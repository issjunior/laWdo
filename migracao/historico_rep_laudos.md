# Histórico / Linha do Tempo REP e Laudo

> **Status**: Implementado (2026-05-31)
> **Escopo**: Timeline de trilha dupla com eventos de REP e Laudo, conexões direcionais, trilha fantasma

---

## Visão Geral

A feature exibe o ciclo de vida completo de uma REP e seu Laudo em uma visualização de **trilha dupla** (two-column timeline), permitindo ao usuário acompanhar cada evento cronologicamente com distinção visual clara entre as duas entidades.

### Acesso

| Ponto | Local | Ação |
|-------|-------|------|
| Tabela de REPs | `REPsPage.tsx` | Ícone `Clock` na coluna de ações → abre Dialog |
| Tabela de Laudos | `LaudosPage.tsx` | Ícone `Clock` entre status e delete → abre Dialog |
| Página de Logs | `LogsPage.tsx` | 3ª aba "Linha do Tempo" → busca por nº REP → timeline inline |

---

## Layout Visual (Cronológico)

As trilhas REP e Laudo compartilham o mesmo eixo cronológico vertical.
Cada linha da grid representa um instante no tempo, alinhando eventos
simultâneos lado a lado.

```
┌──────────────────────────────────────────────────────────┐
│  REP (azul)           │           │  LAUDO (violeta)     │
│                        │           │                      │
│  ●── Pendente          │           │                      │
│  │   REP criada        │           │                      │
│  │   15/03 14:30       │           │                      │
│                        │           │                      │
│  ●── Em Andamento      │── REP→Laudo──►  ●── Em andamento │
│  │   16/03 09:15       │  Iniciou laudo  │   16/03 09:15  │
│                        │           │                      │
│                        │           │  ●── Concluído        │
│                        │           │  │   18/03 16:45      │
│                        │           │                      │
│  ●── Concluído         │◄── Laudo→REP ──┤                  │
│  │   18/03 16:45       │  Concluiu REP │                  │
│                        │           │                      │
│                        │           │  ●── Entregue         │
│                        │           │  │   20/03 10:00      │
│                        │           │                      │
│  (trilha fantasma)     │           │  ─ ─ ─ ─ ─ ─ ─ ─  │
│                        │           │  Aguardando laudo    │
└──────────────────────────────────────────────────────────┘
```

### Identidade visual por trilha

| Atributo | REP | Laudo |
|----------|-----|-------|
| Cor da linha | `blue-400` | `purple-400` |
| Cor do dot | `blue-500` | `purple-500` |
| Cor do card | borda `blue-200` | borda `purple-200` |
| Badge origem | "REP" outline | "Laudo" outline |
| Linha fantasma | — | `border-dashed border-purple-300/30` |

### Conexões com direção (setas)

| Momento | Direção | Label |
|---------|---------|-------|
| Laudo criado | REP ▸ Laudo | "Iniciou laudo" |
| Laudo concluído | Laudo ▸ REP | "Concluiu REP" |
| Laudo reaberto | Laudo ▸ REP | "Reabriu REP" |
| Laudo entregue | Laudo ▸ REP | "Entregue" |
| Laudo excluído | Laudo ▸ REP | "Removeu laudo" |

### Trilha fantasma

Quando não há eventos de Laudo (antes da criação ou após exclusão), a coluna Laudo mostra uma linha tracejada opaca com o texto "Aguardando criação do laudo".

---

## Arquitetura

### Arquivos

```
src/
├── main/
│   ├── services/
│   │   └── audit-log.service.ts     ← getTimelineRep(repId)
│   └── ipc/handlers/
│       ├── log.handlers.ts           ← log:timeline-rep
│       └── rep.handlers.ts           ← rep:findByNumero
├── preload/
│   └── index.ts                      ← log.timelineRep(), rep.findByNumero()
└── renderer/
    ├── components/timeline/
    │   ├── DualTrackTimeline.tsx     ← Componente principal (~300 linhas)
    │   └── RepTimelineDialog.tsx     ← Dialog wrapper
    ├── pages/
    │   ├── LogsPage.tsx              ← 3ª aba "Linha do Tempo"
    │   ├── REPsPage.tsx              ← Botão Histórico
    │   └── LaudosPage.tsx            ← Botão Histórico
    └── styles/
        └── globals.css               ← Estilos .dual-track-*
```

### Fluxo de dados

```
Usuário clica "Histórico" (REP/Laudo) ou busca na LogsPage
  │
  ▼
RepTimelineDialog / LogsPage
  │
  ▼
DualTrackTimeline(repId)
  │
  ├──► window.ipcAPI.log.timelineRep(repId)
  │      │
  │      ▼
  │    IPC: log:timeline-rep
  │      │
  │      ▼
  │    getTimelineRep(repId)
  │      │
  │      ▼
  │    SELECT * FROM logs_auditoria WHERE modulo IN ('rep','reps') AND entidade_id = ?
  │    UNION ALL
  │    SELECT * FROM logs_auditoria LEFT JOIN laudos ...
  │    WHERE ld.rep_id = ? OR (modulo IN ('laudo','laudos') AND entidade_id = ?)
  │    ORDER BY created_at ASC
  │      │
  │      ▼
  │    Retorna eventos com campo origem = 'REP' | 'Laudo'
  │
  ├──► processEvents() — funde eventos REP+Laudo em ordem cronológica,
  │    agrupa pares com timestamp ≤ 2s em uma mesma row com conexão
  │
  ▼
Render: grid 3-colunas com linhas cronológicas unificadas
  - Linhas verticais contínuas (REP azul, Laudo violeta) como fundo
  - Cada row = 1 instante no tempo: evento REP, Laudo, ou ambos
  - Gutter central: setas de conexão com labels nas rows conectadas
  - Se !hasLaudoEvents: trilha fantasma tracejada na coluna Laudo
```

