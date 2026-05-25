# Cursor salta para o início ao digitar no TinyMCE (LaudosPage)

## Sintoma

Ao digitar qualquer caractere no editor TinyMCE da página de Laudos, o cursor salta imediatamente para o início do texto. A digitação fica impossível.

O problema **não ocorre** nas páginas `CabecalhoPage.tsx` e `TemplatesPage.tsx`, que também usam o mesmo componente `TinyMceEditor`.

## Causa raiz

**Duas causas independentes, ambas contribuindo para o mesmo sintoma:**

### 1. Componente `PlaceholderContextMenu` definido DENTRO do `LaudosPage`

O `PlaceholderContextMenu` era declarado como uma função dentro do corpo do `LaudosPage`:

```tsx
export const LaudosPage: React.FC = () => {
  // ...
  const PlaceholderContextMenu: React.FC<{...}> = ({ editorId, children }) => (
    <ContextMenu>...</ContextMenu>
  );
  // ...
};
```

A cada render do `LaudosPage`, uma **nova referência de função** era criada. O React interpreta isso como um tipo de componente diferente. Consequência: o React **desmonta e remonta** toda a subárvore do `PlaceholderContextMenu`, incluindo o `<TinyMceEditor>` filho. O TinyMCE é destruído (`editor.destroy()`) e recriado (`init`), perdendo o cursor e o estado interno.

`CabecalhoPage` e `TemplatesPage` não têm esse problema porque usam `<ContextMenu>` diretamente no JSX (componente importado, referência estável).

### 2. Modo controlado (`value`) com HTML complexo de seções

O `buildSingleHtmlFromSecoes()` gera HTML com elementos `<section>` contendo atributos `style` inline, `data-*` e `contenteditable="false"`:

```html
<section data-laudo-secao="true" data-secao-index="0" style="margin-bottom:16px;border:1px solid rgba(128,128,128,0.2);...">
  <div contenteditable="false" data-laudo-secao-header="true" style="background:...">Seção 1</div>
  <div data-laudo-secao-content="true" style="padding:8px 4px;">
    <p>conteúdo...</p>
  </div>
</section>
```

O TinyMCE **normaliza** esse HTML internamente (reordena atributos CSS, ajusta espaçamentos, etc.). Quando a prop `value` do `@tinymce/tinymce-react` é comparada com `editor.getContent()`, os valores **nunca batem exatamente**. Isso dispara `editor.setContent(value)` a cada render, que reposiciona o cursor no início.

`CabecalhoPage` e `TemplatesPage` não têm seções com esse HTML complexo — usam parágrafos simples cujo `getContent()` bate com o `value`.

## Solução aplicada

### 1. Extrair `PlaceholderContextMenu` para escopo de módulo

Movido para **fora** do componente `LaudosPage`, como uma função de módulo com referência estável:

```tsx
// ✅ Fora do LaudosPage — referência estável entre renders
const PlaceholderContextMenu: React.FC<{
  editorId: string;
  categorias: Categoria[];
  placeholders: Placeholder[];
  onInsertPlaceholder: (editorId: string, chave: string) => void;
  children: React.ReactNode;
}> = ({ editorId, categorias, placeholders, onInsertPlaceholder, children }) => (
  <ContextMenu>
    <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
    <ContextMenuContent>...</ContextMenuContent>
  </ContextMenu>
);
```

Os dados que antes vinham do closure (`categorias`, `placeholders`, `inserirPlaceholder`) agora são recebidos via props.

Uso:
```tsx
<PlaceholderContextMenu 
  editorId="laudo-single-editor"
  categorias={categorias} 
  placeholders={placeholders} 
  onInsertPlaceholder={inserirPlaceholder}
>
  <TinyMceEditor ... />
</PlaceholderContextMenu>
```

### 2. Usar `initialValue` em vez de `value` no TinyMceEditor

Adicionado suporte à prop `initialValue` no `TinyMceEditor.tsx` (modo não controlado):

```tsx
// TinyMceEditor.tsx
interface TinyMceEditorProps {
  value?: string;           // Modo controlado (legado, compatível com outras páginas)
  initialValue?: string;    // Modo NÃO controlado — sem sync a cada render
  // ...
}

// No corpo do componente:
const [stableInitialValue] = useState(initialValue);
const isUncontrolled = initialValue !== undefined;
```

Quando `initialValue` é passado, o `<Editor>` recebe `initialValue={stableInitialValue}` (capturado via `useState` na montagem) e **não** recebe `value`. O conteúdo do editor não é sincronizado a cada mudança de estado React — apenas na montagem inicial.

Nos pontos de uso do `LaudosPage`:
```tsx
// Antes:  value={singleEditorHtml}         ← causava setContent a cada tecla
// Depois: initialValue={singleEditorHtml}   ← só aplica na montagem
```

Para atualizações programáticas (após salvar, aplicar resposta da IA), usa-se `editor.setContent()` diretamente via `window.tinymce.get(editorId)`.

### Ajustes complementares no `handleSalvar` e `handleApplyResponse`

Como o editor não sincroniza mais automaticamente com o estado React:

- **`handleSalvar`**: após reindexar figuras, empurra o HTML corrigido de volta ao editor via `editor.setContent(conteudoFinal)`
- **`handleApplyResponse`** (multi mode, ramo `else`): adicionado `editor.setContent(texto)` — antes só atualizava estado React e dependia do sync do `value`

## Arquivos alterados

| Arquivo | O que mudou |
|---------|-------------|
| `src/renderer/components/editor/TinyMceEditor.tsx` | `value` opcional, adicionado `initialValue` para modo não controlado |
| `src/renderer/pages/LaudosPage.tsx` | `PlaceholderContextMenu` extraído para módulo; `value` → `initialValue`; `setContent` após save e apply response |

## Regra para evitar recorrência

1. **Nunca defina componentes React dentro de outro componente** como closures. Sempre extraia para escopo de módulo ou use `useMemo`/`useCallback` com dependências estáveis. Caso contrário, a identidade do componente muda a cada render e os filhos são desmontados/remontados.

2. **Em editores TinyMCE com HTML complexo** (seções, wrappers com atributos inline, `contenteditable`), **sempre use `initialValue`** (modo não controlado). O modo `value` (controlado) só é seguro para HTML simples onde `getContent()` retorna exatamente o mesmo string passado em `value`.
