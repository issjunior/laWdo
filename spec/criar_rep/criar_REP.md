# Plano: Formulário de Criação de REP — UX Progressiva + Section Registry

> Arquitetura: **A — Section Registry** (componentes separados por tipo de exame, mapeados via `EXAM_FIELD_MAP`)
> Persistência: **JSON column** (`campos_especificos TEXT`) na tabela `reps` para campos de tipos que não são colunas nativas
> Validação: **Zod `superRefine` condicional** — campos do Nível 3 são required apenas quando o tipo correspondente está selecionado

---

## 1. Visão geral do fluxo UX

O formulário da REP adota **progressive disclosure** em 3 níveis:

```
┌──────────────────────────────────────────────────┐
│  NÍVEL 1 — Dados da Solicitação                  │
│  (sempre visível, campos obrigatórios primeiro)   │
│  Nº REP* | Data Recebimento* | Solicitante       │
│  Tipo Exame | Template | Tipo Solicitação*        │
│  Nº Solicitação* | Data Doc | Autoridade          │
│  Nome do Envolvido                                │
├──────────────────────────────────────────────────┤
│  NÍVEL 2 — Documentos Associados                  │
│  (sempre visível)                                 │
│  Nº BO | Nº IP | Lacre Entrada | Lacre Saída      │
├──────────────────────────────────────────────────┤
│  NÍVEL 3 — Campos Específicos do Exame    🔒/🔓   │
│  (desbloqueado ao selecionar tipo + preencher     │
│   campos obrigatórios dos níveis 1 e 2)           │
│                                                    │
│  Conteúdo DINÂMICO via Section Registry:           │
│  • Local (LOC): Local Fato, Lat/Lon, Acionamento  │
│  • Numeração (I-801): Campos de numeração         │
│  • Outros tipos: respectivas seções               │
└──────────────────────────────────────────────────┘
```

### Regra de desbloqueio do Nível 3

O accordion de campos específicos fica **visível mas bloqueado** (collapsed, com cadeado e texto guia) até que:

1. `tipo_exame_id` esteja selecionado **E**
2. Os campos obrigatórios (`numero`, `data_requisicao`, `tipo_solicitacao`, `numero_documento`) estejam preenchidos e válidos

Quando desbloqueado, as seções específicas aparecem com uma animação sutil e o ícone de cadeado some.

---

## 2. Estrutura de arquivos

```
src/
├── renderer/
│   ├── components/
│   │   └── rep/
│   │       └── exam-fields/           ← NOVO diretório
│   │           ├── index.ts           ← SECTION_REGISTRY + EXAM_FIELD_MAP + EXAM_SERVICE_REGISTRY
│   │           ├── types.ts           ← ExamSection, ExamSectionProps
│   │           ├── placeholders.ts    ← categorias + campos de placeholder para templates
│   │           ├── local-fato.tsx     ← campos: local_fato, latitude, longitude
│   │           ├── acionamento.tsx    ← campos: data_acionamento, data_chegada, data_saida
│   │           ├── numeracao.tsx      ← campos: numeração veicular I-801
│   │           └── services/          ← NOVO subdiretório
│   │               ├── types.ts       ← ExamService interface
│   │               ├── numeracao.service.ts  ← serialize/deserialize I-801 + defaults + masks
│   │               └── loc.service.ts       ← serialize/deserialize LOC (se necessário)
│   ├── lib/
│   │   └── validators/
│   │       ├── tipo-exame.schema.ts   ← REMOVE eh_local
│   │       └── rep.schema.ts          ← ADD campos_especificos, corrigir obrigatórios
│   └── pages/
│       ├── REPsPage.tsx               ← REFATORADO: Section Registry + validação condicional
│       └── TiposExamePage.tsx         ← REMOVE checkbox eh_local + badge "Local"
├── main/
│   ├── database/
│   │   └── index.ts                   ← Migration v17: DROP eh_local, ADD campos_especificos
│   ├── types/
│   │   └── database.ts                ← Remove eh_local, ADD campos_especificos ao REPRow
│   └── ipc/handlers/
│       ├── tipo-exame.handlers.ts     ← Remove sanitização eh_local
│       └── rep.handlers.ts            ← ADD campos_especificos no create/update
└── preload/
    └── types.ts                       ← Remove eh_local
```

