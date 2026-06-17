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

---

# Rastreamento de Figuras (Imagens) no Editor — Como Construído

> Documentação consolidada do fluxo completo de inserção, alteração, reindex,
> deleção, save/preview e bridge IPC. Escrita em 2026-05-29 com base no
> código implementado.

## 1. Arquitetura geral

```
Usuário interage com:
  ├── TinyMCE Editor (iframe)
  │     ├── Toolbar "Inserir Imagem"  →  file_picker_callback
  │     ├── Colar (Ctrl+V)            →  images_upload_handler → MutationObserver
  │     └── Arrastar do SO            →  images_upload_handler → MutationObserver
  │
  └── IlustracoesPanel (inline ou pop-out)
        ├── Botão "+" por imagem  →  onInsertImage  →  editor.execCommand('insertLaudoImage')
        ├── Botão "Inserir todas" →  onInsertAll    →  aplicarFigurasNoEditor()
        ├── Trash (deletar)       →  onDeleteImage  →  editor.execCommand('removeLaudoImage')
        ├── Drag-and-drop         →  onReorder      →  sincronizarOrdemEditor()
        ├── Editar legenda        →  onUpdateLegenda → DOM direct figcaption update
        └── Botão "Atualizar Figuras" → onRefreshHtml → scanAndWrapImages + reindexFiguras

React State (LaudosPage):
  ├── singleEditorHtml (modo single)  ──┐
  ├── secoes[] (modo multi)           ──┤
  └── editorMode ('single'|'multi')   ──┼── extrairFigurasDoEditor() → figurasNoEditor → painel
                                         │
IPC Bridge (pop-out):                   │
  syncToPanel  ──►  IlustracoesPanelWindow  (state → panel)
  panel-action ◄──  IlustracoesPanelWindow  (panel → ações → callbacks)
```

## 2. Estrutura de dados

### 2.1 Interface `ImagemLaudo` (`IlustracoesPanel.tsx:74-82`)

```ts
export interface ImagemLaudo {
  id: string;           // UUID, usado em data-image-id
  url: string;          // data URI (base64) — imagem completa
  thumbnailUrl: string; // miniatura JPEG 300px 75% quality
  legenda: string;      // texto descritivo (sem prefixo "Figura XX: ")
  numero_figura: number;// 1-based sequencial
  sequencia: number;    // ordem no painel (idem numero_figura)
  created_at: string;   // timestamp ISO
}
```

### 2.2 Markup HTML da figura

```html
<figure class="laudo-figure" data-image-id="uuid"
        style="text-align:center;margin:12px auto;max-width:100%">
  <img src="data:image/png;base64,..." alt="descrição"
       style="max-width:100%;height:auto;border:1px solid #ddd;border-radius:4px;padding:4px"/>
  <figcaption style="font-size:13px;color:#666;font-weight:bold;margin-top:4px">
    Figura 01: descrição da figura
  </figcaption>
</figure>
```

A classe `.laudo-figure` é o marcador universal. Toda função de extração,
reindex, deleção e scroll-sync usa `querySelectorAll('.laudo-figure')` ou
`querySelector('.laudo-figure[data-image-id="..."]')`.

### 2.3 Funções geradoras de markup

| Função | Arquivo:Linha | Propósito |
|---|---|---|
| `buildFigureInnerHtml(url,id,legenda)` | `TinyMceEditor.tsx:7` | Markup `<figure>` sem `<br>` — para criar elementos DOM |
| `buildFigureHtml(url,id,legenda)` | `TinyMceEditor.tsx:17` | Idem + `<br>` ao final — para `insertContent()` |
| `buildFigureHtml(url,id,legenda)` | `LaudosPage.tsx:38` | Versão local usada em `buildFiguresHtml` |
| `buildFiguresHtml(imagens[])` | `LaudosPage.tsx:47` | Concatena `buildFigureHtml` para lista de imagens |

Há duas duplicatas de `buildFigureHtml` (uma em cada arquivo) com o mesmo
markup. Mantidas separadas por contexto (editor vs página).

## 3. Contrato do `IlustracoesPanel` — props

| Prop | Tipo | Origem |
|---|---|---|
| `laudoId` | `string` | `editando.id` |
| `onInsertImage` | `(url, id, legenda) => void` | `panelCallbacksRef.current.onInsertImage` |
| `onInsertAll` | `(imagens: ImagemLaudo[]) => void` | `panelCallbacksRef.current.onInsertAll` |
| `onDeleteImage` | `(imageId: string) => void` | `panelCallbacksRef.current.onDeleteImage` |
| `onReorder` | `(imagens: ImagemLaudo[]) => void` | `panelCallbacksRef.current.onReorder` |
| `onRefreshHtml` | `() => void` | `panelCallbacksRef.current.onRefreshHtml` |
| `figurasNoEditor` | `ImagemLaudo[]` | `extrairFigurasDoEditor()` — recalculado a cada render |
| `onUpdateLegendaInEditor` | `(id, legenda) => void` | `panelCallbacksRef.current.onUpdateLegenda` |
| `syncEnabled` | `boolean` | Estado React `syncEnabled` |
| `figuraAtivaId` | `string \| null` | IntersectionObserver — figura mais visível |
| `onSyncToggle` | `(enabled: boolean) => void` | `setSyncEnabled` |
| `onScrollToFigure` | `(imageId: string) => void` | `handleScrollToFigure` |
| `onPopOut` | `() => void` | `handlePopOut` (abre janela separada) |

