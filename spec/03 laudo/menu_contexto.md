# Plano: Menu de Contexto — Placeholders Dinâmicos por Tipo de Exame

> **Status:** Planejamento concluído — aguardando implementação
> **Baseado em:** `criar_input_personalizado_b602.md`, `criar_input_personalizados_exame.md`
> **Objetivo:** Fazer o menu de contexto do editor de laudo mostrar placeholders organizados por submenus, filtrando apenas categorias relevantes ao tipo de exame do laudo atual, com entradas geradas dinamicamente a partir dos dados reais da REP.

---

## 1. Decisões de Design

| # | Decisão | Detalhe |
|---|---------|---------|
| 1 | **Nomenclatura mantida** | Placeholders individuais de `dados_investigacao` mantêm nomes atuais (`b602_local`, não `b602_dados_investigacao_local`) |
| 2 | **Filtro por relevância** | Menu mostra apenas: **categorias fixas** (REP/Laudo, Perito, Datas, etc.) + **categoria do exame vinculado ao laudo atual** (ex: `cat-exam-B-602` para laudos B-602) |
| 3 | **`tipo_exame_codigo` no `LaudoItem`** | O backend (`laudo.findAll`) deve retornar o código do tipo de exame para permitir o filtro |
| 4 | **Submenus aninhados** | Usar `ContextMenuSub` do shadcn com 3 níveis: Categoria → Seção → Grupo → Placeholder |
| 5 | **Linhas dinâmicas** | O menu lê `campos_especificos` da REP vinculada ao laudo. Se a REP tem 3 cartuchos → menu mostra Cartucho 1, 2, 3. Se tem 7 → mostra até 7. Nada é pré-cadastrado além do mínimo. |
| 6 | **Envolvidos em subnível** | Placeholders `b602_envolvido_1`...`b602_envolvido_10` agrupados em submenu "Envolvidos" |
| 7 | **Constante JS por tipo de exame** | Cada tipo de exame define sua estrutura de menu via constante dedicada (ex: `B602_MENU_STRUCTURE`), sem acoplar ao service de serialização |

---

## 2. Arquitetura Alvo — Menu de Contexto

### 2.1 Visual final (ex: laudo B-602 com 2 cartuchos cadastrados)

```
┌─ Inserir Placeholder ─────────────────────┐
│ ───────────────────────────────────────── │
│ 📄 REP/Laudo                              │
│   ├── {{numero_rep}}                      │
│   ├── {{data_recebimento_rep}}            │
│   └── ...                                 │
│ 👤 Perito                                 │
│   ├── {{perito_nome}}                     │
│   └── ...                                 │
│ 📅 Datas                                  │
│ 📍 Local                                  │
│ 🏢 Solicitante                            │
│ ✏️ Personalizados                         │
│ 🎯 B-602 - Eficiência e Prestabilidade    │  ← só aparece se laudo for B-602
│   ├── 📊 Dados da Investigação            │
│   │   ├── {{b602_tabela_dados_investigacao}}│
│   │   ├── {{b602_envolvidos}}             │
│   │   ├── Envolvidos ──┐                  │
│   │   │   ├── {{b602_envolvido_1}}  ← dinâmico
│   │   │   └── {{b602_envolvido_2}}  ← dinâmico
│   │   ├── {{b602_data_ocorrencia}}         │
│   │   ├── {{b602_local}}                   │
│   │   ├── {{b602_numero_bo}}               │
│   │   ├── {{b602_numero_ip}}               │
│   │   └── {{b602_solicitante_nome}}        │
│   ├── 📦 Material Encaminhado              │
│   │   ├── {{b602_tabela_material_enc}}     │
│   │   ├── Item 1 ──┐                       │
│   │   │   ├── {{b602_material_enc_1_natureza}}│
│   │   │   ├── {{b602_material_enc_1_quantidade}}│
│   │   │   └── ...                          │
│   │   └── Item 2 ── (dinâmico)            │
│   ├── 🔵 Cartuchos                         │
│   │   ├── {{b602_tabela_cartuchos}}        │
│   │   ├── Cartucho 1 ──┐                   │
│   │   │   ├── {{b602_cartucho_1_quantidade}}│
│   │   │   ├── {{b602_cartucho_1_calibre}}  │
│   │   │   └── ...                          │
│   │   └── Cartucho 2 ── (dinâmico)        │
│   └── 🔴 Estojos                           │
│       ├── {{b602_tabela_estojos}}          │
│       ├── Estojo 1 ──┐                     │
│       │   └── ...                          │
│       └── Estojo 2 ── (dinâmico)          │
└────────────────────────────────────────────┘
```

