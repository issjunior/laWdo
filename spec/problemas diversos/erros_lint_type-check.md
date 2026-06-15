# Plano: Correção de Erros de Type-Check e Lint

> **Status:** Em planejamento (2026-06-13)
> **Escopo:** 70 erros `tsc --noEmit` + 668 problemas ESLint (624 erros, 44 warnings)

---

## Sumário executivo

| Prioridade | Grupo | Erros type-check | Erros lint | Runtime? |
|-----------|-------|-----------------|------------|----------|
| CRÍTICO | Variável fora de escopo / tipo ausente / prop removida | 7 | 0 | Sim |
| ALTO | Casts de tipo / mismatch de interface | ~50 | 0 | Potencial |
| MÉDIO | Tipos de componente incompatíveis | ~10 | 0 | Improvável |
| BAIXO | Lint (any, deps, estilos) | 0 | ~668 | Não |

---

## 1. CRÍTICO — Erros que quebram runtime ou build

### 1.1 `toastId` fora de escopo no `catch`

**Arquivo:** `src/renderer/pages/LaudosPage.tsx:1433,1555`  
**Causa:** `const toastId = toast.loading(...)` declarado dentro do bloco `try {}`, inacessível no `catch {}`. `const` tem escopo de bloco e `try`/`catch` são blocos distintos.  
**Correção:** Declarar `let toastId: string | number` antes do `try`, atribuir dentro.

```typescript
// Antes (linha ~1428)
try {
  setExportando(true);
  const toastId = toast.loading(...);

// Depois
let toastId: string | number;
try {
  setExportando(true);
  toastId = toast.loading(...);
```

**Impacto:** Erro de runtime ao falhar exportação — o `catch` tenta acessar variável indefinida.

---

### 1.2 Interface local `Placeholder` sem campo `valor`

**Arquivo:** `src/renderer/pages/LaudosPage.tsx:66-71,1729`  
**Causa:** Interface local `Placeholder` (linha 66) declara `id, chave, descricao, categoria_id` mas **não inclui `valor`**. O código na linha 1729 acessa `p.valor`. O schema Zod (`placeholder.schema.ts`) define `valor: z.string().default('')`, então o campo existe no banco mas falta na interface local.  
**Correção:** Adicionar `valor: string` à interface local.

```typescript
// Linha 66
interface Placeholder {
  id: string;
  chave: string;
  valor: string;        // ← adicionar
  descricao: string;
  categoria_id: string;
}
```

**Impacto:** TypeScript rejeita `p.valor` — o código compila mas a verificação de tipo falha.

---

### 1.3 Tipo `SolicitanteCreateData` não encontrado

**Arquivo:** `src/renderer/pages/SolicitantesPage.tsx:33`  
**Causa:** `useState<SolicitanteCreateData>({...})` referencia tipo inexistente. O schema exporta `CreateSolicitanteInput` via `solicitante.schema.ts`.  
**Correção:** Substituir `SolicitanteCreateData` por `CreateSolicitanteInput` (importar do schema) ou definir inline.

```typescript
// SolicitantesPage.tsx
import type { CreateSolicitanteInput } from '@/lib/validators';

const [formData, setFormData] = useState<CreateSolicitanteInput>({...});
```

**Impacto:** A página de Solicitantes não passa no type-check.

---

### 1.4 `placeholderResponseSchema` não existe

**Arquivo:** `src/renderer/lib/validators/index.ts:151`  
**Causa:** O lazy import `import("./placeholder.schema").then(m => m.placeholderResponseSchema)` referencia export que não existe. O arquivo `placeholder.schema.ts` exporta `placeholderSchema`, não `placeholderResponseSchema`.  
**Correção:** Trocar para `placeholderSchema` ou criar o export `placeholderResponseSchema`.

```typescript
// index.ts linha 151
response: import("./placeholder.schema").then(m => m.placeholderSchema),
```

**Impacto:** O validador de placeholder quebra em runtime se esse lazy import for usado.

---

### 1.5 Prop `onOutdent` inexistente em `SortableCategoryTree`

**Arquivo:** `src/renderer/pages/PlaceholdersPage.tsx:428`  
**Causa:** `SortableCategoryTreeProps` (linha 22-28 do componente) define apenas `arvore, selectedId, onSelect, onAdd, onMove`. A prop `onOutdent` foi removida da interface mas o caller ainda a passa.  
**Correção:** Remover `onOutdent={handleOutdent}` da chamada em `PlaceholdersPage.tsx:428`.

```tsx
// PlaceholdersPage.tsx linha 428
// Antes:
  onOutdent={handleOutdent}
// Depois: (remover a linha)
```

