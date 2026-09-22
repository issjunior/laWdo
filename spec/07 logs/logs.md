# Sistema de logs, auditoria e capturas locais

## Trilhas e responsabilidades

O aplicativo mantem cinco trilhas locais, que compartilham a pagina **Logs e diagnostico**, mas possuem persistencia e criterios de coleta proprios.

| Trilha | Estado canonico | Finalidade |
|---|---|---|
| sistema | arquivos em `userData/logs` | avisos e erros tecnicos continuos |
| auditoria | tabela SQLite `logs_auditoria` | rastreabilidade das acoes da aplicacao |
| linha do tempo | consulta de auditoria correlacionada por REP/laudo | ciclo de vida de uma entidade |
| desempenho | `userData/logs/performance.log` | amostras e eventos tecnicos continuos |
| captura central | `userData/capturas-logs` | dossie local, temporario e exportavel de uma sessao investigada |

`CapturaLogsService` e a fonte de verdade da captura central. Ele nao cria eventos de negocio nem produz qualquer escrita no GDL.

## Logs continuos, auditoria e snapshots

`logger.ts` cria `userData/logs`, grava JSON em `combined.log` e `error.log`, e usa rotacao de 5 MB com cinco arquivos. Em desenvolvimento tambem emite texto colorido no console. `getLogger(module)` entrega um singleton por modulo; o threshold usual e `warn`, com excecoes como IA em `debug` e backup, configuracao e atualizacao em `info`.

`getAllLogs()` aceita linhas JSON atuais e linhas legadas em texto, ordenando por horario decrescente. `clearAllLogs()` limpa os arquivos tecnicos rotacionados.

`audit-log.service.ts` concentra `auditLogin`, `auditDelete`, `auditExport`, `auditBackup`, `auditCicloVida` e `auditLimpezaLogs`, alem de `listAuditLogs`, `clearAuditLogs`, `countAuditLogs` e `getTimelineRep`. A persistencia da auditoria e assincrona com `catch`, portanto uma falha nela nao bloqueia a operacao principal. Quando ha captura central ativa, a tentativa de auditoria tambem e observada pela sonda, sem incluir mensagens ou dados de negocio no dossie.

Snapshots de erros fatais sao responsabilidade de `diagnostico-state.service.ts`. Eles ficam em `userData/diagnostico-state-dumps`, limitam profundidade, colecoes e strings, e registram falhas fatais do main ou renderer. Nao sao eventos de uma captura central e nao geram NDJSON de sessao.

`desempenho.service.ts` preserva os perfis continuos e grava amostras locais em `performance.log`, com rotacao e exportacao CSV. O perfil detalhado da captura central e ativado somente durante a sessao de cinco minutos. Os dados continuos e o CSV nao substituem o JSON consolidado da captura central.

## Captura central

A captura central aceita uma ou mais sondas: `sistema`, `auditoria`, `linha_tempo` e `desempenho`. Somente uma sessao pode permanecer ativa. O controle global seleciona as quatro sondas; os controles em cada aba selecionam somente a sonda daquela aba. O cabecalho do laWdo tambem apresenta a sessao ativa e permite interrompe-la fora da pagina Logs.

A sessao dura no maximo cinco minutos. Ela pode encerrar por parada manual, expiracao ou recuperacao apos interrupcao do aplicativo. O encerramento manual preserva todos os eventos ja descarregados. Ao iniciar, a sonda de desempenho tambem ativa o perfil detalhado pelo mesmo prazo e o handler o encerra ao finalizar a sessao central.

Fluxo entre camadas:

```text
Controle React -> window.ipcAPI.capturaLogs -> preload com allowlist
  -> captura-logs.handlers -> CapturaLogsService -> arquivos locais
```

Os canais sao `estado`, `iniciar`, `parar`, `marcar-problema`, `listar`, `exportar`, `excluir` e `limpar`, sob o prefixo `captura-logs:`. A notificacao `captura-logs:estado-alterado` atualiza controles e cabecalho.

## Coleta e anonimização

A coleta ocorre por observadores do processo principal:

- Logger tecnico fornece somente nivel, codigo de aviso/erro e modulo seguro para a sonda Sistema.
- Auditoria fornece modulo, tipo de acao, entidade, resultado e contexto opaco. Para REP e laudo, o mesmo contexto opaco alimenta a Linha do Tempo.
- Desempenho fornece origem, categoria, operacao, canal, duracoes, metricas e apenas metadados numericos ou booleanos permitidos.

Identificadores de entidade e contexto sao transformados com hash com sal exclusivo da sessao. A captura e a exportacao aceitam somente codigos, horarios, numeros, booleanos e `null`; mensagens livres, numeros de REP, identificadores reais, conteudo pericial, imagens, nomes e caminhos nao entram no arquivo.

