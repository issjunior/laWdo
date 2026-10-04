# Painel de Saúde do Sistema

> **Última consolidação:** 02/10/2026
> **Propósito:** registrar o estado atual de ambiente, build, tipagem, lint, testes, cobertura e auditoria de código morto.
> **Escopo da medição:** instalação limpa e sequência completa de gates, incluindo release, schema, empacotamento e smoke isolado no Windows.

---

## Resumo executivo

| Métrica | Status | Resultado atual |
|---|---|---|
| **Ambiente** | ✅ Reprodutível | Node.js 24.21.0 e npm 11.17.0; instalação por `npm ci --strict-allow-scripts`. |
| **Build** (`npm run build`) | ✅ OK | main, preload e renderer compilam; nenhum chunk supera 500 kB. |
| **TypeScript** (`npm run type-check`) | ✅ OK | 0 erros em main, preload e renderer. |
| **ESLint** (`npm run lint`) | ✅ OK | 0 erros e 0 warnings. |
| **Testes** (`npm test`) | ✅ OK | 555 pass, 2 skip em 109 arquivos. |
| **Cobertura** (`npm run test:coverage`) | ✅ Acima do gate | statements 62,02%; branches 54,50%; funções 63,22%; linhas 64,93%. |
| **Release e schema** | ✅ OK | 14 testes de release aprovados; smoke do schema concluído na versão 36. |
| **Código morto** | ✅ Knip zerado | Knip sem achados; `ts-prune` permanece auxiliar e requer triagem qualitativa. |
| **Dependências** | ✅ OK | árvore de primeiro nível válida e auditoria npm com 0 vulnerabilidades. |
| **Pacote Windows** | ✅ OK | `npm run pack` e smoke do executável em perfil isolado aprovados. |

Leitura prática: os gates locais estão verdes e o ambiente de desenvolvimento/CI está alinhado. Knip continua manual e observacional; não integra o gate de CI. O `ts-prune` ainda lista exports internos e contratos usados em módulo ou afetados por NodeNext, portanto seu relatório não autoriza remoção automática.

---

## Fontes de verdade e gates

| Frente | Fonte canônica | Verificação |
|---|---|---|
| Runtime e scripts autorizados | `package.json`, `package-lock.json` e `.nvmrc` | `node --version`, `npm --version`, `npm ci --strict-allow-scripts` |
| CI e release | `.github/workflows/*.yml` | CI e `npm run test:release` |
| Tipagem | `tsconfig*.json` | `npm run type-check` |
| Lint | `eslint.config.js` | `npm run lint` |
| Testes e cobertura | `vitest.config.ts` e `src/__tests__/` | `npm test`, `npm run test:coverage` |
| Código morto | `knip.json`, `tsconfig*.json` e `DEAD_CODE_EXCEPTIONS.md` | `npm run knip`, `npm run dead-code:check` |
| Distribuição | `electron-builder.yml` | `npm run build`, `npm run smoke:schema`, `npm run pack` e smoke Windows |

O CI fixa Node.js 24.21.0 e instala com `npm ci --strict-allow-scripts`. `package.json` exige Node `>=24.21.0 <25` e npm `>=11.17.0 <12`. Scripts de instalação estão autorizados por pacote e versão: `sqlite3@6.0.1`, `bcrypt@6.0.0` e `electron-winstaller@5.4.0`; `fsevents@2.3.3` é explicitamente negado por ser opcional e incompatível com Windows.

---

## Medição vigente

Executar na ordem:

```bash
npm ci --strict-allow-scripts
npm ls --depth=0
npm run type-check
npm run lint
npm test
npm run test:coverage
npm run test:release
npm run build
npm run knip
npm run dead-code:check
npm run smoke:schema
npm run pack
git diff --check
```

| Data | Build | Tipos | Lint | Testes | Cobertura S/B/F/L | Knip |
|---|---|---|---|---|---|---|
| 23/07/2026 | ✅ com aviso de chunk | 0 erros | 0 / 0 | 199 pass, 1 skip | 57,85 / 48,12 / 64,47 / 59,90% | zerado |
| **02/10/2026** | ✅ sem chunk > 500 kB | 0 erros | 0 / 0 | **555 pass, 2 skip** | **62,02 / 54,50 / 63,22 / 64,93%** | **zerado** |

## Estado das frentes

### Bundle e desempenho

Imports curinga de `lucide-react` foram substituídos por um registro tipado de imports estáticos. O antigo chunk de aproximadamente 731 kB deixou de existir; o chunk `icones-categoria` mede 35,07 kB e o maior chunk atual mede 407,82 kB. Nomes de ícones continuam persistidos como string, com alias para nome legado e fallback explícito.

Não houve captura comparável do diagnóstico assistido porque o servidor estava sem sessão `dev:diagnostico` ativa. A redução de bundle está comprovada pelo build, mas não implica ganho presumido de tempo de abertura.

### Testes e cobertura

A suíte cobre as políticas de navegação Electron, preservação de senha, parsing seguro da sessão, resolução de ícones e recuperação do `ErrorBoundary`. Os thresholds progressivos continuam em `vitest.config.ts`; a medição vigente permanece acima deles.

Os testes que invocam LibreOffice e fluxos grandes de REP possuem timeout local maior para absorver a instrumentação V8, sem alterar as asserções funcionais.

### Código morto

`src/main/diagnostico-mcp.ts` é entry point externo declarado no Knip, e CSS do renderer integra seu escopo. O resultado do Knip está zerado após remoção de implementações sem consumidor, exports indevidos e aliases de UI ociosos.

O `ts-prune` continua produzindo falsos positivos para NodeNext, exports públicos e símbolos usados no próprio módulo. As exceções duradouras devem permanecer justificadas em `DEAD_CODE_EXCEPTIONS.md`.

### Dependências e empacotamento

`jszip` é dependência direta de desenvolvimento porque os testes a importam diretamente. A instalação limpa encontra 0 vulnerabilidades. O pacote Windows reconstrói `bcrypt` e `sqlite3`, conclui a integridade do ASAR e permanece aberto no smoke com perfil de usuário isolado.

## Regras de manutenção

- Manter `.nvmrc`, `package.json` e todos os workflows alinhados na versão exata de Node.
- Instalar em CI e validações reprodutíveis com `npm ci --strict-allow-scripts`; revisar qualquer novo lifecycle script antes de autorizá-lo.
- Executar `type-check` e `lint` após código; incluir testes para banco, IPC ou lógica e cobertura quando a suíte mudar.
- Tratar Knip e `ts-prune` como auditorias manuais; confirmar entry points e consumidores reais antes de remover símbolos.
- Para Electron, módulos nativos ou empacotamento, executar `pack`, smoke de schema e smoke do executável no Windows.
- Não elevar o limite de chunk para ocultar regressões; investigar importação e divisão de código.
- Não usar `npm audit fix --force` como correção automática.

## Referências

- `package.json`
- `.nvmrc`
- `vitest.config.ts`
- `knip.json`
- `.github/workflows/ci.yml`
- `spec/15 seguranca/seguranca_electron.md`
- `spec/11 github actions/workflows_github_actions.md`
- `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/DEAD_CODE_EXCEPTIONS.md`
