# Plano Dashboard

## Resumo

Implementar uma `DashboardPage` operacional com acabamento premium, respeitando integralmente os temas e tokens definidos em `src/renderer/styles/globals.css`. A home deve priorizar retomada de trabalho, visão rápida de status e métricas confiáveis. Projeções não ficam expostas diretamente no dashboard: devem abrir em modal dedicado, com visão mensal e anual baseada em dados pretéritos e aviso explícito quando a base histórica não for suficiente para estimativa razoavelmente confiável.

## Objetivos da V1

- Substituir o placeholder atual da `DashboardPage` por uma home funcional.
- Manter foco operacional, não gerencial.
- Respeitar light/dark mode sem criar linguagem visual paralela.
- Evitar métricas ambíguas como "horas trabalhadas" sem rastreamento real.
- Entregar arquitetura modular, payloads enxutos e boa performance.
- Refletir alterações no banco imediatamente quando o usuário retorna ao dashboard.

## Escopo funcional

### Saudação contextual

Exibir linha de saudação no topo do dashboard com nome do usuário logado e data atual:

```
Bom dia, Silva — quarta-feira, 2 de julho de 2026
```

- Nome vem da sessão do usuário autenticado (já disponível no renderer).
- Data é gerada localmente no renderer, sem custo de IPC.
- Sem tratamento honorífico (não usar "Dr.", "Perita" etc.).
- Parte do bloco de cabeçalho da página, antes dos KPIs.

### Dashboard principal

#### KPIs de REPs

- `Pendente`
- `Em Andamento`
- `Concluído`

#### KPIs de Laudos

- `Em andamento`
- `Concluído`
- `Entregue`

#### KPIs de alerta operacional (prazo)

Agregar no mesmo payload `dashboard:resumo`:

- `repsPrazoProximo`: contagem de REPs com status `Pendente` ou `Em Andamento` com `prazo` nos próximos 7 dias
- `repsPrazoVencido`: contagem de REPs com status `Pendente` ou `Em Andamento` com `prazo` já ultrapassado

Exibir como cards destacados (amber para prazo próximo, red para vencido). São métricas operacionais diretas — não gerenciais. Zero mudança de schema: o campo `prazo` já existe na tabela `reps`.

#### Laudos recentes

- Ordenados por `updated_at DESC`.
- Limitar a 6 registros no payload.
- Campos obrigatórios no `DashboardLaudoRecente`:
  - `id` — para navegação
  - `rep_numero` — REP associada
  - `tipo_exame_nome` — contexto do exame
  - `status` — badge de status
  - `updated_at` — "atualizado há X dias"
- JOIN reutiliza a lógica já existente em `findAllComRep()` no `laudo.service.ts`.
- Incluir CTA para abrir a `LaudosPage`.

#### Tempo médio de ciclo por tipo de exame

- Calcular com base em `data_inicio` até `data_conclusao`.
- Ignorar laudos sem `data_conclusao`.
- Não rotular como horas trabalhadas.
- Rótulo obrigatório: `Tempo médio de ciclo`.

#### Atalhos rápidos

- `REPsPage`
- `LaudosPage`
- `LogsPage`

#### CTA de projeções

Exibir botão no cabeçalho da página (área superior direita) para abrir o modal de projeções. Não deve competir visualmente com os KPIs operacionais.

### Modal de projeções

- Abrir sob demanda a partir do dashboard.
- Exibir duas visões separadas:
  - projeção mensal
  - projeção anual
- Basear-se apenas em dados pretéritos de laudos concluídos.
- Exibir:
  - histórico mensal observado
  - consolidado anual observado
  - projeção mensal estimada
  - projeção anual estimada
  - base histórica analisada
  - mensagem de confiabilidade
- Quando não houver base suficiente:
  - avisar explicitamente o usuário
  - reduzir ênfase visual da projeção
  - evitar aparência de previsão precisa

## Layout de primeira dobra

Ordem de blocos (prioridade operacional descendente):

