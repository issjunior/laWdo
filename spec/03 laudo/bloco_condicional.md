# Blocos condicionais do laudo

## Processamento

`processarBlocosCondicionais(html, camposEspecificos, contexto?)`, em `secao-builder.service.ts`, processa primeiro wrappers internos com `data-cond-bloco`, remove o wrapper inteiro quando a condição não está ativa e encerra ao estabilizar. O limite defensivo é de 50 passagens.

Em seções repetidas, ids com `N` são normalizados para o índice da arma. Toggles legados de funcionamento e coleta continuam consultando os valores da arma projetada. Os dois ids B-602 versionados (`funcionamento_eficiencia_v2` e `coleta_padroes_v2`) dependem de `exibeBlocosPericiais`, calculado pela família da peça.

Antes da avaliação, headings `h3` residuais dentro de `[data-bloco-pericial]` são removidos. Isso preserva um único título estrutural por arma.

## Seções derivadas da REP

`filtrarSecoesAtivas()` usa `projetarB602ParaLaudo()` para decidir se seções derivadas têm dados. `DOS CARTUCHOS` exige cartuchos projetados e `DOS ESTOJOS` exige estojos projetados; `DAS ARMAS` exige ao menos uma arma projetada. Portanto, os blocos de cartuchos e estojos no template não aparecem apenas por existirem no HTML: uma REP que contém somente pistola não os produz.

O id `b602_lacres_saida_toggle` é ativo quando a projeção contém ao menos uma arma ou um estojo; ele envolve o parágrafo de lacração final e evita que a seção declare lacres para uma REP sem essas peças.

Os ids `b602_cartuchos_toggle` e `b602_estojos_toggle` permanecem nos wrappers como contrato de processamento e de edição do template. Eles não correspondem a um toggle manual disponível na tela atual da REP B-602.

## Edição e exclusão no laudo

Todo `.cond-bloco[data-cond-bloco]`, incluindo blocos genéricos e B-602, recebe um `data-cond-instancia` persistente e único durante a normalização. O wrapper fica protegido com `contenteditable="false"`; o botão transitório **Editar** ativa `data-cond-em-edicao="true"` e libera apenas o conteúdo textual. Placeholders, controles e demais elementos atômicos continuam protegidos. **Concluir**, troca de modo e recarga encerram a edição.

Os controles **Editar/Concluir** e **Excluir** são elementos `data-mce-bogus` adicionados no documento do iframe e não integram o HTML salvo. O clique é capturado por eventos nativos de ponteiro no documento do TinyMCE e transporta `{ editorId, instanciaId }`, evitando localizar novamente a ocorrência por título, tipo ou arma. `Backspace` e `Delete` editam texto no modo liberado e não disparam exclusão integral.

Após confirmação nativa, a ocorrência exata recebe `data-cond-suprimido="true"` em uma transação do undo manager e desaparece imediatamente. A exclusão preserva internamente o wrapper e o conteúdo para estabilidade da recomposição, mas a interface atual não oferece restauração. Preview, PDF, ODT, HTML exportado, contexto e evidências da IA removem integralmente blocos suprimidos e controles transitórios.

Blocos B-602 versionados ainda carregam `data-bloco-pericial`, `data-arma-chave` e `data-cond-versao="2"`. Ao recompor seção derivada, o serviço preserva o wrapper atual pelo par arma+tipo, incluindo texto editado e o marcador de exclusão. A identidade da ação no editor, porém, é sempre `editorId + data-cond-instancia`.

## Seções e desempenho

`expandirSecoesRepetiveis()` aplica o processamento para cada arma. Evite parse repetido de `campos_especificos` ou buscas por arma dentro dos loops.

Os testes de `secao-builder.service` e de blocos periciais cobrem marcadores legados e versionados, elegibilidade, remoção de headings residuais e preservação de conteúdo.
