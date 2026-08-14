# Plano de implementação — Diagnóstico assistido: captura guiada e perfil de desempenho

## 1. Decisão de replanejamento

O modo diagnóstico já entrega a infraestrutura local segura: sessão autenticada, eventos, inspeção da interface, captura de tela, snapshots e servidor MCP. O teste real do salto de rolagem revelou, porém, uma lacuna operacional: o agente precisou solicitar cursores, filtros, eventos e snapshot em etapas separadas. Nesse intervalo, eventos periódicos e rolagens comuns truncaram a consulta; a evidência chegou fragmentada e sem a geometria necessária para explicar o comportamento.

A auditoria da captura real confirmou a limitação. O snapshot reuniu 108 eventos desde o início da sessão, com 91 IPCs e somente quatro ações, e a interface final foi truncada por profundidade. A rolagem registrou apenas `x` e `y` a cada 250 ms; não houve `wheel`, tecla, cadeia rolável, dimensões, mudança de layout nem estado anterior. O descritor do alvo usou `textContent`, tornando o evento instável e capaz de copiar conteúdo pericial. Valores ausentes foram serializados como a string `"undefined"`. Também foram observados erros do TinyMCE e do renderer, mas a origem apontou para o *bundle* minificado sem stack original suficiente para localizar a causa.

Esta etapa transforma o diagnóstico em uma infraestrutura única de captura local com duas finalidades. Em `problema`, o usuário reproduzirá apenas o comportamento real na aplicação e encerrará a captura quando o sintoma ocorrer ou a tentativa terminar. Em `desempenho`, o usuário apenas iniciará uma janela de observação; o laWdo coletará uma linha de base, amostras de baixo custo e um estado final, encerrando e gravando o pacote automaticamente ao atingir a duração escolhida.

As duas finalidades preservarão informações em arquivos locais, versionados e legíveis pelo agente. O modo `problema` priorizará causalidade e sequência; o modo `desempenho` priorizará tendências, gargalos e comparação antes/depois com interferência mínima da própria medição.

Não será criada automação que invente passos de negócio, nem gravação contínua da tela, rede aberta, execução livre de JavaScript ou acesso arbitrário ao banco.

## 2. Objetivo

Permitir que um agente de IA receba evidências suficientes para diagnosticar falhas reproduzíveis ou investigar a saúde e o desempenho do laWdo, localizar componentes e arquivos candidatos e escolher uma estratégia de correção verificável, sem exigir que o usuário copie cursores, filtre NDJSON ou localize arquivos.

A automação deverá reduzir e organizar evidências, não substituir o raciocínio técnico. Ela poderá classificar sinais e classes de causa, mas não declarará uma causa-raiz nem editará código. A decisão final caberá ao agente depois de confrontar o dossiê com o código atual, os testes e, quando útil, o grafo do projeto.

Os fluxos-alvo são:

```text
Agente: iniciar_captura(finalidade=problema) → instrução curta ao usuário
Usuário: reproduz o problema na janela real e responde “concluído”
Agente: finalizar_captura → dossiê causal + classes de causa candidatas

Agente ou usuário: iniciar_captura(finalidade=desempenho, duracaoSegundos=60)
laWdo: coleta baseline e amostras agregadas → finaliza automaticamente
Agente: consultar_captura → gargalos priorizados + próximos testes
```

## 3. Escopo da v1.1

### 3.1 Ferramentas MCP

As seis ferramentas existentes permanecem como primitivas de investigação:

| Ferramenta | Papel após o replanejamento |
|---|---|
| `diagnostico_status` | Pré-condição e recuperação de sessão. |
| `capturar_tela` | Inspeção pontual fora de uma rotina guiada. |
| `inspecionar_interface` | Inspeção pontual e diagnóstico detalhado. |
| `executar_acao` | Ações seguras do agente. |
| `obter_eventos` | Consulta forense pontual. |
| `criar_snapshot` | Snapshot técnico manual. |

Serão adicionadas quatro ferramentas de alto nível:

| Ferramenta | Comportamento |
|---|---|
| `iniciar_captura` | Valida a sessão, seleciona `problema` ou `desempenho`, registra linha de base e ativa somente as sondas necessárias. |
| `status_captura` | Informa finalidade, estado, duração, contagens agregadas, prazo e orientação de recuperação; não despeja eventos. |
| `finalizar_captura` | Encerra antecipadamente ou conclui uma reprodução, fixa o intervalo e devolve o dossiê adequado à finalidade. |
| `consultar_captura` | Recupera uma parte tipada do pacote e, opcionalmente, compara duas capturas de desempenho compatíveis, sem exigir shell nem conhecimento do caminho temporário. |