---

## 2.1. Decisão de persistência — JSON column (4.1b)

**Escolha:** Adicionar coluna `campos_especificos TEXT` (JSON) na tabela `reps`.

**Justificativa:**
- Campos de tipos como LOC (`local_fato`, `latitude`, `longitude`, `data_acionamento`, etc.) **já são colunas nativas** da tabela `reps` — continuam sendo enviados como top-level fields no IPC
- Campos de novos tipos (ex: I-801 numeração) que **não são colunas nativas** serão serializados em JSON na coluna `campos_especificos`
- Evita ALTER TABLE a cada novo tipo de exame
- Evita JOINs com tabela separada
- Os campos específicos não precisam ser filtrados/ordenados individualmente em queries

**Formato do JSON:**
```json
// Exemplo para I-801:
{
  "numeracao": {
    "descricao": "...",
    "observacoes": "..."
  }
}
```

**Fluxo de dados:**
```
Form (REPFormData) → prepareForApi(data, codigo)
                     ↓
              Campos comuns/LOC → colunas nativas (numero, local_fato, lat, lon...)
              Campos I-801 → EXAM_SERVICE_REGISTRY['I-801'].serialize(data)
                             → JSON.stringify() → campos_especificos
```

---

## 2.2. Estratégia de validação — Zod `superRefine` condicional

**Problema:** O schema Zod é estático, mas os campos required dependem do `tipo_exame_id` selecionado (dinâmico).

**Solução:** Schema reconstruído via `useMemo` dependendo de `tiposExame`, usando `superRefine`:

```ts
const repFormSchema = useMemo(() => z.object({
  // Campos base — sempre obrigatórios (Nível 1)
  numero: z.string().min(1).regex(/^(\d{1,3}|\d{1,3}\.\d{3})-\d{4}$/),
  data_requisicao: z.string().min(1),
  tipo_solicitacao: z.string().min(1).max(50),
  numero_documento: z.string().min(1).max(30),
  tipo_exame_id: z.string().optional(),

  // Campos opcionais na base (validados como required apenas via superRefine)
  nome_envolvido: z.string().max(200).optional(),
  local_fato: z.string().max(500).optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  data_acionamento: z.string().optional(),
  data_chegada: z.string().optional(),
  data_saida: z.string().optional(),
  // Numeracao (I-801) placeholder:
  numeracao_descricao: z.string().optional(),
  numeracao_observacoes: z.string().optional(),

  // Demais campos opcionais...
}).superRefine((data, ctx) => {
  if (!data.tipo_exame_id) return;
  const tipo = tiposExame.find(t => t.id === data.tipo_exame_id);
  if (!tipo) return;
  const sections = EXAM_FIELD_MAP[tipo.codigo] || [];

  if (sections.includes('local_fato') && !data.local_fato?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Local do fato é obrigatório para este tipo de exame', path: ['local_fato'] });
  }
  if (sections.includes('numeracao') && !data.numeracao_descricao?.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Descrição da numeração é obrigatória', path: ['numeracao_descricao'] });
  }
}), [tiposExame]);
```

**Revalidação ao trocar tipo:** `useEffect` no `tipo_exame_id` chama `form.trigger()` para forçar revalidação dos campos condicionais, garantindo que erros inline apareçam/desapareçam corretamente.

**Botão Salvar:**
```tsx
<Button type="submit" disabled={submitting || !form.formState.isValid}>
```
Com `mode: 'onChange'` no `useForm` para feedback inline imediato.

---

## 3. Section Registry (exam-fields/index.ts)

