# Plano: Deteccao Automatizada de Codigo Morto com Knip

> **Ultima atualizacao:** 05/07/2026
>
> **Status:** tranche observacional concluida e relatorio zerado. O Knip
> continua fora do `lint` e fora do CI como gate nesta etapa.
>
> **Fonte de decisao atual:** `00_saude_do_sistema.md`

Este documento substituiu o plano futuro condicionado de 22/06/2026. Naquela
data, o projeto nao tinha cobertura minima nem CI. Em 03/07/2026, a situacao
mudou: lint, type-check, testes e coverage ficaram verdes e protegidos por
GitHub Actions em `main`. Em 05/07/2026, a tranche observacional foi concluida
com o Knip zerado, sem regressao em `type-check`, `lint` ou `test`.

O proximo passo deixou de ser "instalar e medir". Agora a decisao real e de
estrategia: manter o Knip como comando manual observacional ou promover a
ferramenta para algum gate futuro depois de uma janela de estabilizacao.

## Decisao Atual

Knip foi introduzido em branch propria e executado em **modo observacional**:

- `knip` adicionado como `devDependency`
- `knip.json` criado com escopo explicito para main, preload e renderer
- script `npm run knip` adicionado
- auditoria executada com `npm run knip -- --no-exit-code`
- quatro rodadas de triagem concluidas
- `npm run lint` mantido sem Knip

Racional:

- a documentacao atual do Knip recomenda adocao gradual, com severidades
  separadas por tipo de achado
- achados podem vir em cadeia; arquivos nao alcancados devem ser tratados antes
  de exports e dependencias
- o projeto ja possui falsos positivos conhecidos no `ts-prune`, especialmente
  no main process com NodeNext e imports `.js`
- o custo de manutencao de excecoes ainda precisa ser medido com dados reais do
  Knip neste repositorio

## Estado dos Pre-Requisitos

| Pre-requisito | Estado em 22/06/2026 | Estado em 03/07/2026 | Decisao |
|---|---|---|---|
| Cobertura de testes >= 30% | Nao atendido (~1%) | Atendido: linhas 54,86%; funcoes 64,76%; statements 51,77%; branches 39,48% | Desbloqueia auditoria Knip |
| CI estabelecido | Inexistente | Atendido: GitHub Actions roda `npm ci`, type-check, lint, testes e coverage | Desbloqueia auditoria Knip |
| Cultura de qualidade | Em construcao | Em consolidacao: lint zerado, coverage gate, excecoes documentadas | Suficiente para modo observacional |
| Projeto com > 400 fontes TS | Nao atendido (~212) | Nao atendido: 169 fontes TS/TSX em `src` | Ainda pesa contra gate imediato |
| `verbatimModuleSyntax` ou `isolatedModules` | Nao atendido | Nao atendido | Nao bloqueia relatorio, mas aumenta chance de ruido |

Conclusao: os bloqueios principais foram removidos e a auditoria observacional
provou valor pratico, mas ainda nao ha justificativa suficiente para acoplar
Knip ao `lint` ou ao CI como gate nesta mesma tranche.

## Resultado da Tranche Observacional

Resumo consolidado apos quatro rodadas de triagem em 05/07/2026:

| Categoria | Linha de base | Estado atual |
|---|---:|---:|
| Arquivos nao usados | 0 | 0 |
| Dependencias nao usadas | 4 | 0 |
| DevDependencies nao usadas | 1 | 0 |
| Exports nao usados | 73 | 0 |
| Tipos exportados nao usados | 39 | 0 |
| Exports duplicados | 8 | 0 |

Beneficios ja materializados:

- remocao de dependencias sem uso real
- reducao da superficie publica desnecessaria no `main`, `renderer/shared` e `ui`
- linha de base zerada para detectar regressao futura com muito menos ruido
- manutencao da estabilidade do projeto durante toda a limpeza

Validacao mantida verde ao final da tranche:

- `npm run type-check`
- `npm run lint`
- `npm test`
- `npm run knip -- --no-exit-code`

## Escopo da Primeira Tranche

Branch usada: `codex/knip-observacional`

Commit sugerido para fechamento desta rodada: `update_knip_observacional_zerado`

Objetivo executado:

- instalar e configurar Knip
- gerar a linha de base inicial
- documentar os achados por categoria
- triar em rodadas separadas os achados reais
- manter `npm run lint` inalterado
- nao colocar Knip no workflow de CI como gate

Fora do escopo:

- remover arquivos ou exports apontados pelo Knip
- remover `ts-prune`
- transformar Knip em erro de CI
- reestruturar tsconfig, aliases ou module resolution

