# Ilustrações no laudo

## Estado e responsabilidades

O HTML do laudo é a fonte das figuras já inseridas no editor. A fila de imagens disponíveis no Painel de Ilustrações é persistida separadamente em `imagens_laudo`: arquivo local, metadados, legenda, origem e sequência. Ela permite reabrir o painel sem depender do conteúdo em memória ou da conexão com o GDL.

| Estado | Fonte canônica | Consumidor principal |
|---|---|---|
| figura inserida | HTML do laudo (`<figure class="laudo-figure">`) | editor, preview e exportação |
| imagem disponível no painel | `imagens_laudo` + arquivo sob `userData/imagens/laudos/<laudoId>` | `IlustracoesPanel` |
| imagem arquivada após inserção | linha em `imagens_laudo` com `disponivel_painel = 0` | backup; não reaparece no painel |
| thumbnail da Lista de Fotos | resposta temporária do GDL | seletor visual antes da captura |

`imagem-laudo.service.ts` valida IDs e data URIs, limita MIME, calcula SHA-256, grava por hash e expõe imagens como data URI; o renderer nunca recebe caminho local.

## Painel, seleção e substituição

Upload local e captura GDL entram primeiro na fila persistida. O painel mostra thumbnails das imagens disponíveis e permite inserir, excluir, reordenar ou escolher uma imagem para substituir uma figura existente.

O clique em um dummy do editor abre o seletor visual. A comparação mostra a figura original à esquerda e a nova figura à direita; o campo da nova legenda inicia com a legenda original, pode ser editado e é salvo no registro da imagem escolhida. Ao confirmar, o editor troca `src` e `data-image-id`, remove `data-dummy`, atualiza a legenda e registra uma única operação de undo. A nova imagem é arquivada da fila. Ao substituir uma figura real persistida, seu ID volta a ficar disponível no painel.

O preenchimento em lote lista apenas dummies, propõe imagens por ordem e permite revisar cada associação. Uma imagem só pode ser selecionada para um dummy; associações vazias deixam o dummy intacto. As atualizações de HTML e disponibilidade ainda usam operações independentes, portanto uma falha de arquivamento pode exigir correção pelo painel sem desfazer a figura já aplicada.

## Imagens da REP no GDL

O modal recebe somente `laudoId`. O main resolve `laudo → rep_id → rep.numero`, exige `número/ano` e não aceita número, URL, caminho ou hash do renderer. `gdl:listar-imagens-laudo` baixa a Lista de Fotos ZIP, devolve metadados e, quando decodificável, `thumbnailDataUri`: JPEG leve, com maior dimensão de 320 px, gerado no main. Falha de prévia não torna a foto inelegível e a interface mostra fallback.

`gdl:capturar-imagens-laudo` aceita somente IDs SHA-256 e reobtém o ZIP antes de extrair os itens selecionados. A captura devolve sucessos e falhas por item. Arquivo ausente, corrompido, criptografado ou incompatível não bloqueia os demais. A thumbnail nunca é persistida, enviada à exportação ou usada como arquivo final; após captura, a cópia validada segue o fluxo local e entra em backup.

## Editor e janela destacada

As imagens são encapsuladas como `figure.laudo-figure`, recebem ID estável e são reindexadas antes de salvar ou gerar preview. O ciclo preserva single/multisseção, seção `ILUSTRAÇÕES`, legenda e ordenação.

A janela destacada reutiliza o painel e comunica inserção, exclusão, reordenação e substituição pela ponte IPC existente. Persistência continua em wrappers específicos do preload; módulos Node/Electron não são expostos ao renderer.

## Verificação

`migracao-imagens-laudo.integration.test.ts` protege a tabela legada. `gdl-imagens-rep-modal.component.test.tsx` cobre seleção/captura e renderização de thumbnail retornada pelo GDL. `seletor-figura-dialog.component.test.tsx` cobre a cópia e edição da legenda antes da substituição. Mudanças em contratos exigem alinhar serviço, handler, `ALLOWED_CHANNELS`, preload, tipos e os dois modos do painel.
