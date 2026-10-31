# Ilustrações no laudo

## Estado e responsabilidades

O HTML do laudo é a fonte das figuras inseridas. O Painel de Ilustrações combina imagens persistidas em `imagens_laudo` (arquivo local, metadados, legenda, origem e sequência) e imagens novas em estágio na memória do main, separadas por laudo. `imagem-laudo.service.ts` valida IDs e conteúdo, calcula hash e expõe imagens como data URI; o renderer não recebe caminho local.

| Estado | Fonte canônica | Consumidor principal |
|---|---|---|
| figura inserida | HTML (`figure.laudo-figure`) | editor, preview e exportação |
| imagem disponível | registro/arquivo persistido ou estágio em memória | `IlustracoesPanel` |
| imagem nova ainda não inserida | estágio em memória do main, com miniatura | painel integrado e destacado |
| imagem arquivada | `disponivel_painel = 0` | fora do painel; backup depende do uso no HTML salvo ou de vínculo de origem |

## Edição local por ocorrência

O painel e **Substituir figura** abrem `EditorFiguraDialog` para a imagem escolhida. A prévia mostra a imagem orientada inteira; arrastar cria o retângulo de corte, e suas alças permitem mover e redimensionar. A área externa fica escurecida. O corte é limitado à imagem e convertido de percentuais da prévia para pixels da resolução original. Giros de 90°, rotação livre e espelhamento são aplicados em canvas; a rotação livre preenche as áreas vazias com branco e redefine o corte para a imagem inteira. **Selecionar imagem inteira** desfaz só o corte; **Restaurar imagem** limpa os ajustes e usa a base local, sem novo download do GDL.

O resultado é uma nova ocorrência/derivação local: `imagem_origem_id` aponta para a base preservada durante a elaboração e `ajustes_json` registra os ajustes. A v40 adiciona essas colunas. O serviço valida ID, vínculo ao mesmo laudo, data URI e JSON antes de persistir; a base não pode ser excluída enquanto houver derivação. Duas figuras que usam a mesma foto podem ter ajustes independentes. A reconciliação do painel considera IDs de ocorrência, e o backup completo parte dos IDs utilizados no HTML salvo e inclui cada cadeia de `imagem_origem_id` enquanto o laudo não foi concluído. Na conclusão, os vínculos e os atributos `data-image-original-id` são removidos; uma reabertura edita a versão tratada. Apenas existir em `imagens_laudo` ou estar arquivada não garante inclusão. O filtro atua somente no snapshot, conforme `spec/14 backup/backup_usuario.md`. O teste `imagem-editada.integration.test.ts` cobre persistência/restauração local; `editor-figura.test.ts` e `editor-figura.component.test.tsx` cobrem geometria e interação do recorte.

## Painel e legenda assistida

Upload e captura GDL entram no estágio em memória; a inserção prepara o arquivo persistido e a prévia do editor. O painel permite inserir, excluir, reordenar, ampliar e substituir figuras. Em cada item, o botão de geração de legenda fica entre Ampliar e Substituir, pois atua sobre aquela figura. A edição da legenda é enviada com debounce; quando a fila retorna um valor persistido diferente, o campo local é sincronizado para não conservar valor obsoleto.

Esse botão envia apenas `operationId`, `laudoId`, `imagemId` e `modo: 'legenda'`. O main valida vínculo, MIME, tamanho, privacidade e visão antes de carregar a imagem. A IA deve retornar uma legenda técnico-pericial em uma única linha, sem prefixo ou quebra, com no máximo 15 palavras. O texto volta ao editor de legenda para revisão humana: não é salvo, inserido nem aplicado automaticamente.

Substituição conserva operação única de undo: atualiza `src`, `data-image-id`, legenda e disponibilidade da fila. Atualização do HTML e arquivamento persistido continuam independentes; falha de arquivamento pode exigir correção posterior.

## Dock, janela e GDL

IA e Ilustrações ocupam docks direitos mutuamente exclusivos. O dock de Ilustrações varia de 320 a 720 px e persiste a largura integrada. O trilho e painel ficam sticky durante a rolagem do documento, com altura ajustada ao espaço visível da viewport; a lista de imagens mantém rolagem própria com `overscroll` contido. Ao abrir ou redimensionar quando não há espaço para editor (mínimo de 560 px), painel e trilho, o controlador recolhe o dock sem perder a largura salva ou desmontar o editor. As regras compartilhadas de layout ficam em `spec/04 layout/componentes_ui_base.md`.

