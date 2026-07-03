# Planejamento: Modo de Diagnóstico Assistido

> **Status:** Planejado
> **Data:** 26/06/2026 — atualizado em 01/07/2026
> **Objetivo:** permitir que qualquer agente de IA realize diagnósticos, medições de desempenho e testes de forma autônoma, sem depender de relato manual do usuário.

## Resumo

O sistema terá um **modo de diagnóstico local** em três camadas complementares, voltado para investigação assistida de bugs, medição de desempenho e execução de testes em tempo real.

As três camadas são independentes e se complementam:

- **Camada 1 — Arquivos** (`eventos.ndjson`, logs Winston): universal, funciona com qualquer agente local que leia arquivos.
- **Camada 2 — Terminal** (`npm test`, `npm run lint`, `npm run type-check`): qualquer agente com acesso ao terminal executa e lê resultados.
- **Camada 3 — CDP** (Chrome DevTools Protocol via `--remote-debugging-port`): agentes com MCP de DevTools conectam ao renderer em tempo real.

A decisão para v1 é **não** expor uma API REST como mecanismo principal de observabilidade. O modo diagnóstico por arquivo é mais adequado para capturar a sequência completa de eventos que antecede travamentos, erros intermitentes e estados inválidos.

## Arquitetura em Três Camadas

### Camada 1 — Arquivos de sessão (universal)

Cobre: `main process`, `renderer`, `IPC`, navegação, ações do usuário.

Qualquer agente local com acesso ao sistema de arquivos lê `eventos.ndjson` e os logs Winston sem configuração adicional. É a camada mais portátil e agnóstica de ferramenta.

Escopo:
- trilha cronológica de eventos em `diagnostico-sessoes/<data-hora>/eventos.ndjson`
- snapshot de estado em erros fatais
- logs Winston em `combined.log` e `error.log`

### Camada 2 — Terminal (universal para agentes locais)

Cobre: testes unitários, análise estática, verificação de tipos.

Comandos que qualquer agente local executa diretamente:

```bash
npm test                # Vitest — roda todos os testes e retorna resultado
npm run test:coverage   # cobertura com threshold 70%
npm run lint            # ESLint
npm run type-check      # TypeScript sem emitir arquivos
npm run dead-code:check # ts-prune nos 3 tsconfigs
```

### Camada 3 — Chrome DevTools Protocol (agentes com MCP de CDP)

Cobre: renderer em tempo real — console, exceptions, performance, heap, DOM.

O Electron expõe o DevTools Protocol via flag `--remote-debugging-port`. Com a porta aberta, agentes equipados com `chrome-devtools-mcp` ou `playwright-mcp` conectam em `http://localhost:9222` e ganham:

| Capacidade | O que o agente acessa |
|---|---|
| Console logs | `console.log/warn/error` do renderer em tempo real |
| Exceptions | Stacktrace completo com linha e coluna |
| Performance | Timeline de CPU, heap, FPS, layout thrashing |
| Network | Requisições HTTP (Gemini, Groq, etc.) |
| Executar JS | Inspecionar estado React no contexto do renderer |
| DOM | Árvore de componentes e estilos computados |

**Limitação**: CDP alcança apenas o renderer. O main process e IPC continuam cobertos exclusivamente pela Camada 1.

#### Script de desenvolvimento com debug

Adicionar ao `package.json`:

```json
"dev:debug": "npm run build && electron . --remote-debugging-port=9222"
```

O script `dev` padrão permanece sem a flag, para não expor a porta em execuções normais.

## Compatibilidade com Agentes de IA

| Agente | Camada 1 (arquivos) | Camada 2 (terminal) | Camada 3 (CDP) |
|---|---|---|---|
| Antigravity / Gemini | ✅ | ✅ | ✅ (chrome-devtools-plugin instalado) |
| Cursor | ✅ | ✅ | ✅ com playwright-mcp ou chrome-devtools-mcp |
| Windsurf | ✅ | ✅ | ✅ com MCP configurado |
| Claude.ai / ChatGPT web | ❌ sem acesso local | ❌ | ❌ |

O denominador comum mais portátil é a Camada 1. O `eventos.ndjson` torna o diagnóstico independente de ferramenta específica.

## Decisão Arquitetural

### Solução escolhida

Implementar diagnóstico em três camadas:

- **Camada 1**: desligada por padrão, ativada manualmente pelo usuário, sessão local por pasta, escrita incremental em NDJSON, sem dependência externa.
- **Camada 2**: sempre disponível, sem configuração — basta rodar o comando.
- **Camada 3**: disponível apenas quando o app é iniciado com `dev:debug`, sem impacto na execução normal.

