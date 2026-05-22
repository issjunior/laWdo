# Painel de Ilustrações com Janela Separada — Abordagem Híbrida

## Decisão: Híbrido (inline + pop-out)

O usuário pode usar o painel inline (comportamento atual, ideal para 1 monitor)
ou destacá-lo em uma janela separada (ideal para 2+ monitores).
A transição entre os modos é instantânea, com estado preservado.

```
┌── Janela Principal ────────────────────────────┐     ┌── Janela Painel ───────────┐
│ Editor de Laudo                                 │     │ Painel de Ilustrações      │
│                                                 │ IPC │                            │
│ [Ilustrações ▼] ──── split button               │     │  ▓▓▓▓▓▓▓▓▓▓               │
│   ├ Abrir inline                                │     │  insert/delete/legenda     │
│   └ Abrir em janela separada ──────────────────►│     │                            │
│                                                 │◄────│  ações do painel           │
│ Painel inline ── [↗] pop-out ──────────────────►│     │                            │
│                                                 │     │  [Voltar ao editor]        │
│ Seção 1...                                      │     │                            │
│ Seção 2...                                      │     │  ☑ Sincronizar scroll      │
└─────────────────────────────────────────────────┘     └────────────────────────────┘
```

## Fluxo de dados via IPC

```
LaudosPage (main window)                  IlustracoesPanelWindow (pop-out)
───────────────────────────               ────────────────────────────────
figurasNoEditor  ──syncToPanel──►         onStateSync → renderiza props
syncEnabled      ──syncToPanel──►
figuraAtivaId    ──syncToPanel──►

onPanelAction ◄──panel-action──          sendAction('insertImage', ...)
  → insere no editor                      sendAction('deleteImage', ...)
  → remove do editor                      sendAction('updateLegenda', ...)
  → atualiza legenda                      sendAction('reorder', ...)
  → reordena                              sendAction('insertAll', ...)
  → insere todas                          sendAction('refreshHtml', ...)
  → reindexa                              sendAction('syncToggle', ...)
  → toggle sync                           sendAction('scrollToFigure', ...)

onPanelClosed ◄──panel-closed──           Usuário clica X → closed event
```

## Novos arquivos

| Arquivo | Função | Linhas |
|---------|--------|--------|
| `src/renderer/pages/IlustracoesPanelWindow.tsx` | Página standalone do painel, sem Layout (sidebar/header/footer) | ~120 |
| `src/main/ipc/handlers/ilustracoes.handlers.ts` | Criação/remoção do BrowserWindow + relay bidirecional de IPC | ~60 |

### `IlustracoesPanelWindow.tsx`

- Lê `laudoId` dos search params da URL
- No mount, notifica main window que está pronto
- Escuta `ilustracoes:state-sync` e repassa como props ao `IlustracoesPanel`
- Wrappers de callback que convertem props → `sendAction()` via IPC
- Header compacto com título e botão "Voltar ao editor" (fecha a janela)

### `ilustracoes.handlers.ts`

Gerenciado por `registerIpcHandlers()` no `main/ipc/index.ts`:

| Canal IPC | Direção | Função |
|-----------|---------|--------|
| `ilustracoes:open-panel` | renderer → main | Cria BrowserWindow (420x700) e carrega `#/panel-ilustracoes` |
| `ilustracoes:close-panel` | renderer → main | Fecha a janela do painel |
| `ilustracoes:sync-to-panel` | main → panel | LaudosPage → panel: envia figurasNoEditor, syncEnabled, figuraAtivaId |
| `ilustracoes:panel-action` | panel → main | Panel → LaudosPage: ação do usuário (insertImage, deleteImage, etc.) |
| `ilustracoes:panel-closed` | main → LaudosPage | Panel fechado pelo usuário (X) |

## Arquivos modificados

