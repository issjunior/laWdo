# Exportação do laudo e resolução de placeholders

## Fonte de resolução

`exportacao-placeholders.ts` constrói o mapa de valores a partir da REP e de seu contexto. No B-602, `projetarB602ParaLaudo()` é a fonte derivada de material, cartuchos, estojos e armas; novas gravações usam `b602.pecas`, e arrays legados são apenas fallback de leitura.

`construirMapaPlaceholdersResolvidos()` expõe, por chave, valor, preenchimento e formato (`texto`, `html` estrutural ou `html-inline`). O resumo de lacres de saída B-602 é um valor inline: armas são referenciadas individualmente por letra, estojos são agrupados, e cada lacre ausente gera `XXX` reservado. Editor, IA, preview e exportação devem consumir esse mesmo mapa; não duplicar a resolução em componentes.

### Identidade e concordância do perito

`users.forma_tratamento` é `masculino` ou `feminino`, com padrão masculino na migration v41 e no cadastro. O login transporta a escolha pela sessão local validada; `obterFormasPerito()` deriva `perito_cargo`, `perito_artigo`, `perito_titulo`, `perito_designado`, `perito_pelo` e `perito_qual`. O cargo conhecido alterna Perito/Perita ou Técnico/Técnica; cargo desconhecido permanece literal. O mapa de exportação e as prévias de templates e cabeçalhos usam essas formas. O texto livre não recebe flexão automática; a concordância depende de placeholders escritos no modelo. `perito-tratamento.test.ts` e `exportacao-placeholders.test.ts` cobrem os dois valores.

`obterFormasPerito()` vive em `src/shared/utils/perito-tratamento.ts`; o módulo do renderer reexporta o contrato. Cabeçalhos e fechamento de laudos resolvem primeiro os valores de `apresentacao_json.perito`, capturados pelo main na criação, usando nós de texto para preservar escape HTML. Os demais placeholders dessas regiões usam o contexto atual da REP. Essa cópia não congela a identidade nos placeholders do corpo: `buildPlaceholderMapping()` continua lendo o perito da sessão. Prévias de templates e da configuração usam o perfil atual.

### Placeholders personalizados

O contexto de resolução recebe os placeholders personalizados cadastrados, com chave e valor padrão. Eles entram primeiro no mapa para estarem disponíveis em editor, IA, preview e exportação; chaves conhecidas da REP, do perito ou calculadas pelo B-602 são preenchidas depois e têm precedência. Chave vazia é ignorada e valor padrão ausente torna-se texto vazio, preservando o comportamento de `XXX` para placeholder não preenchido.
### Datas da REP importada do GDL

`data_recebimento_rep` sempre formata `rep.data_requisicao`, que representa a Data de Entrada/Solicitação importada ou informada manualmente. Somente `data_extenso_recebimento_rep` tem uma fonte alternativa: quando `campos_especificos` contém `integracaoGdl.dataExecucaoLaudo` como texto não vazio, ela formata essa data por extenso; caso contrário, usa `data_requisicao`.

A leitura do JSON é defensiva: JSON inválido, estrutura ausente ou valor não textual não interrompem a exportação e ativam o fallback. O metadado é criado apenas em novas importações GDL quando existe andamento válido de execução; exportar não consulta nem altera o GDL e REPs anteriores continuam no fallback.

## Estrutura canônica de exportação

`parseHtmlParaEstrutura()` converte o HTML já resolvido em `DocumentoExportacao` (`versao: 1`). Parágrafos carregam estilos, alinhamento, espaçamentos e `recuoPrimeiraLinhaPt`; uma quebra de página é o bloco `{ tipo: 'quebra-pagina' }`.

A escrita canônica no editor é `<div data-quebra-pagina="true" style="break-after: page;"></div>`. Na leitura, `normalizarQuebrasPaginaHtml()` também aceita `<!-- pagebreak -->` e divs equivalentes, normalizando-as antes do parser. O marcador deve permanecer um bloco independente para preservar sua posição relativa aos demais blocos.

