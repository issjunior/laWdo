# Editor de texto compartilhado

## Fonte de verdade e contratos

`src/renderer/components/editor/TinyMceEditor.tsx` concentra a configuração e os comandos comuns do TinyMCE usados em laudos, templates, cabeçalhos e importação. A toolbar-base é única; `condbloco` e `suprimirblocopericial` só são acrescentados quando `condToggles` fornece contexto.

O componente aceita `value` no modo controlado e `initialValue` no modo não controlado. Este último captura o HTML apenas na montagem para impedir que normalizações internas reposicionem o cursor em documentos estruturados. Por isso, uma recarga externa do laudo precisa trocar a chave de montagem do editor; `criarChaveMontagemEditor()` é usada por `LaudosPage.tsx` para desmontar a instância anterior e carregar o novo HTML persistido. Não tentar atualizar `initialValue` na mesma instância.

Antes de montar, `removerInstanciaTinyMceAnterior()` remove instâncias TinyMCE órfãs com o mesmo id. A abertura mostra estado de carregamento. Após 8 segundos, se houver onFalhaInicializacao, delega a recuperação a esse callback; no editor único de laudos a página muda para o modo por seções, todas recolhidas, conserva a referência inicial e avisa para abrir uma seção. Sem callback, tenta uma nova montagem uma vez somente se a instância ainda não existir; persistindo a indisponibilidade, preserva o conteúdo e mostra **Tentar novamente**. IDs ausentes recebem identificador derivado de `useId`.

## Configuração textual e visual

A toolbar usa `wrap` e agrupa histórico, formatação, fonte/cores, alinhamento/listas, recuos/entrelinha, inserção e revisão. `autoresize` só entra quando `alturaAutomatica` está ativa. O menu de parágrafo aplica recuo de primeira linha apenas em `p`, com 1 cm, 1,25 cm, 1,5 cm ou remoção; a alteração ocorre em transação de undo. O alvo é o parágrafo selecionado; títulos, itens de lista e células não são alvos diretos. Parágrafos elegíveis dentro de contêineres continuam sujeitos às proteções descritas abaixo.

`pagebreak` grava o marcador canônico `data-quebra-pagina="true"`; o comentário legado `<!-- pagebreak -->` continua aceito pela normalização de exportação. A skin observa o tema sem remontar o editor. Em tela cheia, `repNumero` insere identificação fora do conteúdo editável; ela não integra o HTML salvo.

Parágrafos narrativos sem alinhamento explícito aparecem justificados por padrão no iframe do TinyMCE. O seletor exclui parágrafos de tabelas e figuras; estilos inline escolhidos pelo usuário prevalecem. O editor compacto de personalização (`EditorCampoLaudo.tsx`) também inicia justificado e mantém HTML multilinha com negrito, itálico, sublinhado, sobrescrito e subscrito. Ele captura `initialValue` em referência por abertura; o rascunho fica em referência na página e é normalizado somente ao aplicar, evitando reposicionar o cursor a cada tecla.

## Espaçamento entre parágrafos

O menu **Espaçamento** oferece ajustes independentes antes e depois: 0, 3, 6, 8, 12, 18 e 24 pt, além de **Padrão do documento**, que remove a margem inline daquele lado. `aplicarEspacamentoParagrafo()`, em `editor-formatacao.ts`, atua nos blocos selecionados `p`, títulos, `pre` e `blockquote`, excluindo os protegidos e contêineres que já tenham um bloco descendente selecionado. Itens de lista e células não são alvos diretos; parágrafos internos não protegidos continuam elegíveis.

A operação altera somente `margin-top` ou `margin-bottom`, preserva texto, seleção e entrelinha, e participa de uma única transação de undo. O menu acompanha `NodeChange`, distingue margem ausente de zero explícito e não indica valor uniforme para seleção mista; remove o listener ao descartar. A conversão de medidas está em `src/renderer/lib/medidas-texto.ts`, compartilhada com o parser de exportação, e aceita pt, px, cm, mm e in.

`editor-formatacao.test.ts` cobre seleção múltipla, títulos, conteúdo protegido, valores mistos, retorno ao padrão e undo/redo. `tiny-mce-editor-config.test.ts` confere a presença do comando na toolbar. A preservação de zero e conversão das margens até DOCX/ODT fica em `spec/03 laudo/exportar_laudo.md`.

## Extensões e composição

O editor preserva comandos de placeholders, figuras, tabelas resolvidas e blocos condicionais. Imagens soltas são convertidas em `figure.laudo-figure`, exceto indicadores de quebra e clones temporários de redimensionamento (`data-mce-bogus="all"` e `.mce-clonedresizable`). O observador revalida a presença da imagem no documento e a ausência de wrapper antes da conversão, evitando duplicação durante resize. Controles visuais de blocos e tabelas vivem somente no iframe.

