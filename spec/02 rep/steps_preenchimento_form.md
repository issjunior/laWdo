# Stepper de Preenchimento do Formulário de REP

> 📡 **Integração GDL:** O CardHeader do formulário possui botão "GDL" que abre o modal de consulta à API.
> Veja [`spec/08 gdl/api_gdl.md`](../08%20gdl/api_gdl.md).

## Problema

O formulário de criação/edição de REP em `REPsPage.tsx` usava um Accordion de 3 níveis (Dados da Solicitação → Documentos Associados → Campos Específicos). Os campos nativos de Documentos Associados (`numero_bo`, `numero_ip`, `lacre_entrada`, `lacre_saida`, `nome_envolvido`) foram removidos do schema (migration v23) e migrados para `campos_especificos` por tipo de exame. Múltiplos blocos de formulário renderizados simultaneamente tornavam o preenchimento confuso.

## Solução

Substituir o Accordion por um **stepper vertical lateral colapsável** que guia o preenchimento, com passos fixos + passos dinâmicos baseados no tipo de exame selecionado.

---

## Decisões de Design

| # | Tópico | Decisão |
|---|---|---|
| 1 | Escopo | Apenas `REPsPage.tsx` (formulário de criação/edição de REP) |
| 2 | Padrão visual | Vertical lateral, posicionado à esquerda do card do formulário |
| 3 | Granularidade | Passos dinâmicos: cada seção do `SECTION_REGISTRY` vira um passo independente (remove agrupamento `group`) |
| 4 | Navegação | Livre — usuário clica em qualquer passo desbloqueado a qualquer momento. Sem validação ao avançar |
| 5 | Estado visual do passo | `pending` (círculo vazio) → `active` (círculo preenchido cor primária, texto bold) → `complete` (check verde quando todos os campos obrigatórios do passo estão preenchidos). Passos sem `requiredFields` (ex: Documentos Associados) ficam permanentemente `pending` — sem falso-positivo |
| 6 | Passos 3+ sem tipo de exame | Bloqueados com ícone de cadeado e tooltip explicativo |
| 7 | Desbloqueio | Mantido: passos 3+ só desbloqueiam quando os 5 campos estiverem preenchidos (`numero`, `data_requisicao`, `tipo_solicitacao`, `numero_documento`, `tipoExameId`). Cadeado visível no stepper com tooltip listando campos faltantes |
| 8 | Layout | Flex row: `[Stepper ~220px] [Card formulário flex-1]` dentro do container `max-w-[1600px]` do REPsPage. Stepper com toggle de colapso |
| 9 | Colapso | Toggle manual (botão seta), padrão é expandido. Colapsado: ~40-50px mostrando números + barra de progresso |
| 10 | Passos dinâmicos | Deriva do `SECTION_REGISTRY` existente via `EXAM_FIELD_MAP[codigo]`. Cada entrada vira um passo numerado sequencialmente após os fixos |
| 11 | Completude de passo | Definida por lista explícita de `requiredFields` no `STEP_REGISTRY` (passos fixos) e `SECTION_REGISTRY` (passos dinâmicos). Campo obrigatório preenchido = conta para completude. Passos com `requiredFields: []` (sem campos obrigatórios) nunca recebem check verde — permanecem `pending` |
| 12 | Agrupamento | Removido. O campo `group` do `SECTION_REGISTRY` é ignorado no stepper. Cada seção é um passo independente |
| 13 | Reuso | Componente genérico `<Stepper>` em `ui/` + hook `useRepStepper` com lógica específica. `REPsPage.tsx` compõe `<Stepper>` + `useRepStepper` diretamente (acesso ao `activeStep` para destaque das seções). `RepStepper.tsx` existe como wrapper opcional com sticky já embutido |
| 14 | Conteúdo do passo ativo | Todos os campos do formulário permanecem renderizados. A seção do passo ativo ganha destaque visual (borda `ring-2 ring-primary` + background) e scroll automático |
| 15 | Passo bloqueado ao clicar | Tooltip explicativo listando quais campos faltam para desbloquear |
| 16 | Accordion | Removido apenas do formulário em `REPsPage.tsx`. O componente `Accordion` de `ui/` permanece inalterado |
| 17 | Botões Salvar/Cancelar | Fixos no rodapé do `CardContent`, sempre visíveis. Salvar valida tudo via zod `superRefine` e submete |
| 18 | Definição de requiredFields | Lista explícita no `STEP_REGISTRY` para passos 1-2 e no `SECTION_REGISTRY` para passos 3+. Ex: `requiredFields: ['numero', 'data_requisicao', 'tipo_solicitacao', 'numero_documento']` |
| 19 | Auto-avançar | Não. Usuário decide quando navegar. O check verde é o feedback de "pronto" |
| 20 | Stepper colapsado | Números + barra de progresso vertical conectando os dots. Sem labels, sem ícones |
| 21 | Destaque do passo ativo no formulário | Scroll automático (`scrollIntoView`) + borda `ring-2 ring-primary` + background `bg-primary/5` na seção correspondente |
| 22 | Scroll do stepper | Sticky via wrapper `<div className="sticky top-[calc(var(--spacing-header,0px)+1rem)]">` no `REPsPage.tsx` — fixo durante o scroll da página, compensando o header |
| 23 | GDL Warning | Exibido como banner no topo do formulário, com botão GDL no CardHeader |
| 24 | Botões Placeholder e Fechar (X) | Mantidos no `CardHeader` do formulário, mesma posição atual |
| 25 | Completude passos 2+ | Adicionar campo `requiredFields: string[]` ao `SECTION_REGISTRY`. Cada entrada declara quais campos são obrigatórios para o passo ser considerado completo |

