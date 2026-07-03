# Painel de Saúde do Sistema

> **Última medição:** 03/07/2026
> **Propósito:** registrar o estado atual de build, tipagem, lint, testes e auditoria de código morto.

---

## Resumo Executivo

| Métrica | Status | Quantidade | Observação |
|---|---|---|---|
| **Build** (`npm run build`) | ✅ OK | 0 erros bloqueantes | build completo executado em 03/07/2026 |
| **TypeScript** (`npm run type-check`) | ✅ OK | 0 erros | main + preload + renderer passam |
| **ESLint** (`npm run lint`) | 🟡 OK com warnings | 0 erros, 49 warnings | warnings concentrados em `no-explicit-any` e `react-hooks/exhaustive-deps` |
| **Testes** (`npm test`) | ✅ OK | 43 pass, 1 skip | suíte verde após alinhar a fixture de `dashboard.service` ao contrato atual |
| **Código morto** (`npm run prune:all`) | 🟡 Não reavaliado nesta medição | último painel mantinha apontamentos remanescentes | sem nova rodada em 03/07/2026 |

Leitura prática do estado atual:

- a aplicação compila
- a checagem de tipos passa
- o lint continua executável como gate, sem erros bloqueantes
- a suíte automatizada voltou a ficar verde

---

## Comandos executados nesta medição

```bash
npm run build
npm run type-check
npm run lint
npm test
```

## Evolução recente

| Data | Build | TS Errors | ESLint (err/warn) | Testes | Observação |
|---|---|---|---|---|---|
| **30/06/2026** | ✅ | 0 | 0 / 514 | 34 pass, 1 skip | baseline com warnings altos |
| **01/07/2026** | ✅ | 0 | 0 / 49 | 34 pass, 1 skip | limpeza incremental de lint |
| **03/07/2026** | ✅ | 0 | 0 / 49 | 43 pass, 1 skip | dashboard mantida e suíte restaurada após correção da fixture |

---

## Detalhamento por frente

### Build

`npm run build` passou em 03/07/2026.

Observações não bloqueantes da execução atual:

- o build do renderer concluiu normalmente
- o Vite ainda alerta sobre chunks grandes no bundle final
- a presença da dashboard não quebrou a pipeline de `main`, `preload` ou `renderer`

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

`npm run lint` passa com `49` warnings e `0` erros.

Distribuição atual:

- `@typescript-eslint/no-explicit-any`: 22 warnings
- `react-hooks/exhaustive-deps`: 27 warnings

Os focos que continuam mais carregados são:

- `src/main/services/exportacao.service.ts`
- `src/main/ipc/index.ts`
- `src/main/ipc/handlers/laudo.handlers.ts`
- páginas grandes do renderer com dependências de hooks ainda não revisitadas

### Testes

`npm test` passa em 03/07/2026.

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

1. tratar os warnings restantes de `src/main/ipc/handlers/laudo.handlers.ts`
2. tratar os warnings restantes de `src/main/ipc/index.ts`
3. revisar `src/main/services/exportacao.service.ts` em tranche própria
4. atacar `react-hooks/exhaustive-deps` com revisão comportamental, sem correção mecânica
5. rodar nova auditoria de código morto quando a frente de lint estiver mais estável

## Referências úteis

- `spec/10 dashboard/dashboard_operacional.md`
- `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/DEAD_CODE_EXCEPTIONS.md`
- `src/__tests__/main/dashboard.service.test.ts`
- `src/main/services/dashboard.service.ts`
