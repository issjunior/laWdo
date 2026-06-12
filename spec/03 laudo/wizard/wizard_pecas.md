# Plano de Implementação: Wizards e Banco de Peças

> **Status:** Parcialmente implementado — seções 4.5.1 (bloqueio), 4.5.2a (criarLaudoWizardRascunho), 4.5.3 (status Bloqueado), 4.5.4 (desbloquear irmão), e 5.4b (REP auto-rascunho) pendentes de implementação.
> **Versão do schema atual:** 24 (alvo original: 20)
> **Data:** 2026-06-02

---

## 1. Visão Geral

Adicionar um **modo Wizard** como alternativa ao modo Template para criação de laudos periciais. O usuário responde perguntas em cascata (ex: tipo de arma → calibre → marca) e o sistema monta o laudo automaticamente com **peças** (trechos de texto pré-cadastrados) inseridas nas seções corretas.

> **Sistema single-user:** Não há separação de papéis. O mesmo usuário cadastra peças, configura wizards, cria REPs e preenche laudos.

### Conceitos-chave

| Conceito | Definição |
|---|---|
| **Wizard** | Árvore de decisão vinculada a um TipoExame. Define as perguntas e a ordem em que aparecem. |
| **Etapa** | Um nó da árvore. Representa uma pergunta com tipo de input (select, radio, checkbox, text, image). |
| **Opção** | Uma escolha possível dentro de uma etapa. Pode disparar uma sub-etapa (cascata). |
| **Peça** | Texto HTML pré-cadastrado no **banco de peças** (independente de wizard). Reutilizável entre wizards. Criável inline durante a edição do wizard. |
| **Regra** | Ponte entre wizard e peça. Define: "a peça X aparece na seção Y quando as condições Z forem atendidas". |
| **Resposta** | Escolha do usuário em uma etapa. Salva para retroatividade (alterar depois reaplica). |

### Fluxo completo do sistema

```
CONFIGURAÇÃO (o usuário monta o wizard):
  Sidebar → Wizards → [+ Novo Wizard] → Editor de Wizard
    ├── Monta árvore de etapas (perguntas + opções em cascata)
    ├── Vincula peças via dialog (busca existentes ou cria inline)
    └── Salva

  Sidebar → Peças (opcional — gerenciamento em lote)
    └── Criar/editar/excluir peças quando preferir fazer em massa

USO (o usuário preenche para gerar laudo):
  REPs → Botão "Wizard" na REP → WizardLaudoPage
    ├── Responde perguntas em cascata (stepper)
    ├── Vê preview em tempo real (peças agrupadas por seção)
    ├── Desmarca peças que não quiser incluir
    ├── "Salvar Progresso" → salva respostas, laudo continua Em andamento
    └── "Gerar Laudo Wizard" → calcula peças, gera HTML, laudo pronto

  Também acessível via:
    REPs → Badge "Wizard" clicável na coluna ações → WizardLaudoPage
    LaudosPage → Botão "Preencher" no laudo wizard → WizardLaudoPage
      (restaura respostas salvas anteriormente)

FLUXO TEMPLATE (inalterado):
  REPs → "Criar Laudo (Template)" → ... (fluxo existente)

FLUXO WIZARD (novo):
  REPs → "Criar Laudo (Wizard)" → WizardLaudoPage
    ├── Preenche perguntas → Salvar Progresso (continua depois)
    └── Preenche tudo → Gerar Laudo Wizard
```

### Fluxo comparativo (antes/depois)

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
| `respostas_wizard` | TEXT | **Cache JSON** das respostas do perito (snapshot desnormalizado para consulta rápida). A fonte da verdade é a tabela `respostas_wizard`. |

**Constraint `rep_id UNIQUE`:** Remover — uma REP pode ter até 2 laudos (1 template + 1 wizard). A restrição é aplicada em camada de aplicação (ver seção 12.6).

**Novo status `Bloqueado`:** A coluna `status` passa a aceitar 4 valores: `'Em andamento'`, `'Concluído'`, `'Entregue'`, `'Bloqueado'`. O status `Bloqueado` indica que este laudo foi travado porque o outro laudo da mesma REP foi concluído/entregue (ver seção 4.7).

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
  template_id TEXT NOT NULL,
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
| `template_id` | Template vinculado **(obrigatório)**. Define as seções onde as peças serão inseridas. Wizard sem template não faz sentido funcional. |

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

Armazena cada escolha do perito. **Esta é a fonte da verdade** para restaurar o estado do wizard. A coluna `laudos.respostas_wizard` é um cache JSON desnormalizado, atualizado em conjunto com esta tabela.

**Índices para as novas tabelas (migration v20c):**

```sql
-- Performance: buscar respostas por laudo (tela de preenchimento)
CREATE INDEX IF NOT EXISTS idx_respostas_wizard_laudo ON respostas_wizard(laudo_id);

-- Performance: calcular peças por wizard
CREATE INDEX IF NOT EXISTS idx_regras_wizard_wizard ON regras_wizard(wizard_id);

-- Performance: buscar etapas por wizard
CREATE INDEX IF NOT EXISTS idx_etapas_wizard_wizard ON etapas_wizard(wizard_id);

-- Performance: buscar opções por etapa
CREATE INDEX IF NOT EXISTS idx_opcoes_etapa_etapa ON opcoes_etapa(etapa_id);

-- Performance: busca de peças por categoria
CREATE INDEX IF NOT EXISTS idx_pecas_categoria ON pecas(categoria);

-- Performance: busca de wizards por tipo_exame
CREATE INDEX IF NOT EXISTS idx_wizards_tipo_exame ON wizards(tipo_exame_id);
```

---

## 3. TypeScript Interfaces

Adicionar em `src/main/types/database.ts`:

```ts
export interface WizardRow {
  id: string
  tipo_exame_id: string
  template_id: string
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

**Matriz de matching condição ↔ resposta:**

```ts
/**
 * Verifica se uma condição da regra é satisfeita pela resposta do perito.
 *
 * | tipo_input da etapa  | resposta (tipo)  | condição na regra | match?           |
 * |----------------------|------------------|--------------------|------------------|
 * | select, radio        | string           | "revolver"         | igualdade exata  |
 * | checkbox (multipla)  | string[]         | "revolver"         | array.includes   |
 * | checkbox (multipla)  | string[]         | ["a","c"]          | TODAS no array   |
 * | text                 | string           | "qualquer"         | igualdade exata  |
 * | text                 | string           | "*"                | sempre true      |
 * | image                | string (path)    | "*"                | sempre true      |
 * | (sem resposta)       | undefined        | qualquer           | false            |
 */
function condicaoSatisfeita(
  resposta: string | string[] | undefined,
  condicao: string | string[]
): boolean {
  if (resposta === undefined || resposta === null) return false;

  // Wildcard: condição "*" casa com qualquer resposta não-vazia
  if (condicao === '*') return true;

  // Resposta é array (checkbox/multipla_escolha)
  if (Array.isArray(resposta)) {
    if (Array.isArray(condicao)) {
      // Todas as condições precisam estar no array de respostas
      return condicao.every(c => resposta.includes(c));
    }
    // Condição única: basta estar presente no array
    return resposta.includes(condicao);
  }

  // Resposta é string: match exato
  return resposta === condicao;
}
```

> **Nota:** As condições no JSON da regra são sempre strings. Quando uma etapa `multipla_escolha` precisa casar com múltiplos valores, usa-se um array JSON: `{"etapa_tags": ["revolver", "taurus"]}`. O parser trata ambos os formatos.

### 4.5 `src/main/services/laudo.service.ts` — alterações nos métodos existentes

#### 4.5.1 `criarLaudoInicial()` (template) — adicionar verificação de bloqueio

```ts
async criarLaudoInicial(params: {
  rep_id: string; perito_id: string; template_id: string;
}): Promise<LaudoRow> {
  // 0a. Validar se já existe laudo template
  const existeTemplate = await executeQuery<LaudoRow>(
    "SELECT id FROM laudos WHERE rep_id = ? AND tipo_criacao = 'template'",
    [params.rep_id]
  );
  if (existeTemplate.length > 0) {
    throw new Error('Já existe um laudo (Template) para esta REP');
  }

  // 0b. Validar se existe laudo wizard Concluído/Entregue (bloqueio)
  const wizardFinalizado = await executeQuery<LaudoRow>(
    "SELECT id FROM laudos WHERE rep_id = ? AND tipo_criacao = 'wizard' AND status IN ('Concluído', 'Entregue')",
    [params.rep_id]
  );
  if (wizardFinalizado.length > 0) {
    throw new Error('Não é possível criar laudo template: já existe laudo wizard concluído/entregue para esta REP');
  }

  // 1. Carregar seções do template
  // ... (resto igual ao existente)
}
```

#### 4.5.2 `criarLaudoWizardRascunho()` + `gerarLaudoWizard()` — dois métodos separados

A criação do laudo wizard é dividida em **dois métodos** com responsabilidades distintas (evita ambiguidade de um método único com parâmetro opcional):

##### 4.5.2a `criarLaudoWizardRascunho()` — chamado pelo `rep:create`/`rep:update`

```ts
interface CriarLaudoWizardRascunhoParams {
  rep_id: string
  perito_id: string
  wizard_id: string
  template_id: string     // obtido do wizard (obrigatório)
}

/**
 * Cria um laudo wizard VAZIO (rascunho) vinculado à REP.
 * - conteudo = '' (será preenchido depois ao clicar "Gerar Laudo Wizard")
 * - respostas_wizard = '{}'
 * - status = 'Em andamento'
 *
 * Chamado automaticamente quando uma REP é criada/editada com modo_criacao='wizard'.
 */
async criarLaudoWizardRascunho(params: CriarLaudoWizardRascunhoParams): Promise<LaudoRow> {
  // 0a. VALIDAR: já existe laudo wizard para esta REP?
  const existeWizard = await executeQuery<LaudoRow>(
    "SELECT id FROM laudos WHERE rep_id = ? AND tipo_criacao = 'wizard'",
    [params.rep_id]
  );
  if (existeWizard.length > 0) {
    throw new Error('Já existe um laudo (Wizard) para esta REP');
  }

  // 0b. VALIDAR: existe laudo template Concluído/Entregue? (bloqueio)
  const templateFinalizado = await executeQuery<LaudoRow>(
    "SELECT id FROM laudos WHERE rep_id = ? AND tipo_criacao = 'template' AND status IN ('Concluído', 'Entregue')",
    [params.rep_id]
  );
  if (templateFinalizado.length > 0) {
    throw new Error('Não é possível criar laudo wizard: já existe laudo template concluído/entregue para esta REP');
  }

  // 1. Inserir laudo rascunho
  const id = randomUUID();
  const now = new Date().toISOString();

  await executeNonQuery(
    `INSERT INTO laudos (id, rep_id, perito_id, template_id, wizard_id, conteudo, status, tipo_criacao, respostas_wizard, data_inicio, versao, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '', 'Em andamento', 'wizard', '{}', ?, 1, ?, ?)`,
    [id, params.rep_id, params.perito_id, params.template_id, params.wizard_id, now, now, now]
  );

  const [laudo] = await executeQuery<LaudoRow>('SELECT * FROM laudos WHERE id = ?', [id]);
  return laudo;
}
```

##### 4.5.2b `gerarLaudoWizard()` — chamado pelo botão "Gerar Laudo Wizard"

```ts
interface GerarLaudoWizardParams {
  laudo_id?: string       // se existir, ATUALIZA laudo existente; senão CRIA novo
  rep_id: string
  perito_id: string
  wizard_id: string
  template_id: string
  respostas: Record<string, string | string[]>   // OBRIGATÓRIO
  pecas_selecionadas?: string[]                   // IDs que o usuário marcou no PecasChecklist
}

/**
 * Gera o laudo completo a partir das respostas do wizard.
 * - Se laudo_id for informado: atualiza laudo existente (reaplicação)
 * - Se laudo_id NÃO for informado: cria novo laudo (primeira geração)
 * - Calcula peças, gera HTML, salva conteúdo e respostas
 */
