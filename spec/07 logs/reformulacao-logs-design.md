# Reformulação do Sistema de Logs — Design

> **Status**: Design aprovado (2025-06-15)
> **Objetivo**: Reduzir verbosidade, enriquecer erros, padronizar datas, corrigir backup/restauração e tornar trilha REP/Laudo amigável ao perito.

---

## 1. Thresholds e Higiene de Logs de Sistema

**Regra**: arquivos em disco (`combined.log`, `error.log`) só gravam `warn`+. Console dev mantém `info`/`debug` colorido.

### Novos thresholds padrão

Todos os módulos sobem para `warn`, exceto `ia` (`debug`), `ilustracao` (`warn`), `renderer` (`warn`):

```
database, auth, laudo, template, rep, solicitante, tipo_exame, placeholder,
backup, configuracao, sistema, ipc, security, wizard, peca, regra-wizard,
gdl, exportacao → warn
```

### Logs info removidos ou rebaixados a `debug`

| Arquivo | Mensagens afetadas | Destino |
|---------|-------------------|---------|
| `base.service.ts` | `"tabela X criado"`, `"tabela X atualizado"`, `"tabela X excluído"` | Removidos (auditoria já cobre) |
| `database/index.ts` | ~40 mensagens de migration passo-a-passo, "Teste de conexão OK", "Schema inicial criado", "Migrations aplicadas" | `debug` |
| `database/sqlite.ts` | "Conectando ao banco", "Conexão estabelecida", "Teste de conexão OK" | `debug` |
| `ipc/index.ts` | "Registrando handlers IPC", "Handlers registrados com sucesso", "Login bem-sucedido", "Logout solicitado" | `debug` |
| `backup.service.ts` | ~12 mensagens de passos de backup/restauração | `debug` |
| `logger.ts` | "Sistema de logs inicializado", "Log antigo removido", "Logs do sistema limpos" | `debug` |

**Resultado**: `combined.log` cresce ~90% mais devagar, contendo apenas `warn` e `error`.

---

## 2. Enriquecimento de Mensagens de Erro

### Princípio

Toda chamada `log.error()` deve responder na própria mensagem: **o que falhou + em qual contexto + qual entidade**.

### Exemplos GDL

| Antes | Depois |
|-------|--------|
| `log.error('Falha no teste de conexão GDL', { erro })` | `log.error('Falha no teste de conexão GDL em ambiente Produção', { erro, endpoint })` |
| `logError('Erro no handler gdl:consultar-rep', error)` | `logError('Falha ao consultar REP 045-2026 no GDL (Homologação)', error)` |
| `log.error('Erro ao buscar REPs ordenadas', error)` | `log.error('Erro ao buscar REPs ordenadas', error)` — já ok, sem entidade específica |
| `log.error('Erro ao deletar laudo', { laudoId, error })` | `log.error('Falha ao excluir laudo da Requisição 045-2026', error)` |

### Regra para handlers

Handlers **não devem** logar erro genérico e depois retornar `error.message`. Devem:
1. Passar o contexto completo no `log.error()` (entidade, parâmetros)
2. Retornar mensagem amigável ao renderer (pode ser mais enxuta)

### Regra para serviços

Serviços incluem na mensagem de erro os **parâmetros de entrada** relevantes (id, numero, ambiente), não só no `meta`.

---

## 3. Padronização de Data/Hora — Formato Brasileiro

| Local | Formato atual | Novo formato |
|-------|--------------|--------------|
| Arquivos JSON (`combined.log`, `error.log`) | ISO 8601 | `DD/MM/AA HH:mm:ss` |
| Console dev | `YYYY-MM-DD HH:mm:ss` | `DD/MM/AA HH:mm:ss` |
| UI (LogsPage, timeline, diálogos) | `DD/MM/YY HH:mm:ss` | `DD/MM/AA HH:mm:ss` |
| Banco `logs_auditoria.created_at` | UTC (CURRENT_TIMESTAMP) | Mantém UTC. Exibição converte na UI |

### Implementação

Trocar `winston.format.timestamp()` por `winston.format.timestamp({ format: 'DD/MM/YY HH:mm:ss' })` no `fileFormat` e `consoleFormat` do `logger.ts`.

---

## 4. Backup e Restauração — Auditoria de REPs e Laudos

### Mudança no backup

Hoje:
```
cópia do DB → DELETE FROM logs_auditoria → VACUUM → ZIP
```

Passa a ser:
```
cópia do DB → DELETE FROM logs_auditoria WHERE modulo NOT IN ('rep', 'laudo') → VACUUM → ZIP
```

**Resultado**: ao restaurar backup, registros de auditoria de REPs e Laudos voltam. Demais (login, backup, export, limpeza, etc.) são descartados.

### Logs de sistema (Winston)

Continuam **fora** do backup. Arquivos em `userData/logs/` nunca entram no ZIP.

---

