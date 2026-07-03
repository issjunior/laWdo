# Dashboard

## Resumo

A dashboard deixou de ser placeholder e hoje funciona como home operacional do sistema. A implementação foi condensada no renderer para reduzir indireção: a página concentra fetch, normalização, formatadores e subcomponentes locais, enquanto as fronteiras corretas do Electron permanecem separadas em `service`, `handler`, `preload` e tipagem compartilhada.

O foco da tela é retomada de trabalho:

- status de REPs
- status de laudos
- alertas de prazo
- laudos recentes
- tempo médio de ciclo
- atalhos rápidos
- projeções abertas sob demanda em modal

## Estrutura atual

### Arquivos principais

```text
src/renderer/pages/DashboardPage.tsx
src/main/services/dashboard.service.ts
src/main/ipc/handlers/dashboard.handlers.ts
src/types/dashboard.d.ts
src/__tests__/main/dashboard.service.test.ts
src/__tests__/pages/dashboard-page.test.tsx
```

### Organização por camada

- `src/renderer/pages/DashboardPage.tsx`
  concentra a feature inteira no renderer, incluindo helpers puros, normalização do payload IPC, estado da página e subcomponentes privados não exportados.
- `src/main/services/dashboard.service.ts`
  consolida consultas SQL, agregações do resumo e cálculo das projeções.
- `src/main/ipc/handlers/dashboard.handlers.ts`
  expõe os canais IPC da dashboard.
- `src/types/dashboard.d.ts`
  define o contrato tipado compartilhado entre camadas.

Não existem mais hooks, libs ou componentes dedicados do dashboard fora da própria página.

## Comportamento da tela

### Cabeçalho

O topo da página exibe:

- selo `Painel operacional`
- saudação contextual com nome do usuário da sessão
- data atual formatada localmente no renderer
- botão de refresh manual
- botão `Projeções`

Formato atual da saudação:

```text
Bom dia Silva — quarta-feira, 2 de julho de 2026
```

Detalhes:

- o nome é lido de `sessionStorage` pela chave `lawdo_auth_user`
- a página aceita `nome` ou `name` no objeto persistido
- se não houver nome válido, usa fallback `Perito`
- a data é gerada localmente via `Intl.DateTimeFormat('pt-BR')`

### KPIs principais

A página renderiza 6 KPIs vindos do resumo agregado:

- REPs `Pendente`
- REPs `Em Andamento`
- REPs `Concluído`
- Laudos `Em andamento`
- Laudos `Concluído`
- Laudos `Entregue`

Os cards são montados a partir dos arrays:

- `repsPorStatus`
- `laudosPorStatus`

O service completa status ausentes com `0`, então a UI sempre recebe a régua fixa esperada.

### Alertas de prazo

Os alertas operacionais usam os campos:

- `repsPrazoProximo`
- `repsPrazoVencido`

Regras atuais:

- `Prazo próximo`: REPs com status `Pendente` ou `Em Andamento` e prazo entre hoje e os próximos 7 dias
- `Prazo vencido`: REPs com status `Pendente` ou `Em Andamento` e prazo anterior a hoje

Comportamento da UI:

- os cards só aparecem quando o total for maior que zero
- se ambos forem zero, o bloco não é renderizado

### Laudos recentes

O bloco `Laudos recentes` mostra até 6 registros ordenados por `updated_at DESC`.

Campos exibidos:

- número da REP
- tipo de exame
- status
- data relativa no formato `atualizado hoje` / `atualizado há X dias`

Comportamento de navegação:

- o botão `Abrir Laudos` navega para `/laudos`
- clicar em qualquer laudo recente também navega para `/laudos`
- não existe deep-link para item específico nesta versão

### Tempo médio de ciclo

O bloco `Tempo médio de ciclo` exibe média por tipo de exame usando:

- `data_inicio`
- `data_conclusao`

Regras atuais:

- ignora laudos sem uma das datas
- ignora intervalos inválidos em que `data_conclusao < data_inicio`
- calcula média em dias com uma casa decimal
- ordena por nome do tipo de exame

### Atalhos rápidos

Os atalhos disponíveis hoje são:

- `/reps`
- `/laudos`
- `/logs`

## Atualização dos dados

### Resumo

O resumo é recarregado:

- no mount da página
- quando a rota da página é renderizada novamente
- quando a janela recupera foco
- quando o documento volta a ficar visível
- quando o usuário clica no botão manual de atualizar

Não há polling por intervalo.

### Projeções

As projeções são carregadas sob demanda:

- a primeira abertura do modal habilita o fetch
- o resultado fica em estado local da página
- novas aberturas reutilizam o cache enquanto a página estiver montada

## IPC

### Canais

- `dashboard:resumo`
- `dashboard:projecoes`

### Contrato de resposta

Os handlers retornam o formato:

```ts
type RespostaDashboard<T> = {
  success: boolean
  data?: T
  error?: string
}
```

No renderer, toda resposta é tratada como fronteira insegura e normalizada antes de alimentar estado tipado.