```ts
import { MapPin, Clock, Hash, FileWarning } from 'lucide-react';
import { LocalFatoFields } from './local-fato';
import { AcionamentoFields } from './acionamento';
import { NumeracaoFields } from './numeracao';

export interface ExamSection {
  id: string;                    // chave única, usada no accordion value
  label: string;                 // título da seção
  icon: React.ComponentType<{ size?: number }>;
  description: string;           // subtítulo explicativo
  component: React.FC<ExamSectionProps>;
  group?: string;                // se pertence a um grupo existente (ex: 'envolvido-local')
}

export interface ExamSectionProps {
  form: UseFormReturn<REPFormData>;
  mostrarPlaceholders: boolean;
}

/** Todas as seções disponíveis no sistema */
export const SECTION_REGISTRY: Record<string, ExamSection> = {
  local_fato: {
    id: 'local_fato',
    label: 'Local do Fato',
    icon: MapPin,
    description: 'Coordenadas geográficas e descrição do local periciado',
    component: LocalFatoFields,
    group: 'envolvido-local',   // renderiza DENTRO do accordion "Envolvido e Local"
  },
  acionamento: {
    id: 'acionamento',
    label: 'Linha do Tempo',
    icon: Clock,
    description: 'Registro de acionamento, chegada e saída do local',
    component: AcionamentoFields,
    group: null,                 // seção independente no accordion
  },
  numeracao: {
    id: 'numeracao',
    label: 'Numerações Identificadoras',
    icon: Hash,
    description: 'Dados específicos para exame de numeração (I-801)',
    component: NumeracaoFields,
    group: null,
  },
};

/** Mapeamento: código do tipo de exame → IDs das seções */
export const EXAM_FIELD_MAP: Record<string, string[]> = {
  'LOC':   ['local_fato', 'acionamento'],
  'I-801': ['numeracao'],
};

/** Helper: retorna as seções para um código de exame */
export function getSectionsForExame(codigo: string): ExamSection[] {
  const ids = EXAM_FIELD_MAP[codigo] || [];
  return ids.map(id => SECTION_REGISTRY[id]).filter(Boolean);
}
```

---

## 3.5. ExamService Registry — Serialização por tipo de exame

Além do `SECTION_REGISTRY` (que mapeia tipo → componentes visuais), existe o **`EXAM_SERVICE_REGISTRY`** que encapsula toda a lógica de dados específica do tipo de exame: serialização, desserialização, defaults e máscaras.

Isso remove os blocos `if (codigo === 'I-801')` que estavam hardcoded na `REPsPage.tsx`.

### Interface

```ts
// exam-fields/services/types.ts
export interface ExamService {
  codigo: string;
  /** Serializa campos do form em objeto JS → será convertido a JSON pelo REPsPage */
  serialize: (data: REPFormData) => Record<string, unknown>;
  /** Desserializa JSON do banco de volta para Partial<REPFormData> */
  deserialize: (json: unknown) => Partial<REPFormData>;
  /** Valores default aplicados na serialização quando o campo está vazio */
  fieldDefaults?: Record<string, string>;
  /** Funções de formatação aplicadas durante digitação (onChange) */
  fieldMasks?: Record<string, (value: string) => string>;
}
```

### Registry

```ts
// exam-fields/index.ts
import { numeracaoService } from './services/numeracao.service';

export const EXAM_SERVICE_REGISTRY: Record<string, ExamService> = {
  'I-801': numeracaoService,
  // 'LOC' não precisa: campos são colunas nativas, campos_especificos = null
};
```

### Como a REPsPage.tsx consome

```ts
// Ao salvar (substitui buildCamposEspecificos hardcoded):
const service = EXAM_SERVICE_REGISTRY[codigo];
if (service) {
  const obj = service.serialize(data);
  // Aplica fieldDefaults (ex: placa vazia → 'sem identificação')
  for (const [key, defaultVal] of Object.entries(service.fieldDefaults ?? {})) {
    if (!obj[key]) obj[key] = defaultVal;
  }
  payload.campos_especificos = JSON.stringify(obj);
}

// Ao carregar para edição (substitui parseCamposEspecificos hardcoded):
const service = EXAM_SERVICE_REGISTRY[codigo];
const especificos = service?.deserialize(JSON.parse(rep.campos_especificos)) ?? {};
```

### Fluxo completo

```
REPsPage.tsx                              exam-fields/
  │                                           │
  │  preparar save                            │
  ├──► EXAM_SERVICE_REGISTRY[codigo]          │
  │      .serialize(data)          ────►  numeracao.service.ts
  │        │                                 │ placa: data.placa || 'sem identificação'
  │        ▼                                 │ fabricacao: data.fabricacao || ''
  │      payload.campos_especificos          │ ...
  │                                           │
  │  preparar edit                            │
  ├──► EXAM_SERVICE_REGISTRY[codigo]          │
  │      .deserialize(json)        ────►  numeracao.service.ts
  │        │                                 │ 'sem identificação' → ''
  │        ▼                                 │
  │      form.reset({...especificos})        │
```

