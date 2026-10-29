# Ciclo de vida atual do laudo

## Criação, edição e estrutura

`criarLaudoInicial()` impede duplicidade por `rep_id`, valida template e suas seções, filtra seções ativas, expande repetições e grava HTML em `Em andamento`. `LaudosPage.tsx` orquestra TinyMCE, conteúdo React, IA e Ilustrações; aplicações de IA usam fingerprint do alvo e agrupam escrita no `undoManager`.

O HTML vira `SecaoEditor`, cuja relação `parentId` é a fonte de hierarquia. O editor único agrupa filhas em `data-laudo-subsecoes`; no modo por seções, pais usam `Collapsible`. Trocar de modo encerra edição transitória de bloco condicional.

## Apresentação preservada por laudo

A fonte canônica da apresentação de um laudo existente é a coluna TEXT `laudos.apresentacao_json`, separada do HTML de `conteudo`. O contrato em `src/shared/configuracoes/apresentacao-laudo.ts` exige `versao: 1`, `cabecalho: { primeiraPaginaHabilitada, todasPaginasHabilitadas, primeiraPagina, todasPaginas }`, `fechamento: { habilitado, conteudo, espacamentoAntesPt }` e `perito` como mapa de strings. O espaçamento deve ser finito, entre 0 e 300 pontos.

`criarLaudoInicial()` chama `capturarApresentacaoLaudo(perito_id)` no main e insere a cópia junto com o conteúdo no mesmo INSERT. O serviço valida as configurações JSON e a linha do perito; falha nessa captura impede a criação. O mapa preserva nome, cargo e formas de tratamento, lotação e matrícula; especialidade fica vazia nesse caminho. Alterações posteriores de configuração, perfil, corpo, status ou geração pelo wizard não recapturam a apresentação. Não há operação específica de duplicação de laudo.

As configurações ativas são `cabecalho_documento` e `fechamento_laudo`, usadas para novos laudos e prévias de templates. Se ausentes, a leitura aceita `cabecalho_laudo`/`cabecalho_paginas` como cabeçalho habilitado e fechamento desativado. JSON presente e inválido não ativa esse fallback. A gravação normal em `configuracao.service.ts` valida os dois contratos antes de persistir.

O schema corrente é 48. A migration 44 garante a coluna e preenche somente cópias nulas, em transação, usando cabeçalho legado e perfil disponível na migração, com fechamento desativado. Não reconstrói dados históricos nunca armazenados. Percorre os laudos sequencialmente, com consultas de configuração/perito por registro; o custo cresce com o número de laudos. A migration 45, em outra transação e obrigatoriamente depois da captura legada, substitui os dois padrões ativos pelos constantes compartilhados. Reaberturas sem migration pendente preservam personalizações posteriores; não reaplicam os padrões.

As margens de página pertencem à configuração da instalação `pdf_margins`, não à cópia `apresentacao_json`. A migration v46 insere ou substitui essa configuração com superior 3,5 cm, direita 2 cm, inferior 1,5 cm e esquerda 3 cm, conforme `src/shared/configuracoes/margens-pdf.ts`. A substituição inclui valores personalizados anteriores e ocorre apenas na migração; personalizações salvas depois permanecem na reabertura. Ela não regrava conteúdo, cabeçalhos, fechamento ou dados do perito dos laudos. A montagem de saída aplica a separação adicional fixa de 24 px após o cabeçalho inicial também aos laudos existentes, conforme `spec/03 laudo/visualizar_pdf.md`; arquivos PDF já exportados não são modificados.

Prévia no editor, prévia pela lista e exportação recebem a cópia persistida e a validam com `lerApresentacaoLaudo()`; cópia ausente ou inválida interrompe a saída, sem usar os padrões atuais. Essa preservação abrange cabeçalhos e fechamento: placeholders do corpo continuam usando o resolvedor atual da REP e sessão, descrito em `spec/03 laudo/exportar_laudo.md`.

