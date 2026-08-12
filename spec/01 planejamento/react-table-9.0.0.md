# Plano — migração para TanStack React Table 9.0.0 (PR #106)

## Objetivo

Concluir com segurança o PR [#106](https://github.com/issjunior/laWdo/pull/106), que atualiza `@tanstack/react-table` de 8.21.3 para 9.0.0 estável. A migração preserva o comportamento e a interface visual das tabelas existentes, sem usar a camada temporária e deprecated `useLegacyTable`.

## Documentação obrigatória

Durante a implementação e a revisão, seguir estas fontes oficiais da TanStack Table v9 como referência normativa; não inferir APIs pela versão v8 nem por exemplos de versões beta.

1. [Features Guide](https://tanstack.com/table/latest/docs/guide/features) — referência principal para selecionar recursos, suas pré-condições, row models e funções registradas, mantendo tree-shaking e evitando habilitar APIs não usadas pelo laWdo.
2. [Migrating to TanStack Table V9 (React)](https://tanstack.com/table/latest/docs/framework/react/guide/migrating) — referência para alterações incompatíveis da React adapter, estado, tipos, métodos de instância e renderização.
3. Para uma API de recurso específico usada durante a migração, consultar o respectivo guia oficial vinculado por essas duas páginas antes de implementá-la; a documentação atual prevalece sobre este plano se houver divergência.

## Preparação do PR

1. Comentar `@dependabot rebase` no PR #106 para atualizá-lo contra a `main` atual.
2. Confirmar que o novo diff contém apenas `@tanstack/react-table` 9.0.0 e suas dependências transitivas no `package-lock.json`.
3. Se o bot não puder rebasear, comentar `@dependabot recreate`; não fechar o PR apenas por estar defasado e não usar force-push.
4. Adicionar a migração em commits coesos, em português, sobre a branch atualizada do PR #106.

## Implementação da v9

1. Em `DataTable`, substituir `useReactTable` por `useTable` e declarar um único objeto estável de recursos, fora do componente, com `tableFeatures()`.
   - Registrar somente as capacidades efetivamente usadas: `columnFilteringFeature`, `globalFilteringFeature`, `columnVisibilityFeature`, `rowSortingFeature`, `rowPaginationFeature`, `rowPinningFeature` e `rowSelectionFeature`.
   - `rowSelectionFeature` é necessário porque a renderização atual consulta `row.getIsSelected()`, mesmo sem uma interface de seleção.
   - Não registrar recursos sem uso: agrupamento, agregação, faceting, expansão, ordenação/fixação/redimensionamento de colunas, seleção de células ou virtualização.
2. Registrar no mesmo `tableFeatures()` os processamentos executados no cliente: `createFilteredRowModel()`, `createSortedRowModel()` e `createPaginatedRowModel()`.
   - Não migrar `getCoreRowModel()`: na v9 o core já é incluído automaticamente.
   - Manter a paginação, ordenação e filtragem no cliente; não habilitar opções `manual*`.
3. Substituir registries completos de filtros e ordenações por funções individuais, mantendo tree-shaking.
   - Não depender da string implícita `"auto"`; registrar e referenciar explicitamente a função de filtro global e as funções de ordenação necessárias às colunas existentes.
   - Auditar `sortingFn` e migrá-lo para `sortFn` se houver uso nas definições de coluna.
   - Validar a busca em textos, números, datas e campos calculados para preservar o resultado funcional anterior.
4. Preservar o estado controlado com React (`state` e os handlers `on[State]Change` específicos), padrão ainda compatível com a v9.
   - Não introduzir atoms, `table.Subscribe` ou `createTableHook` nesta mudança; são otimizações opcionais e não necessárias para compatibilidade.
   - Trocar leituras de `table.getState()` por `table.state` no componente de paginação.
   - Manter `initialColumnVisibility`, ordenação inicial, filtro global, filtros de coluna, visibilidade e fixação de linhas.
5. Manter `flexRender`, que segue suportado pela v9; a adoção de `<table.FlexRender />` não é necessária.
   - Auditar usos de métodos de `row`, `cell`, `column` e `header`: chamá-los sempre a partir da instância e não desestruturá-los nem passá-los como callbacks soltos, pois dependem de `this` na v9.
   - Manter a separação de linhas fixadas em topo, centro e rodapé e `enableRowPinning` quando a prop estiver habilitada.
6. Centralizar os tipos da v9 junto da configuração de recursos.
   - Tipar definições e instâncias com `typeof recursosTabela`, por exemplo `ColumnDef<typeof recursosTabela, TData, TValue>` e `Table<typeof recursosTabela, TData>`.
   - Adaptar `DataTablePagination` e `DataTableColumnHeader` a esses tipos locais; as páginas não devem expor genéricos crus da v9.
   - Atualizar Placeholders, REPs, Solicitantes, Templates, Tipos de Exame, Wizards, Logs, Laudos e Peças para o tipo compartilhado de coluna, preservando células, cabeçalhos, ações e ordenações padrão.
   - Declarar `id` estável para toda coluna calculada que não tenha `accessorKey`.

## Testes e validação

1. Atualizar os testes de `DataTableColumnHeader` para os tipos v9 e manter os cenários de ordenação crescente, decrescente, ocultação e coluna não ordenável.
2. Criar testes de comportamento do `DataTable` para confirmar:
   - busca global e contagem filtrada;
   - busca em valores textuais, numéricos e calculados;
   - ordenação e sequência de linhas exibidas;
   - ocultar e restaurar colunas;
   - paginação, mudança de tamanho de página e navegação;
   - fixar e desafixar linhas, nas regiões superior e inferior;
   - renderização sem regressão quando a tabela não usa fixação de linhas.
3. Executar os testes existentes das páginas consumidoras e corrigir apenas incompatibilidades da v9, sem testes de detalhes internos.
4. Rodar `npm run type-check`, `npm run lint`, `npm test`, `npm run test:coverage` e `npm run pack`.
5. Fazer smoke test no Windows nas principais telas de tabela: carregamento, busca, ordenação, paginação, visibilidade de colunas, ações por linha e abertura normal do aplicativo.

## Critérios para integração

1. O PR #106 está atualizado contra a `main`, com CI verde e todas as validações concluídas com sucesso.
2. A cobertura global continua atendendo aos thresholds vigentes, sem exclusões de produção ou testes sem assertiva funcional.
3. Registrar no PR o resumo da migração, as funções/recursos v9 selecionados, os resultados das validações e do smoke test.
4. Integrar por **Create a merge commit**; então atualizar a `main` local e confirmar a árvore de trabalho limpa.

## Referências verificadas

- [Migrating to TanStack Table V9 (React)](https://tanstack.com/table/latest/docs/framework/react/guide/migrating)
- [TanStack Table — Features Guide](https://tanstack.com/table/latest/docs/guide/features)

## Premissas

- A versão 9.0.0 é estável; o escopo não inclui versões beta ou pré-release.
- A `main` usa Node 24 e React 19, compatíveis com a dependência atualizada.
- O PR #106 é o veículo da mudança, preservando a rastreabilidade e evitando esperar um novo ciclo mensal do Dependabot.
