# Exceções de Código Morto

Arquivos que ferramentas de detecção sinalizam mas NÃO devem ser removidos.

## Componentes shadcn/ui
| Arquivo | Justificativa | Data |
|---|---|---|
| `src/renderer/components/ui/lens.tsx` | Parte da lib shadcn/ui; não usado atualmente | 22/06/2026 |

## Scripts e Configurações
| Arquivo | Justificativa | Data |
|---|---|---|
| `vite.config.ts` | Config de build | 22/06/2026 |
| `vitest.config.ts` | Config de testes | 22/06/2026 |
| `tailwind.config.js` | Config de estilo | 22/06/2026 |
| `postcss.config.js` | Config de build | 22/06/2026 |
| `electron-builder.yml` | Config de empacotamento | 22/06/2026 |
| `scripts/copy-tinymce.mjs` | Script de build | 22/06/2026 |
| `scripts/fix-imports.mjs` | Script de build | 22/06/2026 |

## Dependências condicionais
| Dependência | Justificativa | Data |
|---|---|---|
| `electron-squirrel-startup` | Importado condicionalmente no main | 22/06/2026 |

## Binários CLI
| Binário | Justificativa | Data |
|---|---|---|
| `electron-builder` | CLI via npm scripts | 22/06/2026 |

## Código Removido (confirmado como morto)
| Função/Objeto | Arquivo | Removido em | Evidência |
|---|---|---|---|
| `generateSecureHash()` | `src/main/security/crypto.ts` | 22/06/2026 | Nunca importada por nenhum arquivo |
| `isEncrypted()` (exportada) | `src/main/security/crypto.ts` | 22/06/2026 | Nunca importada (serviço usa cópia local privada) |
| `cryptoUtils` (objeto aggregator) | `src/main/security/crypto.ts` | 22/06/2026 | Nunca importado — consumidores importam funções individuais |

## Falsos positivos conhecidos do ts-prune

### Main process com NodeNext e imports `.js`
| Arquivo | Justificativa | Data |
|---|---|---|
| `src/main/database/sqlite.ts` | Exports como `closeDatabase` e `withTransaction` são importados por serviços via caminhos `.js`; `ts-prune` não reconhece todos esses usos no modo atual | 03/07/2026 |
| `src/main/types/database.ts` | Tipos de linhas SQL são importados por services/handlers via caminhos `.js`; `ts-prune` sinaliza falsamente como não usados | 03/07/2026 |
| `src/main/utils/logger.ts` | Helpers como `logInfo`, `setupLogging`, `getAllLogs` e `clearAllLogs` têm consumidores reais em `main/index.ts` e handlers IPC | 03/07/2026 |
| `src/main/services/dashboard.service.ts` | `dashboardService` é consumido por `dashboard.handlers.ts`, mas aparece como candidato por limitação de resolução do `ts-prune` no main | 03/07/2026 |
| `src/main/services/diagnostico-state.service.ts` | Funções de diagnóstico são consumidas por `src/main/ipc/index.ts`, mas aparecem como candidato por limitação de resolução do `ts-prune` no main | 03/07/2026 |
| `src/main/services/secao-builder.service.ts` | `filtrarSecoesAtivas` e `buildHtml` têm consumidores em `laudo.service.ts`, mas aparecem como candidatos por limitação de resolução do `ts-prune` no main | 03/07/2026 |
