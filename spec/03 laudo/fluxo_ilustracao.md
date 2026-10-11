# Ilustrações no laudo

## Estado e responsabilidades

O HTML do laudo é a fonte das figuras inseridas. A fila do Painel de Ilustrações é persistida separadamente em `imagens_laudo`: arquivo local, metadados, legenda, origem e sequência. `imagem-laudo.service.ts` valida IDs e conteúdo, calcula hash e expõe imagens como data URI; o renderer não recebe caminho local.

| Estado | Fonte canônica | Consumidor principal |
|---|---|---|
| figura inserida | HTML (`figure.laudo-figure`) | editor, preview e exportação |
| imagem disponível | `imagens_laudo` e arquivo local | `IlustracoesPanel` |
| imagem arquivada | `disponivel_painel = 0` | backup; fora do painel |

## Edição local por ocorrência

O painel e **Substituir figura** abrem `EditorFiguraDialog` para a imagem escolhida. A prévia mostra a imagem orientada inteira; arrastar cria o retângulo de corte, e suas alças permitem mover e redimensionar. A área externa fica escurecida. O corte é limitado à imagem e convertido de percentuais da prévia para pixels da resolução original. Giros de 90°, rotação livre e espelhamento são aplicados em canvas; a rotação livre preenche as áreas vazias com branco e redefine o corte para a imagem inteira. **Selecionar imagem inteira** desfaz só o corte; **Restaurar imagem** limpa os ajustes e usa a base local, sem novo download do GDL.

O resultado é uma nova ocorrência/derivação local: `imagem_origem_id` aponta para a base preservada e `ajustes_json` registra os ajustes. A v40 adiciona essas colunas. O serviço valida ID, vínculo ao mesmo laudo, data URI e JSON antes de persistir; a base não pode ser excluída enquanto houver derivação. Duas figuras que usam a mesma foto podem ter ajustes independentes. A reconciliação do painel considera IDs de ocorrência, e o backup completo inclui arquivos da base e das versões editadas porque ambos permanecem referenciados em `imagens_laudo`. O teste `imagem-editada.integration.test.ts` cobre persistência/restauração local; `editor-figura.test.ts` e `editor-figura.component.test.tsx` cobrem geometria e interação do recorte.

## Painel e legenda assistida

Upload e captura GDL entram na fila persistida. O painel permite inserir, excluir, reordenar, ampliar e substituir figuras. Em cada item, o botão de geração de legenda fica entre Ampliar e Substituir, pois atua sobre aquela figura. A edição da legenda é enviada com debounce; quando a fila retorna um valor persistido diferente, o campo local é sincronizado para não conservar valor obsoleto.

Esse botão envia apenas `operationId`, `laudoId`, `imagemId` e `modo: 'legenda'`. O main valida vínculo, MIME, tamanho, privacidade e visão antes de carregar a imagem. A IA deve retornar uma legenda técnico-pericial em uma única linha, sem prefixo ou quebra, com no máximo 15 palavras. O texto volta ao editor de legenda para revisão humana: não é salvo, inserido nem aplicado automaticamente.

Substituição conserva operação única de undo: atualiza `src`, `data-image-id`, legenda e disponibilidade da fila. Atualização do HTML e arquivamento persistido continuam independentes; falha de arquivamento pode exigir correção posterior.

## Dock, janela e GDL

IA e Ilustrações ocupam docks direitos mutuamente exclusivos. O dock de Ilustrações varia de 320 a 720 px e persiste a largura integrada. O trilho, divisor e painel ficam fixos durante a rolagem do documento, limitados à viewport; a lista de imagens mantém rolagem própria com `overscroll` contido. Ao abrir ou redimensionar quando não há espaço para editor (mínimo de 560 px), painel e trilho, o controlador recolhe o dock sem perder a largura salva ou desmontar o editor. As regras compartilhadas de layout ficam em `spec/04 layout/componentes_ui_base.md`.