### Vantagens

- **REPsPage.tsx fica genérica**: não sabe nomes de campos, defaults ou formato JSON de cada tipo.
- **Novo tipo de exame**: basta criar um `ExamService` e registrá-lo — sem tocar em `REPsPage.tsx`.
- **Defaults por campo**: `fieldDefaults = { placa: 'sem identificação' }` aplicado na serialização.
- **Máscaras de input**: `fieldMasks = { fabricacao: (v) => formatarFabricacao(v) }` exportado para o componente UI.

---

## 4. REPsPage.tsx — Refatoração

### 4a. Estrutura do estado

```tsx
// Estado de desbloqueio dos campos específicos
const [camposEspecificosDesbloqueados, setCamposEspecificosDesbloqueados] = useState(false);

// Deriva seções do tipo de exame
const examSections = useMemo(() => {
  const tipo = tiposExame.find(t => t.id === tipoExameId);
  if (!tipo) return [];
  return getSectionsForExame(tipo.codigo);
}, [tipoExameId, tiposExame]);

// Seções agrupadas vs independentes
const groupedSections = examSections.filter(s => s.group);
const standaloneSections = examSections.filter(s => !s.group);

// Verifica se campos obrigatórios estão preenchidos
const { numero, data_requisicao, tipo_solicitacao, numero_documento } = form.watch();
const commonFieldsValid = !!(numero && data_requisicao && tipo_solicitacao && numero_documento && tipoExameId);
const canUnlockSpecificFields = commonFieldsValid;

// Efeito: desbloqueia automaticamente quando condições são atendidas
useEffect(() => {
  if (canUnlockSpecificFields && !camposEspecificosDesbloqueados) {
    setCamposEspecificosDesbloqueados(true);
  }
}, [canUnlockSpecificFields]);
```

### 4b. Estrutura do Accordion

```tsx
<Accordion type="multiple" defaultValue={["dados-solicitacao", "documentos"]}>
  
  {/* ============================================ */}
  {/* NÍVEL 1: Dados da Solicitação (sempre aberto) */}
  {/* ============================================ */}
  <AccordionItem value="dados-solicitacao">
    <AccordionTrigger>
      <FileText /> Dados da Solicitação
    </AccordionTrigger>
    <AccordionContent>
      {/* Nº REP + Data Recebimento (row 1) */}
      {/* Solicitante | Responsável | Tipo Exame | Template | Tipo Solicitação (row 2) */}
      {/* Nº Solicitação | Data Doc | Autoridade | Envolvido (row 3) */}
    </AccordionContent>
  </AccordionItem>

  {/* ============================================ */}
  {/* NÍVEL 2: Documentos Associados (sempre aberto) */}
  {/* ============================================ */}
  <AccordionItem value="documentos">
    <AccordionTrigger>
      <Link2 /> Documentos Associados
    </AccordionTrigger>
    <AccordionContent>
      {/* Nº BO | Nº IP | Lacre Entrada | Lacre Saída */}
      {/* Observações */}
    </AccordionContent>
  </AccordionItem>

  {/* ============================================ */}
  {/* NÍVEL 3: Campos Específicos (bloqueado/desbloqueado) */}
  {/* ============================================ */}
  {examSections.length > 0 && (
    <AccordionItem 
      value="campos-especificos" 
      className={!camposEspecificosDesbloqueados ? 'opacity-60' : ''}
    >
      <AccordionTrigger>
        {camposEspecificosDesbloqueados 
          ? <><Zap size={14} /> Campos Específicos — {tipoExameSelecionado?.nome}</>
          : <><Lock size={14} /> Preencha os campos obrigatórios acima para desbloquear</>
        }
      </AccordionTrigger>
      <AccordionContent>
        {camposEspecificosDesbloqueados ? (
          <>
            {/* Seções agrupadas (ex: local_fato vai dentro de "Envolvido e Local") */}
            {groupedSections.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Envolvido e Local</h4>
                {groupedSections.map(s => (
                  <s.component key={s.id} form={form} mostrarPlaceholders={mostrarPlaceholders} />
                ))}
              </div>
            )}
            
            {/* Seções independentes (ex: Acionamento, Numerações) */}
            {standaloneSections.map(s => (
              <div key={s.id} className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <s.icon size={14} />
                  <span>{s.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{s.description}</p>
                <s.component form={form} mostrarPlaceholders={mostrarPlaceholders} />
              </div>
            ))}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-3">
            <Lock size={28} className="opacity-30" />
            <p className="text-sm">Selecione o tipo de exame e preencha os campos obrigatórios (Nº REP, Data de Recebimento, Tipo de Solicitação, Nº da Solicitação) para desbloquear os campos específicos.</p>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  )}
</Accordion>
```

