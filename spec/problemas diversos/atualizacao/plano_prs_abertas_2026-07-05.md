# Plano para Solucionar PRs Abertas

> **Data de referência:** 05/07/2026
> **Escopo:** PRs abertas do GitHub encontradas em `issjunior/laWdo`
> **Objetivo:** tratar as PRs sem misturar upgrade seguro de infraestrutura com migrações grandes de runtime/toolchain.

---

## Estado atual

Há 3 PRs abertas:

1. `#3` `Bump the github-actions-versoes group with 2 updates`
2. `#4` `Bump the npm-producao group with 31 updates`
3. `#5` `Bump the npm-desenvolvimento group with 17 updates`

Leitura prática:

- `#3` está verde e mexe só em workflow GitHub Actions.
- `#4` falha em `type-check`.
- `#5` falha já em `npm ci`.

---

## Diagnóstico resumido por PR

### PR #3 — GitHub Actions

Status atual:

- CI verde
- alteração isolada de infraestrutura
- baixo risco funcional na aplicação

Conclusão:

- candidata a merge rápido, separada das demais

### PR #4 — Dependências de produção

Falhas objetivas já observadas:

- `src/renderer/components/layout/Header.tsx`
  - `lucide-react` não exporta mais `Github`
- `src/renderer/components/rep/GdlConsultaModal.tsx`
- `src/renderer/pages/REPsPage.tsx`
- `src/renderer/pages/SolicitantesPage.tsx`
- `src/renderer/pages/TemplatesPage.tsx`
  - uso de `ZodError.errors`, incompatível com o upgrade aplicado

Risco estrutural:

- a PR agrupa muitos majors ao mesmo tempo
- inclui upgrades de alto impacto como `React 19`, `Electron 43`, `Zod 4`, `lucide-react 1`, `sqlite3 6`, `bcrypt 6`
- mesmo corrigindo os erros atuais de TypeScript, ainda pode haver regressões de runtime, build, preload, binários nativos e testes

Conclusão:

- não deve ser tratada como PR de merge direto
- precisa ser quebrada em lotes menores

### PR #5 — Dependências de desenvolvimento

Falha objetiva já observada:

- `npm ci` quebra por conflito entre `eslint@10.6.0` e `eslint-plugin-react@7.37.5`

Risco estrutural:

- também agrupa vários majors ao mesmo tempo
- inclui `ESLint 10`, `TypeScript 6`, `Vite 8`, `Tailwind 4`, `concurrently 10`, `typescript-eslint 8`
- parte dessas mudanças exige revisão de config e compatibilidade entre plugins, não apenas bump de versão

Conclusão:

- não deve ser corrigida “por cima” da PR agrupada
- precisa virar migração de toolchain em etapas

---

## Estratégia recomendada

### Etapa 1 — Resolver a PR segura primeiro

Executar:

1. revisar diff da `#3`
2. confirmar que só altera `.github/workflows/**`
3. fazer merge da `#3`

Resultado esperado:

- manter CI atualizada sem contaminar a análise das PRs grandes

### Etapa 2 — Não insistir em merge das PRs agrupadas `#4` e `#5`

Decisão recomendada:

- evitar corrigir as duas PRs enormes diretamente
- fechar, substituir ou recriar em lotes menores

Motivo:

- quando a PR mistura dezenas de pacotes com majors, o custo de triagem explode
- qualquer regressão fica sem isolamento causal

### Etapa 3 — Separar a frente de atualização em lotes

Lotes sugeridos:

1. **Infraestrutura CI**
   - PR `#3`
2. **Correções compatíveis de baixo impacto**
   - patches/minors sem mudança de contrato
3. **Bibliotecas com quebra conhecida e localizada**
   - `lucide-react`
   - `zod`
4. **Toolchain do frontend/dev**
   - `eslint`
   - `@typescript-eslint/*`
   - `typescript`
   - `vite`
   - `@vitejs/plugin-react`
5. **UI/runtime React**
   - `react`
   - `react-dom`
   - libs Radix que dependem do comportamento novo
6. **Plataforma Electron e nativos**
   - `electron`
   - `electron-builder`
   - `sqlite3`
   - `bcrypt`

---

## Plano operacional

## Frente A — Merge da PR #3

Passos:

1. validar diff final da PR
2. confirmar que o workflow continua usando Node 24 e cache `npm`
3. fazer merge

Validação mínima:

- observar check verde da própria PR

## Frente B — Curadoria da PR #4 em branch própria

Meta:

- reproduzir localmente as quebras de compatibilidade reais
- corrigir primeiro o que já está explicitamente quebrado

Primeiros ajustes previstos:

1. trocar `Github` por `GitHub` em `Header.tsx`
2. migrar todos os acessos de `error.errors` para a API atual do Zod
3. revisar pontos com inferência frágil nas páginas:
   - `REPsPage.tsx`
   - `SolicitantesPage.tsx`
   - `TemplatesPage.tsx`
   - `GdlConsultaModal.tsx`

Validação obrigatória após essa tranche:

1. `npm run type-check`
2. `npm run lint`
3. `npm test`

Decisão após a tranche:

- se a branch ainda acumular regressões vindas de `React 19`, `Electron 43`, `sqlite3 6` ou `bcrypt 6`, separar esses upgrades em PRs próprias

## Frente C — Curadoria da PR #5 em branch própria

Meta:

- estabilizar a toolchain antes de qualquer tentativa de merge

Primeiro bloqueio a resolver:

1. alinhar `eslint` com o ecossistema instalado

Abordagem recomendada:

1. decidir entre:
   - manter `eslint` em versão compatível com `eslint-plugin-react`
   - ou atualizar todo o conjunto de plugins para uma combinação suportada
2. só depois revisar:
   - `typescript`
   - `typescript-eslint`
   - `vite`
   - `@vitejs/plugin-react`
   - `tailwindcss`

Validação obrigatória por tranche:

1. `npm ci`
2. `npm run type-check`
3. `npm run lint`
4. `npm test`
5. `npm run build`

---

## Ordem recomendada de execução

1. mergear `#3`
2. abrir branch curada para produção baseada na `#4`, mas sem carregar automaticamente todos os majors de uma vez
3. estabilizar os erros de `lucide-react` e `zod`
4. validar build, lint, testes e tipagem
5. só então iniciar a frente de toolchain da `#5`
6. deixar `Electron`, `sqlite3` e `bcrypt` por último

---

## Critérios de aceite

Uma tranche de atualização só deve ser considerada pronta quando:

- `npm ci` passa
- `npm run type-check` passa
- `npm run lint` passa
- `npm test` passa
- `npm run build` passa quando a tranche toca build/toolchain/runtime
- a causa da regressão fica isolada a um conjunto pequeno de dependências

---

## Decisão recomendada agora

Decisão prática para a próxima execução:

1. tratar `#3` como merge rápido
2. transformar `#4` em frente curada de compatibilidade
3. transformar `#5` em frente separada de toolchain
4. evitar merge de PR agrupada do Dependabot quando houver vários majors misturados

