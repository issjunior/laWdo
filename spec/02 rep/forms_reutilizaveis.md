# Wrappers reutilizaveis de formulario

## Arquivo base

`src/renderer/components/forms/form.tsx` concentra os wrappers usados com `react-hook-form`.

Os exports atuais sao:

- `Form`
- `FormItem`
- `FormLabel`
- `FormControl`
- `FormMessage`
- `FormField`

## Como funciona

### `Form`

`Form` e apenas um alias de `FormProvider`.
Ele injeta o contexto do `react-hook-form` para todo o subtree.

### `FormField`

`FormField` envolve `Controller` e publica o `name` em um contexto local:

```ts
const FormFieldContext = React.createContext<FormFieldContextValue>(...)
```

Esse contexto e lido depois por `useFormField()`.

### `FormItem`

`FormItem` cria um `id` estavel com `React.useId()` e o entrega por outro contexto.
Esse id vira a base de:

- `formItemId`
- `formDescriptionId`
- `formMessageId`

## Acessibilidade

`FormControl` injeta automaticamente:

- `id`
- `aria-describedby`
- `aria-invalid`

Com isso, qualquer `Input`, `SelectTrigger` ou `Textarea` encaixado no `Slot` recebe a ligacao correta com label e erro.

## Tratamento de erro

`FormMessage` usa a prioridade:

1. `error.message` do `react-hook-form`
2. `children`, quando nao ha erro formal

Se nao houver mensagem nenhuma, ele retorna `null`.

## Regra de uso

O padrao atual do projeto e:

```tsx
<FormField
  control={form.control}
  name="campo"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Campo</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

Esse padrao aparece nos formularios de REP, configuracao de IA e outros fluxos do renderer.

## Restricao importante

`useFormField()` depende dos dois contextos internos.
Isso significa:

- `FormLabel`
- `FormControl`
- `FormMessage`

so devem ser usados dentro do subtree de `FormField` + `FormItem`.

Se usados fora desse arranjo, o componente perde os ids derivados e a ligacao correta com o estado do campo.
