# Preview PDF e HTML do laudo

## Origem

O preview usa o corpo HTML persistido do laudo, que pode ter sido criado ou sincronizado por `laudo.service.ts` a partir de template e `campos_especificos` da REP. Antes da geração final, a resolução de placeholders produz a camada de valores e tabelas.

A depuração deve seguir esta ordem: conteúdo salvo em `laudos.conteudo`, HTML após resolução e, por fim, a conversão para PDF/ODT.

## Cabeçalhos configuráveis

A configuração separa `cabecalho_laudo`, usado no corpo da primeira página, de `cabecalho_paginas`, convertido no `headerTemplate` das páginas. `buildPdfHeaderConfig()` lê as duas chaves em paralelo; `buildHeaderTemplate()` remove wrappers `data-placeholder`, converte `{{pagina}}` e `{{totalPaginas}}` nas classes nativas do Chromium e aplica substituições como `numero_rep`.

Os padrões canônicos ficam em `src/shared/configuracoes/cabecalhos-padrao.ts`. A migration v35 garante o cabeçalho da primeira página e a v36 garante o cabeçalho de todas as páginas com `INSERT OR IGNORE`, portanto configurações já personalizadas não são sobrescritas. A tela de Cabeçalhos apresenta primeiro a configuração das páginas e depois a primeira página; ambas são editadas localmente e persistidas em `configuracoes`.

A versão atual do schema é 36. O teste de integridade do schema ainda contém expectativas literais para a versão 34 e, no estado atual, registra duas falhas até ser alinhado por alteração de testes autorizada.

## Comportamento relevante

- Seções condicionais inativas e blocos periciais suprimidos não aparecem na saída.
- Placeholders textuais ausentes e blocos periciais vazios aparecem como `XXX` destacado; isso é informação pendente, não erro de preview.
- Tabelas resolvidas recebem `width` e `max-width` de 100% no fragmento HTML e nas folhas de estilo do PDF/ODT.
- Prévia visual do editor não é fonte do preview: ela é removida e a resolução é refeita com dados da REP.

Assim, defeitos de seção podem vir da sincronização estrutural, enquanto defeitos de valor ou tabela devem ser investigados no resolvedor antes da camada de conversão.