A composição entre editor único e por seções pertence a `LaudosPage.tsx`. Seções possuem `id`, `parentId` e `nivel`; agrupadores vazios não criam editor ocioso e subseções órfãs permanecem no primeiro nível. Após uma atualização externa — inclusive a reconciliação de uma REP — `handleEditar()` recarrega o laudo, incrementa a versão de montagem e faz o TinyMCE refletir o HTML do banco imediatamente.

## Relações e verificação

Mudanças em recuo, quebra ou alinhamento devem ser coordenadas com `src/renderer/lib/exportacao-parser.ts`, `src/shared/types/exportacao.types.ts`, `src/shared/utils/quebra-pagina.ts` e `src/main/services/exportacao.service.ts`. `src/__tests__/renderer/tiny-mce-editor-config.test.ts` cobre catálogo, toolbar, medidas, tela cheia, remoção de instância anterior e mudança da chave de montagem. A interação real do TinyMCE, seleção múltipla e alternância visual de tema continuam dependentes de smoke manual.

## Prontidão e inserção de figuras

A prontidão é concluída em init_instance_callback, após normalizar blocos e instalar as interações. onEditorInit aceita void | Promise<void> e é aguardado antes de liberar edição, publicar alterações de usuário e definir data-diagnostico-pronto. Em laudos, prepararInicializacaoEditorLaudo() aguarda editor.uploadImages(), verifica o resultado de cada imagem e revalida sessão e instância antes de aplicar placeholders, cache de coleta e numeração. Só depois o editor único estabelece a referência comparável; editores por seção não substituem a referência salva da sessão. Falha mantém o editor indisponível e oferece nova tentativa; conclusão de instância removida ou sessão antiga não libera a atual. Eventos anteriores usam normalizacao-inicial. O contrato está em spec/problemas diversos/aviso_salvar_sem_edicao.md.

Timeouts registram tentativa, última fase, tamanho inicial e disponibilidade do documento e das folhas de estilo, sem gravar HTML. O marcador `data-diagnostico-pronto` no iframe permite instalar sondas após a inicialização; o contrato fica em `spec/13 diagnostico/diagnostico_assistido.md`.

Em laudos com callback de inserção, a toolbar troca o comando genérico de imagem por **Inserir figura**. A página captura editor e bookmark e abre o seletor no dock integrado; demais consumidores conservam o comando usual. `figura-html.ts` produz o markup compartilhado com escape de atributos e legenda. O fluxo está em `spec/03 laudo/fluxo_ilustracao.md`.

`tiny-mce-editor-inicializacao.component.test.tsx` cobre a ordem entre carregamento inicial e liberação de alterações; `conteudo-comparavel-laudo.test.ts` cobre a comparação canônica. O ambiente simulado não substitui a abertura real do iframe no Electron.

## Limpeza de formatação e recuo

editor-formatacao.ts concentra os formatos e comandos comuns. O corpo usa Arial/Helvetica/sans-serif, 14 px, com cor padrão adaptada ao tema. RemoveFormat aplica texto padrão e limpa estilos de texto selecionado e espaçamento dos blocos, mantendo conteúdo protegido de figuras, legendas, placeholders, campos reservados e controles transitórios. A seleção parcial não deve limpar texto fora do intervalo; sem seleção, a limpeza atua no bloco atual e restaura a posição do cursor. A operação participa de uma única transação de undo.

O recuo de primeira linha atua em parágrafos selecionados e nos parágrafos descendentes de um `.cond-bloco[data-cond-bloco]` selecionado. O bloqueio `contenteditable="false"` do próprio condicional permite esse comando de formatação; outros ancestrais não editáveis, figuras, legendas, placeholders, campos reservados, controles e blocos suprimidos continuam excluídos. Isso não libera edição do texto protegido. A indicação do menu compara medidas equivalentes em pt, px, cm, mm e in; valores mistos não selecionam uma opção uniforme. O listener NodeChange é removido no descarte do menu. editor-formatacao.test.ts exercita o TinyMCE real no ambiente DOM simulado, com declarações de módulos em tinymce-recursos.d.ts; seleção e aparência no Electron continuam exigindo smoke manual.

## Sincronização agrupada e custo de edição

Nos laudos, os dois modos ativam a prop opcional `agruparAlteracoes` com `initialValue`. O DOM do TinyMCE contém a edição mais recente; o estado React recebe o HTML após 400 ms sem alterações ou ao perder foco. `sincronizacao-editor-laudo.ts` observa input, change, Undo, Redo e SetContent, marca a pendência imediatamente por `onAlteracaoPendente` e não serializa a cada tecla. A composição de texto suspende o temporizador até compositionend; a remoção cancela o trabalho e elimina o sincronizador. Eventos anteriores à prontidão não marcam edição. Outros consumidores mantêm o comportamento padrão de onEditorChange.

