# Diagnóstico assistido

## Escopo e fontes de verdade

O laWdo mantém dois mecanismos relacionados, mas independentes:

1. **Sessão MCP temporária**: habilitada somente no desenvolvimento por `npm run dev:diagnostico`; permite observação pontual e capturas guiadas de problema ou desempenho.
2. **Snapshots de falhas fatais**: gravados em `app.getPath('userData')/diagnostico-state-dumps`; participam do tratamento global de erros mesmo sem sessão MCP.

| Responsabilidade | Fonte canônica |
|---|---|
| Contratos, limites, envelopes e erros | `src/shared/diagnostico/contratos.ts` |
| Ativação, janelas e roteamento | `src/main/index.ts` |
| Sessão, credencial, retenção e eventos | `src/main/services/diagnostico-sessao.service.ts` e `diagnostico-eventos.service.ts` |
| Transporte local | `src/main/services/diagnostico-pipe.service.ts` e `src/main/diagnostico-mcp.ts` |
| Capturas e artefatos | `src/main/services/diagnostico-captura.service.ts` |
| Interface e ações | `src/main/services/diagnostico-interface.service.ts` |
| Desempenho | `src/main/services/diagnostico-desempenho.service.ts` |
| Instrumentação | `src/preload/index.ts` e `src/renderer/components/diagnostico/DiagnosticoBridge.tsx` |
| Source maps e marcadores | `src/main/services/diagnostico-source-map.service.ts` e `scripts/diagnostico/gerar-manifesto-fontes.mjs` |
| Falhas fatais fora do MCP | `src/main/services/diagnostico-state.service.ts`, `src/main/ipc/index.ts` e `src/main/utils/logger.ts` |

## Ativação e integração com o Codex

A sessão MCP inicia somente quando o aplicativo não está empacotado e `LAWDO_MODO_DIAGNOSTICO=1`. `npm run dev:diagnostico` define a variável, compila main, preload e renderer com source maps e gera `out/diagnostico-marcadores.json`. `npm run dev`, `npm start` e o aplicativo empacotado não abrem a sessão.

`npm run diagnostico:configurar-codex` substitui a configuração local `lawdoDiagnostico` por um servidor stdio que executa `out/main/diagnostico-mcp.js` com o workspace absoluto. O Codex precisa ser reiniciado depois.

```text
Codex → MCP stdio → sessao-ativa.json
      → named pipe/Unix socket autenticado → processo main
      → sessão, interface, eventos e captura
```

Não há porta TCP, avaliação livre de JavaScript, consulta SQLite arbitrária nem rede de diagnóstico. A interface usa scripts internos fechados; o agente envia somente entradas validadas.

## Sessão, autenticação e retenção

A sessão fica em `<workspace>/tmp/diagnostico-agente`. O caminho real do workspace gera `workspaceId` SHA-256 e nome estável do pipe. Cada execução recebe `sessionId` e token aleatórios.

`sessao-ativa.json` contém descoberta e credencial. No Windows, `icacls` restringe o arquivo ao usuário atual; falha da ACL remove a credencial e impede a sessão. O token é comparado em tempo constante e aparece redigido em `metadados.json`. Mensagem inválida ou token incorreto fecha a conexão sem resposta.

Existe no máximo uma sessão ativa por workspace. Credencial abandonada é removida quando o PID não está ativo. No encerramento, o pipe fecha antes da credencial; mesmo se o último evento falhar, `sessao-ativa.json` é removido.

A retenção preserva a sessão ativa e remove as mais antigas até restarem cinco e 100 MiB. A limpeza ocorre ao iniciar e encerrar, sem quota incremental durante a captura.

## Contrato MCP

O protocolo atual é versão `1`. Respostas carregam `ok`, `versaoProtocolo`, `requestId`, `sessionId` e `dados` ou `erro`. Os objetos Zod são estritos. O proxy MCP aguarda cinco segundos pelo pipe.

| Ferramenta | Estado atual |
|---|---|
| `diagnostico_status` | Sessão, cursor e janelas; sem sessão, orienta `npm run dev:diagnostico`. |
| `capturar_tela` | Janela focada/indicada ou região válida; janela visível e timeout de cinco segundos. |
| `inspecionar_interface` | Revisão com 500 elementos e profundidade 12 por padrão; máximos 1000 e 20. |
| `executar_acao` | Clique ou digitação em elemento revisionado; invalida a revisão. Texto até 20.000 caracteres. |
| `obter_eventos` | Cursor e filtros, com até 200 eventos. |
| `criar_snapshot` | Eventos, metadados e, quando disponíveis, tela e interface. |
| `iniciar_captura` | Finalidade `problema` ou `desempenho`; uma captura ativa por sessão. |
| `status_captura` | Somente captura ativa; não recupera uma concluída. |
| `finalizar_captura` | Gera o pacote; idempotente enquanto o resultado estiver em memória. |
| `consultar_captura` | Lê componentes em memória, pagina NDJSON e compara métricas. |

Os erros tipados cobrem entrada, sessão, autenticação, versão, janela, revisão, elemento, ação, timeout, captura parcial/concorrente/ausente/expirada/incompatível e erro interno.

## Eventos e privacidade

`DiagnosticoEventosService` atribui sequência monotônica, sanitiza, persiste NDJSON em fila e conserva cópia em memória. Linha inválida/incompleta é ignorada na releitura. A coleção em memória não tem limite.

