# Blocos condicionais do laudo

## Processamento

`processarBlocosCondicionais(html, camposEspecificos, contexto?)`, em `secao-builder.service.ts`, processa primeiro wrappers internos com `data-cond-bloco`, remove o wrapper inteiro quando a condição não está ativa e encerra ao estabilizar. O limite defensivo é de 50 passagens.

Em seções repetidas, ids com `N` são normalizados para o índice da arma. Toggles legados de funcionamento e coleta continuam consultando os valores da arma projetada. Os dois ids B-602 versionados (`funcionamento_eficiencia_v2` e `coleta_padroes_v2`) dependem de `exibeBlocosPericiais`, calculado pela família da peça.

Antes da avaliação, headings `h3` residuais dentro de `[data-bloco-pericial]` são removidos. Isso preserva um único título estrutural por arma.

## Supressão recuperável

Blocos B-602 versionados carregam `data-bloco-pericial`, `data-arma-chave` e `data-cond-versao="2"`. No editor, a ação transitória de supressão não é serializada. Após confirmação na página de laudos, a decisão persistida é `data-cond-suprimido="true"` no wrapper do bloco.

A supressão não apaga o conteúdo: o editor mostra um aviso compacto e permite restaurar todos os blocos suprimidos. A exportação remove integralmente wrappers suprimidos. Ao reconstruir uma seção derivada, o service preserva o wrapper atual pelo par arma+tipo, incluindo texto e supressão.

## Seções e desempenho

`filtrarSecoesAtivas()` continua descartando seções derivadas sem dados e pais sem filhos ativos ou conteúdo útil. `expandirSecoesRepetiveis()` aplica o processamento para cada arma. Evite parse repetido de `campos_especificos` ou buscas por arma dentro dos loops.

Os testes de `secao-builder.service` e de blocos periciais cobrem marcadores legados e versionados, elegibilidade, remoção de headings residuais e preservação de conteúdo.
