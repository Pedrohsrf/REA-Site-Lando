# Resultados dos testes de equivalência

> Atualização: o modo **original** (padrão) foi comparado com o landonorris.com por capturas lado a lado em 1440×900
> e 390×844 (`docs/screenshots/comparacao-*.png`) e pelos 13 cenários E2E. Resultado: **13 de 13 idênticos**,
> zero erros de console e zero requisições externas.

Data: 29/10/2026. Chrome 156 em `:9222` (perfil isolado). Reconstrução executada com `NOW=2026-10-29T12:00:00`.

## 1. Testes automatizados (`npm test`): 46 de 46 aprovados

| Arquivo | Testes | Cobertura |
|---|---|---|
| `tests/rules.test.mjs` | 17 | Datas locais e UTC, passado/futuro, ordenação, corrida atual, navegação circular, posição, rodada, ordinal, sprint, células de resultado, rótulo "Schedule", troféus, anterior/próxima, idade, índice da prévia |
| `tests/server.test.mjs` | 13 | Status das 8 rotas (igual ao original, incluindo o 404 de `/partnerships`), barra final, tipos MIME, bloqueio de path traversal, métodos HTTP, API `/api/*`, próxima e anterior corrida, contagens das listas, visualizador inicial, cenário pós-temporada (2027) |
| `tests/original.test.mjs` | 6 | Modo original: status das rotas, nenhuma referência aos CDNs originais nem a analytics, todos os assets referenciados existem localmente, bundle apontando para Rive/WebGL/WASM locais, tipos MIME e API JSON |
| `tests/equivalence.test.mjs` | 10 | Comparação com o HTML original salvo: todos os links internos e externos, as 24 corridas com seus campos, frases-chave de cada página, contagens das coleções, termos de uso integrais, embed da política e imagens servidas localmente |

## 2. Comparação em tempo de execução: original × reconstrução

Script: `scripts/e2e-compare.mjs`. Os mesmos cenários foram executados nos dois sites, e o resultado bruto está em
`docs/e2e-results.txt` e `docs/e2e-results.json`.

| Cenário | Valor observado (original = reconstrução) | Resultado |
|---|---|---|
| Visualizador: corrida inicial | México, 30-01 Nov, 71 voltas, Practice 2/3, Race 1 Nov 20:00, "Schedule", sem resultados | **Igual** |
| Visualizador: "previous" ×1 (corrida passada) | Austin, a corrida mostra 5th e 1:35:47.171, rótulos "Result" e "Time/Gap" visíveis | **Igual** |
| Visualizador: "previous" ×2 (sprint) | Singapura, "Sprint Quali" / "Sprint", 4th, 1:42:41.291 | **Igual** |
| Visualizador: "next" ×5 a partir do México (volta ao início) | Melbourne, 06-08 Mar, 5th, 1:23:58.542 | **Igual** |
| Calendário: corridas passadas e total | 19 / 24 | **Igual** |
| Histórico: abrir o 1º e depois o 2º item | `aria-expanded` = false, true, false; 1 aberto | **Igual** |
| Contagem regressiva | alvo 1/11/2026 20:00, avança a cada segundo, 4 dígitos | **Igual** |
| Formatação de posição e rodada | sufixo em markup separado; rodadas "19", "20", "21" | **Igual** |
| Lista "upcoming" (On Track) | mexico-city, sao-paulo, las-vegas, lusail, yas-marina | **Igual** |
| Home: capacetes e menu | 16 capacetes; menu /, /on-track, /off-track, /calendar | **Igual** |
| Menu: abrir e fechar | `aria-expanded` true e depois false, rótulo "Open menu" | **Igual** |
| Navegação SPA para /off-track | URL /off-track, mesmo documento, página off-track | **Igual** |
| 404: seletor de estilos | 4 botões; o 3º ativo é "grid"; "Page Not Found" | **Igual** |

**13 de 13 cenários com resultado idêntico.**

## 3. Verificação visual

Capturas em `docs/screenshots/`:
- `original-home.png`: hero do original (evidência REA `ev_5586e889…`)
- `rebuild-home.png`, `rebuild-on-track.png`, `rebuild-calendar.png` e `rebuild-off-track-legal-404-mobile.png`: reconstrução em 1440×900 e 390×844

Nenhum erro de console na reconstrução. A única entrada é o 404 esperado de `/partnerships`, igual ao do original.

## 4. Diferenças registradas

| Área | Diferença | Impacto |
|---|---|---|
| Animações Rive e WebGL | Substituídas por CSS, SVG e Canvas 2D (PENDENCIAS P1 a P5) | Visual. Dados e comportamento são equivalentes. |
| Corrida anterior/próxima, rodada e idade | No original são campos fixos do CMS. Aqui são calculados pela data. | Mesmo resultado hoje. Na reconstrução eles se atualizam sozinhos. |
| Revelação de texto | Por bloco, não por linha ou caractere | Visual |

## 5. Problemas encontrados e corrigidos durante a validação

1. Textos revelados com `clip-path` nunca disparavam o IntersectionObserver, porque o Chrome considera o recorte. A revelação passou a usar opacidade e deslocamento.
2. O tema do nav era calculado enquanto o loader cobria a página. Agora o loader é ignorado e o tema é recalculado ao terminar.
3. O frame decorativo do capacete ocupava uma linha do grid e escondia a imagem. Agora ele tem posição absoluta.
4. Scripts do conteúdo trocado na navegação SPA não rodavam (embed iubenda). Foi adicionada a reexecução de `data-taxi-reload`.

## 6. Como repetir

```bash
npm test
NOW=2026-10-29T12:00:00 PORT=3100 npm start
node scripts/e2e-compare.mjs http://localhost:3100      # Chrome com --remote-debugging-port=9222
node scripts/cdp-shoot.mjs http://localhost:3100/calendar out 1440 900 0,0.5,1
```