**Impacto:** Erro de tipo — TypeScript rejeita prop inexistente.

---

### 1.6 `import.meta.hot` — falta referência Vite

**Arquivos:** `src/renderer/index.tsx:209-210`, `tsconfig.renderer.json`  
**Causa:** `tsconfig.renderer.json` não inclui `"vite/client"` nos types, então `ImportMeta` não tem a propriedade `hot`.  
**Correção:** Adicionar `"vite/client"` ao array `types` em `tsconfig.renderer.json`.

```json
// tsconfig.renderer.json
"types": ["vitest/globals", "vite/client"]
```

**Impacto:** Só afeta desenvolvimento (HMR). Em produção o Vite remove o bloco `if (import.meta.hot)`.

---

### 1.7 Módulo `@/assets/logo.jpg` sem declaração de tipo

**Arquivo:** `src/renderer/pages/DashboardPage.tsx:3`  
**Causa:** TypeScript não sabe interpretar imports de `.jpg`. Precisa de um arquivo de declaração ou `declare module`.  
**Correção:** Criar `src/renderer/types/assets.d.ts`:

```typescript
declare module '*.jpg' {
  const value: string;
  export default value;
}
declare module '*.jpeg' { const value: string; export default value; }
declare module '*.png' { const value: string; export default value; }
declare module '*.svg' { const value: string; export default value; }
```

**Impacto:** Apenas type-check — o Vite resolve o import em runtime.

---

## 2. ALTO — Casts de tipo e mismatch de interfaces

### 2.1 `REPFormData` ↔ `Record<string, string>` (25 erros)

**Arquivos:** `src/renderer/components/rep/exam-fields/services/b602.service.ts`, `src/renderer/components/rep/exam-fields/index.ts:115`  
**Causa:** `REPFormData` é uma interface com propriedades nomeadas fixas, sem index signature `[key: string]: string`. O código faz `(data as Record<string, string>)` para acessar campos dinâmicos como `b602_cartuchos_${i}_calibre`. TypeScript 5.x com `strict: true` rejeita casts entre tipos sem sobreposição.  
**Correção:** Cast via `unknown`:

```typescript
// Antes
const v = (data as Record<string, string>)[`b602_envolvidos_${i}`];

// Depois
const v = (data as unknown as Record<string, string>)[`b602_envolvidos_${i}`];
```

Ou, alternativamente, adicionar index signature à `REPFormData`: `[key: string]: string`. Isso eliminaria todos os casts e os erros, mas enfraquece a checagem de todas as propriedades.  
**Recomendação:** Cast via `unknown` — localizado nos pontos de acesso dinâmico, sem enfraquecer o tipo base.

---

### 2.2 Zod `.passthrough()` vs `REPFormData` (15 erros)

**Arquivo:** `src/renderer/pages/REPsPage.tsx:396-473,598,892,1378-1625`  
**Causa:** O schema Zod usa `.passthrough()` (linha 443) para permitir campos dinâmicos não declarados (ex: `b602_cartuchos_3_calibre`). Isso faz o tipo inferido do schema divergir de `REPFormData` — o tipo inferido é `{ [k: string]: unknown } & { numero: string, ... }` enquanto `REPFormData` não tem index signature. O `Resolver<REPFormData>` e `UseFormReturn<REPFormData>` esperam `REPFormData` exato, mas recebem o tipo alargado.  
**Correção:** Duas opções:

**Opção A (recomendada):** Adicionar index signature ao `REPFormData`:
```typescript
export interface REPFormData {
  [key: string]: string;  // permite acesso indexado e casa com .passthrough()
  numero: string;
  // ... demais campos
}
```

**Opção B:** Tipar `useForm` com o schema inferido em vez de `REPFormData`:
```typescript
const form = useForm<z.infer<typeof repFormSchema>>({ ... });
```

**Recomendação:** Opção A — simples, resolve 15 erros de uma vez, alinhado com o fato de que `.passthrough()` aceita campos extras. A index signature `[key: string]: string` é compatível com todas as propriedades existentes (todas são `string`).

---

### 2.3 `LucideIcon` vs `ComponentType<{ size?: number }>` (6 erros)

**Arquivo:** `src/renderer/components/rep/exam-fields/index.ts:37,46,55,64,73` e `src/renderer/pages/REPsPage.tsx:1621`  
**Causa:** `ExamSection.icon` é tipado como `React.ComponentType<{ size?: number }>`, mas os ícones Lucide exportam `LucideIcon` que é `ForwardRefExoticComponent<LucideProps>`. `LucideProps.size` aceita `string | number`, enquanto o tipo esperado só aceita `number`.  
**Correção:** Alterar o tipo de `icon` em `ExamSection` para aceitar `LucideIcon`:

```typescript
// types.ts
import type { LucideIcon } from 'lucide-react';

export interface ExamSection {
  // ...
  icon: LucideIcon;  // em vez de React.ComponentType<{ size?: number }>
  // ...
}
```

**Impacto:** Apenas type-check. O runtime já funciona — Lucide aceita `size={16}` sem problemas.

---

### 2.4 `group: null` vs `string | undefined` (6 erros)

**Arquivo:** `src/renderer/components/rep/exam-fields/index.ts:31,40,49,58,67,76`  
**Causa:** `SECTION_REGISTRY` declara `group: null` para seções sem grupo, mas o tipo `ExamSection.group` é `string | undefined`.  
**Correção:** Mudar `group: null` para `group: undefined` no registry, ou ajustar o tipo para `string | null`.

```typescript
// index.ts — trocar null por undefined
group: undefined,  // em vez de group: null
```

---

## 3. MÉDIO — Componentes com tipos incompatíveis

### 3.1 TinyMCE `onEditorChange`: `Dispatch<SetStateAction<string>>`

**Arquivos:** `CabecalhoPage.tsx:311,353`, `LaudosPage.tsx:2512,2563`, `TemplatesPage.tsx:1169,1215`  
**Causa:** O componente `TinyMceEditor` espera `(html: string) => void` como `onEditorChange`, mas recebe `Dispatch<SetStateAction<string>>`. Embora funcionem em runtime (ambos aceitam `string`), TypeScript reclama porque `Dispatch<SetStateAction<string>>` também aceita função updater `(prev: string) => string`.  
**Correção:** Criar wrapper ou tipar corretamente:

```typescript
// Opção A: wrapper
onEditorChange={(html: string) => setContent(html)}

// Opção B: ajustar tipo do componente TinyMceEditor para aceitar
// ((value: string) => void) | Dispatch<SetStateAction<string>>
```

**Recomendação:** Opção A — explícito, sem alterar o componente base.

---

### 3.2 `Placeholder` vs `PlaceholderItem` / `{ id, chave, nome }`

**Arquivo:** `TemplatesPage.tsx:962,1160,1206`  
**Causa:** O tipo `Placeholder` (do schema) tem `descricao: string | null`, enquanto `PlaceholderItem` espera `descricao: string`. Também há mismatch onde se espera `{ nome: string }` mas `Placeholder` não tem `nome`.  
**Correção:** Ajustar tipos ou mapear os dados. O campo "nome" provavelmente deveria ser `chave` (o placeholder não tem `nome`, mas tem `chave`).

---

### 3.3 `CategoriasPecasPage` — handler com parâmetro opcional

**Arquivo:** `CategoriasPecasPage.tsx:269`  
**Causa:** `(silent?: boolean) => Promise<void>` passado como `onClick` que espera `MouseEventHandler`.  
**Correção:** Envolver em arrow function: `onClick={() => handleSave()}`.

---

### 3.4 `ImportTemplateDialog` — `string | FormEvent`

**Arquivo:** `ImportTemplateDialog.tsx:166`  
**Causa:** Valor de evento de formulário passado onde se espera `string`.  
**Correção:** Extrair o valor corretamente ou tipar como `string`.

---

## 4. BAIXO — Lint (estilo e boas práticas)

### 4.1 `@typescript-eslint/no-explicit-any` (~200 ocorrências)

**Arquivos:** Espalhados por praticamente todas as pages e handlers.  
**Causa:** Uso intenso de `any` em parâmetros, retornos de API, e tipagem de objetos dinâmicos.  
**Correção:** Corrigir progressivamente — maior parte está em respostas de API (`r.data as any[]`), parâmetros genéricos de callbacks, e objetos de configuração. Usar `unknown` + narrowing ou tipos genéricos.  
**Recomendação:** Atacar por arquivo, começando pelos menores (handlers, services) e subindo para as pages. Não tentar corrigir tudo de uma vez.

### 4.2 TinyMCE skins `no-extra-semi` (~30 ocorrências)

**Arquivos:** `src/renderer/public/tinymce/skins/**/*.ts` e `*.min.ts`  
**Causa:** Arquivos CSS-in-JS de terceiros com ponto-e-vírgula extra no final.  
**Correção:** Excluir `src/renderer/public/**` do ESLint no `.eslintignore` ou configurar overrides. São arquivos vendor, não devem ser lintados.

### 4.3 `react-hooks/exhaustive-deps` (~20 warnings)

