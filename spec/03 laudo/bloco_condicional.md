# Blocos Condicionais no Editor de Laudo

> **Status:** Implementado (2026-06-17)
> **Esquema:** Migration v25 — coluna `condicao TEXT` em `secoes_template`
> **Arquivos principais:** `TinyMceEditor.tsx`, `exam-fields/index.ts`, `exportacao-placeholders.ts`, `laudo.service.ts`

---

## 1. Visão Geral

Os blocos condicionais permitem que o perito insira **seções opcionais** no laudo que só aparecem se determinados toggles estiverem ativos na REP. Exemplo: se a REP B-602 tem o toggle "Cartuchos" ligado, o editor insere um `<h3>DOS CARTUCHOS</h3>`; se desligado, o bloco some na exportação.

```
REP B-602
  ├── Cartuchos: ON  →  editor insere <h3>DOS CARTUCHOS</h3>
  ├── Estojos: ON    →  editor insere <h3>DOS ESTOJOS</h3>
  └── Arma: ON       →  editor insere <h3>DA ARMA</h3>
       ├── Funcionamento: ON  → <h3>FUNCIONAMENTO E EFICIÊNCIA</h3>
       └── Coleta: ON         → <h3>COLETA DE PADRÕES BALÍSTICOS</h3>
```

---

## 2. Estruturas de Dados

### 2.1 `ExamToggle`

```ts
// src/renderer/components/rep/exam-fields/index.ts
export interface ExamToggle {
  id: string;                 // identificador único (ex: 'b602_cartuchos_toggle')
  label: string;              // label no formulário da REP
  subtitulo?: string;         // texto do <h3> no bloco condicional
  sectionId?: string;         // id da seção no SECTION_REGISTRY (se houver)
  subToggles?: ExamToggle[];  // sub-toggles aninhados
}
```

### 2.2 `EXAM_TOGGLES`

Registro central que mapeia código do exame → array de toggles:

```ts
export const EXAM_TOGGLES: Record<string, ExamToggle[]> = {
  'B-602': [
    { id: 'b602_cartuchos_toggle', label: 'Cartuchos', subtitulo: 'DOS CARTUCHOS', sectionId: 'cartuchos' },
    { id: 'b602_estojos_toggle', label: 'Estojos', subtitulo: 'DOS ESTOJOS', sectionId: 'estojos' },
    {
      id: 'b602_armas_toggle', label: 'Arma', subtitulo: 'DA ARMA', sectionId: 'armas',
      subToggles: [
        { id: 'b602_armas_funcionamento_toggle', label: 'Funcionamento e Eficiência', subtitulo: 'FUNCIONAMENTO E EFICIÊNCIA' },
        { id: 'b602_armas_coleta_toggle', label: 'Coleta de Padrões Balísticos', subtitulo: 'COLETA DE PADRÕES BALÍSTICOS' },
      ],
    },
  ],
};
```

### 2.3 Propriedades do `<TinyMceEditor>`

```ts
interface TinyMceEditorProps {
  // ...
  condToggles?: Array<{
    id: string;
    label: string;
    subtitulo?: string;
    subToggles?: Array<{ id: string; label: string; subtitulo?: string }>
  }>;
  sectionNumber?: number;  // número da seção atual (para numeração automática)
}
```

---

## 3. Pipeline de Renderização

### 3.1 Toolbar `condbloco`

Se `condToggles` tem itens, o editor registra o botão `condbloco`:

```
[Bloco Cond. ▼]
  ├── Cartuchos          → insertCondBloco('b602_cartuchos_toggle')
  ├── Estojos            → insertCondBloco('b602_estojos_toggle')
  ├── Arma               → insertCondBloco('b602_armas_toggle')
  │   ├── Funcionamento  → insertCondBloco('b602_armas_funcionamento_toggle', 0)
  │   └── Coleta         → insertCondBloco('b602_armas_coleta_toggle', 1)
  └── ...
```

Sem toggles, o botão aparece desabilitado: `disabled: true`.

### 3.2 Comando `insertCondBloco`

**Arquivo:** `TinyMceEditor.tsx:424`

```
insertCondBloco(toggleId: string, subIndex?: number)
```

1. Busca o toggle em `condToggles` (incluindo sub-toggles)
2. Detecta número da seção (ver seção 3.3)
3. Gera HTML: `<div data-cond-bloco="toggleId" class="cond-bloco"><h3>N. Subtitulo</h3><p>&nbsp;</p></div>`
4. Insere no editor via `editor.insertContent(html)`

### 3.3 Numeração Automática

Ordem de precedência para determinar o número da seção:

| Prioridade | Fonte | Detecção |
|---|---|---|
| 1 | Prop `sectionNumber` | Passada diretamente pelo componente pai |
| 2 | Único `<h2>` no editor | Regex `^(\d+)\.` no textContent do `<h2>` |
| 3 | `<h2>` mais próximo do cursor | Sobe no DOM até encontrar `<h2>`, aplica regex |
| 4 | `<section data-template-secao="true">` | Atributo `data-secao-index` + 1 |

Para sub-toggles, o número final é `N.M` onde `N` é o número da seção e `M` é `subIndex + 1`.

Se nenhum número for detectado, usa `X` como fallback.

### 3.4 Formato HTML gerado

```html
<div data-cond-bloco="b602_cartuchos_toggle" class="cond-bloco">
  <h3>5. DOS CARTUCHOS</h3>
  <p>&nbsp;</p>
</div>
```

