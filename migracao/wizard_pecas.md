# Plano de Implementação: Wizards e Banco de Peças

> **Status:** Planejamento concluído — pronto para implementação
> **Versão do schema alvo:** 20
> **Data:** 2026-06-02

---

## 1. Visão Geral

Adicionar um **modo Wizard** como alternativa ao modo Template para criação de laudos periciais. O perito responde perguntas em cascata (ex: tipo de arma → calibre → marca) e o sistema monta o laudo automaticamente com **peças** (trechos de texto pré-cadastrados) inseridas nas seções corretas.

### Conceitos-chave

| Conceito | Definição |
|---|---|
| **Wizard** | Árvore de decisão vinculada a um TipoExame. Define as perguntas e a ordem em que aparecem. |
| **Etapa** | Um nó da árvore. Representa uma pergunta com tipo de input (select, radio, checkbox, text, image). |
| **Opção** | Uma escolha possível dentro de uma etapa. Pode disparar uma sub-etapa (cascata). |
| **Peça** | Texto HTML pré-cadastrado no **banco de peças** (independente de wizard). Reutilizável entre wizards. |
| **Regra** | Ponte entre wizard e peça. Define: "a peça X aparece na seção Y quando as condições Z forem atendidas". |
| **Resposta** | Escolha do perito em uma etapa. Salva para retroatividade (alterar depois reaplica). |

### Fluxo comparativo

```
ANTES (template):
  REP → "Criar Laudo" → TipoExame → Template → Laudo (seções do template)

DEPOIS (template + wizard):
  REP → "Criar Laudo (Template)" → ... (fluxo existente, inalterado)
  REP → "Criar Laudo (Wizard)"   → Wizard (página dedicada) → Laudo [Wizard]
```

---

## 2. Modelo de Dados

### 2.1 Alterações em tabelas existentes

**Tabela `laudos` — Migration v20a:**

```sql
-- Remover UNIQUE de rep_id (SQLite não suporta DROP CONSTRAINT direto,
-- será necessário recriar a tabela)
-- ADICIONAR colunas:
ALTER TABLE laudos ADD COLUMN tipo_criacao TEXT NOT NULL DEFAULT 'template';
ALTER TABLE laudos ADD COLUMN wizard_id TEXT;
ALTER TABLE laudos ADD COLUMN respostas_wizard TEXT;  -- JSON snapshot
```

| Coluna | Tipo | Descrição |
|---|---|---|
| `tipo_criacao` | TEXT | `'template'` ou `'wizard'` |
| `wizard_id` | TEXT FK | Wizard usado (nulo se template) |
| `respostas_wizard` | TEXT | JSON com as respostas do perito (para retroatividade) |

**Constraint `rep_id UNIQUE`:** Remover — uma REP pode ter até 2 laudos (1 template + 1 wizard). A restrição é aplicada em camada de aplicação (ver seção 12.6).

**Como remover UNIQUE no SQLite:**
```sql
-- Criar nova tabela sem UNIQUE em rep_id
CREATE TABLE laudos_v20 (
  id TEXT PRIMARY KEY,
  rep_id TEXT NOT NULL,
  perito_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Em andamento',
  data_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
  data_conclusao DATETIME,
  data_entrega DATETIME,
  versao INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  tipo_criacao TEXT NOT NULL DEFAULT 'template',
  wizard_id TEXT,
  respostas_wizard TEXT,
  FOREIGN KEY (rep_id) REFERENCES reps(id),
  FOREIGN KEY (perito_id) REFERENCES users(id),
  FOREIGN KEY (template_id) REFERENCES templates(id),
  FOREIGN KEY (wizard_id) REFERENCES wizards(id)
);

-- Migrar dados
INSERT INTO laudos_v20 SELECT
  id, rep_id, perito_id, template_id, conteudo, status,
  data_inicio, data_conclusao, data_entrega, versao,
  created_at, updated_at,
  'template', NULL, NULL
FROM laudos;

DROP TABLE laudos;
ALTER TABLE laudos_v20 RENAME TO laudos;

-- Recriar índices
CREATE INDEX IF NOT EXISTS idx_laudos_status ON laudos(status);
CREATE INDEX IF NOT EXISTS idx_laudos_rep ON laudos(rep_id);
```

### 2.2 Novas tabelas — Migration v20b

#### `wizards`

```sql
CREATE TABLE wizards (
  id TEXT PRIMARY KEY,
  tipo_exame_id TEXT NOT NULL,
  template_id TEXT,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tipo_exame_id) REFERENCES tipos_exame(id),
  FOREIGN KEY (template_id) REFERENCES templates(id)
);
```

