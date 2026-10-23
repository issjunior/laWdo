# Diagnóstico assistido

## Objetivo e escopo

O diagnóstico assistido permite a um agente conectado ao Codex observar uma execução local de desenvolvimento do laWdo, capturar evidências estruturadas e investigar problemas reproduzíveis ou desempenho sem expor uma porta de rede, avaliar JavaScript livremente ou consultar o banco arbitrariamente.

Ele tem dois mecanismos independentes:

1. **Sessão MCP temporária**: disponível apenas em desenvolvimento com `npm run dev:diagnostico`. Expõe observação pontual e capturas guiadas.
2. **Snapshots de falhas fatais**: gravados localmente em `app.getPath('userData')/diagnostico-state-dumps`, inclusive quando não há sessão MCP.

O diagnóstico não é habilitado por `npm run dev`, `npm start` nem pelo aplicativo empacotado.

## Instalação e ativação

No computador de desenvolvimento que executará o aplicativo:

```powershell
npm ci
npm run build
npm run diagnostico:configurar-codex
npm run dev:diagnostico
```

Depois de configurar o MCP, encerre completamente o Codex, abra-o novamente e crie uma nova tarefa. A configuração de servidores é global ao usuário, mas a lista de ferramentas é carregada no início da tarefa e não é atualizada retroativamente em uma tarefa já aberta.

O configurador recompõe o registro `lawdoDiagnostico` para o workspace atual. No Windows, ele procura o executável do Codex Desktop em `%LOCALAPPDATA%\OpenAI\Codex\bin\<versão>\codex.exe` e usa `codex` do `PATH` como fallback. O comando MCP persistido usa caminhos absolutos para o executável Node que iniciou o configurador, `out/main/diagnostico-mcp.js` e o workspace; assim, a inicialização pelo Desktop não depende do `PATH` herdado. Falhas de criação ou substituição exibem o erro de spawn, stderr ou stdout original em vez de apenas uma mensagem genérica.

Para usar em outro computador, repita todo o procedimento no clone local: instale Node.js 24 ou superior, obtenha as dependências com `npm ci`, gere o build e execute `npm run diagnostico:configurar-codex` naquele computador. A configuração contém caminhos absolutos locais e não deve ser copiada de outra máquina.

Antes de abrir o aplicativo, confirme o registro:

```powershell
codex mcp get lawdoDiagnostico
```

O resultado deve indicar `enabled: true`, `transport: stdio` e um `command` com caminho absoluto para `node.exe` no Windows. Se as ferramentas ainda não aparecerem, confirme que o Codex foi totalmente encerrado e que a verificação ocorre em uma nova tarefa. Depois, inicie o aplicativo com `npm run dev:diagnostico`.

Confirmação da sessão:

```text
diagnostico_status
```

Ferramentas presentes com `conectado: false` significam que o registro MCP foi carregado, mas o aplicativo não possui uma sessão diagnóstica ativa. Com o aplicativo iniciado corretamente, a resposta deve indicar `conectado: true` e `modoDiagnostico: true`.

## Arquitetura e fontes de verdade

```text
Codex → MCP stdio → tmp/diagnostico-agente/sessao-ativa.json
      → named pipe autenticado → processo main
      → sessão, interface, eventos e capturas
```

| Responsabilidade | Fonte canônica |
|---|---|
| Contratos, limites e envelopes | `src/shared/diagnostico/contratos.ts` |
| Inicialização e roteamento | `src/main/index.ts` |
| Sessão, credencial, retenção e eventos | `src/main/services/diagnostico-sessao.service.ts` e `diagnostico-eventos.service.ts` |
| Transporte MCP e pipe | `src/main/diagnostico-mcp.ts` e `diagnostico-pipe.service.ts` |
| Capturas e artefatos | `diagnostico-captura.service.ts` |
| Interface e ações revisionadas | `diagnostico-interface.service.ts` |
| Métricas e comparação | `diagnostico-desempenho.service.ts` |
| Instrumentação do renderer | `src/preload/index.ts` |
| Source maps e marcadores | `diagnostico-source-map.service.ts` e `scripts/diagnostico/gerar-manifesto-fontes.mjs` |

