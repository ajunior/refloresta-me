'use strict';
// Todos os sprites são gerados por código: mapas de caracteres (pixel art) ou
// desenho procedural em canvases pequenos. Nada de imagens externas.

const PAL = {
  // protagonista
  h: '#1b1420', s: '#b5703f', S: '#8a4b2a', r: '#d8352a', k: '#1e1622',
  y: '#f2c443', Y: '#b8801f', b: '#7a3b2a', B: '#552619', c: '#d9aa5c', C: '#9c6f34',
  // animais
  R: '#e0302a', u: '#2f6fd6', e: '#f4e6c8', n: '#7a5230', N: '#4e331e',
  t: '#d6b48a', T: '#a8865f', m: '#3a2a20', w: '#ffffff', o: '#f39a1e',
  J: '#e0a640', A: '#4a4048', a: '#2e282e', D: '#c83a2a', G: '#9a9498',
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(n) {
  n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  n ^= n >>> 13;
  n = Math.imul(n, 0xc2b2ae35);
  return (n ^ (n >>> 16)) >>> 0;
}

function px(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  fn(x);
  return c;
}

function fromMap(rows, overlay, pal = PAL) {
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const grid = rows.map(r => r.padEnd(w, '.').split(''));
  if (overlay) for (const [i, j, ch] of overlay) grid[j][i] = ch;
  return px(w, h, x => {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const col = pal[grid[j][i]];
        if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
      }
    }
  });
}

function outlined(src, color = '#140d14') {
  const w = src.width, h = src.height;
  const d = src.getContext('2d').getImageData(0, 0, w, h).data;
  const on = (i, j) => i >= 0 && j >= 0 && i < w && j < h && d[(j * w + i) * 4 + 3] > 0;
  return px(w, h, x => {
    x.fillStyle = color;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (on(i, j)) continue;
        if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1)) x.fillRect(i, j, 1, 1);
      }
    }
    x.drawImage(src, 0, 0);
  });
}

function flip(src) {
  return px(src.width, src.height, x => {
    x.translate(src.width, 0);
    x.scale(-1, 1);
    x.drawImage(src, 0, 0);
  });
}

// Par [direita, esquerda]
function both(src) { return [src, flip(src)]; }

function disc(x, cx, cy, r, color) {
  x.fillStyle = color;
  for (let j = -r; j <= r; j++) {
    for (let i = -r; i <= r; i++) {
      if (i * i + j * j <= r * r + r * 0.6) x.fillRect(Math.round(cx + i), Math.round(cy + j), 1, 1);
    }
  }
}

// Matriz de Bayer 4x4 para a transição queimado → verde em pontilhado
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const DITHER_LEVELS = 4;

function ditherMask(src, level) {
  if (level >= DITHER_LEVELS) return src;
  const thr = (level / DITHER_LEVELS) * 16;
  return px(src.width, src.height, x => {
    x.drawImage(src, 0, 0);
    const img = x.getImageData(0, 0, src.width, src.height);
    for (let j = 0; j < src.height; j++) {
      for (let i = 0; i < src.width; i++) {
        if (BAYER[(j % 4) * 4 + (i % 4)] >= thr) img.data[(j * src.width + i) * 4 + 3] = 0;
      }
    }
    x.putImageData(img, 0, 0);
  });
}

function speckle(x, R, w, h, colors, n, y0 = 0) {
  for (let k = 0; k < n; k++) {
    x.fillStyle = colors[Math.floor(R() * colors.length)];
    x.fillRect(Math.floor(R() * w), y0 + Math.floor(R() * (h - y0)), 1 + (R() < 0.3), 1);
  }
}

// ---------------------------------------------------------------- tiles
function groundTile(green, top, seed) {
  const R = rng(seed);
  return px(16, 16, x => {
    x.fillStyle = green ? '#6b4426' : '#3e302b';
    x.fillRect(0, 0, 16, 16);
    speckle(x, R, 16, 16, green ? ['#5a381f', '#7d5230', '#8a5f38'] : ['#2e2420', '#54423a', '#4a3a33'], 30);
    if (green) {
      // pedrinhas
      x.fillStyle = '#9a7a55';
      x.fillRect(3 + Math.floor(R() * 9), 9 + Math.floor(R() * 5), 2, 1);
    }
    if (!top) return;
    for (let i = 0; i < 16; i++) {
      const d = 3 + Math.floor(R() * 3);
      for (let j = 0; j < d; j++) {
        if (green) x.fillStyle = j === 0 ? '#86d96a' : j === d - 1 ? '#2e7d32' : '#4caf50';
        else x.fillStyle = j === 0 ? '#7a7376' : j === d - 1 ? '#2c2729' : '#575153';
        x.fillRect(i, j, 1, 1);
      }
    }
    if (!green) {
      // brasas no meio da cinza
      x.fillStyle = '#e8642a';
      for (let k = 0; k < 2; k++) x.fillRect(Math.floor(R() * 16), 1 + Math.floor(R() * 2), 1, 1);
    } else {
      x.fillStyle = '#b8f08c';
      for (let k = 0; k < 3; k++) x.fillRect(Math.floor(R() * 16), 0, 1, 1);
    }
  });
}

