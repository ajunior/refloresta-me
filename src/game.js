'use strict';
// Refloresta.me — motor do jogo

const W = 384, H = 224, TS = 16;
const STEP = 1 / 60;
const T_EMPTY = 0, T_SOLID = 1, T_LOG = 2, T_WATER = 3, T_TOXIC = 4;
const FIRE_HP = 16, EMBER_HP = 8, SURVIVOR_NEED = 32, SEED_MAX = 12;
const ANIMAL_NAMES = {
  arara: 'a arara', macaco: 'o macaco', preguica: 'a preguiça',
  tucano: 'o tucano', anta: 'a anta', onca: 'a onça',
};
const ANIMAL_COLORS = {
  arara: ['#e0302a', '#2f6fd6', '#f2c443'], macaco: ['#7a5230', '#d6b48a'], preguica: ['#a8865f', '#d6b48a'],
  tucano: ['#26262c', '#f39a1e', '#ffffff'], anta: ['#4a4048', '#9a9498'], onca: ['#e0a640', '#3a2a20'],
};
const FLYERS = ['arara', 'tucano'];
const RAIN_GREEN = 0.65, RAIN_TIME = 14, RAIN_COOLDOWN = 40;

const SPR = buildSprites();
const cv = document.getElementById('game');
const sctx = cv.getContext('2d');
const view = document.createElement('canvas');
view.width = W;
view.height = H;
const g = view.getContext('2d');
g.imageSmoothingEnabled = false;
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------- tela
function resize() {
  const dpr = window.devicePixelRatio || 1;
  let s = Math.min(innerWidth / W, innerHeight / H);
  if (s >= 2) s = Math.floor(s * 2) / 2;
  cv.style.width = Math.floor(W * s) + 'px';
  cv.style.height = Math.floor(H * s) + 'px';
  cv.width = Math.floor(W * s * dpr);
  cv.height = Math.floor(H * s * dpr);
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- entrada
const keys = {}, pressed = {};
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
addEventListener('keydown', e => {
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  Sfx.unlock();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ---------------------------------------------------------------- toque (celular e tablet)
let touchMode = false;
const pointers = new Map();
const TOUCH_BTNS = [
  { code: 'ArrowLeft', x: 30, y: H - 30, r: 19, icon: 'left' },
  { code: 'ArrowRight', x: 74, y: H - 30, r: 19, icon: 'right' },
  { code: 'ArrowUp', x: 52, y: H - 68, r: 14, icon: 'up' },
  { code: 'Space', x: W - 30, y: H - 30, r: 20, label: 'PULO', color: '#5cc25a' },
  { code: 'KeyX', x: W - 74, y: H - 28, r: 17, label: 'ÁGUA', color: '#3d95d6' },
  { code: 'KeyC', x: W - 52, y: H - 70, r: 15, label: 'SEMENTE', color: '#c9a24a' },
  { code: 'KeyP', x: 254, y: 15, r: 10, label: 'II', color: '#9a9498' },
];

function toGame(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}

const touchUI = () => state === 'play' && !card && !paused;

function syncTouchButtons() {
  for (const b of TOUCH_BTNS) {
    const on = touchUI() && [...pointers.values()].some(p => Math.hypot(p.x - b.x, p.y - b.y) < b.r * 1.35);
    if (on && !b.on) { keys[b.code] = true; pressed[b.code] = true; }
    if (!on && b.on) keys[b.code] = false;
    b.on = on;
  }
}

cv.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch') return;
  e.preventDefault();
  Sfx.unlock();
  if (!touchMode) {
    touchMode = true;
    document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  }
  const p = toGame(e);
  pointers.set(e.pointerId, p);
  if (paused) pressed.KeyP = true;
  else if (state === 'story' && p.x < 90 && p.y > H - 34) pressed.Escape = true;
  else if (!touchUI()) pressed.Enter = true;
  syncTouchButtons();
});
cv.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, toGame(e));
  syncTouchButtons();
});
for (const ev of ['pointerup', 'pointercancel']) {
  cv.addEventListener(ev, e => { pointers.delete(e.pointerId); syncTouchButtons(); });
}

const held = (...codes) => codes.some(c => keys[c]);
const hit = (...codes) => codes.some(c => pressed[c]);

// ---------------------------------------------------------------- estado
let state = 'title';
let levelIdx = 0;
let story = null;
let card = null;
const seenFacts = new Set();
let factQueue = [];
let rain = { t: 0, dur: RAIN_TIME, k: 0, cd: 8, bow: 0 };
let party = null;
let paused = false;
let time = 0, winT = 0;
let L, P, checkpoint;
const cam = { x: 0 };
let drops = [], seeds = [], particles = [], trail = [];
let hint = { text: '', t: 0 };
let toast = { text: '', t: 0 };
let shownHints = new Set();
let stats;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- nível
function loadLevel(def) {
  const w = def.width, h = def.height;
  L = {
    def, w, h,
    tiles: new Uint8Array(w * h),
    top: new Int16Array(w).fill(-1),
    g: new Float32Array(w),
    gt: new Float32Array(w),
    waves: [], platforms: [], saplings: [], followers: L ? L.followers : [],
    goalX: def.goal * TS,
  };
  for (const [a, b, row] of def.ground) {
    for (let c = a; c <= b; c++) {
      L.top[c] = row;
      for (let r = row; r < h; r++) L.tiles[r * w + c] = T_SOLID;
    }
  }
  for (const [a, b] of def.water) {
    for (let c = a; c <= b; c++) {
      L.tiles[L.top[c] * w + c] = T_WATER;
      L.top[c]++;
    }
  }
  for (const [a, b] of def.pools || []) {
    for (let c = a; c <= b; c++) {
      L.tiles[L.top[c] * w + c] = T_TOXIC;
      L.top[c]++;
    }
  }
  L.pools = (def.pools || []).map(([a, b]) => ({ a, b, clean: false }));
  L.props = def.props || [];
  for (const [c, r, len] of def.logs) for (let i = 0; i < len; i++) L.tiles[r * w + c + i] = T_LOG;

  L.fires = def.fires.map(c => ({ col: c, x: c * TS, y: (L.top[c] - 1) * TS, hp: FIRE_HP, alive: true, seed: c * 7 }));
  L.survivors = def.survivors.map(c => ({ col: c, x: c * TS + 8, base: L.top[c] * TS, water: 0, bloomed: false, shake: 0 }));
  L.cages = def.cages.map(d => {
    const row = d.row ?? L.top[d.col];
    return { col: d.col, animal: d.animal, x: d.col * TS - 3, y: row * TS - 24, open: false };
  });
  L.pickups = def.pickups.map(d => makePickup(d.col * TS + 8, (d.row ?? L.top[d.col] - 1) * TS + 8, d.respawn));
  L.embers = def.embers.map(d => ({
    x: d.col * TS + 3, y: L.top[d.col] * TS - 10, w: 10, h: 10, vx: 0, vy: 0, dir: -1,
    a: d.range[0] * TS, b: (d.range[1] + 1) * TS, hop: 1, hp: EMBER_HP, alive: true, onGround: false,
  }));
  L.canoeX = (def.goal + 2) * TS;
  L.groundCols = 0;
  for (let c = 0; c < w; c++) if (L.top[c] >= 0) L.groundCols++;
}

function makePickup(x, y, respawn = false) {
  return { x, y, baseY: y, alive: true, respawn, timer: 0, fall: false, vx: 0, vy: 0 };
}

const tileAt = (c, r) => (c < 0 || c >= L.w || r < 0 || r >= L.h) ? T_EMPTY : L.tiles[r * L.w + c];
const solidAt = (c, r) => (c < 0 || c >= L.w) ? true : tileAt(c, r) === T_SOLID;

function rectSolid(x, y, w, h) {
  const c0 = Math.floor(x / TS), c1 = Math.floor((x + w - 0.01) / TS);
  const r0 = Math.floor(y / TS), r1 = Math.floor((y + h - 0.01) / TS);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (solidAt(c, r)) return true;
  return false;
}

function rectHasTile(x, y, w, h, type) {
  const c0 = Math.floor(x / TS), c1 = Math.floor((x + w - 0.01) / TS);
  const r0 = Math.floor(y / TS), r1 = Math.floor((y + h - 0.01) / TS);
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tileAt(c, r) === type) return true;
  return false;
}

// Move um corpo retangular com colisão contra tiles sólidos e plataformas de cima
function moveBody(b, dt) {
  b.hitWall = false;
  const nx = b.x + b.vx * dt;
  if (!rectSolid(nx, b.y, b.w, b.h)) b.x = nx;
  else {
    if (b.vx > 0) b.x = Math.floor((nx + b.w) / TS) * TS - b.w - 0.01;
    else if (b.vx < 0) b.x = (Math.floor(nx / TS) + 1) * TS + 0.01;
    b.vx = 0;
    b.hitWall = true;
  }

  b.onGround = false;
  const ny = b.y + b.vy * dt;
  if (b.vy > 0) {
    if (rectSolid(b.x, ny, b.w, b.h)) {
      b.y = Math.floor((ny + b.h) / TS) * TS - b.h - 0.01;
      b.vy = 0;
      b.onGround = true;
      return;
    }
    const prevBottom = b.y + b.h, newBottom = ny + b.h;
    // troncos
    const r = Math.floor(newBottom / TS);
    if (prevBottom <= r * TS + 0.5 && newBottom >= r * TS) {
      const c0 = Math.floor(b.x / TS), c1 = Math.floor((b.x + b.w - 0.01) / TS);
      for (let c = c0; c <= c1; c++) {
        if (tileAt(c, r) === T_LOG) {
          b.y = r * TS - b.h - 0.01;
          b.vy = 0;
          b.onGround = true;
          return;
        }
      }
    }
    // copas das árvores plantadas
    for (const p of L.platforms) {
      if (b.x + b.w > p.x && b.x < p.x + p.w && prevBottom <= p.y + 0.5 && newBottom >= p.y) {
        b.y = p.y - b.h - 0.01;
        b.vy = 0;
        b.onGround = true;
        return;
      }
    }
    b.y = ny;
  } else if (b.vy < 0) {
    if (rectSolid(b.x, ny, b.w, b.h)) {
      b.y = (Math.floor(ny / TS) + 1) * TS + 0.01;
      b.vy = 0;
    } else b.y = ny;
  }
}

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ---------------------------------------------------------------- recuperação da floresta
function addGreen(col, amt, radius) {
  for (let dx = -radius; dx <= radius; dx++) {
    const c = col + dx;
    if (c < 0 || c >= L.w || L.top[c] < 0) continue;
    const f = 1 - Math.abs(dx) / (radius + 1);
    L.waves.push({ c, amt: amt * (0.45 + 0.55 * f), delay: Math.abs(dx) * 0.08 });
  }
}

