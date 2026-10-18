# Preview PDF e HTML do laudo

## Origem e cabeçalhos

A prévia aberta no editor parte do conteúdo atual dos editores, inclusive alterações ainda não salvas; a prévia pela lista parte de `laudos.conteudo`, sem editor aberto. Ambas resolvem placeholders com os dados atuais da REP e renumeram `TABELA N` no HTML final antes do PDF. No editor, a página também confere os títulos visíveis antes de montar o HTML e interrompe a geração se essa conferência falhar. A prévia transitória de placeholder não é a fonte canônica da saída.

`buildPdfHeaderConfig({ usarCopiaLaudo: true, apresentacaoJson, contexto })` usa a apresentação preservada no laudo, validada pelo contrato compartilhado. `cabecalho.primeiraPagina` entra no corpo antes das seções; `cabecalho.todasPaginas` vira `headerTemplate` do Chromium. A ativação do cabeçalho controla os dois conteúdos. Os dados preservados do perito são resolvidos como texto antes dos demais placeholders, que recebem o contexto atual da REP. `buildHeaderTemplate()` remove wrappers, converte `{{pagina}}`/`{{totalPaginas}}` nas classes nativas e substitui valores escapados, preservando caracteres literais de substituição.

O fechamento habilitado e não vazio entra uma única vez após todas as seções. `montarFechamentoHtml()` aplica `data-laudo-fechamento="true"`, espaçamento superior em pontos e `break-inside: avoid`/`page-break-inside: avoid`. Ele acompanha o fluxo do documento; não é rodapé fixo. Conteúdo sem texto, imagem ou tabela não reserva espaço. Fechamentos já escritos no corpo de templates não são removidos automaticamente.

## Configuração e prévias dos padrões

`CabecalhoPage.tsx`, na rota `/cabecalho`, oferece abas Cabeçalho e Fechamento com salvamento independente via IPC de configuração existente. As chaves JSON são `cabecalho_documento` e `fechamento_laudo`. Desativar preserva o HTML editável para reativação; o campo de espaçamento aceita de 0 a 300 pontos. As abas usam `forceMount` e ocultação visual, mantendo as três instâncias de editor montadas. A normalização dos placeholders ocorre no carregamento/inserção do modelo e ao salvar, não a cada tecla.

A prévia conjunta usa o rascunho das duas abas, inclusive conteúdo ainda não salvo, dados do perito carregados da sessão e REP demonstrativa. Falha de carregamento bloqueia edição, salvamento e prévia; falha na prévia mostra erro e fecha o diálogo. O botão de inserir modelo só atua em fechamento vazio. A indicação de assinatura digital é texto visual, sem assinatura criptográfica.

Prévia de template carrega os padrões ativos, não a cópia de um laudo. `carregarApresentacaoPadrao()` valida respostas IPC e JSON; ausência das novas chaves permite fallback ao cabeçalho legado e fechamento desativado, enquanto valor inválido gera erro. Os padrões de instalação ficam em `src/shared/configuracoes/apresentacao-laudo.ts` e `cabecalhos-padrao.ts`: cabeçalho e fechamento habilitados, com 34 pontos acima do fechamento. A ordem e o efeito das migrations 44/45 estão em `spec/03 laudo/laudo_ciclo_vida.md`.

## Margens e paginação

`getMargens()` sempre devolve margens válidas: configuração persistida normalizada ou o padrão `{ top: 2.5, right: 2, bottom: 2.5, left: 3 }` em centímetros. Para PDF, `exportacao.service.ts` e `template.handlers.ts` usam as mesmas margens efetivas. Quando existe cabeçalho de páginas, a margem superior é no mínimo 2,5 cm, mesmo se uma configuração menor chegar à camada de impressão. O `headerTemplate` é encaminhado explicitamente na exportação do laudo; assim o cálculo não depende do cabeçalho exclusivo da primeira página.

O HTML de impressão não introduz padding lateral alternativo: as margens de impressão definem a área útil e o documento usa os valores efetivos. Tabelas usam largura máxima de 100%, `thead` como `table-header-group` e `tr` com `break-inside: avoid`. As tabelas de placeholders identificadas por `data-placeholder-celula-fixa` também usam layout fixo, padding reduzido e quebra de texto para não ultrapassar a área imprimível; a partir de dez colunas, a fonte é menor. A regra compartilhada em `pdf-tabelas.ts` é aplicada na prévia e na exportação, inclusive a tabelas já inseridas no laudo. Em continuação de tabela, o cabeçalho da página e o cabeçalho da tabela ficam abaixo da margem superior, sem sobreposição.

## Prontidão e recuperação

`gerarPdfPreparado()` é compartilhado pela prévia e exportação. Após carregar o HTML em uma janela oculta com sandbox, verifica fontes e decodificação de imagens do corpo, inclusive URLs de imagem em estilos; verifica os recursos do cabeçalho em documento auxiliar isolado antes de imprimir. A preparação tem limite de 15 segundos e a impressão, de 30 segundos. Timeout, encerramento do renderer ou falha de recurso encerram a operação e limpam janelas e arquivos temporários; não há espera fixa nem PDF parcial. Os logs registram tempos, contagens e códigos, sem HTML ou conteúdo pericial.

As prévias de laudo validam a cópia completa da apresentação em modo estrito: ausência ou valor inválido resulta em `CABECALHO_INDISPONIVEL`, inclusive quando a falha está no fechamento, sem substituí-la pelos padrões ativos. O IPC devolve falha tipada com código, etapa e possibilidade de nova tentativa; a interface mostra orientação persistente, **Tentar novamente** e **Fechar**. Uma nova tentativa usa o conteúdo atual do editor, e uma falha não reapresenta a prévia anterior como se fosse a atual.

## Saída e verificação

O CSS de preview e PDF justifica parágrafos narrativos sem alinhamento próprio, excluindo tabelas e figuras. Alinhamento inline escolhido no editor prevalece. Valores personalizados por ocorrência aparecem com sua formatação, sem o destaque violeta do editor; as âncoras não personalizadas continuam resolvidas pelo mapa da REP/perito.

`renumerarTabelasHtml()` ignora prévias transitórias e aplica a sequência no documento completo após a resolução, inclusive quando tabelas B-602 carregam números fixos. A prévia pela lista confere somente o HTML gerado, pois não há editor para sincronizar.

Seções condicionais inativas ou suprimidas não aparecem na saída. Placeholders pendentes podem aparecer como `XXX`; isso informa dado ausente. Tabelas resolvidas recebem largura máxima de 100% no HTML e nas folhas de estilo do PDF/ODT.

`src/__tests__/renderer/margens.test.ts` cobre a normalização/fallback das margens. O smoke de PDF deve usar tabela suficiente para cruzar uma página e confirmar, visualmente, a margem superior e a repetição de cabeçalho na página seguinte.

`src/__tests__/pages/cabecalho-page.test.tsx` cobre carregamento, montagem estável, edição, salvamento por aba, desativação/reabertura e inserção do modelo. `src/__tests__/renderer/apresentacao-laudo.test.ts` cobre as quatro combinações de ativação e resolução do perito preservado. A paginação visual com fechamento próximo ao fim da página depende de smoke no Electron.
