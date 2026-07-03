# Plano: Deteccao Automatizada de Codigo Morto com Knip

> **Ultima atualizacao:** 03/07/2026
>
> **Status:** plano executavel em modo observacional. Os pre-requisitos
> principais foram atingidos, mas o Knip ainda nao deve entrar como gate do
> `lint` antes da primeira auditoria sem bloqueio.
>
> **Fonte de decisao atual:** `00_saude_do_sistema.md`

Este documento substitui o plano futuro condicionado de 22/06/2026. Naquela
data, o projeto nao tinha cobertura minima nem CI. Em 03/07/2026, a situacao
mudou: lint, type-check, testes e coverage estao verdes e protegidos por
GitHub Actions em `main`.

O proximo passo nao e instalar Knip diretamente no `lint`. A configuracao deve
entrar primeiro como ferramenta de relatorio para medir ruido, falsos positivos
e beneficio real no contexto Electron multi-target do projeto.

## Decisao Atual

Knip pode ser iniciado em branch propria, mas em **modo observacional**:

- adicionar `knip` como devDependency
- criar `knip.json` explicito para main, preload e renderer
- adicionar script `knip`
- rodar `npm run knip -- --no-exit-code` ou equivalente na primeira auditoria
- triar resultados antes de promover qualquer regra a gate
- manter `npm run lint` sem Knip ate a triagem inicial estabilizar

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

Conclusao: os bloqueios principais foram removidos, mas ainda nao ha justificativa
para acoplar Knip ao `lint` no primeiro commit. A instalacao deve medir o ruido
antes de bloquear a pipeline.

## Escopo da Primeira Tranche

Branch sugerida: `codex/knip-observacional`

Commit sugerido: `add_knip_observacional`

Objetivo:

- instalar e configurar Knip
- gerar o primeiro relatorio
- documentar os achados por categoria
- nao remover codigo automaticamente
- nao alterar `npm run lint`
- nao colocar Knip no workflow de CI como gate

Fora do escopo:

- remover arquivos ou exports apontados pelo Knip
- remover `ts-prune`
- transformar Knip em erro de CI
- reestruturar tsconfig, aliases ou module resolution

## Configuracao Inicial Proposta

Arquivo: `knip.json`

```json
{
  "$schema": "https://unpkg.com/knip/schema.json",
  "entry": [
    "src/main/index.ts",
    "src/preload/index.ts",
    "src/renderer/index.tsx",
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
    "vite.*.ts",
    "vitest.config.ts",
    "tailwind.config.js",
    "postcss.config.js"
  ],
  "ignore": [
    "out/**",
    "dist/**",
    "coverage/**",
    "src/renderer/public/**"
  ],
  "ignoreDependencies": [
    "electron-squirrel-startup"
  ],
  "ignoreBinaries": [
    "electron-builder"
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

1. manter `knip` como comando manual
2. depois adicionar job separado no CI com `continue-on-error: true` ou comando
   sem exit code, se o relatorio ainda tiver ruido
3. apenas no fim incluir Knip no `lint` ou remover `--no-exit-code`

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

Ao implementar a primeira tranche:

```bash
npm run knip -- --no-exit-code
npm run lint
npm run type-check
npm test
npm run test:coverage
npm run build
```

No GitHub:

- publicar branch propria
- observar o CI existente
- nao exigir que Knip passe como gate nessa primeira etapa

## Entregaveis Esperados

- `knip` instalado em `devDependencies`
- `knip.json` criado na raiz
- script `npm run knip` adicionado
- primeiro relatorio de achados registrado em spec ou comentario da issue `#1`
- decisao documentada sobre o proximo passo:
  - remover achados reais
  - registrar excecoes
  - manter observacional
  - promover para gate

## Referencias

- `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/00_saude_do_sistema.md`
- `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/01_abordagem_leve_pre_knip.md`
- `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/DEAD_CODE_EXCEPTIONS.md`
- Documentacao Knip consultada via Context7: configuracao de entry/project, workspaces, severidades graduais, `ignoreDependencies`, tags e uso em CI
