# Campo reservado (XXX)

## Significado e formato

O marcador de dado pendente é `<span class="campo-reservado" data-reservado="true">XXX</span>`. Ele recebe destaque âmbar no TinyMCE e no HTML de saída. Diferente de uma chave de placeholder, o conteúdo do campo reservado é editável quando usado em templates.

## Templates

Em `TemplatesPage`, `autoConverterReservados={true}` detecta `XXX` digitado e o converte após debounce. A conversão também ocorre ao carregar ou pré-visualizar template por `converterPlaceholdersTextuais(html, chaves, true)`. O botão de template insere o mesmo formato.

A conversão é literal e case-insensitive; por isso também alcança ocorrências dentro de uma palavra. O undo nativo do TinyMCE restaura a conversão.

## Preenchimento manual no laudo

O duplo clique em `XXX` âmbar ou placeholder azul elegível pela política de edição abre o modal de personalização da ocorrência. O editor compacto aceita linhas e formatação básica; `normalizarHtmlCampo()` limita a saída a texto, quebras, negrito, itálico, sublinhado, sobrescrito e subscrito e rejeita valor vazio. O rascunho fica em referência, enquanto `initialValue` permanece fixo até fechar, evitando salto de cursor. O editor captura a tipografia computada da ocorrência e o recuo do `p` ancestral ao abrir. O menu Parágrafo só é habilitado quando há parágrafo de origem e mantém o recuo em rascunho separado; não acrescenta tags/estilos ao HTML inline permitido. Aplicar personaliza o valor e grava o recuo no parágrafo original em uma única transação de undo, marcando edição pendente; cancelar descarta os dois rascunhos. O diálogo é amplo, com conteúdo rolável e ações fixas.

`preencherCampoReservado()` grava o HTML codificado em `data-placeholder-personalizado-html`, troca o destaque por violeta e preserva `data-placeholder` quando a ocorrência veio de chave da REP. Sem chave, grava `data-placeholder-personalizado-livre`. O modal oferece **Restaurar valor da REP** apenas para ocorrência vinculada personalizada; a ação exige confirmação assíncrona, revalida a ocorrência, remove a sobreposição local e reaplica o mapa atual sem consultar GDL. A alteração nunca é enviada à REP ou ao GDL.

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

`campos-reservados.test.ts` cobre personalização, restauração e rejeição de valor vazio; `editor-campo-laudo.component.test.tsx` cobre valor inicial estável, tipografia herdada, recuo e reabertura. Os padrões de tipografia e medidas são compartilhados em `tipografia-editor-laudo.ts` e `recuo-editor-laudo.ts`, conforme `spec/03 laudo/editor_texto.md`. A interação real de duplo clique e foco do diálogo permanece sujeita a smoke manual no TinyMCE.

## Pendências estruturadas do B-601

`src/shared/utils/campo-reservado.ts` fornece `criarHtmlCampoReservado(aviso, chaveRep?)`, que escapa texto e atributos e acrescenta `data-aviso-reservado`. Quando há chave da REP, mantém `data-campo-rep-pendente`; essa chave identifica a origem da pendência, sem equivaler a um `data-placeholder` resolvido automaticamente. Tooltip, title, aria-label e `data-origem-xxx` distinguem dado ausente na REP de preenchimento manual.

Os quadros de investigação/material, lacres, origem/coleta e revisões B-601 usam esse formato em vez de texto XXX solto. Campos técnicos manuais indicam característica e unidade PQ/estojo. `apresentacao-placeholders.ts` recupera a descrição pela chave da REP ou pelo aviso persistido. A limpeza de apresentação deve preservar esses metadados de domínio. Nos seletores de Origem, Tipo e Constituição e formato do B-601 padrão, a interação específica do B-601 substitui o preenchimento por texto livre; seus controles transitórios não entram no HTML salvo ou exportado, conforme `spec/03 laudo/b601.md`.

## Edição pontual em conteúdo protegido

encontrarCampoReservado() exclui cabeçalhos, células fixas, controles transitórios e campos atendidos pelos seletores B-601. Uma âncora com chave dentro de prévia também não abre o diálogo. permiteEdicaoCampo() bloqueia somente leitura e âncoras técnicas; campos reservados ou já personalizados podem ser preenchidos pontualmente mesmo com o bloco protegido. Outros valores resolvidos dentro de blocos exigem **Editar** em todos os ancestrais protegidos.

Ao aplicar dentro de uma prévia de tabela, materializarEdicaoPontual() cria a cópia personalizada na mesma transação de undo antes de preencher o campo, conservando as outras células protegidas. O recuo só é aplicado quando o parágrafo também é elegível. A restauração revalida instância e referência após a confirmação; alvo removido, substituído ou em somente leitura não é alterado. Erros ao aplicar mantêm o rascunho disponível; o sucesso da restauração informa que ela ocorreu no rascunho.
