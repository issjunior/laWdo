# Seções repetíveis por arma no B-602

## Escopo atual

A repetição por arma pertence ao pipeline legado do laudo. Ela consome `b602.armas` e os toggles associados; não consome diretamente `b602.pecas`.

Componentes envolvidos:

- `b602Service`: leitura e escrita do array legado quando esses campos existem
- `secao-builder.service.ts`: filtragem, condições e expansão
- `laudo.service.ts`: sincronização e reconciliação do HTML

## Pré-condições

Uma seção com `repetir_para = 'armas'` só permanece quando `campos_especificos.b602.armas` é um array não vazio.

Seções condicionais por arma usam:

- `b602.armas_toggle`
- `b602_arma_N_func_toggle`
- `b602_arma_N_coleta_toggle`

A presença de uma peça cuja família seja `arma` em `b602.pecas` não satisfaz essas condições no código atual.

## Expansão

`expandirSecoesRepetiveis()`:

1. lê o array `b602.armas`
2. cria um grupo `data-repeat-group="armas"`
3. gera um item por arma com índice estável na renderização
4. reindexa placeholders `_1_` para o índice atual
5. processa condições no contexto da arma

O título vem de `repetir_titulo` ou do nome da seção e também recebe substituição indexada.

## Reconciliação do laudo

Headings e blocos carregam atributos estruturais como `data-secao-id`, `data-parent-id`, `data-estrutura-nivel`, `data-titulo-base` e marcadores de repetição.

`laudoService.sincronizarSecoesCondicionais()` recalcula a base e reconcilia com o conteúdo salvo para preservar edições manuais fora das áreas derivadas.

Criação/atualização da REP e sincronização do laudo não são uma transação única. Falha de sincronização é registrada sem desfazer a REP.

## Fronteira com o editor atual de peças

O fluxo ativo do B-602 grava `b602.pecas` e remove `b602.armas` na composição final. Não existe conversão geral de `PecaB602` para o contrato legado de arma.

Consequência atual: uma arma cadastrada no editor novo pode não gerar seção repetível, bloco condicional ou placeholder legado.

Essa diferença não deve ser corrigida copiando dados em vários pontos. A opção resiliente é:

- migrar o builder e os placeholders para `b602.pecas`; ou
- criar um adaptador único e determinístico de peças para a visão legada

Qualquer adaptador precisa definir explicitamente:

- quais `tipoCodigo` representam arma
- mapeamento de campos comuns e personalizados
- identidade e ordem das armas
- equivalência dos toggles de funcionamento e coleta
- comportamento para tipos sem round-trip confirmado

## Desempenho

A expansão é feita em memória durante construção ou sincronização do laudo. O custo cresce com quantidade de seções e armas. Evitar consultas por arma ou parse repetido de `campos_especificos` dentro do loop.

## Verificação

`secao-builder.service.test.ts` cobre expansão repetível com o formato legado. Não há teste equivalente usando `b602.pecas`.

Uma mudança nessa fronteira precisa testar:

1. zero, uma e várias armas
2. reindexação de placeholders
3. toggles por item
4. sincronização sem perda de conteúdo manual
5. peças manuais e GDL
6. tipos sem mapeamento confirmado