> **Nota:** As categorias I-801, B-700 (futuro) etc. **não aparecem** — só a que corresponde ao tipo de exame do laudo em edição.

### 2.2 Estrutura da constante `B602_MENU_STRUCTURE`

```ts
// src/renderer/components/rep/exam-fields/b602-menu.ts
export interface MenuField {
  name: string;       // sufixo do campo (ex: 'quantidade', 'calibre')
  label: string;      // label em português
}

export interface MenuGroup {
  type: 'group';
  label: string;      // ex: 'Cartucho'
  prefix: string;     // ex: 'b602_cartucho_'
  fields: MenuField[];
}

export interface MenuEntry {
  type: 'field';
  name: string;       // nome completo do campo (ex: 'b602_data_ocorrencia')
  label: string;
}

export type MenuSectionItem = MenuEntry | MenuGroup;

export interface MenuSection {
  id: string;         // ex: 'dados_investigacao'
  label: string;      // ex: 'Dados da Investigação'
  items: MenuSectionItem[];
}

export const B602_MENU_STRUCTURE: MenuSection[] = [
  {
    id: 'dados_investigacao',
    label: 'Dados da Investigação',
    items: [
      { type: 'field', name: 'b602_tabela_dados_investigacao', label: 'Tabela completa' },
      { type: 'field', name: 'b602_envolvidos', label: 'Envolvidos (todos)' },
      {
        type: 'group',
        label: 'Envolvidos',
        prefix: 'b602_envolvido_',
        fields: [{ name: '', label: 'Nome do envolvido' }],
      },
      { type: 'field', name: 'b602_data_ocorrencia', label: 'Data da Ocorrência' },
      { type: 'field', name: 'b602_local', label: 'Local' },
      { type: 'field', name: 'b602_numero_bo', label: 'Nº do BO' },
      { type: 'field', name: 'b602_numero_ip', label: 'Nº do IP' },
      { type: 'field', name: 'b602_solicitante_nome', label: 'Solicitante' },
    ],
  },
  {
    id: 'material_enc',
    label: 'Material Encaminhado',
    items: [
      { type: 'field', name: 'b602_tabela_material_enc', label: 'Tabela completa' },
      {
        type: 'group',
        label: 'Item',
        prefix: 'b602_material_enc_',
        fields: [
          { name: 'natureza', label: 'Natureza' },
          { name: 'quantidade', label: 'Quantidade' },
          { name: 'tipo', label: 'Tipo' },
          { name: 'dito_oficio', label: 'Dito do Ofício' },
          { name: 'numero_lacre', label: 'Nº do Lacre' },
        ],
      },
    ],
  },
  {
    id: 'cartuchos',
    label: 'Cartuchos',
    items: [
      { type: 'field', name: 'b602_tabela_cartuchos', label: 'Tabela completa' },
      {
        type: 'group',
        label: 'Cartucho',
        prefix: 'b602_cartucho_',
        fields: [
          { name: 'quantidade', label: 'Quantidade' },
          { name: 'calibre', label: 'Calibre' },
          { name: 'marca', label: 'Marca' },
          { name: 'origem', label: 'Origem' },
          { name: 'espoleta', label: 'Espoleta' },
          { name: 'estojo', label: 'Estojo' },
          { name: 'projetil', label: 'Projétil' },
          { name: 'observacao', label: 'Observação' },
        ],
      },
    ],
  },
  {
    id: 'estojos',
    label: 'Estojos',
    items: [
      { type: 'field', name: 'b602_tabela_estojos', label: 'Tabela completa' },
      {
        type: 'group',
        label: 'Estojo',
        prefix: 'b602_estojo_',
        fields: [
          { name: 'quantidade', label: 'Quantidade' },
          { name: 'calibre', label: 'Calibre' },
          { name: 'marca', label: 'Marca' },
          { name: 'origem', label: 'Origem' },
          { name: 'espoleta', label: 'Espoleta' },
          { name: 'estojo', label: 'Estojo' },
          { name: 'observacao', label: 'Observação' },
        ],
      },
    ],
  },
];
```

### 2.3 Como os grupos dinâmicos expandem

O componente `PlaceholderContextMenu` recebe os dados da REP (`campos_especificos` parseado) e, para cada `MenuGroup`, conta quantas linhas existem:

```ts
function getGroupCount(prefix: string, b602Data: any): number {
  // prefix = 'b602_envolvido_' → conta `b602.envolvidos.length`
  // prefix = 'b602_cartucho_'   → conta `b602.cartuchos.length`
  // prefix = 'b602_material_enc_' → conta `b602.material_enc.length`
  // prefix = 'b602_estojo_'     → conta `b602.estojos.length`
}
```

