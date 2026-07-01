# Plano de Implementacao - Saude de Codigo

> Ultima atualizacao: 01/07/2026
> Branch atual publicada: `main`
> HEAD publicado: ver ultimo resultado de tranche registrado abaixo
> Escopo deste arquivo: checkpoint operacional para continuidade da limpeza de lint, TypeScript, testes e codigo morto.

Este arquivo registra o progresso e o plano de continuidade da implementacao de
qualidade tecnica. Ele deve ser usado como fonte de retomada para novas tranches
de trabalho. Nao descreve comportamento funcional do produto.

## Estado atual publicado

| Area | Estado atual | Observacao |
|---|---|---|
| Branch principal | Publicada | `main` alinhada com `origin/main` |
| HEAD atual | Publicado | `16c91fa ajuste_tipa_template_handlers` |
| Build | Passando | Validado nas tranches de `src/main/**` |
| TypeScript | Passando | `npm run type-check` OK na ultima tranche registrada |
| Testes | Passando | `npm test` OK na ultima tranche registrada |
| ESLint | Passando com warnings | `0 errors`, `49 warnings` |
| Codigo morto | Ainda com apontamentos | Tratar separado de lint/types |

## Checkpoint de pausa - 01/07/2026

Pausa planejada pelo usuario: a continuidade desta iniciativa deve ser retomada
em outro dia a partir deste checkpoint.

Estado publicado no momento da pausa:

| Item | Estado |
|---|---|
| Branch ativa/publicada | `main` alinhada com `origin/main` |
| HEAD publicado | `16c91fa ajuste_tipa_template_handlers` |
| Ultima tranche concluida | `codex/limpa-any-template-handlers` |
| Lint atual | `49 warnings`, `0 errors` |
| Distribuicao do lint | `22 no-explicit-any` + `27 react-hooks/exhaustive-deps` |
| TypeScript | `npm run type-check` passando |
| Testes automatizados | `npm test` passando com `34` aprovados e `1` skipped |
| Build | `npm run build` passando |
| Smoke manual | Usuario informou smoke sem observacao de erros |

Retomada recomendada:

1. Confirmar base limpa em `main`:
   - `git switch main`
   - `git pull`
   - `git status --short --branch`
2. Reconfirmar medicao:
   - `npm run lint`
   - `npm run type-check`
3. Criar branch para a proxima tranche:
   - `git switch -c codex/limpa-any-laudo-handlers`
4. Tratar `src/main/ipc/handlers/laudo.handlers.ts`, removendo os `3`
   warnings `no-explicit-any` restantes do handler de laudos.
5. Validar com:
   - `npx eslint src/main/ipc/handlers/laudo.handlers.ts`
   - `npm run type-check`
   - `npm run lint`
   - `npm test`
   - `npm run build`

Fora do escopo da proxima retomada curta:

- `src/main/services/exportacao.service.ts`
- `src/main/ipc/index.ts`
- warnings de `react-hooks/exhaustive-deps`
- codigo morto/ts-prune

## Linha de progresso

| Commit | Branch de origem | Resultado |
|---|---|---|
| `7171fd1 ajuste_baseline_qualidade` | baseline inicial | Build, type-check, lint e testes desbloqueados; lint com `514 warnings` |
| `1f3b250 ajuste_limpa_warnings_main` | `codex/limpa-warnings-main` | Limpeza inicial em `src/main`; lint da main caiu para `494 warnings` |
| `5280c65 ajuste_reducao_warnings_lint_renderer` | `codex/reduz-warnings-lint` | Reducao relevante no renderer, incluindo `b602.tsx`, `LaudosPage.tsx`, `REPsPage.tsx` |
| `df1eb57 ajuste_limpa_warnings_renderer_simples` | `codex/limpa-warnings-renderer-simples` | Limpeza segura no renderer sem preload; foco em unused/no-console/unescaped |
| `898b48f ajuste_limpa_warnings_preload` | `codex/limpa-warnings-preload` | `src/preload/index.ts` ficou com `0 warnings`; lint global caiu para `266 warnings` |
| `6ea0dcb ajuste_limpa_any_renderer_simples` | `codex/limpa-warnings-any-renderer` | `no-explicit-any` simples no renderer; lint global caiu para `214 warnings` |

