# Plano de Implementacao - Saude de Codigo

> Ultima atualizacao: 03/07/2026
> Status da iniciativa: concluida
> Fonte de verdade do estado atual: `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/00_saude_do_sistema.md`
> Escopo deste arquivo: registrar a estrategia usada, a sequencia das tranches e o fechamento operacional da iniciativa. Nao usar este arquivo como painel corrente de metricas.

Este arquivo deixou de ser um plano ativo. A frente de limpeza de lint,
TypeScript, testes, coverage inicial e triagem principal de codigo morto foi
encerrada em 03/07/2026. O acompanhamento do estado atual do sistema passou a
ficar concentrado no painel de saude.

## Fechamento operacional

Em 03/07/2026, a iniciativa foi considerada encerrada com o seguinte resultado
consolidado no painel de saude:

| Frente | Estado de fechamento |
|---|---|
| Build | `npm run build` passando |
| TypeScript | `npm run type-check` passando |
| ESLint | `0 errors`, `0 warnings` |
| Testes | `43 pass`, `1 skip` |
| Coverage | medicao ativa com gate progressivo inicial |
| Codigo morto | renderer triado sem candidatos reais; remanescentes do main documentados como falsos positivos conhecidos |

Leitura pratica:

- a frente de `no-explicit-any` foi encerrada
- a frente de `react-hooks/exhaustive-deps` foi encerrada com revisao
  comportamental
- a suite automatizada ficou verde no estado atual do repositorio
- a triagem principal de `ts-prune` foi concluida no renderer
- o proximo acompanhamento deve acontecer pelo painel de saude, nao por novas
  tranches neste arquivo

## Como usar este arquivo daqui para frente

Use este documento apenas para:

- entender a ordem das tranches executadas
- retomar o racional das decisoes de corte e validacao
- localizar o ponto em que a iniciativa deixou de ser um plano aberto

Nao use este documento para:

- consultar metricas correntes
- decidir pendencias atuais de lint, testes ou coverage
- listar proximas tranches como se ainda estivessem abertas

Para estado corrente, consultar:

- `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/00_saude_do_sistema.md`
- `spec/problemas diversos/erros_eslint_typescript_testes_codigomorto/DEAD_CODE_EXCEPTIONS.md`

## Linha de progresso

| Commit | Branch de origem | Resultado |
|---|---|---|
| `7171fd1 ajuste_baseline_qualidade` | baseline inicial | Build, type-check, lint e testes desbloqueados; lint com `514 warnings` |
| `1f3b250 ajuste_limpa_warnings_main` | `codex/limpa-warnings-main` | Limpeza inicial em `src/main`; lint da main caiu para `494 warnings` |
| `5280c65 ajuste_reducao_warnings_lint_renderer` | `codex/reduz-warnings-lint` | Reducao relevante no renderer, incluindo `b602.tsx`, `LaudosPage.tsx`, `REPsPage.tsx` |
| `df1eb57 ajuste_limpa_warnings_renderer_simples` | `codex/limpa-warnings-renderer-simples` | Limpeza segura no renderer sem preload; foco em unused/no-console/unescaped |
| `898b48f ajuste_limpa_warnings_preload` | `codex/limpa-warnings-preload` | `src/preload/index.ts` ficou com `0 warnings`; lint global caiu para `266 warnings` |
| `6ea0dcb ajuste_limpa_any_renderer_simples` | `codex/limpa-warnings-any-renderer` | `no-explicit-any` simples no renderer; lint global caiu para `214 warnings` |
| `codex/limpa-any-renderer-pequeno` | tranche renderer pequena | `PlaceholderContextMenu`, `CabecalhoPage`, `WizardLaudoPage` e `WizardEditorPage` limpos; total caiu para `190 warnings` |
| `codex/tipa-ipc-renderer-bootstrap` | bootstrap renderer | `src/renderer/index.tsx` tipado; total caiu para `188 warnings` |
| `codex/limpa-any-tinymce-editor` | editor | `TinyMceEditor.tsx` limpo; total caiu para `166 warnings` |
| `codex/limpa-any-laudos-page` | laudos renderer | `LaudosPage.tsx` sem `no-explicit-any`; total caiu para `123 warnings` |
| `codex/limpa-any-templates-page` | templates renderer | `TemplatesPage.tsx` sem `no-explicit-any`; total caiu para `112 warnings` |
| `codex/limpa-any-exportacao-placeholders` | helper renderer | `exportacao-placeholders.ts` limpo; total caiu para `110 warnings` |
| `codex/limpa-any-sqlite-database` | database main | `sqlite.ts` e `types/database.ts` limpos; total caiu para `96 warnings` |
| `codex/limpa-any-base-service` | services main | `base.service.ts` e cortes proximos limpos; total caiu para `87 warnings` |
| `codex/limpa-any-services-pequenos` | services main | services pequenos limpos; total caiu para `81 warnings` |
| `codex/remove-grill-me-e-logger` | manutencao auxiliar | skill local removido do repo e `logger.ts` limpo; total caiu para `79 warnings` |
| `codex/limpa-any-handlers-crud` | handlers IPC | handlers CRUD pequenos limpos; total caiu para `61 warnings` |
| `codex/limpa-any-template-handlers` | handlers IPC | `template.handlers.ts` limpo; total caiu para `49 warnings` |
| `03/07/2026 - tranche IPC/exportacao` | fechamento main | `laudo.handlers.ts`, `ipc/index.ts` e `exportacao.service.ts` sairam da lista; restaram `27 warnings` de hooks |
| `03/07/2026 - tranche hooks renderer` | fechamento renderer | warnings de `react-hooks/exhaustive-deps` zerados; lint global ficou em `0 warnings` |
| `03/07/2026 - fechamento planejamento` | consolidacao final | coverage habilitada com gate progressivo e triagem principal de codigo morto consolidada |

## Regras que se provaram corretas

- separar limpeza de tipos de refatoracao funcional
- nao tratar `react-hooks/exhaustive-deps` mecanicamente
- preferir `unknown` + narrowing a casts artificiais
- validar cada tranche com `npm run lint` e `npm run type-check`
- incluir `npm test` e `npm run build` quando o corte tocar IPC, preload,
  services, bootstrap ou fluxos sensiveis
- documentar falsos positivos de codigo morto em vez de remover contratos ainda
  necessarios

## Ponto de transicao

A partir deste fechamento:

- o painel `00_saude_do_sistema.md` virou a referencia principal do estado atual
- novas iniciativas de qualidade devem abrir documento proprio se tiverem
  escopo diferente
- este arquivo deve permanecer estavel, salvo se for necessario corrigir o
  registro historico ou a forma de encerramento