Cada linha vira um submenu numerado: `Cartucho 1`, `Cartucho 2`, etc.

Placeholders de célula (`b602_cartucho_1_calibre`) **não precisam existir no banco** — são gerados na hora. Apenas os placeholders escalares (`b602_local`, `b602_data_ocorrencia`, etc.) e os de tabela (`b602_tabela_*`) precisam de seed para aparecer como "atalhos fixos" no menu, mas com a abordagem dinâmica, até isso pode ser repensado.

### 2.4 Placeholders fixos por tipo de exame (seed mínimo)

Para cada tipo de exame, apenas os **placeholders agregados** são semeados no banco:

| Chave | Categoria | Descrição |
|-------|-----------|-----------|
| `b602_envolvidos` | `cat-exam-B-602` | Lista de envolvidos (todos) |
| `b602_data_ocorrencia` | `cat-exam-B-602` | Data da ocorrência |
| `b602_local` | `cat-exam-B-602` | Local |
| `b602_numero_bo` | `cat-exam-B-602` | Nº BO |
| `b602_numero_ip` | `cat-exam-B-602` | Nº IP |
| `b602_solicitante_nome` | `cat-exam-B-602` | Solicitante |

Os placeholders de tabela e célula (`b602_tabela_*`, `b602_cartucho_1_calibre`, `b602_envolvido_1`) são **gerados dinamicamente** pelo menu a partir da constante `B602_MENU_STRUCTURE` + dados reais da REP.

---

## 3. Plano de Implementação — Ordem dos Passos

### Passo 1 — Adicionar `tipo_exame_codigo` ao backend

**Arquivo:** `src/main/ipc/handlers/laudo.handlers.ts` (ou equivalente)

- No handler `findAll`, fazer JOIN com `tipo_exame` (ou `reps`) para retornar `tipo_exame_codigo` em cada linha

**Arquivo:** `src/renderer/pages/LaudosPage.tsx`

- Adicionar `tipo_exame_codigo?: string` à interface `LaudoItem`

**Arquivo:** `src/main/types/database.ts`

- Atualizar tipagem se necessário

### Passo 2 — Criar constante de estrutura do menu B-602

**Novo arquivo:** `src/renderer/components/rep/exam-fields/b602-menu.ts`

- Exportar `B602_MENU_STRUCTURE: MenuSection[]`
- Exportar interfaces: `MenuSection`, `MenuSectionItem`, `MenuEntry`, `MenuGroup`, `MenuField`
- Exportar helper `getGroupCount(prefix, b602Data)` para contar linhas dinâmicas

**Arquivo:** `src/renderer/components/rep/exam-fields/index.ts`

- Registrar `B602_MENU_STRUCTURE` no `EXAM_MENU_REGISTRY`:
  ```ts
  export const EXAM_MENU_REGISTRY: Record<string, MenuSection[]> = {
    'B-602': B602_MENU_STRUCTURE,
  };
  ```

### Passo 3 — Refatorar `PlaceholderContextMenu` com suporte a submenus dinâmicos

**Arquivo:** `src/renderer/components/editor/PlaceholderContextMenu.tsx`

Mudanças:
- **Novas props:**
  - `exameMenuStructure?: MenuSection[]` — estrutura do tipo de exame atual
  - `exameCamposEspecificos?: Record<string, unknown>` — dados da REP para contar linhas
  - `categoriaExameId?: string` — ID da categoria de exame a mostrar (ex: `'cat-exam-B-602'`)

- **Lógica de filtro de categorias:**
  - Categorias "fixas": todas que **não** começam com `cat-exam-`
  - Categoria de exame: apenas a que corresponde a `categoriaExameId`

- **Renderização de seções dinâmicas:**
  - Para cada `MenuSection` em `exameMenuStructure`, renderizar um submenu
  - Para cada `MenuEntry` (`type: 'field'`): renderizar `ContextMenuItem` normal
  - Para cada `MenuGroup` (`type: 'group'`):
    - Contar linhas via `getGroupCount(prefix, b602Data)`
    - Para cada linha `1..count`, criar um `ContextMenuSub` numerado
    - Dentro: um `ContextMenuItem` por field do grupo, com placeholder completo (`prefix + n + '_' + field.name`)

**Novo arquivo (opcional):** Extrair a lógica de renderização de submenus de exame para um componente separado `ExamPlaceholderSubmenu.tsx` para manter o `PlaceholderContextMenu` enxuto.

### Passo 4 — Conectar LaudosPage ao menu dinâmico

**Arquivo:** `src/renderer/pages/LaudosPage.tsx`

- Ao entrar no modo edição (`setEditando`), buscar os dados da REP para obter:
  - `tipo_exame_codigo` (do `editando.tipo_exame_codigo`)
  - `campos_especificos` parseado (da REP)