## Configuracao Inicial Aplicada

Arquivo: `knip.json`

```json
{
  "$schema": "https://unpkg.com/knip/schema.json",
  "entry": [
    "src/preload/index.ts",
    "src/renderer/index.html",
    "scripts/*.mjs"
  ],
  "project": [
    "src/main/**/*.ts",
    "src/preload/**/*.ts",
    "src/renderer/**/*.{ts,tsx}",
    "src/types/**/*.d.ts",
    "scripts/**/*.mjs",
    "*.config.{js,ts}",
    "vite.*.ts"
  ],
  "ignore": [
    "src/renderer/types/assets.d.ts"
  ],
  "rules": {
    "files": "warn",
    "exports": "warn",
    "types": "warn",
    "dependencies": "warn",
    "devDependencies": "warn",
    "unlisted": "warn",
    "duplicates": "warn"
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

A primeira execucao indicou hints de configuracao redundante. A configuracao
acima ja reflete o ajuste para reduzir ruido sem ocultar achados de codigo morto.

Script inicial:

```json
{
  "scripts": {
    "knip": "knip"
  }
}
```

Comando da primeira auditoria:

```bash
npm run knip -- --no-exit-code
```

## Ordem de Triagem

1. **Unused files**
   - prioridade mais alta
   - confirmar se o arquivo e realmente inalcançavel
   - verificar imports dinamicos, entry points, scripts e convencoes Electron/Vite

2. **Unused dependencies e devDependencies**
   - conferir `package.json`, scripts, configs e imports condicionais
   - registrar excecoes antes de remover dependencias usadas por CLI ou runtime

3. **Unused exports e types**
   - tratar por feature ou camada
   - considerar falsos positivos por barrels, tipos publicos e imports `.js`
   - remover apenas quando houver evidencia direta de ausencia de consumidor

4. **Duplicatas e unlisted**
   - corrigir somente depois de estabilizar arquivos/deps/exports

## Criterios de Promocao para Gate

Knip so deve entrar em `npm run lint` ou no CI quando todos os criterios abaixo
forem atendidos:

- primeira auditoria concluida e documentada
- achados reais removidos em tranches separadas
- falsos positivos registrados em `DEAD_CODE_EXCEPTIONS.md`
- `npm run knip` passa sem achados de severidade `error`
- `npm run lint`, `npm run type-check`, `npm test`, `npm run test:coverage` e
  `npm run build` continuam verdes

Promocao recomendada:

1. manter `knip` como comando manual por enquanto
2. se houver interesse em observacao continua, adicionar job separado no CI com
   `continue-on-error: true` ou comando sem exit code
3. apenas depois decidir se faz sentido incluir Knip no `lint` ou remover
   `--no-exit-code`

## Relacao com ts-prune

`ts-prune` permanece por enquanto.

Motivo:

- ja existe baseline e excecoes conhecidas no projeto
- Knip ainda precisa provar que reduz ruido em vez de apenas trocar uma lista de
  falsos positivos por outra
- remover `ts-prune` antes da primeira auditoria Knip eliminaria uma referencia
  comparativa util

`ts-prune` so deve ser removido quando:

- Knip cobrir os mesmos sinais com menos ruido operacional
- `DEAD_CODE_EXCEPTIONS.md` estiver atualizado para a nova ferramenta
- a equipe decidir que manter duas ferramentas de codigo morto nao compensa

## Verificacao da Tranche Observacional

Verificacao usada para fechar a tranche:

```bash
npm run knip -- --no-exit-code
npm run lint
npm run type-check
npm test
npm run test:coverage
npm run build
```

No GitHub:

- branch propria publicada
- issue `#1` atualizada com o progresso da implementacao
- Knip mantido sem gate nessa primeira etapa

Primeira linha de base registrada em:

- `05_auditoria_knip_2026-07-03.md`

## Entregaveis Entregues

- `knip` instalado em `devDependencies`
- `knip.json` criado na raiz
- script `npm run knip` adicionado
- linha de base e rodadas de triagem registradas em spec
- comentario publicado na issue `#1`
- decisao atual documentada: manter observacional e decidir gate separadamente

## Referencias

- `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/00_saude_do_sistema.md`
- `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/01_abordagem_leve_pre_knip.md`
- `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/DEAD_CODE_EXCEPTIONS.md`
- Documentacao Knip consultada via Context7: configuracao de entry/project, workspaces, severidades graduais, `ignoreDependencies`, tags e uso em CI
