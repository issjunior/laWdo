# Plano de Implementacao - Baseline de Qualidade

> Ultima atualizacao: 30/06/2026
> Branch atual: `codex/ajuste_baseline_qualidade`
> Commit base implementado: `7d68979 ajuste_baseline_qualidade`

Este arquivo acompanha a evolucao da implementacao das correcoes de ESLint,
TypeScript, testes e codigo morto. Ele registra o que ja foi executado, o que
esta pendente e quais criterios devem ser usados para considerar cada etapa
concluida.

## Objetivo

Estabilizar um baseline minimo de qualidade para que os comandos principais do
projeto sejam executaveis de forma confiavel:

- `npm run build`
- `npm run type-check`
- `npm run lint`
- `npm test`
- `npm run prune:all`

O baseline atual nao elimina toda a divida tecnica. Ele separa erro bloqueante
de divida conhecida para permitir evolucao incremental sem esconder os pontos
que ainda precisam ser tratados.

## Estado atual

| Area | Estado atual | Observacao |
|---|---|---|
| Branch de trabalho | Criada | `codex/ajuste_baseline_qualidade` |
| Commit da primeira etapa | Criado | `7d68979 ajuste_baseline_qualidade` |
| Build | Passando | Validado com `npm run build` |
| TypeScript | Passando | Validado com `npm run type-check` |
| Testes | Passando | `34 passed`, `1 skipped` |
| ESLint | Passando com warnings | `0 errors`, `514 warnings` |
| Codigo morto | Ainda com apontamentos | `npm run prune:all` segue com falsos positivos e divida conhecida |
| Publicacao no GitHub | Pendente | Branch ainda nao foi enviada para PR |

## Ja implementado

### Baseline de build, tipos, lint e testes

- Corrigidas falhas de type-check em componentes e paginas afetadas por tipos
  de Zod, react-hook-form, TanStack Table, TinyMCE e icones.
- Ajustados testes do componente `Button` para refletir as classes atuais do
  componente.
- Ajustado o setup de testes para usar `globalThis` e mock compartilhado da API
  Electron.
- Adicionado `out/**` ao `.eslintignore` para evitar lint sobre artefatos de
  build.
- Rebaixadas para warning as regras:
  - `@typescript-eslint/no-unused-vars`
  - `@typescript-eslint/no-explicit-any`
  - `react/no-unescaped-entities`

### Resultado da validacao

| Comando | Resultado |
|---|---|
| `npm run build` | Passou |
| `npm run type-check` | Passou |
| `npm run lint` | Passou com `514 warnings` |
| `npm test` | Passou com `34 passed`, `1 skipped` |
| `npm run prune:all` | Executou, mas ainda aponta divida/excecoes conhecidas |

## Pendente

### Publicacao e revisao

- Fazer push da branch `codex/ajuste_baseline_qualidade`.
- Abrir Draft PR no GitHub.
- Registrar na descricao do PR que o lint passa porque parte da divida foi
  convertida em warnings, nao porque foi totalmente eliminada.
- Revisar com atencao os ajustes em:
  - `REPsPage.tsx`
  - `ModelosIAPage.tsx`
  - `TinyMceEditor.tsx`
  - `.eslintrc.json`

### Documentacao de estado atual

- Atualizar o painel de saude em `00_saude_do_sistema.md` para refletir as
  metricas atuais.
- Manter os specs funcionais sem alteracao, salvo se for identificado impacto
  real de comportamento. A mudanca desta etapa foi estrutural e de qualidade.

### Reduçao incremental da divida de lint

- Tratar warnings de `no-unused-vars` ate a regra poder voltar para error.
- Tratar warnings de `react/no-unescaped-entities` ate a regra poder voltar
  para error.
- Tratar `no-explicit-any` por grupos de arquivos, evitando trocas mecanicas por
  tipos artificiais.

### Codigo morto

- Manter `ts-prune` como diagnostico atual.
- Registrar excecoes confirmadas em `DEAD_CODE_EXCEPTIONS.md`.
- Avaliar Knip somente depois que o baseline estiver revisado e aceito no PR.

## Criterios de conclusao da etapa atual

A etapa `ajuste_baseline_qualidade` sera considerada concluida quando:

- A branch estiver publicada no GitHub.
- O Draft PR estiver aberto com descricao das validacoes.
- O PR deixar claro o tradeoff de lint com warnings.
- O painel `00_saude_do_sistema.md` estiver atualizado com as metricas atuais.
- Nao houver regressao em build, type-check, lint e testes.

## Proximas etapas sugeridas

| Ordem | Etapa | Resultado esperado |
|---|---|---|
| 1 | Publicar branch e abrir Draft PR | Mudancas revisaveis no GitHub |
| 2 | Atualizar `00_saude_do_sistema.md` | Specs refletem o baseline atual |
| 3 | Reduzir warnings de unused vars | Regra pode voltar para error |
| 4 | Reduzir warnings de texto React | Regra pode voltar para error |
| 5 | Atacar `no-explicit-any` por modulo | Reducao gradual sem quebrar tipos |
| 6 | Reavaliar Knip | Automacao futura de codigo morto |

## Decisoes registradas

- A branch separada foi adotada porque a mudanca tem potencial estrutural.
- O baseline aceita warnings de lint temporariamente para desbloquear a esteira
  de validacao.
- O trabalho de codigo morto continua separado da estabilizacao inicial de
  build, tipos, lint e testes.
- Specs funcionais nao devem ser atualizados apenas porque arquivos foram
  tocados; a atualizacao deve refletir comportamento atual relevante.
