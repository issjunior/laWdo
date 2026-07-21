# Plano para resolver os PRs do Dependabot

**Data de referência:** 21/07/2026
**Repositório:** `issjunior/laWdo`
**Objetivo:** resolver as três PRs abertas do Dependabot sem misturar atualizações seguras de infraestrutura com migrações grandes de runtime e toolchain.

## Resumo executivo

- Fazer squash-merge da PR [#13](https://github.com/issjunior/laWdo/pull/13), que altera somente `actions/setup-node@6` para `actions/setup-node@7` e está com a CI verde.
- Não corrigir diretamente as PRs [#11](https://github.com/issjunior/laWdo/pull/11) e [#14](https://github.com/issjunior/laWdo/pull/14). Fechá-las com um comentário informando que serão substituídas por atualizações menores e rastreáveis.
- Executar as migrações em tranches sequenciais, criando cada branch a partir da `main` já atualizada.
- Alterar o Dependabot para agrupar apenas patches e minors; atualizações major continuarão como PRs individuais.

## Convenção de execução e merge

- Cada linha do roteiro abaixo corresponde a **uma branch própria e uma única PR**. A próxima branch só nasce da `main` depois do squash-merge e do check `Qualidade` verde da anterior.
- Toda atualização deve registrar `package.json` e `package-lock.json` na mesma PR. Não usar `npm update` sem conferir o diff do lockfile.
- Uma falha de validação, mudança de contrato IPC, migration de banco ou regressão visual interrompe a tranche: corrigir na própria branch ou revertê-la; não acumular a correção na PR seguinte.
- Branches de baixa complexidade podem ser mescladas após revisão e CI verde. As de complexidade média, alta e muito alta exigem também os critérios de aceite específicos indicados no roteiro.

| Ordem | Branch própria | Escopo | Complexidade | Condição para squash-merge |
|---:|---|---|---|---|
| 0 | PR #13 do Dependabot | `actions/setup-node` 6 → 7 | Baixa | Diff restrito ao workflow e CI verde. |
| 1 | `dependabot/politica-minor-patch` | Grupos e limites do Dependabot | Baixa | YAML válido, sem agrupar atualizações de segurança. |
| 2 | `dependabot/compativeis-producao` | Patches/minors de produção | Baixa–média | Bateria comum verde e sem major no diff. |
| 3 | `dependabot/compativeis-desenvolvimento` | Ferramentas de baixo impacto | Baixa–média | Bateria comum verde e peers compatíveis. |
| 4 | `dependabot/lucide-1` | Lucide 1 | Média | Imports e mapas dinâmicos auditados. |
| 5 | `dependabot/zod-4` | Zod 4 | Média | Mensagens e validações preservadas. |
| 6 | `dependabot/react-19` | React, tipos e testes | Média–alta | Smoke do renderer e componentes Radix aprovado. |
| 7 | `dependabot/tailwind-4` | Tailwind, PostCSS e `tailwind-merge` | Alta | Smoke visual claro/escuro aprovado. |
| 8 | `dependabot/node-24` | Baseline local e contratos de versão | Média | `engines`, arquivos de pinagem escolhidos e CI alinhados. |
| 9 | `dependabot/eslint-9` | Plugins ESLint e flat config | Média–alta | Lint com a nova config e regras equivalentes. |
| 10 | `dependabot/vite-7` | Vite e plugin React compatíveis | Alta | Build do renderer e Electron verificados. |
| 11 | `dependabot/vite-8` | Vite 8/Rolldown e plugin React 6 | Alta | Bundling e chunks validados no pacote. |
| 12 | `dependabot/adm-zip` | Backup | Média | Criar e restaurar backup no Windows. |
| 13 | `dependabot/bcrypt` | Hashes e autenticação | Média–alta | Criar, verificar e ler hashes existentes. |
| 14 | `dependabot/sqlite3` | SQLite, IPC e migrations | Alta | Testes de banco/IPC e reabertura de dados aprovados. |
| 15 | `dependabot/electron-builder` | Empacotamento | Alta | `npm run pack` e instalação do pacote no Windows. |
| 16 | `dependabot/electron-35` | Electron 29 → 35 | Muito alta | Smoke do pacote, preload e módulos nativos. |
| 17 | `dependabot/electron-39` | Electron 35 → 39 | Muito alta | Mesmo smoke, sem regressões do checkpoint anterior. |
| 18 | `dependabot/electron-43` | Electron 39 → 43 | Muito alta | Smoke final completo e CI verde. |

## Evolução da execução

### 21/07/2026 — Tranche 0 concluída

- PR [#13](https://github.com/issjunior/laWdo/pull/13) revisada: diff de um arquivo e uma linha (`actions/setup-node` 6 → 7), sem reviews ou threads pendentes.
- Check `Qualidade` da PR aprovado antes do merge.
- Squash-merge realizado no commit `d7839ff9e0de9f7051a929701d4d6d997098efb3` (`update_actions_setup_node_7`).
- A execução da CI na `main` concluiu com sucesso: [run 29845924813](https://github.com/issjunior/laWdo/actions/runs/29845924813).

### 21/07/2026 — Tranche 1 em andamento

- Branch `dependabot/politica-minor-patch` criada a partir da `main` no commit `d7839ff9e0de9f7051a929701d4d6d997098efb3`.
- Alteração em preparação: limitar os grupos de atualizações por versão do Dependabot a `minor` e `patch`, preservando o grupo de segurança sem filtro por SemVer.
- `dependabot.yml` validado por parser YAML e `git diff --check`.
- Commit `9680319a96509a811b0bd452bb4263a6977cb181` publicado e PR [#16](https://github.com/issjunior/laWdo/pull/16) aberta com CI aprovada.
- Squash-merge da PR #16 concluído no commit `d13247c5d6c78271234324e01b09fa7d8f0c1215`.
- PRs agrupadas [#11](https://github.com/issjunior/laWdo/pull/11) e [#14](https://github.com/issjunior/laWdo/pull/14) encerradas com comentário de substituição por tranches menores.
- Próximo bloqueio: confirmar a CI da `main` após o merge antes de criar `dependabot/compativeis-producao`.

### 21/07/2026 — Tranche 2 em preparação

- CI da `main` após a PR #16 concluída com sucesso: [run 29846464661](https://github.com/issjunior/laWdo/actions/runs/29846464661).
- Branch `dependabot/compativeis-producao` criada a partir do commit `d13247c5d6c78271234324e01b09fa7d8f0c1215`.
- Atualizado somente o `package-lock.json`, respeitando os intervalos já declarados em `package.json`. Inclui `@hookform/resolvers`, componentes Radix compatíveis, `react-hook-form`, `sanitize-html`, `tinymce` e `yet-another-react-lightbox`; majors permanecem excluídos.
- Validações aprovadas: `npm ci`, `npm run type-check`, `npm run lint`, `npm run test:coverage` (188 aprovados, 1 ignorado), `npm run build`, `npm run knip -- --no-exit-code`, `npm run dead-code:check` e `git diff --check`.
- `npm audit` reportou 23 vulnerabilidades transitivas (1 crítica, 19 altas, 1 moderada e 2 baixas). Nenhum `npm audit fix` foi aplicado, pois isso pode introduzir alterações fora do escopo da tranche.
- Commit `cdf510d0f18e4e5f6666222c4953181cdf10730e` publicado, CI da PR [#19](https://github.com/issjunior/laWdo/pull/19) aprovada e squash-merge concluído no commit `ceff0a9c4ef9ca34674b6e719e4ba0f351ba5e10`.
- Próximo bloqueio: confirmar a CI da `main` antes de criar `dependabot/compativeis-desenvolvimento`.

### 21/07/2026 — Tranche 3 em andamento

- CI da `main` após a PR #19 concluída com sucesso: [run 29849659504](https://github.com/issjunior/laWdo/actions/runs/29849659504).
- Branch `dependabot/compativeis-desenvolvimento` criada a partir da `main` validada.
- Atualização aplicada ao lockfile para `autoprefixer`, `knip`, `postcss` e `prettier`; majors e ferramentas de runtime permanecem excluídos.
- Validações aprovadas: `npm run type-check`, `npm run lint`, `npm run test:coverage` (188 aprovados, 1 ignorado) e `npm run build`.
- Commit `019f9ecb86da0864bc0afa981f83c95b6cf58505` publicado, CI da PR [#20](https://github.com/issjunior/laWdo/pull/20) aprovada e squash-merge concluído no commit `dcb4a45054ebfd8b01f21d6c9189237e2463d359`.

### 21/07/2026 — Próxima tranche: Lucide 1

- Criada a issue [#21](https://github.com/issjunior/laWdo/issues/21) para concentrar a migração de `lucide-react` 0.x → 1.x, incluindo correções de código e smoke visual.
- CI da `main` concluída com sucesso e branch `dependabot/lucide-1` criada.
- `lucide-react` atualizado para 1.x. O logo GitHub foi removido pela política do Lucide para ícones de marca; o cabeçalho agora usa `Code2`, preservando link e texto do repositório.
- Validações aprovadas: `npm run type-check`, `npm run lint`, `npm run test:coverage` (188 aprovados, 1 ignorado) e `npm run build`.
- `npm run dev` iniciou o Electron sem erro no terminal. Smoke visual pendente: abrir o menu de informações, confirmar o ícone `Code2` e testar o link “Repositório GitHub”.

### 21/07/2026 — Correção emergencial: sanitize-html

- O `npm run dev` exibiu `ERR_REQUIRE_ESM`: `sanitize-html@2.17.6` passou a requerer `htmlparser2@12` (ESM), incompatível com o `require` do processo principal Electron.
- Criada a issue [#22](https://github.com/issjunior/laWdo/issues/22) para registrar a regressão.
- A correção isolada fixa `sanitize-html` em `2.17.5`, que usa `htmlparser2@10.1.0` CommonJS. O `npm run dev` foi repetido e iniciou sem o erro.
- PR [#23](https://github.com/issjunior/laWdo/pull/23) aprovada pela CI e mesclada por squash no commit `32229bbcab4f9726c261b0e65c4feaecfbb2dc87`.
- Smoke visual do cabeçalho aprovado em 21/07/2026: ícone exibido e link “Repositório GitHub” funcionou corretamente.
- PR [#24](https://github.com/issjunior/laWdo/pull/24) rebaseada sobre a `main` corrigida, revalidada pela CI e mesclada por squash no commit `eeee5d8b88ebd882e0c553856fd6a2ee9362ec0a`.
- Issue [#21](https://github.com/issjunior/laWdo/issues/21) encerrada como concluída.

### 21/07/2026 — Tranche 5: Zod 4 em validação

- Criada a issue [#26](https://github.com/issjunior/laWdo/issues/26) e a branch `dependabot/zod-4`, a partir da `main` que contém a tranche Lucide.
- `zod` foi atualizado de `^3.22.4` para `^4.4.3`. As quatro leituras do campo removido `ZodError.errors` foram migradas para `ZodError.issues` em `GdlConsultaModal`, `REPsPage`, `SolicitantesPage` e `TemplatesPage`, preservando o mapeamento das mensagens de validação.
- Validações automáticas aprovadas sobre uma instalação limpa: `npm ci`, `npm run type-check`, `npm run lint`, `npm run test:coverage` (188 aprovados, 1 ignorado), `npm run build` e `git diff --check`.
- Smoke manual aprovado: validações inválidas de REP, solicitante, template e ano da consulta GDL sem erros observados.
- Commit `dc7cb58` (`update_zod_4`) publicado na branch remota e PR [#27](https://github.com/issjunior/laWdo/pull/27) aberta, com CI `Qualidade` verde e smoke aprovado.
- Squash-merge da PR #27 concluído no commit `4412f342bd82e049e09a1173343813ec4a834d32`; a issue #26 foi fechada automaticamente. Próximo passo: confirmar a CI da `main` antes de criar `dependabot/react-19`.

### 21/07/2026 — Tranche 6: React 19 em validação

- CI da `main` após Zod aprovada: [run 29860274506](https://github.com/issjunior/laWdo/actions/runs/29860274506). Criada a branch `dependabot/react-19` e a issue [#28](https://github.com/issjunior/laWdo/issues/28).
- Atualizados `react` e `react-dom` para `^19.2.8`, com `@types/react` `^19.2.17` e `@types/react-dom` `^19.2.3`.
- Auditoria das APIs removidas do React 19 não encontrou `ReactDOM.render`, `findDOMNode`, `react-dom/test-utils`, context legado ou string refs; o renderer já usa `createRoot`. Os `forwardRef` existentes permanecem compatíveis.
- O teste B602 de reidratação excedia o timeout global apenas sob a cobertura completa; passou isoladamente. Foi aplicado timeout específico de 20 s para esse teste de renderização extensa, mantendo o limite global em 10 s.
- Validações aprovadas: `npm ci`, `npm run type-check`, `npm run lint`, `npm run test:coverage` (188 aprovados, 1 ignorado) e `npm run build`.
- Smoke visual aprovado: inicialização, temas, navegação, diálogos/popovers/selects, formulários e editor TinyMCE sem erros observados.
- Commit `25455cc` (`update_react_19`) publicado na branch `dependabot/react-19`; PR [#29](https://github.com/issjunior/laWdo/pull/29) aprovada com CI verde e smoke visual concluído.
- Squash-merge da PR #29 concluído no commit `85f88e9004fcda49167aceed7f0367a9c0a958f3`; a issue #28 foi fechada automaticamente. Próximo passo: confirmar a CI da `main` antes de criar `dependabot/tailwind-4`.

### 21/07/2026 — Tranche 7: Tailwind 4 em correção visual

- Criada a branch `dependabot/tailwind-4` a partir da `main` no commit `85f88e9004fcda49167aceed7f0367a9c0a958f3`.
- Migrados o processamento do Tailwind para `@tailwindcss/vite`, o Tailwind para 4.x e `tailwind-merge` para a versão compatível. `globals.css` passou a carregar o `tailwind.config.js` por `@config`; as dependências e a configuração legadas de PostCSS foram removidas por não serem usadas pelo plugin Vite.
- As entradas dinâmicas que antes estavam no `safelist` do arquivo JavaScript foram declaradas por `@source inline(...)`, pois o Tailwind 4 não lê esse `safelist` legado. As sintaxes de variáveis CSS usadas por componentes shadcn foram atualizadas para a forma do Tailwind 4, como `w-(--sidebar-width)`.
- O primeiro smoke visual encontrou sidebar sobreposta e perda generalizada de espaçamentos. A sidebar foi corrigida pela nova sintaxe de variáveis; a perda de espaçamento foi rastreada até o reset global no `src/renderer/index.html`, fora das camadas CSS, que declarava `* { padding: 0 }` e anulava utilitários como `p-6`, `px-7` e `space-y-*`.
- O reset global foi removido. Em execução de desenvolvimento, um elemento `p-6` voltou a computar `padding: 24px`. Também foram convertidos os cálculos da variante flutuante da sidebar para `--spacing(4)`, substituindo o `theme(spacing.4)` legado.
- Smoke visual aprovado em tema claro e escuro: login, sidebar, cabeçalho, dashboard, formulários, tabelas e diálogos, sem erros observados.
- Validação final aprovada em instalação limpa: `npm ci`, `npm run type-check`, `npm run lint`, `npm run test:coverage` (188 aprovados, 1 ignorado), `npm run build`, `npm run dead-code:check` e `git diff --check`. `npm run knip -- --no-exit-code` não identificou dependências ou arquivos novos sem uso; os exports históricos já reportados permanecem observacionais.
- Criada a issue [#30](https://github.com/issjunior/laWdo/issues/30) para rastrear a migração e a regressão visual corrigida.
- Commit local `update_tailwind_4` criado na branch. Próximo passo: publicar a branch, abrir PR e realizar squash-merge apenas após a CI verde.

## Diagnóstico atual

### PR #13 — GitHub Actions

- Altera somente `.github/workflows/ci.yml`.
- Atualiza `actions/setup-node` de 6 para 7.
- Preserva Node 24 e cache do npm.
- Está mergeável e com o check `Qualidade` concluído com sucesso.

**Decisão:** revisar o diff final e fazer squash-merge antes das demais frentes.

### PR #11 — dependências de produção

- Agrupa 25 atualizações, incluindo React 19, Zod 4, Lucide 1, SQLite 6, bcrypt 6 e outros majors.
- A instalação conclui, mas o `type-check` falha.
- Falhas observadas:
  - `lucide-react` não exporta mais `Github`;
  - Zod 4 não expõe `ZodError.errors`, afetando `GdlConsultaModal`, `REPsPage`, `SolicitantesPage` e `TemplatesPage`;
  - os callbacks derivados desses acessos passam a produzir parâmetros implicitamente tipados como `any`.
- Mesmo após esses ajustes, ainda permaneceriam riscos de runtime, UI, banco, módulos nativos e empacotamento.

**Decisão:** fechar a PR agrupada e substituir por PRs menores.

### PR #14 — dependências de desenvolvimento

- Agrupa 17 atualizações, incluindo Electron 43, ESLint 10, Tailwind 4, TypeScript 7 e Vite 8.
- A CI falha já no `npm ci`.
- Causa observada: `@typescript-eslint/eslint-plugin@8.65.0` aceita TypeScript `>=4.8.4 <6.1.0`, enquanto a PR instala TypeScript 7.0.2.
- ESLint 10 também exige migração da configuração `.eslintrc.json` para flat config.
- Tailwind 4 e Vite 8 requerem migrações próprias de configuração e build.

**Decisão:** fechar a PR agrupada e substituir por uma migração de toolchain em etapas.

## Sequência de implementação

### 1. CI e política do Dependabot

1. ~~Fazer squash-merge da PR #13~~ — concluído em 21/07/2026.
2. Criar `dependabot/politica-minor-patch` a partir dessa `main`.
3. Alterar `.github/dependabot.yml`:
   - adicionar `update-types: [minor, patch]` aos grupos npm de produção e desenvolvimento;
   - aplicar a mesma regra ao grupo de versões do GitHub Actions;
   - preservar atualizações de segurança separadas e sem bloqueio por nível SemVer.
4. ~~Validar a sintaxe do YAML e abrir a PR; fazer squash-merge somente com a CI verde~~ — concluído na PR #16.
5. ~~Após o merge, fechar as PRs #11 e #14 com comentário apontando para esta estratégia e para as PRs substitutas~~ — concluído em 21/07/2026.

### 2. Atualizações compatíveis

Criar as duas PRs abaixo, em sequência e sempre a partir da `main` atualizada:

1. `dependabot/compativeis-producao`: patches e minors de produção, excluindo qualquer salto major;
2. após seu merge, `dependabot/compativeis-desenvolvimento`: ferramentas de desenvolvimento de baixo impacto, como `knip`, `postcss` e `prettier`.

Não aceitar automaticamente TypeScript 7 nem `@types/node` 26. Conferir engines e peer dependencies antes de atualizar qualquer ferramenta.

### 3. Migrações de frontend

Cada item deve ser tratado em uma branch e PR independentes, criada somente após o merge da anterior:

1. **`dependabot/lucide-1` — Lucide 1**
   - trocar o export removido `Github` pelo export atual `GitHub`;
   - auditar imports diretos e mapas de ícones dinâmicos;
   - manter fallback explícito nos mapas `Record<string, LucideIcon>`.

2. **`dependabot/zod-4` — Zod 4**
   - substituir `ZodError.errors` por `ZodError.issues`;
   - ajustar os callbacks sem introduzir `any`;
   - preservar o formato e a ordem das mensagens exibidas ao usuário;
   - cobrir `GdlConsultaModal`, `REPsPage`, `SolicitantesPage` e `TemplatesPage`.

3. **`dependabot/react-19` — React 19**
   - atualizar conjuntamente `react`, `react-dom`, `@types/react` e `@types/react-dom`;
   - atualizar a pilha de testes React compatível;
   - auditar APIs removidas, tipos obsoletos, refs e comportamento em `StrictMode`;
   - fazer smoke test dos componentes Radix e dos fluxos principais do renderer.

4. **`dependabot/tailwind-4` — Tailwind 4**
   - instalar e configurar `@tailwindcss/postcss`;
   - revisar `postcss.config.js`, `tailwind.config.js` e `globals.css`;
   - preservar tokens visuais, dark mode, fontes, animações e safelist;
   - atualizar `tailwind-merge` na mesma tranche;
   - remover `autoprefixer` da configuração ou das dependências se deixar de ter uso independente.

### 4. Toolchain

1. **`dependabot/node-24` — Baseline Node**
   - adotar Node 24 como baseline documentada;
   - alinhar `engines`, CI e `@types/node` à versão 24;
   - escolher e adicionar o arquivo de pinagem local adotado pelo repositório (por exemplo, `.nvmrc` ou equivalente), sem introduzir mais de uma fonte de verdade;
   - mesclar somente quando `node --version`, `npm ci` e a bateria comum forem executados com Node 24.

2. **`dependabot/eslint-9` — TypeScript e lint**
   - manter TypeScript 5.9 enquanto `typescript-eslint@8` não aceitar TypeScript 7;
   - antes de alterar o ESLint, montar a matriz de peer dependencies de `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-react` e `eslint-plugin-react-hooks` para ESLint 9;
   - migrar ESLint 8 para ESLint 9 junto dos plugins compatíveis;
   - converter `.eslintrc.json` para `eslint.config.*`;
   - comparar a configuração antiga e nova para preservar regras, ignores e extensões de arquivo;
   - tratar ESLint 10 em uma PR posterior, somente quando todos os plugins usados declararem compatibilidade.

3. **`dependabot/vite-7` — Vite 5 para 7**
   - registrar antes da alteração a matriz de versões de Vite, `@vitejs/plugin-react`, Vitest e Node;
   - atualizar Vite e o plugin React para a combinação compatível, sem misturar a mudança para Vite 8;
   - validar aliases, `base: './'`, `manualChunks`, `root`, `outDir` e a abertura do renderer pelo Electron;
   - fazer squash-merge apenas após `npm run build` e smoke do renderer no Electron.

4. **`dependabot/vite-8` — Vite 8 e Rolldown**
   - criar somente após a estabilidade de Vite 7;
   - atualizar Vite 8 e `@vitejs/plugin-react` 6, avaliando os plugins de bundling existentes;
   - validar a configuração equivalente de `manualChunks`/opções de bundling, aliases, base relativa e saída do renderer;
   - executar `npm run pack` e verificar no Windows os chunks gerados e o carregamento de arquivos locais antes do merge.

5. **Outras ferramentas**
   - atualizar `concurrently` e demais majors isoladamente quando suas engines e peers estiverem compatíveis com Node 24.

### 5. Dependências nativas e Electron

Executar somente após frontend e toolchain estarem estáveis:

1. `dependabot/adm-zip`: atualizar `adm-zip` e validar criação e restauração de backup; mesclar após o smoke no Windows.
2. `dependabot/bcrypt`: atualizar `bcrypt` e validar autenticação, criação e verificação de hashes, inclusive dados já persistidos; mesclar após o smoke no Windows.
3. `dependabot/sqlite3`: atualizar `sqlite3`, reconstruir o módulo nativo quando necessário e executar todos os testes de banco e IPC; mesclar após a reabertura de uma base existente e a bateria comum.
4. `dependabot/electron-builder`: atualizar `electron-builder` e validar `npm run pack`; mesclar somente após instalar e abrir o pacote gerado no Windows.
5. Migrar Electron em três checkpoints independentes: `dependabot/electron-35` (29 → 35), `dependabot/electron-39` (35 → 39) e `dependabot/electron-43` (39 → 43). Em cada um:
   - revisar somente as breaking changes do intervalo correspondente;
   - reconstruir e validar `bcrypt` e `sqlite3` contra a versão alvo;
   - preservar `contextIsolation: true`, `nodeIntegration: false` e `sandbox: true`;
   - validar preload, IPC, `safeStorage`, arquivos locais, empacotamento e o smoke completo no Windows antes do squash-merge.

## Validação por tranche

Toda PR deve passar:

```bash
npm ci
npm run type-check
npm run lint
npm run test:coverage
npm run build
```

Além da bateria comum, a descrição da PR deve indicar: branch de origem, versão inicial/final de cada dependência, compatibilidades verificadas, comandos executados e resultado do critério de aceite específico. O merge só ocorre depois desses registros e da CI verde.

Quando a mudança tocar dependências, exports ou configuração estrutural, executar também:

```bash
npm run knip -- --no-exit-code
npm run dead-code:check
```

Tranches de Electron, SQLite, bcrypt ou empacotamento exigem adicionalmente:

```bash
npm run pack
```

O pacote deve ser testado no Windows com os seguintes fluxos:

- inicialização e login;
- criação, abertura e salvamento de REP;
- criação e edição de laudo no TinyMCE;
- persistência e reabertura de dados SQLite;
- criação e restauração de backup;
- execução de operações que cruzam preload e IPC.

As tranches de React e Tailwind também exigem smoke visual em:

- temas claro e escuro;
- formulários e validações;
- menus, popovers, selects e diálogos;
- tabelas e paginação;
- editor, sidebar e cabeçalho.

## Critérios de conclusão

A rodada estará concluída quando:

- a PR #13 estiver mesclada;
- as PRs #11 e #14 estiverem fechadas e substituídas;
- todas as tranches criadas estiverem mescladas com CI verde;
- o aplicativo empacotado passar pelo smoke test no Windows;
- uma execução posterior do Dependabot agrupar apenas patches e minors;
- atualizações major futuras aparecerem isoladas ou em famílias explicitamente compatíveis.

## Premissas

- Não haverá mudança intencional nos contratos IPC nem no schema do banco; qualquer necessidade descoberta deverá ser isolada e testada.
- O baseline público de desenvolvimento mudará de Node `>=18` para Node 24.
- TypeScript 7 e ESLint 10 permanecerão adiados até existir uma combinação oficialmente compatível de compilador e plugins.
- Atualizações de segurança continuam prioritárias e não serão adiadas pela política de agrupamento.
- A autenticação local do GitHub CLI deverá ser renovada com `gh auth refresh -h github.com` antes de acompanhar checks pela CLI.
- Depois das mudanças funcionais, executar `/spec` para identificar documentação de estado atual afetada; qualquer atualização de spec será submetida à aprovação específica.