A janela destacada reutiliza o painel e persiste somente dimensões, limitadas a 90% da área útil; pode coexistir com a janela de IA. O fluxo GDL recebe laudoId; o main resolve a REP e abre uma sessão temporária com ZIP para listagem, miniaturas e captura, sem baixar o ZIP novamente a cada seleção. Miniaturas não são o arquivo final. O cache de hashes e a exclusão visual de duplicatas ficam em spec/08 gdl/api_gdl.md. Mudanças em contratos exigem alinhar serviço, handler, `ALLOWED_CHANNELS`, preload, tipos, dock e janela.

## Inserção, remoção e identidade

**Inserir figura** na toolbar captura a instância do editor e um bookmark da seleção. Abre o seletor no dock de Ilustrações, recolhe IA e reintegra o painel caso estivesse destacado. O seletor permite escolher imagem disponível, carregar arquivo local, ajustar imagem e legenda ou abrir a captura GDL. Confirmar cria uma derivação com novo ID e `imagem_origem_id`, mesmo sem recorte, preservando a base para outras ocorrências.

Antes de inserir, a página revalida instância, seção e bookmark; no editor único, o alvo precisa permanecer dentro do conteúdo de uma seção. Posição inválida não insere em outro local: o painel tenta excluir a derivação recém-criada e orienta selecionar novamente. Persistência, inserção no DOM e arquivamento são sequenciais; falha de compensação ou arquivamento não constitui rollback transacional. Após sucesso, a derivação é arquivada na fila e o HTML continua pendente até salvar o laudo.

O **+** do painel e **Inserir todas** têm outro destino explícito: o final de ILUSTRAÇÕES, criando a seção quando necessário. A fila visível exclui IDs presentes no editor; inserir todas prepara prévias sequencialmente, admite sucesso parcial e retorna os IDs efetivamente inseridos para atualizar a fila, com confirmação acima de 30. Miniaturas são carregadas em lotes de 30. Edição/substituição usa o índice da ocorrência para distinguir duas figuras da mesma imagem; o ID de arquivo isolado não identifica uma ocorrência ambígua.

Excluir figura real pelo painel primeiro a disponibiliza novamente na fila; só depois remove seu HTML. Dummy não precisa de operação de arquivo. ILUSTRAÇÕES desaparece apenas quando vazia e sem subseções: texto, tabela ou outra mídia impedem a remoção. No editor único a remoção participa do undo; no modo por seções a exclusão da seção pode oferecer **Desfazer** no toast.

`figura-html.ts` produz o markup compartilhado. A varredura TinyMCE ignora clones de resize e imagens já envolvidas, evitando duplicação. Mudanças de conteúdo e undo/redo sincronizam a numeração física entre editores montados; a montagem do HTML final também reindexa a sequência.

## Renumeração e restauração explícita de legendas

`figuras.ts` altera apenas o prefixo numérico de legendas existentes, preservando a marcação inline da descrição e sincronizando o `alt`. Renumerar não recria `figcaption` ausente ou vazio. A recuperação é acionada explicitamente por **Atualizar Figuras**; reordenar a fila usa somente atualização normal.

A recuperação procura primeiro a descrição do `alt`, sem o prefixo Figura/Fig. Na ausência dela, consulta a legenda persistida somente para imagem não dummy cujo ID apareça uma única vez no documento. Consultas elegíveis usam `Promise.all`, sem limite próprio de concorrência. Depois de aguardar, a página relê o DOM e a contagem dos IDs; troca de laudo ou modo interrompe a aplicação, e legendas já preenchidas são preservadas. Sem descrição recuperável, cria apenas **Figura NN**, sem inventar texto. Editores montados usam transação de undo por editor; seções desmontadas são atualizadas no estado.

`ResultadoAtualizacaoFiguras` contém `restauradas`, `semDescricao`, `falhasConsulta` e `erro` opcional. Falhas individuais de consulta permitem resultado parcial e aviso. O painel integrado aguarda a Promise; o destacado envia `refreshHtml(true)` e aguarda `resultadoAtualizacao` na sincronização por até 15 segundos. Fechamento da janela rejeita a espera. O protocolo mantém uma espera local e não tem ID de correlação; timeout encerra a espera, não cancela o trabalho no editor.