### Solução não escolhida para v1

Não implementar API REST como canal principal de inspeção.

Motivos:

- API REST expõe melhor **estado atual** do que **histórico do comportamento**
- bugs de congelamento exigem reconstruir a trilha de eventos até a falha
- para observabilidade real em tempo real, a API acabaria exigindo buffer de eventos, polling ou streaming adicional
- o projeto já possui base de logs no `main` e canais IPC, o que reduz o custo do modo diagnóstico

## Escopo da v1

O modo diagnóstico (Camada 1) deve registrar, em tempo real:

- logs do `main`
- erros não tratados do `main`
- logs enviados pelo `renderer`
- erros globais do `renderer`
- navegação entre telas
- ações relevantes do usuário ligadas a REP, template e laudo
- início, fim, duração e erro de IPC crítico

Fluxos prioritários:

- `rep:*`
- `template:*`
- `laudo:*`
- sincronização de seções
- geração e atualização do conteúdo do laudo

Não entram na v1:

- replay visual
- gravação de vídeo
- dump completo do banco
- dump integral de formulário
- envio de dados para servidor externo
- API REST de consulta

Entram como complemento útil de baixo risco:

- snapshot enxuto de estado em erro fatal global
- rota atual
- contexto mínimo higienizado do renderer
- recursos básicos do processo e do sistema operacional

## Estrutura da Coleta

Ao iniciar o modo diagnóstico, o sistema criará uma sessão em:

```text
diagnostico-sessoes/<data-hora>/
```

Arquivos mínimos da sessão:

- `eventos.ndjson`: trilha principal de eventos, um JSON por linha
- `resumo.json`: metadados básicos da sessão, opcional na primeira entrega

Arquivos complementares quando houver falha fatal:

- `estado-snapshot.json`: fotografia do estado mínimo disponível no momento do erro

O arquivo `eventos.ndjson` deve ser escrito de forma incremental, para que os eventos já registrados continuem legíveis mesmo se a aplicação travar ou fechar de forma inesperada.

## Formato dos Eventos

Cada evento deve seguir um formato estável, suficiente para leitura manual e automática:

```json
{
  "timestamp": "2026-06-26T14:30:00.000Z",
  "sessaoId": "2026-06-26_14-30-00",
  "origem": "main",
  "tipo": "ipc:fim",
  "mensagem": "laudo:sincronizarSecoes concluído",
  "contexto": {
    "rota": "/laudos/12",
    "repId": 34,
    "laudoId": 12,
    "templateId": 7,
    "duracaoMs": 184
  }
}
```

Campos esperados:

- `timestamp`
- `sessaoId`
- `origem`: `main`, `renderer`, `ipc` ou `ui`
- `tipo`
- `mensagem`
- `contexto`

Contexto desejável quando disponível:

- `rota`
- `repId`
- `laudoId`
- `templateId`
- `duracaoMs`
- resumo de erro

## Snapshot de Estado em Erros Fatais

Além da trilha cronológica, o diagnóstico pode produzir um snapshot enxuto quando ocorrer erro global não tratado no `main` ou no `renderer`.

Objetivo:

- reduzir a ambiguidade sobre o estado exato da tela no momento do travamento
- complementar a trilha temporal com uma fotografia mínima do sistema
- manter baixo risco de exposição de dados sensíveis

Conteúdo desejado do snapshot:

- rota atual do renderer
- contexto mínimo da janela
- estado de sessão higienizado
- recursos básicos do processo Electron
- versão do sistema operacional
- resumo do erro fatal

Regras:

- não gravar dump integral de formulário
- não gravar conteúdo bruto sensível de periciando
- higienizar campos como senha, token, email, telefone, foto, avatar, CPF, RG e similares
- limitar profundidade e tamanho de strings para evitar snapshots explosivos

Esse snapshot não substitui `eventos.ndjson`. Ele só complementa o diagnóstico quando a causa raiz depende do estado atual da tela, e não apenas da sequência de eventos.

## Interface do Usuário

O sistema deve oferecer um controle simples para:

- verificar se o diagnóstico está ativo
- iniciar o diagnóstico
- parar o diagnóstico
- abrir a pasta da sessão atual

Regras de comportamento:

- o modo inicia sempre desligado ao abrir o aplicativo
- enquanto desligado, não grava trilha adicional de diagnóstico
- ao parar, encerra a sessão atual de forma limpa
- se o app cair no meio da execução, os eventos já persistidos devem permanecer disponíveis

