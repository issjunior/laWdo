# Auditoria Knip Observacional - 03/07/2026

> **Status:** linha de base registrada e frente observacional concluida com
> relatorio zerado.
> Knip ainda nao e gate de CI, lint ou build.

## Contexto

A auditoria foi executada na branch `codex/knip-observacional`, apos a saude
principal do projeto estar verde em CI com type-check, lint, testes e coverage.

Comando executado:

```bash
npm run knip -- --no-exit-code
```

O modo `--no-exit-code` foi usado intencionalmente para medir ruido e achados
sem bloquear a pipeline.

Desde esta mesma tranche, o repositório também passou a contar com automação do
GitHub para dependências:

- `Dependency graph` habilitado no repositório
- `Dependabot` habilitado
- `.github/dependabot.yml` publicado com agenda semanal para `npm` e `github-actions`

Essa camada não substitui o Knip. O GitHub monitora árvore, risco e updates; o
Knip continua sendo a ferramenta de auditoria de possível dependência sobrando
ou export sem consumidor.

## Configuracao Aplicada

Arquivo criado: `knip.json`

A configuracao inicial seguiu o plano de `02_plano_knip_futuro.md`, mas foi
refinada apos a primeira execucao para remover hints redundantes indicados pelo
proprio Knip.

Decisoes da configuracao atual:

- entradas explicitas para preload, HTML do renderer e scripts `.mjs`
- escopo de projeto separado para main, preload, renderer, tipos e configs
- regras em `warn` para arquivos, exports, tipos, dependencias, unlisted e duplicatas
- `src/renderer/types/assets.d.ts` ignorado como declaracao ambiente esperada
- `lint`, CI e build permanecem sem Knip como gate

## Resultado da Primeira Linha de Base

Resumo dos achados acionaveis:

| Categoria | Quantidade | Leitura inicial |
|---|---:|---|
| Arquivos nao usados | 0 | falso positivo de `assets.d.ts` foi tratado como excecao de configuracao |
| Dependencias nao usadas | 4 | requer triagem antes de remover |
| DevDependencies nao usadas | 1 | requer triagem antes de remover |
| Exports nao usados | 73 | misto de possiveis limpezas e falsos positivos/exports publicos |
| Tipos exportados nao usados | 39 | misto de tipos publicos, tipos de fronteira e possiveis limpezas |
| Exports duplicados | 8 | principalmente padrao `default` + export nomeado em paginas/services |

Dependencias apontadas:

- `@dnd-kit/modifiers`
- `groq`
- `react-icons`
- `sqlite`

DevDependency apontada:

- `@types/sqlite3`

Duplicatas apontadas:

- `src/main/services/safe-storage.service.ts`
- `src/renderer/pages/CabecalhoPage.tsx`
- `src/renderer/pages/DashboardPage.tsx`
- `src/renderer/pages/GdlConfigPage.tsx`
- `src/renderer/pages/LogsPage.tsx`
- `src/renderer/pages/ModelosIAPage.tsx`
- `src/renderer/pages/SolicitantesPage.tsx`
- `src/renderer/pages/TiposExamePage.tsx`

## Leitura Operacional

O Knip trouxe uma linha de base mais ampla que o `ts-prune`: alem de exports e
tipos, tambem aponta dependencias e duplicatas. A ferramenta ja parece util
como relatorio manual, mas ainda ha volume suficiente para nao promove-la a gate.

Prioridade recomendada da proxima tranche:

1. triar as 5 dependencias/devDependencies apontadas, porque a decisao costuma
   ser objetiva e reduz risco de pacote ocioso
2. triar duplicatas `default` + export nomeado, separando padrao deliberado de
   export realmente redundante
3. tratar exports do main por camada, com cuidado com handlers, services e
   imports `.js` no runtime NodeNext
4. tratar componentes `ui`/shadcn por ultimo, pois exports publicos nao usados
   internamente podem ser estoque intencional de design system

## Decisao Atual

Manter Knip em modo observacional.

Nao fazer nesta tranche:

- remover dependencias automaticamente
- remover exports em lote
- adicionar Knip ao `npm run lint`
- adicionar Knip como falha de CI
- remover `ts-prune`

## Resultado da Primeira Rodada de Triagem - 05/07/2026

Comandos executados:

```bash
npm uninstall @dnd-kit/modifiers groq react-icons sqlite @types/sqlite3
npm run type-check
npm run lint
npm test
npm run knip -- --no-exit-code
```

Resultado observado apos a rodada:

| Categoria | Antes | Depois | Leitura atual |
|---|---:|---:|---|
| Arquivos nao usados | 0 | 0 | sem mudanca |
| Dependencias nao usadas | 4 | 0 | zeradas com remocao segura de pacotes ociosos |
| DevDependencies nao usadas | 1 | 0 | zerada |
| Exports nao usados | 73 | 57 | queda puxada pela limpeza segura do `main` |
| Tipos exportados nao usados | 39 | 39 | ainda sem triagem nesta rodada |
| Exports duplicados | 8 | 0 | zerados ao remover `default exports` redundantes |

Dependencias/devDependency removidas:

- `@dnd-kit/modifiers`
- `groq`
- `react-icons`
- `sqlite`
- `@types/sqlite3`

Duplicatas resolvidas:

- `src/main/services/safe-storage.service.ts`
- `src/renderer/pages/CabecalhoPage.tsx`
- `src/renderer/pages/DashboardPage.tsx`
- `src/renderer/pages/GdlConfigPage.tsx`
- `src/renderer/pages/LogsPage.tsx`
- `src/renderer/pages/ModelosIAPage.tsx`
- `src/renderer/pages/SolicitantesPage.tsx`
- `src/renderer/pages/TiposExamePage.tsx`

Exports do `main` reduzidos nesta rodada:

- helpers internos de `src/main/database/sqlite.ts` deixaram de ser publicos
- `validarArquivo` em `src/main/services/importacao.service.ts` deixou de ser publico
- classes de services do `main` deixaram de ser exportadas quando o contrato publico real era apenas o singleton
- `condicaoSatisfeita` em `src/main/services/regra-wizard.service.ts` deixou de ser publico

Validacao da rodada:

- `npm run type-check` OK
- `npm run lint` OK
- `npm test` OK com `43` passando e `1` skip
- `npm run knip -- --no-exit-code` sem dependencias/devDependencies ociosas e sem duplicatas

## Resultado da Segunda Rodada de Triagem - 05/07/2026

Comandos executados:

```bash
npm run type-check
npm run lint
npm test
npm run knip -- --no-exit-code
```

Resultado observado apos a rodada:

| Categoria | Antes da rodada 2 | Depois da rodada 2 | Leitura atual |
|---|---:|---:|---|
| Arquivos nao usados | 0 | 0 | sem mudanca |
| Dependencias nao usadas | 0 | 0 | sem mudanca |
| DevDependencies nao usadas | 0 | 0 | sem mudanca |
| Exports nao usados | 57 | 57 | frente remanescente esta no renderer/shared |
| Tipos exportados nao usados | 39 | 15 | queda puxada por recolhimento da tipagem interna do `main` |
| Exports duplicados | 0 | 0 | sem mudanca |

Tipos internos recolhidos nesta rodada:

- `CreateAuditInput`
- `ConfiguracaoRow`
- tipos internos de `exportacao.service.ts`
- tipos internos de `gdl.service.ts`
- `SecaoImportada`
- `PecaComSecao`
- `ArvoreEtapa`
- `ArvoreOpcao`
- `LogLevel`

Validacao da rodada:

- `npm run type-check` OK
- `npm run lint` OK
- `npm test` OK com `43` passando e `1` skip
- `npm run knip -- --no-exit-code` com `57` exports e `15` tipos exportados restantes

## Proxima Prioridade

## Resultado da Terceira Rodada de Triagem - 05/07/2026

Comandos executados:

```bash
npm run type-check
npm run lint
npm test
npm run knip -- --no-exit-code
```