A janela destacada reutiliza o painel e persiste somente dimensões, limitadas a 90% da área útil; pode coexistir com a janela de IA. O fluxo GDL recebe apenas `laudoId`; o main resolve REP e reobtém ZIP para captura. Thumbnails são temporárias, não persistidas nem usadas como arquivo final. Mudanças em contratos exigem alinhar serviço, handler, `ALLOWED_CHANNELS`, preload, tipos, dock e janela.

## Inserção, remoção e identidade

**Inserir figura** na toolbar captura a instância do editor e um bookmark da seleção. Abre o seletor no dock de Ilustrações, recolhe IA e reintegra o painel caso estivesse destacado. O seletor permite escolher imagem disponível, carregar arquivo local, ajustar imagem e legenda ou abrir a captura GDL. Confirmar cria uma derivação com novo ID e `imagem_origem_id`, mesmo sem recorte, preservando a base para outras ocorrências.

Antes de inserir, a página revalida instância, seção e bookmark; no editor único, o alvo precisa permanecer dentro do conteúdo de uma seção. Posição inválida não insere em outro local: o painel tenta excluir a derivação recém-criada e orienta selecionar novamente. Persistência, inserção no DOM e arquivamento são sequenciais; falha de compensação ou arquivamento não constitui rollback transacional. Após sucesso, a derivação é arquivada na fila e o HTML continua pendente até salvar o laudo.

O **+** do painel e **Inserir todas** têm outro destino explícito: o final de ILUSTRAÇÕES, criando a seção quando necessário. A fila visível exclui IDs presentes no editor; inserir todas carrega imagens completas sequencialmente e pede confirmação acima de 30. Miniaturas são carregadas em lotes de 30. Edição/substituição usa o índice da ocorrência para distinguir duas figuras da mesma imagem; o ID de arquivo isolado não identifica uma ocorrência ambígua.

Excluir figura real pelo painel primeiro a disponibiliza novamente na fila; só depois remove seu HTML. Dummy não precisa de operação de arquivo. ILUSTRAÇÕES desaparece apenas quando vazia e sem subseções: texto, tabela ou outra mídia impedem a remoção. No editor único a remoção participa do undo; no modo por seções a exclusão da seção pode oferecer **Desfazer** no toast.

`figura-html.ts` produz o markup compartilhado. A varredura TinyMCE ignora clones de resize e imagens já envolvidas, evitando duplicação. Mudanças de conteúdo e undo/redo sincronizam a numeração física entre editores montados; a montagem do HTML final também reindexa a sequência.

## Renumeração e restauração explícita de legendas

`figuras.ts` altera apenas o prefixo numérico de legendas existentes, preservando a marcação inline da descrição e sincronizando o `alt`. Renumerar não recria `figcaption` ausente ou vazio. A recuperação é acionada explicitamente por **Atualizar Figuras**; reordenar a fila usa somente atualização normal.

A recuperação procura primeiro a descrição do `alt`, sem o prefixo Figura/Fig. Na ausência dela, consulta a legenda persistida somente para imagem não dummy cujo ID apareça uma única vez no documento. Consultas elegíveis usam `Promise.all`, sem limite próprio de concorrência. Depois de aguardar, a página relê o DOM e a contagem dos IDs; troca de laudo ou modo interrompe a aplicação, e legendas já preenchidas são preservadas. Sem descrição recuperável, cria apenas **Figura NN**, sem inventar texto. Editores montados usam transação de undo por editor; seções desmontadas são atualizadas no estado.

`ResultadoAtualizacaoFiguras` contém `restauradas`, `semDescricao`, `falhasConsulta` e `erro` opcional. Falhas individuais de consulta permitem resultado parcial e aviso. O painel integrado aguarda a Promise; o destacado envia `refreshHtml(true)` e aguarda `resultadoAtualizacao` na sincronização por até 15 segundos. Fechamento da janela rejeita a espera. O protocolo mantém uma espera local e não tem ID de correlação; timeout encerra a espera, não cancela o trabalho no editor.

`figuras-ocorrencia.test.ts`, `ilustracoes-secoes.test.ts`, `seletor-figura-dialog.component.test.tsx` e `layout-editor-laudo.component.test.tsx` cobrem helpers e fluxos simulados; janela destacada e redimensionamento real exigem verificação visual.
