# Integração atual com a API GDL

## Referência externa

O manual `docs/api/API_GDL.txt` documenta o contrato externo da API. Esta spec descreve somente o comportamento atualmente implementado pela aplicação.

## Arquitetura e fluxo

A integração é somente leitura no sistema externo.

```text
GdlConsultaModal
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
| validação de payload externo | `gdl.schema.ts` |
| conversão para domínio local | `gdl-b602-normalizador.service.ts` |
| contrato entre camadas | `shared/types/b602-gdl.types.ts` |
| tipos e campos reconhecidos | `shared/catalogos/b602-gdl.catalogo.ts` |
| revisão e seleção | `GdlConsultaModal.tsx` |
| merge no formulário | `REPsPage.tsx` e `pecas-b602.utils.ts` |

## Catálogo de tipos de origem

`src/shared/catalogos/tipos-origem-gdl.catalogo.ts` é a fonte canônica dos códigos e labels do campo externo `Origens > Tipo`. A aplicação persiste o label recebido pela API; códigos e labels não devem ser redefinidos isoladamente em componentes.

No estado atual, o consumidor de produção desse catálogo é `TipoSolicitacaoSelect.tsx`, no renderer. Sua permanência em `shared/` é uma exceção deliberada ao critério geral de compartilhamento já efetivo: a integração GDL será estendida a outros tipos de exame que consultam a mesma lista externa de origens. A exceção não autoriza mover outros catálogos para `shared/` apenas por reutilização hipotética.

Critério de validação da decisão:

- ao implementar o próximo tipo de exame com origem GDL, reutilizar este catálogo e confirmar que códigos, labels e semântica são realmente comuns
- se não surgir um segundo consumidor de produção, relocalizar o catálogo para a feature REP no renderer
- se os exames exigirem subconjuntos ou regras diferentes, manter a base externa comum e separar as regras específicas por feature
- preservar o teste de unicidade de códigos e labels ao atualizar a lista

## Ambientes e credenciais

Ambientes: `homologacao` e `producao`. Cada um possui URL, login, senha e CPF. Senhas passam por `configuracao.service.ts`; o renderer recebe apenas operações específicas via preload.

`normalizarAmbiente()` usa homologação como fallback para qualquer valor diferente de `producao`.

As requests usam Basic Auth e `cpfUsuario` sem pontuação. `httpsRequest()` aceita HTTP ou HTTPS e atualmente configura `rejectUnauthorized: false`. Portanto, o certificado TLS não é validado; isso é uma característica de segurança atual que não deve ser replicada em novas integrações sem necessidade comprovada.

## Validação de sessão local

`{userData}/gdl/validacao-sessao.json` guarda por ambiente:

- `validado`
- REP e ano usados
- data/hora

Essa informação é memória de UX, não token nem prova de sessão no servidor. Falhas de leitura ou escrita geram `warn` e não bloqueiam a operação.

401 e 403 limpam o estado do ambiente. Falhas genéricas, timeout e 404 não o limpam automaticamente.

## Teste e validação de credenciais

`testarConexao()` consulta `GET /unidadesMedida` com timeout de 5 segundos e não autentica. O retorno diferencia etapa de rede, latência e status.

`validarCredenciais()` faz uma consulta real de REP com timeout de 15 segundos usando as credenciais informadas, sem exigir que elas já estejam salvas.

## Consulta principal

`consultarRep(numero, ano)`:

1. carrega ambiente e credenciais persistidos
2. exige login e senha
3. chama `GET /rep/obter` com timeout de 15 segundos
4. interpreta JSON como `unknown`
5. valida por Zod
6. em homologação, tenta complementar envolvidos
7. registra validação local

Status tratados:

- `200`: valida e retorna
- `404`: REP não encontrada
- `401/403`: autenticação rejeitada e validação limpa
- demais: erro do servidor
- erro de rede/timeout/schema: mensagem do erro e log

Não há retry ou backoff automático.

## Consulta auxiliar de envolvidos

Somente em homologação, o service chama sequencialmente `POST /repsInvestigacaoPolicial/listarReps` para cada filtro único.

Filtros:

- prefere número e ano das origens
- aceita ano no campo separado ou sufixo `/AAAA`
- deduplica pares número/ano
- usa `numeroCaso` positivo como fallback

A consulta exige CPF com 11 dígitos, envia página 1 e tamanho 10, e tem timeout de 15 segundos por filtro.

Falhas são toleradas: CPF inválido, ausência de filtro, status não 200, JSON inválido e timeout geram log e preservam o resultado principal.

Implicação de desempenho: como os filtros são processados em série e não há limite explícito de origens antes da deduplicação, o tempo total pode somar 15 segundos por filtro em cenário de timeout. Paralelizar exige limite de concorrência para não sobrecarregar o GDL.

## Schemas e fronteira insegura

`gdl.schema.ts` normaliza strings nulas, números em string e campos opcionais. Schemas usam `passthrough()` ou `catchall(z.unknown())` para preservar propriedades dinâmicas.

Regras:

- nunca alimentar o formulário diretamente com o JSON bruto
- campos estruturais conhecidos precisam passar por Zod
- propriedades extras permanecem `unknown` até normalização
- erros de parse usam mensagens específicas

O schema de investigação aceita `envolvidos` como `unknown`, pois a API retorna formatos heterogêneos. A interpretação semântica ocorre no normalizador.

## Normalização B-602

`converterRepB602()` separa transporte externo do domínio local. Ele produz campos gerais, peças, dados de solicitação, dados de investigação, metadados e avisos.

Peças:

- tipo resolvido por label ou alias normalizado
- campos comuns normalizados
- somente chaves com mapeamento confirmado vão para `personalizados`
- outras propriedades vão para `extrasGdl`
- tipo desconhecido permanece sem `tipoCodigo` e gera aviso

Envolvidos:

- extração recursiva limitada em profundidade
- reconhecimento por aliases e contexto
- deduplicação por texto normalizado
- separação em qualificação e nome no limite do formulário

BO e IP são classificados por prefixo normalizado. Múltiplos números não são escolhidos arbitrariamente; o campo fica vazio e o usuário recebe aviso.

## Revisão e aplicação

O modal:

- executa pré-teste ao abrir
- busca por número e ano
- mostra mapeados e não preenchidos
- permite desmarcar peças
- oferece `mesclar` e `substituir`

`mesclar` preserva campos locais não vazios. `substituir` aplica campos retornados, mas na coleção de peças substitui apenas correspondências por `codPecaGdl`; peças manuais permanecem.

Uma peça GDL editada localmente é protegida no modo mesclar. Campos importados recebem destaque verde somente durante a sessão.

Avisos não bloqueiam aplicação ou salvamento. O usuário continua responsável por ambiguidades.

## Resiliência e idempotência

A API não é alterada. Consultar novamente pode acrescentar peças novas e reconciliar peças com mesmo `codPecaGdl`. Peças recebidas sem `codPecaGdl` não têm identidade externa e podem ser adicionadas novamente.

Não existe cancelamento explícito da request ao fechar o modal, limite de tamanho do corpo da resposta ou retry. Novas melhorias devem considerar timeout, cancelamento e limite de concorrência antes de adicionar paralelismo.

## Compatibilidade com o laudo

O resultado GDL alimenta `PecaB602[]`, persistido em `b602.pecas`. Consumidores legados do laudo ainda leem arrays antigos. A importação bem-sucedida não garante, por si só, que placeholders e seções antigas recebam os dados de peças.

## Testes e impacto

`gdl-b602-normalizador.service.test.ts` cobre payload inválido, propriedades dinâmicas, peças, origens, metadados, envolvidos, ambiguidades e filtros. Testes de catálogo e merge cobrem completude e precedência local.

Não há teste de rede real nem teste end-to-end atravessando IPC, persistência e laudo.

Alterações precisam manter alinhados:

1. schema e normalizador do main
2. contrato shared
3. handler e preload
4. modal de revisão
5. merge e persistência
6. catálogo e testes
7. consumidores do laudo quando o formato persistido mudar