Parágrafos `<p>` sem `text-align` explícito recebem `justify` no documento canônico, exceto dentro de tabelas e figuras; títulos e alinhamentos manuais mantêm seu valor. As folhas de impressão de PDF e preview aplicam o mesmo padrão, sem alterar o HTML salvo. DOCX consome o alinhamento canônico e ODT deriva dele. `exportacao-parser.test.ts` protege essa precedência.

A validação `documentoValido()` no processo principal confere versão, fonte, tamanho e a estrutura básica dos blocos de `secoes` antes de gerar DOCX/ODT. Ela não valida profundamente todos os estilos/conteúdos aninhados e atualmente não verifica o campo opcional `fechamento`; o tipo TypeScript não substitui essa validação em runtime. O fechamento produzido pelo renderer é separado pelo parser, mas não deve ser considerado validado contra payload IPC arbitrário pelo main.

### Tabelas no documento canônico

`exportacao-parser.ts` transforma texto direto e formatação inline de `<td>`/`<th>` em parágrafos da célula, preserva blocos mistos na ordem e representa `<caption>` como parágrafo antes da tabela. DOCX consome esse documento canônico; ODT converte o DOCX gerado pelo mesmo caminho. Por isso, texto de células não pode depender de um `<p>` explícito no HTML.

## Cabeçalho, fechamento e margens de parágrafo

`LaudosPage.tsx` monta cabeçalho da primeira página, corpo resolvido e fechamento nessa ordem, usando a apresentação preservada. DOCX/ODT recebem o cabeçalho inicial no próprio corpo canônico, sem a antiga duplicação por `params.cabecalho` nesse fluxo. O parser expande o wrapper `.cabecalho` e separa imagens dentro de parágrafos, preservando texto formatado antes/depois e a ordem. O cabeçalho repetido `headerTemplate`, com contador Chromium, pertence ao caminho PDF; não é enviado como cabeçalho repetido nativo nesse fluxo de DOCX/ODT.

O wrapper inicial é montado por `montarCabecalhoPrimeiraPagina()` em `src/renderer/lib/pdf-header.ts`, compartilhado com as prévias de laudo, template e página Cabeçalho. No HTML/PDF, acrescenta 24 px de padding inferior e nenhuma margem inferior ao wrapper; o espaçamento próprio dos parágrafos permanece. Cabeçalho vazio não cria wrapper. A regra alcança laudos novos e existentes sem alterar suas cópias de apresentação. DOCX/ODT expandem o wrapper no parser e não transportam esse padding externo como uma separação canônica de 24 px.

As margens de página partem da configuração local `pdf_margins`, consumida por `getMargens()`. O padrão compartilhado em `src/shared/configuracoes/margens-pdf.ts` é superior 3,5 cm, direita 2 cm, inferior 1,5 cm e esquerda 3 cm. A migration v46 aplica esses valores uma única vez, substituindo configurações anteriores; personalizações posteriores são mantidas. O fluxo de configuração, normalização e reserva do cabeçalho repetido está em `spec/03 laudo/visualizar_pdf.md`.

`DocumentoExportacao` mantém versão 1 e aceita `fechamento?: { blocos, espacamentoAntesPt }`. O parser extrai o primeiro wrapper `data-laudo-fechamento="true"`, retira-o das seções comuns e limita o espaçamento lido a 0–300 pt, usando zero para valor não finito. `gerarDOCXCanonico()` acrescenta esses blocos depois das seções em uma única célula de tabela sem bordas, com `cantSplit` na linha e margem superior da célula em twips. Isso pede que o conversor mantenha o fechamento junto quando couber em uma página; não constitui garantia para conteúdo maior que a área imprimível. ODT deriva desse DOCX via LibreOffice. No PDF o wrapper permanece no fluxo com quebra interna evitada.