O protocolo é versão 1. As entradas são schemas Zod estritos; toda resposta contém `ok`, `versaoProtocolo`, `requestId`, `sessionId` e `dados` ou `erro`. O proxy MCP espera até cinco segundos pela sessão local.

## Modos de uso

### Inspeção pontual

Use para confirmar o estado atual antes de aprofundar uma hipótese.

- `capturar_tela`: captura a janela ou uma região.
- `inspecionar_interface`: retorna a árvore acessível revisionada; padrão de 500 elementos/profundidade 12, máximos 1000/20.
- `executar_acao`: clica ou digita apenas em `janelaId + revisao + elementoId` retornados pela inspeção; a revisão é invalidada após a ação.
- `obter_eventos`: consulta eventos por cursor e filtros, até 200 por chamada.
- `criar_snapshot`: grava um artefato coerente de tela, interface, eventos e metadados.

Exemplo: ao suspeitar que um botão está desabilitado indevidamente, chame `inspecionar_interface`, localize o elemento retornado, execute um clique tipado e consulte os eventos subsequentes. Não solicite nem use seletor CSS, cursor de banco, JavaScript arbitrário ou consulta SQLite.

### Captura guiada de problema

Use para erro recorrente, intermitente ou difícil de explicar — inclusive salto de rolagem, falha visual, erro de renderer e IPC lento.

1. Chame `diagnostico_status`.
2. Inicie `iniciar_captura` com `finalidade: "problema"` e uma descrição concreta de 10 a 500 caracteres.
3. Peça ao usuário apenas para reproduzir o cenário uma vez.
4. Chame `finalizar_captura` com `resultadoUsuario: "reproduzido"`, `"nao_reproduzido"` ou `"interrompido"`.
5. Leia `dossie`, `manifesto`, `eventos`, `timeline` e, quando necessário, telas ou interface.

Exemplo de entrada:

```json
{
  "finalidade": "problema",
  "cenario": "A rolagem salta ao abrir uma seção com imagens no editor."
}
```

A captura mantém sondas detalhadas por até dez minutos, inclui uma linha de base e buffer anterior de 20 eventos. Ela registra ações, wheel/scroll, foco, teclas, mutações estruturais, redimensionamentos, layout shifts, eventos TinyMCE de mesma origem, erros e durações de IPC sem payload. O dossiê pode sinalizar rolagem programática, alteração de layout, erro ou IPC correlacionado; esses sinais são hipóteses, não diagnóstico conclusivo.

### Captura de desempenho

Use para verificar saúde, regressão ou efeito de uma alteração em `ocioso`, `abertura_laudo`, `uso_editor`, `painel_ia` ou `geral`.

1. Chame `diagnostico_status`.
2. Inicie `iniciar_captura` com `finalidade: "desempenho"`.
3. Mantenha o cenário escolhido em uso normal durante 30 a 300 segundos (60 por padrão).
4. Aguarde a finalização automática e use `consultar_captura` para `metricas_resumo`, `amostras_processos` ou `dossie`.

Exemplo:

```json
{
  "finalidade": "desempenho",
  "cenarioDesempenho": "uso_editor",
  "duracaoSegundos": 60
}
```

A captura amostra `app.getAppMetrics()` a cada segundo e agrega CPU, working set e atraso do event loop por PID/tipo. O resumo calcula mediana, p95, máximo e tendência; CPU p95 de pelo menos 20% e memória crescente são gargalos. IPC com p95 de pelo menos 250 ms também aparece no resumo.

Para comparar antes/depois, use `consultar_captura` com `compararComCapturaId` e componente `dossie` ou `metricas_resumo`. Compare apenas capturas do mesmo cenário e versão de protocolo. A resposta recusa contextos incompatíveis e traz deltas absolutos e percentuais de CPU, memória e atraso do event loop. PIDs continuam sendo parte da chave de comparação; processos recriados podem não ter par equivalente.

### Consulta de artefatos

`consultar_captura` acessa componentes tipados da captura concluída. `eventos` e `amostras_processos` são paginados por `depoisDe` e `limite`; telas retornam imagem. A consulta de capturas concluídas depende do índice em memória da sessão atual: depois de reiniciar o aplicativo, os arquivos podem continuar no disco, mas não são redescobertos automaticamente.

