# Campo reservado (XXX)

## Significado e formato

O marcador de dado pendente é `<span class="campo-reservado" data-reservado="true">XXX</span>`. Ele recebe destaque âmbar no TinyMCE e no HTML de saída. Diferente de uma chave de placeholder, o conteúdo do campo reservado é editável quando usado em templates.

## Templates

Em `TemplatesPage`, `autoConverterReservados={true}` detecta `XXX` digitado e o converte após debounce. A conversão também ocorre ao carregar ou pré-visualizar template por `converterPlaceholdersTextuais(html, chaves, true)`. O botão de template insere o mesmo formato.

A conversão é literal e case-insensitive; por isso também alcança ocorrências dentro de uma palavra. O undo nativo do TinyMCE restaura a conversão.

## Preenchimento manual no laudo

O duplo clique em `XXX` âmbar ou placeholder azul abre o modal de personalização da ocorrência. O editor compacto aceita linhas e formatação básica; `normalizarHtmlCampo()` limita a saída a texto, quebras, negrito, itálico, sublinhado, sobrescrito e subscrito e rejeita valor vazio. O rascunho fica em referência, enquanto `initialValue` permanece fixo até fechar, evitando salto de cursor. Aplicar usa transação de undo e marca a edição pendente; cancelar não altera o HTML.

`preencherCampoReservado()` grava o HTML codificado em `data-placeholder-personalizado-html`, troca o destaque por violeta e preserva `data-placeholder` quando a ocorrência veio de chave da REP. Sem chave, grava `data-placeholder-personalizado-livre`. O modal oferece **Restaurar valor da REP** apenas para ocorrência vinculada personalizada; a ação remove a sobreposição local e reaplica o mapa atual sem consultar GDL. A alteração nunca é enviada à REP ou ao GDL.

## Laudos e exportação

No laudo, `XXX` também representa ausência de valor resolvido e conteúdo narrativo vazio de bloco pericial não suprimido. Nesses casos ele é produzido pelo resolvedor de exportação e pelo modo `Dados da REP`, não por conversão do texto autoral. O campo pendente não impede preview, PDF, ODT ou exportação.

A normalização anterior ao salvamento remove apenas atributos transitórios de apresentação de placeholders; preserva campos reservados que já pertençam ao conteúdo autoral. Um campo preenchido manualmente deixa de ser pendência; se havia chave de placeholder, ela continua no HTML canônico junto ao valor local codificado. Blocos suprimidos são removidos na exportação e, portanto, não recebem `XXX`.

## Responsabilidades

| Área | Responsabilidade |
| --- | --- |
| `TinyMceEditor.tsx` | estilos, conversão opcional em templates e detecção do duplo clique no iframe |
| `campos-reservados.ts` e `EditorCampoLaudo.tsx` | identificam a ocorrência, normalizam o HTML permitido e mantêm o valor inicial estável |
| `LaudosPage.tsx` | diálogo shadcn, referência temporária ao campo, undo e sincronização do HTML |
| `utils.ts` | conversão textual e limpeza transitória antes do salvamento |
| `exportacao-placeholders.ts` | criação de `XXX` para valores e blocos pendentes |
| exportadores PDF/ODT | preservação do estilo e largura das tabelas |

A diferença entre `XXX` autoral e `XXX` derivado precisa ser preservada para que a limpeza de visualização não apague conteúdo do perito. Uma substituição manual deliberadamente elimina essa diferença apenas para a ocorrência preenchida.

## Verificação

`campos-reservados.test.ts` cobre personalização, restauração e rejeição de valor vazio; `editor-campo-laudo.component.test.tsx` cobre a estabilidade do valor inicial ao digitar e reabrir. A interação real de duplo clique e foco do diálogo permanece sujeita a smoke manual no TinyMCE.
