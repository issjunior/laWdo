# Exportação do laudo e resolução de placeholders

## Fonte de resolução

`exportacao-placeholders.ts` constrói o mapa de valores a partir da REP e de seu contexto. No B-602, `projetarB602ParaLaudo()` é a fonte derivada de material, cartuchos, estojos e armas; novas gravações usam `b602.pecas`, e arrays legados são apenas fallback de leitura.

`construirMapaPlaceholdersResolvidos()` expõe, por chave, valor, preenchimento e formato (`texto`, `html` estrutural ou `html-inline`). O resumo de lacres de saída B-602 é um valor inline: armas são referenciadas individualmente por letra, estojos são agrupados, e cada lacre ausente gera `XXX` reservado. Editor, IA, preview e exportação devem consumir esse mesmo mapa; não duplicar a resolução em componentes.

### Identidade e concordância do perito

`users.forma_tratamento` é `masculino` ou `feminino`, com padrão masculino na migration v41 e no cadastro. O login transporta a escolha pela sessão local validada; `obterFormasPerito()` deriva `perito_cargo`, `perito_artigo`, `perito_titulo`, `perito_designado`, `perito_pelo` e `perito_qual`. O cargo conhecido alterna Perito/Perita ou Técnico/Técnica; cargo desconhecido permanece literal. O mapa de exportação e as prévias de templates e cabeçalhos usam essas formas. O texto livre não recebe flexão automática; a concordância depende de placeholders escritos no modelo. `perito-tratamento.test.ts` e `exportacao-placeholders.test.ts` cobrem os dois valores.

### Placeholders personalizados

O contexto de resolução recebe os placeholders personalizados cadastrados, com chave e valor padrão. Eles entram primeiro no mapa para estarem disponíveis em editor, IA, preview e exportação; chaves conhecidas da REP, do perito ou calculadas pelo B-602 são preenchidas depois e têm precedência. Chave vazia é ignorada e valor padrão ausente torna-se texto vazio, preservando o comportamento de `XXX` para placeholder não preenchido.
### Datas da REP importada do GDL

`data_recebimento_rep` sempre formata `rep.data_requisicao`, que representa a Data de Entrada/Solicitação importada ou informada manualmente. Somente `data_extenso_recebimento_rep` tem uma fonte alternativa: quando `campos_especificos` contém `integracaoGdl.dataExecucaoLaudo` como texto não vazio, ela formata essa data por extenso; caso contrário, usa `data_requisicao`.

A leitura do JSON é defensiva: JSON inválido, estrutura ausente ou valor não textual não interrompem a exportação e ativam o fallback. O metadado é criado apenas em novas importações GDL quando existe andamento válido de execução; exportar não consulta nem altera o GDL e REPs anteriores continuam no fallback.

## Estrutura canônica de exportação

`parseHtmlParaEstrutura()` converte o HTML já resolvido em `DocumentoExportacao` (`versao: 1`). Parágrafos carregam estilos, alinhamento, espaçamentos e `recuoPrimeiraLinhaPt`; uma quebra de página é o bloco `{ tipo: 'quebra-pagina' }`.

A escrita canônica no editor é `<div data-quebra-pagina="true" style="break-after: page;"></div>`. Na leitura, `normalizarQuebrasPaginaHtml()` também aceita `<!-- pagebreak -->` e divs equivalentes, normalizando-as antes do parser. O marcador deve permanecer um bloco independente para preservar sua posição relativa aos demais blocos.

Parágrafos `<p>` sem `text-align` explícito recebem `justify` no documento canônico, exceto dentro de tabelas e figuras; títulos e alinhamentos manuais mantêm seu valor. As folhas de impressão de PDF e preview aplicam o mesmo padrão, sem alterar o HTML salvo. DOCX consome o alinhamento canônico e ODT deriva dele. `exportacao-parser.test.ts` protege essa precedência.

