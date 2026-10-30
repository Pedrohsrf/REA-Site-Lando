# Relatório da análise técnica (REA, Chrome DevTools e Ghidra)

Data: 29/10/2026. Alvo: https://landonorris.com (análise autorizada pela equipe do piloto, conforme informado pelo solicitante).
Todas as interações foram de leitura: nenhum formulário foi enviado, não houve compras e nenhum dado foi alterado.

## 1. Ambiente

| Item | Valor |
|---|---|
| Navegador | Google Chrome 156.0.8078.74, instância separada |
| Depuração | `--remote-debugging-port=9222` |
| Perfil | `--user-data-dir=<scratchpad>/chrome-profile` (exclusivo e descartável) |
| REA | Servidor MCP `rea` (ferramentas `inspect_web_page`, `capture_web_screenshot`, `analyze_javascript_application`) |
| Ghidra | Não utilizado (justificativa na seção 6) |

## 2. Recursos examinados

| Recurso | Tamanho | Como |
|---|---|---|
| HTML de `/`, `/on-track`, `/off-track`, `/calendar`, `/legal/*`, `/partnerships` (404) | 75 KB a 873 KB | Download direto e captura REA |
| `sitemap.xml` (404) e `robots.txt` (vazio) | — | Download |
| CSS `lando-offbrand.shared.6e09a725a.css` | 188 KB | Download, extração de tokens |
| JS **ativo** `lando.itsoffbrand.io/dev-js/lando-by-OFF+BRAND.05.js` | 1,32 MB | REA (análise estática) e leitura dirigida |
| JS Webflow `lando-offbrand.schunk…js` e `…751e0867…js` | 36 KB e 1 KB | REA |
| JS inativos (comentados no HTML): `lando.OFF+BRAND.js`, `…gold-android-fix-03.js`, `assets…/lando-by-OFF+BRAND.js`, `transitions-rive-isolate.js` | 0,1 a 1,46 MB | Baixados e identificados como inativos |
| Texturas WebGL (`lando.itsoffbrand.io/gl/textures/...`) | — | Download de retrato, máscara e textura do 404 |
| Animações Rive (`lando.itsoffbrand.io/rive/*.riv`) | — | Só a existência foi confirmada (HTTP 200) |
| 230 imagens do CMS e 2 fontes (Mona Sans Variable, Brier Bold) | 12 MB | Espelhadas localmente |

## 3. Evidências do REA

| Evidence ID | Operação | Resultado |
|---|---|---|
| `ev_67404aaa4104af34826202d5d728016240cabefaea17ff8af846080f0dd60033` | `inspect_web_page` na home (alvo `A320C457…`) | DOM, acessibilidade, 5 scripts da origem principal, armazenamento sem chaves da aplicação. A captura ficou limitada à origem `landonorris.com`, porque os scripts do CDN pertencem a outra origem. |
| `ev_5586e8894953d56e0f753ce50006c1a7566fec6ace20740d9b18f638b761a2b6` | `capture_web_screenshot` | Hero com retrato WebGL e capacete revelado, "Next Race Mexico GP" e "tap to lock" (viewport de 844×917) |
| `ev_3bfa777d1a2945c7095f0381c725fa370b81f7966f3caff2543936f0797beb82` (resumo `ev_4ee0e66c…`) | `analyze_javascript_application` nos 3 bundles ativos | 3 arquivos, 352 784 nós AST, 10 módulos, 43 achados e nenhuma falha de parse. Grafo semântico **parcial**: o analisador esgotou o heap no bundle de 1,3 MB, então as relações de fluxo de dados ficaram incompletas. |

**Limitações declaradas pelo REA:** a observação é passiva, sem cliques. Rede e console só aparecem a partir do momento
em que o REA se conectou. A análise estática não comprova execução. Por isso, as regras foram confirmadas depois em
tempo de execução (seção 5).

## 4. Achados técnicos (fatos confirmados)

