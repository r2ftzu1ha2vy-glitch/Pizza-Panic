/* Pizza Tower Defense (Expanded + Mobile Friendly + De-select)
   - Tap/click a tower button to select. Tap it again (or Esc) to de-select.
   - Tap/click map to place if a tower is selected.
   - Tap/click an existing tower to open action bar (Upgrade/Sell/Close).
   - Sounds: WebAudio generated (no external assets)
*/

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const UI = {
  wave: document.getElementById("wave"),
  lives: document.getElementById("lives"),
  cash: document.getElementById("cash"),
  score: document.getElementById("score"),
  btnStart: document.getElementById("btnStart"),
  btnPause: document.getElementById("btnPause"),
  btnRestart: document.getElementById("btnRestart"),
  shopGrid: document.getElementById("shopGrid"),
};

const W = canvas.width, H = canvas.height;

// ---------- Mobile action bar (created if missing) ----------
function ensureActionBar(){
  let bar = document.getElementById("actionBar");
  if (bar) return bar;

  bar = document.createElement("div");
  bar.id = "actionBar";
  bar.innerHTML = `
    <div class="abCard">
      <div class="abTitle" id="abTitle">Tower</div>
      <div class="abRow">
        <button id="abUpgrade">Upgrade</button>
        <button id="abSell" class="danger">Sell</button>
        <button id="abClose" class="ghost">Close</button>
      </div>
      <div class="abHint" id="abHint"></div>
    </div>
  `;
  document.body.appendChild(bar);

  // minimal inline CSS (so it works even if you don’t update style.css)
  const style = document.createElement("style");
  style.textContent = `
    #actionBar{
      position: fixed;
      left: 0; right: 0; bottom: 0;
      padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
      display: none;
      z-index: 9999;
      background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.55));
      backdrop-filter: blur(6px);
    }
    #actionBar .abCard{
      max-width: 920px;
      margin: 0 auto;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 16px;
      background: rgba(15,18,32,.82);
      padding: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,.35);
    }
    #actionBar .abTitle{
      font: 800 14px ui-sans-serif, system-ui;
      color: rgba(233,236,255,.95);
      margin: 2px 2px 10px;
    }
    #actionBar .abRow{
      display: flex;
      gap: 10px;
    }
    #actionBar button{
      flex: 1 1 auto;
      padding: 12px 10px;
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,.12);
      background: rgba(255,255,255,.06);
      color: rgba(233,236,255,.95);
      font: 800 14px ui-sans-serif, system-ui;
      cursor: pointer;
      touch-action: manipulation;
    }
    #actionBar button.danger{ border-color: rgba(255,107,107,.35); }
    #actionBar button.ghost{ opacity: .9; }
    #actionBar .abHint{
      margin: 8px 2px 0;
      color: rgba(170,176,214,.95);
      font: 600 12px ui-sans-serif, system-ui;
    }
  `;
  document.head.appendChild(style);

  return bar;
}
const actionBar = ensureActionBar();
const abTitle = document.getElementById("abTitle");
const abHint = document.getElementById("abHint");
const abUpgrade = document.getElementById("abUpgrade");
const abSell = document.getElementById("abSell");
const abClose = document.getElementById("abClose");

// ---------- WebAudio SFX ----------
let audioCtx = null;
function ensureAudio(){
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}
function beep({freq=440, type="sine", dur=0.08, gain=0.08, slide=0, when=0}){
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + when;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide !== 0) osc.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}
function noiseBurst({dur=0.12, gain=0.06, when=0, hp=900}){
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + when;
  const bufferSize = Math.max(1, Math.floor(audioCtx.sampleRate * dur));
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(hp, t0);

  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);

  src.connect(filter).connect(g).connect(audioCtx.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}
