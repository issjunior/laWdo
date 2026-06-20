# Ciclo de Vida do Laudo

> **Status**: Implementado (2025-05-29)  
> **Escopo**: Transições de status, exclusão com senha, UI de ações, auditoria do ciclo de vida
> **Status válidos:** `Em andamento`, `Concluído`, `Entregue` — somente estes 3. O status `Bloqueado` documentado em `wizard_pecas.md` **não foi implementado** no código atual (`src/main/ipc/handlers/laudo.handlers.ts:222`).

---

## Máquina de Estados

```
                   laudo:create / rep:create (auto)
                         │
                         ▼
                 ┌──────────────┐
          ┌─────▷│ Em andamento │◁──────────────────┐
          │      └──────┬───────┘                   │
          │             │                           │
          │    ┌────────▼────────┐                  │
          │    │   Concluído     │                  │
          │    └────────┬───────┘                  │
          │             │                           │
          │    ┌────────▼────────┐    Reabrir       │
          │    │    Entregue     │───(Undo2)────────┘
          │    └─────────────────┘
          │
          └─── Preencher (RotateCcw) reabre de Concluído/Entregue

          Em qualquer status: Excluir (com senha se Concluído/Entregue)
```

### Transições

| De | Para | Ação | Handler | Preenche data |
|---|---|---|---|---|
| (criação) | Em andamento | `laudo:create` / auto via `rep:create` | `laudo.service.ts:16` | `data_inicio` |
| Em andamento | Concluído | Botão "Concluir" | `laudo:updateStatus` | `data_conclusao` |
| Concluído | Entregue | Botão "Entregar" | `laudo:updateStatus` | `data_entrega` |
| Concluído / Entregue | Em andamento | Botão "Preencher" (↺) | `laudo:updateStatus` | — |
| Entregue | Concluído | Botão "Reabrir" (Undo2) | `laudo:updateStatus` | — |
| Qualquer | (excluído) | Botão "Excluir" | `laudo:delete` | — |

---

## Service: `laudoService.updateStatus()`

**Arquivo**: `src/main/services/laudo.service.ts:137`

```ts
async updateStatus(id: string, status: string): Promise<LaudoRow>
```

Comportamento:
- Atualiza a coluna `status`
- Se `status === 'Concluído'` → preenche `data_conclusao = now`
- Se `status === 'Entregue'` → preenche `data_entrega = now`
- Atualiza `updated_at = CURRENT_TIMESTAMP`

---

## IPC Handler: `laudo:updateStatus`

**Arquivo**: `src/main/ipc/handlers/laudo.handlers.ts:127`

Assinatura: `(laudoId: string, novoStatus: string) → { success, data?, error? }`

- Valida status: `['Em andamento', 'Concluído', 'Entregue']`
- Busca laudo atual (`laudoService.findById`) para capturar `statusAnterior`
- Chama `laudoService.updateStatus(laudoId, novoStatus)`
- Audita transição: `auditCicloVida('transicao_status')` com `dados_anteriores` e `dados_novos`

---

## IPC Handler: `laudo:delete` (com userId e correção de bug)

**Arquivo**: `src/main/ipc/handlers/laudo.handlers.ts:99`

Assinatura: `(laudoId: string, userId?: string) → { success, error? }`

Mudanças em relação ao original:
- **Busca o laudo antes de deletar** para obter `statusAnterior` real
- **Corrigido bug**: `dados_anteriores` usava hardcoded `'Concluído'` → agora usa `laudo.status` real
- **Aceita `userId` opcional** para rastrear quem excluiu

```ts
const laudo = await laudoService.findById(laudoId);
const statusAnterior = laudo.status;
const { rep_id } = await laudoService.deletar(laudoId);
await repService.updateStatus(rep_id, 'Pendente');

auditDelete(userId || '', 'laudos', laudoId,
  `Laudo ${laudoId} excluído (status: ${statusAnterior})`, ...);
auditCicloVida(userId || '', 'rep', rep_id, 'transicao_status', ...,
  { status: statusAnterior },  // ← corrigido
  { status: 'Pendente', motivo: 'laudo_excluido' });
```