## 4. Os 10 callbacks do `panelCallbacksRef`

Definidos em `LaudosPage.tsx:749-1029`. Usam `useRef` para estabilidade e
para permitir compartilhamento entre painel inline e IPC do pop-out.

### Tabela de equivalências single vs multi

| Callback | Single mode | Multi mode |
|---|---|---|
| **onInsertImage** | `parseSingleHtmlToSecoes` + `setSecoes` + `setSingleEditorHtml` + `editor.setContent()` | `aplicarFigurasNoEditor('insertImage', ...)` → `execCommand` ou remount |
| **onDeleteImage** | `removeLaudoImage` + `extrairFigurasDoHtml` (se vazio, remove seção) | `removeLaudoImage` no editor da seção ILUSTRAÇÕES + fallback state-path |
| **onUpdateLegenda** | DOM direto no `laudo-single-editor` + state sync | Itera `secao-{idx}`, DOM direto + `atualizarConteudoSecao` |
| **onReorder** | `buildFiguresHtml` + `buildSingleHtmlFromSecoes` + `editor.setContent` | `sincronizarOrdemEditor` → `aplicarFigurasNoEditor('reorder', ..., true)` |
| **onRefreshHtml** | `scanAndWrapImages` + state sync | Itera todos `secao-{idx}`, `scanAndWrapImages` cada + `setSecoes` |
| **onInsertAll** | Igual `onInsertImage` mas em lote com `buildFiguresHtml` | `aplicarFigurasNoEditor('insertAll', ...)` |
| **onReplaceImage** | `replaceLaudoImage` via `execCommand` + `getContent()` + state sync | Itera `secao-{idx}`, busca `data-image-id`, `execCommand` + `atualizarConteudoSecao` |
| **onSyncToggle** | `setSyncEnabled(enabled)` | (idêntico) |
| **onScrollToFigure** | Busca `.laudo-figure[data-image-id="..."]` no `laudo-single-editor` | Itera `secao-{idx}` até encontrar |
| **syncCurrentState** | Envia `extrairFigurasDoEditor()` + `syncEnabled` + `figuraAtivaId` + `tema` via IPC | (idêntico) |

### `syncCurrentState` — detalhe

```ts
syncCurrentState: () => {
  window.ipcAPI.ilustracoes.syncToPanel({
    figurasNoEditor: extrairFigurasDoEditor(),
    syncEnabled,
    figuraAtivaId,
    tema: document.body.classList.contains('dark') ? 'dark' : 'light',
  });
},
```

Chamado 3 vezes consecutivas no `handlePopOut` (linhas 1081-1083) com
timeouts 0ms, 300ms, 700ms. Garante que a janela pop-out receba estado
mesmo se a primeira tentativa chegar antes do listener `onStateSync` ser
registrado no lado receptor.

## 5. Fluxos detalhados

### 5.1 Inserção — 3 caminhos

#### 5.1.1 Caminho A: Toolbar "Inserir Imagem"

```
file_picker_callback (TinyMceEditor.tsx:248)
  → <input type="file" accept="image/*">
  → FileReader.readAsDataURL(file)
  → buildFigureHtml(dataUri, crypto.randomUUID(), '')
  → editor.insertContent(html)               ← figura já nasce estruturada
```

Não requer pós-processamento.

#### 5.1.2 Caminho B: Colar (Ctrl+V)

```
images_upload_handler (TinyMceEditor.tsx:168)
  → FileReader.readAsDataURL(blobInfo.blob())
  → resolve(dataUri) → TinyMCE insere <img src="data:...">

paste_postprocess (TinyMceEditor.tsx:178) — age no fragmento ANTES da inserção
  → processarImagensPuras(fragment) → wrapImgAsFigure() nos <img> sem .laudo-figure

MutationObserver (TinyMceEditor.tsx:361) — age no DOM vivo após inserção
  → coleta <img> órfãos (fora de .laudo-figure)
  → editor.undoManager.transact(() => { wrapImgAsFigure() + replaceChild })
  → onChange(editor.getContent()) — SINCRONIZA estado React
```

Duas camadas de proteção: `paste_postprocess` (pré-inserção) + `MutationObserver` (pós-inserção).

#### 5.1.3 Caminho C: Arrastar do sistema operacional

