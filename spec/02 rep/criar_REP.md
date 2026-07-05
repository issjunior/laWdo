# Ciclo atual de criacao e edicao de REP

## Contrato persistido

O contrato de linha persistida da REP esta em `src/renderer/lib/validators/rep.schema.ts`.

Campos centrais:

- `id`: UUID
- `numero`: obrigatorio, formato `000-AAAA` ou `000.000-AAAA`
- `solicitante_id`, `tipo_exame_id`, `usuario_id`: UUIDs opcionais/nulos
- `data_requisicao`: obrigatoria
- `tipo_solicitacao`: obrigatoria
- `numero_documento`: obrigatorio
- `status`: default `Pendente`
- `observacoes`: texto opcional
- `campos_especificos`: string JSON opcional

Campos numericos persistidos como numero no schema:

- `latitude`
- `longitude`

## Numero da REP

O schema hoje aceita:

```regex
/^(\d{1,3}|\d{1,3}\.\d{3})-\d{4}$/
```

Exemplos validos:

- `1-2026`
- `045-2026`
- `123.456-2026`

## Estado e consultas no main

`src/main/services/rep.service.ts` cobre a camada de consulta e status:

- `findAllOrdered()`
- `findByStatus(status)`
- `findByNumero(numero)`
- `updateStatus(id, status)`

O service nao reconstrui o formulario do renderer; ele entrega e atualiza a linha da tabela `reps`.

## Campos especificos

O create/edit da REP continua com dois caminhos de dados:

- campos fixos em colunas nativas
- payload variavel em `campos_especificos`

Hoje:

- `LOC` usa colunas nativas de local e acionamento
- `I-801` serializa JSON proprio
- `B-602` serializa um bloco `b602` com listas e toggles

## Papel do tipo de exame

O tipo de exame controla:

1. quais secoes do formulario aparecem
2. quais campos contam para completude do stepper
3. se a persistencia adicional vai para `campos_especificos`

Essa decisao nao fica no `rep.service.ts`; ela nasce no renderer a partir de `EXAM_FIELD_MAP` e `EXAM_SERVICE_REGISTRY`.

## Status da REP

No estado atual, a REP continua com os status operacionais usados pelos fluxos do sistema, incluindo `Pendente`.
Ja o laudo usa a propria maquina de estados (`Em andamento`, `Concluido`, `Entregue`).

Essa separacao e importante: excluir ou reabrir laudo pode levar a REP de volta para `Pendente`, mas isso acontece no fluxo de laudo e auditoria, nao no schema da REP.