function forestPct() {
  let s = 0;
  for (let c = 0; c < L.w; c++) if (L.top[c] >= 0) s += L.gt[c];
  return s / L.groundCols;
}

function updateGreen(dt) {
  for (let i = L.waves.length - 1; i >= 0; i--) {
    const wv = L.waves[i];
    wv.delay -= dt;
    if (wv.delay > 0) continue;
    L.gt[wv.c] = Math.min(1, L.gt[wv.c] + wv.amt);
    for (let k = 0; k < 2; k++) leaf(wv.c * TS + rand(0, 16), L.top[wv.c] * TS - 2);
    L.waves.splice(i, 1);
  }
  for (let c = 0; c < L.w; c++) L.g[c] += (L.gt[c] - L.g[c]) * Math.min(1, dt * 2.5);
  for (const pool of L.pools) if (!pool.clean && poolGreen(pool) >= 0.55) cleanPool(pool);
}

// A mata ciliar em volta da poça limpa a água
function poolGreen(pool) {
  let s = 0, n = 0;
  for (let c = pool.a - 2; c <= pool.b + 2; c++) if (c >= 0 && c < L.w && L.top[c] >= 0) { s += L.gt[c]; n++; }
  return n ? s / n : 0;
}

function cleanPool(pool) {
  pool.clean = true;
  stats.rivers++;
  for (let c = pool.a; c <= pool.b; c++) {
    const r = L.top[c] - 1;
    L.tiles[r * L.w + c] = T_WATER;
    burst(c * TS + 8, r * TS + 4, ['#bfe8fa', '#ffffff', '#5cc25a'], 6, 50);
  }
  Sfx.clean();
  showToast('A água ficou limpa de novo!');
  queueFact('mataciliar');
}

// ---------------------------------------------------------------- partículas
function part(o) { particles.push({ grav: 0, size: 1, type: 'px', ...o, max: o.life }); }
function leaf(x, y) {
  part({ x, y, vx: rand(-20, 20), vy: rand(-60, -25), life: rand(0.6, 1.2), grav: 80, color: ['#5cc25a', '#86d96a', '#2f8a3e', '#f2c443'][Math.floor(Math.random() * 4)], size: 2, type: 'leaf' });
}
function splash(x, y) {
  for (let k = 0; k < 2; k++) part({ x, y, vx: rand(-40, 40), vy: rand(-60, -10), life: 0.3, grav: 400, color: '#9ad8f4' });
}
function steam(x, y, n = 1) {
  for (let k = 0; k < n; k++) part({ x: x + rand(-4, 4), y, vx: rand(-10, 10), vy: rand(-40, -20), life: rand(0.5, 1), color: '#e8e4e8', size: rand(2, 4), type: 'smoke' });
}
function burst(x, y, colors, n = 12, speed = 90) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    part({ x, y, vx: Math.cos(a) * rand(20, speed), vy: Math.sin(a) * rand(20, speed) - 30, life: rand(0.5, 1), grav: 200, color: colors[k % colors.length], size: 2 });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.vy += p.grav * dt;
    if (p.type === 'leaf') p.vx += Math.sin(time * 6 + i) * 60 * dt;
    if (p.type === 'smoke') p.size += dt * 5;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function newAmbient(scatter) {
  return { x: rand(0, W), y: scatter ? rand(0, H) : -4, vx: rand(-6, 6), vy: rand(8, 20), ph: rand(0, 6), kind: 'ash' };
}

const ambient = Array.from({ length: 36 }, () => newAmbient(true));

function updateAmbient(dt, green) {
  for (const a of ambient) {
    if (a.kind === 'ash') {
      a.x += (a.vx + Math.sin(time + a.ph) * 6) * dt;
      a.y += a.vy * dt;
    } else {
      a.x += Math.sin(time * 0.8 + a.ph) * 10 * dt;
      a.y += Math.cos(time * 0.6 + a.ph) * 8 * dt;
    }
    if (a.y > H + 4 || a.x < -8 || a.x > W + 8 || (a.kind === 'pollen' && (a.y < -4))) {
      Object.assign(a, newAmbient(false));
      if (Math.random() < green) {
        a.kind = 'pollen';
        a.y = rand(40, H - 40);
        a.x = rand(0, W);
      }
    }
  }
}

// ---------------------------------------------------------------- jogador
function spawnPlayer() {
  const prev = P;
  P = {
    x: checkpoint.x, y: checkpoint.y, w: 10, h: 18, vx: 0, vy: 0, face: 1,
    onGround: false, coyote: 0, jumpBuf: 0, jumpCut: true,
    hearts: 3, inv: 1, stun: 0, dead: 0, fadeIn: 0.4,
    water: prev ? Math.max(prev.water, 40) : 100,
    seeds: prev ? Math.max(prev.seeds, 2) : 3,
    spraying: false, sprayT: 0, sfxT: 0, throwCD: 0, anim: 0, inWater: false, emptyMsg: 0,
  };
  trail = [];
  for (const f of L.followers) { f.x = P.x; f.y = P.y; }
}

function hurt(fromX) {
  if (P.inv > 0 || P.dead > 0) return;
  P.hearts--;
  P.inv = 1.4;
  P.stun = 0.25;
  P.vx = Math.sign(P.x + 5 - fromX || 1) * 150;
  P.vy = -230;
  P.jumpCut = true;
  Sfx.hurt();
  if (P.hearts <= 0) kill();
}

function kill() {
  if (P.dead > 0) return;
  P.dead = 1;
  stats.deaths++;
  Sfx.die();
}

function updatePlayer(dt) {
  if (P.dead > 0) {
    P.dead -= dt;
    P.vy += 1400 * dt;
    if (P.y < H + 40) P.y += P.vy * dt;
    if (P.dead <= 0) spawnPlayer();
    return;
  }
  P.inv = Math.max(0, P.inv - dt);
  P.stun = Math.max(0, P.stun - dt);
  P.fadeIn = Math.max(0, P.fadeIn - dt);
  P.throwCD = Math.max(0, P.throwCD - dt);

  const ctl = P.stun <= 0;
  const left = ctl && held('ArrowLeft', 'KeyA');
  const right = ctl && held('ArrowRight', 'KeyD');
  const up = held('ArrowUp', 'KeyW');
  const jumpHeld = held('Space', 'KeyZ', 'KeyJ');
  const jumpPress = ctl && hit('Space', 'KeyZ', 'KeyJ');
  const sprayHeld = held('KeyX', 'KeyK');
  const seedPress = ctl && hit('KeyC', 'KeyL');

  P.inWater = rectHasTile(P.x, P.y, P.w, P.h, T_WATER);
  if (rectHasTile(P.x, P.y + 4, P.w, P.h - 4, T_TOXIC)) {
    hurt(P.x + 5 - P.face * 4);
    if (P.onGround || P.vy > 0) P.vy = -330;
  }
  let maxV = P.inWater ? 70 : 118;
  if (P.spraying && P.onGround) maxV *= 0.6;
  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  if (dir) {
    P.vx += dir * (P.onGround ? 1000 : 700) * dt;
    if (Math.sign(P.vx) !== dir) P.vx += dir * 900 * dt;
    P.face = dir;
  } else if (P.stun <= 0) {
    const f = (P.onGround ? 1100 : 300) * dt;
    P.vx = Math.abs(P.vx) <= f ? 0 : P.vx - Math.sign(P.vx) * f;
  }
  if (P.stun <= 0) P.vx = clamp(P.vx, -maxV, maxV);

  P.jumpBuf = jumpPress ? 0.12 : P.jumpBuf - dt;
  P.coyote = P.onGround ? 0.1 : P.coyote - dt;
  if (P.jumpBuf > 0 && P.coyote > 0) {
    P.vy = P.inWater ? -380 : -430;
    P.jumpBuf = 0;
    P.coyote = 0;
    P.jumpCut = false;
    Sfx.jump();
    for (let k = 0; k < 4; k++) part({ x: P.x + 5, y: P.y + P.h, vx: rand(-30, 30), vy: rand(-20, 0), life: 0.3, color: '#8a7f80' });
  }
  if (!jumpHeld && P.vy < 0 && !P.jumpCut) { P.vy *= 0.45; P.jumpCut = true; }
  P.vy = Math.min(520, P.vy + (P.vy > 0 ? 2000 : 1400) * dt);

  const wasGround = P.onGround;
  moveBody(P, dt);
  if (P.onGround && !wasGround && P.vy === 0) {
    for (let k = 0; k < 3; k++) part({ x: P.x + 5, y: P.y + P.h, vx: rand(-25, 25), vy: rand(-15, 0), life: 0.25, color: '#8a7f80' });
  }
  P.x = clamp(P.x, 0, L.w * TS - P.w);
  if (P.y > H + 24) { kill(); return; }

  P.anim += Math.abs(P.vx) * dt * 0.09;

  // cabaça: encher no igarapé
  if (P.inWater && P.water < 100) {
    P.water = Math.min(100, P.water + 70 * dt);
    if (Math.random() < dt * 12) {
      part({ x: P.x + rand(0, 10), y: P.y + 10, vx: 0, vy: -30, life: 0.5, color: '#bfe8fa', size: 2 });
      Sfx.refill();
    }
  }

  if (rain.k > 0) P.water = Math.min(100, P.water + 8 * rain.k * dt);

  // jato d'água
  P.spraying = sprayHeld && P.water > 0;
  if (sprayHeld && P.water <= 0 && P.emptyMsg <= 0) {
    showToast('Cabaça vazia! Procure um igarapé.');
    P.emptyMsg = 3;
  }
  P.emptyMsg -= dt;
  if (P.spraying) {
    P.sprayT -= dt;
    while (P.sprayT <= 0) {
      P.sprayT += 0.028;
      const nx = P.face > 0 ? P.x + P.w + 2 : P.x - 2;
      drops.push({
        x: nx, y: P.y + 9,
        vx: (up ? P.face * rand(100, 140) : P.face * rand(220, 270)) + P.vx * 0.5,
        vy: up ? rand(-340, -290) : rand(-60, -20),
        life: 0.9,
      });
      P.water = Math.max(0, P.water - 0.85);
    }
    P.sfxT -= dt;
    if (P.sfxT <= 0) { Sfx.spray(); P.sfxT = 0.09; }
  }

  // sementes
  if (seedPress) {
    if (P.seeds > 0 && P.throwCD <= 0) {
      P.seeds--;
      P.throwCD = 0.3;
      seeds.push({ x: P.x + 5, y: P.y + 4, vx: P.face * 150 + P.vx * 0.4, vy: -240 });
      Sfx.throwSeed();
    } else if (P.seeds <= 0) showToast('Sem sementes! Procure castanhas.');
  }

  trail.push({ x: P.x, y: P.y, face: P.face });
  if (trail.length > 60) trail.shift();
}