async gerarLaudoWizard(params: GerarLaudoWizardParams): Promise<LaudoRow> {
  const laudo = params.laudo_id ? await this.findById(params.laudo_id) : null;

  if (laudo) {
    // REAPLICAÇÃO: laudo já existe
    if (laudo.status === 'Bloqueado') {
      throw new Error('Não é possível gerar: laudo está bloqueado');
    }
    if (laudo.tipo_criacao !== 'wizard') {
      throw new Error('Este laudo não é do tipo wizard');
    }
  } else {
    // PRIMEIRA GERAÇÃO: validar unicidade e bloqueio
    const existeWizard = await executeQuery<LaudoRow>(
      "SELECT id FROM laudos WHERE rep_id = ? AND tipo_criacao = 'wizard'",
      [params.rep_id]
    );
    if (existeWizard.length > 0) {
      throw new Error('Já existe um laudo (Wizard) para esta REP');
    }

    const templateFinalizado = await executeQuery<LaudoRow>(
      "SELECT id FROM laudos WHERE rep_id = ? AND tipo_criacao = 'template' AND status IN ('Concluído', 'Entregue')",
      [params.rep_id]
    );
    if (templateFinalizado.length > 0) {
      throw new Error('Não é possível criar laudo wizard: já existe laudo template concluído/entregue');
    }
  }

  // 1. Carregar seções do template
  // 2. Calcular peças com base nas respostas (chamar regraWizardService.calcularPecas)
  // 3. Filtrar por pecas_selecionadas (se informado)
  // 4. Para cada seção, concatenar: conteúdo base da seção + peças (com data-peca-id e data-peca-hash)
  // 5. Gerar conteúdo HTML final
  // 6. Se laudo existe → UPDATE; senão → INSERT
  // 7. Atualizar laudos.respostas_wizard (cache JSON)
  // 8. Sobrescrever registros em respostas_wizard (tabela)
}
```

**Canais IPC correspondentes:**

| Canal | Serviço chamado | Quem chama |
|---|---|---|
| `laudo:createWizardRascunho` | `criarLaudoWizardRascunho()` | `rep:create` / `rep:update` (criação automática) |
| `laudo:gerarWizard` | `gerarLaudoWizard()` | WizardLaudoPage (botão "Gerar Laudo Wizard") |
| `laudo:salvarProgressoWizard` | `salvarProgressoWizard()` | WizardLaudoPage (botão "Salvar Progresso") |

**Cenários de uso:**

| Cenário | Canal IPC | `laudo_id` | `respostas` | Resultado |
|---|---|---|---|---|
| REP criada com Wizard | `laudo:createWizardRascunho` | — (cria novo) | — (sem respostas) | Laudo rascunho (`conteudo=''`, `Em andamento`) |
| REP editada para Wizard | `laudo:createWizardRascunho` | — (cria novo) | — (sem respostas) | Idem |
| Usuário clicou "Gerar Laudo Wizard" (1ª vez) | `laudo:gerarWizard` | — (cria novo) | preenchido | Laudo completo com HTML gerado |
| Usuário reaplicou wizard (laudo já existia) | `laudo:gerarWizard` | informado (atualiza) | preenchido | Laudo atualizado, edições manuais preservadas |

O laudo rascunho permite que o usuário:
- Salve progresso parcial (respostas via `salvarProgressoWizard`)
- Feche e continue depois (respostas restauradas ao reabrir)
- Veja o badge "Wizard: Em andamento" na REPsPage e LaudosPage

#### 4.5.3 `updateStatus()` — adicionar efeitos colaterais de bloqueio/desbloqueio

```ts
async updateStatus(id: string, novoStatus: string): Promise<LaudoRow> {
  // Validar status
  const statusValidos = ['Em andamento', 'Concluído', 'Entregue', 'Bloqueado'];
  if (!statusValidos.includes(novoStatus)) {
    throw new Error(`Status inválido. Use: ${statusValidos.join(', ')}`);
  }

  const laudo = await this.findById(id);
  if (!laudo) throw new Error('Laudo não encontrado');

  const now = new Date().toISOString();
  const updates: string[] = ['status = ?'];
  const params: string[] = [novoStatus];

  if (novoStatus === 'Concluído') {
    updates.push('data_conclusao = ?');
    params.push(now);
  }
  if (novoStatus === 'Entregue') {
    updates.push('data_entrega = ?');
    params.push(now);
  }

  params.push(id);
  const sql = `UPDATE laudos SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  await executeNonQuery(sql, params);

  // EFEITO COLATERAL: Bloquear/desbloquear o outro laudo da mesma REP
  const outroTipo = laudo.tipo_criacao === 'template' ? 'wizard' : 'template';

  if (novoStatus === 'Concluído' || novoStatus === 'Entregue') {
    // Bloquear o outro laudo se estiver Em andamento
    await executeNonQuery(
      `UPDATE laudos SET status = 'Bloqueado', updated_at = CURRENT_TIMESTAMP
       WHERE rep_id = ? AND tipo_criacao = ? AND status = 'Em andamento'`,
      [laudo.rep_id, outroTipo]
    );
  }

  if (novoStatus === 'Em andamento') {
    // Desbloquear o outro laudo se estiver Bloqueado
    await executeNonQuery(
      `UPDATE laudos SET status = 'Em andamento', updated_at = CURRENT_TIMESTAMP
       WHERE rep_id = ? AND tipo_criacao = ? AND status = 'Bloqueado'`,
      [laudo.rep_id, outroTipo]
    );
  }

  return this.findById(id) as Promise<LaudoRow>;
}
```

#### 4.5.4 `deletar()` — desbloquear o outro laudo + limpeza completa

```ts
/**
 * Ordem de deleção de um laudo (template ou wizard):
 *
 * 1. Desbloquear laudo irmão (se este estiver Concluído/Entregue)
 * 2. Deletar imagens do diretório do laudo (fs.rmSync)
 * 3. FK CASCADE cuida de: respostas_wizard (ON DELETE CASCADE no laudo_id)
 * 4. Deletar o laudo
 * 5. Se não houver mais laudos para esta REP → resetar status para 'Pendente'
 */
async deletar(id: string): Promise<{ rep_id: string }> {
  const laudo = await this.findById(id);
  if (!laudo) throw new Error('Laudo não encontrado');

  // 1. Se este laudo está Concluído/Entregue, desbloquear o outro
  if (laudo.status === 'Concluído' || laudo.status === 'Entregue') {
    const outroTipo = laudo.tipo_criacao === 'template' ? 'wizard' : 'template';
    await executeNonQuery(
      `UPDATE laudos SET status = 'Em andamento', updated_at = CURRENT_TIMESTAMP
       WHERE rep_id = ? AND tipo_criacao = ? AND status = 'Bloqueado'`,
      [laudo.rep_id, outroTipo]
    );
  }

  // 2. Deletar imagens do diretório do laudo
  const laudoDir = path.join(app.getPath('userData'), 'laudos', id);
  if (fs.existsSync(laudoDir)) {
    fs.rmSync(laudoDir, { recursive: true, force: true });
  }

  // 3. FK CASCADE cuida automaticamente de:
  //    - respostas_wizard (ON DELETE CASCADE no laudo_id)
  //    NÃO é necessário deletar manualmente

  // 4. Deletar o laudo
  await this.delete(id);

  // 5. Resetar status da REP se não houver mais laudos
  const laudosRestantes = await executeQuery<LaudoRow>(
    "SELECT id FROM laudos WHERE rep_id = ?", [laudo.rep_id]
  );
  if (laudosRestantes.length === 0) {
    await repService.updateStatus(laudo.rep_id, 'Pendente');
  }

  return { rep_id: laudo.rep_id };
}
```

**Tabela de limpeza de recursos órfãos:**

| Recurso | Como é limpo |
|---|---|
| `respostas_wizard` (tabela) | `ON DELETE CASCADE` no FK `laudo_id` → automático |
| `laudos.respostas_wizard` (coluna JSON) | Junto com a row do laudo no DELETE |
| Imagens do laudo (`laudos/{laudoId}/`) | `fs.rmSync` com `recursive: true, force: true` |
| Laudo irmão bloqueado | Desbloqueado automaticamente → `Em andamento` |

#### 4.5.5 `salvarProgressoWizard()` — salvar respostas sem gerar laudo

```ts
/**
 * Salva as respostas parciais do wizard sem recalcular peças nem gerar HTML.
 * O laudo continua com status "Em andamento" e conteúdo atual inalterado.
 * Usado pelo botão "Salvar Progresso" na WizardLaudoPage.
 *
 * ATUALIZA AMBAS as fontes na mesma transação:
 * 1. laudos.respostas_wizard (cache JSON) — para consulta rápida
 * 2. respostas_wizard (tabela) — source of truth para restauração
 */
async salvarProgressoWizard(
  laudoId: string,
  respostas: Record<string, string | string[]>
): Promise<void> {
  const laudo = await this.findById(laudoId);
  if (!laudo) throw new Error('Laudo não encontrado');
  if (laudo.status === 'Bloqueado') {
    throw new Error('Não é possível salvar progresso: laudo está bloqueado');
  }

  // Atualizar snapshot JSON no laudo (cache)
  await executeNonQuery(
    `UPDATE laudos SET respostas_wizard = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [JSON.stringify(respostas), laudoId]
  );

  // Sobrescrever registros em respostas_wizard (source of truth)
  await executeNonQuery(
    `DELETE FROM respostas_wizard WHERE laudo_id = ?`,
    [laudoId]
  );

  for (const [etapaId, valor] of Object.entries(respostas)) {
    const valorTexto = Array.isArray(valor) ? JSON.stringify(valor) : String(valor);
    await executeNonQuery(
      `INSERT INTO respostas_wizard (id, laudo_id, etapa_id, valor_texto, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), laudoId, etapaId, valorTexto, new Date().toISOString()]
    );
  }
}
```

**Formato do JSON cache (`laudos.respostas_wizard`):**
```json
{
  "etapa_arma": "revolver",
  "etapa_calibre": "38",
  "etapa_tags": ["ferrugem", "oxidacao"],
  "etapa_observacao": "texto livre digitado pelo perito",
  "_wizard_id": "wiz_abc123",
  "_atualizado_em": "2026-06-04T10:30:00Z"
}
```

> **Dupla persistência:** A tabela `respostas_wizard` é a **fonte da verdade** (normalizada, usada para restaurar o estado do WizardLaudoPage). A coluna `laudos.respostas_wizard` é um **cache JSON desnormalizado** (para consultas rápidas sem JOIN, exibição em tooltips, etc.). Ambas são atualizadas atomicamente nas operações de save.

**Ciclo de vida completo da WizardLaudoPage:**

```
┌──────────────────────────────────────────────────────────────────┐
│               WIZARDLAUDOPAGE — CICLO DE VIDA                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. AO CARREGAR (mount):                                          │
│     → Buscar laudo por rep_id (laudo:findByRepId)                 │
│     → Carregar wizard (wizard:getArvore)                          │
│     → Se laudo existe: carregar respostas da TABELA               │
│       respostas_wizard (source of truth) e restaurar inputs       │
│     → Chamar regra-wizard:calcularPecas() para preview inicial    │
│     → Renderizar PecasChecklist (reativo, atualiza a cada input)  │
│                                                                    │
│  2. A CADA MUDANÇA DE RESPOSTA (onChange):                        │
│     → Atualizar estado local (React useState)                     │
│     → Recalcular PecasChecklist via calcularPecas()               │
│       (chamada IPC a cada mudança ou debounced 300ms)             │
│     → LaudoPreview atualiza em tempo real                         │
│     → NADA é persistido no banco ainda                            │
│                                                                    │
│  3. "SALVAR PROGRESSO" (botão):                                   │
│     → Chamar laudo:salvarProgressoWizard                          │
│     → Persiste respostas na TABELA + cache JSON no laudo          │
│     → NÃO recalcula nem gera HTML do laudo                        │
│     → Laudo.conteudo permanece inalterado (ou vazio)              │
│     → Toast: "Progresso salvo. Você pode continuar depois."       │
│     → Usuário pode fechar a página e voltar depois                │
│                                                                    │
│  4. "GERAR LAUDO WIZARD" (botão):                                 │
│     → Validar etapas obrigatórias (ver seção 6.4)                 │
│     → Chamar laudo:gerarWizard com respostas + pecas_selecionadas │
│     → Backend: calcula peças, gera HTML completo, salva           │
│     → Redirecionar para LaudosPage com toast:                     │
│       "Laudo gerado! Deseja adicionar ilustrações?"               │
│                                                                    │
│  5. REABERTURA (laudo já existia):                                │
│     → Carregar respostas da tabela respostas_wizard               │
│     → Restaurar inputs e PecasChecklist                           │
│     → Se laudo.status === 'Bloqueado':                            │
│       → Exibir Alert com Lock                                    │
│       → Todos os inputs e botões desabilitados                    │
│       → Preview visível em modo readonly                          │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

**Fluxo de save progress:**
1. Usuário está na WizardLaudoPage preenchendo as perguntas
2. Responde algumas etapas, mas não todas
3. Clica "Salvar Progresso" → `laudo:salvarProgressoWizard` é chamado
4. Respostas são persistidas no banco (cache JSON `laudos.respostas_wizard` + tabela `respostas_wizard`)
5. Usuário pode fechar a página e voltar depois
6. Ao reabrir, `WizardLaudoPage` carrega da tabela `respostas_wizard` (source of truth) e restaura os inputs
7. Continua de onde parou
8. Quando terminar, clica "Gerar Laudo Wizard" → chama `laudo:gerarWizard` que calcula peças e gera HTML

### 4.6 Retroatividade (Gerar/Atualizar laudo final)

```ts
async reaplicarRespostas(laudoId: string, novasRespostas: Record<string, string | string[]>): Promise<LaudoRow> {
  // 0. Validar: laudo não pode estar Bloqueado
  const laudo = await this.findById(laudoId);
  if (laudo.status === 'Bloqueado') {
    throw new Error('Não é possível reaplicar: laudo está bloqueado porque o outro laudo da REP foi concluído/entregue');
  }

  // 1. Carregar laudo e wizard vinculado
  // 2. Recalcular peças com novas respostas
  // 3. Para cada peça calculada:
  //    a. Localizar o bloco data-peca-id no HTML atual
  //    b. Comparar o hash do conteúdo atual (data-peca-hash) com o hash original
  //    c. Se hash igual → peça NÃO foi editada → substituir pelo novo conteúdo
  //    d. Se hash diferente → peça foi editada manualmente → PRESERVAR edição do perito
  // 4. Peças que não estão mais nas regras → remover blocos data-peca-id
  // 5. Peças novas → inserir nas seções corretas
  // 6. Conteúdo FORA dos marcadores data-peca-id é SEMPRE preservado:
  //    - Ilustrações (<figure class="laudo-figure">)
  //    - Edições manuais do usuário no TinyMCE
  //    - Cabeçalhos, rodapés, formatação customizada
  // 7. Atualizar laudo.conteudo e respostas_wizard
  // 8. Sobrescrever registros em respostas_wizard
}
```

**Detecção de edição manual via hash:**

Cada peça inserida no HTML carrega um hash do conteúdo original:

```html
<div data-peca-id="abc123" data-peca-hash="a1b2c3d4e5f6" class="peca-wizard">
  <p>Trata-se de um revólver...</p>
</div>
```

Na reaplicação, o algoritmo `reaplicarBlocoPeca()`:

```ts
function reaplicarBlocoPeca(
  pecaId: string,
  novoConteudo: string,
  htmlAtual: string
): string {
  const blocoAtual = extrairConteudoBloco(htmlAtual, pecaId);
  const hashAtual = extrairHash(htmlAtual, pecaId);
  const hashOriginal = calcularHash(novoConteudo);

  if (!blocoAtual) {
    // Peça nova (não existe no HTML) → inserir
    return inserirBloco(htmlAtual, pecaId, novoConteudo, hashOriginal);
  }

  if (hashAtual && hashAtual !== calcularHash(blocoAtual)) {
    // Hash mudou → perito editou manualmente → PRESERVAR
    return htmlAtual;
  }

  // Hash igual → peça intacta → substituir com novo conteúdo
  return substituirBloco(htmlAtual, pecaId, novoConteudo, hashOriginal);
}
```

### 4.7 Lógica de Bloqueio entre Laudos

Quando uma REP possui dois laudos (1 template + 1 wizard), eles seguem regras de bloqueio mútuo:

#### Máquina de estados do bloqueio

```
┌─────────────────────────────────────────────────────────────────┐
│  AMBOS Em andamento                                             │
│  ┌──────────────┐    ┌──────────────┐                           │
│  │   Template   │    │    Wizard    │                           │
│  │ Em andamento │    │ Em andamento │                           │
│  └──────┬───────┘    └──────┬───────┘                           │
│         │                   │                                    │
│         │ Concluir/Entregar │                                    │
│         ▼                   ▼                                    │
│  ┌──────────────┐    ┌──────────────┐                           │
│  │   Template   │    │    Wizard    │                           │
│  │ Concluído/   │    │  Bloqueado   │  ← bloqueado automatic.   │
│  │ Entregue     │    │              │                           │
│  └──────┬───────┘    └──────┬───────┘                           │
│         │                   │                                    │
│         │ Preencher         │ (sem ação possível,                │
│         │ (volta Em and.)   │  apenas Excluir)                  │
│         ▼                   ▼                                    │
│  ┌──────────────┐    ┌──────────────┐                           │
│  │   Template   │    │    Wizard    │                           │
│  │ Em andamento │    │ Em andamento │  ← desbloqueado automatic. │
│  └──────────────┘    └──────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

#### Regras completas

| Gatilho | Efeito |
|---|---|
| Laudo A muda para `Concluído` | Laudo B (se existir e estiver `Em andamento`) → `Bloqueado` |
| Laudo A muda para `Entregue` | Laudo B (se existir e estiver `Em andamento`) → `Bloqueado` |
| Laudo A volta para `Em andamento` (Preencher) | Laudo B (se estiver `Bloqueado`) → `Em andamento` |
| Tentar criar laudo template | Bloqueado se existir wizard `Concluído`/`Entregue` |
| Tentar criar laudo wizard | Bloqueado se existir template `Concluído`/`Entregue` |
| Deletar laudo `Concluído`/`Entregue` | Laudo B (se estiver `Bloqueado`) → `Em andamento` |
| Deletar laudo `Bloqueado` | Sem efeito no outro laudo |
| Deletar laudo `Em andamento` (ambos `Em andamento`) | Sem efeito no outro laudo |
| Tentar reaplicar/editar laudo `Bloqueado` | Erro: laudo bloqueado |

#### Comportamento do status `Bloqueado`

- O status `Bloqueado` é **terminal enquanto durar o bloqueio**: o laudo não pode ser editado, preenchido, concluído ou entregue.
- A única ação disponível para um laudo `Bloqueado` é **Excluir**.
- Para desbloquear, é necessário reabrir o outro laudo (colocá-lo de volta em `Em andamento`) ou deletá-lo.
- Na UI, badge cinza/slate com tooltip explicativo.

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

Adicionar handlers + atualizar validação de status:

```ts
// Atualizar array de status válidos (adicionar 'Bloqueado'):
const statusValidos = ['Em andamento', 'Concluído', 'Entregue', 'Bloqueado'];

// Novos handlers:
ipcMain.handle('laudo:createWizardRascunho', async (_, params) => {
  return laudoService.criarLaudoWizardRascunho(params)
})

ipcMain.handle('laudo:gerarWizard', async (_, params) => {
  return laudoService.gerarLaudoWizard(params)
})

ipcMain.handle('laudo:salvarProgressoWizard', async (_, laudoId, respostas) => {
  await laudoService.salvarProgressoWizard(laudoId, respostas)
  return { success: true }
})
```

### 5.4b Alterar `rep.handlers.ts` — suporte a `modo_criacao='wizard'`

```ts
// rep:create — adicionar suporte a wizard:
ipcMain.handle('rep:create', async (_event, data) => {
  // ... validações existentes (numero, duplicidade) ...

  const { modo_criacao, wizard_id, template_id, perito_id, ...repData } = data;

  // 1. Criar REP (sempre acontece)
  const rep = await repService.create(sanitizedRepData);

  // 2. Criar laudo conforme modo
  if (modo_criacao === 'wizard' && wizard_id && perito_id) {
    // Validar: wizard existe e pertence ao tipo_exame da REP
    const wizard = await wizardService.findById(wizard_id);
    if (!wizard || wizard.tipo_exame_id !== rep.tipo_exame_id) {
      // Não falha a criação da REP, mas retorna aviso
      return { 
        success: true, 
        data: rep, 
        warning: 'Wizard inválido para este tipo de exame. Laudo não foi criado.'
      };
    }

    try {
      await laudoService.criarLaudoWizardRascunho({
        rep_id: rep.id,
        perito_id,
        wizard_id,
        template_id: wizard.template_id,
      });
      logInfo('Laudo wizard rascunho criado automaticamente para REP', { repId: rep.id });
      auditCicloVida('', 'laudo', rep.id, 'criacao',
        `Laudo wizard rascunho criado automaticamente para REP ${data.numero}`,
        null,
        { rep_id: rep.id, perito_id, wizard_id, tipo_criacao: 'wizard' },
      );
    } catch (laudoError) {
      // REP foi criada, laudo não. Retorna warning para o frontend exibir toast
      logError('Erro ao criar laudo wizard rascunho — REP criada sem laudo', laudoError);
      return { 
        success: true, 
        data: rep, 
        warning: 'REP criada, mas houve erro ao criar o laudo wizard. Você pode criá-lo depois.'
      };
    }
  } else if (template_id && perito_id && template_id !== 'tpl-nao-definido') {
    // Fluxo template existente (mantido igual)
    try {
      await laudoService.criarLaudoInicial({ rep_id: rep.id, perito_id, template_id });
    } catch (laudoError) {
      logError('Erro ao criar laudo automático — REP criada sem laudo', laudoError);
    }
  }

  return { success: true, data: rep };
});
```

> **Transação:** SQLite não suporta transações atômicas multi-tabela. A REP é a entidade primária — sempre é criada. O laudo é derivado. Se a criação do laudo falhar, a REP sobrevive e o `warning` permite que o frontend exiba um toast informativo e o usuário crie o laudo manualmente depois.

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
'laudo:createWizardRascunho', 'laudo:gerarWizard', 'laudo:salvarProgressoWizard',
```

---

## 6. Frontend: Páginas

### 6.1 `src/renderer/pages/PecasPage.tsx` — Banco de Peças

**Estrutura shadcn:**

```tsx
// Imports
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/data-table/data-table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Search, Edit, Trash2, Loader2, AlertCircle, Package } from 'lucide-react';

<TooltipProvider>
  <div className="container mx-auto p-4 md:p-6 space-y-6">

    {/* Cabeçalho */}
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Banco de Peças</h1>
        <p className="text-muted-foreground mt-1">Gerencie os trechos de texto em lote. Peças também podem ser criadas inline durante a edição do wizard.</p>
      </div>
      <Button onClick={handleNova} className="flex items-center gap-2 w-full sm:w-auto">
        <Plus size={16} /> Nova Peça
      </Button>
    </div>

    {/* Card com DataTable */}
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
          <div>
            <CardTitle>Lista de Peças</CardTitle>
            <CardDescription>{pecas.length} peça(s) cadastrada(s)</CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou tag..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Loading / Error / Empty / DataTable */}
        <DataTable
          columns={colunas}
          data={pecas}
          searchColumn="nome"
          searchPlaceholder="Buscar peça..."
        />
      </CardContent>
    </Card>
  </div>
