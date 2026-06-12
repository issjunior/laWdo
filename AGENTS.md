# laWdo

Aplicação Electron desktop para elaboração de laudos periciais — Polícia Científica do Paraná.

---

## Comandos essenciais

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Desenvolvimento (Vite + Electron com hot reload) |
| `npm run build` | Build completo (prebuild → main/preload/renderer → postbuild) |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint com autocorreção |
| `npm run type-check` | TypeScript (`tsc --noEmit`) |
| `npm test` | Vitest (single run) |
| `npm run test:watch` | Vitest em watch mode |
| `npm run test:coverage` | Vitest com coverage (threshold 70%) |
| `npm run package` | Empacotar com electron-builder |

Após alterações, execute `npm run type-check` e `npm run lint`. Se houver alterações no banco ou IPC, execute também `npm test`.

---

## Convenções de código

- **Idioma**: todo código, nomes de funções, variáveis, comentários e mensagens em **português**.
- **Nomenclatura**: camelCase para funções/variáveis (`buscarPorId`, `criarLaudo`), PascalCase para componentes React (`LoginForm`, `TinyMceEditor`), kebab-case para serviços/handlers (`user.service.ts`, `laudo.handlers.ts`).
- **Aliases de import**: `@` → `src/renderer/`, `@shared` → `src/shared/`, `@main` → `src/main/`, `@preload` → `src/preload/`.
- **Estilo**: minimalista. Sem comentários óbvios — adicione comentários apenas quando ajudarem a própria IA a entender o código em manutenções futuras. Sem emojis, sem explicações prolixas.
- **CSS**: exclusivamente Tailwind utility classes + variáveis CSS definidas em `src/renderer/styles/globals.css`. Não criar arquivos CSS novos nem estilos inline.

---

## Arquitetura

A aplicação segue o modelo de 3 camadas do Electron com `shared/` para tipos comuns:

```
src/
├── main/         # Processo principal (Node.js)
├── preload/      # Ponte de segurança (contextBridge)
├── renderer/     # Interface React
└── shared/       # Tipos compartilhados
```

**Fluxo IPC** (toda comunicação renderer ↔ main):

```
Renderer → window.ipcAPI(channel, payload) → Preload → Handler → Service → Database
```

- **Nunca** importar módulos do main no renderer (ex: `electron`, `sqlite3`).
- O Preload expõe `window.ipcAPI` via `contextBridge.exposeInMainWorld`. Toda chamada do renderer usa essa API.

### Camadas do main process

```
main/
├── database/     # SQLite + migrações (src/main/database/index.ts)
├── services/     # Lógica de negócio (herdam de BaseService<T>)
├── ipc/handlers/  # Handlers IPC (um arquivo por entidade)
├── security/     # Criptografia e sanitização
└── utils/        # Logger (Winston)
```

**BaseService\<T\>** (`src/main/services/base.service.ts`): classe abstrata com CRUD genérico — `findAll()`, `findById()`, `create()`, `update()`, `delete()`. Todo serviço de entidade deve estendê-la.

### Renderer

React 18 + React Router 7 (HashRouter — obrigatório para Electron com `file://`) + Tailwind CSS + shadcn/ui (New York style). Páginas com lazy loading via `React.lazy`.

---

## IPC e segurança do Electron

- **Segurança**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` — **nunca desabilitar**.
- **Canais IPC**: formato `entidade:acao` (`user:findAll`, `laudo:create`, `backup:criar`).
- Para adicionar um novo canal:
  1. Criar handler em `src/main/ipc/handlers/`
  2. Registrar o channel no `ALLOWED_CHANNELS` em `src/preload/index.ts`
  3. Tipar no `IpcAPI` em `src/preload/types.ts`
- **HashRouter**: usar sempre `HashRouter` (não `BrowserRouter`), pois Electron carrega via protocolo `file://`.

---

## UI e componentes

shadcn/ui (New York, base Zinc, ícones Lucide) com Tailwind CSS e suporte a dark mode (`class`-based).

**Design visual**: centralizado em `src/renderer/styles/globals.css` (design tokens, temas claro/escuro, estilos base). Use exclusivamente classes Tailwind + variáveis CSS dali definidas.

**Principais grupos de componentes** em `src/renderer/components/`:

| Grupo | Responsabilidade |
|-------|-----------------|
| `editor/` | TinyMceEditor, PlaceholderContextMenu |
| `rep/` | RepStepper, formulários de requisição de exame |
| `laudo/` | IlustracoesPanel |
| `timeline/` | DualTrackTimeline, RepTimelineDialog |
| `ai/` | AISectionToolbar, AISheet |
| `categorias/` | SortableCategoryTree |
| `data-table/` | DataTable com paginação |
| `layout/` | AppSidebar, Header, Footer |
| `ui/` | 24 componentes shadcn/ui |

---

## Banco de dados

SQLite via pacote `sqlite3`. Arquivo: `laudopericial.db` em `app.getPath('userData')`.

**Serviços**: herdam de `BaseService<T>` (`src/main/services/base.service.ts`) com CRUD genérico.

**Para criar uma nova migration**:
1. Adicionar função `migrateV25()` em `src/main/database/index.ts`
2. Incrementar `CURRENT_SCHEMA_VERSION`
3. Registrar a nova migration na chain de `applyMigrations()`

Consultas usam SQL bruto (strings template), não há ORM.

---

## Gotchas

1. **NUNCA importar `electron` ou módulos Node.js no renderer** — toda comunicação é via `window.ipcAPI`.
2. **Sempre registrar novos canais no `ALLOWED_CHANNELS` do preload** — handler no main sem channel no preload = canal bloqueado.
3. **Sempre usar `HashRouter`** (não `BrowserRouter`) — `BrowserRouter` quebra em produção no Electron.
4. **Sempre criar migration ao alterar schema** — incrementar `CURRENT_SCHEMA_VERSION` sem criar a função `migrateVXX()` correspondente corrompe upgrades do banco.
5. O script `scripts/fix-imports.mjs` roda no postbuild para adicionar extensões `.js` nos imports relativos (TypeScript `module: NodeNext` exige, mas `tsc` não adiciona).

---

## Validação

Zod + react-hook-form com `@hookform/resolvers`. Schemas em `src/renderer/lib/validators/`.

## AI / LLM

Providers: Groq SDK + Google Gemini. Chaves de API são configuráveis na UI e armazenadas criptografadas localmente. **Não** usar `.env` nem hardcodar chaves.

## Commits

Padrão em português snake_case: `add_*` (features), `ajuste_*` (ajustes), `correcao_*` (fixes), `update_*` (atualizações).

---

## Referências

- `PRD.md` — requisitos do produto e contexto de negócio.
- `spec/` — especificações detalhadas por funcionalidade.

Consulte sob demanda, apenas quando necessário para entender requisitos.