---

## 5. Níveis de desbloqueio — Diagrama de estados

```
Estado inicial:
┌─────────────────────┐
│ Nível 1: visível    │ ← preenchendo...
│ Nível 2: visível    │ ← preenchendo...
│ Nível 3: BLOQUEADO  │ ← cadeado, opacidade 60%
└─────────────────────┘
        │
        │ tipo_exame_id selecionado
        │ + numero, data_requisicao, tipo_solicitacao, numero_documento válidos
        ▼
┌─────────────────────┐
│ Nível 1: visível    │
│ Nível 2: visível    │
│ Nível 3: DESBLOQ.   │ ← seções específicas aparecem
└─────────────────────┘
```

**Comportamento:** se o usuário limpar o campo `numero` após desbloquear, o Nível 3 **continua desbloqueado** (não some — isso seria ruim para UX). Uma vez desbloqueado, permanece.

---

## 6. Exemplo: Seção "Acionamento" (acionamento.tsx)

```tsx
import { FormField, FormItem, FormControl, FormMessage } from '@/components/forms/form';
import { Input } from '@/components/ui/input';
import { LabelWithPlaceholder } from './label-with-placeholder';
import type { ExamSectionProps } from './types';

export const AcionamentoFields: React.FC<ExamSectionProps> = ({ form, mostrarPlaceholders }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <FormField
      control={form.control}
      name="data_acionamento"
      render={({ field }) => (
        <FormItem>
          <LabelWithPlaceholder field="data_acionamento" mostrar={mostrarPlaceholders}>
            Data/Hora Acionamento
          </LabelWithPlaceholder>
          <FormControl>
            <Input type="datetime-local" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={form.control}
      name="data_chegada"
      render={({ field }) => (
        <FormItem>
          <LabelWithPlaceholder field="data_chegada" mostrar={mostrarPlaceholders}>
            Data/Hora Chegada
          </LabelWithPlaceholder>
          <FormControl>
            <Input type="datetime-local" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={form.control}
      name="data_saida"
      render={({ field }) => (
        <FormItem>
          <LabelWithPlaceholder field="data_saida" mostrar={mostrarPlaceholders}>
            Data/Hora Saída
          </LabelWithPlaceholder>
          <FormControl>
            <Input type="datetime-local" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </div>
);
```

---

## 7. Remoção do `eh_local`

| Passo | Arquivo | O quê |
|---|---|---|
| 1 | `src/main/database/index.ts` | Migration v17: Recria `tipos_exame` sem `eh_local` (DROP TABLE + rename, com `PRAGMA foreign_keys=OFF`), ADD `campos_especificos TEXT` na `reps` |
| 2 | `src/main/types/database.ts` | Remove `eh_local` do `TipoExameRow`; adiciona `campos_especificos?: string` ao `REPRow` |
| 3 | `src/lib/validators/tipo-exame.schema.ts` | Remove `eh_local` dos 3 schemas |
| 4 | `src/lib/validators/rep.schema.ts` | Adiciona `campos_especificos`, ajusta obrigatoriedade de `tipo_solicitacao` e `numero_documento` |
| 5 | `src/preload/types.ts` | Remove `eh_local` do `TipoExameCreateData` e `TipoExameUpdateData` |
| 6 | `src/main/ipc/handlers/tipo-exame.handlers.ts` | Remove `if (updateData.eh_local !== undefined)` |
| 7 | `src/main/ipc/handlers/rep.handlers.ts` | Adiciona `campos_especificos` no create e update |
| 8 | `src/renderer/pages/TiposExamePage.tsx` | Remove checkbox "É exame de local" + badge "Local/Laboratorial" |

---

## 8. Checklist de implementação

