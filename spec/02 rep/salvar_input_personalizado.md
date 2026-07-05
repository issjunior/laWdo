# Persistencia dos campos especificos da REP

## Visao geral

O estado atual separa os dados da REP em dois grupos:

- colunas nativas da tabela `reps`
- JSON de `campos_especificos`

O renderer decide para qual grupo cada valor vai antes do envio ao IPC.

## Onde a logica mora

O ponto central e `src/renderer/components/rep/exam-fields/index.ts`.

Funcoes publicas:

```ts
serializeCamposEspecificos(codigo, data)
deserializeCamposEspecificos(codigo, json)
```

## Regras atuais de serializacao

### Exames com service

Hoje dois codigos usam service dedicado:

- `I-801`
- `B-602`

Fluxo:

1. o codigo do tipo de exame resolve um service em `EXAM_SERVICE_REGISTRY`
2. o helper copia `data` para `dataWithDefaults`
3. aplica `fieldDefaults` quando houver campo vazio
4. chama `service.serialize(...)`
5. persiste `JSON.stringify(...)`

### Exames sem service

`LOC` nao grava `campos_especificos`.
Os campos de local e acionamento continuam em colunas nativas da REP.

## Regras atuais de leitura

`deserializeCamposEspecificos(codigo, json)` segue este comportamento:

- sem JSON -> retorna `{}`
- sem service -> retorna `{}`
- JSON invalido -> retorna `{}`
- JSON valido -> delega para `service.deserialize(...)`

Isso evita quebrar a edicao de REPs antigas quando o payload esta incompleto ou malformado.

## Papel do `REPFormData`

`REPFormData` usa assinatura indexada (`[key: string]: string`) para acomodar nomes dinamicos.

Isso permite restaurar diretamente campos como:

- `b602_envolvidos_0`
- `b602_local_uf`
- `b602_armas_toggle`

sem precisar criar um tipo fechado por linha do formulario.

## Papel do `rep.service.ts`

`src/main/services/rep.service.ts` nao conhece a estrutura interna de `campos_especificos`.
O service trabalha no nivel da linha persistida:

- `findAllOrdered()`
- `findByStatus(status)`
- `findByNumero(numero)`
- `updateStatus(id, status)`

Toda a montagem e desmontagem do JSON segue no renderer e nos handlers de REP.

## B-602

No estado atual, o B-602 e o caso mais completo de persistencia:

- listas (`envolvidos`, `material_enc`, `cartuchos`, `estojos`, `armas`)
- toggles de colecao
- toggles por arma (`func_toggle`, `coleta_toggle`)
- local quebrado em `bairro`, `cidade`, `uf`

Esse conjunto e serializado sob a chave `b602` no JSON.

## I-801

O I-801 usa o mesmo pipeline, mas com payload menor e focado em numeracao.
Ele continua sendo a referencia de exame com poucos campos, enquanto o B-602 cobre o caso de multiplas linhas e grupos.

## Regra pratica de manutencao

Quando um campo especifico novo nao esta salvando ou restaurando:

1. verificar se o codigo do exame esta em `EXAM_SERVICE_REGISTRY`
2. conferir `serialize()` e `deserialize()` do service
3. confirmar se o nome do campo no formulario bate com a chave que o service espera
4. validar se o exame deveria usar JSON ou coluna nativa