`lerConteudoAtualEditorLaudo()` cancela o temporizador, lê o DOM e publica eventual alteração pendente antes de retornar o HTML. Salvamento e troca de modo usam essa leitura para preservar edições feitas antes dos 400 ms. Não usar apenas o estado React nessas operações. A comparação de pendências da página também espera 400 ms e não aceita uma versão do estado enquanto houver sincronização pendente.

A comparação reaproveita o resultado quando os campos das seções não mudaram. A normalização reutiliza o DOM já analisado ao limpar a apresentação transitória de placeholders; a numeração de figuras observa mudanças estruturais, sem varrer o documento a cada digitação. `instrumentarLeiturasEditorLaudo()` mede serialização de HTML e criação de níveis de undo, restaurando o wrapper ao remover o editor. As métricas incluem duração, tamanho e modo, sem texto do laudo.

`sincronizacao-editor-laudo.test.ts` cobre agrupamento, composição, leitura imediata, descarte e edição durante salvamento; `desempenho-editor-laudo.test.ts` cobre os atalhos de processamento. A suíte manual com Electron está em [Testes de carga do editor](../13%20diagnostico/testes_carga_editor.md).

## Consulta de projéteis durante a edição

O trilho de `LaudosPage.tsx` oferece **Identificação de projéteis** apenas para códigos de exame da família B, normalizados sem espaços/hífens e em maiúsculas. A ferramenta completa abre em diálogo sobre a página, mantendo a instância do TinyMCE e a sessão de alterações pendentes. Nenhum resultado é aplicado automaticamente ao documento; abrir, consultar e fechar não salva nem estabelece nova referência comparável. O atalho Ctrl+S/Meta+S do laudo fica bloqueado enquanto o modal está aberto, e o foco retorna ao botão do trilho ao fechar.

A consulta fica em memória após fechar o modal e é descartada ao sair ou trocar de laudo. O componente é carregado na primeira abertura, sem substituir a árvore do editor. Responsabilidades, dimensões do modal e catálogo estão em [Identificação de projéteis](../16%20ferramentas/identificacao_projeteis.md). `projeteis-laudo.component.test.tsx` verifica o acesso condicional, a consulta preservada, foco, atalhos e identidade do editor simulado; o histórico real de desfazer e a ausência de falsa pendência continuam sujeitos a smoke no Electron.

## Busca no laudo e atalhos

Em `LaudosPage.tsx`, Ctrl+F (ou Meta+F) abre `BarraBuscaLaudo` acima do editor, inclusive com foco dentro do iframe. O comando não é capturado quando há diálogo ou alerta modal aberto. Enter/Shift+Enter no campo percorrem resultados em ciclo; Esc fecha a busca. O botão **Atalhos do laudo** no trilho abre `AtalhosLaudoDialog`, que descreve os contextos de busca, salvamento e edição e restaura o foco de origem ao fechar. Localizar/substituir do TinyMCE continua disponível na toolbar e atua no editor em foco.

`useBuscaTextoLaudo.ts` pesquisa todos os editores/seções do laudo atual. Lê o DOM quando montado e, para seções desmontadas, usa `criarCopiaVisualizacaoPlaceholders()` sobre o HTML em estado, com o modo de visualização e mapa de valores atuais. Assim, procura o texto exibido, incluindo valores resolvidos e personalizações, ou as chaves quando esse modo está ativo. Não pesquisa cabeçalhos/fechamento externos ao corpo editável. Navegar expande a seção e seus ancestrais e espera sua montagem por até 30 tentativas de 50 ms; fechar, trocar de laudo ou navegar novamente invalida a tentativa anterior.

`busca-texto-laudo.ts` ignora controles transitórios, scripts, estilos, elementos explicitamente ocultos e subárvores com data-cond-suprimido="true". Normaliza caixa em pt-BR e espaços, preservando acentos; encontra texto dividido por marcação inline, mas não une parágrafos, células ou outros blocos distintos. Retorna ocorrências sem sobreposição. O destaque usa CSS Highlights, com seleção nativa como fallback, sem inserir marcação no HTML. A rolagem centraliza o resultado nos contêineres do iframe e da página, descontando controles fixos/sticky.

Enquanto aberta, a busca observa mutações e eventos de edição e recalcula após 200 ms de pausa; o custo acompanha o texto completo das fontes. Ao fechar, remove observadores, listeners e destaque. `busca-texto-laudo.test.ts`, `busca-texto-laudo-rolagem.test.ts` e `use-busca-texto-laudo.test.tsx` cobrem normalização, fontes desmontadas, navegação, cancelamento e rolagem; geometria e foco reais continuam sujeitos a smoke no Electron.

## Personalização com tipografia e recuo