## Persistencia, formato e qualidade

Enquanto ativa, a sessao e descrita em `captura-ativa.json` e descarrega eventos incrementalmente em `id.ndjson`. No encerramento, o servico le o NDJSON, calcula o resumo, valida a estrutura em tempo de execucao e grava `id.json` no formato 2. O arquivo ativo e o NDJSON sao removidos somente apos a gravacao da captura concluida.

O JSON concluido inclui:

- metadados da sessao, sondas, motivo de encerramento, total e descartes;
- `qualidade`: `suficiente`, `parcial` ou `sem_evidencia`;
- `coberturaSondas` com eventos, avisos, erros e evidencia por sonda;
- `resumo` com duracao, marcadores, contagens por codigo, estatisticas de metricas (minimo, maximo, media e P95) e achados;
- eventos cronologicos detalhados e anonimizados.

`sem_evidencia` significa que nenhuma sonda registrou evento util. `parcial` indica descarte na fila ou ao menos uma sonda selecionada sem evidencia. Os achados reconhecem falta de evidencia, erros isolados ou repetidos, operacoes lentas, atraso do event loop, long tasks e crescimento significativo de memoria. Uma operacao lenta e preservada como achado se seu P95 ou qualquer execucao individual atingir 250 ms; execucoes de 2 s ou mais sao criticas.

A fila central comporta mil eventos. Eventos excedentes incrementam `eventosDescartados`. A retencao mantem no maximo dez capturas concluidas ou 50 MB, removendo as mais antigas. A limpeza protegida de Logs tambem elimina capturas. Na inicializacao, uma sessao ativa persistida e finalizada como `interrompida`, preservando o que ja estava no NDJSON.

## Interface, historico, exportacao e limpeza

`LogsPage.tsx` apresenta a captura completa e o historico antes das abas Sistema, Auditoria, Linha do Tempo e Desempenho. O cabecalho da pagina contem somente a acao global **Limpar registros**. A captura completa continua independente da aba selecionada; cada aba conserva seu controle de sonda.

Os resumos sao derivados apenas dos dados ja carregados no renderer e pertencem a sua aba:

- **Sistema** mostra o total e a distribuicao por nivel do resultado filtrado. A exportacao CSV usa exatamente essa lista filtrada.
- **Auditoria** diferencia `Registros encontrados`, retornado pela consulta, de `Registros carregados`, que corresponde aos ate 200 itens recentes exibidos na tabela. Sua exportacao CSV usa os itens carregados para os filtros atuais.
- **Linha do Tempo** mostra numero e status da REP encontrada, total de eventos e a separacao REP/laudo. `DualTrackTimeline` calcula essas contagens ao usar a consulta ja existente e entrega o resumo opcional a pagina; esse callback nao inicia consulta nem persistencia adicional.
- **Desempenho** deriva total, eventos criticos, operacoes lentas e maior duracao somente das amostras carregadas na aba. A exportacao CSV de desempenho permanece propria.

A Linha do Tempo nao oferece exportacao CSV. `DataTable` mantem a paginacao das listas, inclusive a de desempenho.

O historico de capturas apresenta qualidade e sondas sem evidencia, alem de permitir exportacao e exclusao manual. A exportacao escreve o JSON ja validado apos escolha de destino. O nome sugerido deriva de `iniciadaEm` no horario local, no formato `captura-logs-ddMMyyyy-HHmm.json`. Capturas iniciadas em minutos distintos recebem nomes sugeridos distintos; o dialogo ainda permite que o usuario altere o nome.

A limpeza geral e um fluxo protegido por senha com duas confirmacoes. O dialogo informa que a operacao remove registros tecnicos, amostras de desempenho e capturas centrais, alem da auditoria. Apos limpar com sucesso os arquivos de sistema, o handler tambem limpa desempenho e capturas centrais; a limpeza de auditoria ocorre pela chamada propria e registra a acao quando recebe o usuario atual.

## Manutencao e verificacao

Alteracoes na captura devem manter alinhados o contrato em `shared`, o servico, handler, allowlist e tipos do preload, a exposicao no renderer e os controles visuais. O teste `src/__tests__/main/captura-logs.service.test.ts` cobre exclusividade, limite de cinco minutos, parada e recuperacao, anonimização, retencao, resumo, qualidade e deteccao de pico lento diluido no mesmo codigo. Os testes de renderer cobrem os resumos de Logs, a distincao entre auditoria encontrada e carregada, os tres resultados da Linha do Tempo e os indicadores calculados pelas amostras carregadas de desempenho.
