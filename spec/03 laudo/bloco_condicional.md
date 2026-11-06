# Blocos condicionais do laudo

## Processamento e elegibilidade

`processarBlocosCondicionais(html, camposEspecificos, contexto?)`, em `secao-builder.service.ts`, avalia wrappers `data-cond-bloco`, remove o wrapper inteiro quando a condição está inativa e encerra ao estabilizar, com limite defensivo de 50 passagens. Em seções repetidas, ids com `N` usam o índice da arma. Toggles legados e os ids B-602 versionados de funcionamento/coleta consultam a arma projetada; estes últimos dependem de `exibeBlocosPericiais`. Headings `h3` residuais dentro de `data-bloco-pericial` são removidos para manter um único título estrutural por arma.

`filtrarSecoesAtivas()` usa `projetarB602ParaLaudo()` para decidir se uma seção derivada existe. Cartuchos, estojos e armas exigem a respectiva coleção projetada. `b602_lacres_saida_toggle` é ativo com ao menos uma arma ou estojo. Os wrappers `b602_cartuchos_toggle` e `b602_estojos_toggle` são contrato de processamento do template, não toggles manuais da REP.

## Exclusão no editor e reconciliação

Cada `.cond-bloco[data-cond-bloco]` recebe `data-cond-instancia`. Na página Laudos, o texto elegível é diretamente editável, inclusive em blocos aninhados, sem Editar/Concluir; outros consumidores mantêm a liberação local. A superfície oferece **Restaurar dados da REP** quando há `laudoId` e `data-cond-origem`, além de **Excluir**. conteudo-interativo.ts localiza e revalida o elemento da instância atual; controles e estado de edição são transitórios. A exclusão confirmada marca data-cond-suprimido="true" em uma transação de undo; preview, PDF, ODT, HTML exportado e contexto de IA omitem blocos suprimidos. A confirmação assíncrona aborta se o conteúdo mudar ou o alvo deixar de existir. A política comum está em spec/03 laudo/editor_texto.md.

A exclusão local não altera a REP nem o GDL. A recomposição não é uniforme: blocos periciais versionados por arma preservam wrapper, texto e supressão pelo par `data-arma-chave + data-bloco-pericial`; já cartuchos e estojos pertencem ao conteúdo-base da seção derivada **DOS EXAMES**. Se essa seção for reconciliada com peças projetadas, esses wrappers são reconstituídos a partir do template, inclusive quando foram apagados no editor.

`LaudoService.sincronizarSecoesCondicionais()` sempre calcula a reconciliação estrutural contra o HTML persistido. `AtualizacaoRepGdlService.aplicar()` a chama também quando não há diferenças selecionadas: nesse caso não regrava a REP e registra uma reconciliação pura do laudo. O modal oferece **Reconciliar laudo** para uma REP atualizada; o renderer recarrega o laudo do banco e remonta o TinyMCE, evitando que o conteúdo persistido restaurado permaneça invisível na instância aberta.

## Verificação

`secao-builder.service.test.ts` cobre elegibilidade, projeções e reparo de estrutura derivada; `atualizacao-rep-gdl.service.test.ts` protege a reconciliação sem regravação da REP; `atualizar-rep-gdl-dialog.component.test.tsx` cobre o disparo com seleção vazia. O smoke manual deve conferir edição direta, restauração de bloco vinculado, indisponibilidade da restauração legada e exclusão/reconciliação de cartuchos e estojos sem duplicação.

## Recuo sem desbloquear o conteúdo

O comando **Parágrafo** do editor principal permite ajustar `text-indent` de parágrafos elegíveis de um `.cond-bloco[data-cond-bloco]` selecionado, mesmo quando o próprio wrapper está `contenteditable="false"`. Essa exceção continua relevante nos consumidores com wrapper protegido: pertence à seleção de alvos do recuo, sem liberar o texto. Na página Laudos aplica-se também a política atual de edição direta. Outros ancestrais não editáveis, placeholders, campos reservados, figuras, legendas, controles e blocos suprimidos são excluídos. A alteração usa uma transação de undo e segue até os exportadores pelo estilo do parágrafo. `editor-formatacao.test.ts` cobre essa exceção e as proteções; os demais comandos mantêm seus próprios critérios de elegibilidade.

## Origem determinística e restauração local

`vincularBlocosCondicionais()` atribui `data-cond-origem` como base64url do JSON `[secaoId, item, condicao, ocorrencia]`. O item vem da arma repetida ou peça B-601 ancestral; a ocorrência distingue condições repetidas na mesma seção/item. `buildHtml(..., true)` aplica o vínculo na criação e reconciliação de laudos, sem alterar a montagem genérica de templates.

`laudo:obterBlocoCondicionalOriginal` exige sessão local e strings válidas. `LaudoService.obterBlocoCondicionalOriginal()` limita a origem a 1024 caracteres, relê laudo, REP e seções locais, valida o JSON e reconstrói o modelo com os dados atuais. Retorna somente uma correspondência exata; ausência ou ambiguidade falha. Portanto, restaurar usa o modelo local atual, não um snapshot histórico nem consulta remota ao GDL.

O adaptador valida wrapper e origem retornados, conserva `data-cond-instancia` do alvo e aplica somente após confirmação e revalidação do conteúdo. Restaurar descarta personalizações daquele bloco. A reconciliação não promove automaticamente blocos legados sem vínculo: `preservarBlocosCondicionaisLegados()` remove da nova montagem as origens que não existiam no bloco anterior, mantendo a restauração indisponível nesses casos. `secao-builder.service.test.ts` e `conteudo-protegido.test.ts` cobrem vínculo e restauração simulados.
