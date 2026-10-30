# Preview PDF e HTML do laudo

## Origem e cabeçalhos

A prévia aberta no editor parte do conteúdo atual dos editores, inclusive alterações ainda não salvas; a prévia pela lista parte de `laudos.conteudo`, sem editor aberto. Ambas resolvem placeholders com os dados atuais da REP e renumeram `TABELA N` no HTML final antes do PDF. No editor, a página também confere os títulos visíveis antes de montar o HTML e interrompe a geração se essa conferência falhar. A prévia transitória de placeholder não é a fonte canônica da saída.

`buildPdfHeaderConfig({ usarCopiaLaudo: true, apresentacaoJson, contexto })` usa a apresentação preservada no laudo, validada pelo contrato compartilhado. `cabecalho.primeiraPagina` entra no corpo antes das seções; `cabecalho.todasPaginas` vira `headerTemplate` do Chromium. primeiraPaginaHabilitada e todasPaginasHabilitadas controlam os conteúdos independentemente. O formato legado com habilitado é aceito na leitura e aplica o mesmo valor às duas flags. Os dados preservados do perito são resolvidos como texto antes dos demais placeholders, que recebem o contexto atual da REP. `buildHeaderTemplate()` remove wrappers, converte `{{pagina}}`/`{{totalPaginas}}` nas classes nativas e substitui valores escapados, preservando caracteres literais de substituição.

`montarCabecalhoPrimeiraPagina()` em `src/renderer/lib/pdf-header.ts` concentra o wrapper inicial: quando há conteúdo, aplica `padding-bottom:24px` e `margin-bottom:0`; quando vazio, não cria wrapper nem reserva espaço. Os 24 px são uma separação adicional fixa, além do espaçamento próprio dos parágrafos do cabeçalho e do corpo. A prévia da página Cabeçalho, a prévia de templates, as duas prévias de laudo e a exportação usam a mesma montagem, inclusive para laudos existentes, sem regravar sua apresentação nem alterar PDFs já exportados.

O fechamento habilitado e não vazio entra uma única vez após todas as seções. `montarFechamentoHtml()` aplica `data-laudo-fechamento="true"`, espaçamento superior em pontos e `break-inside: avoid`/`page-break-inside: avoid`. Ele acompanha o fluxo do documento; não é rodapé fixo. Conteúdo sem texto, imagem ou tabela não reserva espaço. Fechamentos já escritos no corpo de templates não são removidos automaticamente.

## Configuração e prévias dos padrões

`CabecalhoPage.tsx`, na rota `/cabecalho`, oferece abas Cabeçalho e Fechamento com salvamento independente via IPC de configuração existente. As chaves JSON são `cabecalho_documento` e `fechamento_laudo`. Desativar preserva o HTML editável para reativação; o campo de espaçamento aceita de 0 a 300 pontos. As abas usam `forceMount` e ocultação visual, mantendo as três instâncias de editor montadas. A normalização dos placeholders ocorre no carregamento/inserção do modelo e ao salvar, não a cada tecla.

A prévia conjunta usa o rascunho das duas abas, inclusive conteúdo ainda não salvo, dados do perito carregados da sessão e REP demonstrativa. Falha de carregamento bloqueia edição, salvamento e prévia; falha na prévia mostra erro e fecha o diálogo. O botão de inserir modelo só atua em fechamento vazio. A indicação de assinatura digital é texto visual, sem assinatura criptográfica.

Prévia de template carrega os padrões ativos, não a cópia de um laudo. `carregarApresentacaoPadrao()` valida respostas IPC e JSON; ausência das novas chaves permite fallback ao cabeçalho legado e fechamento desativado, enquanto valor inválido gera erro. Os padrões de instalação ficam em `src/shared/configuracoes/apresentacao-laudo.ts` e `cabecalhos-padrao.ts`: cabeçalho e fechamento habilitados, com 34 pontos acima do fechamento. A ordem e o efeito das migrations 44/45 estão em `spec/03 laudo/laudo_ciclo_vida.md`.

## Margens e paginação

