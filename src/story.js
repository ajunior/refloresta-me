'use strict';
// Textos da história e do "Caderno da Floresta", em linguagem simples para crianças.

const HERO_NAME = 'Urihi';

// Cada slide tem uma cena ilustrada (desenhada em game.js) e até 3 linhas curtas
const INTRO = [
  {
    scene: 'forest',
    lines: [
      'A Amazônia é a maior floresta tropical do mundo.',
      'A maior parte dela fica aqui, no Brasil.',
    ],
  },
  {
    scene: 'life',
    lines: [
      'Lá vivem onças, araras, macacos, preguiças',
      'e milhares de tipos de árvores e plantas.',
      'E também muitos povos indígenas, como os Yanomami.',
    ],
  },
  {
    scene: 'rain',
    lines: [
      'As árvores soltam água no ar. Essa água vira nuvem',
      'e o vento leva a chuva para o Brasil inteiro.',
      'São os "rios voadores"!',
    ],
  },
  {
    scene: 'cool',
    lines: [
      'A floresta também deixa o planeta mais fresquinho',
      'e guarda o ar que a gente respira limpo.',
    ],
  },
  {
    scene: 'fire',
    lines: [
      'Mas pessoas derrubaram e queimaram a floresta',
      'para criar gado. E o garimpo ilegal cava a terra',
      'atrás de ouro e envenena os rios com mercúrio.',
    ],
  },
  {
    scene: 'sad',
    lines: [
      'Sem árvores, os animais perdem a casa,',
      'os rios ficam sujos e a chuva diminui.',
    ],
  },
  {
    scene: 'hero',
    lines: [
      `${HERO_NAME} é um menino Yanomami.`,
      'Ele decidiu trazer a floresta de volta.',
      'Você vai ajudar?',
    ],
  },
];

// Cartões do Caderno da Floresta: aparecem na primeira vez que algo acontece
const FACTS = {
  semente: {
    title: 'Castanha-do-pará',
    icon: 'nut',
    lines: [
      'A castanheira pode viver mais de 500 anos',
      'e ficar alta como um prédio de 15 andares.',
      'Cada semente é uma floresta esperando para nascer!',
    ],
  },
  fogo: {
    title: 'Fogo na floresta',
    icon: 'fire',
    lines: [
      'A Amazônia é úmida e quase nunca pega fogo sozinha.',
      'A maioria dos incêndios é provocada por pessoas',
      'que querem abrir espaço para o pasto.',
    ],
  },
  igarape: {
    title: 'Igarapé',
    icon: 'water',
    lines: [
      'Igarapé é um riozinho no meio da floresta.',
      'O nome vem do tupi e quer dizer "caminho de canoa".',
    ],
  },
  sobrevivente: {
    title: 'Árvores mães',
    icon: 'tree',
    lines: [
      'Árvores grandes que sobrevivem ao fogo dão sombra',
      'e espalham sementes. Elas ajudam a floresta toda',
      'a nascer de novo à sua volta.',
    ],
  },
  muda: {
    title: 'A muda vira árvore',
    icon: 'sapling',
    lines: [
      'As raízes seguram a terra, as folhas fazem sombra',
      'e as árvores puxam água do chão para o céu.',
      'Plante muitas: a floresta volta mais rápido!',
    ],
  },
  chuva: {
    title: 'Rios voadores',
    icon: 'rain',
    lines: [
      'Uma árvore grande solta centenas de litros de água',
      'no ar por dia. Floresta de volta = chuva de volta!',
      'A chuva ajuda a apagar o fogo e encher sua cabaça.',
    ],
  },
  arara: {
    title: 'Arara-vermelha',
    icon: 'arara',
    lines: [
      'Araras voam longe carregando frutos e sementes.',
      'Onde elas deixam cair, uma árvore pode nascer.',
      'PODER: a arara vai plantar sementes por você!',
    ],
  },
  macaco: {
    title: 'Macaco',
    icon: 'macaco',
    lines: [
      'Macacos comem frutas e espalham as sementes',
      'pela floresta... no cocô! É assim que plantam.',
      'PODER: o macaco vai achar sementes para você!',
    ],
  },
  preguica: {
    title: 'Preguiça',
    icon: 'preguica',
    lines: [
      'A preguiça desce da árvore mais ou menos uma vez',
      'por semana, só para fazer cocô. E ele vira adubo!',
      'PODER: suas mudas crescem mais rápido e mais fortes.',
    ],
  },
  tucano: {
    title: 'Tucano',
    icon: 'tucano',
    lines: [
      'O tucano engole frutinhas inteiras e solta',
      'as sementes longe dali, ajudando a floresta a crescer.',
      'PODER: o tucano também planta sementes por você!',
    ],
  },
  anta: {
    title: 'Anta',
    icon: 'anta',
    lines: [
      'A anta é o maior mamífero terrestre do Brasil.',
      'É chamada de "jardineira da floresta" porque',
      'espalha muitas sementes. PODER: acha sementes!',
    ],
  },
  onca: {
    title: 'Onça-pintada',
    icon: 'onca',
    lines: [
      'É o maior felino das Américas. Uma floresta com onça',
      'é uma floresta saudável e equilibrada.',
      'PODER: as brasas fogem de medo da onça!',
    ],
  },
  garimpo: {
    title: 'Garimpo ilegal',
    icon: 'toxic',
    lines: [
      'O garimpo usa mercúrio para achar ouro. O mercúrio',
      'é um veneno: vai para os rios, para os peixes',
      'e faz as pessoas ficarem doentes. Não encoste!',
    ],
  },
  mataciliar: {
    title: 'Mata ciliar',
    icon: 'water',
    lines: [
      'As árvores na beira do rio são como os cílios',
      'que protegem os olhos: seguram a terra e',
      'ajudam a água a ficar limpa de novo.',
    ],
  },
};

const OUTRO = [
  {
    scene: 'party',
    lines: [
      `${HERO_NAME} e seu povo comemoram: a floresta está voltando!`,
      'Mas na vida real, ela também precisa de você.',
    ],
  },
  {
    scene: 'forest',
    lines: [
      'Aprenda sobre a floresta e os povos indígenas.',
      'Cuide das árvores, da água e dos animais.',
      'E conte para todo mundo o que você aprendeu!',
    ],
  },
  {
    scene: 'title',
    lines: ['Obrigado por jogar Refloresta.me!'],
  },
];
