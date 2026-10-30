# Inventário de telas e funcionalidades

Fonte: inspeção de https://landonorris.com em 29/10/2026 (Chrome com depuração remota na porta 9222, perfil
isolado), HTML das 7 rotas, CSS e o bundle ativo `lando-by-OFF+BRAND.05.js`.

Legenda da situação:
- **Verificado**: observado no original e reproduzido. O teste ou a comparação E2E confirma a equivalência.
- **Aproximado**: mesma função, mas com implementação visual diferente (ver PENDENCIAS.md).
- **Externo**: depende de um serviço de terceiros e foi mantida a mesma integração.
- **Inativo no original**: está presente no código, mas desligado no site.

## Rotas

| Rota | Finalidade | Status HTTP (original = reconstrução) | Situação |
|---|---|---|---|
| `/` | Home | 200 | Verificado |
| `/on-track` | Carreira, resultados e calendário resumido | 200 | Verificado |
| `/off-track` | Projetos pessoais e campanhas | 200 | Verificado |
| `/calendar` | Calendário 2026, visualizador de circuitos, histórico | 200 | Verificado |
| `/legal/terms-conditions` | Termos de uso | 200 | Verificado (texto integral) |
| `/legal/privacy-policy` | Política de privacidade (embed iubenda) | 200 | Externo |
| `/partnerships` | Linkada na home ("view partnerships"), mas inexistente | **404** nos dois | Verificado (comportamento reproduzido) |
| qualquer outra | Página 404 "Veered off track" | 404 | Verificado |

Não há `sitemap.xml` (retorna 404), `robots.txt` (vazio), login, área restrita nem formulários ativos.

---

## Elementos globais (todas as páginas)

### G1. Loader "Load Norris"
- **Local:** sobreposição em tela cheia no primeiro carregamento.
- **Uso:** aparece sozinho e some quando a página termina de carregar. O botão "Load Norris" dispensa o loader na hora.
- **Entradas e saídas:** progresso do carregamento de imagens e fontes. Ao terminar, remove `is-loading` do `body`.
- **Original:** animação Rive `page-transition.riv` com os inputs `initial`, `transition-in` e `transition-out`.
- **Situação:** Aproximado. A cortina é feita em CSS, sem Rive (ver PENDENCIAS P1).

### G2. Barra de navegação
- Botão **Store**, que leva a `https://store.landonorris.com/`, logo/wordmark que leva a `/` e botão hambúrguer.
- **Regras:** a cor do nav (`data-nav-theme`) acompanha o fundo da seção que está sob ele. O hambúrguer alterna
  `aria-expanded` e o rótulo `aria-label` entre "Open menu" e "Close menu".
- **Situação:** Verificado. O E2E confere `aria-expanded` e o rótulo.

### G3. Menu em tela cheia
- **Links:** Home, On Track, Off Track e Calendar. Partnerships está oculto no menu.
- **Imagens:** 5 imagens (`data-nav-img`). Passar o mouse num link mostra a imagem correspondente.
- **Lateral:** capacete, "mclaren f1 since 2019", "business enquiries" (`mailto:business@landonorris.com`)
  e redes sociais (TikTok, Instagram, YouTube `landonorris04`, Twitch).
- **Fechamento:** Esc ou navegação.
- **Situação:** Verificado.

### G4. Transições de página (SPA)
- **Original:** Taxi.js. Faz `fetch` da página com o cabeçalho `X-Requested-With: Taxi`, troca o `[data-taxi-view]`
  e mantém o documento. Pré-carrega ao passar o mouse sobre um link. Uma resposta fora de 2xx causa navegação completa.
- **Reconstrução:** mesmo contrato (cabeçalho, cache, pré-carga, fallback e `popstate`). Scripts marcados com
  `data-taxi-reload` são reexecutados.
- **Situação:** Verificado. O E2E confirma o mesmo documento após clicar em "/off-track".

### G5. Bloqueio de paisagem no celular
- **Regra:** em dispositivo touch, na horizontal e com tela baixa, mostra "Please rotate your device, This is a vertical drive."
- **Situação:** Verificado. A animação Rive foi trocada por um ícone animado.

