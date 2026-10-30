# Funcionalidades não verificadas, não implementadas ou dependentes de terceiros

## Animações (atualizado em 29/10/2026)

No modo **original** (o padrão), o site serve localmente o mesmo HTML, CSS e JavaScript do landonorris.com, além de
todos os assets usados em tempo de execução:
- 8 arquivos Rive;
- os modelos GLB do capacete, do "disco", das pistas e do sotd;
- texturas WebP e KTX2;
- HDRIs;
- fontes MSDF;
- decoders Draco/Basis e o WASM do Rive.

Por isso as animações são **idênticas** às do site oficial, incluindo:
- hero WebGL com simulação de fluido;
- carrossel WebGL "WE DID IT AT HOME";
- fundo topográfico;
- pistas 3D do visualizador;
- capacete 3D da On Track;
- variantes 3D do 404;
- easter egg *disco*;
- MotionPath da Off Track;
- transições Rive;
- SplitText e todas as interações.

A comparação lado a lado (capturas em `docs/screenshots/`) e os 13 cenários E2E confirmam a equivalência.

| # | Item | Situação |
|---|---|---|
| P1–P7 | Rive, WebGL, fluido do cursor, pistas 3D, SplitText, MotionPath, disco, 404 3D e capacete em rolagem | **Idênticos** no modo original |
| P8 | Modo `rebuild` (front-end reescrito) | Continua disponível (`npm run start:rebuild`), com as aproximações descritas na versão anterior deste documento |
| P9 | Google Tag (analytics) | **Removido** de propósito na cópia local, para não enviar dados à conta de analytics do site oficial |

## Dependentes de serviços externos (mesma integração mantida)

| # | Item | Dependência | Situação |
|---|---|---|---|
| E1 | Vídeos dos cartões "On Socials" | Vimeo, vídeo `824804225` (o original usa o mesmo ID nos 7 cartões) | Funciona com internet. Sem acesso, ficam as imagens estáticas. |
| E2 | Política de Privacidade | iubenda, política `76795150` | O texto é carregado do iubenda em tempo de execução, igual ao original |
| E3 | Loja | store.landonorris.com e landonorris.store (sistemas separados) | Só os links. Checkout, carrinho e catálogo estão fora do escopo do site. |
| E4 | Redes sociais e e-mail comercial | TikTok, Instagram, YouTube, Twitch e `mailto:` | Links mantidos |
| E5 | CMS do Webflow (editor e publicação) | Webflow | Substituído por `data/*.json` com recarga ao vivo. Não há painel de edição. |

## Inativos no original (não implementados de propósito)

| # | Item | Motivo |
|---|---|---|
| I1 | Newsletter Klaviyo ("Sign Up") | Script comentado e link oculto no original. O link oculto `data-signup-trigger` foi mantido. |
| I2 | Banner de cookies iubenda | Configuração comentada no original |
| I3 | Página `/partnerships` | Não existe no original (responde 404). O link e o 404 foram mantidos. |
| I4 | Painel de debug dat.GUI | Ferramenta interna, invisível ao usuário |

## Não verificados

| # | Item | Motivo |
|---|---|---|
| V1 | Sequência exata do botão "Load Norris" no primeiro acesso | Depende da animação Rive. A reconstrução dispensa o loader sozinha ou pelo clique. |
| V2 | Desempenho e fallback com KTX2 em celulares | Sem dispositivo físico. Os testes mobile foram feitos por emulação de viewport (390×844). |
| V3 | Navegadores além do Chrome 156 | Só o Chrome foi usado na comparação |
| V4 | Comportamento futuro do CMS (resultados preenchidos após cada GP) | Os resultados são editados à mão no original. Aqui também, em `data/races.json`. |