```
┌──────────────────────────────────────────────────────────┐
│  Saudação contextual + data             [Projeções →]    │
├────────────┬────────────┬────────────┬────────────────────┤
│ REPs Pend. │ REPs EmAnd │ REPs Conc. │ [alerta prazo]     │  ← KPI row 1
├────────────┴────────────┴────────────┴────────────────────┤
│ Laudos EmAnd │ Laudos Conc. │ Laudos Entregue             │  ← KPI row 2
├──────────────────────────────────────────────────────────┤
│              Laudos Recentes (lista compacta)             │  ← foco principal
├───────────────────────────────┬──────────────────────────┤
│       Tempo médio de ciclo    │    Atalhos rápidos        │
└───────────────────────────────┴──────────────────────────┘
```

Os laudos recentes têm prioridade visual sobre o tempo médio de ciclo — ficam antes, pois exigem ação imediata.

## Backend

### Novo agregado de resumo

Criar leitura agregada `dashboard:resumo` no main process para devolver payload já consolidado ao renderer.

Deve retornar:

- `repsPorStatus` — contagem por status
- `repsPrazoProximo` — REPs ativas com prazo nos próximos 7 dias
- `repsPrazoVencido` — REPs ativas com prazo vencido
- `laudosPorStatus` — contagem por status
- `tempoMedioPorTipoExame`
- `laudosRecentes` — últimos 6 laudos atualizados com JOIN de REP e tipo de exame

### Novo agregado de projeções

Criar leitura agregada `dashboard:projecoes` no main process.

Deve retornar:

- histórico mensal consolidado de laudos concluídos
- resumo anual consolidado derivado da série mensal
- projeção mensal estimada
- projeção anual estimada
- indicadores de suficiência e confiabilidade

### Regras de cálculo

- Considerar como base principal os laudos com `data_conclusao`.
- Série mensal:
  - agrupar por mês de conclusão
  - usar janela histórica ordenada cronologicamente
- Série anual:
  - agregar os valores mensais por ano
- Tempo médio de ciclo:
  - diferença entre `data_inicio` e `data_conclusao`
  - descartar registros incompletos ou inválidos
- Laudos recentes:
  - ordenar por `updated_at DESC`
  - limitar a 6 registros
- Prazo:
  - `repsPrazoProximo`: `prazo BETWEEN data_atual AND data_atual + 7 dias` com status `Pendente` ou `Em Andamento`
  - `repsPrazoVencido`: `prazo < data_atual` com status `Pendente` ou `Em Andamento`

### Regra de suficiência histórica

O sistema deve operacionalizar "precisão razoável" com uma régua objetiva.

Critérios mínimos da V1:

- exigir quantidade mínima de meses históricos preenchidos
- exigir cobertura temporal mínima contínua ou quase contínua
- marcar `dadosInsuficientes` quando a série for curta, muito esparsa ou inexistente
- retornar mensagem explicativa pronta para a UI

Observação:

- a projeção pode existir tecnicamente com amostra curta, mas não deve ser apresentada como confiável
- na insuficiência, a UI deve privilegiar histórico observado e aviso, não o número projetado

## IPC e tipagem

### Novos canais

- `dashboard:resumo`
- `dashboard:projecoes`

### Atualizações obrigatórias

- registrar canais em `ALLOWED_CHANNELS`
- expor wrappers específicos no preload
- tipar `window.ipcAPI.dashboard`

### Tipos compartilhados

Criar `src/types/dashboard.ts` (o diretório `src/types/` já existe; `src/shared/` não existe no projeto).

Tipos a declarar:

- `DashboardResumo`
- `DashboardProjecoes`
- `DashboardKpiStatus`
- `DashboardAlertaPrazo`
- `DashboardTempoMedioTipoExame`
- `DashboardLaudoRecente`
- `DashboardSerieMensal`
- `DashboardSerieAnual`
- `DashboardIndicadorConfiabilidade`

### Contratos esperados

- `window.ipcAPI.dashboard.resumo(): Promise<{ success: boolean; data?: DashboardResumo; error?: string }>`
- `window.ipcAPI.dashboard.projecoes(): Promise<{ success: boolean; data?: DashboardProjecoes; error?: string }>`

## Frontend e modularização

### Organização de arquivos

