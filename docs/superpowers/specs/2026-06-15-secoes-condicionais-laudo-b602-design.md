# Seções Condicionais no Laudo (B-602)

## Visão geral

O formulário B-602 da REP ganha toggles que controlam se seções/blocos correspondentes aparecem no laudo. A sincronização é reativa: ao salvar a REP, o laudo é reconstruído automaticamente. O template é criado pelo usuário via TemplatesPage com estrutura flexível — o mecanismo funciona com qualquer organização de seções.

---

## 1. Formulário B-602 na REP

### Ordem das seções

1. Dados da Investigação (sempre)
2. Material Apresentado a Exame (sempre, sem toggle)
3. Cartuchos (toggle: `b602_cartuchos_toggle`)
4. Estojos (toggle: `b602_estojos_toggle`)
5. Arma (toggle: `b602_armas_toggle`)

### Material Apresentado a Exame

- **Sem toggle** — sempre presente no form e no laudo
- Tabela de repetição com colunas: Natureza, Quantidade, Tipo, Dito Ofício, Nº Lacre
- Dropdown Natureza ganha duas novas opções: **Cartucho** e **Estojo** (além de Arma, Munição, Acessório)
- Quando Natureza = **Arma**, expande campos extras inline na mesma linha:
  - Marca, Calibre, Numeração Série, Numeração Cano, Capacidade Carregador, Comprimento Cano, Acabamento, Funcionamento, Estado de Conservação
  - Campos indexados: `b602_material_enc_{i}_arma_marca`, `b602_material_enc_{i}_arma_calibre`, etc.

### Cartuchos e Estojos

Comportamento atual mantido. Tabela de repetição com toggle (`ToggleSection`). Cada um controlado por seu checkbox.

### Arma (nova seção, toggle próprio)

- Toggle principal: `b602_armas_toggle` — "Possui Arma(s)?"
- Quando marcado, mostra:
  - Tabela de armas (repetição, min 1 linha): Tipo, Marca, Calibre, Numeração Série, Numeração Cano, Capacidade, Comprimento Cano, Acabamento, Funcionamento, Estado Conservação, Quantidade, Dito Ofício, Nº Lacre
  - Sub-toggle: `b602_armas_funcionamento_toggle` — "Funcionamento e Eficiência"
  - Sub-toggle: `b602_armas_coleta_toggle` — "Coleta de Padrões Balísticos"

### Toggles disponíveis (registro central)

```ts
export const EXAM_TOGGLES: Record<string, ExamToggle[]> = {
  'B-602': [
    { id: 'b602_cartuchos_toggle', label: 'Cartuchos', sectionId: 'cartuchos' },
    { id: 'b602_estojos_toggle', label: 'Estojos', sectionId: 'estojos' },
    {
      id: 'b602_armas_toggle', label: 'Arma', sectionId: 'armas',
      subToggles: [
        { id: 'b602_armas_funcionamento_toggle', label: 'Funcionamento e Eficiência' },
        { id: 'b602_armas_coleta_toggle', label: 'Coleta de Padrões Balísticos' },
      ],
    },
  ],
};
```

Usado por: REPsPage (saber quais toggles renderizar), TemplatesPage (dropdown de condicao + toolbar), sync (mapear toggle → seção/bloco).

---

## 2. Template de laudo

### Nível 1 — Seção condicional (H2)

**Banco:** Migration v26 adiciona coluna `condicao TEXT` em `secoes_template`.
Formato: `{"campo": "b602_cartuchos_toggle", "valor": "on"}`.
`NULL` = seção sempre presente (comportamento atual).

**TemplatesPage:** Na edição de seção (modo multi-editor), dropdown opcional "Mostrar apenas se:" lista toggles do tipo de exame (`EXAM_TOGGLES`). Para B-602: Cartuchos, Estojos, Arma. Valor default: vazio (sem condição).

### Nível 2 — Bloco condicional (dentro do conteúdo)

**Toolbar TinyMCE:** Botão "Bloco Condicional" visível apenas para B-602.

Ao clicar, dropdown hierárquico com toggles e sub-toggles:

```
▸ Cartuchos
▸ Estojos
▸ Arma
  ▸ Funcionamento e Eficiência
  ▸ Coleta de Padrões Balísticos
```

Ao selecionar, insere no cursor:

```html
<div data-cond-bloco="b602_armas_funcionamento_toggle"
     style="border:1px dashed #f59e0b;padding:8px;border-radius:6px;margin:8px 0">
  <p style="color:#92400e;font-size:12px;margin:0 0 4px" data-cond-label="true">
    [Condicional: Funcionamento e Eficiência]
  </p>
  <p>&nbsp;</p>
</div>
```

- Borda laranja tracejada e label descritiva no editor
- `data-cond-label="true"` no parágrafo de label para estilização
- Comando: `editor.addCommand('insertCondBloco', ...)` em `TinyMceEditor.tsx`

### Estrutura típica do template B-602

```
H2: PREÂMBULO                          (sem condicao)
H2: OBJETIVO                           (sem condicao)
H2: MATERIAL APRESENTADO A EXAME       (sem condicao)
H2: DO EXAME                           (sem condicao)
    ├── <div cond-bloco: cartuchos>    DOS CARTUCHOS + {{b602_tabela_cartuchos}}
    ├── <div cond-bloco: estojos>      DOS ESTOJOS + {{b602_tabela_estojos}}
    └── <div cond-bloco: armas>        DA ARMA + {{b602_arma_1_marca}}...
         ├── <div cond-bloco: func>     Funcionamento e Eficiência
         └── <div cond-bloco: coleta>   Coleta de Padrões Balísticos
H2: CONCLUSÃO                          (sem condicao)
H2: CONSIDERAÇÕES FINAIS               (sem condicao)
H2: ENCERRAMENTO                       (sem condicao)
```