const SFX = {
  shoot(){ ensureAudio(); beep({freq:640,type:"square",dur:0.05,gain:0.05,slide:-160}); noiseBurst({dur:0.05,gain:0.02,hp:1200}); },
  laser(){ ensureAudio(); beep({freq:980,type:"sine",dur:0.07,gain:0.06,slide:120}); },
  freeze(){ ensureAudio(); beep({freq:420,type:"triangle",dur:0.08,gain:0.06,slide:-120}); },
  boom(){ ensureAudio(); noiseBurst({dur:0.16,gain:0.09,hp:200}); beep({freq:120,type:"sawtooth",dur:0.12,gain:0.05,slide:-20}); },
  hit(){ ensureAudio(); beep({freq:260,type:"triangle",dur:0.06,gain:0.04,slide:-40}); },
  kill(){ ensureAudio(); beep({freq:520,type:"sine",dur:0.06,gain:0.06}); beep({freq:760,type:"sine",dur:0.06,gain:0.05,when:0.06}); },
  place(){ ensureAudio(); beep({freq:330,type:"sine",dur:0.08,gain:0.06,slide:80}); },
  upgrade(){ ensureAudio(); beep({freq:500,type:"triangle",dur:0.06,gain:0.06}); beep({freq:700,type:"triangle",dur:0.08,gain:0.06,when:0.06}); },
  sell(){ ensureAudio(); beep({freq:260,type:"square",dur:0.06,gain:0.05,slide:-80}); },
  leak(){ ensureAudio(); beep({freq:220,type:"sawtooth",dur:0.12,gain:0.05,slide:-80}); beep({freq:180,type:"sawtooth",dur:0.14,gain:0.04,when:0.08,slide:-50}); },
  wave(){ ensureAudio(); beep({freq:400,type:"triangle",dur:0.08,gain:0.06}); beep({freq:520,type:"triangle",dur:0.08,gain:0.06,when:0.08}); beep({freq:660,type:"triangle",dur:0.10,gain:0.06,when:0.16}); },
};

// ---------- Helpers ----------
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const dist2=(ax,ay,bx,by)=>{ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };
const lerp=(a,b,t)=>a+(b-a)*t;

// ---------- Path ----------
const path = [
  {x: 40, y: 80},
  {x: 300, y: 80},
  {x: 300, y: 210},
  {x: 140, y: 210},
  {x: 140, y: 420},
  {x: 520, y: 420},
  {x: 520, y: 150},
  {x: 820, y: 150},
  {x: 820, y: 480},
  {x: 940, y: 480},
];
function cachePath(){
  const lens=[]; let total=0;
  for (let i=0;i<path.length-1;i++){
    const a=path[i], b=path[i+1];
    const l=Math.hypot(b.x-a.x,b.y-a.y);
    lens.push(l); total+=l;
  }
  return {lens,total};
}
const pathCache = cachePath();

function pointOnPath(t){
  let d=t*pathCache.total;
  for (let i=0;i<pathCache.lens.length;i++){
    const seg=pathCache.lens[i];
    const a=path[i], b=path[i+1];
    if (d<=seg){
      const tt=seg===0?0:d/seg;
      return {x:lerp(a.x,b.x,tt), y:lerp(a.y,b.y,tt)};
    }
    d-=seg;
  }
  const last=path[path.length-1];
  return {x:last.x,y:last.y};
}

function isNearRoad(x,y,thresh){
  for (let i=0;i<path.length-1;i++){
    const a=path[i], b=path[i+1];
    const vx=b.x-a.x, vy=b.y-a.y;
    const wx=x-a.x, wy=y-a.y;
    const c1=vx*wx+vy*wy;
    const c2=vx*vx+vy*vy;
    let t=c2===0?0:c1/c2;
    t=clamp(t,0,1);
    const px=a.x+vx*t, py=a.y+vy*t;
    if (Math.hypot(x-px,y-py)<=thresh) return true;
  }
  return false;
}

// ---------- Definitions ----------
const TOWERS = {
  pep:     { name:"Pepperoni", cost:50,  range:120, fireRate:3.0,  projectile:"bullet", dmg:10, color:"rgba(255,77,109,.9)" },
  freezer: { name:"Freezer",   cost:70,  range:110, fireRate:1.6,  projectile:"ice",    dmg:6,  slow:0.75, slowDur:0.8, splash:36, color:"rgba(114,221,255,.9)" },
  laser:   { name:"LaserSlice",cost:95,  range:160, fireRate:1.2,  projectile:"laser",  dmg:28, color:"rgba(255,209,102,.95)" },
  bomb:    { name:"BombOven",  cost:110, range:140, fireRate:0.65, projectile:"bomb",   dmg:22, splash:60, color:"rgba(255,159,28,.95)" },
};
const ENEMIES = {
  rat:      { hp:1.0,  spd:1.0,  r:12, bounty:1.0 },
  pineapple:{ hp:1.8,  spd:0.82, r:14, bounty:1.5 },
  olive:    { hp:0.75, spd:1.35, r:11, bounty:1.2 },
  meatball: { hp:6.0,  spd:0.70, r:18, bounty:6.0 },
};