## Artefatos, segurança e limites

Cada captura é criada em diretório temporário e renomeada somente ao fim. Finalizações concorrentes compartilham a mesma Promise; chamadas posteriores reutilizam o resultado concluído. Bloqueios transitórios de rename com EPERM, EACCES ou EBUSY permitem mais duas tentativas, após 100 e 200 ms. Falha persistente libera a captura ativa, marca a captura como interrompida, registra captura_finalizacao_falhou/FALHA_PERSISTENCIA e preserva arquivos parciais. O temporizador automático trata a rejeição sem gerar Promise não observada. Os testes de diagnostico-captura.service.test.ts cobrem concorrência, retry e nova captura após falha.

Artefatos:

```text
capturas/<timestamp>-<capturaId>/
├── manifesto.json
├── dossie-agente.json
├── resumo.md
├── contexto-execucao.json
├── marcadores-interface.json
├── linha-do-tempo.json
├── eventos.ndjson
├── erros-captura.json
├── metricas-resumo.json
├── amostras-processos.ndjson
└── tela/interface inicial e final, quando coletadas
```

Uma captura de desempenho não coleta tela nem interface. Ela retém no máximo 300 amostras normalizadas, reserva até 8 MiB aos dados NDJSON e reduz ao perfil essencial sob pressão de persistência ou atraso do event loop. Nesse perfil, conserva apenas processos Browser/GPU e registra a degradação no resumo. Essa condição limita a qualidade da evidência e deve ser considerada antes de concluir que não existe gargalo.

A sessão usa token aleatório, pipe local e ACL do usuário atual no arquivo de descoberta. Não abre porta TCP. O token é comparado em tempo constante e não entra em logs ou metadados. A sanitização redige campos sensíveis, valores e texto visível de eventos; screenshots e estrutura de interface ainda podem conter conteúdo pericial, portanto ficam locais e temporários. Não transfira artefatos sem avaliar o conteúdo.

A retenção preserva a sessão ativa e remove sessões antigas até restarem cinco e 100 MiB. Escritas de artefato podem falhar parcialmente antes do rename, deixando diretório `.tmp`.

## Invariantes e alteração coordenada

- O renderer não recebe Node/Electron; toda ação continua pela ponte segura.
- O MCP só existe no desenvolvimento não empacotado e com variável explícita.
- Mudança de ferramenta deve manter alinhados contratos compartilhados, registro MCP, roteamento no main e testes.
- Nova sonda deve definir sanitização, custo, eventos e desligamento.
- Ação de interface exige uma revisão válida; não introduza seletor arbitrário persistível.
- Comparação de desempenho só é interpretável sob o mesmo cenário e protocolo.

## Verificação

A cobertura automatizada inclui contratos/envelopes, sessão, ACL, pipe, encerramento, NDJSON, sanitização, captura única, artefato, idempotência, limite de amostras, degradação, métricas, comparação e source maps.

A validação manual complementar é iniciar `npm run dev:diagnostico`, confirmar `diagnostico_status` e executar uma captura curta do cenário desejado. Não há teste automatizado de Electron com a janela real para todas as sondas de preload/TinyMCE, recuperação de capturas após reinício ou retenção durante captura.

## Eventos específicos do editor de laudos

`diagnostico-editor-laudo.ts`, `useGerenciadorAlteracoesLaudo.ts`, `LaudosPage.tsx` e `TinyMceEditor.tsx` registram o tipo `editor_laudo` somente durante captura de problema. O preload confere a finalidade e o main repete essa guarda antes de validar `schemaEventoEditorLaudo` estrito. Evento inválido é descartado. O fluxo não acrescenta ferramenta MCP nem coleta esses detalhes em captura de desempenho.

Os eventos correlacionam sessão, montagem, modo single/multi, origem e tentativa de inicialização: script, setup, init, prontidão, timeout, remoção, comparação e salvamento. A comparação relata tamanhos, quantidades de âncoras ocultas/prévias e até dez diferenças com posição estrutural, tag, nome do atributo e categoria. Diferenças textuais registram comprimentos e contagens de espaços, nunca o texto, HTML, valores de atributos ou imagens. A travessia limita o resultado a dez diferenças, mas o parsing inicial ainda percorre os dois documentos; esse custo só é assumido durante a captura de problema.