---

## 3. Sincronização REP → Laudo

### Gatilho

Handler `rep:update` no main process. Após salvar a REP, chama `laudoService.sincronizarSecoesCondicionais(laudo_id)`.

### Algoritmo

```
sincronizarSecoesCondicionais(laudo_id):
  1. Busca laudo (conteudo HTML), template (secoes_template com condicao),
     REP (campos_especificos com toggles)
  2. Determina seções esperadas:
     a. condicao = NULL → sempre inclusa
     b. condicao.campo = 'on' na REP → inclusa
     c. senão → removida
  3. Reconstrói HTML do laudo:
     a. Seções mantidas → preserva conteúdo existente (já está no HTML)
     b. Seções novas → insere <h2> + conteúdo fresco do template na posição correta
     c. Seções removidas → remove <h2> e todo conteúdo até o próximo <h2>
  4. Dentro de cada seção, processa <div data-cond-bloco="...">:
     a. toggle = 'off' → remove o div e todo seu innerHTML
     b. toggle = 'on' → mantém
  5. Salva laudo.conteudo
```

### Aviso ao desmarcar (REPsPage)

Antes de salvar a REP, se um toggle mudou de `'on'` para `'off'` e existe laudo vinculado, exibe diálogo:

> "Desmarcar 'Possui Cartuchos?' removerá a seção/bloco correspondente do laudo. Edições manuais nessa seção serão perdidas."
> [Cancelar] [Continuar]

---

## 4. Placeholders

### Placeholders de arma (novos)

Individuais (indexados por linha):
- `b602_arma_{n}_tipo`, `b602_arma_{n}_marca`, `b602_arma_{n}_calibre`
- `b602_arma_{n}_numeracao_serie`, `b602_arma_{n}_numeracao_cano`
- `b602_arma_{n}_capacidade_carregador`, `b602_arma_{n}_comprimento_cano`
- `b602_arma_{n}_acabamento`, `b602_arma_{n}_funcionamento`, `b602_arma_{n}_estado_conservacao`
- `b602_arma_{n}_quantidade`, `b602_arma_{n}_dito_oficio`, `b602_arma_{n}_numero_lacre`

Tabela: `b602_tabela_armas` (HTML, via `buildArmasTabela()`)

### Placeholders de contagem (novos)

| Chave | Fonte |
|-------|-------|
| `b602_total_material_enc` | Soma de `quantidade` em `material_enc[]` |
| `b602_total_cartuchos` | Soma de `quantidade` em `cartuchos[]` |
| `b602_total_estojos` | Soma de `quantidade` em `estojos[]` |
| `b602_total_armas` | Soma de `quantidade` em `armas[]` |

Resolvidos em `aplicarPlaceholders()` (LaudosPage.tsx) e `resolverPlaceholdersExportacao()` (exportacao-placeholders.ts).

### Menu de contexto (PlaceholderContextMenu)

`B602_MENU_STRUCTURE` atualizado com nova seção "Arma" contendo:
- Grupo "Armas" com campos individuais (tipo, marca, calibre, etc.)
- Entry "Tabela de Armas" → `b602_tabela_armas`
- Entries de contagem

Sub-toggles (Funcionamento, Coleta) não precisam de entrada no menu — são blocos condicionais inseridos via toolbar, não placeholders de valor.

---

## 5. Upgrade e compatibilidade

### Migration v26

```sql
ALTER TABLE secoes_template ADD COLUMN condicao TEXT;
```

### Seed

- Novos placeholders de contagem + arma no `seedSistema()` do `placeholder.service.ts`
- Associados à categoria `cat-exam-B-602` (já existente)

### Compatibilidade

- Templates existentes: `condicao = NULL` → sem alteração de comportamento
- REPs existentes: campos novos com default (toggle `'off'`, arrays vazios)
- Laudos existentes sem `<div data-cond-bloco>`: sync não afeta o conteúdo
- `b602_material_enc_toggle` removido do form — Material Encaminhado sempre presente

---

## 6. Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/main/database/index.ts` | Migration v26, seed placeholders |
| `src/main/services/laudo.service.ts` | `sincronizarSecoesCondicionais()` |
| `src/main/ipc/handlers/rep.handlers.ts` | Chamar sync após `rep:update` |
| `src/renderer/components/rep/exam-fields/b602.tsx` | `ArmasFields`, sub-toggles, Natureza "Cartucho"/"Estojo", remover toggle Material Enc, campos arma inline |
| `src/renderer/components/rep/exam-fields/b602.service.ts` | Serialize/deserialize armas + campos arma no material_enc |
| `src/renderer/components/rep/exam-fields/types.ts` | Campos novos no `REPFormData` |
| `src/renderer/components/rep/exam-fields/index.ts` | `EXAM_TOGGLES`, `armas` em `EXAM_FIELD_MAP` + `SECTION_REGISTRY` |
| `src/renderer/components/rep/exam-fields/placeholders.ts` | Placeholders arma + contagem |
| `src/renderer/components/rep/step-registry.ts` | Step "Arma" |
| `src/renderer/pages/REPsPage.tsx` | Schema, validação, aviso ao desmarcar |
| `src/renderer/pages/TemplatesPage.tsx` | Dropdown `condicao`, botão "Bloco Condicional" (B-602) |
| `src/renderer/pages/LaudosPage.tsx` | `aplicarPlaceholders`: contagens + armas |
| `src/renderer/lib/tabelas-placeholder.ts` | `buildArmasTabela()` |
| `src/renderer/lib/exportacao-placeholders.ts` | Resolver contagens + armas |
| `src/renderer/components/editor/TinyMceEditor.tsx` | Comando `insertCondBloco` + toolbar button |
