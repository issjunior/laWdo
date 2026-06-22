# 🪶 Plano: Abordagem Leve Anti-Código Morto (Pré-Knip)

> **Última atualização:** 22/06/2026
>
> **Status:** ✅ **CONCLUÍDO** — implementado em 22/06/2026 (commit `31aefc2`).
>
> **Motivação:** O projeto tem código morto identificado (~6 arquivos órfãos + ~10 imports não usados) que pode ser removido com segurança agora. Em vez de investir 4-6 horas configurando Knip (que exige pré-requisitos de maturidade ainda não alcançados), este plano entrega 80% do valor com 20% do esforço usando ferramentas leves.
>
> **Futuro:** Quando os pré-requisitos de maturidade forem alcançados (testes, CI), o [plano completo do Knip](./02_plano_knip_futuro.md) deve ser implementado.

---

## 📋 Sumário

1. [Diagnóstico Atual](#-diagnóstico-atual)
2. [Estágio 1 — Limpeza Manual](#-estágio-1--limpeza-manual)
3. [Estágio 2 — ts-prune + Skill](#-estágio-2--ts-prune--skill)
4. [Estágio 3 — Caminho para o Knip](#-estágio-3--caminho-para-o-knip)
5. [Verificação](#-verificação)

---

## 🔍 Diagnóstico Atual

### Arquivos órfãos confirmados (22/06/2026)

| Arquivo | Evidência | Ação |
|---|---|---|
| `src/renderer/routes/index.tsx` | `AppRoutes` nunca importado — `App.tsx` define rotas inline | ✅ Remover |
| `src/renderer/components/layout/Layout.tsx` | Importa `./Sidebar.js` (não existe mais); nunca importado | ✅ Remover |
| `src/renderer/pages/index.ts` | Barrel incompleto (8/22 páginas); nunca importado | ✅ Remover |
| `src/shared/types/database.js` | Artefato compilado (`.js` gerado de `.ts`); `@shared/*` nunca importado | ✅ Remover |
| `src/shared/types/database.ts` | Nenhum arquivo importa de `@shared/*` ou `../shared/` | ⚠️ Decidir — remover se sem planos de uso |
| `src/shared/types/logger.ts` | `LogModule` redefinido localmente em `main/utils/logger.ts`; `@shared/*` nunca importado | ⚠️ Decidir — remover se sem planos de uso |

### Imports não utilizados

| Arquivo | Imports mortos |
|---|---|
| `src/renderer/App.tsx` | `useLocation`, `Dialog`+4 subcomponentes, `Tabs`+3 subcomponentes, `Badge`, `Info`, `Github`, `Mail`, `SidebarTrigger` (duplicado com `Header.tsx`) |
| `src/main/ipc/index.ts` | `auditLogout` |

### Contexto do projeto

| Métrica | Valor |
|---|---|
| Fontes TypeScript | ~212 (excluindo vendor TinyMCE 176 arquivos) |
| Testes existentes | 2 (`button.test.tsx`, `user.schema.test.ts`) |
| Cobertura de testes | ~1% |
| CI | Inexistente |
| ESLint | Configurado (`.eslintrc.json`), `no-unused-vars` ativo |
| Prettier | Configurado |
| Type-check | `tsc --noEmit && tsc -p tsconfig.renderer.json --noEmit` |

---

## 🧹 Estágio 1 — Limpeza Manual

**Tempo estimado:** 30 minutos
**Risco:** Baixíssimo (só remove o que já foi confirmado como órfão)

### Passo 1.1 — Remover arquivos órfãos

```bash
# Arquivos confirmados como órfãos (sem nenhum import em todo o projeto)
git rm src/renderer/routes/index.tsx
git rm src/renderer/components/layout/Layout.tsx
git rm src/renderer/pages/index.ts
git rm src/shared/types/database.js   # artefato compilado — fonte é o .ts

# Avaliar remoção de src/shared/types/ (diretório inteiro sem imports)
# Decisão: se não há plano concreto de uso, remover
git rm src/shared/types/database.ts
git rm src/shared/types/logger.ts
```

### Passo 1.2 — Limpar imports não usados em App.tsx

Remover os seguintes imports de `src/renderer/App.tsx`:

- `useLocation` de `react-router-dom`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogTrigger` de `@/components/ui/dialog`
- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` de `@/components/ui/tabs`
- `Badge` de `@/components/ui/badge`
- `Info`, `Github`, `Mail` de `lucide-react`
- `SidebarTrigger` de `@/components/ui/sidebar` (já importado em `Header.tsx`)

### Passo 1.3 — Limpar imports não usados em main/ipc/index.ts

Remover `auditLogout` do import de handlers (se confirmado que não é chamado no arquivo).

### Passo 1.4 — Validar

```bash
npm run build          # main + preload + renderer — deve compilar sem erros
npm run test           # 2 testes devem continuar passando
npm run type-check     # zero erros de tipo
npm run lint           # ESLint zero erros
```

---

## 🔧 Estágio 2 — ts-prune + Skill

**Tempo estimado:** 1-2 horas
**Risco:** Baixo (ferramentas sob demanda, sem CI gate)

### Passo 2.1 — Instalar ts-prune

```bash
npm install -D ts-prune
```

### Passo 2.2 — Adicionar scripts ao package.json

```json
{
  "scripts": {
    "prune": "ts-prune -p tsconfig.renderer.json",
    "prune:all": "ts-prune -p tsconfig.renderer.json && ts-prune -p tsconfig.main.json && ts-prune -p tsconfig.preload.json",
    "dead-code:check": "npm run prune:all"
  }
}
```

**Por que ts-prune e não Knip agora?**

| Aspecto | ts-prune | Knip |
|---|---|---|
| Instalação | `npm install -D ts-prune` | `npm install -D knip` + `knip.json` (~60 linhas) |
| Configuração | Zero — usa tsconfig existente | ~2-4 horas (multi-tsconfig, path aliases, exceções) |
| Detecta | Exports não usados | Exports + arquivos órfãos + deps npm + duplicatas |
| Falsos positivos | Baixíssimo (usa o compilador TypeScript) | Médio-alto (shadcn/ui, barrel exports, configs) |
| Cobertura | ~80% do problema | 100% |

### Passo 2.3 — Criar a skill `/check-dead-code`

Criar arquivo `.claude/skills/check-dead-code.md`:

```markdown
---
name: check-dead-code
description: "Analisa código morto no projeto e sugere remoções seguras"
---

## Propósito

Auditar código morto usando ts-prune + grep + verificação semântica.

## Fluxo principal

1. Rode `npm run prune:all` para obter exports não usados
2. **Filtre apenas "unused files" primeiro** (arquivos inteiros órfãos — risco baixo)
3. Para cada arquivo sinalizado, aplique os **6 critérios de decisão** abaixo
4. Agrupe resultados:
   - ✅ Pode remover com segurança
   - ⚠️ Requer verificação manual
   - ❌ Falso positivo confirmado — justificar no `DEAD_CODE_EXCEPTIONS.md`
5. Execute remoções seguras (se `--fix`)

## Critérios de decisão (6 pontos)

Antes de remover qualquer arquivo ou export, aplique este checklist:

**✅ Pode remover com segurança se:**

| # | Critério | Como verificar |
|---|---|---|
| 1 | Arquivo não importado em nenhum lugar | `grep -r "from.*NomeArquivo" src/` retorna vazio |
| 2 | Função/export não referenciada | Nenhum arquivo fora o próprio usa a exportação |
| 3 | Sem testes específicos para o arquivo | Não existe `NomeArquivo.test.ts` ou `.spec.ts` |

**❌ NÃO remover se:**

| # | Critério | Como verificar |
|---|---|---|
| 4 | Pode ser usado dinamicamente | `lazy(() => import(...))`, `require()` condicional, string-based path |
| 5 | Pode ser re-exportado em barrel | `export * from` ou `export { X } from` em `index.ts` do diretório |
| 6 | Pode ser usado por plugin externo | TinyMCE, Electron, webpack/rollup que carregam por convenção de nome |

**Regra de ouro:** Em caso de dúvida, **não remove**. Registra no `DEAD_CODE_EXCEPTIONS.md` como "suspeito — requer verificação manual".

## Validação pós-remoção

- `npm run build` — sem erros
- `npm run test` — testes passando
- `npm run type-check` — sem erros de tipo
- `npm run prune:all` — confirmar que órfão sumiu
- Testar fluxos críticos manualmente (REP form, stepper, login)

## Subcomandos

- `/check-dead-code` — auditoria completa
- `/check-dead-code --dir src/renderer/components/rep` — escopo específico
- `/check-dead-code --files-only` — apenas unused files (primeira iteração)
- `/check-dead-code --exports-only` — apenas unused exports (segunda passada)
- `/check-dead-code --fix` — remove arquivos seguros e commita
```

### Passo 2.4 — Criar DEAD_CODE_EXCEPTIONS.md

```markdown
# Exceções de Código Morto

Arquivos que ferramentas de detecção sinalizam mas NÃO devem ser removidos.

## Componentes shadcn/ui
| Arquivo | Justificativa | Data |
|---|---|---|
| `src/renderer/components/ui/lens.tsx` | Parte da lib shadcn/ui; não usado atualmente | 22/06/2026 |

## Scripts e Configurações
| Arquivo | Justificativa | Data |
|---|---|---|
| `vite.config.ts` | Config de build | 22/06/2026 |
| `vitest.config.ts` | Config de testes | 22/06/2026 |
| `tailwind.config.js` | Config de estilo | 22/06/2026 |
| `postcss.config.js` | Config de build | 22/06/2026 |
| `electron-builder.yml` | Config de empacotamento | 22/06/2026 |
| `scripts/copy-tinymce.mjs` | Script de build | 22/06/2026 |
| `scripts/fix-imports.mjs` | Script de build | 22/06/2026 |

## Dependências condicionais
| Dependência | Justificativa | Data |
|---|---|---|
| `electron-squirrel-startup` | Importado condicionalmente no main | 22/06/2026 |

## Binários CLI
| Binário | Justificativa | Data |
|---|---|---|
| `electron-builder` | CLI via npm scripts | 22/06/2026 |
```

### Passo 2.5 — Adicionar eslint-plugin-import (opcional, baixo custo)

```bash
npm install -D eslint-plugin-import
```

Adicionar ao `.eslintrc.json`:

```json
{
  "plugins": ["@typescript-eslint", "react", "react-hooks", "import"],
  "rules": {
    "import/no-unused-modules": ["warn", { "unusedExports": true }]
  }
}
```

> ⚠️ **Cuidado:** Esta regra pode gerar falsos positivos em barrels e exports usados por entry points. Testar antes de promover a `error`. Se gerar ruído excessivo, manter apenas como `warn` local.

---

## 🛤️ Estágio 3 — Caminho para o Knip

O plano completo do Knip está documentado em [knip_retira_codigo_morto.md](./02_plano_knip_futuro.md) e deve ser implementado **quando os pré-requisitos abaixo forem satisfeitos**:

### Pré-requisitos para o Knip

| # | Pré-requisito | Estado atual (22/06/2026) |
|---|---|---|
| 1 | Cobertura de testes ≥ 30% em fluxos críticos | ❌ ~1% |
| 2 | CI estabelecido (type-check + lint + test em PRs) | ❌ Inexistente |
| 3 | Cultura de qualidade consolidada | ⚠️ Em construção |
| 4 | > 400 fontes TypeScript | ❌ ~212 fontes |
| 5 | `verbatimModuleSyntax` ou `isolatedModules` habilitado | ❌ Não habilitado |

### O que fazer até lá

1. **Manter `ts-prune` rodando sob demanda** — a cada 1-2 sprints, rodar `/check-dead-code` para auditar
2. **Investir em testes** — prioridade #1 do projeto. Sem testes, qualquer ferramenta de qualidade é uma ilha
3. **Estabelecer CI** — GitHub Actions com `type-check` + `lint` + `test` é pré-requisito para qualquer gate automático
4. **Evoluir ESLint** — migrar para `eslint.config.js` (flat config) com TypeScript strict rules

### Transição para Knip

Quando os pré-requisitos estiverem satisfeitos:

1. Instalar Knip: `npm install -D knip`
2. Criar `knip.json` conforme especificado em [knip_retira_codigo_morto.md](./02_plano_knip_futuro.md)
3. Integrar ao `lint`: `"lint": "eslint . --ext .ts,.tsx && knip"`
4. Adicionar ao CI: workflow `lint.yml` com Knip
5. Remover `ts-prune` (substituído pelo Knip)
6. Manter `DEAD_CODE_EXCEPTIONS.md` e skill `/check-dead-code`

---

## ✅ Verificação

### Estágio 1 (após limpeza manual)

1. `npm run build` → sucesso (main + preload + renderer)
2. `npm run test` → 2 testes passando
3. `npm run type-check` → zero erros
4. `npm run lint` → ESLint zero erros

### Estágio 2 (após ts-prune + skill)

5. `npm run prune:all` → zero exports não usados (exceto exceções documentadas)
6. Skill `/check-dead-code` funcional em `.claude/skills/check-dead-code.md`
7. `DEAD_CODE_EXCEPTIONS.md` versionado na raiz

---

## 🔗 Referências

- **[knip_retira_codigo_morto.md](./02_plano_knip_futuro.md)** — Plano FUTURO completo do Knip (com CI gate, multi-tsconfig, regras)
- [ts-prune — GitHub](https://github.com/nadeesha/ts-prune)
- [eslint-plugin-import — no-unused-modules](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-unused-modules.md)
- Skill: `check-dead-code` (`.claude/skills/check-dead-code.md`)
- Spec: RepStepper em `spec/02 rep/steps_preenchimento_form.md`