`AGENTS.md` deverá deixar de prescrever a sequência manual como fluxo padrão. Para falha reproduzível, a orientação será `diagnostico_status` → `iniciar_captura(finalidade=problema)` → usuário reproduz → `finalizar_captura`. Para saúde ou desempenho, será `diagnostico_status` → `iniciar_captura(finalidade=desempenho)` → aguardar a conclusão automática → `consultar_captura`. As seis primitivas ficam para aprofundamento posterior.

### 3.2 Responsabilidades do usuário e do agente

O agente deve:

1. confirmar sessão e rota antes de armar a captura;
2. descrever em uma frase o que o usuário deve fazer e o sinal observável de falha;
3. chamar `iniciar_captura` imediatamente antes da reprodução ou da janela de medição;
4. não pedir cursor, comandos MCP ou caminhos de arquivo ao usuário;
5. em `problema`, chamar `finalizar_captura` assim que o usuário confirmar o término, mesmo se “nada aconteceu”;
6. em `desempenho`, aguardar a finalização automática e somente encerrar antes do prazo se o usuário solicitar;
7. analisar o dossiê primeiro e usar `consultar_captura` somente quando a evidência resumida não bastar;
8. separar fatos observados, classes de causa candidatas e hipótese própria;
9. relacionar a hipótese a arquivos atuais, criar ou ajustar um teste de regressão e repetir a mesma captura depois da correção.

O usuário deve apenas:

1. manter o laWdo aberto em modo diagnóstico;
2. pedir em linguagem natural que o agente inicie a captura, sem conhecer nomes de ferramentas, cursores ou caminhos;
3. em `problema`, executar os passos funcionais normais uma vez e informar “concluído”, “falhou” ou “não reproduziu”;
4. em `desempenho`, manter ou usar o laWdo conforme o cenário indicado; a conclusão será automática.

Para comportamentos intermitentes, o agente poderá iniciar uma nova captura; capturas não serão reutilizadas nem mescladas silenciosamente. Para desempenho, comparações usarão referências explícitas a dois `capturaId`, nunca uma média implícita entre sessões diferentes.

## 4. Modelo de captura guiada

### 4.1 Estado e ciclo de vida

Uma sessão terá no máximo uma captura ativa, independentemente da finalidade. O estado ficará em memória no processo principal e será persistido em diretório temporário da sessão para recuperação de falha.

```text
inativa → preparando → coletando → finalizada
                         └→ expirada / cancelada / interrompida
```

- `preparando`: validação, linha de base e criação do diretório temporário.
- `coletando`: a linha de base foi concluída e a janela de observação está ativa; não exige ação do usuário em `desempenho`.
- `finalizada`: artefato foi gravado atomicamente e não aceita nova coleta.
- `expirada`: uma captura de problema atinge 10 minutos sem finalização; preserva os dados parciais como pacote incompleto.
- `cancelada`: somente por nova abertura explícita ou encerramento da sessão; também grava motivo e intervalo já existente.
- `interrompida`: janela, renderer ou aplicativo encerrou durante a captura; preserva tudo que já foi validado.

Em `desempenho`, a duração padrão será 60 segundos, configurável entre 30 e 300 segundos. A captura se finalizará automaticamente no prazo, mas aceitará encerramento antecipado idempotente. Em `problema`, a finalização será manual para coincidir com a reprodução observada.

### 4.2 Linha de base e recorte automático

`iniciar_captura` receberá finalidade, uma janela opcional e parâmetros restritos. Em `problema`, exigirá uma descrição curta do cenário e categorias opcionais de interesse. Em `desempenho`, aceitará duração e um perfil predefinido, sem prompt técnico livre. Ela deverá:

1. selecionar a janela focada quando `janelaId` estiver ausente;
2. fixar `cursorInicial` no último evento já persistido;
3. registrar rota, dimensões, foco, escala, contexto de diagnóstico do renderer e cadeia de contêineres roláveis da janela;
4. criar screenshot e snapshot de interface iniciais, admitindo falha parcial;
5. em `problema`, incluir um buffer anterior de até 20 eventos para preservar o gatilho imediatamente anterior;
6. em `desempenho`, registrar amostras de baixo custo e manter eventos detalhados desligados, salvo anomalia;
7. retornar `capturaId`, finalidade, instrução e horário de conclusão ou expiração.