## 5. Trilha REP/Laudo Multi-Página com Mensagens Amigáveis

### Páginas com acesso à trilha

| Página | Como acessa | Componente |
|--------|-------------|------------|
| LogsPage (aba Timeline) | Busca por nº da REP | `DualTrackTimeline` (já existe) |
| REPsPage | Botão "Linha do Tempo" na linha da REP | `RepTimelineDialog` (já existe) |
| LaudosPage | Botão "Histórico" no laudo | Timeline do laudo via `listAuditLogs({ entidade_id })` |
| Dashboard (futuro) | Widget "Últimas atividades" | `listAuditLogs({ limit: 5 })` |

### Mensagens amigáveis (português de perito)

NUNCA expor UUIDs. Sempre usar número da REP. Símbolos `→` permitidos para transições de status.

| Evento | Mensagem |
|--------|----------|
| REP criada | `Requisição 045-2026 registrada` |
| Status REP alterado | `Requisição 045-2026: Pendente → Em andamento` |
| REP excluída | `Requisição 045-2026 removida` |
| Laudo iniciado (manual) | `Laudo da Requisição 045-2026 iniciado` |
| Laudo iniciado (automático) | `Laudo da Requisição 045-2026 iniciado automaticamente` |
| Conteúdo salvo | `Laudo da Requisição 045-2026 salvo (versão 2)` |
| Laudo concluído | `Laudo da Requisição 045-2026: Em andamento → Concluído` |
| Laudo entregue | `Laudo da Requisição 045-2026: Concluído → Entregue` |
| Laudo excluído (REP resetada) | `Laudo da Requisição 045-2026 excluído. Requisição voltou a Pendente` |
| Laudo preenchido pelo wizard | `Laudo da Requisição 045-2026 preenchido pelo assistente` |

### Regra de implementação

Handlers que auditam laudos devem buscar o número da REP (`repService.findById(laudo.rep_id)`) antes de compor a mensagem, para nunca expor UUIDs.

---

## 6. Retenção

| Tipo | Retenção | Observação |
|------|----------|------------|
| Arquivos Winston (`combined.log`, `error.log`) | 30 dias | `cleanupOldLogs()` já existe. Arquivos rotativos: 5 MB, máx 5 arquivos |
| Tabela `logs_auditoria` (SQLite) | Indefinido | Rastreabilidade legal. Limpeza manual via LogsPage com senha |

---

## 7. Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/main/utils/logger.ts` | Thresholds padrão, timestamp BR, `setupLogging` → debug |
| `src/main/services/base.service.ts` | Remover `log.info` de create/update/delete |
| `src/main/database/index.ts` | ~40 mensagens de migration → `debug`, remover "Teste de conexão OK" |
| `src/main/database/sqlite.ts` | Mensagens de conexão → `debug` |
| `src/main/ipc/index.ts` | Handlers registrados, login/logout → `debug` |
| `src/main/services/backup.service.ts` | Passos → `debug`, filtro `WHERE modulo NOT IN ('rep','laudo')` |
| `src/main/services/gdl.service.ts` | Enriquecer erros com ambiente/REP |
| `src/main/ipc/handlers/gdl.handlers.ts` | Enriquecer erros com ambiente/REP |
| `src/main/services/rep.service.ts` | Enriquecer msgs de erro |
| `src/main/services/laudo.service.ts` | Enriquecer msgs de erro |
| `src/main/ipc/handlers/rep.handlers.ts` | Mensagens de auditoria amigáveis, enriquecer erros |
| `src/main/ipc/handlers/laudo.handlers.ts` | Mensagens de auditoria amigáveis (buscar nº REP), enriquecer erros |
| `src/renderer/pages/LogsPage.tsx` | `formatarTimestamp` → ano 2 dígitos (`DD/MM/AA`) |
| `src/renderer/pages/REPsPage.tsx` | Botão Timeline → `RepTimelineDialog` |
| `src/renderer/pages/LaudosPage.tsx` | Botão Histórico → timeline |
| Demais ~15 serviços/handlers | Revisar mensagens de erro para incluir contexto |
| `src/shared/types/logger.ts` | Atualizar se necessário (timestamps, tipos) |
| `spec/07 logs/logs.md` | Atualizar spec com novo estado após implementação |

---

## 8. O que NÃO muda

- Arquitetura híbrida (Winston JSON + SQLite auditoria)
- Tabela `logs_auditoria` (schema, índices, colunas)
- `audit-log.service.ts` (interface permanece, só mensagens mudam)
- `BaseService<T>` (só remove infos, mantém erros)
- `log-factory.ts` e `getLogger()` (cache singleton, mesma API)
- Diálogo de limpeza de logs (LogsPage, senha, 2 passos)
- Rate-limit do `user:verifyPassword`
- Exclusão de `logs_auditoria` na limpeza manual (continua total)
- Canais IPC existentes (`log:*`, `rep:*`, `laudo:*`)
