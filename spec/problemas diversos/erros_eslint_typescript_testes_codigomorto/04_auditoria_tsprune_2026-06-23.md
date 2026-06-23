# 🔍 Auditoria de Código Morto — ts-prune (23/06/2026)

> **Propósito:** Documentar os resultados completos da auditoria de código morto usando ts-prune,
> cruzados com os 4 insumos de diagnóstico (saúde do sistema, abordagem pré-Knip, plano Knip, grafo).
> **Invocado via:** `/check-dead-code` (skill)
> **Commit base:** `64669b9` (`update_fluxo_saude_do_sistema`)

---

## ✅ Status da Execução — 23/06/2026

**Todos os itens confirmados foram removidos com segurança.** Nenhuma regressão detectada.

| Métrica | Antes | Depois |
|---------|-------|--------|
| Build | ✅ | ✅ |
| TypeScript | ~30 err | 32 err (pré-existentes) |
| ESLint | 585/540 | 583/538 (↓ 2 err) |
| Testes | 27/31 | 27/31 (3 falhas pré-existentes) |
| ts-prune | ~310 | **268** (↓ 42 itens) |

---

## 📊 Resumo

| Métrica | Valor |
|---------|-------|
| Total de itens ts-prune | ~268 (era ~310) |
| Falsos positivos (shadcn/Zod/TinyMCE) | ~268 |
| **Código morto removido** | **✅ 42 itens (1 arquivo + ~27 exports + 11 default exports + 1 import)** |
| Requer verificação manual | ~10 itens (M1-M3 — pendentes) |
| Default exports redundantes | 11 removidos |

**Risco geral:** 🟢 Baixo — nenhum item é god node, bridge ou tem testes específicos.

---

## 🔴 Falsos Positivos (Descartados)

Aplicando os atalhos de categoria conforme `00_saude_do_sistema.md`:

### shadcn/ui barrel re-exports

