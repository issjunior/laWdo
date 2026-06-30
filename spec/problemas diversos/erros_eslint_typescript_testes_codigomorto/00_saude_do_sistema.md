# 🏥 Painel de Saúde do Sistema

> **Última medição:** 30/06/2026
> **Propósito:** Termômetro único para medir o progresso de qualidade do projeto ao longo do tempo.
> **Próxima medição sugerida:** A cada sprint ou após cada grande refatoração.

---

## 🗺️ Visão Geral do Fluxo de Correção

Este projeto tem **4 camadas de diagnóstico** que se complementam para identificar, decidir e remover código morto com segurança. A skill `check-dead-code` é o executor; os arquivos deste diretório são os insumos de contexto; e o Knip é o destino futuro para automação.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADAS DE DIAGNÓSTICO                       │
├───────────┬──────────────┬──────────────┬───────────────────────┤
│   Painel  │  Abordagem   │    Grafo     │       Skill           │
│  de Saúde │    Leve      │  (graphify)  │  check-dead-code      │
│           │              │              │                       │
│ (este arq)│ 01_...md     │ 03_...md     │ .claude/skills/       │
│           │              │              │ check-dead-code/      │
│ Métricas  │ Órfãos já    │ Impacto      │ Executa a auditoria   │
│ atuais    │ removidos    │ estrutural   │ usando os 3 insumos   │
└─────┬─────┴──────┬───────┴──────┬───────┴───────────┬───────────┘
      │            │              │                   │
      ▼            ▼              ▼                   ▼
  "O QUE está   "O QUE já    "ONDE impacta   "COMO decidir
   ruim?"       foi feito?"   no sistema?"    e remover?"
                                              │
                                              ▼
                                      ┌───────────────┐
                                      │     FUTURO     │
                                      │    (Knip)      │
                                      │                │
                                      │ Automação no   │
                                      │ CI/lint para   │
                                      │ prevenir novos │
                                      │ órfãos         │
                                      └───────────────┘
```

### O papel de cada peça

| Peça | O que é | Quando usar |
|------|---------|-------------|
| **`00_saude_do_sistema.md`** (este arquivo) | Painel com métricas atuais: build ✅, TS ✅, ESLint sem erros bloqueantes, testes 34/35, dead code ainda com apontamentos | Consultar antes de auditar — mostra o panorama geral e categorias de falso positivo já mapeadas |
| **`01_abordagem_leve_pre_knip.md`** | Plano concluído: lista de órfãos já removidos, imports limpos, scripts configurados | **Evitar retrabalho** — itens já tratados não são reanalisados |
| **`02_plano_knip_futuro.md`** | Especificação do Knip: config, entry points, regras, pré-requisitos (testes ≥30%, CI) | **Futuro** — quando os pré-requisitos forem atingidos, Knip substitui ts-prune |
| **`03_melhoria_graphify.md`** | Análise estrutural do grafo: god nodes, coesão de comunidades, bridges, impacto de remoção | **Decisão enriquecida** — saber se um nó morto é isolado ou parte de um hub crítico |
| **Skill `check-dead-code`** (`.claude/skills/check-dead-code/`) | Orquestrador: lê os 4 insumos → roda ts-prune → cruza dados → decide → remove | **Agora** — auditoria sob demanda, invocada via `/check-dead-code` |
| **Knip** (futuro) | Ferramenta AST que detecta arquivos órfãos + exports não usados + deps npm automaticamente | **Futuro** — integrado ao lint/CI, bloqueia código morto antes de entrar no repositório |

### Resumo do ciclo

```
1. graphify update . --force        (gera grafo estrutural)
       ↓
2. LLM → 03_melhoria_graphify.md    (análise curada do grafo)
       ↓
3. npm run prune:all                (ts-prune detecta exports não usados)
       ↓
4. /check-dead-code                 (skill cruza ts-prune + 4 insumos + 7 critérios)
       ↓
5. ✅ Remove seguro | ⚠️ Manual | ❌ Falso positivo → DEAD_CODE_EXCEPTIONS.md
       ↓