// ---------------------------------------------------------------- água, sementes e mundo
function updateDrops(dt) {
  outer:
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.vy += 650 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.life -= dt;
    const c = Math.floor(d.x / TS), r = Math.floor(d.y / TS);
    if (d.life <= 0 || d.y > H) { drops.splice(i, 1); continue; }
    if (solidAt(c, r)) { splash(d.x, d.y); drops.splice(i, 1); continue; }
    if (tileAt(c, r) === T_WATER || tileAt(c, r) === T_TOXIC) { drops.splice(i, 1); continue; }
    for (const f of L.fires) {
      if (f.alive && d.x > f.x + 1 && d.x < f.x + 15 && d.y > f.y + 2 && d.y < f.y + 17) {
        f.hp--;
        if (Math.random() < 0.4) steam(d.x, d.y);
        if (f.hp <= 0) extinguish(f);
        drops.splice(i, 1);
        continue outer;
      }
    }
    for (const e of L.embers) {
      if (e.alive && d.x > e.x - 1 && d.x < e.x + e.w + 1 && d.y > e.y - 1 && d.y < e.y + e.h + 1) {
        e.hp--;
        steam(d.x, d.y);
        if (e.hp <= 0) killEmber(e);
        drops.splice(i, 1);
        continue outer;
      }
    }
    for (const s of L.survivors) {
      if (!s.bloomed && d.x > s.x - 20 && d.x < s.x + 20 && d.y > s.base - 66 && d.y < s.base) {
        s.water++;
        s.shake = 0.12;
        queueFact('sobrevivente');
        if (Math.random() < 0.3) part({ x: d.x, y: d.y, vx: rand(-10, 10), vy: -20, life: 0.5, color: '#86d96a', size: 1 });
        if (s.water >= SURVIVOR_NEED) bloom(s);
        drops.splice(i, 1);
        continue outer;
      }
    }
    for (const s of L.saplings) {
      if (s.stage < 2 && Math.abs(d.x - s.x) < 8 && d.y > s.base - 20 && d.y < s.base) {
        s.t += 0.05;
        drops.splice(i, 1);
        continue outer;
      }
    }
  }
}

function extinguish(f) {
  f.alive = false;
  stats.fires++;
  steam(f.x + 8, f.y + 10, 8);
  Sfx.extinguish();
  addGreen(f.col, 0.35, 2);
}

function killEmber(e) {
  e.alive = false;
  steam(e.x + 5, e.y + 5, 6);
  Sfx.extinguish();
  addGreen(Math.floor((e.x + 5) / TS), 0.2, 2);
}

function bloom(s) {
  s.bloomed = true;
  stats.survivors++;
  addGreen(s.col, 0.85, 7);
  checkpoint = { x: s.x - 5, y: s.base - 18.01 };
  for (let k = 0; k < 30; k++) leaf(s.x + rand(-22, 22), s.base - rand(20, 64));
  for (const dx of [-14, 0, 14]) {
    const p = makePickup(s.x + dx, s.base - 50);
    p.fall = true;
    p.vx = dx * 3;
    p.vy = -120;
    L.pickups.push(p);
  }
  Sfx.bloom();
  showToast('A árvore voltou a viver! Checkpoint salvo.');
}

function updateSeeds(dt) {
  for (let i = seeds.length - 1; i >= 0; i--) {
    const s = seeds[i];
    const px0 = s.x, py0 = s.y;
    s.vy += 900 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.y > H + 10) { seeds.splice(i, 1); continue; }
    const c = Math.floor(s.x / TS), r = Math.floor(s.y / TS);
    if (!solidAt(c, r)) continue;
    if (s.vy > 0 && py0 < r * TS + 2 && !solidAt(c, r - 1)) {
      plant(c, r, s.auto);
      seeds.splice(i, 1);
    } else {
      s.x = px0;
      s.y = py0;
      s.vx *= -0.3;
    }
  }
}

// auto = semente plantada por um animal (sem avisos nem devolução)
function plant(col, row, auto = false) {
  const x = col * TS + 8, y = row * TS;
  const above = tileAt(col, row - 1);
  if (above === T_WATER || above === T_TOXIC) {
    for (let k = 0; k < 4; k++) part({ x, y: y - 14, vx: rand(-10, 10), vy: -20, life: 0.4, color: above === T_WATER ? '#bfe8fa' : '#a89c78' });
    if (!auto) showToast(above === T_WATER ? 'A semente afundou no igarapé.' : 'Nada nasce na água envenenada. Plante na beira!');
    return;
  }
  if (L.fires.some(f => f.alive && f.col === col)) {
    burst(x, y - 6, ['#f39a1e', '#d8352a', '#3a2a20'], 8, 50);
    Sfx.fizzle();
    if (!auto) showToast('A semente queimou! Apague o fogo antes.');
    return;
  }
  const busy = L.saplings.some(s => Math.abs(s.col - col) < 2)
    || L.survivors.some(s => Math.abs(s.col - col) < 2)
    || L.cages.some(cg => cg.col === col)
    || col * TS > L.goalX - 32;
  if (busy) {
    if (auto) return;
    P.seeds = Math.min(SEED_MAX, P.seeds + 1);
    showToast('Sem espaço aqui. Tente mais longe.');
    return;
  }
  L.saplings.push({ col, x, base: y, stage: 0, t: 0 });
  for (let k = 0; k < 5; k++) part({ x, y: y - 2, vx: rand(-25, 25), vy: rand(-40, -10), life: 0.4, grav: 200, color: '#6b4426' });
  Sfx.plant();
}

function updateSaplings(dt) {
  // a preguiça aduba e a chuva rega: mudas crescem mais rápido
  const speed = (hasFollower('preguica') ? 1.7 : 1) * (1 + rain.k);
  for (const s of L.saplings) {
    if (s.stage === 2) continue;
    s.t += dt * speed;
    if (s.stage === 0 && s.t > 0.9) {
      s.stage = 1;
      s.t = 0;
      for (let k = 0; k < 4; k++) leaf(s.x, s.base - 10);
    } else if (s.stage === 1 && s.t > 1.1) {
      s.stage = 2;
      L.platforms.push({ x: s.x - 12, y: s.base - 48, w: 24 });
      addGreen(s.col, 0.55, hasFollower('preguica') ? 4 : 3);
      stats.trees++;
      queueFact('muda');
      for (let k = 0; k < 10; k++) leaf(s.x + rand(-10, 10), s.base - rand(20, 48));
      Sfx.grow();
    }
  }
}

function updateFires(dt) {
  const hb = { x: P.x, y: P.y, w: P.w, h: P.h };
  for (const f of L.fires) {
    if (!f.alive) continue;
    if (rain.k > 0 && onScreen(f.x, 0)) {
      f.hp -= 2.5 * rain.k * dt;
      if (Math.random() < dt * 3) steam(f.x + 8, f.y + 6);
      if (f.hp <= 0) { extinguish(f); continue; }
    }
    if (Math.random() < dt * 2.2) {
      part({ x: f.x + rand(4, 12), y: f.y + 2, vx: rand(-6, 6), vy: rand(-22, -14), life: rand(1.6, 2.6), color: '#3a3236', size: rand(2, 4), type: 'smoke' });
    }
    if (Math.random() < dt * 3) part({ x: f.x + rand(3, 13), y: f.y + 4, vx: rand(-10, 10), vy: rand(-50, -30), life: 0.6, color: '#ffb04a' });
    const k = 0.4 + 0.6 * f.hp / FIRE_HP;
    const top = f.y + 16 - 11 * k;
    if (overlap(hb, { x: f.x + 3, y: top, w: 10, h: f.y + 16 - top })) hurt(f.x + 8);
  }
}

function updateEmbers(dt) {
  for (const e of L.embers) {
    if (!e.alive) continue;
    e.vy = Math.min(500, e.vy + 1200 * dt);
    if (e.onGround) {
      e.hop -= dt;
      if (e.hop <= 0) { e.vy = -230; e.hop = rand(0.8, 1.6); }
    }
    if (rain.k > 0 && onScreen(e.x, 0)) {
      e.hp -= 1.2 * rain.k * dt;
      if (e.hp <= 0) { killEmber(e); continue; }
    }
    // com medo da onça, as brasas fogem
    const scared = hasFollower('onca') && P.dead <= 0 && Math.abs(e.x - P.x) < 96;
    if (scared) e.dir = Math.sign(e.x - P.x) || 1;
    e.vx = e.dir * (scared ? 70 : 34);
    moveBody(e, dt);
    if (e.hitWall || (e.dir < 0 && e.x < e.a) || (e.dir > 0 && e.x + e.w > e.b)) e.dir *= -1;
    if (e.onGround && !scared) {
      const ahead = Math.floor((e.dir > 0 ? e.x + e.w + 2 : e.x - 2) / TS);
      if (!solidAt(ahead, Math.floor((e.y + e.h + 2) / TS))) e.dir *= -1;
    }
    if (rectHasTile(e.x, e.y, e.w, e.h, T_WATER)) { killEmber(e); continue; }
    if (Math.random() < dt * 4) part({ x: e.x + 5, y: e.y, vx: rand(-10, 10), vy: -40, life: 0.5, color: '#ffb04a' });
    if (P.dead <= 0 && overlap(P, e)) hurt(e.x + 5);
  }
}

function updateSurvivors(dt) {
  for (const s of L.survivors) s.shake = Math.max(0, s.shake - dt);
}

function updateCages() {
  for (const cg of L.cages) {
    if (cg.open || P.dead > 0) continue;
    if (overlap(P, { x: cg.x + 2, y: cg.y, w: 18, h: 24 })) {
      cg.open = true;
      stats.animals++;
      L.followers.push({ type: cg.animal, x: cg.x + 4, y: cg.y + 8, face: 1, vx: 0, cd: 3 });
      addGreen(cg.col, 0.25, 4);
      burst(cg.x + 11, cg.y + 12, ANIMAL_COLORS[cg.animal], 16);
      Sfx.rescue();
      showToast(`Você libertou ${ANIMAL_NAMES[cg.animal]}!`);
      queueFact(cg.animal);
    }
  }
}

