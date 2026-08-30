# Exportação do laudo e resolução de placeholders

## Fonte de resolução

`exportacao-placeholders.ts` constrói o mapa de valores a partir da REP e de seu contexto. No B-602, `projetarB602ParaLaudo()` é a fonte derivada de material, cartuchos, estojos e armas; novas gravações usam `b602.pecas`, e arrays legados são apenas fallback de leitura.

`construirMapaPlaceholdersResolvidos()` expõe, por chave, valor, preenchimento e formato (`texto`, `html` estrutural ou `html-inline`). O resumo de lacres de saída B-602 é um valor inline: armas são referenciadas individualmente por letra, estojos são agrupados, e cada lacre ausente gera `XXX` reservado. Editor e exportação devem consumir esse mesmo mapa; não duplicar a resolução em componentes.

## Estrutura canônica de exportação

`parseHtmlParaEstrutura()` converte o HTML já resolvido em `DocumentoExportacao` (`versao: 1`). Parágrafos carregam estilos, alinhamento, espaçamentos e `recuoPrimeiraLinhaPt`; uma quebra de página é o bloco `{ tipo: 'quebra-pagina' }`.

A escrita canônica no editor é `<div data-quebra-pagina="true" style="break-after: page;"></div>`. Na leitura, `normalizarQuebrasPaginaHtml()` também aceita `<!-- pagebreak -->` e divs equivalentes, normalizando-as antes do parser. O marcador deve permanecer um bloco independente para preservar sua posição relativa aos demais blocos.

A validação no processo principal rejeita documentos fora desse contrato antes da geração. Não é uma fronteira IPC permissiva: dados inválidos não seguem para os conversores.

## Regras de saída

A exportação remove prévias transitórias de placeholder, controles transitórios de supressão e qualquer bloco com `data-cond-suprimido="true"`. Placeholders sem valor resolvem para `<span class="campo-reservado" data-reservado="true">XXX</span>`. Bloco pericial não suprimido que contenha somente espaço ou parágrafo vazio recebe um parágrafo com o mesmo marcador. `XXX` não bloqueia a exportação.

Valores estruturais são inseridos como fragmento HTML. Tabelas recebem largura e largura máxima de 100%; a geração de PDF e ODT também força essas regras para impedir estouro horizontal.

PDF e preview aplicam `break-after: page` e `page-break-after: always` ao marcador. DOCX converte o recuo para twips (`w:firstLine`) e cada bloco de quebra em `PageBreak` nativo; ODT é produzido a partir do DOCX canônico pelo LibreOffice.

## Invariantes

- O HTML persistido mantém as chaves canônicas; valores resolvidos e prévias não devem ser gravados.
- O valor de HTML vem exclusivamente do resolvedor, nunca de atributo ou DOM do editor.
- Dados desconhecidos do GDL não se tornam placeholders automaticamente.
- Ausência de peça ou de valor não interrompe a exportação.
- Recuo e quebra de página devem atravessar parser e conversores sem se degradar em texto ou HTML comum.

## Verificação

`exportacao-parser.test.ts` cobre `text-indent`, o comentário legado e a ordem do bloco de quebra. `exportacao-docx-canonica.test.ts` inspeciona o XML do pacote para `w:firstLine` e `w:type="page"`, além da conversão ODT quando o LibreOffice está disponível. Os testes de exportação também cobrem placeholders B-602, tabelas, valores ausentes, blocos suprimidos e preenchimento de blocos periciais vazios.
