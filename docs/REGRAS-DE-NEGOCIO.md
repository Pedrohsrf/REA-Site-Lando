# Regras de negócio

As regras foram recuperadas do bundle ativo `lando-by-OFF+BRAND.05.js` (análise estática) e confirmadas por
comparação em tempo de execução com o original (ver TESTES.md). Na reconstrução, todas estão em
`public/js/lib/rules.mjs` e têm testes em `tests/rules.test.mjs`.

As referências entre parênteses são nomes de funções minificadas e offsets de caracteres no bundle original.

## R1. Data da corrida e classificação passado/futuro (`j$`, offset ≈1 276 700)
- O campo CMS `date-actual` usa o formato `D/M/AAAA H:MM`. Exemplo: `1/11/2026 20:00`.
- Para classificar a corrida, ele é lido como **dia local**, ignorando a hora: `new Date(ano, mês-1, dia)`.
- "Hoje" é a meia-noite local (`setHours(0,0,0,0)`).
- A corrida é **passada** quando o dia é estritamente anterior a hoje, e recebe a classe `is-in-past`. No próprio dia da corrida, ela ainda conta como futura.
- A ordenação é por data crescente, e itens sem data vão para o fim.

## R2. Corrida atual do visualizador
- O visualizador abre na primeira corrida com data igual ou posterior a hoje.
- Se todas já passaram, abre na **última**.

## R3. Navegação do visualizador
- "next item" no último item volta ao primeiro. "previous item" no primeiro vai ao último.
- Clicar numa linha da lista seleciona aquela corrida e rola até o visualizador, com um recuo de 8 rem.
- A transição apaga os campos (clip à direita), troca os valores e revela de novo. O mesmo acontece no original, com uma camada lime.

## R4. Conteúdo das sessões
- Para corridas futuras, as células mostram a data e o horário agendados de P1, P2, P3, Quali e Race.
- Para corridas passadas, as células passam a mostrar resultados:
  - a coluna de data mostra a posição (`*-time-pos`);
  - a coluna de horário mostra o tempo (`*-time-result`);
  - se o resultado estiver vazio, o valor agendado é mantido.
- Os rótulos "Result" e "Time/Gap" (`past-reveal`) aparecem apenas para corridas passadas.
- A nota "*uk time" (`past-hide`) aparece apenas para corridas futuras.

## R5. Fim de semana com sprint
- Se a corrida tem o indicador sprint visível, "Practice 2" vira **Sprint Quali** e "Practice 3" vira **Sprint**.
- Nas demais corridas, os rótulos voltam ao padrão.

## R6. Cabeçalho "Schedule" (comportamento preservado)
- O código original registra no log "Changed Schedule to Results", mas na prática grava "Schedule" para corridas passadas.
- A reconstrução reproduz esse comportamento: `FAITHFUL_RESULTS_LABEL = true` em `rules.mjs`.
- Basta trocar para `false` para exibir "Results" e corrigir o que parece ser um bug do original.

## R7. Contagem regressiva (`S$`, offset ≈1 271 600)
- O alvo vem do texto `D/M/AAAA H:MM` da próxima corrida, interpretado como **UTC** (`Date.UTC`).
- Isso acontece mesmo que a página indique "*uk time". A diferença só existe durante o horário de verão britânico (BST).
- A contagem atualiza a cada 1 s e mostra dias, horas, minutos e segundos com 2 dígitos.
- Depois do início, mostra `00` em tudo.
- O intervalo é cancelado quando o usuário sai da página.

## R8. Formatação de posição (`B_`)
- Um texto `^(\d+)([a-zA-Z]+)$` é dividido em número e sufixo sobrescrito: `5th` vira 5<sup>th</sup>.
- O sufixo fica em **lime** quando o número é `1`. Nas outras posições, fica em cinza.
- Valores fora do padrão (DNF, DNS, NS, `-`) aparecem sem alteração.

## R9. Formatação de rodada (`E_`)
- Números abaixo de 10 ganham um zero à esquerda: `3` vira `03`.