function updatePickups(dt) {
  for (const p of L.pickups) {
    if (!p.alive) {
      if (p.respawn && (p.timer -= dt) <= 0) { p.alive = true; burst(p.x, p.y, ['#f2c443'], 6, 40); }
      continue;
    }
    if (p.fall) {
      p.vy += 500 * dt;
      p.x += p.vx * dt;
      p.vx *= 0.98;
      p.y += p.vy * dt;
      if (p.vy > 0 && solidAt(Math.floor(p.x / TS), Math.floor((p.y + 5) / TS))) {
        p.y = Math.floor((p.y + 5) / TS) * TS - 9;
        p.baseY = p.y;
        p.fall = false;
      }
      if (p.y > H) p.alive = false;
    }
    if (P.dead <= 0 && Math.abs(P.x + 5 - p.x) < 11 && Math.abs(P.y + 9 - p.y) < 14) {
      p.alive = false;
      p.timer = 6;
      P.seeds = Math.min(SEED_MAX, P.seeds + 3);
      burst(p.x, p.y, ['#f2c443', '#fff3a0'], 6, 40);
      Sfx.pickup();
      showToast('+3 sementes de castanha');
      queueFact('semente');
    }
  }
}

const hasFollower = type => L.followers.some(f => f.type === type);

function updateFollowers(dt) {
  let nFly = 0, nWalk = 0;
  for (const f of L.followers) {
    if (FLYERS.includes(f.type)) {
      const k = nFly++;
      const tx = P.x + 5 - P.face * (20 + k * 18) - 7, ty = P.y - 18 - k * 8 + Math.sin(time * 3 + k) * 4;
      f.vx = (tx - f.x) * 4;
      f.x += f.vx * dt;
      f.y += (ty - f.y) * 4 * dt;
      f.face = Math.abs(f.vx) > 8 ? Math.sign(f.vx) : P.face;
    } else if (f.type !== 'preguica') {
      const h = trail[Math.max(0, trail.length - 1 - 16 - nWalk++ * 14)];
      if (!h) continue;
      const tx = h.x - h.face * 12, ty = h.y + 19 - SPR.animals[f.type][0][0].height;
      const dx = tx - f.x;
      f.x += dx * Math.min(1, 10 * dt);
      f.y += (ty - f.y) * Math.min(1, 10 * dt);
      f.moving = Math.abs(dx) > 0.5;
      f.face = Math.abs(dx) > 0.5 ? Math.sign(dx) : h.face;
    }
    if (state === 'play') updatePower(f, dt);
  }
}

// Poderes: araras e tucanos plantam; macacos e antas acham sementes
function updatePower(f, dt) {
  if (P.dead > 0 || (f.cd -= dt) > 0) return;
  if (FLYERS.includes(f.type)) {
    f.cd = 7;
    seeds.push({ x: f.x + 7, y: f.y + 8, vx: P.face * 70, vy: -80, auto: true });
    Sfx.throwSeed();
  } else if (f.type === 'macaco' || f.type === 'anta') {
    f.cd = 9;
    if (P.seeds >= SEED_MAX) return;
    P.seeds++;
    burst(f.x + 6, f.y, ['#f2c443', '#fff3a0'], 5, 30);
    Sfx.pickup();
  } else f.cd = Infinity;
}

// ---------------------------------------------------------------- chuva (rios voadores)
function updateRain(dt) {
  rain.bow = Math.max(0, rain.bow - dt);
  if (rain.t > 0) {
    rain.t -= dt;
    rain.k = clamp(Math.min(rain.t, rain.dur - rain.t) / 1.5, 0, 1);
    if (rain.t <= 0) { rain.k = 0; rain.bow = 12; }
    return;
  }
  rain.cd -= dt;
  if (state === 'play' && rain.cd <= 0 && localGreen() >= RAIN_GREEN) startRain();
}

function startRain() {
  rain.t = rain.dur = RAIN_TIME;
  rain.cd = RAIN_COOLDOWN;
  Sfx.rain(RAIN_TIME);
  Sfx.thunder();
  showToast('A floresta chamou a chuva!');
  queueFact('chuva');
}

function updateCamera(dt, snap) {
  const target = P.x + 5 - W / 2 + P.face * 24;
  cam.x = snap ? target : cam.x + (target - cam.x) * Math.min(1, dt * 5);
  cam.x = clamp(cam.x, 0, L.w * TS - W);
}

function showToast(text) { toast = { text, t: 2.4 }; }

// Cartões do Caderno da Floresta: um de cada vez, só na primeira vez
function queueFact(key) {
  if (params.has('nofacts') || seenFacts.has(key) || !FACTS[key]) return;
  seenFacts.add(key);
  factQueue.push(key);
}

function updateHints(dt) {
  hint.t -= dt;
  toast.t -= dt;
  for (const h of L.def.hints) {
    if (!shownHints.has(h) && P.x >= h.col * TS) {
      shownHints.add(h);
      if (h.text) hint = { text: h.text, t: 6 };
      if (h.fact) queueFact(h.fact);
    }
  }
}

// ---------------------------------------------------------------- loop
function startGame() {
  L = null;
  P = null;
  startLevel(0);
}

function startLevel(i) {
  levelIdx = i;
  loadLevel(LEVELS[i]);
  stats = { fires: 0, trees: 0, animals: 0, survivors: 0, deaths: 0, rivers: 0 };
  drops = []; seeds = []; particles = [];
  shownHints = new Set();
  hint = { text: '', t: 0 };
  toast = { text: '', t: 0 };
  rain = { t: 0, dur: RAIN_TIME, k: 0, cd: 8, bow: 0 };
  party = null;
  card = null;
  factQueue = [];
  checkpoint = { x: L.def.start[0] * TS + 3, y: L.def.start[1] * TS - 18.01 };
  if (P) P.hearts = 3;
  spawnPlayer();
  updateCamera(0, true);
  state = 'play';
  paused = false;
}

function finishLevel() {
  winT = 0;
  stats.pct = forestPct();
  if (L.def.goalType === 'xapono') {
    state = 'party';
    startParty();
  } else {
    state = 'win';
    Sfx.win();
  }
}

function startStory(slides, done) {
  story = { slides, i: 0, t: 0, done };
  state = 'story';
}

function updateStory(dt) {
  story.t += dt;
  const sl = story.slides[story.i];
  const full = sl.lines.join(' ').length / 40 + 0.2;
  if (hit('Escape')) { story.done(); return; }
  if (hit('Enter', 'Space', 'NumpadEnter', 'KeyX', 'ArrowRight')) {
    if (story.t < full) story.t = full;
    else if (++story.i >= story.slides.length) story.done();
    else story.t = 0;
  }
}

// ---------------------------------------------------------------- festa no xapono
function startParty() {
  const px0 = L.goalX + 8;
  party = { x: px0, beat: 0, beatT: 0, people: [] };
  for (let k = 0; k < 9; k++) {
    const fromLeft = k % 2 === 0;
    party.people.push({
      v: k % SPR.people.length,
      x: px0 + (fromLeft ? 60 : 180) + rand(-10, 10),
      tx: px0 + 70 + k * 12 + rand(-4, 4),
      y: 0, vy: 0, ph: rand(0, 6), delay: 0.4 + k * 0.25, face: fromLeft ? 1 : -1,
    });
  }
  P.vx = 0;
  Sfx.win();
}

function updateParty(dt) {
  const base = L.top[L.def.goal] * TS;
  // Urihi caminha até o centro do pátio
  const tx = party.x + 112;
  if (Math.abs(P.x - tx) > 2) {
    P.vx = Math.sign(tx - P.x) * 60;
    P.x += P.vx * dt;
    P.anim += Math.abs(P.vx) * dt * 0.09;
  } else P.vx = 0;
  P.y = base - 18.01;
  P.onGround = true;
  if (P.vx) P.face = Math.sign(P.vx);
  trail.push({ x: P.x, y: P.y, face: P.face });
  if (trail.length > 60) trail.shift();
  for (const p of party.people) {
    if ((p.delay -= dt) > 0) continue;
    const dx = p.tx - p.x;
    if (Math.abs(dx) > 1) { p.x += Math.sign(dx) * 50 * dt; p.face = Math.sign(dx); }
    else {
      p.face = Math.sign(P.x - p.x) || 1;
      p.vy += 900 * dt;
      p.y += p.vy * dt;
      if (p.y >= 0) { p.y = 0; p.vy = Math.random() < 0.5 ? -150 : -90; }
    }
  }
  // batida da festa
  if (winT > 1 && (party.beatT -= dt) <= 0) {
    party.beatT = 0.22;
    Sfx.beat(party.beat++);
  }
  if (Math.random() < dt * 3) {
    burst(party.x + rand(70, 170), base - rand(60, 100), ['#e0302a', '#2f6fd6', '#f2c443', '#5cc25a'], 10, 80);
  }
  cam.x += (clamp(party.x + 120 - W / 2, 0, L.w * TS - W) - cam.x) * Math.min(1, dt * 3);
}

const STORY_GREEN = { fire: 0, sad: 0, hero: 0.2 };