O fechamento desativado ou vazio não é acrescentado nem reserva espaço. Ele é externo ao HTML editado do laudo e aparece uma única vez na composição automática; texto de fechamento já existente no template/corpo continua presente, podendo duplicar o resultado. A menção de assinatura digital no modelo é somente visual.

`parseHtmlParaEstrutura()` lê `marginTop`/`marginBottom` pelo estilo do DOM, inclusive a expansão de `margin`, e converte pt, px, cm, mm e in com `medidas-texto.ts`. Margem ausente permanece `undefined`; zero explícito permanece zero. A geração DOCX testa presença em vez de truthiness e grava `w:before`/`w:after` em twips, sem modificar a altura da linha. Essas regras também afetam os parágrafos do fechamento.

## Regras de saída

Em ocorrência personalizada, a exportação prefere o HTML local de `data-placeholder-personalizado-html`, remove o destaque violeta e não consulta novamente o GDL. **Restaurar valor da REP** remove essa personalização e volta a resolver o valor já disponível no mapa local. Campos livres personalizados também saem sem o destaque visual.

A exportação remove prévias transitórias de placeholder, controles de tabelas e blocos condicionais, atributos de edição e qualquer bloco com `data-cond-suprimido="true"`. Placeholders sem valor resolvem para `<span class="campo-reservado" data-reservado="true">XXX</span>`. Bloco pericial não excluído que contenha somente espaço ou parágrafo vazio recebe um parágrafo com o mesmo marcador. `XXX` não bloqueia a exportação.

Valores estruturais são inseridos como fragmento HTML. Tabelas recebem largura e largura máxima de 100%. No PDF, tabelas não balísticas de placeholders marcadas por `data-placeholder-celula-fixa` recebem layout fixo, padding reduzido e quebra de texto; as de dez ou mais colunas usam fonte menor. As tabelas balísticas seguem o contrato específico abaixo, com palavras preservadas e divisão por colunas. A prévia e a exportação compartilham essas regras em `pdf-tabelas.ts`, necessárias porque `max-width: 100%` sozinho não contém uma tabela larga. ODT mantém seu caminho próprio de conversão. Quando uma tabela foi personalizada no laudo, a cópia local substitui a resolução da âncora vinculada; identificadores, classes e controles exclusivamente visuais são removidos da saída.

Na exportação iniciada pelo editor, `LaudosPage.tsx` lê primeiro os editores abertos, confere e corrige seus títulos `TABELA N`, e só então monta o HTML a exportar. Depois de resolver todos os placeholders, `renumerarTabelasHtml()` confere o HTML final; isso impede que os títulos fixos B-602 restaurem números antigos. Falha na conferência anterior à geração interrompe a operação com erro, antes de produzir arquivo.

PDF e preview aplicam `break-after: page` e `page-break-after: always` ao marcador. Ambos usam `gerarPdfPreparado()` para aguardar carregamento, fontes e imagens antes de imprimir, com limites de 15 segundos para preparação e 30 segundos para impressão. A leitura de cabeçalho é estrita: falha não vira ausência confirmada. Falhas de PDF têm código e etapa tipados e oferecem nova tentativa na interface, sem descartar as edições atuais.

Na exportação, o buffer completo é gravado em arquivo temporário no diretório de destino e só então movido para o nome escolhido. Uma falha de preparação ou impressão não substitui o arquivo existente. Se a escrita ou renomeação falhar com `EPERM`, `EACCES` ou `EBUSY`, retorna orientação para fechar o documento em outro programa, escolher outro nome/pasta ou conferir permissões; não apresenta essa falha de destino como falha de renderização. O temporário é removido no `finally`, e outros erros seguem o tratamento geral. DOCX converte o recuo para twips (`w:firstLine`) e cada bloco de quebra em `PageBreak` nativo; ODT é produzido a partir do DOCX canônico pelo LibreOffice.