| Coluna | Descrição |
|---|---|
| `tipo_exame_id` | Tipo de exame ao qual o wizard pertence (obrigatório) |
| `template_id` | Template vinculado (opcional). Se informado, define as seções disponíveis. Se nulo, wizard é genérico. |

#### `etapas_wizard`

```sql
CREATE TABLE etapas_wizard (
  id TEXT PRIMARY KEY,
  wizard_id TEXT NOT NULL,
  etapa_pai_id TEXT,
  pergunta TEXT NOT NULL,
  descricao_ajuda TEXT,
  tipo_input TEXT NOT NULL DEFAULT 'select',
  nivel INTEGER NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  obrigatorio INTEGER NOT NULL DEFAULT 1,
  multipla_escolha INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wizard_id) REFERENCES wizards(id) ON DELETE CASCADE,
  FOREIGN KEY (etapa_pai_id) REFERENCES etapas_wizard(id) ON DELETE SET NULL
);
```

| Coluna | Valores | Descrição |
|---|---|---|
| `tipo_input` | `'select'`, `'radio'`, `'checkbox'`, `'text'`, `'image'` | Tipo de campo |
| `nivel` | 0, 1, 2... | Profundidade na árvore (0 = raiz) |
| `multipla_escolha` | 0/1 | Se 1, permite selecionar múltiplas opções (checkbox) |
| `etapa_pai_id` | FK ou null | Nulo = etapa raiz (aparece sempre). Senão = só aparece quando opção pai é escolhida. |

#### `opcoes_etapa`

```sql
CREATE TABLE opcoes_etapa (
  id TEXT PRIMARY KEY,
  etapa_id TEXT NOT NULL,
  label TEXT NOT NULL,
  valor TEXT NOT NULL,
  etapa_filha_id TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (etapa_id) REFERENCES etapas_wizard(id) ON DELETE CASCADE,
  FOREIGN KEY (etapa_filha_id) REFERENCES etapas_wizard(id) ON DELETE SET NULL
);
```

| Coluna | Descrição |
|---|---|
| `label` | Texto visível: "Revólver" |
| `valor` | Chave interna: "revolver" (usada nas condições das regras) |
| `etapa_filha_id` | Próxima etapa liberada ao escolher esta opção (cascata) |

#### `pecas`

```sql
CREATE TABLE pecas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  conteudo TEXT NOT NULL,
  categoria TEXT,
  tags TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

| Coluna | Descrição |
|---|---|
| `conteudo` | HTML do trecho |
| `categoria` | Agrupamento livre: "armas", "veiculos", "documentos" |
| `tags` | JSON array de strings para busca: `["revolver","taurus","calibre38"]` |

#### `regras_wizard`

```sql
CREATE TABLE regras_wizard (
  id TEXT PRIMARY KEY,
  wizard_id TEXT NOT NULL,
  peca_id TEXT NOT NULL,
  secao_template_id TEXT,
  condicoes TEXT NOT NULL DEFAULT '{}',
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wizard_id) REFERENCES wizards(id) ON DELETE CASCADE,
  FOREIGN KEY (peca_id) REFERENCES pecas(id) ON DELETE CASCADE,
  FOREIGN KEY (secao_template_id) REFERENCES secoes_template(id) ON DELETE SET NULL
);
```

| Coluna | Descrição |
|---|---|
| `condicoes` | JSON: `{"etapa_arma": "revolver", "etapa_calibre": "38"}` — mapeia `etapa_id` → `opcao_valor`. Peça aparece quando TODAS as condições são satisfeitas. |
| `secao_template_id` | Seção do laudo onde inserir a peça. Se nulo, peça é sugerida mas não tem seção fixa. |

#### `respostas_wizard`

```sql
CREATE TABLE respostas_wizard (
  id TEXT PRIMARY KEY,
  laudo_id TEXT NOT NULL,
  etapa_id TEXT NOT NULL,
  opcao_id TEXT,
  valor_texto TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (laudo_id) REFERENCES laudos(id) ON DELETE CASCADE,
  FOREIGN KEY (etapa_id) REFERENCES etapas_wizard(id),
  FOREIGN KEY (opcao_id) REFERENCES opcoes_etapa(id) ON DELETE SET NULL
);
```

Armazena cada escolha do perito. Permite reabrir o wizard e restaurar o estado anterior (retroatividade).

---

## 3. TypeScript Interfaces

Adicionar em `src/main/types/database.ts`:

```ts
export interface WizardRow {
  id: string
  tipo_exame_id: string
  template_id: string | null
  nome: string
  descricao?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface EtapaWizardRow {
  id: string
  wizard_id: string
  etapa_pai_id: string | null
  pergunta: string
  descricao_ajuda?: string
  tipo_input: 'select' | 'radio' | 'checkbox' | 'text' | 'image'
  nivel: number
  ordem: number
  obrigatorio: boolean
  multipla_escolha: boolean
  created_at: string
  updated_at: string
}

export interface OpcaoEtapaRow {
  id: string
  etapa_id: string
  label: string
  valor: string
  etapa_filha_id: string | null
  ordem: number
  created_at: string
}

export interface PecaRow {
  id: string
  nome: string
  descricao?: string
  conteudo: string
  categoria?: string
  tags?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

export interface RegraWizardRow {
  id: string
  wizard_id: string
  peca_id: string
  secao_template_id: string | null
  condicoes: string
  ordem: number
  created_at: string
}

export interface RespostaWizardRow {
  id: string
  laudo_id: string
  etapa_id: string
  opcao_id: string | null
  valor_texto: string | null
  created_at: string
}
```

---

## 4. Backend: Services

### 4.1 `src/main/services/wizard.service.ts`

```ts
class WizardService extends BaseService<WizardRow> {
  // CRUD básico (herdado de BaseService)
  