function update(dt) {
  time += dt;
  if (hit('KeyM')) showToast(Sfx.toggleMute() ? 'Música desligada (M)' : 'Música ligada (M)');
  let mg = 0.35;
  if (state === 'story') mg = STORY_GREEN[story.slides[story.i].scene] ?? 0.8;
  else if (state === 'play' || state === 'win') mg = localGreen();
  Sfx.music(state !== 'party', mg);
  const green = L ? localGreen() : 0;
  updateAmbient(dt, green);
  if (state === 'title') {
    cam.x = (0.5 - Math.cos(time * 0.08) * 0.5) * 900;
    if (hit('Enter', 'Space', 'NumpadEnter')) { Sfx.unlock(); startStory(INTRO, startGame); }
    return;
  }
  if (state === 'story') {
    updateParticles(dt);
    updateStory(dt);
    return;
  }
  if (state === 'win') {
    winT += dt;
    updateGreen(dt);
    updateParticles(dt);
    updateFollowers(dt);
    updateRain(dt);
    if (L.def.goalType === 'canoe' && winT > 0.6) L.canoeX += 45 * dt * Math.min(1, winT - 0.6);
    if (Math.random() < dt * 6) leaf(cam.x + rand(0, W), rand(20, 120));
    if (winT > 1.2 && hit('Enter', 'Space', 'NumpadEnter')) startLevel(levelIdx + 1);
    return;
  }
  if (state === 'party') {
    winT += dt;
    updateParty(dt);
    updateGreen(dt);
    updateParticles(dt);
    updateFollowers(dt);
    if (winT > 8 && hit('Enter', 'Space', 'NumpadEnter')) startStory(OUTRO, () => { state = 'title'; });
    return;
  }
  if (card) {
    card.t += dt;
    if (card.t > 0.6 && hit('Enter', 'Space', 'NumpadEnter', 'KeyX', 'KeyK')) card = null;
    return;
  }
  if (factQueue.length && P.dead <= 0) {
    card = { key: factQueue.shift(), t: 0 };
    Sfx.card();
    return;
  }
  if (hit('KeyP', 'Escape')) paused = !paused;
  if (paused) return;

  updatePlayer(dt);
  updateDrops(dt);
  updateSeeds(dt);
  updateSaplings(dt);
  updateFires(dt);
  updateEmbers(dt);
  updateSurvivors(dt);
  updateCages();
  updatePickups(dt);
  updateFollowers(dt);
  updateGreen(dt);
  updateParticles(dt);
  updateCamera(dt);
  updateHints(dt);
  updateRain(dt);

  if (P.dead <= 0 && P.x >= L.goalX) finishLevel();
}

// ---------------------------------------------------------------- desenho
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}

function localGreen() {
  const c0 = Math.max(0, Math.floor(cam.x / TS)), c1 = Math.min(L.w - 1, c0 + W / TS);
  let s = 0, n = 0;
  for (let c = c0; c <= c1; c++) if (L.top[c] >= 0) { s += L.g[c]; n++; }
  return n ? s / n : 0;
}

function drawSky(t) {
  const grd = g.createLinearGradient(0, 0, 0, H * 0.8);
  grd.addColorStop(0, mix('#3e2a38', '#3a8ad8', t));
  grd.addColorStop(0.55, mix('#8e4a3e', '#7cc0ec', t));
  grd.addColorStop(1, mix('#e08a4a', '#d8f0f4', t));
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  // sol
  const sx = 300 - cam.x * 0.02, sy = 46;
  g.globalAlpha = 0.25;
  g.fillStyle = mix('#e85a2a', '#fff8d0', t);
  g.beginPath(); g.arc(sx, sy, 22, 0, Math.PI * 2); g.fill();
  g.globalAlpha = 1;
  g.fillStyle = mix('#e8702a', '#fff2a8', t);
  g.beginPath(); g.arc(sx, sy, 13, 0, Math.PI * 2); g.fill();
  // nuvens quando a floresta volta
  if (t > 0.05) {
    g.globalAlpha = t * 0.9;
    g.fillStyle = '#ffffff';
    for (let k = 0; k < 4; k++) {
      const cx = ((k * 211 - cam.x * 0.05) % 520 + 520) % 520 - 60, cy = 24 + k * 13;
      g.fillRect(Math.round(cx), cy, 40, 6);
      g.fillRect(Math.round(cx) + 8, cy - 4, 22, 4);
    }
    g.globalAlpha = 1;
  }
}

function drawLayer(pair, factor, t, yOff) {
  const PW = pair[0].width;
  const ox = -Math.round(((cam.x * factor) % PW + PW) % PW);
  for (let i = 0; i < 2; i++) {
    g.globalAlpha = 1 - t;
    g.drawImage(pair[0], ox + i * PW, yOff);
    g.globalAlpha = 1;
    if (t > 0) {
      g.globalAlpha = t;
      g.drawImage(pair[1], ox + i * PW, yOff);
      g.globalAlpha = 1;
    }
  }
}

function drawHaze(t) {
  if (t >= 1) return;
  const grd = g.createLinearGradient(0, H * 0.35, 0, H);
  grd.addColorStop(0, 'rgba(60,40,40,0)');
  grd.addColorStop(1, `rgba(90,60,55,${0.35 * (1 - t)})`);
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
}

function drawTiles() {
  const c0 = Math.max(0, Math.floor(cam.x / TS)), c1 = Math.min(L.w - 1, c0 + W / TS + 1);
  const wf = SPR.water[Math.floor(time * 5) % 4];
  for (let c = c0; c <= c1; c++) {
    const lvl = Math.round(L.g[c] * 4);
    for (let r = 0; r < L.h; r++) {
      const t = L.tiles[r * L.w + c];
      if (t === T_EMPTY) continue;
      const x = c * TS, y = r * TS;
      if (t === T_WATER) { g.drawImage(wf, x, y); continue; }
      if (t === T_TOXIC) { g.drawImage(SPR.toxic[Math.floor(time * 4) % 4], x, y); continue; }
      const v = hash(c * 31 + r) & 1;
      let kind = 'log';
      if (t === T_SOLID) kind = tileAt(c, r - 1) === T_SOLID ? 'dirt' : 'top';
      g.drawImage(SPR.tiles.b[kind][v], x, y);
      // a superfície muda em pontilhado; a terra por baixo vira de uma vez
      if (kind !== 'dirt' && lvl > 0) g.drawImage(SPR.tiles.gd[kind][v][lvl], x, y);
      else if (kind === 'dirt' && lvl >= 2) g.drawImage(SPR.tiles.g.dirt[v], x, y);
    }
  }
}

function drawDeco() {
  const c0 = Math.max(0, Math.floor(cam.x / TS)), c1 = Math.min(L.w - 1, c0 + W / TS + 1);
  const kinds = ['tuft', 'fern', 'flowerRed', 'flowerYellow', 'tuft', 'flowerPink'];
  for (let c = c0; c <= c1; c++) {
    const r = L.top[c];
    if (r < 0 || tileAt(c, r - 1) === T_WATER || tileAt(c, r - 1) === T_TOXIC) continue;
    if (L.fires.some(f => f.alive && f.col === c)) continue;
    const hv = hash(c * 7 + 3), gl = L.g[c];
    if (gl > 0.6 + (hv % 10) * 0.035) g.drawImage(SPR.deco[kinds[hv % kinds.length]], c * TS, (r - 1) * TS);
    else if (gl < 0.3 && hv % 5 === 0) g.drawImage(SPR.deco.stump, c * TS, (r - 1) * TS);
  }
}

const onScreen = (x, w = 64) => x + w > cam.x && x - w < cam.x + W;

function drawWorld() {
  // balsas de garimpo ficam atrás do chão; enferrujam e somem sob a mata
  for (const pr of L.props) {
    const x = pr.col * TS;
    if (!onScreen(x, 100)) continue;
    const gl = L.g[pr.col + 3] || 0;
    g.globalAlpha = 1 - gl * 0.75;
    g.drawImage(SPR.dredge, x, 11 * TS - 52);
    g.globalAlpha = 1;
  }
  drawTiles();
  drawDeco();

  const ox = L.goalX + 8, base = L.top[L.def.goal] * TS;
  if (L.def.goalType === 'xapono' && onScreen(ox, 260)) g.drawImage(SPR.xapono, ox, base - 80);
  if (party) drawParty(base);

  for (const s of L.survivors) {
    if (!onScreen(s.x)) continue;
    const sh = s.shake > 0 ? Math.round(Math.sin(time * 60)) : 0;
    g.drawImage(s.bloomed ? SPR.survivor.bloomed : SPR.survivor.wilted, s.x - 28 + sh, s.base - 72);
    if (!s.bloomed && s.water > 0) {
      g.fillStyle = '#140d14';
      g.fillRect(s.x - 13, s.base - 80, 26, 4);
      g.fillStyle = '#5cc25a';
      g.fillRect(s.x - 12, s.base - 79, Math.round(24 * s.water / SURVIVOR_NEED), 2);
    }
  }

  for (const s of L.saplings) {
    if (!onScreen(s.x)) continue;
    const img = SPR.sapling[s.stage];
    g.drawImage(img, Math.round(s.x - img.width / 2), s.base - img.height);
  }

  for (const cg of L.cages) {
    if (!onScreen(cg.x)) continue;
    const wob = !cg.open && Math.sin(time * 9 + cg.col) > 0.85 ? 1 : 0;
    g.drawImage(cg.open ? SPR.cages.broken : SPR.cages[cg.animal], cg.x + wob, cg.y);
  }

  for (const f of L.fires) {
    if (!f.alive || !onScreen(f.x)) continue;
    const k = 0.4 + 0.6 * f.hp / FIRE_HP;
    const img = SPR.fire[(Math.floor(time * 10) + f.seed) % 4];
    const hh = Math.round(16 * k);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.18 + Math.sin(time * 13 + f.seed) * 0.04;
    g.fillStyle = '#f39a1e';
    g.beginPath(); g.arc(f.x + 8, f.y + 11, 18 * k, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.drawImage(img, 0, 0, 16, 16, f.x, f.y + 16 - hh, 16, hh);
  }

  for (const p of L.pickups) {
    if (!p.alive || !onScreen(p.x)) continue;
    const bob = p.fall ? 0 : Math.round(Math.sin(time * 4 + p.x) * 2);
    g.drawImage(SPR.nut, Math.round(p.x - 5), Math.round(p.y - 4 + bob));
    if (Math.sin(time * 5 + p.x) > 0.9) {
      g.fillStyle = '#fff3a0';
      g.fillRect(Math.round(p.x + 3), Math.round(p.y - 5 + bob), 1, 1);
    }
  }

  for (const e of L.embers) {
    if (!e.alive || !onScreen(e.x)) continue;
    const img = SPR.ember[Math.floor(time * 8) % 2][e.dir > 0 ? 0 : 1];
    g.drawImage(img, Math.round(e.x - 2), Math.round(e.y - 4));
  }

  drawFollowers(false);
  if (L.def.goalType === 'canoe' && onScreen(L.canoeX, 80)) drawCanoe();
  else drawPlayer();
  drawFollowers(true);

  g.fillStyle = '#9ad8f4';
  for (const d of drops) g.fillRect(Math.round(d.x), Math.round(d.y), 2, 2);
  g.fillStyle = '#3d95d6';
  for (const d of drops) g.fillRect(Math.round(d.x), Math.round(d.y) + 1, 1, 1);

  for (const s of seeds) {
    g.fillStyle = '#4e331e';
    g.fillRect(Math.round(s.x) - 2, Math.round(s.y) - 2, 4, 4);
    g.fillStyle = '#a0744a';
    g.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 2, 2);
  }

  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.type === 'smoke') {
      g.globalAlpha = a * 0.45;
      g.fillStyle = p.color;
      const s = Math.round(p.size);
      g.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
      g.globalAlpha = 1;
    } else {
      g.globalAlpha = Math.min(1, a * 2);
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      g.globalAlpha = 1;
    }
  }
}

