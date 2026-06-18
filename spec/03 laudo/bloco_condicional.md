# Blocos Condicionais no Editor de Laudo

> **Status:** Implementado (2026-06-17)
> **Última revisão:** 2026-06-17
> **Esquema:** Migration v25 — coluna `condicao TEXT` em `secoes_template`
> **Arquivos principais:** `TinyMceEditor.tsx`, `exam-fields/index.ts`, `exportacao-placeholders.ts`, `laudo.service.ts`, `LaudosPage.tsx`

---

## 1. Visão Geral

Os blocos condicionais permitem que o perito insira **seções opcionais** no laudo que só aparecem se determinados toggles estiverem ativos na REP. Exemplo: se a REP B-602 tem o toggle "Cartuchos" ligado, o editor insere um `<h3>DOS CARTUCHOS</h3>`; se desligado, o bloco some na exportação.

O menu "Bloco Cond." da toolbar **só exibe os toggles marcados na REP**, evitando que o perito insira blocos cujo toggle está desligado.

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
  subtitulo?: string;         // texto do <h3> no bloco condicional (ex: 'DOS CARTUCHOS')
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
}
```

> **Nota:** A prop `sectionNumber` e toda a lógica de numeração automática foram **removidas** (2026-06-17). Blocos condicionais são inseridos sem prefixo numérico.

---

## 3. Pipeline de Renderização

### 3.1 Toolbar `condbloco`

Se `condToggles` tem itens, o editor registra o botão `condbloco`:

```
[Bloco Cond. ▼]
  ├── Cartuchos          → insertCondBloco('b602_cartuchos_toggle')
  ├── Estojos            → insertCondBloco('b602_estojos_toggle')
  ├── Arma               → insertCondBloco('b602_armas_toggle')
  │   ├── Funcionamento  → insertCondBloco('b602_armas_funcionamento_toggle')
  │   └── Coleta         → insertCondBloco('b602_armas_coleta_toggle')
  └── ...
```

Sem toggles, o botão aparece desabilitado: `disabled: true`.

### 3.2 Filtragem pelo estado da REP (`LaudosPage.tsx`)

**Arquivo:** `LaudosPage.tsx:478`

O `exameToggles` é filtrado com base no `exameCamposEspecificos` carregado da REP:

```
exameCamposEspecificos (extraído de parsed.b602)
  ├── cartuchos[]?          → b602_cartuchos_toggle ON (implícito)
  ├── estojos[]?            → b602_estojos_toggle ON (implícito)
  ├── armas_toggle === 'on' → b602_armas_toggle ON (explícito)
  ├── armas_funcionamento_toggle === 'on' → ON (explícito)
  └── armas_coleta_toggle === 'on'       → ON (explícito)
```

**Regras:**
- **Explícito**: `chave === 'on'` (ex: `armas_toggle`, `armas_funcionamento_toggle`)
- **Implícito**: array de dados correspondente existe e tem itens (ex: `cartuchos[]` existe → `cartuchos_toggle` ativo)
- **SubToggles**: mantidos apenas se o sub-toggle específico está 'on'; toggle pai aparece se ele próprio ou ao menos 1 sub está ativo
- **Sem dados da REP**: mostra todos os toggles (evita flicker durante carregamento)

### 3.3 Comando `insertCondBloco`

**Arquivo:** `TinyMceEditor.tsx:421`

```
insertCondBloco(toggleId: string, subIndex?: number)
```

1. Busca o toggle em `condToggles` (incluindo sub-toggles)
2. Gera HTML: `<div data-cond-bloco="toggleId" class="cond-bloco"><h3>Subtitulo</h3><p>&nbsp;</p></div>`
3. Insere no editor via `editor.insertContent(html)`

> **Nota:** O prefixo `X.X.` foi removido. O `<h3>` contém apenas o título do bloco (ex: "DOS CARTUCHOS") sem numeração.

### 3.4 Formato HTML gerado

```html
<div data-cond-bloco="b602_cartuchos_toggle" class="cond-bloco">
  <h3>DOS CARTUCHOS</h3>
  <p>&nbsp;</p>