function logTile(green, seed) {
  const R = rng(seed);
  return px(16, 16, x => {
    const base = green ? '#7a5232' : '#3b2b24';
    const dark = green ? '#5a3a20' : '#241914';
    const light = green ? '#a0744a' : '#55423a';
    x.fillStyle = base;
    x.fillRect(0, 1, 16, 8);
    x.fillStyle = light;
    x.fillRect(0, 1, 16, 2);
    x.fillStyle = dark;
    x.fillRect(0, 8, 16, 1);
    for (let k = 0; k < 4; k++) x.fillRect(Math.floor(R() * 14), 4 + Math.floor(R() * 3), 3, 1);
    if (green) {
      x.fillStyle = '#4caf50';
      x.fillRect(Math.floor(R() * 12), 0, 3, 1);
      x.fillRect(Math.floor(R() * 12), 9, 1, 2);
    } else {
      x.fillStyle = '#e8642a';
      x.fillRect(Math.floor(R() * 14), 5, 2, 1);
    }
  });
}

function waterTile(frame) {
  return px(16, 16, x => {
    x.fillStyle = '#2f7fc0';
    x.fillRect(0, 2, 16, 14);
    x.fillStyle = '#3d95d6';
    x.fillRect(0, 2, 16, 3);
    x.fillStyle = '#9ad8f4';
    for (let i = 0; i < 16; i++) {
      const y = Math.round(1.5 + Math.sin((i + frame * 4) * 0.8) * 1);
      x.fillRect(i, y, 1, 1);
    }
    x.fillStyle = '#5fb2e6';
    x.fillRect((frame * 5) % 16, 8, 3, 1);
    x.fillRect((frame * 5 + 9) % 16, 12, 2, 1);
  });
}

// ---------------------------------------------------------------- protagonista
const HERO_TOP = [
  '................',
  '......hssh......',
  '....hhhhhhhh....',
  '...hhhhhhhhhh...',
  '...hhhhhhhhhhh..',
  '...hhhhsssssss..',
  '...hhhssssskss..',
  '...hhhsssrrssss.',
  '...hhhssssssss..',
  '....hhsSsssss...',
  '......SSsss.....',
  '.....yyYyyYyy...',
  '....sssrsssrss..',
  '....ssssrsssrs..',
  '....sSssssssSs..',
  '....sbbbbbbbbs..',
  '.....bBbbbbBb...',
];
const HERO_LEGS = {
  idle: ['......ss..ss....', '......ss..ss....', '......sss.sss...'],
  run1: ['.....SS...ss....', '....SS.....ss...', '...SS......sss..'],
  run2: ['.......ss.......', '.......Sss......', '.......SSss.....'],
  run3: ['.....ss...SS....', '....ss.....SS...', '...ss......SSS..'],
  jump: ['......ss.ss.....', '.....ss...sss...', '.....s..........'],
  fall: ['.....ss...ss....', '.....ss....ss...', '....ss.....sss..'],
};
// braçadeira com pena de arara
const ARMBAND = [[4, 12, 'R'], [5, 12, 'R'], [3, 11, 'R'], [2, 10, 'y']];
const GOURD_HIP = [[3, 13, 'B'], [2, 14, 'c'], [3, 14, 'c'], [2, 15, 'C'], [3, 15, 'c'], [2, 16, 'C'], [3, 16, 'C']];
const GOURD_SPRAY = [[12, 12, 's'], [13, 11, 'C'], [14, 11, 'c'], [15, 11, 'c'], [13, 12, 'c'], [14, 12, 'c'], [15, 12, 'C'], [14, 13, 'C'], [13, 13, 's']];