## Validacoes recentes

### HEAD `6ea0dcb`

| Comando | Resultado |
|---|---|
| `npm run lint` | Passou com `214 warnings`, `0 errors` |
| `npm run type-check` | Passou |
| Teste manual | Realizado pelo usuario sem erros observados |
| `git push origin main` | Publicado com sucesso |

### Ultima validacao completa com testes/build

Na tranche de preload, antes da ultima limpeza de `any` no renderer:

| Comando | Resultado |
|---|---|
| `npm run lint` | Passou com `266 warnings`, `0 errors` |
| `npm run type-check` | Passou |
| `npm test` | Passou com `34 passed`, `1 skipped` |
| `npm run build` | Passou |

## Regras de continuidade

- Criar nova branch a partir de `main` para cada tranche.
- Manter commits pequenos, em portugues e snake_case.
- Validar sempre com:
  - `npm run lint`
  - `npm run type-check`
- Rodar `npm test` quando houver alteracao comportamental, IPC, banco, service, handlers ou fluxo de UI relevante.
- Rodar `npm run build` quando houver alteracao em preload, bootstrap, tipagem global, empacotamento ou configuracao.
- Evitar misturar limpeza de lint com refatoracao funcional.
- Nao tratar `react-hooks/exhaustive-deps` mecanicamente; abrir plano proprio por componente.
- Nao substituir `any` por tipos artificiais que apenas escondem incerteza. Preferir:
  - tipos locais do formato realmente usado;
  - `unknown` com narrowing;
  - tipos compartilhados quando o contrato se repete;
  - deixar para tranche posterior quando exigir contrato mais amplo.
- Nao atualizar specs funcionais apenas porque arquivos foram tocados; atualizar documentacao somente quando houver mudanca de comportamento atual relevante.

## Distribuicao atual dos warnings

Estado em `6ea0dcb`:

| Regra | Quantidade |
|---|---:|
| `@typescript-eslint/no-explicit-any` | `187` |
| `react-hooks/exhaustive-deps` | `27` |
| Total | `214` |

Principais concentradores restantes:

| Arquivo/area | Tipo de divida | Observacao |
|---|---|---|
| `src/renderer/pages/LaudosPage.tsx` | `no-explicit-any` e hooks | Arquivo grande e sensivel; tranche propria |
| `src/renderer/components/editor/TinyMceEditor.tsx` | `no-explicit-any` | Contrato com TinyMCE; exige cuidado com tipos externos |
| `src/renderer/pages/TemplatesPage.tsx` | `no-explicit-any` e hooks | Fluxo de templates/secoes; separar de hooks |
| `src/renderer/components/editor/PlaceholderContextMenu.tsx` | `no-explicit-any` | Provavel alvo pequeno antes de TinyMCE |
| `src/renderer/pages/CabecalhoPage.tsx` | `no-explicit-any` e hooks | Pode ser tranche renderer pequena, com cuidado nos placeholders |
| `src/renderer/index.tsx` | `no-explicit-any` | Declara `window.ipcAPI`; tratar junto com tipagem global/preload |
| `src/renderer/lib/exportacao-placeholders.ts` | `no-explicit-any` | Envolve REP/campos especificos/exportacao; exige tipos do contrato de exportacao |
| `src/main/**` | `no-explicit-any` | Tranche separada para database/services/handlers |
| `react-hooks/exhaustive-deps` | hooks | Plano proprio, com teste manual por tela |

### Medicao de retomada em 01/07/2026

`npm run lint` foi executado novamente em `main` no HEAD `6ea0dcb` e confirmou
o mesmo total: `214 warnings`, `0 errors`.

Concentracao observada por area:

| Area | Warnings observados | Leitura operacional |
|---|---:|---|
| `src/main/**` | Maior parte dos `any` restantes | Melhor tratar em tranche propria por impacto em IPC, SQLite e services |
| `LaudosPage.tsx` | 43 `any` + 1 hook | Nao misturar com limpeza pequena; fluxo central do produto |
| `TinyMceEditor.tsx` | 22 `any` | Exige consulta aos tipos reais do TinyMCE antes de alterar |
| `TemplatesPage.tsx` | 10 `any` + 5 hooks | Separar limpeza de tipos da correcao dos hooks |
| `PlaceholderContextMenu.tsx` | 7 `any` | Melhor primeiro alvo pequeno no renderer |
| `CabecalhoPage.tsx` | 6 `any` + 2 hooks | Tratar somente `any` na proxima tranche; hooks ficam para depois |
| `WizardEditorPage.tsx` | 6 `any` + 2 hooks | Candidato secundario se a primeira tranche ficar pequena |
| `WizardLaudoPage.tsx` | 5 `any` | Candidato secundario com baixo acoplamento aparente |

### Resultado da tranche `codex/limpa-any-renderer-pequeno`

Arquivos tratados:

- `src/renderer/components/editor/PlaceholderContextMenu.tsx`
- `src/renderer/pages/CabecalhoPage.tsx`
- `src/renderer/pages/WizardLaudoPage.tsx`
- `src/renderer/pages/WizardEditorPage.tsx`

Resultado validado:

| Comando | Resultado |
|---|---|
| `npx eslint src/renderer/components/editor/PlaceholderContextMenu.tsx src/renderer/pages/CabecalhoPage.tsx src/renderer/pages/WizardLaudoPage.tsx src/renderer/pages/WizardEditorPage.tsx` | Passou com `4 warnings` de hooks ja fora do escopo |
| `npm run type-check` | Passou |
| `npm run lint` | Passou com `190 warnings`, `0 errors` |

Efeito:

- `no-explicit-any`: caiu de `187` para `163`.
- `react-hooks/exhaustive-deps`: permaneceu em `27`.
- Total: caiu de `214` para `190`.
- Nenhuma dependencia de hook foi alterada nesta tranche.

### Resultado da tranche `codex/tipa-ipc-renderer-bootstrap`

Arquivo tratado:

- `src/renderer/index.tsx`

Resultado validado:

| Comando | Resultado |
|---|---|
| `npx eslint src/renderer/index.tsx` | Passou sem warnings |
| `npm run type-check` | Passou |
| `npm run lint` | Passou com `188 warnings`, `0 errors` |
| `npm test` | Passou com `34 passed`, `1 skipped` |
| `npm run build` | Passou |

Efeito:

- `no-explicit-any`: caiu de `163` para `161`.
- `react-hooks/exhaustive-deps`: permaneceu em `27`.
- Total: caiu de `190` para `188`.
- A tipagem global estrita do `IpcAPI` do preload foi testada, mas ficou fora do
  corte por abrir erros em consumidores IPC que ainda dependem de respostas
  legadas flexiveis. A tranche manteve uma tipagem legada local para o bootstrap
  sem ampliar handlers, canais ou contratos IPC.

### Resultado da tranche `codex/limpa-any-tinymce-editor`

`src/renderer/components/editor/TinyMceEditor.tsx` ficou sem warnings
`no-explicit-any`, usando tipos oficiais/locais para instancia do editor,
callbacks TinyMCE, comandos customizados e menu condicional. A mutacao dinamica
`_placeholderChaves` foi substituida por ref React local.

| Comando/teste | Resultado |
|---|---|
| `npx eslint src/renderer/components/editor/TinyMceEditor.tsx` | Passou sem warnings |
| `npm run type-check` | Passou |
| `npm run lint` | Passou com `166 warnings`, `0 errors` |
| Teste manual do editor | Realizado pelo usuario sem erros observados |

Efeito: `no-explicit-any` caiu de `161` para `139`; hooks permaneceram em
`27`; total caiu de `188` para `166`.

## Proxima tranche operacional

### Tranche recomendada: LaudosPage