| Arquivo | Mudança | Linhas |
|---------|---------|--------|
| `src/main/ipc/index.ts` | Registrar `registerIlustracoesHandlers(mainWindow)`, exportar ref mainWindow | +3 |
| `src/main/index.ts` | Passar mainWindow ao registrar handlers IPC | +2 |
| `src/preload/index.ts` | Interface `IpcAPI.ilustracoes` + canais ALLOWED_CHANNELS + bridge | +55 |
| `src/renderer/App.tsx` | Rota `#/panel-ilustracoes` fora do Layout | +5 |
| `src/renderer/pages/LaudosPage.tsx` | Estado `panelPoppedOut`, refs de callbacks, sync IPC, split button | +80 / -10 |
| `src/renderer/components/laudo/IlustracoesPanel.tsx` | Prop `onPopOut` + botão `ExternalLink` no header | +8 |

### `preload/index.ts` — Nova interface

```ts
ilustracoes: {
  openPanel: () => void;
  closePanel: () => void;
  syncToPanel: (data: { figurasNoEditor, syncEnabled, figuraAtivaId }) => void;
  sendAction: (action: string, ...args: any[]) => void;
  onPanelAction: (cb: (action: string, ...args: any[]) => void) => () => void;
  onStateSync: (cb: (data) => void) => () => void;
  onPanelClosed: (cb: () => void) => () => void;
};
```

`on*` methods retornam funções de cleanup (`removeListener`). Isso garante que listeners sejam limpos no unmount dos componentes.

Canais adicionados ao `ALLOWED_CHANNELS`:
```
ilustracoes:open-panel, ilustracoes:close-panel, ilustracoes:sync-to-panel,
ilustracoes:panel-action, ilustracoes:state-sync, ilustracoes:panel-closed
```

### `LaudosPage.tsx` — Mudanças

**Estado novo:**
```ts
const [panelPoppedOut, setPanelPoppedOut] = useState(false);
```

**Refatoração de callbacks (extrair de inline para refs reutilizáveis):**

Os 8 callbacks atualmente definidos inline nas props do `IlustracoesPanel` (linhas 1629-1763 do arquivo atual) são extraídos para `useRef`. Isso permite que o mesmo código seja chamado tanto pelo painel inline quanto via IPC do pop-out:

```ts
const panelCallbacks = useRef({
  onInsertImage: (url, id, legenda) => { /* lógica atual */ },
  onDeleteImage: (imageId) => { /* lógica atual */ },
  onUpdateLegenda: (id, legenda) => { /* lógica atual */ },
  onReorder: (imagens) => { /* lógica atual */ },
  onRefreshHtml: () => { /* lógica atual */ },
  onInsertAll: (imagens) => { /* lógica atual */ },
  onSyncToggle: (enabled) => { /* lógica atual */ },
  onScrollToFigure: (imageId) => { /* lógica atual */ },
});
```

**Split button na toolbar (ambas opções de acesso):**

Botão "Ilustrações" atual vira um split button:
- **Clique principal**: alterna painel inline (comportamento atual)
- **Dropdown (chevron)**: opção "Abrir em janela separada"
- Quando `panelPoppedOut = true`, botão principal fecha a janela pop-out e reabre inline
- Badge/estilo `bg-primary/20` indica que o painel está ativo em outra janela

**Ícone pop-out no header do painel inline:**

Adicionado via prop `onPopOut` no `IlustracoesPanel`:
- Ícone `ExternalLink` ao lado do título "Painel de Ilustrações"
- Tooltip: "Abrir em janela separada"
- Ao clicar: fecha painel inline, abre janela pop-out, define `panelPoppedOut = true`

**Sincronização de estado (throttled):**
```ts
useEffect(() => {
  if (!panelPoppedOut) return;
  const timer = setTimeout(() => {
    window.ipcAPI.ilustracoes.syncToPanel({
      figurasNoEditor: extrairFigurasDoEditor(),
      syncEnabled,
      figuraAtivaId,
    });
  }, 100);
  return () => clearTimeout(timer);
}, [panelPoppedOut, extrairFigurasDoEditor, syncEnabled, figuraAtivaId]);
```