  /** Lista wizards de um tipo de exame */
  findByTipoExame(tipoExameId: string): Promise<WizardRow[]>
  
  /** Retorna árvore completa do wizard (etapas + opções aninhadas) */
  getArvoreCompleta(wizardId: string): Promise<ArvoreWizard>
  
  /** Salva árvore completa (transacional: deleta existente, insere nova) */
  saveArvoreCompleta(wizardId: string, arvore: ArvoreWizard): Promise<void>
}
```

### 4.2 `src/main/services/peca.service.ts`

```ts
class PecaService extends BaseService<PecaRow> {
  /** Buscar peças por tags ou categoria */
  search(query: string): Promise<PecaRow[]>
  
  /** Buscar por categoria */
  findByCategoria(categoria: string): Promise<PecaRow[]>
}
```

### 4.3 `src/main/services/regra-wizard.service.ts`

```ts
class RegraWizardService extends BaseService<RegraWizardRow> {
  /** Lista regras de um wizard */
  findByWizard(wizardId: string): Promise<RegraWizardRow[]>
  
  /** Calcula quais peças são acionadas com base nas respostas */
  calcularPecas(
    wizardId: string,
    respostas: Record<string, string | string[]>
  ): Promise<PecaComSecao[]>
}
```

### 4.4 Lógica `calcularPecas()` — central

Dado um wizard + mapa de respostas `{"etapa_arma": "revolver", "etapa_calibre": "38"}`:

1. Carrega todas as `regras_wizard` do wizard
2. Para cada regra, faz parse do JSON `condicoes`
3. Verifica se TODAS as `condicoes` são satisfeitas pelas `respostas`
4. Junta com a peça (`pecas`) e seção (`secoes_template`) correspondentes
5. Retorna lista de `{ peca, secao, ordem }`

### 4.5 `src/main/services/laudo.service.ts` — alterações

```ts
interface CriarLaudoWizardParams {
  rep_id: string
  perito_id: string
  wizard_id: string
  template_id: string      // template vinculado ao wizard
  respostas: Record<string, string | string[]>
}

async criarLaudoWizard(params: CriarLaudoWizardParams): Promise<LaudoRow> {
  // 0. VALIDAR: já existe laudo wizard para esta REP? (seção 12.6)
  // 1. Carregar seções do template
  // 2. Calcular peças com base nas respostas
  // 3. Para cada seção, concatenar: conteúdo base da seção + peças
  // 4. Gerar conteúdo HTML final
  // 5. Salvar laudo com tipo_criacao='wizard', wizard_id, respostas_wizard (JSON)
  // 6. Salvar respostas_wizard na tabela respostas_wizard
}
```

### 4.6 Retroatividade

```ts
async reaplicarRespostas(laudoId: string, novasRespostas: Record<string, string | string[]>): Promise<LaudoRow> {
  // 1. Carregar laudo e wizard vinculado
  // 2. Recalcular peças com novas respostas
  // 3. Para cada seção: substituir blocos de peças antigas pelos novos
  //    (identificar blocos por data-peca-id no HTML)
  // 4. Atualizar laudo.conteudo e respostas_wizard
  // 5. Sobrescrever registros em respostas_wizard
}
```

---

## 5. Backend: IPC Handlers

### 5.1 `src/main/ipc/handlers/wizard.handlers.ts`

```ts
export function registerWizardHandlers() {
  ipcMain.handle('wizard:findAll',        () => wizardService.findAll())
  ipcMain.handle('wizard:findById',       (_, id) => wizardService.findById(id))
  ipcMain.handle('wizard:findByTipoExame',(_, tipoExameId) => wizardService.findByTipoExame(tipoExameId))
  ipcMain.handle('wizard:create',         (_, data) => wizardService.create(data))
  ipcMain.handle('wizard:update',         (_, id, data) => wizardService.update(id, data))
  ipcMain.handle('wizard:delete',         (_, id) => wizardService.delete(id))
  ipcMain.handle('wizard:getArvore',      (_, wizardId) => wizardService.getArvoreCompleta(wizardId))
  ipcMain.handle('wizard:saveArvore',     (_, wizardId, arvore) => wizardService.saveArvoreCompleta(wizardId, arvore))
}
```

### 5.2 `src/main/ipc/handlers/peca.handlers.ts`

```ts
export function registerPecaHandlers() {
  ipcMain.handle('peca:findAll',     () => pecaService.findAll())
  ipcMain.handle('peca:findById',    (_, id) => pecaService.findById(id))
  ipcMain.handle('peca:create',      (_, data) => pecaService.create(data))
  ipcMain.handle('peca:update',      (_, id, data) => pecaService.update(id, data))
  ipcMain.handle('peca:delete',      (_, id) => pecaService.delete(id))
  ipcMain.handle('peca:search',      (_, query) => pecaService.search(query))
  ipcMain.handle('peca:findByCategoria', (_, cat) => pecaService.findByCategoria(cat))
}
```

### 5.3 `src/main/ipc/handlers/regra-wizard.handlers.ts`

```ts
export function registerRegraWizardHandlers() {
  ipcMain.handle('regra-wizard:findByWizard',  (_, wizardId) => regraWizardService.findByWizard(wizardId))
  ipcMain.handle('regra-wizard:save',          (_, regras) => regraWizardService.saveBatch(regras))
  ipcMain.handle('regra-wizard:calcularPecas', (_, wizardId, respostas) => regraWizardService.calcularPecas(wizardId, respostas))
}
```

### 5.4 Alterar `laudo.handlers.ts`

Adicionar handler:

```ts
ipcMain.handle('laudo:createWizard', async (_, params) => {
  return laudoService.criarLaudoWizard(params)
})

ipcMain.handle('laudo:reaplicarWizard', async (_, laudoId, respostas) => {
  return laudoService.reaplicarRespostas(laudoId, respostas)
})
```

### 5.5 Canais IPC (preload)

Adicionar em `src/preload/index.ts`:

```ts
// No IpcAPI interface:
wizard: {
  findAll: () => Promise<UserResponse>
  findById: (id: string) => Promise<UserResponse>
  findByTipoExame: (tipoExameId: string) => Promise<UserResponse>
  create: (data: any) => Promise<UserResponse>
  update: (id: string, data: any) => Promise<UserResponse>
  delete: (id: string) => Promise<UserResponse>
  getArvore: (wizardId: string) => Promise<UserResponse>
  saveArvore: (wizardId: string, arvore: any) => Promise<UserResponse>
}

peca: {
  findAll: () => Promise<UserResponse>
  findById: (id: string) => Promise<UserResponse>
  create: (data: any) => Promise<UserResponse>
  update: (id: string, data: any) => Promise<UserResponse>
  delete: (id: string) => Promise<UserResponse>
  search: (query: string) => Promise<UserResponse>
  findByCategoria: (categoria: string) => Promise<UserResponse>
}

regraWizard: {
  findByWizard: (wizardId: string) => Promise<UserResponse>
  save: (regras: any[]) => Promise<UserResponse>
  calcularPecas: (wizardId: string, respostas: any) => Promise<UserResponse>
}
```

Adicionar ao `ALLOWED_CHANNELS`:

```ts
'wizard:findAll', 'wizard:findById', 'wizard:findByTipoExame',
'wizard:create', 'wizard:update', 'wizard:delete',
'wizard:getArvore', 'wizard:saveArvore',
'peca:findAll', 'peca:findById', 'peca:create', 'peca:update', 'peca:delete',
'peca:search', 'peca:findByCategoria',
'regra-wizard:findByWizard', 'regra-wizard:save', 'regra-wizard:calcularPecas',
'laudo:createWizard', 'laudo:reaplicarWizard',
```

---

## 6. Frontend: Páginas

### 6.1 `src/renderer/pages/PecasPage.tsx` — Banco de Peças

```
┌──────────────────────────────────────────────┐
│  🧩 Banco de Peças              [+ Nova Peça] │
├──────────────────────────────────────────────┤
│  [🔍 Buscar...]  [Categoria ▼]               │
├──────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐      │
│  │ Peça 1: Revólver Taurus .38       │  ✏️ 🗑️  │
│  │ Cat: armas  Tags: revolver, taurus │      │
│  │ "Trata-se de um revólver..."       │      │
│  ├─────────────────────────────────────┤      │
│  │ Peça 2: Pistola Glock 9mm        │  ✏️ 🗑️  │
│  │ Cat: armas  Tags: pistola, glock  │      │
│  │ "Trata-se de uma pistola..."      │      │
│  └─────────────────────────────────────┘      │
└──────────────────────────────────────────────┘
```

**Funcionalidades:**
- Listagem com busca e filtro por categoria
- Dialog de criação/edição (nome, descrição, categoria, tags, conteúdo HTML via TinyMCE simplificado ou textarea rica)
- Exclusão com confirmação
- Preview do HTML

### 6.2 `src/renderer/pages/WizardsPage.tsx` — Lista de Wizards

```
┌──────────────────────────────────────────────┐
│  🪄 Wizards                    [+ Novo Wizard] │
├──────────────────────────────────────────────┤
│  [Tipo Exame ▼]  [🔍 Buscar...]              │
├──────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐      │
│  │ Wizard B602 - Eficiência/Prestab.  │  ✏️ 🗑️ │
│  │ Tipo: B602  Template: Padrão B602  │      │
│  │ Etapas: 3  |  Peças: 12           │      │
│  ├─────────────────────────────────────┤      │
│  │ Wizard LOC  - Local de Crime       │  ✏️ 🗑️ │
│  │ Tipo: LOC   Template: Padrão LOC   │      │
│  │ Etapas: 5  |  Peças: 8            │      │
│  └─────────────────────────────────────┘      │
└──────────────────────────────────────────────┘
```

### 6.3 `src/renderer/pages/WizardEditorPage.tsx` — Editor de Wizard

**Layout lado a lado:**

```
┌────────────────────┬──────────────────────────┐
│   ÁRVORE DE ETAPAS │   CONFIGURAÇÃO DA ETAPA  │
│                    │                          │
│  ⬤ Tipo de Arma   │  Pergunta: Tipo de Arma  │
│  ├─○ Revólver     │  Tipo: [select ▼]        │
│  │  ⬤ Calibre    │  Obrigatório: [✓]        │
│  │   ├─○ .38      │                          │
│  │   └─○ .357     │  ─── REGRAS (Peças) ─── │
│  ├─○ Pistola      │  ☑ Revólver Taurus .38  │
│  │  ⬤ Calibre    │  ☑ Tambor 6 câmaras     │
│  │  ⬤ Mecanismo  │  ☐ Acabamento oxidado   │
│  └─○ Espingarda   │  [+ Vincular Peça]       │
│                    │                          │
│  [+ Adicionar     │  Seção alvo: Do Material │
│   Etapa Raiz]     │                          │
└────────────────────┴──────────────────────────┘
```

**Funcionalidades:**
- Árvore visual com indentação (componente em árvore com linhas conectando)
- Drag & drop para reordenar etapas/opções (@dnd-kit já usado no projeto)
- Ao clicar em uma etapa, painel direito mostra:
  - Configuração da etapa (pergunta, tipo, obrigatório)
  - Lista de opções (adicionar/remover/reordenar)
  - Regras vinculadas: quais peças esta etapa ativa + checkboxes
  - Seção alvo para cada peça
- Botão "Vincular Peça" → Dialog de busca no banco de peças
- Preview do wizard: "Simular preenchimento" para testar

### 6.4 `src/renderer/pages/WizardLaudoPage.tsx` — Preenchimento do Wizard (Perito)

**Layout:**

```
┌─────────────────────┬──────────────────────────┐
│   WIZARD            │   PREVIEW DO LAUDO        │
│                     │                          │
│  Passo 1 de 3      │  ┌──────────────────┐    │
│                     │  │ Seção 1: Histórico│   │
│  Tipo de Arma: *   │  │ {{dados_rep}}    │    │
│  ○ Revólver        │  └──────────────────┘    │
│  ○ Pistola    ◀─── │  ┌──────────────────┐    │
│  ○ Espingarda      │  │ Seção 2: Material │   │
│                     │  │                    │   │
│  ───────────────── │  │ ☑ Trata-se de um  │    │
│  Passo 2 de 3      │  │   revólver marca   │    │
│  (condicional)      │  │   Taurus, calibre  │    │
│                     │  │   .38...           │    │
│  Calibre: *        │  │ ☐ Acabamento      │    │
│  ○ .38             │  │   oxidado...       │    │
│  ○ .357            │  └──────────────────┘    │
│                     │  ...                     │
│  ───────────────── │                          │
│  [◀ Voltar]        │  [Gerar Laudo Wizard]    │
│       [Avançar ▶] │                          │
└─────────────────────┴──────────────────────────┘
```

**Funcionalidades:**
- Renderização dinâmica das etapas com base na árvore
- Ao selecionar opção em etapa pai, revela etapa filha
- Coluna direita: preview em tempo real do laudo sendo montado (readonly, agrupado por seção)
- Checkboxes para desmarcar peças (o usuário escolhe quais entram)
- Botão "Gerar Laudo Wizard" → chama `laudo:createWizard`
- Após gerar, redireciona para `LaudosPage` com o laudo criado
- Se reaberto (laudo já existe): carrega respostas anteriores, permite alterar

### 6.5 `src/renderer/pages/REPsPage.tsx` — Alterações

Adicionar na tabela de REPs, ao lado do botão "Criar Laudo" existente:

```tsx
// Linha ~773, ao lado do botão "Criar Laudo" atual
<Button
  size="sm"
  variant="outline"
  onClick={() => navigate(`/reps/${rep.id}/wizard`)}
  disabled={temLaudoWizard}
  title={temLaudoWizard ? 'Já possui laudo wizard' : 'Criar Laudo via Wizard'}
>
  <Zap className="mr-1 h-4 w-4" />
  Wizard
</Button>
```

---

## 7. Frontend: Rotas

Adicionar em `src/renderer/routes/index.tsx`:

```tsx
{
  path: '/pecas',
  element: <PecasPage />,
}
{
  path: '/wizards',
  element: <WizardsPage />,
}
{
  path: '/wizards/:id',
  element: <WizardEditorPage />,
}
{
  path: '/reps/:repId/wizard',
  element: <WizardLaudoPage />,
}
```

---

## 8. Frontend: Componentes

### `src/renderer/components/wizard/`

```
├── ArvoreEtapas.tsx         # Visualização em árvore (esquerda do editor)
├── ConfigEtapaPanel.tsx     # Painel direito de configuração de etapa
├── OpcoesEditor.tsx         # Lista de opções com add/remove/reorder
├── RegrasVinculadas.tsx      # Lista de peças vinculadas com checkboxes
├── VinculadorPecaDialog.tsx  # Dialog de busca no banco de peças
├── WizardStepper.tsx         # Navegação passo a passo (para WizardLaudoPage)
├── WizardEtapaRenderer.tsx   # Renderiza o input da etapa (select/radio/checkbox/text)
├── PecasChecklist.tsx        # Checklist de peças agrupadas por seção (preview)
└── LaudoPreview.tsx          # Preview readonly do laudo sendo montado
```

---

## 9. Sidebar

Adicionar em `src/renderer/components/layout/AppSidebar.tsx`:

```tsx
// Grupo "Cadastros" ou novo grupo "Wizard"
{
  title: 'Wizard',
  items: [
    { name: 'Peças', url: '/pecas', icon: Puzzle },
    { name: 'Wizards', url: '/wizards', icon: Wand },
  ],
}
```

---

## 10. Diferenciação Template vs Wizard na UI

A diferenciação entre laudos template vs wizard é feita via coluna `tipo_criacao`:
- `'template'` → badge azul "Template" na UI (listagem de laudos, tabela de REPs)
- `'wizard'`  → badge roxo "Wizard" na UI

Não há sufixo no número da REP. A REP mantém seu número único (ex: 2024/00123).
Cada laudo vinculado é identificado pelo tipo na listagem.

### Na tabela de REPs (REPsPage)

```
REP 2024/00123 — Furto de veículo
├─ [Template] Criado em 01/06/2024  ← badge azul
└─ [Wizard]   Criado em 02/06/2024  ← badge roxo
```

### Na listagem de laudos (LaudosPage)

Mesmo padrão: badge `tipo_criacao` como coluna ou indicador visual ao lado do nome do template/wizard.

---

## 11. Ordem de Implementação (Fases)

### Fase 1 — Database (schema v20)
1. Criar migration v20 em `src/main/database/index.ts`
   - 20a: Alterar tabela `laudos` (remover UNIQUE, adicionar colunas)
   - 20b: Criar novas tabelas (`wizards`, `etapas_wizard`, `opcoes_etapa`, `pecas`, `regras_wizard`, `respostas_wizard`)
2. Adicionar TypeScript interfaces em `src/main/types/database.ts`
3. Atualizar `CURRENT_SCHEMA_VERSION` para 20

### Fase 2 — Backend Services
1. `base.service.ts` — verificar se suporta as operações novas
2. `wizard.service.ts` + CRUD de wizard, getArvoreCompleta, saveArvoreCompleta
3. `peca.service.ts` — CRUD + search
4. `regra-wizard.service.ts` — CRUD + calcularPecas (lógica central)
5. `laudo.service.ts` — método `criarLaudoWizard` + `reaplicarRespostas`

### Fase 3 — IPC Handlers + Preload
1. `wizard.handlers.ts` — todos os canais listados na seção 5.1
2. `peca.handlers.ts` — seção 5.2
3. `regra-wizard.handlers.ts` — seção 5.3
4. Atualizar `laudo.handlers.ts` — adicionar `laudo:createWizard` e `laudo:reaplicarWizard`
5. Atualizar `ipc/index.ts` — registrar novos handlers
6. Atualizar `preload/index.ts` — expor API + allowed channels

### Fase 4 — Frontend: Banco de Peças
1. `PecasPage.tsx` — listagem, busca, filtro
2. Dialog de criação/edição de peça (com TinyMCE ou textarea rica)
3. Integrar rota e sidebar

### Fase 5 — Frontend: Editor de Wizard (Admin)
1. `WizardsPage.tsx` — listagem de wizards
2. `WizardEditorPage.tsx` — editor visual completo
3. Componentes auxiliares: `ArvoreEtapas`, `ConfigEtapaPanel`, `OpcoesEditor`, `RegrasVinculadas`, `VinculadorPecaDialog`
4. Integrar rotas e sidebar

### Fase 6 — Frontend: Preenchimento do Wizard (Perito)
1. `WizardLaudoPage.tsx` — página de preenchimento com preview
2. `WizardStepper`, `WizardEtapaRenderer`, `PecasChecklist`, `LaudoPreview`
3. Lógica de cascata: ao selecionar opção, revela etapa filha
4. Cálculo de peças em tempo real (chamada IPC `regra-wizard:calcularPecas`)
5. Botão "Gerar Laudo Wizard" e integração com `laudo:createWizard`
6. Retroatividade: reabrir wizard de laudo existente

### Fase 7 — Integração com REPsPage
1. Botão "Wizard" na tabela de REPs
2. Navegação para `/reps/:repId/wizard`
3. Atualizar listagem de laudos na REP para mostrar múltiplos laudos (template + wizard)

### Fase 8 — Testes e Ajustes
1. Testar fluxo completo: criar peça → criar wizard → preencher → gerar laudo → editar → reaplicar
2. Testar retroatividade
3. Testar edge cases: wizard sem template, peças sem seção, etc.

---

## 12. Observações Técnicas

### 12.1 SQLite e remoção de UNIQUE
SQLite não suporta `ALTER TABLE DROP CONSTRAINT`. A migration v20a precisa:
1. Criar tabela `laudos_v20` sem UNIQUE
2. Copiar dados
3. Drop tabela antiga, rename nova
4. Recriar índices

### 12.2 Retroatividade — marcadores HTML
Para identificar blocos de peças no HTML e substituí-los na reaplicação, cada peça inserida deve ser envolta em um marcador:

```html
<!-- data-peca-id="abc123" data-secao-id="xyz456" -->
<div data-peca-id="abc123" class="peca-wizard">
  <p>Trata-se de um revólver...</p>
</div>
```

Na reaplicação, o serviço localiza todos os `data-peca-id`, remove os que não estão mais nas novas regras, insere os novos, preserva o conteúdo fora desses marcadores (edições manuais do perito).

### 12.3 Template_id obrigatório no wizard?
Se o wizard tem `template_id = NULL`, não há seções definidas. Neste caso, as peças seriam concatenadas sequencialmente. **Recomendação:** exigir `template_id` em wizards — um wizard sempre precisa saber em quais seções inserir as peças.

### 12.4 Múltiplos laudos por REP
A UI da REPsPage atualmente espera 0 ou 1 laudo por REP. Com a remoção de UNIQUE, será necessário:
- `laudo:findByRepId` → mudar para `laudo:findAllByRepId` (retornar array)
- Tabela de REPs: mostrar badges de laudos ("Template" em azul, "Wizard" em roxo)
- Respeitar o limite de 1 laudo por tipo por REP (ver seção 12.6)

### 12.5 Padrões de código a seguir
- Seguir o padrão `BaseService<T>` existente para todos os novos services
- Handlers seguem o mesmo padrão de `try/catch` + `success/error` response
- Componentes usam Shadcn/ui para selects, dialogs, buttons
- Formulários usam `react-hook-form` + `zod` como nos existentes
- IDs usam `randomUUID()` do crypto
- Rotas seguem o padrão React Router v7

### 12.6 Restrição: 1 laudo por tipo por REP

Uma REP pode ter no máximo 2 laudos: **1 template + 1 wizard**. A restrição é aplicada no `laudo.service.ts`:

```ts
// Em criarLaudoInicial (template):
async criarLaudoInicial(params: { rep_id, perito_id, template_id }): Promise<LaudoRow> {
  // Validar se já existe laudo template
  const existente = await executeQuery<LaudoRow>(
    "SELECT id FROM laudos WHERE rep_id = ? AND tipo_criacao = 'template'",
    [params.rep_id]
  );
  if (existente.length > 0) {
    throw new Error('Já existe um laudo (Template) para esta REP');
  }
  // ... resto da lógica existente
}

// Em criarLaudoWizard:
async criarLaudoWizard(params: CriarLaudoWizardParams): Promise<LaudoRow> {
  // Validar se já existe laudo wizard
  const existente = await executeQuery<LaudoRow>(
    "SELECT id FROM laudos WHERE rep_id = ? AND tipo_criacao = 'wizard'",
    [params.rep_id]
  );
  if (existente.length > 0) {
    throw new Error('Já existe um laudo (Wizard) para esta REP');
  }
  // ... resto da lógica
}
```

**Regra de negócio resumida:**

| Tentativa | REP sem laudo | REP com 1 template | REP com 1 wizard | REP com ambos |
|---|---|---|---|---|
| Criar template | Permitido | Bloqueado | Permitido | Bloqueado |
| Criar wizard | Permitido | Permitido | Bloqueado | Bloqueado |

---

## 13. Sumário dos Arquivos a Criar/Modificar

### Arquivos Novos

| Arquivo | Fase |
|---|---|
| `migracao/wizard_pecas.md` | Este documento |
| `src/main/services/wizard.service.ts` | Fase 2 |
| `src/main/services/peca.service.ts` | Fase 2 |
| `src/main/services/regra-wizard.service.ts` | Fase 2 |
| `src/main/ipc/handlers/wizard.handlers.ts` | Fase 3 |
| `src/main/ipc/handlers/peca.handlers.ts` | Fase 3 |
| `src/main/ipc/handlers/regra-wizard.handlers.ts` | Fase 3 |
| `src/renderer/pages/PecasPage.tsx` | Fase 4 |
| `src/renderer/pages/WizardsPage.tsx` | Fase 5 |
| `src/renderer/pages/WizardEditorPage.tsx` | Fase 5 |
| `src/renderer/pages/WizardLaudoPage.tsx` | Fase 6 |
| `src/renderer/components/wizard/ArvoreEtapas.tsx` | Fase 5 |
| `src/renderer/components/wizard/ConfigEtapaPanel.tsx` | Fase 5 |
| `src/renderer/components/wizard/OpcoesEditor.tsx` | Fase 5 |
| `src/renderer/components/wizard/RegrasVinculadas.tsx` | Fase 5 |
| `src/renderer/components/wizard/VinculadorPecaDialog.tsx` | Fase 5 |
| `src/renderer/components/wizard/WizardStepper.tsx` | Fase 6 |
| `src/renderer/components/wizard/WizardEtapaRenderer.tsx` | Fase 6 |
| `src/renderer/components/wizard/PecasChecklist.tsx` | Fase 6 |
| `src/renderer/components/wizard/LaudoPreview.tsx` | Fase 6 |
| `src/renderer/lib/validators/wizard.schema.ts` | Fase 2 |

### Arquivos Modificados

| Arquivo | Mudança | Fase |
|---|---|---|
| `src/main/database/index.ts` | Migration v20 (a+b) | Fase 1 |
| `src/main/types/database.ts` | Novas interfaces | Fase 1 |
| `src/main/services/laudo.service.ts` | `criarLaudoWizard`, `reaplicarRespostas` | Fase 2 |
| `src/main/ipc/handlers/laudo.handlers.ts` | Novos handlers wizard | Fase 3 |
| `src/main/ipc/index.ts` | Registrar novos handlers | Fase 3 |
| `src/preload/index.ts` | Novos canais na API + ALLOWED_CHANNELS | Fase 3 |
| `src/preload/types.ts` | Tipos para wizard/peca/regra | Fase 3 |
| `src/renderer/pages/REPsPage.tsx` | Botão Wizard, suporte múltiplos laudos | Fase 7 |
| `src/renderer/routes/index.tsx` | Novas rotas | Fase 4 |
| `src/renderer/components/layout/AppSidebar.tsx` | Itens de menu | Fase 4 |
