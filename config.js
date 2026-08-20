window.NEKUBI_STAGES = [
  {
    short: '第一層', name: '荒野と城の入口', goal: '密書を奪還せよ', intro: '敵に気づかれる前に、影の中へ隠れてください。', objectiveType: '密書', objectiveTotal: 2,
    assist: { vision:.68, alert:.5, enemySpeed:.7, dashCost:16, shadowRegen:1.35, invincible:1.65, ammo:14 },
    palette: { skyA: '#151b22', skyB: '#8c3e2a', horizon: '#d07a3b', ink: '#111416', ground: '#4a3a2e', edge: '#e8c070', accent: '#f0d078' },
    platforms: [
      [0,646,3920,74],[175,540,320,24],[515,454,235,22],[770,562,290,24],[1080,470,250,22],[1355,390,255,22],[1625,535,250,25],
      [2050,540,310,24],[2440,448,250,22],[2780,555,290,24],[3160,430,260,22],[3520,540,280,24]
    ],
    enemies: [
      {x:350,p:1,type:'guard'},{x:900,p:3,type:'scout'},{x:1400,p:5,type:'guard'},{x:1750,p:6,type:'scout'},
      {x:2200,p:7,type:'guard'},{x:2580,p:8,type:'scout'},{x:2950,p:9,type:'guard'},{x:3300,p:10,type:'scout'},
      {x:3680,p:0,type:'guard',sleeping:true,deepSleep:true}
    ],
    objectives: [{x:615,p:2,type:'scroll'},{x:3280,p:10,type:'scroll'}],
    shadows: [[35,540,320,106],[810,548,285,98],[1460,525,245,121],[2100,540,300,106],[2860,548,280,98],[3480,525,250,121]],
    hazards: [], exit: {x:3820,p:0}
  },
  {
    short: '第二層', name: '城内・兵士待機所', goal: '火鉢を消せ', intro: '兵が目覚める前に、三つの火を落として警備を崩せ。', objectiveType: '火鉢', objectiveTotal: 3,
    assist: { ammo:12 },
    palette: { skyA: '#11100f', skyB: '#38241b', horizon: '#9d5c2c', ink: '#0c0d0d', ground: '#2b211b', edge: '#c0843e', accent: '#f0a547' },
    platforms: [
      [0,646,3920,74],[185,535,280,22],[530,427,260,24],[835,547,245,22],[1140,445,245,23],[1440,342,210,22],[1675,530,230,25],
      [2080,535,280,22],[2460,420,250,24],[2820,545,250,22],[3180,430,245,23],[3540,530,230,25]
    ],
    enemies: [
      {x:260,p:1,type:'guard',sleeping:true},{x:600,p:2,type:'archer'},{x:930,p:3,type:'guard'},{x:1220,p:4,type:'archer'},
      {x:1745,p:6,type:'guard'},{x:2220,p:7,type:'archer'},{x:2580,p:8,type:'guard'},{x:2940,p:9,type:'archer'},
      {x:3300,p:10,type:'guard'},{x:3680,p:0,type:'guard',sleeping:true,deepSleep:true}
    ],
    objectives: [{x:390,p:1,type:'brazier'},{x:1545,p:5,type:'brazier'},{x:3320,p:10,type:'brazier'}],
    shadows: [[20,535,175,111],[795,545,130,101],[1355,535,155,111],[2080,535,175,111],[2860,545,140,101],[3480,535,155,111]],
    hazards: [[1085,55,'bell'],[1645,42,'bell'],[3045,55,'bell'],[3605,42,'bell']], exit: {x:3820,p:0}
  },
  {
    short: '第三層', name: '城中腹・石垣回廊', goal: '封印を解除せよ', intro: '湿った石垣を登り、三つの封印を斬って上へ。', objectiveType: '封印', objectiveTotal: 3,
    assist: { ammo:12 },
    palette: { skyA: '#071514', skyB: '#17423a', horizon: '#467d68', ink: '#07100f', ground: '#263531', edge: '#68a087', accent: '#94d8b2' },
    platforms: [
      [0,646,3920,74],[145,548,230,22],[420,448,220,22],[685,346,205,22],[925,474,230,22],[1205,365,220,22],[1470,262,205,22],[1710,435,225,24],
      [2060,548,230,22],[2340,448,220,22],[2600,346,205,22],[2880,474,230,22],[3160,365,220,22],[3440,262,205,22],[3700,435,180,24]
    ],
    enemies: [
      {x:230,p:1,type:'scout'},{x:500,p:2,type:'samurai'},{x:755,p:3,type:'scout'},{x:1020,p:4,type:'samurai'},
      {x:1540,p:6,type:'scout'},{x:1780,p:7,type:'samurai'},{x:2180,p:8,type:'scout'},{x:2460,p:9,type:'samurai'},
      {x:2920,p:11,type:'scout'},{x:3500,p:13,type:'samurai'},{x:3680,p:0,type:'scout',sleeping:true,deepSleep:true}
    ],
    objectives: [{x:550,p:2,type:'seal'},{x:1285,p:5,type:'seal'},{x:3280,p:12,type:'seal'}],
    shadows: [[30,548,120,98],[870,545,150,101],[1610,535,145,111],[2100,548,130,98],[2820,545,150,101],[3480,535,145,111]],
    hazards: [[385,42,'water'],[655,55,'water'],[1155,70,'water'],[2345,42,'water'],[2615,55,'water'],[3115,70,'water']],
    exit: {x:3820,p:0}
  },
  {
    short: '第四層', name: '最上階・月影御殿', goal: '結界柱を断て', intro: '開閉する障子と矢の間を読み、四本の結界柱を破壊せよ。', objectiveType: '結界', objectiveTotal: 4,
    assist: { ammo:12 },
    palette: { skyA: '#140e18', skyB: '#472238', horizon: '#a64a5f', ink: '#0d0b10', ground: '#2c2028', edge: '#bb6d88', accent: '#ffc0d1' },
    platforms: [
      [0,646,3920,74],[160,528,240,22],[455,407,205,22],[710,542,230,23],[985,414,210,22],[1245,532,230,23],[1515,395,210,22],[1740,535,190,24],
      [2080,528,240,22],[2380,407,205,22],[2660,542,230,23],[2940,414,210,22],[3220,532,230,23],[3500,395,210,22],[3740,535,160,24]
    ],
    enemies: [
      {x:250,p:1,type:'archer'},{x:530,p:2,type:'samurai'},{x:1055,p:4,type:'archer'},{x:1325,p:5,type:'samurai'},
      {x:1780,p:7,type:'archer'},{x:2180,p:8,type:'samurai'},{x:2460,p:9,type:'archer'},{x:2980,p:11,type:'samurai'},
      {x:3300,p:12,type:'archer'},{x:3680,p:0,type:'archer',sleeping:true,deepSleep:true}
    ],
    objectives: [{x:345,p:1,type:'ward'},{x:570,p:2,type:'ward'},{x:2480,p:9,type:'ward'},{x:3580,p:13,type:'ward'}],
    shadows: [[25,545,135,101],[640,545,100,101],[1165,545,115,101],[2100,545,135,101],[2720,545,100,101],[3240,545,115,101]],
    hazards: [[405,45,'spikes'],[945,40,'spikes'],[1480,40,'spikes'],[2365,45,'spikes'],[2905,40,'spikes'],[3440,40,'spikes']],
    gates: [680,1215,1700,2640,3175], exit: {x:3820,p:0}
  },
  {
    short: '第五層', name: '天守閣の外・暁天', goal: '眠る殿の首を掻け', intro: '屋根上の寝所。影から近づき、眠る殿の首を掻け。', objectiveType: '城主', objectiveTotal: 1,
    assist: { vision:.72, alert:.42, enemySpeed:.62, dashCost:16, shadowRegen:1.25, invincible:1.55, ammo:10 },
    palette: { skyA: '#11182b', skyB: '#b64d38', horizon: '#f2a04d', ink: '#080b10', ground: '#242326', edge: '#e0a750', accent: '#ffd17a' },
    platforms: [
      [0,646,3920,74],[145,530,235,24],[430,418,230,23],[715,535,230,24],[990,397,235,24],[1280,518,230,24],[1570,420,280,26],
      [1980,530,235,24],[2320,418,230,23],[2660,535,230,24],[3000,397,235,24],[3340,518,230,24],[3600,420,280,26]
    ],
    enemies: [
      {x:230,p:1,type:'samurai',sleeping:true},{x:800,p:3,type:'samurai'},{x:1360,p:5,type:'samurai',sleeping:true},
      {x:2100,p:7,type:'samurai'},{x:2740,p:9,type:'samurai'},{x:3680,p:12,type:'boss',sleeping:true,deepSleep:true}
    ],
    objectives: [],
    shadows: [[15,545,130,101],[650,545,110,101],[1215,545,110,101],[1980,545,130,101],[2620,545,110,101],[3280,545,110,101]],
    hazards: [[385,44,'spikes'],[955,40,'spikes'],[1515,50,'spikes'],[2345,44,'spikes'],[2915,40,'spikes'],[3475,50,'spikes']],
    exit: {x:3820,p:0}
  }
];