</div>
```

- `<div data-cond-bloco>` — marcador para o backend processar
- `<h3>` — título visível, **sem numeração automática**
- `<p>&nbsp;</p>` — espaço para o perito digitar conteúdo

---

## 4. Backend — Sincronização

### 4.1 `laudoService.sincronizarSecoesCondicionais()`

**Arquivo:** `src/main/services/laudo.service.ts:343`

Chamado ao salvar/atualizar a REP (via handler `rep:update`). Fluxo:

1. Busca o laudo e seu template
2. Lê `secoes_template` com `condicao` não-nula
3. Busca `campos_especificos` da REP associada
4. Avalia cada condição: se `condicao.campo` === `'on'`, seção ativa
5. Reconstrói o HTML concatenando seções na ordem do template
6. Para seções existentes: atualiza número do H2 e processa blocos condicionais
7. Para seções novas: cria a partir do template (com numeração H2)
8. Para seções não-listadas no template: mantém como estão
9. Salva se houve mudança

### 4.2 `_processarBlocosCondicionais()`

**Arquivo:** `src/main/services/laudo.service.ts:481`

Remove `<div data-cond-bloco>` cujo toggle não está ativo (`!== 'on'`):

```ts
private _processarBlocosCondicionais(html: string, toggles: Record<string, unknown>): string {
  const BLOCK_REGEX = /<div\s+data-cond-bloco="([^"]*)"[^>]*>([\s\S]*?)<\/div>/gi;
  return html.replace(BLOCK_REGEX, (match, toggleId) => {
    return toggles[toggleId] === 'on' ? match : '';
  });
}
```

Usa callback no `String.replace` para garantir remoção posicional correta.

> **Nota:** O parâmetro `numeroSecao` e a renumeração de `<h3>` foram removidos (2026-06-17). O método apenas remove blocos com toggle off.

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

### 5.2 Limpeza de estilos

Remove atributos `style` de `<div data-cond-bloco>`:

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

> **Nota:** A função `resolverNumeracaoBlocosCondicionais` foi descontinuada e convertida em no-op (2026-06-17). Não há mais numeração automática de blocos condicionais na exportação.

---

## 6. Arquivos Envolvidos

| Arquivo | Papel |
|---|---|
| `src/renderer/components/editor/TinyMceEditor.tsx` | Prop `condToggles`, toolbar `condbloco`, comando `insertCondBloco` (sem numeração) |
| `src/renderer/components/rep/exam-fields/index.ts` | Interface `ExamToggle`, constante `EXAM_TOGGLES`, export |
| `src/renderer/components/rep/exam-fields/types.ts` | Tipos `REPFormData` com campos de toggle |
| `src/renderer/lib/exportacao-placeholders.ts` | `limparIndicadoresCondicionais()` — compatibilidade retroativa e limpeza; `resolverNumeracaoBlocosCondicionais()` descontinuada (no-op) |
| `src/main/services/laudo.service.ts` | `sincronizarSecoesCondicionais()`, `_processarBlocosCondicionais()` (sem renumeração) |
| `src/main/database/index.ts` | Migration v25: `condicao TEXT` em `secoes_template` |
| `src/renderer/pages/LaudosPage.tsx` | Filtra `condToggles` com base no `exameCamposEspecificos` da REP; passa ao `<TinyMceEditor>` |
| `src/renderer/pages/TemplatesPage.tsx` | Passa `condToggles` ao `<TinyMceEditor>` (todos os toggles, sem filtro — template não tem REP vinculada) |

---

## 7. Fluxo Completo

```
Usuário preenche REP B-602
  → liga toggle "Cartuchos" (cartuchos[] com itens salvos)
  → salva (campos_especificos.b602.cartuchos = [...itens...])

Usuário abre editor de laudo vinculado à REP
  → LaudosPage busca campos_especificos da REP
  → Faz parse de parsed.b602 → exameCamposEspecificos
  → Filtra EXAM_TOGGLES['B-602']: só mantém toggles ON na REP
  → Passa condToggles filtrados ao <TinyMceEditor>

Usuário clica no botão "Bloco Cond." na toolbar
  → Dropdown mostra: Cartuchos (se ON), Estojos (se ON), Arma (se ON)...
  → Clica "Cartuchos"
  → insertCondBloco('b602_cartuchos_toggle')
  → Insere: <div data-cond-bloco="b602_cartuchos_toggle" class="cond-bloco">
             <h3>DOS CARTUCHOS</h3>
             <p>&nbsp;</p>
           </div>

Usuário salva a REP (atualização)
  → rep.handlers.ts: rep:update → laudoService.sincronizarSecoesCondicionais(laudoId)
  → Avalia condicoes das secoes_template
  → _processarBlocosCondicionais: remove blocos com toggle off (callback replace)

Usuário gera preview PDF
  → resolverPlaceholdersExportacao(html, ctx)
  → limparIndicadoresCondicionais(html)
  → <div data-cond-bloco> estilos limpos; <p data-cond-label> convertido para <h3>
```