</TooltipProvider>
```

**Colunas do DataTable:**

```tsx
const colunas: ColumnDef<PecaItem>[] = [
  {
    accessorKey: 'nome',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nome" />,
    cell: ({ row }) => (
      <div>
        <span className="font-medium">{row.original.nome}</span>
        {row.original.descricao && (
          <p className="text-xs text-muted-foreground truncate max-w-[300px]">{row.original.descricao}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'categoria',
    header: 'Categoria',
    cell: ({ row }) => {
      const cat = row.getValue('categoria') as string;
      return cat ? (
        <Badge variant="secondary" className="text-xs">{cat}</Badge>
      ) : <span className="text-muted-foreground text-xs">—</span>;
    },
  },
  {
    accessorKey: 'tags',
    header: 'Tags',
    cell: ({ row }) => {
      const tags: string[] = row.original.tags ? JSON.parse(row.original.tags) : [];
      return (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map(t => (
            <Badge key={t} variant="outline" className="text-[10px] h-4 px-1.5">{t}</Badge>
          ))}
          {tags.length > 3 && <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>}
        </div>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <div className="flex justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => handleEditar(row.original)}>
              <Edit size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-xs">Editar peça</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleExcluir(row.original)}>
              <Trash2 size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-xs">Excluir peça</p></TooltipContent>
        </Tooltip>
      </div>
    ),
  },
];
```

**Dialog de criação/edição:**

```tsx
<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        {editando ? 'Editar Peça' : 'Nova Peça'}
      </DialogTitle>
      <DialogDescription>
        {editando ? 'Atualize os dados da peça.' : 'Cadastre um novo trecho de texto para usar nos wizards.'}
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="peca-nome">Nome *</Label>
        <Input id="peca-nome" value={form.nome} onChange={...} placeholder="Ex: Revólver Taurus .38" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="peca-descricao">Descrição</Label>
        <Input id="peca-descricao" value={form.descricao} onChange={...} placeholder="Breve descrição do trecho" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="peca-categoria">Categoria</Label>
          <Input id="peca-categoria" value={form.categoria} onChange={...} placeholder="Ex: armas" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="peca-tags">Tags (separadas por vírgula)</Label>
          <Input id="peca-tags" value={form.tags} onChange={...} placeholder="revolver, taurus, calibre38" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="peca-conteudo">Conteúdo HTML *</Label>
        <Textarea
          id="peca-conteudo"
          value={form.conteudo}
          onChange={...}
          placeholder="&lt;p&gt;Trata-se de um revólver...&lt;/p&gt;"
          className="min-h-[160px] font-mono text-sm"
        />
      </div>
      {/* Preview do HTML renderizado */}
      {form.conteudo && (
        <Card className="bg-muted/30">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Preview</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-3 text-sm prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: form.conteudo }} />
        </Card>
      )}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
      <Button onClick={handleSalvar} disabled={!form.nome || !form.conteudo}>
        {editando ? 'Atualizar' : 'Criar'} Peça
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Tema (light/dark):**
- Cards: `bg-card text-card-foreground border-border` — sombra suave no light, borda visível no dark
- Inputs: `bg-card text-foreground` — fundo branco no light, `#161e2e` no dark
- Tags: `Badge variant="outline"` — herdando cores do tema
- Preview HTML: `prose prose-sm dark:prose-invert` — tipografia adaptável
- Empty state: ícone `Package size={32} className="opacity-40"` + texto `text-muted-foreground`

### 6.2 `src/renderer/pages/WizardsPage.tsx` — Lista de Wizards

**Estrutura shadcn:**

```tsx
// Imports
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, Wand, Layers, Puzzle } from 'lucide-react';

<TooltipProvider>
  <div className="container mx-auto p-4 md:p-6 space-y-6">

    {/* Cabeçalho */}
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Wizards</h1>
        <p className="text-muted-foreground mt-1">Configure as árvores de decisão para criação de laudos</p>
      </div>
      <Button onClick={handleNovo} className="flex items-center gap-2 w-full sm:w-auto">
        <Plus size={16} /> Novo Wizard
      </Button>
    </div>

    {/* Cards de estatísticas */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          <Wand size={16} className="text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{wizards.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Wizards cadastrados</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
          <Layers size={16} className="text-emerald-500" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{ativos}</p>
          <p className="text-xs text-muted-foreground mt-1">Prontos para uso</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">Inativos</CardTitle>
          <Puzzle size={16} className="text-slate-400" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-slate-500">{inativos}</p>
          <p className="text-xs text-muted-foreground mt-1">Desabilitados</p>
        </CardContent>
      </Card>
    </div>

    {/* Card com DataTable */}
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
          <div>
            <CardTitle>Lista de Wizards</CardTitle>
            <CardDescription>{wizards.length} wizard(s) — {ativos} ativo(s)</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={tipoExameFiltro} onValueChange={setTipoExameFiltro}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo de Exame" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {tiposExame.map(t => <SelectItem key={t.id} value={t.id}>{t.codigo} - {t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-8 w-[200px]" value={busca} onChange={...} />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable columns={colunas} data={wizards} searchColumn="nome" searchPlaceholder="Buscar wizard..." />
      </CardContent>
    </Card>
  </div>
</TooltipProvider>
```

**Colunas do DataTable:**

```tsx
const colunas: ColumnDef<WizardItem>[] = [
  {
    accessorKey: 'nome',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Nome" />,
    cell: ({ row }) => (
      <div className="cursor-pointer hover:text-primary transition-colors"
           onClick={() => navigate(`/wizards/${row.original.id}`)}>
        <span className="font-medium">{row.original.nome}</span>
        {row.original.descricao && (
          <p className="text-xs text-muted-foreground truncate max-w-[260px]">{row.original.descricao}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'tipo_exame',
    header: 'Tipo Exame',
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs font-mono">
        {row.original.tipo_exame_codigo || row.original.tipo_exame_nome}
      </Badge>
    ),
  },
  {
    accessorKey: 'template_nome',
    header: 'Template',
    cell: ({ row }) => {
      const nome = row.getValue('template_nome') as string;
      return nome ? (
        <span className="text-sm">{nome}</span>
      ) : <span className="text-muted-foreground text-xs">—</span>;
    },
  },
  {
    accessorKey: 'estatisticas',
    header: 'Etapas / Peças',
    cell: ({ row }) => (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{row.original.etapas_count} etapas</span>
        <span className="text-border">|</span>
        <span className="text-muted-foreground">{row.original.pecas_count} peças</span>
      </div>
    ),
  },
  {
    accessorKey: 'ativo',
    header: 'Status',
    cell: ({ row }) => {
      const ativo = row.getValue('ativo') as boolean;
      return (
        <Badge className={ativo
          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700'
          : 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800'
        }>
          {ativo ? 'Ativo' : 'Inativo'}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <div className="flex justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => navigate(`/wizards/${row.original.id}`)}>
              <Edit size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-xs">Editar wizard</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleExcluir(row.original)}>
              <Trash2 size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-xs">Excluir wizard</p></TooltipContent>
        </Tooltip>
      </div>
    ),
  },
];
```

**Dialog de criação (Novo Wizard):**

```tsx
<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogContent className="max-w-xl">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Wand className="h-5 w-5 text-primary" /> Novo Wizard
      </DialogTitle>
      <DialogDescription>Configure o wizard — a árvore de etapas será editada na próxima tela.</DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <Label htmlFor="wiz-nome">Nome *</Label>
        <Input id="wiz-nome" placeholder="Ex: Wizard Armas de Fogo" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wiz-descricao">Descrição</Label>
        <Input id="wiz-descricao" placeholder="Descrição do propósito do wizard" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="wiz-tipo-exame">Tipo de Exame *</Label>
          <Select>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {tiposExame.map(t => <SelectItem key={t.id} value={t.id}>{t.codigo} - {t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="wiz-template">Template *</Label>
          <Select>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
      <Button onClick={handleCriar} disabled={!nome || !tipoExameId || !templateId}>
        Criar e Editar Etapas
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### 6.3 `src/renderer/pages/WizardEditorPage.tsx` — Editor de Wizard

**Layout shadcn (grid 2 colunas responsivo):**

```tsx
// Imports
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Plus, GripVertical, Trash2, Save, Eye } from 'lucide-react';