`figuras-ocorrencia.test.ts`, `ilustracoes-secoes.test.ts`, `seletor-figura-dialog.component.test.tsx` e `layout-editor-laudo.component.test.tsx` cobrem helpers e fluxos simulados; janela destacada e redimensionamento real exigem verificação visual.

## Acesso pelo documento e seleção de fotos

Clicar na imagem de uma figura real abre o dock integrado de Ilustrações, recolhe IA e reintegra o painel destacado, sem substituir a figura. Clicar na imagem de uma figura dummy mantém o pedido específico de substituição. Esses callbacks são fornecidos pelos dois modos de edição do laudo; outros consumidores do TinyMCE não ganham esse comportamento automaticamente.

No seletor em modo **substituir**, **Buscar REP** fica junto de **Carregar arquivo local**, mesmo quando já há imagens na fila. Ao carregar a Lista de Fotos da REP, `GdlImagensRepModal` pré-seleciona os arquivos com `provavelImagem` e sem `status`. A seleção pode ser revista antes da captura; não representa download/persistência automática e não inclui itens com status impeditivo.

`gdl-imagens-rep-modal.component.test.tsx` e `seletor-figura-dialog.component.test.tsx` cobrem seleção inicial e acesso à busca com fila preenchida. `ilustracoes-panel-rolagem.component.test.tsx` e `painel-lateral-redimensionavel.component.test.tsx` verificam a estrutura de rolagem e o trilho com acesso aos atalhos; interação real entre iframe, dock e janela destacada exige smoke manual.

## Estágio, persistência e limpeza

imagem-laudo.service.ts mantém bytes originais e miniatura de até 300 px no maior lado em memória, com limite global de 256 MiB para o estágio. Listar/obter/descartar estágio não grava em SQLite. Os canais ilustracoes:estagiar-imagem, listar-estagio, obter-imagem-estagio e descartar-estagio sustentam esse fluxo; preparar-insercao promove a imagem ao armazenamento e gera a prévia. Se falhar a geração depois da promoção, tenta excluir a imagem persistida; o estágio só é retirado após sucesso. O renderer usa resumos/miniaturas e solicita a imagem completa para ampliar ou editar.

O armazenamento por bytes conserva as fotos GDL originais durante a elaboração. A antiga redução para JPEG de 1600 px/qualidade 82 serve somente para reconhecer hashes legados no fluxo GDL. A saída para PDF usa o perfil `perfil_figura_laudo`: Máxima economia (1024 px/JPEG 62, padrão), Compacto (1280/70), Equilibrado (1600/78) ou Nítido (2048/85). O maior lado nunca é ampliado; transparência exige PNG e a conversão só prevalece quando diminui os bytes. Na transição para Concluído, o main compacta as figuras referenciadas pelo HTML salvo, mantém esses registros, elimina os demais registros do laudo e rompe os vínculos de origem; os arquivos antigos sem referências são removidos após a transação. A reabertura usa as figuras tratadas; originais GDL podem ser consultados novamente pelo fluxo Buscar REP. Uma limitação atual é que atualizarLegenda/atualizarOrdem escrevem somente em SQLite: para imagem ainda apenas estagiada, a edição visível no renderer não atualiza os metadados guardados no estágio. Não presumir persistência dessas alterações antes da promoção.

A migration v48 adiciona imagens_laudo.temporaria_sessao INTEGER NOT NULL DEFAULT 0. Novos registros entram com 1; os antigos permanecem 0. O marcador torna o registro elegível para limpeza, sem substituir a conferência do HTML salvo. ilustracoes:encerrar-sessao descarta o estágio e remove somente imagens marcadas sem referência no conteúdo persistido nem em sua cadeia de imagem_origem_id. A mesma limpeza roda na inicialização; erro é registrado sem impedir a abertura do aplicativo. Exclusões de registros são transacionais por laudo; arquivos são removidos depois e somente sem referências restantes. Não remove indiscriminadamente a fila legada nem trata HTML ainda não salvo como preservação. Fechar sem salvar pode remover fotos novas e derivações que só existiam no rascunho.

## Prévia adaptativa e saída

