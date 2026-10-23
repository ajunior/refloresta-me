# Refloresta.me

Jogo educativo gratuito para crianças sobre a Amazônia. Urihi, um menino Yanomami, apaga o fogo, planta sementes, liberta animais e limpa os rios até voltar ao xapono.

Jogue em **https://refloresta.me**.

Feito por [Adjamilton Junior](https://www.linkedin.com/in/a-jr/).

## Rodar localmente

É só HTML e JavaScript, sem instalação nem build:

```sh
python3 -m http.server
```

Depois abra http://localhost:8000 (página inicial) ou http://localhost:8000/jogar/ (o jogo).

## Estrutura

- `index.html`: página inicial
- `jogar/index.html`: página do jogo
- `src/`: código do jogo (motor, áudio, fases, sprites e textos)
- `site/img/`, `assets/`: imagens da página e ícones

## Licenças

Este projeto usa duas licenças: uma para o código e outra para a arte e os textos.

**Código: [MIT](LICENSE)**

- `src/game.js`
- `src/audio.js`
- `src/levels.js`
- o HTML e o CSS de `index.html` e `jogar/index.html`

**Arte, história e textos: [CC BY-NC-SA 4.0](LICENSES/CC-BY-NC-SA-4.0.txt)**

- `src/sprites.js`: os desenhos do jogo, escritos como mapas de pixels
- `src/story.js`: a história e os cartões do Caderno da Floresta
- os textos da página inicial
- as imagens em `site/img/` e `assets/`
- a música e os efeitos sonoros: as melodias e sequências definidas em `src/audio.js`

Na prática, você pode usar, adaptar e compartilhar a arte e os textos, por exemplo em sala de aula, desde que:

- dê o crédito a Refloresta.me;
- não use para fins comerciais;
- compartilhe as versões modificadas com a mesma licença.

O código pode ser reaproveitado livremente, inclusive em outros projetos, desde que o aviso da licença MIT seja mantido.

### O que as licenças não cobrem

- **O nome e a identidade "Refloresta.me":** versões modificadas devem usar outro nome.
- **O povo Yanomami:** o personagem Urihi e os elementos da cultura Yanomami no jogo (como o xapono) representam um povo real. As licenças não autorizam ninguém a falar em nome dos Yanomami nem a usar essa representação de forma que os desrespeite.

Copyright (c) 2026 Refloresta.me
