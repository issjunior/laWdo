# Planejamento: Modo de Diagnóstico Assistido

> **Status:** Planejado
> **Data:** 26/06/2026
> **Objetivo:** criar uma trilha local de eventos e erros em tempo real para investigar falhas sem depender de relato manual do usuário.

## Resumo

O sistema terá um **modo de diagnóstico local**, voltado para investigação assistida de bugs em tempo real. Quando ativado manualmente, ele gravará eventos relevantes do `main`, `renderer`, navegação e IPC em arquivos dentro do projeto.

A decisão para v1 é **não** expor uma API REST como mecanismo principal de observabilidade. O modo diagnóstico é mais adequado para capturar a sequência completa de eventos que antecede travamentos, erros intermitentes e estados inválidos.

## Decisão Arquitetural

### Solução escolhida

Implementar um modo de diagnóstico:

- **desligado por padrão**
- ativado manualmente pelo usuário
- com sessão local por pasta
- com escrita incremental em arquivo texto estruturado
- sem dependência de servidor externo

### Solução não escolhida para v1

Não implementar API REST como canal principal de inspeção.

Motivos:

- API REST expõe melhor **estado atual** do que **histórico do comportamento**
- bugs de congelamento exigem reconstruir a trilha de eventos até a falha
- para observabilidade real em tempo real, a API acabaria exigindo buffer de eventos, polling ou streaming adicional
- o projeto já possui base de logs no `main` e canais IPC, o que reduz o custo do modo diagnóstico

## Escopo da v1

O modo diagnóstico deve registrar, em tempo real:

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

## Estrutura da Coleta

Ao iniciar o modo diagnóstico, o sistema criará uma sessão em:

```text
diagnostico-sessoes/<data-hora>/
```

Arquivos mínimos da sessão:

- `eventos.ndjson`: trilha principal de eventos, um JSON por linha
- `resumo.json`: metadados básicos da sessão, opcional na primeira entrega

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

Com essa abordagem, a investigação passa a ter acesso direto a:

- sequência exata de ações antes do erro
- warnings e exceptions do `main` e do `renderer`
- duração de operações sensíveis
- relação entre ação do usuário, IPC e efeito no laudo
- contexto mínimo para correlacionar o problema com REP, template e laudo específicos

Isso é mais útil para diagnóstico de causa raiz do que uma API REST isolada, porque prioriza **comportamento ao longo do tempo**, e não apenas o estado atual da aplicação.

## Validação da Entrega

Critérios mínimos:

- o modo diagnóstico inicia desligado
- ao ativar, cria pasta de sessão no projeto
- eventos passam a ser gravados em `eventos.ndjson`
- erros do `main` e do `renderer` aparecem na trilha
- navegação e IPC crítico aparecem com contexto e duração
- ao desativar, novos eventos deixam de ser gravados
- os arquivos continuam legíveis após encerramento inesperado

Validação técnica esperada na implementação:

- `npm run type-check`
- `npm run lint`

## Próximo Passo

Se a v1 de diagnóstico ainda não bastar para identificar a causa raiz de um bug específico, a próxima etapa será aprofundar a instrumentação dos fluxos de REP, template e sincronização de seções, mantendo a mesma infraestrutura de sessão local.
