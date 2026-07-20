# Exportação do laudo e resolução de placeholders

## Resolução

A exportação resolve placeholders a partir dos dados da REP e do contexto adicional. Para B-602, o estado persistido continua em `campos_especificos.b602.pecas`; antes de montar tabelas, totais e placeholders individuais de armas, os consumidores chamam `projetarB602ParaLaudo()`.

A projeção fornece a visão de material encaminhado, cartuchos, estojos e armas consumida por `exportacao-placeholders.ts`, `LaudosPage.tsx`, `tabelas-placeholder.ts` e pelo preview da REP. Ela prioriza `b602.pecas` e só usa arrays legados como fallback de leitura. Não criar mapeamentos paralelos desses dados em cada exportador.

## Placeholders e tabelas B-602

As tabelas `b602_tabela_material_enc`, `b602_tabela_cartuchos`, `b602_tabela_estojos` e `b602_tabela_armas`, seus totais e placeholders indexados de armas passam a refletir a projeção canônica. Quantidades numéricas são apresentadas com dois dígitos e datas ISO válidas são formatadas em padrão brasileiro nas tabelas.

Para dados de solicitação, `solicitante_nome` preserva valor já existente e, quando vazio, usa `b602.solicitante_nome` ou o órgão vindo de `integracaoGdl.dadosSolicitacao`. `autoridade_solicitante_rep` usa a autoridade da REP e, quando ausente, a recebida pela integração GDL.

## Invariantes

- A projeção é derivada; não cria uma segunda persistência.
- Dados desconhecidos do GDL não são promovidos a placeholders automaticamente.
- A compatibilidade legada é somente de leitura; novas gravações B-602 usam `pecas`.
- A ausência de peças gera tabela/placeholder vazio, sem falha de exportação.

Testes de exportação protegem a projeção de B-602 e a resolução de órgão/autoridade. A geração visual completa de PDF continua dependente do fluxo de preview.
