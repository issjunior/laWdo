# Auditoria Knip Observacional - 03/07/2026

> **Status:** primeira linha de base registrada. Knip ainda nao e gate de CI,
> lint ou build.

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

Proximo passo recomendado: iniciar tranche pequena de triagem das dependencias
apontadas pelo Knip.
