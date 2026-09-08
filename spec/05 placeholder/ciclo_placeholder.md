# Ciclo atual de placeholders

## Fonte canônica e resolução

O HTML salvo usa a chave canônica em `data-placeholder`, por exemplo `{{b602_arma_1_marca}}`. A resolução de valores na edição, IA e exportação parte da REP. Para B-602, a única adaptação dos dados persistidos é `projetarB602ParaLaudo()`, que prioriza `b602.pecas` e aceita arrays legados apenas na leitura.

`construirMapaPlaceholdersResolvidos()` descreve cada chave com valor, `preenchido` e formato `texto`/`html`/`html-inline`. O resumo de lacres de saída B-602 usa `html-inline` para combinar valores da REP com campos `XXX` reservados sem serializar a apresentação. O mapa evita que cada consumidor implemente seu próprio critério de ausência ou HTML estrutural.

## Visualização no editor

Ao abrir um laudo, a visualização padrão é `Dados da REP`; o usuário pode alternar para `Placeholders`. A troca é somente de apresentação, vale para editores único e por seção e não é persistida nem deve criar alteração de conteúdo ou entrada de undo.

No modo de dados, placeholder textual preenchido exibe o valor mantendo a âncora não editável. Valor ausente exibe `XXX` destacado. Para valor HTML, a âncora canônica é ocultada e a prévia é inserida como elemento irmão identificado por `data-placeholder-preview`; tabelas não são inseridas dentro do `span` da chave. No formato `html-inline`, a âncora recebe somente o fragmento resolvido; isso preserva campos reservados dentro de uma frase, como os lacres de saída B-602. No modo de chaves, a prévia é removida e a âncora volta a mostrar a chave.

## Tabelas editáveis no laudo

Uma prévia HTML que contém tabela recebe `data-placeholder-preview-tabela="true"`, células protegidas e a ação transitória **Personalizar tabela**. A apresentação usa fundo e borda âmbar, selo **Tabela do placeholder** e controles no mesmo padrão dos blocos condicionais; tabelas comuns inseridas pelo usuário não recebem esse tratamento.

Personalizar transforma a prévia em cópia local com `data-placeholder-tabela-personalizada="true"` e identidade compartilhada com a âncora canônica. Cabeçalhos e células fixas continuam não editáveis; células de valor ficam editáveis. A ação muda para **Restaurar dados da REP**, que remove a cópia e volta a resolver a tabela a partir da REP.

A cópia personalizada pertence somente ao laudo e nunca altera REP ou GDL. No modo de chaves ela é ocultada e a âncora reaparece; no modo de dados ocorre o inverso. Undo envolve personalização e restauração. Salvamento preserva a cópia e o vínculo, removendo `contenteditable` e controles; exportação e contexto da IA removem a âncora duplicada e usam o conteúdo local da tabela.

## Normalização e fronteiras

Antes de salvar, `removerFormatacaoPlaceholders()` remove prévias, controles transitórios e atributos de apresentação, restaura o texto da âncora a partir de `data-placeholder` e preserva o marcador persistido de supressão de bloco. Portanto, valores reais e HTML de prévia nunca devem substituir o contrato salvo.

A exportação também remove resíduos transitórios e resolve novamente a partir da REP. Dados externos desconhecidos, inclusive campos GDL sem placeholder definido, permanecem preservados na peça, mas não viram HTML arbitrário.

## Verificação

Testes de utilitários, placeholders pendentes e exportação B-602 cobrem normalização, chaves indexadas, valores ausentes, prévias HTML e resolução de tabelas.