ImagensPage.tsx, em /imagens no menu de configurações, separa **Figura do laudo e PDF**, **Prévia no editor** e **Envio para IA**. Cada grupo salva sua preferência; as opções aparecem em linhas compactas, ordenadas da maior resolução para a menor, ao lado de uma comparação única com desenhos SVG sobrepostos do maior limite ao menor e destaque da escolha. Em largura estreita, a comparação fica abaixo das opções e usa escala menor. A ilustração é demonstrativa, não mede qualidade nem MB; Original da IA aparece como contorno tracejado de tamanho variável. `perfil_figura_laudo` é texto validado com padrão Máxima economia. `perfil_previa_editor` permanece texto validado: economico (480–640 px, padrão), equilibrado (640–960 px) ou nitido (960–1280 px), medidos no maior lado. Preferências válidas já salvas continuam prevalecendo, sem sobrescrita automática. prepararImagemEditorLaudo() usa o maior tamanho CSS vezes a densidade limitada a 1–4, contido no intervalo do perfil, sem ampliar a imagem original. PNG/GIF produzem prévia PNG; demais formatos, JPEG de qualidade 80. A IA oferece também Muito econômica (384 px/JPEG 60), independente dos outros grupos. Miniaturas, prévias e arquivos de impressão têm finalidades distintas.

Inserção e substituição gravam data-imagem-previa="true" no figure. Redimensionamento solicita nova prévia segundo as dimensões exibidas. Ao salvar, compactarFigurasParaEditor() substitui data URIs grandes de figuras reais identificadas por uma prévia de até 960 px somente se menor; usa cache por ID na operação. Ignora dummy e figuras já marcadas; se não obtiver recurso local mantém o HTML recebido. Compactação não transforma a prévia no original.

Para PDF/DOCX/ODT, resolverImagensImpressaoLaudo() busca cada ID marcado em ilustracoes:obter-imagem-impressao, remove o marcador da cópia de saída e exige recurso válido do mesmo laudo. O main confere SHA-256 do arquivo e prepara a resolução proporcional de impressão. Não modifica HTML salvo nem substitui o arquivo local. Testes existentes: imagem-laudo-previa.integration.test.ts, imagem-laudo-limpeza.integration.test.ts, compactacao-figuras-laudo.test.ts e imagens-impressao-laudo.test.ts; colagem, arraste, resize e janela destacada ainda exigem smoke visual.

## Limites de compactação e falhas na conclusão

tratarFigura() só escolhe a conversão quando os bytes codificados são menores que a entrada. Os limites dos perfis são alvos: o fallback aos bytes de origem pode conservar dimensões superiores ao limite. A decisão de PNG usa o canal alfa do bitmap tratado, não apenas a extensão. obterImagemImpressaoLaudo() aplica o perfil a uma cópia e depois respeita a largura de impressão de 1–3000 px; obter PDF não regrava a imagem armazenada.

A conclusão usa o HTML persistido, valida as figuras selecionadas e prepara arquivos antes de atualizar registros. Os IDs usados permanecem com imagem_origem_id/ajustes_json nulos e disponivel_painel/temporaria_sessao zerados. A transação do handler reúne essas alterações, conteúdo e status de laudo/REP. Arquivos novos podem permanecer órfãos no rollback; exclusão dos antigos ocorre após commit e falhas são registradas sem invalidar a conclusão. Não há restauração automática dos bytes descartados ao reabrir; nova exportação ou conclusão pode tratar novamente os bytes disponíveis. imagem-laudo-previa.integration.test.ts cobre prévia, limite de impressão e retenção na conclusão com recursos simulados, sem substituir inspeção da qualidade real.

## Imagens no BKP individual

A exportação do BKP percorre as referências `data-image-id` do HTML salvo, ignorando subárvores dummy, e inclui cada figura usada e sua cadeia de `imagem_origem_id`. O caminho real deve permanecer sob `userData/imagens/laudos`; arquivo ausente, fora dessa raiz, com tamanho divergente, hash divergente ou ciclo na cadeia impede a criação. Imagens disponíveis no painel sem uso ou vínculo de origem não entram.

Na importação, cada imagem e vínculo de origem recebe novo ID, os bytes são copiados para uma pasta exclusiva do laudo e o hash é conferido antes da transação. O HTML, as seções e as peças têm as referências remapeadas. Ao substituir um laudo, os registros anteriores são removidos na transação; os arquivos antigos só são apagados depois do commit quando não restar referência. Falha antes do commit remove a nova pasta, enquanto falha na limpeza posterior é registrada e não desfaz a importação.
