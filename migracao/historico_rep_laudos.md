# Histórico / Linha do Tempo REP e Laudo

> **Status**: Implementado e Refinado (2026-05-31)
> **Escopo**: Timeline de trilha dupla com eventos de REP e Laudo, conexões direcionais, trilha fantasma e visual premium responsivo.

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
│  │   15/03/2026 14:30  │           │                      │
│                        │           │                      │
│  ●── Em Andamento      │── REP→Laudo──►  ●── Em andamento │
│  │   16/03/2026 09:15  │  Iniciou laudo  │   16/03/2026 09:15  │
│                        │           │                      │
│                        │           │  ●── Concluído        │
│                        │           │  │   18/03/2026 16:45  │
│                        │           │                      │
│  ●── Concluído         │◄── Laudo→REP ──┤                  │
│  │   18/03/2026 16:45  │  Concluiu REP │                  │
│                        │           │                      │
│                        │           │  ●── Entregue         │
│                        │           │  │   20/03/2026 10:00  │
│                        │           │                      │
│  (trilha fantasma)     │           │  ─ ─ ─ ─ ─ ─ ─ ─  │
│                        │           │  Aguardando laudo    │
└──────────────────────────────────────────────────────────┘
```

### Identidade visual por trilha

| Atributo | REP (Azul) | Laudo (Violeta) |
|----------|-----|-------|
| Cor da linha | Gradiente de opacidade `blue-400` / `blue-600` | Gradiente de opacidade `violet-400` / `violet-600` |
| Diâmetro da Linha | `w-[3px]` (3px) | `w-[3px]` (3px) |
| Estilo do Dot | `w-4 h-4` com sombra em anel suave (`dual-track-dot-rep`) | `w-4 h-4` com sombra em anel suave (`dual-track-dot-laudo`) |
| Estilo do Card | Borda fina premium + hover com `translateY(-1px)` e sombra | Borda fina premium + hover com `translateY(-1px)` e sombra |
| Badge origem | Pill badge com ícone ScrollText ("REP") | Pill badge com ícone History ("Laudo") |
| Linha fantasma | — | `border-dashed` (`dual-track-ghost` glassmorphism) |

### Conexões com direção (setas)

| Momento | Direção | Label |
|---------|---------|-------|
| Laudo criado | REP ▸ Laudo | "Iniciou laudo" |
| Laudo concluído | Laudo ▸ REP | "Concluiu REP" |
| Laudo reaberto | Laudo ▸ REP | "Reabriu REP" |
| Laudo entregue | Laudo ▸ REP | "Entregue" |
| Laudo excluído | Laudo ▸ REP | "Removeu laudo" |

### Trilha fantasma

Quando não há eventos de Laudo (antes da criação ou após exclusão), a coluna Laudo mostra uma linha tracejada opaca com o texto "Aguardando criação do laudo" no formato de card fantasma com efeito glassmorphism e bordas pontilhadas.

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
    │   ├── DualTrackTimeline.tsx     ← Componente principal com subcomponentes auxiliares
    │   └── RepTimelineDialog.tsx     ← Dialog wrapper com fix de scroll e layout flex
    ├── pages/
    │   ├── LogsPage.tsx              ← 3ª aba "Linha do Tempo"
    │   ├── REPsPage.tsx              ← Botão Histórico
    │   └── LaudosPage.tsx            ← Botão Histórico
    └── styles/
        └── globals.css               ← Estilos personalizados sob .dual-track-*
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
  - Linhas verticais contínuas com gradiente (REP azul, Laudo violeta) como fundo
  - Cada row = 1 instante no tempo: evento REP, Laudo, ou ambos
  - Gutter central (60px): setas de conexão com labels nas rows conectadas
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

## Componentes UI & Refinamentos Premium

### DualTrackTimeline

Componente principal refatorado para usar uma estrutura modularizada e classes personalizadas de CSS para micro-animações e efeitos visuais:
- **`TimelineSkeleton`**: Renderiza 3 linhas simuladas com efeito shimmer (`dual-track-shimmer`) em vez de um spinner estático, melhorando a percepção de velocidade de carregamento.
- **`EmptyState`**: Exibe uma mensagem amigável acompanhada de um ícone ilustrativo centralizado quando não há dados para a REP informada.
- **`EventCard`**: Renderiza os cards de eventos da timeline. Cada card possui um ícone posicionado dentro de um círculo colorido sutil correspondente, cabeçalhos pill badges customizados e efeito hover de elevação.
- **`ConnectionGutter`**: Componente dedicado a renderizar a seta de direção com um badge flutuante estilizado no vão central da timeline.

**Props:**
```typescript
interface DualTrackTimelineProps {
  repId: string;
  repNumero?: string;
}
```

### RepTimelineDialog

Wrapper do diálogo modal otimizado para usabilidade:
- **Fix de Acessibilidade do Botão Fechar**: O botão "Fechar" (x) do Dialog agora permanece fixo no topo direito e não é mais ocultado ao rolar a lista de eventos. Isso foi alcançado estruturando o modal em contêineres flex, onde a cabeceira e o botão de fechar permanecem em `flex-shrink-0` e a timeline em si fica dentro de uma div com `flex-1 overflow-y-auto`.

**Props:**
```typescript
interface RepTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repId: string;
  repNumero: string;
}
```

---

## Design System & CSS Customizado

Toda a estilização premium está centralizada em `src/renderer/styles/globals.css` sob a classe wrapper `.dual-track-timeline`, o que facilita a manutenção e evita poluição por classes utilitárias repetitivas:

1. **Micro-Animações**:
   - `timeline-row-in`: Efeito de entrada de cada linha da timeline com uma leve transição lateral (`translateX(-10px)` para `0`) e fade-in gradual.
2. **Dots de Evento**:
   - `.dual-track-dot-rep` / `.dual-track-dot-laudo`: Possuem uma sombra em anel expandida e translúcida (efeito glow) que destaca o ponto da trilha.
3. **Linhas**:
   - `.dual-track-line-rep` / `.dual-track-line-laudo`: Usam um gradiente de opacidade de cima para baixo de 3px de largura para suavizar o visual.
4. **Cards e Badges**:
   - `.dual-track-card`: Efeito hover com `transform: translateY(-1px)` e sombra suave.
   - `.dual-track-header-rep` / `.dual-track-header-laudo`: Pill badges com texto em caixa alta e cores semitransparentes.

---

## Dark Mode

Suporte premium aprimorado via variáveis de cor e seletores `dark:` no Tailwind CSS integrados às classes globais:
- **Cards Fantasma**: Visual em estilo glassmorphism que se adapta perfeitamente ao fundo escuro.
- **Bordas**: Linhas de trilha e cards ajustados para tons mais profundos de azul e violeta no modo escuro para evitar contraste excessivo e cansaço visual.
- **Conectores**: Badges de conexão no gutter com gradiente e borda sutilmente iluminada.

---

## Pontos de Atenção para Manutenção

1. **Formatação de Data/Hora Brasileira**: As datas vindas do banco de dados (SQLite) utilizam formato ISO com espaço (ex: `2026-05-29 21:15:00`). O helper `formatTimestamp` primeiro normaliza substituindo o espaço por `T` e então usa uma formatação manual e determinística (`dd/MM/yyyy HH:mm`) com `padStart`. Isto garante consistência em diferentes locales no ambiente do Electron.
2. **Largura da Grid CSS**: A grid usa o layout `grid-template-columns: 1fr 60px 1fr` para garantir espaço suficiente para o badge de conexão com label de texto no meio.
3. **Rolagem do Dialog**: A rolagem vertical (`overflow-y-auto`) deve sempre ficar na div filha da timeline dentro do `DialogContent`, e nunca diretamente no `DialogContent`, a fim de preservar o posicionamento absoluto do botão nativo de fechar do Radix UI / Shadcn.
4. **A query aceita `modulo IN ('rep', 'reps')`** — necessário porque `auditDelete` grava o nome da tabela (`'reps'`, `'laudos'`) enquanto `auditCicloVida` grava `'rep'`/`'laudo'`.
5. **Fallback `entidade_id = repId` no UNION de Laudo** — cobre o caso de `rep:create` auditar laudo auto-criado com `entidade_id = rep.id` em vez de `laudo.id`.
6. **Detecção de conexão por timestamp (≤ 2s)** — os handlers escrevem eventos REP e Laudo sequencialmente de forma síncrona, então timestamps ficam dentro de milissegundos. Se houver latência de I/O, o threshold de 2s cobre.
7. **Trilha fantasma** — controlada por `hasLaudoEvents`. Se `laudoEvents.length === 0`, a coluna Laudo renderiza linha tracejada + placeholder. Se um laudo for criado depois, a timeline reflete automaticamente ao recarregar.
8. **Animação escalonada** — cada row recebe `animationDelay` via prop `style` inline calculado por `rowIndex * 50ms`, criando efeito de revelação sequencial.
9. **`RepTimelineDialog` no return correto** — `REPsPage.tsx` tem dois blocos de retorno (tabela quando `!showForm` e formulário). O dialog deve obrigatoriamente ficar dentro do `if (!showForm)`, mesmo bloco onde os botões de ação estão.