**Listener de ações do painel pop-out:**
```ts
useEffect(() => {
  if (!panelPoppedOut) return;
  return window.ipcAPI.ilustracoes.onPanelAction((action, ...args) => {
    const cbs = panelCallbacks.current;
    switch (action) {
      case 'insertImage': cbs.onInsertImage(args[0], args[1], args[2]); break;
      case 'deleteImage': cbs.onDeleteImage(args[0]); break;
      case 'updateLegenda': cbs.onUpdateLegenda(args[0], args[1]); break;
      case 'reorder': cbs.onReorder(args[0]); break;
      case 'refreshHtml': cbs.onRefreshHtml(); break;
      case 'insertAll': cbs.onInsertAll(args[0]); break;
      case 'syncToggle': cbs.onSyncToggle(args[0]); break;
      case 'scrollToFigure': cbs.onScrollToFigure(args[0]); break;
    }
  });
}, [panelPoppedOut]);
```

**Listener de fechamento do painel:**
```ts
useEffect(() => {
  if (!panelPoppedOut) return;
  return window.ipcAPI.ilustracoes.onPanelClosed(() => {
    setPanelPoppedOut(false);
    toast.info('Painel de ilustrações fechado');
  });
}, [panelPoppedOut]);
```

**Cleanup no handleVoltar:**
```ts
if (panelPoppedOut) window.ipcAPI.ilustracoes.closePanel();
```

**O que NÃO é removido de LaudosPage:**
- `iluminacoesPanelOpen` e lógica de toggle inline (permanece para modo inline)
- `panelCollapsed` e `togglePanel` (permanece)
- O bloco JSX do painel inline (linhas 1602-1768 do arquivo atual) **permanece**

### `App.tsx` — Rota

```tsx
// Import
const IlustracoesPanelWindow = lazy(() => import('@/pages/IlustracoesPanelWindow')
  .then(m => ({ default: m.IlustracoesPanelWindow })));

// Route (antes das rotas do Layout, para escapar do sidebar/header/footer)
<Route path="/panel-ilustracoes" element={
  <Suspense fallback={<div>Carregando...</div>}>
    <IlustracoesPanelWindow />
  </Suspense>
} />
```

### `IlustracoesPanel.tsx` — Botão pop-out

```tsx
// Nova prop opcional
onPopOut?: () => void;

// No header (linha ~421), ao lado do título:
{onPopOut && (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPopOut}>
          <ExternalLink size={14} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Abrir em janela separada</TooltipContent>
    </Tooltip>
  </TooltipProvider>
)}
```

## Ciclo de vida da janela pop-out

| Evento | Ação |
|--------|------|
| Usuário clica "Abrir em janela separada" | Fecha painel inline, cria BrowserWindow, `panelPoppedOut = true` |
| Usuário clica X na janela pop-out | `closed` event → notifica LaudosPage → `panelPoppedOut = false` |
| Usuário clica "Ilustrações" (pop-out ativo) | Fecha janela pop-out, reabre inline |
| Usuário clica "Voltar ao editor" (na janela pop-out) | Fecha janela pop-out, reabre inline |
| Usuário clica "Voltar" (sair do editor) | Fecha janela pop-out automaticamente |
| App é fechado | Janela pop-out fecha junto (padrão Electron) |

## Total estimado

| Tipo | Linhas |
|------|--------|
| Código novo | ~195 |
| Código modificado | ~125 |
| **Total** | **~320 linhas** |

## Prós e contras da abordagem híbrida

**Prós:**
- UX adaptável: inline para 1 monitor, pop-out para 2+ monitores
- Transição suave entre modos (sem perda de estado)
- Editor sempre 100% largura quando em pop-out
- Nenhum conflito de layout, scroll, z-index, overflow
- Reutiliza totalmente o `IlustracoesPanel` existente (551 linhas, sem reescrita)

**Contras:**
- ~320 linhas de código novo (vs ~150 do plano original só pop-out)
- Complexidade de relay IPC entre dois processos renderer
- Debug mais complexo (duas janelas, dois contextos React)