<TooltipProvider>
  <div className="container mx-auto p-4 md:p-6 h-full flex flex-col space-y-4">
    {/* Topo: voltar + título + ações */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/wizards')}>
          <ArrowLeft size={16} className="mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-xl font-bold">{wizard.nome || 'Novo Wizard'}</h1>
          <p className="text-sm text-muted-foreground">{wizard.descricao}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleSimular}>
          <Eye size={14} className="mr-1" /> Simular
        </Button>
        <Button size="sm" onClick={handleSalvar} disabled={saving}>
          <Save size={14} className="mr-1" /> Salvar
        </Button>
      </div>
    </div>

    {/* Corpo: grid 2 colunas */}
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 min-h-0">
      {/* Coluna esquerda: Árvore de Etapas */}
      <Card className="flex flex-col min-h-0">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers size={14} /> Árvore de Etapas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto px-0">
          <ArvoreEtapas
            etapas={arvore}
            etapaSelecionada={etapaSelecionada}
            onSelect={setEtapaSelecionada}
            onReorder={handleReorder}
          />
        </CardContent>
        <div className="p-3 border-t flex-shrink-0">
          <Button variant="outline" size="sm" className="w-full" onClick={handleAddEtapaRaiz}>
            <Plus size={14} className="mr-1" /> Adicionar Etapa Raiz
          </Button>
        </div>
      </Card>

      {/* Coluna direita: Configuração da Etapa */}
      <Card className="flex flex-col min-h-0">
        {etapaSelecionada ? (
          <>
            <CardContent className="flex-1 overflow-y-auto space-y-6 p-4">
              {/* Configuração básica */}
              <ConfigEtapaPanel
                etapa={etapaSelecionada}
                onChange={handleUpdateEtapa}
              />

              <Separator />

              {/* Opções da etapa */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold">Opções</Label>
                  <Button variant="ghost" size="sm" onClick={handleAddOpcao}>
                    <Plus size={12} className="mr-1" /> Adicionar
                  </Button>
                </div>
                <OpcoesEditor
                  opcoes={etapaSelecionada.opcoes}
                  onChange={handleUpdateOpcoes}
                  onReorder={handleReorderOpcoes}
                />
              </div>

              <Separator />

              {/* Regras vinculadas (peças) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold">Peças Vinculadas</Label>
                  <Button variant="ghost" size="sm" onClick={() => setVinculadorOpen(true)}>
                    <Plus size={12} className="mr-1" /> Vincular Peça
                  </Button>
                </div>
                <RegrasVinculadas
                  regras={regrasDaEtapa}
                  secoes={secoesTemplate}
                  onChange={handleUpdateRegras}
                  onRemove={handleRemoveRegra}
                />
              </div>
            </CardContent>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Layers size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selecione uma etapa na árvore</p>
              <p className="text-xs mt-1 opacity-60">para configurar pergunta, opções e peças</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  </div>
</TooltipProvider>
```

**Componentes auxiliares usados:**

| Componente | Shadcn usado | Descrição |
|---|---|---|
| `ArvoreEtapas` | `Button` (ghost), CSS custom | Árvore indentada com linhas. Cada nó é um `button` com `variant="ghost"`. Nó selecionado usa `bg-accent text-accent-foreground`. Suporte a drag-and-drop via `@dnd-kit`. |
| `ConfigEtapaPanel` | `Input`, `Select`, `Checkbox`, `Label` | Pergunta (Input), tipo_input (Select: select/radio/checkbox/text/image), obrigatório (Checkbox), múltipla escolha (Checkbox). |
| `OpcoesEditor` | `Button` (ghost/outline), `GripVertical` | Lista de opções com label e valor (Input inline), botão remover, drag handle. |
| `RegrasVinculadas` | `Checkbox`, `Badge`, `Select` | Cada regra: Checkbox (ativar/desativar) + Badge com nome da peça + Select da seção alvo. Badge da peça usa `variant="secondary"`. |
| `VinculadorPecaDialog` | `Dialog`, `DataTable`, `Input` (busca) | Dialog com DataTable do banco de peças para buscar e selecionar. **Inclui botão "+ Criar Nova Peça"** que abre sub-dialog inline com os campos: nome, descrição, categoria, tags, conteúdo HTML + preview. Ao salvar, a peça já aparece selecionada para vincular. |

**VinculadorPecaDialog com criação inline:**

```tsx
<Dialog open={vinculadorOpen} onOpenChange={setVinculadorOpen}>
  <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Puzzle className="h-5 w-5 text-primary" /> Vincular Peça
      </DialogTitle>
      <DialogDescription>
        Selecione uma peça existente ou crie uma nova para vincular à etapa atual.
      </DialogDescription>
    </DialogHeader>

    {/* Filtros */}
    <div className="flex gap-2 py-2">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou tag..." className="pl-8" value={busca} onChange={...} />
      </div>
      <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas</SelectItem>
          {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>

    {/* DataTable de peças */}
    <div className="flex-1 overflow-y-auto min-h-0">
      <DataTable
        columns={colunasPecas}
        data={pecasFiltradas}
        searchColumn="nome"
        searchPlaceholder=""
        hideSearch
        onRowClick={handleSelecionarPeca}
      />
    </div>

    {/* Rodapé com ações */}
    <div className="flex items-center justify-between pt-4 border-t">
      <Button variant="ghost" size="sm" onClick={() => setCriarPecaOpen(true)} className="text-primary">
        <Plus size={14} className="mr-1" /> Criar Nova Peça
      </Button>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setVinculadorOpen(false)}>Cancelar</Button>
        <Button onClick={handleVincular} disabled={!pecaSelecionada}>
          Vincular Peça
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>

{/* Sub-dialog: Criar Peça inline */}
<Dialog open={criarPecaOpen} onOpenChange={setCriarPecaOpen}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" /> Nova Peça
      </DialogTitle>
      <DialogDescription>
        Crie rapidamente uma peça — ela ficará disponível no banco e será automaticamente selecionada.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-2">
      <Input placeholder="Nome da peça *" value={form.nome} onChange={...} />
      <Input placeholder="Descrição" value={form.descricao} onChange={...} />
      <div className="grid grid-cols-2 gap-4">
        <Input placeholder="Categoria (ex: armas)" value={form.categoria} onChange={...} />
        <Input placeholder="Tags (separadas por vírgula)" value={form.tags} onChange={...} />
      </div>
      <Textarea
        placeholder="&lt;p&gt;Conteúdo HTML da peça...&lt;/p&gt;"
        value={form.conteudo}
        onChange={...}
        className="min-h-[120px] font-mono text-sm"
      />
      {form.conteudo && (
        <Card className="bg-muted/30">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Preview</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-3 text-sm prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: form.conteudo }} />
        </Card>
      )}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setCriarPecaOpen(false)}>Cancelar</Button>
      <Button onClick={handleCriarESelecionar} disabled={!form.nome || !form.conteudo}>
        Criar e Selecionar
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Fluxo de criação inline:**
1. Usuário está no WizardEditorPage configurando a etapa "Tipo de Arma"
2. Clica "Vincular Peça" → abre VinculadorPecaDialog com DataTable
3. Não encontra a peça desejada → clica "+ Criar Nova Peça" no rodapé
4. Sub-dialog abre com formulário completo (nome, descrição, categoria, tags, conteúdo HTML + preview)
5. Preenche e clica "Criar e Selecionar" → peça é salva no banco e automaticamente selecionada
6. Volta ao VinculadorPecaDialog com a peça já marcada → clica "Vincular Peça"
7. Regra é criada, fecha dialogs, volta ao editor

