# Groq como provedor de IA

## Papel e configuração

Groq é um dos dois provedores OpenAI-compatíveis e o fallback quando `provedor_ia` está ausente ou diferente de `gemini`. A página `ModelosIAPage.tsx` persiste `provedor_ia`, `api_key_groq` e `modelo_ia_padrao`; chaves são recuperadas somente no main. O teste de conexão usa o canal específico `ia:testar-conexao`, não o fluxo legado de pergunta.

Endpoint: `https://api.groq.com/openai/v1/chat/completions`.

O catálogo compartilhado `src/shared/catalogos/modelos-ia.catalogo.ts` é a fonte de verdade para modelos, capacidade de visão, MIME, limite de imagem e orçamento de contexto:

- `llama-3.3-70b-versatile`: padrão textual;
- `meta-llama/llama-4-scout-17b-16e-instruct`: visão JPEG/PNG até 4 MiB;
- `gemma2-9b-it`;
- `mixtral-8x7b-32768`.

Um modelo salvo que não pertença à Groq cai no modelo padrão do próprio provedor. Não existe fallback silencioso para Gemini.

## Execução atual

O painel novo usa `ia:planejar`, `ia:executar`, `ia:descrever-imagem`, `ia:cancelar` e eventos tipados de progresso. `IaExecucaoService` carrega provedor, modelo, chave, perfil e privacidade no início do plano e preserva essa fotografia durante todos os lotes. O corpo textual solicita JSON estruturado; se o modelo rejeitar `response_format`, a chamada é repetida em modo compatível e a validação local continua obrigatória.

Lotes são sequenciais e atômicos para o renderer. Cada chamada tem timeout de 120 segundos. Rede, 408, 429 e 5xx admitem até duas repetições, com `Retry-After` limitado a 30 segundos ou backoff com jitter. Respostas vazias, fragmentos fora do contrato e respostas tardias após cancelamento são rejeitadas.

A descrição multimodal só usa um modelo Groq com `suportaVisao`. O renderer envia IDs; o main carrega a imagem persistida, valida pertencimento, MIME e tamanho e envia um único conteúdo multimodal. A resposta é texto para cópia manual e não altera o laudo.

## Compatibilidade legada e invariantes

Os canais legados `ia:revisarOrtografia`, `ia:adequarEscrita` e `ia:perguntar` ainda existem para consumidores antigos, mas não definem o contrato do painel destacável. O canal legado que aceitava data URI ou URL de imagem pelo renderer foi removido.

Manutenções devem preservar o catálogo compartilhado, as validações de fronteira IPC, o isolamento das chaves no main, a ausência de fallback entre provedores e a proibição de registrar conteúdo pericial. O fluxo completo do painel está em `spec/06 ia/painel_assistente_ia.md`.
