// Ninja Stealth Assassination Game
// simple canvas based stealth game following user's instructions

const TILE=32;
const MAP=[
"####################",
"#P....#....C.#....L#",
"#.##D#.####.#.##D###",
"#....#.#....#......#",
"###G.#.#.G..#.####.#",
"#....#.#....#....D.#",
"##.######D####.##..#",
"#...............#..#",
"#.#############.#.##",
"#.....C.........#..#",
"#.###############..#",
"#.................D#",
"####################"
];

let canvas,ctx,width,height;
let player={x:0,y:0,w:TILE,h:TILE,spd:2,silent:false,dir:{x:1,y:0},facing:{x:1,y:0}};
let guards=[],cats=[],doors=[],traps=[],stones=[];
let lord={x:0,y:0};
let stealth=100,noiseFlash=0,gameState='play',detected=false;
let snoreCtx=null;

function init(){
  canvas=document.getElementById('game');
  width=MAP[0].length*TILE;
  height=MAP.length*TILE;
  canvas.width=width;canvas.height=height;
  ctx=canvas.getContext('2d');
  parseMap();
  // Start snoring sound after the player interacts with the page
  const enableSound = () => {
    startSnore();
    window.removeEventListener('pointerdown', enableSound);
    window.removeEventListener('keydown', enableSound);
  };
  window.addEventListener('pointerdown', enableSound, { once: true });
  window.addEventListener('keydown', enableSound, { once: true });
  loop();
}

function parseMap(){
  for(let y=0;y<MAP.length;y++){
    for(let x=0;x<MAP[y].length;x++){
      const ch=MAP[y][x];
      switch(ch){
        case 'P':
          player.x=x*TILE;player.y=y*TILE;
          MAP[y]=MAP[y].replace('P','.');
          break;
        case 'L':
          lord.x=x*TILE;lord.y=y*TILE;
          MAP[y]=MAP[y].replace('L','.');
          break;
        case 'G':
          guards.push({x:x*TILE,y:y*TILE,dir:0,patrol:[{x:x*TILE,y:y*TILE},{x:x*TILE+TILE*3,y:y*TILE}],pi:1,speed:1,range:TILE*3,fov:Math.PI/6,alert:false});
          MAP[y]=MAP[y].replace('G','.');
          break;
        case 'C':
          cats.push({x:x*TILE,y:y*TILE,meowed:false});
          MAP[y]=MAP[y].replace('C','.');
          break;
        case 'D':
          doors.push({x:x*TILE,y:y*TILE,open:false});
          MAP[y]=MAP[y].replace('D','-'); // floor for movement
          break;
        case 'T':
          traps.push({x:x*TILE,y:y*TILE});
          MAP[y]=MAP[y].replace('T','.');
          break;
      }
    }
  }
}

const keys={};
document.addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(e.code==='KeyF')throwStone();
});
document.addEventListener('keyup',e=>{keys[e.code]=false;});

// allow control via postMessage from an external controller
window.addEventListener('message',e=>{
  const data=e.data;
  if(!data||data.type!=='control')return;
  keys[data.code]=data.pressed;
  if(data.code==='KeyF'&&data.pressed)throwStone();
});

function throwStone(){
  const dir=player.facing; 
  stones.push({x:player.x+player.w/2,y:player.y+player.h/2,vx:dir.x*4,vy:dir.y*4,life:60});
}

function startSnore(){
  snoreCtx=new (window.AudioContext||window.webkitAudioContext)();
  const osc=snoreCtx.createOscillator();
  osc.type='sine';osc.frequency.value=60;
  const gain=snoreCtx.createGain();
  gain.gain.setValueAtTime(0.1,snoreCtx.currentTime);
  osc.connect(gain);gain.connect(snoreCtx.destination);
  osc.start();
}

function loop(){
  update();
  render();
  requestAnimationFrame(loop);
}

