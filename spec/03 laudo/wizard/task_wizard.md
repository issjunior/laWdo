# Task Tracking: Wizards e Banco de Peças

> **Referência:** `wizard_pecas.md`
> **Schema alvo:** v20
> **Status:** Implementação concluída (Fases 1-9)
> **Data:** 2026-06-05

---

## Fase 1 — Database (Schema v20)

### Migration v20a — Alterar tabela `laudos`

- [x] Recriar `laudos` sem UNIQUE em `rep_id`
- [x] Adicionar coluna `tipo_criacao TEXT NOT NULL DEFAULT 'template'`
- [x] Adicionar coluna `wizard_id TEXT`
- [x] Adicionar coluna `respostas_wizard TEXT`
- [x] Migrar dados existentes
- [x] Recriar índices (`idx_laudos_status`, `idx_laudos_rep`)

### Migration v20b — Novas tabelas

- [x] Criar tabela `wizards`
- [x] Criar tabela `etapas_wizard`
- [x] Criar tabela `opcoes_etapa`
- [x] Criar tabela `pecas`
- [x] Criar tabela `regras_wizard`
- [x] Criar tabela `respostas_wizard`

### Migration v20c — Índices

- [x] `idx_respostas_wizard_laudo`
- [x] `idx_regras_wizard_wizard`
- [x] `idx_etapas_wizard_wizard`
- [x] `idx_opcoes_etapa_etapa`
- [x] `idx_pecas_categoria`
- [x] `idx_wizards_tipo_exame`

### Schema version

- [x] Atualizar `CURRENT_SCHEMA_VERSION` para 20

### TypeScript Interfaces

- [x] `WizardRow` em `src/main/types/database.ts`
- [x] `EtapaWizardRow` em `src/main/types/database.ts`
- [x] `OpcaoEtapaRow` em `src/main/types/database.ts`
- [x] `PecaRow` em `src/main/types/database.ts`
- [x] `RegraWizardRow` em `src/main/types/database.ts`
- [x] `RespostaWizardRow` em `src/main/types/database.ts`
- [x] Atualizar `LaudoRow` com `tipo_criacao`, `wizard_id`, `respostas_wizard`
- [x] Atualizar `EntityRow` union type

---

## Fase 2 — Backend Services

### `wizard.service.ts`

- [x] Estender `BaseService<WizardRow>`
- [x] `findByTipoExame(tipoExameId)` — listar wizards por tipo de exame
- [x] `getArvoreCompleta(wizardId)` — árvore completa (etapas + opções aninhadas)
- [x] `saveArvoreCompleta(wizardId, arvore)` — salvar árvore transacionalmente
- [x] `findAllActive()` — listar wizards ativos

### `peca.service.ts`

- [x] Estender `BaseService<PecaRow>`
- [x] `search(query)` — buscar por nome, tags, categoria, descrição
- [x] `findByCategoria(categoria)`
- [x] `findCategorias()` — listar categorias distintas

### `regra-wizard.service.ts`

- [x] Estender `BaseService<RegraWizardRow>`
- [x] `findByWizard(wizardId)`
- [x] `findByWizardWithPecas(wizardId)` — com JOIN das peças e seções
- [x] `calcularPecas(wizardId, respostas)` — **lógica central** de matching condição ↔ resposta
- [x] `saveBatch(regras)` — salvar regras em lote
- [x] Função auxiliar `condicaoSatisfeita()` — wildcard, array, string matching
- [x] Matriz de matching: select/radio (exato), checkbox (includes), text (exato/wildcard), image (wildcard)

### `laudo.service.ts` — Novos métodos

- [x] `criarLaudoWizardRascunho()` — cria laudo vazio (`conteudo=''`, `Em andamento`)
- [x] `gerarLaudoWizard()` — calcula peças, gera HTML, salva (INSERT ou UPDATE)
- [x] `salvarProgressoWizard()` — persiste respostas (cache JSON + tabela normalizada)
- [x] `getRespostasWizard()` — buscar respostas salvas da tabela
- [x] `findAllByRepId()` — retorna array de laudos (template + wizard)

### `laudo.service.ts` — Alterações nos métodos existentes

- [x] `criarLaudoInicial()` — adicionar validação de unicidade (feito) + bloqueio (não implementado)
- [ ] `updateStatus()` — adicionar status `Bloqueado` + bloqueio/desbloqueio automático
- [x] `deletar()` — resetar status REP (feito) + desbloquear laudo irmão (não implementado) + limpar imagens (feito)
- [x] `deletarPorRepId()` — atualizado para múltiplos laudos

### Helpers internos

- [x] `_hashContent()` — hash simples para detectar edições manuais
- [x] `_reaplicarBlocosPeca()` — reaplicação com preservação de edições

---

## Fase 3 — IPC Handlers + Preload

### Novos handlers

- [x] `src/main/ipc/handlers/wizard.handlers.ts` — 8 canais
- [x] `src/main/ipc/handlers/peca.handlers.ts` — 8 canais
- [x] `src/main/ipc/handlers/regra-wizard.handlers.ts` — 3 canais