**Tema da árvore (CSS custom em `globals.css`):**

```css
/* ── Wizard Tree View ── */
.wizard-tree-node {
  @apply flex items-center gap-2 py-1.5 px-3 rounded-md cursor-pointer
         text-sm transition-colors hover:bg-accent/50;
}
.wizard-tree-node[data-selected="true"] {
  @apply bg-accent text-accent-foreground font-medium;
}
.wizard-tree-node[data-depth="1"] { padding-left: 24px; }
.wizard-tree-node[data-depth="2"] { padding-left: 44px; }
.wizard-tree-node[data-depth="3"] { padding-left: 64px; }

.wizard-tree-line {
  @apply absolute left-3 top-0 bottom-0 w-px bg-border;
}
```

### 6.4 `src/renderer/pages/WizardLaudoPage.tsx` — Preenchimento do Wizard (Perito)

**Layout shadcn (grid 2 colunas + stepper):**

```tsx
// Imports
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ArrowLeft, ArrowRight, Zap, AlertTriangle, Lock, Save } from 'lucide-react';

<TooltipProvider>
  <div className="container mx-auto p-4 md:p-6 h-full flex flex-col space-y-4">
    {/* Topo: voltar + info do wizard + stepper */}
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} className="mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Zap size={18} className="text-violet-500" />
            {wizard.nome}
          </h1>
          <p className="text-sm text-muted-foreground">REP: {rep.numero} — {rep.nome_envolvido}</p>
        </div>
      </div>
    </div>

    {/* Alerta de bloqueio */}
    {laudoBloqueado && (
      <Alert className="bg-slate-100 border-slate-300 dark:bg-slate-800/50 dark:border-slate-700">
        <Lock className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        <AlertDescription className="text-slate-700 dark:text-slate-300">
          Este laudo wizard está bloqueado porque o laudo template desta REP foi concluído/entregue.
          Para desbloqueá-lo, reabra ou exclua o laudo template.
        </AlertDescription>
      </Alert>
    )}

    {/* Wizard Stepper */}
    <WizardStepper
      passos={passosVisiveis}
      passoAtual={passoAtual}
      onStepClick={setPassoAtual}
    />

    {/* Corpo: grid 2 colunas */}
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6 min-h-0">
      {/* Coluna esquerda: Perguntas */}
      <Card className="flex flex-col min-h-0">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="text-base">
            {etapasVisiveis[passoAtual]?.pergunta || 'Pergunta'}
          </CardTitle>
          {etapasVisiveis[passoAtual]?.descricao_ajuda && (
            <CardDescription>{etapasVisiveis[passoAtual].descricao_ajuda}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          <WizardEtapaRenderer
            etapa={etapasVisiveis[passoAtual]}
            valor={respostas[etapasVisiveis[passoAtual]?.id]}
            onChange={(v) => handleResposta(etapasVisiveis[passoAtual].id, v)}
            disabled={laudoBloqueado}
          />
        </CardContent>
        <div className="flex justify-between p-4 border-t flex-shrink-0">
          <Button
            variant="outline"
            disabled={passoAtual === 0}
            onClick={() => setPassoAtual(p => p - 1)}
          >
            <ArrowLeft size={14} className="mr-1" /> Voltar
          </Button>
          <Button
            variant="outline"
            disabled={passoAtual >= etapasVisiveis.length - 1}
            onClick={() => setPassoAtual(p => p + 1)}
          >
            Avançar <ArrowRight size={14} className="ml-1" />
          </Button>
        </div>
      </Card>

      {/* Coluna direita: Preview */}
      <Card className="flex flex-col min-h-0">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="text-base">Preview do Laudo</CardTitle>
          <CardDescription>Agrupado por seção do template</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4">
          <PecasChecklist
            pecasPorSecao={pecasCalculadas}
            selecionadas={pecasSelecionadas}
            onToggle={handleTogglePeca}
            disabled={laudoBloqueado}
          />
          <Separator />
          <LaudoPreview
            secoes={secoesTemplate}
            pecas={pecasAtivas}
            dadosRep={rep}
          />
        </CardContent>
        <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleSalvarProgresso}
            disabled={laudoBloqueado || salvandoProgresso}
            className="flex items-center gap-2"
          >
            {salvandoProgresso ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Salvar Progresso
          </Button>
          <Button
            onClick={handleGerarLaudo}
            disabled={laudoBloqueado || gerando}
            className="flex items-center gap-2"
          >
            {gerando ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Zap size={16} />
            )}
            {laudoExistente ? 'Atualizar Laudo Wizard' : 'Gerar Laudo Wizard'}
          </Button>
        </div>
      </Card>
    </div>
  </div>
</TooltipProvider>
```

**WizardStepper (componente custom com CSS do tema):**

```tsx
// src/renderer/components/wizard/WizardStepper.tsx
function WizardStepper({ passos, passoAtual, onStepClick }: Props) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-2">
      {passos.map((passo, i) => (
        <React.Fragment key={passo.id}>
          {/* Step circle */}
          <button
            onClick={() => onStepClick(i)}
            disabled={i > passoAtual && !passo.respondido}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
              i < passoAtual && 'bg-primary text-primary-foreground',
              i === passoAtual && 'bg-primary/15 text-primary ring-2 ring-primary/30',
              i > passoAtual && 'bg-muted text-muted-foreground',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            <span className={cn(
              'flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
              i < passoAtual && 'bg-primary-foreground/20',
              i === passoAtual && 'bg-primary text-primary-foreground',
              i > passoAtual && 'bg-muted-foreground/20'
            )}>
              {i < passoAtual ? '✓' : i + 1}
            </span>
            <span className="hidden sm:inline">{passo.pergunta}</span>
          </button>
          {/* Connector line */}
          {i < passos.length - 1 && (
            <div className={cn(
              'h-0.5 w-6 flex-shrink-0',
              i < passoAtual ? 'bg-primary' : 'bg-border'
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
```

**WizardEtapaRenderer — renderiza o input conforme `tipo_input`:**

```tsx
// Switch com shadcn components:
switch (etapa.tipo_input) {
  case 'select':
    return (
      <Select value={valor as string} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
        <SelectContent>
          {etapa.opcoes.map(o => <SelectItem key={o.id} value={o.valor}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );

  case 'radio':
    return (
      <div className="space-y-3">
        {etapa.opcoes.map(o => (
          <label key={o.id} className={cn(
            'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
            valor === o.valor
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border hover:bg-accent/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}>
            <div className={cn(
              'w-4 h-4 rounded-full border-2 flex items-center justify-center',
              valor === o.valor ? 'border-primary' : 'border-muted-foreground/40'
            )}>
              {valor === o.valor && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
            <span className="text-sm">{o.label}</span>
          </label>
        ))}
      </div>
    );

  case 'checkbox':
    return (
      <div className="space-y-3">
        {etapa.opcoes.map(o => (
          <label key={o.id} className={cn(
            'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
            (valor as string[])?.includes(o.valor)
              ? 'border-primary bg-primary/5'
              : 'border-border hover:bg-accent/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}>
            <Checkbox
              checked={(valor as string[])?.includes(o.valor)}
              onCheckedChange={(c) => {
                const arr = (valor as string[]) || [];
                onChange(c ? [...arr, o.valor] : arr.filter(v => v !== o.valor));
              }}
              disabled={disabled}
            />
            <span className="text-sm">{o.label}</span>
          </label>
        ))}
      </div>
    );

  case 'text':
    return (
      <div className="space-y-2">
        <Textarea
          value={valor as string || ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Digite sua resposta..."
          disabled={disabled}
          className="min-h-[120px]"
        />
      </div>
    );

  case 'image':
    return (
      <div className="space-y-3">
        <Input type="file" accept="image/*" disabled={disabled} />
        {valor && (
          <img src={valor as string} alt="Upload" className="max-w-full rounded-lg border" />
        )}
      </div>
    );
}
```

**PecasChecklist — agrupado por seção:**

```tsx
{Object.entries(pecasPorSecao).map(([secaoId, pecas]) => (
  <div key={secaoId} className="space-y-2">
    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
      {secoesMap[secaoId]?.nome || 'Sem seção'}
    </h4>
    {pecas.map(peca => (
      <label key={peca.id} className={cn(
        'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
        selecionadas.has(peca.id) ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/50',
        disabled && 'opacity-50 cursor-not-allowed'
      )}>
        <Checkbox
          checked={selecionadas.has(peca.id)}
          onCheckedChange={() => onToggle(peca.id)}
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="text-sm">
          <span className="font-medium">{peca.nome}</span>
          {peca.descricao && <p className="text-xs text-muted-foreground">{peca.descricao}</p>}
        </div>
      </label>
    ))}
  </div>
))}
```

**LaudoPreview — HTML readonly com tema:**

```tsx
<div className="prose prose-sm max-w-none dark:prose-invert
  bg-card border rounded-lg p-4 text-sm"
  dangerouslySetInnerHTML={{ __html: htmlMontado }} />
```

**Funcionalidades:**
- Renderização dinâmica das etapas com base na árvore (pré-ordem: raiz → filhas)
- Ao selecionar opção em etapa pai, revela etapa filha no stepper
- Coluna direita: preview em tempo real do laudo sendo montado (readonly, agrupado por seção)
- Checkboxes para desmarcar peças (o usuário escolhe quais entram)
- Botão "Gerar Laudo Wizard" → chama `laudo:gerarWizard`
- Após gerar, redireciona para `LaudosPage` com o laudo criado
- Se reaberto (laudo já existe): carrega respostas anteriores, permite alterar
- **Se laudo estiver `Bloqueado`:** exibe `Alert` com `Lock` icon. Stepper e inputs desabilitados. Botões "Salvar Progresso" e "Gerar" ocultos. Apenas preview visível em modo readonly.

**Regras de cascata (etapas filhas):**

```ts
/**
 * Constrói a lista de passos visíveis no stepper percorrendo a árvore
 * em pré-ordem (raiz → filhas em ordem). Etapas filhas só aparecem
 * quando a opção pai correspondente foi selecionada.
 */
function buildPassosVisiveis(
  arvore: ArvoreWizard,
  respostas: Record<string, string | string[]>
): PassoWizard[] {
  const passos: PassoWizard[] = [];
  const etapasMap = new Map(arvore.etapas.map(e => [e.id, e]));

  function walk(etapas: EtapaWizard[], nivel: number) {
    for (const etapa of etapas.sort((a, b) => a.ordem - b.ordem)) {
      passos.push({ ...etapa, nivel });

      // Se esta etapa tem resposta e a opção escolhida dispara uma etapa filha
      const resposta = respostas[etapa.id];
      if (resposta !== undefined && resposta !== '') {
        const valores = Array.isArray(resposta) ? resposta : [resposta];
        for (const opcao of etapa.opcoes) {
          if (valores.includes(opcao.valor) && opcao.etapa_filha_id) {
            const filha = etapasMap.get(opcao.etapa_filha_id);
            if (filha) walk([filha], nivel + 1);
          }
        }
      }
    }
  }

  const raizes = arvore.etapas
    .filter(e => !e.etapa_pai_id)
    .sort((a, b) => a.ordem - b.ordem);
  walk(raizes, 0);
  return passos;
}
```