---

## Estrutura de Arquivos

### Novos

| Arquivo | Responsabilidade |
|---|---|
| `src/renderer/components/ui/stepper.tsx` | Componente `<Stepper>` genérico. Props: `steps: Step[]`, `activeStep: string`, `completedSteps: Set<string>`, `onStepClick: (id: string) => void`, `collapsed: boolean`, `onToggle: () => void`. Renderiza layout vertical com ícones, labels, linha conectora, indicadores de estado |
| `src/renderer/components/rep/RepStepper.tsx` | Wrapper opcional: `<Stepper>` alimentado pelo hook `useRepStepper` com sticky já aplicado. Não usado diretamente — `REPsPage.tsx` compõe hook + Stepper manualmente para ter acesso ao `activeStep` |
| `src/renderer/components/rep/useRepStepper.ts` | Hook: recebe `form`, `tipoExameId`, `tipoExameSelecionado`. Calcula `steps`, `activeStep`, `completedSteps`, `canUnlockDynamic`, `collapsed`/`setCollapsed`, `onStepClick`. Usa `STEP_REGISTRY` + `SECTION_REGISTRY` via `getDynamicSteps()`. Completude: passos com `requiredFields: []` não auto-completam |
| `src/renderer/components/rep/step-registry.ts` | `STEP_REGISTRY` (passo fixo 1 com `id`, `label`, `icon`, `requiredFields`). Função `getDynamicSteps(codigo)` que deriva passos 2+ do `SECTION_REGISTRY` |

### Modificados

| Arquivo | Mudança |
|---|---|
| `src/renderer/pages/REPsPage.tsx` | Removidos imports `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent`, ícones `Lock`/`Zap`, estados `camposEspecificosDesbloqueados`/`accordionValue` e useEffects associados. Adicionados imports `Stepper` + `useRepStepper`. Layout do formulário: `flex gap-6 max-w-[1600px]` com `<Stepper>` sticky à esquerda + `<Card className="flex-1">` à direita. Seções renderizadas flat com `id="step-*"`/`data-step` + destaque `ring-2 ring-primary bg-primary/5` na seção ativa via `stepper.activeStep`. Scroll automático (`scrollIntoView`) ao clicar no stepper. Botões Salvar/Cancelar fixos no rodapé. Input Nº do BO: removido placeholder falso, adicionado `HelpIcon` com formato |
| `src/renderer/components/rep/exam-fields/index.ts` | Adicionado `requiredFields: string[]` a cada entrada do `SECTION_REGISTRY`: `local_fato: ['local_fato']`, `numeracao: ['numeracao_veiculo']`, `acionamento: []` |
| `src/renderer/components/rep/exam-fields/types.ts` | Adicionado campo `requiredFields: string[]` à interface `ExamSection` |
| `src/renderer/components/rep/exam-fields/numeracao.tsx` | Adicionado `COR_MAP` (cores CSS) + bolinhas coloridas (`inline-block w-3 h-3 rounded-full`) ao lado de cada opção no Select de Cor |