```
images_upload_handler → dataUri → TinyMCE insere <img>
MutationObserver → wrap → onChange ✓
```

`paste_postprocess` não cobre drag/drop — apenas o MutationObserver.

#### 5.1.4 Caminho D: Botão "+" no painel de ilustrações

```
IlustracoesPanel: usuário clica "+" em SortableItem
  → onInsertImage(url, id, legenda)

LaudosPage.onInsertImage:
  ├─ single: parse + rebuild com buildFigureHtml + setContent
  └─ multi:  aplicarFigurasNoEditor('insertImage', ...)
       ├─ editor pronto → execCommand('insertLaudoImage') + insertContent
       └─ editor offline → buildFiguresHtml + state update + remount editor
```

`aplicarFigurasNoEditor` (linha 672) tem dois modos:
- **execCommand**: se `editor.initialized && editor.getBody()`, chama
  `insertLaudoImage` diretamente. Rápido, sem flicker.
- **remount**: se o editor não está com body carregado (ex: seção colapsada
  que expandiu), atualiza o HTML no estado e força remount do componente
  TinyMCE via `ilustracoesKey++`.

#### 5.1.5 Caminho E: Botão "Inserir todas" no painel

```
IlustracoesPanel: botão "Inserir Todas (N)"
  → onInsertAll(imagens[])

LaudosPage.onInsertAll:
  ├─ single: parse + rebuild + buildFiguresHtml(lote)
  └─ multi:  aplicarFigurasNoEditor('insertAll', imagens)
       → mesmo execCommand/remount dual-path
```

### 5.2 Deleção

#### Via botão trash no painel (FiguraEditorItem)

```
IlustracoesPanel → onDeleteImage(imageId)

LaudosPage.onDeleteImage:
  ├─ single:
  │   editor.execCommand('removeLaudoImage', false, { id: imageId })
  │   parseSingleHtmlToSecoes(editor.getContent())
  │   se seção ILUSTRAÇÕES ficou sem figuras → remove seção + reindex secoesColapsadas
  │   setSingleEditorHtml + setSecoes
  │
  └─ multi:
      localiza idxIlustracoes (se não existe, aborta)
      localiza editor = tinymce.get('secao-{idxIlustracoes}')
      ├─ editor pronto:
      │   execCommand('removeLaudoImage', false, { id })
      │   atualizarConteudoSecao(idxIlustracoes, editor.getContent())
      │   se sem figuras → remove seção + reindex secoesColapsadas
      │
      └─ editor offline:
          fallback state-path: DOMParser no HTML, remove o figure,
          atualiza setSecoes
```

Efeito cascata: se a última figura for removida, a **seção ILUSTRAÇÕES
inteira é deletada** e os índices em `secoesColapsadas` são reindexados para
compensar o shift.

### 5.3 Edição de legenda

Dois caminhos independentes:

#### Via input no painel — SortableItem e FiguraEditorItem

Ambos usam debounce de 600ms (useEffect com `setTimeout`/`clearTimeout`):

```
Usuário digita no Input
  → setLegenda(e.target.value)            ← estado local imediato (UX)
  → após 600ms sem digitar:
      onUpdateLegenda(imagem.id, legenda)  ← persiste no estado do painel
```

#### Sincronização com editor — `onUpdateLegenda` no LaudosPage

```
IlustracoesPanel → onUpdateLegenda(id, legenda)

LaudosPage.onUpdateLegenda:
  busca .laudo-figure[data-image-id="id"] no editor (single ou iterando multi)
  atualiza figcaption.textContent preservando prefixo "Figura NN: "
  atualiza img.alt = figcaption.textContent
  single: setSingleEditorHtml + setSecoes
  multi:  atualizarConteudoSecao(idx, editor.getContent())
```

A lógica preserva o número existente (ex: `Figura 03:`) ou usa `Figura XX`
se ainda não numerado.

### 5.4 Reordenação — drag-and-drop no painel

```
IlustracoesPanel: usuário arrasta item (SortableItem com useSortable de @dnd-kit)
  → onDragEnd recalcula numero_figura e sequencia
  → onReorder(imagensOrdenadas)

LaudosPage.onReorder:
  ├─ single:
  │   buildSingleHtmlFromSecoes + buildFiguresHtml + editor.setContent
  │
  └─ multi:
      sincronizarOrdemEditor() → aplicarFigurasNoEditor('reorder', imagens, true)
        → substituirConteudo=true: limpa todas .laudo-figure existentes
        → insere na nova ordem via execCommand('insertLaudoImage')
```

### 5.5 Numeração e reindex

#### Reindex automático (save e preview)

