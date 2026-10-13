# Gestão de tipos de exame

## Fonte de verdade e responsabilidades

O cadastro persistido fica na tabela SQLite `tipos_exame`. `TiposExamePage.tsx` mantém apenas a projeção da lista, os totais e o rascunho de criação/edição; não é a configuração dos campos específicos de cada exame, descrita em `spec/02 rep/criar_input_personalizados_exame.md`.

| Responsabilidade | Fonte |
|---|---|
| Página, filtro, totais e recuperação | `src/renderer/pages/TiposExamePage.tsx` |
| Campos do formulário | `src/renderer/components/tipos-exame/TipoExameFormFields.tsx` |
| Tipos do renderer | `src/renderer/lib/validators/tipo-exame.schema.ts` |
| Wrappers, allowlist e contrato IPC | `src/preload/index.ts`, `src/preload/types.ts` |
| Handlers e sanitização | `src/main/ipc/handlers/tipo-exame.handlers.ts` |
| Consultas e CRUD | `src/main/services/tipo-exame.service.ts`, derivado de `BaseService` |

## Lista, totais e filtro

Na abertura, a página dispara uma consulta da lista e outra dos totais. A lista usa `tipoExame.findAll()` por padrão: o handler delega a `findAllOrdered()`, que consulta apenas `ativo = 1`, ordenado por nome. **Mostrar todos** usa `findAllSemFiltroStatus()`, também ordenado por nome. Os totais sempre vêm da consulta sem filtro de status; alternar o filtro da lista não refaz os totais.

Lista e totais têm sequências de requisição próprias. Só a resposta da sequência mais recente pode atualizar o estado; trocar o filtro ou desmontar a página invalida a sequência anterior. Isso descarta respostas tardias, mas não cancela o IPC já iniciado. A referência do filtro é consultada no início de cada recarga, inclusive após uma alteração do cadastro.

Os cards derivam total, ativos e inativos de `todosTipos`; `null` significa indisponível ou ainda não carregado, e os valores aparecem como `—`. Lista vazia e falha de carregamento são estados distintos.

## Falhas e fronteira IPC

Lista e totais mantêm erros independentes. Falha dos totais limpa sua projeção para `null`, mostra **Totais indisponíveis** e oferece **Tentar novamente** sem esconder uma lista válida. Falha da lista mostra o erro no lugar da tabela e permite repetir somente essa consulta; os dados anteriores podem continuar na memória, mas não são exibidos como resultado atual.

As respostas de consulta exigem `success` e `Array.isArray(data)`; falha declarada, rejeição ou payload sem array entram na recuperação. Essa checagem não valida individualmente cada registro: a interface ainda depende do formato entregue pelo serviço e pelo contrato IPC. Não tratá-la como validação completa de dados desconhecidos.

## Criação, edição e status

O formulário trabalha com código, nome e descrição. Antes de criar ou editar, a página exige código e nome não vazios após `trim()`. O main sanitiza os campos; a validação atual não usa um schema completo de payload no handler. `toggleStatus` alterna o indicador ativo; excluir pede confirmação na página e usa o CRUD do serviço.

Após criação, edição, exclusão ou alternância de status bem-sucedida, lista e totais são recarregados em paralelo com `Promise.all`. A escrita já ocorreu antes dessas consultas; falha de recarga não desfaz o cadastro. Como cada carregador trata sua própria falha, a mensagem de sucesso da operação pode coexistir com um erro de lista ou totais. As duas leituras não formam snapshot transacional e podem refletir momentos próximos em caso de escrita concorrente.

Ativos e inativos pertencem ao mesmo cadastro; desativar não exclui o tipo. O catálogo de templates integrados também depende desse estado: tipo inativo torna seu template indisponível para novos laudos, conforme `spec/03 laudo/templates_integrados.md`. Alterar o cadastro não registra automaticamente seções ou campos específicos no renderer.

## Custo e verificação

As consultas carregam coleções inteiras; contagens e filtros de status dos cards são calculados no renderer. Quando a lista inclui inativos, lista e totais fazem leituras completas separadas. Preservar independência de erros, descarte de respostas antigas e recarga conforme o filtro ao alterar esse fluxo.

`src/__tests__/renderer/tipos-exame-page.component.test.tsx` cobre uma chamada por consulta na abertura, resposta atrasada de filtro anterior, totais indisponíveis com nova tentativa e recuperação da lista. A tabela e o IPC são simulados; esses testes não comprovam persistência SQLite nem todo o CRUD.