`src/__tests__/main/apresentacao-laudo.integration.test.ts` cobre padrões, preservação após mudança de perfil/configuração/corpo, rejeição de configuração inválida e migração/reabertura com SQLite temporário. `src/__tests__/renderer/apresentacao-laudo.test.ts` cobre consumo da cópia, combinações de ativação e recusa de apresentação inválida.

## Atualização e reconciliação

`updateConteudo()` compacta figuras elegíveis para prévias locais antes de substituir conteúdo e `updated_at`, conforme `fluxo_ilustracao.md`. `sincronizarSecoesCondicionais()` recompõe a base do template e a reconcilia com o HTML salvo. Blocos B-602 versionados por `data-arma-chave` e `data-bloco-pericial` preservam o wrapper atual da peça ainda projetada, inclusive `data-cond-suprimido="true"`; headings legados são removidos e blocos de peça removida não são carregados.

Na atualização seletiva pelo GDL, o serviço recebe também o `campos_especificos` anterior e calcula a base condicional anterior e a nova. Se a projeção estrutural for igual, não reescreve o HTML: placeholders passam a mostrar os novos valores, enquanto intervenções manuais, posição de blocos e estado do editor são preservados. Se houver diferença estrutural, executa a reconciliação normal contra o HTML salvo.

A atualização pelo GDL reúne REP e reconciliação na mesma transação local; falha em qualquer etapa desfaz o caminho. A edição comum da REP continua sequencial e pode persistir a REP se a sincronização posterior falhar.

Personalizações manuais de texto ficam na ocorrência do HTML do laudo, não na REP. A visualização, o salvamento e a atualização local da REP preservam o atributo de personalização; o valor manual continua prevalecendo até **Restaurar valor da REP**. Isso não cria escrita no GDL.

## Status, verificação e limites

`updateStatus()` controla datas de conclusão e entrega. Atualização GDL de REP vinculada a laudo concluído ou entregue exige confirmação, reabre o laudo para `Em andamento`, retorna a REP a `Em Andamento` e registra motivo `atualizacao_gdl`. Sem confirmação, o main recusa a operação.

Os testes cobrem criação, seções repetíveis, blocos versionados, editor, salvamento concorrente, IA e undo. `atualizacao-rep-gdl.service.test.ts` verifica o encaminhamento do estado anterior à sincronização e `atualizar-rep-gdl-dialog.component.test.tsx` o fechamento após aplicação. A reconciliação GDL contra SQLite e HTML real ainda não tem teste de integração dedicado; aceitação visual ampla de docks e janelas destacadas permanece manual.

## Conteúdo salvo, pendências e concorrência

`useGerenciadorAlteracoesLaudo.ts` mantém a sessão de edição, a referência comparável salva e os estados `salvo`, `pendente`, `salvando` e `erro`. A sessão recebe uma referência comparável inicial ao abrir e conclui sua inicialização após a preparação do editor. Eventos de usuário ou IA provocam nova comparação; desfazer até o mesmo conteúdo pode eliminar a pendência. Salvar é bloqueado enquanto a sessão inicializa ou já existe salvamento.

`LaudosPage.tsx` conclui a sincronização agrupada antes de ler o DOM dos editores, usando o estado React como fallback para seções desmontadas, recompõe a estrutura e remove ILUSTRAÇÕES realmente vazias. `conteudo-comparavel-laudo.ts` remove apresentação transitória de placeholders, renumera tabelas, descarta atributos `data-mce-*`, ordena atributos e ignora espaços entre blocos na raiz. Preserva texto inline, formatação autoral e personalizações. Essa representação serve à comparação; a gravação continua usando o HTML canônico da página.

Salvar reconcilia imagens antes de enviar `laudo.updateConteudo`. A conclusão só afeta a mesma sessão; respostas de sessão encerrada são ignoradas. O HTML enviado torna-se a referência salva. Se houver edição durante a requisição, a página conserva o DOM novo, mantém a pendência e não reaplica o HTML antigo. **Salvar e sair** só prossegue se não restar diferença. Reconciliação de imagens e gravação do HTML são operações separadas, sem transação única.

## Proteção de saída e wizard

