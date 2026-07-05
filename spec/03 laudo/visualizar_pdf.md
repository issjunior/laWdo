# Preview PDF e HTML do laudo

## Principio atual

O preview PDF depende do mesmo corpo HTML que alimenta a exportacao.
Esse corpo nao vem apenas do TinyMCE: ele pode ter sido criado ou sincronizado por `laudo.service.ts` a partir de template e `campos_especificos` da REP.

## Origem do HTML

`laudo.service.ts` monta ou recalcula `laudos.conteudo` com:

- `filtrarSecoesAtivas()`
- `expandirSecoesRepetiveis()`
- `buildHtml()`
- reconciliacao contra o HTML atual

Por isso o preview pode refletir:

- secoes condicionais ja removidas
- grupos de armas ja expandidos
- headings estruturais numerados

## Relacao com placeholders

Antes da geracao final do PDF, o renderer ainda resolve placeholders simples e complexos.
Os mais sensiveis hoje sao:

- campos simples de REP
- placeholders do B-602
- tabelas HTML do B-602
- placeholders indexados por arma

## Diferenca entre conteudo salvo e preview

O conteudo salvo em `laudos.conteudo` e a base.
O preview final acrescenta a ultima camada de substituicao de placeholders e transformacao para PDF.

Isso significa que bugs aparentes de "preview" podem nascer em tres pontos diferentes:

1. geracao/sincronizacao do conteudo no main
2. resolucao de placeholders no renderer
3. pipeline de conversao para PDF

## Regra pratica

Se uma secao do laudo some, duplica ou fica desatualizada no PDF:

- primeiro validar `laudos.conteudo`
- depois validar o HTML pos-resolucao de placeholders
- so por ultimo validar a camada de geracao do PDF