function buildHero() {
  const out = {};
  for (const [name, legs] of Object.entries(HERO_LEGS)) {
    for (const spray of [false, true]) {
      const img = outlined(fromMap([...HERO_TOP, ...legs], [...ARMBAND, ...(spray ? GOURD_SPRAY : GOURD_HIP)]));
      out[name + (spray ? '_spray' : '')] = both(img);
    }
  }
  return out;
}

// ---------------------------------------------------------------- animais
const ARARA = [
  [
    '..............',
    '..........RR..',
    '....uu...RRRe.',
    '...uuyu..RRekk',
    '...uyyRRRRR.k.',
    '....yRRRRR....',
    '.....RRRR.....',
    '....RRR.......',
    '...RRu........',
    '..Ru..........',
    '.u............',
  ],
  [
    '..............',
    '..........RR..',
    '.........RRRe.',
    '.........RRekk',
    '....RRRRRRR.k.',
    '...yRRRRR.....',
    '..uyyRRRR.....',
    '..uuyRR.......',
    '...RRu........',
    '..Ru..........',
    '.u............',
  ],
];
const MACACO = [
  [
    '............',
    '.....nnnn...',
    '....nnttnn..',
    '....ntktkn..',
    '....nttttn..',
    '.....nttn...',
    'n...nnnnnn..',
    'n..nnnTTnnn.',
    '.n.nnnTTn.n.',
    '..nnnnnnn...',
    '...nn..nn...',
    '..NN...NN...',
  ],
  [
    '............',
    '.....nnnn...',
    '....nnttnn..',
    '....ntktkn..',
    '....nttttn..',
    'n....nttn...',
    'n...nnnnnn.n',
    '.n.nnnTTnnn.',
    '..nnnnTTn...',
    '...nnnnnnn..',
    '..nn....nn..',
    '.NN......NN.',
  ],
];
const PREGUICA = [
  '..............',
  '....TTTTTT....',
  '...TTeeeeTT...',
  '...TekeekeT...',
  '...TTeeeeTT...',
  '..TTTTTTTTTT..',
  '.mTTTTTTTTTTm.',
  '..TTTTttTTTT..',
  '...TTTTTTTT...',
  '...mm....mm...',
];

const TUCANO = [
  [
    '..............',
    '..kk..kkk.....',
    '...kk.kkkuoooo',
    '....kkkkeeoooo',
    '....kkkkeeoo..',
    '...kkkkke.....',
    '..kkkkkkk.....',
    '.kkkkkkk......',
    'kkkkkR........',
    '.kk...........',
  ],
  [
    '..............',
    '......kkk.....',
    '.....kkkkuoooo',
    '.....kkkeeoooo',
    '....kkkkeeoo..',
    '...kkkkke.....',
    '..kkkkkkk.....',
    '.kkkkkkk......',
    'kkkkkR........',
    '.kk...........',
  ],
];
const ONCA_BODY = [
  '................',
  '...........J.J..',
  '..........JJJJJ.',
  '..........JkJJmJ',
  'J.JJJJJJJJJJJJJJ',
  '.JJmJJmJJmJJJJ..',
  '..JJJJJJJJJJJJ..',
  '..JmJJJmJJJmJ...',
];
const ONCA = [
  [...ONCA_BODY, '..JJ.JJ..JJ.JJ..', '..JJ.JJ..JJ.JJ..'],
  [...ONCA_BODY, '...JJJ....JJJ...', '...J.J....J.J...'],
];
const ANTA_BODY = [
  '....................',
  '..............AA....',
  '...AAAAAAAAAAAAAA...',
  '..AAAAAAAAAAAAAAkA..',
  '.AAAAAAAAAAAAAAAAAA.',
  '.AAAAAAAAAAAAAAAAAAA',
  '.AAAAAAAAAAAAAAAA.aA',
  '.AAAAAAAAAAAAAAA...a',
];
const ANTA = [
  [...ANTA_BODY, '..AA..AA...AA..AA...', '..AA..AA...AA..AA...', '..aa..aa...aa..aa...'],
  [...ANTA_BODY, '...AA.AA....AA.AA...', '...AA..AA...AA..AA..', '...aa..aa...aa..aa..'],
];

function buildAnimals() {
  const set = frames => frames.map(f => both(outlined(fromMap(f))));
  return {
    arara: set(ARARA),
    macaco: set(MACACO),
    preguica: set([PREGUICA]),
    tucano: set(TUCANO),
    onca: set(ONCA),
    anta: set(ANTA),
  };
}