```
handleSalvar (LaudosPage.tsx:1237):
  reconstruirConteudo(secoesAtuais) → HTML completo de todas as seções
  reindexarFiguras(html)            → numeração sequencial (Figura 01, 02, ...)
  removerFormatacaoPlaceholders(html)
  ipcAPI.laudo.updateConteudo(id, conteudoFinal)

handlePreview (LaudosPage.tsx:1101):
  reconstruirConteudo → reindexarFiguras → aplicarPlaceholders → previewPDF
```

Ambos chamam `reindexarFiguras()` de `src/renderer/lib/figuras.ts:13`:
- Itera `.laudo-figure` por ordem de aparição no HTML
- `Figura XX` → `Figura 01`, `Figura 02`...
- Preserva legenda existente: `Figura 03: foto do local`
- Sincroniza `img.alt = figcaption.textContent`

#### Reindex manual

Dois pontos de acesso ao mesmo callback `onRefreshHtml`:

| Local | Componente |
|---|---|
| `RefreshCw` no toolbar do editor | `LaudosPage.tsx:1730` — `panelCallbacksRef.current.onRefreshHtml()` |
| "Atualizar Figuras" no painel | `IlustracoesPanel.tsx:534` — `onRefreshHtml()` |

**O que `onRefreshHtml` faz** (linhas 949-973):

```ts
onRefreshHtml: () => {
  if (editorMode === 'single') {
    editor.execCommand('scanAndWrapImages');  // wrap img órfãos + reindex
    const novoHtml = editor.getContent();
    setSingleEditorHtml(novoHtml);
    setSecoes(parseSingleHtmlToSecoes(novoHtml, secoes));
  } else {
    setSecoes(prev => {
      const novas = [...prev];
      for (let idx = 0; idx < prev.length; idx++) {
        const editor = tinymce.get(`secao-${idx}`);
        if (editor) {
          editor.execCommand('scanAndWrapImages');  // cada seção
          novas[idx] = { ...novas[idx], conteudo: editor.getContent() };
        } else {
          // fallback: editor não carregado
          novas[idx] = { ...novas[idx], conteudo: reindexarFiguras(prev[idx].conteudo) };
        }
      }
      return novas;
    });
  }
}
```

`scanAndWrapImages` primeiro chama `scanEditorForRawImages` (converte `<img>`
órfãos em figuras), depois `reindexFiguras` (renumera). Se o editor não
estiver carregado (seção colapsada), cai no fallback que só reindexa o HTML
existente.

#### Reindex via `scanAndWrapImages` — comando TinyMCE (`TinyMceEditor.tsx:325`)

```ts
editor.addCommand('scanAndWrapImages', () => {
  const count = scanEditorForRawImages(editor);  // wrap img órfãos
  editor.execCommand('reindexFiguras');           // renumera tudo
  return count;
});
```

## 6. Seção ILUSTRAÇÕES — ciclo de vida

### Criação automática

Função `garantirSecaoIlustracoes()` (`LaudosPage.tsx:564`):

Regra de posicionamento (ordem de prioridade):
1. **Antes de "CONSIDERAÇÕES FINAIS"** (se existir)
2. **Antes de "ENCERRAMENTO"** (se existir)
3. **Antes de "CONCLUSÃO"** (se existir)
4. **No final** (última seção)

Usada por todos os callbacks de inserção (`onInsertImage`, `onInsertAll`)
no modo multi-seção para garantir que a seção exista antes de inserir.

### Remoção automática

Ocorre em `onDeleteImage` quando a última figura é removida da seção:
- Single mode: `parseSingleHtmlToSecoes` → `extrairFigurasDoHtml` → se 0
  figuras, `splice` remove a seção + reindex `secoesColapsadas`
- Multi mode: `editor.getBody()?.querySelector('.laudo-figure')` — se null,
  `splice` remove a seção + reindex `secoesColapsadas`

Toast "Seção ILUSTRAÇÕES removida" notifica o usuário.

### Remontagem

Quando `aplicarFigurasNoEditor` cai no caminho `remount`, o componente
TinyMCE da seção ILUSTRAÇÕES recebe uma key nova (`ilustracoesKey++`) via
`queueMicrotask`. A flag `ilustracoesRemounting` mostra um overlay de
loading. `handleIlustracoesEditorInit` restaura o scroll e limpa a flag.

## 7. Single mode vs Multi mode — comando e estado

| Operação | Single: editor ID | Single: estado | Multi: editor ID | Multi: estado |
|---|---|---|---|---|
| Conteúdo | `laudo-single-editor` | `singleEditorHtml` | `secao-{idx}` | `secoes[idx].conteudo` |
| Parse sections | `parseSingleHtmlToSecoes` | retorna `SecaoEditor[]` | — | `parseConteudoEmSecoes` |
| Rebuild | `buildSingleHtmlFromSecoes` | `<section data-laudo-secao>` | — | `<h2>Título</h2>\n...` |
| Figura extração | `extrairFigurasDoHtml(singleEditorHtml)` | array | `secoes.flatMap(s => extrairFigurasDoHtml(s.conteudo))` | array |
| Figura inserção | `editor.setContent(novoHtml)` + state sync | `setSingleEditorHtml` + `setSecoes` | `editor.execCommand` ou state + remount | `atualizarConteudoSecao` |