Sondas de iframe esperam `data-diagnostico-pronto="true"`, definido no callback final de inicialização. Ao iniciar a captura, o preload detecta editores já prontos; durante inicialização/encerramento, desconecta o observador de iframes. Logs usuais de timeout continuam disponíveis fora da captura, com metadados de fase e recursos, sem HTML.

`diagnostico-editor-laudo.test.ts` verifica finalidade, resumo estrutural, limite de diferenças e rejeição de campos extras; `tiny-mce-editor-inicializacao.component.test.tsx` verifica a liberação das alterações após o callback inicial. Ambos são simulados e não comprovam todas as sondas em iframe Electron real.

## Falhas funcionais do GDL

Durante instrumentação IPC, uma resposta `success: false` de canal `gdl:*` pode acrescentar `falha` estruturada ao evento. O preload normaliza e o main repete a validação: código, etapa e código de sistema pertencem a listas fechadas; HTTP é inteiro de 100–599, referência tem formato UUID e bloqueio temporário exige prazo inteiro entre 1–60 segundos. O evento não recebe detalhes textuais, payload da consulta, credenciais ou campos extras da resposta.

As listas canônicas estão em `src/shared/types/gdl-minhas-reps.types.ts`. Como o preload sandboxed não pode depender desses imports em execução, mantém cópias locais das listas e do normalizador em `src/preload/index.ts`; mantê-las alinhadas ao normalizador de `diagnostico-eventos.service.ts` é obrigatório ao estender classificações. Esse metadado não amplia as ferramentas MCP nem habilita diagnóstico fora do modo explícito de desenvolvimento.

`diagnostico-captura.service.ts` incorpora falhas GDL de eventos IPC com duração às anomalias e classifica rede/timeout como `conectividade`, credenciais/autenticação/sessão como `autenticacao` e demais falhas como `integracao_gdl`. Classes são cumulativas com sinais de layout/rolagem e gargalos de processo. Para inferir `desempenho` por IPC lento, exclui eventos com falha GDL conhecida; as métricas gerais e seus alvos continuam presentes. Lentidão de uma falha de rede, sozinha, não comprova regressão do aplicativo.

Com falhas GDL, os próximos passos orientam investigar categoria/etapa e verificar conexão/VPN sem presumir o estado da VPN. `diagnostico-ipc.test.ts`, `diagnostico-eventos.service.test.ts` e `diagnostico-captura.service.test.ts` verificam normalização, metadados e classificação com respostas simuladas. Mensagens da interface e bloqueio web estão em `spec/08 gdl/api_gdl.md`.

## Incidentes gráficos e evidências de GPU

`src/main/bootstrap.ts` chama `prepararDiagnosticoGpu()`, de `src/main/diagnostico-gpu.ts`, antes do ready. Somente no modo explícito de diagnóstico em desenvolvimento prepara a sessão, o arquivo `chromium-gpu.log` e switches de logging/vmodule do Chromium. A sessão MCP reutiliza o mesmo ID e diretório. A observação gráfica atua durante toda essa sessão, independentemente de haver captura guiada em andamento. A preparação não altera os switches de aceleração gráfica; falha da coleta auxiliar não impede abrir o aplicativo. Os snapshots fatais independentes continuam com o escopo descrito acima.

`diagnostico-gpu.service.ts` coleta Browser/GPU/Renderer a cada 2 s e lê o log a cada 1 s, com histórico prévio de 120 s, até 61 amostras e 1.000 linhas. Obtém ambiente inicial e em gpu-info-update, com timeout de 3 s e campos técnicos normalizados. Uma saída do processo GPU gera incidente UUID; ocorrências nos primeiros 60 s do incidente são agrupadas. Código 34 recebe `contexto_grafico_perdido`; outros recebem `processo_gpu_encerrado`, sem concluir causa de driver/hardware.