**Plataforma**
- Webflow, com site `67b5a02dc5d338960b17a7e9`, publicado em 13/09/2026, e CMS de coleções (corridas, capacetes, destaques e histórico).

**Código customizado**
- Feito pela agência OFF+BRAND e servido de `lando.itsoffbrand.io`, empacotado com esbuild/bun.

**Bibliotecas no bundle**
- GSAP com ScrollTrigger e MotionPathPlugin, Lenis, Taxi.js e Rive (runtime WASM embutido em base64).
- Three.js, com decoders Draco e KTX2/Basis, e dat.GUI.
- Carregamento dinâmico do player Vimeo.

**WebGL (`window.landoGL`)**
- Cenas: `head` (retrato com capacete), `helmet-scroll`, `tracks` (modelos 3D dos circuitos `tracks-06-test.glb`), `notFoundScene` (variantes Lime, Dark, Grid e Google) e `disco`.
- Fontes MSDF.
- Sem WebGL 2, o site adiciona a classe `gl-fallback` ao `<html>`.

**Rive**
- Arquivos `page-transition`, `btn-ui` (setas e hambúrguer), `circuits` (traçado de cada circuito, input `track`), `reef` (capacetes), `signature`, `phrases` e `mob-landscape`.

**Rede da aplicação**
- O único `fetch` próprio é o do Taxi.js: GET da mesma origem com o cabeçalho `X-Requested-With: Taxi`.
- **Não há API de backend própria.** Todo o conteúdo vem renderizado no HTML pelo Webflow.

**Armazenamento**
- `localStorage` aparece apenas no dat.GUI (debug).
- Nenhum cookie ou chave de aplicação foi observado.

**Integrações**
- Ativas: Vimeo (vídeos sociais) e iubenda (embed da política de privacidade).
- Comentadas, portanto inativas: Klaviyo e o banner de cookies iubenda.
- Links externos: store.landonorris.com, landonorris.store e as redes sociais.

**Regras de negócio**
- Documentadas em REGRAS-DE-NEGOCIO.md, com as funções de origem (`j$`, `S$`, `B_`, `E_`, `S_`, `T$`, `ZZ`, `T_` e `z$`).

**Defeitos do original encontrados**
- O rótulo "Schedule"/"Results" não muda (R6).
- O link para `/partnerships` leva a um 404.
- Há anomalias de rodada no CMS.
- O countdown usa UTC embora a página diga "*uk time".

## 5. Validação em tempo de execução

Os mesmos cenários foram executados no original e na reconstrução pelo Chrome em `:9222`
(`scripts/e2e-compare.mjs`). Os resultados estão em TESTES.md.

## 6. Ghidra

O Ghidra **não foi aplicado**:
- O sistema não distribui executáveis nem bibliotecas nativas. Tudo é HTML, CSS, JavaScript e recursos.
- Os únicos binários compilados são módulos WebAssembly de **bibliotecas públicas de código aberto**: o runtime do Rive (`@rive-app/canvas`) e os decoders Draco e Basis.
- Esses módulos não contêm lógica de negócio do site.
- Descompilá-los não acrescentaria nada ao inventário e só reproduziria o código-fonte já disponível publicamente.

O Ghidra não analisa uma URL. Os binários relevantes (`.glb` e `.riv`) são arquivos de **dados** (modelos e animações), não código.

## 7. O que não foi possível examinar (hipóteses e limites)

- **Backend e CMS do Webflow:** não estão acessíveis pelo navegador. Os campos e coleções foram inferidos pelos atributos `data-cal-list` e pelo HTML gerado.
- **Painel da loja** (Shopify em store.landonorris.com, landonorris.store): é um sistema separado e ficou fora do escopo. Só os links foram mantidos.
- **Conteúdo dos arquivos Rive e GLB:** é binário proprietário da agência e não foi reproduzido (ver PENDENCIAS.md).
- **Comportamento exato do botão "Load Norris":** o código só mostra a cortina e o esmaecimento do botão. A sequência exata do primeiro carregamento é uma **hipótese**.
