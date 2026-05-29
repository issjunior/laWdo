# Padrão de Formulários — Laudo Pericial

> **Arquivo de referência para implementação de formulários no projeto.**
> Criado em: 2026-05-11 | Plano: padronização UX REPsPage + LaudosPage

---

## 1. Componentes shadcn/ui para Formulários

### Accordion (seções de formulário)

**Arquivo:** `src/renderer/components/ui/accordion.tsx`
**Instalação:** `npx shadcn@latest add accordion`

**Uso padrão para seções de formulário:**

```tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { FileText, User, Clock3, Link2 } from 'lucide-react';

// No JSX do formulário:
<Accordion type="multiple" defaultValue={["dados-solicitacao", "envolvido-local", "documentos"]}>
  <AccordionItem value="dados-solicitacao">
    <AccordionTrigger className="text-sm font-semibold">
      <span className="inline-flex items-center gap-2">
        <FileText size={14} />
        Dados da Solicitação
      </span>
    </AccordionTrigger>
    <AccordionContent>
      <p className="text-xs text-muted-foreground mb-4">
        Informações principais da requisição.
      </p>
      {/* Grid de campos aqui */}
    </AccordionContent>
  </AccordionItem>
  {/* ... mais itens */}
</Accordion>
```

**Regras:**
- Sempre usar `type="multiple"` para formulários (várias seções abertas)
- `defaultValue` deve incluir todas as seções com campos obrigatórios
- Seções condicionais (ex: só aparece para exame local) não devem estar no `defaultValue`
- Ícone da seção dentro do `AccordionTrigger`, antes do texto
- Descrição da seção como `<p className="text-xs text-muted-foreground">` dentro do `AccordionContent`

### Collapsible (toggle de conteúdo)

**Arquivo:** `src/renderer/components/ui/collapsible.tsx` (já instalado)

**Uso padrão para editor multi-seção:**

```tsx
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown } from 'lucide-react';

// No JSX:
<Collapsible open={isOpen} onOpenChange={setIsOpen}>
  <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 rounded-t-lg transition-colors">
    <h3 className="text-base font-semibold">{titulo}</h3>
    <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* Conteúdo aqui */}
  </CollapsibleContent>
</Collapsible>
```

**Regras:**
- Manter estado `open` e `onOpenChange` para controle
- Chevron com classe `group-data-[state=open]:rotate-180` para animação
- NÃO usar `forceMount` com editores que precisam medir dimensões no init

### Tooltip (ajuda contextual)

**Arquivo:** `src/renderer/components/ui/tooltip.tsx` (já instalado)

**Substitui:** Componente `HelpIcon` CSS customizado

**Uso padrão:**

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// No JSX:
<Tooltip>
  <TooltipTrigger asChild>
    <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border border-muted-foreground/40 text-[10px] text-muted-foreground font-semibold cursor-help ml-1.5">
      ?
    </span>
  </TooltipTrigger>
  <TooltipContent side="top">
    <p className="max-w-[250px] text-xs">{textoDeAjuda}</p>
  </TooltipContent>
</Tooltip>
```

**Regras:**
- Se já houver `TooltipProvider` no ancestral, usar apenas `<Tooltip>`
- `side="top"` para não sobrepor campos abaixo
- `asChild` no `TooltipTrigger` para preservar estilização do span
- Texto no `TooltipContent` com `max-w-[250px]` para evitar overflow

### Alert (feedback)

**Arquivo:** `src/renderer/components/ui/alert.tsx` (já instalado)

**Padrão de Alert de erro:**

```tsx
{error && (
  <Alert variant="destructive">
    <AlertDescription>{error}</AlertDescription>
  </Alert>
)}
```

**Padrão de Alert de sucesso (com dark mode):**

```tsx
{success && (
  <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900/50">
    <AlertDescription className="text-green-800 dark:text-green-400">
      {success}
    </AlertDescription>
  </Alert>
)}
```

**Regras:**
- Erro: usar `variant="destructive"` (shadcn lida com cores)
- Sucesso: classes manuais com `dark:` obrigatório
- Auto-dismiss com `setTimeout(() => setSuccess(null), 3000)`
- Erro na listagem: exibir ANTES do Card, igual ao LaudosPage

---

## 2. react-hook-form + Form Component

### Schema e useForm

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/forms/form';

const schema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido').optional(),
});

type FormValues = z.infer<typeof schema>;

function MeuForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: '', email: '' },
    mode: 'onBlur',  // Valida ao sair do campo
  });

  const onSubmit = form.handleSubmit(async (data) => {
    // data já validado
    await api.save(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit}>
        {/* campos */}
      </form>
    </Form>
  );
}
```