Branch sugerida: `codex/limpa-any-laudos-page`

Commit sugerido: `ajuste_tipa_laudos_page`

Objetivo quantitativo:

- Reduzir os `43` warnings de `no-explicit-any` em
  `src/renderer/pages/LaudosPage.tsx`.
- Nao misturar a limpeza de tipos com o warning de hook do mesmo arquivo, salvo
  decisao explicita.
- Manter `npm run lint` com `0 errors`.
- Manter `npm run type-check` passando.

Escopo principal:

| Ordem | Arquivo | Acao esperada | Criterio de corte |
|---:|---|---|---|
| 1 | `src/renderer/pages/LaudosPage.tsx` | Tipar acesso global ao TinyMCE, dados de REP/perito usados em placeholders, callbacks do painel de ilustracoes, `catch` e helpers locais | Parar se exigir reestruturar estado, fluxo de salvamento/exportacao ou hooks |

Agrupamento observado em retomada:

- Acesso ao editor: repeticoes de `(window as any).tinymce?.get(...)` e arrays
  de editores.
- Placeholders/exportacao: `aplicarPlaceholders`, perito vindo de
  `sessionStorage` e dados de REP usados por chave.
- Painel de ilustracoes: callback `onPanelAction`, `handleIlustracoesEditorInit`
  e helper local de atualizacao de `figcaption`.
- Tratamento de erro: varios `catch (e: any)` que podem virar `unknown` com
  helper de mensagem.

Fora do escopo nesta tranche:

- `src/main/**`
- `TemplatesPage.tsx`
- `src/renderer/index.tsx`
- `TinyMceEditor.tsx`
- Qualquer warning de `react-hooks/exhaustive-deps`

Validacao recomendada:

- `npm run lint`
- `npm run type-check`
- `npm test`
- teste manual de listar, editar, salvar, exportar e navegar em laudos

### Resultado da tranche `codex/limpa-any-laudos-page`

`src/renderer/pages/LaudosPage.tsx` ficou sem warnings
`no-explicit-any`. Foram tipados o acesso global ao TinyMCE, os dados locais de
REP/perito usados por placeholders, callbacks do painel de ilustracoes,
helpers de editor e tratamentos `catch` com `unknown`.

| Comando/teste | Resultado |
|---|---|
| `npx eslint src/renderer/pages/LaudosPage.tsx` | Passou com `1 warning` de `react-hooks/exhaustive-deps`, fora do escopo |
| `npm run type-check` | Passou |
| `npm run lint` | Passou com `123 warnings`, `0 errors` |
| `npm test` | Passou com `34` testes aprovados e `1` skipped |

Efeito: `no-explicit-any` caiu de `139` para `96`; hooks permaneceram em
`27`; total caiu de `166` para `123`.

Proxima recomendacao operacional: tratar `TemplatesPage.tsx` em uma tranche
separada, removendo os warnings `no-explicit-any` sem mexer nos hooks.

### Resultado da tranche `codex/limpa-any-templates-page`

`src/renderer/pages/TemplatesPage.tsx` ficou sem warnings `no-explicit-any`.
Foram tipados o acesso global ao TinyMCE, tipos de exame, placeholders vindos
do IPC, dados de perito da sessao, preview por card e tratamentos `catch` com
`unknown`. Os warnings de hooks do arquivo foram preservados fora do escopo.

| Comando/teste | Resultado |
|---|---|
| `npx eslint src/renderer/pages/TemplatesPage.tsx` | Passou com `5 warnings` de `react-hooks/exhaustive-deps`, fora do escopo |
| `npm run type-check` | Passou |
| `npm run lint` | Passou com `112 warnings`, `0 errors` |
| `npm test` | Passou com `34` testes aprovados e `1` skipped |

Efeito: `no-explicit-any` caiu de `96` para `85`; hooks permaneceram em
`27`; total caiu de `123` para `112`.

Proxima recomendacao operacional: tratar
`src/renderer/lib/exportacao-placeholders.ts` em uma tranche curta, removendo
os `2` warnings `no-explicit-any` restantes nesse helper de exportacao.

