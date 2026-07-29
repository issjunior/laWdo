# Preview PDF e HTML do laudo

## Origem

O preview usa o corpo HTML persistido do laudo, que pode ter sido criado ou sincronizado por `laudo.service.ts` a partir de template e `campos_especificos` da REP. Antes da geração final, a resolução de placeholders produz a camada de valores e tabelas.

A depuração deve seguir esta ordem: conteúdo salvo em `laudos.conteudo`, HTML após resolução e, por fim, a conversão para PDF/ODT.

## Comportamento relevante

- Seções condicionais inativas e blocos periciais suprimidos não aparecem na saída.
- Placeholders textuais ausentes e blocos periciais vazios aparecem como `XXX` destacado; isso é informação pendente, não erro de preview.
- Tabelas resolvidas recebem `width` e `max-width` de 100% no fragmento HTML e nas folhas de estilo do PDF/ODT.
- Prévia visual do editor não é fonte do preview: ela é removida e a resolução é refeita com dados da REP.

Assim, defeitos de seção podem vir da sincronização estrutural, enquanto defeitos de valor ou tabela devem ser investigados no resolvedor antes da camada de conversão.