// ---------- State ----------
let state;
let selectedTowerId = null;     // null = de-selected
let selectedTowerIndex = -1;    // for action bar
let mouse = {x:0,y:0};

function updateHUD(){
  UI.wave.textContent = state.wave;
  UI.lives.textContent = state.lives;
  UI.cash.textContent = state.cash;
  UI.score.textContent = state.score;
}
function reset(){
  state = {
    running:false,
    paused:false,
    time:0,
    lives:20,
    cash:140,
    score:0,
    wave:1,
    betweenWaves:true,
    nextWaveAt: 1.0,
    enemies:[],
    towers:[],
    bullets:[],
    particles:[],
    spawn: { active:false, toSpawn:0, cooldown:0, enemyHP:20, enemySpeed:45, baseBounty:8 },
  };
  closeTowerActions();
  updateHUD();
}
reset();

// ---------- Selection UI ----------
function setSelectedTower(id){
  selectedTowerId = id; // id or null
  document.querySelectorAll(".towerBtn").forEach(btn=>{
    btn.classList.toggle("active", id && btn.dataset.tower === id);
  });
}
function toggleSelectedTower(id){
  if (selectedTowerId === id) setSelectedTower(null);
  else setSelectedTower(id);
}
function closeTowerActions(){
  selectedTowerIndex = -1;
  actionBar.style.display = "none";
}
function openTowerActions(index){
  selectedTowerIndex = index;
  const t = state.towers[index];
  const def = TOWERS[t.type];
  const up = towerUpgradeCost(t);
  abTitle.textContent = `${def.name} (Lv ${t.level})`;
  abHint.textContent = `Upgrade: $${up} • Sell refund varies • Cash: $${state.cash}`;
  actionBar.style.display = "block";
}

// Wire shop buttons
document.querySelectorAll(".towerBtn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    ensureAudio();
    toggleSelectedTower(btn.dataset.tower);
    closeTowerActions();
  });
});

// Esc to de-select
window.addEventListener("keydown",(e)=>{
  if (e.key === "Escape"){
    setSelectedTower(null);
    closeTowerActions();
  }
});

// ---------- Tower actions (mobile + desktop) ----------
abUpgrade.addEventListener("click", ()=>{
  ensureAudio();
  if (selectedTowerIndex < 0) return;
  upgradeTower(state.towers[selectedTowerIndex]);
  // refresh hint
  if (selectedTowerIndex >= 0) openTowerActions(selectedTowerIndex);
});
abSell.addEventListener("click", ()=>{
  ensureAudio();
  if (selectedTowerIndex < 0) return;
  sellTower(selectedTowerIndex);
  closeTowerActions();
});
abClose.addEventListener("click", ()=> closeTowerActions());

// Desktop quick-sell still works when a tower is selected in actions
window.addEventListener("keydown",(e)=>{
  const k=e.key.toLowerCase();
  if (k==="delete" || k==="backspace"){
    if (selectedTowerIndex !== -1){
      ensureAudio();
      sellTower(selectedTowerIndex);
      closeTowerActions();
    }
  }
});

// ---------- Entities ----------
function spawnEnemy(kind){
  const p=pointOnPath(0);
  const def=ENEMIES[kind];
  const hp=Math.round(state.spawn.enemyHP * def.hp);
  state.enemies.push({
    kind, t:0,
    x:p.x,y:p.y,
    r:def.r,
    hp,hpMax:hp,
    speed: state.spawn.enemySpeed * def.spd,
    slowMul:1,
    slowTimer:0
  });
}

