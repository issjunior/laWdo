# Editor de texto compartilhado

## Fonte de verdade e usos

`src/renderer/components/editor/TinyMceEditor.tsx` concentra a configuração e os comandos comuns do TinyMCE usados na edição de laudo, templates, cabeçalhos e importação. A toolbar-base é única; `condbloco` e `suprimirblocopericial` só são acrescentados quando `condToggles` fornece contexto.

O componente oferece dois contratos de conteúdo:

- `value` mantém o editor controlado pelo estado React.
- `initialValue` captura o HTML somente na montagem e evita que a normalização interna do TinyMCE reposicione o cursor em documentos com seções e atributos estruturais. Atualizações programáticas nesse modo devem usar a instância do editor.

## Configuração de edição

A toolbar usa `wrap` e agrupa histórico, formato de bloco, estilo de texto, fonte/cores, alinhamento/listas, recuos/entrelinha, inserção e comandos de revisão. A lista de plugins é estática; `autoresize` entra apenas quando `alturaAutomatica` está ativo. Não há menu "Mais ferramentas": os controles avançados disponíveis ficam nos grupos da toolbar.

O menu `Formatação` aplica parágrafo, títulos 1–6 ou pré-formatado. O menu `Parágrafo` aplica recuo da primeira linha somente em `p`, com 1 cm (`28.35pt`), 1,25 cm (`35.43pt`), 1,5 cm (`42.52pt`) ou remoção da propriedade. A alteração ocorre em uma transação do undo manager; o estado dos itens acompanha a seleção. Títulos, listas, células e outros blocos não recebem esse formato.

## Quebra de página e tema

O botão `pagebreak` grava o marcador canônico definido em `@shared/utils/quebra-pagina`:

```html
<div data-quebra-pagina="true" style="break-after: page;"></div>
```

O editor ainda aceita o comentário legado `<!-- pagebreak -->` por meio da normalização compartilhada usada na exportação. O marcador recebe contraste próprio nos temas claro e escuro; o tema do conteúdo observa `body.dark` e troca a skin sem remontar o editor.

Em tela cheia, quando `repNumero` existe, uma identificação `Laudo · REP <número>` é inserida fora da área editável e removida ao sair. Ela não integra o HTML do laudo.

## Extensões preservadas

Além da configuração textual, o componente preserva comandos específicos para placeholders, figuras e blocos condicionais. Imagens soltas são convertidas em `figure.laudo-figure`, exceto o indicador interno de quebra de página; ações que alteram várias imagens usam transação de undo.

## Relações e verificação

Mudanças em recuo ou quebra devem ser coordenadas com `src/renderer/lib/exportacao-parser.ts`, `src/shared/types/exportacao.types.ts`, `src/shared/utils/quebra-pagina.ts` e `src/main/services/exportacao.service.ts`, pois o editor apenas produz HTML e a exportação preserva a semântica nos formatos finais.

`src/__tests__/renderer/tiny-mce-editor-config.test.ts` cobre catálogo, toolbar, medidas e identificação em tela cheia. O teste é unitário de configuração; interação real do TinyMCE, seleção múltipla e alternância visual de tema dependem de smoke manual.
