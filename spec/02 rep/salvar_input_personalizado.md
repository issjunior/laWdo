# Persistência dos campos específicos da REP

## Responsabilidade e fluxo

A tabela `reps` guarda campos comuns em colunas e o restante em `campos_especificos`, uma string JSON. A responsabilidade pelo formato interno é do renderer; `rep.handlers.ts` e `rep.service.ts` persistem a string sem validar sua estrutura de domínio.

Fluxo atual:

`formulário → serializeCamposEspecificos() → composição em REPsPage → preload/IPC → rep.handlers → BaseService → SQLite`

Na leitura:

`SQLite → IPC → deserializeCamposEspecificos() + extratores B-602 → formulário e estado de peças`

## Formato por exame

| Código | Escrita | Leitura |
|---|---|---|
| `LOC` | colunas nativas | colunas nativas |
| `I-801` | `numeracaoService` | `numeracaoService` |
| `B-602` | `b602Service` e `incluirPecasB602()` | `b602Service`, `extrairPecasB602()` e `extrairMetadadosIntegracaoGdl()` |

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
    "pecas": []
  },
  "integracaoGdl": {}
}
```

`integracaoGdl` só existe quando há metadados. `b602_solicitante_nome` é derivado na UI e não é gravado pelo `b602Service` atual.

## Composição em duas etapas

`b602Service.serialize()` ainda monta arrays legados de material, cartuchos, estojos e armas a partir dos campos antigos. Em seguida, `incluirPecasB602()`:

1. faz parse do JSON produzido internamente
2. remove `material_enc`, `cartuchos`, `estojos`, `armas` e `armas_toggle`
3. adiciona `b602.pecas`
4. adiciona `integracaoGdl` na raiz quando presente

O parse dessa etapa recebe saída do próprio serializer, não dado externo. Se a origem mudar, precisa ganhar validação ou `try/catch`.

## Compatibilidade de leitura e escrita

| Estrutura | Escrita atual | Leitura atual | Consumidores conhecidos |
|---|---|---|---|
| `b602.envolvidos`, local, BO e IP | sim | sim | formulário e placeholders de investigação |
| `b602.pecas` | sim | sim, por extrator separado | editor de peças e merge GDL |
| `integracaoGdl` | quando disponível | validação estrutural parcial | formulário e nova consulta |
| `material_enc`, `cartuchos`, `estojos`, `armas` | removidos na escrita final | ainda aceitos pelo service legado | preview, placeholders e seções legadas |

Esse é um limite arquitetural atual: o editor novo persiste `b602.pecas`, mas `LaudosPage`, `exportacao-placeholders.ts` e `secao-builder.service.ts` ainda consultam arrays legados. Não existe no fluxo atual um adaptador geral de `pecas` para esses arrays.

Consequência: dados de peças persistidos no formato novo podem não alimentar placeholders, tabelas e seções condicionais que dependem exclusivamente do formato legado. Uma correção deve escolher uma fonte canônica e adaptar os consumidores; manter duas escritas independentes aumenta risco de divergência.

## Envolvidos

O formulário mantém qualificação e nome separados. `combinarEnvolvido()` e `separarEnvolvido()` definem a fronteira:

- nome vazio não gera item
- qualificação vazia preserva o nome
- qualificação sem `:` recebe o separador
- texto legado sem `:` volta integralmente como nome
- no máximo dez itens são serializados pelo formulário

Esses helpers ficam em `shared` porque são usados pelo main e pelo renderer.

## Validação na leitura

`deserializeCamposEspecificos()` retorna `{}` para JSON ausente ou inválido. `extrairPecasB602()` aceita apenas objetos com identidade, origem e blocos mínimos; `extrairMetadadosIntegracaoGdl()` normaliza somente a estrutura reconhecida.

Falhas são toleradas para permitir abrir REPs antigas, mas há uma consequência: ao salvar uma REP cujo JSON inválido foi ignorado, o conteúdo anterior pode ser substituído pelo formato reconstruído a partir do formulário.

O main não revalida `campos_especificos`. Portanto, chamadas IPC externas ao fluxo normal precisam validar o contrato antes de enviar.

## Critérios para evolução

- ampliar o mesmo JSON quando o dado pertence exclusivamente ao exame
- criar coluna ou tabela quando o dado precisa de consulta, integridade ou ciclo de vida próprio no main
- evitar serializar o mesmo conceito em `pecas` e arrays legados sem adaptador determinístico
- preservar leitura de formatos antigos antes de remover código legado
- versionar ou migrar quando não for possível inferir o formato com segurança

## Verificação

Há testes para normalização GDL, catálogo e merge de peças, mas não existe teste direto do round-trip completo `prepareForApi → IPC → edição`, nem teste que garanta consumo de `b602.pecas` pelo laudo.

Qualquer mudança no formato deve verificar:

1. criação e edição da REP
2. round-trip de envolvidos e peças
3. merge e substituição GDL
4. preview da REP
5. placeholders e seções do laudo
6. abertura de JSON legado e inválido
