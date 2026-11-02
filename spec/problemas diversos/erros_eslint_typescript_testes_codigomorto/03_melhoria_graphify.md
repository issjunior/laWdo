# Leitura estrutural para manutenção

## Fonte e limite de confiança

`graphify-out/GRAPH_REPORT.md` descreve um snapshot de 02/11/2026, com 6.354 nós, 11.883 relações e 628 comunidades; base informada `a9148905`. A árvore auditada usa HEAD `393b53e` e contém alterações locais. O grafo é mapa de navegação, não comprovação de consumidores atuais, código morto ou desempenho. Não foi reconstruído nesta rodada. Os números da curadoria antiga de junho não descrevem o projeto atual.

## Relações confirmadas no código

| Núcleo | Responsabilidade e impacto |
|---|---|
| `main/database/sqlite.ts` | Abertura, PRAGMAs, fila da conexão, contexto de transação, backup e fechamento; mudanças atingem serviços e handlers de vários domínios. |
| `imagem-laudo.service.ts` | Originais, estágio, metadados e preparação/revalidação da conclusão; depende do processador para derivados. |
| `processador-imagens.service.ts` e `services/imagens/` | Auxiliar Electron/sharp, validação de mensagens, fila limitada, cache e compatibilidade BMP. Não administra banco nem fornece API Node ao renderer. |
| `gdl.service.ts` | Consulta/download, leitura limitada do ZIP e hashes originais/legados; miniaturas são derivadas pelo processador. |
| `IlustracoesPanel.tsx` | Resumos, lotes de miniaturas e proteção contra respostas obsoletas; não deve recodificar o original ao apenas exibir. |
| `dashboard.service.ts` | Agregação de amostras em grupos sem cópias quadráticas; médias e medianas mantêm contratos existentes. |

## Critérios de decisão

- Confirmar relações no código antes de remover um export. Knip tem entrypoints explícitos para o auxiliar, preparação de carga e smokes; ts-prune mantém limitações NodeNext e uso no próprio módulo.
- Não deduzir que BaseService é uma god class pela coesão de uma comunidade que também contém tipos/configurações. Sua função continua CRUD compartilhado.
- Não deduzir lentidão por centralidade. Evidência atual vem do código, regressões e smoke sintético do processador; falta referência assistida comparável do fluxo completo.
- Ao alterar cache/encoder, seguir identidade original, hash legado, estágio, editor, impressão e fechamento. Esses consumidores devem ser verificados em conjunto.

O estado dos gates e as pendências de dependências ficam em `00_saude_do_sistema.md`; exceções duradouras de código morto ficam em `DEAD_CODE_EXCEPTIONS.md`.