function update(){
  if(gameState!=='play')return;
  let speed=player.silent?player.spd/2:player.spd;
  let vx=0,vy=0;
  if(keys['ArrowLeft']){vx=-speed;player.facing={x:-1,y:0};}
  if(keys['ArrowRight']){vx=speed;player.facing={x:1,y:0};}
  if(keys['ArrowUp']){vy=-speed;player.facing={x:0,y:-1};}
  if(keys['ArrowDown']){vy=speed;player.facing={x:0,y:1};}
  player.silent=keys['ShiftLeft']||keys['ShiftRight'];
  movePlayer(vx,vy);
  if((vx||vy)&&!player.silent)makeNoise(player.x+player.w/2,player.y+player.h/2);

  updateGuards();
  updateStones();
  checkCats();
  checkDoors();
  checkTraps();
  checkLord();
  if(noiseFlash>0)noiseFlash--; else stealth=Math.min(100,stealth+0.05);
}

function movePlayer(vx,vy){
  let nx=player.x+vx,ny=player.y+vy;
  if(isWalkable(nx,player.y))player.x=nx;
  if(isWalkable(player.x,ny))player.y=ny;
}

function isWalkable(x,y){
  let cx=Math.floor(x/TILE),cy=Math.floor(y/TILE);
  if(cx<0||cy<0||cy>=MAP.length||cx>=MAP[0].length)return false;
  return MAP[cy][cx]!=='#';
}

function updateGuards(){
  guards.forEach(g=>{
    const target=g.patrol[g.pi];
    const dx=target.x-g.x,dy=target.y-g.y;
    const dist=Math.hypot(dx,dy);
    if(dist<1){
      g.pi=(g.pi+1)%g.patrol.length;
    } else {
      g.x+=Math.sign(dx)*g.speed;
      g.y+=Math.sign(dy)*g.speed;
      g.dir=Math.atan2(dy,dx);
    }
    checkVision(g);
  });
}

function checkVision(g){
  const px=player.x+player.w/2,py=player.y+player.h/2;
  const gx=g.x+TILE/2,gy=g.y+TILE/2;
  const dx=px-gx,dy=py-gy;
  const dist=Math.hypot(dx,dy);
  if(dist<g.range){
    let ang=Math.atan2(dy,dx);
    let diff=Math.atan2(Math.sin(ang-g.dir),Math.cos(ang-g.dir));
    if(Math.abs(diff)<g.fov/2){
      detected=true;gameOver();
    }
  }
}

function makeNoise(x,y){
  noiseFlash=20;stealth=Math.max(0,stealth-10);
  guards.forEach(g=>{
    const dist=Math.hypot((g.x+TILE/2)-x,(g.y+TILE/2)-y);
    if(dist<TILE*2){detected=true;gameOver();}
  });
}

function checkCats(){
  cats.forEach(c=>{
    if(!c.meowed && Math.hypot(player.x-c.x,player.y-c.y)<TILE){
      c.meowed=true;meow(c);
    }
  });
}

function meow(cat){
  makeNoise(cat.x,cat.y);
  const ac=new (window.AudioContext||window.webkitAudioContext)();
  const osc=ac.createOscillator();
  osc.type='sawtooth';osc.frequency.value=400;
  const gain=ac.createGain();gain.gain.setValueAtTime(0.3,ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01,ac.currentTime+0.3);
  osc.connect(gain);gain.connect(ac.destination);osc.start();osc.stop(ac.currentTime+0.3);
}

function checkDoors(){
  doors.forEach(d=>{
    if(!d.open && player.x<d.x+TILE && player.x+player.w>d.x && player.y<d.y+TILE && player.y+player.h>d.y){
      d.open=true;makeNoise(d.x,d.y);
    }
  });
}

function checkTraps(){
  traps.forEach(t=>{
    if(player.x< t.x+TILE && player.x+player.w>t.x && player.y<t.y+TILE && player.y+player.h>t.y){
      if(!player.silent){detected=true;gameOver();}
    }
  });
}

function checkLord(){
  if(player.x<lord.x+TILE && player.x+player.w>lord.x && player.y<lord.y+TILE && player.y+player.h>lord.y){
    if(!detected)assassinate(); else gameOver();
  }
}

function updateStones(){
  stones.forEach(s=>{
    s.x+=s.vx;s.y+=s.vy;s.life--;
    if(!isWalkable(s.x,s.y)||s.life<=0){
      makeNoise(s.x,s.y);s.remove=true;
    }
  });
  stones=stones.filter(s=>!s.remove);
}

