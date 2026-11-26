# Exceções de Código Morto

Símbolos que a varredura atual do `ts-prune` sinaliza, mas cuja utilização foi confirmada no código. Esta lista não substitui a revisão dos consumidores, usos dinâmicos e entrypoints a cada nova triagem.

| Símbolo | Arquivo | Consumidores confirmados |
|---|---|---|
| `SolicitanteRow`, `CategoriaPecaRow` | `src/main/types/database.ts` | Serviços e handlers do processo principal via imports NodeNext `.js`. |
| `setupLogging`, `getAllLogs`, `clearAllLogs`, `ILogger`, `LogEntry` | `src/main/utils/logger.ts` | Inicialização do processo principal e handlers de logs. |
| `DashboardService`, `dashboardService` | `src/main/services/dashboard.service.ts` | `dashboard.handlers.ts`. |

Não remover um candidato somente porque consta nesta tabela: confirme seus consumidores no código atual e retire a exceção quando a ferramenta deixar de sinalizá-lo.
