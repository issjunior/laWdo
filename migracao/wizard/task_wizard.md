# Task Tracking: Wizards e Banco de Peças

> **Referência:** `migracao/wizard/wizard_pecas.md`
> **Schema alvo:** v20
> **Objetivo:** Rastrear o que foi implementado para documentação e manutenção posterior.

---

## Fase 1 — Database (Schema v20)

### Migration v20a — Alterar tabela `laudos`

- [ ] Recriar `laudos` sem UNIQUE em `rep_id`
- [ ] Adicionar coluna `tipo_criacao TEXT NOT NULL DEFAULT 'template'`
- [ ] Adicionar coluna `wizard_id TEXT`
- [ ] Adicionar coluna `respostas_wizard TEXT`
- [ ] Migrar dados existentes
- [ ] Recriar índices (`idx_laudos_status`, `idx_laudos_rep`)

### Migration v20b — Novas tabelas

- [ ] Criar tabela `wizards`
- [ ] Criar tabela `etapas_wizard`
- [ ] Criar tabela `opcoes_etapa`
- [ ] Criar tabela `pecas`
- [ ] Criar tabela `regras_wizard`
- [ ] Criar tabela `respostas_wizard`

### Migration v20c — Índices

- [ ] `idx_respostas_wizard_laudo`
- [ ] `idx_regras_wizard_wizard`
- [ ] `idx_etapas_wizard_wizard`
- [ ] `idx_opcoes_etapa_etapa`
- [ ] `idx_pecas_categoria`
- [ ] `idx_wizards_tipo_exame`

### Schema version

- [ ] Atualizar `CURRENT_SCHEMA_VERSION` para 20

### TypeScript Interfaces

- [ ] `WizardRow` em `src/main/types/database.ts`
- [ ] `EtapaWizardRow` em `src/main/types/database.ts`
- [ ] `OpcaoEtapaRow` em `src/main/types/database.ts`
- [ ] `PecaRow` em `src/main/types/database.ts`
- [ ] `RegraWizardRow` em `src/main/types/database.ts`
- [ ] `RespostaWizardRow` em `src/main/types/database.ts`

---

## Fase 2 — Backend Services

### `wizard.service.ts`

- [ ] Estender `BaseService<WizardRow>`
- [ ] `findByTipoExame(tipoExameId)` — listar wizards por tipo de exame
- [ ] `getArvoreCompleta(wizardId)` — árvore completa (etapas + opções aninhadas)
- [ ] `saveArvoreCompleta(wizardId, arvore)` — salvar árvore transacionalmente

### `peca.service.ts`

- [ ] Estender `BaseService<PecaRow>`
- [ ] `search(query)` — buscar por nome, tags, categoria
- [ ] `findByCategoria(categoria)`

### `regra-wizard.service.ts`

- [ ] Estender `BaseService<RegraWizardRow>`
- [ ] `findByWizard(wizardId)`
- [ ] `calcularPecas(wizardId, respostas)` — **lógica central** de matching condição ↔ resposta
- [ ] Matriz de matching: select/radio (exato), checkbox (includes), text (exato/wildcard), image (wildcard)

### `laudo.service.ts` — Novos métodos

- [ ] `criarLaudoWizardRascunho()` — cria laudo vazio (`conteudo=''`, `Em andamento`)
- [ ] `gerarLaudoWizard()` — calcula peças, gera HTML, salva (INSERT ou UPDATE)
- [ ] `salvarProgressoWizard()` — persiste respostas (cache JSON + tabela normalizada)
- [ ] `reaplicarRespostas()` — retroatividade com detecção de edição manual via hash
- [ ] Função auxiliar `condicaoSatisfeita()` — wildcard, array, string matching
- [ ] Função auxiliar `reaplicarBlocoPeca()` — hash detection para preservar edições

### `laudo.service.ts` — Alterações nos métodos existentes

- [ ] `criarLaudoInicial()` — adicionar validação de unicidade + bloqueio
- [ ] `updateStatus()` — adicionar status `Bloqueado` + bloqueio/desbloqueio automático
- [ ] `deletar()` — desbloquear laudo irmão + limpar imagens + resetar status REP

### Schemas Zod

- [ ] `src/renderer/lib/validators/wizard.schema.ts`

---

## Fase 3 — IPC Handlers + Preload

### Novos handlers

- [ ] `src/main/ipc/handlers/wizard.handlers.ts` — todos os canais (seção 5.1)
- [ ] `src/main/ipc/handlers/peca.handlers.ts` — todos os canais (seção 5.2)
- [ ] `src/main/ipc/handlers/regra-wizard.handlers.ts` — todos os canais (seção 5.3)

### Alterações em handlers existentes