### G6. Rodapé
- **Colunas:** "pages" (Home, On Track, Off Track, Calendar, mais Partnerships oculto e Store) e "Follow On" (4 redes, mais "Sign Up" oculto).
- **Conteúdo:** frase "Always bringing the fight.", botão "business enquiries", marquee com 7 logos de parceiros,
  "© 2026 Lando Norris. All rights reserved", Privacy Policy e Terms.
- **Situação:** Verificado. "Sign Up" fica oculto nos dois (ver Inativo, I1).

### G7. Rolagem suave
- **Original:** Lenis em telas com 992 px ou mais.
- **Reconstrução:** Lenis em telas com 992 px ou mais, desligado quando o usuário pede movimento reduzido.
- **Situação:** Verificado.

### G8. Revelação de textos
- **Original:** `data-anim-high` e `data-oval-scroll` (SplitText com GSAP).
- **Reconstrução:** fade com deslocamento ao entrar na viewport.
- **Situação:** Aproximado. Não há divisão por linhas e caracteres.

---

## Home (`/`)

| # | Seção | Conteúdo e comportamento | Situação |
|---|---|---|---|
| H1 | Hero | Retrato em WebGL com o capacete revelado pelo mouse. Mostra "Next Race" (calculada) com link para `/calendar` e "mclaren f1 since 2019". | Aproximado: canvas 2D com pincel de revelação (P2) |
| H2 | Controle de toque | "tap to lock" / "Back to scroll". Trava a rolagem para pintar o hero com o dedo. Alterna `aria-pressed` e `aria-label`. | Verificado |
| H3 | Assinatura | Assinatura em SVG e "Message from lando" | Verificado (sem traçado Rive) |
| H4 | Manifesto | "Redefining limits, fighting for wins…" com destaques | Verificado |
| H5 | Galeria horizontal | 12 cartões (10 fotos com legenda, 2 citações, 1 pílula "1"). Fica fixada e rola na horizontal. O fundo passa de verde-escuro para branco. Vira lista vertical abaixo de 768 px. | Verificado |
| H6 | On/Off Track | Dois blocos com link para `/on-track` e `/off-track`. A imagem central troca entre capacete e rosto conforme o lado do cursor. | Verificado |
| H7 | Imagem de transição | Foto em tela cheia | Verificado |
| H8 | Helmets – Hall of Fame | 16 capacetes (2019–2025). O hover revela a 2ª imagem e as colunas têm parallax. CTA "view on track". | Verificado |
| H9 | Lando Store | "World Drivers' Champion", texto e "Visit the store", que leva a `https://landonorris.store/`, com colagem de 5 imagens | Verificado |
| H10 | Partners & campaigns | Texto, "view partnerships" (leva a `/partnerships`, que dá 404) e 2 marquees de logos que invertem com a direção da rolagem | Verificado |
| H11 | On Socials | 7 cartões. O hover toca o vídeo do Vimeo `824804225` (sem som e em loop) e há links para as 4 redes. | Externo (Vimeo) |
| H12 | Rodapé | ver G6 | Verificado |

## On Track (`/on-track`)

| # | Seção | Conteúdo e comportamento | Situação |
|---|---|---|---|
| O1 | Hero | "On TRACK", "last lap lando", idade (26 y.o, calculada pela data de nascimento) e Bristol, UK. Mostra a corrida **anterior** (local e posição) e a **próxima**/atual (rodada, local e datas). | Verificado (E2E e testes) |
| O2 | Manifesto | "Challenging the limits, winning races…" | Verificado |
| O3 | Pódios | "49 podiums" com contador animado. A faixa de 10 fotos mostra uma prévia que acompanha o X do cursor. | Verificado |
| O4 | Carreira F1 | 13 vitórias, 19 poles, média de chegada 6.28, 18 voltas mais rápidas e tabela por temporada (2019–2024). CTA "full schedule & results". | Verificado |
| O5 | Destaques de resultados | 7 linhas (série, local, bandeira, data, posição, troféu, tempo e diferença). O hover mostra uma foto que segue o mouse. | Verificado |
| O6 | Galeria horizontal | 6 cartões | Verificado |
| O7 | Pré-F1 | Texto e 8 títulos (2013–2018), com o principal destacado | Verificado |
| O8 | Contagem regressiva | "next race begins in..." até a próxima corrida, em dias, horas, minutos e segundos | Verificado (E2E: mesmo alvo e incremento) |
| O9 | Visualizador de circuito | Mesmo componente do calendário (C3), restrito às corridas futuras | Verificado |
| O10 | Calendário resumido | "Upcoming 2026 schedule", posição (6th), rodada (19), 5 corridas futuras com voltas e distância. Clicar numa linha abre ela no visualizador. | Verificado (E2E) |
| O11 | Imagem e capacetes | Foto e Hall of Fame (sem CTA) | Verificado |