function gameOver(){
  if(gameState!=='play')return;
  gameState='over';
  alarm();
  setTimeout(()=>{
    alert('You were discovered');
  },100);
}

function assassinate(){
  gameState='clear';
  slowMotion(()=>{
    inkSplatter();
    silentBell();
    alert('MISSION COMPLETE');
  });
}

function slowMotion(cb){
  let count=0;
  function step(){
    render();
    count++;
    if(count<30)requestAnimationFrame(step); else cb();
  }
  step();
}

function inkSplatter(){
  ctx.fillStyle='rgba(0,0,0,0.8)';
  for(let i=0;i<20;i++){
    let r=Math.random()*100;
    ctx.beginPath();ctx.arc(Math.random()*width,Math.random()*height,r,0,Math.PI*2);ctx.fill();
  }
}

function silentBell(){
  const ac=new (window.AudioContext||window.webkitAudioContext)();
  const osc=ac.createOscillator();osc.type='sine';osc.frequency.value=800;
  const gain=ac.createGain();gain.gain.setValueAtTime(0.3,ac.currentTime);gain.gain.exponentialRampToValueAtTime(0.01,ac.currentTime+1);
  osc.connect(gain);gain.connect(ac.destination);osc.start();osc.stop(ac.currentTime+1);
}

function alarm(){
  const ac=new (window.AudioContext||window.webkitAudioContext)();
  const osc=ac.createOscillator();osc.type='square';osc.frequency.value=120;
  const gain=ac.createGain();gain.gain.setValueAtTime(0.4,ac.currentTime);gain.gain.exponentialRampToValueAtTime(0.01,ac.currentTime+0.5);
  osc.connect(gain);gain.connect(ac.destination);osc.start();osc.stop(ac.currentTime+0.5);
}

function render(){
  ctx.fillStyle='#111';ctx.fillRect(0,0,width,height);
  for(let y=0;y<MAP.length;y++){
    for(let x=0;x<MAP[y].length;x++){
      const ch=MAP[y][x];
      if(ch==='#'){
        ctx.fillStyle='#333';ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
      }else{
        ctx.fillStyle='#222';ctx.fillRect(x*TILE,y*TILE,TILE,TILE);
      }
    }
  }
  doors.forEach(d=>{ctx.fillStyle=d.open?'#664':'#999';ctx.fillRect(d.x,d.y,TILE,TILE);});
  traps.forEach(t=>{if(player.silent){ctx.fillStyle='#0f0';ctx.fillRect(t.x+8,t.y+8,16,16);}});
  cats.forEach(c=>{ctx.fillStyle='#880';ctx.fillRect(c.x+8,c.y+8,16,16);});
  guards.forEach(g=>{
    ctx.fillStyle=g.alert?'#f00':'#0f0';ctx.fillRect(g.x+8,g.y+8,16,16);
    drawFOV(g);
  });
  // lord
  ctx.fillStyle='#a00';ctx.fillRect(lord.x+4,lord.y+4,TILE-8,TILE-8);
  ctx.fillStyle='#fff';ctx.fillText('Zzz',lord.x,lord.y-4);
  // player
  ctx.fillStyle='#fff';ctx.fillRect(player.x+8,player.y+8,16,16);
  // stones
  ctx.fillStyle='#999';stones.forEach(s=>{ctx.beginPath();ctx.arc(s.x,s.y,4,0,Math.PI*2);ctx.fill();});
  drawUI();
}

function drawFOV(g){
  ctx.fillStyle='rgba(255,0,0,0.2)';
  ctx.beginPath();
  const gx=g.x+TILE/2, gy=g.y+TILE/2;
  ctx.moveTo(gx,gy);
  for(let i=-1;i<=1;i+=2){
    const ang=g.dir + i*g.fov/2;
    const x=gx+Math.cos(ang)*g.range;
    const y=gy+Math.sin(ang)*g.range;
    ctx.lineTo(x,y);
  }
  ctx.closePath();ctx.fill();
}

function drawUI(){
  const el=document.getElementById('stealthMeter');
  el.textContent='Stealth '+Math.round(stealth)+'%';
  el.style.color=noiseFlash>0?'red':'white';
}

window.onload=init;