---

## UI: Ações na Tabela de Laudos

**Arquivo**: `src/renderer/pages/LaudosPage.tsx`

### Ordem dos ícones (esquerda → direita)

```
[📤 Entregar] [✓ Concluir] [✏/↺ Preencher]  |  [🗑 Excluir]
```

### Comportamento por status

| Status | Entregar | Concluir | Preencher | Excluir |
|---|---|---|---|---|
| **Em andamento** | Cinza `opacity-30` | Clicável | ✏ `Edit` "Abrir editor" | 🗑 sem senha |
| **Concluído** | Clicável | Cinza | ↺ `RotateCcw` "Reabrir para edição — status voltará para Em andamento" | 🗑 com senha |
| **Entregue** | Cinza | Cinza | ↺ `RotateCcw` "Reabrir para edição — status voltará para Em andamento" | 🗑 com senha |

### Botão Preencher (ícone condicional)

O mesmo botão muda de comportamento conforme o status:
- **Em andamento**: `Edit` — abre o editor diretamente
- **Concluído / Entregue**: `RotateCcw` — chama `handleUpdateStatus('Em andamento')` + `handleEditar()`

### Badges de Status

| Status | Cor | Classes |
|---|---|---|
| Em andamento | Âmbar | `bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700` |
| Concluído | Verde | `bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700` |
| Entregue | Azul | `bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-700` |

### Filtro por Abas (Segmented Pill Bar)

**Arquivo**: `src/renderer/pages/LaudosPage.tsx` (linhas ~2812-2835)

A listagem de laudos possui 4 pílulas de filtro horizontal, uma para cada visão:

| Pílula | Status filtrado | Cor (ativa) | Dot |
|--------|----------------|-------------|-----|
| **Todos** | Todos os status | `bg-primary` | Mostrado apenas quando inativo (dot neutro) |
| **Em andamento** | `Em andamento` | `bg-amber-500` | âmbar |
| **Concluídos** | `Concluído` | `bg-emerald-500` | verde |
| **Entregues** | `Entregue` | `bg-blue-500` | azul |

#### Design visual

- **Pílulas horizontais** com `flex-1` (distribuição igualitária) e `gap-3` entre elas
- **Ativa**: background + borda sólida na cor do status, texto branco, `shadow-sm`
- **Inativa**: `bg-transparent`, `border-border/60`, `text-muted-foreground`, hover sutil
- **Contagem**: badge arredondado à direita do label (semi-transparente no ativo, `bg-muted` no inativo)
- **Dot colorido**: presente nas inativas, substituído por dot branco nas ativas
- **Transições**: `transition-all duration-200` em todas as interações
- **Full-width**: a página usa `w-full` em vez do antigo `container max-w-[1400px]`

#### Lógica de filtro

```typescript
const [tabFiltro, setTabFiltro] = useState<string>('todos');

const laudosFiltrados = useMemo(() => {
  if (tabFiltro === 'todos') return laudos;
  const statusMap: Record<string, string> = {
    'em_andamento': 'Em andamento',
    'concluidos': 'Concluído',
    'entregues': 'Entregue',
  };
  return laudos.filter(l => l.status === statusMap[tabFiltro]);
}, [laudos, tabFiltro]);
```

#### Tratamento de `data-[state=active]`

O `<TabsTrigger>` do shadcn/ui aplica `data-[state=active]:bg-background` por padrão, o que sobrescreveria as cores das pílulas ativas. A solução foi explicitar `data-[state=active]` nos próprios `className` de cada variante via funções helper (`pillVariant`, `dotClasses`, `badgePill`), garantindo que as cores do status prevaleçam independente do momento em que o Radix aplica o atributo.

