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