### Campo Input simples

```tsx
<FormField
  control={form.control}
  name="nome"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Nome *</FormLabel>
      <FormControl>
        <Input placeholder="Digite o nome" {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Campo Input com máscara

```tsx
<FormField
  control={form.control}
  name="numero"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Nº da REP *</FormLabel>
      <FormControl>
        <Input
          placeholder="000.000-2026"
          value={field.value}
          onChange={e => field.onChange(formatarMascara(e.target.value))}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Campo Select

```tsx
<FormField
  control={form.control}
  name="tipo"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Tipo *</FormLabel>
      <Select value={field.value} onValueChange={field.onChange}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="A">Opção A</SelectItem>
          <SelectItem value="B">Opção B</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Side-effect com watch

```tsx
const tipoExameId = form.watch('tipo_exame_id');

useEffect(() => {
  form.setValue('template_id', '', { shouldValidate: false });
}, [tipoExameId]);
```

### Preencher formulário ao editar

```tsx
const handleEditar = async (item) => {
  const dados = await api.findById(item.id);
  form.reset({
    nome: dados.nome,
    email: dados.email || '',
    // ... todos os campos
  });
};
```

### Limpar formulário

```tsx
const handleCancelar = () => {
  form.reset(defaultValues);
};
```

---

## 3. Padrão de Lista + Formulário

### Estrutura da página

```tsx
export const MinhaPage: React.FC = () => {
  const [editando, setEditando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modo formulário
  if (editando) {
    return <MeuFormulario onCancelar={() => setEditando(false)} />;
  }

  // Modo lista
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <CabecalhoPagina titulo="..." descricao="..." botaoNovo />
      
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      
      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>{dados.length} registro(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={colunas} data={dados} ... />
        </CardContent>
      </Card>
    </div>
  );
};
```

---

## 4. Anti-Padrões (NÃO FAZER)

| Anti-padrão | Motivo | Alternativa |
|---|---|---|
| `alert()` nativo para erros | Bloqueia UI, não tem tema | `setError()` + `<Alert variant="destructive">` |
| `confirm()` nativo para exclusão | OK para ações simples, mas prefira AlertDialog para fluxos complexos | Manter `confirm()` para exclusão simples |
| Gerenciar `formData` com `useState` por campo | Boilerplate excessivo, propenso a bugs | `useForm` + `zodResolver` |
| Validar com `safeParse` manual | Duplicação de lógica do Zod | `zodResolver` no `useForm` |
| Erros manuais `<p className="text-red-600">` | Inconsistente, sem aria | `<FormMessage />` (automático) |
| Classes de cor sem prefixo `dark:` | Quebra no tema escuro | Sempre adicionar `dark:` equivalente |
| Importações não utilizadas | Polui o código, falsos positivos no lint | Remover imports fantasmas |
| `forceMount` com editores ricos (TinyMCE) | Editor inicializa com dimensão zero | Deixar seção aberta no primeiro render |

---

## 5. Check-list de Verificação

Ao implementar um formulário com este padrão, verificar:

- [ ] Schema Zod define campos obrigatórios com `.min(1, ...)`
- [ ] `mode: 'onBlur'` no `useForm`
- [ ] `FormField` para cada campo (render prop pattern)
- [ ] `FormMessage` em cada `FormItem`
- [ ] Máscaras usam `value` + `onChange` wrapper, não `{...field}`
- [ ] Selects usam `value={field.value}` + `onValueChange={field.onChange}`
- [ ] `form.reset(dados)` ao editar
- [ ] `form.reset(defaultValues)` ao cancelar
- [ ] `form.handleSubmit(onSubmit)` no submit
- [ ] Alert de erro com `variant="destructive"` (cores automáticas)
- [ ] Alert de sucesso com `dark:` nas classes manuais
- [ ] Accordion com `type="multiple"` e `defaultValue` para seções obrigatórias
- [ ] Tooltip com `side="top"` e `asChild` no trigger
- [ ] Se `TooltipProvider` já existe no ancestral, não duplicar
- [ ] Nenhum `alert()` nativo para feedback de erro
- [ ] Nenhum import fantasma
- [ ] `npm run build` sem erros
- [ ] `npm run lint` sem novos warnings
