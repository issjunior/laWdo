# Ciclo de vida atual do laudo

## Criação, edição e estrutura

`criarLaudoInicial()` impede duplicidade por `rep_id`, valida template e suas seções, filtra seções ativas, expande repetições e grava HTML em `Em andamento`. `LaudosPage.tsx` orquestra TinyMCE, conteúdo React, IA e Ilustrações; aplicações de IA usam fingerprint do alvo e agrupam escrita no `undoManager`.

O HTML vira `SecaoEditor`, cuja relação `parentId` é a fonte de hierarquia. O editor único agrupa filhas em `data-laudo-subsecoes`; no modo por seções, pais usam `Collapsible`. Trocar de modo encerra edição transitória de bloco condicional.

## Atualização e reconciliação

`updateConteudo()` substitui conteúdo e `updated_at`. `sincronizarSecoesCondicionais()` recompõe a base do template e a reconcilia com o HTML salvo. Blocos B-602 versionados por `data-arma-chave` e `data-bloco-pericial` preservam o wrapper atual da peça ainda projetada, inclusive `data-cond-suprimido="true"`; headings legados são removidos e blocos de peça removida não são carregados.

Na atualização seletiva pelo GDL, o serviço recebe também o `campos_especificos` anterior e calcula a base condicional anterior e a nova. Se a projeção estrutural for igual, não reescreve o HTML: placeholders passam a mostrar os novos valores, enquanto intervenções manuais, posição de blocos e estado do editor são preservados. Se houver diferença estrutural, executa a reconciliação normal contra o HTML salvo.

A atualização pelo GDL reúne REP e reconciliação na mesma transação local; falha em qualquer etapa desfaz o caminho. A edição comum da REP continua sequencial e pode persistir a REP se a sincronização posterior falhar.

## Status, verificação e limites

`updateStatus()` controla datas de conclusão e entrega. Atualização GDL de REP vinculada a laudo concluído ou entregue exige confirmação, reabre o laudo para `Em andamento`, retorna a REP a `Em Andamento` e registra motivo `atualizacao_gdl`. Sem confirmação, o main recusa a operação.

Os testes cobrem criação, seções repetíveis, blocos versionados, editor, salvamento concorrente, IA e undo. `atualizacao-rep-gdl.service.test.ts` verifica o encaminhamento do estado anterior à sincronização e `atualizar-rep-gdl-dialog.component.test.tsx` o fechamento após aplicação. A reconciliação GDL contra SQLite e HTML real ainda não tem teste de integração dedicado; aceitação visual ampla de docks e janelas destacadas permanece manual.