`finalizar_captura` fixará `cursorFinal` antes de gerar artefatos. Em `problema`, incluirá os eventos entre os cursores mais o buffer inicial. Em `desempenho`, fechará a série temporal, calculará percentis e comparará os estados inicial e final. Nenhuma finalidade fará busca global posterior que possa ser truncada por polling. O retorno será limitado ao dossiê compacto; os dados completos continuarão apenas no pacote da captura.

### 4.3 Artefato único

Cada rotina concluirá em:

```text
tmp/diagnostico-agente/sessoes/<sessao>/capturas/<timestamp>-<capturaId>/
├── manifesto.json
├── resumo.md
├── dossie-agente.json
├── contexto-execucao.json
├── marcadores-interface.json
├── metricas-resumo.json
├── amostras-processos.ndjson
├── linha-do-tempo.json
├── interface-inicial.json
├── interface-final.json
├── tela-inicial.png
├── tela-final.png
├── eventos.ndjson
└── erros-captura.json
```

O diretório será criado como temporário e renomeado somente no fim. Uma indisponibilidade de imagem ou interface não invalidará `manifesto.json`, `linha-do-tempo.json` e `eventos.ndjson`.

Arquivos que não se aplicarem à finalidade serão omitidos e declarados como ausentes no manifesto. `manifesto.json` registrará versão do protocolo, finalidade, sessão, cenário quando aplicável, janela, cursores, horários, componentes disponíveis, erros parciais e classificação final. `contexto-execucao.json` registrará somente metadados técnicos: versão do aplicativo e do protocolo, commit ou identificador do build, modo de execução, plataforma, arquitetura, versões de Electron/Chromium/Node, rota, dimensões, zoom e disponibilidade de source maps. O resumo nunca inclui tokens, senhas, chaves, valores de campos nem texto do laudo.

### 4.4 Dossiê diretamente consumível pelo agente

`finalizar_captura` não devolverá apenas contadores e um caminho. Ela montará deterministicamente `dossie-agente.json` e retornará sua versão compacta em `dados.dossieAgente`, limitada por schema e tamanho. O dossiê conterá:

- classificação declarada pelo usuário e qualidade da captura;
- linha do tempo essencial com no máximo 30 fatos, preservando IDs dos eventos originais;
- anomalias ordenadas por confiança e relevância, sempre com eventos de suporte;
- classes de causa candidatas, como `entrada_usuario`, `rolagem_programatica`, `mudanca_layout`, `remontagem`, `ipc`, `erro_renderer` ou `inconclusiva`;
- diferenças estruturais e geométricas entre linha de base e estado final;
- erros com stack original, quando disponível, e correlação temporal com a ação;
- marcadores estáveis da interface e arquivos-fonte candidatos encontrados no manifesto da revisão;
- lacunas que impedem conclusão e a próxima ferramenta ou reprodução recomendada;
- lista dos componentes completos disponíveis por `consultar_captura`.

A síntese será feita por regras locais explicáveis; o laWdo não chamará outro modelo de IA para interpretar seus próprios eventos. “Classe de causa candidata” não equivale a causa-raiz. Se sinais conflitarem ou faltarem dados, o estado deverá ser `inconclusiva` e o dossiê deverá explicar o que falta.

## 5. Captura automatizada de saúde e desempenho

### 5.1 Finalidade

O modo `desempenho` servirá para responder perguntas como “qual processo consome mais memória?”, “qual rota apresenta maior latência?”, “há IPC lento?”, “o renderer bloqueia durante a abertura do laudo?” e “a alteração melhorou ou piorou o baseline?”. Ele não dependerá da reprodução de uma falha pontual nem exigirá que o usuário marque eventos.

O início criará os arquivos, coletará uma amostra inicial e iniciará uma janela temporizada. Ao término, o próprio laWdo fechará os arquivos, calculará agregados e disponibilizará o dossiê ao agente. O usuário poderá usar a aplicação normalmente durante o intervalo ou deixá-la ociosa, conforme a finalidade declarada no campo restrito `cenarioDesempenho`: `ocioso`, `abertura_laudo`, `uso_editor`, `painel_ia` ou `geral`.

