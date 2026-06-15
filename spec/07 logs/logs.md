# Módulo de Logs — LaudoPericial

> **Status**: Reformulado (2025-06-15) — thresholds `warn`, timestamps brasileiros, mensagens amigáveis, erros enriquecidos, backup com auditoria REP/Laudo

---

## Diagnóstico

| Problema | Impacto | Status |
|---|---|---|
| `logDebug` em **toda query SQL** | Em dev, cada SELECT/INSERT/UPDATE escreve arquivo síncrono | Corrigido — thresholds `warn`+ |
| ~100+ `log.info` poluentes | Arquivos de log enormes, sem valor de diagnóstico | Corrigido — removidos ou viram `debug` |
| `logs_auditoria` nunca populada | Sem rastreabilidade de ações de usuário | Implementado (2025-05-29) |
| Backup ZIP excluía `logs_auditoria` | Auditoria perdida ao restaurar backup | Corrigido — filtra só não-REP/Laudo |
| Mensagens de erro sem contexto | "Falha no teste de conexão GDL" sem dizer qual ambiente | Corrigido — erros enriquecidos com entidade/ambiente |
| Mensagens de auditoria com UUIDs | "Laudo abc123-def: Em andamento → Concluído" ilegível | Corrigido — mensagens amigáveis com nº da Requisição |
| Timestamps ISO em arquivos | Dificulta leitura por usuários brasileiros | Corrigido — `DD/MM/AA HH:mm:ss` |

---

## Arquitetura

```
┌──────────────────────────────────────────────────────────────┐
│  src/shared/types/logger.ts  —  Tipos puros (LogModule,      │
│  LogLevel, ILogger, AuditEntry)                              │
└──────────────────────────┬───────────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────────┐
│  src/main/utils/logger.ts   —  Motor central (reescrito)     │
│  • Winston JSON: {timestamp, level, module, message, ...}    │
│  • Transport: File assíncrono + buffer de escrita            │
│  • Lazy eval: só serializa se level >= threshold do módulo   │
│  • Níveis configuráveis por módulo                           │
└───────────┬───────────────────────┬──────────────────────────┘
            │                       │
┌───────────▼───────────┐  ┌───────▼──────────────────────────┐
│ log-factory.ts        │  │ audit-log.service.ts             │
│ getLogger(module)     │  │ • auditLogin / auditDelete       │
│ → {info,warn,         │  │ • auditExport / auditBackup      │
│    error,debug}       │  │ • auditCicloVida (REP/Laudo)     │
│ cache singleton       │  │ • auditLimpezaLogs               │
│ por módulo            │  │ • Fire-and-forget (não bloqueia) │
└───────────────────────┘  └──────────────────────────────────┘
```

### Divisão híbrida de persistência

| Tipo | Destino | Retenção | Backup? |
|---|---|---|---|
| **Sistema** (erros, warns) | `userData/logs/*.log` — JSON rotativo | 30 dias | **Nunca** |
| **Auditoria** (ações sensíveis + ciclo de vida) | Tabela `logs_auditoria` — SQLite | Indefinido | **REP/Laudo** (filtrado: `modulo IN ('rep','laudo')`)

### Princípios de performance

1. **Log lazily** — mensagem só é computada se o nível do log for aceito
2. **Async I/O** — toda escrita em disco/DB é assíncrona
3. **Buffer no renderer** — logs acumulados e enviados em lote a cada 1s
4. **Sem log em hot paths** — queries SQL não geram log por padrão
5. **Fire-and-forget auditoria** — INSERT de auditoria não bloqueia a operação principal

---

## Tabela `logs_auditoria` — Schema Final

```sql
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id TEXT,
    acao TEXT NOT NULL,
    tipo_acao TEXT NOT NULL DEFAULT 'outro',
    modulo TEXT NOT NULL DEFAULT 'sistema',
    entidade TEXT NOT NULL,
    entidade_id TEXT,
    nivel TEXT NOT NULL DEFAULT 'info',
    mensagem TEXT,
    dados_anteriores TEXT,
    dados_novos TEXT,
    detalhes TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_usuario ON logs_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_created ON logs_auditoria(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_modulo ON logs_auditoria(modulo);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_tipo ON logs_auditoria(tipo_acao);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_entidade ON logs_auditoria(entidade, entidade_id);
```

### Colunas adicionadas (migration v19)

