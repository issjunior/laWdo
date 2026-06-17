# Encapsulamento de Placeholders (`contenteditable=false`)

**Status:** ✅ IMPLEMENTADO — 2026-05-25
**Arquivos alterados:** `TinyMceEditor.tsx` (2 pontos), `src/renderer/lib/utils.ts` (1 ponto)

## Problema

Após inserir um placeholder (via menu de contexto com `insertPlaceholder` **ou** digitando `{{chave}}` manualmente), as palavras digitadas em seguida pelo usuário herdavam a formatação do `<span class="placeholder-tag">`, como se fizessem parte do placeholder. Exemplo visual do que acontecia:

```html
<!-- Inserido/convertido: -->
<span class="placeholder-tag" data-placeholder="{{numero_rep}}">{{numero_rep}}</span>

<!-- Após o usuário digitar "texto adicional", o DOM ficava: -->
<span class="placeholder-tag" data-placeholder="{{numero_rep}}">{{numero_rep}} texto adicional</span>
```

Isso corrompia tanto a exibição visual (tudo azul/estilizado) quanto a resolução do placeholder no preview (o texto extra era tratado como parte do valor do placeholder).

## Causa Raiz

Em um editor `contenteditable` (TinyMCE), quando um `<span>` inline é inserido, o cursor do navegador pode ficar **dentro** ou **na borda** do elemento. Ao começar a digitar, o browser estende naturalmente o span existente — comportamento padrão do DOM em modo de edição.

Os três pontos de criação de spans de placeholder sofriam do mesmo problema:

| Local | Gatilho | Por que falhava |
|---|---|---|
| Comando `insertPlaceholder` | Menu de contexto | `editor.insertContent(html)` insere o span e o cursor cai dentro/adjacente |
| `converterPlaceholderLocal` | Digitação manual + debounce 600ms | Bookmark restaurado após `replaceChild` podia cair dentro do span recém-criado |
| `converterPlaceholdersTextuais` | Carga do laudo salvo | Spans criados sem proteção; ao editar, cursor entrava neles |

## Solução

Adicionar `contenteditable="false"` aos `<span>` de placeholder, tornando-os **elementos atômicos não-editáveis**. Comportamento resultante:

- O cursor **não pode entrar** no span — é forçado para fora
- O usuário pode **selecionar e deletar** o placeholder inteiro com backspace/delete (TinyMCE trata `ce=false` como unidade deletável)
- O placeholder age como uma "cápsula" visual, similar a uma imagem inline
- Copiar/colar preserva o atributo (placeholder copiado mantém comportamento)

## Pontos de Alteração

### 1. Comando `insertPlaceholder` — Menu de Contexto

**Arquivo:** `src/renderer/components/editor/TinyMceEditor.tsx:~340` (comando `insertPlaceholder` no `setup()`)

```tsx
// Antes:
const html = `<span class="placeholder-tag" data-placeholder="{{${placeholder.chave}}}">{{${placeholder.chave}}}</span>`;

// Depois:
const html = `<span contenteditable="false" class="placeholder-tag" data-placeholder="{{${placeholder.chave}}}">{{${placeholder.chave}}}</span>`;
```

### 2. Auto-converter `converterPlaceholderLocal` — Digitação Manual

**Arquivo:** `src/renderer/components/editor/TinyMceEditor.tsx:677`

```tsx
// Antes:
span.className = 'placeholder-tag';
span.setAttribute('data-placeholder', `{{${s.chave}}}`);

// Depois:
span.className = 'placeholder-tag';
span.setAttribute('contenteditable', 'false');  // ← adicionado
span.setAttribute('data-placeholder', `{{${s.chave}}}`);
```

### 3. `converterPlaceholdersTextuais` — Carga de Laudo Salvo

**Arquivo:** `src/renderer/lib/utils.ts:56`

```tsx
// Antes:
span.className = 'placeholder-tag';
span.setAttribute('data-placeholder', `{{${s.chave}}}`);

// Depois:
span.className = 'placeholder-tag';
span.setAttribute('contenteditable', 'false');  // ← adicionado
span.setAttribute('data-placeholder', `{{${s.chave}}}`);
```

## Verificação de Impacto

Nenhuma funcionalidade existente é afetada negativamente:

| Funcionalidade | Arquivo | Mecanismo | Impacto |
|---|---|---|---|
| **Preview PDF** (`aplicarPlaceholders`) | `LaudosPage.tsx:206` | `querySelectorAll('span[data-placeholder]')` | Nenhum — `contenteditable` não interfere em queries DOM |
| **Extração de texto IA** | `ia.handlers.ts:63` | Regex `/<span[^>]*data-placeholder[^>]*>[\s\S]*?<\/span>/gi` | Nenhum — `[^>]*` captura qualquer atributo extra |
| **Salvar laudo** | `LaudosPage.tsx:1121` | `removerFormatacaoPlaceholders()` (no-op) + salvar HTML bruto | Atributo extra é inofensivo no HTML armazenado |
| **Carregar laudo** | `LaudosPage.tsx:1077` | `converterPlaceholdersTextuais()` pula spans com `data-placeholder` já existentes | Sem dupla-conversão |
| **Deleção (backspace)** | TinyMCE nativo | Elemento `ce=false` é tratado como unidade deletável | Funciona normalmente |
| **PDF rendering** (Puppeteer) | `template.handlers.ts:195` | CSS `.placeholder-tag` aplicado via `content_style` | Renderiza normalmente |

## Possíveis Problemas Futuros

### Upgrade do TinyMCE

Se uma versão futura do TinyMCE mudar o tratamento de `contenteditable="false"` em elementos inline:
- **Sintoma:** spans desaparecem visualmente ou são envolvidos em wrappers extras (`data-mce-cef`).
- **Diagnóstico:** inspecionar o DOM do editor e verificar se os spans `[data-placeholder]` estão intactos.
- **Mitigação:** testar com `mceNonEditable` class ou usar a API `editor.dom.addClass(span, 'mceNonEditable')` como fallback.

### Placeholder colado de fonte externa

Se o usuário colar texto de fora que contenha `contenteditable="false"` em spans maliciosos, o TinyMCE pode rejeitar ou sanitizar. Isso não deve ocorrer com placeholders normais, mas fica documentado.

### Deleção acidental difícil

Por ser não-editável caractere a caractere, o usuário precisa selecionar o span inteiro (clique único) e delete. Se houver reclamação de UX:
- Alternativa: permitir edição mas forçar escape do cursor via zero-width space `\u200B` após o span (abordagem com mais edge cases).

## Data da Implementação

2026-05-25

**Locais verificados (2026-06-17, refs atualizadas pós-adição seções condicionais):**
- `src/renderer/components/editor/TinyMceEditor.tsx:350` — `insertPlaceholder` com `contenteditable="false"`
- `src/renderer/components/editor/TinyMceEditor.tsx:677` — `converterPlaceholderLocal` com `setAttribute('contenteditable', 'false')`
- `src/renderer/lib/utils.ts:56` — `converterPlaceholdersTextuais` com `setAttribute('contenteditable', 'false')`