A validação no processo principal rejeita documentos fora desse contrato antes da geração. Não é uma fronteira IPC permissiva: dados inválidos não seguem para os conversores.

### Tabelas no documento canônico

`exportacao-parser.ts` transforma texto direto e formatação inline de `<td>`/`<th>` em parágrafos da célula, preserva blocos mistos na ordem e representa `<caption>` como parágrafo antes da tabela. DOCX consome esse documento canônico; ODT converte o DOCX gerado pelo mesmo caminho. Por isso, texto de células não pode depender de um `<p>` explícito no HTML.

## Regras de saída

Em ocorrência personalizada, a exportação prefere o HTML local de `data-placeholder-personalizado-html`, remove o destaque violeta e não consulta novamente o GDL. **Restaurar valor da REP** remove essa personalização e volta a resolver o valor já disponível no mapa local. Campos livres personalizados também saem sem o destaque visual.

A exportação remove prévias transitórias de placeholder, controles de tabelas e blocos condicionais, atributos de edição e qualquer bloco com `data-cond-suprimido="true"`. Placeholders sem valor resolvem para `<span class="campo-reservado" data-reservado="true">XXX</span>`. Bloco pericial não excluído que contenha somente espaço ou parágrafo vazio recebe um parágrafo com o mesmo marcador. `XXX` não bloqueia a exportação.

Valores estruturais são inseridos como fragmento HTML. Tabelas recebem largura e largura máxima de 100%; a geração de PDF e ODT também força essas regras para impedir estouro horizontal. Quando uma tabela foi personalizada no laudo, a cópia local substitui a resolução da âncora vinculada; identificadores, classes e controles exclusivamente visuais são removidos da saída.

Na exportação iniciada pelo editor, `LaudosPage.tsx` lê primeiro os editores abertos, confere e corrige seus títulos `TABELA N`, e só então monta o HTML a exportar. Depois de resolver todos os placeholders, `renumerarTabelasHtml()` confere o HTML final; isso impede que os títulos fixos B-602 restaurem números antigos. Falha na conferência anterior à geração interrompe a operação com erro, antes de produzir arquivo.

PDF e preview aplicam `break-after: page` e `page-break-after: always` ao marcador. DOCX converte o recuo para twips (`w:firstLine`) e cada bloco de quebra em `PageBreak` nativo; ODT é produzido a partir do DOCX canônico pelo LibreOffice.

## Invariantes

- O HTML persistido mantém as chaves canônicas; valores resolvidos e prévias transitórias não devem ser gravados. A personalização manual por ocorrência é uma exceção intencional, persistida como HTML sanitizado no atributo local da âncora.
- Valores HTML de placeholders vêm do resolvedor; tabelas personalizadas vinculadas usam a cópia local persistida. Prévias transitórias e atributos de apresentação não entram na saída.
- Dados desconhecidos do GDL não se tornam placeholders automaticamente.
- A data de execução GDL afeta somente `data_extenso_recebimento_rep`; não altera a data de recebimento, a REP persistida fora do metadado nem o GDL.
- Ausência de peça ou de valor não interrompe a exportação.
- Recuo, quebra de página, texto de células e títulos de tabelas devem atravessar parser e conversores sem se degradar em texto ou HTML comum.

## Verificação

`exportacao-parser.test.ts` cobre `text-indent`, quebra de página, caption, texto direto e blocos mistos em células. `exportacao-docx-canonica.test.ts` inspeciona o XML de DOCX e ODT para garantir texto de tabela, além de `w:firstLine` e `w:type="page"`; a conversão ODT depende de LibreOffice disponível. `exportacao-placeholders.test.ts` cobre o fallback/precedência de `data_extenso_recebimento_rep` e o valor padrão de placeholder personalizado. Os demais testes de exportação cobrem placeholders B-602, tabelas, valores ausentes, blocos suprimidos e preenchimento de blocos periciais vazios.
