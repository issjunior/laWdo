# Ciclo de vida atual do laudo

## Criação

`criarLaudoInicial()` impede duplicidade por `rep_id`, valida que o template existe e, quando sua origem é `integrado`, exige que ele esteja disponível para novos laudos. Também rejeita template integrado sem seções, evitando criar um laudo vazio por falha de catálogo ou sincronização.

Após as validações, busca as seções do template, lê `campos_especificos`, filtra seções ativas, expande repetições e grava o HTML com status `Em andamento`, `tipo_criacao = 'template'`, `versao = 1` e `data_inicio`. Na ausência de conteúdo de template não integrado, usa `<p>Laudo em elaboracao.</p>`.

## Edição e painéis laterais

`LaudosPage.tsx` orquestra o TinyMCE, o estado React do conteúdo e os painéis de IA e Ilustrações. Os docks direitos são separados e mutuamente exclusivos, reservam largura real ao lado do documento e mantêm o editor montado ao abrir, recolher, trocar ou redimensionar. Um trilho vertical permanente abre IA, Ilustrações e Ferramentas; janelas destacadas podem coexistir fora do dock.

A largura integrada é persistida por painel somente após interação. A navegação esquerda pode ser recolhida temporariamente enquanto um dock está expandido, sem alterar a preferência normal da sidebar.

Transformações da IA são vinculadas ao alvo capturado. Antes da prévia e da aplicação, o renderer recalcula o fingerprint; conteúdo alterado bloqueia a substituição. O HTML é reconstruído a partir da estrutura original, e somente os fragmentos textuais propostos são editáveis. Inserções e substituições são aplicadas em uma única `undoManager.transact`, sincronizam o estado React e registram alteração pendente com origem `ia`. A IA não salva o laudo e resultados de lotes não são aplicados parcialmente.

## Atualização e reconciliação

`updateConteudo()` substitui o conteúdo e `updated_at`. A evolução estrutural acontece em `sincronizarSecoesCondicionais()`, que recompõe a base do template e a reconcilia com o HTML salvo.

Para seções B-602 derivadas, a reconciliação identifica blocos periciais versionados por `data-arma-chave` e `data-bloco-pericial`. Quando a peça permanece na projeção, o conteúdo atual do wrapper — inclusive `data-cond-suprimido="true"` — prevalece sobre o conteúdo-base. Headings internos legados são descartados durante essa preservação. Blocos de arma removida não são carregados para a nova estrutura.

O laudo combina template, dados da REP e intervenções do usuário. Alterações em qualquer uma dessas fontes devem preservar a reconciliação, as seções estruturais e a identidade estável da arma.

## Status e exclusão

`updateStatus()` aceita `Em andamento`, `Concluido` e `Entregue`, preenche as respectivas datas de conclusão ou entrega e atualiza `updated_at`. Antes de pedir conclusão ou entrega, o renderer analisa o HTML: campos reservados visíveis (inclusive `XXX` legado, sem contar atributos, scripts ou estilos) e figuras marcadas com `data-dummy="true"` geram pendências agrupadas por seção. Havendo pendências, a ação pede confirmação explícita; ela não é bloqueada pelo main nem altera o conteúdo automaticamente.

A exclusão remove diretório físico, imagens e linha do banco; operações relacionadas não são transacionais. Ao sair do laudo, referências de painel, seleção de imagem e operações de IA da sessão são encerradas ou descartadas.

## Limitações e verificação

Atualização de REP e sincronização do laudo são sequenciais. Falhas na sincronização são registradas, mas não desfazem a REP já persistida. Testes protegem criação, seções repetíveis, preservação de blocos versionados, layout do editor, mudança efetiva, salvamento concorrente, aplicação de IA e undo. A aceitação visual ampla dos docks e janelas destacadas em Windows, múltiplas resoluções e temas permanece manual.