Cross-mode sync: `parseSingleHtmlToSecoes` e `buildSingleHtmlFromSecoes`
traduzem entre o markup `<section data-laudo-secao>` do single mode e o
array `SecaoEditor[]` compartilhado. Toda transição entre modos (botão
Layers/List) preserva os dados via essas funções.

## 8. Pop-out bridge — IPC

Quando o painel está em janela separada (`panelPoppedOut = true`), todas as
ações são relayadas via IPC do Electron.

### Canais (`src/preload/index.ts`)

```
ilustracoes:open-panel      → main cria BrowserWindow 420×700
ilustracoes:close-panel     → main fecha a janela
ilustracoes:sync-to-panel   → main → panel: figurasNoEditor, syncEnabled, figuraAtivaId, tema
ilustracoes:panel-action    → panel → main → LaudosPage: insertImage, deleteImage, etc.
ilustracoes:state-sync      → listener no panel: recebe estado
ilustracoes:panel-closed    → main → LaudosPage: usuário fechou a janela (X)
```

### Fluxo de ação (ex: insertImage)

```
IlustracoesPanelWindow (pop-out)
  → sendAction('insertImage', url, id, legenda)
    → ipcRenderer.send('ilustracoes:panel-action', 'insertImage', url, id, legenda)

ilustracoes.handlers.ts (main)
  → panelWindow.webContents.send('ilustracoes:panel-action', ...)  // relay

LaudosPage.tsx
  → onPanelAction callback → switch('insertImage') → cbs.onInsertImage(url, id, legenda)
```

### Fluxo de estado (LaudosPage → panel)

```
useEffect [panelPoppedOut, extrairFigurasDoEditor, syncEnabled, figuraAtivaId]
  → setTimeout 100ms → syncToPanel({ figurasNoEditor, syncEnabled, figuraAtivaId, tema })

IlustracoesPanelWindow
  → onStateSync(data) → setState(data) → renderiza IlustracoesPanel com as props
```

### Handlers no pop-out (`IlustracoesPanelWindow.tsx`)

Todas as 8 ações têm wrappers que chamam `sendAction()`:
`handleInsertImage`, `handleInsertAll`, `handleDeleteImage`,
`handleUpdateLegenda`, `handleReorder`, `handleRefreshHtml`,
`handleSyncToggle`, `handleScrollToFigure`.

### Ciclo de vida da janela pop-out

```
handlePopOut()              → setPanelPoppedOut(true), openPanel(), syncCurrentState ×3
Usuário clica X na janela   → panel-closed IPC → setPanelPoppedOut(false)
Usuário clica "Ilustrações" → closePanel(), setPanelPoppedOut(false), abre inline
Usuário clica "Voltar"      → closePanel() automático
App fecha                   → janela pop-out fecha junto (Electron padrão)
```

## 9. Save e Preview

### `handleSalvar` (`LaudosPage.tsx:1237`)

```
1. Coleta conteúdo atual de todos os editores (getContent)
2. parseSingleHtmlToSecoes (single) ou itera secoes (multi)
3. reconstruirConteudo(secoesAtuais)           → HTML unificado
4. reindexarFiguras(conteudoOriginal)          → numeração sequencial
5. removerFormatacaoPlaceholders(htmlReindexado) → limpa spans de placeholder
6. ipcAPI.laudo.updateConteudo(id, conteudoFinal)  → persiste no banco
7. Atualiza estados locais (singleEditorHtml, secoes, editando)
8. Se single: editor.setContent(conteudoFinal)
```

### `handlePreview` (`LaudosPage.tsx:1101`)

```
1-3. Idem handleSalvar (coleta + reconstroi)
4. buildPdfHeaderConfig() + buscar dados REP + relacionamentos
5. reindexarFiguras(fullHtml)
6. aplicarPlaceholders(html, repData, ...)
7. getMargens() → ipcAPI.template.previewPDF(html, margens, headerTemplate)
8. Blob URL → iframe exibe PDF
```

## 10. Scroll-sync — IntersectionObserver

`LaudosPage.tsx:509-553`: Um `IntersectionObserver` em cada editor monitora
todas as `.laudo-figure` com thresholds `[0, 0.25, 0.5, 0.75, 1]`.

A figura com maior `intersectionRatio` é definida como `figuraAtivaId`. O
`IlustracoesPanel` destaca com borda azul (`ring-2 ring-primary`) o item
correspondente na lista "Figuras no Laudo".

Clique na miniatura → `onScrollToFigure` → `figure.scrollIntoView({ behavior: 'smooth', block: 'center' })`.

## 11. Lightbox — Visualização ampliada com legenda

