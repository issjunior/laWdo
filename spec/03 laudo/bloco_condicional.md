# Blocos condicionais do laudo

## Processamento e elegibilidade

`processarBlocosCondicionais(html, camposEspecificos, contexto?)`, em `secao-builder.service.ts`, avalia wrappers `data-cond-bloco`, remove o wrapper inteiro quando a condição está inativa e encerra ao estabilizar, com limite defensivo de 50 passagens. Em seções repetidas, ids com `N` usam o índice da arma. Toggles legados e os ids B-602 versionados de funcionamento/coleta consultam a arma projetada; estes últimos dependem de `exibeBlocosPericiais`. Headings `h3` residuais dentro de `data-bloco-pericial` são removidos para manter um único título estrutural por arma.

`filtrarSecoesAtivas()` usa `projetarB602ParaLaudo()` para decidir se uma seção derivada existe. Cartuchos, estojos e armas exigem a respectiva coleção projetada. `b602_lacres_saida_toggle` é ativo com ao menos uma arma ou estojo. Os wrappers `b602_cartuchos_toggle` e `b602_estojos_toggle` são contrato de processamento do template, não toggles manuais da REP.

## Exclusão no editor e reconciliação

Cada `.cond-bloco[data-cond-bloco]` recebe `data-cond-instancia`, fica protegido e expõe controles transitórios **Editar/Concluir** e **Excluir**. Os controles são `data-mce-bogus`, não fazem parte do HTML salvo e o alvo da ação é sempre `editorId + instanciaId`. A exclusão confirmada marca a ocorrência com `data-cond-suprimido="true"` em uma transação de undo; preview, PDF, ODT, HTML exportado e contexto de IA omitem blocos suprimidos.

A exclusão local não altera a REP nem o GDL. A recomposição não é uniforme: blocos periciais versionados por arma preservam wrapper, texto e supressão pelo par `data-arma-chave + data-bloco-pericial`; já cartuchos e estojos pertencem ao conteúdo-base da seção derivada **DOS EXAMES**. Se essa seção for reconciliada com peças projetadas, esses wrappers são reconstituídos a partir do template, inclusive quando foram apagados no editor.

`LaudoService.sincronizarSecoesCondicionais()` sempre calcula a reconciliação estrutural contra o HTML persistido. `AtualizacaoRepGdlService.aplicar()` a chama também quando não há diferenças selecionadas: nesse caso não regrava a REP e registra uma reconciliação pura do laudo. O modal oferece **Reconciliar laudo** para uma REP atualizada; o renderer recarrega o laudo do banco e remonta o TinyMCE, evitando que o conteúdo persistido restaurado permaneça invisível na instância aberta.

## Verificação

`secao-builder.service.test.ts` cobre elegibilidade, projeções e reparo de estrutura derivada; `atualizacao-rep-gdl.service.test.ts` protege a reconciliação sem regravação da REP; `atualizar-rep-gdl-dialog.component.test.tsx` cobre o disparo com seleção vazia. O smoke manual deve confirmar que excluir cartuchos/estojos, salvar e executar **Atualizar REP → Reconciliar laudo** restaura ambos sem duplicação.
