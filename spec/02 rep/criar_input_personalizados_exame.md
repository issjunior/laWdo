# Como criar inputs específicos para um novo tipo de exame

> **Arquivos relacionados:**
> - Implementação completa B-602 → [`b602/criar_input_personalizado_b602.md`](b602/criar_input_personalizado_b602.md)
> - Seções repetíveis para armas B-602 → [`b602/criar_input_personalizado_arma_b602.md`](b602/criar_input_personalizado_arma_b602.md)
> - Salvamento/recuperação de inputs → [`salvar_input_personalizado.md`](salvar_input_personalizado.md)

Quando um novo tipo de exame (ex: `MEU-COD`) precisa de campos próprios no formulário de REP, siga estes 4 passos.

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
- Máscaras de input (ex: formato `xxxx/xxxx`) devem ser implementadas diretamente no componente de campo, no handler `onChange` do `<Input>`.

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

## Passo 3 — Criar o ExamService (serialização, desserialização, defaults e máscaras)

Crie um arquivo em `src/renderer/components/rep/exam-fields/services/seu-tipo.service.ts`:

```ts
import type { REPFormData } from '../types';
import type { ExamService } from './types';

export const meuTipoService: ExamService = {
  codigo: 'MEU-COD',

  serialize(data: REPFormData): Record<string, unknown> {
    return {
      meu_tipo: {
        campo_x: data.meu_campo_x || '',
        campo_y: data.meu_campo_y || '',
      },
    };
  },

  deserialize(json: unknown): Partial<REPFormData> {
    const data = json as Record<string, unknown> | null;
    const obj = data?.meu_tipo as Record<string, string> | undefined;
    return {
      meu_campo_x: obj?.campo_x === 'sem identificação' ? '' : (obj?.campo_x || ''),
      meu_campo_y: obj?.campo_y || '',
    };
  },

  // Valores default quando o campo fica vazio no formulário
  fieldDefaults: {
    meu_campo_x: '',          // preencha se houver um fallback (ex: 'sem identificação')
  },

  // Máscaras de input aplicadas durante a digitação
  fieldMasks: {
    // Exemplo: formata dígitos enquanto o usuário digita
    // meu_campo_y: (v: string) => v.replace(/\D/g, '').slice(0, 8),
  },
};
```

### Interface `ExamService`

```ts
// exam-fields/services/types.ts (já existe no projeto)
export interface ExamService {
  codigo: string;
  /** Serializa campos do form em objeto JS (será convertido a JSON pelo REPsPage) */
  serialize: (data: REPFormData) => Record<string, unknown>;
  /** Desserializa JSON do banco de volta para Partial<REPFormData> */
  deserialize: (json: unknown) => Partial<REPFormData>;
  /** Valores default aplicados na serialização quando o campo está vazio */
  fieldDefaults?: Record<string, string>;
  /** Funções de formatação aplicadas durante digitação (onChange) */
  fieldMasks?: Record<string, (value: string) => string>;
}
```

### Registrar no registry

Edite `src/renderer/components/rep/exam-fields/index.ts`:

```ts
import { meuTipoService } from './services/seu-tipo.service';
import type { ExamService } from './services/types';

export const EXAM_SERVICE_REGISTRY: Record<string, ExamService> = {
  'I-801': numeracaoService,
  'MEU-COD': meuTipoService,   // ← novo service
};
```

**Nota:** `EXAM_SERVICE_REGISTRY[codigo]` pode ser `undefined` para exames cujos campos são apenas colunas nativas (ex: `LOC`). Nesse caso, `campos_especificos` não é serializado (fica `null` no banco).

---

## Passo 4 — Conectar à pipeline de dados

### 4a. `REPFormData` (tipagem)

No arquivo `src/renderer/components/rep/exam-fields/types.ts`, adicione os novos campos ao `REPFormData`:

```ts
export interface REPFormData {
  // ... existentes ...
  meu_campo_x: string;
  meu_campo_y: string;
}
```

### 4b. `emptyForm()` (valores iniciais)

Em `src/renderer/pages/REPsPage.tsx`, adicione os defaults:

```ts
const emptyForm = (): REPFormData => ({
  // ... existentes ...
  meu_campo_x: '',
  meu_campo_y: '',
});
```

### 4c. `FIELD_PLACEHOLDER` (mapeamento para template)