// ---------------------------------------------------------------- povo Yanomami (festa final)
const KID = [
  '............',
  '....hssh....',
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hhhsssss..',
  '..hhssskss..',
  '..hhsrrsss..',
  '...hsssss...',
  '....yyyy....',
  '...sssrss...',
  '...ssrsss...',
  '....bbbb....',
  '....s..s....',
  '....s..s....',
  '...ss.ss....',
];

function range(a, b) { return Array.from({ length: b - a + 1 }, (_, i) => a + i); }

function buildPeople() {
  const adult = [...HERO_TOP, ...HERO_LEGS.idle];
  const armsUp = [...range(4, 11).map(j => [13, j, 's']), [14, 4, 's'], ...range(5, 11).map(j => [2, j, 's'])];
  const kidUp = [...range(3, 9).map(j => [10, j, 's']), ...range(4, 9).map(j => [1, j, 's'])];
  const dress = [];
  for (const j of range(12, 16)) for (const i of range(5, 12)) dress.push([i, j, 'D']);
  const kidDress = [];
  for (const j of range(9, 11)) for (const i of range(4, 8)) kidDress.push([i, j, 'D']);
  const gray = { ...PAL, h: '#9a9498' };
  const variants = [
    { map: adult, ov: ARMBAND, up: armsUp },
    { map: adult, ov: dress, up: armsUp },
    { map: adult, ov: dress, up: armsUp, pal: gray },
    { map: adult, ov: ARMBAND, up: armsUp, pal: gray },
    { map: KID, ov: [], up: kidUp },
    { map: KID, ov: kidDress, up: kidUp },
  ];
  return variants.map(v => [false, true].map(up => both(outlined(fromMap(v.map, [...v.ov, ...(up ? v.up : [])], v.pal || PAL)))));
}

function cageSprite(animalImg) {
  return px(22, 24, x => {
    x.drawImage(animalImg, Math.floor((22 - animalImg.width) / 2), 22 - animalImg.height - 1);
    x.fillStyle = '#4a3020';
    x.fillRect(1, 0, 20, 3);
    x.fillRect(1, 21, 20, 3);
    x.fillStyle = '#7a5434';
    x.fillRect(1, 0, 20, 1);
    x.fillRect(1, 21, 20, 1);
    for (let i = 1; i < 22; i += 4) {
      x.fillStyle = '#5a3a24';
      x.fillRect(i, 3, 2, 18);
      x.fillStyle = '#8a6440';
      x.fillRect(i, 3, 1, 18);
    }
    // amarração de corda e cadeado dos traficantes
    x.fillStyle = '#c9a24a';
    x.fillRect(9, 10, 4, 1);
    x.fillStyle = '#8c8c96';
    x.fillRect(9, 11, 4, 4);
    x.fillStyle = '#5c5c66';
    x.fillRect(10, 13, 2, 1);
  });
}

function brokenCage() {
  return px(22, 24, x => {
    x.fillStyle = '#4a3020';
    x.fillRect(1, 21, 20, 3);
    x.fillStyle = '#5a3a24';
    x.fillRect(1, 12, 2, 9);
    x.fillRect(19, 15, 2, 6);
    x.fillRect(5, 18, 8, 2);
  });
}

// ---------------------------------------------------------------- fogo e brasas
function fireFrame(seed) {
  const R = rng(seed);
  return px(16, 16, x => {
    for (let i = 1; i < 15; i++) {
      const edge = Math.abs(i - 7.5) / 7.5;
      const hgt = Math.max(2, Math.floor((1 - edge * edge) * 14 * (0.7 + R() * 0.4)));
      for (let j = 0; j < hgt; j++) {
        const t = j / hgt;
        let col = t > 0.72 ? '#d8352a' : t > 0.38 ? '#f39a1e' : '#ffe066';
        if (edge > 0.65 && t < 0.72) col = t > 0.3 ? '#d8352a' : '#f39a1e';
        x.fillStyle = col;
        x.fillRect(i, 15 - j, 1, 1);
      }
    }
    x.fillStyle = '#ffe066';
    for (let k = 0; k < 3; k++) x.fillRect(2 + Math.floor(R() * 12), Math.floor(R() * 5), 1, 1);
    x.fillStyle = '#fff6c0';
    x.fillRect(7, 12, 2, 3);
  });
}

