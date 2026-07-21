# B-602 no formulário de REP

## Estado canônico

O B-602 usa o mesmo formulário para criação manual e dados importados do GDL. Durante a edição, `REPsPage` mantém `PecaB602[]`; a escrita canônica é `campos_especificos.b602.pecas`. A leitura continua aceitando arrays legados, mas o fluxo ativo não os recria.

| Dado | Fonte durante a edição | Escrita canônica |
|---|---|---|
| dados de investigação | `REPFormData` | escalares de `b602` |
| peças | `PecaB602[]` | `b602.pecas` |
| órgão/unidade | `b602_solicitante_nome` | `b602.solicitante_nome` |
| metadados da consulta | `MetadadosIntegracaoGdl` | `integracaoGdl` |

`PecaB602` separa identidade local, origem manual/GDL, `codPecaGdl`, alteração local, tipo, campos comuns, personalizados e `extrasGdl`. Campos externos inesperados permanecem em `extrasGdl`; não devem virar campos de domínio sem confirmação explícita.

## Catálogo e formulário

`src/shared/catalogos/b602-gdl.catalogo.ts` é a fonte de verdade dos 16 tipos, aliases, campos, obrigatoriedade e opções. `PEÇA TESTE` (`771`) é excluída deliberadamente: não é oferecida nem importada.

Os campos comuns incluem identificação, quantidade, medida, descrição da quantidade, exame in loco, datas, lacres, código do vestígio, consumo/liberação e observação. `Nº Análises` é descartado por decisão funcional. Datas entram no formulário como `AAAA-MM-DD`; o normalizador aceita formatos brasileiros e ISO.

O editor dinâmico usa `texto`, `select`, `checkbox` exclusivo e `combobox`. `Marca da Arma` conserva fallback para texto livre. Para REVÓLVER, tanto `Marca da Arma` quanto `Tipo Acabamento` têm mapeamento GDL confirmado. A completude exige tipo reconhecido, quantidade positiva e todos os personalizados obrigatórios preenchidos.

## Importação e persistência

O main valida o JSON externo com Zod e `converterRepB602()` resolve o tipo por label/alias normalizado. Somente campos marcados como confirmados no catálogo vão a `personalizados`; os demais permanecem em `extrasGdl`. Selects e checkboxes aceitam código ou label e são convertidos ao código canônico; o combobox conserva o label.

`prepareForApi()` passa peças e metadados ao contexto de serialização; `b602Service` grava o formato canônico. Na leitura, peças passam por validação estrutural mínima e metadados por schema Zod. O nome legado `origensCandidatasSolicitacao` é aceito apenas na leitura e normalizado para `origensDisponiveis`.

`mesclarPecasB602DoGdl()` usa `codPecaGdl` para preservar `idLocal`. Mesclar conserva valores locais não vazios e alterações locais; Substituir atualiza correspondências e pode remover peças GDL desmarcadas, sem remover peças manuais. Nenhuma dessas operações escreve no GDL.

## Integração com o laudo

`b602.pecas` é a origem persistida. Para consumidores legados do laudo, `projetarB602ParaLaudo()` produz visão determinística de armas, cartuchos, estojos e material encaminhado, com fallback de leitura dos arrays antigos. Preview, exportação, tabelas, placeholders e seções repetíveis devem consumir essa projeção, sem conversões independentes.

## Evidência, testes e limites

Os 16 tipos disponíveis têm round-trip confirmado por normalização, handlers IPC, SQLite e reabertura. A suíte também verifica o catálogo, a exclusão de `771`, a completude manual de cada tipo, a reconciliação, o editor, os modais e a serialização.

A rede GDL real e a validação em produção não são automatizadas. Fixtures são anonimizados; credenciais e dados sensíveis não entram em fixtures ou logs.
