# Encapsulamento de placeholders

## Âncora canônica e proteção

Placeholders usam uma âncora como `<span contenteditable="false" class="placeholder-tag" data-placeholder="{{numero_rep}}">{{numero_rep}}</span>`. `contenteditable="false"` impede que a digitação adjacente entre no span e herde sua formatação; seleção e exclusão operam sobre a ocorrência inteira. A chave em `data-placeholder` é a identidade de resolução, independentemente do texto visível.

`TinyMceEditor.tsx` cria a proteção no comando `insertPlaceholder` e em `converterPlaceholderLocal`, que converte chaves digitadas com debounce de 600 ms. `converterPlaceholdersTextuais()` em `src/renderer/lib/utils.ts` trata a carga de HTML e não cria outra âncora sobre uma ocorrência já identificada. A conversão deve preservar seleção e evitar spans aninhados.

## Visualização e personalização por ocorrência

No modo **Dados da REP**, valores textuais continuam na âncora não editável. HTML estrutural usa uma prévia irmã com `data-placeholder-preview`; uma tabela não deve ser inserida dentro do span da chave. O modo **Placeholders** volta a mostrar as chaves e remove a apresentação derivada.

O duplo clique em placeholder azul ou `XXX` âmbar abre `EditorCampoLaudo`. A alteração é aplicada por `campos-reservados.ts`, com normalização do HTML inline permitido e transação de undo. O valor local fica codificado em `data-placeholder-personalizado-html`, preservando a chave quando vinculada à REP. Essa personalização não libera digitação direta na âncora e não altera a REP ou o GDL.

A personalização prevalece nas resoluções até **Restaurar valor da REP** remover o atributo local e reaplicar o mapa já disponível. Tabelas personalizadas têm uma cópia estrutural própria vinculada à âncora; não confundir esse fluxo com o modal de texto. Os formatos e regras completos estão em `spec/05 placeholder/ciclo_placeholder.md` e `spec/05 placeholder/campo_reservado_xxx.md`.

## Persistência e consumidores

`removerFormatacaoPlaceholders()` não é um no-op. Antes de salvar, remove prévias derivadas, controles de edição, tooltips e atributos transitórios. Para âncoras sem personalização textual, restaura o texto da chave; para as personalizadas, preserva o atributo local e o conteúdo correspondente. A âncora de uma tabela personalizada permanece vinculada e oculta. Não remover indiscriminadamente atributos `data-placeholder-*`: parte deles representa conteúdo autoral persistido.

`apresentacao-placeholders.ts` recompõe a visualização a partir do mapa local; `exportacao-placeholders.ts` resolve a saída e remove elementos exclusivos da edição. `ia-contexto.ts` respeita o valor personalizado por ocorrência. Uma mudança no encapsulamento deve preservar esses três consumidores e a comparação de pendências.

PDF e prévia usam o Chromium do Electron por `gerarPdfPreparado()`, compartilhado por `exportacao.service.ts` e `template.handlers.ts`. A impressão recebe o HTML de saída resolvido, não depende do CSS do iframe de edição nem usa Puppeteer. Recursos, margens e falhas estão em `spec/03 laudo/visualizar_pdf.md` e `spec/03 laudo/exportar_laudo.md`.

## Invariantes e verificação

- Preservar a chave canônica ao alternar apresentação, salvar, reabrir ou personalizar uma ocorrência vinculada.
- Não gravar a prévia derivada como substituta da âncora nem apagar personalizações ao limpar a apresentação.
- Manter a digitação adjacente fora do span; testar seleção, exclusão e cópia/cola quando alterar o editor.
- Validar e normalizar conteúdo personalizado antes de reinseri-lo no DOM ou consumi-lo na saída.

`campos-reservados.test.ts` cobre personalização, restauração e rejeição de vazio; `exportacao-placeholders.test.ts` e `ia-contexto.test.ts` cobrem precedência do valor local. Os testes simulados não comprovam seleção e cópia/cola no TinyMCE real; mudanças no comportamento de `contenteditable` exigem verificação no iframe Electron.