## Off Track (`/off-track`)

| # | Seção | Conteúdo e comportamento | Situação |
|---|---|---|---|
| F1 | Hero | "OFF TRACK", nome, idade, texto, assinatura e nota Hilton. Imagem que percorre 10 fotos conforme a rolagem. Marquee de 6 logos. | Verificado (sem o caminho em curva do original, P5) |
| F2 | Manifesto | Igual ao da On Track | Verificado |
| F3 | Personal Projects | Galeria horizontal com 21 cartões: padel, photography & film, LEGO com Nathan Sawaya, golfe "Mastering the Green" e citações | Verificado |
| F4 | On Socials | 7 cartões Vimeo | Externo |
| F5 | Campanhas (`data-more-list`) | O código remove a seção quando não há itens. Não há itens hoje. | Verificado (vazio nos dois) |

## Calendar (`/calendar`)

| # | Seção | Conteúdo e comportamento | Situação |
|---|---|---|---|
| C1 | Hero | "Upcoming 2026 calendar" e assinatura | Verificado |
| C2 | Cabeçalho | Texto, Standing 6th, Round 19 e âncoras "track visualiser" e "calendar list" | Verificado |
| C3 | Visualizador de circuito | Mostra uma corrida: datas, extensão, ano da primeira participação, distância, voltas, texto "lando at…", bandeira e nome vertical. Tabela de sessões (P1, P2, P3, Quali, Race). Botões anterior e próximo com volta circular. | Verificado (E2E em 5 cenários) |
| C4 | Lista de corridas passadas | 19 linhas: rodada, local, data, posição com troféu (ouro, prata ou bronze) e volta mais rápida. Hover com foto. | Verificado |
| C5 | Lista de corridas futuras | 5 linhas: rodada, local, datas, voltas e distância | Verificado |
| C6 | Formula 1 All Results | Acordeão por temporada (2025–2019) com posição final e pódios. Cada item lista as corridas daquele ano. Só um fica aberto por vez. Acessível por teclado (Enter/Espaço). | Verificado (E2E) |

## Legais

| # | Página | Situação |
|---|---|---|
| L1 | Termos e Condições (Wearegrip Limited, atualizado em 23.09.2025) | Texto integral reproduzido |
| L2 | Política de Privacidade | O original não tem texto próprio: é um embed iubenda (política 76795150). A reconstrução mantém o mesmo embed. |

## 404

| # | Item | Situação |
|---|---|---|
| N1 | "Page Not Found / Veered off track" e "Go to Home" | Verificado |
| N2 | 4 seletores de estilo do capacete (lime, dark, grid, google) que alteram o visual | Verificado no comportamento (E2E). O visual 3D foi aproximado (P2). |

## Inativo no original (presente no código, desligado)

| # | Item | Evidência |
|---|---|---|
| I1 | Newsletter "Sign Up" com Klaviyo (`company_id=XWvzdS`) | Script comentado no `<head>`. O link `data-signup-trigger` tem a classe `is-hidden` e nenhuma lógica no bundle ativo. |
| I2 | Banner de cookies iubenda (`siteId 2095750`, `cookiePolicyId 76795150`) | Configuração `_iub.csConfiguration` comentada no `<head>` |
| I3 | Bundles alternativos (`lando.OFF+BRAND.js`, `…gold-android-fix-03.js`, `assets…/lando-by-OFF+BRAND.js`, `transitions-rive-isolate.js`) | Comentados no HTML. Só `lando-by-OFF+BRAND.05.js` está ativo. |
| I4 | Painel de debug dat.GUI (usa `localStorage`) | Embutido no bundle e não exposto ao usuário |
| I5 | Página `/partnerships` | Linkada, mas responde 404 |