**Limpeza em cascata (quando o pai muda):**

| Situação | Comportamento |
|---|---|
| Usuário troca opção pai | Respostas das etapas filhas são **limpas** automaticamente |
| Etapa filha tinha resposta preenchida | Exibir **diálogo de confirmação**: "Mudar esta opção limpará as respostas de: [lista etapas filhas]. Continuar?" |
| Etapas filhas removidas do stepper | Imediatamente — só reaparecem se nova opção disparar filha |
| Ordem no stepper | Pré-ordem (raiz, depois filhas em ordem). Nível visual: raiz sem indentação, filhas com ícone de sub-item |

**Validação de etapas obrigatórias:**

```tsx
// No WizardLaudoPage:
const todasObrigatoriasRespondidas = useMemo(() => {
  return passosVisiveis
    .filter(e => e.obrigatorio)
    .every(e => {
      const resposta = respostas[e.id];
      if (resposta === undefined || resposta === null || resposta === '') return false;
      if (e.multipla_escolha && Array.isArray(resposta) && resposta.length === 0) return false;
      return true;
    });
}, [passosVisiveis, respostas]);

const podeGerar = todasObrigatoriasRespondidas && !laudoBloqueado;
```

**Feedback visual no stepper:**

| Estado | Ícone/Estilo |
|---|---|
| Etapa obrigatória não respondida | Ícone `AlertTriangle` âmbar no círculo do passo |
| Etapa opcional não respondida | Círculo vazio normal (pending) |
| Etapa respondida (obrigatória ou não) | ✓ verde (completed) |
| Botão "Gerar Laudo Wizard" | Desabilitado + tooltip: "Responda todas as etapas obrigatórias antes de gerar o laudo" |
| Mensagem de erro inline | Label abaixo da pergunta: "Esta pergunta é obrigatória." em `text-destructive` |

**Após "Gerar Laudo Wizard":**
- Exibe toast de sucesso com link: "Laudo gerado. Deseja adicionar ilustrações?"
- Link redireciona para a LaudosPage com o laudo aberto no editor TinyMCE
- O sistema de ilustrações existente (`IlustracoesPanel`, upload, drag-and-drop, legendas, numeração) funciona integralmente (ver seção 6.6)

### 6.5 `src/renderer/pages/REPsPage.tsx` — Alterações

#### 6.5.1 Formulário da REP: novo campo "Modo de Criação do Laudo"

No Accordion "Dados da Solicitação", após o Select de Template, adicionar:

```tsx
{/* Modo de Criação do Laudo */}
{tipoExameId && (
  <FormField
    control={form.control}
    name="modo_criacao"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Modo de Criação do Laudo</FormLabel>
        <div className="flex gap-4">
          <label className={cn(
            'flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors',
            field.value === 'template'
              ? 'border-primary bg-primary/5 text-primary'
              : 'border-border hover:bg-accent/50'
          )}>
            <input type="radio" name="modo_criacao" value="template"
              checked={field.value === 'template'}
              onChange={() => field.onChange('template')}
              className="sr-only"
            />
            <FileText size={16} />
            <span className="text-sm font-medium">Template</span>
          </label>
          <label className={cn(
            'flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors',
            field.value === 'wizard'
              ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20 text-violet-700 dark:text-violet-300'
              : 'border-border hover:bg-accent/50'
          )}>
            <input type="radio" name="modo_criacao" value="wizard"
              checked={field.value === 'wizard'}
              onChange={() => field.onChange('wizard')}
              className="sr-only"
            />
            <Zap size={16} />
            <span className="text-sm font-medium">Wizard</span>
          </label>
        </div>
        <FormMessage />
      </FormItem>
    )}
  />
)}

{/* Select condicional conforme modo */}
{modoCriacao === 'template' ? (
  <FormField name="template_id" render={...}>
    {/* Select de Template — comportamento atual */}
  </FormField>
) : modoCriacao === 'wizard' ? (
  <FormField name="wizard_id" render={...}>
    {/* Select de Wizard — filtra wizards do tipo_exame */}
    <Select disabled={!tipoExameId || wizardsVinculados.length === 0} ...>
      <SelectTrigger><SelectValue placeholder="Selecione um wizard..." /></SelectTrigger>
      <SelectContent>
        {wizardsVinculados.map(w => <SelectItem key={w.id} value={w.id}>{w.nome}</SelectItem>)}
      </SelectContent>
    </Select>
  </FormField>
) : null}
```

**Ao salvar a REP com Wizard:**
- `rep:create` / `rep:update` recebe `modo_criacao='wizard'` e `wizard_id`
- Backend chama `laudoService.criarLaudoWizardRascunho()` (cria laudo vazio: `conteudo=''`, `respostas_wizard='{}'`, status `Em andamento`)
- Se a criação do laudo falhar: REP é mantida, `warning` é retornado no response, frontend exibe toast "REP criada, mas houve erro ao criar o laudo wizard. Você pode criá-lo depois."
- Após salvar com sucesso, exibe toast: "REP salva. Deseja preencher o Wizard agora?" com botão que redireciona para `/reps/:repId/wizard`
- Ou o usuário fecha o toast e preenche depois pela REPsPage (badge "W") ou LaudosPage (botão "Preencher")

**Fluxo detalhado no backend (ver seção 5.4b):**
1. REP é criada normalmente (`repService.create`)
2. Se `modo_criacao === 'wizard'`:
   - Valida que o wizard existe e pertence ao `tipo_exame_id` da REP
   - Chama `criarLaudoWizardRascunho()` que:
     - Verifica unicidade (não pode já existir wizard para esta REP)
     - Verifica bloqueio (não pode existir template Concluído/Entregue)
     - Insere laudo com `conteudo=''`, `tipo_criacao='wizard'`, status `Em andamento`
   - Se falhar: REP sobrevive, retorna `warning` (não `error`)
3. Auditoria: registra criação do laudo wizard rascunho via `auditCicloVida`

#### 6.5.2 DataTable: badges clicáveis + botões condicionais

**Estrutura de rastreamento:**

```ts
// Estrutura para rastrear laudos por REP
interface LaudosPorREP {
  template?: { id: string; status: string }
  wizard?: { id: string; status: string }
}
const [laudosPorRep, setLaudosPorRep] = useState<Record<string, LaudosPorREP>>({});
```

**Lógica dos botões na coluna ações:**

```tsx
const temTemplate = laudosPorRep[rep.id]?.template
const temWizard = laudosPorRep[rep.id]?.wizard
const templateFinalizado = temTemplate &&
  ['Concluído', 'Entregue'].includes(temTemplate.status)
const wizardFinalizado = temWizard &&
  ['Concluído', 'Entregue'].includes(temWizard.status)

const podeCriarTemplate = !temTemplate && !wizardFinalizado
const podeCriarWizard = !temWizard && !templateFinalizado
```

**Coluna ações da DataTable:**

```tsx
cell: ({ row }) => {
  const rep = row.original;
  const laudos = laudosPorRep[rep.id];

  return (
    <div className="flex justify-end gap-1 items-center">
      {/* Badge Template (clicável → editor TinyMCE) */}
      {laudos?.template ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 text-[10px] h-5 px-1.5 gap-1"
              onClick={() => navigate(`/laudos?editar=${laudos.template.id}`)}
            >
              <FileText size={10} /> T
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Template: {laudos.template.status} — Clique para editar</p>
          </TooltipContent>
        </Tooltip>
      ) : podeCriarTemplate ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={() => handleCriarLaudo(rep)}>
              <FileText size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-xs">Criar Laudo (Template)</p></TooltipContent>
        </Tooltip>
      ) : null}

      {/* Badge Wizard (clicável → WizardLaudoPage) */}
      {laudos?.wizard ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              className={cn(
                'cursor-pointer hover:opacity-80 text-[10px] h-5 px-1.5 gap-1',
                laudos.wizard.status === 'Bloqueado'
                  ? 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600'
                  : 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-700'
              )}
              onClick={() => navigate(`/reps/${rep.id}/wizard`)}
            >
              <Zap size={10} /> W
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p className="text-xs">Wizard: {laudos.wizard.status}
              {laudos.wizard.status === 'Bloqueado' && ' (bloqueado)'}
              {' — Clique para editar'}
            </p>
          </TooltipContent>
        </Tooltip>
      ) : podeCriarWizard ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={() => navigate(`/reps/${rep.id}/wizard`)}>
              <Zap size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top"><p className="text-xs">Criar Laudo (Wizard)</p></TooltipContent>
        </Tooltip>
      ) : null}

      {/* Indicador "Sem laudo" (nenhum existe e ambos bloqueados) */}
      {!laudos?.template && !laudos?.wizard && !podeCriarTemplate && !podeCriarWizard && (
        <Badge variant="destructive" className="text-[10px] h-4 px-1 gap-0.5">
          <Lock size={9} />
        </Badge>
      )}

      {/* Ações da REP (existentes) */}
      <Button variant="ghost" size="sm" onClick={() => handleEditar(rep)}><Edit size={14} /></Button>
      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(rep)}><Trash2 size={14} /></Button>
    </div>
  );
}
```


---

### 6.6 Ilustrações no Laudo Wizard

O wizard gera o conteúdo **textual** do laudo (peças concatenadas nas seções do template). As ilustrações (fotos do armamento, local, evidências) são adicionadas **após a geração**, usando o mesmo sistema já implementado para laudos template — **zero componentes novos**.

#### Fluxo completo

```
WizardLaudoPage → "Gerar Laudo Wizard"
  → laudo criado com HTML das peças
  → toast: "Laudo gerado com sucesso! Adicionar ilustrações?"
    ├── [Sim] → redireciona para LaudosPage, abre editor TinyMCE
    └── [Depois] → fecha toast. Usuário acessa depois via:
          REPsPage → badge "W" clicável → WizardLaudoPage → reaplicar
          LaudosPage → botão "Preencher" no laudo wizard → abre TinyMCE
```

#### Edição de ilustrações (TinyMCE + IlustracoesPanel)

No editor TinyMCE da LaudosPage, o laudo wizard funciona exatamente como um laudo template:

| Funcionalidade | Suporte |
|---|---|
| **IlustracoesPanel** | Upload de imagens, drag-and-drop para reordenar, legendas, numeração automática (Figura 01, 02...) |
| **Sync painel ↔ editor** | Imagem inserida/removida no painel reflete no editor e vice-versa |
| **Inserção manual** | Usuário pode colar ou inserir imagens diretamente no texto via TinyMCE |
| **Seção ILUSTRAÇÕES** | Criada automaticamente antes de "CONSIDERAÇÕES FINAIS" ou "CONCLUSÃO", como no template |
| **Numeração** | `reindexarFiguras()` renumera todas as figuras na ordem correta ao salvar |
| **Preview PDF** | Imagens são incluídas no PDF gerado para preview |

#### Preservação na retroatividade

Se o usuário **reaplicar** o wizard depois de adicionar ilustrações, as figuras **não são perdidas**:

```html
<h2>1. Do Material</h2>
<div data-peca-id="abc123">Trata-se de uma pistola Taurus PT92, calibre 9mm...</div>
<div data-peca-id="def456">O armamento apresenta oxidação superficial...</div>

<!-- Ilustrações — FORA dos marcadores data-peca-id → preservadas na reaplicação -->
<figure class="laudo-figure" data-image-id="img001">
  <img src="file://..." alt="Figura 01: Vista frontal do armamento"/>
  <figcaption>Figura 01: Vista frontal do armamento</figcaption>
</figure>

<figure class="laudo-figure" data-image-id="img002">
  <img src="file://..." alt="Figura 02: Detalhe da numeração de série"/>
  <figcaption>Figura 02: Detalhe da numeração de série</figcaption>
</figure>
```

A lógica de retroatividade (seção 4.6) só substitui os blocos `data-peca-id`. Todo conteúdo fora desses marcadores — incluindo `<figure class="laudo-figure">` — é preservado intacto.

#### Código aproveitado (zero novos componentes)