- `<div data-cond-bloco>` — marcador para o backend processar
- `<h3>` — título visível, com numeração automática
- `<p>&nbsp;</p>` — espaço para o perito digitar conteúdo

---

## 4. Backend — Sincronização

### 4.1 `laudoService.sincronizarSecoesCondicionais()`

**Arquivo:** `src/main/services/laudo.service.ts:343`

Chamado ao salvar o laudo (ou em processo separado). Fluxo:

1. Busca o laudo e seu template
2. Lê `secoes_template` com `condicao` não-nula
3. Busca `campos_especificos` da REP associada
4. Avalia cada condição: se `condicao.campo` === `'on'`, seção ativa
5. Reconstrói o HTML concatenando seções na ordem do template
6. Para seções já existentes: atualiza número do H2 e processa blocos condicionais
7. Para seções novas: cria a partir do template
8. Para seções não-listadas no template: mantém como estão
9. Salva se houve mudança

### 4.2 `_processarBlocosCondicionais()`

**Arquivo:** `src/main/services/laudo.service.ts:481`

Remove `<div data-cond-bloco>` cujo toggle não está ativo (`!== 'on'`):

```ts
const COND_REGEX = /<div\s+data-cond-bloco="([^"]*)"[^>]*>([\s\S]*?)<\/div>/gi;
// Se toggles[toggleId] !== 'on', remove o bloco
```

### 4.3 Migration v25

Coluna `condicao` adicionada à tabela `secoes_template`:

```sql
ALTER TABLE secoes_template ADD COLUMN condicao TEXT;
```

Formato: `{"campo": "b602_cartuchos_toggle"}` (JSON com nome do campo do toggle).

---

## 5. Exportação — `limparIndicadoresCondicionais()`

**Arquivo:** `src/renderer/lib/exportacao-placeholders.ts:229`

Executada no preview PDF e exportação. Duas transformações:

### 5.1 Compatibilidade retroativa (formato antigo)

Converte `<p data-cond-label="true">[Condicional: LABEL]</p>` → `<h3>LABEL</h3>`:

```ts
html.replace(
  /<p[^>]*data-cond-label="true"[^>]*>\[Condicional:\s*([^\]]+)\]<\/p>/gi,
  '<h3>$1</h3>'
);
```

Isso garante que laudos salvos no formato anterior (com `<p>` em vez de `<h3>`) ainda sejam renderizados corretamente.

### 5.2 Limpeza de estilos

Remove atributos `style` de `<div data-cond-bloco>` que possam ter sido inseridos pelo editor:

```ts
html.replace(
  /<div[^>]*\bdata-cond-bloco="[^"]*"[^>]*>/gi,
  (match) => match.replace(/\s*style="[^"]*"/gi, '')
);
```

### 5.3 Pipeline completo (`resolverPlaceholdersExportacao`)

```
HTML com placeholders
  → resolver spans[data-placeholder]
  → resolver {{chave}} tags
  → limparIndicadoresCondicionais(HTML)  ← transforma cond-bloco + remove styles
  → HTML final para preview/PDF
```

---

## 6. Arquivos Envolvidos

| Arquivo | Papel |
|---|---|
| `src/renderer/components/editor/TinyMceEditor.tsx` | Prop `condToggles`, toolbar `condbloco`, comando `insertCondBloco`, numeração automática |
| `src/renderer/components/rep/exam-fields/index.ts` | Interface `ExamToggle`, constante `EXAM_TOGGLES`, export |
| `src/renderer/components/rep/exam-fields/types.ts` | Tipos `REPFormData` com campos de toggle |
| `src/renderer/lib/exportacao-placeholders.ts` | `limparIndicadoresCondicionais()` — compatibilidade retroativa e limpeza |
| `src/main/services/laudo.service.ts` | `sincronizarSecoesCondicionais()`, `_processarBlocosCondicionais()` |
| `src/main/database/index.ts` | Migration v25: `condicao TEXT` em `secoes_template` |
| `src/renderer/pages/LaudosPage.tsx` | Passa `condToggles` e `sectionNumber` ao `<TinyMceEditor>` |
| `src/renderer/pages/TemplatesPage.tsx` | Passa `condToggles` e `sectionNumber` ao `<TinyMceEditor>` |

---

## 7. Fluxo Completo

```
Usuário preenche REP B-602
  → liga toggle "Cartuchos"
  → salva (campos_especificos.b602.b602_cartuchos_toggle = 'on')

Usuário abre editor de laudo vinculado à REP
  → LaudosPage busca campos_especificos da REP
  → Monta condToggles a partir de EXAM_TOGGLES['B-602']
  → Passa condToggles ao <TinyMceEditor>

Usuário clica no botão "Bloco Cond." na toolbar
  → Dropdown mostra: Cartuchos, Estojos, Arma...
  → Clica "Cartuchos"
  → insertCondBloco('b602_cartuchos_toggle')
  → Detecta número da seção (ex: "5")
  → Insere: <div data-cond-bloco="b602_cartuchos_toggle" class="cond-bloco">
             <h3>5. DOS CARTUCHOS</h3>
             <p>&nbsp;</p>
           </div>

Usuário salva o laudo
  → laudoService.sincronizarSecoesCondicionais(laudoId)
  → Avalia condicoes das secoes_template
  → Processa blocos condicionais internos (remove desligados)

Usuário gera preview PDF
  → resolverPlaceholdersExportacao(html, ctx)
  → limparIndicadoresCondicionais(html)
  → <div data-cond-bloco> viram <h3> no PDF
  → Se toggle desligado: bloco removido → não aparece no PDF
```
