# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Consumidores finais em momento de compra, avaliando um produto em loja fisica ou online e querendo decidir com rapidez se vale comprar agora, salvar para depois ou continuar comparando.

## Product Purpose

O produto permite identificar itens por foto ou busca manual, reunir ofertas relevantes e organizar esse contexto em favoritos e historico para ajudar o usuario a comprar melhor. O sucesso do produto e reduzir friccao entre descobrir um produto, comparar precos e retomar a decisao depois.

## Positioning

O diferencial do produto e combinar dois caminhos de entrada igualmente importantes, foto e texto, com continuidade de uso por meio de historico e favoritos. Ele nao e apenas um buscador de preco nem apenas um scanner: ele preserva contexto para comparacao e retorno futuro.

## Operating Context

- Uso rapido em contexto de compra, inclusive durante a avaliacao de um produto no ponto de venda.
- Fluxo principal por camera para capturar o produto e buscar ofertas automaticamente.
- Fluxo alternativo por busca manual quando o usuario ja sabe o nome do item.
- Revisita posterior por historico e favoritos para retomar comparacoes e acompanhar oportunidades.
- Autenticacao obrigatoria para acesso persistente por login social ou e-mail/senha com Clerk.

## Capabilities and Constraints

- Reconhece produtos por imagem e tambem aceita busca manual por texto.
- Exibe ofertas organizadas para comparacao e destaca a melhor opcao disponivel.
- Permite favoritar produtos e revisar buscas anteriores pelo historico.
- O produto atual existe em um app Expo/React Native com autenticacao Clerk e suporte a iOS e Android.
- A plataforma deve ser tratada como `adaptive`, com espaco para ajustes deliberados entre iOS e Android quando isso melhorar a experiencia.

## Brand Commitments

- Nome atual de trabalho: Comparador / comparador-precos.
- A experiencia deve preservar uma direcao premium, limpa, comercial e confiavel, adequada a um app utilitario de comparacao de precos.
- O produto deve manter os fluxos de foto, busca manual, favoritos, historico e autenticacao Clerk como compromissos centrais.

## Evidence on Hand

- Configuracao do app em `app.json`.
- Fluxos principais em `src/app/` e `src/components/`.
- Autenticacao em `src/components/auth/auth-screen.tsx`.
- Controle de entrada e onboarding em `src/components/onboarding/app-entry-gate.tsx`.
- Busca e persistencia local/remota em `src/services/product-analysis/`.
- Assets reais ja presentes em `assets/images/` e `assets/icons/`, incluindo `assets/images/Intro1.jpg` e `assets/images/Intro2.png`.
- Nao ha, no repositorio atual, prova documentada de depoimentos, estudos de caso, benchmarking publico, claims de economia quantificada ou promessas comerciais que possam ser inventadas depois.

## Product Principles

- Diminuir o tempo entre ver um produto e tomar uma decisao de compra informada.
- Permitir que o usuario entre no fluxo pelo canal mais conveniente no momento: foto ou texto.
- Preservar contexto util, nao apenas resultado instantaneo, por meio de historico e favoritos.
- Priorizar clareza, confianca e velocidade percebida em vez de excesso de interface.
- Tratar autenticacao e sincronizacao como parte da continuidade da experiencia, nao como detalhe tecnico isolado.

## Accessibility & Inclusion

- O produto depende de permissao de camera, entao deve sempre oferecer um caminho alternativo viavel por busca manual.
- A experiencia de autenticacao precisa continuar compreensivel para quem prefere login social e para quem depende de e-mail e senha.
- Como app utilitario de decisao rapida, a interface deve favorecer leitura imediata, estados claros e acoes explicitamente acionaveis.
