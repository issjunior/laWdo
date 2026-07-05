# Seccoes repetiveis por arma no B-602

## Onde a repeticao acontece

O comportamento atual depende de duas camadas do main:

- `src/main/services/secao-builder.service.ts`
- `src/main/services/laudo.service.ts`

O formulario grava as armas no JSON do B-602.
O builder do laudo usa esse JSON para expandir secoes marcadas com `repetir_para = 'armas'`.

## Pipeline atual

### 1. Filtragem das secoes

`filtrarSecoesAtivas()` remove secoes derivadas da REP que nao tenham dados suficientes.

No caso de armas:

- uma secao com `repetir_para === 'armas'` so permanece se houver itens em `b602.armas`
- blocos associados a armas tambem respeitam os toggles por item

### 2. Expansao

`expandirSecoesRepetiveis()` percorre as secoes filtradas e, para cada secao repetivel:

1. le `b602.armas`
2. cria um bloco `<div data-repeat-group="armas" ...>`
3. injeta um `<h4 data-repeat-item="arma" data-arma-indice="N">`
4. reindexa placeholders do padrao `_1_` para `_{N}_`
5. processa blocos condicionais no contexto daquela arma

## Titulos por item

O titulo de cada arma vem de:

- `secao.repetir_titulo`, quando definido
- fallback para `secao.nome`

Antes de renderizar o heading, o builder substitui os placeholders indexados para o indice atual.

## Toggles por arma

`processarBlocosCondicionais()` entende dois toggles especiais por item:

- `b602_arma_N_func_toggle`
- `b602_arma_N_coleta_toggle`

Quando a expansao esta no contexto da arma `N`, o builder normaliza o padrao para o indice real e remove o bloco se a chave nao estiver em `on`.

## Estrutura preservada no laudo

Os headings estruturais recebem atributos como:

- `data-secao-id`
- `data-parent-id`
- `data-estrutura-nivel`
- `data-titulo-base`
- `data-repeat-section`

Esses marcadores sao usados por `laudo.service.ts` para reconciliar o HTML atual com a base recalculada.

## Sincronizacao depois da edicao da REP

`laudoService.sincronizarSecoesCondicionais(laudoId)`:

1. recarrega as secoes do template
2. relanca `filtrarSecoesAtivas()`
3. relanca `expandirSecoesRepetiveis()`
4. monta novo HTML base com `buildHtml()`
5. reconcilia com o conteudo salvo

O objetivo e atualizar o bloco derivado da REP sem perder conteudo manual fora dessas areas derivadas.

## Regra pratica

Qualquer alteracao nos campos da arma do B-602 precisa considerar tres pontos:

1. serializacao em `b602Service`
2. placeholders indexados do grupo `b602_arma_*`
3. expansao do laudo em `secao-builder.service.ts`
