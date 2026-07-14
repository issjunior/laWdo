# B-602 no formulário de REP

## Visão arquitetural

O fluxo ativo usa um único formulário para dados manuais e importados. O GDL não possui formulário paralelo: ele normaliza dados para o mesmo contrato local.

| Dado | Fonte de verdade durante a edição | Persistência |
|---|---|---|
| investigação | `REPFormData` | propriedades escalares de `b602` |
| envolvidos | pares qualificação/nome em `REPFormData` | strings em `b602.envolvidos` |
| peças | `PecaB602[]` em `REPsPage` | `b602.pecas` |
| marcação visual GDL | `Set<string>` local | não persistida |
| origem e última consulta | `MetadadosIntegracaoGdl` | `integracaoGdl` |

## Seções ativas e legado

`EXAM_FIELD_MAP['B-602']` contém somente:

- `dados_investigacao`
- `pecas_b602`

`SECTION_REGISTRY`, `b602.tsx` e `b602Service` ainda contêm editores e campos legados de material encaminhado, cartuchos, estojos e armas. Eles não são renderizados pelo fluxo ativo e não devem ser usados como segunda fonte de edição.

## Dados da investigação

Campos:

- até dez envolvidos
- data da ocorrência
- bairro, cidade e UF
- número do BO
- número do IP
- solicitante derivado da seleção da REP

Cada envolvido tem qualificação e nome separados. O datalist sugere `EM PODER DE:`, `AUTOR:` e `VÍTIMA:`, mas aceita texto livre.

A lista mantém ao menos uma linha. Adição para em dez. Exclusão compacta os pares seguintes e limpa o último, evitando lacunas que alterariam a ordem persistida.

A completude do stepper exige primeiro envolvido, data, cidade e UF. O bloqueio de salvamento acrescenta BO-ou-IP.

## Contrato de peça

`PecaB602` separa:

- `idLocal`: identidade estável na sessão e na persistência local
- `origem`: `manual` ou `gdl`
- `codPecaGdl`: identidade externa quando disponível
- `alteradaLocalmente`: protege edição local durante nova mesclagem
- `tipoCodigo` e `tipoPeca`
- `comuns`: campos compartilhados por todos os tipos
- `personalizados`: campos definidos pelo catálogo
- `extrasGdl`: propriedades externas sem mapeamento confirmado

`extrasGdl` preserva informação desconhecida sem alimentar automaticamente campos de domínio.

## Catálogo e completude

`b602-gdl.catalogo.ts` é a fonte dos tipos, aliases, campos e opções. Atualmente existem 17 códigos; somente CARABINA e ESTOJO têm round-trip confirmado.

`pecaB602EstaCompleta()` exige:

1. `tipoCodigo` reconhecido pelo catálogo
2. quantidade maior que zero
3. todos os campos personalizados marcados como obrigatórios

Identificação, lacres e outros campos comuns não são obrigatórios por essa função, salvo regra adicional no catálogo. Um tipo importado sem correspondência fica com código vazio, gera aviso e impede a completude.

## Edição manual

Uma peça nova recebe UUID, origem manual, quantidade 1 e objetos vazios. Ao trocar o tipo, campos personalizados existentes são descartados somente após confirmação.

Editar peça importada marca `alteradaLocalmente = true`. Excluir item GDL afeta apenas o laWdo; nenhuma escrita é enviada à API externa.

Não há limite explícito para quantidade de peças. O editor trabalha todo em memória e não faz I/O por campo.

## Mesclagem com nova consulta GDL

`mesclarPecasB602DoGdl()` usa `codPecaGdl` para localizar equivalência externa e preserva `idLocal`.

| Situação | Modo mesclar | Modo substituir |
|---|---|---|
| peça GDL nova | adiciona | adiciona |
| peça existente alterada localmente | preserva inteira | substitui dados, preservando `idLocal` |
| campos comuns existentes | preenche apenas vazios | usa resposta nova |
| personalizados existentes | valores locais não vazios vencem | usa resposta nova |
| extras GDL | combina, com local vencendo | usa resposta nova |
| peças manuais | permanecem | permanecem |

`substituir` não significa limpar toda a coleção: peças manuais e peças GDL antigas não retornadas não são removidas pelo helper atual. Ele substitui apenas correspondências encontradas.

A busca inicial usa `Map` por `codPecaGdl`, mas a substituição localiza `idLocal` com `findIndex` para cada correspondência. O volume esperado é pequeno; em coleções grandes o trecho pode se aproximar de custo quadrático.

## Normalização do GDL

O main valida o payload antes de converter. Tipos são encontrados por label ou alias normalizado. Apenas chaves com mapeamento confirmado entram em `personalizados`; as demais vão para `extrasGdl`.

Envolvidos são extraídos de estruturas heterogêneas, deduplicados e separados em qualificação e nome. Mais de dez, ausência, múltiplos BO/IP e tipo de peça não confirmado geram avisos sem bloquear aplicação.

## Persistência e compatibilidade

O formato escrito pelo fluxo ativo usa `b602.pecas`. Na leitura, peças passam por validação estrutural mínima antes de entrar no estado.

Os arrays legados ainda são entendidos pelo `b602Service`, mas a composição final da página os remove. Isso preserva abertura de parte dos registros antigos, mas não cria equivalência entre arrays legados e `PecaB602[]`.

## Relação atual com laudo e placeholders

Há uma assimetria importante:

- o editor atual grava `b602.pecas`
- preview da REP, `LaudosPage`, `exportacao-placeholders.ts` e `secao-builder.service.ts` ainda consultam `material_enc`, `cartuchos`, `estojos`, `armas` e toggles
- não há adaptador geral de `PecaB602` para essas estruturas

Assim, peças do formato novo não garantem preenchimento dos placeholders ou ativação das seções legadas. Essa limitação deve ser considerada antes de alterar laudo, exportação ou templates.

A solução consistente precisa escolher entre:

1. tornar `b602.pecas` a fonte única e migrar consumidores
2. gerar uma visão legada determinística a partir de `pecas` em um único adaptador

Não escrever e editar os dois formatos independentemente.

## Impacto e testes

Alterações em peças precisam conferir:

- tipos e catálogo shared
- normalizador GDL
- editor e merge
- completude e pendências
- persistência e restauração
- preview da REP
- placeholders, seções condicionais e repetição por arma

Testes atuais cobrem catálogo, completude, normalização e merge. Não cobrem o round-trip completo no banco nem o consumo de `b602.pecas` pelo laudo.
