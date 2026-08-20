window.NEKUBI_STAGES = [
  {
    short: '第一層', name: '荒野と城の入口', goal: '密書を奪還せよ', intro: '敵に気づかれる前に、影の中へ隠れてください。', objectiveType: '密書', objectiveTotal: 2,
    assist: { vision:.86, alert:.8, enemySpeed:.88, dashCost:18, shadowRegen:1.15, invincible:1.3, ammo:12 },
    palette: { skyA: '#151b22', skyB: '#8c3e2a', horizon: '#d07a3b', ink: '#111416', ground: '#4a3a2e', edge: '#e8c070', accent: '#f0d078' },
    platforms: [
      [0,646,3920,74],[140,540,300,24],[500,448,220,22],[800,568,200,24],[1100,430,240,22],[1460,548,360,24],
      [1960,390,200,22],[2260,520,280,24],[2660,370,190,22],[2980,455,260,22],[3360,555,220,24],[3650,530,200,22]
    ],
    enemies: [
      {x:220,p:1,type:'guard'},{x:1180,p:4,type:'scout'},{x:1580,p:5,type:'guard',sleeping:true},
      {x:2360,p:7,type:'scout'},{x:3080,p:9,type:'guard'},{x:3720,p:0,type:'guard',sleeping:true,deepSleep:true}
    ],
    objectives: [{x:580,p:2,type:'scroll'},{x:3120,p:9,type:'scroll'}],
    shadows: [[140,540,300,106],[1460,548,360,98],[2260,520,200,110],[2980,455,180,120],[3500,530,250,116]],
    hazards: [[430,55,'thorns'],[1360,70,'thorns'],[1880,55,'thorns'],[2580,65,'thorns'],[3280,50,'thorns']],
    exit: {x:3820,p:0}
  },
  {
    short: '第二層', name: '城内・兵士待機所', goal: '火鉢を消せ', intro: '兵が目覚める前に、三つの火を落として警備を崩せ。', objectiveType: '火鉢', objectiveTotal: 3,
    assist: { vision:1.0, alert:1.0, enemySpeed:1.0, ammo:12 },
    palette: { skyA: '#11100f', skyB: '#38241b', horizon: '#9d5c2c', ink: '#0c0d0d', ground: '#2b211b', edge: '#c0843e', accent: '#f0a547' },
    platforms: [
      [0,646,3920,74],[160,530,260,22],[480,410,240,24],[820,555,200,22],[1120,430,280,23],[1520,330,200,22],
      [1860,540,250,25],[2240,420,220,22],[2580,560,180,22],[2880,400,260,24],[3260,480,240,23],[3600,545,180,25]
    ],
    enemies: [
      {x:220,p:1,type:'guard'},{x:560,p:2,type:'archer'},{x:1220,p:4,type:'guard'},{x:1600,p:5,type:'archer'},
      {x:2340,p:7,type:'archer'},{x:2660,p:8,type:'guard'},{x:3360,p:10,type:'guard'},
      {x:3720,p:0,type:'guard',sleeping:true,deepSleep:true}
    ],
    objectives: [{x:240,p:1,type:'brazier'},{x:1600,p:5,type:'brazier'},{x:3380,p:10,type:'brazier'}],
    shadows: [[160,530,200,116],[1860,540,250,106],[2880,400,160,120],[3480,545,200,101]],
    hazards: [[700,48,'bell'],[2000,60,'bell'],[2780,50,'bell']],
    exit: {x:3820,p:0}
  },
  {
    short: '第三層', name: '城中腹・石垣回廊', goal: '封印を解除せよ', intro: '湿った石垣を登り、三つの封印を斬って上へ。', objectiveType: '封印', objectiveTotal: 3,
    assist: { vision:1.06, alert:1.08, enemySpeed:1.05, ammo:12 },
    palette: { skyA: '#071514', skyB: '#17423a', horizon: '#467d68', ink: '#07100f', ground: '#263531', edge: '#68a087', accent: '#94d8b2' },
    platforms: [
      [0,646,3920,74],[120,550,200,22],[380,450,200,22],[640,330,190,22],[920,480,210,22],[1220,360,200,22],
      [1520,250,180,22],[1800,430,220,24],[2140,540,240,22],[2480,400,200,22],[2760,300,190,22],[3080,460,210,22],
      [3360,280,200,22],[3660,420,200,24]
    ],
    enemies: [
      {x:180,p:1,type:'scout'},{x:700,p:3,type:'samurai'},{x:1320,p:5,type:'scout'},{x:1580,p:6,type:'samurai'},
      {x:1880,p:7,type:'scout'},{x:2820,p:10,type:'samurai'},{x:3160,p:11,type:'scout'},
      {x:3720,p:0,type:'scout',sleeping:true,deepSleep:true}
    ],
    objectives: [{x:450,p:2,type:'seal'},{x:1300,p:5,type:'seal'},{x:3440,p:12,type:'seal'}],
    shadows: [[120,550,160,96],[1800,430,180,110],[2140,540,240,106],[3080,460,150,101],[3500,545,220,101]],
    hazards: [[340,70,'water'],[1480,90,'water'],[2380,50,'water'],[2980,120,'water']],
    exit: {x:3820,p:0}
  },
  {
    short: '第四層', name: '最上階・月影御殿', goal: '結界柱を断て', intro: '開閉する障子と矢の間を読み、四本の結界柱を破壊せよ。', objectiveType: '結界', objectiveTotal: 4,
    assist: { vision:1.12, alert:1.15, enemySpeed:1.1, ammo:11 },
    palette: { skyA: '#140e18', skyB: '#472238', horizon: '#a64a5f', ink: '#0d0b10', ground: '#2c2028', edge: '#bb6d88', accent: '#ffc0d1' },
    platforms: [
      [0,646,3920,74],[150,525,230,22],[430,400,210,22],[760,555,200,23],[1080,410,230,22],[1420,530,240,23],
      [1760,380,200,22],[2100,545,180,24],[2420,405,220,22],[2760,540,200,23],[3080,390,210,22],[3400,520,230,23],
      [3680,400,180,22]
    ],
    enemies: [
      {x:500,p:2,type:'archer'},{x:1160,p:4,type:'samurai'},{x:1860,p:6,type:'archer'},
      {x:2500,p:8,type:'samurai'},{x:3160,p:10,type:'archer'},{x:3480,p:11,type:'samurai'},
      {x:3720,p:0,type:'archer',sleeping:true,deepSleep:true}
    ],
    objectives: [{x:220,p:1,type:'ward'},{x:1500,p:5,type:'ward'},{x:2500,p:8,type:'ward'},{x:3760,p:12,type:'ward'}],
    shadows: [[150,525,160,120],[1420,530,180,116],[2420,405,140,110],[3300,545,180,101]],
    hazards: [[860,55,'spikes'],[2060,50,'spikes'],[3040,58,'spikes']],
    gates: [900,2100,3100], exit: {x:3820,p:0}
  },
  {
    short: '第五層', name: '天守閣の外・暁天', goal: '眠る殿の首を掻け', intro: '屋根上の寝所。影から近づき、眠る殿の首を掻け。', objectiveType: '城主', objectiveTotal: 1,
    assist: { vision:1.15, alert:1.2, enemySpeed:1.12, dashCost:20, shadowRegen:1.0, invincible:1.0, ammo:8 },
    palette: { skyA: '#11182b', skyB: '#b64d38', horizon: '#f2a04d', ink: '#080b10', ground: '#242326', edge: '#e0a750', accent: '#ffd17a' },
    platforms: [
      [0,646,3920,74],[130,535,220,24],[400,410,240,23],[720,540,210,24],[1040,390,230,24],[1360,525,200,24],
      [1680,410,260,26],[2100,545,220,24],[2440,400,230,23],[2780,530,200,24],[3120,385,240,24],[3440,510,210,24],
      [3680,415,220,26]
    ],
    enemies: [
      {x:480,p:2,type:'archer'},{x:800,p:3,type:'samurai'},{x:1780,p:6,type:'samurai'},
      {x:2520,p:8,type:'archer'},{x:3760,p:12,type:'boss',sleeping:true}
    ],
    objectives: [],
    shadows: [[130,535,180,111],[1680,410,200,120],[3120,385,220,130],[3440,510,280,136]],
    hazards: [[360,40,'spikes'],[1520,48,'spikes'],[3180,46,'bell']],
    exit: {x:3820,p:0}
  }
];