### Resultado da tranche `codex/limpa-any-exportacao-placeholders`

`src/renderer/lib/exportacao-placeholders.ts` ficou sem warnings
`no-explicit-any`. Foram tipados os dados de REP usados na exportacao e o
perito lido da sessao com `unknown` + narrowing.

| Comando/teste | Resultado |
|---|---|
| `npx eslint src/renderer/lib/exportacao-placeholders.ts` | Passou sem warnings |
| `npm run type-check` | Passou |
| `npm run lint` | Passou com `110 warnings`, `0 errors` |
| `npm test` | Passou com `34` testes aprovados e `1` skipped |

Efeito: `no-explicit-any` caiu de `85` para `83`; hooks permaneceram em
`27`; total caiu de `112` para `110`.

Proxima recomendacao operacional: iniciar `src/main/**` por um corte estreito
em `database/sqlite.ts` e `types/database.ts`, antes de services/handlers.

### Resultado da tranche `codex/limpa-any-sqlite-database`

`src/main/database/sqlite.ts` e `src/main/types/database.ts` ficaram sem
warnings `no-explicit-any`. A fronteira SQLite passou a usar `sqlite3.Database`,
callbacks com `Error | null`, parametros `unknown[]` e linhas padrão
`DatabaseRow`. A index signature ampla de `DatabaseRow` foi removida; campos
reais usados pelo código atual foram declarados explicitamente.

| Comando/teste | Resultado |
|---|---|
| `npx eslint src/main/database/sqlite.ts src/main/types/database.ts` | Passou sem warnings |
| `npm run type-check` | Passou |
| `npm run lint` | Passou com `96 warnings`, `0 errors` |
| `npm test` | Passou com `34` testes aprovados e `1` skipped |
| `npm run build` | Passou |

Efeito: `no-explicit-any` caiu de `83` para `69`; hooks permaneceram em
`27`; total caiu de `110` para `96`.

Proxima recomendacao operacional: tratar `src/main/services/base.service.ts`
e, se couber no mesmo corte, helpers de services com parametros SQL.

### Resultado da tranche `codex/limpa-any-base-service`

`src/main/services/base.service.ts` ficou sem warnings `no-explicit-any`.
No mesmo corte, foram removidos `any` de parametros SQL próximos em
`SolicitanteService` e `TemplateService`, e o filtro padrão `ativo = 1` deixou
de depender de mutação com cast dinâmico.

| Comando/teste | Resultado |
|---|---|
| `npx eslint src/main/services/base.service.ts src/main/services/solicitante.service.ts src/main/services/template.service.ts` | Passou sem warnings |
| `npm run type-check` | Passou |
| `npm run lint` | Passou com `87 warnings`, `0 errors` |
| `npm test` | Passou com `34` testes aprovados e `1` skipped |
| `npm run build` | Passou |

Efeito: `no-explicit-any` caiu de `69` para `60`; hooks permaneceram em
`27`; total caiu de `96` para `87`.

Proxima recomendacao operacional: tratar um corte de services pequenos antes de
entrar nos handlers IPC, com candidatos como `config-backup.service.ts`,
`importacao.service.ts`, `laudo.service.ts`, `regra-wizard.service.ts` e
`user.service.ts`. Manter `exportacao.service.ts` separado por envolver `docx`
e tipos de documento.

### Resultado da tranche `codex/limpa-any-services-pequenos`

Os services pequenos restantes ficaram sem warnings `no-explicit-any`, exceto
`exportacao.service.ts`, que permanece separado por envolver contratos do
pacote `docx` e estrutura de documento.

Arquivos tratados:

- `src/main/services/config-backup.service.ts`
- `src/main/services/importacao.service.ts`
- `src/main/services/laudo.service.ts`
- `src/main/services/regra-wizard.service.ts`
- `src/main/services/user.service.ts`

