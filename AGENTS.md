# laWdo

Aplicação Electron desktop para elaboração de laudos periciais.

---

## Comandos essenciais

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Desenvolvimento (Vite + Electron com hot reload) |
| `npm run build` | Build completo (prebuild → main/preload/renderer → postbuild) |
| `npm run lint` | ESLint |
| `npm run lint:fix` | ESLint com autocorreção |
| `npm run type-check` | TypeScript (`tsc --noEmit`) |
| `npm run spec` | Executa a auditoria padrão de spec (diff atual + último commit) |
| `npm run spec:auditar` | Audita quais specs de estado atual precisam ser revistos |
| `npm run spec:registrar` | Aplica um plano aprovado de escrita em `spec/` |
| `npm test` | Vitest (single run) |
| `npm run test:watch` | Vitest em watch mode |
| `npm run test:coverage` | Vitest com coverage (gate progressivo em `vitest.config.ts`) |
| `npm run package` | Empacotar com electron-builder |
| `npm run prune` | ts-prune (renderer) — exports não usados |
| `npm run prune:all` | ts-prune nos 3 tsconfigs (renderer + main + preload) |
| `npm run dead-code:check` | Aliás de `prune:all` |
| `/graphify` | Consultar o knowledge graph do projeto (skill) |
| `/check-dead-code` | Skill de auditoria de código morto |

Após alterações, execute `npm run type-check` e `npm run lint`. Se houver alterações no banco ou IPC, execute também `npm test`. Periodicamente, rode `npm run dead-code:check` e consulte `/check-dead-code` para auditar código morto.

Para documentação de estado atual, use o fluxo `/spec` ou os scripts `npm run spec`, `npm run spec:auditar` e `npm run spec:registrar`. A classificação e cobertura dos specs ficam em `spec/09 automacao-spec/manifesto.json`.

O comando `/graphify` usa o knowledge graph em `graphify-out/` para consultas semânticas. Prefira `graphify query "<pergunta>"` a grep para entender relações entre arquivos/funções. Análises curadas (LLM) do grafo ficam em `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/03_melhoria_graphify.md`.

---

## Convenções de código

- **Idioma**: todo código, nomes de funções, variáveis, comentários e mensagens em **português**.
- **Nomenclatura**: camelCase para funções/variáveis (`buscarPorId`, `criarLaudo`), PascalCase para componentes React (`LoginForm`, `TinyMceEditor`), kebab-case para serviços/handlers (`user.service.ts`, `laudo.handlers.ts`).
- **Aliases de import**: `@` → `src/renderer/`, `@shared` → `src/shared/`, `@main` → `src/main/`, `@preload` → `src/preload/`.
- **Estilo**: minimalista. Sem comentários óbvios — adicione comentários apenas quando ajudarem a própria IA a entender o código em manutenções futuras. Sem emojis, sem explicações prolixas.
- **CSS**: exclusivamente Tailwind utility classes + variáveis CSS definidas em `src/renderer/styles/globals.css`. Não criar arquivos CSS novos nem estilos inline.
- **Assets estáticos**: `src/renderer/types/assets.d.ts` declara tipos para imports de `.jpg/.jpeg/.png/.svg`. Código vendor (ex: TinyMCE em `src/renderer/public/tinymce/`) é excluído do lint via `.eslintignore`.

---

## Prevenção de erros recorrentes

Ao implementar ou alterar código, preserve a qualidade da tipagem e não aumente a dívida de lint existente.

- Evite `any`. Quando o formato for conhecido, declare `interface` ou `type`; quando não for conhecido, use `unknown` com narrowing.
- Não substitua `any` por casts artificiais apenas para calar o TypeScript. Use type assertions somente em fronteiras bem entendidas, com fallback ou validação quando o dado vier de IPC, JSON, storage, API externa ou biblioteca dinâmica.
- Em `catch`, trate o erro como `unknown`: use `error instanceof Error ? error.message : 'Erro inesperado'`.
- Após `JSON.parse`, normalize ou valide o resultado antes de alimentar estado tipado ou acessar propriedades.
- Para dados vindos de IPC, alinhe payloads e respostas com `src/preload/types.ts`. Não introduza novas declarações `ipcAPI: any`.
- Ao criar ou alterar canal IPC, atualize em conjunto: handler, `ALLOWED_CHANNELS`, `IpcAPI` e tipos de entrada/saída.
- No Electron, exponha ao renderer apenas wrappers específicos via preload/contextBridge. Nunca exponha módulos Node/Electron diretamente no renderer.
- Não corrija `react-hooks/exhaustive-deps` mecanicamente. Antes de adicionar dependências, avalie stale closures, loops de renderização e recarregamentos indevidos.
- Se uma função usada por `useEffect`, `useMemo` ou tabela muda a cada render, estabilize com `useCallback`, mova para dentro do hook ou reestruture o estado conforme o comportamento esperado.
- Para ícones Lucide dinâmicos, siga o padrão local já usado no projeto com `Record<string, LucideIcon>` e fallback explícito.
- Antes de finalizar, rode `npm run type-check` e `npm run lint`. Código novo não deve aumentar a contagem de warnings.

