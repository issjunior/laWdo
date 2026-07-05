# Campos especificos por tipo de exame

## Visao geral

O renderer concentra a extensao de formularios de REP em `src/renderer/components/rep/exam-fields/`.
O ponto de entrada atual e `index.ts`, que mantem quatro registros:

- `SECTION_REGISTRY`: metadados visuais e de validacao de cada secao
- `EXAM_FIELD_MAP`: codigo do tipo de exame -> ids de secao
- `EXAM_SERVICE_REGISTRY`: codigo do tipo de exame -> serializacao/desserializacao
- `EXAM_MENU_REGISTRY`: estruturas de menu de placeholders por exame

Hoje o projeto ja entrega tres familias de campos:

| Codigo | Secoes |
|---|---|
| `LOC` | `local_fato`, `acionamento` |
| `I-801` | `numeracao` |
| `B-602` | `dados_investigacao`, `material_enc`, `cartuchos`, `estojos`, `armas` |

## Contrato das secoes

Cada entrada de `SECTION_REGISTRY` usa a interface `ExamSection`:

```ts
interface ExamSection {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  description: string
  component: React.FC<ExamSectionProps>
  group?: string
  requiredFields: string[]
}
```

Pontos importantes do estado atual:

- `requiredFields` e usado pelo stepper para marcar o passo como concluido
- `group` ainda existe para organizacao visual, mas o fluxo do stepper usa cada secao como passo independente
- `ExamSectionProps` recebe `form` (`UseFormReturn<REPFormData>`) e `mostrarPlaceholders`

## Contrato dos dados

`REPFormData` fica em `exam-fields/types.ts` e hoje funciona como objeto dinamico:

```ts
export interface REPFormData {
  [key: string]: string
  numero: string
  solicitante_id: string
  tipo_exame_id: string
  ...
}
```

Essa assinatura indexada e intencional. Ela permite que formularios com colecoes dinamicas, como B-602, usem chaves como:

- `b602_envolvidos_0`
- `b602_cartuchos_toggle`
- `b602_arma_1_func_toggle`

sem precisar criar uma interface fixa para cada combinacao de linhas.

## Serializacao por tipo

`EXAM_SERVICE_REGISTRY` concentra a logica de persistencia de `campos_especificos`.

Estado atual:

- `I-801` usa `numeracaoService`
- `B-602` usa `b602Service`
- `LOC` nao usa service, porque seus campos continuam em colunas nativas da tabela `reps`

Os helpers publicos de `index.ts` sao:

```ts
serializeCamposEspecificos(codigo, data): string | undefined
deserializeCamposEspecificos(codigo, json): Partial<REPFormData>
```

Regras atuais:

1. `serializeCamposEspecificos` aplica `fieldDefaults` do service antes de chamar `serialize()`
2. o retorno persistido sempre e `JSON.stringify(...)`
3. `deserializeCamposEspecificos` faz `JSON.parse` protegido por `try/catch`
4. se nao houver service para o codigo, o helper retorna `undefined` no save e `{}` na leitura

## Como adicionar um novo tipo hoje

### 1. Criar a secao visual

Adicionar um componente em `exam-fields/` que receba `ExamSectionProps` e use `FormField`, `FormControl` e `FormMessage`.

### 2. Registrar a secao

Adicionar a entrada em `SECTION_REGISTRY` com:

- `id`
- `label`
- `description`
- `component`
- `requiredFields`

### 3. Mapear o codigo do exame

Adicionar o codigo em `EXAM_FIELD_MAP`.

Exemplo conceitual:

```ts
EXAM_FIELD_MAP['MEU-COD'] = ['minha_secao']
```

### 4. Criar o service do exame

Se o exame nao usar apenas colunas nativas:

- criar `exam-fields/services/meu-exame.service.ts`
- implementar `serialize()` e `deserialize()`
- opcionalmente expor `fieldDefaults`
- registrar em `EXAM_SERVICE_REGISTRY`

### 5. Registrar menu e placeholders

Se o tipo precisar de placeholders especificos:

- adicionar a categoria e os campos em `exam-fields/placeholders.ts`
- expor uma estrutura em `EXAM_MENU_REGISTRY` quando houver menu customizado, como o B-602

## Diferenca entre B-602 e os demais

O B-602 hoje e o unico tipo que usa ao mesmo tempo:

- secoes dinamicas multiplas
- toggles por grupo
- menu proprio (`B602_MENU_STRUCTURE`)
- serializacao de listas em `b602Service`
- integracao com laudo para blocos condicionais e repeticao por arma

Por isso ele serve como referencia real para novos tipos complexos.