`AlteracoesPendentesContext.tsx` registra verificadores, função de salvar, erro e estado de salvamento do editor e do wizard. `App.tsx` usa `createHashRouter` e `RouterProvider`, mantendo URLs em hash compatíveis com `file://` e permitindo `useBlocker`. Links internos, Voltar, logout e fechamento da janela principal convergem para `DialogoSaidaLaudo`.

O diálogo oferece **Continuar editando** (foco inicial), **Sair sem salvar** e **Salvar e sair**. Sem pendência nem salvamento ativo, executa diretamente a ação. Cancelar restaura a navegação bloqueada; salvar aguarda o resultado e conserva diálogo e erro quando falha ou há edição concorrente. Durante salvamento os botões e Escape ficam bloqueados. Há uma única ação de saída pendente; requisições repetidas não a substituem. Descartar permite sair do rascunho, mas não reverte operações de imagens já persistidas separadamente.

No wizard, a pendência compara `JSON.stringify` das respostas atuais com o snapshot carregado/salvo. **Salvar e sair** executa `salvarProgressoWizard`, preservando respostas parciais sem gerar o laudo. Edições durante esse salvamento continuam pendentes. Geração bem-sucedida libera a navegação para Laudos. A seleção temporária de peças não integra essa comparação; não tratar o mecanismo como proteção de todo estado visual do wizard.

O provider seleciona o primeiro registro ativo para salvar: presume uma página de edição por vez, não um salvamento transacional de vários formulários. O fechamento nativo está em `spec/04 layout/janelas_desktop.md`; a autorização de reinício para atualização permanece separada, em `spec/12 atualizacao/fluxo_atualizacao.md`.

`alteracoes-pendentes-saida.component.test.tsx`, `wizard-laudo-saida.component.test.tsx`, `conteudo-comparavel-laudo.test.ts` e `layout-editor-laudo.component.test.tsx` cobrem navegação, descarte, erro, respostas parciais, normalização e edição durante salvamento. O fechamento com janela Electron real permanece dependente de smoke manual.

## Reconciliação específica B-601

Seções B-601 usam preservação por grupo e identidade do item. Quadros preenchidos não são substituídos por uma mudança de origem: a assinatura sinaliza revisão e a recriação depende de confirmação. Conteúdo que perde a condição de visibilidade é mantido para revisão; o complemento de figuras pertence ao laudo e conserva alterações e exclusões. Ver spec/03 laudo/b601.md. O mesmo provider de saída também recebe o registro cadastro-rep-b601 para proteger o estado local de peças ainda não salvo.

## Listagem compacta

A lista em `LaudosPage.tsx` usa DataTable com `densidade="compacta"`, pinning e recebimento decrescente como ordenação inicial. A coluna Solicitação reúne tipo e número do documento, mas ordena pelo número (`numero_documento`, ID `solicitacao`). Exame reúne código e nome, ordenando pelo código (`tipo_exame_codigo`, ID `exame`). Template, Envolvido e Início começam ocultos; Exame começa visível.

Textos de solicitação, exame, template e envolvido quebram linha em larguras limitadas; datas e número da REP não quebram. Ações usam botões compactos e preservam as restrições de status. `DataTableColumnHeader.quebrarTitulo` permite duas linhas em Data de recebimento sem alterar o comportamento padrão dos outros cabeçalhos. Essas composições são apresentação da lista, sem alteração nos campos persistidos da REP ou do laudo.

## Edição incremental e leitura imediata

A digitação marca a revisão da sessão imediatamente, mas publica HTML no estado após 400 ms de pausa. A comparação adiada usa o estado somente quando nenhum editor tem sincronização pendente; reaproveita a representação comparável de seções inalteradas. Salvar, verificar saída e trocar de modo leem o conteúdo atual pelo sincronizador, sem depender de o temporizador ter terminado. O contrato e os testes estão em `editor_texto.md`; as verificações de integridade no Electron permanecem manuais em `spec/13 diagnostico/testes_carga_editor.md`.

## Status local e migrations