A sanitização por chave redige senha, token, segredo, chave de API, CPF, RG, e-mail, telefone, foto, avatar e endereço. Objetos ficam em 100 chaves, arrays em 100 itens, profundidade em seis e strings em 2.000 caracteres. É heurística: chave sensível não reconhecida pode permanecer.

O preload mede início, sucesso, erro e duração dos IPCs sem payload. Na captura de problema, registra clique, alteração, imagem, wheel e scroll, com até oito contêineres roláveis. Scroll é limitado a 250 ms. Iframes TinyMCE de mesma origem são instrumentados; outros são ignorados.

A inspeção coleta nome, texto, valor de controles, geometria e estado acessível. Valor só é redigido quando o identificador corresponde à lista sensível. Screenshots e texto visível podem conter conteúdo pericial: são locais e temporários, mas não anonimizados.

`DiagnosticoBridge` envia rota, título, painel e somente `id`, `role/cargo` e `lotacao` do usuário. Também encaminha erros globais. Com MCP, eles entram na sessão e tentam resolver source map; o handler geral pode também gerar snapshot fatal em `userData`.

## Capturas guiadas

### Problema

Exige cenário de 10–500 caracteres. A linha de base escolhe janela indicada ou focada e tenta tela e interface; falhas parciais não impedem coleta. O cursor é fixado depois da linha de base, com buffer anterior de 20 eventos.

As sondas detalhadas ficam ativas por até dez minutos. A finalização aceita `reproduzido`, `nao_reproduzido` ou `interrompido`; sem resultado, usa `inconclusiva`. O classificador atual detecta salto grande entre scrolls consecutivos sem wheel e sugere `rolagem_programatica` e `mudanca_layout`; sem sinal, fica `inconclusiva`.

### Desempenho

Duração de 30–300 segundos, padrão 60; cenário `ocioso`, `abertura_laudo`, `uso_editor`, `painel_ia` ou `geral`. As sondas detalhadas ficam desligadas. `app.getAppMetrics()` é amostrado a cada segundo, por até 300 ciclos, com PID, tipo, CPU e working set.

O resumo calcula mediana, p95, máximo e tendência por PID/tipo. CPU p95 a partir de 20% e memória crescente viram gargalos. Não mede event loop, frames, tarefas longas, layout shifts nem percentis IPC.

A comparação calcula deltas por PID/tipo. Não valida cenário, finalidade, versão, duração ou ambiente e não correlaciona PIDs distintos. `compativel: true` significa apenas que ambos têm amostras.

## Artefatos, atomicidade e recuperação

```text
capturas/<timestamp>-<capturaId>/
├── manifesto.json
├── dossie-agente.json
├── linha-do-tempo.json
├── eventos.ndjson
├── erros-captura.json
├── metricas-resumo.json
├── amostras-processos.ndjson
├── interface-inicial.json
├── interface-final.json
├── tela-inicial.png
└── tela-final.png
```

Tela e interface são opcionais; eventos, erros e métricas são gravados. O dossiê limita a linha do tempo a 30 eventos e combina sinais, gargalos, marcadores, lacunas e próximos passos determinísticos.

O pacote é escrito em `.tmp` e renomeado ao fim; os arquivos são escritos em paralelo e falha intermediária pode deixar o temporário. O índice de capturas concluídas existe só em memória. Após reinício, os arquivos permanecem até a retenção, mas `consultar_captura` não os redescobre.

Na finalização automática, o manifesto registra `expirada`, inclusive quando desempenho chega normalmente ao prazo. Uma resposta posterior usa `finalizada`. Essa assimetria é atual.

## Source maps e marcadores

O resolvedor aceita somente arquivos sob `out/` e mapas v3 adjacentes. Origem externa, mapa ausente/inválido ou mapeamento ausente retornam motivo.

Os marcadores atuais são `layout.conteudo-principal` → `src/renderer/App.tsx`, `laudos.editor-scroll` → `src/renderer/pages/LaudosPage.tsx` e `painel-ia.dock` → `src/renderer/components/ai/AssistenteIaPanel.tsx`. Se o manifesto faltar, a sessão continua sem alvos.

## Snapshots fatais fora do MCP

`src/main/services/diagnostico-state.service.ts` guarda o último contexto e grava JSON por `uncaughtException`, `unhandledRejection`, `error` ou `unhandledrejection`, com erro, contexto, versões, memória e sistema operacional.

Sua sanitização é separada: strings até 500 caracteres, arrays até 20 e profundidade cinco. Os arquivos em `userData/diagnostico-state-dumps` não entram na retenção temporária nem são consultáveis pelo MCP.

## Invariantes e alterações coordenadas

Mudança de contrato exige alinhar `contratos.ts`, registro MCP, roteamento no main e testes. Nova sonda exige preload, canal permitido, listener, sanitização e custo.

O MCP permanece condicionado a execução não empacotada e variável explícita. A credencial não vai a logs/metadados e falha de ACL impede sessão. O renderer continua sem Node/Electron.

A ação usa `janelaId + revisao + elementoId` e invalida a revisão. O agente não fornece seletor arbitrário persistível.

## Verificação existente

Os testes cobrem contratos/envelopes; ativação, pipe, credencial, ACL e encerramento; autenticação/`requestId`; NDJSON, cursor e sanitização; captura única, artefato e idempotência; métricas/comparação; e source maps.

Não há teste dedicado para `DiagnosticoInterfaceService`, roteamento integrado das dez operações, sondas preload/TinyMCE, recuperação após reinício, retenção durante captura ou snapshots fatais.