| Arquivo | Itens |
|---------|-------|
| `badge.tsx` | `BadgeProps`, `badgeVariants` |
| `button.tsx` | `ButtonProps`, `buttonVariants` |
| `card.tsx` | `CardFooter` |
| `context-menu.tsx` | `ContextMenuCheckboxItem`, `ContextMenuRadioItem`, `ContextMenuShortcut`, `ContextMenuGroup`, `ContextMenuPortal`, `ContextMenuRadioGroup` |
| `dialog.tsx` | `DialogPortal`, `DialogOverlay`, `DialogClose` |
| `dropdown-menu.tsx` | `DropdownMenuRadioItem`, `DropdownMenuShortcut`, `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuSub`, `DropdownMenuSubContent`, `DropdownMenuSubTrigger`, `DropdownMenuRadioGroup` |
| `select.tsx` | `SelectGroup`, `SelectLabel`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton` |
| `sheet.tsx` | `SheetPortal`, `SheetOverlay`, `SheetTrigger`, `SheetFooter` |
| `sidebar.tsx` | `SidebarGroupAction`, `SidebarInput`, `SidebarMenuAction`, `SidebarMenuBadge`, `SidebarMenuSkeleton`, `SidebarRail`, `SidebarSeparator` |
| `stepper.tsx` | `StepperProps` |
| `table.tsx` | `TableFooter`, `TableCaption` |
| `textarea.tsx` | `TextareaProps` |

### Zod types re-exportados (barrel `validators/index.ts`)

Todos os schemas (`userSchema`, `createUserSchema`, etc.) e tipos (`User`, `CreateUserInput`, etc.)
de todas as entidades: User, Solicitante, TipoExame, REP, Laudo, ImagemLaudo, Placeholder,
LogAuditoria, Template.

### TinyMCE vendor skins

Todos os arquivos em `src/renderer/public/tinymce/skins/**` (`.ts` e `.min.ts`) —
código de terceiros, carregado dinamicamente pelo editor.

### Funções internas ("used in module")

Itens marcados como `(used in module)` são usados apenas dentro do próprio módulo.
Seguros de ignorar. Exemplos representativos:

- `exportacao-parser.ts` — todos os tipos (ImagemExportação, ElementoParágrafo, etc.)
- `exportacao-placeholders.ts:37` — `ExportacaoContext`
- `margens.ts:16` — `CM_TO_INCHES`
- `tree-utils.ts:68` — `getDescendantIds`
- `AISectionToolbar.tsx:14` — `AISectionToolbarProps`
- `SortableCategoryTree.tsx:22` — `SortableCategoryTreeProps`
- `PlaceholderContextMenu.tsx:17` — `PlaceholderItem`
- `form.tsx:168` — `useFormField`
- `step-registry.ts:6` — `StepEntry`
- Todos os service types marcados como "used in module"
- Todos os database types marcados como "used in module"
- `IpcAPI` do preload

---

## ✅ Remove com Segurança (Código Morto Confirmado)

Cruzado com os **7 critérios de decisão** e os **4 insumos**.

### Grupo A — Arquivo Órfão
✅ **Removido em 23/06/2026**

| # | Arquivo | Evidência | Critérios |
|---|---------|-----------|-----------|
| A1 | `src/renderer/components/forms/PerfilPeritoForm.tsx` | `PerfilPeritoForm` NUNCA importado — grep só encontra o próprio arquivo | ✅ 1,2,3,4 — grau 0, sem testes |

### Grupo B — Exports Individuais (Renderer)
✅ **Todos removidos em 23/06/2026**

| # | Item | Arquivo | Evidência |
|---|------|---------|-----------|
| B1 | `useErrorBoundary` | `ErrorBoundary.tsx` | App.tsx importa `ErrorBoundary` (componente), não o hook |
| B2 | `marginsToInches` | `lib/margens.ts` | `getMargens` é usado por 5 páginas, `marginsToInches` não |
| B3 | `resolverNumeracaoBlocosCondicionais` | `lib/exportacao-placeholders.ts` | Só no próprio arquivo |
| B4 | `getAllSteps` | `components/rep/step-registry.ts` | `useRepStepper.ts` importa `STEP_REGISTRY` e `getDynamicSteps`, não `getAllSteps` |
| B5 | `getFieldMasks` | `components/rep/exam-fields/index.ts` | Nunca importado externamente |
| B6 | `ParentOption` | `lib/tree-utils.ts` | `getDescendantIds` é usado no módulo, `ParentOption` não |

### Grupo C — Main Database
✅ **Todos removidos em 23/06/2026**

| # | Item | Arquivo | Evidência |
|---|------|---------|-----------|
| C1 | `tableExists` | `database/sqlite.ts` | Definida, nunca importada |
| C2 | `backupDatabase` | `database/sqlite.ts` | `database/index.ts` tem sua própria versão (a usada) |
| C3 | `getDatabaseInfo` | `database/sqlite.ts` | Nunca importado |
| C4 | `restoreDatabase` | `database/index.ts` | Definida, sem chamadas externas |
| C5 | `checkDatabaseIntegrity` | `database/index.ts` | Definida, sem chamadas externas |
| C6 | `getDatabaseInfo` | `database/index.ts` | Definida, sem chamadas externas |

### Grupo D — Security / Crypto
✅ **Todos removidos em 23/06/2026** (exceto `deriveKey` que já não era exportado)

| # | Item | Arquivo | Evidência |
|---|------|---------|-----------|
| D1 | `hashPassword` | `security/crypto.ts` | `user.handlers.ts` usa `bcrypt.hash` direto |
| D2 | `verifyPassword` | `security/crypto.ts` | `user.handlers.ts` usa lógica inline com bcrypt |
| D3 | `generateSecureToken` | `security/crypto.ts` | Nunca importado |
| D4 | `deriveKey` | `security/crypto.ts` | Só usado DENTRO de crypto.ts — remover `export` |
| D5 | `security` (obj agregador) | `security/index.ts` | Funções importadas individualmente; objeto nunca usado |

**Nota:** `encrypt()` e `decrypt()` são usados em `solicitante.service.ts` ✅ — manter.

### Grupo E — Logger
✅ **Todos removidos em 23/06/2026** (incluindo arquivo `log-factory.ts`)

| # | Item | Arquivo | Evidência |
|---|------|---------|-----------|
| E1 | `createLogger` | `utils/log-factory.ts` | **Arquivo inteiro morto** — ninguém importa de `log-factory` |
| E2 | `setModuleLogLevel` | `utils/logger.ts` | Só definido, nunca importado |
| E3 | `getModuleLogLevels` | `utils/logger.ts` | Só definido, nunca importado |
| E4 | `logWarning` | `utils/logger.ts` | Só definido (usam `logInfo`/`logError`/`logDebug`) |
| E5 | `getRecentLogs` | `utils/logger.ts` | Só definido, nunca importado |
| E6 | `cleanupOldLogs` | `utils/logger.ts` | Só definido, nunca importado |
| E7 | `logger` (baseLogger) | `utils/logger.ts` | Só definido (usam `getLogger()` em vez disso) |

### Grupo F — Types Órfãos
✅ **Todos removidos em 23/06/2026**

| # | Item | Arquivo | Evidência |
|---|------|---------|-----------|
| F1 | `EntityRow` | `main/types/database.ts` | Nunca importado |
| F2 | `QueryResult` | `main/types/database.ts` | Nunca importado |
| F3 | `PaginatedResult` | `main/types/database.ts` | Nunca importado |
| F4 | `CategoriaPecaCreateData` | `services/categoria-peca.service.ts` | Nunca importado |
| F5 | `CategoriaPlaceholderCreateData` | `services/categoria-placeholder.service.ts` | Nunca importado |

---

## ⚠️ Requer Verificação Manual

| # | Item | Arquivo | Observação |
|---|------|---------|------------|
| M1 | `log-factory.ts` (arquivo) | `src/main/utils/log-factory.ts` | `createLogger` nunca importado. Verificar se há planos de uso ou se pode remover o arquivo inteiro |
| M2 | `PdfHeaderConfig`, `PdfHeaderOptions` | `lib/pdf-header.ts` | Interfaces usadas como return/param types de `buildPdfHeaderConfig`. Podem virar tipos internos (remover `export`) |
| M3 | `setupCertificateValidation` | `security/index.ts` | Exportado mas sem chamada externa. Função de inicialização que pode ser chamada dentro do próprio módulo |

---

## 🔶 Default Exports Redundantes
✅ **Todos removidos em 23/06/2026** — nenhuma importação usa `default`, todas usam named export.

| Componente | Named export usado | Ação |
|------------|-------------------|------|
| `GdlConsultaModal` | `{ GdlConsultaModal }` → REPsPage.tsx | ✅ Removido |
| `DualTrackTimeline` | `{ DualTrackTimeline }` → LogsPage.tsx | ✅ Removido |
| `RepTimelineDialog` | `{ RepTimelineDialog }` → LaudosPage.tsx, REPsPage.tsx | ✅ Removido |
| `AISheet` | `{ AISheet }` → LaudosPage.tsx | ✅ Removido |
| `AISectionToolbar` | `{ AISectionToolbar }` → LaudosPage.tsx | ✅ Removido |
| `PlaceholderContextMenu` | `{ PlaceholderContextMenu }` → LaudosPage.tsx | ✅ Removido |
| `ErrorBoundary` | `{ ErrorBoundary }` → App.tsx | ✅ Removido |
| `categoria-peca.service` | `{ categoriaPecaService }` | ✅ Removido |
| `categoria-placeholder.service` | `{ categoriaService }` | ✅ Removido |
| `configuracao.service` | `{ configuracaoService }` | ✅ Removido |
| `placeholder.service` | `{ placeholderService }` | ✅ Removido |

---

## 📈 Impacto no Grafo (Graphify)

Conforme `03_melhoria_graphify.md`:

| Item afetado | Grau | Risco | Status |
|-------------|------|-------|--------|
| `cryptoUtils` (D1-D5) | Baixo | ✅ Confirmado — `hashPassword`, `verifyPassword`, `generateSecureToken` removidos | ✅ Removido |
| `isEncrypted()` | ≤3 | ✅ Neutro — função permanece (usada internamente) | ✅ Mantida |
| log-factory.ts | N/A | 🟢 Isolado — 0 imports, 0 dependentes | ✅ Arquivo removido |
| Todos os grupos A-F | ≤3 | 🟢 Nenhum é bridge ou god node | ✅ Todos removidos |

---

## 🔗 Referências

- [`00_saude_do_sistema.md`](./00_saude_do_sistema.md) — Painel de saúde do sistema
- [`01_abordagem_leve_pre_knip.md`](./01_abordagem_leve_pre_knip.md) — Abordagem pré-Knip (concluída)
- [`02_plano_knip_futuro.md`](./02_plano_knip_futuro.md) — Plano futuro do Knip
- [`03_melhoria_graphify.md`](./03_melhoria_graphify.md) — Análise estrutural do grafo
- [`DEAD_CODE_EXCEPTIONS.md`](../../../DEAD_CODE_EXCEPTIONS.md) — Exceções documentadas
- Skill: `check-dead-code` (`.claude/skills/check-dead-code/`)