| Comando/teste | Resultado |
|---|---|
| `npx eslint src/main/services/config-backup.service.ts src/main/services/importacao.service.ts src/main/services/laudo.service.ts src/main/services/regra-wizard.service.ts src/main/services/user.service.ts` | Passou sem warnings |
| `npm run type-check` | Passou |
| `npm run lint` | Passou com `81 warnings`, `0 errors` |
| `npm test` | Passou com `34` testes aprovados e `1` skipped |
| `npm run build` | Passou |

Efeito: `no-explicit-any` caiu de `60` para `54`; hooks permaneceram em
`27`; total caiu de `87` para `81`.

Proxima recomendacao operacional: escolher entre duas rotas curtas:
`src/main/utils/logger.ts`, com 2 warnings localizados, ou iniciar handlers IPC
por grupos pequenos. Deixar `src/main/services/exportacao.service.ts` para
tranche propria.

### Resultado da tranche `codex/remove-grill-me-e-logger`

O skill local `.agents/skills/grill-me/SKILL.md` foi removido do repositorio
para sair do GitHub. `.agents` ja esta coberto pelo `.gitignore`, entao uma
copia local futura nao deve voltar a ser rastreada por acidente.

`src/main/utils/logger.ts` ficou sem warnings `no-explicit-any`; `logInfo` e
`logDebug` agora recebem `Record<string, unknown>` nos metadados.

| Comando/teste | Resultado |
|---|---|
| `npx eslint src/main/utils/logger.ts` | Passou sem warnings |
| `npm run type-check` | Passou |
| `npm run lint` | Passou com `79 warnings`, `0 errors` |
| `npm test` | Passou com `34` testes aprovados e `1` skipped |
| `npm run build` | Passou |

Efeito: `no-explicit-any` caiu de `54` para `52`; hooks permaneceram em
`27`; total caiu de `81` para `79`.

Proxima recomendacao operacional: iniciar handlers IPC por grupos pequenos,
comecando por handlers simples de CRUD antes de `template.handlers.ts` e
`src/main/ipc/index.ts`. Manter `src/main/services/exportacao.service.ts`
separado.

### Resultado da tranche `codex/limpa-any-handlers-crud`

Handlers IPC pequenos ficaram sem warnings `no-explicit-any`, usando tipos de
linha do banco, tipos exportados dos services e payloads locais para create,
update, arvore de wizard, filtros de auditoria e respostas de regras.

Arquivos tratados:

- `src/main/ipc/handlers/categoria-peca.handlers.ts`
- `src/main/ipc/handlers/categoria-placeholder.handlers.ts`
- `src/main/ipc/handlers/placeholder.handlers.ts`
- `src/main/ipc/handlers/peca.handlers.ts`
- `src/main/ipc/handlers/tipo-exame.handlers.ts`
- `src/main/ipc/handlers/solicitante.handlers.ts`
- `src/main/ipc/handlers/wizard.handlers.ts`
- `src/main/ipc/handlers/regra-wizard.handlers.ts`
- `src/main/ipc/handlers/log.handlers.ts`
- `src/main/ipc/handlers/rep.handlers.ts`
- `src/main/ipc/handlers/user.handlers.ts`

| Comando/teste | Resultado |
|---|---|
| `npx eslint` nos handlers tratados | Passou sem warnings |
| `npm run type-check` | Passou |
| `npm run lint` | Passou com `61 warnings`, `0 errors` |
| `npm test` | Passou com `34` testes aprovados e `1` skipped |
| `npm run build` | Passou |

Efeito: `no-explicit-any` caiu de `52` para `34`; hooks permaneceram em
`27`; total caiu de `79` para `61`.

Proxima recomendacao operacional: tratar `src/main/ipc/handlers/template.handlers.ts`
em tranche propria, por concentrar `12` warnings em blocos repetidos de
`catch (error: any)`. Depois, tratar `laudo.handlers.ts`,
`src/main/ipc/index.ts` e `src/main/services/exportacao.service.ts` em cortes
separados.

### Resultado da tranche `codex/limpa-any-template-handlers`

