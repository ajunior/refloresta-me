'use strict';
// Coordenadas em tiles (16px). A linha 0 é o topo da tela; o chão "normal" fica na linha 11.
// Campos opcionais: pools (água com mercúrio), props (cenário)

const LEVEL1 = {
  name: 'Fase 1 — O Pasto Queimado',
  width: 168,
  height: 14,
  start: [2, 11],
  // [coluna inicial, coluna final, linha do topo do chão]
  ground: [
    [0, 35, 11],
    [39, 50, 10],
    [54, 76, 11],
    [77, 90, 6],
    [91, 96, 11],
    [101, 139, 11],
    [140, 143, 10],
    [144, 147, 9],
    [148, 167, 11],
  ],
  // igarapés: rebaixam o chão em 1 tile e enchem de água
  water: [[16, 19], [45, 46], [66, 69], [92, 93], [115, 118], [136, 137], [164, 167]],
  // troncos (plataformas atravessáveis por baixo): [coluna, linha, comprimento]
  logs: [[47, 7, 3], [98, 9, 2], [105, 8, 3], [126, 8, 5]],
  fires: [10, 34, 42, 43, 48, 56, 57, 60, 80, 82, 85, 103, 104, 108, 109, 112, 123, 124, 132, 133, 145, 151, 152, 155],
  survivors: [32, 94, 138],
  cages: [
    { col: 58, animal: 'arara' },
    { col: 88, animal: 'macaco' },
    { col: 128, row: 8, animal: 'preguica' },
  ],
  // castanhas (cada uma vale 3 sementes); row opcional = linha onde o item flutua
  pickups: [
    { col: 22 },
    { col: 48, row: 6 },
    { col: 72, respawn: true },
    { col: 106, row: 7 },
    { col: 135 },
  ],
  embers: [
    { col: 84, range: [78, 90] },
    { col: 110, range: [101, 114] },
    { col: 158, range: [148, 160] },
  ],
  hints: [
    { col: 0, text: 'SETAS: andar   ·   ESPAÇO ou Z: pular' },
    { col: 4, text: 'Fogo! Apague com água ou pule por cima', fact: 'fogo' },
    { col: 6, text: 'Segure X para jogar água no fogo' },
    { col: 13, text: 'Entre no igarapé para encher a cabaça' },
    { col: 15, fact: 'igarape' },
    { col: 21, text: 'Pegue a castanha e aperte C para semear o chão queimado' },
    { col: 28, text: 'Regue a árvore sobrevivente: ela vira checkpoint' },
    { col: 40, text: 'Segure CIMA junto com X para molhar mais alto' },
    { col: 54, text: 'Toque na gaiola para libertar o animal' },
    { col: 70, text: 'Paredão! Plante uma árvore perto dele e suba pela copa' },
    { col: 148, text: 'A canoa está logo ali!' },
  ],
  goal: 162,
  goalType: 'canoe',
  doneText: 'Urihi pega a canoa e segue pelo rio...',
  stars: [0.3, 0.55, 0.8],
};

const LEVEL2 = {
  name: 'Fase 2 — O Rio do Garimpo',
  width: 200,
  height: 14,
  start: [1, 11],
  ground: [
    [0, 29, 11],
    [34, 94, 11],
    [95, 110, 5],
    [111, 140, 11],
    [144, 199, 11],
  ],
  water: [[5, 6], [27, 28], [42, 43], [62, 63], [80, 81], [103, 104], [119, 120], [134, 136]],
  pools: [[15, 17], [51, 55], [69, 71], [84, 86], [147, 149]],
  logs: [[31, 9, 2], [51, 8, 5], [89, 9, 2], [92, 7, 2], [142, 9, 1]],
  props: [{ type: 'dredge', col: 48 }, { type: 'dredge', col: 143 }],
  fires: [9, 12, 22, 25, 36, 38, 44, 45, 60, 61, 64, 74, 75, 78, 99, 101, 106, 114, 115, 121, 122, 126, 130, 131, 152, 153, 158, 161],
  survivors: [40, 77, 124],
  cages: [
    { col: 47, animal: 'tucano' },
    { col: 66, animal: 'anta' },
    { col: 108, animal: 'onca' },
  ],
  pickups: [
    { col: 3 },
    { col: 20, respawn: true },
    { col: 52, row: 7 },
    { col: 73 },
    { col: 112 },
    { col: 128 },
    { col: 145 },
  ],
  embers: [
    { col: 42, range: [34, 49] },
    { col: 76, range: [72, 83] },
    { col: 98, range: [96, 110] },
    { col: 125, range: [112, 132] },
    { col: 157, range: [150, 165] },
  ],
  hints: [
    { col: 0, text: 'Siga o rio até o xapono, a casa do seu povo' },
    { col: 3, text: 'Encha a cabaça no igarapé limpo' },
    { col: 11, text: 'Água com mercúrio do garimpo! Não encoste.', fact: 'garimpo' },
    { col: 13, text: 'Plante árvores na beira da água suja para limpá-la' },
    { col: 29, text: 'Cava do garimpo! Pule pelos troncos' },
    { col: 86, text: 'Suba pelos troncos' },
    { col: 141, text: 'Mais uma cava!' },
    { col: 165, text: 'O xapono está logo ali!' },
  ],
  goal: 174,
  goalType: 'xapono',
  ending: true,
  stars: [0.3, 0.55, 0.8],
};

const LEVELS = [LEVEL1, LEVEL2];
