# Gemini como provedor de IA

## Papel e configuração

Gemini é integrado pelo endpoint OpenAI-compatível `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`. A página `ModelosIAPage.tsx` persiste `provedor_ia = 'gemini'`, `api_key_gemini` e `modelo_gemini_padrao`; a chave permanece no main. O teste de conexão usa `ia:testar-conexao`.

O catálogo compartilhado `src/shared/catalogos/modelos-ia.catalogo.ts` registra:

- `gemini-2.5-flash`: padrão, visão JPEG/PNG/WebP até 15 MiB;
- `gemini-2.5-pro`: visão e maior orçamento de contexto;
- `gemini-2.0-flash`: visão.

Modelo salvo ausente ou incompatível cai no padrão do próprio Gemini. Não há fallback silencioso para Groq nem escolha automática de outro provedor.

## Execução atual

O painel usa o mesmo contrato tipado e o mesmo `IaExecucaoService` empregado pela Groq. Planejamento, confirmação, lotes sequenciais, timeout de 120 segundos, até duas repetições para rede/408/429/5xx, cancelamento e checkpoints em memória não variam por provedor.

Respostas textuais são solicitadas em JSON estruturado e validadas localmente. Cercas Markdown são toleradas; modelos que rejeitem `response_format` recebem uma tentativa de compatibilidade sem relaxar o contrato final. Uma tentativa corretiva pode ser feita quando a estrutura retornada é inválida.

Na descrição de imagem, o modelo Gemini selecionado precisa declarar visão e aceitar o MIME/tamanho persistido. O main resolve a imagem por `laudoId` e `imagemId`; o renderer não envia data URI, URL ou caminho. A resposta é texto simples para cópia manual e nunca é aplicada automaticamente.

## Privacidade e invariantes

Perfil e privacidade são fotografados no início da operação. No modo integral, o provedor pode receber texto e imagens, além de uma representação textual somente para leitura dos placeholders resolvidos. No modo protegido, o contexto resolvido não segue e descrições de imagem são bloqueadas. Documento e imagem são tratados como conteúdo não confiável, subordinado às regras fixas do sistema.

Chaves, prompts, respostas, documentos e imagens não entram nos logs nem nos snapshots da janela. Mudanças devem manter alinhados catálogo, contratos shared, preload, handlers e serviço. O fluxo completo do painel está em `spec/06 ia/painel_assistente_ia.md`.