### 5.2 Métricas permitidas

A coleta usará fontes locais e APIs estáveis, com granularidade suficiente para decisão técnica e sem conteúdo pericial:

- `app.getAppMetrics()` a cada segundo para CPU e memória por processo Electron, PID e tipo;
- estado inicial e final de memória do processo principal e do renderer; operações de *memory dump* não serão executadas em cada amostra porque têm custo maior;
- eventos `unresponsive`, `responsive` e `render-process-gone` do `WebContents`;
- atraso do *event loop* do main e do renderer, agregado por janela de tempo;
- tarefas longas e *layout shifts* agregados no renderer, sem texto, seletores livres ou conteúdo de recursos;
- cadência aproximada de frames apenas enquanto a janela estiver visível, agregada por segundo e sem armazenar cada `requestAnimationFrame`;
- quantidade, duração, percentis e erros de IPC por canal permitido, preservando somente canal, fase e duração;
- marcos de inicialização e abertura de janela/laudo já observáveis pelo aplicativo;
- contagens estruturais no início e no fim: janelas, editores TinyMCE, imagens ainda não estabilizadas e nós sob raízes explicitamente marcadas, sem HTML, `src`, nomes ou valores;
- versão, build, plataforma, dimensões, zoom e rota técnica.

O dossiê apresentará mediana, p95, máximo, tendência e anomalias relevantes, além de apontar quais medições não estavam disponíveis. Não produzirá uma recomendação genérica como “reduzir memória”; deverá relacionar o sinal a uma fase, processo, rota, canal IPC ou marcador conhecido.

### 5.3 Controle de interferência

A medição não poderá prejudicar sensivelmente o comportamento que pretende observar:

- amostragem padrão de um segundo e agregação em memória com limites fixos;
- persistência sequencial em NDJSON, sem reescrever o arquivo inteiro;
- eventos de alta frequência agregados antes da travessia IPC;
- screenshots, inspeção estrutural completa, `ResizeObserver` amplo e captura de cada interação desligados em `desempenho`;
- coleta cara executada somente no início, no fim ou após anomalia explícita;
- redução automática para o perfil `essencial` se a fila de persistência crescer, o event loop atrasar ou o orçamento interno for excedido; o dossiê registrará a degradação;
- limites de 300 amostras, 10 MB por pacote de desempenho e retenção compartilhada com as sessões diagnósticas existentes.

A homologação comparará uma execução de controle com uma execução instrumentada do mesmo cenário. Como teto inicial, a instrumentação não poderá acrescentar mais de dois pontos percentuais à mediana de CPU, 20 MB ao pico de memória nem 5 ms ao p95 de atraso do event loop. Se o ambiente impedir uma medição estável, a captura será classificada como `inconclusiva`, não como aprovada.

### 5.4 Comparação e decisão de otimização

O diagnóstico poderá comparar explicitamente uma captura `antes` e uma `depois`, desde que finalidade, cenário, versão do protocolo e parâmetros sejam compatíveis. O resultado conterá deltas absolutos e percentuais, mas não declarará melhoria quando houver regressão relevante em outra métrica crítica ou quando a variabilidade invalidar a comparação.

“Maximizar o desempenho” será tratado como ciclo verificável:

1. capturar baseline;
2. priorizar um gargalo com evidência;
3. inspecionar o código e formular uma alteração limitada;
4. executar testes funcionais;
5. repetir a mesma captura;
6. aceitar a mudança somente se o ganho superar a variação e não houver regressão funcional.

Nenhuma configuração, limite, modelo de IA, banco, *background throttling* ou comportamento do usuário será alterado automaticamente pela captura.

## 6. Evidência específica para falhas de interface e rolagem

O evento genérico de rolagem atual não distingue intenção, alvo e mudança de layout. A rotina guiada acrescentará uma sonda declarativa do renderer, acionada somente durante uma captura ativa e sem avaliação livre de código. A sonda observará tanto o documento principal quanto documentos internos *same-origin* do TinyMCE e será reinstalada de modo idempotente quando um editor for criado ou remontado.

### 6.1 Sonda de interação

O preload registrará, com *throttle* e sanitização:

