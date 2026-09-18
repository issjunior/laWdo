# Preview PDF e HTML do laudo

## Origem e cabeçalhos

O preview e a exportação partem de `laudos.conteudo`; antes da geração, placeholders e tabelas são resolvidos com os dados atuais da REP. A depuração deve seguir conteúdo salvo, HTML resolvido e conversão final para PDF/ODT. A prévia visual do editor não é fonte da saída.

`cabecalho_laudo` é inserido no corpo da primeira página e `cabecalho_paginas` torna-se `headerTemplate` do Chromium. `buildPdfHeaderConfig()` lê ambos; `buildHeaderTemplate()` remove wrappers de placeholder, converte `{{pagina}}`/`{{totalPaginas}}` nas classes nativas e substitui valores como o número da REP. Os padrões ficam em `src/shared/configuracoes/cabecalhos-padrao.ts`; migrations v35 e v36 os inserem com `INSERT OR IGNORE`.

## Margens e paginação

`getMargens()` sempre devolve margens válidas: configuração persistida normalizada ou o padrão `{ top: 2.5, right: 2, bottom: 2.5, left: 3 }` em centímetros. Para PDF, `exportacao.service.ts` e `template.handlers.ts` usam as mesmas margens efetivas. Quando existe cabeçalho de páginas, a margem superior é no mínimo 2,5 cm, mesmo se uma configuração menor chegar à camada de impressão. O `headerTemplate` é encaminhado explicitamente na exportação do laudo; assim o cálculo não depende do cabeçalho exclusivo da primeira página.

O HTML de impressão não introduz padding lateral alternativo: as margens de impressão definem a área útil e o documento usa os valores efetivos. Tabelas têm largura máxima de 100%, `thead` como `table-header-group` e `tr` com `break-inside: avoid`. Em continuação de tabela, o cabeçalho da página e o cabeçalho da tabela ficam abaixo da margem superior, sem sobreposição.

## Saída e verificação

Seções condicionais inativas ou suprimidas não aparecem na saída. Placeholders pendentes podem aparecer como `XXX`; isso informa dado ausente. Tabelas resolvidas recebem largura máxima de 100% no HTML e nas folhas de estilo do PDF/ODT.

`src/__tests__/renderer/margens.test.ts` cobre a normalização/fallback das margens. O smoke de PDF deve usar tabela suficiente para cruzar uma página e confirmar, visualmente, a margem superior e a repetição de cabeçalho na página seguinte.
