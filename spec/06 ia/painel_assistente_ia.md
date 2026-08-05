# Painel do Assistente IA

## Responsabilidades e fontes de verdade

O assistente é um painel único do editor de laudos, disponível como dock direito redimensionável ou como janela destacada. `LaudosPage.tsx` mantém o controlador canônico da sessão, o alvo capturado, o histórico, a operação ativa e as propostas. `AssistenteIaPanel.tsx` é uma apresentação reutilizada pelos dois modos; a janela `PainelIaWindow.tsx` é apenas uma projeção e não acessa TinyMCE nem o HTML-fonte.

Os contratos e validadores compartilhados ficam em `src/shared/types/ia.types.ts`; o catálogo de provedores, modelos, visão e orçamentos fica em `src/shared/catalogos/modelos-ia.catalogo.ts`; o planejamento determinístico de lotes fica em `src/shared/ia-planejamento.ts`. O main valida IPC e propriedade da operação em `ia.handlers.ts` e executa provedores em `ia-execucao.service.ts`.

## Experiência integrada

O editor mantém um trilho vertical permanente com IA, Ilustrações e Ferramentas. IA e Ilustrações usam docks separados e mutuamente exclusivos, reservam espaço real e não desmontam o editor ao abrir, recolher ou redimensionar. O dock da IA varia de 360 a 640 px; sua largura é persistida em pixels no `localStorage` somente após interação. O estado aberto ou recolhido é transitório.

A janela destacada é única por sessão, pode coexistir com a janela destacada de Ilustrações e recebe na URL somente `sessionId`. Largura e altura são persistidas no main, validadas e limitadas a 90% da área útil; a posição não é persistida. Reencaixar fecha a janela e abre o dock na última largura válida.

O painel oferece seleção explícita de seleção, seção, documento ou cursor conforme a ação. Ações rápidas cobrem ortografia, linguagem técnico-pericial, clareza, resumo e expansão; o pedido livre escolhe entre inserir no cursor capturado e reescrever o escopo. O histórico é somente visual: cada solicitação é isolada e limpar a conversa não altera o laudo.

## Sessão, sincronização e autorização

Cada sessão usa `sessionId`, cada execução usa `operationId`, cada mensagem tem identidade estável e cada proposta usa `proposalId`. O main associa sessão, janela e operações ao `webContents` proprietário, aceita uma operação ativa por renderer e cancela operações quando o proprietário é destruído. Cancelar é idempotente; fechar a janela pelo `X` não equivale a cancelar.

O handshake e a ressincronização enviam snapshot completo. Mudanças normais usam deltas validados com revisão monotônica. A janela ignora revisões antigas e, ao detectar uma lacuna, solicita novo snapshot antes de aplicar deltas posteriores. Comandos remotos, inclusive aplicação, são validados e referenciam `mensagemId`, nunca índice visual.

## Captura e aplicação segura

O alvo é capturado antes da chamada como seleção, seção, documento ou cursor. Seleções e inserções preservam bookmark e contexto; transformações preservam HTML de origem, fragmentos textuais identificados e fingerprint SHA-256. Cada resposta permanece vinculada ao alvo que a originou. Se o conteúdo mudar, a prévia e a aplicação são bloqueadas como alvo alterado.

Somente texto é enviado e aceito como proposta. Placeholders, números, datas, identificadores e URLs são convertidos em tokens opacos e validados por identidade e cardinalidade. No modo integral, valores resolvidos dos placeholders seguem em uma representação textual somente para leitura; o HTML e seus marcadores continuam fora do contrato de geração. No modo protegido, o contexto resolvido e imagens não são enviados.

A resposta textual deve ser JSON com todos os fragmentos, na ordem e uma única vez. O serviço tolera cercas Markdown, tenta compatibilidade sem `response_format` quando o modelo rejeita JSON estruturado e permite uma tentativa corretiva para contrato inválido. O renderer restaura tokens e reconstrói a proposta sobre a estrutura original.

Substituições abrem comparação lado a lado. O usuário pode editar apenas os textos propostos; HTML e assinatura estrutural permanecem bloqueados e são revalidados. Inserções usam construtor seguro e texto escapado. A aplicação ocorre em uma única `undoManager.transact`, atualiza o estado React e registra alteração pendente com origem `ia`; propostas aplicadas não podem ser reaplicadas acidentalmente. A IA nunca salva o laudo automaticamente.

## Planejamento, confirmação e falhas parciais

O serviço calcula orçamento pelo catálogo do modelo, com margem de segurança e reserva de resposta. Fragmentos extensos são subdivididos em partes ordenadas por limites de frase, distribuídos em lotes e recompostos na ordem original. As chamadas são sequenciais e nenhum resultado chega ao renderer até a conclusão integral.

Documento completo, múltiplos lotes e descrição de imagem exigem confirmação explícita. O resumo mostra provedor, modelo, lotes, chamadas-base e limite máximo considerando retries e correção. O plano recebe fingerprint sobre alvo, ação, instrução, provedor, modelo, perfil e privacidade; qualquer mudança invalida a confirmação.

O timeout é de 120 segundos por chamada. Erros de rede, 408, 429 e 5xx admitem até duas repetições, respeitando `Retry-After` até 30 segundos ou backoff com jitter. Falhas após lotes concluídos criam checkpoint somente em memória por até 30 minutos. A retomada exige o mesmo plano e continua do primeiro lote pendente; sucesso, cancelamento, incompatibilidade, expiração ou fim da sessão descartam o checkpoint. Nunca há aplicação parcial no laudo.

## Perfil, privacidade e observabilidade

A página Modelos de IA é a única área de configuração. O perfil versionado em `perfil_resposta_ia` define tom, detalhamento e instruções personalizadas; JSON ausente ou inválido usa o padrão. A preferência versionada `privacidade_ia` controla `enviarConteudoIntegral`. Embora a UI apresente envio integral como padrão, o serviço adota mascaramento conservador quando a configuração está ausente, inválida ou corrompida.

Chaves permanecem no main e não entram em snapshots, URL, histórico ou logs. Logs registram apenas identificadores, provedor/modelo, ação/escopo, contagens, duração, tentativas e códigos de erro. Corpos de provedor, prompts, respostas, laudos e imagens não são registrados nem devolvidos como erro bruto ao renderer.

## Descrição de imagem

A imagem para IA é escolhida por clique no editor e não se confunde com a seleção do Painel de Ilustrações. O renderer envia somente `operationId`, `laudoId` e `imagemId`. O main reconcilia a figura com `imagens_laudo`, valida pertencimento, MIME, tamanho e capacidade de visão e carrega o conteúdo persistido.

A descrição retorna texto simples em contexto isolado por imagem, com cópia manual. Não existe inserção ou aplicação automática dessa resposta. Imagens sem vínculo persistido, de outro laudo, incompatíveis, grandes demais ou bloqueadas pelo modo protegido são rejeitadas antes da chamada ao provedor.

## Verificação e mudanças coordenadas

Testes cobrem contratos e catálogo compartilhados, lotes e retomada, timeout/cancelamento, formatos inválidos, propriedade IPC, snapshot/delta, comandos da janela, captura e proteção de fragmentos, aplicação e undo, layout redimensionável e descrição multimodal. Mudanças devem manter alinhados shared, preload, `ALLOWED_CHANNELS`, handlers, serviço, controlador em `LaudosPage`, dock e janela. A validação manual ampla em Windows, múltiplas resoluções, temas e monitores permanece como lacuna atual de cobertura.