A fonte única dos padrões é `src/shared/configuracoes/margens-pdf.ts`: `MARGENS_PADRAO_PDF = { top: 3.5, right: 2, bottom: 1.5, left: 3 }`, em centímetros, e `CHAVE_MARGENS_PDF = pdf_margins`. Renderer, geração PDF e migration usam esse contrato. `getMargens()` devolve a configuração persistida normalizada ou esse padrão quando ausente, inválida ou indisponível. No renderer, valores numéricos finitos são limitados a 0–5 cm e arredondados a uma casa decimal; cada campo ausente ou inválido usa o padrão daquele lado. Para PDF, `exportacao.service.ts` e `template.handlers.ts` delegam a `criarOpcoesPdf()` em `src/main/services/pdf-layout.ts`. A função valida cada margem como número finito entre 0 e 5 cm e usa o padrão daquele lado se inválida; converte centímetros em polegadas para a impressão. A saída força A4 retrato, `preferCSSPageSize: false`, e a preparação injeta `@page { size: A4 portrait !important; }`, sem aceitar tamanho de página alternativo do HTML. O `headerTemplate` é encaminhado explicitamente na exportação do laudo; assim o cálculo não depende do cabeçalho exclusivo da primeira página.

A página Margens do PDF informa: **Padrão para assinatura no GDL: superior 3,5 cm, direita 2 cm, inferior 1,5 cm e esquerda 3 cm.** O aviso descreve os valores de referência mesmo quando a configuração atual é personalizada. **Restaurar padrão** altera os valores em edição; **Salvar margens** persiste o JSON na configuração local à instalação, usada também pelos laudos existentes, sem cópia em `apresentacao_json`. A migration v46 insere ou substitui essa configuração uma única vez, inclusive em instalações com margens personalizadas; alterações salvas depois são preservadas na reabertura. O aviso é orientação de layout e não executa assinatura nem operação no GDL.

O HTML de impressão não introduz padding lateral alternativo: as margens de impressão definem a área útil e o documento usa os valores efetivos. Tabelas usam largura máxima de 100%, `thead` como `table-header-group` e `tr` com `break-inside: avoid`. As tabelas não balísticas de placeholders identificadas por `data-placeholder-celula-fixa` usam layout fixo, padding reduzido e quebra de texto; a partir de dez colunas, a fonte é menor. Tabelas `data-tabela-laudo="balistica"` preservam palavras e podem ser divididas por colunas, repetindo a identificação e renumerando as partes. O renderer prepara o HTML e o main mede novamente após carregar fontes, usando a largura útil A4 menos as margens laterais. As restrições de estrutura e diferenças entre os caminhos estão em `spec/03 laudo/exportar_laudo.md`. A regra compartilhada em `pdf-tabelas.ts` é aplicada na prévia e na exportação, inclusive a tabelas já inseridas no laudo. Em continuação de tabela, a reserva do cabeçalho da página desloca o início do corpo e o cabeçalho repetido da tabela. A paginação final depende do motor Chromium.