- [ ] `laudo.handlers.ts` — adicionar `laudo:createWizardRascunho`, `laudo:gerarWizard`, `laudo:salvarProgressoWizard`
- [ ] `laudo.handlers.ts` — array `statusValidos` incluir `'Bloqueado'`
- [ ] `rep.handlers.ts` — `rep:create`/`rep:update`: suporte a `modo_criacao='wizard'` + `wizard_id`
- [ ] `rep.handlers.ts` — chamar `criarLaudoWizardRascunho()` automaticamente, retornar `warning` se falhar

### Registrar handlers

- [ ] `src/main/ipc/index.ts` — registrar wizard, peca, regra-wizard handlers

### Preload

- [ ] `src/preload/index.ts` — expor API `wizard`, `peca`, `regraWizard`
- [ ] `src/preload/index.ts` — adicionar canais ao `ALLOWED_CHANNELS`
- [ ] `src/preload/types.ts` — adicionar tipos para wizard/peca/regra

---

## Fase 4 — Frontend: Banco de Peças

### `PecasPage.tsx`

- [ ] Cabeçalho com título "Banco de Peças" + botão "Nova Peça"
- [ ] Card com DataTable (colunas: nome+descrição, categoria, tags, ações)
- [ ] Busca por nome/tag (Input com ícone Search)
- [ ] Filtro por categoria (Select)
- [ ] Dialog de criação/edição (nome, descrição, categoria, tags, conteúdo HTML + preview)

### Rotas e sidebar

- [ ] Rota `/pecas` em `src/renderer/routes/index.tsx`
- [ ] Item "Peças" no grupo Wizard da `AppSidebar`

---

## Fase 5 — Frontend: Editor de Wizard

### `WizardsPage.tsx`

- [ ] Cabeçalho + botão "Novo Wizard"
- [ ] Cards de estatísticas (total, ativos, inativos)
- [ ] DataTable com colunas: nome, tipo exame, template, etapas/peças, status, ações
- [ ] Filtro por tipo de exame (Select)
- [ ] Dialog de criação (nome, descrição, tipo exame, template)

### `WizardEditorPage.tsx`

- [ ] Layout grid 2 colunas: árvore de etapas (esquerda) + configuração (direita)
- [ ] Topo: voltar + título + botões (Simular, Salvar)
- [ ] ArvoreEtapas com seleção, indentação por nível, linhas CSS, drag-and-drop
- [ ] ConfigEtapaPanel (pergunta, tipo_input, obrigatório, múltipla escolha)
- [ ] OpcoesEditor com drag handle, remover, reordenar
- [ ] RegrasVinculadas com peça + seção alvo
- [ ] VinculadorPecaDialog com DataTable + criação inline de peça
- [ ] Salvar árvore completa via `wizard:saveArvore`

### Componentes auxiliares (`src/renderer/components/wizard/`)

- [ ] `ArvoreEtapas.tsx`
- [ ] `ConfigEtapaPanel.tsx`
- [ ] `OpcoesEditor.tsx`
- [ ] `RegrasVinculadas.tsx`
- [ ] `VinculadorPecaDialog.tsx`

### Rotas e sidebar

- [ ] Rota `/wizards` em `src/renderer/routes/index.tsx`
- [ ] Rota `/wizards/:id` em `src/renderer/routes/index.tsx`
- [ ] Item "Wizards" no grupo Wizard da `AppSidebar`

---

## Fase 6 — Frontend: Preenchimento do Wizard (Perito)

### `WizardLaudoPage.tsx`

- [ ] Layout grid 2 colunas: perguntas (esquerda) + preview (direita)
- [ ] WizardStepper com passos numerados, conectores, estados (completed/active/pending)
- [ ] WizardEtapaRenderer (switch por tipo_input: select, radio, checkbox, text, image)
- [ ] Lógica de cascata: opção selecionada → revela etapa filha
- [ ] Limpeza em cascata: trocar opção pai → diálogo de confirmação → limpar filhas
- [ ] PecasChecklist agrupado por seção com checkboxes
- [ ] LaudoPreview com HTML readonly (prose + tema)
- [ ] Cálculo de peças em tempo real via `regra-wizard:calcularPecas`
- [ ] Botão "Salvar Progresso" → `laudo:salvarProgressoWizard`
- [ ] Botão "Gerar Laudo Wizard" → `laudo:gerarWizard`
- [ ] Validação de etapas obrigatórias antes de gerar
- [ ] Alerta de bloqueio (Lock + Alert) com inputs e botões desabilitados
- [ ] Retroatividade: reabrir laudo existente → carregar respostas da tabela `respostas_wizard`
- [ ] Redirecionar para LaudosPage após gerar com toast "Adicionar ilustrações?"

