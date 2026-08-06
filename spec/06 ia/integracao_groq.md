# Groq como provedor de IA

## Papel e configuração

Groq é um provedor OpenAI-compatível e o fallback quando `provedor_ia` está ausente ou diferente de `gemini`. `ModelosIAPage.tsx` persiste provedor, chave e modelo; a chave é recuperada somente no main. O catálogo compartilhado `src/shared/catalogos/modelos-ia.catalogo.ts` define modelos, visão, MIME, limite de imagem e orçamento de contexto. Modelo salvo incompatível recai no padrão do próprio Groq, sem fallback para Gemini.

A página também persiste `perfil_resposta_ia`: tom, detalhamento, instruções personalizadas e temperatura de 0 a 1, em passos de 0,1. Perfil ausente, legado ou inválido recebe o padrão, cuja temperatura é 0,2.

## Execução e invariantes

`IaExecucaoService` fotografa provedor, modelo, perfil e privacidade antes de planejar e usa essa fotografia durante todos os lotes. Para cada chamada textual, envia a instrução fixa de segurança, a ação, o pedido do usuário, o perfil e `temperature`; o pedido não é confundido com instruções encontradas no documento. A resposta continua sendo JSON validado localmente, com uma tentativa compatível sem `response_format` quando necessária.

A descrição multimodal requer modelo Groq com visão. No modo `legenda`, a solicitação exige uma única linha técnico-pericial, sem prefixo ou quebra, com no máximo 15 palavras; no modo normal retorna descrição simples para cópia manual. O renderer envia somente IDs, e o main valida vínculo, MIME e tamanho antes de ler a imagem persistida.

Timeout, retries, cancelamento, checkpoints e privacidade são compartilhados com Gemini e descritos em `spec/06 ia/painel_assistente_ia.md`. Chaves, prompts, respostas, documentos e imagens não entram em logs.
