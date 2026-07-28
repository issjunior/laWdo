# Exportação do laudo e resolução de placeholders

## Fonte de resolução

`exportacao-placeholders.ts` constrói o mapa de valores a partir da REP e de seu contexto. No B-602, `projetarB602ParaLaudo()` é a fonte derivada de material, cartuchos, estojos e armas; novas gravações usam `b602.pecas`, e arrays legados são apenas fallback de leitura.

`construirMapaPlaceholdersResolvidos()` expõe, por chave, valor, preenchimento e formato (`texto` ou `html`). Editor e exportação devem consumir esse mesmo mapa; não duplicar a resolução em componentes.

## Regras de saída

A exportação remove prévias transitórias de placeholder, controles transitórios de supressão e qualquer bloco com `data-cond-suprimido="true"`. Placeholders sem valor resolvem para `<span class="campo-reservado" data-reservado="true">XXX</span>`. Bloco pericial não suprimido que contenha somente espaço ou parágrafo vazio recebe um parágrafo com o mesmo marcador. `XXX` não bloqueia a exportação.

Valores estruturais são inseridos como fragmento HTML. Tabelas recebem largura e largura máxima de 100%; a geração de PDF e ODT também força essas regras para impedir estouro horizontal.

## Invariantes

- O HTML persistido mantém as chaves canônicas; valores resolvidos e prévias não devem ser gravados.
- O valor de HTML vem exclusivamente do resolvedor, nunca de atributo ou DOM do editor.
- Dados desconhecidos do GDL não se tornam placeholders automaticamente.
- Ausência de peça ou de valor não interrompe a exportação.

Testes de exportação cobrem placeholders B-602, tabelas, valores ausentes, blocos suprimidos e preenchimento de blocos periciais vazios.
