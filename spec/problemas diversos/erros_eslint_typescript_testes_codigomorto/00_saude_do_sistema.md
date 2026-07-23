# Painel de Saúde do Sistema

> **Última consolidação:** 23/07/2026
> **Propósito:** registrar o estado atual de build, tipagem, lint, testes, cobertura e auditoria de código morto.
> **Escopo da medição:** validação completa após limpeza de lint e de superfície interna sem consumidor, seguida de smoke manual sem erros observados.

---

## Resumo Executivo

| Métrica | Status | Resultado atual |
|---|---|---|
| **Build** (`npm run build`) | ✅ OK | main, preload e renderer compilam; permanece apenas o aviso de chunks grandes do Vite. |
| **TypeScript** (`npm run type-check`) | ✅ OK | 0 erros em main, preload e renderer. |
| **ESLint** (`npm run lint`) | ✅ OK | 0 erros e 0 warnings. |
| **Testes** (`npm test`) | ✅ OK | 199 pass, 1 skip em 34 arquivos. |
| **Cobertura** (`npm run test:coverage`) | ✅ OK com gate progressivo | statements 57,85%; branches 48,12%; funções 64,47%; linhas 59,9%. |
| **Código morto** (`npm run prune:all`) | 🟡 Triado | renderer sem candidatos reais; apontamentos do main são falsos positivos conhecidos do `ts-prune` com NodeNext/imports `.js`. |
| **Knip** (`npm run knip -- --no-exit-code`) | ✅ Observacional zerado | 0 dependências, devDependencies, exports, tipos e duplicatas apontados. |
| **Dependências** (`npm audit`) | 🟡 Pendente de avaliação | 2 vulnerabilidades altas; nenhuma correção forçada foi aplicada. |

Leitura prática: a aplicação está apta aos gates locais de código e passou no smoke manual. A cobertura permanece acima dos thresholds progressivos (`50%` statements, `35%` branches, `60%` funções e `50%` linhas), e Knip continua observacional para evitar bloquear o fluxo por classificação inadequada.

---

## Fontes de verdade e gates

| Frente | Fonte canônica | Comando de verificação |
|---|---|---|
| Scripts e dependências | `package.json` e `package-lock.json` | comandos npm abaixo |
| Tipagem | `tsconfig*.json` | `npm run type-check` |
| Lint | configuração ESLint | `npm run lint` |
| Testes e cobertura | `vitest.config.ts` e `src/__tests__/` | `npm test`, `npm run test:coverage` |
| Código morto | `tsconfig*.json`, `knip.json` e `DEAD_CODE_EXCEPTIONS.md` | `npm run prune:all`, `npm run knip -- --no-exit-code` |

O CI em `.github/workflows/ci.yml` executa `type-check`, `lint` e `test:coverage` com Node.js 24. Knip permanece manual/observacional; `ts-prune` exige triagem qualitativa dos itens do main antes de qualquer remoção.

---

## Medição de 23/07/2026

```bash
npm run type-check
npm run lint
npm test
npm run test:coverage
npm run prune:all
npm run knip -- --no-exit-code
npm run build
```

| Data | Build | TypeScript | ESLint | Testes | Cobertura | Knip |
|---|---|---|---|---|---|---|
| 19/07/2026 | — | 0 erros | 0 / 0 | 148 pass, 1 skip em 23 arquivos | medição anterior preservada | zerado |
| **23/07/2026** | ✅ | 0 erros | 0 / 0 | **199 pass, 1 skip em 34 arquivos** | **57,85 / 48,12 / 64,47 / 59,9%** | **zerado** |

A sequência da cobertura é statements, branches, funções e linhas. O build precisou rodar fora do sandbox, pois Vite/Tailwind requerem o binário nativo do `@tailwindcss/oxide`; fora do isolamento, ele concluiu normalmente.

---

## Estado das frentes

### Lint e tipos

A frente está zerada. Capturas de exceção sem consumo foram simplificadas, contratos que existiam apenas para inferência de tipos foram declarados explicitamente e exports internos sem consumidores foram recolhidos. Essas alterações não mudam contratos IPC nem comportamento funcional.

### Testes e cobertura

A suíte atual cobre integrações GDL/B-602, persistência, componentes do renderer, utilitários, serviços e catálogos. O gate progressivo continua adequado ao estado atual; elevar thresholds exige ampliação deliberada da cobertura, não apenas alteração de configuração.

### Código morto

O Knip não reporta itens. O `ts-prune` ainda apresenta itens do main que devem ser mantidos: são afetados por resolução NodeNext e imports relativos com extensão `.js`. A lista e a justificativa canônicas ficam em `DEAD_CODE_EXCEPTIONS.md`; não remover um item apenas pelo relatório.

### Build, smoke e dependências

O build completo está verde e o smoke manual posterior não observou erros. O Vite alerta sobre chunks acima de 500 kB após minificação; é uma limitação de tamanho conhecida, não bloqueante.

`npm audit` reporta 2 vulnerabilidades altas. Como a recomendação automática envolve `--force`, a atualização requer uma tranche própria com análise de impacto e nova validação completa.

---

## Regras de manutenção

- Após mudanças de código, executar `npm run type-check` e `npm run lint`; incluir `npm test` para mudanças de banco, IPC ou lógica.
- Para mudanças que afetam a suíte, executar também `npm run test:coverage`.
- Tratar `npm run prune:all` e Knip como auditorias: confirmar consumidores reais e exceções antes de remover código.
- Alterações em Electron, módulos nativos ou empacotamento exigem `npm run pack` e smoke no Windows quando aplicável.
- Atualizações de dependências com vulnerabilidades devem ser avaliadas isoladamente; não usar `npm audit fix --force` como correção automática.

## Referências

- `package.json`
- `vitest.config.ts`
- `.github/workflows/ci.yml`
- `knip.json`
- `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/DEAD_CODE_EXCEPTIONS.md`
