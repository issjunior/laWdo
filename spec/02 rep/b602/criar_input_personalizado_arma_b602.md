# Seções repetíveis por arma no B-602

## Fonte dos dados

O formato persistido é `campos_especificos.b602.pecas`. `projetarB602ParaLaudo()` é a adaptação única entre essa coleção canônica e os consumidores legados; ela deriva material encaminhado, cartuchos, estojos e armas, usando arrays legados apenas como fallback de leitura. Builders, exportadores e páginas não devem recriar essa projeção.

Cada arma projetada possui `chaveOrigem`, derivada de `PecaB602.idLocal` ou, para leitura legada, de `legado-{indice}`, e `exibeBlocosPericiais`, calculado pelo catálogo compartilhado quando `familia === 'arma'`. A chave identifica a peça entre reconstruções; não use o índice como identidade persistente.

## Repetição e blocos periciais

`secao-builder.service.ts` expande `repetir_para = 'armas'`, reindexa placeholders e acrescenta `data-arma-chave` e `data-arma-indice` ao heading repetido e aos blocos periciais.

Os marcadores legados `b602_arma_N_func_toggle` e `b602_arma_N_coleta_toggle` continuam dependendo dos toggles projetados. Os marcadores versionados abaixo dependem exclusivamente de `exibeBlocosPericiais` e, portanto, aparecem para qualquer peça elegível como arma:

- `b602_arma_N_funcionamento_eficiencia_v2`, com `data-bloco-pericial="funcionamento"`;
- `b602_arma_N_coleta_padroes_v2`, com `data-bloco-pericial="coleta"`.

Os blocos versionados não carregam `h3` próprio: o heading estrutural da arma é a fonte do título. Tipos fora da família arma não entram na repetição e não ativam esses blocos.

## Template integrado e sincronização

A definição canônica do template `Laudo Padrão B-602` está no catálogo integrado do main process e contém a seção repetível `DAS ARMAS`. Na inicialização, a sincronização integrada valida e calcula seu checksum antes de adotá-lo ou instalá-lo; a adoção preserva os IDs físicos do template legado compatível e de suas seções.

A migration v31 permanece responsável por normalizar os marcadores da seção repetível existente. A v32 introduz metadados de origem, versão, checksum e chave integrada, sem reescrever conteúdo de templates que não coincida exatamente com a definição canônica.

## Sincronização e migração

Ao sincronizar seção derivada, `laudoService` indexa blocos periciais por `data-arma-chave:data-bloco-pericial` e reaproveita o HTML atual quando a peça ainda existe. Assim preserva texto editado e a supressão recuperável, sem transferir conteúdo para outra arma.

Atualização de REP e sincronização de laudo não formam uma transação única; falha na sincronização é registrada sem desfazer a REP. A expansão é em memória e cresce com a quantidade de seções e armas.

## Limites e verificação

Testes de `secao-builder.service`, da projeção B-602 e da migration v31 cobrem elegibilidade, normalização dos marcadores, atributos de identidade, compatibilidade legada e o conteúdo atualizado do template padrão. `templates-integrados.test.ts` protege a definição B-602, a repetição por armas e a estabilidade do checksum diante de artefatos transitórios do editor.