## Contratos de Integração

Novos canais IPC previstos:

- `diagnostico:status`
- `diagnostico:iniciar`
- `diagnostico:parar`
- `diagnostico:abrirPastaSessao`

O `preload` deve expor esses comandos em `window.ipcAPI`.

O modo diagnóstico deve coexistir com o sistema atual de logs. Ele não substitui `combined.log` e `error.log`; apenas cria uma trilha orientada a investigação de sessão.

## Benefício Esperado

Com essa abordagem, qualquer agente de IA local passa a ter acesso direto a:

- sequência exata de ações antes do erro (Camada 1)
- warnings e exceptions do `main` e do `renderer` (Camada 1)
- duração de operações sensíveis (Camada 1)
- relação entre ação do usuário, IPC e efeito no laudo (Camada 1)
- contexto mínimo para correlacionar o problema com REP, template e laudo específicos (Camada 1)
- resultado de testes, lint e type-check sem intervenção do usuário (Camada 2)
- console e performance do renderer em tempo real (Camada 3, quando `dev:debug`)

Isso elimina a necessidade de o usuário copiar e colar mensagens de erro manualmente. O agente lê os arquivos, executa os comandos e conecta ao renderer diretamente.

## Validação da Entrega

Critérios mínimos:

- o modo diagnóstico inicia desligado
- ao ativar, cria pasta de sessão no projeto
- eventos passam a ser gravados em `eventos.ndjson`
- erros do `main` e do `renderer` aparecem na trilha
- navegação e IPC crítico aparecem com contexto e duração
- ao desativar, novos eventos deixam de ser gravados
- os arquivos continuam legíveis após encerramento inesperado
- `dev:debug` inicia o Electron com `--remote-debugging-port=9222`
- agente conectado ao CDP enxerga console e exceptions do renderer em tempo real

Validação técnica esperada na implementação:

- `npm run type-check`
- `npm run lint`

## Fase 2 — Testes Automatizados Assistidos por Diagnóstico

Depois da v1 estabilizar a coleta de eventos, o modo diagnóstico poderá ser usado como camada de observabilidade para testes automatizados de fluxo real no Electron.

Objetivo:

- permitir que testes E2E validem não apenas o estado final da interface, mas também a trilha interna de comportamento
- facilitar a investigação automática de falhas intermitentes, travamentos, lentidão e erros silenciosos
- dar ao agente de IA evidências objetivas sobre navegação, IPC, erros globais e duração de operações durante a execução do teste

Divisão de responsabilidades:

- **Playwright/CDP**: controla a interface, clica, preenche campos, navega e verifica DOM
- **Vitest**: continua cobrindo services, validações, funções puras e handlers isolados
- **Modo diagnóstico**: registra eventos, erros, durações de IPC, rota atual e snapshots higienizados durante a execução

Fluxo esperado de um teste E2E com diagnóstico:

1. iniciar o Electron em modo `dev:debug`
2. ativar uma sessão de diagnóstico por IPC ou pela interface
3. executar o fluxo automatizado no renderer
4. parar a sessão de diagnóstico ao final
5. ler `eventos.ndjson`, logs e snapshots gerados
6. falhar o teste se forem encontrados erros fatais, rejeições não tratadas, IPC crítico com erro ou duração acima do limite definido

Exemplos de cenários úteis:

- criar REP, gerar laudo e sincronizar seções sem erro global ou IPC crítico falho
- importar template e confirmar que os eventos esperados aparecem na ordem correta
- medir duração de `laudo:sincronizarSecoes` e sinalizar regressões de performance
- reproduzir fluxo que falha intermitentemente e anexar a trilha `eventos.ndjson` como evidência

Essa fase não transforma o modo diagnóstico em motor de automação. O controle da UI deve continuar com Playwright/CDP; o diagnóstico atua como fonte de verdade complementar para explicar o que ocorreu por baixo da interface.

## Próximo Passo

Se a v1 de diagnóstico ainda não bastar para identificar a causa raiz de um bug específico, a próxima etapa será aprofundar a instrumentação dos fluxos de REP, template e sincronização de seções, mantendo a mesma infraestrutura de sessão local.

Para bugs exclusivos do renderer que exijam inspeção de estado React em tempo real, avaliar a adição do canal `diagnostico:lerEventos` via IPC — retornando as últimas N linhas do `eventos.ndjson` diretamente na interface, sem exigir que o usuário abra o arquivo.
