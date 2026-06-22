# 🏥 Painel de Saúde do Sistema

> **Última medição:** 22/06/2026
> **Propósito:** Termômetro único para medir o progresso de qualidade do projeto ao longo do tempo.
> **Próxima medição sugerida:** A cada sprint ou após cada grande refatoração.

---

## 📊 Resumo Executivo

| Métrica | Status | Quantidade | Meta | Tendência |
|---|---|---|---|---|
| **Build** (`npm run build`) | ✅ OK | 0 erros | 0 | → |
| **TypeScript** (`npm run type-check`) | 🟡 ~30 erros | ~30 (era ~70 antes de 20/06) | 0 | 📉 melhora |
| **ESLint** (`npm run lint`) | 🟠 540 erros | 540 err + 45 warn (era ~668 antes de 20/06) | 0 err | 📉 melhora |
| **Testes** (`npm run test`) | 🟠 3 falhas | 27/31 pass (3 fail, 1 skip) | 31/31 | → |
| **Código morto** (`npm run prune:all`) | ✅ 0 real | ~310 total (falsos positivos: shadcn/ui, Zod, TinyMCE, props) | 0 real | → |

**Build funcional ✅** — o sistema compila e roda. Os erros são de qualidade/estilo, não de runtime.

> 📉 Em 20/06/2026 houve uma bateria de correções que reduziu `~70 → ~30` erros TypeScript e eliminou dezenas de erros ESLint (unused-vars, unescaped-entities, no-empty, no-useless-escape, TinyMCE vendor excluído do lint).

---

## 🎯 Comandos para Extrair Cada Métrica

| Métrica | Comando | Saída esperada |
|---|---|---|
| **Build** | `npm run build` | `✓ built in Xs` ou erro |
| **TypeScript** | `npm run type-check 2>&1 \| grep -c "error TS"` | Número inteiro |
| **ESLint (total)** | `npm run lint 2>&1 \| tail -1` | `✖ N problems (E err, W warn)` |
| **ESLint (só erros)** | `npm run lint 2>&1 \| grep -c "^.*error"` | Número inteiro |
| **Testes (resumo)** | `npm run test 2>&1 \| grep -E "Test Files\|Tests"` | `N passed / M total` |
| **Código morto** | `npm run prune:all 2>&1 \| grep -c " - "` | Número inteiro |
| **Diagnóstico completo** | `npm run build && npm run lint 2>&1 \| tail -1 && npm run type-check 2>&1 \| grep -c "error TS" && npm run test 2>&1 \| grep "Tests" && npm run prune:all 2>&1 \| grep -c " - "` | Tudo de uma vez |

