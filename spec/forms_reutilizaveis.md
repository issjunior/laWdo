# Padrão: Formulários Reutilizáveis (Quick-Create)

## Objetivo

Permitir que formulários de cadastro de entidades (Solicitante, Tipo de Exame, etc.) possam ser reutilizados como **quick-create dialogs** dentro de outros formulários principais (ex: formulário da REP), sem duplicação de código.

## Estrutura de arquivos

```
src/renderer/
├── components/
│   ├── solicitantes/
│   │   └── SolicitanteFormFields.tsx   ← campos extraídos (shared)
│   └── tipos-exame/
│       └── TipoExameFormFields.tsx     ← campos extraídos (shared)
├── pages/
│   ├── SolicitantesPage.tsx            ← consome SolicitanteFormFields
│   ├── TiposExamePage.tsx              ← consome TipoExameFormFields
│   └── REPsPage.tsx                    ← consome ambos via quick-create dialogs
└── lib/validators/                     ← schemas e tipos Zod (já existentes)
```

## Passo a passo para reutilizar um formulário

### 1. Extrair campos para um componente compartilhado

Crie `src/renderer/components/<entidade>/<Entidade>FormFields.tsx` contendo **apenas os campos do formulário** (sem Dialog, DialogHeader, DialogFooter, etc.).

**Props do componente:**

| Prop | Tipo | Descrição |
|---|---|---|
| `formData` | `Create<Entidade>Input` | Dados atuais do formulário (tipo inferido do Zod via `@/lib/validators`) |
| `onChange` | `(data: Create<Entidade>Input) => void` | Callback para atualizar os dados |
| `errors` | `Partial<Record<keyof ..., string>>` | (opcional) Erros de validação por campo |
| `error` | `string \| null` | (opcional) Mensagem de erro geral |
| `success` | `string \| null` | (opcional) Mensagem de sucesso |

**Exemplo:** `SolicitanteFormFields.tsx`
```tsx
import React from 'react';
import { Input } from '@/components/ui/input';
import type { CreateSolicitanteInput } from '@/lib/validators';

interface SolicitanteFormFieldsProps {
  formData: CreateSolicitanteInput;
  onChange: (data: CreateSolicitanteInput) => void;
  errors?: Partial<Record<keyof CreateSolicitanteInput, string>>;
  error?: string | null;
  success?: string | null;
}

export const SolicitanteFormFields: React.FC<SolicitanteFormFieldsProps> = ({
  formData, onChange, errors = {}, error: generalError, success,
}) => (
  <div className="space-y-4 py-4">
    <div className="grid grid-cols-1 gap-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Solicitante *</label>
        <Input
          value={formData.nome}
          onChange={e => onChange({ ...formData, nome: e.target.value })}
          className={errors.nome ? 'border-red-500' : ''}
        />
        {errors.nome && <p className="text-xs text-red-600">{errors.nome}</p>}
      </div>
      {/* ... demais campos */}
    </div>
    {generalError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{generalError}</div>}
    {success && <div className="text-sm text-green-600 bg-green-50 p-3 rounded">{success}</div>}
  </div>
);
```

### 2. Refatorar a página original

Substitua o JSX inline dos campos pelo componente compartilhado. Remova imports que ficaram sem uso (ex: `Input`, `Textarea` se só eram usados nos campos extraídos).

```tsx
// ANTES (código inline duplicado)
<div className="space-y-4 py-4">
  <div className="space-y-2">
    <label htmlFor="nome">Solicitante *</label>
    <Input id="nome" value={formData.nome} onChange={...} />
  </div>
  {/* ...mais campos... */}
</div>

// DEPOIS (componente compartilhado)
import { SolicitanteFormFields } from '@/components/solicitantes/SolicitanteFormFields';

<SolicitanteFormFields
  formData={formData}
  onChange={setFormData}
  errors={errors}
  error={error}
  success={success}
/>
```

### 3. Consumir em um quick-create dialog (REPsPage)

No formulário de destino, adicione:

- **Ícone** `ClipboardPen` (lucide-react) após o label, com `onClick` que abre o dialog
- **Estados** do dialog: `open`, `formData`, `errors`, `error`, `submitting`
- **Handler** `handleSalvar<Entidade>QC` que valida, chama a API, recarrega a lista e seleciona o novo item
- **Dialog** contendo o `<Entidade>FormFields>` + botões Cancelar/Criar

#### 3.1 Ícone no label

```tsx
<LabelWithPlaceholder field="solicitante_id" mostrar={mostrarPlaceholders}>
  Solicitante{' '}
  <ClipboardPen
    size={14}
    className="inline cursor-pointer text-muted-foreground hover:text-primary"
    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setSolicitanteQCOpen(true); }}
  />
</LabelWithPlaceholder>
```