### Fase 1 — Database & Types
- [x] Migration v17: Recriar `tipos_exame` sem coluna `eh_local` (DROP TABLE + rename, com `PRAGMA foreign_keys=OFF`)
- [x] Migration v17: `ALTER TABLE reps ADD COLUMN campos_especificos TEXT`
- [x] Atualizar `CURRENT_SCHEMA_VERSION` para 17
- [x] `database.ts`: remover `eh_local` do `TipoExameRow`
- [x] `database.ts`: adicionar `campos_especificos?: string` ao `REPRow`

### Fase 2 — Validators
- [x] `tipo-exame.schema.ts`: remover `eh_local` dos 3 schemas
- [x] `rep.schema.ts`: `tipo_solicitacao` → `.min(1)` (obrigatório)
- [x] `rep.schema.ts`: `numero_documento` → `.min(1)` (obrigatório)
- [x] `rep.schema.ts`: adicionar `campos_especificos: z.string().nullable().optional()`

### Fase 3 — Section Registry
- [x] Criar `src/renderer/components/rep/exam-fields/types.ts` (inclui `REPFormData`)
- [x] Criar `src/renderer/components/rep/exam-fields/index.ts` (registry + mapa + helper)
- [x] Criar `src/renderer/components/rep/exam-fields/placeholders.ts` (categorias + campos placeholder)
- [x] Criar `src/renderer/components/rep/exam-fields/local-fato.tsx`
- [x] Criar `src/renderer/components/rep/exam-fields/acionamento.tsx`
- [x] Criar `src/renderer/components/rep/exam-fields/numeracao.tsx` (placeholder I-801)

### Fase 3.5 — ExamService Registry (serialização modular)
- [x] Criar `src/renderer/components/rep/exam-fields/services/types.ts` (interface `ExamService`)
- [x] Criar `src/renderer/components/rep/exam-fields/services/numeracao.service.ts` (serialize/deserialize I-801 + fieldDefaults + fieldMasks)
- [x] Registrar `EXAM_SERVICE_REGISTRY` em `exam-fields/index.ts`
- [x] Adicionar helpers `serializeCamposEspecificos()` e `deserializeCamposEspecificos()` em `exam-fields/index.ts`

### Fase 4 — REPsPage Refatoração
- [x] Mover `nome_envolvido` para "Dados da Solicitação" (Nível 1, row com autoridade)
- [x] Remover accordions condicionais "envolvido-local" e "acionamento"
- [x] Adicionar estado `camposEspecificosDesbloqueados` + `canUnlockSpecificFields`
- [x] Adicionar accordion "Campos Específicos" (Nível 3) com lock/unlock
- [x] Renderizar seções dinâmicas via `getSectionsForExame(tipo.codigo)`
- [x] Schema Zod com `superRefine` condicional (via `useMemo` + `tiposExameRef`)
- [x] `useEffect` no `tipo_exame_id` → `form.trigger(['local_fato', 'numeracao_descricao'])`
- [x] Botão Salvar: `disabled={submitting || !form.formState.isValid}`
- [x] `prepareForApi(data, codigo)`: delegar serialização a `EXAM_SERVICE_REGISTRY[codigo].serialize(data)`
- [x] Modo `onChange` no `useForm` para feedback inline imediato
- [x] `handleEditar`: delegar desserialização a `EXAM_SERVICE_REGISTRY[codigo].deserialize(json)`
- [x] Remover funções hardcoded `buildCamposEspecificos()` e `parseCamposEspecificos()`

### Fase 5 — Cleanup
- [x] `preload/types.ts`: remover `eh_local` de `TipoExameCreateData`/`UpdateData`
- [x] `tipo-exame.handlers.ts`: remover sanitização de `eh_local`
- [x] `TiposExamePage.tsx`: remover checkbox "É exame de local" + badge "Local/Laboratorial" + import `Label`
- [x] `rep.handlers.ts`: adicionar `campos_especificos` no `create` e `update`

### Build & Correções
- [x] `build:main` compila sem erros
- [x] `build:preload` compila sem erros
- [x] Corrigido: `DROP TABLE IF EXISTS tipos_exame_v17` antes do CREATE (migração reexecutável)
- [x] Corrigido: `PRAGMA foreign_keys = OFF/ON` durante recriação da tabela (FK constraint)
- [x] `npm run dev` executa sem erros
