# 🔍 Plano: Detecção Automática de Código Morto com Knip

> **Última atualização:** 20/06/2026
>
> **Motivação:** O componente `RepStepper.tsx` foi descoberto como código morto (criado como wrapper opcional mas nunca importado) e posteriormente refatorado em componente principal com contexto, IntersectionObserver e children — transformando o órfão em peça central do stepper. Este documento propõe uma solução dupla — ferramenta automatizada + skill — para evitar que código morto se acumule.

---

## 📋 Sumário

1. [O Problema](#-o-problema)
2. [Solução Proposta](#-solução-proposta)
3. [Knip — Ferramenta de Dead-Code Detection](#-knip--ferramenta-de-dead-code-detection)
4. [Skill — Auditoria Sob Demanda](#-skill--auditoria-sob-demanda)
5. [Comparação Skill vs Knip](#-comparação-skill-vs-knip)
6. [Plano de Execução](#-plano-de-execução)
7. [Verificação](#-verificação)

---

## 🔥 O Problema

O projeto tinha um componente (`RepStepper.tsx`) **completamente funcional, bem escrito e documentado** que nunca foi importado por nenhum arquivo do sistema. Nenhuma ferramenta existente detectou isso:

| Ferramenta | Detecta? | Por quê? |
|---|---|---|
| ESLint `no-unused-vars` | ❌ | Só escopa arquivo local — variável exportada nunca é "unused" dentro do próprio arquivo |
| TypeScript `noUnusedLocals` | ❌ | Mesma limitação — não analisa grafo de dependências |
| Prettier | ❌ | Formatação apenas |
| Testes | ❌ | Sem teste para `RepStepper` |

**Custo do código morto:**
- Manutenção desnecessária (renomeações, refactors, migrações)
- Falsa sensação de cobertura
- Ruído cognitivo para novos devs
- Aumento no bundle (mínimo, mas existe)

---

## ✅ Solução Proposta

**Duas camadas complementares:**

1. **Knip** (ferramenta automatizada) — roda no lint/type-check, barra novos órfãos no fluxo diário
2. **Skill Claude Code** — auditoria sob demanda, com contexto semântico para decisões de remoção

---

## 🔧 Knip — Ferramenta de Dead-Code Detection

### O que é

[Knip](https://github.com/webpro/knip) é um ferramenta de análise estática que detecta:
- **Arquivos não importados** (como `RepStepper.tsx`)
- **Exportações não utilizadas**
- **Dependências npm não usadas**
- **DevDependencies não usadas**
- **Duplicatas no package.json**

Funciona com AST (não regex), entende path aliases do TypeScript, e funciona zero-config na maioria dos projetos.

### Por que Knip e não alternativas

| Ferramenta | Arquivos órfãos | Exports não usados | Deps npm | Path aliases | Manutenção |
|---|---|---|---|---|---|
| **Knip** | ✅ | ✅ | ✅ | ✅ nativo | Ativo (3k+ stars) |
| `ts-prune` | ❌ | ✅ | ❌ | ⚠️ via tsconfig | Baixa |
| `unimported` | ✅ | ❌ | ❌ | ⚠️ frágil | Baixa |
| `depcheck` | ❌ | ❌ | ✅ | ❌ | Moderada |

### Funcionamento no projeto

```bash
# Instalação
npm install -D knip

# Uso básico
npx knip

# Exemplo de saída para RepStepper:
# ❌ src/renderer/components/rep/RepStepper.tsx → unused file
# ❌ src/renderer/components/rep/RepStepper.tsx → RepStepper (unused exported)
```

### Configuração necessária

O projeto usa path aliases (`@/*`, `@shared/*`, `@main/*`, `@preload/*`) com múltiplos `tsconfig.json`. O Knip lida bem com isso, mas precisa de configuração para:

1. **Entry points** — indicar quais arquivos são pontos de entrada (Vite, Electron main, preload)
2. **Ignorar falsos positivos** esperados (ex: `vite-env.d.ts`, `scripts/`, `*.config.*`)
3. **Projetos TypeScript separados** — mapear `tsconfig.renderer.json`, `tsconfig.main.json`, `tsconfig.preload.json`

**Configuração recomendada (`knip.json` ou `knip.config.ts`):**

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": [
    "src/main/main.ts",
    "src/preload/preload.ts",
    "src/renderer/main.tsx"
  ],
  "project": [
    "src/**/*.{ts,tsx}",
    "!src/renderer/public/**",
    "!src/renderer/components/ui/**",
    "!*.{js,mjs,ts}",
    "!scripts/**",
    "!vite.config.ts",
    "!vitest.config.ts",
    "!tailwind.config.js",
    "!postcss.config.js",
    "!electron-builder.yml"
  ],
  "ignoreDependencies": [
    "@electron-toolkit/preload",
    "@electron-toolkit/utils"
  ]
}
```

> **Nota sobre `src/renderer/components/ui/`:** Componentes shadcn/ui são gerados e registrados dinamicamente. Knip vai acusá-los como não usados se algum não estiver sendo importado. Como é um falso positivo conhecido do shadcn, vale ignorar o diretório ou revisar manualmente.

### Integração no fluxo

Adicionar ao script `lint` no `package.json`:

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx && knip",
    "knip": "knip"
  }
}
```

Futuramente, com CI configurado, o Knip pode bloquear PRs que introduzam código morto.

---

## 🎯 Skill — Auditoria Sob Demanda

### Quando usar

- Investigar um diretório específico
- Auditar antes de uma release (complementar ao Knip)
- Decidir se um arquivo apontado pelo Knip pode ser removido (contexto semântico)

### Definição da skill

```yaml
# .claude/skills/check-dead-code.md
---
name: check-dead-code
description: "Analisa código morto no projeto e sugere remoções"
---

Execute as seguintes etapas:
1. Rode `npx knip --no-exit-code` para obter o relatório de código morto
2. Para cada arquivo sinalizado como "unused file":
   a. Leia o arquivo para entender o que ele contém
   b. Busque por possíveis referências indiretas (imports dinâmicos, barrel re-exports, registros em registry)
   c. Determine se pode ser removido ou se é falso positivo
3. Agrupe os resultados por ação:
   - ✅ Pode remover com segurança
   - ⚠️ Requer verificação manual (suspeito de falso positivo)
   - ❌ Falso positivo confirmado (justificar)
4. Se solicitado, remova os arquivos seguros e documente em spec/
5. Relatório final com resumo do que foi removido, ignorado ou precisa de ação manual
```

### Como invocar

```
/check-dead-code
/check-dead-code --dir src/renderer/components/rep   # escopo específico
/check-dead-code --fix                                 # remove arquivos seguros e commita
```

---

## ⚖️ Comparação Skill vs Knip

| Aspecto | Knip | Skill (`/check-dead-code`) |
|---|---|---|
| **Detecção** | ✅ Automática via AST | ✅ Contextual via grep + leitura |
| **Decisão de remoção** | ❌ Só sinaliza | ✅ Decide se pode remover |
| **Frequência** | A cada `npm run lint` | Quando invocada |
| **Falso positivo** | Pode ter (shadcn/ui, configs) | Mínimo (analisa contexto) |
| **Dependência** | +1 devDependency | Zero |
| **Prevenção** | ✅ Bloqueia antes de commitar | ❌ Só detecta, não previne |

**Knip previne; a skill decide.** As duas se complementam.

---

## 📝 Plano de Execução

### Fase 1 — Instalação e Configuração

- [ ] Instalar `knip` como devDependency
- [ ] Criar `knip.json` com entry points e exclusões
- [ ] Adicionar script `"knip": "knip"` no `package.json`
- [ ] Adicionar `knip` ao script `lint` (após ESLint)
- [ ] Criar skill `check-dead-code` em `.claude/skills/`

### Fase 2 — Auditoria Inicial (com a skill)

- [ ] Rodar `knip` pela primeira vez
- [ ] Auditar cada sinalização com a skill:
  - `RepStepper.tsx` → ~~remover~~ refatorado em componente principal (ver `spec/02 rep/steps_preenchimento_form.md`)
  - Possíveis órfãos em `components/ui/` (falsos positivos do shadcn)
  - Dependências não usadas no `package.json`
- [ ] Executar remoções seguras (arquivos, imports, dependências)
- [ ] Registrar exceções legítimas no `knip.json`

### Fase 3 — Verificação

- [ ] Rodar `npm run build` (sem erros após remoções)
- [ ] Rodar `npm run test` (testes passando)
- [ ] Rodar `npm run type-check` (sem erros de tipo)
- [ ] Verificar funcionalidades afetadas (REP form, stepper) manualmente

### Fase 4 — Preventivo

- [ ] `knip` roda em todo `npm run lint` (prevenção automática)
- [ ] Skill documentada em `AGENTS.md` ou `CLAUDE.md`
- [ ] [Futuro] CI com Knip bloqueando PRs que introduzam código morto

---

## ✅ Verificação

1. **Build**: `npm run build` → sucesso
2. **Lint**: `npm run lint` → inclui Knip, zero erros
3. **Testes**: `npm run test` → green
4. **Validação semântica:** `RepStepper.tsx` refatorado em componente principal → formulário de REP usa `<RepStepper>` diretamente, funcionalidade preservada
5. **Knip limpo:** `npx knip` → sem sinalizações inesperadas (exclusões justificadas no config)

---

## 🔗 Referências

- [Knip — Documentação Oficial](https://knip.dev/)
- [Skill: check-dead-code](#-skill--auditoria-sob-demanda)
- [Spec: RepStepper — código morto confirmado](./spec/../02%20rep/steps_preenchimento_form.md) (seção: "Wrapper opcional — Não usado diretamente")