function addParticles(x,y,color,n=8){
  for (let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2;
    const s=40+Math.random()*160;
    state.particles.push({
      x,y,
      vx:Math.cos(a)*s,
      vy:Math.sin(a)*s,
      life:0.35+Math.random()*0.25,
      r:2+Math.random()*2,
      color
    });
  }
}

function fireProjectile(tower,target){
  const def=TOWERS[tower.type];
  const ang=Math.atan2(target.y-tower.y, target.x-tower.x);

  let spd=420, life=0.75;
  if (def.projectile==="laser"){ spd=900; life=0.22; }
  if (def.projectile==="bomb"){ spd=360; life=0.85; }
  if (def.projectile==="ice"){ spd=380; life=0.80; }

  state.bullets.push({
    type:def.projectile,
    x:tower.x,y:tower.y,
    vx:Math.cos(ang)*spd,
    vy:Math.sin(ang)*spd,
    r: def.projectile==="bomb" ? 6 : 4,
    dmg: def.dmg*(1+tower.level*0.18),
    splash: def.splash ? def.splash*(1+tower.level*0.10) : 0,
    slow: def.slow ?? 0,
    slowDur: def.slowDur ?? 0,
    life
  });

  if (def.projectile==="laser") SFX.laser();
  else if (def.projectile==="bomb") SFX.boom();
  else if (def.projectile==="ice") SFX.freeze();
  else SFX.shoot();
}

function placeTower(x,y){
  if (!selectedTowerId) return false;
  const def=TOWERS[selectedTowerId];
  if (state.cash < def.cost) return false;
  if (isNearRoad(x,y,34)) return false;
  for (const t of state.towers) if (dist2(x,y,t.x,t.y) < 26*26) return false;

  state.cash -= def.cost;
  state.towers.push({
    type:selectedTowerId,
    x,y,
    range:def.range,
    fireRate:def.fireRate,
    cd:0,
    level:0,
    cost:def.cost
  });
  SFX.place();
  updateHUD();
  return true;
}

function towerUpgradeCost(t){ return Math.round(t.cost * (0.7 + t.level*0.55)); }
function upgradeTower(t){
  const c=towerUpgradeCost(t);
  if (state.cash < c) return false;
  state.cash -= c;
  t.level++;
  t.range *= 1.06;
  t.fireRate *= 1.05;
  SFX.upgrade();
  updateHUD();
  return true;
}
function sellTower(idx){
  const t=state.towers[idx];
  const refund=Math.round(t.cost*0.65 + (t.level*0.35*t.cost));
  state.cash += refund;
  state.towers.splice(idx,1);
  // fix selection index if needed
  if (selectedTowerIndex === idx) selectedTowerIndex = -1;
  else if (selectedTowerIndex > idx) selectedTowerIndex--;
  SFX.sell();
  updateHUD();
}

function findTowerAt(x,y){
  let best=-1, bd=Infinity;
  for (let i=0;i<state.towers.length;i++){
    const t=state.towers[i];
    const d=dist2(x,y,t.x,t.y);
    if (d < 20*20 && d < bd){ bd=d; best=i; }
  }
  return best;
}

// ---------- Input (mobile-friendly pointer) ----------
canvas.addEventListener("pointermove",(ev)=>{
  const rect=canvas.getBoundingClientRect();
  mouse.x=(ev.clientX-rect.left)*(canvas.width/rect.width);
  mouse.y=(ev.clientY-rect.top)*(canvas.height/rect.height);
});

canvas.addEventListener("pointerdown",(ev)=>{
  ensureAudio();
  if (!state.running || state.paused) return;

  const rect=canvas.getBoundingClientRect();
  const x=(ev.clientX-rect.left)*(canvas.width/rect.width);
  const y=(ev.clientY-rect.top)*(canvas.height/rect.height);

  // If tapped a tower: open actions (mobile) / select for actions (desktop too)
  const hit = findTowerAt(x,y);
  if (hit !== -1){
    openTowerActions(hit);
    // don’t place on same tap
    return;
  }

  // tap empty: close actions
  closeTowerActions();

  // place only if tower is selected
  placeTower(x,y);
});