function emberFrame(seed) {
  const R = rng(seed);
  return px(14, 14, x => {
    disc(x, 7, 9, 4, '#d8352a');
    disc(x, 7, 9, 3, '#f39a1e');
    disc(x, 7, 10, 2, '#ffe066');
    x.fillStyle = '#d8352a';
    for (let i = 4; i <= 10; i += 2) {
      const hh = 2 + Math.floor(R() * 4);
      x.fillRect(i, 5 - hh + 1, 1, hh);
    }
    x.fillStyle = '#f39a1e';
    x.fillRect(7, 3, 1, 3);
    x.fillStyle = '#1e1622';
    x.fillRect(5, 8, 1, 2);
    x.fillRect(9, 8, 1, 2);
    x.fillRect(6, 11, 3, 1);
  });
}

function charredStump() {
  return px(16, 16, x => {
    x.fillStyle = '#241a18';
    x.fillRect(5, 9, 6, 7);
    x.fillRect(4, 14, 8, 2);
    x.fillStyle = '#3d2e2a';
    x.fillRect(5, 9, 6, 1);
    x.fillStyle = '#5a5254';
    x.fillRect(3, 15, 10, 1);
  });
}

// ---------------------------------------------------------------- árvores
function canopy(x, R, cx, cy, rx, ry, palette, n) {
  for (let k = 0; k < n; k++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R());
    const px0 = cx + Math.cos(a) * rx * d, py0 = cy + Math.sin(a) * ry * d;
    const r = 4 + Math.floor(R() * 4);
    disc(x, px0, py0, r, palette[0]);
    disc(x, px0 - 1, py0 - 1, r - 1, palette[1]);
    disc(x, px0 - 2, py0 - 2, Math.max(1, r - 3), palette[2]);
  }
}

function survivorTree(bloomed) {
  const R = rng(bloomed ? 77 : 78);
  return px(56, 72, x => {
    // tronco
    x.fillStyle = bloomed ? '#5e3d24' : '#3a2a22';
    x.fillRect(25, 30, 7, 42);
    x.fillRect(22, 66, 13, 6);
    x.fillStyle = bloomed ? '#7d5634' : '#4e3a30';
    x.fillRect(26, 30, 2, 40);
    x.fillStyle = bloomed ? '#5e3d24' : '#3a2a22';
    // galhos
    for (let i = 0; i < 10; i++) {
      x.fillRect(31 + i, 36 - Math.floor(i * 0.8), 2, 2);
      x.fillRect(24 - i, 40 - Math.floor(i * 0.9), 2, 2);
    }
    if (bloomed) {
      canopy(x, R, 28, 20, 20, 12, ['#1f5e30', '#2f8a3e', '#5cc25a'], 26);
      x.fillStyle = '#f2c443';
      for (let k = 0; k < 22; k++) x.fillRect(8 + Math.floor(R() * 40), 6 + Math.floor(R() * 26), 2, 2);
      x.fillStyle = '#fff3a0';
      for (let k = 0; k < 10; k++) x.fillRect(8 + Math.floor(R() * 40), 6 + Math.floor(R() * 26), 1, 1);
    } else {
      // copa murcha: poucas folhas secas
      canopy(x, R, 28, 26, 16, 8, ['#4a4426', '#6b5e2e', '#8a7a3a'], 7);
      x.fillStyle = '#8a7a3a';
      for (let k = 0; k < 6; k++) x.fillRect(10 + Math.floor(R() * 36), 34 + Math.floor(R() * 20), 1, 1);
    }
  });
}

function sapling(stage) {
  if (stage === 0) {
    return px(16, 16, x => {
      x.fillStyle = '#2e7d32';
      x.fillRect(7, 10, 2, 6);
      x.fillStyle = '#5cc25a';
      x.fillRect(4, 9, 3, 2);
      x.fillRect(9, 8, 3, 2);
      x.fillStyle = '#86d96a';
      x.fillRect(4, 9, 1, 1);
      x.fillRect(11, 8, 1, 1);
    });
  }
  if (stage === 1) {
    const R = rng(5);
    return px(24, 32, x => {
      x.fillStyle = '#6b4426';
      x.fillRect(11, 14, 2, 18);
      canopy(x, R, 12, 12, 5, 5, ['#1f5e30', '#2f8a3e', '#5cc25a'], 5);
    });
  }
  const R = rng(9);
  return px(36, 52, x => {
    x.fillStyle = '#5e3d24';
    x.fillRect(16, 18, 4, 34);
    x.fillRect(14, 49, 8, 3);
    x.fillStyle = '#7d5634';
    x.fillRect(16, 18, 1, 32);
    canopy(x, R, 18, 15, 11, 7, ['#1f5e30', '#2f8a3e', '#5cc25a'], 14);
    // frutos de açaí
    x.fillStyle = '#4b1f4f';
    for (let k = 0; k < 7; k++) x.fillRect(9 + Math.floor(R() * 18), 12 + Math.floor(R() * 10), 2, 2);
  });
}