**Arquivos:** Várias pages.  
**Causa:** `useEffect`/`useMemo`/`useCallback` com dependências incompletas ou excessivas.  
**Correção:** Revisar cada caso — alguns precisam adicionar deps, outros remover, outros usar refs para valores estáveis.  
**Recomendação:** Tratar por arquivo, o mais crítico é `REPsPage.tsx` (6 warnings).

### 4.4 `no-empty` (5 ocorrências)

**Arquivos:** `REPsPage.tsx`, `TemplatesPage.tsx`, `WizardLaudoPage.tsx`  
**Causa:** Blocos `catch {}` vazios.  
**Correção:** Adicionar `catch { /* silent */ }` ou `catch { void 0 }` (permite bloco vazio com comentário) — depende da config ESLint. Alternativa: desabilitar regra para catch blocks.

### 4.5 `no-unused-vars` (5 ocorrências)

**Arquivos:** `SolicitantesPage`, `TemplatesPage`, `WizardEditorPage`  
**Causa:** Imports/funções declaradas mas não usadas.  
**Correção:** Remover as declarações não utilizadas.

### 4.6 `react/no-unescaped-entities` (6 ocorrências)

**Arquivos:** `TemplatesPage`, `WizardEditorPage`, `WizardsPage`  
**Causa:** Aspas `"` em JSX sem escape.  
**Correção:** Usar `&quot;` ou curly quotes.

### 4.7 `no-extra-boolean-cast` (4 ocorrências)

**Arquivo:** `SolicitantesPage.tsx`  
**Causa:** `!!` redundante em contexto booleano.  
**Correção:** Remover `!!`.

### 4.8 `no-useless-escape` (6 ocorrências)

**Arquivo:** `TemplatesPage.tsx:214`  
**Causa:** `\.` e `\:` escapados em regex onde não precisam (dentro de classe de caractere).  
**Correção:** Remover as barras invertidas desnecessárias.

---

## 5. Ordem de implementação sugerida

| # | Grupo | Erros resolvidos | Esforço |
|---|-------|-----------------|---------|
| 1 | 1.1 toastId escopo | 1 | 2 min |
| 2 | 1.2 Placeholder.valor | 1 | 1 min |
| 3 | 1.3 SolicitanteCreateData | 1 | 2 min |
| 4 | 1.4 placeholderResponseSchema | 1 | 1 min |
| 5 | 1.5 onOutdent prop | 1 | 1 min |
| 6 | 1.6 Vite types | 1 | 1 min |
| 7 | 1.7 assets.d.ts | 1 | 2 min |
| 8 | 2.1 REPFormData casts (unknown) | ~25 | 10 min |
| 9 | 2.2 REPFormData index signature | ~15 | 5 min |
| 10 | 2.3 LucideIcon type | ~6 | 2 min |
| 11 | 2.4 group: null → undefined | ~6 | 2 min |
| 12 | 3.1 TinyMCE onEditorChange | ~6 | 5 min |
| 13 | 3.2 Placeholder mismatch | ~3 | 10 min |
| 14 | 3.3 CategoriasPecas handler | 1 | 1 min |
| 15 | 3.4 ImportTemplateDialog | 1 | 2 min |
| 16 | 4.2 TinyMCE skins eslintignore | ~30 | 1 min |
| 17 | 4.5 no-unused-vars | 5 | 3 min |
| 18 | 4.6 no-unescaped-entities | 6 | 3 min |
| 19 | 4.7 no-extra-boolean-cast | 4 | 1 min |
| 20 | 4.8 no-useless-escape | 6 | 1 min |
| 21 | 4.4 no-empty | 5 | 2 min |
| 22 | 4.3 react-hooks/exhaustive-deps | ~20 | 30 min |
| 23 | 4.1 no-explicit-any | ~200 | horas |

**Total estimado:** ~1-2h para resolver críticos + alto + médio (grupos 1-15).  
**Lint baixo:** ~40 min para grupos 16-22. `no-explicit-any` (grupo 23) é trabalho contínuo.

---

## 6. Observações

- Nenhum desses erros foi introduzido pelo commit `ajuste_formulario_b602` — são pré-existentes.
- Os erros `no-extra-semi` nos skins TinyMCE são código de terceiros (vendor) e devem ser excluídos do lint, não corrigidos.
- A adição de `[key: string]: string` ao `REPFormData` (item 2.2) resolve 15 erros em REPsPage e também simplifica futuros campos dinâmicos de outros tipos de exame.
- O cast `as unknown as Record<string, string>` (item 2.1) é o padrão TypeScript recomendado para acesso indexado a tipos sem index signature — já usado em outras partes do código.
