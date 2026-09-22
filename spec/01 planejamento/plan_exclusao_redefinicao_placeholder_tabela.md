# Exclusão e renumeração de tabelas no laudo

## Objetivo

Permitir excluir pelo “×” qualquer ocorrência de placeholder que renderize uma tabela e manter a numeração das tabelas restantes em sequência. A atualização deve acontecer no editor após a exclusão e ser conferida novamente antes de visualizar ou exportar o laudo, pois a atualização imediata de figuras já apresentou divergências nesse fluxo.

## Estado atual e decisões

- A prévia de tabela mantém uma âncora canônica `data-placeholder` oculta; uma tabela personalizada mantém vínculo próprio com essa âncora. A exclusão deve remover a tabela e a âncora da ocorrência selecionada, sem atingir outras ocorrências da mesma chave nem alterar a REP ou o GDL.
- As tabelas B-602 são geradas com títulos fixos `TABELA 1` a `TABELA 5`. Por isso, renumerar apenas no momento da exclusão não basta: a resolução dos placeholders pode recriar os números antigos.
- A sequência abrange todas as tabelas do laudo cujo `<caption>` ou primeira célula de título comece com `TABELA N`, inclusive tabelas manuais e personalizadas. Tabelas sem esse título e referências em parágrafos comuns não entram na renumeração.
- Numerar pela ordem física no documento completo, atravessando seções, a partir de `TABELA 1`, sem zeros à esquerda. Alterar somente o número do título; preservar descrição, demais células e formatação.

## Implementação

1. Centralizar a identificação e renumeração dos títulos em uma rotina de DOM reutilizável. Ela deve percorrer apenas tabelas efetivas, ignorar prévias transitórias duplicadas quando trabalhar sobre HTML canônico e devolver se houve correção. A operação deve ser idempotente e preservar marcação inline do título.
2. Ao confirmar o “×”, remover em uma transação de undo a tabela e a âncora correspondente. Depois, renumerar as tabelas visíveis de todos os editores na ordem do laudo e sincronizar o conteúdo alterado com o estado da página. Em tabela de prévia, corrigir a apresentação sem gravar o HTML resolvido sobre a âncora; em tabela manual ou personalizada, persistir o título corrigido.
3. Reaplicar a conferência visual quando a estrutura de tabelas mudar por inserção, personalização, restauração ou troca do modo de visualização. Não executar a rotina a cada tecla digitada nem substituir integralmente o conteúdo dos editores apenas para atualizar os números, evitando perda de seleção e alterações inesperadas no undo.
4. Nos comandos **Visualizar PDF** e **Exportar** (PDF, DOCX e ODT), capturar primeiro o conteúdo atual dos editores, conferir e corrigir os títulos no editor e gerar o arquivo a partir desse mesmo estado. Depois da resolução de todos os placeholders, executar a renumeração mais uma vez sobre o HTML final, antes de enviá-lo ao gerador. A prévia iniciada pela lista de laudos confere somente o HTML gerado, pois não há editor aberto.
5. Se a conferência anterior à geração falhar, informar o erro e interromper a prévia ou exportação; não entregar um arquivo com numeração potencialmente desatualizada. Nenhuma mudança de banco de dados ou IPC é necessária.

## Verificação e aceitação

- Excluir a primeira tabela e uma tabela intermediária: as restantes ficam `TABELA 1`, `TABELA 2` etc. imediatamente, inclusive quando distribuídas entre seções.
- Conferir tabelas geradas por placeholders, personalizadas e manuais, com título em `<caption>` ou na primeira célula; preservar texto e formatação após o número e não modificar tabelas sem título.
- Introduzir uma numeração divergente no editor e verificar que **Visualizar PDF** e cada formato de **Exportar** corrigem tanto o editor quanto o arquivo. Na prévia pela lista, verificar o PDF gerado.
- Verificar que salvar, reabrir, alternar entre dados da REP e chaves, e desfazer/refazer a exclusão não recriam tabelas excluídas nem deixam lacunas. A exportação não deve duplicar a âncora de uma tabela personalizada.
- Recomenda-se criar testes focados para a rotina de renumeração e os fluxos de exclusão e geração, devido ao histórico de divergência entre editor e arquivo. Executar `npm run type-check`, `npm run lint` e os testes existentes de placeholders e exportação. Não tocar testes sem antes comunicar a justificativa e o escopo, conforme `AGENTS.md`.
