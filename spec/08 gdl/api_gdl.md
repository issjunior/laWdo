# Integração atual com a API GDL

## Referência externa

O manual `docs/api/API_GDL.txt` documenta o contrato externo. Esta spec descreve somente o comportamento implementado pela aplicação.

## Arquitetura e fluxo

A integração é somente leitura no sistema externo.

```text
GdlConsultaModal ou GdlPecasModal
  → preload
  → gdl.handlers
  → gdl.service
  → API GDL
  → schemas Zod
  → converterRepB602
  → ResultadoImportacaoExame
  → REPsPage
```

| Responsabilidade | Fonte |
|---|---|
| HTTP, ambientes e credenciais | `gdl.service.ts` |
| validação do payload externo | `gdl.schema.ts` |
| conversão para domínio local | `gdl-b602-normalizador.service.ts` |
| contrato entre camadas | `shared/types/b602-gdl.types.ts` |
| tipos de peça | `shared/catalogos/b602-gdl.catalogo.ts` |
| marcas de arma | `shared/catalogos/b602-marcas-armas.catalogo.ts` |
| tipos de origem | `shared/catalogos/tipos-origem-gdl.catalogo.ts` |
| busca geral e revisão de dados | `GdlConsultaModal.tsx` |
| revisão exclusiva das peças atuais | `GdlPecasModal.tsx` |
| seleção tipo/número | `TipoSolicitacaoSelect.tsx` |
| aplicação e persistência | `REPsPage.tsx`, `b602.service.ts` e `pecas-b602.utils.ts` |

## Catálogo de tipos de origem

`tipos-origem-gdl.catalogo.ts` é a fonte canônica dos códigos e labels do campo externo `Origens > Tipo`. A aplicação persiste o label recebido pela API; códigos e labels não devem ser redefinidos em componentes.

O consumidor de produção atual é `TipoSolicitacaoSelect.tsx`. A permanência em `shared/` antecipa uso pela mesma integração em outros exames. Se não surgir segundo consumidor real, o catálogo deve ser relocalizado para a feature REP. Subconjuntos e regras específicas continuam fora do catálogo base.

O teste do catálogo protege unicidade de códigos e labels.

## Ambientes e credenciais

Ambientes: `homologacao` e `producao`. Cada um possui URL, login, senha e CPF. Senhas passam por `configuracao.service.ts`; o renderer recebe apenas operações específicas via preload.

`normalizarAmbiente()` usa homologação como fallback. Requests usam Basic Auth e CPF sem pontuação. `httpsRequest()` configura `rejectUnauthorized: false`; o certificado TLS não é validado.

## Validação de sessão local

`{userData}/gdl/validacao-sessao.json` guarda, por ambiente, estado validado, REP/ano usados e data/hora. É memória de UX, não token nem prova de sessão remota.

Falhas de leitura ou escrita geram `warn` e não bloqueiam. 401/403 limpam o estado; falhas genéricas, timeout e 404 não.

## Teste e validação de credenciais

`testarConexao()` consulta `GET /unidadesMedida` com timeout de 5 segundos e não autentica. `validarCredenciais()` faz consulta real de REP com timeout de 15 segundos usando as credenciais informadas.

## Consulta principal

`consultarRep(numero, ano)`:

1. carrega ambiente e credenciais
2. exige login e senha
3. chama `GET /rep/obter` com timeout de 15 segundos
4. interpreta JSON como `unknown`
5. valida por Zod
6. em homologação, tenta complementar envolvidos
7. registra validação local

200 retorna dados validados; 404 indica ausência; 401/403 indicam autenticação rejeitada e limpam validação. Não há retry ou backoff.

## Consulta auxiliar de envolvidos

Somente em homologação, o service chama sequencialmente `POST /repsInvestigacaoPolicial/listarReps` para cada filtro único.

Prefere número/ano das origens, aceita ano em campo separado ou no sufixo `/AAAA`, deduplica pares e usa `numeroCaso` positivo como fallback. A chamada exige CPF de 11 dígitos, página 1, tamanho 10 e timeout de 15 segundos.

Falhas são toleradas e preservam o resultado principal. Como filtros são processados em série e não há limite explícito antes da deduplicação, o tempo total pode somar 15 segundos por filtro.

## Schemas e fronteira insegura

`gdl.schema.ts` normaliza strings nulas, números em string e campos opcionais. Schemas usam `passthrough()` ou `catchall(z.unknown())` para preservar propriedades dinâmicas.

Nunca alimentar o formulário com JSON bruto. Campos conhecidos passam por Zod; extras permanecem `unknown` até normalização. O schema de peça inclui os campos comuns retornáveis, entre eles descrição da quantidade, datas, código do vestígio e observação, e preserva propriedades personalizadas por `catchall(z.unknown())`. A investigação aceita `envolvidos` como `unknown` porque o formato externo é heterogêneo.

## Normalização B-602

`converterRepB602()` produz campos gerais, peças, dados de solicitação, dados de investigação, metadados e avisos.

Peças:

- tipo resolvido por label ou alias normalizado
- campos comuns resolvidos por chave canônica ou label visual normalizado
- Data de Entrada e Data de Liberação aceitam formato brasileiro, brasileiro com horário ou ISO e chegam ao renderer como `AAAA-MM-DD`
- `Nº Análises` não é mapeado por ser administrativo
- campos com opções aceitam código ou label; selects e checkboxes viram código local
- o combobox `Marca da Arma` usa label, oferece as 1.379 opções observadas e aceita texto livre
- em `PISTOLA(S)`, `Marca` permanece em `extrasGdl` por decisão funcional
- somente mapeamentos confirmados vão para `personalizados`
- demais propriedades vão para `extrasGdl`
- tipo desconhecido fica sem `tipoCodigo` e gera aviso

Envolvidos passam por extração recursiva limitada, deduplicação e separação entre qualificação e nome. BO e IP são classificados por prefixo normalizado. Números múltiplos deixam o campo correspondente vazio e geram aviso.

## Origens da solicitação

Todas as origens com tipo não vazio são normalizadas para `ReferenciaOrigemGdl { tipo, numero }`. O número incorpora o ano quando necessário.

A deduplicação considera tipo normalizado e número. Portanto:

- repetição exata é removida
- mesmo tipo com números diferentes é preservado
- tipos fora das famílias BO/IP/OFÍCIO também são preservados para seleção

A sugestão inicial usa a primeira origem cuja família normalizada começa por BO, IP ou OFÍCIO; se não houver, usa a primeira origem disponível. Tipo e número são sempre escolhidos como par.

O contrato atual chama a lista de `origensDisponiveis`. Na leitura de metadados persistidos, o renderer aceita `origensCandidatasSolicitacao` e a converte para o nome atual.

## Revisão e aplicação

A consulta geral usa `GdlConsultaModal`: executa pré-teste, recebe número/ano, mostra dados mapeados e ausentes e inicia todas as peças retornadas marcadas. O usuário pode desmarcar peças antes de aplicar e escolhe `mesclar` ou `substituir` quando já existem dados relevantes.

A seção B-602 oferece `Selecionar peças do GDL`, que abre `GdlPecasModal`. Esse modal usa a REP já preenchida, consulta automaticamente e não reaplica campos gerais. Seus checkboxes refletem a coleção atual: peça GDL presente fica marcada; peça nova ou removida anteriormente fica desmarcada; peça importada que não retornou permanece listada com aviso.

`mesclar` preserva campos locais não vazios e alterações locais. `substituir` atualiza correspondências por `codPecaGdl`, remove localmente peças GDL desmarcadas ou ausentes da seleção e preserva peças manuais. A revisão exclusiva aplica essa reconciliação somente à coleção de peças.

`TipoSolicitacaoSelect` mostra origens da REP separadas do preenchimento manual. Selecionar origem atualiza tipo e número; selecionar tipo manual ou `Outros` limpa o número anterior. O par exato evita confundir duas origens do mesmo tipo.

O catálogo GDL e tipos locais legados permanecem disponíveis manualmente. Valor livre usa `Outros`; valor não catalogado recebido do GDL é preservado como opção enquanto a origem inicial for GDL.

Peça GDL editada localmente é protegida no modo mesclar. Campos importados recebem destaque verde somente durante a sessão. Avisos não bloqueiam aplicação ou salvamento.

## Persistência e reabertura

`REPsPage` passa peças e metadados ao `b602Service` pelo contexto de serialização. O service grava `b602.pecas`, `b602.solicitante_nome` e `integracaoGdl` no formato canônico, sem arrays legados.

Na reabertura, peças e metadados são validados separadamente. Metadados inválidos retornam `null`; JSON inválido não é forçado por cast. O órgão GDL persistido tem precedência sobre o solicitante local para a unidade policial.

## Resiliência e idempotência

A API não é alterada. Nova consulta pode acrescentar peças e reconciliar aquelas com o mesmo `codPecaGdl`. A remoção decorrente de checkbox desmarcado ocorre apenas no estado local. Peças sem identidade externa podem ser adicionadas novamente.

Não existe cancelamento explícito ao fechar o modal, limite de corpo ou retry. Paralelismo futuro precisa de limite de concorrência.

## Compatibilidade com o laudo

O resultado alimenta `PecaB602[]`, persistido em `b602.pecas`. Consumidores legados do laudo ainda leem arrays antigos; importação bem-sucedida não garante preenchimento de placeholders e seções antigas.

## Testes e impacto

Testes cobrem payload inválido, propriedades dinâmicas, campos comuns dos 17 tipos, aliases visuais, catálogo e opções de `PISTOLA(S)`, origens completas, preservação de mesmo tipo com números diferentes, sugestão inicial, metadados, envolvidos, ambiguidades, comportamento do seletor, reconciliação e o estado inicial/aplicação do `GdlPecasModal`.

`rep-b602-persistencia.integration.test.ts` atravessa serialização, handlers e SQLite temporário até a reabertura. Não há teste de rede GDL real; o serviço de laudo é mockado no teste de persistência.

Alterações precisam manter alinhados schema, normalizador, contrato shared, handler/preload, os dois modais, seletor, persistência, catálogo e consumidores do laudo.
