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

## Extensão para outros exames

Um novo tipo de exame deve declarar sua `MenuSection[]`, registrá-la em `EXAM_MENU_REGISTRY` e fornecer somente os placeholders agregados ou escalares que precisam existir no catálogo. A lógica dinâmica deve permanecer nos metadados do exame e nos helpers da própria feature, sem acoplar o menu a formatos brutos do processo principal.

A inserção só altera o HTML local do editor. Ela não cria nem modifica dados na REP ou no GDL.
