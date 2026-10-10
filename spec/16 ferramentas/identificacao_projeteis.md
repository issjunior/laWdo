# Identificação atual de projéteis

## Escopo e fontes de verdade

A página `ProjeteisPage.tsx` compara medidas observadas com referências locais e mostra candidatos por proximidade; a ordem não determina o calibre por si só. O catálogo distribuído é `src/shared/catalogos/projeteis.catalogo.ts`, gerado por `scripts/projeteis/gerar-catalogo.py` a partir das tabelas periciais fornecidas. Cada variante preserva fonte, localização e eventual observação de inconsistência; valores questionáveis da fonte não são corrigidos por inferência. `siglas-projeteis.ts` fornece descrições de siglas e o PDF em `src/renderer/public/tabela-calibres-balistica-forense.pdf` serve à consulta visual. A geração do catálogo é uma operação de manutenção, não ocorre no aplicativo.

Cadastros personalizados ficam na tabela SQLite `projeteis_personalizados`. O renderer combina catálogo distribuído e registros locais em memória para consulta e catálogo completo; referências distribuídas são somente leitura. Não há vínculo de projétil com REP ou laudo nem envio ao GDL. `src/shared/types/projetil.types.ts` define os contratos, `consulta-projeteis.ts` ordena resultados, e `projetil.service.ts` valida e persiste entradas pelo main.

## Consulta e apresentação

O usuário pode informar calibre real médio em mm, altura máxima em mm, massa em g ou filtrar por sigla. Vírgula e ponto decimais são aceitos; medidas informadas devem ser positivas. Sem medida nem sigla, a página mostra apenas o acesso ao catálogo. O catálogo completo filtra por calibre e sigla e pagina em grupos de 12. A consulta mostra três referências inicialmente, com expansão até dez; cada cartão traz referência, medida observada e diferença `medido − referência`. Dentro de uma faixa a diferença é zero; fora, usa o limite mais próximo. Medida sem valor na fonte produz comparação parcial.

Estado íntegro marca as três medidas como confiáveis. Ao mudar para deformado ou perda de massa, a página desmarca todas, e o usuário pode selecionar as medidas confiáveis; diferenças das demais continuam visíveis, mas não ordenam. Em perda de massa, a massa observada é limite inferior: referências de massa igual ou maior precedem as de massa menor, sem estimar perda; massa não participa da distância. A ordenação considera depois quantidade de dados ausentes em medidas confiáveis, distância de calibre real, massa e altura, e desempate estável por calibre, tipo e ID. Filtrar só por sigla ou usar apenas medidas não confiáveis produz referências filtradas sem classificação baseada em distância. Raiamento e descrição da sigla são apresentação auxiliar, não critério de ordenação.

## Persistência, importação e compatibilidade

`projetil:listarPersonalizados`, `salvarPersonalizado`, `excluirPersonalizado` e `importarCsv` passam por preload, handler e serviço. O handler valida identificadores e tipo do CSV; o serviço trata o payload como desconhecido, exige calibre e tipo de até 120 caracteres, massa positiva e ao menos uma das dimensões positivas. Evita duplicatas pela combinação normalizada de calibre, tipo, massa e dimensões. A página confere o formato básico da resposta IPC antes de alimentar o estado. Erros retornam mensagem ao usuário sem substituir a lista local já carregada.

CSV aceita cabeçalho exato `calibre;tipo;massa_gramas;calibre_real_mm;altura_maxima_mm` (vírgula também é separador se não houver ponto e vírgula na primeira linha), aspas e BOM. O serviço limita texto a 1 MB e 1 a 500 linhas, valida todas antes de escrever, ignora duplicatas existentes ou repetidas no arquivo e insere as novas em transação. Uma linha inválida rejeita o lote inteiro; se todas forem duplicatas, retorna zero. Não há exportação de CSV.

As migrations 37 e 38 introduziram formatos intermediários; a 38 só migra medidas antigas quando mínimo e máximo eram iguais. A migration 39 recria a tabela com `calibre_real_mm` e `altura_maxima_mm` escalares e remove todos os cadastros personalizados preexistentes, registrando a contagem. O schema corrente é 39 e toda gravação posterior exige ao menos uma dimensão. Essa perda na migração é comportamento atual relevante para avaliação de atualização e restauração. O backup Completo usa o banco inteiro; o backup de Configuração não inclui a tabela, conforme `spec/14 backup/backup_usuario.md`.

## Verificação e limites

`projeteis-catalogo.test.ts`, `consulta-projeteis.test.ts`, `projetil-validacao.service.test.ts`, `projetil-importacao.integration.test.ts`, `projetil-migracao.integration.test.ts` e `projeteis-page.component.test.tsx` cobrem catálogo, ordenação, validação, lote CSV, migration e apresentação. As referências são aproximações de documentos heterogêneos, algumas sem todas as medidas; a identificação final depende da avaliação pericial e da consulta à fonte indicada.
