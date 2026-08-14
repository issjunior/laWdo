# Diagnóstico assistido

## Objetivo e escopo

O diagnóstico assistido permite a um agente conectado ao Codex observar uma execução local de desenvolvimento do laWdo, capturar evidências estruturadas e investigar problemas reproduzíveis ou desempenho sem expor uma porta de rede, avaliar JavaScript livremente ou consultar o banco arbitrariamente.

Ele tem dois mecanismos independentes:

1. **Sessão MCP temporária**: disponível apenas em desenvolvimento com `npm run dev:diagnostico`. Expõe observação pontual e capturas guiadas.
2. **Snapshots de falhas fatais**: gravados localmente em `app.getPath('userData')/diagnostico-state-dumps`, inclusive quando não há sessão MCP.

O diagnóstico não é habilitado por `npm run dev`, `npm start` nem pelo aplicativo empacotado.

## Instalação e ativação

No computador de desenvolvimento que executará o aplicativo:

```powershell
npm ci
npm run build
npm run diagnostico:configurar-codex
npm run dev:diagnostico
```

Depois de configurar o MCP, reinicie o Codex. A configuração registra o servidor local `lawdoDiagnostico`, que executa `out/main/diagnostico-mcp.js` para aquele workspace.

Para usar em outro computador, repita todo o procedimento no clone local: instale Node.js 24 ou superior, obtenha as dependências com `npm ci`, gere o build e execute `npm run diagnostico:configurar-codex` naquele computador. A configuração é local porque contém o caminho absoluto do workspace; não deve ser copiada de outra máquina. Inicie sempre uma nova sessão com `npm run dev:diagnostico`.

Confirmação inicial recomendada:

```text
diagnostico_status
```

A resposta deve indicar sessão conectada e modo de diagnóstico ativo. Se não houver sessão, a orientação retornada é iniciar `npm run dev:diagnostico`.

## Arquitetura e fontes de verdade

```text
Codex → MCP stdio → tmp/diagnostico-agente/sessao-ativa.json
      → named pipe autenticado → processo main
      → sessão, interface, eventos e capturas
```

| Responsabilidade | Fonte canônica |
|---|---|
| Contratos, limites e envelopes | `src/shared/diagnostico/contratos.ts` |
| Inicialização e roteamento | `src/main/index.ts` |
| Sessão, credencial, retenção e eventos | `src/main/services/diagnostico-sessao.service.ts` e `diagnostico-eventos.service.ts` |
| Transporte MCP e pipe | `src/main/diagnostico-mcp.ts` e `diagnostico-pipe.service.ts` |
| Capturas e artefatos | `diagnostico-captura.service.ts` |
| Interface e ações revisionadas | `diagnostico-interface.service.ts` |
| Métricas e comparação | `diagnostico-desempenho.service.ts` |
| Instrumentação do renderer | `src/preload/index.ts` |
| Source maps e marcadores | `diagnostico-source-map.service.ts` e `scripts/diagnostico/gerar-manifesto-fontes.mjs` |

O protocolo é versão 1. As entradas são schemas Zod estritos; toda resposta contém `ok`, `versaoProtocolo`, `requestId`, `sessionId` e `dados` ou `erro`. O proxy MCP espera até cinco segundos pela sessão local.

## Modos de uso

### Inspeção pontual

Use para confirmar o estado atual antes de aprofundar uma hipótese.

- `capturar_tela`: captura a janela ou uma região.
- `inspecionar_interface`: retorna a árvore acessível revisionada; padrão de 500 elementos/profundidade 12, máximos 1000/20.
- `executar_acao`: clica ou digita apenas em `janelaId + revisao + elementoId` retornados pela inspeção; a revisão é invalidada após a ação.
- `obter_eventos`: consulta eventos por cursor e filtros, até 200 por chamada.
- `criar_snapshot`: grava um artefato coerente de tela, interface, eventos e metadados.

Exemplo: ao suspeitar que um botão está desabilitado indevidamente, chame `inspecionar_interface`, localize o elemento retornado, execute um clique tipado e consulte os eventos subsequentes. Não solicite nem use seletor CSS, cursor de banco, JavaScript arbitrário ou consulta SQLite.

### Captura guiada de problema

Use para erro recorrente, intermitente ou difícil de explicar — inclusive salto de rolagem, falha visual, erro de renderer e IPC lento.

1. Chame `diagnostico_status`.
2. Inicie `iniciar_captura` com `finalidade: "problema"` e uma descrição concreta de 10 a 500 caracteres.
3. Peça ao usuário apenas para reproduzir o cenário uma vez.
4. Chame `finalizar_captura` com `resultadoUsuario: "reproduzido"`, `"nao_reproduzido"` ou `"interrompido"`.
5. Leia `dossie`, `manifesto`, `eventos`, `timeline` e, quando necessário, telas ou interface.

Exemplo de entrada:

```json
{
  "finalidade": "problema",
  "cenario": "A rolagem salta ao abrir uma seção com imagens no editor."
}
```

A captura mantém sondas detalhadas por até dez minutos, inclui uma linha de base e buffer anterior de 20 eventos. Ela registra ações, wheel/scroll, foco, teclas, mutações estruturais, redimensionamentos, layout shifts, eventos TinyMCE de mesma origem, erros e durações de IPC sem payload. O dossiê pode sinalizar rolagem programática, alteração de layout, erro ou IPC correlacionado; esses sinais são hipóteses, não diagnóstico conclusivo.

### Captura de desempenho

Use para verificar saúde, regressão ou efeito de uma alteração em `ocioso`, `abertura_laudo`, `uso_editor`, `painel_ia` ou `geral`.

1. Chame `diagnostico_status`.
2. Inicie `iniciar_captura` com `finalidade: "desempenho"`.
3. Mantenha o cenário escolhido em uso normal durante 30 a 300 segundos (60 por padrão).
4. Aguarde a finalização automática e use `consultar_captura` para `metricas_resumo`, `amostras_processos` ou `dossie`.

Exemplo:

```json
{
  "finalidade": "desempenho",
  "cenarioDesempenho": "uso_editor",
  "duracaoSegundos": 60
}
```

A captura amostra `app.getAppMetrics()` a cada segundo e agrega CPU, working set e atraso do event loop por PID/tipo. O resumo calcula mediana, p95, máximo e tendência; CPU p95 de pelo menos 20% e memória crescente são gargalos. IPC com p95 de pelo menos 250 ms também aparece no resumo.

Para comparar antes/depois, use `consultar_captura` com `compararComCapturaId` e componente `dossie` ou `metricas_resumo`. Compare apenas capturas do mesmo cenário e versão de protocolo. A resposta recusa contextos incompatíveis e traz deltas absolutos e percentuais de CPU, memória e atraso do event loop. PIDs continuam sendo parte da chave de comparação; processos recriados podem não ter par equivalente.

### Consulta de artefatos

`consultar_captura` acessa componentes tipados da captura concluída. `eventos` e `amostras_processos` são paginados por `depoisDe` e `limite`; telas retornam imagem. A consulta de capturas concluídas depende do índice em memória da sessão atual: depois de reiniciar o aplicativo, os arquivos podem continuar no disco, mas não são redescobertos automaticamente.

## Artefatos, segurança e limites

Cada captura é criada em diretório temporário e renomeada somente ao fim:

```text
capturas/<timestamp>-<capturaId>/
├── manifesto.json
├── dossie-agente.json
├── resumo.md
├── contexto-execucao.json
├── marcadores-interface.json
├── linha-do-tempo.json
├── eventos.ndjson
├── erros-captura.json
├── metricas-resumo.json
├── amostras-processos.ndjson
└── tela/interface inicial e final, quando coletadas
```

Uma captura de desempenho não coleta tela nem interface. Ela retém no máximo 300 amostras normalizadas, reserva até 8 MiB aos dados NDJSON e reduz ao perfil essencial sob pressão de persistência ou atraso do event loop. Nesse perfil, conserva apenas processos Browser/GPU e registra a degradação no resumo. Essa condição limita a qualidade da evidência e deve ser considerada antes de concluir que não existe gargalo.

A sessão usa token aleatório, pipe local e ACL do usuário atual no arquivo de descoberta. Não abre porta TCP. O token é comparado em tempo constante e não entra em logs ou metadados. A sanitização redige campos sensíveis, valores e texto visível de eventos; screenshots e estrutura de interface ainda podem conter conteúdo pericial, portanto ficam locais e temporários. Não transfira artefatos sem avaliar o conteúdo.

A retenção preserva a sessão ativa e remove sessões antigas até restarem cinco e 100 MiB. Escritas de artefato podem falhar parcialmente antes do rename, deixando diretório `.tmp`.

## Invariantes e alteração coordenada

- O renderer não recebe Node/Electron; toda ação continua pela ponte segura.
- O MCP só existe no desenvolvimento não empacotado e com variável explícita.
- Mudança de ferramenta deve manter alinhados contratos compartilhados, registro MCP, roteamento no main e testes.
- Nova sonda deve definir sanitização, custo, eventos e desligamento.
- Ação de interface exige uma revisão válida; não introduza seletor arbitrário persistível.
- Comparação de desempenho só é interpretável sob o mesmo cenário e protocolo.

## Verificação

A cobertura automatizada inclui contratos/envelopes, sessão, ACL, pipe, encerramento, NDJSON, sanitização, captura única, artefato, idempotência, limite de amostras, degradação, métricas, comparação e source maps.

A validação manual complementar é iniciar `npm run dev:diagnostico`, confirmar `diagnostico_status` e executar uma captura curta do cenário desejado. Não há teste automatizado de Electron com a janela real para todas as sondas de preload/TinyMCE, recuperação de capturas após reinício ou retenção durante captura.