Em `src/renderer/pages/REPsPage.tsx`, adicione as chaves de placeholder:

```ts
const FIELD_PLACEHOLDER: Record<string, string> = {
  // ... existentes ...
  meu_campo_x: 'meu_placeholder_x',
  meu_campo_y: 'meu_placeholder_y',
};
```

### 4d. `repFormSchema` (validação condicional)

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
    form.trigger(['local_fato', 'numeracao_veiculo', 'meu_campo_x', 'meu_campo_y']);
  }
}, [tipoExameId]);
```

### 4e. `handleEditar()` — desserialização

A função `handleEditar` já usa `deserializeCamposEspecificos()` do registry. Basta adicionar os novos campos no `form.reset({...})`:

```ts
form.reset({
  // ... existentes ...
  meu_campo_x: especificos.meu_campo_x || '',
  meu_campo_y: especificos.meu_campo_y || '',
});
```

### 4f. Placeholders de template (campos específicos)

Em `src/renderer/components/rep/exam-fields/placeholders.ts`, adicione a categoria e os campos:

```ts
export const EXAM_PLACEHOLDER_CATEGORIES: ExamPlaceholderCategory[] = [
  { id: 'cat-exam-I-801', codigo: 'I-801', label: 'I-801 - Numerações Identificadoras', cor: 'amber', icone: 'Car' },
  { id: 'cat-exam-MEU-COD', codigo: 'MEU-COD', label: 'MEU-COD - Seu Exame', cor: 'blue', icone: 'Flask' },
];

export const CAMPOS_ESPECIFICOS_PLACEHOLDERS: CampoEspecificoPlaceholder[] = [
  // ... existentes ...
  { chave: 'meu_x', label: 'Campo X', descricao: 'Descrição do campo X', jsonPath: 'meu_tipo.campo_x', categoria_exam_codigo: 'MEU-COD' },
  { chave: 'meu_y', label: 'Campo Y', descricao: 'Descrição do campo Y', jsonPath: 'meu_tipo.campo_y', categoria_exam_codigo: 'MEU-COD' },
];
```

---

## Resumo do fluxo de dados

```
FORM (REPFormData)
  │
  │  Campos comuns (numero, data_requisicao, etc.) → colunas nativas da tabela reps
  │  Campos LOC (local_fato, lat, lon, datas)      → colunas nativas da tabela reps
  │  Campos MEU-COD (meu_campo_x, meu_campo_y)     → EXAM_SERVICE_REGISTRY['MEU-COD'].serialize(data)
  │
  ▼
REPsPage.tsx → EXAM_SERVICE_REGISTRY[codigo].serialize(data) → JSON.stringify → reps.campos_especificos
  │
  ▼
IPC handler → SQLite reps
  │
  ▼
Edição: REPsPage.tsx → EXAM_SERVICE_REGISTRY[codigo].deserialize(json) → form.reset({...campos})
```

**A `REPsPage.tsx` não contém nenhum `if (codigo === '...')` para serialização/desserialização.** Toda a lógica específica do tipo de exame fica encapsulada no `ExamService` correspondente.

---

## Checklist para novo tipo

- [ ] `exam-fields/seu-tipo.tsx` — componente React com `FormField` usando `name="..."` único
- [ ] `exam-fields/index.ts` — `SECTION_REGISTRY` + `EXAM_FIELD_MAP`
- [ ] `exam-fields/services/seu-tipo.service.ts` — `ExamService` com `serialize`, `deserialize`, `fieldDefaults` e `fieldMasks`
- [ ] `exam-fields/index.ts` — `EXAM_SERVICE_REGISTRY` com o novo service
- [ ] `exam-fields/types.ts` — `REPFormData` com os novos campos
- [ ] `exam-fields/placeholders.ts` — categoria + campos placeholder (se aplicável)
- [ ] `REPsPage.tsx` — `emptyForm()` com defaults
- [ ] `REPsPage.tsx` — `FIELD_PLACEHOLDER` com as chaves de placeholder
- [ ] `REPsPage.tsx` — `repFormSchema.superRefine` com validação condicional
- [ ] `REPsPage.tsx` — `form.trigger([...])` com os paths dos novos campos
- [ ] `REPsPage.tsx` — `handleEditar().form.reset({...})` com os novos campos