## Invariantes

- O HTML persistido mantém as chaves canônicas; valores resolvidos e prévias transitórias não devem ser gravados. A personalização manual por ocorrência é uma exceção intencional, persistida como HTML sanitizado no atributo local da âncora.
- Valores HTML de placeholders vêm do resolvedor; tabelas personalizadas vinculadas usam a cópia local persistida. Prévias transitórias e atributos de apresentação não entram na saída.
- Dados desconhecidos do GDL não se tornam placeholders automaticamente.
- A data de execução GDL afeta somente `data_extenso_recebimento_rep`; não altera a data de recebimento, a REP persistida fora do metadado nem o GDL.
- Ausência de peça ou de valor não interrompe a exportação.
- Recuo, quebra de página, texto de células e títulos de tabelas devem atravessar parser e conversores sem se degradar em texto ou HTML comum.

## Verificação

`exportacao-parser.test.ts` cobre `text-indent`, quebra de página, caption, texto direto e blocos mistos em células. `exportacao-docx-canonica.test.ts` inspeciona o XML de DOCX e ODT para garantir texto de tabela, além de `w:firstLine` e `w:type="page"`; a conversão ODT depende de LibreOffice disponível. `exportacao-placeholders.test.ts` cobre o fallback/precedência de `data_extenso_recebimento_rep` e o valor padrão de placeholder personalizado. Os demais testes de exportação cobrem placeholders B-602, tabelas, valores ausentes, blocos suprimidos e preenchimento de blocos periciais vazios.

`apresentacao-laudo.test.ts` cobre ordem, ativação, dados preservados, fechamento vazio e imagens/texto de cabeçalho. `exportacao-parser.test.ts` cobre margens abreviadas, pixels, zero e ausência; `exportacao-docx-canonica.test.ts` confere margens explícitas, entrelinha e a linha indivisível sem bordas do fechamento no XML. A paginação final e a conversão ODT dependem dos motores de impressão/conversão e de validação visual.

## Tabelas balísticas e área útil

`data-tabela-laudo="balistica"` identifica tabelas B-601/B-602 geradas, grupos descritivos B-601 e tabelas fixas reconhecidas na resolução desses exames, exceto layouts com figuras. `src/shared/utils/tabelas-balistica-layout.ts` concentra CSS e cálculo puro de grupos/larguras; `tabelas-balistica-layout.ts` no renderer mede e adapta o HTML. A página fornece `larguraUtilTabelasCm = 21 - esquerda - direita` ao mapa e à resolução de placeholders; outros consumidores usam 16 cm como padrão.

O layout preserva palavras: usa quebra normal, sem hifenização nem `overflow-wrap: anywhere`. Calcula a largura mínima pela maior palavra da coluna mais folga e distribui a sobra com pesos maiores para descrição, origem e observações. No renderer, a medição usa canvas ou estimativa de sete pixels por caractere quando indisponível. A apresentação no editor ajusta larguras sem dividir; a resolução destinada à saída pode dividir colunas em tabelas sucessivas, repetindo a primeira coluna identificadora, acrescentando **parte N/M** e renumerando o resultado completo.

O algoritmo de divisão exige tabela regular, linha inicial de título única e cabeçalho de colunas no `thead`, sem mesclagens nas linhas de dados/cabeçalho. Estruturas irregulares, como o quadro de investigação com colspan, não passam pela divisão. O renderer preserva tabelas dentro de `[data-placeholder-tabela-personalizada]`. A preparação PDF executa uma segunda medição no DOM carregado, com fontes computadas e largura real, em `pdf-tabelas.ts`; esse caminho seleciona todas as tabelas balísticas elegíveis, inclusive cópias locais, e renumera após dividir. Uma palavra isolada maior que a área útil interrompe a preparação em vez de ser fragmentada. DOCX/ODT recebem a adaptação feita no renderer, sem essa segunda medição Chromium.

