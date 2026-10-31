# Menu de contexto e inserções do editor

## Escopo

`PlaceholderContextMenu.tsx` organiza a inserção de placeholders no TinyMCE. Ele recebe categorias e placeholders cadastrados, a estrutura do tipo de exame atual e, na edição de laudo, os campos específicos da REP usados para dimensionar grupos repetíveis. O mesmo menu é usado nas páginas de laudos e templates.

Categorias gerais permanecem disponíveis em todos os exames. Categorias cujo id começa com `cat-exam-` são filtradas: somente a correspondente a `categoriaExameId` aparece. `EXAM_MENU_REGISTRY`, em `src/renderer/components/rep/exam-fields/index.ts`, relaciona o código do exame à sua estrutura de menu; no estado atual, o B-602 possui estrutura especializada.

## Placeholders dinâmicos do B-602

`B602_MENU_STRUCTURE`, definida em `b602.tsx`, separa Dados da Investigação, Material Encaminhado, Cartuchos, Estojos e Armas. Entradas agregadas inserem diretamente uma chave conhecida. Grupos repetíveis usam um prefixo e uma lista de campos; `getGroupCount()` lê os dados B-602 da REP e cria submenus numerados somente para as ocorrências existentes.

As chaves concretas, como `{{b602_cartucho_2_calibre}}`, não precisam estar cadastradas individualmente. `placeholderChaveEhValida()` também aceita uma chave concreta quando ela corresponde a uma chave-base válida que contém `_N_`. Laudos e templates combinam as chaves carregadas do banco com `CAMPOS_ESPECIFICOS_PLACEHOLDERS` antes de entregá-las ao editor.

Na página de laudos, `LaudosPage.tsx` carrega e normaliza `campos_especificos` da REP vinculada, deriva `categoriaExameId` de `tipo_exame_codigo` e passa a estrutura e os dados ao menu. Em templates não existe REP concreta; a estrutura do exame continua disponível, mas grupos que dependem de ocorrências não são materializados.

## Blocos condicionais

`EXAM_TOGGLES` fornece os blocos disponíveis para o tipo de exame. O TinyMCE registra `condbloco` quando recebe esse contexto e insere um wrapper `.cond-bloco[data-cond-bloco]` com título quando aplicável. Para B-602, funcionamento/eficiência e coleta de padrões por arma são acrescentados em tempo de execução.

Cada bloco recebe `data-cond-badge`, `data-cond-resumo` e `data-cond-instancia`. O resumo `Mostra quando: ...` permanece como metadado interno usado para identificar a condição em ações e diagnósticos; ele não é renderizado no cartão e não é copiado para o atributo `title`. Durante a normalização, o editor recalcula badge e resumo, remove qualquer `title` legado e garante uma identidade persistente única.

Os controles transitórios de editar/concluir e excluir pertencem ao editor, não ao menu de placeholders. O comportamento de proteção, edição, exclusão persistida e limpeza para saída está documentado em `spec/03 laudo/bloco_condicional.md` e `spec/03 laudo/editor_texto.md`.

## Tabelas resolvidas

Placeholders cujo valor é uma tabela HTML continuam sendo inseridos como âncoras de placeholder. No modo de dados, o editor cria a prévia fora do `span` canônico. Somente prévias de tabela recebem o cartão âmbar e as ações de personalização/restauração; tabelas comuns inseridas pelo usuário não são afetadas. O ciclo persistente está documentado em `spec/05 placeholder/ciclo_placeholder.md`.

## Preenchimento das tabelas B-601

Na página Laudos, TinyMceEditor registra menu-preenchimento-b601.ts quando existe laudoId. O contexto do clique no iframe é consumido por PlaceholderContextMenu.tsx, que substitui o menu de placeholders somente nos campos compatíveis dos quadros descritivos de projéteis e estojos. Cabeçalhos, identificadores, origem/procedência vinculada à REP, fotografias e demais locais conservam o menu anterior. Templates e cabeçalhos não recebem esse preenchimento.

| Ação | Atalho no editor |
|---|---|
| Marcar como Prejudicado | Ctrl + Shift + P |
| Marcar como Ausente | Ctrl + Shift + A |

O menu tem título Preencher célula(s), contagem das células selecionadas e opções curtas Prejudicado/Ausente, com ícones e atalhos alinhados em etiquetas de teclado. As duas opções ficam desabilitadas e o menu informa indisponibilidade quando a seleção não permite o preenchimento. A apresentação usa os componentes locais e tokens do tema.

Os atalhos também aparecem no grupo Tabelas B601 de AtalhosLaudoDialog, aberto pelo menu flutuante de Laudos. Atuam no editor em foco, no modo único ou por seções, e ficam suspensos enquanto há diálogo ou confirmação na página.

O clique aplica à célula apontada; se ela pertence à seleção múltipla de células, aplica à seleção inteira. Pelo teclado, um clique simples identifica a célula para os atalhos mesmo quando o conteúdo protegido não recebe o cursor do TinyMCE; selecionar o texto não é necessário. Sem referência de clique, usa a célula do foco/cursor e sua seleção. Essa referência fica apenas em memória por editor e é descartada ao clicar fora, navegar por teclado, trocar o modo ou recarregar/desfazer/refazer o conteúdo; alvos removidos não são reutilizados. Os rótulos do menu indicam quando há várias células. Uma célula incompatível ou sem permissão desabilita a operação inteira. A execução revalida presença, identidade do campo, valor capturado, modo e permissões, sem redirecionar a outro alvo se o contexto ficar obsoleto.

A operação aceita apenas Prejudicado ou Ausente, substitui os valores locais em uma transação de undo e não gera alteração quando todos já contêm o valor solicitado. Campos manuais usam preencherCampoReservado; seletores com texto livre seguem seu evento de alteração, preservando identidade e controles. A elegibilidade e as exceções de proteção seguem [B-601](b601.md). O foco retorna somente ao fechar o menu, inclusive no cancelamento, com editor.focus({ scrollToSelection: false }); o atalho restaura o foco após aplicar. Abertura/fechamento não preenchem campos nem representam salvamento.

## Extensão para outros exames

Um novo tipo de exame deve declarar sua `MenuSection[]`, registrá-la em `EXAM_MENU_REGISTRY` e fornecer somente os placeholders agregados ou escalares que precisam existir no catálogo. A lógica dinâmica deve permanecer nos metadados do exame e nos helpers da própria feature, sem acoplar o menu a formatos brutos do processo principal.

A inserção só altera o HTML local do editor. Ela não cria nem modifica dados na REP ou no GDL.

## Inserção de figuras em laudos

A toolbar do laudo oferece **Inserir figura** na seleção capturada, usando o seletor do Painel de Ilustrações. Esse comando não é a inserção do painel ao final da seção ILUSTRAÇÕES. Instância e bookmark são revalidados antes de escrever; se o alvo deixou de existir, a operação falha sem escolher outro destino. O fluxo está em `spec/03 laudo/fluxo_ilustracao.md`.
