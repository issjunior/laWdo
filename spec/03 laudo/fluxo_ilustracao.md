# Ilustrações no laudo

## Estado e responsabilidades

O HTML do laudo é a fonte das figuras inseridas no editor. A fila do Painel de Ilustrações é persistida separadamente em `imagens_laudo`: arquivo local, metadados, legenda, origem e sequência. Ela permite reabrir o painel sem depender do conteúdo em memória ou da conexão com o GDL.

| Estado | Fonte canônica | Consumidor principal |
|---|---|---|
| figura inserida | HTML do laudo (`figure.laudo-figure`) | editor, preview e exportação |
| imagem disponível | `imagens_laudo` + arquivo sob `userData/imagens/laudos/<laudoId>` | `IlustracoesPanel` |
| imagem arquivada | `imagens_laudo.disponivel_painel = 0` | backup; não reaparece no painel |
| imagem selecionada para IA | clique atual em figura persistida no editor | descrição multimodal |
| thumbnail da Lista de Fotos | resposta temporária do GDL | seletor antes da captura |

`imagem-laudo.service.ts` valida IDs e data URIs, limita MIME, calcula SHA-256, grava por hash e expõe imagens como data URI; o renderer nunca recebe caminho local. Figuras inseridas pelo toolbox são vinculadas a `imagens_laudo`; a reconciliação também roda em Atualizar Figuras e antes de uma descrição por IA.

## Painel, seleção e substituição

Upload local e captura GDL entram primeiro na fila persistida. O painel mostra thumbnails e permite inserir, excluir, reordenar ou escolher uma imagem para substituir uma figura.

O clique em um dummy abre o seletor visual. A comparação mostra original e nova figura; a legenda começa com o valor original, pode ser editada e é salva no registro escolhido. A confirmação troca `src` e `data-image-id`, remove `data-dummy`, atualiza a legenda e registra uma única operação de undo. A nova imagem é arquivada; a imagem real substituída volta à fila.

O preenchimento em lote lista somente dummies e impede reutilizar uma imagem na mesma confirmação. Atualização do HTML e disponibilidade persistida continuam operações independentes; falha de arquivamento pode exigir correção posterior sem desfazer a figura aplicada.

## Imagens da REP no GDL

O modal recebe somente `laudoId`. O main resolve `laudo → rep_id → rep.numero`, exige número/ano e não aceita número, URL, caminho ou hash do renderer. `gdl:listar-imagens-laudo` devolve metadados e, quando possível, `thumbnailDataUri` JPEG leve de até 320 px; falha de prévia não torna a foto inelegível.

`gdl:capturar-imagens-laudo` aceita somente IDs SHA-256 e reobtém o ZIP antes de extrair. Sucessos e falhas são independentes por item. A thumbnail nunca é persistida nem usada como arquivo final; a cópia validada entra no fluxo local e no backup.

## Dock e janela destacada

IA e Ilustrações ocupam docks direitos distintos e mutuamente exclusivos. O dock de Ilustrações varia de 320 a 720 px, persiste a última largura integrada e mantém a rolagem automática da figura ativa restrita à lista interna, sem reposicionar a página do laudo.

A janela destacada reutiliza `IlustracoesPanel` e comunica ações por wrappers IPC específicos. Suas dimensões são persistidas no main com validação, debounce e limite de 90% da área útil; a posição não é persistida. Ela pode coexistir com a janela destacada de IA.

## Descrição de imagem por IA

A figura selecionada para IA é um estado separado da seleção visual do Painel de Ilustrações. Ela é definida exclusivamente por clique no editor e é limpa ao trocar modo ou laudo, remover ou substituir a figura.

O renderer envia somente `operationId`, `laudoId` e `imagemId`. O main valida vínculo com o laudo, MIME, tamanho, privacidade e capacidade de visão antes de carregar a imagem persistida. A descrição é texto simples, fica em histórico isolado da imagem e oferece apenas cópia manual; nunca insere texto, troca figura, altera legenda ou modifica o documento. Figuras legadas sem vínculo persistido exigem importação controlada.

## Verificação

Testes cobrem migração de `imagens_laudo`, captura GDL, substituição e legenda, rolagem interna, dimensões da janela, autorização IPC e descrição multimodal. Mudanças em contratos exigem alinhar serviço, handler, `ALLOWED_CHANNELS`, preload, tipos, dock e janela.