`IlustracoesPanel.tsx:586-597`: Ao clicar no ícone `Maximize2` (Ampliar) em um
item da aba "Figuras no Laudo", abre um Lightbox (`yet-another-react-lightbox`)
com a imagem em tela cheia e a legenda formatada abaixo.

### Plugins

| Plugin | Import | Função |
|--------|--------|--------|
| `Zoom` | `yet-another-react-lightbox/plugins/zoom` | Zoom in/out com scroll e gestos |
| `Captions` | `yet-another-react-lightbox/plugins/captions` | Renderiza `description` como legenda abaixo da imagem |

CSS adicional: `yet-another-react-lightbox/plugins/captions.css`.

### Formato da legenda

```tsx
slides={figurasNoEditor.map(img => {
  const num = img.numero_figura.toString().padStart(2, '0')
  return {
    src: img.url,
    description: img.legenda
      ? `Figura ${num}: ${img.legenda}`
      : `Figura ${num}`
  }
})}
```

Regras:
- `numero_figura` com 2 dígitos (`padStart(2, '0')`) → `Figura 01`, `Figura 02`...
- Se `legenda` preenchida: `Figura 01: descrição`
- Se `legenda` vazia: `Figura 01`
- Legenda centralizada via `captions={{ descriptionTextAlign: "center" }}`

### Por que `description` e não `title`

O CSS do plugin `Captions` posiciona `title` no topo e `description` na base
do slide. Usar `title` faria a legenda aparecer no canto superior direito.

### Apenas figuras inseridas no editor

O Lightbox das imagens carregadas (aba "Imagens Carregadas", ainda não
inseridas no laudo) **não** inclui o plugin `Captions` nem a formatação
`Figura XX:`. Mantém apenas `title: img.legenda` (comportamento original).

### Lupa nas miniaturas — componente `Lens`

Além do lightbox, as miniaturas das figuras no painel (`SortableItem` / `FiguraEditorItem`)
usam o componente `Lens` (`src/renderer/components/ui/lens.tsx`) para efeito de lupa:

- Envolve o `<img>` da miniatura com `<Lens zoomFactor={1.3} lensSize={170}>`
- `isStatic={false}` — segue o mouse com máscara radial gradient
- `AnimatePresence` anima entrada/saída da lente (duração `0.1s`)
- Requer `"use client"` e usa `motion` de `framer-motion` (`motion/react`)

## 12. Funções utilitárias e comandos

### 12.1 Funções em `TinyMceEditor.tsx` (linhas 6-75)

| Função | Assinatura | Propósito |
|---|---|---|
| `buildFigureInnerHtml` | `(url, id, legenda) → string` | Markup `<figure>` sem `<br>`. Usada p/ DOM |
| `buildFigureHtml` | `(url, id, legenda) → string` | Idem + `<br>`. Usada p/ `insertContent()` |
| `wrapImgAsFigure` | `(img: HTMLImageElement) → HTMLElement` | Gera UUID, cria `<figure>` com `img.src` |
| `processarImagensPuras` | `(raiz: Node) → number` | Varre fragmento, converte `<img>` órfãos. Usada em `paste_postprocess` |
| `scanEditorForRawImages` | `(editor: any) → number` | Varre `getBody()`, converte via `undoManager.transact`. Usada em `scanAndWrapImages` |

### 12.2 Comandos TinyMCE registrados no `setup` (`TinyMceEditor.tsx:282-343`)

| Comando | Ação |
|---|---|
| `insertPlaceholder` | Insere span `{{chave}}` estilizado |
| `insertLaudoImage` | Insere `buildFigureHtml` via `insertContent` |
| `reindexFiguras` | Renumera `Figura XX` → `Figura 01`, `02`... |
| `removeLaudoImage` | Remove `<figure>` por `data-image-id` + trailing `<br>` |
| `replaceLaudoImage` | Substitui `src` de figura dummy por imagem real via `editor.dom.setAttrib()` + `undoManager.transact()` |
| `insertLaudoImageDummy` | Insere placeholder SVG (retângulo escuro + ícone câmera) com `data-dummy="true"` |
| `scanAndWrapImages` | `scanEditorForRawImages` + `reindexFiguras` |

### 12.3 `reindexarFiguras` (`src/renderer/lib/figuras.ts`)

Função pura que opera sobre string HTML (não DOM vivo). Usada no save e
preview. Itera `.laudo-figure` com `DOMParser`, atualiza `figcaption` e
`img.alt`.

### 12.4 Substituição de imagem dummy — `data-mce-src`

**Problema corrigido (2026-06-10):** O TinyMCE armazena internamente a URL
da imagem no atributo `data-mce-src`. O comando `replaceLaudoImage` original
fazia `img.src = novaUrl` (propriedade JS), que **não atualiza** o
`data-mce-src`. Na serialização (`getContent()`), o TinyMCE usa
`data-mce-src` como fonte canônica, devolvendo o SVG dummy original mesmo
após a substituição visual.

