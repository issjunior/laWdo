# Dashboard Operacional

## Resumo

A dashboard deixou de ser placeholder e hoje é a home operacional carregada na rota `/`.
Ela combina agregações do banco no `main`, contratos tipados no `preload` e uma página única no `renderer` que concentra fetch, normalização defensiva, layout responsivo e subcomponentes locais.

A feature cobre:

- KPIs de REPs e laudos
- alertas de prazo
- listas de REPs recentes e laudos recentes
- tempo médio de ciclo por tipo de exame
- projeções mensais e anuais abertas sob demanda em modal

## Arquivos principais

```text
src/renderer/pages/DashboardPage.tsx
src/main/services/dashboard.service.ts
src/main/ipc/handlers/dashboard.handlers.ts
src/main/ipc/index.ts
src/preload/index.ts
src/preload/types.ts
src/types/dashboard.d.ts
src/renderer/App.tsx
src/renderer/lib/menu-config.ts
src/__tests__/main/dashboard.service.test.ts
src/__tests__/pages/dashboard-page.test.tsx
```

## Entrada da feature

- a rota `/` renderiza `DashboardPage` via lazy loading em `src/renderer/App.tsx`
- o item `Dashboard` é a primeira entrada do menu lateral em `src/renderer/lib/menu-config.ts`
- a página usa `window.ipcAPI.dashboard` para buscar resumo e projeções

## Contratos entre camadas

### `DashboardResumo`

O resumo carregado no mount da página contém:

- `repsPorStatus`
- `repsPrazoProximo`
- `repsPrazoVencido`
- `laudosPorStatus`
- `tempoMedioPorTipoExame`
- `repsRecentes`
- `laudosRecentes`

### `DashboardProjecoes`

O modal de projeções consome:

- `historicoMensal`
- `resumoAnual`
- `projecaoMensalEstimada`
- `projecaoAnualEstimada`
- `baseHistoricaAnalisada`
- `indicadorConfiabilidade`

### Resposta IPC

Os canais retornam o envelope:

```ts
interface DashboardResponse<T> {
  success: boolean
  data?: T
  error?: string
}
```

No renderer, a resposta é tratada como fronteira insegura: a página normaliza payloads com `unknown`, descarta itens malformados e aplica fallbacks antes de alimentar estado tipado.

## Comportamento visual da tela

### Cabeçalho

O topo mostra:

- selo `Painel operacional`
- saudação contextual por horário
- nome lido de `sessionStorage` na chave `lawdo_auth_user`
- fallback `Perito` quando não existe nome válido
- botão manual de atualização
- botão `Projeções`

A leitura do usuário aceita tanto `nome` quanto `name` no objeto persistido da sessão.

### KPIs

Os KPIs são montados a partir de uma régua fixa de status.

REPs:

- `Pendente`
- `Em Andamento`
- `Concluído`

Laudos:

- `Em andamento`
- `Concluído`
- `Entregue`

O backend completa status ausentes com `0`, então a UI não depende de o banco retornar todas as combinações.

### Alertas de prazo

Os cards de prazo usam:

- `repsPrazoProximo`
- `repsPrazoVencido`

Regras atuais:

- `Prazo próximo`: REPs com status `Pendente` ou `Em Andamento` e prazo entre hoje e os próximos 7 dias
- `Prazo vencido`: REPs com status `Pendente` ou `Em Andamento` e prazo anterior a hoje

Se ambos os totais forem zero, o bloco não é renderizado.

### Recentes

A dashboard exibe duas listas independentes:

- REPs recentes
- laudos recentes

As duas listas:

- são ordenadas por `updated_at DESC` no backend
- exibem status, identificação principal e data relativa
- navegam para `/reps` ou `/laudos` ao clique
- não fazem deep-link para item específico nesta versão

### Tempo médio de ciclo

O bloco `Tempo médio de ciclo` usa apenas laudos com:

- `data_inicio` preenchida
- `data_conclusao` preenchida
- intervalo válido (`data_conclusao >= data_inicio`)

A média é exibida em dias, com uma casa decimal quando necessário.

### Estados visuais e resiliência

A página tem três estados principais:

