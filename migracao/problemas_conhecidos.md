# Problemas Conhecidos

## 1. Roteamento 404 no Electron (HashRouter vs BrowserRouter)

**Problema:** Ao navegar pelos links do menu lateral, o Electron exibe "404 - Página não encontrada".

**Causa:** O Electron carrega o renderizador via protocolo `file://`. O `BrowserRouter` do React Router depende de um servidor web para resolver as rotas — ele tenta navegar para caminhos como `file:///.../solicitantes`, que não existem como arquivos físicos, resultando em 404.

**Solução:** Substituir `BrowserRouter` por `HashRouter` em `src/renderer/App.tsx`:

- `BrowserRouter` → `HashRouter`
- No componente `Sidebar`, usar `useLocation()` do React Router em vez de `window.location.pathname` para destacar o link ativo, já que com HashRouter a rota fica no hash e não no pathname.

**Arquivos alterados:**
- `src/renderer/App.tsx`