### Componentes auxiliares (`src/renderer/components/wizard/`)

- [ ] `WizardStepper.tsx`
- [ ] `WizardEtapaRenderer.tsx`
- [ ] `PecasChecklist.tsx`
- [ ] `LaudoPreview.tsx`

### Rota

- [ ] Rota `/reps/:repId/wizard` em `src/renderer/routes/index.tsx`

---

## Fase 7 — Integração com REPsPage + LaudosPage

### `REPsPage.tsx`

- [ ] Campo "Modo de Criação do Laudo" (radio Template / Wizard)
- [ ] Select de Wizard condicional (filtrado por `tipo_exame_id`) quando modo Wizard
- [ ] `laudo:findAllByRepId` — retornar array com `tipo_criacao`
- [ ] Estrutura `LaudosPorREP` para rastrear template + wizard por REP
- [ ] Badges clicáveis: "T" azul (template), "W" violeta (wizard)
- [ ] Badge "W" cinza/slate para wizard `Bloqueado`
- [ ] Botões condicionais: criar template bloqueado se wizard finalizado, vice-versa
- [ ] Indicador "Sem laudo" (Lock) quando ambos bloqueados
- [ ] Ao salvar REP com Wizard: criar laudo rascunho, toast com redirecionamento
- [ ] Toast de warning quando criação do laudo rascunho falhar

### `LaudosPage.tsx`

- [ ] Adicionar `tipo_criacao` e `wizard_id` ao `LaudoItem`
- [ ] Coluna "Tipo / Status" com dois badges lado a lado
- [ ] Badge `Bloqueado` (slate) com tooltip explicativo
- [ ] Roteamento condicional no `handleEditar`: wizard → `/reps/:repId/wizard`, template → TinyMCE
- [ ] Botão "Preencher/Editar" condicional (ícone `Zap` para wizard)
- [ ] Laudos `Bloqueado`: apenas botão Excluir disponível

---

## Fase 8 — CSS e Tema

### `src/renderer/globals.css`

- [ ] `.wizard-step` — completed, active, pending, disabled
- [ ] `.wizard-step-connector` — linha entre passos
- [ ] `.wizard-tree-node` — nó da árvore, estados selected/normal, indentação por data-depth
- [ ] `.wizard-tree-line` — linha vertical da árvore
- [ ] `.wizard-radio-card` — cards de radio (selected, normal, disabled)
- [ ] `.wizard-radio-dot` — bolinha do radio custom
- [ ] Overrides dark mode para badges (slate, violet)

---

## Fase 9 — Testes e Validação

### Fluxo completo

- [ ] Criar peça inline (VinculadorPecaDialog) → salvar → aparece vinculada
- [ ] Criar peça via `/pecas` → editar → excluir
- [ ] Criar wizard → montar árvore → vincular peças → salvar
- [ ] Preencher wizard → preview em tempo real → Salvar Progresso → reabrir → respostas restauradas
- [ ] Gerar laudo wizard → abrir TinyMCE → conteúdo HTML correto
- [ ] Adicionar ilustrações no laudo wizard gerado → preview PDF

### Retroatividade

- [ ] Gerar laudo → editar peça manualmente no TinyMCE → reaplicar wizard → edição manual preservada
- [ ] Gerar laudo → reaplicar wizard sem edições manuais → peças atualizadas
- [ ] Peça removida das regras → bloco `data-peca-id` removido do HTML
- [ ] Conteúdo fora de `[data-peca-id]` preservado (ilustrações, formatação)

### Bloqueio entre laudos

- [ ] Concluir laudo template → wizard vira `Bloqueado`
- [ ] Concluir laudo wizard → template vira `Bloqueado`
- [ ] Reabrir laudo (`Em andamento`) → outro laudo desbloqueia
- [ ] Deletar laudo `Concluído`/`Entregue` → outro laudo desbloqueia
- [ ] Deletar laudo `Bloqueado` → sem efeito colateral no outro
- [ ] Tentar criar template com wizard finalizado → erro
- [ ] Tentar criar wizard com template finalizado → erro
- [ ] Laudo `Bloqueado`: apenas botão Excluir na UI, editor readonly

### Edge cases

- [ ] Wizard sem template → validação impede (template_id NOT NULL)
- [ ] Peça sem seção alvo (regra com `secao_template_id` nulo) → aparece como sugestão
- [ ] Etapa com multipla_escolha + condição array na regra → matching correto
- [ ] Etapa text + condição wildcard `*` → sempre match
- [ ] Etapa image → sempre match com `*`
- [ ] Trocar opção pai que tem filhas respondidas → diálogo de confirmação

---

> **Legenda:** `[ ]` pendente · `[x]` concluído · `[~]` em andamento