// ---------------------------------------------------------------- itens e cenário
function nutSprite() {
  return outlined(fromMap([
    '..........',
    '....NN....',
    '...NnnN...',
    '..NnntnN..',
    '..NntnnN..',
    '..NnnnnN..',
    '...NnnN...',
    '....NN....',
    '..........',
  ]));
}

function heartSprite(full) {
  const H = full ? 'R' : 'm';
  return outlined(fromMap([
    '.........',
    '.' + H + H + '...' + H + H + '.',
    H + 'w' + H + H + '.' + H + H + H + H,
    H + H + H + H + H + H + H + H + H,
    '.' + H + H + H + H + H + H + H + '.',
    '..' + H + H + H + H + H + '..',
    '...' + H + H + H + '...',
    '....' + H + '....',
  ].map(r => r.padEnd(9, '.'))));
}

function toxicTile(frame) {
  return px(16, 16, x => {
    x.fillStyle = '#5e5640';
    x.fillRect(0, 2, 16, 14);
    x.fillStyle = '#746a4e';
    x.fillRect(0, 2, 16, 3);
    x.fillStyle = '#a89c78';
    for (let i = 0; i < 16; i++) x.fillRect(i, Math.round(1.5 + Math.sin((i + frame * 3) * 0.7)), 1, 1);
    // brilho prateado do mercúrio
    x.fillStyle = '#d8d8e8';
    x.fillRect((frame * 4 + 2) % 16, 6, 2, 1);
    x.fillStyle = '#b090c0';
    x.fillRect((frame * 4 + 10) % 16, 10, 2, 1);
    x.fillStyle = '#8ab0a0';
    x.fillRect((frame * 5 + 6) % 16, 13, 1, 1);
  });
}

// Balsa/draga de garimpo (cenário)
function dredge() {
  const R = rng(44);
  return px(96, 64, x => {
    x.fillStyle = '#4a4040';
    for (let j = 6; j < 46; j++) {
      x.fillRect(18, j, 2, 1);
      x.fillRect(28, j, 2, 1);
      if (j % 8 === 0) x.fillRect(18, j, 12, 1);
      if (j % 8 < 4) x.fillRect(18 + (j % 8) * 3, j, 1, 1);
    }
    x.fillStyle = '#3a3434';
    for (let i = 0; i < 26; i++) x.fillRect(4 + i, 50 - Math.floor(i * 0.55), 3, 3);
    x.fillStyle = '#5a4a3a';
    x.fillRect(2, 44, 92, 12);
    x.fillStyle = '#3e3228';
    x.fillRect(4, 56, 88, 4);
    x.fillStyle = '#8a4a2a';
    for (let k = 0; k < 18; k++) x.fillRect(4 + Math.floor(R() * 86), 45 + Math.floor(R() * 10), 2 + Math.floor(R() * 3), 1);
    x.fillStyle = '#7a6a5a';
    x.fillRect(48, 22, 32, 22);
    x.fillStyle = '#5a4c40';
    x.fillRect(46, 20, 36, 3);
    x.fillStyle = '#26262c';
    x.fillRect(53, 27, 7, 6);
    x.fillRect(66, 27, 7, 6);
    x.fillStyle = '#3a3434';
    x.fillRect(70, 6, 6, 14);
    x.fillStyle = '#8a4a2a';
    x.fillRect(70, 6, 6, 2);
  });
}

function canoe() {
  return outlined(px(56, 16, x => {
    x.fillStyle = '#7a4a2a';
    for (let i = 0; i < 52; i++) {
      const d = Math.abs(i - 26) / 26;
      const top = 8 + Math.round(d * d * -5);
      x.fillRect(i + 2, top, 1, 14 - top - Math.round(d * 3));
    }
    x.fillStyle = '#a06a3a';
    x.fillRect(6, 8, 44, 1);
    x.fillStyle = '#c9a24a';
    x.fillRect(30, 0, 2, 12);
    x.fillRect(28, 10, 6, 3);
  }));
}

