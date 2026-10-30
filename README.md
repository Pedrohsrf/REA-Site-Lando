# landonorris.com — reconstrução funcional

Aplicação web que reproduz as funcionalidades de https://landonorris.com, construída a partir da análise
do site original (snapshot de 29/10/2026). O conteúdo do CMS foi exportado para JSON e as regras de negócio
do JavaScript original foram reimplementadas e testadas.

## Requisitos

- Node.js 20.11 ou superior (testado com 24.22)
- Opcional, só para reextrair o conteúdo: Python 3.10+ com `beautifulsoup4`
- Opcional, só para os testes de equivalência no navegador: Google Chrome

## Instalação e execução

```bash
npm install          # gsap 3.13, lenis, @rive-app/canvas-lite 2.26.4, three r174 (mesmas versões do original)
npm start            # http://localhost:3000
```

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `3000` | Porta HTTP |
| `NOW` | data atual | Fixa o "hoje" usado nas regras de calendário (ex.: `NOW=2026-10-29T12:00:00`) |
| `NODE_ENV` | — | Em `production` os JSON são lidos uma vez; fora dela, a cada requisição (edição ao vivo) |

### Modos de renderização

| Modo | Como iniciar | O que serve |
|---|---|---|
| **original** (padrão) | `npm start` | As páginas Webflow, o CSS, o bundle OFF+BRAND (`lando-by-OFF+BRAND.05.js`), as animações Rive e as cenas WebGL do site oficial, todos espelhados em `public/original/` e `original/pages/`. As animações são **idênticas** ao landonorris.com. Não há nenhuma requisição aos CDNs originais e o analytics (Google Tag) foi removido. |
| **rebuild** | `npm run start:rebuild` | As páginas geradas por `src/render.mjs` a partir de `data/*.json`, com o front-end reescrito (`public/js`, `public/css`) |

Nos dois modos, a API JSON (`/api/*`) e as regras de negócio de `public/js/lib/rules.mjs` funcionam igual.

Para atualizar o modo original com o que estiver publicado no site oficial (equivalente a um novo "publish" do Webflow):

```bash
npm run refresh:original   # baixa as páginas de novo, espelha assets novos e reescreve as URLs
npm run extract            # opcional: atualiza também data/*.json a partir das páginas baixadas
```

O modo original reutiliza o código e os assets da agência OFF+BRAND e o CSS gerado pelo Webflow. Confirme que a
autorização do projeto cobre esse uso antes de publicar.

Outros comandos:

```bash
npm run dev          # servidor com reinício automático
npm test             # 40 testes: regras, rotas/API, equivalência com o HTML original
npm run build        # exporta o site estático para dist/ (hospedagem sem Node)
npm run extract      # regera data/*.json a partir de scripts/source-snapshot/*.html
npm run mirror       # baixa imagens e fontes para public/assets e regera data/asset-map.json
node scripts/e2e-compare.mjs http://localhost:3000   # compara cenários com o original (Chrome em :9222)
```

Para os testes no navegador, abra um Chrome separado:

```bash
chrome --remote-debugging-port=9222 --user-data-dir=<pasta-temporaria>
```

## Estrutura

```
server.mjs                 servidor HTTP (Node puro): páginas, estáticos, /vendor, API JSON
src/data.mjs               repositório de conteúdo: carrega data/*.json, mapeia imagens locais, estado da temporada
src/render.mjs             templates de todas as rotas (mesmos contratos data-* do original)
public/js/lib/rules.mjs    regras de negócio puras (compartilhadas entre servidor, navegador e testes)
public/js/app.mjs          comportamento no navegador (calendário, contagem regressiva, menu, transições, etc.)
public/css/site.css        estilos com os tokens de design do original
public/assets/             imagens, fontes e texturas espelhadas
data/                      exportação do CMS (corridas, histórico, capacetes, galerias, textos)
scripts/                   extração, espelhamento, build estático, screenshots e comparação E2E
tests/                     node:test
docs/                      inventário, regras, relatório de análise, testes, pendências
```

## API JSON (somente leitura)

| Rota | Conteúdo |
|---|---|
| `GET /api/season` | rodada atual, posição no campeonato, idade, corrida anterior e próxima |
| `GET /api/races` | 24 corridas da temporada 2026 com sessões e resultados |
| `GET /api/history` | resultados por temporada (2019–2025) |
| `GET /api/highlights` | destaques de resultados |
| `GET /api/helmets` | Hall of Fame de capacetes |

## Atualizar conteúdo

O original usa o CMS do Webflow. Aqui, o equivalente é editar `data/*.json`; o servidor recarrega os dados a
cada requisição fora de produção. Para resultados de uma corrida, preencha em `data/races.json` os campos
`*TimeResult` / `*TimePos`, `finish` e `fastestLap`. A classificação passado/futuro é calculada pela data
(`dateActual`), não precisa ser marcada à mão.

## Documentação

- [docs/INVENTARIO.md](docs/INVENTARIO.md): telas e funcionalidades
- [docs/REGRAS-DE-NEGOCIO.md](docs/REGRAS-DE-NEGOCIO.md)
- [docs/RELATORIO-ANALISE.md](docs/RELATORIO-ANALISE.md): análise com REA e Ghidra
- [docs/TESTES.md](docs/TESTES.md): resultados de equivalência
- [docs/PENDENCIAS.md](docs/PENDENCIAS.md): itens não reproduzidos ou dependentes de terceiros
