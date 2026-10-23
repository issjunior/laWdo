# Editor de texto compartilhado

## Fonte de verdade e contratos

`src/renderer/components/editor/TinyMceEditor.tsx` concentra a configuração e os comandos comuns do TinyMCE usados em laudos, templates, cabeçalhos e importação. A toolbar-base é única; `condbloco` e `suprimirblocopericial` só são acrescentados quando `condToggles` fornece contexto.

O componente aceita `value` no modo controlado e `initialValue` no modo não controlado. Este último captura o HTML apenas na montagem para impedir que normalizações internas reposicionem o cursor em documentos estruturados. Por isso, uma recarga externa do laudo precisa trocar a chave de montagem do editor; `criarChaveMontagemEditor()` é usada por `LaudosPage.tsx` para desmontar a instância anterior e carregar o novo HTML persistido. Não tentar atualizar `initialValue` na mesma instância.

Antes de montar, `removerInstanciaTinyMceAnterior()` remove instâncias TinyMCE órfãs com o mesmo id. A abertura mostra estado de carregamento, tenta uma nova montagem automaticamente uma vez após 8 segundos e, se persistir a indisponibilidade, preserva o conteúdo e mostra **Tentar novamente**. IDs ausentes recebem identificador derivado de `useId`.

## Configuração textual e visual

A toolbar usa `wrap` e agrupa histórico, formatação, fonte/cores, alinhamento/listas, recuos/entrelinha, inserção e revisão. `autoresize` só entra quando `alturaAutomatica` está ativa. O menu de parágrafo aplica recuo de primeira linha apenas em `p`, com 1 cm, 1,25 cm, 1,5 cm ou remoção; a alteração ocorre em transação de undo e não alcança títulos, listas ou células.

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

A prontidão é concluída em `init_instance_callback`, após o carregamento inicial: normaliza blocos condicionais, instala suas ações e chama `onEditorInit` antes de liberar `onChange` como alteração de usuário. Eventos anteriores usam `normalizacao-inicial`; o evento `init` isolado não estabelece a referência de conteúdo salvo. Na página de laudos, o editor único conclui a inicialização da sessão com o HTML normalizado. A comparação de pendências e a proteção contra respostas de sessões antigas ficam em `useGerenciadorAlteracoesLaudo.ts`.

Timeouts registram tentativa, última fase, tamanho inicial e disponibilidade do documento e das folhas de estilo, sem gravar HTML. O marcador `data-diagnostico-pronto` no iframe permite instalar sondas após a inicialização; o contrato fica em `spec/13 diagnostico/diagnostico_assistido.md`.

Em laudos com callback de inserção, a toolbar troca o comando genérico de imagem por **Inserir figura**. A página captura editor e bookmark e abre o seletor no dock integrado; demais consumidores conservam o comando usual. `figura-html.ts` produz o markup compartilhado com escape de atributos e legenda. O fluxo está em `spec/03 laudo/fluxo_ilustracao.md`.

`tiny-mce-editor-inicializacao.component.test.tsx` cobre a ordem entre carregamento inicial e liberação de alterações; `conteudo-comparavel-laudo.test.ts` cobre a comparação canônica. O ambiente simulado não substitui a abertura real do iframe no Electron.

## Limpeza de formatação e recuo

editor-formatacao.ts concentra os formatos e comandos comuns. O corpo usa Arial/Helvetica/sans-serif, 14 px, com cor padrão adaptada ao tema. RemoveFormat aplica texto padrão e limpa estilos de texto selecionado e espaçamento dos blocos, mantendo conteúdo protegido de figuras, legendas, placeholders, campos reservados e controles transitórios. A seleção parcial não deve limpar texto fora do intervalo; sem seleção, a limpeza atua no bloco atual e restaura a posição do cursor. A operação participa de uma única transação de undo.

O recuo de primeira linha atua somente em parágrafos selecionados não protegidos. A indicação do menu compara medidas equivalentes em pt, px, cm, mm e in; valores mistos não selecionam uma opção uniforme. O listener NodeChange é removido no descarte do menu. editor-formatacao.test.ts exercita o TinyMCE real no ambiente DOM simulado, com declarações de módulos em tinymce-recursos.d.ts; seleção e aparência no Electron continuam exigindo smoke manual.

## Sincronização agrupada e custo de edição

Nos laudos, os dois modos ativam a prop opcional `agruparAlteracoes` com `initialValue`. O DOM do TinyMCE contém a edição mais recente; o estado React recebe o HTML após 400 ms sem alterações ou ao perder foco. `sincronizacao-editor-laudo.ts` observa input, change, Undo, Redo e SetContent, marca a pendência imediatamente por `onAlteracaoPendente` e não serializa a cada tecla. A composição de texto suspende o temporizador até compositionend; a remoção cancela o trabalho e elimina o sincronizador. Eventos anteriores à prontidão não marcam edição. Outros consumidores mantêm o comportamento padrão de onEditorChange.

`lerConteudoAtualEditorLaudo()` cancela o temporizador, lê o DOM e publica eventual alteração pendente antes de retornar o HTML. Salvamento e troca de modo usam essa leitura para preservar edições feitas antes dos 400 ms. Não usar apenas o estado React nessas operações. A comparação de pendências da página também espera 400 ms e não aceita uma versão do estado enquanto houver sincronização pendente.

A comparação reaproveita o resultado quando os campos das seções não mudaram. A normalização reutiliza o DOM já analisado ao limpar a apresentação transitória de placeholders; a numeração de figuras observa mudanças estruturais, sem varrer o documento a cada digitação. `instrumentarLeiturasEditorLaudo()` mede serialização de HTML e criação de níveis de undo, restaurando o wrapper ao remover o editor. As métricas incluem duração, tamanho e modo, sem texto do laudo.

`sincronizacao-editor-laudo.test.ts` cobre agrupamento, composição, leitura imediata, descarte e edição durante salvamento; `desempenho-editor-laudo.test.ts` cobre os atalhos de processamento. A suíte manual com Electron está em [Testes de carga do editor](../13%20diagnostico/testes_carga_editor.md).