> 💡 **Dica:** Copie e cole a saída na tabela de [Evolução](#-evolução) abaixo para acompanhar o progresso!

---

## 🧭 Classificação por Criticidade

| Cor | Significado | O que fazer |
|---|---|---|
| 🔴 **CRÍTICO** | **Build quebrado** — sistema não compila ou não roda | Parar tudo, corrigir imediatamente |
| 🟠 **ALTO** | **Lint ou testes falhando** — indicam problemas de qualidade | Prioridade alta para resolver |
| 🟡 **MÉDIO** | **TypeScript errors** — podem ou não afetar runtime | Resolver progressivamente |
| 🔵 **BAIXO** | **Código morto** — não afeta funcionalidade | Auditar periodicamente (skill `/check-dead-code`) |

---

## 📈 Evolução

Registre aqui as medições ao longo do tempo para visualizar o progresso.

| Data | Build | TS Errors | ESLint (err/warn) | Testes (pass/total) | Código morto | Quem |
|---|---|---|---|---|---|
| **13/06/2026** | ✅ | ~70 | 668 (624 err, 44 warn) | — | — | — |
| **20/06/2026** | ✅ | ~32 | ~585+ | — | — | — |
| **22/06/2026** | ✅ | ~30 | 540 / 45 | 27/31 (+3 fail, 1 skip) | ~310 | — |

---

## 🔬 Detalhamento dos Erros

### TypeScript (~30 erros)

Distribuição aproximada:

| Grupo | Qtde | Arquivos afetados |
|---|---|---|
| `REPFormData` vs `Record<string, string>` (cast) | ~25 | `exam-fields/services/b602.service.ts`, `exam-fields/index.ts` |
| Zod `.passthrough()` vs `REPFormData` | ~15 | `REPsPage.tsx` |
| TinyMCE prop mismatch | ~6 | `TinyMceEditor.tsx`, `CabecalhoPage.tsx`, `LaudosPage.tsx`, `TemplatesPage.tsx` |
| `LucideIcon` vs `ComponentType<{ size }>` | ~6 | `exam-fields/index.ts`, `REPsPage.tsx` |
| `group: null` vs `string \| undefined` | ~6 | `exam-fields/index.ts` |
| Outros (escopo, prop removida, etc.) | ~7 | `LaudosPage.tsx`, `SolicitantesPage.tsx`, `PlaceholdersPage.tsx` |


### ESLint (540 erros, 45 warnings)

| Regra | Qtde | Gravidade |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | ~200 | error |
| `no-extra-semi` (TinyMCE vendor) | ~30 | error |
| `react-hooks/exhaustive-deps` | ~20 | warning |
| `no-unused-vars` | ~5 | error |
| `no-empty` (catch blocks) | ~5 | error |
| `react/no-unescaped-entities` | ~6 | error |
| `no-extra-boolean-cast` | ~4 | error |
| `no-useless-escape` | ~6 | error |
| Demais (espalhados) | ~264 | error |

> ⚠️ Os erros `no-extra-semi` são do vendor TinyMCE em `out/renderer/tinymce/` e `public/tinymce/` — código de terceiros. Devem ser **excluídos do lint** (`.eslintignore`), não corrigidos.

### Testes (3 falhas, 1 skip)

As 3 falhas são **pré-existentes** e localizadas no mesmo arquivo:

| Teste | Arquivo | Causa |
|---|---|---|
| Botão tamanho pequeno | `button.test.tsx:49` | Espera `h-9`, recebe `h-8` (shadcn/ui atualizou classes) |
| Botão tamanho grande | `button.test.tsx:56` | Espera `h-11`, recebe `h-10` (shadcn/ui atualizou classes) |
| Botão com ícone | `button.test.tsx:64` | Espera `h-10 w-10`, recebe `h-9 w-9` (shadcn/ui atualizou classes) |

**Correção:** Atualizar as classes CSS esperadas nos asserts do `button.test.tsx` para bater com a versão atual do componente.

### Código Morto (~310 itens do ts-prune)

A maioria são falsos positivos conhecidos:

| Categoria | Exemplos |
|---|---|
| **shadcn/ui barrel re-exports** | `DropdownMenuGroup`, `SheetPortal`, `DialogOverlay`, etc. |
| **Zod types re-exportados** | `User`, `CreateUserInput`, `REPResponse`, etc. |
| **TinyMCE vendor skins** | `public/tinymce/skins/**` |
| **Props de componentes** | `ButtonProps`, `StepperProps`, `BadgeProps` (usadas internamente) |
| **Funções internas** | `marginsToInches`, `getDescendantIds` (usadas no mesmo módulo) |

📄 **Exceções documentadas:** [`DEAD_CODE_EXCEPTIONS.md`](../../../../DEAD_CODE_EXCEPTIONS.md)

---

## 📋 Planos de Ação

| Plano | Status | Onde está |
|---|---|---|
| **Abordagem leve (pré-Knip)** | ✅ Concluído | [`01_abordagem_leve_pre_knip.md`](01_abordagem_leve_pre_knip.md) |
| **Knip (detecção automática)** | 🟡 Futuro | [`02_plano_knip_futuro.md`](02_plano_knip_futuro.md) |

### Prioridades sugeridas

1. 🥇 **Excluir vendor TinyMCE do ESLint** (~30 erros resolvidos em 1 minuto)
2. 🥇 **Corrigir os 7 erros críticos de type-check** (escopo, prop removida, etc.) — risco real de runtime
3. 🥈 **Corrigir os 5 `no-unused-vars`** — código morto já confirmado
4. 🥈 **Atualizar `button.test.tsx`** — 3 falhas resolvidas
5. 🥉 **Resolver casts `REPFormData`** — ~25 erros de uma vez
6. 🥉 **Exhaustive-deps** — ~20 warnings, melhora runtime

---

## 🔗 Referências

- [Abordagem leve anti-código morto (concluído)](01_abordagem_leve_pre_knip.md)
- [Plano Knip futuro](02_plano_knip_futuro.md)
- [Exceções de código morto](../../../DEAD_CODE_EXCEPTIONS.md)
- Skill: `check-dead-code` em `.claude/skills/check-dead-code.md` (apenas local — não versionado)
