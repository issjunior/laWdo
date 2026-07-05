# Exportacao do laudo e relacao com o conteudo salvo

## Principio atual

O laudo exportado parte sempre do HTML salvo em `laudos.conteudo`.
Esse HTML nao e estatico: ele nasce e pode ser recalculado a partir de template + dados da REP.

## Papel de `laudo.service.ts`

`src/main/services/laudo.service.ts` prepara o conteudo base em dois momentos centrais:

### Criacao inicial

`criarLaudoInicial()`:

1. busca as secoes do template
2. le `reps.campos_especificos`
3. executa `filtrarSecoesAtivas(secoes, especificos)`
4. executa `expandirSecoesRepetiveis(secoesAtivas, especificos)`
5. monta o HTML com `buildHtml(secoesAtivas, expansoes, especificos)`
6. salva o resultado em `laudos.conteudo`

### Sincronizacao posterior

`sincronizarSecoesCondicionais(laudoId)` repete esse pipeline para manter o laudo alinhado quando a REP muda.

## O que isso significa para exportacao

Antes do preview PDF, do DOCX ou do ODT, o sistema parte de um HTML que ja pode conter:

- secoes filtradas por condicao
- grupos repetidos por arma
- titulos estruturais com `data-secao-id`
- blocos derivados de `campos_especificos`

Ou seja: a exportacao nao resolve apenas placeholders simples; ela tambem consome um laudo cujo corpo ja foi moldado pelo builder.

## Campos vindos da REP

As partes mais sensiveis para exportacao sao:

- placeholders simples de REP
- placeholders do B-602
- tabelas completas do B-602
- headings reindexados de secoes repetiveis

Se o conteudo salvo estiver desatualizado em relacao a REP, a exportacao vai refletir esse descompasso. Por isso a sincronizacao condicional e parte do ciclo real do laudo exportavel.

## Regra pratica

Ao mexer em:

- `secao-builder.service.ts`
- `campos_especificos` do B-602
- logica de sincronizacao em `laudo.service.ts`

e obrigatorio revisar o impacto no HTML que segue para preview e exportacao.
