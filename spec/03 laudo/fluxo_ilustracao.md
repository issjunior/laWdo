# Ilustrações no laudo

## Estado e responsabilidades

O HTML do laudo é a fonte das figuras já inseridas no editor. A fila de imagens ainda disponíveis no Painel de Ilustrações é persistida separadamente em `imagens_laudo`: arquivo local, metadados, legenda, origem e sequência. Ela permite reabrir o painel sem depender do conteúdo em memória ou da conexão com o GDL.

| Estado | Fonte canônica | Consumidor principal |
|---|---|---|
| figura inserida | HTML do laudo (`<figure class="laudo-figure">`) | editor, preview e exportação |
| imagem disponível no painel | `imagens_laudo` + arquivo sob `userData/imagens/laudos/<laudoId>` | `IlustracoesPanel` |
| imagem arquivada após inserção | linha em `imagens_laudo` com `disponivel_painel = 0` | backup; não reaparece no painel |

`imagem-laudo.service.ts` é responsável por validar IDs e data URIs, limitar os MIME aceitos a JPEG/PNG/GIF/BMP/WebP, calcular SHA-256, gravar o arquivo por hash e expor imagens novamente como data URI. O renderer não recebe caminho local.

## Persistência, compatibilidade e backup

A tabela atual contém `nome_arquivo`, `caminho_relativo`, MIME, tamanho, hash, legenda, origem (`local` ou `gdl`), sequência e disponibilidade. A migration v30 converte a estrutura legada: ignora registro sem arquivo ou com formato não reconhecido, detecta o MIME pelos bytes, copia o arquivo para o diretório canônico e preserva ID, sequência, legenda e origem quando válidos. Cada linha não migrável é registrada em log, sem impedir a inicialização.

Arquivos são referenciados por caminho relativo sob `userData/imagens`; leituras fora dessa raiz são rejeitadas. A exclusão remove a linha e só apaga o arquivo quando não há outra referência. A alteração de ordem usa transação SQLite; salvar imagem e gravar arquivo não formam uma transação única, portanto uma falha entre essas etapas pode deixar arquivo não referenciado, mas nunca deve expor caminho arbitrário.

Backup cria manifesto v2 a partir de `imagens_laudo`, inclui cada arquivo referenciado uma vez e valida caminho, tamanho e SHA-256 na restauração antes de substituir o estado local.

## Entradas e ciclo do painel

1. Upload local lê o arquivo como data URI, salva-o no main e o adiciona à fila.
2. `Buscar imagens da REP` abre `GdlImagensRepModal`; a seleção e a captura ocorrem pelo GDL, mas o resultado segue o mesmo salvamento local.
3. O painel carrega somente linhas com `disponivel_painel = 1`, ordenadas por sequência. Reordenação atualiza a sequência no banco; legenda é persistida de forma assíncrona.
4. Inserir uma ou todas as imagens chama os callbacks existentes do editor e arquiva as linhas; em seguida elas deixam a fila. Excluir pela fila remove linha e arquivo; excluir uma figura do editor também solicita a remoção persistida pelo mesmo ID.

Arquivamento em lote usa operações independentes: pode haver sucesso parcial e o painel mostra erro, sem desfazer as figuras já inseridas no HTML.

## Imagens da REP no GDL

O modal recebe apenas `laudoId`. O main resolve `laudo → rep_id → rep.numero`, exige formato inequívoco `número/ano` e nunca confia em número, URL, caminho ou hash enviados pelo renderer. `gdl:listar-imagens-laudo` mostra metadados da Lista de Fotos; `gdl:capturar-imagens-laudo` aceita somente IDs de seleção SHA-256 válidos e reobtém o ZIP antes de extrair os itens selecionados.

A captura devolve sucessos e falhas por item. Arquivo não elegível, ausente, corrompido, criptografado ou com formato incompatível não bloqueia as demais imagens. O painel deduplica capturas GDL da sessão por SHA-256; após exclusão da fila, o hash pode ser capturado novamente.

A origem GDL não cria dependência de rede depois da captura: a cópia validada passa a ser uma imagem local, entra em backup e é inserida no editor como as demais. Nenhuma operação altera arquivos ou dados no GDL.

## Editor, preview e janela destacada

As imagens inseridas são encapsuladas como `figure.laudo-figure`, recebem ID estável e são reindexadas antes de salvar ou gerar preview. O ciclo preserva os modos single e multisseção, a criação/remoção automática da seção `ILUSTRAÇÕES`, a sincronização de figuras, a edição de legenda e a ordenação.

A janela destacada usa a ponte IPC existente para relatar ações e sincronizar estado com `LaudosPage`. Operações de persistência continuam no painel renderizado e atravessam o preload por wrappers específicos; módulos Node/Electron não são expostos ao renderer.

## Verificação

`migracao-imagens-laudo.integration.test.ts` protege a conversão da tabela antiga e a integridade básica da imagem migrada. `gdl-imagens-rep-modal.component.test.tsx` cobre a seleção/captura no modal. Alterações que afetem schema, handlers ou contratos compartilhados devem manter alinhados migration, serviço, handler, `ALLOWED_CHANNELS`, preload, tipos e os dois fluxos de painel.
