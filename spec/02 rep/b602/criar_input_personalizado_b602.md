# B-602 no formulário de REP

## Visão arquitetural

O fluxo ativo usa um único formulário para dados manuais e importados. O GDL normaliza dados para o mesmo contrato local.

| Dado | Fonte de verdade durante a edição | Persistência |
|---|---|---|
| investigação | `REPFormData` | propriedades escalares de `b602` |
| envolvidos | pares qualificação/nome em `REPFormData` | strings em `b602.envolvidos` |
| unidade policial | `b602_solicitante_nome` | `b602.solicitante_nome` |
| peças | `PecaB602[]` em `REPsPage` | `b602.pecas` |
| origens para solicitação | `ReferenciaOrigemGdl[]` restaurado dos metadados | `integracaoGdl.dadosSolicitacao.origensDisponiveis` |
| marcação visual GDL | `Set<string>` local | não persistida |
| origem e última consulta | `MetadadosIntegracaoGdl` | `integracaoGdl` |

## Seções ativas e legado

`EXAM_FIELD_MAP['B-602']` contém somente `dados_investigacao` e `pecas_b602`.

`SECTION_REGISTRY`, `b602.tsx` e `b602Service` ainda contêm campos legados de material, cartuchos, estojos e armas. Eles não são renderizados pelo fluxo ativo e não devem virar segunda fonte de edição.

## Dados da solicitação

O normalizador conserva todas as origens GDL com tipo não vazio. A deduplicação usa o par tipo normalizado+número; origens do mesmo tipo e números diferentes permanecem distintas.

Para o preenchimento inicial, escolhe a primeira origem cuja família normalizada começa por BO, IP ou OFÍCIO. Se nenhuma pertencer a essas famílias, usa a primeira origem disponível. O tipo e o número escolhidos alimentam `tipo_solicitacao` e `numero_documento`.

`TipoSolicitacaoSelect` apresenta dois grupos:

- origens cadastradas na REP, exibidas como tipo e número
- preenchimento manual com catálogo GDL, tipos locais legados e `Outros`

Uma origem é identificada pelo par exato tipo+número. Selecioná-la altera ambos os campos. Selecionar um tipo manual ou `Outros` limpa o número anterior. Valores livres ficam no modo `Outros`; valor desconhecido proveniente do GDL é preservado enquanto `origemInicial === 'gdl'`.

Na reabertura, as origens são restauradas de `integracaoGdl`. O leitor converte o nome legado `origensCandidatasSolicitacao` para `origensDisponiveis`.

## Unidade policial

O órgão retornado pelo GDL tem precedência para `b602_solicitante_nome`. Sem órgão GDL, o campo deriva do solicitante local escolhido. O valor é persistido para manter o texto usado na REP mesmo após a sessão.

## Dados da investigação

Campos:

- até dez envolvidos
- data da ocorrência
- bairro, cidade e UF
- número do BO
- número do IP
- unidade policial derivada

Cada envolvido tem qualificação e nome separados. A lista mantém ao menos uma linha, limita a dez e compacta os pares após exclusão.

A completude do stepper exige primeiro envolvido, data, cidade e UF. O bloqueio de salvamento acrescenta BO-ou-IP.

## Contrato de peça

`PecaB602` separa identidade local, origem manual/GDL, identidade externa, marca de alteração local, tipo, campos comuns, personalizados e extras desconhecidos.

`extrasGdl` preserva informação externa sem alimentar automaticamente campos de domínio.

## Catálogo e completude

`b602-gdl.catalogo.ts` é a fonte dos tipos, aliases, campos e opções. `pecaB602EstaCompleta()` exige:

1. `tipoCodigo` reconhecido
2. quantidade maior que zero
3. campos personalizados obrigatórios preenchidos

Um tipo importado sem correspondência fica com código vazio, gera aviso e impede completude.

## Edição e mesclagem

Peça nova recebe UUID, origem manual, quantidade 1 e objetos vazios. Trocar o tipo descarta personalizados somente após confirmação. Editar peça GDL marca `alteradaLocalmente = true`. Excluir não escreve na API.

`mesclarPecasB602DoGdl()` usa `codPecaGdl` e preserva `idLocal`. No modo mesclar, alterações locais e valores não vazios vencem. No modo substituir, correspondências recebem a resposta nova; peças GDL desmarcadas ou ausentes da seleção podem ser removidas, enquanto peças manuais permanecem.

Peças sem `codPecaGdl` não têm identidade externa estável e podem ser adicionadas novamente em consultas futuras.

## Revisão exclusiva das peças do GDL

A seção `Peças` expõe o botão `Selecionar peças do GDL`. `GdlPecasModal` usa o campo `numero` no formato `número-AAAA`, consulta a REP automaticamente e rejeita retorno que não seja B-602.

`montarItensReconciliacaoPecasB602()` combina o retorno com as peças atuais:

- peça GDL presente no formulário inicia marcada;
- peça retornada mas ausente do formulário inicia desmarcada, inclusive após exclusão anterior;
- peça importada que não retornou continua visível e marcada enquanto permanecer no formulário;
- peças manuais não entram na lista nem são removidas ao aplicar.

A aplicação reconcilia somente `PecaB602[]`, atualiza os metadados e não reaplica campos gerais. Reabrir o modal reflete a decisão local mais recente.

## Normalização do GDL

O main valida o payload por Zod antes de converter. Tipos de peça são encontrados por label ou alias normalizado. Apenas chaves com mapeamento confirmado entram em `personalizados`; as demais vão para `extrasGdl`.

Envolvidos são extraídos de estruturas heterogêneas, deduplicados e separados em qualificação e nome. Mais de dez envolvidos, ausência, múltiplos BO/IP e tipo de peça não confirmado geram avisos sem bloquear aplicação.

## Persistência e compatibilidade

`prepareForApi()` passa peças e metadados no contexto de `serializeCamposEspecificos()`. O `b602Service` produz diretamente o formato canônico, remove arrays legados e grava `b602.pecas` e `integracaoGdl`.

Na leitura:

- escalares passam por `b602Service.deserialize()`
- peças passam por validação estrutural mínima
- metadados passam por schema Zod
- `origensCandidatasSolicitacao` é aceito apenas como compatibilidade de leitura

Chamada do service sem contexto ainda produz arrays legados, mas não é o caminho canônico de persistência da página.

## Relação atual com laudo e placeholders

O editor grava `b602.pecas`, enquanto preview da REP, `LaudosPage`, `exportacao-placeholders.ts` e `secao-builder.service.ts` ainda consultam arrays antigos. Não há adaptador geral.

Assim, peças novas não garantem preenchimento dos placeholders ou ativação das seções legadas. A solução consistente precisa tornar `pecas` a fonte única ou gerar uma visão legada determinística num único adaptador. Não escrever os dois formatos independentemente.

## Desempenho e testes

Não há limite explícito de peças. A busca inicial do merge usa `Map`, mas a substituição usa `findIndex` por correspondência; o volume esperado é pequeno.

Testes cobrem catálogo, completude, normalização, merge, remoção opcional de peças GDL ausentes, preservação de peças manuais, serialização canônica, reidratação de metadados, compatibilidade do nome legado, seletor de origem e o estado inicial/aplicação do `GdlPecasModal`. Não cobrem o round-trip completo no banco nem o consumo de `b602.pecas` pelo laudo.