---

## Interfaces e Tipos

```ts
// src/renderer/components/ui/stepper.tsx (exportado)
interface Step {
  id: string;
  label: string;
  icon: LucideIcon;
  blocked?: boolean;
  blockedTooltip?: string;
}

interface StepperProps {
  steps: Step[];
  activeStep: string;
  completedSteps: Set<string>;
  onStepClick: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}

// src/renderer/components/rep/step-registry.ts
interface StepEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  requiredFields: string[];
}
```

---

## Comportamento do Stepper

```
Passo fixo (sempre presente):
  1. Dados da Solicitação   [FileText]   requiredFields: [numero, data_requisicao, tipo_solicitacao, numero_documento]

Passos dinâmicos (visíveis após tipo de exame selecionado, bloqueados até 5 campos preenchidos):
  2. Dados da Investigação  [Crosshair]  requiredFields: [b602_envolvidos_0, b602_data_ocorrencia, b602_local, b602_solicitante_nome]
  3. Material Encaminhado   [Package]    requiredFields: []
  4. Cartuchos              [Target]     requiredFields: []
  5. Estojos                [Layers]     requiredFields: []
  
  (derivados de getSectionsForExame(tipo.codigo), ordenados por posição no SECTION_REGISTRY)
```

### Estados visuais de cada item no stepper

| Estado | Aparência |
|---|---|
| `pending` | Círculo cinza vazio, texto normal |
| `active` | Círculo preenchido cor primária, texto bold |
| `complete` | Check verde (CheckCircle), texto normal |
| `blocked` | Ícone Lock, opacidade reduzida, cursor `not-allowed` |

### Tooltip ao clicar em passo bloqueado

Lista dinâmica dos campos faltantes:
- "Preencha: Nº da REP, Data de recebimento, Tipo de Solicitação, Nº da Solicitação, Tipo de Exame"
- Ou apenas os que faltam: "Preencha: Nº da REP, Tipo de Exame"

---

## Layout Visual

```
┌─ SidebarInset (main content) ──────────────────────────────────────────┐
│                                                                         │
│  ┌─ Header ──────────────────────────────────────────────────────────┐ │
│  │ REPS / Nova Requisição                     [Placeholders] [X]      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌─ max-w-[1600px] mx-auto ──────────────────────────────────────────┐ │
│  │                                                                     │ │
│  │  ┌──────────┐  ┌─ Card (flex-1) ────────────────────────────────┐ │ │
│  │  │ Stepper  │  │                                                 │ │ │
│  │  │          │  │  ┌─ Seção Dados da Solicitação ──────────────┐ │ │ │
│  │  │ ● 1 Dados│  │  │  (campos com destaque ring-primary)       │ │ │ │
│  │  │ │        │  │  └───────────────────────────────────────────┘ │ │ │
│  │  │ 🔒 2 Inv │  │                                                 │ │ │
│  │  │ │        │  │  ┌─ Seção Dados da Investigação ────────────┐ │ │ │
│  │  │ 🔒 3 Mat │  │  │  (sem destaque)                           │ │ │ │
│  │  │ 🔒 4 Car │  │  └──────────────────────────────────────────┘ │ │ │
│  │  │          │  │                                                 │ │ │
│  │  │ [<<]     │  │  ┌─ Botões ──────────────────────────────────┐ │ │ │
│  │  │          │  │  │        [Cancelar]  [Salvar]               │ │ │ │
│  │  └──────────┘  │  └───────────────────────────────────────────┘ │ │ │
│  │                 └─────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Modo colapsado

```
  │ 1│
  │ ││
  │ 2│  ┌─ Card ──────────────────────────────────────────────────────┐
  │ ││  │                                                              │
  │ 🔒│  │  ...                                                        │
  │ ││  │                                                              │
  │ 🔒│  └──────────────────────────────────────────────────────────────┘
  │ [>>]
