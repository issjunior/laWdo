# Editor de texto compartilhado

## Fonte de verdade e contratos

`src/renderer/components/editor/TinyMceEditor.tsx` concentra a configuração e os comandos comuns do TinyMCE usados em laudos, templates, cabeçalhos e importação. A toolbar-base é única; `condbloco` e `suprimirblocopericial` só são acrescentados quando `condToggles` fornece contexto.

O componente aceita `value` no modo controlado e `initialValue` no modo não controlado. Este último captura o HTML apenas na montagem para impedir que normalizações internas reposicionem o cursor em documentos estruturados. Por isso, uma recarga externa do laudo precisa trocar a chave de montagem do editor; `criarChaveMontagemEditor()` é usada por `LaudosPage.tsx` para desmontar a instância anterior e carregar o novo HTML persistido. Não tentar atualizar `initialValue` na mesma instância.

Antes de montar, `removerInstanciaTinyMceAnterior()` remove instâncias TinyMCE órfãs com o mesmo id. A abertura mostra estado de carregamento, tenta uma nova montagem automaticamente uma vez após 8 segundos e, se persistir a indisponibilidade, preserva o conteúdo e mostra **Tentar novamente**. IDs ausentes recebem identificador derivado de `useId`.

## Configuração textual e visual

A toolbar usa `wrap` e agrupa histórico, formatação, fonte/cores, alinhamento/listas, recuos/entrelinha, inserção e revisão. `autoresize` só entra quando `alturaAutomatica` está ativa. O menu de parágrafo aplica recuo de primeira linha apenas em `p`, com 1 cm, 1,25 cm, 1,5 cm ou remoção; a alteração ocorre em transação de undo e não alcança títulos, listas ou células.

`pagebreak` grava o marcador canônico `data-quebra-pagina="true"`; o comentário legado `<!-- pagebreak -->` continua aceito pela normalização de exportação. A skin observa o tema sem remontar o editor. Em tela cheia, `repNumero` insere identificação fora do conteúdo editável; ela não integra o HTML salvo.

## Extensões e composição

O editor preserva comandos de placeholders, figuras, tabelas resolvidas e blocos condicionais. Imagens soltas são convertidas em `figure.laudo-figure`, exceto indicadores de quebra. Controles visuais de blocos e tabelas vivem somente no iframe.

A composição entre editor único e por seções pertence a `LaudosPage.tsx`. Seções possuem `id`, `parentId` e `nivel`; agrupadores vazios não criam editor ocioso e subseções órfãs permanecem no primeiro nível. Após uma atualização externa — inclusive a reconciliação de uma REP — `handleEditar()` recarrega o laudo, incrementa a versão de montagem e faz o TinyMCE refletir o HTML do banco imediatamente.

## Relações e verificação

Mudanças em recuo ou quebra devem ser coordenadas com `src/renderer/lib/exportacao-parser.ts`, `src/shared/types/exportacao.types.ts`, `src/shared/utils/quebra-pagina.ts` e `src/main/services/exportacao.service.ts`. `src/__tests__/renderer/tiny-mce-editor-config.test.ts` cobre catálogo, toolbar, medidas, tela cheia, remoção de instância anterior e mudança da chave de montagem. A interação real do TinyMCE, seleção múltipla e alternância visual de tema continuam dependentes de smoke manual.
