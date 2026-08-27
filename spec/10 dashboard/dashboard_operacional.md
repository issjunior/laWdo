# Dashboard operacional

## Papel e composição

`src/renderer/pages/DashboardPage.tsx` é a home operacional da aplicação. A página é organizada em três seções recolhíveis, cuja abertura é persistida em `localStorage` na chave `dashboard_secoes_expandidas`:

1. **Situação atual:** distribuição por status de REPs e laudos, seguida de quatro prioridades operacionais.
2. **Consulta cronológica:** consulta por período ou busca de um laudo e respectiva cronologia.
3. **Produção de laudos:** ciclos de conclusão agrupados por natureza de exame.

O resumo e a produção inicial são buscados no mount. Falhas no resumo substituem a tela por uma mensagem com nova tentativa; as consultas cronológica e de produção mantêm seus próprios estados de carregamento, erro e vazio.

## Contratos e fronteira IPC

O dashboard usa exclusivamente wrappers específicos do preload:

| Operação | Entrada | Saída e responsabilidade |
| --- | --- | --- |
| `dashboard.resumo()` | — | Contagens canônicas por status e prioridades. |
| `dashboard.consultarLaudos()` | busca opcional, marco, intervalo, página e tamanho | Página de laudos, total filtrado e agregação completa por status. |
| `dashboard.cronologiaLaudo()` | ID não vazio do laudo | Marcos persistidos e transições auditadas vinculadas ao laudo, ou `null`. |
| `dashboard.producaoLaudos()` | natureza e intervalo de conclusão opcionais | Indicadores por natureza disponível no histórico concluído. |

Os canais permitidos e os métodos de `IpcAPI` vivem em `src/preload/index.ts`; os contratos compartilhados estão em `src/types/dashboard.d.ts`; `src/main/ipc/handlers/dashboard.handlers.ts` valida os filtros antes de delegar para `DashboardService`.

O preload é uma fronteira insegura. Mesmo depois da validação do main, o renderer normaliza `unknown` antes de atualizar estado: descarta registros sem ID/REP, converte contagens para inteiros não negativos, torna datas opcionais em `null` e aplica zero aos indicadores inválidos. Uma resposta IPC bem-sucedida mas malformada, portanto, não deve quebrar a página nem produzir valores numéricos inválidos.

### Regras de validação

- O marco da consulta é um de `criacao`, `alteracao`, `conclusao` ou `entrega`.
- Datas usam `YYYY-MM-DD`; início posterior ao fim é rejeitado. Página é positiva e o tamanho fica entre 1 e 100 (10 é o padrão do serviço).
- A busca consulta número da REP, código ou nome da natureza.
- O intervalo final é inclusivo por `date(coluna) <= date(?)`.
- A produção recebe as mesmas regras de datas e aceita uma natureza opcional.

## Situação atual e filtros derivados

`DashboardService.obterResumo()` preenche sempre as listas de status conhecidas, inclusive quando a consulta não retorna linhas:

- REPs: `Pendente`, `Em Andamento`, `Concluído`.
- Laudos: `Em andamento`, `Concluído`, `Entregue`.

As prioridades são contadas no main e levam às listas filtradas via URL:

| Prioridade | Regra no resumo | Destino |
| --- | --- | --- |
| REPs vencidas | REP pendente/em andamento, prazo anterior a hoje | `/reps?prioridade=vencida` |
| REPs próximas | REP pendente/em andamento, prazo entre hoje e os próximos sete dias | `/reps?prioridade=proxima` |
| Laudos aguardando entrega | status `Concluído` e `data_entrega` nula | `/laudos?prioridade=aguardando-entrega` |
| Laudos sem alteração | status `Em andamento` e ao menos sete dias desde `updated_at` | `/laudos?prioridade=sem-alteracao` |

Segmentos dos gráficos levam para `/reps?status=…` ou `/laudos?status=…`. As páginas de destino aplicam `status` antes de `prioridade` sobre a coleção já carregada e exibem a ação **Limpar filtro**, que navega para a rota sem query string. A regra é duplicada intencionalmente entre a consulta SQL do resumo e o filtro visual: ao alterar uma prioridade, preserve ambas alinhadas, inclusive o limite de sete dias e a comparação de status.

### Gráficos