function drawCanoe() {
  const bob = Math.round(Math.sin(time * 3) * 1.5);
  const x = Math.round(L.canoeX), y = (L.top[L.def.goal + 2] - 1) * TS + 6 + bob;
  if (state === 'win' && winT > 0.3) {
    // Urihi sentado na canoa, remando
    const im = SPR.hero.idle[0];
    g.drawImage(im, 0, 0, im.width, 15, x + 18, y - 13, im.width, 15);
    P.x = x + 20;
  } else drawPlayer();
  g.drawImage(SPR.canoe, x, y);
}

function drawParty(base) {
  for (const p of party.people) {
    if (p.delay > 0) continue;
    const dancing = Math.abs(p.tx - p.x) <= 1;
    const up = dancing && Math.floor(time * 4 + p.ph) % 2 === 0;
    const im = SPR.people[p.v][up ? 1 : 0][p.face > 0 ? 0 : 1];
    g.drawImage(im, Math.round(p.x), Math.round(base - im.height + 2 + p.y));
  }
}

function drawPlayer() {
  if (!P || (P.dead > 0 && P.y > H)) return;
  if (P.inv > 0 && P.dead <= 0 && Math.floor(time * 20) % 2 === 0) return;
  let name;
  if (P.dead > 0) name = 'fall';
  else if (!P.onGround) name = P.vy < 0 ? 'jump' : 'fall';
  else if (Math.abs(P.vx) > 8) name = ['run1', 'run2', 'run3', 'run2'][Math.floor(P.anim) % 4];
  else name = 'idle';
  if (P.spraying) name += '_spray';
  if (state === 'party' && P.vx === 0) name = Math.floor(time * 4) % 2 ? 'jump' : 'idle';
  const fi = P.face > 0 ? 0 : 1;
  const bob = name.startsWith('run2') ? -1 : 0;
  const dx = P.face > 0 ? -3.5 : -2.5;
  g.drawImage(SPR.hero[name][fi], Math.round(P.x + dx), Math.round(P.y - 2 + bob));
}

function drawFollowers(front) {
  if (!L) return;
  for (const f of L.followers) {
    const fi = f.face > 0 ? 0 : 1;
    const frames = SPR.animals[f.type];
    if (f.type === 'preguica') {
      if (front || (P.dead > 0 && P.y > H) || state === 'win') continue;
      g.drawImage(frames[0][P.face > 0 ? 1 : 0], Math.round(P.face > 0 ? P.x - 9 : P.x + 5), Math.round(P.y + 3));
    } else if (FLYERS.includes(f.type)) {
      if (front) g.drawImage(frames[Math.floor(time * 8) % 2][fi], Math.round(f.x), Math.round(f.y));
    } else if (!front) {
      const fr = f.moving ? Math.floor(time * 8) % frames.length : 0;
      const hop = f.moving && f.type === 'macaco' ? -Math.abs(Math.round(Math.sin(time * 12) * 2)) : 0;
      g.drawImage(frames[fr][fi], Math.round(f.x), Math.round(f.y + hop));
    }
  }
}

function drawAmbient() {
  for (const a of ambient) {
    if (a.kind === 'ash') {
      g.fillStyle = 'rgba(200,190,190,0.55)';
      g.fillRect(Math.round(a.x), Math.round(a.y), 1, 1);
    } else {
      g.globalAlpha = 0.5 + Math.sin(time * 4 + a.ph) * 0.4;
      g.fillStyle = '#fff3a0';
      g.fillRect(Math.round(a.x), Math.round(a.y), 1, 1);
      g.globalAlpha = 1;
    }
  }
}

function drawRainbow(a) {
  if (a <= 0) return;
  const cols = ['#e0302a', '#f39a1e', '#f2c443', '#5cc25a', '#3d95d6', '#7a4ab0'];
  g.globalAlpha = a * 0.45;
  cols.forEach((c, i) => {
    g.strokeStyle = c;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(W * 0.62, H * 0.62, 120 - i * 3, Math.PI, 2 * Math.PI);
    g.stroke();
  });
  g.globalAlpha = 1;
}

function drawRainSky(k) {
  if (k <= 0) return;
  g.fillStyle = `rgba(40,52,72,${0.45 * k})`;
  g.fillRect(0, 0, W, H);
}

function drawRainDrops(k) {
  if (k <= 0) return;
  const n = Math.round(140 * k);
  g.fillStyle = 'rgba(200,225,255,0.65)';
  for (let i = 0; i < n; i++) {
    const sp = 300 + (i % 3) * 60;
    const y = ((i * 53) % H + time * sp) % (H + 20) - 10;
    const x = (((i * 97) % W - y * 0.25) % W + W) % W;
    g.fillRect(Math.round(x), Math.round(y), 1, 5);
  }
}

function draw() {
  if (state === 'story') { drawStoryFrame(); return; }
  const t = localGreen();
  drawSky(t);
  drawRainbow(Math.min(1, rain.bow / 3));
  drawLayer(SPR.bg.far, 0.15, t, 0);
  drawHaze(t);
  drawLayer(SPR.bg.near, 0.4, t, 8);
  drawRainSky(rain.k * 0.6);
  g.save();
  g.translate(-Math.round(cam.x), 0);
  drawWorld();
  g.restore();
  drawRainDrops(rain.k);
  drawAmbient();
  if (state === 'play' && P.dead > 0) {
    g.fillStyle = `rgba(10,6,10,${clamp(1 - P.dead, 0, 1)})`;
    g.fillRect(0, 0, W, H);
  } else if (state === 'play' && P.fadeIn > 0) {
    g.fillStyle = `rgba(10,6,10,${P.fadeIn / 0.4})`;
    g.fillRect(0, 0, W, H);
  }

  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(view, 0, 0, cv.width, cv.height);
  if (state === 'title') drawTitle();
  else {
    drawHUD();
    if (state === 'win') drawWin();
    else if (state === 'party') { if (winT > 8) drawWin(); }
    else if (card) drawCard();
    else if (paused) drawCenterBox(['PAUSA', '', touchMode ? 'Toque para continuar' : 'P ou ESC para continuar']);
  }
  if (touchMode && touchUI()) drawTouchButtons();
  if (touchMode && innerHeight > innerWidth) drawCenterBox(['Gire o aparelho', '', 'O jogo fica melhor na horizontal']);
}

// ---------------------------------------------------------------- HUD (em resolução de tela)
const FONT = '"Press Start 2P", monospace';
const U = () => cv.width / W;

function text(str, gx, gy, size, color, align = 'left') {
  const u = U();
  sctx.font = `${Math.round(size * u)}px ${FONT}`;
  sctx.textAlign = align;
  sctx.textBaseline = 'top';
  sctx.fillStyle = 'rgba(10,6,10,0.75)';
  sctx.fillText(str, gx * u + Math.max(1, u * 0.75), gy * u + Math.max(1, u * 0.75));
  sctx.fillStyle = color;
  sctx.fillText(str, gx * u, gy * u);
}

function textWidth(str, size) {
  const u = U();
  sctx.font = `${Math.round(size * u)}px ${FONT}`;
  return sctx.measureText(str).width / u;
}

function img(im, gx, gy, s = 1) {
  const u = U();
  sctx.drawImage(im, Math.round(gx * u), Math.round(gy * u), Math.round(im.width * u * s), Math.round(im.height * u * s));
}

function box(gx, gy, gw, gh, color = 'rgba(15,10,15,0.6)') {
  const u = U();
  sctx.fillStyle = color;
  sctx.fillRect(Math.round(gx * u), Math.round(gy * u), Math.round(gw * u), Math.round(gh * u));
}

function bar(gx, gy, gw, gh, frac, color, back = '#2a2028') {
  box(gx - 1, gy - 1, gw + 2, gh + 2, '#140d14');
  box(gx, gy, gw, gh, back);
  box(gx, gy, Math.round(gw * clamp(frac, 0, 1)), gh, color);
  box(gx, gy, Math.round(gw * clamp(frac, 0, 1)), 1, 'rgba(255,255,255,0.35)');
}

function drawHUD() {
  box(3, 3, 222, 25);
  for (let i = 0; i < 3; i++) img(SPR.heart[i < P.hearts ? 1 : 0], 7 + i * 11, 6);
  text('ÁGUA', 7, 18, 6, '#bfe8fa');
  bar(33, 18, 52, 6, P.water / 100, P.water < 20 ? '#e8642a' : '#3d95d6');
  img(SPR.nut, 94, 5);
  text('x' + P.seeds, 106, 7, 8, '#f2c443');
  text('ANIMAIS', 94, 18, 6, '#e8dcc8');
  text(`${stats.animals}/${L.cages.length}`, 140, 18, 6, '#ffffff');
  // animais resgatados (ícones)
  L.cages.forEach((cg, i) => {
    const im = SPR.animals[cg.animal][0][0];
    const u = U(), sc = Math.min(1, 16 / im.width, 13 / im.height);
    sctx.globalAlpha = cg.open ? 1 : 0.25;
    sctx.drawImage(im, Math.round((164 + i * 19) * u), Math.round((7 + (12 - im.height * sc) / 2) * u), Math.round(im.width * sc * u), Math.round(im.height * sc * u));
    sctx.globalAlpha = 1;
  });

  const pct = forestPct();
  box(W - 101, 3, 98, 25);
  text('FLORESTA', W - 97, 6, 6, '#b8f08c');
  text(Math.round(pct * 100) + '%', W - 7, 6, 8, '#ffffff', 'right');
  bar(W - 97, 18, 90, 6, pct, '#4caf50');
  // marcas das estrelas
  for (const s of L.def.stars) box(W - 97 + Math.round(90 * s), 17, 1, 8, '#f2c443');

  if (hint.t > 0 && state === 'play') {
    const a = clamp(Math.min(hint.t, 6 - hint.t) * 3, 0, 1);
    sctx.globalAlpha = a;
    const tw = textWidth(hint.text, 6);
    box(W / 2 - tw / 2 - 6, 33, tw + 12, 14, 'rgba(15,10,15,0.7)');
    text(hint.text, W / 2, 37, 6, '#fff3a0', 'center');
    sctx.globalAlpha = 1;
  }
  if (toast.t > 0 && state === 'play') {
    sctx.globalAlpha = clamp(toast.t * 3, 0, 1);
    const tw = textWidth(toast.text, 6);
    box(W / 2 - tw / 2 - 6, H - 26, tw + 12, 14, 'rgba(15,10,15,0.7)');
    text(toast.text, W / 2, H - 22, 6, '#ffffff', 'center');
    sctx.globalAlpha = 1;
  }
}