// ---------- Waves ----------
function startWave(){
  state.betweenWaves=false;
  state.spawn.active=true;

  const w=state.wave;
  state.spawn.enemyHP = 18 + Math.floor(w*5.0);
  state.spawn.enemySpeed = 44 + w*2.2;
  state.spawn.baseBounty = 7 + Math.floor(w*0.8);

  let count=8+w*3;
  const bossWave=(w%5===0);
  if (bossWave) count=Math.max(6,count-6);

  state.spawn.toSpawn = count + (bossWave ? 1 : 0);
  state.spawn.cooldown=0.25;
  SFX.wave();
}
function pickEnemyForWave(){
  const w=state.wave;
  const rat=1.0;
  const pineapple=clamp(0.20+w*0.03,0.20,0.80);
  const olive=clamp(0.10+w*0.04,0.10,0.90);
  const total=rat+pineapple+olive;
  const r=Math.random()*total;
  if (r<rat) return "rat";
  if (r<rat+pineapple) return "pineapple";
  return "olive";
}
function finishWave(){
  state.betweenWaves=true;
  state.spawn.active=false;
  state.nextWaveAt = state.time + 2.0;
  state.wave++;
  updateHUD();
}

// ---------- Loop ----------
let last=performance.now();
requestAnimationFrame(loop);

function loop(now){
  const dt=clamp((now-last)/1000, 0, 0.05);
  last=now;
  if (state.running && !state.paused) update(dt);
  render();
  requestAnimationFrame(loop);
}

function update(dt){
  state.time += dt;

  if (state.betweenWaves && state.time >= state.nextWaveAt) startWave();

  // spawn
  if (state.spawn.active){
    state.spawn.cooldown -= dt;
    while (state.spawn.cooldown <= 0 && state.spawn.toSpawn > 0){
      const w=state.wave;
      const bossWave=(w%5===0);
      if (bossWave && state.spawn.toSpawn===1) spawnEnemy("meatball");
      else spawnEnemy(pickEnemyForWave());
      state.spawn.toSpawn--;
      state.spawn.cooldown += 0.55;
    }
    if (state.spawn.toSpawn<=0 && state.enemies.length===0) finishWave();
  }

  // enemies
  for (let i=state.enemies.length-1;i>=0;i--){
    const e=state.enemies[i];
    if (e.slowTimer>0){
      e.slowTimer -= dt;
      if (e.slowTimer<=0) e.slowMul=1;
    }
    const speed=e.speed*e.slowMul;
    e.t += (speed*dt)/pathCache.total;
    const p=pointOnPath(clamp(e.t,0,1));
    e.x=p.x; e.y=p.y;

    if (e.t>=1){
      state.enemies.splice(i,1);
      state.lives -= (e.kind==="meatball" ? 3 : 1);
      SFX.leak();
      updateHUD();
      if (state.lives<=0){ state.running=false; state.paused=false; closeTowerActions(); }
    }
  }

  // towers shoot
  for (const t of state.towers){
    t.cd -= dt;
    if (t.cd>0) continue;

    const r2=t.range*t.range;
    let best=null, bestScore=Infinity;

    for (const e of state.enemies){
      const d=dist2(t.x,t.y,e.x,e.y);
      if (d>r2) continue;
      const prio = (e.kind==="meatball") ? -1 : 0;
      const score = prio*1e12 + d;
      if (score < bestScore){ bestScore=score; best=e; }
    }

    if (best){
      fireProjectile(t,best);
      t.cd = 1 / (t.fireRate*(1+t.level*0.06));
    }
  }

  // bullets
  for (let i=state.bullets.length-1;i>=0;i--){
    const b=state.bullets[i];
    b.x += b.vx*dt;
    b.y += b.vy*dt;
    b.life -= dt;

    let hit=-1;
    for (let j=0;j<state.enemies.length;j++){
      const e=state.enemies[j];
      const rr=b.r+e.r;
      if (dist2(b.x,b.y,e.x,e.y) <= rr*rr){ hit=j; break; }
    }

    if (hit!==-1){
      const e=state.enemies[hit];
      applyHit(e, b.dmg, b, false);

      if (b.splash>0){
        const s2=b.splash*b.splash;
        for (let j=state.enemies.length-1;j>=0;j--){
          if (j===hit) continue;
          const ee=state.enemies[j];
          if (dist2(b.x,b.y,ee.x,ee.y) <= s2){
            applyHit(ee, b.dmg*0.65, b, true);
          }
        }
        addParticles(b.x,b.y,"rgba(255,209,102,.9)", 14);
      } else {
        addParticles(b.x,b.y,"rgba(255,77,109,.9)", 8);
      }

      state.bullets.splice(i,1);
      continue;
    }

    if (b.life<=0 || b.x<0 || b.y<0 || b.x>W || b.y>H){
      state.bullets.splice(i,1);
    }
  }

  // particles
  for (let i=state.particles.length-1;i>=0;i--){
    const p=state.particles[i];
    p.x += p.vx*dt; p.y += p.vy*dt;
    p.vx *= Math.pow(0.02, dt);
    p.vy *= Math.pow(0.02, dt);
    p.life -= dt;
    if (p.life<=0) state.particles.splice(i,1);
  }
}