6. [Futuro] Knip no CI             (previne novos órfãos automaticamente)
```

---

## 📊 Resumo Executivo

| Métrica | Status | Quantidade | Meta | Tendência |
|---|---|---|---|---|
| **Build** (`npm run build`) | ✅ OK | 0 erros | 0 | → |
| **TypeScript** (`npm run type-check`) | ✅ OK | 0 erros | 0 | 📉 melhora |
| **ESLint** (`npm run lint`) | 🟡 OK com warnings | 0 err + 514 warn | 0 err | 📉 melhora |
| **Testes** (`npm run test`) | ✅ OK | 34 pass, 1 skip | suíte verde | 📉 melhora |
| **Código morto** (`npm run prune:all`) | 🟡 Em auditoria | apontamentos remanescentes e falsos positivos conhecidos | 0 real | → |

**Baseline funcional ✅** — build, type-check, lint e testes executam sem erro bloqueante.
O lint ainda concentra dívida técnica em warnings conhecidos.

> 📉 Em 20/06/2026 houve uma bateria de correções que reduziu `~70 → ~30` erros TypeScript e eliminou dezenas de erros ESLint (unused-vars, unescaped-entities, no-empty, no-useless-escape, TinyMCE vendor excluído do lint).
> 📉 Em 30/06/2026 o baseline foi estabilizado: TypeScript chegou a `0` erros, testes passaram para `34/35`, e ESLint passou a ser executável como gate com `0` erros e warnings explícitos.

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
| **23/06/2026** (pré-execução) | ✅ | ~30 | 540 / 45 | 27/31 | ~310 (30 confirmados) | skill |
| **23/06/2026** (pós-execução) | ✅ | ~32 | 538 / 45 | 27/31 | **268** (42 removidos 🧹) | execução manual |
| **30/06/2026** (baseline) | ✅ | 0 | 0 / 514 | 34/35 (+1 skip) | apontamentos remanescentes | Codex |

---

## 🔬 Detalhamento dos Erros

### TypeScript (0 erros)

O comando `npm run type-check` passa no baseline atual.

Os principais grupos que bloqueavam a checagem foram tratados:

| Grupo | Qtde | Arquivos afetados |
|---|---|---|
| Zod/react-hook-form e `REPFormData` | resolvido | `REPsPage.tsx`, `exam-fields/types.ts` |
| Schema de modelos de IA | resolvido | `ModelosIAPage.tsx` |
| TinyMCE prop mismatch | resolvido | `TinyMceEditor.tsx` |
| Tipos do TanStack Table | resolvido | `data-table.tsx` |
| Tipagem de ícones | resolvido | `exam-fields/types.ts` |


### ESLint (0 erros, 514 warnings)

O comando `npm run lint` passa porque as dívidas abaixo foram mantidas visíveis
como warnings, não porque foram eliminadas.

| Regra | Qtde | Gravidade |
|---|---|---|
| `@typescript-eslint/no-explicit-any` | majoritária | warning |
| `@typescript-eslint/no-unused-vars` | remanescente | warning |
| `react/no-unescaped-entities` | remanescente | warning |
| `react-hooks/exhaustive-deps` | ~20 | warning |
| Demais warnings | remanescente | warning |

> ⚠️ `out/**` está excluído do lint para evitar análise de artefatos de build. O vendor TinyMCE em `public/tinymce/` continua tratado como código de terceiros.

### Testes (34 pass, 1 skip)

As falhas pré-existentes em `button.test.tsx` foram corrigidas para refletir as
classes atuais do componente `Button`.

| Teste | Arquivo | Causa |
|---|---|---|
| Botão tamanho pequeno | `button.test.tsx` | Assert atualizado para `h-8` |
| Botão tamanho grande | `button.test.tsx` | Assert atualizado para `h-10` |
| Botão com ícone | `button.test.tsx` | Assert atualizado para `h-9 w-9` |

O skip remanescente segue como parte da suíte atual.

### Código Morto (~268 itens do ts-prune)

**🧹 Execução em 23/06/2026:** 42 itens removidos (1 arquivo órfão, ~27 exports, 1 import limpo, 11 default exports redundantes). Nenhuma regressão — build, lint, type-check e testes mantidos.

A maioria dos ~268 restantes são falsos positivos conhecidos:

| Categoria | Exemplos |
|---|---|
| **shadcn/ui barrel re-exports** | `DropdownMenuGroup`, `SheetPortal`, `DialogOverlay`, etc. |
| **Zod types re-exportados** | `User`, `CreateUserInput`, `REPResponse`, etc. |
| **TinyMCE vendor skins** | `public/tinymce/skins/**` |
| **Props de componentes** | `ButtonProps`, `StepperProps`, `BadgeProps` (usadas internamente) |
| **Funções internas** | `marginsToInches`, `getDescendantIds` (usadas no mesmo módulo) |

📄 **Exceções documentadas:** [`DEAD_CODE_EXCEPTIONS.md`](./DEAD_CODE_EXCEPTIONS.md)

---

## 📋 Planos de Ação

| Plano | Status | Onde está |
|---|---|---|
| **Abordagem leve (pré-Knip)** | ✅ Concluído | [`01_abordagem_leve_pre_knip.md`](01_abordagem_leve_pre_knip.md) |
| **Auditoria ts-prune 23/06/2026** | ✅ Executado — 42 itens removidos | [`04_auditoria_tsprune_2026-06-23.md`](04_auditoria_tsprune_2026-06-23.md) |
| **Baseline de qualidade 30/06/2026** | 🟡 Em revisão | [`plan_implementacao.md`](plan_implementacao.md) |
| **Knip (detecção automática)** | 🟡 Futuro | [`02_plano_knip_futuro.md`](02_plano_knip_futuro.md) |

### Prioridades sugeridas

1. 🥇 **Publicar a branch do baseline e abrir Draft PR**
2. 🥇 **Reduzir warnings de `no-unused-vars`** até a regra poder voltar para error
3. 🥈 **Reduzir warnings de `react/no-unescaped-entities`** até a regra poder voltar para error
4. 🥈 **Atacar `no-explicit-any` por módulo** sem trocar dívida real por tipos artificiais
5. 🥉 **Auditar código morto remanescente** e registrar exceções confirmadas
6. 🥉 **Reavaliar Knip** depois do baseline ser aceito

---

## 🔗 Referências

- [Abordagem leve anti-código morto (concluído)](01_abordagem_leve_pre_knip.md)
- [Plano Knip futuro](02_plano_knip_futuro.md)
- [Melhoria Graphify](03_melhoria_graphify.md) — visão estrutural baseada no grafo do graphify (god nodes, coesão de comunidades, bridges)
- [Auditoria ts-prune 23/06/2026](04_auditoria_tsprune_2026-06-23.md) — relatório completo de código morto com ~30 itens confirmados
- [Exceções de código morto](./DEAD_CODE_EXCEPTIONS.md)

## Nota de 27/06/2026

As referências históricas a `DEAD_CODE_EXCEPTIONS.md` fora deste diretório foram consolidadas para o caminho completo:

`spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/DEAD_CODE_EXCEPTIONS.md`

Isso não muda o fluxo de auditoria; apenas elimina ambiguidade quando a IA consulta o arquivo a partir de outros diretórios e specs.
- Skill: `check-dead-code` em `.claude/skills/check-dead-code.md` (apenas local — não versionado)