- `pointerdown`, `click`, `wheel`, `keydown`, `change`, foco, carregamento de imagem, criação/remoção do iframe do editor e mudança de rota;
- identificador seguro do alvo (`tag`, papel e `data-diagnostico-id`); nomes acessíveis somente poderão ser enviados quando vierem de atributo estático permitido e nunca de `textContent`, `innerText`, `value` ou conteúdo editável;
- para `wheel` e `scroll`, a cadeia de ancestrais roláveis, `scrollTop`, `scrollHeight`, `clientHeight`, direção e distância da mudança;
- se o `scroll` ocorreu até 150 ms depois de `wheel`/tecla/pointer do usuário, ou sem causa local identificada;
- alterações relevantes de tamanho por `ResizeObserver`, `layout-shift` por `PerformanceObserver` com `hadRecentInput`, estabilização de imagens e mutações estruturais somente em raízes marcadas, sempre agregadas por elemento e limitadas por frequência;
- um buffer circular em memória para eventos de alta frequência; apenas o intervalo da captura será persistido.

Os dados de geometria usarão pixels CSS e não incluirão texto de conteúdo. Fora de uma captura guiada, serão mantidos somente os eventos mínimos de sessão, janela e erro; listeners enriquecidos de ação, rolagem e layout permanecerão desligados.

### 6.2 Sinais derivados no processo principal

Ao finalizar, o processo principal calculará sinais explicáveis, sem alegar causalidade:

- salto de `scrollTop` maior que 25% do intervalo rolável sem `wheel` ou tecla correspondente;
- mudança de dimensão de painel/editor nos 500 ms anteriores ao salto;
- rolagem no contêiner principal enquanto o ponteiro estava sobre um descendente não rolável;
- mudança de alvo rolável entre dois eventos consecutivos;
- imagem carregada ou editor remontado próximo ao salto;
- *layout shift* sem entrada recente que envolva o contêiner ou descendente marcado;
- erro, console `warn/error` ou IPC lento/erro correlacionado à interação.

Cada sinal terá `tipo`, `confianca` (`baixa`, `media`, `alta`), eventos de suporte e uma descrição factual. A ferramenta não diagnosticará “o rodapé está errado”; ela devolverá, por exemplo, “`main#conteudo-principal` passou de 389 para 686 sem wheel associado; o ponteiro estava sobre o cartão do Laudo”. A conclusão permanece responsabilidade do agente.

### 6.3 Correlação com erros e código-fonte

Durante a captura ativa, o renderer registrará `error` e `unhandledrejection` com mensagem, tipo e stack, e o processo principal correlacionará console, IPC e falhas fatais pelo intervalo temporal. Em `dev:diagnostico`, stacks de main, preload e renderer deverão ser resolvidas contra os source maps locais antes de entrar no dossiê; o dado bruto será preservado no pacote. Falha de resolução será explícita e nunca convertida em localização presumida.

Superfícies críticas usarão identificadores semânticos estáveis, por exemplo `laudos.editor`, `laudos.editor-scroll`, `painel-ia.dock` e `painel-ia.trilho`. Um manifesto gerado na preparação do diagnóstico relacionará cada identificador aos arquivos que o declaram na revisão atual. O agente poderá então começar a investigação nesses arquivos e confirmar as relações com Graphify ou busca local, sem depender de nomes de classes Tailwind, texto visível ou nomes de *bundles* com hash.

## 7. Contratos das novas ferramentas

### 7.1 `iniciar_captura`

Entrada:

```json
{
  "finalidade": "problema",
  "cenario": "Ao abrir uma seção com imagens, a rolagem volta ao fim da página.",
  "janelaId": 1,
  "categorias": ["acao", "ipc", "erro", "console", "janela"]
}
```

- `finalidade`: obrigatória: `problema` ou `desempenho`;
- `cenario`: obrigatório em `problema`, 10–500 caracteres, sem dados sensíveis intencionais;
- `janelaId`: opcional; ausente usa a janela focada;
- `categorias`: permitido somente em `problema`; o padrão cobre ações, interface, IPC, erro, console e janela; arrays vazios são inválidos;
- em `desempenho`, `duracaoSegundos` será opcional entre 30 e 300, com padrão 60, e `cenarioDesempenho` aceitará somente `ocioso`, `abertura_laudo`, `uso_editor`, `painel_ia` ou `geral`.

Saída em `dados`:

```json
{
  "capturaId": "uuid",
  "finalidade": "problema",
  "estado": "coletando",
  "janelaId": 1,
  "rota": "#/laudos",
  "cursorInicial": 120,
  "expiraEm": "ISO-8601",
  "instrucoesUsuario": "Reproduza o salto uma vez e responda somente quando concluir.",
  "componentesIniciais": { "tela": true, "interface": true, "geometriaRolagem": true },
  "errosCaptura": []
}
```