- Derivar:
  - `categoriaExameId`: `"cat-exam-" + tipo_exame_codigo` (ex: `"cat-exam-B-602"`)
  - `exameMenuStructure`: `EXAM_MENU_REGISTRY[tipo_exame_codigo]`
- Passar para `PlaceholderContextMenu`:
  ```tsx
  <PlaceholderContextMenu
    editorId="..."
    categorias={categoriasFiltradas}
    placeholders={placeholdersFiltrados}
    exameMenuStructure={exameMenuStructure}
    exameCamposEspecificos={camposEspecificos}
    categoriaExameId={categoriaExameId}
    onInsertPlaceholder={inserirPlaceholder}
  >
  ```
- **Não filtrar** `placeholders` e `categorias` no componente pai — o `PlaceholderContextMenu` faz o filtro internamente com base nas novas props.

### Passo 5 — Atualizar seed de placeholders (remoção do que virou dinâmico)

**Arquivo:** `src/main/services/placeholder.service.ts`

- **Manter** os 7 placeholders escalares B-602 atuais no seed (já existem)
- **Remover** do seed qualquer placeholder de célula ou tabela que tenha sido pré-cadastrado (se houver)
- Adicionar à lista de proteção contra deleção as chaves B-602 existentes

**Arquivo:** `src/renderer/components/rep/exam-fields/placeholders.ts`

- Garantir que `CAMPOS_ESPECIFICOS_PLACEHOLDERS` contenha apenas os escalares (já está assim)
- Adicionar export de `EXAM_MENU_REGISTRY` (ou importar de `index.ts`)

### Passo 6 — Build, teste e verificação

- [ ] `npm run build` compila sem erros
- [ ] Abrir laudo B-602 → menu mostra categorias fixas + B-602
- [ ] Abrir laudo I-801 → menu mostra categorias fixas + I-801 (sem B-602)
- [ ] REP com 2 cartuchos → submenu Cartuchos mostra Cartucho 1 e 2
- [ ] REP com 0 cartuchos → submenu Cartuchos vazio ou oculto
- [ ] Clicar em placeholder de célula → insere `{{b602_cartucho_1_calibre}}` no editor
- [ ] Preview PDF resolve todos os placeholders
- [ ] Placeholders de célula digitados manualmente (`{{b602_cartucho_7_calibre}}`) funcionam mesmo sem estar no menu

---

## 4. Checklist Resumida

### Fase 1 — Backend
- [ ] `laudo.handlers.ts`: JOIN para retornar `tipo_exame_codigo`
- [ ] `LaudosPage.tsx`: adicionar `tipo_exame_codigo` ao `LaudoItem`
- [ ] Tipagem no `database.ts` se necessário

### Fase 2 — Constante de menu B-602
- [ ] Criar `src/renderer/components/rep/exam-fields/b602-menu.ts`
- [ ] Exportar `B602_MENU_STRUCTURE` e interfaces
- [ ] Registrar em `EXAM_MENU_REGISTRY` no `exam-fields/index.ts`

### Fase 3 — PlaceholderContextMenu
- [ ] Novas props: `exameMenuStructure`, `exameCamposEspecificos`, `categoriaExameId`
- [ ] Filtro de categorias (fixas vs exame)
- [ ] Renderização de seções dinâmicas com submenus aninhados
- [ ] Grupos expandem conforme número de linhas nos dados da REP

### Fase 4 — LaudosPage
- [ ] Buscar `campos_especificos` da REP ao editar
- [ ] Derivar `categoriaExameId` e `exameMenuStructure`
- [ ] Passar novas props ao `PlaceholderContextMenu`

### Fase 5 — Seed e cleanup
- [ ] `placeholder.service.ts`: revisar seed B-602 (manter escalares)
- [ ] `placeholders.ts`: garantir exports corretos

### Fase 6 — Verificação
- [ ] Build limpo
- [ ] Menu filtra por tipo de exame
- [ ] Linhas dinâmicas refletem dados reais
- [ ] Preview PDF funcional
- [ ] Placeholders manuais funcionam

---

## 5. Notas para Tipos de Exame Futuros

Ao criar um novo tipo de exame (ex: B-700), o desenvolvedor deve:

1. Criar `b700-menu.ts` com `B700_MENU_STRUCTURE`
2. Registrar em `EXAM_MENU_REGISTRY['B-700']` no `index.ts`
3. Criar a categoria no seed: `cat-exam-B-700`
4. Semear placeholders escalares no `placeholder.service.ts`

O menu de contexto funcionará automaticamente para o novo tipo, sem mexer no componente `PlaceholderContextMenu`.
