# Plano de Implementacao - Saude de Codigo

> Ultima atualizacao: 01/07/2026
> Branch atual publicada: `main`
> HEAD publicado: `6ea0dcb ajuste_limpa_any_renderer_simples`
> Escopo deste arquivo: checkpoint operacional para continuidade da limpeza de lint, TypeScript, testes e codigo morto.

Este arquivo registra o progresso e o plano de continuidade da implementacao de
qualidade tecnica. Ele deve ser usado como fonte de retomada para novas tranches
de trabalho. Nao descreve comportamento funcional do produto.

## Estado atual publicado

| Area | Estado atual | Observacao |
|---|---|---|
| Branch principal | Publicada | `main` alinhada com `origin/main` |
| HEAD atual | Publicado | `6ea0dcb ajuste_limpa_any_renderer_simples` |
| Build | Passando | Ultima validacao completa feita na tranche de preload |
| TypeScript | Passando | `npm run type-check` OK em `6ea0dcb` |
| Testes | Passando | `npm test` OK na integracao anterior; nao exigido na ultima tranche puramente tipologica |
| ESLint | Passando com warnings | `0 errors`, `214 warnings` |
| Codigo morto | Ainda com apontamentos | Tratar separado de lint/types |

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

## Proximas tranches sugeridas

### 1. exportacao-placeholders

Objetivo: reduzir `any` no helper de placeholders de exportacao.

Risco:

- Helper pequeno, mas usado por preview/exportacao de laudos.
- Preferir tipos locais para REP/campos especificos sem alterar HTML gerado.

Validacao recomendada:

- `npm run lint`
- `npm run type-check`
- `npm test`
- teste manual de preview/exportacao quando houver proxima janela de QA

### 2. Main process: database/services/handlers

Objetivo: reduzir `any` em `src/main/**`.

Alvos provaveis:

- `src/main/database/sqlite.ts`
- `src/main/services/base.service.ts`
- handlers IPC com `Record<string, any>`
- `src/main/services/exportacao.service.ts`

Risco:

- Afeta contratos IPC, persistencia e SQL.
- Preferir tipos de linha SQLite e payloads de service por entidade.

Validacao recomendada:

- `npm run lint`
- `npm run type-check`
- `npm test`
- `npm run build` se houver alteracao de contrato compartilhado

### 3. Hooks (`react-hooks/exhaustive-deps`)

Objetivo: tratar os 27 warnings restantes de hooks com analise comportamental.

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
