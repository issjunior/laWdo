# Stepper do formulario de REP

## Estrutura atual

O formulario principal de REP usa `RepStepper` + `useRepStepper`.
O fluxo esta distribuido em:

- `src/renderer/components/rep/RepStepper.tsx`
- `src/renderer/components/rep/useRepStepper.ts`
- `src/renderer/components/rep/step-registry.ts`
- `src/renderer/components/ui/stepper.tsx`

## Passos fixos e dinamicos

O registro fixo atual fica em `STEP_REGISTRY`:

```ts
[
  {
    id: 'dados-solicitacao',
    label: 'Dados da Solicitacao',
    requiredFields: ['numero', 'data_requisicao', 'tipo_solicitacao', 'numero_documento'],
  },
]
```

Depois do passo fixo, `useRepStepper()` anexa os passos dinamicos derivados de `EXAM_FIELD_MAP[codigo]`.

### Mapeamento atual

| Codigo | Passos dinamicos |
|---|---|
| `LOC` | `Local do Fato`, `Linha do Tempo` |
| `I-801` | `Numeracoes Identificadoras` |
| `B-602` | `Dados da Investigacao`, `Material Encaminhado`, `Cartuchos`, `Estojos`, `Arma` |

## Completude

`useRepStepper()` observa `form.watch()` e monta `completedSteps` em tempo real.

Regra atual:

- se `requiredFields.length === 0`, o passo entra automaticamente em `completedSteps`
- se houver campos obrigatorios, todos precisam estar preenchidos com string nao vazia

Isso e importante no B-602, porque passos como `material_enc`, `cartuchos`, `estojos` e `armas` nao dependem de um campo obrigatorio unico para serem considerados navegaveis.

## Navegacao

`onStepClick(id)`:

1. atualiza `activeStep`
2. procura `document.getElementById('step-' + id)`
3. executa `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`

O destaque visual da secao no formulario depende desse identificador `step-*`.

## Estado local do componente

`useRepStepper()` mantem:

- `activeStep`
- `collapsed`
- `completedSteps`
- `steps`

O estado de colapso e puramente visual e nao altera o conjunto de passos calculados.

## Dependencia do tipo de exame

Se `tipoExameSelecionado?.codigo` estiver ausente:

- o stepper mostra apenas `Dados da Solicitacao`
- nenhum passo dinamico e montado

Quando o codigo aparece, `getDynamicSteps(codigo)` transforma cada entrada do `SECTION_REGISTRY` em um `Step` com id `section-{secao.id}`.

## Relacao com `requiredFields`

O contrato entre `step-registry.ts` e `exam-fields/index.ts` e este:

- passo fixo: `requiredFields` definidos em `STEP_REGISTRY`
- passo dinamico: `requiredFields` lidos de `SECTION_REGISTRY`

Qualquer nova secao adicionada a um exame precisa declarar `requiredFields`, mesmo que seja um array vazio.

## Regra pratica de manutencao

Quando um exame ganhar nova secao:

1. atualizar `SECTION_REGISTRY`
2. atualizar `EXAM_FIELD_MAP`
3. conferir se `requiredFields` refletem o criterio real de conclusao do passo

Sem isso, o stepper continua renderizando o passo, mas perde o comportamento correto de completude.
