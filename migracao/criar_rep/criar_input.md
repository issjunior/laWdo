# Como criar inputs específicos para um novo tipo de exame

Quando um novo tipo de exame (ex: `MEU-COD`) precisa de campos próprios no formulário de REP, siga estes 3 passos.

---

## Passo 1 — Criar o componente de campos

Crie um arquivo em `src/renderer/components/rep/exam-fields/seu-tipo.tsx`:

```tsx
import React from 'react';
import { FormField, FormItem, FormControl, FormMessage } from '@/components/forms/form';
import { Input } from '@/components/ui/input';
import type { ExamSectionProps } from './types';

export const SeuTipoFields: React.FC<ExamSectionProps> = ({ form }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField
      control={form.control}
      name="meu_campo_x"
      render={({ field }) => (
        <FormItem>
          <label className="text-sm font-medium leading-none">
            Campo X
          </label>
          <FormControl>
            <Input placeholder="..." {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={form.control}
      name="meu_campo_y"
      render={({ field }) => (
        <FormItem>
          <label className="text-sm font-medium leading-none">
            Campo Y
          </label>
          <FormControl>
            <Input placeholder="..." {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>
);
```

**Regras:**
- Cada `<FormField>` usa `control={form.control}` e um `name` único (ex: `meu_campo_x`).
- O `name` é a chave que liga o input ao `REPFormData` e ao JSON de persistência.
- Use os componentes shadcn/ui (`Input`, `Textarea`, `Select`, etc.) para consistência visual.

---

## Passo 2 — Registrar no Section Registry

Edite `src/renderer/components/rep/exam-fields/index.ts`:

### 2a. Adicionar ao `SECTION_REGISTRY`

```ts
import { SeuTipoFields } from './seu-tipo';

export const SECTION_REGISTRY: Record<string, ExamSection> = {
  // ... existentes (local_fato, acionamento, numeracao) ...
  meu_tipo: {
    id: 'meu_tipo',
    label: 'Nome da Seção',
    icon: MeuIcone,       // import de lucide-react
    description: 'Descrição do que esses campos representam',
    component: SeuTipoFields,
    group: null,          // ou 'envolvido-local' se agrupado
  },
};
```

### 2b. Mapear código GDL → seções

```ts
export const EXAM_FIELD_MAP: Record<string, string[]> = {
  'LOC':   ['local_fato', 'acionamento'],
  'I-801': ['numeracao'],
  'MEU-COD': ['meu_tipo'],   // ← novo mapeamento
};
```

A partir daqui, ao selecionar o tipo `MEU-COD` no formulário, o Nível 3 já exibirá a seção (quando desbloqueado).

---

## Passo 3 — Conectar à pipeline de dados

Edite `src/renderer/pages/REPsPage.tsx` em 4 pontos:

### 3a. `REPFormData` (tipagem)

No arquivo `src/renderer/components/rep/exam-fields/types.ts`, adicione os novos campos ao `REPFormData`:

```ts
export interface REPFormData {
  // ... existentes ...
  meu_campo_x: string;
  meu_campo_y: string;
}
```

### 3b. `emptyForm()` (valores iniciais)

Adicione os defaults:

```ts
const emptyForm = (): REPFormData => ({
  // ... existentes ...
  meu_campo_x: '',
  meu_campo_y: '',
});
```

### 3c. `repFormSchema` (validação condicional)

Adicione as regras no `superRefine`:

```ts
// Na definição base do schema, os campos são opcionais:
meu_campo_x: z.string().optional(),
meu_campo_y: z.string().optional(),

// No superRefine, eles viram required apenas quando o tipo exige:
if (sections.includes('meu_tipo') && !data.meu_campo_x?.trim()) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Campo X é obrigatório para este tipo de exame',
    path: ['meu_campo_x'],
  });
}
```

Para revalidar ao trocar de tipo, adicione os paths ao `form.trigger()`:

```ts
useEffect(() => {
  if (tipoExameId) {
    form.trigger(['local_fato', 'numeracao_descricao', 'meu_campo_x']);
  }
}, [tipoExameId]);
```

### 3d. `buildCamposEspecificos()` (serialização para save)

```ts
function buildCamposEspecificos(data: REPFormData, codigo: string): string | undefined {
  if (codigo === 'I-801') {
    return JSON.stringify({
      numeracao: {
        descricao: data.numeracao_descricao || '',
        observacoes: data.numeracao_observacoes || '',
      },
    });
  }
  if (codigo === 'MEU-COD') {
    return JSON.stringify({
      meu_tipo: {
        campo_x: data.meu_campo_x || '',
        campo_y: data.meu_campo_y || '',
      },
    });
  }
  return undefined;
}
```

### 3e. `parseCamposEspecificos()` (desserialização para edit)

```ts
function parseCamposEspecificos(json: string | null | undefined): Partial<REPFormData> {
  if (!json) return {};
  try {
    const data = JSON.parse(json);
    return {
      numeracao_descricao: data.numeracao?.descricao || '',
      numeracao_observacoes: data.numeracao?.observacoes || '',
      meu_campo_x: data.meu_tipo?.campo_x || '',
      meu_campo_y: data.meu_tipo?.campo_y || '',
    };
  } catch {
    return {};
  }
}
```

**Pronto.** O `prepareForApi()` e o `handleEditar()` já chamam essas funções automaticamente.

---

## Resumo do fluxo de dados

```
FORM (REPFormData)
  │
  │  Campos comuns (numero, data_requisicao, etc.) → colunas nativas da tabela reps
  │  Campos LOC (local_fato, lat, lon, datas)      → colunas nativas da tabela reps
  │  Campos MEU-COD (meu_campo_x, meu_campo_y)     → JSON.stringify → reps.campos_especificos
  │
  ▼
prepareForApi(data, codigo)
  │
  ▼
IPC handler → SQLite reps
  │
  ▼
Edição: parseCamposEspecificos(reps.campos_especificos) → form.reset({...campos})
```

---

## Checklist para novo tipo

- [ ] `exam-fields/seu-tipo.tsx` — componente React com `FormField` usando `name="..."` único
- [ ] `exam-fields/index.ts` — `SECTION_REGISTRY` + `EXAM_FIELD_MAP`
- [ ] `exam-fields/types.ts` — `REPFormData` com os novos campos
- [ ] `REPsPage.tsx` — `emptyForm()` com defaults
- [ ] `REPsPage.tsx` — `repFormSchema.superRefine` com validação condicional
- [ ] `REPsPage.tsx` — `form.trigger([...])` com os paths dos novos campos
- [ ] `REPsPage.tsx` — `buildCamposEspecificos()` com serialização JSON
- [ ] `REPsPage.tsx` — `parseCamposEspecificos()` com desserialização JSON