```
src/renderer/components/dashboard/
  KpiCards.tsx              # bloco de cards de status (REPs e Laudos)
  AlertaPrazo.tsx           # cards de alerta amber/red para prazo
  LaudosRecentes.tsx        # lista compacta de laudos recentes
  TempoMedioCiclo.tsx       # tabela de tempo médio por tipo de exame
  AtalhosDashboard.tsx      # grid de atalhos rápidos
  ModalProjecoes.tsx        # modal com as projeções
  DashboardSkeleton.tsx     # skeleton loader do estado de carregamento
  DashboardErro.tsx         # estado de erro elegante
  DashboardVazio.tsx        # estado vazio (banco novo, sem dados)

src/renderer/lib/dashboard/
  formatadores.ts           # formatação de período, duração, rótulos
  normalizadores.ts         # normalização segura do payload IPC

src/renderer/hooks/
  useDashboardResumo.ts     # hook de dados do resumo
  useDashboardProjecoes.ts  # hook de dados de projeções (carregamento sob demanda)
```

### Hooks de dados

Criar hooks dedicados para separar fetch de render, garantindo testabilidade isolada e página declarativa.

```typescript
// useDashboardResumo.ts
export function useDashboardResumo(): {
  dados: DashboardResumo | null;
  carregando: boolean;
  erro: string | null;
  recarregar: () => void;
}

// useDashboardProjecoes.ts
export function useDashboardProjecoes(habilitado: boolean): {
  dados: DashboardProjecoes | null;
  carregando: boolean;
  erro: string | null;
}
```

A `DashboardPage` não usa `useState`/`useEffect` diretamente para dados — delega inteiramente aos hooks.

### Estratégia de atualização dos dados

O dashboard deve refletir o estado atual do banco sempre que o usuário o visualiza. A atualização deve ocorrer nos seguintes momentos:

- no mount da página (carregamento inicial)
- ao retornar ao dashboard via navegação (o `useEffect` do hook depende de um token de visibilidade ou do foco da rota)
- via botão de refresh manual explícito (ícone discreto no cabeçalho)

**Estratégia de implementação**: usar o evento de foco da rota ou visibilidade da página (`visibilitychange`) para disparar `recarregar()` do hook quando o usuário retorna ao dashboard. Isso garante que uma REP criada em outra página apareça imediatamente sem necessidade de polling ou intervalo fixo.

Não implementar polling por intervalo fixo — o dado é atualizado por ação do usuário, não por tempo.

### Estratégia de cache do modal de projeções

- Primeira abertura do modal: dispara fetch via `useDashboardProjecoes(true)`.
- Dados ficam em `useState` na `DashboardPage` até o unmount.
- Segunda abertura: reutiliza o estado sem novo fetch.
- Sem context global, sem SWR, sem cache externo — `useState` é suficiente.

### ErrorBoundary

Envolver os blocos principais da `DashboardPage` com o `ErrorBoundary` existente em `src/renderer/components/ErrorBoundary.tsx`. Um erro em `LaudosRecentes` não deve derrubar os KPIs. Não criar novo ErrorBoundary.

### Navegação

- Clicar em laudo recente abre `LaudosPage` sem foco em item específico (V1 sem deep-link).
- Atalhos rápidos navegam diretamente para a página correspondente.

## Direção visual

### Regras gerais

- usar apenas Tailwind utilities e variáveis já definidas em `globals.css`
- não criar CSS novo para o dashboard
- não hardcodar tema fora da linguagem já adotada no projeto

### Aparência premium

- cards com hierarquia visual clara, boa respiração e contraste consistente com os tokens existentes
- layout em blocos bem definidos, com primeira dobra de leitura imediata
- informações operacionais com destaque maior que conteúdo analítico
- modal de projeções com aparência de painel executivo, sem poluição visual
- cards de alerta de prazo com cor semântica (amber/red) sem depender exclusivamente de cor — usar ícone e label complementares

### Micro-animações e carregamento

- Skeleton loader nos cards durante carregamento: `bg-muted animate-pulse` (Tailwind puro, sem dependência)
- Entrada dos cards após carregamento: `animate-fade-in` (já definido em `globals.css`) com `animation-delay` progressivo (0ms, 60ms, 120ms… por card)
- Número dos KPIs: counter animation leve via `useEffect` simples com incremento (opcional, não bloquear a V1 por isso)

### Compatibilidade com temas

- respeitar automaticamente light/dark mode
- reutilizar superfícies, bordas, sombras e cores semânticas alinhadas aos tokens:
  - `background`
  - `card`
  - `muted`
  - `border`
  - `primary`
  - `sidebar-*`

