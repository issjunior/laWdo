# Gemini como provedor de IA

## Papel e configuração

Gemini usa o endpoint OpenAI-compatível `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`. `ModelosIAPage.tsx` persiste `provedor_ia = 'gemini'`, chave e modelo padrão; a chave permanece no main. O catálogo compartilhado registra capacidade de visão, MIME, limites de imagem e orçamento. Modelo ausente ou incompatível recai no padrão do Gemini, sem fallback para Groq.

O perfil versionado `perfil_resposta_ia` contém tom, detalhamento, instruções personalizadas e temperatura entre 0 e 1, em passos de 0,1. Perfis ausentes, legados ou inválidos recebem o padrão, com temperatura 0,2.

## Observação sobre Gemini Enterprise

O usuário utiliza Gemini Enterprise pelo link `https://vertexaisearch.cloud.google.com/home/cid/b417bc3f-ab4d-444d-a66c-6ded42f69850?hl=pt_BR`. Esta informação é contexto para futuras investigações: o uso do produto corporativo no navegador pode apresentar regras, limites ou comportamento distintos da Gemini Developer API configurada no laWdo.

A observação não altera o provedor ativo nem permite, por si só, inferir equivalência entre cotas, credenciais, projeto ou respostas dos dois serviços. Ao comparar falhas ou limites, registre o produto e o endpoint envolvidos antes de concluir a causa.

## Execução, limites e invariantes

O `IaExecucaoService` fotografa provedor, modelo, perfil e privacidade antes do planejamento. Cada chamada textual recebe a instrução fixa de segurança, a ação, o pedido explícito do usuário, o perfil e `temperature`; documento e contexto são conteúdo não confiável e não podem orientar o modelo. Respostas são JSON estruturado e validadas localmente, com tentativa compatível quando `response_format` é rejeitado.

Descrição multimodal exige modelo Gemini com visão e imagem persistida válida. No modo `legenda`, o serviço exige legenda técnico-pericial em uma linha, sem prefixo ou quebra, limitada a 15 palavras; no modo normal retorna apenas descrição simples para cópia manual.

Uma resposta HTTP 429 só é apresentada como tipo específico de limite quando o provedor oferece metadados estruturados reconhecíveis. Sem `QuotaFailure`, `RetryInfo` ou cabeçalho de prazo, a UI informa HTTP 429 sem identificar a causa ou prometer reativação. Em modo diagnóstico, o evento terminal `limite_uso_ia` registra somente metadados permitidos (provedor, modelo, status, tentativa, categoria conhecida, formato/MIME da resposta e campos estruturados de cota); chave, prompt, corpo bruto, mensagem do provedor, documento e imagem não entram em eventos. Respostas-array não documentadas são classificadas como formato observado, não como prova de cota.

Timeout, retries, cancelamento, checkpoints e privacidade são comuns aos dois provedores e estão em `spec/06 ia/painel_assistente_ia.md`. Chaves, prompts, respostas, documentos e imagens não entram em logs.