| Componente/Método | Arquivo | Função no wizard |
|---|---|---|
| `IlustracoesPanel` | `src/renderer/components/laudo/IlustracoesPanel.tsx` | Upload, reorder, legendas |
| `TinyMceEditor` | `src/renderer/components/editor/TinyMceEditor.tsx` | Editor de texto com suporte a imagens |
| `handleToggleIlustracoes` | `LaudosPage.tsx` | Abrir/fechar painel de ilustrações |
| `handlePopOut` | `LaudosPage.tsx` | Destacar painel em janela separada |
| `reindexarFiguras` | `src/renderer/lib/figuras.ts` | Renumerar figuras (Figura 01, 02...) |
| `buildFigureHtml` | `LaudosPage.tsx` | Gerar HTML da figura |
| `garantirSecaoIlustracoes` | `LaudosPage.tsx` | Criar seção ILUSTRAÇÕES |
| `extrairFigurasDoHtml` | `LaudosPage.tsx` | Extrair figuras do HTML |
| `panelCallbacksRef` | `LaudosPage.tsx` | Sync bidirecional painel ↔ editor |

#### O que NÃO muda

- O `IlustracoesPanel` não precisa saber se o laudo é template ou wizard
- A numeração (`reindexarFiguras`) funciona igual para ambos
- O PDF preview inclui imagens normalmente
- A seção ILUSTRAÇÕES é inserida no mesmo local (antes de CONSIDERAÇÕES FINAIS)



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

| Componente | Shadcn utilizados | Descrição |
|---|---|---|
| `ArvoreEtapas` | `Button` (ghost) | Árvore indentada com linhas CSS. Nó selecionado: `bg-accent text-accent-foreground`. Drag-and-drop via `@dnd-kit`. |
| `ConfigEtapaPanel` | `Input`, `Select`, `Checkbox`, `Label` | Formulário: pergunta (Input), tipo_input (Select), obrigatório/múltipla (Checkbox). |
| `OpcoesEditor` | `Button` (ghost/outline), `GripVertical` | Lista de opções com label + valor inline, botão remover, drag handle. |
| `RegrasVinculadas` | `Checkbox`, `Badge` (secondary), `Select` | Cada regra: Checkbox ativar + Badge nome peça + Select seção alvo. |
| `VinculadorPecaDialog` | `Dialog`, `DataTable`, `Input` (busca), `Select` (categoria) | Dialog full com DataTable do banco de peças, busca por nome/tag, filtro por categoria. |
| `WizardStepper` | CSS custom + `cn()` | Passos numerados com círculo, conector (linha), estados: completed/active/pending. Cores via `bg-primary`, `bg-muted`, `ring-primary`. |
| `WizardEtapaRenderer` | `Select`, `Checkbox`, `Textarea`, `Input` | Render switch por `tipo_input`. Radio custom com div + CSS. Todos respeitam `disabled` prop. |
| `PecasChecklist` | `Checkbox`, `Card` (implícito via borda) | Agrupado por seção com título `uppercase tracking-wider`. Cada item: Checkbox + nome + descrição. |
| `LaudoPreview` | CSS `prose prose-sm dark:prose-invert` + `bg-card border rounded-lg` | HTML readonly renderizado via `dangerouslySetInnerHTML`. |

**Padrão de imports em todos os componentes:**

```tsx
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// ... conforme necessidade
```

**Padrão de cores condicionais (light/dark):**

Todos os componentes usam `bg-{color}-100 text-{color}-800 border-{color}-300` para light e
`dark:bg-{color}-950/50 dark:text-{color}-300 dark:border-{color}-700` para dark,
seguindo o padrão dos badges de status existentes no projeto.

---

## 9. Sidebar

Adicionar em `src/renderer/components/layout/AppSidebar.tsx`:

```tsx
// Grupo "Wizard"
{
  title: 'Wizard',
  items: [
    { name: 'Peças', url: '/pecas', icon: Puzzle },   // opcional — gerenciamento em lote
    { name: 'Wizards', url: '/wizards', icon: Wand },   // principal — lista + editor
  ],
}
```

> **Peças é opcional no fluxo:** O usuário pode pular `/pecas` completamente. As peças podem ser criadas inline dentro do `VinculadorPecaDialog` no editor de wizard (`/wizards/:id`). A página `/pecas` serve para gerenciamento em massa (revisar, editar ou excluir várias peças de uma vez).

---

## 10. Diferenciação Template vs Wizard na UI

### Badges `tipo_criacao` (Badge shadcn)

| Tipo | Shadcn Badge className |
|---|---|
| `Template` | `bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700` |
| `Wizard` | `bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-700` |

### Badges de `status` do laudo (Badge shadcn)

| Status | Shadcn Badge className | Ações disponíveis |
|---|---|---|
| `Em andamento` | `bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700` | Concluir, Preencher/Editar, Excluir |
| `Concluído` | `bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700` | Entregar, Preencher (reabrir), Excluir |
| `Entregue` | `bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700` | Preencher (reabrir), Excluir |
| `Bloqueado` | `bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600` | **Apenas Excluir** |

Tooltip no badge `Bloqueado`: "Este laudo foi bloqueado porque o outro laudo desta REP foi concluído/entregue."

Não há sufixo no número da REP. A REP mantém seu número único (ex: 2024/00123).

### Na listagem de laudos (LaudosPage)

Cada linha exibe **dois badges lado a lado**: badge `tipo_criacao` + badge `status`.
Laudos `Bloqueado` não exibem botões de ação exceto "Excluir" com tooltip explicativo.

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
5. `laudo.service.ts` — métodos `criarLaudoWizardRascunho`, `gerarLaudoWizard`, `salvarProgressoWizard`, `reaplicarRespostas` + bloqueio/desbloqueio em `updateStatus` e `deletar` + verificação de bloqueio em `criarLaudoInicial`

### Fase 3 — IPC Handlers + Preload
1. `wizard.handlers.ts` — todos os canais listados na seção 5.1
2. `peca.handlers.ts` — seção 5.2
3. `regra-wizard.handlers.ts` — seção 5.3
4. Atualizar `laudo.handlers.ts` — adicionar `laudo:createWizardRascunho`, `laudo:gerarWizard`, `laudo:salvarProgressoWizard`
5. Atualizar `ipc/index.ts` — registrar novos handlers
6. Atualizar `preload/index.ts` — expor API + allowed channels

### Fase 4 — Frontend: Banco de Peças (opcional no fluxo)
1. `PecasPage.tsx` — listagem, busca, filtro, gerenciamento em lote
2. Dialog de criação/edição de peça (nome, descrição, categoria, tags, conteúdo HTML + preview)
3. Integrar rota `/pecas` e sidebar
4. **Nota:** Peças também podem ser criadas inline via `VinculadorPecaDialog` no editor (Fase 5). `/pecas` é para gerenciamento em massa.

### Fase 5 — Frontend: Editor de Wizard
1. `WizardsPage.tsx` — listagem de wizards
2. `WizardEditorPage.tsx` — editor visual completo
3. Componentes auxiliares: `ArvoreEtapas`, `ConfigEtapaPanel`, `OpcoesEditor`, `RegrasVinculadas`, `VinculadorPecaDialog` (com criação inline de peças)
4. Integrar rotas `/wizards`, `/wizards/:id` e sidebar

### Fase 6 — Frontend: Preenchimento do Wizard (Perito)
1. `WizardLaudoPage.tsx` — página de preenchimento com preview
2. `WizardStepper`, `WizardEtapaRenderer`, `PecasChecklist`, `LaudoPreview`
3. Lógica de cascata: ao selecionar opção, revela etapa filha
4. Cálculo de peças em tempo real (chamada IPC `regra-wizard:calcularPecas`)
5. Botão "Gerar Laudo Wizard" e integração com `laudo:gerarWizard`
6. Retroatividade: reabrir wizard de laudo existente
7. Tratar laudo `Bloqueado`: readonly, mensagem informativa, sem ações de edição

### Fase 7 — Integração com REPsPage + LaudosPage
1. Formulário REP: campo "Modo de Criação" (radio Template/Wizard) + Select de Wizard (filtrado por tipo_exame)
2. Ao salvar REP com Wizard: cria laudo rascunho, oferece redirecionamento
3. DataTable REPs: badges clicáveis (T/W) + botões condicionais com bloqueio
4. `laudo:findAllByRepId` retornando array com tipo_criacao
5. LaudosPage: `LaudoItem` com `tipo_criacao`, roteamento condicional no `handleEditar`
6. Badge `Bloqueado` (slate) com tooltip, ações reduzidas

### Fase 8 — Testes e Ajustes
1. Testar fluxo completo: criar peça (inline e via /pecas) → criar wizard → preencher → gerar laudo → editar → reaplicar
2. Testar retroatividade
3. Testar edge cases: wizard sem template, peças sem seção, etc.
4. Testar bloqueio: concluir template → wizard vira Bloqueado; reabrir template → wizard desbloqueia
5. Testar bloqueio: concluir wizard → template vira Bloqueado; deletar wizard → template desbloqueia
6. Testar deleção de laudo Bloqueado (deve funcionar sem efeitos colaterais)
7. Testar criação bloqueada: wizard finalizado → criar template deve falhar
8. Testar UI: badges de status Bloqueado, tooltips, botões desabilitados
9. Testar ilustrações: gerar laudo wizard → abrir TinyMCE → adicionar fotos via IlustracoesPanel → salvar → preview PDF
10. Testar retroatividade com ilustrações: gerar laudo → adicionar fotos → reaplicar wizard → fotos preservadas
11. Testar save progress: preencher parcial → Salvar Progresso → fechar → reabrir → respostas restauradas

---

## 12. Observações Técnicas

### 12.1 SQLite e remoção de UNIQUE
SQLite não suporta `ALTER TABLE DROP CONSTRAINT`. A migration v20a precisa:
1. Criar tabela `laudos_v20` sem UNIQUE
2. Copiar dados
3. Drop tabela antiga, rename nova
4. Recriar índices

### 12.2 Retroatividade — marcadores HTML com hash

Para identificar blocos de peças no HTML e detectar edições manuais, cada peça inserida é envolta em um marcador com hash:

```html
<div data-peca-id="abc123" data-peca-hash="a1b2c3d4e5f6" class="peca-wizard">
  <p>Trata-se de um revólver...</p>
</div>
```

**Atributos:**
| Atributo | Descrição |
|---|---|
| `data-peca-id` | ID da peça no banco. Usado para localizar o bloco na reaplicação. |
| `data-peca-hash` | Hash SHA-256 do conteúdo original da peça. Usado para detectar se o perito editou manualmente. |

**Algoritmo de reaplicação:**
1. Parse do HTML atual → extrair todos os blocos `[data-peca-id]` com seus hashes
2. Para cada peça calculada pelas novas regras:
   - Se o bloco NÃO existe no HTML → inserir (peça nova)
   - Se o bloco existe E `hash atual === hash armazenado` → substituir (peça intacta)
   - Se o bloco existe E `hash atual !== hash armazenado` → preservar (perito editou)
3. Blocos que não estão nas novas regras → remover
4. Conteúdo FORA de `[data-peca-id]` é sempre preservado (ilustrações, formatação customizada, etc.)

Ver seção 4.6 para o código completo de `reaplicarRespostas()`.

### 12.3 `template_id` — obrigatório no wizard

`wizards.template_id` é **NOT NULL**. Um wizard sem template não tem seções definidas para inserir as peças — não faz sentido funcional. O template vinculado define:
- Quais seções estarão disponíveis no `VinculadorPecaDialog` (Select de seção alvo)
- A ordem das seções no laudo final
- O conteúdo base de cada seção (antes das peças)

Se no futuro houver necessidade de wizard sem template (peças concatenadas sequencialmente), uma migration futura pode relaxar a constraint.

### 12.4 Múltiplos laudos por REP + Integração com LaudosPage

A UI da REPsPage atualmente espera 0 ou 1 laudo por REP. Com a remoção de UNIQUE, será necessário:
- `laudo:findByRepId` → mudar para `laudo:findAllByRepId` (retornar array)
- Tabela de REPs: badges clicáveis ("T" azul para template, "W" violeta para wizard) que levam ao editor correto
- Respeitar o limite de 1 laudo por tipo por REP (ver seção 12.6)
- Tratar o status `Bloqueado`: badge cinza, tooltip explicativo, ações reduzidas (apenas Excluir)

**LaudosPage: adicionar `tipo_criacao` ao `LaudoItem`:**

```ts
interface LaudoItem {
  // ... campos existentes ...
  tipo_criacao?: string;  // 'template' | 'wizard'
  wizard_id?: string;     // FK do wizard (nulo se template)
}
```

**LaudosPage: roteamento condicional no `handleEditar` e botões de ação:**