| Coluna | Tipo | Default | Adicionada de |
|---|---|---|---|
| `tipo_acao` | TEXT NOT NULL | `'outro'` | Zod schema |
| `modulo` | TEXT NOT NULL | `'sistema'` | Zod schema |
| `nivel` | TEXT NOT NULL | `'info'` | Zod schema |
| `mensagem` | TEXT | — | Zod schema |
| `dados_anteriores` | TEXT | — | Ciclo de vida |
| `dados_novos` | TEXT | — | Ciclo de vida |

### Enums

**`tipo_acao`**: `login`, `logout`, `criacao`, `atualizacao`, `exclusao`, `leitura`, `exportacao`, `importacao`, `backup`, `restauracao`, `configuracao`, `transicao_status`, `limpeza_logs`, `erro`, `outro`

**`modulo`**: `autenticacao`, `usuario`, `solicitante`, `tipo_exame`, `rep`, `laudo`, `imagem`, `placeholder`, `sistema`, `backup`, `exportacao`, `configuracao`, `ia`, `template`

**`nivel`**: `info`, `warning`, `error`, `debug`

---

## Eventos de Ciclo de Vida Rastreados

### REP

| Evento | `tipo_acao` | Mensagem exemplo | Handler |
|---|---|---|---|
| REP criada | `criacao` | `Requisição 045-2026 registrada` | `rep:create` |
| Status alterado | `transicao_status` | `Requisição 045-2026: Pendente → Em andamento` | `rep:update` / `rep:updateStatus` |
| REP excluída | `exclusao` | `Requisição 045-2026 removida` | `rep:delete` |
| REP resetada (laudo excluído) | `transicao_status` | `Requisição 045-2026 voltou a Pendente` | `laudo:delete` |

### Laudo

| Evento | `tipo_acao` | Mensagem exemplo | Handler |
|---|---|---|---|
| Laudo criado | `criacao` | `Laudo da Requisição 045-2026 iniciado` | `laudo:create` / `rep:create` |
| Laudo criado automático | `criacao` | `Laudo da Requisição 045-2026 iniciado automaticamente` | `rep:create` / `rep:update` |
| Conteúdo salvo | `atualizacao` | `Laudo da Requisição 045-2026 salvo (versão 2)` | `laudo:updateConteudo` |
| Status → Concluído | `transicao_status` | `Laudo da Requisição 045-2026: Em andamento → Concluído` | `laudo:updateStatus` |
| Status → Entregue | `transicao_status` | `Laudo da Requisição 045-2026: Concluído → Entregue` | `laudo:updateStatus` |
| Laudo excluído | `exclusao` | `Laudo da Requisição 045-2026 excluído. Requisição voltou a Pendente` | `laudo:delete` |

**Regra**: mensagens NUNCA expõem UUIDs. Sempre usam o número da Requisição. Símbolo `→` usado para transições de status.

---

## Níveis de Log por Módulo (Defaults)

Todos os módulos em `warn`, exceto `ia` em `debug`, `ilustracao` e `renderer` em `warn`.

```json
{
  "database": "warn",
  "auth": "warn",
  "renderer": "warn",
  "ilustracao": "warn",
  "ia": "debug",
  "sistema": "warn",
  "rep": "warn",
  "laudo": "warn",
  "template": "warn",
  "solicitante": "warn",
  "tipo_exame": "warn",
  "placeholder": "warn",
  "backup": "warn",
  "configuracao": "warn",
  "ipc": "warn",
  "security": "warn",
  "wizard": "warn",
  "peca": "warn",
  "regra-wizard": "warn",
  "gdl": "warn",
  "exportacao": "warn"
}
```

Fallback `shouldLog` default: `'warn'` (qualquer módulo novo herda warn).

---

## Diálogo de Exclusão de Logs (shadcn/ui)