`src/main/ipc/handlers/template.handlers.ts` ficou sem warnings
`no-explicit-any`. Os blocos `catch (error: any)` foram trocados por
`unknown` com helper local de mensagem, preservando os retornos IPC, logs,
fluxo de templates/secoes e preview PDF.

| Comando/teste | Resultado |
|---|---|
| `npx eslint src/main/ipc/handlers/template.handlers.ts` | Passou sem warnings |
| `npm run type-check` | Passou |
| `npm run lint` | Passou com `49 warnings`, `0 errors` |
| `npm test` | Passou com `34` testes aprovados e `1` skipped |
| `npm run build` | Passou |

Efeito: `no-explicit-any` caiu de `34` para `22`; hooks permaneceram em
`27`; total caiu de `61` para `49`.

Proxima recomendacao operacional: tratar `src/main/ipc/handlers/laudo.handlers.ts`
em uma tranche curta, removendo os `3` warnings restantes no handler de laudos.
Em seguida, tratar `src/main/ipc/index.ts` e manter
`src/main/services/exportacao.service.ts` separado por envolver `docx`.

## Proximas tranches sugeridas

### 1. Main process: laudo handlers

Objetivo: remover os `3` warnings `no-explicit-any` de
`src/main/ipc/handlers/laudo.handlers.ts`.

Risco:

- Afeta criacao por wizard, progresso de wizard e exportacao de laudo.
- Preservar payloads atuais e retornos IPC.

Validacao recomendada:

- `npm run lint`
- `npm run type-check`
- `npm test`
- `npm run build`

### 2. Main process: IPC index

Objetivo: reduzir `any` em `src/main/**`.

Alvos provaveis:

- `src/main/ipc/index.ts`

Risco:

- Afeta contratos IPC, persistencia e SQL.
- Preferir tipos de linha SQLite e payloads de service por entidade.

Validacao recomendada:

- `npm run lint`
- `npm run type-check`
- `npm test`
- `npm run build` se houver alteracao de contrato compartilhado

### 3. Exportacao e hooks

Objetivo: tratar `src/main/services/exportacao.service.ts` em tranche propria e,
depois, os 27 warnings restantes de hooks com analise comportamental.

Regra:

- Nao aplicar dependencia sugerida automaticamente sem revisar risco de loop,
  recarregamento excessivo ou fechamento obsoleto.
- Preferir `useCallback`, mover funcoes para dentro do hook ou reestruturar
  estado somente quando isso preservar comportamento.

Validacao recomendada:

- `npm run lint`
- `npm run type-check`
- teste manual por tela afetada

## Checklist para retomar

1. Confirmar base:
   - `git switch main`
   - `git pull`
   - `git status --short --branch`
2. Medir warnings atuais:
   - `npm run lint`
   - opcional: resumo JSON por regra/arquivo
3. Criar branch:
   - `git switch -c codex/<nome-da-tranche>`
4. Limitar escopo:
   - escolher poucos arquivos;
   - evitar hooks se a tranche for de `any`;
   - evitar IPC se a tranche for renderer simples.
5. Implementar.
6. Validar:
   - `npm run lint`
   - `npm run type-check`
   - testes adicionais conforme risco.
7. Commitar:
   - `git add ...`
   - `git commit -m ajuste_<descricao_curta>`
8. Teste manual se houver UI/fluxo.
9. Merge na `main`, validar novamente e publicar:
   - `git switch main`
   - `git merge <branch>`
   - `npm run lint`
   - `npm run type-check`
   - `git push origin main`

## Criterios para considerar a iniciativa concluida

- `npm run lint` sem warnings ou com warnings explicitamente aceitos e documentados.
- Regras temporariamente rebaixadas em `.eslintrc` reavaliadas para voltar a `error` quando possivel.
- `npm run type-check`, `npm test` e `npm run build` estaveis.
- Excecoes de codigo morto confirmadas registradas em `DEAD_CODE_EXCEPTIONS.md`.
- `00_saude_do_sistema.md` atualizado quando as metricas forem estabilizadas.
