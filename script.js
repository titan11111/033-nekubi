(() => {
  'use strict';

  /*
   * 実戦投入した現代Web機構:
   * 1 Pointer Events / 2 Web Audio / 3 Canvas DPR / 4 rAF delta time
   * 5 SVG Path2D / 6 OffscreenCanvas cache / 7 Vibration
   * 8 localStorage / 9 Page Visibility / 10 Gamepad + Performance適応
   */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const panel = document.getElementById('action-panel');
  const overlay = document.getElementById('overlay');
  const titleEl = document.getElementById('title');
  const missionEl = document.getElementById('mission');
  const startBtn = document.getElementById('startBtn');
  const stageLabel = document.getElementById('stageLabel');
  const lifeLabel = document.getElementById('lifeLabel');
  const weaponLabel = document.getElementById('weaponLabel');
  const jutsuLabel = document.getElementById('jutsuLabel');
  const alertBox = document.getElementById('unified-alert');
  const alertTitle = document.getElementById('alert-title');
  const alertText = document.getElementById('alert-text');
  const comboEl = document.getElementById('combo');
  const muteBtn = document.getElementById('muteBtn');

  const STAGE_NAMES = ['壱ノ階', '弐ノ階', '参ノ階', '四ノ階', '天守'];
  const input = Object.create(null);
  const justPressed = new Set();
  const paths = {
    ninja: new Path2D('M-13-18 Q0-27 13-18 L16 8 8 21 0 13-8 21-16 8Z M-13-10 L13-10 10-3-10-3Z'),
    enemy: new Path2D('M-15-15 L-8-24 0-19 8-24 15-15 13 18 4 23 0 13-4 23-13 18Z'),
    shuriken: new Path2D('M0-13 4-4 13 0 4 4 0 13-4 4-13 0-4-4Z'),
    kunai: new Path2D('M0-18 5-5 3 12-3 12-5-5Z')
  };

  let W = 400;
  let H = 600;
  let dpr = 1;
  let state = 'title';
  let paused = false;
  let currentStage = 1;
  let player;
  let enemies = [];
  let platforms = [];
  let shurikens = [];
  let particles = [];
  let slashes = [];
  let jutsuEffects = [];
  let deathEchoes = [];
  let door;
  let lastTime = performance.now();
  let frameCost = 0;
  let shake = 0;
  let flash = 0;
  let hitStop = 0;
  let alertTimer = 0;
  let stageClearTimer = 0;
  let executionTimer = 0;
  let backgroundCache = null;
  let highScore = Number(localStorage.getItem('nekubi-high-score') || 0);
  let score = 0;

  class Sound {
    constructor() {
      this.context = null;
      this.wired = false;
      this.master = null;
      this.muted = localStorage.getItem('nekubi-muted') === '1';
      this.currentBgm = null;
      this.tracks = {
        stealth: this.makeTrack('kokoro.mp3'),
        action: this.makeTrack('nekugi.mp3')
      };
      this.updateButton();
    }

    makeTrack(src) {
      const track = new Audio();
      track.preload = 'none';
      track.loop = true;
      track.volume = 1;
      track.crossOrigin = 'anonymous';
      track.setAttribute('playsinline', '');
      track.dataset.src = src;
      return track;
    }

    unlock() {
      if (!this.context) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        this.context = new AudioContextClass();
        const buffer = this.context.createBuffer(1, 1, 22050);
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        source.start(0);
        this.wireBass();
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    }

    wireBass() {
      if (this.wired || !this.context) return;
      const ac = this.context;
      const shelf = ac.createBiquadFilter();
      shelf.type = 'lowshelf';
      shelf.frequency.value = 140;
      shelf.gain.value = 14;
      const sub = ac.createBiquadFilter();
      sub.type = 'peaking';
      sub.frequency.value = 58;
      sub.Q.value = 0.85;
      sub.gain.value = 11;
      const punch = ac.createBiquadFilter();
      punch.type = 'peaking';
      punch.frequency.value = 95;
      punch.Q.value = 1.1;
      punch.gain.value = 6;
      const compressor = ac.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 12;
      compressor.ratio.value = 3.2;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.22;
      this.master = ac.createGain();
      this.master.gain.value = this.muted ? 0 : 1.55;
      shelf.connect(sub);
      sub.connect(punch);
      punch.connect(compressor);
      compressor.connect(this.master);
      this.master.connect(ac.destination);
      Object.values(this.tracks).forEach((track) => {
        try {
          ac.createMediaElementSource(track).connect(shelf);
        } catch (_) {
          track.volume = 1;
        }
      });
      this.wired = true;
    }

    tone(kind) {
      if (this.muted) return;
      this.unlock();
      if (!this.context) return;
      const ac = this.context;
      const now = ac.currentTime;
      const oscillator = ac.createOscillator();
      const gain = ac.createGain();
      const filter = ac.createBiquadFilter();
      const config = {
        tap: [180, 120, .035, 'triangle'],
        jump: [150, 420, .14, 'triangle'],
        slash: [1250, 90, .105, 'sawtooth'],
        hit: [180, 45, .15, 'square'],
        kill: [110, 32, .32, 'sawtooth'],
        fire: [95, 310, .48, 'sawtooth'],
        water: [540, 130, .42, 'sine'],
        thunder: [1500, 55, .28, 'square'],
        ultimate: [70, 920, .9, 'sawtooth'],
        throw: [1250, 500, .09, 'triangle'],
        hide: [380, 850, .2, 'sine'],
        alert: [290, 520, .28, 'sawtooth'],
        door: [220, 880, .42, 'triangle'],
        hurt: [120, 35, .3, 'square'],
        finish: [90, 25, .75, 'sawtooth']
      }[kind] || [220, 110, .1, 'sine'];
      oscillator.type = config[3];
      oscillator.frequency.setValueAtTime(config[0], now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, config[1]), now + config[2]);
      filter.type = 'lowpass';
      filter.frequency.value = kind === 'slash' ? 2800 : 1800;
      gain.gain.setValueAtTime(kind === 'finish' ? .42 : .18, now);
      gain.gain.exponentialRampToValueAtTime(.001, now + config[2]);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(this.master || ac.destination);
      oscillator.start(now);
      oscillator.stop(now + config[2]);
    }

    playBgm(type) {
      this.unlock();
      const next = this.tracks[type];
      if (!next) return;
      if (!next.src) next.src = next.dataset.src;
      Object.entries(this.tracks).forEach(([key, track]) => {
        if (!track || key === type) return;
        track.pause();
        track.currentTime = 0;
      });
      this.currentBgm = type;
      next.volume = 1;
      next.muted = false;
      if (this.master) this.master.gain.value = this.muted ? 0 : 1.55;
      if (this.muted) {
        next.pause();
        return;
      }
      const playPromise = next.play();
      if (playPromise) playPromise.catch(() => {});
    }

    pauseBgm() {
      Object.values(this.tracks).forEach((track) => {
        if (track) track.pause();
      });
    }

    stopBgm() {
      Object.values(this.tracks).forEach((track) => {
        if (!track) return;
        track.pause();
        track.currentTime = 0;
      });
      this.currentBgm = null;
    }

    resumeBgm() {
      if (this.muted || !this.currentBgm) return;
      this.playBgm(this.currentBgm);
    }

    toggle() {
      this.muted = !this.muted;
      localStorage.setItem('nekubi-muted', this.muted ? '1' : '0');
      this.updateButton();
      if (this.master) this.master.gain.value = this.muted ? 0 : 1.55;
      if (this.muted) this.pauseBgm();
      else {
        this.tone('tap');
        if (state === 'playing' && !paused) this.playBgm(this.currentBgm || 'stealth');
        else if (state === 'win' || !overlay.classList.contains('hidden')) this.playBgm(this.currentBgm || 'stealth');
      }
    }

    updateButton() {
      muteBtn.textContent = this.muted ? '消音' : '音';
      muteBtn.setAttribute('aria-label', this.muted ? '音を出す' : '音を消す');
    }
  }

  const sound = new Sound();

  class Player {
    constructor() {
      this.w = 30;
      this.h = 42;
      this.x = 32;
      this.y = H - 100;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.grounded = false;
      this.coyote = 0;
      this.hp = 3;
      this.ammo = 6;
      this.hidden = false;
      this.attackTimer = 0;
      this.invincible = 0;
      this.combo = 0;
      this.comboWindow = 0;
      this.trail = [];
      this.nin = 0;
      this.jutsuIndex = 0;
    }

    update(dt) {
      if (this.invincible > 0) this.invincible -= dt;
      if (this.attackTimer > 0) this.attackTimer -= dt;
      if (this.comboWindow > 0) this.comboWindow -= dt;
      else this.combo = 0;

      this.hidden = Boolean(input.hide && this.grounded && Math.abs(this.vx) < 1.2);
      if (this.hidden) {
        this.vx *= .65;
      } else {
        const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        this.vx += direction * 1.18 * dt;
        this.vx *= Math.pow(.78, dt);
        this.vx = clamp(this.vx, -6.4, 6.4);
        if (direction) this.facing = direction;
      }

      if (consume('jump') && (this.grounded || this.coyote > 0)) {
        this.vy = -13.3;
        this.grounded = false;
        this.coyote = 0;
        burst(this.x + this.w / 2, this.y + this.h, '#c9bea3', 8, 3);
        sound.tone('jump');
      }

      if (consume('attack') && !this.hidden) this.slash();
      if (consume('throw') && !this.hidden) this.throwShuriken();
      if (consume('jutsu') && !this.hidden) this.castJutsu();

      this.vy += .68 * dt;
      const previousBottom = this.y + this.h;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.x = clamp(this.x, 0, W - this.w);
      this.grounded = false;

      for (const platform of platforms) {
        if (
          this.vy >= 0 &&
          this.x + this.w > platform.x &&
          this.x < platform.x + platform.w &&
          previousBottom <= platform.y + 9 &&
          this.y + this.h >= platform.y
        ) {
          this.y = platform.y - this.h;
          this.vy = 0;
          this.grounded = true;
        }
      }

      this.coyote = this.grounded ? 7 : Math.max(0, this.coyote - dt);
      if (this.y > H + 40) this.hurt(1, W / 2);

      if (!this.hidden && (Math.abs(this.vx) > 3 || Math.abs(this.vy) > 5)) {
        this.trail.unshift({ x: this.x, y: this.y, life: 11 });
        if (this.trail.length > 5) this.trail.pop();
      } else {
        this.trail.length = 0;
      }
    }

    slash() {
      if (this.attackTimer > 2) return;
      this.combo = this.comboWindow > 0 ? (this.combo % 3) + 1 : 1;
      this.comboWindow = 27;
      this.attackTimer = this.combo === 3 ? 13 : 9;
      const reach = [0, 57, 66, 78][this.combo];
      this.vx += this.facing * [0, 2.8, 2.1, 4.2][this.combo];
      const hitX = this.facing > 0 ? this.x + this.w : this.x - reach;
      slashes.push({
        x: this.x + this.w / 2,
        y: this.y + this.h / 2,
        facing: this.facing,
        combo: this.combo,
        life: 10
      });
      sound.tone('slash');
      let struck = false;
      for (const enemy of enemies) {
        if (!enemy.dead && overlap(hitX, this.y - 8, reach, this.h + 16, enemy.x, enemy.y, enemy.w, enemy.h)) {
          enemy.damage(this.combo === 3 ? 4 : this.combo === 2 ? 2 : 1, this.facing, this.combo);
          struck = true;
        }
      }
      if (struck) {
        this.vx -= this.facing * 1.2;
        showCombo(this.combo);
      }
    }

    availableJutsu() {
      return [
        { name: '火遁', cost: 35 },
        ...(currentStage >= 2 ? [{ name: '水遁', cost: 40 }] : []),
        ...(currentStage >= 3 ? [{ name: '雷遁', cost: 55 }] : []),
        ...(currentStage >= 5 ? [{ name: '終ノ奥義', cost: 100 }] : [])
      ];
    }

    cycleJutsu() {
      const list = this.availableJutsu();
      this.jutsuIndex = (this.jutsuIndex + 1) % list.length;
      notify('忍術', `${list[this.jutsuIndex].name}を選択`, 70);
      sound.tone('tap');
      updateHud();
    }

    castJutsu() {
      const jutsu = this.availableJutsu()[this.jutsuIndex] || this.availableJutsu()[0];
      if (this.nin < jutsu.cost) {
        notify('忍力不足', `${jutsu.name}には忍力${jutsu.cost}が必要`, 85);
        sound.tone('tap');
        return;
      }
      this.nin -= jutsu.cost;
      this.attackTimer = 24;
      const cx = this.x + this.w / 2;
      const cy = this.y + this.h / 2;
      if (jutsu.name === '火遁') {
        sound.tone('fire'); shake = 13; flash = 4;
        jutsuEffects.push({ type: 'fire', x: cx, y: cy, facing: this.facing, life: 42, maxLife: 42 });
        enemies.forEach((enemy) => {
          const ahead = (enemy.x + enemy.w / 2 - cx) * this.facing;
          if (!enemy.dead && ahead > -15 && ahead < 210 && Math.abs(enemy.y - this.y) < 90) enemy.damage(4, this.facing, 4, false);
        });
      } else if (jutsu.name === '水遁') {
        sound.tone('water');
        jutsuEffects.push({ type: 'water', x: cx, y: cy, facing: this.facing, life: 46, maxLife: 46 });
        this.invincible = 50;
        this.x = clamp(this.x + this.facing * 150, 0, W - this.w);
        enemies.forEach((enemy) => {
          if (!enemy.dead && Math.abs(enemy.x - cx) < 185 && Math.abs(enemy.y - this.y) < 100) {
            enemy.vx = this.facing * 5; enemy.damage(2, this.facing, 2, false);
          }
        });
      } else if (jutsu.name === '雷遁') {
        sound.tone('thunder'); hitStop = 5; flash = 12; shake = 20;
        const targets = enemies.filter((enemy) => !enemy.dead).sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx)).slice(0, 4);
        jutsuEffects.push({ type: 'thunder', x: cx, y: cy, targets, life: 30, maxLife: 30 });
        targets.forEach((enemy) => enemy.damage(5, Math.sign(enemy.x - cx) || this.facing, 5, false));
      } else {
        sound.tone('ultimate'); hitStop = 12; flash = 20; shake = 28;
        jutsuEffects.push({ type: 'ultimate', x: cx, y: cy, targets: enemies.filter((enemy) => !enemy.dead), life: 70, maxLife: 70 });
        enemies.filter((enemy) => !enemy.dead).forEach((enemy) => enemy.damage(99, Math.sign(enemy.x - cx) || 1, 9, false));
      }
      notify(jutsu.name, jutsu.name === '終ノ奥義' ? '影・月喰一閃' : '忍法、発動', 75);
      vibrate(jutsu.name === '終ノ奥義' ? [35, 20, 55, 25, 90] : [22, 18, 35]);
      updateHud();
    }

    throwShuriken() {
      if (this.ammo <= 0 || this.attackTimer > 2) {
        if (this.ammo <= 0) notify('武具', '手裏剣が尽きた。斬撃で敵を討て', 100);
        return;
      }
      this.ammo -= 1;
      this.attackTimer = 14;
      shurikens.push({
        x: this.x + this.w / 2,
        y: this.y + 17,
        vx: this.facing * 11.5,
        rotation: 0,
        active: true
      });
      sound.tone('throw');
      updateHud();
    }

    hurt(amount, sourceX) {
      if (this.invincible > 0 || state !== 'playing') return;
      this.hp -= amount;
      this.invincible = 72;
      this.hidden = false;
      this.x = clamp(this.x + (this.x < sourceX ? -28 : 28), 0, W - this.w);
      this.y = Math.min(this.y, H - 120);
      this.vy = -7;
      shake = 15;
      flash = 8;
      sound.tone('hurt');
      burst(this.x + this.w / 2, this.y + 20, '#c53127', 14, 6);
      vibrate([25, 25, 35]);
      updateHud();
      if (this.hp <= 0) endGame(false);
    }

    draw() {
      for (const trail of this.trail) {
        ctx.save();
        ctx.globalAlpha = trail.life / 30;
        drawNinja(trail.x + this.w / 2, trail.y + this.h / 2, this.facing, false);
        ctx.restore();
        trail.life -= 1;
      }
      if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2) return;
      ctx.save();
      ctx.globalAlpha = this.hidden ? .23 : 1;
      drawNinja(this.x + this.w / 2, this.y + this.h / 2, this.facing, this.hidden);
      ctx.restore();
      if (this.hidden) {
        ctx.fillStyle = 'rgba(220,230,225,.65)';
        ctx.font = `700 13px ${getComputedStyle(document.documentElement).getPropertyValue('--display-font')}`;
        ctx.textAlign = 'center';
        ctx.fillText('隠レ身', this.x + this.w / 2, this.y - 9);
      }
    }
  }

  class Enemy {
    constructor(x, y, type = 'ashigaru') {
      this.x = x;
      this.y = y;
      this.w = type === 'musha' ? 38 : 31;
      this.h = type === 'musha' ? 52 : 43;
      this.type = type;
      this.hp = type === 'musha' ? 6 : type === 'samurai' ? 4 : 2;
      this.dead = false;
      this.facing = -1;
      this.origin = x;
      this.vx = 0;
      this.alerted = false;
      this.attackCooldown = 25 + Math.random() * 50;
      this.hitFlash = 0;
      this.stagger = 0;
    }

    update(dt) {
      if (this.dead) return;
      if (this.stagger > 0) { this.stagger -= dt; this.x += this.vx * dt; this.vx *= .84; return; }
      if (this.hitFlash > 0) this.hitFlash -= dt;
      this.attackCooldown -= dt;
      const dx = player.x - this.x;
      const dy = Math.abs(player.y - this.y);
      const seesPlayer = !player.hidden && Math.abs(dx) < (this.type === 'samurai' ? 190 : 150) && dy < 60;
      if (seesPlayer) {
        if (!this.alerted) {
          this.alerted = true;
          notify('警戒', '敵兵に見つかった。隠れ身で気配を断て', 95);
          sound.tone('alert');
        }
        this.facing = Math.sign(dx) || this.facing;
        if (Math.abs(dx) > 34) this.vx = this.facing * (this.type === 'musha' ? 1.25 : 1.75);
        else {
          this.vx = 0;
          if (this.attackCooldown <= 0) {
            this.attackCooldown = this.type === 'musha' ? 70 : 52;
            if (Math.abs(dx) < 46) player.hurt(1, this.x);
          }
        }
      } else {
        if (Math.abs(this.x - this.origin) > 72) this.facing = this.x > this.origin ? -1 : 1;
        this.vx = this.facing * .62;
        if (player.hidden) this.alerted = false;
      }
      this.x += this.vx * dt;
    }

    damage(amount, direction, impact = 1, rewardNin = true) {
      if (this.dead) return;
      const dealt = Math.min(this.hp, amount);
      this.hp -= amount;
      this.x += direction * (8 + impact * 3);
      this.stagger = Math.min(22, 5 + impact * 2);
      this.hitFlash = 7;
      hitStop = amount >= 3 ? 7 : 4;
      shake = amount >= 3 ? 17 : 10;
      flash = amount >= 3 ? 5 : 2;
      score += dealt * 100;
      if (rewardNin) player.nin = Math.min(100, player.nin + Math.min(18, 5 + dealt * 2));
      sound.tone('hit');
      vibrate(amount >= 3 ? [22, 18, 30] : 18);
      burst(this.x + this.w / 2, this.y + this.h / 2, amount >= 3 ? '#fff2ad' : '#d43a2d', 13 + amount * 4, 7);
      if (this.hp <= 0) {
        deathEchoes.push({ x: this.x, y: this.y, w: this.w, h: this.h, facing: this.facing, type: this.type, life: 24, maxLife: 24, cut: impact });
        this.dead = true;
        score += 400;
        if (rewardNin) player.nin = Math.min(100, player.nin + 12);
        sound.tone('kill');
        burst(this.x + this.w / 2, this.y + this.h / 2, '#161617', 25, 10);
        burst(this.x + this.w / 2, this.y + this.h / 2, '#c22c22', 18, 8);
        if (Math.random() < .6) player.ammo = Math.min(9, player.ammo + 1);
        checkDoor();
      }
      updateHud();
    }

    draw() {
      if (this.dead) return;
      ctx.save();
      ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
      ctx.scale(this.facing, 1);
      ctx.fillStyle = this.hitFlash > 0 ? '#fff' : this.type === 'musha' ? '#3b302a' : this.type === 'samurai' ? '#7e2827' : '#263d54';
      ctx.strokeStyle = '#d2c19b';
      ctx.lineWidth = 2;
      ctx.fill(paths.enemy);
      ctx.stroke(paths.enemy);
      ctx.fillStyle = '#171719';
      ctx.fillRect(-13, -11, 26, 7);
      ctx.fillStyle = '#f0dfc1';
      ctx.fillRect(3, -8, 6, 2);
      ctx.strokeStyle = '#ddd5bd';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(7, 5);
      ctx.lineTo(this.type === 'musha' ? 30 : 23, this.type === 'samurai' ? -14 : 16);
      ctx.stroke();
      if (this.alerted) {
        ctx.scale(this.facing, 1);
        ctx.fillStyle = '#f02d22';
        ctx.font = '900 22px serif';
        ctx.textAlign = 'center';
        ctx.fillText('！', 0, -31);
      }
      ctx.restore();
    }
  }

  function resizeCanvas() {
    const rect = panel.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    H = 600;
    W = Math.max(360, Math.round(H * (rect.width / Math.max(1, rect.height))));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    backgroundCache = createBackgroundCache();
    if (state === 'playing' || state === 'paused') buildStage(currentStage, true);
  }

  function createBackgroundCache() {
    const cache = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(Math.ceil(W), H)
      : document.createElement('canvas');
    cache.width = Math.ceil(W);
    cache.height = H;
    const bg = cache.getContext('2d');
    const gradient = bg.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, currentStage >= 4 ? '#170909' : '#071018');
    gradient.addColorStop(.6, '#11171a');
    gradient.addColorStop(1, '#07090a');
    bg.fillStyle = gradient;
    bg.fillRect(0, 0, W, H);

    bg.globalAlpha = .2;
    bg.fillStyle = '#89929a';
    for (let y = 60; y < H; y += 38) {
      for (let x = (y / 38) % 2 ? -28 : 0; x < W; x += 74) {
        bg.fillRect(x, y, 68, 32);
      }
    }
    bg.globalAlpha = 1;
    bg.fillStyle = '#e9dfa9';
    bg.shadowColor = '#eadb92';
    bg.shadowBlur = 34;
    bg.beginPath();
    bg.arc(W * .78, 82, 33, 0, Math.PI * 2);
    bg.fill();
    bg.shadowBlur = 0;
    bg.fillStyle = 'rgba(2,6,8,.85)';
    bg.beginPath();
    bg.arc(W * .79 - 10, 74, 33, 0, Math.PI * 2);
    bg.fill();
    return cache;
  }

  function buildStage(stage, preserveStats = false) {
    const oldHp = preserveStats && player ? player.hp : 3;
    const oldAmmo = preserveStats && player ? player.ammo : 6;
    const oldNin = preserveStats && player ? player.nin : 0;
    const oldJutsu = preserveStats && player ? player.jutsuIndex : 0;
    player = new Player();
    player.hp = oldHp;
    player.ammo = oldAmmo;
    player.nin = oldNin;
    player.jutsuIndex = Math.min(oldJutsu, player.availableJutsu().length - 1);
    platforms = [
      { x: 0, y: H - 49, w: W, h: 49 },
      { x: W * .18, y: H - 156, w: W * .45, h: 17 },
      { x: 0, y: H - 268, w: W * .37, h: 17 },
      { x: W * .48, y: H - 376, w: W * .45, h: 17 },
      { x: W * .62, y: H - 487, w: W * .38, h: 18 }
    ];
    door = { x: W - 82, y: H - 577, w: 60, h: 90, open: false, pulse: 0 };
    enemies = [];
    const difficulty = stage - 1;
    const types = stage >= 4 ? ['samurai', 'musha'] : stage >= 2 ? ['ashigaru', 'samurai'] : ['ashigaru'];
    const slots = [
      [W * .42, H - 92],
      [W * .78, H - 92],
      [W * .22, H - 199],
      [W * .50, H - 199],
      [W * .08, H - 311],
      [W * .26, H - 311],
      [W * .54, H - 419],
      [W * .78, H - 419]
    ];
    const count = Math.min(slots.length, (2 + difficulty) * 2);
    for (let i = 0; i < count; i += 1) {
      const type = stage === 5 && i >= count - 2 ? 'musha' : types[i % types.length];
      const enemy = new Enemy(slots[i][0], slots[i][1], type);
      enemy.hp += difficulty;
      enemies.push(enemy);
    }
    shurikens = [];
    particles = [];
    slashes = [];
    jutsuEffects = [];
    deathEchoes = [];
    stageClearTimer = 0;
    backgroundCache = createBackgroundCache();
    notify('忍務', stage === 5 ? '天守の敵将を討ち、奥の門へ' : '敵兵を全て討ち、上階の扉へ', 130);
    updateHud();
  }

  function checkDoor() {
    if (enemies.every((enemy) => enemy.dead) && !door.open) {
      door.open = true;
      sound.tone('door');
      notify('開門', '扉が開いた。扉の前で「上」を押せ', 150);
      vibrate([15, 25, 15]);
    }
  }

  function tryDoor() {
    if (!door || !overlap(player.x, player.y, player.w, player.h, door.x - 10, door.y, door.w + 20, door.h + 8)) return;
    if (!door.open) {
      notify('封印', `残る敵兵 ${enemies.filter((enemy) => !enemy.dead).length} 人`, 95);
      return;
    }
    if (currentStage < 5) {
      currentStage += 1;
      buildStage(currentStage, true);
      const learned = currentStage === 2 ? '水遁' : currentStage === 3 ? '雷遁' : currentStage === 5 ? '終ノ奥義' : '';
      if (learned) notify('忍術会得', `${learned}を会得した。SELECTで切替`, 155);
    } else {
      state = 'execution';
      executionTimer = 155;
      sound.pauseBgm();
      sound.tone('finish');
      burst(W / 2, H / 2, '#c5201d', 70, 15);
    }
  }

  function update(dt) {
    pollGamepad();
    if (consume('door')) tryDoor();
    player.update(dt);
    for (const enemy of enemies) enemy.update(dt);

    for (const projectile of shurikens) {
      projectile.x += projectile.vx * dt;
      projectile.rotation += .65 * dt;
      if (projectile.x < -20 || projectile.x > W + 20) projectile.active = false;
      for (const enemy of enemies) {
        if (
          projectile.active &&
          !enemy.dead &&
          overlap(projectile.x - 8, projectile.y - 8, 16, 16, enemy.x, enemy.y, enemy.w, enemy.h)
        ) {
          projectile.active = false;
          enemy.damage(2, Math.sign(projectile.vx), 1, false);
        }
      }
    }
    shurikens = shurikens.filter((projectile) => projectile.active);
    particles.forEach((particle) => {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += .13 * dt;
      particle.life -= dt;
    });
    particles = particles.filter((particle) => particle.life > 0);
    slashes.forEach((slash) => { slash.life -= dt; });
    slashes = slashes.filter((slash) => slash.life > 0);
    jutsuEffects.forEach((effect) => { effect.life -= dt; });
    jutsuEffects = jutsuEffects.filter((effect) => effect.life > 0);
    deathEchoes.forEach((echo) => { echo.life -= dt; echo.y += .35 * dt; });
    deathEchoes = deathEchoes.filter((echo) => echo.life > 0);
    door.pulse += .08 * dt;
    if (alertTimer > 0) {
      alertTimer -= dt;
      if (alertTimer <= 0) alertBox.classList.remove('show');
    }
    if (shake > 0) shake -= dt;
    if (flash > 0) flash -= dt;
  }

  function render() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    if (backgroundCache) ctx.drawImage(backgroundCache, 0, 0, W, H);
    drawCastleSilhouette();
    platforms.forEach(drawPlatform);
    drawDoor();
    deathEchoes.forEach(drawDeathEcho);
    enemies.forEach((enemy) => enemy.draw());
    shurikens.forEach(drawShuriken);
    player.draw();
    slashes.forEach(drawSlash);
    jutsuEffects.forEach(drawJutsuEffect);
    particles.forEach(drawParticle);
    ctx.restore();

    if (flash > 0) {
      ctx.fillStyle = `rgba(255,245,220,${Math.min(.6, flash / 10)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawCastleSilhouette() {
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath();
    ctx.moveTo(0, H - 50);
    ctx.lineTo(0, 190);
    ctx.lineTo(W * .15, 150);
    ctx.lineTo(W * .3, 190);
    ctx.lineTo(W * .47, 105);
    ctx.lineTo(W * .64, 190);
    ctx.lineTo(W * .82, 145);
    ctx.lineTo(W, 185);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawPlatform(platform) {
    ctx.fillStyle = '#382a21';
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.fillStyle = '#776146';
    ctx.fillRect(platform.x, platform.y, platform.w, 4);
    ctx.strokeStyle = 'rgba(202,177,120,.22)';
    for (let x = platform.x + 16; x < platform.x + platform.w; x += 34) {
      ctx.beginPath();
      ctx.moveTo(x, platform.y + 4);
      ctx.lineTo(x - 8, platform.y + platform.h);
      ctx.stroke();
    }
  }

  function drawDoor() {
    const glow = door.open ? .45 + Math.sin(door.pulse) * .18 : .08;
    ctx.save();
    ctx.shadowColor = door.open ? '#efcf73' : '#661914';
    ctx.shadowBlur = door.open ? 24 : 7;
    ctx.fillStyle = door.open ? `rgba(235,203,105,${glow})` : '#241815';
    ctx.fillRect(door.x, door.y, door.w, door.h);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = door.open ? '#e6c766' : '#8e3428';
    ctx.lineWidth = 5;
    ctx.strokeRect(door.x, door.y, door.w, door.h);
    ctx.strokeStyle = '#75603b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(door.x + door.w / 2, door.y);
    ctx.lineTo(door.x + door.w / 2, door.y + door.h);
    ctx.stroke();
    ctx.fillStyle = door.open ? '#fff0a5' : '#9f3b31';
    ctx.font = '700 15px serif';
    ctx.textAlign = 'center';
    ctx.fillText(door.open ? '開' : '封', door.x + door.w / 2, door.y + 50);
    if (door.open) {
      ctx.fillStyle = '#f3df9b';
      ctx.font = '700 12px serif';
      ctx.fillText('▲ 上で入る', door.x + door.w / 2, door.y - 10);
    }
    ctx.restore();
  }

  function drawNinja(x, y, facing, hidden) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.fillStyle = hidden ? '#6a7774' : '#111519';
    ctx.strokeStyle = '#8d8171';
    ctx.lineWidth = 1.5;
    ctx.fill(paths.ninja);
    ctx.stroke(paths.ninja);
    ctx.fillStyle = '#9d201b';
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(-31, -12);
    ctx.lineTo(-19, 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5eee0';
    ctx.fillRect(4, -9, 7, 2);
    ctx.strokeStyle = '#d7d7d2';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-7, 4);
    ctx.lineTo(17, 18);
    ctx.stroke();
    ctx.restore();
  }

  function drawShuriken(projectile) {
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(projectile.rotation);
    ctx.shadowColor = '#dffcff';
    ctx.shadowBlur = 11;
    ctx.fillStyle = '#edf4ed';
    ctx.fill(paths.shuriken);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#25292c';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSlash(slash) {
    const progress = 1 - slash.life / 10;
    ctx.save();
    ctx.translate(slash.x, slash.y);
    ctx.scale(slash.facing, 1);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = slash.combo === 3 ? '#ffe17c' : slash.combo === 2 ? '#b9edff' : '#f5ffff';
    ctx.lineWidth = (slash.combo === 3 ? 11 : 8) - progress * 5;
    ctx.shadowColor = slash.combo === 3 ? '#ff3426' : '#6ff';
    ctx.shadowBlur = 22;
    if (slash.combo === 1) {
      ctx.beginPath(); ctx.arc(0, 0, 43, -.78, .78 + progress * .5); ctx.stroke();
    } else if (slash.combo === 2) {
      ctx.beginPath(); ctx.moveTo(-12, 35); ctx.quadraticCurveTo(29, 5, 56, -38); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-12, -39); ctx.lineTo(68, 38); ctx.moveTo(-8, 40); ctx.lineTo(68, -35); ctx.stroke();
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawDeathEcho(echo) {
    const fade = echo.life / echo.maxLife;
    ctx.save();
    ctx.globalAlpha = fade * .82;
    ctx.translate(echo.x + echo.w / 2, echo.y + echo.h / 2);
    ctx.scale(echo.facing, 1);
    ctx.fillStyle = '#08090a';
    ctx.strokeStyle = '#b82920';
    ctx.lineWidth = 2;
    ctx.save(); ctx.translate(0, -Math.min(10, (1 - fade) * 15)); ctx.fill(paths.enemy); ctx.stroke(paths.enemy); ctx.restore();
    ctx.strokeStyle = '#fff1c2';
    ctx.beginPath();
    if (echo.cut >= 3) { ctx.moveTo(-24, -22); ctx.lineTo(26, 22); }
    else { ctx.moveTo(-24, 2); ctx.lineTo(26, -3); }
    ctx.stroke();
    ctx.restore();
  }

  function drawJutsuEffect(effect) {
    const p = 1 - effect.life / effect.maxLife;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (effect.type === 'fire') {
      ctx.translate(effect.x, effect.y); ctx.scale(effect.facing, 1);
      for (let i = 0; i < 7; i += 1) {
        const x = 25 + i * 27 + p * 18;
        const r = Math.max(3, 30 - i * 2) * Math.sin(Math.min(1, p * 2.5) * Math.PI);
        ctx.fillStyle = i % 2 ? 'rgba(255,55,18,.7)' : 'rgba(255,190,45,.75)';
        ctx.beginPath(); ctx.arc(x, Math.sin(i * 2.1) * 18, Math.abs(r), 0, Math.PI * 2); ctx.fill();
      }
    } else if (effect.type === 'water') {
      ctx.strokeStyle = `rgba(100,225,255,${1 - p})`; ctx.lineWidth = 18 - p * 12; ctx.shadowColor = '#54ddff'; ctx.shadowBlur = 22;
      ctx.beginPath(); ctx.moveTo(effect.x - effect.facing * 25, effect.y + 28); ctx.bezierCurveTo(effect.x + effect.facing * 35, effect.y - 55, effect.x + effect.facing * 105, effect.y + 55, effect.x + effect.facing * 170, effect.y - 18); ctx.stroke();
    } else if (effect.type === 'thunder') {
      ctx.strokeStyle = `rgba(210,245,255,${1 - p})`; ctx.lineWidth = 5; ctx.shadowColor = '#56bfff'; ctx.shadowBlur = 25;
      let px = effect.x; let py = effect.y;
      for (const target of effect.targets) {
        const tx = target.x + target.w / 2; const ty = target.y + target.h / 2;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo((px + tx) / 2 + (Math.random() - .5) * 32, (py + ty) / 2); ctx.lineTo(tx, ty); ctx.stroke(); px = tx; py = ty;
      }
    } else {
      ctx.fillStyle = `rgba(20,0,35,${.48 * (1 - p)})`; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = `rgba(255,245,220,${1 - p})`; ctx.lineWidth = 7; ctx.shadowColor = '#d71919'; ctx.shadowBlur = 20;
      for (const target of effect.targets) {
        ctx.beginPath(); ctx.moveTo(effect.x, effect.y); ctx.lineTo(target.x + target.w / 2, target.y + target.h / 2); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawParticle(particle) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.translate(particle.x, particle.y);
    ctx.rotate(Math.atan2(particle.vy, particle.vx));
    ctx.fillStyle = particle.color;
    ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size * 2.4, particle.size);
    ctx.restore();
  }

  function renderExecution() {
    executionTimer -= 1;
    render();
    const phase = executionTimer / 155;
    ctx.fillStyle = phase > .83 ? `rgba(255,255,255,${(phase - .83) * 5})` : 'rgba(120,0,0,.18)';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-.18);
    ctx.strokeStyle = '#f6e6c4';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-W, H * .35);
    ctx.lineTo(W, -H * .35);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#080808';
    ctx.strokeStyle = '#c82720';
    ctx.lineWidth = 8;
    ctx.textAlign = 'center';
    ctx.font = `900 ${Math.min(118, W * .23)}px serif`;
    ctx.strokeText('天 誅', W / 2, H / 2 + 35);
    ctx.fillText('天 誅', W / 2, H / 2 + 35);
    if (executionTimer <= 0) endGame(true);
  }

  function loop(now) {
    const started = performance.now();
    const dt = Math.min(2, Math.max(.35, (now - lastTime) / 16.667));
    lastTime = now;
    if (state === 'playing' && !paused) {
      if (hitStop > 0) {
        hitStop -= 1;
        render();
      } else {
        update(dt);
        render();
      }
    } else if (state === 'execution') {
      renderExecution();
    } else if ((state === 'playing' || state === 'paused') && player) {
      render();
    }
    frameCost = frameCost * .95 + (performance.now() - started) * .05;
    requestAnimationFrame(loop);
  }

  function startGame() {
    sound.unlock();
    sound.playBgm('stealth');
    if (state === 'playing') return;
    sound.tone('door');
    currentStage = 1;
    score = 0;
    state = 'playing';
    paused = false;
    overlay.classList.add('hidden');
    buildStage(1, false);
    notify('操作', 'A斬る・B跳ぶ・X手裏剣・Y火遁・▼隠れ身', 170);
    lastTime = performance.now();
  }

  function endGame(win) {
    state = win ? 'win' : 'gameover';
    if (win) sound.playBgm('action');
    else sound.stopBgm();
    highScore = Math.max(highScore, score);
    localStorage.setItem('nekubi-high-score', String(highScore));
    overlay.classList.remove('hidden');
    titleEl.textContent = win ? '忍務完遂' : '無念';
    missionEl.textContent = win
      ? `戦果 ${score}　最高 ${highScore}`
      : `戦果 ${score}　再び影より参れ`;
    startBtn.textContent = win ? '再潜入' : '再挑戦';
  }

  function togglePause() {
    if (state !== 'playing') return;
    paused = !paused;
    if (paused) sound.pauseBgm();
    else sound.resumeBgm();
    notify(paused ? '停止' : '再開', paused ? '忍務を一時停止した' : '忍務を再開する', 70);
  }

  function notify(title, text, duration = 100) {
    alertTitle.textContent = title;
    alertText.textContent = text;
    alertTimer = duration;
    alertBox.classList.remove('show');
    void alertBox.offsetWidth;
    alertBox.classList.add('show');
  }

  function showCombo(combo) {
    if (combo < 2) return;
    comboEl.textContent = combo === 3 ? '参ノ太刀！' : '弐連斬！';
    comboEl.classList.remove('pop');
    void comboEl.offsetWidth;
    comboEl.classList.add('pop');
  }

  function burst(x, y, color, count, speed) {
    const density = frameCost > 12 ? .55 : 1;
    const actualCount = Math.ceil(count * density);
    for (let i = 0; i < actualCount; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * speed + 1;
      const life = 20 + Math.random() * 26;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        color,
        size: 2 + Math.random() * 3,
        life,
        maxLife: life
      });
    }
  }

  function updateHud() {
    if (!player) return;
    stageLabel.textContent = STAGE_NAMES[currentStage - 1];
    lifeLabel.textContent = `命 ${'●'.repeat(Math.max(0, player.hp))}${'○'.repeat(Math.max(0, 3 - player.hp))}`;
    weaponLabel.textContent = `手裏剣 × ${String(player.ammo).padStart(2, '0')}`;
    weaponLabel.classList.toggle('empty', player.ammo === 0);
    const jutsu = player.availableJutsu()[player.jutsuIndex] || player.availableJutsu()[0];
    jutsuLabel.textContent = `忍力 ${jutsu.name} ${String(Math.floor(player.nin)).padStart(3, '0')}%`;
    jutsuLabel.classList.toggle('ready', player.nin >= jutsu.cost);
  }

  function bindButton(id, action, options = {}) {
    const element = document.getElementById(id);
    const press = (event) => {
      event.preventDefault();
      element.setPointerCapture?.(event.pointerId);
      if (!input[action]) justPressed.add(action);
      input[action] = true;
      element.classList.add('is-pressed');
      sound.tone('tap');
      vibrate(15);
      if (options.immediate) options.immediate();
    };
    const release = (event) => {
      event?.preventDefault();
      input[action] = false;
      element.classList.remove('is-pressed');
    };
    element.addEventListener('pointerdown', press);
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('lostpointercapture', release);
  }

  function setupInputs() {
    bindButton('btn-left', 'left');
    bindButton('btn-right', 'right');
    bindButton('btn-down', 'hide');
    bindButton('btn-up', 'door');
    bindButton('btn-a', 'attack');
    bindButton('btn-b', 'jump');
    bindButton('btn-x', 'throw');
    bindButton('btn-y', 'jutsu');
    bindButton('startPauseBtn', 'pause', { immediate: togglePause });
    bindButton('selectBtn', 'guide', {
      immediate: () => player ? player.cycleJutsu() : notify('操作', 'A斬る・B跳ぶ・X手裏剣・Y忍術・▼隠れる', 125)
    });

    const keyMap = {
      ArrowLeft: 'left',
      ArrowRight: 'right',
      ArrowDown: 'hide',
      ArrowUp: 'door',
      KeyZ: 'attack',
      Space: 'attack',
      KeyX: 'throw',
      KeyC: 'jutsu',
      KeyV: 'jutsu',
      ShiftLeft: 'hide',
      KeyB: 'jump',
      Enter: 'pause'
    };
    document.addEventListener('keydown', (event) => {
      const action = keyMap[event.code];
      if (!action) return;
      event.preventDefault();
      if (!input[action]) justPressed.add(action);
      input[action] = true;
      if (action === 'pause') togglePause();
    });
    document.addEventListener('keyup', (event) => {
      const action = keyMap[event.code];
      if (action) input[action] = false;
    });
  }

  function pollGamepad() {
    const pad = navigator.getGamepads?.()[0];
    if (!pad) return;
    input.left = pad.axes[0] < -.35;
    input.right = pad.axes[0] > .35;
    gamepadEdge(pad.buttons[0]?.pressed, 'attack');
    gamepadEdge(pad.buttons[1]?.pressed, 'jump');
    gamepadEdge(pad.buttons[2]?.pressed, 'throw');
    gamepadEdge(pad.buttons[3]?.pressed, 'jutsu');
    input.hide = Boolean(pad.buttons[12]?.pressed || pad.buttons[4]?.pressed);
    if (pad.buttons[8]?.pressed && !gamepadPrevious.cycle && player) player.cycleJutsu();
    gamepadPrevious.cycle = Boolean(pad.buttons[8]?.pressed);
  }

  const gamepadPrevious = {};
  function gamepadEdge(pressed, action) {
    if (pressed && !gamepadPrevious[action]) justPressed.add(action);
    gamepadPrevious[action] = pressed;
  }

  function consume(action) {
    if (!justPressed.has(action)) return false;
    justPressed.delete(action);
    return true;
  }

  function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
  document.addEventListener('selectstart', (event) => event.preventDefault());
  document.addEventListener('dragstart', (event) => event.preventDefault());
  document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (event) => event.preventDefault());
  document.addEventListener('contextmenu', (event) => event.preventDefault());
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) event.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      sound.pauseBgm();
      if (state === 'playing') paused = true;
    } else {
      sound.unlock();
      if (state === 'playing' && !paused) sound.resumeBgm();
      lastTime = performance.now();
    }
  });
  window.addEventListener('pageshow', () => {
    sound.unlock();
    if (state === 'playing' && !paused) sound.resumeBgm();
    lastTime = performance.now();
  });
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 100));
  window.addEventListener('error', () => notify('異常', '動作を再開できません。再挑戦してください', 300));

  document.addEventListener('pointerdown', () => {
    sound.unlock();
  }, { capture: true });
  document.addEventListener('keydown', (event) => {
    sound.unlock();
    if (overlay.classList.contains('hidden')) return;
    if (event.code !== 'Enter' && event.code !== 'Space') return;
    event.preventDefault();
    startGame();
  });

  startBtn.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    startBtn.classList.add('is-pressed');
    sound.unlock();
    sound.playBgm(state === 'win' ? 'action' : 'stealth');
  });
  startBtn.addEventListener('pointerup', (event) => {
    event.preventDefault();
    startBtn.classList.remove('is-pressed');
    startGame();
  });
  startBtn.addEventListener('click', (event) => {
    event.preventDefault();
    startGame();
  });
  startBtn.addEventListener('pointercancel', () => startBtn.classList.remove('is-pressed'));
  muteBtn.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    sound.toggle();
  });

  setupInputs();
  resizeCanvas();
  requestAnimationFrame(loop);
})();