**Correção** (`TinyMceEditor.tsx:330`):

```ts
// Antes (❌ não atualiza data-mce-src):
(img as HTMLImageElement).src = data.newUrl;

// Depois (✅ atualiza src + data-mce-src via API do TinyMCE):
editor.dom.setAttrib(img, 'src', data.newUrl);
```

Adicionalmente, o corpo do comando foi envolvido em
`editor.undoManager.transact()` para registrar a mudança no histórico de undo
do editor.

### 12.5 Substituição via painel destacado — user gesture

**Problema corrigido (2026-06-10):** No painel pop-out, `handleReplaceImage`
enviava apenas `imageId` via IPC para a janela principal, que então chamava
`input.click()` para abrir o file picker. O Chromium bloqueia abertura
programática de diálogo de arquivo sem "user gesture" na janela alvo (o
clique do usuário foi na janela do painel, não na principal).

**Correção** (`IlustracoesPanelWindow.tsx:79` e `LaudosPage.tsx:1180,1253`):

```
Antes:
  Painel pop-out  ──IPC──►  sendAction('replaceImage', imageId)
  LaudosPage                 input.click() → file picker (❌ bloqueado)

Depois:
  Painel pop-out  input.click() → file picker local (✅ user gesture)
                  reader.onload → sendAction('replaceImage', imageId, dataUri)
  LaudosPage      onReplaceImage(imageId, dataUri) → usa dataUri direto
```

- `onReplaceImage` aceita parâmetro opcional `dataUri?: string`
- Se `dataUri` fornecido → aplica direto no editor (sem file picker)
- Se não → comportamento original com file picker (painel inline)
- IPC handler: `case 'replaceImage': cbs.onReplaceImage(args[0], args[1])`

## 13. Configurações de init do TinyMCE

| Config | Linha | Valor | Efeito |
|---|---|---|---|
| `image_advtab` | `TinyMceEditor.tsx:164` | `true` | Tab avançada no diálogo |
| `image_title` | 165 | `true` | Campo título no diálogo |
| `images_upload_handler` | 168 | `FileReader.readAsDataURL()` | **Novo** — converte blob→dataURI na origem |
| `paste_data_images` | 175 | `true` | Permite data URI no paste |
| `paste_postprocess` | 178 | callback `processarImagensPuras` | Processa fragmento colado antes da inserção |
| `file_picker_callback` | 248 | input type=file → FileReader → `buildFigureHtml` | Toolbar "Inserir Imagem" |
| plugins (lista) | 157 | inclui `'paste'`, `'image'`, `'media'` | Paste e image plugins ativos |

## 14. MutationObserver — detalhes de implementação

`TinyMceEditor.tsx:356-410`, dentro de `editor.on('init')`:

```
MutationObserver configurado com childList: true, subtree: true no editor.getBody()

Algoritmo do callback:
  1. if (processando) return;           ← anti-reentrada
  2. Coleta todos addedNodes das mutations
     - Se addedNode é <img> e não está em .laudo-figure → rawImages.push()
     - Se addedNode contém <img>s (querySelectorAll) → rawImages.push() cada
     - Filtro de src: data: || http || blob:
  3. if (rawImages.length === 0) return;
  4. processando = true; observer.disconnect()  ← evita loops
  5. editor.undoManager.transact(() => {
       for (img of rawImages) {
         const figure = wrapImgAsFigure(img);
         img.parentNode.replaceChild(figure, img);
       }
     })
  6. onChange(editor.getContent())      ← **SINCRONIZA ESTADO REACT**
  7. observer.observe(body, {...})      ← reconecta
  8. processando = false
  9. onImageInserted?.()                ← legado, não mais usado (limpo)
```

### Por que `onChange()` é essencial

O MutationObserver modifica o DOM do iframe, mas NÃO dispara o `change`
event do TinyMCE de forma confiável quando as mudanças ocorrem dentro de
`undoManager.transact()`. Sem `onChange(editor.getContent())`, o estado
React (`singleEditorHtml` / `secoes`) fica desatualizado.

Como `extrairFigurasDoEditor()` lê do estado React (não do DOM do iframe),
retorna array vazio e o painel "Figuras no Laudo" não mostra nada.

A chamada explícita força `setSingleEditorHtml(html)` ou
`atualizarConteudoSecao(idx, html)`, fazendo `extrairFigurasDoEditor()`
recalcular com o conteúdo atualizado.

## 15. Lições aprendidas

### 14.1 Filtro de blob URLs — causa do bug #1

**Problema**: TinyMCE 8.5 cria `blob:http://...` URLs para imagens
coladas/arrastadas quando não há `images_upload_handler`. Todos os filtros
do código (4 em TinyMceEditor.tsx + 1 em LaudosPage.tsx + 2 em
AISectionToolbar) só aceitavam `data:` e `http:`.