#### Componentes shadcn/ui usados

`Tabs`, `TabsList`, `TabsTrigger`, `Badge`

---


### Fluxo condicional

| Status | Passos |
|---|---|
| **Em andamento** | 1 passo: aviso padrão + botão "Excluir Laudo" |
| **Concluído / Entregue** | 2 passos: (1) campo de senha + "Verificar Senha" → (2) confirmação final + "Excluir Laudo" |

### Componentes shadcn/ui usados
`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `Button`, `Input`, `Alert`, `AlertDescription`, ícones `ShieldAlert`, `Lock`

### Implementação

**Arquivo**: `src/renderer/pages/LaudosPage.tsx`

- `handleAbrirExclusao(laudo)` → define `passoExclusao = 'senha'` se `Concluído`/`Entregue`, senão `'confirmado'`
- `handleVerificarSenhaExclusao()` → chama `window.ipcAPI.verifyPassword(userId, senha)`
- `handleExcluir()` → chama `window.ipcAPI.laudo.delete(id, userId)` passando `userId` para status finalizados

### Preload

**Arquivo**: `src/preload/index.ts`

```ts
verifyPassword: (userId: string, password: string) => ipcRenderer.invoke('user:verifyPassword', userId, password)
delete: (laudoId: string, userId?: string) => ipcRenderer.invoke('laudo:delete', laudoId, userId)
```

---

## Auditoria do Ciclo de Vida

Todas as transições de status e exclusões são registradas na tabela `logs_auditoria`:

| Evento | `tipo_acao` | `dados_anteriores` | `dados_novos` |
|---|---|---|---|
| Laudo criado | `criacao` | `null` | `{rep_id, perito_id, template_id, status, versao}` |
| Conteúdo salvo | `atualizacao` | `{versao}` | `{versao}` |
| Status alterado | `transicao_status` | `{status, data_conclusao, data_entrega}` | `{status, data_conclusao, data_entrega}` |
| Laudo excluído | `exclusao` | `{status}` | `null` |
| REP resetada | `transicao_status` | `{status: statusAnterior}` | `{status: 'Pendente', motivo: 'laudo_excluido'}` |

---

## Dark Mode

**Arquivo**: `src/renderer/styles/globals.css`

Overrides para os novos badges:

```css
/* Badges âmbar (Em andamento) */
.dark .bg-amber-100 { background-color: rgba(180, 83, 9, 0.3) !important; }
.dark .text-amber-800 { color: #fcd34d !important; }
.dark .border-amber-300 { border-color: rgba(180, 83, 9, 0.5) !important; }

/* Badges azul (Entregue) */
.dark .bg-blue-100 { background-color: rgba(30, 64, 175, 0.3) !important; }
.dark .text-blue-800 { color: #93c5fd !important; }
.dark .border-blue-300 { border-color: rgba(30, 64, 175, 0.5) !important; }
```

---

## Pontos de Atenção para Manutenção

1. **Status do laudo NUNCA é "Pendente"** — esse é um status da REP. O laudo sempre nasce `Em andamento` via `criarLaudoInicial()` em `laudo.service.ts:40`.

2. **Preencher com ícone condicional**: no `botoesAcaoStatus`, o botão "Preencher" tem `icon: null` porque a renderização decide entre `Edit` e `RotateCcw` com base em `isReadonly`. Não tente adicionar um ícone fixo nesse item do array.

3. **Tooltip do botão Preencher** está inline na renderização, não no array — é o único botão com tooltip dinâmico.

4. **`data_conclusao` e `data_entrega`** são preenchidos automaticamente pelo `laudoService.updateStatus()` — nunca manualmente.

5. **Ao excluir laudo, a REP volta para "Pendente"** — isso é feito no handler `laudo:delete`, não no service.

6. **Senha de exclusão reusa `user:verifyPassword`** com rate-limit de 3 tentativas em 30s — mesmo mecanismo usado na limpeza de logs.