`tipografia-editor-laudo.ts` centraliza Arial/Helvetica/sans-serif, 14 px e entrelinha 1,6. `EditorCampoLaudo` captura na abertura a fonte, o tamanho e a entrelinha computados da ocorrência e o recuo do parágrafo ancestral. O diálogo tem editor de 320 px, largura máxima de 5xl e conteúdo rolável, com cabeçalho e ações fixos. O menu Parágrafo usa `recuo-editor-laudo.ts`, também consumido pelo editor principal.

O recuo escolhido no diálogo fica em rascunho separado do HTML inline e só é habilitado quando a ocorrência pertence a um `p`. **Aplicar valor** personaliza o campo e altera `text-indent` do parágrafo original na mesma transação de undo; **Cancelar** descarta ambos. Não ampliar a lista de tags/estilos de `normalizarHtmlCampo()` para transportar esse recuo. `editor-campo-laudo.component.test.tsx` cobre tipografia herdada, valor inicial estável e comunicação do recuo; `editor-formatacao.test.ts` cobre parágrafos de condicionais e as exclusões de proteção.

## Inserção de imagens e montagem por seções

Com laudoId, upload, colagem, arraste e substituição de dummy passam por estágio local e prepararInsercao antes de colocar a prévia no HTML. Colagem de data URI/blob usa placeholder temporário e data-imagem-processando; ao concluir substitui o src, marca data-imagem-previa e publica a alteração. Falha remove a figura temporária e mostra erro. Imagens remotas HTTP(S) são recusadas com orientação para salvar/anexar o arquivo; não há download arbitrário de imagens de sites. Sem laudoId, os demais consumidores mantêm o fluxo genérico. Durante a preparação, a página bloqueia salvar e trocar modo.

ObjectResized recalcula a prévia para o tamanho CSS e densidade atuais e só aplica a resposta se a figura ainda estiver presente com o mesmo ID. Os originais permanecem no main durante a elaboração; a conclusão conserva somente os recursos tratados, conforme fluxo_ilustracao.md. No modo por seções, os editores são montados na primeira expansão; conteúdo desmontado permanece no estado e participa de busca, substituição por índice e composição do documento.

conferirNumeracaoTabelasEditores() percorre editores montados na ordem, numera tabelas usando undoManager.ignore. A liberação das células B-601 pertence à política de conteúdo interativo, não à numeração. Pode dispensar captura de HTML quando não houve correção persistível. Os seletores de coleta, projétil e estojo usam seletores-tabela-laudo.ts para apresentar a escolha e posicionar o menu dentro da viewport/iframe. Seu texto canônico é separado do controle transitório e reaplicado após PlaceholdersAplicados, Undo/Redo e mudança de modo. O contrato B-601 está em b601.md; foco e abertura real desses menus dependem de smoke no Electron.

## Conteúdo protegido e preparação coordenada

conteudo-interativo.ts instala uma superfície comum em tabelas resolvidas/personalizadas, condicionais e grupos descritivos B-601. adaptadores-conteudo-laudo.ts define liberação, restauração e exclusão; politica-edicao-conteudo.ts centraliza a permissão. **Editar/Concluir** controla a liberação local à instância, sem significar salvar. Cabeçalhos, células fixas e âncoras técnicas continuam protegidos; blocos internos exigem a liberação do ancestral. Campos reservados e seletores pontuais têm exceções descritas nas specs de placeholders e B-601. Somente leitura bloqueia as ações.

**Restaurar dados da REP** e **Excluir** usam confirmação assíncrona; LaudosPage fornece useConfirmacaoConteudo com AlertDialog. O editor revalida identidade, presença, modo e conteúdo antes e depois da preparação assíncrona, serializa as ações e agrupa a alteração no undo. Tabelas podem ser restauradas ou excluídas com sua âncora; condicionais podem ser suprimidos, sem restauração pela REP; grupos B-601 podem ser recriados, mas não excluídos por esse controle. Erros são exibidos por toast. A confirmação cancela na desmontagem ou quando outra a substitui.

registrarPreparacaoConteudo(), em preparacao-conteudo-editor.ts, agrupa SetContent, LoadContent, Undo, Redo, SwitchMode, PlaceholdersAplicados e ConteudoInterativoAlterado em um requestAnimationFrame por editor. A superfície roda na prioridade 0, antes dos seletores na prioridade padrão 10. A remoção cancela o quadro e desregistra listeners; a preparação visual usa undoManager.ignore. Os estilos vêm de globals.css e são copiados para o iframe. limparConteudoInterativo() remove controles, classes e contenteditable transitórios antes da serialização, comparação e exportação; identidades e dados locais continuam persistidos.

conteudo-interativo.test.ts cobre ações, proteção, concorrência e limpeza; inicializacao-saida-laudo.component.test.tsx cobre preparação tardia, saída e sessões obsoletas. Foco, seleção e aparência reais exigem validação no Electron.