function applyHit(enemy, dmg, proj, fromSplash){
  enemy.hp -= dmg;
  if (!fromSplash) SFX.hit();

  if (proj.slowDur>0){
    enemy.slowMul = Math.min(enemy.slowMul, proj.slow);
    enemy.slowTimer = Math.max(enemy.slowTimer, proj.slowDur);
  } else {
    enemy.slowMul = Math.min(enemy.slowMul, 0.92);
    enemy.slowTimer = Math.max(enemy.slowTimer, 0.10);
  }

  if (enemy.hp <= 0){
    const def=ENEMIES[enemy.kind];
    const bounty=Math.round(state.spawn.baseBounty * def.bounty);
    state.cash += bounty;
    state.score += (enemy.kind==="meatball" ? 120 : 10);
    SFX.kill();
    addParticles(enemy.x,enemy.y,"rgba(61,220,151,.9)", enemy.kind==="meatball" ? 22 : 12);

    const idx=state.enemies.indexOf(enemy);
    if (idx!==-1) state.enemies.splice(idx,1);

    updateHUD();
  }
}

// ---------- Render ----------
function drawGrid(){
  ctx.save();
  ctx.globalAlpha=0.18;
  ctx.strokeStyle="rgba(255,255,255,.06)";
  ctx.lineWidth=1;
  const step=40;
  for (let x=0;x<=W;x+=step){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y=0;y<=H;y+=step){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  ctx.restore();
}

function drawRoad(){
  ctx.save();
  ctx.lineCap="round"; ctx.lineJoin="round";

  ctx.strokeStyle="rgba(255, 209, 102, 0.18)";
  ctx.lineWidth=42;
  ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y);
  for (let i=1;i<path.length;i++) ctx.lineTo(path[i].x,path[i].y);
  ctx.stroke();

  ctx.strokeStyle="rgba(15, 18, 32, 0.55)";
  ctx.lineWidth=30;
  ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y);
  for (let i=1;i<path.length;i++) ctx.lineTo(path[i].x,path[i].y);
  ctx.stroke();

  ctx.setLineDash([14,12]);
  ctx.strokeStyle="rgba(255, 209, 102, 0.45)";
  ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(path[0].x,path[0].y);
  for (let i=1;i<path.length;i++) ctx.lineTo(path[i].x,path[i].y);
  ctx.stroke();
  ctx.setLineDash([]);

  const s=path[0], e=path[path.length-1];
  ctx.fillStyle="rgba(61,220,151,.25)";
  ctx.strokeStyle="rgba(61,220,151,.45)";
  ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(s.x,s.y,16,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle="rgba(255,77,109,.22)";
  ctx.strokeStyle="rgba(255,77,109,.42)";
  ctx.beginPath(); ctx.arc(e.x,e.y,16,0,Math.PI*2); ctx.fill(); ctx.stroke();

  ctx.restore();
}

function towerUpgradeCost(t){ return Math.round(t.cost * (0.7 + t.level*0.55)); }

