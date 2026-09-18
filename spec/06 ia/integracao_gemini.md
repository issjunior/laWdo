# Gemini como provedor de IA

## Papel e configuração

Gemini usa `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions` em modo OpenAI-compatível. `ModelosIAPage.tsx` persiste provedor, chave e modelo padrão localmente; a chave é tratada no processo principal. O catálogo compartilhado declara visão, MIME, limites de imagem e orçamento. Modelo inexistente no catálogo é rejeitado como `MODELO_INDISPONIVEL`; não há fallback silencioso para Groq.

O perfil versionado `perfil_resposta_ia` contém tom, detalhamento, instruções e temperatura entre 0 e 1, em passos de 0,1. Perfil ausente, legado ou inválido recebe o padrão com temperatura 0,2. O uso de Gemini Enterprise no navegador não prova equivalência de credenciais, cotas ou endpoint com a Gemini Developer API usada pelo laWdo.

## Teste de conexão

O teste valida a configuração que está aberta no formulário, sem exigir salvamento prévio. O renderer gera `operationId` e envia `{ operationId, provedor, apiKey, modelo }` pelo IPC tipado; o handler valida a forma exata, registra a operação e garante sua remoção ao final. A chave fica somente na chamada do processo principal e não é registrada em logs ou diagnóstico.

`IaExecucaoService.testarConexao()` chama o mesmo endpoint de chat usado na operação real, com mensagem mínima, `temperature: 0` e `max_tokens: 1`. Logo, sucesso confirma simultaneamente chave, modelo e rota compatíveis. HTTP 401/403 vira `NAO_AUTORIZADO`, 400/404 vira `MODELO_INDISPONIVEL`, 429 vira limite de requisições e respostas sem `choices` viram `RESPOSTA_INVALIDA`. O timeout é de 120 segundos; cancelar usa o mesmo `operationId` e resulta em `CANCELADO`, sem deixar a tela bloqueada.

Enquanto o teste está ativo, a tela mostra cronômetro e botão **Cancelar teste**; fechar o diálogo também solicita cancelamento. O resultado fica inline como sucesso, falha ou cancelamento, e salvar permanece desabilitado durante a execução.

## Execução multimodal e privacidade

Descrição de imagem exige Gemini com visão e imagem persistida válida. No modo `legenda`, o serviço retorna uma legenda técnico-pericial de uma linha, sem prefixo ou quebra, limitada a 15 palavras; no modo normal retorna descrição simples. O renderer traduz erros de configuração, modelo, formato/tamanho/propriedade da imagem e resposta vazia antes de exibi-los no fluxo de substituição de figura.

Cada chamada fotografa provedor, modelo, perfil e privacidade antes do planejamento. Documento e contexto são conteúdo não confiável; respostas estruturadas são validadas localmente, com tentativa compatível quando `response_format` é rejeitado. Timeout, retries, checkpoints e privacidade compartilhados estão em `spec/06 ia/painel_assistente_ia.md`. Chaves, prompts, documentos, imagens, respostas brutas e mensagens do provedor não entram em logs.

`ia-execucao.service.test.ts` e `ia-painel.handlers.test.ts` cobrem o contrato do teste e seus erros; o smoke manual deve validar conexão e geração de legenda com a mesma configuração do formulário.