#### 3.2 Estados

```tsx
import { createSolicitanteSchema, type CreateSolicitanteInput } from '@/lib/validators/solicitante.schema';

const [solicitanteQCOpen, setSolicitanteQCOpen] = useState(false);
const [solicitanteQCFormData, setSolicitanteQCFormData] = useState<CreateSolicitanteInput>({
  nome: '', tipo: '', endereco: '', telefone: '', email: ''
});
const [solicitanteQCErrors, setSolicitanteQCErrors] = useState<Partial<Record<keyof CreateSolicitanteInput, string>>>({});
const [solicitanteQCError, setSolicitanteQCError] = useState<string | null>(null);
const [solicitanteQCSubmitting, setSolicitanteQCSubmitting] = useState(false);
```

#### 3.3 Handler de salvamento

```tsx
const handleSalvarSolicitanteQC = async () => {
  setSolicitanteQCError(null);
  setSolicitanteQCErrors({});

  // Validação via Zod
  const validation = createSolicitanteSchema.safeParse(solicitanteQCFormData);
  if (!validation.success) {
    const fieldErrors: Partial<Record<keyof CreateSolicitanteInput, string>> = {};
    validation.error.errors.forEach((err) => {
      const field = err.path[0] as keyof CreateSolicitanteInput;
      fieldErrors[field] = err.message;
    });
    setSolicitanteQCErrors(fieldErrors);
    return;
  }

  try {
    setSolicitanteQCSubmitting(true);
    const r = await window.ipcAPI.solicitante.create(solicitanteQCFormData);
    if (r.success) {
      // Recarrega a lista de opções do dropdown
      await carregarSolicitantes();
      // Seleciona automaticamente o novo registro
      if (r.data?.id) form.setValue('solicitante_id', r.data.id);
      // Fecha e limpa
      setSolicitanteQCOpen(false);
      setSolicitanteQCFormData({ nome: '', tipo: '', endereco: '', telefone: '', email: '' });
    } else {
      setSolicitanteQCError(r.error || 'Erro ao criar solicitante');
    }
  } catch (e: any) {
    setSolicitanteQCError(e.message);
  } finally {
    setSolicitanteQCSubmitting(false);
  }
};
```

#### 3.4 JSX do Dialog

```tsx
<Dialog open={solicitanteQCOpen} onOpenChange={setSolicitanteQCOpen}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Novo Solicitante</DialogTitle>
      <DialogDescription>
        Preencha as informações para cadastrar um novo solicitante.
      </DialogDescription>
    </DialogHeader>
    <SolicitanteFormFields
      formData={solicitanteQCFormData}
      onChange={setSolicitanteQCFormData}
      errors={solicitanteQCErrors}
      error={solicitanteQCError}
    />
    <div className="flex justify-end gap-3 pt-2">
      <Button variant="outline" onClick={() => setSolicitanteQCOpen(false)} disabled={solicitanteQCSubmitting}>
        Cancelar
      </Button>
      <Button onClick={handleSalvarSolicitanteQC} disabled={solicitanteQCSubmitting}>
        {solicitanteQCSubmitting ? 'Criando...' : 'Criar'}
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

## Fluxo de uso para o usuário final

1. Usuário está preenchendo o formulário principal (ex: Nova REP)
2. Clica no ícone `🖊` ao lado do label "Solicitante" ou "Tipo de Exame"
3. Abre um dialog com o formulário de cadastro rápido
4. Preenche os campos e clica em "Criar"
5. O dialog fecha e o dropdown é automaticamente atualizado com o novo registro já selecionado
6. O usuário continua preenchendo o formulário principal sem interrupção

## Como adicionar quick-create para uma nova entidade

Siga os mesmos 3 passos:

1. **Extraia** `src/renderer/components/<entidade>/<Entidade>FormFields.tsx` a partir dos campos do dialog da página `<Entidade>Page.tsx`
2. **Refatore** `<Entidade>Page.tsx` para usar o componente compartilhado
3. No formulário destino (ex: `REPsPage.tsx`):
   - Importe `ClipboardPen` do lucide-react
   - Adicione o ícone após o label (`<ClipboardPen size={14} ... />`)
   - Adicione os estados `*QCOpen`, `*QCFormData`, `*QCErrors`, `*QCError`, `*QCSubmitting`
   - Adicione o handler `handleSalvar*QC` (validar → API → recarregar lista → `form.setValue` → fechar)
   - Adicione o `<Dialog>` com `<EntidadeFormFields>`