## Tipos compartilhados

`src/types/dashboard.d.ts` define:

- `DashboardKpiStatus`
- `DashboardAlertaPrazo`
- `DashboardTempoMedioTipoExame`
- `DashboardLaudoRecente`
- `DashboardSerieMensal`
- `DashboardSerieAnual`
- `DashboardIndicadorConfiabilidade`
- `DashboardResumo`
- `DashboardProjecoes`

Observação:

- o contrato compartilhado está em `.d.ts`
- não existe mais `src/types/dashboard.js`
- os imports continuam sendo feitos com sufixo `.js` por causa do fluxo `NodeNext` e do pós-build do projeto

## Backend

### `dashboard:resumo`

O service consolida em uma única leitura agregada:

- contagem de REPs por status
- contagem de REPs com prazo próximo
- contagem de REPs com prazo vencido
- contagem de laudos por status
- tempo médio de ciclo por tipo de exame
- últimos 6 laudos atualizados

Consultas relevantes:

- agrupamentos de status feitos em SQL
- alertas de prazo feitos em SQL
- laudos recentes via join com `reps` e `tipos_exame`

### `dashboard:projecoes`

O cálculo usa apenas laudos com `data_conclusao`.

Fluxo atual:

1. agrupa laudos concluídos por mês
2. gera série mensal observada
3. completa meses faltantes entre o primeiro e o último mês com zero
4. deriva o resumo anual observado
5. calcula confiabilidade da base histórica
6. estima projeção mensal e anual com base na média da janela final

### Critério atual de projeção

A projeção usa a média dos últimos até 6 meses da série completa.

Saídas:

- `projecaoMensalEstimada`
- `projecaoAnualEstimada`

Se não houver histórico:

- ambas retornam `null`

### Critério atual de confiabilidade

O indicador usa:

- `mesesHistoricos`
- `mesesComDados`
- `coberturaHistorica`
- `nivel`
- `mensagem`

Régua implementada hoje:

- `alta`: pelo menos 12 meses com dados e cobertura histórica >= 85%
- `moderada`: pelo menos 6 meses com dados, pelo menos 9 meses históricos e cobertura >= 70%
- `baixa`: pelo menos 3 meses com dados e cobertura >= 45%, ainda marcado como `dadosInsuficientes: true`
- `insuficiente`: qualquer cenário abaixo disso

Mensagens de confiabilidade já saem prontas do backend para a UI.

## Modal de projeções

O modal mostra:

- projeção mensal
- projeção anual
- base histórica analisada
- badge de suficiência da base
- cobertura histórica
- histórico mensal observado
- consolidado anual observado

Quando `dadosInsuficientes` for `true`:

- os números projetados permanecem visíveis
- o bloco projetado perde ênfase visual com redução de opacidade
- a mensagem de alerta da confiabilidade ganha protagonismo

## Renderer

### Organização interna de `DashboardPage.tsx`

O arquivo segue esta divisão prática:

- constantes e mapeamentos visuais
- helpers puros de formatação
- helpers de normalização segura
- subcomponentes locais
- componente `DashboardPage` no final

Subcomponentes locais existentes:

- `DashboardSkeleton`
- `DashboardErro`
- `DashboardVazio`
- `KpiCards`
- `AlertaPrazo`
- `LaudosRecentes`
- `TempoMedioCiclo`
- `AtalhosDashboard`
- `ModalProjecoes`

### Robustez

A página aplica algumas proteções locais:

- normalização de payload de resumo
- normalização de payload de projeções
- leitura segura de `sessionStorage`
- tratamento de erros de IPC com `unknown`
- `ErrorBoundary` por bloco principal para evitar queda total da página

Blocos protegidos separadamente:

- KPIs
- alertas de prazo
- laudos recentes
- tempo médio de ciclo
- atalhos rápidos

## Estados visuais

### Loading

Quando o resumo inicial ainda não chegou, a página mostra `DashboardSkeleton`.

### Erro

Se o resumo falhar e ainda não existir dado carregado, a página mostra `DashboardErro` com botão `Tentar novamente`.

### Vazio

Se os indicadores vierem zerados e não houver laudos recentes nem tempo médio calculável, a página mostra `DashboardVazio`.

## Testes existentes

### Backend

`src/__tests__/main/dashboard.service.test.ts` cobre a regra do service e das projeções.

### Frontend

`src/__tests__/pages/dashboard-page.test.tsx` cobre:

- sucesso
- erro
- vazio
- abertura do modal de projeções
- navegação para laudos
- navegação para REPs
- navegação para logs

## Validação usada na implementação

Após a implementação e refatoração final da dashboard, a validação executada foi:

- `npm run type-check`
- `npm run lint`
- `npm test`
- `npm run build`

## Limites atuais

- não há deep-link para um laudo específico
- não há polling automático
- não há gráfico externo; o histórico é textual/tabular
- não há previsão estatística avançada
- o dashboard continua com foco operacional, não gerencial
