# Campo reservado (XXX)

## Significado e formato

O marcador de dado pendente é `<span class="campo-reservado" data-reservado="true">XXX</span>`. Ele recebe destaque âmbar no TinyMCE e no HTML de saída. Diferente de uma chave de placeholder, o conteúdo do campo reservado é editável quando usado em templates.

## Templates

Em `TemplatesPage`, `autoConverterReservados={true}` detecta `XXX` digitado e o converte após debounce. A conversão também ocorre ao carregar ou pré-visualizar template por `converterPlaceholdersTextuais(html, chaves, true)`. O botão de template insere o mesmo formato.

A conversão é literal e case-insensitive; por isso também alcança ocorrências dentro de uma palavra. O undo nativo do TinyMCE restaura a conversão.

## Preenchimento manual no laudo

No editor de laudos, o duplo clique em um campo âmbar cujo texto ainda é exatamente `XXX` abre o diálogo de preenchimento manual. O diálogo aceita texto simples não vazio, aplica-o somente à ocorrência selecionada dentro de uma transação de undo e registra alteração pendente no editor único ou por seções. Cancelar ou fechar o diálogo não altera o HTML; se o editor ou o elemento deixar de existir antes da confirmação, o valor não é aplicado.

O preenchimento remove o destaque e os metadados de campo reservado. Quando o `XXX` veio de um placeholder sem valor na REP, também remove `data-placeholder` e seus atributos de apresentação: a escolha passa a ser texto local persistido no laudo e não pode ser sobrescrita por uma nova resolução visual dos dados da REP. Esse fluxo nunca altera REP ou GDL.

## Laudos e exportação

No laudo, `XXX` também representa ausência de valor resolvido e conteúdo narrativo vazio de bloco pericial não suprimido. Nesses casos ele é produzido pelo resolvedor de exportação e pelo modo `Dados da REP`, não por conversão do texto autoral. O campo pendente não impede preview, PDF, ODT ou exportação.

A normalização anterior ao salvamento remove apenas atributos transitórios de apresentação de placeholders; preserva campos reservados que já pertençam ao conteúdo autoral. Um campo preenchido manualmente já não possui marcador nem vínculo de placeholder e é preservado como texto literal. Blocos suprimidos são removidos na exportação e, portanto, não recebem `XXX`.

## Responsabilidades

| Área | Responsabilidade |
| --- | --- |
| `TinyMceEditor.tsx` | estilos, conversão opcional em templates e detecção do duplo clique no iframe |
| `campos-reservados.ts` | identifica o marcador elegível e normaliza a substituição local |
| `LaudosPage.tsx` | diálogo shadcn, referência temporária ao campo, undo e sincronização do HTML |
| `utils.ts` | conversão textual e limpeza transitória antes do salvamento |
| `exportacao-placeholders.ts` | criação de `XXX` para valores e blocos pendentes |
| exportadores PDF/ODT | preservação do estilo e largura das tabelas |

A diferença entre `XXX` autoral e `XXX` derivado precisa ser preservada para que a limpeza de visualização não apague conteúdo do perito. Uma substituição manual deliberadamente elimina essa diferença apenas para a ocorrência preenchida.

## Verificação

`campos-reservados.test.ts` cobre identificação exclusiva do `XXX` âmbar, substituição autoral, desligamento de placeholder pendente e rejeição de valor vazio. A interação real de duplo clique e foco do diálogo permanece sujeita a smoke manual no TinyMCE.
