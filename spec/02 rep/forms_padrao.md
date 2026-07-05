# Padrao atual dos formularios do renderer

## Base tecnica

O renderer usa como pilha padrao:

- `react-hook-form`
- `zod`
- wrappers de `src/renderer/components/forms/form.tsx`
- componentes `ui/` do design system local

O arquivo `form.tsx` hoje fornece o contrato minimo para qualquer formulario com acessibilidade consistente:

- `FormField` para ligar `Controller` ao contexto
- `FormItem` para gerar ids estaveis
- `FormLabel`, `FormControl` e `FormMessage` para amarrar rotulo, controle e erro

## Como os campos basicos sao tratados

### Inputs textuais

Entram dentro de `FormControl` e herdaram:

- `id`
- `aria-describedby`
- `aria-invalid`

### Selects

O padrao do projeto e colocar `SelectTrigger` dentro de `FormControl`.
Isso garante o mesmo encadeamento de ids e mensagens usado pelos inputs comuns.

### Mensagens

O erro visivel vem de `FormMessage`.
Quando o campo nao possui erro do `react-hook-form`, ele pode exibir `children` como mensagem auxiliar.

## Contrato implicito do projeto

Hoje, qualquer formulario novo que queira seguir o padrao da base precisa:

1. usar `FormProvider` via `Form`
2. renderizar cada campo com `FormField`
3. manter `FormLabel`, `FormControl` e `FormMessage` no mesmo `FormItem`

Esse contrato evita:

- ids duplicados
- labels sem `htmlFor`
- mensagens de erro soltas fora da relacao com o controle

## Ligacao com a REP

No fluxo de REP, esse padrao se combina com:

- `REPFormData` dinamico
- componentes de `exam-fields/`
- stepper com `requiredFields`

Ou seja: o formulario principal pode variar por tipo de exame, mas o contrato de campo continua sendo o mesmo.
