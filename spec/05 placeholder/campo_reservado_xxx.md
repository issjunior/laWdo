# Campo reservado (XXX)

## Significado e formato

O marcador de dado pendente é `<span class="campo-reservado" data-reservado="true">XXX</span>`. Ele recebe destaque âmbar no TinyMCE e no HTML de saída. Diferente de uma chave de placeholder, o conteúdo do campo reservado é editável quando usado em templates.

## Templates

Em `TemplatesPage`, `autoConverterReservados={true}` detecta `XXX` digitado e o converte após debounce. A conversão também ocorre ao carregar ou pré-visualizar template por `converterPlaceholdersTextuais(html, chaves, true)`. O botão de template insere o mesmo formato.

A conversão é literal e case-insensitive; por isso também alcança ocorrências dentro de uma palavra. O undo nativo do TinyMCE restaura a conversão.

## Laudos e exportação

No laudo, `XXX` também representa ausência de valor resolvido e conteúdo narrativo vazio de bloco pericial não suprimido. Nesses casos ele é produzido pelo resolvedor de exportação e pelo modo `Dados da REP`, não por conversão do texto autoral. O campo pendente não impede preview, PDF, ODT ou exportação.

A normalização anterior ao salvamento remove apenas atributos transitórios de apresentação de placeholders; preserva campos reservados que já pertençam ao conteúdo autoral. Blocos suprimidos são removidos na exportação e, portanto, não recebem `XXX`.

## Responsabilidades

| Área | Responsabilidade |
| --- | --- |
| `TinyMceEditor.tsx` | estilos e conversão opcional em templates |
| `utils.ts` | conversão textual e limpeza transitória antes do salvamento |
| `exportacao-placeholders.ts` | criação de `XXX` para valores e blocos pendentes |
| exportadores PDF/ODT | preservação do estilo e largura das tabelas |

A diferença entre `XXX` autoral e `XXX` derivado precisa ser preservada para que a limpeza de visualização não apague conteúdo do perito.