### Alterações em handlers existentes

- [x] `laudo.handlers.ts` — `laudo:findAllByRepId`, `laudo:createWizardRascunho`, `laudo:gerarWizard`, `laudo:salvarProgressoWizard`, `laudo:getRespostasWizard`
- [ ] `laudo.handlers.ts` — array `statusValidos` incluir `'Bloqueado'`
- [ ] `rep.handlers.ts` — `rep:create`/`rep:update`: suporte a `modo_criacao='wizard'` + `wizard_id`
- [ ] `rep.handlers.ts` — chamar `criarLaudoWizardRascunho()` automaticamente, retornar `warning` se falhar

### Registrar handlers

- [x] `src/main/ipc/index.ts` — registrar wizard, peca, regra-wizard handlers

### Preload

- [x] `src/preload/index.ts` — expor API `wizard`, `peca`, `regraWizard`
- [x] `src/preload/index.ts` — adicionar canais ao `ALLOWED_CHANNELS`
- [x] `src/preload/index.ts` — atualizar `laudo` API com novos métodos

### Logger types

- [x] `src/main/utils/logger.ts` — adicionar `'wizard' | 'peca' | 'regra-wizard'` ao `LogModule`
- [x] `src/shared/types/logger.ts` — adicionar módulos ao `LOG_MODULES`

---

## Fase 4 — Frontend: Banco de Peças

### `PecasPage.tsx`

- [x] Cabeçalho com título "Banco de Peças" + botão "Nova Peça"
- [x] Card com DataTable (colunas: nome+descrição, categoria, tags, ações)
- [x] Busca por nome/tag (Input com ícone Search)
- [x] Filtro por categoria (Select)
- [x] Dialog de criação/edição (nome, descrição, categoria, tags, conteúdo HTML + preview)
- [x] Empty state com ícone e CTA
- [x] Exclusão com diálogo de confirmação

### Rotas e sidebar

- [x] Rota `/pecas` em `src/renderer/App.tsx`
- [x] Item "Peças" no grupo Wizard da `AppSidebar`

---

## Fase 5 — Frontend: Editor de Wizard

### `WizardsPage.tsx`

- [x] Cabeçalho + botão "Novo Wizard"
- [x] Cards de estatísticas (total, ativos, inativos)
- [x] DataTable com colunas: nome, tipo exame, template, status, ações
- [x] Filtro por tipo de exame (Select)
- [x] Dialog de criação (nome, descrição, tipo exame, template)
- [x] Redirecionamento para editor ao criar

### `WizardEditorPage.tsx`

- [x] Layout grid 2 colunas: árvore de etapas (esquerda) + configuração (direita)
- [x] Topo: voltar + título + botão Salvar
- [x] Árvore de etapas com seleção, indentação por nível
- [x] ConfigEtapaPanel (pergunta, tipo_input, obrigatório, múltipla escolha)
- [x] Editor de opções (label, valor, remover)
- [x] Painel de peças vinculadas (lista + botão Vincular)
- [x] VinculadorPecaDialog com busca + seleção de seção alvo
- [x] Salvar árvore completa + regras

### Rotas e sidebar

- [x] Rota `/wizards` em `src/renderer/App.tsx`
- [x] Rota `/wizards/:id` em `src/renderer/App.tsx`
- [x] Item "Wizards" no grupo Wizard da `AppSidebar`

---

## Fase 6 — Frontend: Preenchimento do Wizard (Perito)

### `WizardLaudoPage.tsx`

- [x] Layout grid 2 colunas: perguntas (esquerda) + preview (direita)
- [x] Stepper com passos numerados + estado (completed/active/pending)
- [x] Renderer por tipo_input: select, radio (cards), checkbox, text, image
- [x] Lógica de cascata: opção selecionada → revela etapa filha
- [x] Limpeza em cascata ao trocar opção pai
- [x] PecasChecklist com preview em tempo real (debounced 300ms)
- [x] LaudoPreview com HTML readonly
- [x] Cálculo de peças em tempo real via `regra-wizard:calcularPecas`
- [x] Botão "Salvar Progresso" → `laudo:salvarProgressoWizard`
- [x] Botão "Gerar Laudo Wizard" → `laudo:gerarWizard`
- [x] Validação de etapas obrigatórias antes de gerar
- [x] Alerta de bloqueio (Lock + Alert) — UI preparada, lógica de bloqueio pendente
- [x] Retroatividade: reabrir laudo existente → carregar respostas da tabela `respostas_wizard`
- [x] Redirecionar para LaudosPage após gerar com toast

### Rota

- [x] Rota `/reps/:repId/wizard` em `src/renderer/App.tsx`

---

## Fase 7 — Integração com REPsPage + LaudosPage

### `LaudosPage.tsx`