**Componentes usados**:
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`
- `Button` (variant destructive / outline)
- `Input` (type password)
- `Label`
- `Alert`, `AlertTitle`, `AlertDescription`
- `Separator`
- Ícones lucide-react: `ShieldAlert`, `Lock`, `AlertTriangle`, `Trash2`

**Fluxo**:
1. Botão "Limpar Logs" (destructive) → abre Dialog
2. Dialog mostra:
   - Ícone `ShieldAlert` + título "Exclusão de Registros do Sistema"
   - Subtítulo: "Esta ação é irreversível e será registrada"
   - Cards com contagem: sistema (N arquivos) + auditoria (M registros)
   - Aviso legal sobre autenticação obrigatória
   - Campo de senha com `Lock` icon
3. Ao submeter:
   - `user:verifyPassword(userId, senha)` → valida credencial
   - `log:limpar` → trunca arquivos Winston
   - `log:limpar-auditoria` → DELETE FROM logs_auditoria
   - Registra ação: `auditLimpezaLogs(userId)`
   - Toast de confirmação

---

## Plano de Execução

### Onda A — Imediato (Sistema de Logs + Auditoria + Ciclo REP)

| # | Fase | Arquivos | Descrição |
|---|---|---|---|
| A1 | Tipos compartilhados | `src/shared/types/logger.ts` (novo) | Interfaces `LogModule`, `LogLevel`, `ILogger`, `AuditEntry`, `LogEntry`. **Nota:** O `LOG_MODULES` em `shared/types/logger.ts` não inclui `'gdl'` — o tipo `LogModule` em `logger.ts` é a fonte autoritativa. |
| A2 | Migração `logs_auditoria` v19 | `src/main/database/index.ts` | Adicionar 6 colunas + índices |
│ A3 | Motor central JSON | `src/main/utils/logger.ts` (reescrito) | Substitui `logger.ts` antigo — Winston JSON, buffer assíncrono, lazy eval, níveis por módulo |
| A4 | Logger factory | `src/main/utils/log-factory.ts` (novo) | `getLogger(module): ILogger` com cache singleton |
| A5 | Audit log service | `src/main/services/audit-log.service.ts` (novo) | `auditLogin`, `auditDelete`, `auditExport`, `auditBackup`, `auditCicloVida`, `auditLimpezaLogs` |
| A6 | Wire auditoria — handlers existentes | 8 handlers | Login, delete (solicitante, tipo_exame, rep, laudo, template, placeholder), backup, export |
| A7 | Wire ciclo de vida REP | `rep.handlers.ts` | create, updateStatus, update, delete |
| A8 | Wire ciclo de vida Laudo (criação/delete) | `laudo.handlers.ts` | create, delete, updateConteudo |
| A9 | Exclusão do backup | `backup.service.ts` | Limpar `logs_auditoria` do DB temporário antes de zipar |
| A10 | IPC handlers | `ipc/index.ts`, `log.handlers.ts` | `user:verifyPassword`, `log:limpar-auditoria`, `log:contar`, batch IPC |
| A11 | Preload bridge | `preload/index.ts`, `preload/types.ts` | Batch buffer, expor `verifyPassword`, `log.limparAuditoria`, `log.contar` |
| A12 | Migração imports main | ~30 arquivos | `logInfo/Error/Warn` → `getLogger(module).info/error/warn` |
| A13 | Dialog de senha + LogsPage | `src/renderer/pages/LogsPage.tsx` | Dialog profissional shadcn/ui, filtro por módulo, abas Sistema/Auditoria |
| A14 | Limpeza console renderer | ~10 páginas | `console.*` → `window.ipcAPI.logInfo(module, msg)` |

### Onda B — Ciclo de Vida Completo do Laudo ✅

| # | Fase | Arquivos | Descrição |
|---|---|---|---|
| B1 | `laudo:updateStatus` handler | `laudo.handlers.ts` | IPC handler para transição de status |
| B2 | `laudoService.updateStatus` | `laudo.service.ts` | Atualiza status + preenche `data_conclusao`/`data_entrega` |
| B3 | Wire auditoria ciclo Laudo | `laudo.handlers.ts` | Auditoria nas transições concluído/entregue |
| B4 | UI de transição de status | `LaudosPage.tsx` | Botões para concluir/entregar/reabrir laudo |
| B5 | Preload + channels | `preload/index.ts`, `renderer/index.tsx` | Canal `laudo:updateStatus`, mock atualizado |

---

## IPC Handlers (Visão Geral)

| Canal | Direção | Descrição | Onda |
|---|---|---|---|
| `user:verifyPassword` | renderer → main | `(userId, senha) → { valid: boolean }` | A |
| `log:listar` | renderer → main | `(filtros?) → { data: LogEntry[] }` — JSON parseado | A |
| `log:listar-auditoria` | renderer → main | `(filtros?) → { data: AuditEntry[] }` | A |
| `log:limpar` | renderer → main | `() → { success }` — limpa arquivos Winston | A |
| `log:limpar-auditoria` | renderer → main | `(userId) → { success, registrosAfetados }` | A |
| `log:contar` | renderer → main | `() → { sistema: number, auditoria: number }` | A |
| `laudo:updateStatus` | renderer → main | `(laudoId, status, userId) → LaudoRow` | B |

---

## Log de Implementação

| Data | Onda | Fase | O quê | Notas |
|---|---|---|---|---|
| 2025-05-29 | — | — | Plano criado | — |
| 2025-05-29 | A1 | Tipos | `src/shared/types/logger.ts` criado com `LogModule`, `LogLevel`, `TipoAcao`, `ILogger`, `SystemLogEntry`, `AuditEntry`, `LogFilters`, etc. | Tipos puros, sem dependências |
| 2025-05-29 | A2 | Migração v19 | 6 colunas adicionadas à `logs_auditoria`: `tipo_acao`, `modulo`, `nivel`, `mensagem`, `dados_anteriores`, `dados_novos`. Índices criados: `idx_logs_auditoria_modulo`, `idx_logs_auditoria_tipo`, `idx_logs_auditoria_entidade`. `CURRENT_SCHEMA_VERSION` = 19 (atualmente 24). | `database/index.ts`, `shared/types/database.ts` |
| 2025-05-29 | A3 | Motor JSON | `logger.ts` reescrito: Winston formato JSON para arquivos, texto colorido para console dev. Filtro por módulo (`shouldLog`), lazy eval em `debug()`, `getLogger(module)` com cache singleton. Níveis por módulo: database=info, renderer=warn, ilustracao=warn, ia=debug. | Motor central, maior refatoração |
| 2025-05-29 | A4 | Factory | `log-factory.ts` — wrapper `createLogger(module)` que usa o cache do `getLogger`. | Thin wrapper |
| 2025-05-29 | A5 | Audit service | `audit-log.service.ts`: `auditLogin`, `auditLogout`, `auditDelete`, `auditExport`, `auditBackup`, `auditCicloVida`, `auditLimpezaLogs`, `listAuditLogs`, `clearAuditLogs`, `countAuditLogs`. Fire-and-forget (INSERT não bloqueia). | `src/main/services/audit-log.service.ts` |
| 2025-05-29 | A6 | Wire auditoria | Login/logout (`ipc/index.ts`), delete handlers: solicitante, tipo_exame, template, placeholder, categoria, backup (criar/restaurar), config export/import. | 8+ handlers alterados |
| 2025-05-29 | A7 | Ciclo REP | `rep:create` → auditCicloVida(criacao), `rep:updateStatus` → auditCicloVida(transicao_status), `rep:update` → auditCicloVida se status mudou, `rep:delete` → auditDelete. | `rep.handlers.ts` |
| 2025-05-29 | A8 | Ciclo Laudo | `laudo:create` → auditCicloVida(criacao), `laudo:updateConteudo` → auditCicloVida(atualizacao), `laudo:delete` → auditDelete + audit REP reset. Laudos auto-criados via `rep:create` e `rep:update` também auditados. | `laudo.handlers.ts`, `rep.handlers.ts` |
| 2025-05-29 | A9 | Exclusão backup | `backup.service.ts` — cópia temporária do DB → DELETE FROM logs_auditoria → VACUUM → ZIP. Arquivo temp removido após ZIP. | `backup.service.ts` |
| 2025-05-29 | A10 | IPC handlers | `log:listar-auditoria`, `log:limpar-auditoria`, `log:contar` em `log.handlers.ts`. `user:verifyPassword` com rate-limit em `user.handlers.ts`. Batch IPC `log-batch`. Log relay atualizado para aceitar `module` param. | 3 arquivos alterados |
| 2025-05-29 | A11 | Preload | `logInfo/Error/Warning` agora aceitam `module` como 1º param. Adicionado `verifyPassword`, `log.listarAuditoria`, `log.limparAuditoria`, `log.contar`. Batch via `log-batch`. | `preload/index.ts`, `preload/types.ts` |
| 2025-05-29 | A12 | Imports main | ~30 arquivos migrados de `logInfo/Error` para `getLogger(module)`. Serviços, database, security, ipc index. `LogModule` expandido com `ipc` e `security`. Tipo `log.error()` aceita `unknown`. | Todos os serviços, database, security, ipc |
| 2025-05-29 | A13 | LogsPage | Refatorada com abas Sistema/Auditoria. Filtros por módulo, nível, tipo_ação, data. Dialog de confirmação com senha (2 passos): 1) verifica senha com `user:verifyPassword`, 2) confirma exclusão. Exclusão audita com `auditLimpezaLogs`. | `LogsPage.tsx` reescrito |
| 2025-05-29 | A14 | Limpeza console | ErrorBoundary: `console.error` removidos, `window.electronAPI` → `window.ipcAPI`. Mock fallback do renderer atualizado com `laudo`, `verifyPassword`, `log.listarAuditoria` etc. | `ErrorBoundary.tsx`, `renderer/index.tsx` |
| 2025-05-29 | B1 | laudo:updateStatus | IPC handler `laudo:updateStatus(laudoId, status)` com validação de status e auditoria. | `laudo.handlers.ts` |
| 2025-05-29 | B2 | laudoService.updateStatus | Método `updateStatus(id, status)` — atualiza status + preenche `data_conclusao`/`data_entrega` conforme o novo status. | `laudo.service.ts` |
| 2025-05-29 | B3 | Wire auditoria | `auditCicloVida('transicao_status')` no handler `laudo:updateStatus` com antes/depois completos. | `laudo.handlers.ts` |
| 2025-05-29 | B4 | UI de status | Botões na coluna de ações da tabela de laudos: Concluir (Em andamento→Concluído), Entregar (Concluído→Entregue), Reabrir (Concluído→Em andamento, Entregue→Concluído). Ícones: List, Send, RefreshCw. | `LaudosPage.tsx` |
| 2025-05-29 | B5 | Preload/channels | `laudo:updateStatus` adicionado ao IpcAPI, ALLOWED_CHANNELS, hook de API e renderer mock. | `preload/index.ts`, `renderer/index.tsx` |
| 2025-05-29 | — | Fixes | `LogModule` adicionado `ipc` e `security`. `log.error()` aceita `unknown`. Imports restaurados em `database/index.ts`. Fallback `logInfo/Error` do IPC removido em favor de `getLogger('sistema')`. | Vários arquivos |

---

## Pontos de Atenção para Manutenção

### Arquivos de log

- **Formato**: JSON (uma linha = um objeto). Timestamps em formato brasileiro: `DD/MM/AA HH:mm:ss`. O parser em `logger.ts:getAllLogs()` lê tanto JSON quanto o formato legado `[timestamp] LEVEL: message`.
- **Localização**: `%APPDATA%/laWdo/logs/combined.log` e `error.log`
- **Rotação**: 5 MB por arquivo, máximo 5 arquivos
- **Retenção**: `cleanupOldLogs()` remove arquivos com mais de 30 dias
- **Threshold em disco**: `warn`+ (só erros e avisos vão para arquivo). Console dev mantém todos os níveis.

### Níveis por módulo

Definidos em `moduleLogLevels` no `logger.ts`. Todos em `warn`, exceto `ia` (`debug`). Alterações em runtime via `setModuleLogLevel(module, level)`. O fallback do `shouldLog` é `'warn'`.

### Logs de auditoria

- Tabela `logs_auditoria` no SQLite, migration v19 adicionou 6 colunas
- Inserção é **fire-and-forget**: não bloqueia a operação principal
- No backup ZIP, apenas registros de REP e Laudo são preservados (`WHERE modulo IN ('rep','laudo')`). Demais são excluídos da cópia de backup
- Limpeza manual via LogsPage exige senha e registra `limpeza_logs`

### `user:verifyPassword`

- Rate-limit: 3 tentativas em 30 segundos
- Usado para limpeza de logs e exclusão de laudos finalizados
- Não retorna dados do usuário, apenas `{ valid: boolean }`

### Mensagens de erro enriquecidas

Toda chamada `log.error()` segue o padrão: **o que falhou + contexto + entidade**.

Exemplos:
- `log.error('Falha no teste de conexão GDL em ambiente Produção', { erro, endpoint })`
- `log.error('Falha ao consultar REP 045-2026 no GDL (Homologação)', { erro, numero, ano })`
- `log.error('Erro ao criar Requisição', { numero, error })`

### BaseService

Operações CRUD (`create`, `update`, `delete`) não geram mais `log.info` no `base.service.ts`. A rastreabilidade é coberta pelos logs de auditoria na tabela `logs_auditoria`. Apenas erros são logados.

### Logs operacionais em debug

Mensagens de migration, conexão com banco, registro de handlers IPC, passos de backup e outros logs operacionais estão em nível `debug` — visíveis apenas no console dev, nunca em disco.
