# Seções repetíveis por arma no B-602

## Fonte dos dados

O formulário B-602 persiste peças em `campos_especificos.b602.pecas`. O laudo não deve exigir que o formulário recrie `b602.armas`: `projetarB602ParaLaudo()` deriva uma visão compatível para armas, cartuchos, estojos e material encaminhado.

A projeção é a única adaptação entre a coleção canônica e os consumidores legados. Ela usa `pecas` quando presente e faz fallback de leitura para os arrays legados, preservando compatibilidade com REPs antigas. Não duplicar essa transformação em builders, exportadores ou páginas.

## Seções, toggles e expansão

`secao-builder.service.ts` usa a projeção para decidir se uma seção derivada possui dados, para avaliar toggles de armas e para expandir `repetir_para = 'armas'`.

1. Sem armas projetadas, a repetição produz conteúdo vazio.
2. Com armas, cada item recebe índice estável na renderização e os placeholders indexados são reindexados.
3. Condições `b602_arma_N_func_toggle` e `b602_arma_N_coleta_toggle` leem a arma projetada no índice correspondente.
4. Toggles explícitos persistidos continuam tendo precedência quando existem.

A projeção classifica peças por família e traduz os campos relevantes para a estrutura usada pelo laudo. Tipos não classificados como arma não devem ativar repetição de armas.

## Sincronização e falhas

`laudoService.sincronizarSecoesCondicionais()` continua reconciliando o HTML derivado com o conteúdo salvo para preservar edições manuais fora das áreas estruturais. Criação/atualização da REP e sincronização do laudo não formam uma transação única; falha de sincronização é registrada sem desfazer a REP.

A expansão ocorre em memória e cresce com a quantidade de seções e armas. Evitar parse repetido de `campos_especificos` ou consultas por arma dentro dos loops.

## Verificação

Testes de `secao-builder.service` cobrem projeção de peças para seções, repetição e toggles. Qualquer alteração deve preservar: zero/uma/várias armas, reindexação de placeholders, conteúdo manual do laudo, peças manuais e importadas e fallback de leitura legada.