Resultado observado apos a rodada:

| Categoria | Antes da rodada 3 | Depois da rodada 3 | Leitura atual |
|---|---:|---:|---|
| Arquivos nao usados | 0 | 0 | sem mudanca |
| Dependencias nao usadas | 0 | 0 | sem mudanca |
| DevDependencies nao usadas | 0 | 0 | sem mudanca |
| Exports nao usados | 57 | 41 | queda puxada por limpeza de `renderer/shared` |
| Tipos exportados nao usados | 15 | 3 | remanescente ficou concentrado em `ui` |
| Exports duplicados | 0 | 0 | sem mudanca |

Escopo limpo nesta rodada:

- exports sem consumidor em `forms`
- exports/tipos sem consumidor em `exam-fields`
- utilitarios de configuracao de template
- `tree-utils`
- parser de exportacao do renderer
- schemas de validacao sem consumidor externo
- helpers internos remanescentes de `secao-builder.service.ts`

Validacao da rodada:

- `npm run type-check` OK
- `npm run lint` OK
- `npm test` OK com `43` passando e `1` skip
- `npm run knip -- --no-exit-code` com `41` exports e `3` tipos exportados restantes

## Resultado da Quarta Rodada de Triagem - 05/07/2026

Comandos executados:

```bash
npm run type-check
npm run lint
npm test
npm run knip -- --no-exit-code
```

Resultado observado apos a rodada:

| Categoria | Antes da rodada 4 | Depois da rodada 4 | Leitura atual |
|---|---:|---:|---|
| Arquivos nao usados | 0 | 0 | sem mudanca |
| Dependencias nao usadas | 0 | 0 | sem mudanca |
| DevDependencies nao usadas | 0 | 0 | sem mudanca |
| Exports nao usados | 41 | 0 | relatorio zerado |
| Tipos exportados nao usados | 3 | 0 | relatorio zerado |
| Exports duplicados | 0 | 0 | sem mudanca |

Escopo limpo nesta rodada:

- exports remanescentes de `src/renderer/components/ui/**`
- tipos publicos de `badge`, `button` e `textarea`
- aliases locais que ficaram sem uso apos a reducao de exports

Validacao da rodada:

- `npm run type-check` OK
- `npm run lint` OK
- `npm test` OK com `43` passando e `1` skip
- `npm run knip -- --no-exit-code` sem apontamentos

## Estado Atual

O Knip permanece em modo observacional, mas a trilha iniciada nesta issue saiu
da fase de baseline e chegou a um estado limpo no repositório:

1. dependencias/devDependencies ociosas zeradas
2. duplicatas de export zeradas
3. exports nao usados zerados
4. tipos exportados nao usados zerados

## Proxima Prioridade

O proximo passo deixou de ser limpeza estrutural imediata e passou a ser
decisao de estrategia:

1. registrar o estado zerado no painel de saude do sistema
2. decidir separadamente se Knip continua apenas observacional ou se entra em gate futuro
3. se houver nova rodada, tratar apenas regressao nova em vez de nova limpeza ampla

## Fechamento da Frente - 05/07/2026

Com o estado zerado registrado e a branch `codex/knip-observacional` promovida
para `main`, a frente observacional do Knip foi considerada concluida.

Saldo final desta auditoria:

- dependencias nao usadas: `4 -> 0`
- devDependencies nao usadas: `1 -> 0`
- exports nao usados: `73 -> 0`
- tipos exportados nao usados: `39 -> 0`
- exports duplicados: `8 -> 0`
- arquivos nao usados: `0 -> 0`

Beneficios consolidados:

- remocao de pacote ocioso sem regressao funcional
- reducao da superficie publica desnecessaria no `main`, `renderer/shared` e `ui`
- baseline limpa para detectar regressao nova com muito menos ruido
- manutencao do Knip fora do `lint` e do CI como gate nesta etapa

Decisao final desta issue para a frente do Knip:

1. encerrar a limpeza ampla
2. nao abrir nova rodada imediata
3. manter o uso do Knip como auditoria manual/observacional
