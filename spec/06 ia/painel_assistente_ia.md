# Painel do Assistente IA

## Responsabilidades e fontes de verdade

O assistente é um painel do editor de laudos, integrado no dock direito ou em janela destacada. `LaudosPage.tsx` mantém sessão, alvo capturado, histórico, operação, propostas e execuções reenviáveis. `AssistenteIaPanel.tsx` é apresentação compartilhada; `PainelIaWindow.tsx` só projeta a sessão e não acessa TinyMCE. Contratos ficam em `src/shared/types/ia.types.ts`, catálogo em `src/shared/catalogos/modelos-ia.catalogo.ts`, validação IPC em `ia.handlers.ts` e execução em `ia-execucao.service.ts`.

## Pedido livre, perfil e tamanho

A mensagem exibida no balão do usuário é sempre o texto original digitado. Para pedido livre, o painel permite `automático`, `curta`, `média` e `longa`; a escolha é convertida em instrução obrigatória enviada ao serviço, sem virar dado visual do histórico. Curta pede 10 palavras com tolerância de 5; média pede um parágrafo; longa pede de 2 a 3 parágrafos; automático não limita. O controle por mensagem não altera o perfil persistido.

A página Modelos de IA persiste o perfil versionado `perfil_resposta_ia` com tom, detalhamento, instruções personalizadas e temperatura de 0 a 1, em passos de 0,1. O serviço inclui pedido do usuário, perfil e temperatura no corpo de cada chamada, mantendo a instrução fixa de segurança acima de conteúdo de documento. Perfil inválido ou ausente usa padrão conservador.

## Falhas, reenvio e progresso

Para erros transitórios `SEM_CONEXAO`, `LIMITE_REQUISICOES`, `TIMEOUT` e `PROVEDOR_INDISPONIVEL`, o balão da mensagem do usuário oferece reenviar. O controlador preserva a execução preparada e o alvo capturado, solicita um novo planejamento para a mesma solicitação e não duplica a mensagem; o comando remoto usa `mensagemId`. Outros erros não expõem reenvio.

Uma solicitação de lote único mostra somente spinner e cronômetro. Para múltiplos lotes, o painel mostra lote atual, progresso e tentativas. Lotes seguem sequenciais, sem aplicação parcial; falha após lote concluído pode manter checkpoint em memória por até 30 minutos, sujeito ao mesmo plano.

## Segurança, sessão e aplicação

Cada sessão usa `sessionId`, execução usa `operationId`, mensagem usa identidade estável e proposta usa `proposalId`. O main associa operações ao `webContents`, aceita uma operação ativa e cancela quando o proprietário é destruído. Handshake usa snapshot e deltas com revisão monotônica.

O alvo é capturado antes da chamada. Placeholders e valores imutáveis são tokenizados; somente texto pode ser proposto. A aplicação revalida alvo e estrutura, usa uma transação única do undo manager e nunca salva automaticamente. Privacidade protegida mascara contexto resolvido e bloqueia descrição de imagens.

## Imagens e verificação

Descrição de imagem recebe somente IDs e é validada contra `imagens_laudo`. O modo normal devolve texto para cópia; o modo `legenda` é usado pelo Painel de Ilustrações e impõe uma linha técnico-pericial de até 15 palavras. Mudanças devem alinhar tipos shared, preload, canais permitidos, handler, serviço, controlador e ambas as projeções do painel. Testes cobrem contratos, lotes, falhas, comandos remotos, aplicação e layout; múltiplos monitores continuam sendo verificação manual ampla.