## UX

- a primeira dobra deve responder rapidamente:
  - o que está pendente
  - o que está em andamento
  - o que precisa ser retomado agora
  - o que está com prazo em risco
- projeções não devem competir com a operação diária
- loading, erro e vazio devem ter estados claros e elegantes
- não depender só de cor para comunicar status ou confiabilidade
- labels devem ser curtos e objetivos

### Rotulagem obrigatória

- `Tempo médio de ciclo`
- `Projeção estimada`
- `Base histórica analisada`
- `Prazo próximo` / `Prazo vencido` para os cards de alerta
- `Dados insuficientes para estimativa confiável` quando aplicável

## Desempenho

### Backend

- consolidar a maior parte das agregações no main process
- evitar múltiplas chamadas IPC pequenas para compor o dashboard
- retornar payload pronto para renderização
- as agregações de `repsPrazoProximo` e `repsPrazoVencido` devem ser feitas em SQL, não no renderer

### Frontend

- carregar `dashboard:resumo` no mount da página e ao retornar à rota
- carregar `dashboard:projecoes` apenas ao abrir o modal
- manter cache simples do modal enquanto a página estiver montada (`useState`)
- limitar listas e evitar transferência de dados brutos desnecessários
- usar memorização apenas onde houver ganho real

### Robustez

- tratar respostas IPC como fronteira insegura
- normalizar payload antes de renderizar (via `normalizadores.ts`)
- degradar bem em caso de ausência parcial de dados (ex: sem laudos, sem REPs com prazo)

## Critérios de aceite

- a `DashboardPage` deixa de ser placeholder e passa a exibir KPIs, alertas de prazo, tempo médio de ciclo, laudos recentes e atalhos
- a dashboard respeita os temas definidos em `globals.css`
- o modal de projeções exibe visão mensal e anual separadas
- projeções usam apenas dados pretéritos
- o sistema avisa claramente quando a base histórica for insuficiente
- o renderer não depende de consultas múltiplas e pesadas para montar a home
- os dados refletem o estado atual ao retornar à rota (sem necessidade de reload)
- a solução final mantém boa modularização e clareza de responsabilidades

## Testes

### Backend

- agregação correta de REPs por status
- agregação correta de Laudos por status (incluindo `Entregue`)
- cálculo correto de `repsPrazoProximo` e `repsPrazoVencido`
- cálculo correto de tempo médio de ciclo
- laudos sem `data_conclusao` não entram na média
- ordenação correta dos laudos recentes
- projeção mensal com base suficiente
- projeção anual com base suficiente
- série vazia
- série curta
- série esparsa
- retorno correto de `dadosInsuficientes` e mensagem de aviso

### Frontend

- render da dashboard em loading, sucesso, erro e vazio
- render correto dos blocos principais
- cards de alerta amber/red quando há REPs com prazo em risco
- ausência dos cards de alerta quando não há REPs com prazo em risco
- abertura do modal de projeções
- render do modal em cenário com suficiência histórica
- render do modal em cenário com insuficiência histórica
- navegação a partir de laudo recente
- comportamento visual coerente em light/dark mode
- dados atualizados ao retornar à rota após ação em outra página

### Validação final

- `npm run type-check`
- `npm run lint`
- `npm test`

## Fora da V1

- rastreamento real de horas trabalhadas
- biblioteca externa de gráficos como dependência obrigatória
- indicadores gerenciais amplos ocupando a home principal
- previsão com aparência de precisão estatística avançada
- polling por intervalo fixo para atualização automática
- filtro por perito no dashboard
- deep-link direto para laudo específico a partir de laudos recentes
- gráficos interativos de linha/barra (representação textual/tabular é suficiente para V1)

## Assunções

- a dashboard da V1 é operacional
- projeções ficam isoladas no modal
- a métrica viável para V1 é `tempo médio de ciclo`
- dados históricos vêm do banco atual, sem mudança de schema
- prazo já existe na tabela `reps` — nenhuma migration necessária para os cards de alerta
- V1 sem deep-link: clicar em laudo recente abre `LaudosPage` geral
- atualização de dados ocorre por ação do usuário (retorno à rota ou refresh manual), não por tempo
- se futuramente houver necessidade de métrica real de esforço, isso exigirá mecanismo explícito de rastreamento de atividade