function drawTower(t, hover=false){
  const def=TOWERS[t.type];
  ctx.save();

  // show range if action bar is open on this tower (mobile) or hover ring
  if (hover){
    ctx.globalAlpha=0.22;
    ctx.fillStyle=def.color;
    ctx.beginPath(); ctx.arc(t.x,t.y,t.range,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }

  ctx.fillStyle="rgba(0,0,0,.25)";
  ctx.beginPath(); ctx.ellipse(t.x,t.y+10,18,8,0,0,Math.PI*2); ctx.fill();

  ctx.fillStyle="rgba(255, 209, 102, .95)";
  ctx.strokeStyle="rgba(0,0,0,.25)";
  ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(t.x,t.y,16,0,Math.PI*2); ctx.fill(); ctx.stroke();

  if (t.type==="pep"){
    ctx.fillStyle="rgba(255, 77, 109, .85)";
    ctx.beginPath(); ctx.arc(t.x,t.y,11,0,Math.PI*2); ctx.fill();
  } else if (t.type==="freezer"){
    ctx.fillStyle="rgba(114, 221, 255, .85)";
    ctx.beginPath(); ctx.arc(t.x,t.y,11,0,Math.PI*2); ctx.fill();
  } else if (t.type==="laser"){
    ctx.fillStyle="rgba(255, 209, 102, .90)";
    ctx.beginPath(); ctx.arc(t.x,t.y,11,0,Math.PI*2); ctx.fill();
  } else if (t.type==="bomb"){
    ctx.fillStyle="rgba(255, 159, 28, .90)";
    ctx.beginPath(); ctx.arc(t.x,t.y,11,0,Math.PI*2); ctx.fill();
  }

  if (t.level>0){
    ctx.fillStyle="rgba(15,18,32,.65)";
    ctx.beginPath(); ctx.arc(t.x+14,t.y-14,9,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(233,236,255,.95)";
    ctx.font="800 11px ui-sans-serif,system-ui";
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(String(t.level), t.x+14, t.y-14);
  }

  ctx.restore();
}

function drawBullet(b){
  ctx.save();
  if (b.type==="laser"){
    ctx.fillStyle="rgba(255, 209, 102, .95)";
    ctx.beginPath(); ctx.arc(b.x,b.y,3,0,Math.PI*2); ctx.fill();
  } else if (b.type==="ice"){
    ctx.fillStyle="rgba(114, 221, 255, .95)";
    ctx.beginPath(); ctx.arc(b.x,b.y,4,0,Math.PI*2); ctx.fill();
  } else if (b.type==="bomb"){
    ctx.fillStyle="rgba(255, 159, 28, .95)";
    ctx.beginPath(); ctx.arc(b.x,b.y,6,0,Math.PI*2); ctx.fill();
  } else {
    ctx.fillStyle="rgba(255, 77, 109, .95)";
    ctx.beginPath(); ctx.arc(b.x,b.y,4,0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawEnemy(e){
  ctx.save();
  // simple body
  if (e.kind==="rat") ctx.fillStyle="rgba(170,176,214,.92)";
  else if (e.kind==="pineapple") ctx.fillStyle="rgba(255,209,102,.92)";
  else if (e.kind==="olive") ctx.fillStyle="rgba(61,220,151,.90)";
  else ctx.fillStyle="rgba(178,58,72,.93)";
  ctx.strokeStyle="rgba(0,0,0,.25)"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill(); ctx.stroke();

  // hp
  const bw=(e.kind==="meatball"?46:32), bh=6;
  const pct=clamp(e.hp/e.hpMax,0,1);
  ctx.fillStyle="rgba(0,0,0,.35)";
  ctx.fillRect(e.x-bw/2, e.y-e.r-14, bw, bh);
  ctx.fillStyle = pct>0.5 ? "rgba(61,220,151,.9)" : (pct>0.25 ? "rgba(255,209,102,.95)" : "rgba(255,107,107,.95)");
  ctx.fillRect(e.x-bw/2, e.y-e.r-14, bw*pct, bh);

  // slow ring
  if (e.slowMul < 0.999){
    ctx.globalAlpha=0.35;
    ctx.strokeStyle="rgba(114,221,255,.95)";
    ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r+4,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=1;
  }

  ctx.restore();
}

function drawParticle(p){
  ctx.save();
  ctx.globalAlpha=clamp(p.life/0.6,0,1);
  ctx.fillStyle=p.color;
  ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawOverlay(){
  ctx.save();

  // placement preview only if a tower is selected
  if (state.running && !state.paused && selectedTowerId){
    const def=TOWERS[selectedTowerId];
    const ok=!isNearRoad(mouse.x,mouse.y,34);
    ctx.globalAlpha=0.18;
    ctx.fillStyle = ok ? def.color : "rgba(255,107,107,.9)";
    ctx.beginPath(); ctx.arc(mouse.x,mouse.y,def.range,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;

    ctx.font="800 14px ui-sans-serif,system-ui";
    ctx.textAlign="left"; ctx.textBaseline="top";
    ctx.fillStyle="rgba(233,236,255,.9)";
    ctx.fillText(`Selected: ${def.name} ($${def.cost}) • Tap button again to de-select • Tap placed tower for actions`, 14, 14);
  } else if (state.running && !state.paused && !selectedTowerId){
    ctx.font="800 14px ui-sans-serif,system-ui";
    ctx.textAlign="left"; ctx.textBaseline="top";
    ctx.fillStyle="rgba(233,236,255,.85)";
    ctx.fillText(`No tower selected • Tap a tower button to select • Tap placed tower for Upgrade/Sell`, 14, 14);
  }

  if (!state.running){
    const gameOver=state.lives<=0;
    ctx.fillStyle="rgba(0,0,0,.40)";
    ctx.fillRect(0,0,W,H);
    ctx.textAlign="center";
    ctx.fillStyle="rgba(233,236,255,.96)";
    ctx.font="900 44px ui-sans-serif,system-ui";
    ctx.fillText(gameOver ? "GAME OVER" : "PIZZA TOWER DEFENSE", W/2, H/2-70);
    ctx.font="700 18px ui-sans-serif,system-ui";
    ctx.fillStyle="rgba(233,236,255,.88)";
    ctx.fillText("Tap a tower button, then tap the map to place. Tap placed tower to Upgrade/Sell.", W/2, H/2-14);
    ctx.fillStyle="rgba(170,176,214,.95)";
    ctx.fillText("Tap same tower button again to de-select.", W/2, H/2+14);
    ctx.fillStyle="rgba(255,209,102,.95)";
    ctx.font="800 16px ui-sans-serif,system-ui";
    ctx.fillText("Sound starts after your first tap/click (browser policy).", W/2, H/2+46);
    if (gameOver){
      ctx.fillStyle="rgba(170,176,214,.95)";
      ctx.fillText(`Final Score: ${state.score}`, W/2, H/2+78);
    }
  }

  if (state.paused){
    ctx.fillStyle="rgba(0,0,0,.35)";
    ctx.fillRect(0,0,W,H);
    ctx.textAlign="center";
    ctx.font="900 40px ui-sans-serif,system-ui";
    ctx.fillStyle="rgba(233,236,255,.96)";
    ctx.fillText("PAUSED", W/2, H/2-20);
    ctx.font="700 16px ui-sans-serif,system-ui";
    ctx.fillStyle="rgba(170,176,214,.95)";
    ctx.fillText("Press Pause again or Start to resume.", W/2, H/2+18);
  }

  ctx.restore();
}

function render(){
  ctx.clearRect(0,0,W,H);
  drawGrid();
  drawRoad();

  for (let i=0;i<state.towers.length;i++){
    drawTower(state.towers[i], i===selectedTowerIndex);
  }
  for (const b of state.bullets) drawBullet(b);
  for (const e of state.enemies) drawEnemy(e);
  for (const p of state.particles) drawParticle(p);

  drawOverlay();
}

// ---------- Top buttons ----------
UI.btnStart.addEventListener("click", ()=>{
  ensureAudio();
  if (!state.running){ state.running=true; state.paused=false; }
  else state.paused=false;
});
UI.btnPause.addEventListener("click", ()=>{
  if (!state.running) return;
  state.paused = !state.paused;
  if (state.paused) closeTowerActions();
});
UI.btnRestart.addEventListener("click", ()=> reset());
