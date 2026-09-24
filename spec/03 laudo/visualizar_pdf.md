# Preview PDF e HTML do laudo

## Origem e cabeçalhos

A prévia aberta no editor parte do conteúdo atual dos editores, inclusive alterações ainda não salvas; a prévia pela lista parte de `laudos.conteudo`, sem editor aberto. Ambas resolvem placeholders com os dados atuais da REP e renumeram `TABELA N` no HTML final antes do PDF. No editor, a página também confere os títulos visíveis antes de montar o HTML e interrompe a geração se essa conferência falhar. A prévia transitória de placeholder não é a fonte canônica da saída.

`cabecalho_laudo` é inserido no corpo da primeira página e `cabecalho_paginas` torna-se `headerTemplate` do Chromium. `buildPdfHeaderConfig()` lê ambos; `buildHeaderTemplate()` remove wrappers de placeholder, converte `{{pagina}}`/`{{totalPaginas}}` nas classes nativas e substitui valores como o número da REP. Os padrões ficam em `src/shared/configuracoes/cabecalhos-padrao.ts`; migrations v35 e v36 os inserem com `INSERT OR IGNORE`.

## Margens e paginação

`getMargens()` sempre devolve margens válidas: configuração persistida normalizada ou o padrão `{ top: 2.5, right: 2, bottom: 2.5, left: 3 }` em centímetros. Para PDF, `exportacao.service.ts` e `template.handlers.ts` usam as mesmas margens efetivas. Quando existe cabeçalho de páginas, a margem superior é no mínimo 2,5 cm, mesmo se uma configuração menor chegar à camada de impressão. O `headerTemplate` é encaminhado explicitamente na exportação do laudo; assim o cálculo não depende do cabeçalho exclusivo da primeira página.

O HTML de impressão não introduz padding lateral alternativo: as margens de impressão definem a área útil e o documento usa os valores efetivos. Tabelas têm largura máxima de 100%, `thead` como `table-header-group` e `tr` com `break-inside: avoid`. Em continuação de tabela, o cabeçalho da página e o cabeçalho da tabela ficam abaixo da margem superior, sem sobreposição.

## Saída e verificação

`renumerarTabelasHtml()` ignora prévias transitórias e aplica a sequência no documento completo após a resolução, inclusive quando tabelas B-602 carregam números fixos. A prévia pela lista confere somente o HTML gerado, pois não há editor para sincronizar.

Seções condicionais inativas ou suprimidas não aparecem na saída. Placeholders pendentes podem aparecer como `XXX`; isso informa dado ausente. Tabelas resolvidas recebem largura máxima de 100% no HTML e nas folhas de estilo do PDF/ODT.

`src/__tests__/renderer/margens.test.ts` cobre a normalização/fallback das margens. O smoke de PDF deve usar tabela suficiente para cruzar uma página e confirmar, visualmente, a margem superior e a repetição de cabeçalho na página seguinte.