Se já houver captura ativa, a operação retornará `CAPTURA_EM_ANDAMENTO` com seu identificador e orientação para finalizá-la ou aguardar a conclusão; jamais apagará evidências em curso. Em `desempenho`, a resposta informará também `finalizaEm` e o perfil efetivamente ativado.

### 7.2 `status_captura`

Entrada opcional: `{ "capturaId": "uuid" }`. Sem identificador, consulta a captura ativa da sessão.

Saída: finalidade, estado, duração, cursor atual, contadores agregados, degradação de perfil, última ação relevante quando aplicável e prazo de conclusão/expiração. Não retorna eventos completos, imagens nem conteúdo da interface.

### 7.3 `finalizar_captura`

Entrada:

```json
{
  "capturaId": "uuid",
  "resultadoUsuario": "reproduzido",
  "observacaoUsuario": "A página saltou após abrir DOS EXAMES."
}
```

- `resultadoUsuario`: obrigatório apenas em `problema`: `reproduzido`, `nao_reproduzido` ou `interrompido`;
- `observacaoUsuario`: opcional, máximo 1.000 caracteres;
- a finalização será idempotente: repetir a chamada devolverá o mesmo pacote, sem duplicar eventos;
- em `desempenho`, a chamada será opcional e encerrará antecipadamente a janela automática.

Saída em `dados`:

```json
{
  "capturaId": "uuid",
  "finalidade": "problema",
  "estado": "finalizada",
  "classificacao": "reproduzido",
  "cursorInicial": 120,
  "cursorFinal": 168,
  "resumo": {
    "acoes": 4,
    "rolagens": 8,
    "erros": 0,
    "ipcsComErro": 0,
    "sinais": []
  },
  "sinais": [],
  "dossieAgente": {
    "qualidade": "suficiente",
    "linhaTempoEssencial": [],
    "classesCausa": [],
    "alvosInvestigacao": [],
    "lacunas": [],
    "proximosPassos": []
  },
  "caminho": "caminho-absoluto-do-pacote",
  "componentes": { "telaInicial": true, "telaFinal": true, "interfaceInicial": true, "interfaceFinal": true, "eventos": true },
  "errosCaptura": []
}
```

Os envelopes comuns, a autenticação via pipe, os limites de entrada, a sanitização e os códigos existentes permanecem. Serão acrescentados apenas `CAPTURA_EM_ANDAMENTO`, `CAPTURA_NAO_ENCONTRADA` e `CAPTURA_EXPIRADA` aos erros estruturados.

### 7.4 `consultar_captura`

Entrada:

```json
{
  "capturaId": "uuid",
  "componente": "timeline",
  "depoisDe": 40,
  "limite": 50,
  "compararComCapturaId": "uuid-opcional"
}
```

`componente` aceitará somente `manifesto`, `dossie`, `metricas_resumo`, `amostras_processos`, `timeline`, `eventos`, `interface_inicial`, `interface_final`, `tela_inicial`, `tela_final` e `erro`. Séries, eventos e timeline serão paginados por cursor; imagens usarão o conteúdo de imagem do MCP. `compararComCapturaId` será aceito somente para `dossie` e `metricas_resumo` de capturas `desempenho` compatíveis. A ferramenta validará pertencimento à sessão e nunca aceitará caminho livre.

### 7.5 Migração obrigatória do `console-message`

Antes das novas capturas, o listener atual deverá ser migrado porque o Electron 43 já avisa que os argumentos posicionais foram depreciados. A API atual entrega os detalhes no próprio evento:

```ts
webContents.on('console-message', ({ level, message, lineNumber, sourceId, frame }) => {
  // normalizar e registrar os campos permitidos
});
```

A implementação mapeará `warning` para o nível interno `warn` e preservará `info`, `error` e `debug`; usará `lineNumber` e `sourceId` no lugar de `line` e `sourceId` posicionais. O frame será reduzido a metadados técnicos permitidos. Em `desempenho`, mensagens de console serão agrupadas por nível e assinatura sanitizada; texto bruto não será persistido. Testes deverão provar que o listener moderno não emite o aviso e que os quatro níveis são normalizados corretamente.

## 8. Implementação prevista