function drawTouchButtons() {
  const u = U();
  for (const b of TOUCH_BTNS) {
    sctx.globalAlpha = b.on ? 0.7 : 0.38;
    sctx.fillStyle = b.color || '#e8dcc8';
    sctx.beginPath();
    sctx.arc(b.x * u, b.y * u, b.r * u, 0, Math.PI * 2);
    sctx.fill();
    sctx.globalAlpha = 0.9;
    if (b.icon) {
      const d = { left: [-1, 0], right: [1, 0], up: [0, -1] }[b.icon], k = b.r * 0.45;
      sctx.fillStyle = '#140d14';
      sctx.beginPath();
      sctx.moveTo((b.x + d[0] * k) * u, (b.y + d[1] * k) * u);
      sctx.lineTo((b.x - d[0] * k * 0.6 - d[1] * k) * u, (b.y - d[1] * k * 0.6 + d[0] * k) * u);
      sctx.lineTo((b.x - d[0] * k * 0.6 + d[1] * k) * u, (b.y - d[1] * k * 0.6 - d[0] * k) * u);
      sctx.fill();
    } else {
      sctx.font = `${Math.round((b.label.length > 4 ? 4 : 5) * u)}px ${FONT}`;
      sctx.textAlign = 'center';
      sctx.textBaseline = 'middle';
      sctx.fillStyle = '#140d14';
      sctx.fillText(b.label, b.x * u, b.y * u);
    }
  }
  sctx.globalAlpha = 1;
}

function drawCenterBox(lines, colors = []) {
  const h = lines.length * 12 + 16;
  box(W / 2 - 150, H / 2 - h / 2, 300, h, 'rgba(15,10,15,0.82)');
  lines.forEach((l, i) => text(l, W / 2, H / 2 - h / 2 + 10 + i * 12, i === 0 ? 10 : 6, colors[i] || (i === 0 ? '#fff3a0' : '#e8dcc8'), 'center'));
}

function drawStar(gx, gy, r, filled) {
  const u = U();
  sctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r;
    sctx.lineTo((gx + Math.cos(a) * rr) * u, (gy + Math.sin(a) * rr) * u);
  }
  sctx.closePath();
  sctx.fillStyle = filled ? '#f2c443' : '#3a3036';
  sctx.fill();
  sctx.lineWidth = u;
  sctx.strokeStyle = '#140d14';
  sctx.stroke();
}

function drawWin() {
  const pct = stats.pct;
  const nStars = L.def.stars.filter(s => pct >= s).length;
  const last = L.def.goalType === 'xapono';
  box(W / 2 - 140, 36, 280, 158, 'rgba(15,10,15,0.85)');
  text(last ? `${HERO_NAME} chegou ao xapono!` : 'Fase completa!', W / 2, 46, 10, '#b8f08c', 'center');
  for (let i = 0; i < 3; i++) {
    const show = winT > 0.4 + i * 0.3;
    drawStar(W / 2 - 30 + i * 30, 76, 10, show && i < nStars);
  }
  const rows = [
    ['Floresta restaurada', Math.round(pct * 100) + '%'],
    ['Animais libertados', `${stats.animals}/${L.cages.length}`],
    ['Árvores sobreviventes', `${stats.survivors}/${L.survivors.length}`],
    ['Árvores plantadas', String(stats.trees)],
    ['Focos de fogo apagados', `${stats.fires}/${L.fires.length}`],
  ];
  if (L.pools.length) rows.push(['Águas limpas', `${stats.rivers}/${L.pools.length}`]);
  rows.forEach(([k, v], i) => {
    text(k, W / 2 - 124, 96 + i * 12, 6, '#e8dcc8');
    text(v, W / 2 + 124, 96 + i * 12, 6, '#ffffff', 'right');
  });
  if (winT > 1.2 && Math.floor(time * 2) % 2 === 0) text(last ? 'ENTER para continuar' : 'ENTER: próxima fase', W / 2, 180, 6, '#fff3a0', 'center');
}

function drawTitle() {
  box(0, 0, W, H, 'rgba(10,6,10,0.45)');
  const tw = textWidth('REFLORESTA.ME', 22);
  box(W / 2 - tw / 2 - 10, 28, tw + 20, 40, 'rgba(15,10,15,0.6)');
  text('REFLORESTA', W / 2 - textWidth('.ME', 22) / 2, 38, 22, '#5cc25a', 'center');
  text('.ME', W / 2 + tw / 2 - textWidth('.ME', 22), 38, 22, '#f2c443');
  text('Uma aventura de ' + HERO_NAME + ' na Amazônia', W / 2, 76, 7, '#e8dcc8', 'center');
  const lines = [
    'O garimpo, o gado e o fogo devastaram a floresta.',
    'Mas ainda há sementes, igarapés e vida.',
    'Apague o fogo, plante, regue e liberte os animais.',
  ];
  lines.forEach((l, i) => text(l, W / 2, 96 + i * 11, 6, '#ffffff', 'center'));
  box(W / 2 - 128, 136, 256, 52, 'rgba(15,10,15,0.6)');
  const ctl = [
    ['SETAS', 'andar'],
    ['ESPAÇO / Z', 'pular'],
    ['X', 'jogar água (+ CIMA: mais alto)'],
    ['C', 'lançar semente'],
  ];
  ctl.forEach(([k, v], i) => {
    text(k, W / 2 - 8, 142 + i * 11, 6, '#f2c443', 'right');
    text(v, W / 2 + 8, 142 + i * 11, 6, '#e8dcc8');
  });
  if (Math.floor(time * 2) % 2 === 0) text(touchMode ? 'Toque para começar' : 'Pressione ENTER', W / 2, 198, 8, '#fff3a0', 'center');
  text(Sfx.isMuted() ? 'M: ligar música' : 'M: desligar música', W - 6, H - 10, 5, 'rgba(255,255,255,0.5)', 'right');
}

// ---------------------------------------------------------------- Caderno da Floresta
const RAIN_ICON = px(16, 16, x => {
  x.fillStyle = '#e8eef4';
  x.fillRect(3, 3, 10, 4);
  x.fillRect(5, 1, 6, 2);
  x.fillRect(1, 5, 14, 3);
  x.fillStyle = '#9ad8f4';
  for (const [i, j] of [[3, 10], [7, 12], [11, 10], [5, 14], [9, 15], [13, 13]]) x.fillRect(i, j, 1, 2);
});

function factIcon(key) {
  const a = SPR.animals[key];
  if (a) return a[Math.floor(time * 4) % a.length][0];
  return {
    nut: SPR.nut, fire: SPR.fire[Math.floor(time * 10) % 4], water: SPR.water[Math.floor(time * 5) % 4],
    tree: SPR.survivor.bloomed, sapling: SPR.sapling[2], rain: RAIN_ICON, toxic: SPR.toxic[Math.floor(time * 4) % 4],
  }[key];
}

