# Ciclo de vida atual do laudo

## Criação

`criarLaudoInicial()` impede duplicidade por `rep_id`, busca as seções do template, lê `campos_especificos`, filtra seções ativas, expande repetições e grava o HTML com status `Em andamento`, `tipo_criacao = 'template'`, `versao = 1` e `data_inicio`. Na ausência de conteúdo, usa `<p>Laudo em elaboracao.</p>`.

## Atualização e reconciliação

`updateConteudo()` substitui o conteúdo e `updated_at`. A evolução estrutural acontece em `sincronizarSecoesCondicionais()`, que recompõe a base do template e a reconcilia com o HTML salvo.

Para seções B-602 derivadas, a reconciliação identifica blocos periciais versionados por `data-arma-chave` e `data-bloco-pericial`. Quando a peça permanece na projeção, o conteúdo atual do wrapper — inclusive `data-cond-suprimido="true"` — prevalece sobre o conteúdo-base. Headings internos legados são descartados durante essa preservação. Blocos de arma removida não são carregados para a nova estrutura.

O laudo combina template, dados da REP e intervenções do usuário. Alterações em qualquer uma dessas fontes devem preservar a reconciliação, as seções estruturais e a identidade estável da arma.

## Status e exclusão

`updateStatus()` aceita `Em andamento`, `Concluido` e `Entregue`, preenche as respectivas datas de conclusão ou entrega e atualiza `updated_at`. A exclusão remove diretório físico, imagens e linha do banco; operações relacionadas não são transacionais.

## Limitações e verificação

Atualização de REP e sincronização do laudo são sequenciais. Falhas na sincronização são registradas, mas não desfazem a REP já persistida. Testes de service cobrem criação, seções repetíveis e preservação de blocos versionados durante a sincronização.