Margens, A4 e reserva medida para cabeçalho repetido são compartilhados por prévia e exportação em `pdf-layout.ts`, conforme `spec/03 laudo/visualizar_pdf.md`. `tabelas-balistica-layout.test.ts`, `pdf-layout.test.ts`, `pdf-preview-layout.test.ts`, `pdf-prontidao.service.test.ts` e `exportacao-pdf-segura.test.ts` cobrem os cálculos, opções, preparação e falhas simuladas; a paginação real exige verificação visual.

## Textos calculados e unidade policial

O B-602 deriva `b602_total_estojos_extenso`, `b602_estojos_descricao` e `b602_estojos_conclusao` da soma das quantidades da projeção de estojos. Exatamente um usa o singular do catálogo `b602-textos-estojos.catalogo.ts`; os demais totais usam o plural. `numero-extenso.ts` aceita inteiros seguros não negativos, escreve zero e retorna vazio para números inválidos. A soma usa parseInt por quantidade, com zero quando não interpretável; não soma frações. Com projeção válida e coleção vazia, calcula zero por extenso e textos no plural, embora a seção condicional de estojos normalmente não seja exibida. Sem dados B-602 válidos, permanece o tratamento normal de ausência. São valores derivados, sem nova persistência na REP; o texto da conclusão é modelo resolvido, não resultado de nova consulta ou inferência pericial.

Nos quadros de investigação B-601/B-602, a Unidade Policial combina o nome resolvido com `integracaoGdl.dadosSolicitacao.cidade` quando textual e não vazia, escapando a cidade para HTML. A cidade é a do órgão solicitante, não a cidade de ocorrência. Sem o metadado mantém só o nome. Os quadros de material usam o rótulo **Dito no Ofício**, preservando a chave de dados `dito_oficio`. `exportacao-placeholders.test.ts`, `exportacao-placeholders-b602.test.ts` e `numero-extenso.test.ts` cobrem essa resolução.

## Figuras locais e proporção no DOCX

Depois de resolver placeholders e antes de gerar PDF ou construir o documento canônico DOCX/ODT, a página substitui figuras data-imagem-previa="true" pelos recursos locais via resolverImagensImpressaoLaudo(). A largura máxima do recurso é a largura útil A4 em centímetros convertida para 300 dpi, arredondada para cima e limitada a 1–3000 px. A consulta é sequencial, com cache por ID durante a composição; falha impede gerar o arquivo. O main valida vínculo e SHA-256. JPEG/PNG/GIF/BMP abaixo do limite podem usar bytes originais; arquivos maiores são reduzidos proporcionalmente, e WebP é convertido para PNG. JPEG reduzido usa qualidade 90. A cópia de saída perde o marcador, mas mantém a identidade da figura até a montagem.

gerarDOCXCanonico() mede as dimensões reais da imagem e deriva a altura da largura final; não força proporção 4:3 nem combina largura e altura inconsistentes do HTML. Usa largura explícita, ou altura convertida pela proporção, ou largura padrão, limitada à área útil da página. Reduz o recurso a aproximadamente 300 dpi da largura exibida quando necessário. ODT herda esse resultado por converter o DOCX. exportacao-docx-proporcao.test.ts e imagens-impressao-laudo.test.ts cobrem proporção e resolução; o arquivo original permanece local.

No B-602, os cartuchos também têm total por extenso e descrição singular/plural em b602-textos-cartuchos.catalogo.ts: b602_total_cartuchos_extenso e b602_cartuchos_descricao derivam da soma das quantidades projetadas, sem nova persistência. O modelo integrado ativo v11 usa esses valores na seção DOS CARTUCHOS; os textos de estojos seguem seu catálogo próprio. Para a tabela alternativa b601_tabela_material_coleta, fontes, personalização e referências do mesmo caso estão em b601.md; controles interativos são removidos antes da saída.
