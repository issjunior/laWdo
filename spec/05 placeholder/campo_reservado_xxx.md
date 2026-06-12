# Campo Reservado (XXX)

## Visão geral

O perito pode usar o marcador "XXX" em templates de laudo para indicar campos que precisam ser preenchidos com informação real posteriormente. O sistema reconhece automaticamente "XXX" digitado no editor e aplica formatação visual âmbar para destacar o campo pendente — tanto no editor quanto na pré-visualização PDF.

A funcionalidade é exclusiva do contexto de edição de templates (`TemplatesPage`), não afetando laudos ou cabeçalhos.

## Funcionamento

### Auto-conversão ao digitar

Quando `autoConverterReservados={true}` no `TinyMceEditor`, um listener de `input` com debounce de 600ms detecta a substring "XXX" (case insensitive) no nó de texto sob o cursor e o substitui por:

```html
<span class="campo-reservado" data-reservado="true">XXX</span>
```

Diferentemente dos placeholders (`contenteditable="false"`), o campo reservado permanece editável (`contenteditable` não setado, herdando `true` do editor). O perito pode simplesmente selecionar "XXX" e digitar o valor real por cima. `Ctrl+Z` desfaz a conversão via undo stack nativo do TinyMCE.

A conversão é literal (sem word boundaries) — qualquer ocorrência da substring "XXX" é convertida, inclusive em palavras como "XXX-2026".

### Inserção via botão

Na toolbar de seções do template, um botão com ícone `Baseline` (agrupado junto ao botão de ilustração) insere diretamente no editor ativo:

```html
<span class="campo-reservado" data-reservado="true">XXX</span>&nbsp;
```

### Carregamento de templates

Ao abrir um template para edição ou ao gerar pré-visualização via datatable (`handlePreviewCard`), a função `converterPlaceholdersTextuais(html, chavesValidas, true)` varre o conteúdo em busca de "XXX" texto puro e aplica o span estilizado. O terceiro parâmetro `true` ativa essa conversão adicional.

### Renderização no PDF

O handler `template.handlers.ts` injeta um bloco `<style>` no HTML antes de renderizar o PDF via `printToPDF` do Electron. As regras CSS incluem:

| Classe | Estilo |
|--------|--------|
| `.placeholder-tag` | Fundo `#e8f0fe`, texto `#1a73e8`, padding 2px 6px, border-radius 4px |
| `.campo-reservado` | Fundo `rgba(255,193,7,0.2)`, texto `#b45309`, borda inferior `2px dotted #f59e0b`, padding 2px 6px, border-radius 4px |

## Arquivos envolvidos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `src/renderer/components/editor/TinyMceEditor.tsx` | Prop `autoConverterReservados`, CSS `.campo-reservado` no `content_style`, listener de `input` com `converterReservadoLocal` |
| `src/renderer/lib/utils.ts` | `converterPlaceholdersTextuais(html, chaves, converterReservados)` — terceiro parâmetro opcional ativa varredura de "XXX" |
| `src/renderer/pages/TemplatesPage.tsx` | `autoConverterReservados={true}` nos 2 editores, `converterPlaceholdersTextuais(..., true)` em 6 pontos (carregamento + `handlePreviewCard`), função `inserirReservadoNoEditor`, botão `Baseline` na toolbar |
| `src/main/ipc/handlers/template.handlers.ts` | Regra CSS `.campo-reservado` no `<style>` do PDF de preview |

## Decisões de design

- **Editável vs atômico**: campo reservado é `contenteditable=true` (seleciona e digita por cima), diferentemente dos placeholders que são atômicos (`contenteditable=false`)
- **Escopo restrito**: apenas templates (`autoConverterReservados={true}`), não laudos ou cabeçalho — evita conversões indesejadas de "XXX" em contextos onde pode ser parte legítima de números de documento ou códigos
- **Estilo âmbar**: fundo amarelo + borda pontilhada comunica "atenção / campo a preencher", distinguindo visualmente dos placeholders azuis do sistema
- **Desfazer**: `Ctrl+Z` reverte a conversão naturalmente, pois o `replaceChild` no text node é capturado pelo undo stack do TinyMCE
- **Case insensitive**: "XXX", "xxx", "Xxx" — todos convertem, preservando o case original no texto do span