## R10. Troféus
- O troféu aparece conforme a posição: 1º ouro, 2º prata (`is-grey`) e 3º bronze. Abaixo do 3º, não há troféu.
- O ícone do troféu é o desenho do circuito, vindo do CMS.

## R11. Corrida anterior e próxima (hero da On Track, "Next Race" da home, Round)
- **Anterior** é a última corrida passada. **Próxima** é a primeira corrida futura.
- Rodada atual é a rodada da próxima corrida.
- No original esses valores são campos fixos do CMS, publicados à mão. Na reconstrução eles são **derivados das datas**, com o mesmo resultado em 29/10/2026 (anterior: United States 5th, próxima: México, rodada 19).
- A posição no campeonato (6th) não pode ser derivada e é um dado editável (`site.json → driver.standing`).

## R12. Idade
- A idade é calculada em anos completos a partir de 13/11/1999. Em 29/10/2026, são 26 anos.
- No original o valor é fixo.

## R13. Lista "Upcoming" da On Track
- Mostra apenas as corridas futuras (5 em 29/10/2026). No original, isso vem de um filtro do CMS do Webflow, aplicado na publicação.

## R14. Acordeão do histórico (`S_`)
- Só um item fica aberto por vez. Abrir um item fecha os outros.
- O componente sincroniza `aria-expanded`, `aria-controls`, `aria-hidden`, `role=button` e `role=region`.
- Enter ou Espaço alternam o item aberto.
- Ao abrir, a página rola até o item (com recuo de 100 px) se o topo estiver fora dos primeiros 30% da tela.

## R15. Prévia de imagem que segue o cursor (`T$`)
- Nas listas de resultados, a imagem da linha em hover acompanha o cursor com um deslocamento de (+20, −20) px.
- Linhas sem imagem escondem a prévia.
- Na faixa de pódios, a imagem mostrada é `floor(x / largura × N)`, limitada a N−1.

## R16. Parallax dos capacetes (`ZZ`)
- Os itens são distribuídos em 4 colunas (índice % 4).
- A coluna `c > 0` começa deslocada `c × 5 rem` e chega a 0 durante a rolagem.

## R17. Marquees
- Os parâmetros vêm de `data-marquee-speed`, `-direction` e `-duplicate`.
- A velocidade aumenta com a velocidade da rolagem, e a direção inverte quando a rolagem sobe.

## R18. Vídeos sociais (`z$`)
- O vídeo do Vimeo (`data-stream-url`) é carregado no hover, sem som e em loop.
- Ele para ao sair do cartão ou quando a aba fica oculta (`visibilitychange`).

## R19. Página 404 (`T_`)
- O seletor muda a variante visual (`lime`, `dark`, `grid` ou `google`) e marca apenas um botão como ativo.

## R20. Transições (Taxi.js)
- A navegação interna troca o conteúdo da página sem recarregar o documento.
- Uma resposta HTTP fora de 2xx leva a uma navegação completa, que é como `/partnerships` chega ao 404.

## R21. Dispositivos
- Na home, abaixo de 992 px ou em telas touch, aparece "tap to lock". Trava a rolagem e o arrasto do dedo pinta a revelação do capacete.
- Em celular na horizontal, a página é bloqueada com "Please rotate your device".
- Rolagem suave (Lenis) só com 992 px ou mais. As texturas WebGL do original usam WebP acima de 991 px e KTX2 abaixo.

## Anomalias de dados preservadas (vindas do CMS original)
- A Arábia Saudita (19/04) tem rodada **5** e posição "NS", enquanto Miami (03/05) é a rodada 4 e o Canadá também é a rodada 5.
- A China tem "DNS" e o indicador sprint ativo.
- O texto "Lando's upcoming racing schedule, as he takes on the **2025** Formula 1 season" está na página do calendário 2026.

Essas anomalias aparecem iguais no original e foram mantidas para preservar a equivalência. Corrija `data/races.json` e `data/site.json` se a equipe quiser.
