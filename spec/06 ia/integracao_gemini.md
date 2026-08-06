# Gemini como provedor de IA

## Papel e configuração

Gemini usa o endpoint OpenAI-compatível `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`. `ModelosIAPage.tsx` persiste `provedor_ia = 'gemini'`, chave e modelo padrão; a chave permanece no main. O catálogo compartilhado registra capacidade de visão, MIME, limites de imagem e orçamento. Modelo ausente ou incompatível recai no padrão do Gemini, sem fallback para Groq.

O perfil versionado `perfil_resposta_ia` contém tom, detalhamento, instruções personalizadas e temperatura entre 0 e 1, em passos de 0,1. Perfis ausentes, legados ou inválidos recebem o padrão, com temperatura 0,2.

## Execução e invariantes

O `IaExecucaoService` fotografa provedor, modelo, perfil e privacidade antes do planejamento. Cada chamada textual recebe a instrução fixa de segurança, a ação, o pedido explícito do usuário, o perfil e `temperature`; documento e contexto são conteúdo não confiável e não podem orientar o modelo. Respostas são JSON estruturado e validadas localmente, com tentativa compatível quando `response_format` é rejeitado.

Descrição multimodal exige modelo Gemini com visão e imagem persistida válida. No modo `legenda`, o serviço exige legenda técnico-pericial em uma linha, sem prefixo ou quebra, limitada a 15 palavras; no modo normal retorna apenas descrição simples para cópia manual.

Timeout, retries, cancelamento, checkpoints e privacidade são comuns aos dois provedores e estão em `spec/06 ia/painel_assistente_ia.md`. Chaves, prompts, respostas, documentos e imagens não entram em logs.