- [x] Adicionar `tipo_criacao` e `wizard_id` ao `LaudoItem`
- [x] Badge `Bloqueado` (slate) no status — UI preparada
- [x] Roteamento condicional no `handleEditar`: wizard → `/reps/:repId/wizard`, template → TinyMCE
- [x] Ícone `Zap` para laudos wizard
- [ ] Ações desabilitadas para laudos `Bloqueado` (status `Bloqueado` não implementado)
- [x] Import `useNavigate` e `Zap`

### Sidebar

- [x] Novo grupo "Wizard" com "Peças" e "Wizards"
- [x] Ícones: `Wand2`, `Package`

---

## Fase 8 — CSS e Tema

### `src/renderer/styles/globals.css`

- [x] `.wizard-step` — completed, active, pending
- [x] `.wizard-tree-node` — selected, hover
- [x] `.wizard-radio-card` — selected, normal, disabled
- [x] `.peca-wizard` — hover reveal peca-id
- [x] `.badge-bloqueado` — dark mode

---

## Fase 9 — Testes e Validação

### Fluxo completo — pendente de testes manuais

- [x] Criar peça via `/pecas` → editar → excluir (implementado)
- [x] Criar wizard → montar árvore → vincular peças → salvar (implementado)
- [x] Preencher wizard → preview em tempo real → Salvar Progresso → reabrir (implementado)
- [x] Gerar laudo wizard → redirecionar para LaudosPage (implementado)
- [x] Adicionar ilustrações no laudo wizard gerado (via fluxo existente)

### Retroatividade

- [x] Hash detection para preservar edições manuais (implementado)
- [x] Reaplicação com substituição de peças intactas (implementado)
- [x] Conteúdo fora de `[data-peca-id]` preservado (implementado)

### Bloqueio entre laudos

> **Status: Não implementado.** O status `Bloqueado` e a lógica de bloqueio/desbloqueio automático não foram implementados. Apenas os 3 status existentes (`Em andamento`, `Concluído`, `Entregue`) são suportados.

- [ ] Concluir laudo template → wizard vira `Bloqueado`
- [ ] Concluir laudo wizard → template vira `Bloqueado`
- [ ] Reabrir laudo (`Em andamento`) → outro laudo desbloqueia
- [ ] Deletar laudo `Concluído`/`Entregue` → outro laudo desbloqueia
- [ ] Laudo `Bloqueado`: ações desabilitadas na UI
- [ ] `criarLaudoInicial()` — validação de bloqueio (rejeitar template se wizard Concluído/Entregue)
- [ ] `criarLaudoWizardRascunho()` — criação automática ao criar/atualizar REP com wizard
- [ ] `laudo:createWizardRascunho` — IPC handler para rascunho automático

---

## Arquivos Criados/Modificados

### Novos arquivos (12)

| Arquivo | Descrição |
|---|---|
| `src/main/services/wizard.service.ts` | CRUD + árvore de wizard |
| `src/main/services/peca.service.ts` | CRUD + busca de peças |
| `src/main/services/regra-wizard.service.ts` | Regras + cálculo de peças |
| `src/main/ipc/handlers/wizard.handlers.ts` | 8 canais IPC |
| `src/main/ipc/handlers/peca.handlers.ts` | 8 canais IPC |
| `src/main/ipc/handlers/regra-wizard.handlers.ts` | 3 canais IPC |
| `src/renderer/pages/PecasPage.tsx` | Banco de Peças |
| `src/renderer/pages/WizardsPage.tsx` | Lista de Wizards |
| `src/renderer/pages/WizardEditorPage.tsx` | Editor de Wizard |
| `src/renderer/pages/WizardLaudoPage.tsx` | Preenchimento do Wizard |

### Modificados (10)

| Arquivo | Mudanças |
|---|---|
| `src/main/database/index.ts` | Migrations v20a/v20b/v20c, CURRENT_SCHEMA_VERSION=20 (atualmente v24) |
| `src/main/types/database.ts` | 7 novas interfaces, LaudoRow atualizado, EntityRow atualizado |
| `src/main/services/laudo.service.ts` | 4 novos métodos (gerarWizard, salvarProgressoWizard, getRespostasWizard, _hashContent, _reaplicarBlocosPeca). Bloqueio pendente. |
| `src/main/ipc/index.ts` | Registrar 3 novos handlers |
| `src/main/ipc/handlers/laudo.handlers.ts` | 5 novos handlers, status atualizado |
| `src/main/ipc/handlers/rep.handlers.ts` | Suporte a modo_criacao='wizard' pendente |
| `src/main/utils/logger.ts` | 3 novos LogModule |
| `src/shared/types/logger.ts` | 3 novos módulos |
| `src/preload/index.ts` | APIs wizard/peca/regraWizard, laudo atualizado |
| `src/renderer/App.tsx` | 4 novas rotas + lazy imports |
| `src/renderer/components/layout/AppSidebar.tsx` | Grupo Wizard |
| `src/renderer/styles/globals.css` | Classes wizard CSS |
| `src/renderer/pages/LaudosPage.tsx` | Wizard routing, Bloqueado, badges |

---

> **Legenda:** `[x]` concluído · `[ ]` pendente · `[~]` em andamento
