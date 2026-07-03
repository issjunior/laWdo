# Painel de Saúde do Sistema

> **Última medição:** 03/07/2026
> **Propósito:** registrar o estado atual de build, tipagem, lint, testes e auditoria de código morto.

---

## Resumo Executivo

| Métrica | Status | Quantidade | Observação |
|---|---|---|---|
| **Build** (`npm run build`) | ✅ OK | 0 erros bloqueantes | build completo reexecutado após limpeza de lint |
| **TypeScript** (`npm run type-check`) | ✅ OK | 0 erros | main + preload + renderer passam |
| **ESLint** (`npm run lint`) | ✅ OK | 0 erros, 0 warnings | frente de lint zerada após revisão dos hooks restantes |
| **Testes** (`npm test`) | ✅ OK | 43 pass, 1 skip | suíte verde após limpeza dos hooks do renderer |
| **Código morto** (`npm run prune:all`) | 🟡 Não reavaliado nesta medição | último painel mantinha apontamentos remanescentes | sem nova rodada em 03/07/2026 |

Leitura prática do estado atual:

- a aplicação compila
- a checagem de tipos passa
- o lint está limpo e volta a funcionar como gate sem tolerância a warnings
- os warnings de `no-explicit-any` saíram da frente prioritária de IPC/exportação
- os warnings de `react-hooks/exhaustive-deps` foram tratados com revisão comportamental
- a suíte automatizada voltou a ficar verde

---

## Comandos executados nesta medição

```bash
npm run type-check
npm run lint
npm test
npm run build
```

## Evolução recente

| Data | Build | TS Errors | ESLint (err/warn) | Testes | Observação |
|---|---|---|---|---|---|
| **30/06/2026** | ✅ | 0 | 0 / 514 | 34 pass, 1 skip | baseline com warnings altos |
| **01/07/2026** | ✅ | 0 | 0 / 49 | 34 pass, 1 skip | limpeza incremental de lint |
| **03/07/2026** | ✅ | 0 | 0 / 49 | 43 pass, 1 skip | dashboard mantida e suíte restaurada após correção da fixture |
| **03/07/2026 (tranche IPC/exportação)** | ✅* | 0 | 0 / 27 | 43 pass, 1 skip* | remoção dos warnings `no-explicit-any` em `laudo.handlers`, `ipc/index` e `exportacao.service` |
| **03/07/2026 (tranche hooks renderer)** | ✅ | 0 | 0 / 0 | 43 pass, 1 skip | remoção dos warnings `react-hooks/exhaustive-deps` em componentes e páginas do renderer |

---

## Detalhamento por frente

### Build

`npm run build` passou em 03/07/2026 após a limpeza de lint.

Observações não bloqueantes da execução atual:

- o build do renderer concluiu normalmente
- o Vite ainda alerta sobre chunks grandes no bundle final
- a pipeline de `main`, `preload` e `renderer` continua íntegra

### TypeScript

`npm run type-check` passa com `0` erros.

Isso confirma que os contratos novos da dashboard ficaram alinhados entre:

- `src/main/services/dashboard.service.ts`
- `src/main/ipc/handlers/dashboard.handlers.ts`
- `src/preload/index.ts`
- `src/preload/types.ts`
- `src/types/dashboard.d.ts`
- `src/renderer/pages/DashboardPage.tsx`

### ESLint

`npm run lint` passa com `0` warnings e `0` erros.

Distribuição atual:

- sem warnings remanescentes

Avanço confirmado nesta tranche:

- `src/main/ipc/handlers/laudo.handlers.ts` saiu da lista
- `src/main/ipc/index.ts` saiu da lista
- `src/main/services/exportacao.service.ts` saiu da lista
- `src/renderer/components/rep/RepStepper.tsx` saiu da lista
- `src/renderer/pages/CabecalhoPage.tsx` saiu da lista
- `src/renderer/pages/CategoriasPecasPage.tsx` saiu da lista
- `src/renderer/pages/GdlConfigPage.tsx` saiu da lista
- `src/renderer/pages/LaudosPage.tsx` saiu da lista
- `src/renderer/pages/LogsPage.tsx` saiu da lista
- `src/renderer/pages/PlaceholdersPage.tsx` saiu da lista
- `src/renderer/pages/REPsPage.tsx` saiu da lista
- `src/renderer/pages/SolicitantesPage.tsx` saiu da lista
- `src/renderer/pages/TemplatesPage.tsx` saiu da lista
- `src/renderer/pages/TiposExamePage.tsx` saiu da lista
- `src/renderer/pages/WizardEditorPage.tsx` saiu da lista

### Testes

`npm test` passa em 03/07/2026 após a limpeza dos hooks do renderer.

Resumo atual:

- **arquivos de teste:** 5 passando
- **testes:** 43 passando, 1 skip

A regressão pontual da dashboard foi resolvida ao alinhar a fixture de `src/__tests__/main/dashboard.service.test.ts` ao contrato atual de `DashboardService.obterResumo()`.

Correção aplicada:

- o teste passou a mockar separadamente a consulta de `repsRecentes`
- a consulta de `laudosRecentes` voltou a receber o payload esperado
- a suíte do service e a suíte da página da dashboard ficaram verdes no mesmo estado do repositório

### Código morto

Não houve nova rodada de `npm run prune:all` nesta medição.

O estado de referência continua sendo o painel anterior:

- apontamentos remanescentes ainda precisam de auditoria
- já existem falsos positivos conhecidos documentados em `DEAD_CODE_EXCEPTIONS.md`

---

## Prioridades atuais

1. rodar nova auditoria de código morto (`npm run prune:all`) com lint e TypeScript estabilizados
2. revisar os apontamentos remanescentes contra `DEAD_CODE_EXCEPTIONS.md`
3. atualizar o painel com a nova medição de código morto

## Notas desta tranche

- `npm run type-check` foi reexecutado e continua verde
- `npm run lint` caiu de `49` para `0` warnings no acumulado das tranches de 03/07/2026
- `npm test` foi reexecutado e continua com `43 pass, 1 skip`
- `npm run build` foi reexecutado e continua verde, com o aviso conhecido de chunks grandes do Vite
- os hooks do renderer foram ajustados sem supressões de ESLint

## Referências úteis

- `spec/10 dashboard/dashboard_operacional.md`
- `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/DEAD_CODE_EXCEPTIONS.md`
- `src/__tests__/main/dashboard.service.test.ts`
- `src/main/services/dashboard.service.ts`
