# Persistência dos campos específicos da REP

## Responsabilidade e fluxo

A tabela `reps` guarda campos comuns em colunas e o restante em `campos_especificos`, uma string JSON. O formato interno pertence ao renderer; `rep.handlers.ts` e `rep.service.ts` persistem a string sem validar sua estrutura de domínio.

Escrita atual:

`formulário + estado externo → serializeCamposEspecificos() → preload/IPC → rep.handlers → BaseService → SQLite`

Leitura atual:

`SQLite → IPC → deserializeCamposEspecificos() + extratores B-602 → formulário, peças e metadados`

## Formato por exame

| Código | Escrita | Leitura |
|---|---|---|
| `LOC` | colunas nativas | colunas nativas |
| `I-801` | `numeracaoService` | `numeracaoService` |
| `B-602` | `b602Service` com contexto de peças/metadados | `b602Service`, `extrairPecasB602()` e `extrairMetadadosIntegracaoGdl()` |

## Formato final atual do B-602

Forma conceitual:

```json
{
  "b602": {
    "envolvidos": ["VÍTIMA: NOME"],
    "data_ocorrencia": "2026-07-14",
    "local": { "bairro": "", "cidade": "LONDRINA", "uf": "PR" },
    "numero_bo": "",
    "numero_ip": "",
    "solicitante_nome": "UNIDADE POLICIAL",
    "pecas": []
  },
  "integracaoGdl": {}
}
```

`integracaoGdl` só existe quando há metadados. `solicitante_nome` é gravado no bloco B-602 e reidratado como `b602_solicitante_nome`.

## Composição canônica

`prepareForApi()` chama `serializeCamposEspecificos()` com o contexto:

```text
b602.pecas
b602.metadadosIntegracaoGdl
```

O `b602Service.serialize()` monta os campos escalares, recebe esse contexto e então:

1. remove `material_enc`, `cartuchos`, `estojos`, `armas` e `armas_toggle`
2. grava `b602.pecas`
3. grava `integracaoGdl` na raiz quando presente
4. devolve o objeto final, que o registry converte para JSON

Não há mais uma recomposição posterior em `REPsPage`. O contexto é obrigatório para que a criação/edição B-602 produza o formato canônico. Uma chamada sem contexto continua produzindo a visão legada e é usada apenas por verificações antigas.

## Compatibilidade de leitura e escrita

| Estrutura | Escrita canônica | Leitura atual | Consumidores conhecidos |
|---|---|---|---|
| investigação, local, BO, IP e solicitante | sim | sim | formulário e placeholders de investigação |
| `b602.pecas` | sim | validação estrutural mínima | editor de peças e merge GDL |
| `integracaoGdl` | quando disponível | schema Zod | formulário e nova consulta |
| `origensDisponiveis` | sim | sim | seletor tipo/número |
| `origensCandidatasSolicitacao` | não | convertida para `origensDisponiveis` | compatibilidade de metadados antigos |
| arrays legados de material/armas | não | ainda aceitos pelo service | preview, placeholders e seções legadas |

O editor novo persiste `b602.pecas`, mas `LaudosPage`, `exportacao-placeholders.ts` e `secao-builder.service.ts` ainda consultam arrays legados. Não existe adaptador geral de peças para esses arrays.

Consequência: peças persistidas no formato novo podem não alimentar placeholders, tabelas e seções condicionais legadas. Uma correção deve escolher fonte canônica e adaptar consumidores; duas escritas independentes aumentariam o risco de divergência.

## Solicitante e origens GDL

Durante a edição B-602, `b602_solicitante_nome` usa primeiro o órgão persistido nos metadados GDL. Sem órgão GDL, deriva do solicitante local escolhido. O valor final é serializado para preservar o texto usado pela REP.

`extrairMetadadosIntegracaoGdl()` aceita a lista atual `origensDisponiveis` e o nome legado `origensCandidatasSolicitacao`. Payload inválido ou JSON quebrado retorna `null`; não há cast direto do conteúdo persistido.

## Envolvidos

O formulário mantém qualificação e nome separados. `combinarEnvolvido()` e `separarEnvolvido()` definem a fronteira:

- nome vazio não gera item
- qualificação vazia preserva o nome
- qualificação sem `:` recebe o separador
- texto legado sem `:` volta integralmente como nome
- no máximo dez itens são serializados

## Falhas na leitura

`deserializeCamposEspecificos()` retorna `{}` para JSON ausente ou inválido. `extrairPecasB602()` filtra objetos sem identidade, origem ou blocos mínimos. `extrairMetadadosIntegracaoGdl()` rejeita a estrutura inteira quando um campo tipado é inválido.

Essas falhas são toleradas para abrir REPs antigas. Ao salvar uma REP cujo JSON foi ignorado, o conteúdo anterior pode ser substituído pelo formato reconstruído.

O main não revalida `campos_especificos`; chamadas IPC externas ao fluxo normal precisam validar o contrato antes de enviar.

## Critérios para evolução

- ampliar o JSON quando o dado pertence exclusivamente ao exame
- criar coluna ou tabela quando o dado precisa de consulta, integridade ou ciclo de vida próprio no main
- passar coleções tipadas pelo contexto do service, não por casts em `REPFormData`
- preservar leitura de nomes antigos antes de remover compatibilidade
- evitar serializar o mesmo conceito em `pecas` e arrays legados sem adaptador determinístico
- versionar ou migrar quando não for possível inferir o formato com segurança

## Verificação

`b602.service.test.ts` cobre o round-trip canônico de peças, metadados e solicitante. `integracao-gdl-b602.utils.test.ts` cobre reidratação, compatibilidade do nome legado e rejeição de payload inválido.

`rep-b602-persistencia.integration.test.ts` registra handlers reais em um SQLite temporário e atravessa serialização, `rep:create`, `rep:update`, `rep:findById`, Mesclar, Substituir e reabertura. O serviço de laudo é isolado por mock, portanto o teste não garante o consumo de `b602.pecas` pelo laudo nem cobre a API GDL real.