```

---

## Mudanças no `SECTION_REGISTRY`

```ts
// exam-fields/index.ts — implementação real (group mantido do original, ignorado pelo stepper)
export const SECTION_REGISTRY: Record<string, ExamSection> = {
  local_fato: {
    id: 'local_fato',
    label: 'Local do Fato',
    icon: MapPin,
    description: 'Coordenadas geográficas e descrição do local periciado',
    component: LocalFatoFields,
    group: 'envolvido-local',  // mantido, ignorado pelo stepper
    requiredFields: ['local_fato'],
  },
  acionamento: {
    id: 'acionamento',
    label: 'Linha do Tempo',
    icon: Clock,
    description: 'Registro de acionamento, chegada e saída do local',
    component: AcionamentoFields,
    group: null,
    requiredFields: [],
  },
  numeracao: {
    id: 'numeracao',
    label: 'Numerações Identificadoras',
    icon: Hash,
    description: 'Dados específicos para exame de numeração (I-801)',
    component: NumeracaoFields,
    group: null,
    requiredFields: ['numeracao_veiculo'],
  },
};
```

---

## Checklist de Implementação

- [x] Criar `src/renderer/components/ui/stepper.tsx` — componente genérico
- [x] Criar `src/renderer/components/rep/step-registry.ts` — STEP_REGISTRY + getDynamicSteps + getMissingUnlockFields
- [x] Criar `src/renderer/components/rep/useRepStepper.ts` — hook com toda lógica
- [x] Criar `src/renderer/components/rep/RepStepper.tsx` — composição Stepper + hook (wrapper opcional)
- [x] Adicionar `requiredFields` ao `SECTION_REGISTRY` em `exam-fields/index.ts`
- [x] Adicionar `requiredFields` à interface `ExamSection` em `exam-fields/types.ts`
- [x] Modificar `REPsPage.tsx`:
  - [x] Remover imports: `Accordion`, `AccordionContent`, `AccordionItem`, `AccordionTrigger`, `Lock`, `Zap`
  - [x] Remover estados: `camposEspecificosDesbloqueados`, `accordionValue` e useEffects associados
  - [x] Adicionar imports `Stepper` + `useRepStepper`
  - [x] Mudar layout do formulário para flex row (stepper sticky + card flex-1)
  - [x] Adicionar `id="step-*"` e `data-step` nas seções do formulário para scroll/destaque
  - [x] Implementar lógica de destaque visual da seção ativa (`ring-2 ring-primary bg-primary/5`)
  - [x] Implementar scroll automático ao trocar de passo (`scrollIntoView`)
  - [x] Remover `<Accordion>` wrapper e seus itens
  - [x] Atualizar `handleNovo` e `handleCancelar` removendo referências a estados removidos
  - [x] Atualizar `handleEditar` removendo `setCamposEspecificosDesbloqueados` e `hasSpecificSections`
  - [x] Manter botões Salvar/Cancelar no rodapé do CardContent
  - [x] Remover placeholder falso do input Nº do BO, adicionar HelpIcon com formato
- [x] Adicionar `COR_MAP` + bolinhas coloridas no Select de Cor em `numeracao.tsx`
- [x] Testar com tipo de exame `B-602` (passos: Dados da Solicitação, Dados da Investigação, Material Encaminhado, Cartuchos, Estojos)
- [x] Testar com tipo de exame `I-801` (passos: Dados da Solicitação, Numerações Identificadoras)
- [x] Testar sem tipo de exame (apenas passo 1, passos 2+ com cadeado)
- [x] Testar colapso/expansão do stepper
- [x] Testar completude visual (check verde)
- [x] Testar tooltip de passo bloqueado
- [x] Testar scroll e destaque da seção ativa
- [x] Testar edição de REP existente (passos dinâmicos já desbloqueados quando aplicável)
- [x] Verificar build (Vite 2138 módulos, sem erros)
- [x] Verificar lint (novos arquivos: zero erros)
