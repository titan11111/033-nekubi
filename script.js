(() => {
  'use strict';

  /*
   * 実際にゲームへ接続した現代Web技術 10項目
   * 01 HiDPI Canvas 2D / 02 requestAnimationFrame + fixed timestep
   * 03 OffscreenCanvas cache / 04 Web Worker atmospheric simulation
   * 05 Web Audio dynamic SFX / 06 Pointer Events multi-touch
   * 07 Gamepad API / 08 Web Animations API
   * 09 Page Visibility auto pause / 10 localStorage progression
   * Fullscreen API は追加の表示機能として利用。
   */

  const $ = (id) => document.getElementById(id);
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const gameView = $('game-view');
  const titleScreen = $('title-screen');
  const resultScreen = $('result-screen');
  const pauseLayer = $('pause-layer');
  const notice = $('notice');
  const noticeKicker = $('noticeKicker');
  const noticeText = $('noticeText');
  const stealthBgm = $('stealthBgm');
  const battleBgm = $('battleBgm');

  const WORLD_H = 720;
  let WORLD_W = 3920;
  const GRAVITY = 1520;
  const STEP = 1 / 120;
  const MAX_STEP_ACCUMULATOR = .1;
  const STORAGE_KEY = 'nekubi-five-layers-v3';
  const input = Object.create(null);
  const pressed = new Set();
  const released = new Set();

  let cssW = 1280;
  let cssH = 720;
  let dpr = 1;
  let viewScale = 1;
  let viewWorldW = 1280;
  let state = 'title';
  let paused = false;
  let autoPaused = false;
  let stageIndex = 0;
  let stage = null;
  let platforms = [];
  let enemies = [];
  let objectives = [];
  let projectiles = [];
  let particles = [];
  let floaters = [];
  let cameraX = 0;
  let stageTime = 0;
  let totalTime = 0;
  let alertLevel = 0;
  let alertPulse = 0;
  let spottedThisStep = false;
  let snoreNear = { dist: 9999, heavy: false, pan: 0 };
  let score = 0;
  let stageScoreStart = 0;
  let maxCombo = 0;
  let combo = 0;
  let comboTimer = 0;
  let shake = 0;
  let flash = 0;
  let lastFrame = performance.now();
  let accumulator = 0;
  let lastTap = 0;
  let fogWorker = null;
  let workerFog = [];
  let fogTick = 0;
  let textureCanvas = null;
  let nextStageAction = 'next';

  const saved = (() => {
    try {
      return { unlocked: 1, highScore: 0, muted: false, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch (_) {
      return { unlocked: 1, highScore: 0, muted: false };
    }
  })();

  const STAGES = window.NEKUBI_STAGES;

  const TECH = [
    ['HiDPI Canvas 2D', '端末の画素密度へ合わせ、輪郭と文字を鮮明に描画。', () => true],
    ['Fixed timestep + rAF', '120Hz物理と画面更新を分離し、端末差でジャンプ感が変わりにくい設計。', () => true],
    ['OffscreenCanvas', '石・木・紙の質感を画面外で一度だけ生成し再利用。', () => 'OffscreenCanvas' in window],
    ['Web Worker', '霧粒子の座標計算を別スレッドへ移し、操作遅延を軽減。', () => 'Worker' in window],
    ['Web Audio API', '斬撃・警戒・被弾を低遅延で合成し、BGMと独立制御。', () => !!(window.AudioContext || window.webkitAudioContext)],
    ['Pointer Events', '複数ボタン同時押しと指の追従をsetPointerCaptureで安定化。', () => 'PointerEvent' in window],
    ['Gamepad API', '家庭用コントローラーのスティックとボタンに対応。', () => !!navigator.getGamepads],
    ['Web Animations API', '開始・任務通知・結果画面を滑らかに遷移。', () => !!Element.prototype.animate],
    ['Page Visibility API', 'タブやアプリを離れた瞬間に自動停止し、事故死を防止。', () => 'hidden' in document],
    ['localStorage', '最高戦果・到達階層・音設定を端末内へ保存。', () => 'localStorage' in window]
  ];

  class AudioEngine {
    constructor() {
      this.context = null;
      this.master = null;
      this.muted = !!saved.muted;
      this.current = null;
      this.buzzer = null;
      this.snore = null;
      this.htmlUnlocked = false;
      stealthBgm.loop = true;
      battleBgm.loop = true;
      stealthBgm.volume = .34;
      battleBgm.volume = .38;
      this.updateButton();
    }

    unlock() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this.context) {
        this.context = new AC();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : .72;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      if (!this.silentPlayed) {
        this.silentPlayed = true;
        try {
          const buffer = this.context.createBuffer(1, 1, 22050);
          const source = this.context.createBufferSource();
          source.buffer = buffer;
          source.connect(this.context.destination);
          source.start(0);
        } catch (_) {}
      }
      if (!this.htmlUnlocked) {
        this.htmlUnlocked = true;
        [stealthBgm, battleBgm].forEach((el) => {
          const prev = el.volume;
          el.volume = 0;
          const play = el.play();
          if (play && play.then) play.then(() => { el.pause(); el.currentTime = 0; el.volume = prev; }).catch(() => { el.volume = prev; });
          else el.volume = prev;
        });
      }
    }

    tone(type) {
      if (this.muted) return;
      this.unlock();
      if (!this.context) return;
      const ac = this.context;
      const t = ac.currentTime;
      const cfg = {
        jump: [170, 450, .12, 'triangle', .08], slash: [1180, 90, .1, 'sawtooth', .11],
        hit: [155, 42, .16, 'square', .12], hurt: [95, 34, .27, 'sawtooth', .16],
        throw: [920, 410, .08, 'triangle', .07], collect: [420, 920, .2, 'sine', .09],
        dash: [110, 260, .13, 'sawtooth', .08], alert: [270, 510, .25, 'square', .07],
        clear: [330, 880, .48, 'triangle', .11], empty: [110, 80, .08, 'square', .04],
        tap: [240, 170, .045, 'square', .035]
      }[type] || [220, 180, .1, 'sine', .06];
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const filter = ac.createBiquadFilter();
      osc.type = cfg[3];
      osc.frequency.setValueAtTime(cfg[0], t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, cfg[1]), t + cfg[2]);
      filter.type = 'lowpass';
      filter.frequency.value = type === 'slash' ? 3100 : 1900;
      gain.gain.setValueAtTime(cfg[4], t);
      gain.gain.exponentialRampToValueAtTime(.001, t + cfg[2]);
      osc.connect(filter).connect(gain).connect(this.master || ac.destination);
      osc.start(t);
      osc.stop(t + cfg[2]);
    }

    track(kind) {
      return kind === 'battle' ? battleBgm : stealthBgm;
    }

    play(kind = 'stealth') {
      if (!kind) { this.pause(); this.current = null; return; }
      const next = this.track(kind);
      const other = this.track(kind === 'battle' ? 'stealth' : 'battle');
      other.pause();
      this.current = kind;
      if (this.muted || state === 'title') return;
      if (!next.paused && !next.ended) return;
      next.play().catch(() => {});
    }

    startBuzzer() {
      if (this.muted || this.buzzer) return;
      this.unlock();
      if (!this.context) return;
      const ac = this.context;
      const osc = ac.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 1080;
      const lfo = ac.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 9;
      const depth = ac.createGain();
      depth.gain.value = .12;
      const vol = ac.createGain();
      vol.gain.value = .12;
      lfo.connect(depth);
      depth.connect(vol.gain);
      osc.connect(vol).connect(this.master || ac.destination);
      osc.start();
      lfo.start();
      this.buzzer = { osc, lfo, vol, depth };
    }

    stopBuzzer() {
      if (!this.buzzer) return;
      const { osc, lfo, vol, depth } = this.buzzer;
      this.buzzer = null;
      try {
        lfo.disconnect();
        depth.disconnect();
        const t = this.context.currentTime;
        vol.gain.cancelScheduledValues(t);
        vol.gain.setValueAtTime(.0001, t);
        osc.stop(t + .04);
        lfo.stop(t + .04);
      } catch (_) {}
    }

    setBuzzer(on) {
      if (on && !this.muted && state === 'playing' && !paused) this.startBuzzer();
      else this.stopBuzzer();
    }

    startSnore() {
      if (this.muted || this.snore) return;
      this.unlock();
      if (!this.context) return;
      const ac = this.context;
      const len = Math.floor(ac.sampleRate * .7);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 260;
      const osc = ac.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 86;
      const oscGain = ac.createGain();
      oscGain.gain.value = .4;
      const pulse = ac.createGain();
      pulse.gain.value = .55;
      const lfo = ac.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = .68;
      const lfoDepth = ac.createGain();
      lfoDepth.gain.value = .42;
      const vol = ac.createGain();
      vol.gain.value = .0001;
      const pan = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain();
      lfo.connect(lfoDepth);
      lfoDepth.connect(pulse.gain);
      src.connect(filter);
      filter.connect(pulse);
      osc.connect(oscGain).connect(pulse);
      pulse.connect(vol);
      vol.connect(pan).connect(this.master || ac.destination);
      src.start();
      osc.start();
      lfo.start();
      this.snore = { src, osc, lfo, vol, filter, pan };
    }

    stopSnore() {
      if (!this.snore) return;
      const { src, osc, lfo, vol } = this.snore;
      this.snore = null;
      try {
        const t = this.context.currentTime;
        vol.gain.cancelScheduledValues(t);
        vol.gain.setValueAtTime(.0001, t);
        src.stop(t + .05);
        osc.stop(t + .05);
        lfo.stop(t + .05);
      } catch (_) {}
    }

    setSnore(dist, heavy, panValue) {
      const hear = 340;
      if (this.muted || paused || state !== 'playing' || dist > hear) {
        this.stopSnore();
        return;
      }
      this.startSnore();
      if (!this.snore) return;
      const t = 1 - dist / hear;
      const vol = (heavy ? .3 : .18) * (.22 + t * .78);
      const now = this.context.currentTime;
      this.snore.vol.gain.setTargetAtTime(vol, now, .08);
      this.snore.filter.frequency.setTargetAtTime(heavy ? 190 : 300, now, .1);
      if (this.snore.pan.pan) this.snore.pan.pan.setTargetAtTime(clamp(panValue, -.75, .75), now, .08);
    }

    pause() { stealthBgm.pause(); battleBgm.pause(); this.stopBuzzer(); this.stopSnore(); }
    resume() { if (!this.muted && this.current && state === 'playing') this.play(this.current); }

    syncScene() {
      if (state !== 'playing' || this.muted) return;
      const kind = sceneBgm();
      if (kind !== this.current) this.play(kind);
    }

    toggle() {
      this.muted = !this.muted;
      saved.muted = this.muted;
      persist();
      this.updateButton();
      if (this.master) this.master.gain.value = this.muted ? 0 : .72;
      if (this.muted) this.pause(); else this.resume();
    }

    updateButton() {
      $('muteBtn').textContent = this.muted ? '消' : '音';
      $('muteBtn').setAttribute('aria-label', this.muted ? '音を出す' : '音を消す');
    }
  }

  const audio = new AudioEngine();

  class Player {
    constructor() {
      this.w = 34; this.h = 48;
      this.x = 58; this.y = 560;
      this.vx = 0; this.vy = 0;
      this.facing = 1;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.hp = 4;
      this.shadow = 100;
      this.ammo = 7;
      this.invincible = 0;
      this.attack = 0;
      this.attackCooldown = 0;
      this.dash = 0;
      this.dashCooldown = 0;
      this.hidden = false;
      this.trail = [];
    }

    reset() {
      this.x = 58; this.y = 560; this.vx = 0; this.vy = 0;
      this.hp = 4; this.shadow = 100; this.ammo = stage?.assist?.ammo || 7;
      this.invincible = 0; this.attack = 0; this.dash = 0; this.trail.length = 0;
    }

    update(dt) {
      const left = isDown('ArrowLeft', 'KeyA') || gamepad.axis < -.24;
      const right = isDown('ArrowRight', 'KeyD') || gamepad.axis > .24;
      const down = isDown('ArrowDown', 'KeyS');
      const axis = (right ? 1 : 0) - (left ? 1 : 0) || gamepad.axis;
      if (axis) this.facing = Math.sign(axis);

      this.coyote = this.grounded ? .095 : Math.max(0, this.coyote - dt);
      this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
      this.invincible = Math.max(0, this.invincible - dt);
      this.attack = Math.max(0, this.attack - dt);
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
      this.dash = Math.max(0, this.dash - dt);
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);

      if (wasPressed('Space', 'ArrowUp', 'KeyW', 'GamepadJump')) this.jumpBuffer = .12;
      if (this.jumpBuffer > 0 && this.coyote > 0) {
        this.vy = -625;
        this.grounded = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        audio.tone('jump');
      }

      if (wasPressed('KeyZ', 'KeyJ', 'GamepadSlash')) this.slash();
      if (wasPressed('KeyX', 'KeyK', 'GamepadThrow')) this.throwShuriken();
      if (wasPressed('ShiftLeft', 'ShiftRight', 'GamepadDash')) this.shadowDash();

      const inShadow = stage.shadows.some((s) => overlap(this.x, this.y, this.w, this.h, s[0], s[1], s[2], s[3]));
      this.hidden = down && this.grounded && inShadow;
      const accel = this.hidden ? 520 : 1250;
      const maxSpeed = this.hidden ? 92 : 265;

      if (this.dash > 0) {
        this.vx = this.facing * 720;
        this.vy *= .88;
        this.trail.unshift({ x: this.x, y: this.y, life: .28 });
        if (this.trail.length > 10) this.trail.pop();
      } else {
        this.vx += axis * accel * dt;
        this.vx *= Math.pow(this.grounded ? .0018 : .03, dt);
        this.vx = clamp(this.vx, -maxSpeed, maxSpeed);
      }

      const shadowRegen = stage.assist?.shadowRegen || 1;
      this.shadow = clamp(this.shadow + (this.hidden ? 21 : 9) * shadowRegen * dt, 0, 100);
      this.vy += GRAVITY * dt;
      const oldY = this.y;
      this.x += this.vx * dt;
      this.x = clamp(this.x, 0, WORLD_W - this.w);
      this.y += this.vy * dt;
      this.grounded = false;

      for (const p of platforms) {
        if (this.x + this.w > p.x && this.x < p.x + p.w && oldY + this.h <= p.y + 8 && this.y + this.h >= p.y && this.vy >= 0) {
          this.y = p.y - this.h;
          this.vy = 0;
          this.grounded = true;
        }
      }

      if (this.y > WORLD_H + 90) this.hurt(1, this.x + 100, true);
      this.checkHazards();
      this.trail.forEach((t) => { t.life -= dt; });
      this.trail = this.trail.filter((t) => t.life > 0);
    }

    slash() {
      if (this.attackCooldown > 0) return;
      this.attack = .16;
      this.attackCooldown = .25;
      this.vx += this.facing * 55;
      audio.tone('slash');
      const boxX = this.facing > 0 ? this.x + this.w - 4 : this.x - 66;
      let hit = false;
      for (const enemy of enemies) {
        if (!enemy.dead && overlap(boxX, this.y - 8, 70, this.h + 16, enemy.x, enemy.y, enemy.w, enemy.h)) {
          const neckCut = enemy.type === 'boss' && enemy.sleeping;
          damageEnemy(enemy, neckCut ? enemy.maxHp : 1, this.facing, neckCut);
          hit = true;
        }
      }
      for (const obj of objectives) {
        if (!obj.done && obj.type !== 'scroll' && overlap(boxX, this.y - 8, 70, this.h + 16, obj.x - 18, obj.y - 50, 36, 55)) {
          completeObjective(obj);
          hit = true;
        }
      }
      if (hit) registerCombo();
    }

    throwShuriken() {
      if (this.attackCooldown > 0) return;
      if (this.ammo <= 0) { audio.tone('empty'); showNotice('武具', '手裏剣が尽きた。斬撃で道を開け。'); return; }
      this.ammo -= 1;
      this.attackCooldown = .2;
      projectiles.push({ owner: 'player', x: this.x + this.w / 2, y: this.y + 18, vx: this.facing * 720, vy: 0, r: 10.5, life: 1.5, rotation: 0 });
      audio.tone('throw');
    }

    shadowDash() {
      const dashCost = stage.assist?.dashCost || 24;
      if (this.dashCooldown > 0 || this.shadow < dashCost) return;
      this.shadow -= dashCost;
      this.dash = .15;
      this.dashCooldown = .38;
      this.invincible = Math.max(this.invincible, .17);
      audio.tone('dash');
      vibrate(18);
    }

    checkHazards() {
      for (const h of stage.hazards) {
        if (!overlap(this.x, this.y, this.w, this.h, h[0], 610, h[1], 36)) continue;
        if (h[2] === 'bell') {
          if (this.grounded && Math.abs(this.vx) > 45) {
            alertLevel = Math.max(alertLevel, 72);
            enemies.forEach((e) => { e.sleeping = false; e.alerted = true; });
            alertPulse = .6;
          }
        } else if (h[2] === 'water') {
          this.vx *= .76;
          if (Math.abs(this.vx) > 110) alertLevel = Math.min(100, alertLevel + .13);
        } else {
          this.hurt(1, h[0] + h[1] / 2);
        }
      }
    }

    hurt(amount, sourceX, respawn = false) {
      if (this.invincible > 0 || state !== 'playing') return;
      this.hp -= amount;
      this.invincible = stage.assist?.invincible || 1.1;
      this.hidden = false;
      this.vx = this.x < sourceX ? -310 : 310;
      this.vy = -420;
      shake = 15;
      flash = .15;
      combo = 0;
      audio.tone('hurt');
      vibrate([28, 20, 42]);
      burst(this.x + this.w / 2, this.y + 20, '#c83c30', 14, 200);
      if (respawn) { this.x = Math.max(35, cameraX + 70); this.y = 420; }
      if (this.hp <= 0) setTimeout(() => finishRun(false), 260);
    }

    draw() {
      for (const trail of this.trail) drawNinja(trail.x, trail.y, this.facing, clamp(trail.life / .28, 0, .48), false);
      if (this.invincible > 0 && Math.floor(this.invincible * 16) % 2) return;
      drawNinja(this.x, this.y, this.facing, this.hidden ? .62 : 1, this.attack > 0);
    }
  }

  const player = new Player();

  function buildEnemy(spec, index) {
    const p = platforms[spec.p];
    const type = spec.type || 'guard';
    const size = type === 'boss' ? [72, 52] : type === 'samurai' ? [42, 56] : type === 'scout' ? [32, 46] : [34, 48];
    const hp = type === 'boss' ? 10 : type === 'samurai' ? 3 : type === 'archer' ? 2 : type === 'scout' ? 2 : 2;
    return {
      x: spec.x, y: p.y - size[1], w: size[0], h: size[1], type, platform: spec.p,
      origin: spec.x, range: Math.min(type === 'scout' ? 180 : 140, p.w * .42), facing: index % 2 ? 1 : -1,
      hp, maxHp: hp, vy: 0, grounded: true,
      alerted: false, sleeping: !!spec.sleeping, deepSleep: !!spec.deepSleep, dead: false, hit: 0, attackCooldown: .5 + index * .1,
      shootCooldown: 1.4 + index * .13, vx: 0, snore: index * .7
    };
  }

  function platformAhead(e, nextX) {
    const feetY = e.y + e.h;
    return platforms.some((p) => nextX + e.w > p.x + 8 && nextX < p.x + p.w - 8 && feetY <= p.y + 10 && feetY >= p.y - 14);
  }

  function landEnemy(e, oldY, dt) {
    e.grounded = false;
    e.vy += GRAVITY * dt;
    e.y += e.vy * dt;
    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      if (e.x + e.w > p.x && e.x < p.x + p.w && oldY + e.h <= p.y + 8 && e.y + e.h >= p.y && e.vy >= 0) {
        e.y = p.y - e.h;
        e.vy = 0;
        e.grounded = true;
        e.platform = i;
      }
    }
    if (e.y > WORLD_H + 80) e.dead = true;
  }

  function turnAtEdge(e, nextX) {
    if (nextX <= 4) { e.x = 4; e.facing = 1; e.vx = Math.abs(e.vx); return true; }
    if (nextX + e.w >= WORLD_W - 4) { e.x = WORLD_W - e.w - 4; e.facing = -1; e.vx = -Math.abs(e.vx); return true; }
    if (e.grounded && !platformAhead(e, nextX)) {
      e.facing *= -1;
      e.vx = 0;
      return true;
    }
    return false;
  }

  function updateEnemy(e, dt) {
    if (e.dead) return;
    e.hit = Math.max(0, e.hit - dt);
    e.attackCooldown = Math.max(0, e.attackCooldown - dt);
    e.shootCooldown -= dt;
    e.snore += dt;
    const oldY = e.y;
    const dx = player.x - e.x;
    const dy = Math.abs((player.y + player.h / 2) - (e.y + e.h / 2));
    const visionScale = stage.assist?.vision || 1;
    const vision = (e.type === 'boss' ? 300 : e.type === 'archer' ? 420 : e.type === 'scout' ? 340 : 280) * visionScale;
    const facingPlayer = dx * e.facing > -80;
    const sees = !player.hidden && player.dash <= 0 && facingPlayer && Math.abs(dx) < vision && dy < 130;
    if (sees) spottedThisStep = true;
    if (e.sleeping) {
      const dist = Math.hypot(dx, player.y - e.y);
      if (dist < snoreNear.dist) {
        snoreNear = { dist, heavy: e.type === 'boss' || e.deepSleep, pan: (e.x - player.x) / 380 };
      }
    }

    if (e.type === 'boss' && e.sleeping) {
      const close = Math.abs(dx) < 120 && dy < 72 && (!player.hidden || Math.abs(dx) < 40);
      if (close || alertLevel > 38) {
        e.sleeping = false;
        e.alerted = true;
        alertPulse = .5;
        spottedThisStep = true;
        showNotice('覚醒', '殿が目を覚ました。');
        audio.syncScene();
      } else {
        landEnemy(e, oldY, dt);
        return;
      }
    }

    if (e.sleeping && e.deepSleep && e.type !== 'boss') {
      landEnemy(e, oldY, dt);
      if (overlap(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h) && !player.hidden) {
        e.sleeping = false;
        e.alerted = true;
        alertPulse = .4;
        spottedThisStep = true;
        showNotice('覚醒', '寝入っていた兵が目を覚ました。');
        audio.syncScene();
      } else {
        return;
      }
    }

    if (e.sleeping && !sees && alertLevel < 48) {
      if (!player.hidden && Math.abs(dx) < 96 && dy < 70) {
        e.sleeping = false;
        e.alerted = true;
        alertPulse = .35;
        spottedThisStep = true;
      } else {
        landEnemy(e, oldY, dt);
        return;
      }
    }
    if (sees || alertLevel > 58) {
      if (!e.alerted) { e.alerted = true; alertPulse = .4; audio.syncScene(); }
      e.sleeping = false;
      const alertScale = stage.assist?.alert || 1;
      alertLevel = clamp(alertLevel + (e.type === 'boss' ? 16 : 22) * alertScale * dt, 0, 100);
      e.facing = Math.sign(dx) || e.facing;
      if (e.type === 'archer' && e.shootCooldown <= 0 && Math.abs(dx) > 60 && e.grounded) {
        projectiles.push({ owner: 'enemy', x: e.x + e.w / 2, y: e.y + 20, vx: Math.sign(dx) * 420, vy: 0, r: 6, life: 3, rotation: 0 });
        e.shootCooldown = 1.15;
      }
      const speedScale = stage.assist?.enemySpeed || 1;
      if (e.type === 'archer') e.vx *= .7;
      else if (Math.abs(dx) > 38) e.vx = Math.sign(dx) * (e.type === 'boss' ? 128 : e.type === 'scout' ? 148 : e.type === 'samurai' ? 118 : 96) * speedScale;
      else e.vx *= .82;
    } else {
      e.alerted = false;
      if (!player.hidden && Math.abs(dx) < 150 && dy < 90) e.facing = Math.sign(dx) || e.facing;
      if (e.type === 'archer') {
        e.vx = 0;
      } else {
        const patrol = e.type === 'scout' ? 96 : e.type === 'samurai' ? 78 : 68;
        e.vx = e.facing * patrol * (stage.assist?.enemySpeed || 1);
      }
    }

    const canDrop = e.type === 'samurai' && e.alerted && player.y > e.y + 18;
    const nextX = e.x + e.vx * dt;
    if (!(canDrop && e.grounded && !platformAhead(e, nextX))) turnAtEdge(e, nextX);
    e.x = clamp(e.x + e.vx * dt, 0, WORLD_W - e.w);
    landEnemy(e, oldY, dt);

    if (overlap(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h) && e.attackCooldown <= 0 && !e.sleeping) {
      player.hurt(e.type === 'boss' ? 4 : 1, e.x + e.w / 2);
      e.attackCooldown = e.type === 'boss' ? .72 : .95;
    }
  }

  function damageEnemy(e, amount, direction, neckCut = false) {
    if (e.dead || e.hit > 0) return;
    e.hp -= amount;
    e.hit = .16;
    e.x += direction * 12;
    e.vy = -80;
    e.sleeping = false;
    e.alerted = true;
    alertLevel = Math.min(100, alertLevel + (neckCut ? 4 : 8));
    burst(e.x + e.w / 2, e.y + e.h / 2, neckCut ? '#f2d36a' : stage.palette.accent, neckCut ? 22 : 9, neckCut ? 240 : 155);
    audio.tone('hit');
    shake = Math.max(shake, neckCut ? 12 : 5);
    if (neckCut) showNotice('天誅', '眠る殿の首を掻いた。');
    if (e.hp <= 0) {
      e.dead = true;
      score += e.type === 'boss' ? 5000 : e.type === 'samurai' ? 700 : e.type === 'scout' ? 500 : 400;
      registerCombo();
      if (e.type === 'boss') {
        completeFinalObjective();
        audio.play('battle');
      }
    }
    audio.syncScene();
  }

  function sceneBgm() {
    if (state !== 'playing') return audio.current;
    if (stageIndex <= 2) return 'stealth';
    if (stageIndex === 3) return alertLevel > 58 ? 'battle' : 'stealth';
    const boss = enemies.find((e) => e.type === 'boss');
    if (boss && !boss.dead && boss.sleeping && alertLevel < 45) return 'stealth';
    return 'battle';
  }

  function setupStage(index) {
    stageIndex = index;
    stage = STAGES[index];
    WORLD_W = stage.platforms[0][2];
    platforms = stage.platforms.map((p) => ({ x:p[0], y:p[1], w:p[2], h:p[3] }));
    enemies = stage.enemies.map(buildEnemy);
    objectives = stage.objectives.map((o, i) => {
      const p = platforms[o.p];
      return { ...o, id:i, y:p.y, done:false, pulse:i * .7 };
    });
    projectiles.length = 0;
    particles.length = 0;
    floaters.length = 0;
    player.reset();
    cameraX = 0;
    stageTime = 0;
    alertLevel = 0;
    combo = 0;
    comboTimer = 0;
    stageScoreStart = score;
    spottedThisStep = false;
    audio.stopBuzzer();
    audio.stopSnore();
    state = 'playing';
    paused = false;
    pauseLayer.classList.add('hidden');
    resultScreen.classList.add('hidden');
    updateHud();
    updateRoute();
    showNotice(stage.short, stage.intro);
    audio.play(sceneBgm());
  }

  function prepareTitleStage() {
    stage = STAGES[0];
    WORLD_W = stage.platforms[0][2];
    platforms = stage.platforms.map((p) => ({ x:p[0], y:p[1], w:p[2], h:p[3] }));
    enemies = stage.enemies.map(buildEnemy);
    objectives = stage.objectives.map((o, i) => {
      const platform = platforms[o.p];
      return { ...o, id:i, y:platform.y, done:false, pulse:i * .7 };
    });
    player.reset();
  }

  function completeObjective(obj) {
    if (obj.done) return;
    obj.done = true;
    score += obj.type === 'scroll' ? 800 : 600;
    audio.tone('collect');
    vibrate([15, 20, 25]);
    burst(obj.x, obj.y - 28, stage.palette.accent, 20, 190);
    floaters.push({ x:obj.x, y:obj.y - 60, text:`${obj.type} 解`, life:1.2, color:stage.palette.accent });
    updateHud();
    if (objectives.every((o) => o.done)) showNotice('突破口', '城門の封が解けた。右端へ進め。');
  }

  function completeFinalObjective() {
    showNotice('決着', '殿を討った。天守の端へ進め。');
    updateHud();
  }

  function objectiveProgress() {
    if (stageIndex === 4) {
      const boss = enemies.find((e) => e.type === 'boss');
      return boss && boss.dead ? 1 : 0;
    }
    return objectives.filter((o) => o.done).length;
  }

  function objectiveComplete() { return objectiveProgress() >= stage.objectiveTotal; }

  function updateProjectiles(dt) {
    for (const p of projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.owner === 'enemy' ? 115 : 0) * dt;
      p.rotation += dt * 14;
      p.life -= dt;
      if (p.owner === 'player') {
        for (const e of enemies) {
          if (!e.dead && overlap(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2, e.x, e.y, e.w, e.h)) {
            damageEnemy(e, 1, Math.sign(p.vx));
            p.life = 0;
            break;
          }
        }
        for (const o of objectives) {
          if (!o.done && o.type !== 'scroll' && Math.hypot(p.x - o.x, p.y - (o.y - 28)) < 30) {
            completeObjective(o); p.life = 0; break;
          }
        }
      } else if (overlap(p.x-p.r,p.y-p.r,p.r*2,p.r*2,player.x,player.y,player.w,player.h)) {
        player.hurt(1, p.x); p.life = 0;
      }
      if (p.x < -30 || p.x > WORLD_W + 30 || p.y > WORLD_H + 40) p.life = 0;
    }
    projectiles = projectiles.filter((p) => p.life > 0);
  }

  function updateObjectives() {
    for (const o of objectives) {
      o.pulse += STEP;
      if (!o.done && o.type === 'scroll' && overlap(player.x,player.y,player.w,player.h,o.x-18,o.y-54,36,54)) completeObjective(o);
    }
    const door = stage.exit;
    if (objectiveComplete() && player.x + player.w > door.x - 20) completeStage();
  }

  function completeStage() {
    if (state !== 'playing') return;
    state = 'stageclear';
    paused = false;
    audio.pause();
    audio.tone('clear');
    const final = stageIndex === STAGES.length - 1;
    saved.unlocked = Math.max(saved.unlocked, Math.min(5, stageIndex + 2));
    saved.highScore = Math.max(saved.highScore, score);
    persist();
    $('resultKicker').textContent = final ? 'ALL MISSIONS COMPLETE' : 'LAYER COMPLETE';
    $('resultTitle').textContent = final ? '暁ニ消ユ' : `${stage.short} 突破`;
    $('resultBody').textContent = final ? '五層の警戒網は崩れた。影は名を残さず、朝霧へ消えた。' : `${stage.name}を攻略。次は${STAGES[stageIndex + 1].name}。`;
    $('resultScore').textContent = String(score).padStart(6, '0');
    $('resultCombo').textContent = maxCombo;
    $('nextBtn').textContent = final ? 'もう一度挑む' : '次の階層へ';
    nextStageAction = final ? 'restart' : 'next';
    resultScreen.classList.remove('hidden');
    resultScreen.animate?.([{opacity:0},{opacity:1}], {duration:480,easing:'ease-out'});
  }

  function finishRun(success) {
    if (state !== 'playing') return;
    state = success ? 'win' : 'gameover';
    audio.pause();
    saved.highScore = Math.max(saved.highScore, score);
    persist();
    $('resultKicker').textContent = success ? 'MISSION COMPLETE' : 'MISSION FAILED';
    $('resultTitle').textContent = success ? '忍務完遂' : '無念';
    $('resultBody').textContent = success ? '城を落としました。' : `${stage.name}から再開できます。警戒より先に影へ入ってください。`;
    $('resultScore').textContent = String(score).padStart(6, '0');
    $('resultCombo').textContent = maxCombo;
    $('nextBtn').textContent = 'この階層を再挑戦';
    nextStageAction = 'retry';
    resultScreen.classList.remove('hidden');
  }

  function fixedUpdate(dt) {
    if (state !== 'playing' || paused) return;
    totalTime += dt;
    stageTime += dt;
    spottedThisStep = false;
    snoreNear = { dist: 9999, heavy: false, pan: 0 };
    player.update(dt);
    enemies.forEach((e) => updateEnemy(e, dt));
    audio.setBuzzer(spottedThisStep);
    audio.setSnore(spottedThisStep ? 9999 : snoreNear.dist, snoreNear.heavy, snoreNear.pan);
    updateProjectiles(dt);
    updateObjectives();
    updateParticles(dt);
    alertLevel = clamp(alertLevel - (player.hidden ? 14 : 5) * dt, 0, 100);
    alertPulse = Math.max(0, alertPulse - dt);
    comboTimer = Math.max(0, comboTimer - dt);
    if (comboTimer <= 0) combo = 0;
    shake *= Math.pow(.015, dt);
    flash = Math.max(0, flash - dt);
    const targetCamera = clamp(player.x - viewWorldW * .34, 0, Math.max(0, WORLD_W - viewWorldW));
    cameraX += (targetCamera - cameraX) * Math.min(1, dt * 5.8);
    fogTick += dt;
    if (fogWorker && fogTick > .15) { fogTick = 0; fogWorker.postMessage({ t:totalTime, stage:stageIndex }); }
    audio.syncScene();
    updateHud();
    clearTransientInputs();
  }

  function updateParticles(dt) {
    for (const p of particles) { p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 220*dt; p.life -= dt; }
    particles = particles.filter((p) => p.life > 0);
    for (const f of floaters) { f.y -= 28*dt; f.life -= dt; }
    floaters = floaters.filter((f) => f.life > 0);
  }

  function registerCombo() {
    combo += 1;
    comboTimer = 1.05;
    maxCombo = Math.max(maxCombo, combo);
    if (combo > 1) {
      score += combo * 75;
      floaters.push({ x:player.x + 20, y:player.y - 18, text:`${combo} 連`, life:.8, color:'#ffe092' });
    }
  }

  function burst(x, y, color, count, speed) {
    for (let i=0;i<count;i++) {
      const a = Math.random()*Math.PI*2;
      const s = speed*(.25+Math.random()*.75);
      particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.3+Math.random()*.45,max:.75,color,size:2+Math.random()*4});
    }
  }

  function render() {
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle = '#080b0d';
    ctx.fillRect(0,0,cssW,cssH);
    ctx.save();
    ctx.scale(viewScale, viewScale);
    const sw = viewWorldW;
    const sx = shake > .5 ? (Math.random()-.5)*shake : 0;
    const sy = shake > .5 ? (Math.random()-.5)*shake*.5 : 0;
    ctx.translate(sx, sy);
    drawBackground(sw);
    ctx.save();
    ctx.translate(-cameraX, 0);
    drawWorld();
    ctx.restore();
    drawForeground(sw);
    if (flash > 0) { ctx.fillStyle=`rgba(235,66,47,${flash*.8})`; ctx.fillRect(0,0,sw,WORLD_H); }
    ctx.restore();
  }

  function drawBackground(sw) {
    if (!stage) stage = STAGES[0];
    const p = stage.palette;
    const sky = ctx.createLinearGradient(0,0,0,WORLD_H);
    sky.addColorStop(0,p.skyA); sky.addColorStop(.62,p.skyB); sky.addColorStop(1,p.horizon);
    ctx.fillStyle=sky; ctx.fillRect(0,0,sw,WORLD_H);

    const moonX = stageIndex === 4 ? sw*.22 : sw*.76;
    const moonY = stageIndex === 0 ? 128 : 98;
    const moonR = stageIndex === 4 ? 58 : 70;
    const mx = moonX - cameraX * .035;
    const glow = ctx.createRadialGradient(mx, moonY, moonR * .2, mx, moonY, moonR * 2.4);
    glow.addColorStop(0, 'rgba(255, 214, 64, .55)');
    glow.addColorStop(.45, 'rgba(232, 176, 42, .18)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(mx, moonY, moonR * 2.4, 0, Math.PI * 2); ctx.fill();
    const moon = ctx.createRadialGradient(mx - 14, moonY - 12, 6, mx, moonY, moonR);
    moon.addColorStop(0, '#fff6b8');
    moon.addColorStop(.38, '#f4d035');
    moon.addColorStop(1, '#c48912');
    ctx.fillStyle = moon;
    ctx.beginPath(); ctx.arc(mx, moonY, moonR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(176, 118, 24, .28)';
    ctx.beginPath(); ctx.arc(mx + 16, moonY - 10, 11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx - 20, moonY + 14, 8, 0, Math.PI * 2); ctx.fill();
    drawMoonClouds(sw, moonY);

    if (stageIndex === 0) drawWilderness(sw);
    else if (stageIndex === 1) drawBarracks(sw);
    else if (stageIndex === 2) drawStoneMidway(sw);
    else if (stageIndex === 3) drawTopFloor(sw);
    else drawKeepRoof(sw);

    for (const f of workerFog) {
      ctx.globalAlpha=f.a;
      ctx.fillStyle=p.accent;
      ctx.beginPath();ctx.ellipse(f.x*sw,(.58+f.y*.34)*WORLD_H,f.w,18+f.w*.08,0,0,Math.PI*2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  function drawMoonClouds(sw, moonY) {
    for (let i = 0; i < 5; i++) {
      const drift = ((totalTime * (18 + i * 7) + i * 240) % (sw + 420)) - 210;
      const cy = moonY - 18 + (i % 3) * 22;
      const cw = 78 + (i % 4) * 28;
      const ch = 22 + (i % 3) * 8;
      ctx.fillStyle = `rgba(18, 22, 32, ${.42 + (i % 3) * .12})`;
      ctx.beginPath();
      ctx.ellipse(drift, cy, cw, ch, 0, 0, Math.PI * 2);
      ctx.ellipse(drift + cw * .45, cy + 4, cw * .7, ch * .85, 0, 0, Math.PI * 2);
      ctx.ellipse(drift - cw * .4, cy + 6, cw * .55, ch * .7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWilderness(sw) {
    ctx.fillStyle='rgba(12,16,22,.82)';
    mountainRange(sw, 365, 80, .07);
    ctx.fillStyle='#0a1016';
    mountainRange(sw, 465, 120, .13);
    const castleX=sw*.7-cameraX*.09;
    drawCastleSilhouette(castleX,245,320,320);
    const haze=ctx.createLinearGradient(0,470,0,WORLD_H);
    haze.addColorStop(0,'transparent');
    haze.addColorStop(1,'rgba(210,140,58,.22)');
    ctx.fillStyle=haze;ctx.fillRect(0,470,sw,WORLD_H-470);
    ctx.fillStyle='rgba(214,132,58,.55)';
    for(let x=-40;x<sw+60;x+=26){const h=28+((x*13)%47+47)%47;ctx.fillRect(x,620-h,3,h);ctx.beginPath();ctx.moveTo(x+2,620-h*.6);ctx.lineTo(x-10,620-h);ctx.lineTo(x+2,620-h*.8);ctx.fill();}
  }

  function drawBarracks(sw) {
    ctx.fillStyle='#15100e';ctx.fillRect(0,210,sw,WORLD_H-210);
    ctx.fillStyle='#36251b';
    for(let x=(-cameraX*.1%270)-30;x<sw+270;x+=270){ctx.fillRect(x,210,18,440);ctx.fillRect(x-22,246,64,18);}
    ctx.fillStyle='rgba(225,159,79,.08)';
    for(let x=120;x<sw;x+=300){const g=ctx.createRadialGradient(x,310,0,x,310,160);g.addColorStop(0,'rgba(241,154,62,.18)');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-160,150,320,320);}
    ctx.strokeStyle='rgba(208,171,102,.16)';ctx.lineWidth=5;
    for(let x=80;x<sw;x+=250){ctx.beginPath();ctx.moveTo(x,420);ctx.lineTo(x+75,330);ctx.moveTo(x+75,330);ctx.lineTo(x+87,420);ctx.stroke();}
  }

  function drawStoneMidway(sw) {
    ctx.fillStyle='rgba(7,18,17,.42)';drawCastleSilhouette(sw*.62-cameraX*.06,65,510,560);
    if(textureCanvas){ctx.globalAlpha=.24;const pattern=ctx.createPattern(textureCanvas,'repeat');ctx.fillStyle=pattern;ctx.fillRect(0,220,sw,500);ctx.globalAlpha=1;}
    ctx.strokeStyle='rgba(132,187,160,.12)';ctx.lineWidth=2;
    for(let y=260;y<WORLD_H;y+=52){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(sw,y);ctx.stroke();}
  }

  function drawTopFloor(sw) {
    ctx.fillStyle='#171116';ctx.fillRect(0,198,sw,WORLD_H-198);
    ctx.fillStyle='rgba(238,210,186,.12)';
    for(let x=(-cameraX*.12%240)-60;x<sw+250;x+=240){ctx.fillRect(x,198,208,372);ctx.fillStyle='rgba(74,35,42,.45)';ctx.fillRect(x+98,198,8,372);for(let y=255;y<560;y+=82)ctx.fillRect(x,y,208,6);ctx.fillStyle='rgba(238,210,186,.12)';}
    ctx.fillStyle='rgba(255,124,143,.08)';ctx.fillRect(0,510,sw,120);
  }

  function drawKeepRoof(sw) {
    ctx.fillStyle='rgba(10,13,20,.65)'; mountainRange(sw,400,100,.04);
    ctx.fillStyle='#11141a'; mountainRange(sw,500,85,.1);
    ctx.fillStyle='#080b0e';drawCastleSilhouette(sw*.54-cameraX*.075,120,570,520);
    ctx.strokeStyle='rgba(255,206,113,.24)';ctx.lineWidth=2;
    for(let i=0;i<35;i++){const x=(i*109+totalTime*26)% (sw+100)-50;const y=90+(i*67)%420;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-18,y+5);ctx.stroke();}
  }

  function mountainRange(sw, base, variance, parallax) {
    ctx.beginPath();ctx.moveTo(0,WORLD_H);ctx.lineTo(0,base);
    for(let x=0;x<=sw+130;x+=130){const worldX=x+cameraX*parallax;const y=base-Math.abs(Math.sin(worldX*.007))*variance-Math.abs(Math.cos(worldX*.014))*variance*.5;ctx.lineTo(x,y);}
    ctx.lineTo(sw,WORLD_H);ctx.closePath();ctx.fill();
  }

  function drawCastleSilhouette(x,y,w,h) {
    ctx.save();ctx.translate(x,y);ctx.fillStyle='#090c0d';
    ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(w,h);ctx.lineTo(w*.92,h*.55);ctx.lineTo(w*.78,h*.52);ctx.lineTo(w*.86,h*.4);ctx.lineTo(w*.72,h*.37);ctx.lineTo(w*.78,h*.25);ctx.lineTo(w*.64,h*.22);ctx.lineTo(w*.68,h*.1);ctx.lineTo(w*.51,0);ctx.lineTo(w*.34,h*.1);ctx.lineTo(w*.38,h*.22);ctx.lineTo(w*.22,h*.25);ctx.lineTo(w*.28,h*.37);ctx.lineTo(w*.12,h*.4);ctx.lineTo(w*.18,h*.52);ctx.lineTo(w*.05,h*.55);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(225,149,62,.28)';for(let yy=h*.3;yy<h*.72;yy+=65){for(let xx=w*.31;xx<w*.72;xx+=70)ctx.fillRect(xx,yy,12,6);}ctx.restore();
  }

  function drawWorld() {
    drawShadows();
    drawPlatforms();
    drawHazards();
    if (stage.gates) drawGates();
    objectives.forEach(drawObjective);
    drawExit();
    enemies.forEach(drawEnemy);
    projectiles.forEach(drawProjectile);
    particles.forEach(drawParticle);
    player.draw();
    floaters.forEach(drawFloater);
  }

  function drawShadows() {
    for (const s of stage.shadows) {
      const g=ctx.createLinearGradient(s[0],0,s[0]+s[2],0);g.addColorStop(0,'transparent');g.addColorStop(.2,'rgba(3,8,9,.48)');g.addColorStop(.8,'rgba(3,8,9,.48)');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(s[0],s[1],s[2],s[3]);
      ctx.fillStyle='rgba(150,210,170,.38)';for(let x=s[0]+8;x<s[0]+s[2];x+=13){const h=18+(x*7)%20;ctx.fillRect(x,s[1]+s[3]-h,2,h);}
    }
  }

  function drawPlatforms() {
    for (const p of platforms) {
      ctx.fillStyle=stage.palette.ground;roundRect(p.x,p.y,p.w,p.h,5);ctx.fill();
      if(textureCanvas){ctx.save();ctx.globalAlpha=.13;ctx.beginPath();ctx.rect(p.x,p.y,p.w,p.h);ctx.clip();const pattern=ctx.createPattern(textureCanvas,'repeat');ctx.fillStyle=pattern;ctx.fillRect(p.x,p.y,p.w,p.h);ctx.restore();}
      ctx.strokeStyle='rgba(18,12,8,.7)';ctx.lineWidth=2;roundRect(p.x,p.y,p.w,p.h,5);ctx.stroke();
      ctx.fillStyle=stage.palette.edge;ctx.globalAlpha=.92;ctx.fillRect(p.x,p.y,p.w,4);ctx.globalAlpha=1;
      if(stageIndex===4){ctx.strokeStyle='rgba(221,169,78,.26)';ctx.lineWidth=3;for(let x=p.x+16;x<p.x+p.w;x+=38){ctx.beginPath();ctx.moveTo(x,p.y+4);ctx.lineTo(x+18,p.y+p.h);ctx.stroke();}}
    }
  }

  function drawHazards() {
    for(const h of stage.hazards){
      const [x,w,type]=h;
      if(type==='bell') {ctx.fillStyle='#8f6a38';ctx.beginPath();ctx.arc(x+w/2,625,13,Math.PI,0);ctx.fill();ctx.fillRect(x+w/2-2,625,4,15);}
      else if(type==='water'){ctx.fillStyle='rgba(86,181,172,.35)';ctx.fillRect(x,625,w,21);ctx.strokeStyle='rgba(159,231,213,.55)';for(let xx=x;xx<x+w;xx+=18){ctx.beginPath();ctx.arc(xx,628,12,Math.PI,Math.PI*2);ctx.stroke();}}
      else {ctx.fillStyle=type==='thorns'?'#695132':'#8c7971';for(let xx=x;xx<x+w;xx+=13){ctx.beginPath();ctx.moveTo(xx,646);ctx.lineTo(xx+7,613);ctx.lineTo(xx+14,646);ctx.fill();}}
    }
  }

  function drawGates() {
    for(let i=0;i<stage.gates.length;i++){
      const x=stage.gates[i];const closed=Math.sin(stageTime*1.25+i*1.7)>.15;
      ctx.globalAlpha=closed?.62:.12;ctx.fillStyle='#e8d5cc';ctx.fillRect(x,260,24,386);ctx.strokeStyle=stage.palette.accent;ctx.lineWidth=2;ctx.strokeRect(x,260,24,386);ctx.globalAlpha=1;
      if(closed&&overlap(player.x,player.y,player.w,player.h,x,260,24,386)){player.x=player.x<x?x-player.w:x+25;player.vx=0;}
    }
  }

  function drawObjective(o) {
    if(o.done) return;
    const y=o.y-28+Math.sin(o.pulse*3)*3;
    ctx.save();ctx.translate(o.x,y);
    ctx.shadowColor=stage.palette.accent;ctx.shadowBlur=18;ctx.fillStyle=stage.palette.accent;
    if(o.type==='scroll'){ctx.rotate(-.08);ctx.fillRect(-15,-18,30,36);ctx.fillStyle='#3d2b1d';ctx.fillRect(-11,-13,22,2);ctx.fillRect(-11,-4,18,2);ctx.fillRect(-11,5,20,2);ctx.fillStyle='#b32921';ctx.fillRect(5,8,7,7);}
    else if(o.type==='brazier'){ctx.fillStyle='#7a4a28';ctx.fillRect(-17,2,34,18);ctx.fillStyle='#f0a040';ctx.beginPath();ctx.moveTo(-12,3);ctx.quadraticCurveTo(-4,-32,3,-7);ctx.quadraticCurveTo(17,-30,13,4);ctx.fill();}
    else if(o.type==='seal'){ctx.strokeStyle=stage.palette.accent;ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#d6e7d8';ctx.fillRect(-5,-18,10,36);ctx.fillRect(-17,-5,34,10);}
    else {ctx.fillStyle='#3c252d';ctx.fillRect(-9,-45,18,50);ctx.strokeStyle=stage.palette.accent;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-22,-38);ctx.lineTo(0,-52);ctx.lineTo(22,-38);ctx.lineTo(0,-22);ctx.closePath();ctx.stroke();}
    ctx.restore();
  }

  function drawExit() {
    const x=stage.exit.x, p=platforms[stage.exit.p];
    const open=objectiveComplete();
    ctx.save();ctx.translate(x,p.y);
    ctx.fillStyle=open?stage.palette.accent:'#221d1b';ctx.globalAlpha=open?.2:.7;ctx.fillRect(-35,-92,70,92);ctx.globalAlpha=1;
    ctx.strokeStyle=open?stage.palette.accent:'#635449';ctx.lineWidth=5;ctx.strokeRect(-35,-92,70,92);
    ctx.fillStyle=open?'#fff0bd':'#93877a';ctx.font='800 18px serif';ctx.textAlign='center';ctx.fillText(open?(stageIndex===4?'暁':'開'):'封',0,-48);
    if(open){ctx.font='700 10px sans-serif';ctx.fillText('→ 進め',0,-103);}
    ctx.restore();
  }

  function drawSnore(e, heavy) {
    const t = e.snore;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f6e4a4';
    ctx.globalAlpha = .55 + .45 * Math.sin(t * 2.4);
    if (heavy) {
      ctx.font = '800 18px serif';
      ctx.fillText('ぐー', e.w + 10, 2 + Math.sin(t * 2) * 5);
      ctx.font = '700 14px serif';
      ctx.globalAlpha = .45 + .4 * Math.sin(t * 2.4 + 1);
      ctx.fillText('ぐー', e.w + 28, -16 + Math.sin(t * 2 + .7) * 4);
      ctx.font = '800 20px serif';
      ctx.globalAlpha = .5 + .4 * Math.sin(t * 1.8 + 1.4);
      ctx.fillText('Z', e.w + 8, -34 + Math.sin(t * 1.7) * 3);
    } else {
      ctx.font = '700 13px serif';
      ctx.fillText('Z', e.w + 4, -4 + Math.sin(t * 2) * 3);
      ctx.fillText('z', e.w + 14, -16 + Math.sin(t * 2 + .6) * 3);
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    if(e.dead) {ctx.globalAlpha=.18;ctx.fillStyle='#07100f';ctx.fillRect(e.x,e.y+e.h-8,e.w,8);ctx.globalAlpha=1;return;}
    const accent=e.type==='boss'?'#e7b24c':e.type==='samurai'?'#a13c32':e.type==='archer'?'#536c68':e.type==='scout'?'#7a8f4a':'#66706d';
    if(!e.sleeping){
      const range=e.type==='boss'?180:e.type==='archer'?330:e.type==='scout'?280:210;
      ctx.fillStyle=e.alerted?'rgba(244,69,52,.14)':'rgba(234,208,147,.075)';ctx.beginPath();ctx.moveTo(e.x+e.w/2,e.y+18);ctx.lineTo(e.x+e.w/2+e.facing*range,e.y-58);ctx.lineTo(e.x+e.w/2+e.facing*range,e.y+112);ctx.closePath();ctx.fill();
    }
    ctx.save();ctx.translate(e.x,e.y);if(e.hit>0)ctx.globalAlpha=.45;
    if(e.type==='boss'){
      ctx.fillStyle='#5a2430';roundRect(-10,e.h-12,e.w+20,14,4);ctx.fill();
      ctx.fillStyle='#d7c49a';roundRect(2,e.h-28,e.w-4,18,6);ctx.fill();
      ctx.fillStyle='#111517';roundRect(e.sleeping?e.w-22:4,e.sleeping?e.h-42:0,22,22,8);ctx.fill();
      ctx.fillStyle=accent;ctx.fillRect(e.sleeping?e.w-18:8,e.sleeping?e.h-36:8,14,6);
      ctx.fillStyle='#e8d5ac';ctx.fillRect(e.facing>0?e.w-8:6,e.sleeping?e.h-32:12,4,3);
      if(e.sleeping) drawSnore(e, true);
      else {
        ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(2,9);ctx.lineTo(e.w*.3,-5);ctx.lineTo(e.w*.5,7);ctx.lineTo(e.w*.75,-5);ctx.lineTo(e.w-2,9);ctx.fill();
      }
    } else if(e.sleeping){
      ctx.fillStyle='#4a322c';roundRect(-8,e.h-14,e.w+26,16,5);ctx.fill();
      ctx.fillStyle='#3a4c56';roundRect(0,e.h-26,e.w+12,14,6);ctx.fill();
      ctx.strokeStyle='#f0d090';ctx.lineWidth=2;roundRect(0,e.h-26,e.w+12,14,6);ctx.stroke();
      ctx.fillStyle=accent;ctx.fillRect(8,e.h-24,e.w-4,6);
      ctx.fillStyle='#e8d5ac';roundRect(e.w-2,e.h-36,20,20,8);ctx.fill();
      ctx.fillStyle='#fff6d2';ctx.fillRect(e.w+8,e.h-28,5,4);
      drawSnore(e, !!e.deepSleep);
    } else {
      ctx.fillStyle='#3a4c56';roundRect(0,8,e.w,e.h-8,7);ctx.fill();
      ctx.strokeStyle='#f0d090';ctx.lineWidth=2;roundRect(0,8,e.w,e.h-8,7);ctx.stroke();
      ctx.fillStyle=accent;ctx.fillRect(4,15,e.w-8,9);
      ctx.fillStyle='#fff6d2';ctx.fillRect(e.facing>0?e.w-12:7,18,5,4);
      const lx=e.facing>0?e.w+5:-5;
      ctx.fillStyle='rgba(255,196,64,.35)';ctx.beginPath();ctx.arc(lx,30,11,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#ffd056';ctx.beginPath();ctx.arc(lx,30,4,0,Math.PI*2);ctx.fill();
      if(e.type==='archer'){ctx.strokeStyle='#e8c478';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.facing>0?e.w+5:-5,27,15,-1.3,1.3);ctx.stroke();}
      if(e.type==='samurai'){ctx.fillStyle=accent;ctx.beginPath();ctx.moveTo(2,9);ctx.lineTo(e.w*.3,-5);ctx.lineTo(e.w*.5,7);ctx.lineTo(e.w*.75,-5);ctx.lineTo(e.w-2,9);ctx.fill();}
      if(e.type==='scout'){ctx.fillStyle='#dceb78';ctx.beginPath();ctx.moveTo(e.w/2,4);ctx.lineTo(e.w/2+8,-8);ctx.lineTo(e.w/2-8,-8);ctx.closePath();ctx.fill();}
    }
    ctx.restore();
    if(e.maxHp>2){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(e.x,e.y-12,e.w,4);ctx.fillStyle=accent;ctx.fillRect(e.x,e.y-12,e.w*(e.hp/e.maxHp),4);}
  }

  function drawNinja(x,y,facing,alpha,attacking) {
    ctx.save();ctx.translate(x,y);ctx.globalAlpha=alpha;
    ctx.fillStyle='#1d2c36';roundRect(0,3,34,45,9);ctx.fill();
    ctx.strokeStyle='#f2d36a';ctx.lineWidth=2;roundRect(0,3,34,45,9);ctx.stroke();
    ctx.fillStyle='#c43a2c';ctx.fillRect(3,22,28,7);
    ctx.fillStyle='#243844';ctx.beginPath();ctx.arc(17,9,14,Math.PI,0);ctx.fill();
    ctx.fillStyle='#fff6c2';ctx.fillRect(facing>0?19:9,10,7,4);
    ctx.strokeStyle=stage.palette.accent;ctx.globalAlpha=alpha*.85;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(7,32);ctx.lineTo(-10*facing,47);ctx.stroke();
    if(attacking){ctx.globalAlpha=alpha;ctx.strokeStyle=stage.palette.accent;ctx.lineWidth=5;ctx.beginPath();const cx=facing>0?24:10;ctx.arc(cx,25,51,facing>0?-1.05:Math.PI-2.1,facing>0?1.05:Math.PI+2.1);ctx.stroke();}
    ctx.restore();
  }

  function drawProjectile(p) {
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.fillStyle=p.owner==='player'?stage.palette.accent:'#de513c';
    if(p.owner==='player'){ctx.scale(1.5,1.5);ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(4,-3);ctx.lineTo(11,0);ctx.lineTo(4,3);ctx.lineTo(0,10);ctx.lineTo(-4,3);ctx.lineTo(-11,0);ctx.lineTo(-4,-3);ctx.closePath();ctx.fill();}
    else {ctx.shadowColor='#f44';ctx.shadowBlur=10;ctx.beginPath();ctx.arc(0,0,p.r,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }

  function drawParticle(p) {ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);ctx.globalAlpha=1;}
  function drawFloater(f) {ctx.globalAlpha=clamp(f.life/.5,0,1);ctx.fillStyle=f.color;ctx.font='800 16px serif';ctx.textAlign='center';ctx.fillText(f.text,f.x,f.y);ctx.globalAlpha=1;}

  function drawForeground(sw) {
    const vignette=ctx.createRadialGradient(sw/2,WORLD_H*.46,Math.min(sw,WORLD_H)*.22,sw/2,WORLD_H*.46,Math.max(sw,WORLD_H)*.72);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,`rgba(0,0,0,${.28+alertLevel*.002})`);ctx.fillStyle=vignette;ctx.fillRect(0,0,sw,WORLD_H);
    if(alertLevel>55){ctx.fillStyle=`rgba(155,22,18,${(alertLevel-55)/45*.11})`;ctx.fillRect(0,0,sw,WORLD_H);}
  }

  function showNotice(kicker, text) {
    noticeKicker.textContent=kicker;noticeText.textContent=text;
    notice.classList.remove('show');void notice.offsetWidth;notice.classList.add('show');
  }

  function updateHud() {
    if(!stage)return;
    $('stageNumber').textContent=stage.short;
    $('stageName').textContent=stage.name;
    $('objectiveText').textContent=stage.goal;
    $('objectiveCount').textContent=`${objectiveProgress()} / ${stage.objectiveTotal}　手裏剣 ${player.ammo}`;
    $('healthText').textContent=player.hp;
    $('shadowText').textContent=Math.round(player.shadow);
    $('healthMeter').firstElementChild.style.transform=`scaleX(${clamp(player.hp/4,0,1)})`;
    $('shadowMeter').firstElementChild.style.transform=`scaleX(${player.shadow/100})`;
    $('alertFill').style.transform=`scaleX(${alertLevel/100})`;
    $('alertText').textContent=alertLevel>82?'包囲':alertLevel>55?'警戒':alertLevel>25?'気配':'平静';
    $('alert-vane').style.borderColor=alertPulse>0?'rgba(235,66,47,.9)':'rgba(232,199,129,.25)';
  }

  function updateRoute() {
    document.querySelectorAll('.route-node').forEach((node,i)=>{node.classList.toggle('current',i===stageIndex);node.classList.toggle('done',i<stageIndex);});
  }

  function resize() {
    const r=gameView.getBoundingClientRect();
    cssW=Math.max(320,Math.floor(r.width));cssH=Math.max(260,Math.floor(r.height));dpr=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.floor(cssW*dpr);canvas.height=Math.floor(cssH*dpr);canvas.style.width=`${cssW}px`;canvas.style.height=`${cssH}px`;
    viewScale=cssH/WORLD_H;viewWorldW=cssW/viewScale;
  }

  function createTexture() {
    const C=window.OffscreenCanvas || function(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
    textureCanvas=new C(128,128);const x=textureCanvas.getContext('2d');x.fillStyle='#777';x.fillRect(0,0,128,128);
    for(let y=0;y<128;y+=24){for(let xx=-(y%48);xx<128;xx+=48){x.fillStyle=`rgba(${50+Math.random()*35},${55+Math.random()*30},${53+Math.random()*24},.48)`;x.fillRect(xx,y,46,22);x.strokeStyle='rgba(8,12,12,.36)';x.strokeRect(xx,y,46,22);}}
  }

  function createFogWorker() {
    if(!window.Worker)return;
    const source=`onmessage=e=>{const t=e.data.t,s=e.data.stage;const fog=Array.from({length:s===2?26:16},(_,i)=>({x:((i*.173+t*(.008+(i%4)*.002))%1.16)-.08,y:(Math.sin(i*2.37+t*.18)*.5+.5),a:.018+(i%5)*.009,w:70+(i%7)*18}));postMessage(fog)}`;
    const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));fogWorker=new Worker(url);fogWorker.onmessage=(e)=>{workerFog=e.data;};
  }

  const gamepad={axis:0,buttons:[]};
  function pollGamepad(){
    const gp=navigator.getGamepads?.()[0];gamepad.axis=gp&&Math.abs(gp.axes[0])>.18?gp.axes[0]:0;
    const map=[[0,'GamepadJump'],[1,'GamepadSlash'],[2,'GamepadThrow'],[5,'GamepadDash']];
    for(const [i,code] of map){const now=!!gp?.buttons[i]?.pressed;const before=gamepad.buttons[i];if(now&&!before)pressed.add(code);if(!now&&before)released.add(code);input[code]=now;gamepad.buttons[i]=now;}
  }

  function isDown(...codes){return codes.some((c)=>input[c]);}
  function wasPressed(...codes){return codes.some((c)=>pressed.has(c));}
  function clearTransientInputs(){pressed.clear();released.clear();}

  function setInput(code, down) {
    if(down&&!input[code])pressed.add(code);
    if(!down&&input[code])released.add(code);
    input[code]=down;
  }

  function bindPointer(id, codes) {
    const el=$(id);if(!el)return;
    const down=(e)=>{e.preventDefault();audio.unlock();if(navigator.vibrate)navigator.vibrate(15);audio.tone('tap');el.setPointerCapture?.(e.pointerId);codes.forEach((c)=>setInput(c,true));el.classList.add('is-pressed');};
    const up=(e)=>{e.preventDefault();codes.forEach((c)=>setInput(c,false));el.classList.remove('is-pressed');};
    el.addEventListener('pointerdown',down);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('lostpointercapture',up);
  }

  function togglePause(force) {
    if(!['playing'].includes(state))return;
    paused=typeof force==='boolean'?force:!paused;
    pauseLayer.classList.toggle('hidden',!paused);
    if(paused)audio.pause();else audio.resume();
  }

  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));}catch(_) {}}
  function vibrate(pattern){if(navigator.vibrate)navigator.vibrate(pattern);}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function overlap(ax,ay,aw,ah,bx,by,bw,bh){return ax<bx+bw&&ax+aw>bx&&ay<by+bh&&ay+ah>by;}
  function roundRect(x,y,w,h,r){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else{ctx.rect(x,y,w,h);}}

  function renderTechList(){
    $('techList').innerHTML=TECH.map(([name,desc,test])=>{const ok=!!test();return `<li><strong>${name} <span class="${ok?'available':'fallback'}">${ok?'● 稼働':'○ 代替動作'}</span></strong>${desc}</li>`;}).join('');
  }

  function openTech(){renderTechList();$('tech-panel').classList.add('open');$('tech-panel').setAttribute('aria-hidden','false');}
  function closeTech(){$('tech-panel').classList.remove('open');$('tech-panel').setAttribute('aria-hidden','true');}

  function startGame(){
    if(state!=='title')return;
    audio.unlock();score=0;maxCombo=0;stageIndex=0;
    const anim=titleScreen.animate?.([{opacity:1,filter:'blur(0)'},{opacity:0,filter:'blur(7px)'}],{duration:480,easing:'ease-in',fill:'forwards'});
    if(anim)anim.finished.then(()=>{titleScreen.classList.add('hidden');titleScreen.style.opacity='';titleScreen.style.filter='';});else titleScreen.classList.add('hidden');
    setupStage(0);
  }

  function frame(now) {
    const elapsed=Math.min(MAX_STEP_ACCUMULATOR,(now-lastFrame)/1000);lastFrame=now;
    pollGamepad();
    if(!paused)accumulator+=elapsed;
    let guard=0;
    while(accumulator>=STEP&&guard++<16){fixedUpdate(STEP);accumulator-=STEP;}
    render();requestAnimationFrame(frame);
  }

  addEventListener('resize',resize,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(resize,280),{passive:true});
  addEventListener('keydown',(e)=>{
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyZ','KeyX','ShiftLeft','ShiftRight','KeyP','Enter'].includes(e.code))e.preventDefault();
    if(e.code==='KeyP')togglePause();
    else if(e.code==='Enter'&&state==='title')startGame();
    else setInput(e.code,true);
  });
  addEventListener('keyup',(e)=>setInput(e.code,false));
  document.addEventListener('pointerdown',()=>audio.unlock(),{once:true});
  document.addEventListener('keydown',()=>audio.unlock(),{once:true});
  document.addEventListener('touchstart',(e)=>{const now=Date.now();if(now-lastTap<300)e.preventDefault();lastTap=now;},{passive:false});
  document.addEventListener('touchend',(e)=>{const now=Date.now();if(now-lastTap<=300)e.preventDefault();lastTap=now;},{passive:false});
  document.addEventListener('touchmove',(e)=>{if(e.target.closest('[data-scrollable]'))return;e.preventDefault();},{passive:false});
  document.addEventListener('dblclick',(e)=>e.preventDefault());
  document.addEventListener('contextmenu',(e)=>e.preventDefault());
  document.addEventListener('selectstart',(e)=>e.preventDefault());
  document.addEventListener('dragstart',(e)=>e.preventDefault());
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden&&state==='playing'){autoPaused=true;togglePause(true);}else if(autoPaused&&state==='playing'){autoPaused=false;togglePause(false);}
  });
  addEventListener('pageshow',()=>{audio.unlock();if(state==='playing'&&!paused)audio.resume();});
  addEventListener('focus',()=>{audio.unlock();if(state==='playing'&&!paused)audio.resume();});
  if (window.visualViewport) visualViewport.addEventListener('resize',resize,{passive:true});

  function bindTap(el, handler) {
    if(!el)return;
    const fire=(e)=>{e.preventDefault();el.classList.add('is-pressed');if(navigator.vibrate)navigator.vibrate(15);audio.unlock();audio.tone('tap');handler(e);};
    const release=()=>el.classList.remove('is-pressed');
    el.addEventListener('pointerdown',fire);
    el.addEventListener('pointerup',release);
    el.addEventListener('pointercancel',release);
    el.addEventListener('pointerleave',release);
  }

  bindPointer('btn-up',['ArrowUp']);
  bindPointer('btn-left',['ArrowLeft']);bindPointer('btn-right',['ArrowRight']);bindPointer('btn-down',['ArrowDown']);
  bindPointer('btn-jump',['Space']);bindPointer('btn-slash',['KeyZ']);bindPointer('btn-throw',['KeyX']);bindPointer('btn-dash',['ShiftLeft']);
  bindTap($('startBtn'),startGame);
  bindTap($('selectBtn'),()=>audio.toggle());
  bindTap($('startPauseBtn'),()=>togglePause());
  bindTap($('nextBtn'),()=>{
    if(nextStageAction==='next')setupStage(stageIndex+1);
    else if(nextStageAction==='restart'){score=0;maxCombo=0;setupStage(0);}
    else{score=stageScoreStart;setupStage(stageIndex);}
  });
  bindTap($('muteBtn'),()=>audio.toggle());
  bindTap($('pauseBtn'),()=>togglePause());
  pauseLayer.addEventListener('click',()=>togglePause(false));
  bindTap($('fullscreenBtn'),()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.();});
  bindTap($('techBtn'),openTech);bindTap($('techClose'),closeTech);

  $('highScoreText').textContent=String(saved.highScore||0).padStart(6,'0');
  createTexture();createFogWorker();prepareTitleStage();renderTechList();resize();updateRoute();updateHud();requestAnimationFrame(frame);
})();