### Query de timeline

```sql
SELECT la.*, 'REP' as origem FROM logs_auditoria la
WHERE la.modulo IN ('rep', 'reps') AND la.entidade_id = ?
UNION ALL
SELECT la.*, 'Laudo' as origem FROM logs_auditoria la
LEFT JOIN laudos ld ON la.entidade_id = ld.id
WHERE ld.rep_id = ?
   OR (la.modulo IN ('laudo', 'laudos') AND la.entidade_id = ?)
ORDER BY created_at ASC
```

A query cobre 3 cenários de dados:
1. `modulo = 'rep'` — eventos criados por `auditCicloVida('rep', ...)`
2. `modulo = 'reps'` — eventos de exclusão criados por `auditDelete('reps', ...)`
3. `modulo IN ('laudo','laudos')` — eventos de laudo, incluindo fallback `entidade_id = repId` para auto-criação

### Detecção de conexões

`detectConnectionDirection(repEvent, laudoEvent)` analisa pares de eventos com timestamps ≤ 2s:

| Padrão REP | Padrão Laudo | Direção |
|------------|-------------|---------|
| `transicao_status` + "Em Andamento" | `criacao` | `rep→laudo` |
| `transicao_status` + "Conclu" | `transicao_status` + "Conclu" | `laudo→rep` |
| `transicao_status` | `transicao_status` + "Em andamento"/"Reabert" | `laudo→rep` |
| `transicao_status` + "Pendente" | `exclusao` | `laudo→rep` |
| `transicao_status` | `transicao_status` + "Entregue" | `laudo→rep` |

---

## Componentes UI

### DualTrackTimeline

**Props:**
```typescript
interface DualTrackTimelineProps {
  repId: string;
  repNumero?: string;
}
```

**Estados internos:**
- `loading` — spinner enquanto carrega
- `error` — alert destrutivo se falhar
- `empty` — mensagem "Nenhum evento" se array vazio
- `hasLaudoEvents` — controla trilha fantasma vs sólida

### RepTimelineDialog

**Props:**
```typescript
interface RepTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repId: string;
  repNumero: string;
}
```

Dialog com `max-w-4xl max-h-[85vh]` para acomodar as duas colunas.

---

## Dark Mode

Suporte completo via classes `dark:` no Tailwind e overrides no `globals.css`:

- Linhas de trilha: `dark:bg-blue-600` / `dark:bg-purple-600`
- Bordas de cards: `dark:border-blue-800` / `dark:border-purple-800`
- Badges: classes `dark:` já existentes nos status styles (âmbar, emerald, blue)
- Trilha fantasma: `dark:border-purple-700/30`
- Setas de conexão: `filter: drop-shadow` para visibilidade
- Placeholder "Aguardando": `opacity-20` / `opacity-40` para sutileza

---

## Pontos de Atenção para Manutenção

1. **A query aceita `modulo IN ('rep', 'reps')`** — necessário porque `auditDelete` grava o nome da tabela (`'reps'`, `'laudos'`) enquanto `auditCicloVida` grava `'rep'`/`'laudo'`.

2. **Fallback `entidade_id = repId` no UNION de Laudo** — cobre o caso de `rep:create` auditar laudo auto-criado com `entidade_id = rep.id` em vez de `laudo.id`.

3. **Detecção de conexão por timestamp (≤ 2s)** — os handlers escrevem eventos REP e Laudo sequencialmente de forma síncrona, então timestamps ficam dentro de milissegundos. Se houver latência de I/O, o threshold de 2s cobre.

4. **Trilha fantasma** — controlada por `hasLaudoEvents`. Se `laudoEvents.length === 0`, a coluna Laudo renderiza linha tracejada + placeholder. Se um laudo for criado depois, a timeline reflete automaticamente ao recarregar.

5. **Grid CSS `grid-template-columns: 1fr 48px 1fr`** — as duas trilhas ocupam espaço igual, o gutter central (48px) contém as setas de conexão.

6. **Linhas verticais contínuas** — Renderizadas como camada de fundo (`absolute inset-0 z-0`) cobrindo toda a altura. Os dots e cards ficam em `z-10` por cima.

7. **Alinhamento cronológico** — `processEvents()` faz merge ordenado por `created_at`. Pares de eventos com tracks diferentes e timestamp ≤ 2s são agrupados na mesma row com conexão detectada.

8. **O Dialog usa `max-w-4xl`** (mais largo que o padrão `max-w-2xl` do RepTimeline antigo) para acomodar as duas colunas confortavelmente.

9. **Animação escalonada** — cada row recebe `animationDelay` via prop `style` inline calculado por `rowIndex * 50ms`, criando efeito de revelação sequencial.

10. **Ícones contextuais** — `getEventIcon()` escolhe entre `ScrollText` (REP) vs `FilePlus` (Laudo) para criação, `CheckCircle`/`Send`/`RotateCcw` para transições específicas, `Trash2` para exclusão.

11. **`RepTimelineDialog` no return correto** — `REPsPage.tsx` tem dois blocos de retorno (tabela quando `!showForm` e formulário). O dialog deve obrigatoriamente ficar dentro do `if (!showForm)`, mesmo bloco onde os botões de ação estão. Se colocado no return do formulário, o dialog nunca renderiza ao clicar "Histórico" na tabela.