// Xapono: a grande casa comunal circular Yanomami, vista de lado com o pátio aberto no meio
function xapono() {
  const R = rng(12);
  const WD = 240, HT = 80;
  return px(WD, HT, x => {
    const wing = (x0, x1, innerRight) => {
      for (let i = x0; i < x1; i++) {
        const f = (i - x0) / (x1 - x0);
        const t = innerRight ? f : 1 - f;
        const top = Math.round(46 - t * 36);
        const bottom = Math.round(58 - t * 22);
        for (let j = top; j < bottom; j++) {
          const band = Math.floor((j - top) / 3) % 2;
          x.fillStyle = (i * 3 + j * 5) % 11 === 0 ? '#8a6a2c' : band ? '#c9a24a' : '#b48c3a';
          x.fillRect(i, j, 1, 1);
        }
        x.fillStyle = '#e0bc66';
        if ((i + 1) % 4 === 0) x.fillRect(i, top, 1, 1);
        x.fillStyle = '#6a4a22';
        x.fillRect(i, bottom, 1, 1);
        // sombra embaixo do telhado
        x.fillStyle = '#2a1e16';
        x.fillRect(i, bottom + 1, 1, HT - bottom - 1);
      }
      // esteios
      x.fillStyle = '#5e3d24';
      for (let i = x0 + 6; i < x1; i += 18) x.fillRect(i, 40, 2, HT - 40);
      // redes de dormir
      for (let i = x0 + 10; i < x1 - 12; i += 26) {
        x.fillStyle = ['#d8352a', '#c9a24a', '#e8dcc8'][Math.floor(R() * 3)];
        for (let k = 0; k < 14; k++) x.fillRect(i + k, 64 + Math.round(Math.sin((k / 13) * Math.PI) * 4), 1, 2);
      }
      // fogueira doméstica sob o telhado
      x.fillStyle = '#f39a1e';
      x.fillRect(Math.round((x0 + x1) / 2), 74, 3, 2);
    };
    wing(0, 90, true);
    wing(150, 240, false);
  });
}

function decoSprites() {
  const flower = (petal, center) => px(16, 16, x => {
    x.fillStyle = '#2e7d32';
    x.fillRect(7, 10, 1, 6);
    x.fillRect(5, 13, 2, 1);
    x.fillStyle = petal;
    x.fillRect(6, 8, 3, 3);
    x.fillRect(7, 7, 1, 5);
    x.fillRect(5, 9, 5, 1);
    x.fillStyle = center;
    x.fillRect(7, 9, 1, 1);
  });
  return {
    tuft: px(16, 16, x => {
      x.fillStyle = '#2e7d32';
      for (const [i, hh] of [[3, 4], [5, 6], [7, 3], [10, 5], [12, 4]]) x.fillRect(i, 16 - hh, 1, hh);
      x.fillStyle = '#5cc25a';
      for (const [i, hh] of [[4, 5], [6, 3], [11, 6]]) x.fillRect(i, 16 - hh, 1, hh);
    }),
    fern: px(16, 16, x => {
      x.fillStyle = '#2f8a3e';
      for (let k = 0; k < 6; k++) {
        x.fillRect(8 - k, 15 - k, 1, 1);
        x.fillRect(8 + k, 15 - k, 1, 1);
        x.fillRect(8, 15 - k * 2, 1, 2);
      }
      x.fillStyle = '#86d96a';
      x.fillRect(3, 10, 2, 1);
      x.fillRect(12, 10, 2, 1);
    }),
    flowerRed: flower('#e0302a', '#ffe066'),
    flowerYellow: flower('#f2c443', '#a0441a'),
    flowerPink: flower('#e86aa8', '#fff3a0'),
    stump: charredStump(),
  };
}