function drawCard() {
  const f = FACTS[card.key];
  const a = clamp(card.t * 5, 0, 1);
  const top = 44 + (1 - a) * 10;
  sctx.globalAlpha = a;
  box(0, 0, W, H, 'rgba(10,6,10,0.45)');
  box(W / 2 - 176, top, 352, 132, '#2a1e16');
  box(W / 2 - 174, top + 2, 348, 128, '#f2e6c8');
  box(W / 2 - 174, top + 2, 348, 14, '#5e3d24');
  text('CADERNO DA FLORESTA', W / 2, top + 6, 6, '#f2c443', 'center');
  const im = factIcon(FACTS[card.key].icon);
  const sc = Math.min(2, 30 / Math.max(im.width, im.height));
  img(im, W / 2 - (im.width * sc) / 2, top + 22 + (30 - im.height * sc) / 2, sc);
  const u = U();
  sctx.font = `${Math.round(9 * u)}px ${FONT}`;
  sctx.textAlign = 'center';
  sctx.fillStyle = '#2f6a2e';
  sctx.fillText(f.title, (W / 2) * u, (top + 58) * u);
  sctx.font = `${Math.round(6 * u)}px ${FONT}`;
  f.lines.forEach((l, i) => {
    sctx.fillStyle = l.startsWith('PODER') ? '#b0402a' : '#3a2a20';
    sctx.fillText(l, (W / 2) * u, (top + 76 + i * 11) * u);
  });
  if (card.t > 0.6 && Math.floor(time * 2) % 2 === 0) {
    sctx.fillStyle = '#7a5230';
    sctx.fillText('ENTER para continuar', (W / 2) * u, (top + 116) * u);
  }
  sctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- cenas da história
function groundStrip(green, from = 0, to = W, toxic = null) {
  const set = green ? SPR.tiles.g : SPR.tiles.b;
  for (let x = from; x < to; x += TS) {
    const c = x / TS, v = hash(c * 31) & 1;
    if (toxic && c >= toxic[0] && c <= toxic[1]) {
      g.drawImage(SPR.toxic[Math.floor(time * 4) % 4], x, 176);
      g.drawImage(set.dirt[v], x, 192);
    } else {
      g.drawImage(set.top[v], x, 176);
      g.drawImage(set.dirt[v], x, 192);
    }
    g.drawImage(set.dirt[v ^ 1], x, 208);
  }
}

function sceneBackground(t) {
  drawSky(t);
  drawLayer(SPR.bg.far, 0.15, t, 0);
  drawHaze(t);
  drawLayer(SPR.bg.near, 0.4, t, 8);
}

const onFeet = (im, x, base = 176, dy = 0) => g.drawImage(im, Math.round(x), Math.round(base - im.height + 2 + dy));

function drawScene(scene, st) {
  cam.x = time * 12;
  const A = SPR.animals, fly = (k, i) => A[k][Math.floor(time * 8 + i) % 2];
  if (scene === 'forest' || scene === 'title' || scene === 'cool' || scene === 'life' || scene === 'party' || scene === 'rain') {
    sceneBackground(1);
    if (scene === 'rain') drawRainSky(0.8);
    groundStrip(true);
    for (let c = 0; c < W / TS; c++) {
      const hv = hash(c * 7 + 3);
      if (hv % 3) g.drawImage(SPR.deco[['tuft', 'fern', 'flowerRed', 'flowerYellow', 'flowerPink'][hv % 5]], c * TS, 160);
    }
  }
  if (scene === 'forest' || scene === 'title') {
    onFeet(SPR.survivor.bloomed, 30);
    onFeet(SPR.survivor.bloomed, 290);
    onFeet(SPR.sapling[2], 120);
    onFeet(SPR.sapling[2], 220);
    const ax = ((time * 50) % (W + 60)) - 30;
    g.drawImage(fly('arara', 0)[0], Math.round(ax), Math.round(70 + Math.sin(time * 3) * 8));
    g.drawImage(fly('tucano', 1)[0], Math.round(ax - 40), Math.round(90 + Math.sin(time * 3 + 1) * 8));
    if (scene === 'title') {
      onFeet(A.macaco[0][0], 180);
      onFeet(A.onca[Math.floor(time * 4) % 2][1], 250);
    }
  } else if (scene === 'life') {
    onFeet(SPR.survivor.bloomed, 0);
    const walk = Math.floor(time * 6) % 2;
    onFeet(A.onca[walk][0], 70);
    onFeet(A.anta[walk][0], 110);
    onFeet(A.macaco[walk][0], 150, 176, -Math.abs(Math.round(Math.sin(time * 10) * 3)));
    onFeet(A.preguica[0][0], 34, 130);
    g.drawImage(fly('arara', 0)[0], 190, Math.round(60 + Math.sin(time * 3) * 6));
    g.drawImage(fly('tucano', 1)[1], 240, Math.round(80 + Math.sin(time * 3 + 2) * 6));
    if (st > 1.2) {
      SPR.people.slice(0, 4).forEach((pp, i) => {
        const up = Math.floor(time * 3 + i) % 2;
        onFeet(pp[up][1], 250 + i * 26);
      });
    }
  } else if (scene === 'rain') {
    onFeet(SPR.survivor.bloomed, 20);
    onFeet(SPR.survivor.bloomed, 150);
    onFeet(SPR.survivor.bloomed, 280);
    // vapor subindo das árvores e virando nuvem que o vento leva
    g.fillStyle = 'rgba(220,235,250,0.55)';
    for (let i = 0; i < 24; i++) {
      const k = ((time * 0.4 + i / 24) % 1);
      const x = 48 + (i % 3) * 130 + Math.sin(i * 7 + time) * 6 + k * 40;
      g.fillRect(Math.round(x), Math.round(110 - k * 80), 2, 2);
    }
    g.fillStyle = '#e8eef4';
    for (let k = 0; k < 3; k++) {
      const cx = ((k * 140 + time * 25) % (W + 80)) - 40;
      g.fillRect(Math.round(cx), 22 + k * 6, 54, 10);
      g.fillRect(Math.round(cx) + 10, 16 + k * 6, 30, 6);
    }
    drawRainDrops(Math.min(1, st / 2));
  } else if (scene === 'cool') {
    const cx = W / 2, cy = 104, r = 34;
    g.globalAlpha = 0.25 + Math.sin(time * 2) * 0.08;
    g.fillStyle = '#d8f0f4';
    g.beginPath(); g.arc(cx, cy, r + 10, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = '#3d95d6';
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#4caf50';
    const sh = (time * 6) % 80;
    for (const [x, y, w, h] of [[-20, -18, 22, 18], [-10, 0, 14, 22], [14, -20, 20, 12], [22, -6, 12, 24], [-40, 8, 14, 10]]) {
      g.fillRect(Math.round(cx + ((x + sh + 40) % 80) - 40), cy + y, w, h);
    }
    g.fillStyle = '#2f8a3e';
    g.fillRect(Math.round(cx + ((-10 + sh + 40) % 80) - 40), cy + 2, 10, 12);
    g.restore();
    onFeet(SPR.sapling[2], 70);
    onFeet(SPR.sapling[2], 290);
  } else if (scene === 'fire' || scene === 'sad' || scene === 'hero') {
    sceneBackground(0);
    groundStrip(false, 0, W, scene === 'sad' ? [9, 12] : null);
    if (scene === 'hero') {
      // a floresta começa a voltar em volta de Urihi
      const rad = Math.min(5, st * 1.6);
      for (let c = 0; c < W / TS; c++) {
        const d = Math.abs(c - 11.5);
        if (d > rad) continue;
        const v = hash(c * 31) & 1, lvl = Math.max(1, Math.min(4, Math.round((rad - d) * 2)));
        g.drawImage(SPR.tiles.gd.top[v][lvl], c * TS, 176);
      }
      onFeet(SPR.survivor.wilted, 40);
      if (st > 1.2) onFeet(SPR.sapling[Math.min(2, Math.floor((st - 1.2) * 1.5))], 236);
      const hero = SPR.hero[Math.floor(time * 2) % 2 ? 'idle' : 'idle_spray'][0];
      g.drawImage(hero, 160, 176 - hero.height * 2 + 4, hero.width * 2, hero.height * 2);
    } else {
      for (let c = 0; c < W / TS; c++) if (hash(c * 5) % 4 === 0) g.drawImage(SPR.deco.stump, c * TS, 160);
      if (scene === 'fire') {
        for (const fx of [30, 70, 86, 150, 200, 216, 330]) {
          g.drawImage(SPR.fire[(Math.floor(time * 10) + fx) % 4], fx, 160);
          if (Math.random() < 0.06) part({ x: fx + 8, y: 160, vx: rand(-6, 6), vy: rand(-22, -14), life: 2, color: '#3a3236', size: 3, type: 'smoke' });
        }
        g.drawImage(SPR.dredge, 250, 124);
      } else {
        onFeet(SPR.cages.macaco, 60);
        onFeet(SPR.cages.arara, 300);
        onFeet(SPR.survivor.wilted, 230);
      }
    }
  }
  if (scene === 'party') {
    g.drawImage(SPR.xapono, W / 2 - 120, 176 - 80);
    SPR.people.forEach((pp, i) => {
      const up = Math.floor(time * 4 + i) % 2;
      const hop = -Math.abs(Math.sin(time * 5 + i * 1.3)) * 8;
      onFeet(pp[up][i % 2], 110 + i * 26, 176, hop);
    });
    const hero = SPR.hero[Math.floor(time * 4) % 2 ? 'jump' : 'idle'][0];
    onFeet(hero, W / 2 - 4, 176, -Math.abs(Math.sin(time * 6)) * 6);
    g.drawImage(fly('arara', 0)[0], Math.round(W / 2 + Math.cos(time) * 80), Math.round(70 + Math.sin(time * 2) * 10));
    if (Math.random() < 0.05) burst(rand(100, 280), rand(40, 90), ['#e0302a', '#2f6fd6', '#f2c443', '#5cc25a'], 10, 70);
  }
  for (const p of particles) {
    g.globalAlpha = clamp(p.life / p.max, 0, 1) * (p.type === 'smoke' ? 0.45 : 1);
    g.fillStyle = p.color;
    const sz = Math.round(p.size);
    g.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
  }
  g.globalAlpha = 1;
}

function drawStoryFrame() {
  const sl = story.slides[story.i];
  drawScene(sl.scene, story.t);
  // transição suave entre slides
  if (story.t < 0.3) {
    g.fillStyle = `rgba(10,6,10,${1 - story.t / 0.3})`;
    g.fillRect(0, 0, W, H);
  }
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(view, 0, 0, cv.width, cv.height);

  const n = sl.lines.length;
  box(12, 10, W - 24, 18 + n * 13, 'rgba(15,10,15,0.78)');
  let left = Math.floor(story.t * 40);
  const size = sl.lines.some(l => textWidth(l, 7) > W - 36) ? 6 : 7;
  sl.lines.forEach((l, i) => {
    const shown = l.slice(0, Math.max(0, left));
    left -= l.length + 1;
    text(shown, W / 2, 20 + i * 13, size, '#ffffff', 'center');
  });
  // pontinhos de progresso
  story.slides.forEach((_, i) => box(W / 2 - story.slides.length * 5 + i * 10, H - 12, 6, 3, i === story.i ? '#f2c443' : 'rgba(255,255,255,0.35)'));
  const full = sl.lines.join(' ').length / 40 + 0.2;
  if (story.t > full && Math.floor(time * 2) % 2 === 0) text('ENTER ►', W - 20, H - 20, 6, '#fff3a0', 'right');
  text(touchMode ? 'PULAR' : 'ESC: pular', 20, H - 20, touchMode ? 7 : 5, 'rgba(255,255,255,0.6)');
}

// ---------------------------------------------------------------- início
loadLevel(LEVEL1);
stats = { fires: 0, trees: 0, animals: 0, survivors: 0, deaths: 0 };
checkpoint = { x: LEVEL1.start[0] * TS + 3, y: LEVEL1.start[1] * TS - 18.01 };
spawnPlayer();

// Parâmetros de depuração: ?play  ?level=2  ?x=COLUNA  ?green=1  ?seeds=N  ?rescue=1  ?win=1
//   ?nofacts  ?rain=1  ?story=intro|outro&slide=N  ?fact=CHAVE  ?touch=1
if (params.has('play') || params.has('x') || params.has('win') || params.has('level')) {
  startGame();
  if (params.has('level')) startLevel(+params.get('level') - 1);
  if (params.has('x')) {
    const c = +params.get('x');
    checkpoint = { x: c * TS + 3, y: L.top[c] * TS - 18.01 };
    spawnPlayer();
    P.inv = 0; P.fadeIn = 0;
    updateCamera(0, true);
  }
  if (params.has('seeds')) P.seeds = +params.get('seeds');
  if (params.has('green')) { L.gt.fill(+params.get('green')); L.g.fill(+params.get('green')); }
  if (params.has('rescue')) {
    for (const cg of L.cages) { cg.open = true; stats.animals++; L.followers.push({ type: cg.animal, x: P.x, y: P.y, face: 1, vx: 0 }); }
  }
  if (params.has('rain')) startRain();
  if (params.has('fact')) queueFact(params.get('fact'));
  if (params.has('win')) {
    if (L.def.goalType === 'xapono') {
      P.x = L.goalX;
      finishLevel();
    } else { state = 'win'; winT = 5; stats.pct = forestPct(); }
  }
}
if (params.has('touch')) touchMode = true;
if (params.has('story')) {
  startStory(params.get('story') === 'outro' ? OUTRO : INTRO, () => { state = 'title'; });
  story.i = +(params.get('slide') || 0);
  story.t = 99;
}

let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= STEP) {
    update(STEP);
    acc -= STEP;
    for (const k in pressed) delete pressed[k];
  }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