### Fronteiras inseguras

Considere como fronteira insegura qualquer dado que venha de fora do fluxo tipado normal da aplicação. Nesses pontos, não confie no formato apenas por expectativa.

Exemplos:
- respostas de IPC (`window.ipcAPI`);
- resultado de `JSON.parse`;
- dados de `sessionStorage` ou `localStorage`;
- respostas de APIs externas;
- APIs dinâmicas de bibliotecas como TinyMCE e Lucide;
- linhas retornadas por SQLite/SQL bruto.

Regra prática: ao cruzar uma fronteira insegura, não use `any` nem cast direto para “forçar” o tipo. Primeiro valide, normalize ou faça narrowing com `unknown`, e só então alimente estado tipado ou acesse propriedades.

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

### Organização de módulos (features)

Cada feature deve ter responsabilidade única e clara, com seus próprios serviços, handlers, componentes e páginas quando aplicável — nomeados consistentemente (ex: `rep.service.ts`, `rep.handlers.ts`, `RepStepper`, `REPsPage.tsx`).

**Comunicação entre features**:
- **Main ↔ Renderer**: sempre via IPC + preload. Nunca importar módulos do main no renderer.
- **Dentro do mesmo processo** (ex: entre feature folders do renderer): imports cruzados são aceitáveis apenas para:
  - **Páginas compondo features** — uma página pode importar componentes de múltiplas feature folders.
  - **Tipos compartilhados** — extraia para `src/shared/types/` se duas features precisam do mesmo tipo.
  - **Componentes genéricos reutilizáveis** — extraia para `src/renderer/components/ui/`.

**Evitar**:
- Importar hooks/utilitários internos de outra feature folder.
- Acoplamento circular entre features.

**Quando modularizar**: quando uma feature cresce e ganha múltiplas páginas, componentes, handlers IPC e serviços próprios. Evite modularizar demais (overhead de comunicação IPC, arquivos minúsculos) ou de menos (feature monolítica que dificulta manutenção).

### Regras de modularização segura

- Nem toda feature precisa ter todas as camadas; crie service, handler, hook ou componente apenas quando houver responsabilidade real.
- Páginas podem compor múltiplas features, mas componentes/hooks internos de uma feature não devem depender de detalhes internos de outra.
- Extraia para `src/shared/types/` apenas tipos usados por mais de uma camada ou feature e com contrato estável.
- Evite transformar `shared/` em depósito genérico. Se algo pertence ao domínio de uma feature, mantenha junto da feature.
- Para fluxos grandes, prefira página como orquestradora e extraia componentes/hooks por responsabilidade clara.
- Ao adicionar IPC de uma feature, mantenha juntos: handler, canal permitido, tipo no preload e chamada tipada no renderer.
- Antes de criar uma nova abstração, verifique se ela reduz duplicação real ou melhora clareza; não criar arquivos pequenos apenas por simetria.

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
| `ui/` | 26 componentes shadcn/ui |
| `auth/` | Login, autenticação |
| `avatar/` | Avatar/foto do periciando |
| `forms/` | Formulários reutilizáveis |
| `pecas/` | Peças processuais |
| `placeholders/` | Lista e gerenciamento de placeholders |
| `shared/` | Componentes compartilhados entre features |
| `solicitantes/` | Gestão de solicitantes |
| `template/` | Templates de laudo |
| `tipos-exame/` | Tipos de exame |

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

### TypeScript

- **`Omit<'onChange'>` em componentes com `onChange` próprio** — se um componente define sua própria prop `onChange` e estende `React.HTMLAttributes<HTMLDivElement>`, os tipos colidem (`HTMLAttributes` também tem `onChange: FormEventHandler`). Use `Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'>` para evitar o conflito. Ex: `TinyMceEditor`.
- **Index signature quando Zod usa `.passthrough()`** — se o schema usa `.passthrough()` para aceitar campos dinâmicos, a interface TypeScript precisa de `[key: string]: string`. Sem isso, acesso indexado e casts com `as Record<string, string>` falham. Ex: `REPFormData` em `exam-fields/types.ts`.

### React

- **Arrow function wrapper em handlers com parâmetro opcional** — funções como `async (silent?: boolean) => void` não são atribuíveis a `MouseEventHandler` diretamente. Sempre usar `onClick={() => handler()}` em vez de `onClick={handler}`.

### Banco de dados

- **Sempre criar migration ao alterar schema** — incrementar `CURRENT_SCHEMA_VERSION` sem criar a função `migrateVXX()` correspondente corrompe upgrades do banco.

### Build e código morto

