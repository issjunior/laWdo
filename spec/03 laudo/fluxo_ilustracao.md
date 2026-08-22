# Ilustrações no laudo

## Estado e responsabilidades

O HTML do laudo é a fonte das figuras inseridas. A fila do Painel de Ilustrações é persistida separadamente em `imagens_laudo`: arquivo local, metadados, legenda, origem e sequência. `imagem-laudo.service.ts` valida IDs e conteúdo, calcula hash e expõe imagens como data URI; o renderer não recebe caminho local.

| Estado | Fonte canônica | Consumidor principal |
|---|---|---|
| figura inserida | HTML (`figure.laudo-figure`) | editor, preview e exportação |
| imagem disponível | `imagens_laudo` e arquivo local | `IlustracoesPanel` |
| imagem arquivada | `disponivel_painel = 0` | backup; fora do painel |

## Painel e legenda assistida

Upload e captura GDL entram na fila persistida. O painel permite inserir, excluir, reordenar, ampliar e substituir figuras. Em cada item, o botão de geração de legenda fica entre Ampliar e Substituir, pois atua sobre aquela figura. A edição da legenda é enviada com debounce; quando a fila retorna um valor persistido diferente, o campo local é sincronizado para não conservar valor obsoleto.

Esse botão envia apenas `operationId`, `laudoId`, `imagemId` e `modo: 'legenda'`. O main valida vínculo, MIME, tamanho, privacidade e visão antes de carregar a imagem. A IA deve retornar uma legenda técnico-pericial em uma única linha, sem prefixo ou quebra, com no máximo 15 palavras. O texto volta ao editor de legenda para revisão humana: não é salvo, inserido nem aplicado automaticamente.

Substituição conserva operação única de undo: atualiza `src`, `data-image-id`, legenda e disponibilidade da fila. Atualização do HTML e arquivamento persistido continuam independentes; falha de arquivamento pode exigir correção posterior.

## Dock, janela e GDL

IA e Ilustrações ocupam docks direitos mutuamente exclusivos. O dock de Ilustrações varia de 320 a 720 px e persiste a largura integrada. O trilho, divisor e painel ficam fixos durante a rolagem do documento, limitados à viewport; a lista de imagens mantém rolagem própria com `overscroll` contido. Ao abrir ou redimensionar quando não há espaço para editor (mínimo de 560 px), painel e trilho, o controlador recolhe o dock sem perder a largura salva ou desmontar o editor. As regras compartilhadas de layout ficam em `spec/04 layout/componentes_ui_base.md`.

A janela destacada reutiliza o painel e persiste somente dimensões, limitadas a 90% da área útil; pode coexistir com a janela de IA. O fluxo GDL recebe apenas `laudoId`; o main resolve REP e reobtém ZIP para captura. Thumbnails são temporárias, não persistidas nem usadas como arquivo final. Mudanças em contratos exigem alinhar serviço, handler, `ALLOWED_CHANNELS`, preload, tipos, dock e janela.