| Área | Alteração |
|---|---|
| `src/shared/diagnostico/contratos.ts` | Schemas Zod, envelopes, erros e JSON Schemas das quatro ferramentas e da telemetria de rolagem. |
| `src/main/services/diagnostico-captura.service.ts` | Máquina de estados compartilhada, finalização automática/manual, composição atômica e dossiês por finalidade. |
| `src/main/services/diagnostico-desempenho.service.ts` | Amostragem, agregação, percentis, orçamento de overhead e comparação entre capturas compatíveis. |
| `src/main/services/diagnostico-eventos.service.ts` | Consulta por intervalo fechado, contadores e escrita do NDJSON recortado. |
| `src/main/services/diagnostico-interface.service.ts` | Snapshot de geometria declarativa dos ancestrais roláveis, sem executar código arbitrário. |
| `src/main/index.ts` | Listener moderno de `console-message`, lifecycle da captura, métricas Electron e delegação aos serviços. |
| `src/preload/index.ts` | Eventos enriquecidos de input/scroll/layout, `ResizeObserver` limitado e desligamento fora de captura ativa. |
| `src/renderer/` | Marcadores semânticos somente nas superfícies necessárias ao cenário e lifecycle explícito da sonda nos editores TinyMCE. |
| `scripts/diagnostico/gerar-manifesto-fontes.mjs` | Manifesto determinístico de marcadores e arquivos na revisão executada, com validação de caminhos. |
| `src/main/diagnostico-mcp.ts` | Registro das quatro ferramentas, devolução do dossiê compacto e leitura tipada dos componentes. |
| `AGENTS.md` | Novo fluxo padrão e orientação de conduta do agente. |
| `src/__tests__/` | Testes de contratos, estado, intervalo, expiração, sanitização, sinais e idempotência. |

Não expor a sonda ao renderer como API pública. Ela será controlada pelo processo principal por IPC interno de diagnóstico já permitido, com validação de payload e sem alterar `contextIsolation`, `sandbox` ou `nodeIntegration`.

## 9. Plano de testes

### 9.1 Unitários e contratuais

- transições válidas e inválidas da captura;
- segunda captura bloqueada sem perda da primeira;
- cursor inicial/final fechado e buffer inicial limitado;
- expiração e finalização idempotente;
- criação atômica e captura parcial;
- schemas Zod e `additionalProperties: false`;
- ausência de segredo e texto de campo redigido em manifesto, resumo e eventos;
- ausência de `textContent`, `innerText`, `value`, conteúdo editável e strings `"undefined"` nos descritores;
- classificação de cada sinal de rolagem a partir de sequências sintéticas;
- *throttle* de scroll e limites de `ResizeObserver`;
- correlação temporal de `layout-shift`, imagem, remontagem, erro e IPC;
- geração do manifesto de marcadores e falha explícita para caminho-fonte inexistente;
- limite de 30 fatos no dossiê sem perder os IDs que dão suporte às anomalias.
- finalização automática de `desempenho`, encerramento antecipado e pacote idempotente;
- agregação correta de mediana, p95, máximo e deltas entre capturas compatíveis;
- recusa de comparação entre cenários ou versões de protocolo incompatíveis;
- migração do `console-message` com níveis textuais, `lineNumber` e `sourceId`.

### 9.2 Integração Electron

- início/fim da captura via pipe autenticado;
- sonda desligada fora de captura e removida no encerramento;
- troca de rota, foco e janela durante a reprodução;
- screenshot/interface final indisponível sem perda de eventos;
- artefato legível após reinício do laWdo;
- cenário controlado com contêiner rolável e alteração de altura que gere sinal de salto;
- captura dentro do iframe *same-origin* do TinyMCE e reinstalação sem listeners duplicados após remontagem;
- resolução de stack do renderer para a fonte original e fallback explícito quando o source map faltar;
- `consultar_captura` paginado e imagem MCP sem aceitar caminho arbitrário;
- amostragem por `app.getAppMetrics()`, eventos de responsividade e degradação automática do perfil;
- captura de desempenho sem screenshot, inspeção profunda ou eventos detalhados de interação.

### 9.3 Smoke manual de homologação

Roteiro obrigatório no Windows:

