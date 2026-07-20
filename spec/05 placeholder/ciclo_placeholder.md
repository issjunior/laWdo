# Ciclo atual de placeholders

## Fontes e resolução

Placeholders são definidos e organizados pelo sistema de placeholders. A resolução de valores na visualização e exportação usa os dados da REP e, quando aplicável, `campos_especificos`.

No B-602, peças são persistidas somente em `campos_especificos.b602.pecas`. Os placeholders B-602 já existentes não acessam diretamente arrays legados: `projetarB602ParaLaudo()` cria a visão derivada de material, cartuchos, estojos e armas para exportadores, tabelas e seções repetíveis. A função usa os arrays legados apenas como compatibilidade de leitura.

## Limites de mapeamento

A projeção alimenta apenas placeholders e tabelas cuja equivalência já existe no laudo. Campos personalizados retornados pela API GDL continuam no contrato da peça; eles não geram novos placeholders automaticamente. A ampliação do catálogo de placeholders precisa de decisão semântica e fluxo próprio, para evitar expor valores sem chave, ordem ou formatação definidas.

## Regras de segurança e consistência

- A resolução não grava dados na REP nem no GDL.
- Valores externos desconhecidos permanecem preservados na peça, mas não são renderizados como HTML arbitrário.
- Alteração de peça é refletida pela próxima sincronização/preview, pois a projeção é calculada da persistência atual.
- Não manter uma cópia independente de `b602.pecas` apenas para placeholders.

A resolução de `solicitante_nome` e `autoridade_solicitante_rep` também pode usar os metadados já persistidos da integração GDL quando os campos principais estiverem vazios.