// Panorama de fundo (largura repetível) para o estado queimado e o verde
function panorama(layer, green) {
  const PW = 768, PH = 224;
  const R = rng(layer * 100 + (green ? 1 : 0));
  return px(PW, PH, x => {
    const ridge = i => {
      const t = (i / PW) * Math.PI * 2;
      if (layer === 0) return 118 + Math.sin(t * 2) * 12 + Math.sin(t * 5 + 1) * 6 + Math.sin(t * 9) * 2;
      return 158 + Math.sin(t * 3 + 2) * 8 + Math.sin(t * 7) * 4;
    };
    const base = layer === 0 ? (green ? '#3f7d5a' : '#6e4a50') : (green ? '#245a3a' : '#3e2e34');
    const light = layer === 0 ? (green ? '#559a6c' : '#83595c') : (green ? '#2f7048' : '#503c44');
    for (let i = 0; i < PW; i++) {
      const y = Math.floor(ridge(i));
      x.fillStyle = base;
      x.fillRect(i, y, 1, PH - y);
      x.fillStyle = light;
      x.fillRect(i, y, 1, 2);
    }
    const nTrees = layer === 0 ? 70 : 34;
    for (let k = 0; k < nTrees; k++) {
      const i = Math.floor((k + R() * 0.8) * (PW / nTrees));
      const y = Math.floor(ridge(i)) + 2;
      const hgt = (layer === 0 ? 10 : 22) + Math.floor(R() * (layer === 0 ? 10 : 22));
      if (green) {
        if (R() < 0.3) {
          // palmeira (açaí)
          x.fillStyle = base;
          x.fillRect(i, y - hgt, 1, hgt);
          x.fillStyle = light;
          for (let f = 0; f < 5; f++) {
            const dx = [-1, 1, -1, 1, 0][f], dy = [0, 0, 1, 1, -1][f];
            for (let s = 0; s < 6; s++) x.fillRect(i + dx * s, y - hgt + dy * Math.floor(s / 2) + (dy === -1 ? -s : 0), 1, 1);
          }
        } else {
          const rr = (layer === 0 ? 4 : 7) + Math.floor(R() * 4);
          x.fillStyle = base;
          x.fillRect(i, y - hgt + rr, 2, hgt - rr);
          disc(x, i, y - hgt + rr, rr, base);
          disc(x, i - 1, y - hgt + rr - 1, rr - 2, light);
        }
      } else {
        // tronco morto com galhos quebrados
        x.fillStyle = base;
        x.fillRect(i, y - hgt, layer === 0 ? 1 : 2, hgt);
        const br = 1 + Math.floor(R() * 3);
        for (let b = 0; b < br; b++) {
          const by = y - hgt + 3 + Math.floor(R() * hgt * 0.5);
          const dir = R() < 0.5 ? -1 : 1;
          const len = 2 + Math.floor(R() * (layer === 0 ? 3 : 6));
          for (let s = 0; s < len; s++) x.fillRect(i + dir * s, by - s, 1, 1);
        }
      }
    }
  });
}

function buildSprites() {
  const tiles = {};
  for (const green of [false, true]) {
    const key = green ? 'g' : 'b';
    tiles[key] = {
      top: [0, 1].map(v => groundTile(green, true, 10 + v + (green ? 50 : 0))),
      dirt: [0, 1].map(v => groundTile(green, false, 20 + v + (green ? 50 : 0))),
      log: [0, 1].map(v => logTile(green, 30 + v)),
    };
  }
  // Versões pontilhadas do verde para cada nível de recuperação
  const ditheredSet = arr => arr.map(img => Array.from({ length: DITHER_LEVELS + 1 }, (_, l) => ditherMask(img, l)));
  tiles.gd = { top: ditheredSet(tiles.g.top), dirt: ditheredSet(tiles.g.dirt), log: ditheredSet(tiles.g.log) };

  const animals = buildAnimals();
  return {
    hero: buildHero(),
    animals,
    cages: {
      arara: cageSprite(animals.arara[0][0]),
      macaco: cageSprite(animals.macaco[0][0]),
      preguica: cageSprite(animals.preguica[0][0]),
      tucano: cageSprite(animals.tucano[1][0]),
      onca: cageSprite(animals.onca[0][0]),
      anta: cageSprite(animals.anta[0][0]),
      broken: brokenCage(),
    },
    tiles,
    water: [0, 1, 2, 3].map(waterTile),
    fire: [1, 2, 3, 4].map(fireFrame),
    ember: [both(emberFrame(1)), both(emberFrame(2))],
    survivor: { wilted: survivorTree(false), bloomed: survivorTree(true) },
    sapling: [sapling(0), sapling(1), sapling(2)],
    nut: nutSprite(),
    heart: [heartSprite(false), heartSprite(true)],
    toxic: [0, 1, 2, 3].map(toxicTile),
    dredge: dredge(),
    canoe: canoe(),
    xapono: xapono(),
    people: buildPeople(),
    deco: decoSprites(),
    bg: {
      far: [panorama(0, false), panorama(0, true)],
      near: [panorama(1, false), panorama(1, true)],
    },
  };
}