```tsx
const handleEditar = (laudo: LaudoItem) => {
  if (laudo.tipo_criacao === 'wizard') {
    // Redireciona para WizardLaudoPage
    navigate(`/reps/${laudo.rep_id}/wizard`);
    return;
  }
  // Template: comportamento atual (abre TinyMCE)
  const parsedSecoes = parseConteudoEmSecoes(
    converterPlaceholdersTextuais(laudo.conteudo || '', placeholderChaves)
  );
  setEditando(laudo);
  setSecoes(parsedSecoes);
  // ...
};
```

**Coluna de status na DataTable da LaudosPage:**

```tsx
{
  id: 'tipo_status',
  header: 'Tipo / Status',
  cell: ({ row }) => {
    const laudo = row.original;
    return (
      <div className="flex gap-1">
        {/* Badge tipo_criacao */}
        <Badge className={laudo.tipo_criacao === 'wizard'
          ? 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-700 text-[10px]'
          : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700 text-[10px]'
        }>
          {laudo.tipo_criacao === 'wizard' ? 'Wizard' : 'Template'}
        </Badge>
        {/* Badge status */}
        <Badge className={statusBadgeStyles[laudo.status]}>{laudo.status}</Badge>
      </div>
    );
  },
}
```

**Botão "Preencher/Editar" condicional:**

```tsx
{/* Na coluna de ações */}
{laudo.status === 'Em andamento' && laudo.tipo_criacao !== 'wizard' && (
  <Button variant="ghost" size="sm" onClick={() => handleEditar(laudo)}>
    <Edit size={14} />
  </Button>
)}
{laudo.status === 'Em andamento' && laudo.tipo_criacao === 'wizard' && (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="sm" onClick={() => navigate(`/reps/${laudo.rep_id}/wizard`)}>
        <Zap size={14} />
      </Button>
    </TooltipTrigger>
    <TooltipContent side="top"><p className="text-xs">Preencher Wizard</p></TooltipContent>
  </Tooltip>
)}
```

### 12.5 Padrões de código a seguir

- Seguir o padrão `BaseService<T>` existente para todos os novos services
- Handlers seguem o mesmo padrão de `try/catch` + `success/error` response
- IDs usam `randomUUID()` do crypto
- Rotas seguem o padrão React Router v7
- **Auditoria (FR8):** Todos os novos handlers que alteram estado (`laudo:createWizardRascunho`, `laudo:gerarWizard`, `laudo:salvarProgressoWizard`, `wizard:create`, `wizard:update`, `wizard:delete`, `wizard:saveArvore`) devem emitir `auditCicloVida` com snapshot antes/depois, seguindo o padrão dos handlers existentes

**Componentes (shadcn/ui new-york style):**
- Todos os componentes de UI usam shadcn/ui importados de `@/components/ui/`
- Formulários usam `react-hook-form` + `zod` como nos existentes
- `DataTable` do `@tanstack/react-table` para listagens com busca e paginação
- Ícones via `lucide-react`

**Tema e cores (dois modos: light/dark via globals.css):**
- Cores de fundo/texto via variáveis CSS HSL: `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`
- Badges de status seguem o padrão: `bg-{cor}-100 text-{cor}-800 border-{cor}-300 dark:bg-{cor}-950/50 dark:text-{cor}-300 dark:border-{cor}-700`
- Preview HTML: `prose prose-sm max-w-none dark:prose-invert`
- Estados vazios: ícone `opacity-40` + texto `text-muted-foreground`
- Cards: `bg-card text-card-foreground border-border` — sombra suave no light (`box-shadow` CSS), borda visível no dark

**Layout responsivo:**
- Container: `container mx-auto p-4 md:p-6 space-y-6`
- Grid 2 colunas: `grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6` (editor) ou `lg:grid-cols-[400px_1fr]` (preenchimento)
- Cabeçalho: `flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center`
- Loading/Error/Empty states seguem o padrão com `Loader2 animate-spin`, `AlertCircle text-destructive`, ícone contextual

**CSS custom para wizard (adicionar em `globals.css`):**

```css
/* ── Wizard Stepper ── */
.wizard-step {
  @apply flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
         transition-colors whitespace-nowrap;
}
.wizard-step-completed { @apply bg-primary text-primary-foreground; }
.wizard-step-active { @apply bg-primary/15 text-primary ring-2 ring-primary/30; }
.wizard-step-pending { @apply bg-muted text-muted-foreground; }
.wizard-step-disabled { @apply opacity-40 cursor-not-allowed; }
.wizard-step-connector { @apply h-0.5 w-6 flex-shrink-0 bg-border; }
.wizard-step-connector-done { @apply bg-primary; }

/* ── Wizard Tree View ── */
.wizard-tree-node {
  @apply flex items-center gap-2 py-1.5 px-3 rounded-md cursor-pointer
         text-sm transition-colors hover:bg-accent/50;
}
.wizard-tree-node[data-selected="true"] {
  @apply bg-accent text-accent-foreground font-medium;
}
.wizard-tree-node[data-depth="1"] { padding-left: 24px; }
.wizard-tree-node[data-depth="2"] { padding-left: 44px; }
.wizard-tree-node[data-depth="3"] { padding-left: 64px; }
.wizard-tree-line {
  @apply absolute left-3 top-0 bottom-0 w-px bg-border;
}

/* ── Wizard Radio Cards ── */
.wizard-radio-card {
  @apply flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors;
}
.wizard-radio-card-selected { @apply border-primary bg-primary/5 text-primary; }
.wizard-radio-card-normal { @apply border-border hover:bg-accent/50; }
.wizard-radio-card-disabled { @apply opacity-50 cursor-not-allowed; }
.wizard-radio-dot { @apply w-4 h-4 rounded-full border-2 flex items-center justify-center; }
.wizard-radio-dot-selected { @apply border-primary; }
.wizard-radio-dot-normal { @apply border-muted-foreground/40; }
.wizard-radio-dot-inner { @apply w-2 h-2 rounded-full bg-primary; }

/* ── Bloqueado badge no dark mode ── */
.dark .bg-slate-100 { background-color: rgba(71, 85, 105, 0.35) !important; }
.dark .text-slate-800 { color: #cbd5e1 !important; }
.dark .border-slate-300 { border-color: rgba(71, 85, 105, 0.5) !important; }

/* ── Violet badge (Wizard) no dark mode ── */
.dark .bg-violet-100 { background-color: rgba(91, 33, 182, 0.3) !important; }
.dark .text-violet-800 { color: #c4b5fd !important; }
.dark .border-violet-300 { border-color: rgba(91, 33, 182, 0.5) !important; }
```

### 12.6 Restrição: 1 laudo por tipo por REP + Bloqueio mútuo

Uma REP pode ter no máximo 2 laudos: **1 template + 1 wizard**. Além da restrição de quantidade, aplica-se bloqueio mútuo quando um dos laudos é finalizado.

#### Restrição de criação

Aplicada no `laudo.service.ts`:

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

  // Validar se existe wizard Concluído/Entregue (bloqueio)
  const wizardFinalizado = await executeQuery<LaudoRow>(
    "SELECT id FROM laudos WHERE rep_id = ? AND tipo_criacao = 'wizard' AND status IN ('Concluído', 'Entregue')",
    [params.rep_id]
  );
  if (wizardFinalizado.length > 0) {
    throw new Error('Não é possível criar laudo template: já existe laudo wizard concluído/entregue');
  }
  // ... resto da lógica existente
}

// Em criarLaudoWizardRascunho:
async criarLaudoWizardRascunho(params: CriarLaudoWizardRascunhoParams): Promise<LaudoRow> {
  // Validar se já existe laudo wizard
  const existente = await executeQuery<LaudoRow>(
    "SELECT id FROM laudos WHERE rep_id = ? AND tipo_criacao = 'wizard'",
    [params.rep_id]
  );
  if (existente.length > 0) {
    throw new Error('Já existe um laudo (Wizard) para esta REP');
  }

  // Validar se existe template Concluído/Entregue (bloqueio)
  const templateFinalizado = await executeQuery<LaudoRow>(
    "SELECT id FROM laudos WHERE rep_id = ? AND tipo_criacao = 'template' AND status IN ('Concluído', 'Entregue')",
    [params.rep_id]
  );
  if (templateFinalizado.length > 0) {
    throw new Error('Não é possível criar laudo wizard: já existe laudo template concluído/entregue');
  }
  // ... resto da lógica
}
```

#### Tabela completa de criação

| Tentativa | Nenhum laudo | Template `Em and.` | Wizard `Em and.` | Template finalizado* | Wizard finalizado* | Ambos `Em and.` | Ambos (um finalizado) |
|---|---|---|---|---|---|---|---|
| Criar template | ✅ | ❌ já existe | ✅ | ❌ já existe | ❌ bloqueado | ❌ já existe | ❌ |
| Criar wizard | ✅ | ✅ | ❌ já existe | ❌ bloqueado | ❌ já existe | ❌ já existe | ❌ |

\* finalizado = `Concluído` ou `Entregue`

#### Bloqueio por mudança de status

O bloqueio/desbloqueio é executado automaticamente dentro de `updateStatus()`:

```ts
async updateStatus(id: string, novoStatus: string): Promise<LaudoRow> {
  // ... atualiza o próprio status ...

  const outroTipo = laudo.tipo_criacao === 'template' ? 'wizard' : 'template';

  if (novoStatus === 'Concluído' || novoStatus === 'Entregue') {
    // BLOQUEAR o outro
    await executeNonQuery(
      `UPDATE laudos SET status = 'Bloqueado', updated_at = CURRENT_TIMESTAMP
       WHERE rep_id = ? AND tipo_criacao = ? AND status = 'Em andamento'`,
      [laudo.rep_id, outroTipo]
    );
  }

  if (novoStatus === 'Em andamento') {
    // DESBLOQUEAR o outro
    await executeNonQuery(
      `UPDATE laudos SET status = 'Em andamento', updated_at = CURRENT_TIMESTAMP
       WHERE rep_id = ? AND tipo_criacao = ? AND status = 'Bloqueado'`,
      [laudo.rep_id, outroTipo]
    );
  }
}
```

#### Bloqueio na deleção

Ao deletar um laudo `Concluído` ou `Entregue`, o outro laudo (se estiver `Bloqueado`) é desbloqueado automaticamente. Ver seção 4.5.4.

#### Comportamento do status `Bloqueado`

- Status terminal enquanto durar o bloqueio: não permite editar, preencher, concluir ou entregar.
- Única ação disponível: **Excluir**.
- Para desbloquear: reabrir o outro laudo (`Em andamento`) ou deletá-lo.
- Badge cinza/slate na UI com tooltip explicativo.

---

## 13. Sumário dos Arquivos a Criar/Modificar

### Arquivos Novos

| Arquivo | Fase |
|---|---|
| `wizard_pecas.md` | Este documento |
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
| `src/main/services/laudo.service.ts` | `criarLaudoWizardRascunho`, `gerarLaudoWizard`, `salvarProgressoWizard`, `reaplicarRespostas` (com hash), bloqueio/desbloqueio em `updateStatus`, `deletar` (com limpeza de imagens), verificação de bloqueio em `criarLaudoInicial` | Fase 2 |
| `src/main/ipc/handlers/laudo.handlers.ts` | Handlers `laudo:createWizardRascunho`, `laudo:gerarWizard`, `laudo:salvarProgressoWizard`, status `Bloqueado` na validação | Fase 3 |
| `src/main/ipc/handlers/rep.handlers.ts` | `rep:create`/`rep:update`: suporte a `modo_criacao='wizard'` + `wizard_id` → chama `criarLaudoWizardRascunho`, retorna `warning` em caso de falha | Fase 3 |
| `src/main/ipc/index.ts` | Registrar novos handlers | Fase 3 |
| `src/preload/index.ts` | Novos canais na API + ALLOWED_CHANNELS | Fase 3 |
| `src/preload/types.ts` | Tipos para wizard/peca/regra | Fase 3 |
| `src/renderer/pages/REPsPage.tsx` | Botão Wizard, suporte múltiplos laudos, lógica de bloqueio nos botões | Fase 7 |
| `src/renderer/pages/LaudosPage.tsx` | `tipo_criacao` no `LaudoItem`, roteamento condicional: wizard → `/reps/:repId/wizard`, template → TinyMCE, badge `Bloqueado` (slate) | Fase 7 |
| `src/renderer/routes/index.tsx` | Novas rotas | Fase 4 |
| `src/renderer/components/layout/AppSidebar.tsx` | Itens de menu | Fase 4 |
