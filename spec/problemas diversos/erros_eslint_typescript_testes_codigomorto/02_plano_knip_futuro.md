# 🔍 Plano: Detecção Automática de Código Morto com Knip

> **Última atualização:** 22/06/2026
>
> **Status:** 🟡 **PLANO FUTURO** — implementação adiada até que pré-requisitos de maturidade do projeto sejam alcançados. Ver [Abordagem Leve (implementação imediata)](./01_abordagem_leve_pre_knip.md) para o plano em execução agora.
>
> **Motivação:** O componente `RepStepper.tsx` foi descoberto como código morto (criado como wrapper opcional mas nunca importado) e posteriormente refatorado em componente principal com contexto, IntersectionObserver e children — transformando o órfão em peça central do stepper. Este documento propõe uma solução dupla — ferramenta automatizada + skill — para evitar que código morto se acumule. A implementação desta solução depende de pré-requisitos de maturidade do projeto (testes, CI) que ainda não foram alcançados.

---

## 📋 Sumário

1. [Pré-Requisitos para Implementação](#-pré-requisitos-para-implementação)
2. [Referências Cruzadas](#-referências-cruzadas)
3. [O Problema](#-o-problema)
4. [Solução Proposta](#-solução-proposta)
5. [Knip — Ferramenta de Dead-Code Detection](#-knip--ferramenta-de-dead-code-detection)
6. [Skill — Auditoria Sob Demanda](#-skill--auditoria-sob-demanda)
7. [Comparação Skill vs Knip](#-comparação-skill-vs-knip)
8. [Plano de Execução](#-plano-de-execução)
9. [Verificação](#-verificação)
10. [Exceções Documentadas](#-exceções-documentadas)

---

## 🛑 Pré-Requisitos para Implementação

**Este plano só deve ser implementado quando as condições abaixo forem satisfeitas.** O Knip é uma ferramenta poderosa, mas introduzi-la em um projeto sem a devida maturidade de qualidade gera mais riscos que benefícios.

### Condições obrigatórias

| # | Pré-requisito | Por quê? | Como medir |
|---|---|---|---|
| 1 | **Cobertura de testes ≥ 30%** em fluxos críticos | Sem testes, remover código baseado em análise estática é arriscado — imports dinâmicos (`lazy()`, `require()` condicional) podem não ser detectados | `npm run test:coverage` |
| 2 | **CI estabelecido** rodando `type-check` + `lint` + `test` em push/PR | Knip será integrado ao `lint`; se não há CI, não há bloqueio real de código morto | Workflow GitHub Actions funcional |
| 3 | **Cultura de qualidade estabelecida** na equipe | O `DEAD_CODE_EXCEPTIONS.md` exige disciplina de manutenção; falsos positivos precisam ser analisados, não ignorados | PRs revisados com atenção a imports/exports |

### Condições desejáveis

| # | Pré-requisito | Por quê? |
|---|---|---|
| 4 | **Projeto com > 400 fontes** TypeScript (hoje: ~212) | O custo de configurar Knip se dilui com a escala; em projetos menores, ts-prune + revisão manual são suficientes |
| 5 | **TypeScript `verbatimModuleSyntax`** ou `isolatedModules` habilitado | Força `import type` explícito, reduzindo falsos positivos de "export não usado" que na verdade é re-exportado |

### Estado atual dos pré-requisitos (22/06/2026)

| Pré-requisito | Estado |
|---|---|
| Cobertura de testes ≥ 30% | ❌ ~1% (2 testes: `button.test.tsx`, `user.schema.test.ts`) |
| CI estabelecido | ❌ Zero workflows GitHub Actions |
| Cultura de qualidade | ⚠️ Em construção — lint e type-check já existem localmente |
| > 400 fontes | ❌ ~212 fontes (excluindo vendor TinyMCE) |
| `verbatimModuleSyntax` | ❌ Não habilitado |

**Conclusão:** Nenhum pré-requisito está satisfeito. Enquanto isso, execute a [Abordagem Leve](./01_abordagem_leve_pre_knip.md).

---

## 🔗 Referências Cruzadas

- **[antes_kip_abordagem_leve.md](./01_abordagem_leve_pre_knip.md)** — Plano de implementação IMEDIATA: limpeza manual + ts-prune + skill `/check-dead-code`
- Este documento (`02_plano_knip_futuro.md`) — Plano FUTURO: Knip completo com CI gate, a ser implementado quando os pré-requisitos forem alcançados

---

## 🔥 O Problema

O projeto tinha um componente (`RepStepper.tsx`) **completamente funcional, bem escrito e documentado** que nunca foi importado por nenhum arquivo do sistema. Além dele, outros arquivos órfãos foram identificados:

| Arquivo órfão | Motivo |
|---|---|
| `src/renderer/routes/index.tsx` | `AppRoutes` nunca importado — `App.tsx` define rotas inline |
| `src/renderer/pages/index.ts` | Barrel de páginas nunca importado — `App.tsx` importa páginas diretamente via `lazy()` |
| `src/renderer/components/layout/Layout.tsx` | Componente `Layout` nunca importado — `App.tsx` declara Layout inline |
| `src/shared/types/database.ts` | `@shared/*` nunca importado por nenhum arquivo do projeto |
| `src/shared/types/logger.ts` | `LogModule` redefinido localmente em `main/utils/logger.ts`; `@shared/*` órfão |
| `src/shared/types/database.js` | Artefato compilado (`.js` gerado de `.ts`) — deveria estar no `.gitignore` |

**Total: 6 arquivos/diretórios órfãos confirmados** (22/06/2026). Isso sem contar ~10 imports não utilizados em `App.tsx` e `main/ipc/index.ts`.

Além disso, ~10 imports não utilizados foram encontrados em `App.tsx` (`useLocation`, `Dialog`+subcomponentes, `Tabs`+subcomponentes, `Badge`, `Info`, `Github`, `Mail`, `SidebarTrigger`) e `main/ipc/index.ts` (`auditLogout`).

Nenhuma ferramenta existente no projeto detecta isso:

| Ferramenta | Detecta? | Por quê? |
|---|---|---|
| ESLint `no-unused-vars` | ❌ | Só escopa arquivo local — variável exportada nunca é "unused" dentro do próprio arquivo |
| TypeScript `noUnusedLocals` | ❌ | Mesma limitação — não analisa grafo de dependências entre arquivos |
| Prettier | ❌ | Formatação apenas |
| Testes | ❌ | Sem cobertura para esses arquivos |
| `tsc --noEmit` | ❌ | Só verifica erros de tipo, não referências cruzadas |

**Custo do código morto:**
- Manutenção desnecessária (renomeações, refactors, migrações de libs)
- Falsa sensação de cobertura
- Ruído cognitivo para novos devs — "este arquivo serve para algo?"
- Aumento no bundle (mínimo, mas acumulativo)

---

## ✅ Solução Proposta

**Duas camadas complementares:**

1. **Knip** (ferramenta automatizada) — roda no lint, barra novos órfãos antes de entrar no repositório
2. **Skill Claude Code** (`/check-dead-code`) — auditoria sob demanda, com critérios de decisão e contexto semântico

**Knip previne; a skill decide.** As duas se complementam.

---

## 🔧 Knip — Ferramenta de Dead-Code Detection

### O que é

[Knip](https://github.com/webpro/knip) é uma ferramenta de análise estática que detecta:
- **Arquivos não importados** (como `Layout.tsx`, `routes/index.tsx`)
- **Exportações não utilizadas** (funções, tipos, constantes exportadas mas nunca referenciadas)
- **Dependências npm não usadas**
- **DevDependencies não usadas**
- **Duplicatas no package.json**

Trabalha com AST (não regex), entende path aliases do TypeScript, e suporta projetos com múltiplos tsconfigs — mas **requer configuração explícita** quando a estrutura foge do convencional.

### Por que Knip e não alternativas

| Ferramenta | Arquivos órfãos | Exports não usados | Deps npm | Path aliases | Múltiplos tsconfigs | Manutenção |
|---|---|---|---|---|---|---|
| **Knip** | ✅ | ✅ | ✅ | ✅ nativo | ✅ com config | Ativo (3k+ stars) |
| `ts-prune` | ❌ | ✅ | ❌ | ⚠️ via tsconfig | ❌ | Baixa |
| `unimported` | ✅ | ❌ | ❌ | ⚠️ frágil | ❌ | Baixa |
| `depcheck` | ❌ | ❌ | ✅ | ❌ | ❌ | Moderada |

### ⚠️ Por que este projeto NÃO é "zero-config"

Diferente de projetos simples (single tsconfig, entry point padrão), este projeto tem estrutura que exige configuração:

| Complexidade | Detalhe | Impacto |
|---|---|---|
| **4 tsconfigs** | `tsconfig.json` (base), `tsconfig.main.json`, `tsconfig.preload.json`, `tsconfig.renderer.json` (standalone) | Knip precisa mapear 3 projetos separados |
| **Module systems diferentes** | Main: NodeNext, Preload: CommonJS, Renderer: ESNext+Bundler | Knip precisa contexto de módulo correto |
| **Path aliases divergentes** | Base: `@shared/*, @main/*, @preload/*`; Renderer adiciona `@/*` | Knip precisa mapear aliases por projeto |
| **Entry points não-óbvios** | `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.tsx`, `src/renderer/index.html` | Knip não adivinha `index.ts` vs `main.ts` |
| **Electron multi-target** | 3 processos isolados que nunca se importam entre si | Cada target é projeto separado |

### Configuração

**`knip.json`** (raiz do projeto):

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": [
    "src/main/index.ts",
    "src/preload/index.ts",
    "src/renderer/index.tsx",
    "src/renderer/index.html"
  ],
  "project": [
    "src/main/**/*.ts",
    "src/preload/**/*.ts",
    "src/renderer/**/*.{ts,tsx}",
    "src/shared/**/*.ts",
    "src/types/**/*.ts"
  ],
  "ignore": [
    "src/renderer/public/**",
    "src/**/*.d.ts"
  ],
  "ignoreDependencies": [
    "electron-squirrel-startup"
  ],
  "ignoreBinaries": [
    "electron-builder"
  ],
  "rules": {
    "files": "error",
    "exports": "warn",
    "types": "warn",
    "dependencies": "error",
    "devDependencies": "error",
    "unlisted": "warn"
  },
  "typescript": {
    "config": [
      "tsconfig.main.json",
      "tsconfig.preload.json",
      "tsconfig.renderer.json"
    ]
  }
}
```

**Explicação:**

| Campo | Valor | Por quê |
|---|---|---|
| `entry` | 4 entradas | `index.ts` (main), `index.ts` (preload), `index.tsx` (renderer), `index.html` (Vite) |
| `project` | 5 globs | Cobre main, preload, renderer, shared, types |
| `ignore` | `public/**`, `.d.ts` | Assets estáticos e declarações de tipo |
| `ignoreDependencies` | `electron-squirrel-startup` | Importado condicionalmente (só produção empacotada) |
| `ignoreBinaries` | `electron-builder` | CLI executada via npm scripts, não importada em código |
| `rules` | files=error, exports=warn, deps=error | Órfãos e deps fantasmas quebram o lint; exports não-usados são warning |
| `typescript.config` | 3 tsconfigs | Knip usa os tsconfigs para resolver path aliases |

> 📌 **`src/renderer/components/ui/` NÃO foi excluído** — se alguém adicionar um componente custom nesse diretório e ele ficar órfão, o Knip precisa detectar. Componentes shadcn/ui não-usados serão documentados como exceções individuais no `DEAD_CODE_EXCEPTIONS.md`.

### Integração no fluxo

**Passo 1 — Script no `package.json`:**

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx && knip",
    "knip": "knip"
  }
}
```

**Passo 2 — [Futuro] GitHub Actions:** workflow `lint.yml` executando `npm run lint` em push/PR, bloqueando merge se falhar.

---

## 🎯 Skill — Auditoria Sob Demanda

### Quando usar

- Investigar um diretório específico em busca de código morto
- Auditar antes de uma release (complementar ao Knip, mais profundo)
- Decidir se um arquivo apontado pelo Knip pode ser removido com segurança
- Validar após remoções: confirmar que nada quebrou

### Critérios de decisão (6 pontos)

Antes de remover qualquer arquivo ou export, a skill aplica este checklist:

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
| 6 | Pode ser usado por plugin externo | Tinymce, Electron, webpack/rollup que carregam por convenção de nome |

**Regra de ouro:** Em caso de dúvida, **não remove**. Registra no `DEAD_CODE_EXCEPTIONS.md` como "suspeito — requer verificação manual".

### Definição da skill

```yaml
# .claude/skills/check-dead-code.md
---
name: check-dead-code
description: "Analisa código morto no projeto e sugere remoções seguras"
---

## Propósito

Auditar código morto usando Knip + verificação semântica.

## Fluxo principal

1. Rode `npx knip --no-exit-code` para obter o relatório
2. **Filtre apenas "unused files" primeiro** (arquivos inteiros órfãos — risco baixo)
3. Para cada arquivo sinalizado, aplique os **6 critérios de decisão**
4. Agrupe resultados:
   - ✅ Pode remover com segurança
   - ⚠️ Requer verificação manual
   - ❌ Falso positivo confirmado — justificar no `DEAD_CODE_EXCEPTIONS.md`
5. Execute remoções seguras (se `--fix`)

## Validação pós-remoção

- `npm run build` — sem erros
- `npm run test` — testes passando
- `npm run type-check` — sem erros de tipo
- `npx knip` — confirmar que órfão sumiu
- Testar fluxos críticos manualmente (REP form, stepper, login)

## Em iteração separada

Depois de unused files, repita o mesmo processo para "unused exports" (são mais numerosos)

## Subcomandos

- `/check-dead-code` — auditoria completa
- `/check-dead-code --dir src/renderer/components/rep` — escopo específico
- `/check-dead-code --files-only` — apenas unused files (primeira iteração)
- `/check-dead-code --exports-only` — apenas unused exports (segunda passada)
- `/check-dead-code --fix` — remove arquivos seguros e commita
```

---

## ⚖️ Comparação Skill vs Knip

| Aspecto | Knip | Skill (`/check-dead-code`) |
|---|---|---|
| **Detecção** | ✅ Automática via AST | ✅ Contextual via grep + leitura |
| **Decisão de remoção** | ❌ Só sinaliza | ✅ Decide com 6 critérios |
| **Frequência** | A cada `npm run lint` | Quando invocada |
| **Falso positivo** | Pode ter (shadcn/ui, configs, barrel re-exports) | Mínimo (analisa contexto) |
| **Dependência** | +1 devDependency (knip) | Zero |
| **Prevenção** | ✅ Bloqueia código morto (CI/lint) | ❌ Só detecta, não previne |
| **Validação pós-remoção** | ❌ | ✅ Build + test + type-check + smoke test |

---

## 📝 Plano de Execução

> ⚠️ **Este plano é para execução FUTURA.** Os pré-requisitos ([ver seção acima](#-pré-requisitos-para-implementação)) não foram alcançados ainda. Enquanto isso, siga a [Abordagem Leve](./01_abordagem_leve_pre_knip.md).

### Fase 1 — Instalação e Configuração

- [ ] **1.1** Instalar `knip`: `npm install -D knip`
- [ ] **1.2** Criar `knip.json` com entry points, 3 tsconfigs e regras
- [ ] **1.3** Validar: `npx knip --debug` — conferir se path aliases estão resolvendo
- [ ] **1.4** Testar se todos os imports são detectados nos 3 targets
- [ ] **1.5** Adicionar script `"knip": "knip"` no `package.json`
- [ ] **1.6** Adicionar `knip` ao script `lint`
- [ ] **1.7** Criar skill `check-dead-code` em `.claude/skills/`

### Fase 2 — Auditoria Inicial

**Iteração 2A — Unused files primeiro (risco baixo):**

- [ ] **2A.1** Rodar `npx knip` — esperado ~10-30 sinais
- [ ] **2A.2** Filtrar apenas "unused files" (ignorar exports)
- [ ] **2A.3** Para cada arquivo, aplicar os 6 critérios de decisão
- [ ] **2A.4** Executar remoções seguras
- [ ] **2A.5** Criar `DEAD_CODE_EXCEPTIONS.md` com falsos positivos e justificativas

**Iteração 2B — Unused exports (mais numeroso):**

- [ ] **2B.1** Rodar `npx knip` após remoções
- [ ] **2B.2** Auditar exports por lote (agrupar por diretório)
- [ ] **2B.3** Remover confirmados; registrar exceções

**Iteração 2C — Dependencies:**

- [ ] **2C.1** Auditar dependências sinalizadas
- [ ] **2C.2** Verificar se são usadas em scripts (não detectado por análise estática)
- [ ] **2C.3** Remover confirmadas do `package.json`

### Fase 3 — Verificação Pós-Remoção

Validar incrementalmente a cada remoção:

- [ ] **3.1** `npm run build` — sucesso
- [ ] **3.2** `npm run test` — passando
- [ ] **3.3** `npm run type-check` — zero erros
- [ ] **3.4** `npx knip` — sem novos sinais inesperados
- [ ] **3.5** Grep para confirmar que nenhum componente removido tem uso dinâmico (import via string, lazy, registry)
- [ ] **3.6** Smoke test manual: login, formulário REP com stepper, navegação sidebar, editor laudo, painel ilustrações

### Fase 4 — Preventivo

- [ ] **4.1** `npm run lint` roda Knip + ESLint antes de cada commit manualmente
- [ ] **4.2** Skill `check-dead-code` documentada em `AGENTS.md` ou `CLAUDE.md`
- [ ] **4.3** `DEAD_CODE_EXCEPTIONS.md` versionado — novas exceções revisadas em PR

---

## ✅ Verificação

1. **Build**: `npm run build` → sucesso (main + preload + renderer)
2. **Lint**: `npm run lint` → ESLint zero erros + Knip zero erros
3. **Testes**: `npm run test` → todos passando
4. **Type-check**: `npm run type-check` → zero erros
5. **Knip limpo**: `npx knip` → só exceções conhecidas e documentadas
6. **Validação semântica**: Arquivos removidos não têm referência dinâmica; fluxos críticos funcionam

---

## 📄 Exceções Documentadas

`DEAD_CODE_EXCEPTIONS.md` (raiz do projeto). Conteúdo inicial esperado:

```markdown
# Exceções de Código Morto

Arquivos que o Knip sinaliza mas NÃO devem ser removidos.

## Componentes shadcn/ui
| Arquivo | Justificativa | Data |
|---|---|---|
| `src/renderer/components/ui/lens.tsx` | Parte da lib shadcn/ui; não usado atualmente | 21/06/2026 |

## Scripts e Configurações
| Arquivo | Justificativa | Data |
|---|---|---|
| `vite.config.ts` | Config de build | 21/06/2026 |
| `vitest.config.ts` | Config de testes | 21/06/2026 |
| `tailwind.config.js` | Config de estilo | 21/06/2026 |
| `postcss.config.js` | Config de build | 21/06/2026 |
| `electron-builder.yml` | Config de empacotamento | 21/06/2026 |
| `scripts/copy-tinymce.mjs` | Script de build | 21/06/2026 |
| `scripts/fix-imports.mjs` | Script de build | 21/06/2026 |

## Dependências condicionais
| Dependência | Justificativa | Data |
|---|---|---|
| `electron-squirrel-startup` | Importado condicionalmente no main | 21/06/2026 |

## Binários CLI
| Binário | Justificativa | Data |
|---|---|---|
| `electron-builder` | CLI via npm scripts | 21/06/2026 |
```

---

## 🔗 Referências

- **[antes_kip_abordagem_leve.md](./01_abordagem_leve_pre_knip.md)** — Plano IMEDIATO: limpeza manual + ts-prune + skill `/check-dead-code`
- [Knip — Documentação Oficial](https://knip.dev/)
- [Knip — Configuração com múltiplos tsconfigs](https://knip.dev/reference/configuration#typescript)
- Skill: `check-dead-code` (`.claude/skills/check-dead-code.md`)
- Spec: RepStepper em `spec/02 rep/steps_preenchimento_form.md`
