# B-602 no formulario de REP

## Visao geral

O B-602 e o tipo de exame mais completo do projeto em termos de campos especificos.
Hoje ele aparece no renderer por meio de cinco secoes dinamicas registradas em `SECTION_REGISTRY`:

- `dados_investigacao`
- `material_enc`
- `cartuchos`
- `estojos`
- `armas`

O codigo do exame aponta para essas secoes via:

```ts
EXAM_FIELD_MAP['B-602'] = [
  'dados_investigacao',
  'material_enc',
  'cartuchos',
  'estojos',
  'armas',
]
```

## Contrato visual minimo

### Dados da investigacao

E a secao base do B-602.
Ela centraliza:

- envolvidos indexados (`b602_envolvidos_0` ... `b602_envolvidos_9`)
- `b602_data_ocorrencia`
- `b602_local_bairro`
- `b602_local_cidade`
- `b602_local_uf`
- `b602_numero_bo`
- `b602_numero_ip`
- `b602_solicitante_nome`

No registro da secao, os campos obrigatorios atuais sao:

```ts
['b602_envolvidos_0', 'b602_data_ocorrencia', 'b602_local_cidade', 'b602_local_uf']
```

### Material encaminhado, cartuchos, estojos e armas

Essas secoes entram no stepper como passos independentes, mas sem `requiredFields`.
Por isso o stepper as marca como concluidas por definicao quando o usuario chega a esse fluxo.

## Toggles topo do exame

`EXAM_TOGGLES` registra hoje tres toggles de primeiro nivel para o B-602:

- `b602_cartuchos_toggle`
- `b602_estojos_toggle`
- `b602_armas_toggle`

Eles servem tanto para UI quanto para o pipeline do editor de laudo.

## Menu de placeholders

O B-602 tambem e o unico exame com menu proprio registrado em `EXAM_MENU_REGISTRY`.

```ts
EXAM_MENU_REGISTRY['B-602'] = B602_MENU_STRUCTURE
```

Isso alimenta:

- o menu de contexto do editor
- os placeholders indexados por grupo
- as tabelas completas do exame na exportacao

## Persistencia

O exame usa `b602Service`, registrado em `EXAM_SERVICE_REGISTRY`.
O JSON persistido fica sob a chave `b602` e inclui:

- dados de investigacao
- arrays de `material_enc`
- arrays de `cartuchos`
- arrays de `estojos`
- arrays de `armas`

## Relacao com o laudo

O B-602 nao termina no formulario.
Seus dados sao reutilizados em tres frentes:

1. placeholders simples e tabelas do laudo
2. blocos condicionais por toggle
3. secoes repetiveis por arma

Por isso qualquer alteracao estrutural no B-602 precisa considerar renderer, service de serializacao e builder do laudo ao mesmo tempo.