- `DashboardSkeleton` durante o carregamento inicial
- `DashboardErro` quando o resumo falha antes do primeiro dado válido
- `DashboardVazio` quando não há indicadores, recentes nem tempo médio calculável

Os blocos principais são encapsulados por `ErrorBoundary`, então uma falha localizada não derruba a tela inteira.

## Atualização dos dados

### Resumo

O resumo é recarregado:

- no mount da página
- quando a rota da página é renderizada novamente
- quando a janela recupera foco
- quando o documento volta a ficar visível
- quando o usuário clica em atualizar

Não existe polling por intervalo.

### Projeções

As projeções são lazy-loaded:

- o fetch só começa na primeira abertura do modal
- o resultado fica em estado local da página
- aberturas seguintes reutilizam o cache enquanto a página permanecer montada

## Responsividade

A página calcula um modo de layout interno com base em `window.innerWidth` e `window.innerHeight`.

Regras atuais:

- `compacto`: largura menor que `1360` ou altura menor que `860`
- `amplo`: largura maior ou igual a `1680` e altura maior ou igual a `920`
- `padrao`: qualquer cenário intermediário

Esse modo altera principalmente:

- densidade dos cards
- quantidade de itens exibidos nas listas recentes
- quantidade de linhas mostradas em `Tempo médio de ciclo`

Limites atuais:

- recentes: `2` no compacto, `3` no padrão, `4` no amplo
- tempo médio: `3` no compacto, `4` no padrão, `6` no amplo

## Backend

### `dashboard:resumo`

`DashboardService.obterResumo()` consolida em paralelo:

- contagem de REPs por status
- total de REPs com prazo próximo
- total de REPs com prazo vencido
- contagem de laudos por status
- tempo médio de ciclo por tipo de exame
- até 6 REPs recentes
- até 6 laudos recentes

Consultas relevantes:

- agrupamentos por status feitos em SQL
- prazos calculados com `date('now', 'localtime')`
- tempo médio calculado com `julianday(data_conclusao) - julianday(data_inicio)`
- tipos de exame resolvidos com `LEFT JOIN` para manter fallback textual

### `dashboard:projecoes`

`DashboardService.obterProjecoes()` usa apenas laudos com `data_conclusao`.

Fluxo atual:

1. agrupa laudos concluídos por mês
2. monta o histórico mensal observado
3. completa meses faltantes entre o primeiro e o último mês com zero
4. resume a série por ano
5. calcula confiabilidade da base histórica
6. estima projeções pela média da janela final

### Critério de projeção

A projeção usa a média dos últimos até 6 meses da série completa.

Saídas:

- `projecaoMensalEstimada`
- `projecaoAnualEstimada`

Se não houver histórico, ambas retornam `null`.

### Critério de confiabilidade

A régua atual é:

- `alta`: pelo menos 12 meses com dados e cobertura histórica >= 85%
- `moderada`: pelo menos 6 meses com dados, pelo menos 9 meses históricos e cobertura >= 70%
- `baixa`: pelo menos 3 meses com dados e cobertura >= 45%, ainda com `dadosInsuficientes: true`
- `insuficiente`: qualquer cenário abaixo disso

A mensagem já sai pronta do backend e a UI apenas apresenta o texto.

## Canais IPC

Os canais expostos são:

- `dashboard:resumo`
- `dashboard:projecoes`

Eles aparecem em conjunto em:

- `src/main/ipc/handlers/dashboard.handlers.ts`
- `src/main/ipc/index.ts`
- `src/preload/index.ts`
- `src/preload/types.ts`

## Testes e estado atual

Cobertura existente:

- `src/__tests__/main/dashboard.service.test.ts`
- `src/__tests__/pages/dashboard-page.test.tsx`

Como estado atual do repositório em `03/07/2026`:

- os testes da página da dashboard passam
- a suíte do service também passa com o contrato atual do resumo
- a fixture do service agora mocka separadamente `repsRecentes` e `laudosRecentes`, acompanhando a ordem real das consultas em `DashboardService.obterResumo()`
- a cobertura automatizada da feature está verde

Essa correção foi de suíte/fixture; o contrato funcional da dashboard permaneceu o mesmo.