O incidente conserva ambiente anterior e sua idade, contexto limitado das janelas, amostras, log e acompanhamento posterior. Novo PID de GPU confirma recuperação; aos 15 s a ocorrência ainda sem confirmação fica inconclusiva, atualiza ambiente/log e consulta eventos Windows. Há nova correlação aos 60 s; amostras e logs posteriores são incorporados até 75 s. Encerramento cancela timers, aguarda tarefas e persiste ocorrências ainda pendentes como inconclusivas com lacuna explícita.

### Consulta e integração com capturas

`diagnostico_status` inclui o resumo GPU. A ferramenta `consultar_gpu` usa schema estrito em `src/shared/diagnostico/contratos.ts`: componente `resumo` (padrão), `ambiente`, `incidente`, `logs_nativos` ou `eventos_windows`. Componentes individuais exigem incidenteId UUID; paginação usa depoisDe não negativo e limite 1–200 (padrão 50). Incidente ausente ou removido retorna `INCIDENTE_GPU_NAO_ENCONTRADO`. A consulta opera no mapa da sessão atual, sem reabrir dossiês antigos do disco.

`criar_snapshot` e as capturas guiadas gravam `gpu.json` com resumo e detalhes limitados; `consultar_captura(componente=gpu)` lê essa evidência. Ela não duplica o log completo do incidente: aprofundamento usa `consultar_gpu` enquanto disponível. Eventos gpu_encerrada no intervalo da captura acrescentam a classe `falha_grafica` e orientam correlação, cumulativamente com outras classes de causa. O resumo gráfico da sessão pode incluir incidentes anteriores ao intervalo; sua presença isolada não demonstra falha durante a captura nem regressão de desempenho.

### Retenção, sanitização e Windows

Dossiês ficam em `gpu/incidentes/<UUID>.json` no diretório da sessão, com escrita serializada em temporário e rename. O mapa é limitado a 20 incidentes ou 50 MB serializados; remoção de arquivos pode falhar e gera lacuna. Cada incidente guarda até 200 ocorrências, 100 amostras, 1.000 linhas e oito consultas Windows, mantendo totalOcorrencias mesmo quando há truncamento. O log nativo é truncado no próprio arquivo após 20 MB para preservar o handle append do Chromium no Windows; lacunas sinalizam continuidade parcial. A leitura incremental limita cada trecho a 1 MB. Esses limites pertencem à sessão, além da retenção geral descrita nesta spec.

`diagnostico-gpu-dados.ts` limita e sanitiza URLs, caminhos, credenciais, e-mail e documento nas linhas expostas e seleciona campos técnicos do ambiente. O arquivo nativo bruto é produzido antes dessa sanitização; a interface MCP expõe a versão sanitizada. Ausência de ambiente/log, timeout, erro de escrita e truncamento são lacunas, não evidência negativa da falha investigada.

`diagnostico-gpu-windows.ts` executa consulta PowerShell fixa, oculta e somente leitura, com timeout de 5 s. Procura Display 4101 e LiveKernelEvent 141/142/117/116 desde dois minutos antes do incidente até a consulta. Retém metadados de WATCHDOG e disponibilidade do arquivo, sem ler o dump. A correlação distingue dump contemporâneo, relatório antigo e ausência de horário de dump; horário do evento sozinho não comprova uma falha nova. Fora do Windows retorna não aplicável; falta de permissão ou timeout fica explícita.

As suítes `diagnostico-gpu-bootstrap.test.ts`, `diagnostico-gpu.service.test.ts`, `diagnostico-gpu-dados.test.ts`, `diagnostico-gpu-windows.test.ts`, contratos, sessão e captura verificam o fluxo com dependências simuladas. `scripts/diagnostico/smoke-gpu.mjs` oferece smoke específico; as simulações não comprovam recuperação real de GPU/driver no Windows.

## Exercício automatizado manual do editor

`npm run test:carga` usa Electron real com dados fictícios isolados e capturas de desempenho em segmentos de 30 segundos. Essa ferramenta de desenvolvimento não amplia o contrato MCP nem habilita diagnóstico no aplicativo comum ou empacotado. Somente seus unitários são executados no CI. Comandos, isolamento, evidências e limites estão em [Testes de carga do editor](testes_carga_editor.md).
