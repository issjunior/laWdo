# Preview PDF e HTML do laudo

## Origem e cabeçalhos

A prévia aberta no editor parte do conteúdo atual dos editores, inclusive alterações ainda não salvas; a prévia pela lista parte de `laudos.conteudo`, sem editor aberto. Ambas resolvem placeholders com os dados atuais da REP e renumeram `TABELA N` no HTML final antes do PDF. No editor, a página também confere os títulos visíveis antes de montar o HTML e interrompe a geração se essa conferência falhar. A prévia transitória de placeholder não é a fonte canônica da saída.

`cabecalho_laudo` é inserido no corpo da primeira página e `cabecalho_paginas` torna-se `headerTemplate` do Chromium. `buildPdfHeaderConfig()` lê ambos; `buildHeaderTemplate()` remove wrappers de placeholder, converte `{{pagina}}`/`{{totalPaginas}}` nas classes nativas e substitui valores como o número da REP. Os padrões ficam em `src/shared/configuracoes/cabecalhos-padrao.ts`; migrations v35 e v36 os inserem com `INSERT OR IGNORE`.

## Margens e paginação

`getMargens()` sempre devolve margens válidas: configuração persistida normalizada ou o padrão `{ top: 2.5, right: 2, bottom: 2.5, left: 3 }` em centímetros. Para PDF, `exportacao.service.ts` e `template.handlers.ts` usam as mesmas margens efetivas. Quando existe cabeçalho de páginas, a margem superior é no mínimo 2,5 cm, mesmo se uma configuração menor chegar à camada de impressão. O `headerTemplate` é encaminhado explicitamente na exportação do laudo; assim o cálculo não depende do cabeçalho exclusivo da primeira página.

O HTML de impressão não introduz padding lateral alternativo: as margens de impressão definem a área útil e o documento usa os valores efetivos. Tabelas usam largura máxima de 100%, `thead` como `table-header-group` e `tr` com `break-inside: avoid`. As tabelas de placeholders identificadas por `data-placeholder-celula-fixa` também usam layout fixo, padding reduzido e quebra de texto para não ultrapassar a área imprimível; a partir de dez colunas, a fonte é menor. A regra compartilhada em `pdf-tabelas.ts` é aplicada na prévia e na exportação, inclusive a tabelas já inseridas no laudo. Em continuação de tabela, o cabeçalho da página e o cabeçalho da tabela ficam abaixo da margem superior, sem sobreposição.

## Prontidão e recuperação

`gerarPdfPreparado()` é compartilhado pela prévia e exportação. Após carregar o HTML em uma janela oculta com sandbox, verifica fontes e decodificação de imagens do corpo, inclusive URLs de imagem em estilos; verifica os recursos do cabeçalho em documento auxiliar isolado antes de imprimir. A preparação tem limite de 15 segundos e a impressão, de 30 segundos. Timeout, encerramento do renderer ou falha de recurso encerram a operação e limpam janelas e arquivos temporários; não há espera fixa nem PDF parcial. Os logs registram tempos, contagens e códigos, sem HTML ou conteúdo pericial.

A página lê as duas configurações do cabeçalho em modo estrito: falha ou valor inválido impede gerar silenciosamente uma prévia sem cabeçalho. O IPC devolve falha tipada com código, etapa e possibilidade de nova tentativa; a interface mostra orientação persistente, **Tentar novamente** e **Fechar**. Uma nova tentativa usa o conteúdo atual do editor, e uma falha não reapresenta a prévia anterior como se fosse a atual.

## Saída e verificação

O CSS de preview e PDF justifica parágrafos narrativos sem alinhamento próprio, excluindo tabelas e figuras. Alinhamento inline escolhido no editor prevalece. Valores personalizados por ocorrência aparecem com sua formatação, sem o destaque violeta do editor; as âncoras não personalizadas continuam resolvidas pelo mapa da REP/perito.

`renumerarTabelasHtml()` ignora prévias transitórias e aplica a sequência no documento completo após a resolução, inclusive quando tabelas B-602 carregam números fixos. A prévia pela lista confere somente o HTML gerado, pois não há editor para sincronizar.

Seções condicionais inativas ou suprimidas não aparecem na saída. Placeholders pendentes podem aparecer como `XXX`; isso informa dado ausente. Tabelas resolvidas recebem largura máxima de 100% no HTML e nas folhas de estilo do PDF/ODT.

`src/__tests__/renderer/margens.test.ts` cobre a normalização/fallback das margens. O smoke de PDF deve usar tabela suficiente para cruzar uma página e confirmar, visualmente, a margem superior e a repetição de cabeçalho na página seguinte.