Os dois gráficos de status e o gráfico do resultado cronológico reutilizam `GraficoStatus`, baseado em Recharts. Há três modos: rosca, barras horizontais e barra horizontal empilhada. O seletor é único; seu valor válido é persistido em `dashboard_tipo_grafico`. O padrão atual é **rosca**; qualquer valor ausente ou inválido volta a esse padrão.

As cores são tokens `--chart-1` a `--chart-4` em `src/renderer/styles/globals.css`, com valores para os temas claro e escuro. Com todos os valores zerados, o componente exibe o estado vazio em vez do gráfico.

## Consulta cronológica

A aba **Por período** aplica o marco escolhido (`created_at`, `updated_at`, `data_conclusao` ou `data_entrega`), ordena do mais recente para o mais antigo e pagina os itens. A resposta inclui `porStatus` calculado sobre **todo** o resultado filtrado, não apenas a página atual; por isso o botão **Gerar gráfico** só habilita quando `total > 0` e abre um diálogo com a distribuição integral e o intervalo contextual.

A aba **Por laudo** faz a mesma busca textual usando o marco de criação e lista os candidatos. Selecionar um item busca a cronologia pelo ID e abre um diálogo com:

- criação (`laudos.created_at`);
- última alteração registrada (`laudos.updated_at`);
- conclusão e entrega/envio persistidas;
- transições de status de `logs_auditoria` cujo `entidade_id` é o ID do laudo, módulo é `laudo` ou `laudos`, e ação é `transicao_status`.

Cada transição desserializa seus JSONs defensivamente; status ausente ou JSON inválido vira `null`. A cronologia permanece útil se não houver auditoria vinculada, mostrando os marcos e o estado informativo. `updated_at` representa somente a última alteração conservada pelo banco, não um histórico de todas as edições. O diálogo também abre diretamente o wizard do laudo selecionado.

## Produção

`obterProducaoLaudos()` considera apenas laudos atualmente `Concluído` ou `Entregue`, com `data_conclusao`, REP criada e início do laudo válidos e não posteriores à conclusão. Os filtros de período recaem sobre `data_conclusao` e a consulta usa `julianday`, compatível com formatos SQLite/ISO usados no banco.

Para cada natureza com histórico concluído, inclusive inativa, a resposta traz:

- duração da criação da REP até a conclusão;
- duração do início do laudo até a conclusão;
- média, mediana e quantidade, em dias corridos e com uma casa decimal.

As naturezas vêm de uma consulta distinta das durações: uma natureza concluída ainda aparece com quantidade zero se todas as suas linhas forem inválidas para o ciclo. A interface mostra estado vazio para nenhuma amostra válida e alerta quando a amostra contém um único laudo.

## Fontes de verdade e manutenção coordenada

| Responsabilidade | Fonte |
| --- | --- |
| Consultas, limites temporais, agregação e mediana | `src/main/services/dashboard.service.ts` |
| Validação e resposta IPC | `src/main/ipc/handlers/dashboard.handlers.ts` |
| Canais permitidos, wrappers e contrato renderer/main | `src/preload/index.ts`, `src/types/dashboard.d.ts` |
| Normalização, armazenamento local e apresentação | `src/renderer/pages/DashboardPage.tsx` |
| Aplicação dos filtros originados no dashboard | `src/renderer/pages/REPsPage.tsx`, `src/renderer/pages/LaudosPage.tsx` |

Não há migration do banco para o dashboard: ele consulta campos existentes. Qualquer novo canal exige alteração coordenada no handler, na lista permitida, em `IpcAPI`, nos contratos compartilhados e na normalização do renderer.

## Testes e limites atuais

`src/__tests__/main/dashboard.service.test.ts` cobre preenchimento dos status, quatro prioridades, paginação com agregação integral, fim inclusivo do período, vínculo da auditoria ao laudo e média/mediana de produção. `src/__tests__/pages/dashboard-page.test.tsx` cobre a composição da visão operacional, consulta vazia e persistência/recuperação do recolhimento de seções.

O dashboard não faz polling nem recarrega por retorno de foco: os dados automáticos são os do mount; o resumo pode ser recarregado manualmente. A consulta cronológica executa três consultas independentes em paralelo (itens, total e agregação); uma mudança concorrente entre elas pode gerar uma página e total de instantes próximos, mas não há transação de leitura que congele a amostra.
