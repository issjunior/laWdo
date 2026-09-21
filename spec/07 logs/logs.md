# Sistema de logs e auditoria

## Camadas atuais

O estado atual dos logs combina:

- `src/main/utils/logger.ts`
- `src/main/services/audit-log.service.ts`
- `src/renderer/pages/LogsPage.tsx`

Sao duas trilhas separadas:

| Trilha | Destino |
|---|---|
| log de sistema | arquivos em `userData/logs` |
| log de auditoria | tabela `logs_auditoria` |

## Logger tecnico

`logger.ts` cria o diretorio `logs` em `app.getPath('userData')` e configura dois arquivos:

- `combined.log`
- `error.log`

Rotacao atual:

- `maxSize = 5 MB`
- `maxFiles = 5`

Formato:

- arquivo: JSON com timestamp `DD/MM/YY HH:mm:ss`
- console em dev: texto colorido

## Modulos e niveis

`LogModule` hoje cobre, entre outros:

- `rep`
- `laudo`
- `ia`
- `gdl`
- `exportacao`
- `secao-builder`

Regra de threshold:

- fallback geral: `warn`
- excecao relevante: `ia = debug`

`getLogger(module)` devolve um singleton por modulo.

## Captura de desempenho

`desempenho.service.ts` grava amostras tecnicas locais em `userData/logs/performance.log`, com rotacao e exportacao CSV. A coleta detalhada fica desligada por padrao para nao acrescentar trabalho ao uso cotidiano; eventos `info` que nao sao essenciais podem ser descartados pelos perfis `importante` e `critico`.

A unica forma de ativar a coleta detalhada e a aba **Desempenho** de `LogsPage`: o usuario escolhe **Iniciar captura** antes de reproduzir o cenario e **Parar captura** ao concluir. A sessao detalhada expira em ate 15 minutos. A captura assistida de diagnostico coleta suas proprias evidencias e nao altera esse estado; portanto, para correlacionar eventos curtos do renderer, a coleta detalhada deve ser iniciada manualmente antes do teste.

As amostras armazenam somente identificadores tecnicos, duracao, contadores e metricas agregadas. Para a atualizacao incremental de placeholders, os metadados permitidos incluem `tabelaB602` e `fallback`, ambos booleanos. Eles indicam, respectivamente, a TABELA 2 B-602 e o uso do caminho completo de contingencia, sem registrar numero de REP, texto, dados de pecas, imagens, nomes ou caminhos locais.

Protocolo para investigar a TABELA 2 B-602:

1. Abrir **Logs > Desempenho** e iniciar a captura detalhada.
2. Abrir o laudo e inserir ou reaplicar a TABELA 2.
3. Parar a captura e exportar o CSV.
4. Procurar `aplicar_visualizacao_incremental` com `tabelaB602=true`, `incremental=true` e `fallback=false`; comparar contadores de placeholders, linhas e celulas entre repeticoes do mesmo cenario.

Essa trilha demonstra a execucao e o volume estrutural do DOM, mas nao mede diretamente reflow, pintura, coleta de lixo ou travamentos do Chromium.

## Leitura e limpeza do log de sistema

Helpers publicos de `logger.ts`:

- `getAllLogs()`
- `clearAllLogs()`

`getAllLogs()` aceita:

- linhas JSON atuais
- linhas legadas em texto

e sempre ordena o resultado por timestamp decrescente.

## Auditoria

`audit-log.service.ts` concentra:

- `auditLogin`
- `auditDelete`
- `auditExport`
- `auditBackup`
- `auditCicloVida`
- `auditLimpezaLogs`

Tambem fornece a camada de consulta:

- `listAuditLogs(filters)`
- `clearAuditLogs()`
- `countAuditLogs()`
- `getTimelineRep(repId)`

`insertAuditLog()` faz `executeNonQuery(...).catch(...)`, entao a auditoria nao bloqueia a operacao principal.

## Snapshots de erros fatais

`diagnostico-state.service.ts` complementa os logs com snapshots locais apenas quando ocorre erro fatal no main ou no renderer. Os arquivos sao gravados em `userData/diagnostico-state-dumps` com sufixo `_estado-snapshot.json`.

Cada snapshot inclui o erro, contexto seguro mais recente do renderer, informacoes do processo e do sistema operacional. A serializacao remove campos sensiveis por chave, limita strings a 500 caracteres, colecoes a 20 itens e profundidade a cinco niveis.

O renderer atualiza rota, hash, titulo da janela, estado do painel de ilustracoes e dados minimizados do usuario via `DiagnosticoBridge`; erros globais e rejeicoes nao tratadas sao enviados ao main. O main tambem registra `uncaughtException` e `unhandledRejection`.

Este mecanismo nao registra uma trilha de sessao, nao gera `eventos.ndjson` e nao possui controles de inicio ou parada na interface.

## `LogsPage`

A pagina do renderer hoje tem quatro abas:

- `sistema`
- `auditoria`
- `timeline`
- `desempenho`

Recursos atuais:

- filtros por modulo, nivel, tipo de acao e intervalo de datas
- exportacao CSV da aba ativa
- contagem separada de registros de sistema e auditoria
- limpeza protegida por senha com dois passos
- busca da timeline por numero de REP
- inicio, encerramento, visualizacao e exportacao da captura de desempenho

## Limpeza protegida

Fluxo atual da limpeza:

1. abre dialog destrutivo
2. mostra contagem de arquivos/registros
3. exige senha do usuario atual via `verifyPassword`
4. executa em paralelo:
   - `window.ipcAPI.log.limpar()`
   - `window.ipcAPI.log.limparAuditoria(userId)`

## Regra pratica

No estado atual, qualquer manutencao em log precisa perguntar em qual trilha ela esta mexendo:

- log tecnico em arquivo
- auditoria em banco
- snapshots de erros fatais
- timeline que agrega eventos de REP e laudo

As trilhas compartilham a pagina de logs apenas parcialmente; elas nao compartilham a mesma persistencia nem o mesmo criterio de limpeza.
