# Blocos condicionais do laudo

## Onde a logica vive

O estado atual dos blocos condicionais depende principalmente de `src/main/services/secao-builder.service.ts`.

As funcoes centrais sao:

- `processarBlocosCondicionais()`
- `filtrarSecoesAtivas()`
- `expandirSecoesRepetiveis()`
- `buildHtml()`

## Como o builder avalia um bloco

`processarBlocosCondicionais(html, camposEspecificos, contexto?)` procura wrappers com `data-cond-bloco`.

Regras atuais:

1. processa primeiro os blocos mais internos
2. se a condicao nao estiver ativa, remove o bloco inteiro
3. se houver contexto de arma, normaliza ids como `b602_arma_N_func_toggle` para o indice real
4. se o HTML nao muda entre uma passagem e outra, encerra o loop
5. se passar de 50 iteracoes, lanca erro defensivo

Esse limite de 50 passagens foi mantido para evitar congelamento ao reprocessar blocos ja estaveis.

## Como uma condicao e considerada ativa

### Toggles simples

Chaves como `b602_cartuchos_toggle` e `b602_estojos_toggle` ficam ativas quando:

- o valor e `'on'`, ou
- a colecao correspondente existe com itens

### Toggles por arma

Chaves como `b602_arma_1_func_toggle` e `b602_arma_1_coleta_toggle` dependem do item certo de `b602.armas[]`.

## Filtragem de secoes

`filtrarSecoesAtivas()` decide quais secoes do template entram no HTML base.

Comportamento atual:

- secoes derivadas da REP podem desaparecer se faltarem dados
- pais sem filhos ativos e sem conteudo util sao descartados
- uma secao com `condicao` JSON continua sendo respeitada

## Integracao com repeticao por arma

Quando uma secao repetivel usa `repetir_para = 'armas'`, o conteudo de cada instancia tambem passa por `processarBlocosCondicionais()`.

Isso permite que uma arma tenha:

- bloco de funcionamento
- bloco de coleta

sem obrigar todas as armas do laudo a exibirem os mesmos subtrechos.