Criar o laudo insere o registro e muda a REP para **Em Andamento** na mesma transação. O handler de status também reúne laudo e REP em transação: **Em andamento** corresponde a **Em Andamento**; **Concluído** e **Entregue** correspondem a REP **Concluído**. Falha na atualização da REP desfaz a mudança do laudo. São estados locais, sem movimentação no GDL.

A migration v47 reconcilia REPs que já possuem laudo: se qualquer laudo vinculado estiver em andamento, a REP fica Em Andamento; nos demais casos, Concluído. REPs sem laudo ficam intactas. Essa agregação da migration não deve ser confundida com o handler de status, que usa a transição do laudo solicitado. A v48 acrescenta temporaria_sessao às imagens; limpeza e preservação por referência estão em fluxo_ilustracao.md. status-rep-laudo.integration.test.ts cobre criação, transições, rollback e reconciliação.

O contrato de apresentação permanece na versão 1. A leitura aceita o cabeçalho legado com habilitado e o transforma nas duas flags atuais com o mesmo valor; novas cópias e o salvamento da tela usam flags independentes. Isso não exige regravar automaticamente apresentações antigas.

## Carregamento, filtros e feedback

findAllComRep() retorna somente LaudoResumoLista, em src/shared/types/laudo.types.ts, sem HTML nem apresentacao_json. Abrir edição ou prévia pela lista consulta findById e valida identidade, conteúdo e apresentação recebidos. Uma abertura mais recente invalida a resposta de abertura anterior. No modo por seções, a entrada e a troca de modo deixam as seções recolhidas; cada editor é montado na primeira expansão e pode permanecer montado depois de recolhido.

A lista abre em **Em andamento**; status Concluído ou prioridade aguardando-entrega selecionam **Concluídos**, e status Entregue seleciona **Entregues**. A aba Todos mantém todos os estados. As abas filtram o resultado dos filtros vindos do Dashboard, com regras em filtros-listas-laudos-reps.ts, compartilhado com REPs. A aba é estado da página e é recalculada quando a busca da URL muda.

Salvar aguarda a reconciliação de imagens em curso, sem iniciar outra em paralelo. Imagens com data-imagem-processando bloqueiam salvar e trocar de modo até a preparação terminar. O sucesso atualiza apenas o resumo da linha e restaura a apresentação visual dos editores; a conferência posterior de tabelas evita getContent quando não precisa capturar nem corrigiu conteúdo persistível. O toast distingue salvamento completo, edição concorrente ainda pendente e falha; falha de restauração visual avisa que a gravação já ocorreu. Voltar sem pendência não força serialização integral do editor.

Ao fechar o editor, a página limpa undo e DOM antes de desmontar e solicita encerrarSessao das imagens. A comparação canônica ignora data-b601-referencias e controles de coleta/estojos, mas conserva valores editados. A busca e a verificação de pendências para conclusão excluem subárvores data-cond-suprimido="true". filtros-listas-laudos-reps.test.ts, pendencias-conclusao-laudo.test.ts e as suítes de comparação/salvamento cobrem essas regras; montagem e liberação de memória no Electron continuam dependentes de observação real.

## Conclusão e retenção de imagens

Na transição para **Concluído** a partir de outro status, laudo:updateStatus chama concluirImagensLaudo() na mesma transação SQLite que atualiza laudo e REP. A seleção parte de data-image-id no HTML salvo, ignorando dummies; figura ausente ou SHA-256 divergente impede a conclusão. O perfil atual trata os bytes, conserva IDs usados e remove os demais registros do laudo. Vínculos de origem, ajustes e data-image-original-id são removidos; figuras restantes deixam de ser temporárias ou disponíveis na fila. Reabrir usa a versão tratada, sem restaurar os originais descartados.

Arquivos tratados são preparados antes de atualizar registros; filesystem e SQLite não formam uma transação única, portanto rollback pode deixar arquivos novos sem referência. Após commit, o estágio é descartado e arquivos antigos só são removidos sem referências restantes. Falha na limpeza é registrada sem desfazer o status concluído. Alterar preferências ou reabrir não recupera resolução perdida; nova conclusão pode aplicar o perfil vigente novamente. O tratamento está em fluxo_ilustracao.md.