A regra de bordas de pdf-tabelas.ts também atende aos quadros fotográficos: border="0" retira bordas das células sem estilo explícito, inclusive cabeçalhos; bordas escolhidas diretamente nas células prevalecem. A moldura individual da figura permanece independente. O contrato de figuras e a distinção entre interface, HTML persistido e saída estão em [Padrão de elaboração](padrao/padrao_elaboracao.md); os detalhes de impressão estão em [Exportação](exportar_laudo.md#bordas-de-quadros-fotográficos-no-pdf). A prévia e o PDF exportado devem ser conferidos com as mesmas entradas e margens, sem usar as guias ou o tema do editor como referência de impressão.

## Prontidão e recuperação

`gerarPdfPreparado()` é compartilhado pela prévia e exportação. Após carregar o HTML em uma janela oculta com sandbox, verifica fontes e decodificação de imagens do corpo, inclusive URLs de imagem em estilos; verifica os recursos do cabeçalho em documento auxiliar isolado antes de imprimir. A preparação tem limite de 15 segundos e a impressão, de 30 segundos. Timeout, encerramento do renderer ou falha de recurso encerram a operação e limpam janelas e arquivos temporários; não há espera fixa nem PDF parcial. Os logs registram tempos, contagens e códigos, sem HTML ou conteúdo pericial.

As prévias de laudo validam a cópia completa da apresentação em modo estrito: ausência ou valor inválido resulta em `CABECALHO_INDISPONIVEL`, inclusive quando a falha está no fechamento, sem substituí-la pelos padrões ativos. O IPC devolve falha tipada com código, etapa e possibilidade de nova tentativa; a interface mostra orientação persistente, **Tentar novamente** e **Fechar**. Uma nova tentativa usa o conteúdo atual do editor, e uma falha não reapresenta a prévia anterior como se fosse a atual.

## Saída e verificação

O CSS de preview e PDF justifica parágrafos narrativos sem alinhamento próprio, excluindo tabelas e figuras. Alinhamento inline escolhido no editor prevalece. Valores personalizados por ocorrência aparecem com sua formatação, sem o destaque violeta do editor; as âncoras não personalizadas continuam resolvidas pelo mapa da REP/perito.

`renumerarTabelasHtml()` ignora prévias transitórias e aplica a sequência no documento completo após a resolução, inclusive quando tabelas B-602 carregam números fixos. A prévia pela lista confere somente o HTML gerado, pois não há editor para sincronizar.

Seções condicionais inativas ou suprimidas não aparecem na saída. Placeholders pendentes podem aparecer como `XXX`; isso informa dado ausente. Tabelas resolvidas recebem largura máxima de 100% no HTML e nas folhas de estilo do PDF/ODT.

`src/__tests__/renderer/margens.test.ts` cobre a normalização/fallback das margens. O smoke de PDF deve usar tabela suficiente para cruzar uma página e confirmar, visualmente, a margem superior e a repetição de cabeçalho na página seguinte.

`src/__tests__/pages/cabecalho-page.test.tsx` cobre carregamento, montagem estável, edição, salvamento por aba, desativação/reabertura e inserção do modelo. `src/__tests__/renderer/apresentacao-laudo.test.ts` cobre as quatro combinações de ativação e resolução do perito preservado. A paginação visual com fechamento próximo ao fim da página depende de smoke no Electron.

## Reserva do cabeçalho repetido

`criarOpcoesPdf()` posiciona `#lawdo-cabecalho-pdf` no topo e na lateral configurados, com largura de 21 cm menos as margens esquerda/direita. Após fontes e imagens estarem prontas no documento auxiliar, `gerarPdfPreparado()` mede sua altura; os contadores temporariamente usam 9999 para reservar largura. `reservarEspacoCabecalho()` acrescenta à margem superior do corpo a altura medida (96 px/polegada) e 0,3 cm de separação. Não há piso fixo de 2,5 cm acionado pela mera presença de cabeçalho.

Altura zero desativa cabeçalho/rodapé nessa impressão sem adicionar reserva. Medida ausente, não numérica, não finita ou negativa, ou cabeçalho que deixe no máximo 1 cm de altura útil, resulta em `CABECALHO_INDISPONIVEL` na etapa `recursos`, sem retry sugerido pelo contrato. A interface orienta rever altura e margens. O rodapé permanece vazio; fechamento continua no fluxo do corpo.

`normalizarRotuloCabecalho()` padroniza o texto legado **LAUDO nº** para **LAUDO Nº** nos trechos de texto de `todasPaginas`, preservando tags/atributos. A leitura da cópia validada do laudo, dos padrões ativos e a construção do header aplicam essa normalização, sem migration nem regravação automática das cópias existentes. A identidade preservada e os demais conteúdos seguem o contrato de apresentação.

`pdf-layout.test.ts` cobre A4, margens, posicionamento e reserva; `pdf-preview-layout.test.ts` verifica o caminho compartilhado da prévia. `pdf-prontidao.service.test.ts` cobre medição, cabeçalho vazio, altura inviável e impressão simulada; `pdf-header-prontidao.test.ts` e `apresentacao-laudo.test.ts` protegem a normalização do rótulo. Esses testes não substituem conferir visualmente PDF com tabela longa e cabeçalho de várias linhas.

## Recursos locais de figuras

Antes de gerar a prévia pelo editor ou pela lista, resolverImagensImpressaoLaudo() troca as figuras marcadas data-imagem-previa="true" por recursos de impressão obtidos do arquivo local validado. IDs repetidos compartilham o recurso na mesma composição. Falta de ID, arquivo indisponível ou falha de integridade interrompe a saída; a prévia reduzida do editor não é usada silenciosamente no PDF. Limites, proporção e contratos estão em exportar_laudo.md e fluxo_ilustracao.md.

Na página Cabeçalho, os controles **Inserir na primeira página** e **Inserir em todas as páginas** preservam seus HTMLs quando desligados. O salvamento usa o contrato atual com flags separadas; a cópia preservada de cada laudo continua sendo sua fonte de apresentação.
