# B-602 no formulário de REP

## Estado canônico

O B-602 usa um único formulário para criação manual e dados importados do GDL. Durante a edição, `REPsPage` mantém `PecaB602[]`; a escrita canônica é `campos_especificos.b602.pecas`. O leitor ainda aceita estruturas legadas, mas o fluxo ativo não recria arrays legados.

| Dado | Fonte durante a edição | Escrita canônica |
|---|---|---|
| dados de investigação | `REPFormData` | escalares de `b602` |
| peças | `PecaB602[]` | `b602.pecas` |
| órgão/unidade | `b602_solicitante_nome` | `b602.solicitante_nome` |
| metadados da consulta | `MetadadosIntegracaoGdl` | `integracaoGdl` |

`PecaB602` separa identidade local, origem manual/GDL, `codPecaGdl`, alteração local, tipo, campos comuns, personalizados e `extrasGdl`. Campos externos inesperados são preservados em `extrasGdl`; não devem ser usados como campos de domínio sem confirmação explícita.

## Catálogo e formulário

`src/shared/catalogos/b602-gdl.catalogo.ts` é a fonte de verdade para tipos, aliases, campos, obrigatoriedade e opções. Há 16 tipos disponíveis no editor e na conversão. `PEÇA TESTE` (`771`) é deliberadamente excluída: não é oferecida nem importada.

Os campos comuns incluem identificação, quantidade, medida, descrição da quantidade, exame in loco, datas, lacres, código do vestígio, consumo/liberação e observação. `Nº Análises` é descartado por decisão funcional. Datas entram no formulário como `AAAA-MM-DD`; o normalizador aceita formatos brasileiros e ISO.

O editor dinâmico usa os controles `texto`, `select`, `checkbox` exclusivo e `combobox`. `Marca da Arma` usa o catálogo compartilhado de marcas, mas mantém fallback para texto livre. A completude exige tipo reconhecido, quantidade positiva e personalizados obrigatórios preenchidos.

## Importação e persistência

O main valida o JSON externo com Zod e `converterRepB602()` resolve o tipo por label/alias normalizado. Apenas campos marcados como confirmados no catálogo são enviados a `personalizados`; os demais ficam em `extrasGdl`. Opções podem chegar como código ou label: selects/checkboxes são convertidos ao código canônico e o combobox conserva o label.

`prepareForApi()` passa peças e metadados ao contexto de serialização; `b602Service` grava diretamente o formato canônico. Na leitura, peças passam por validação estrutural mínima e metadados por schema Zod. O nome legado `origensCandidatasSolicitacao` é aceito somente na leitura e convertido para `origensDisponiveis`.

`mesclarPecasB602DoGdl()` usa `codPecaGdl` para preservar `idLocal`. Mesclar preserva valores locais não vazios e alterações locais; Substituir atualiza correspondências e pode remover peças GDL desmarcadas, sem remover peças manuais. Nenhuma dessas operações escreve no GDL.

## Integração com o laudo

`b602.pecas` é a origem persistida. Para consumidores legados do laudo, `projetarB602ParaLaudo()` cria uma visão determinística de armas, cartuchos, estojos e material encaminhado, com fallback de leitura dos arrays antigos. Preview da REP, exportação, tabelas, placeholders e seções repetíveis devem consumir essa projeção, e não manter conversões independentes.

## Evidência e limites

Round-trip por normalização, handlers IPC e SQLite está coberto para ARMA(S) DE PRESSÃO, CARABINA(S), ESPINGARDA(S), ESTOJO(S), FUZIL(IS), GARRUCHA(S), PISTOLA(S), PROJÉTEIS, REVÓLVER(ES) e SUBMETRALHADORA(S). Permanecem sem round-trip preenchido os tipos ARMA(S) DE CHOQUE, CARREGADOR(ES), ESPOLETA(S), OUTROS, PISTOLETE(S) e PÓLVORA.

Os testes protegem catálogo, exclusão de `771`, normalização, reconciliação, editor, modais, serialização e reabertura por SQLite. A rede GDL real e a validação em produção não são automatizadas.