**Sintoma**: nenhuma função de detecção (`processarImagensPuras`,
`scanEditorForRawImages`, MutationObserver, `scanAndWrapImages`) encontrava
as imagens. Nem o botão manual funcionava.

**Correção**: 
- Adicionado `|| startsWith('blob:')` em 4 filtros (`TinyMceEditor.tsx:44,62,372,380`)
- Adicionado `|| startsWith('blob:')` em `singleTemImagens` (`LaudosPage.tsx:345`)
- **Correção na origem**: `images_upload_handler` converte toda imagem para data URI
  antes de entrar no DOM. Blob URLs deixam de existir no corpo do editor.

### 14.2 `imageInsertCounter` — código morto removido

Estado `imageInsertCounter` em `LaudosPage.tsx` (ex-linha 379) nunca era
consumido por `useEffect`, `useMemo`, `useCallback` ou prop. Os dois
`onImageInserted={() => setImageInsertCounter(c => c + 1)}` nos
`<TinyMceEditor>` eram inócuos. Removidos.

### 14.3 Dupla verificação de estado React

Após qualquer modificação DOM no editor (inserção, deleção, wrap), é
necessário chamar `onChange(editor.getContent())` ou equivalente
(`setSingleEditorHtml`, `setSecoes`) para que o painel reflita a mudança.
Apenas modificar o DOM não é suficiente — o React renderiza a partir do
estado, não do DOM.

### 14.4 `paste_postprocess` vs `image` plugin no TinyMCE 8.5

No TinyMCE 8.5, o plugin `image` intercepta paste de imagens **antes** do
plugin `paste`. O `paste_postprocess` pode não ser chamado para imagens
binárias da clipboard. Por isso o `images_upload_handler` + MutationObserver
são a combinação mais robusta.

### 14.5 `data-mce-src` — TinyMCE ignora `img.src` direto

TinyMCE mantém um atributo interno `data-mce-src` como fonte canônica da URL
da imagem. Atribuir `img.src = novaUrl` (propriedade JS) **não** atualiza
`data-mce-src`. Na serialização (`getContent()` / `setContent()`), o TinyMCE
usa `data-mce-src`, ignorando o `src`. Solução: usar sempre
`editor.dom.setAttrib(img, 'src', novaUrl)`, que atualiza ambos.

### 14.6 User gesture e file picker em janelas Electron separadas

O Chromium bloqueia abertura programática de `<input type="file">` via
`.click()` em janelas que não possuem "transient user activation" (clique,
tecla, etc.). Se o usuário clicou na janela A, a janela B não pode abrir um
file picker. Solução: abrir o file picker sempre na janela onde o clique
ocorreu e transmitir o `dataUri` resultante via IPC para a janela de destino.

## 16. Checklist de troubleshooting

| Sintoma | Causa provável | Verificar |
|---|---|---|
| Imagens coladas não aparecem no painel | `images_upload_handler` não está convertendo | Console: erros no FileReader |
| Imagens coladas não aparecem mesmo após "Atualizar" | Filtro rejeitando URL | DevTools: `src` do `<img>` começa com `blob:`? |
| Painel mostra 0 figuras após wrap | `onChange()` não chamado no observer | `TinyMceEditor.tsx:400` — linha existe? |
| Botão "Atualizar" não funciona em multi-seção | Editor offline | `tinymce.get('secao-0')` retorna null? Seção está colapsada (não inicializada)? |
| Figuras duplicadas após wrap | Observer re-entrada | `processando` flag + `disconnect()` durante transact |
| Figura inserida mas não visível | Seção ILUSTRAÇÕES colapsada | `secoesColapsadas[idxIlus]` é true? |
| Pop-out: painel vazio após abrir janela | `syncCurrentState` não chegou | Timeouts de 0/300/700ms em `handlePopOut` |
| Pop-out: ação (insert/delete) sem efeito | Listener IPC não registrado | `onPanelAction` useEffect com `[panelPoppedOut]` |
| Pop-out: substituir dummy não funciona | File picker bloqueado por user gesture em janela diferente | `IlustracoesPanelWindow.tsx` deve abrir file picker localmente e enviar `dataUri` via IPC |
| Dummy substituído mas volta após save/reopen | `img.src =` não atualiza `data-mce-src` do TinyMCE | `replaceLaudoImage` usa `editor.dom.setAttrib(img, 'src', ...)`? |
| HTML source mostra SVG dummy mesmo após substituição visual | `getContent()` usa `data-mce-src` canônico | DevTools: `<img>` tem `data-mce-src` com SVG antigo? |
| Legenda editada não persiste | Debounce 600ms interrompido | Digitou e mudou de foco antes do timer? |
| Scroll-sync não funciona | IntersectionObserver não inicializado | `syncEnabled` é true? Editor está visível? |