- O script `scripts/fix-imports.mjs` roda no postbuild para adicionar extensões `.js` nos imports relativos (TypeScript `module: NodeNext` exige, mas `tsc` não adiciona).
- **`spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/DEAD_CODE_EXCEPTIONS.md`** — arquivos sinalizados como código morto por `ts-prune` mas que não devem ser removidos são registrados aqui. Ao adicionar uma exceção, justificar com motivo e data. Ver também: `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/00_saude_do_sistema.md`.

### Processo de trabalho

- **Em caso de dúvida** — perguntar, somente prosseguir quando souber ao menos 95% do que fazer.

---

## Validação

Zod + react-hook-form com `@hookform/resolvers`. Schemas em `src/renderer/lib/validators/`.

Quando o schema Zod usa `.passthrough()` para aceitar campos dinâmicos, ver gotchas de TypeScript.

## AI / LLM

Providers: Groq SDK + Google Gemini. Chaves de API são configuráveis na UI e armazenadas criptografadas localmente. **Não** usar `.env` nem hardcodar chaves.

## Commits

Padrão em português snake_case: `add_*` (features), `ajuste_*` (ajustes), `correcao_*` (fixes), `update_*` (atualizações).

---

## Especificações (spec/)

O diretório `spec/` documenta o **estado atual** do sistema — não é changelog nem histórico. Cada arquivo reflete como a funcionalidade **realmente funciona agora**.

| Subdiretório | Cobre | Padrões de código |
|---|---|---|
| `01 planejamento/` | Planejamento | `PRD.md`, `package.json`, `tsconfig*.json`, `vite.*`, `electron-builder.yml`, `scripts/**` |
| `02 rep/` | forms e inputs comuns e personalizados | `**/rep/**`, `**/reps/**`, `**/solicitante/**`, `**/tipo*exame/**`, `**/forms/**`, `**/exam-fields/**` |
| `03 laudo/` | Laudo (ciclo de vida, editor, menu contexto, wizard) | `**/laudo/**`, `**/laudos/**`, `**/editor/**`, `**/wizard/**`, `**/peca/**`, `**/pecas/**`, `**/template/**`, `**/exportacao/**`, `**/importacao/**`, `**/ilustracao/**` |
| `04 layout/` | Temas e estilos visuais | `**/layout/**`, `**/styles/**`, `**/globals.css`, `**/tailwind.config*`, `**/components/ui/**` |
| `05 placeholder/` | Sistema de placeholders | `**/placeholder/**`, `**/categoria-placeholder/**` |
| `06 ia/` | Integrações com IA (Gemini, Groq) | `**/ia/**`, `**/ai/**`, `**/modelos*ia*/**` |
| `07 logs/` | Sistema de logs | `**/logs/**`, `**/log*/**`, `**/audit*/**`, `**/logger*` |
| `08 gdl/` | API GDL | `**/gdl/**`,  `**/api/**`|
| `09 automacao-spec/` | Skill `/spec`, scripts de auditoria/registro e manifesto de specs | `scripts/spec/**`, `spec/09 automacao-spec/manifesto.json`, `.agents/skills/spec/**`, `AGENTS.md`, `package.json` |
| `problemas diversos/` | Problemas e edge cases pontuais | (sem padrão — análise de conteúdo) |

**Quando o código muda** de forma relevante (alterações que podem confundir a IA em manutenções futuras):
1. A IA **sugere** atualizar o(s) arquivo(s) de spec correspondente(s).
2. O **usuário decide** se a atualização/criação do spec procede.

**Formato do relatório:**

```
## /spec — Relatório

**Modo:** <padrão (diff + último commit) | diff atual | último commit | auditoria total | focado: <subdir>>
**Modelo IA:** <nome curto do modelo — extraia de "You are powered by the model named..." no system prompt>
**Base:** <arquivos analisados>

### Specs que precisam de atualização
...

### Specs sem alterações necessárias
...

### Sugestão de novo spec
...
```

Se nenhuma alteração for necessária, informar em uma linha.

**Regras**:
- **Prefira editar** um arquivo existente que já cobre a funcionalidade.
- **Sugira criar** arquivo novo apenas se a mudança não se encaixa em nenhum spec existente — nesse caso, coloque no subdiretório mais apropriado.
- **Conteúdo mínimo**: apenas o necessário para a IA entender o funcionamento atual e embasar decisões de implementação/manutenção.
- Arquivos muito grandes ou desatualizados perdem valor — mantenha enxuto.

---

## Referências

- `PRD.md` — requisitos do produto e contexto de negócio.
- `spec/` — especificações detalhadas por funcionalidade.
- `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/DEAD_CODE_EXCEPTIONS.md` — exceções de código morto (não remover).
- `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/00_saude_do_sistema.md` — painel de saúde do sistema (métricas de TS, lint, testes, código morto).
- `graphify-out/GRAPH_REPORT.md` — relações entre arquivos e funções (auto-gerado).
- `spec/.../codigomorto/03_melhoria_graphify.md` — análise curada do grafo com recomendações de melhoria (gerado por LLM).

Consulte sob demanda, apenas quando necessário para entender requisitos.
