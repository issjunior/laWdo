# Dashboard operacional

## Papel da pagina

`src/renderer/pages/DashboardPage.tsx` e hoje a home operacional da aplicacao.
Ela combina:

- resumo carregado no mount
- layout adaptativo por viewport
- subcomponentes locais na propria pagina
- projecoes carregadas sob demanda

## Contratos consumidos

O renderer fala com:

- `window.ipcAPI.dashboard.resumo()`
- `window.ipcAPI.dashboard.projecoes()`

E trata as respostas como fronteira insegura, normalizando payloads com helpers locais antes de alimentar estado tipado.

## Estruturas principais

### Resumo

O resumo inclui:

- `repsPorStatus`
- `repsPrazoProximo`
- `repsPrazoVencido`
- `laudosPorStatus`
- `tempoMedioPorTipoExame`
- `repsRecentes`
- `laudosRecentes`

### Projecoes

As projecoes incluem:

- `historicoMensal`
- `resumoAnual`
- `projecaoMensalEstimada`
- `projecaoAnualEstimada`
- `baseHistoricaAnalisada`
- `indicadorConfiabilidade`

## Modos de layout

`DashboardPage` calcula um modo interno:

- `compacto`
- `padrao`
- `amplo`

Regras atuais:

- `amplo`: largura >= `1680` e altura >= `920`
- `compacto`: largura < `1360` ou altura < `860`
- restante: `padrao`

Esse modo muda principalmente:

- densidade visual
- quantidade de itens recentes
- quantidade de linhas em tempo medio

## Estados de tela

Estados visuais atuais:

- `DashboardSkeleton`
- `DashboardErro`
- `DashboardVazio`

Quando ha dados, os blocos principais ainda passam por `ErrorBoundary`, entao uma falha localizada nao derruba toda a home.

## Projecoes no estado atual

As projecoes nao abrem mais em modal.
Elas ficam em um `Collapsible` dentro da propria pagina (`CardProjecoes`).

Comportamento:

1. o estado `projecoesExpandidas` e persistido em `localStorage` na chave `dashboard_projecoes_expandido`
2. o fetch de projecoes so dispara na primeira expansao
3. enquanto a pagina permanecer montada, o resultado fica em cache local

## Atualizacao dos dados

O resumo e recarregado quando:

- a pagina monta
- a janela volta a ter foco
- o documento fica visivel de novo
- o usuario aciona a atualizacao manual

Nao existe polling por intervalo.

## Blocos principais

Os blocos exibidos hoje sao:

- `KpiCards`
- `AlertaPrazo`
- `RepsRecentes`
- `LaudosRecentes`
- `TempoMedioCiclo`
- `CardProjecoes`

## Backend

`DashboardService` continua dividindo a carga em dois metodos:

- `obterResumo()`
- `obterProjecoes()`

O resumo agrega em paralelo dados de status, prazos, recentes e tempo medio.
As projecoes usam laudos concluidos e montam:

- serie mensal observada
- consolidado anual
- estimativa mensal
- estimativa anual
- indicador textual de confiabilidade

## Regra pratica

Qualquer manutencao na dashboard precisa distinguir duas coisas:

1. o contrato vindo do main
2. a normalizacao defensiva feita no renderer

Grande parte da resiliencia da pagina depende dessa segunda camada, nao apenas das queries do backend.
