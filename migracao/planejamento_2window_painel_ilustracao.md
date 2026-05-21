Análise: Painel de Ilustrações em janela separada
Sim, é possível e é um padrão comum em apps Electron (ex: Chrome DevTools, Spotify mini-player).
Como funciona
┌── Janela Principal ──────────────────────┐     ┌── Janela do Painel ───────┐
│ Editor de Laudo                           │     │ Ilustrações               │
│                                           │ IPC │                           │
│ [Ilustrações] → abre janela separada ─────┼────→│  ▓▓▓▓▓▓▓▓▓▓              │
│                                           │←────│  insert/delete/legenda    │
│ Seção 1...                                │     │                           │
│ Seção 2...                                │     │  ☑ Sincronizar            │
└───────────────────────────────────────────┘     └───────────────────────────┘
Implicações
Aspecto	Impacto
Layout do editor	Zero — painel não ocupa espaço, editor sempre 100% largura
Multi-monitor	Perfeito — usuário pode colocar o painel em outro monitor
Independência	Minimizar, redimensionar, fechar a janela sem afetar o editor
Estado	Sincronização via IPC entre janelas — requer canais para cada operação
Complexidade	Moderada — ~50 linhas no main process, ~30 no preload, 1 nova página React, ajustes no LaudosPage
Ciclo de vida	Janela deve fechar quando o laudo for fechado ou o usuário sair do editor
Arquitetura
Novos arquivos:
Arquivo	Função
src/renderer/pages/IlustracoesPanelWindow.tsx	Página standalone que renderiza o IlustracoesPanel
(nenhum outro)	Reaproveita IlustracoesPanel existente sem alterações
Arquivos alterados:
Arquivo	Mudança
src/main/ipc/index.ts	Handler para criar/fechar BrowserWindow do painel + relay de IPC entre janelas
src/preload/index.ts	openIllustrationsPanel(laudoId), syncIllustrationsState(data), listeners para callbacks
src/renderer/App.tsx	Rota #/panel-ilustracoes renderiza IlustracoesPanelWindow
src/renderer/pages/LaudosPage.tsx	Botão "Ilustrações" chama window.ipcAPI.openIllustrationsPanel() em vez de toggle inline. Remove toda a lógica do painel flutuante (toggle tab, panelCollapsed, fixed, ResizeObserver, etc.)
Remover de LaudosPage.tsx:
- panelCollapsed, togglePanel, cardRef, panelTop
- ResizeObserver + listeners resize/scroll
- Toggle tab e painel fixed
- Props do painel inline (agora são enviadas via IPC)
Sincronização bidirecional via IPC
LaudosPage (janela principal)          IlustracoesPanelWindow (janela separada)
─────────────────────────────          ─────────────────────────────────────
extrairFigurasDoEditor()  ──IPC──→    figurasNoEditor (prop)
secoes / singleEditorHtml ──IPC──→    (dispara re-render quando muda)
                                  ←──IPC──  onInsertImage(url, id, legenda)
                                  ←──IPC──  onDeleteImage(id)
                                  ←──IPC──  onUpdateLegendaInEditor(id, legenda)
                                  ←──IPC──  onReorder(imagens)
                                  ←──IPC──  onRefreshHtml()
                                  ←──IPC──  onInsertAll(imagens)
syncEnabled / figuraAtivaId  ──IPC──→    syncEnabled / figuraAtivaId (prop)
                                  ←──IPC──  onSyncToggle(enabled)
Considerações finais
Prós da janela separada:
- UX mais limpa — editor sem distrações
- Monitor extra vira área dedicada para ilustrações
- Nenhum conflito de layout, scroll, z-index, overflow
- Arrastar para qualquer posição
Contras:
- ~150 linhas de código novo (IPC, janela, rota)
- Debug mais complexo (duas janelas, dois contextos React)
- Se o usuário tem só 1 monitor, alternar entre janelas pode ser pior que o painel inline
Alternativa híbrida: Oferecer as duas opções — o botão "Ilustrações" abre inline por padrão, e um ícone de "destacar" (pop-out) no cabeçalho do painel move para janela separada.