1. iniciar `npm run dev:diagnostico`;
2. o agente chama `diagnostico_status` e `iniciar_captura(finalidade=problema)`;
3. o usuário reproduz uma vez o cenário informado;
4. o agente chama `finalizar_captura`;
5. confirmar que a resposta contém classificação, intervalo fechado, sinais e caminho do pacote;
6. confirmar que o agente consegue apontar os fatos, a classe de causa e ao menos um arquivo candidato sem abrir NDJSON manualmente;
7. repetir com `nao_reproduzido`, evidência insuficiente e janela fechada durante a captura;
8. aplicar uma falha controlada conhecida, corrigi-la e comparar a captura anterior com a posterior;
9. iniciar `desempenho` por 60 segundos e confirmar a finalização automática sem participação adicional do usuário;
10. comparar uma captura de desempenho anterior e posterior em cenário compatível;
11. confirmar que `npm run dev` e o pacote normal não criam sonda, captura nem diretório novo de diagnóstico.

## 10. Critérios de homologação

A v1.1 estará homologada quando:

1. o usuário conseguir fornecer evidências para uma reprodução usando somente a interface do laWdo e uma confirmação textual ao agente;
2. o agente não precisar solicitar cursor, sintaxe de ferramenta ou filtro de eventos;
3. `finalizar_captura` devolver um dossiê limitado, suficiente para a triagem inicial, e `consultar_captura` permitir aprofundamento sem caminho livre ou shell;
4. o pacote contiver sempre cursor inicial/final, timeline e metadados, mesmo com falha parcial de imagem/interface;
5. os cenários controlados de `wheel`, rolagem programática, `layout-shift` e remontagem serem classificados corretamente, com eventos de suporte, sem transformar correlação em causalidade;
6. o agente, recebendo apenas o dossiê de cada falha controlada, localizar a superfície correta, formular uma hipótese refutável e selecionar o teste de regressão adequado antes de editar código;
7. uma nova captura após a correção demonstrar o desaparecimento do sinal original sem introduzir erro, IPC falho ou regressão do fluxo;
8. capturas expiradas, duplicadas e interrompidas preservarem evidência e não bloquearem a próxima tentativa;
9. nenhum evento ou artefato conter texto do laudo ou valores de campos, e nenhum descritor depender de `textContent`;
10. os dados continuarem locais, autenticados, sanitizados e ausentes da execução normal/empacotada;
11. a captura de desempenho terminar automaticamente, apontar processo/fase/canal candidato e respeitar o orçamento de overhead definido;
12. a comparação antes/depois recusar cenários incompatíveis e não esconder regressões em métricas críticas;
13. `npm run type-check`, `npm run lint`, `npm test`, `npm run test:coverage`, `npm run build` e `npm run pack` passarem, além dos smokes manuais.

## 11. Sequência de execução

1. Migrar `console-message` para o objeto moderno e testar a normalização dos níveis.
2. Atualizar contratos discriminados por finalidade, códigos de erro e testes de schema.
3. Implementar o serviço unificado de captura, arquivos e seus testes de estado/artefato.
4. Implementar o perfil de desempenho de baixo overhead, agregação e comparação.
5. Adicionar marcadores semânticos mínimos e gerar o manifesto de arquivos-fonte da revisão.
6. Adicionar a sonda limitada de interação, rolagem e layout no preload e nos documentos *same-origin* do TinyMCE.
7. Capturar erros/stacks e resolver source maps no modo diagnóstico.
8. Integrar o processo principal aos serviços, sintetizar os dossiês e garantir desligamento/expiração.
9. Implementar as quatro ferramentas MCP e a leitura tipada dos componentes.
10. Adicionar testes Electron de intervalo, captura parcial, desempenho e cenários controlados de causa.
11. Atualizar `AGENTS.md` e os roteiros para agentes.
12. Executar validações, smokes, comparação de overhead e teste cego do dossiê para decisão do agente.
13. Somente após homologação, registrar o estado real em `spec/13 diagnostico/` pelo fluxo `/spec`.

## 12. Itens explicitamente fora deste plano

- vídeo ou captura contínua da tela;
- long polling genérico de eventos;
- replay determinístico de interações;
- execução livre de JavaScript, CSS selectors ou SQL pelo MCP;
- telemetria de rede detalhada;
- profiler contínuo, DevTools Protocol ou heap snapshot em cada amostra;
- ajuste automático de configurações ou aplicação automática de otimizações;
- diagnóstico autônomo sem reprodução ou confirmação do usuário;
- envio automático do artefato para serviços externos.
