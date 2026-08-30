# Seções repetíveis por arma no B-602

## Fonte dos dados

O formato persistido é `campos_especificos.b602.pecas`. `projetarB602ParaLaudo()` é a adaptação única entre essa coleção canônica e os consumidores; ela deriva material encaminhado, cartuchos, estojos e armas. Builders, exportadores e páginas não devem recriar essa projeção.

Cada arma projetada possui `chaveOrigem`, derivada de `PecaB602.idLocal`, e `exibeBlocosPericiais`, calculado pelo catálogo compartilhado quando `familia === 'arma'`. A chave identifica a peça entre reconstruções; não use o índice como identidade persistente.

As seções derivadas seguem as peças projetadas: sem cartuchos, `DOS CARTUCHOS` é omitida; sem estojos, `DOS ESTOJOS` é omitida; sem armas, `DAS ARMAS` não é repetida. Assim, uma REP contendo somente uma pistola gera apenas a seção dessa arma e não introduz cartuchos ou estojos vazios. Os identificadores condicionais do template permanecem como contrato do processador; eles não representam controles manuais exibidos na REP. O `lacreSaida` de cada peça também é projetado para a lacração final: armas preservam a ordem para receber a letra exibida no laudo, enquanto estojos são agrupados pela quantidade de itens projetados.

## Repetição e blocos periciais

`secao-builder.service.ts` expande `repetir_para = 'armas'`, reindexa placeholders e acrescenta `data-arma-chave` e `data-arma-indice` ao heading repetido e aos blocos periciais.

Os marcadores legados `b602_arma_N_func_toggle` e `b602_arma_N_coleta_toggle` continuam dependendo dos toggles projetados. Os marcadores versionados abaixo dependem exclusivamente de `exibeBlocosPericiais` e, portanto, aparecem para qualquer peça elegível como arma:

- `b602_arma_N_funcionamento_eficiencia_v2`, com `data-bloco-pericial="funcionamento"`;
- `b602_arma_N_coleta_padroes_v2`, com `data-bloco-pericial="coleta"`.

Os blocos versionados não carregam `h3` próprio: o heading estrutural da arma é a fonte do título. Tipos fora da família arma não entram na repetição e não ativam esses blocos. A tabela de imagens dummy fica no fim de cada repetição `DAS ARMAS`, fora dos blocos condicionais de funcionamento e coleta.

## Template integrado e sincronização

A definição canônica do template `Laudo Padrão B-602` está no catálogo integrado do main process e contém a seção repetível `DAS ARMAS`. Na inicialização, a sincronização integrada valida e calcula seu checksum antes de adotá-lo ou instalá-lo; em desenvolvimento pode substituir a definição local divergente da mesma versão.

A migration v31 permanece responsável por normalizar os marcadores da seção repetível existente. A v32 introduz metadados de origem, versão, checksum e chave integrada.

## Sincronização e migração

Ao sincronizar seção derivada, `laudoService` indexa blocos periciais por `data-arma-chave:data-bloco-pericial` e reaproveita o HTML atual quando a peça ainda existe. Assim preserva texto editado e a supressão recuperável, sem transferir conteúdo para outra arma.

Atualização de REP e sincronização de laudo não formam uma transação única; falha na sincronização é registrada sem desfazer a REP. A expansão é em memória e cresce com a quantidade de seções e armas.

## Limites e verificação

Testes de `secao-builder.service`, da projeção B-602 e da migration v31 cobrem elegibilidade, normalização dos marcadores, atributos de identidade e o conteúdo atualizado do template padrão. `templates-integrados.test.ts` protege a definição B-602, a repetição por armas e a estabilidade do checksum diante de artefatos transitórios do editor.
