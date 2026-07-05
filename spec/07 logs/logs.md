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

## `LogsPage`

A pagina do renderer hoje tem tres abas:

- `sistema`
- `auditoria`
- `timeline`

Recursos atuais:

- filtros por modulo, nivel, tipo de acao e intervalo de datas
- exportacao CSV da aba ativa
- contagem separada de registros de sistema e auditoria
- limpeza protegida por senha com dois passos
- busca da timeline por numero de REP

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
- timeline que agrega eventos de REP e laudo

As tres compartilham a pagina de logs, mas nao compartilham a mesma persistencia nem o mesmo criterio de limpeza.
