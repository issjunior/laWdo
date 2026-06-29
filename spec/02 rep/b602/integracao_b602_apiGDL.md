# Plano: Integracao B602 com API GDL

## Objetivo

Padronizar os inputs de pecas do formulario B602 do laWdo com a fonte de verdade do GDL, evitando mapear manualmente todas as informacoes da API e todas as opcoes possiveis no codigo local.

O laWdo deve continuar sendo apenas um sistema auxiliar para elaboracao do laudo. O GDL permanece como sistema oficial de origem dos dados e destino final do envio manual.

## Branch planejada

Criar a branch:

```bash
git switch -c feat/gdl-b602
```

Motivo: a implementacao deve repercutir em banco local, IPC, servico GDL, formulario REP/B602, cache offline e documentacao posterior.

## Estrategia geral

1. Usar exclusivamente o ambiente de homologacao da API/GDL web para testes.
2. Descobrir os inputs possiveis das pecas B602 observando o comportamento real do GDL:
   - abrir o GDL web em homologacao;
   - acessar o fluxo de "Adicionar Peca";
   - selecionar tipos de item, por exemplo `CARABINA(S)`;
   - capturar requests e respostas que montam campos, opcoes e dependencias.
3. Complementar a descoberta com REPs B602 reais de homologacao fornecidas pelo usuario:
   - consultar a REP via API;
   - armazenar o JSON bruto;
   - validar como as pecas ja preenchidas aparecem no retorno.
4. Persistir localmente catalogos, metadados e payloads brutos para permitir funcionamento offline.
5. Renderizar o formulario B602 usando os metadados/cache quando existirem, mantendo fallback local para quando o cache nao estiver disponivel.

## Escopo inicial

- Foco apenas em B602.
- Foco nos inputs das pecas da REP.
- Comecar por tipos de peca presentes nas amostras de homologacao, especialmente `CARABINA(S)`.
- Nao implementar escrita no GDL.
- Nao enviar ou atualizar REP pela API GDL.
- Nao remover o preenchimento manual.

## Descoberta dos dados no GDL

A descoberta deve combinar duas fontes:

| Fonte | Papel |
|---|---|
| GDL web homologacao | Revelar quais requests definem campos, opcoes e dependencias ao adicionar uma peca |
| REP B602 real homologacao | Validar como pecas preenchidas retornam em `/rep/obter` |

Se o GDL web expuser endpoint de metadados dos inputs, o laWdo deve usar esse endpoint como fonte principal.

Se nao houver endpoint claro de metadados, o laWdo deve:

- armazenar o JSON bruto das REPs consultadas;
- mapear incrementalmente os tipos de peca encontrados;
- evitar inventar campos sem evidencia no GDL;
- manter campos desconhecidos preservados em payload bruto para auditoria futura.

## Banco local

Adicionar cache SQLite para dados GDL. Estrutura sugerida:

### `gdl_catalogos`

Armazena listas e metadados vindos do GDL.

Campos sugeridos:

- `id`
- `ambiente`
- `catalogo`
- `codigo`
- `nome`
- `filtro_chave`
- `filtro_valor`
- `payload_json`
- `sincronizado_em`

Catalogos iniciais:

- `naturezasExames`
- `tiposPecas`
- `unidadesMedida`
- metadados de inputs de peca, se descobertos no GDL web

### `gdl_reps_cache`

Armazena o retorno bruto de REPs consultadas.

Campos sugeridos:

- `id`
- `ambiente`
- `cod_rep`
- `numero`
- `ano`
- `dados_json`
- `consultado_em`

## IPC e servico GDL

Adicionar canais somente leitura:

- `gdl:sincronizar-catalogos-b602`
  - consulta homologacao;
  - salva catalogos/metadados no banco local;
  - retorna contagens e data da sincronizacao.

- `gdl:listar-opcoes-b602`
  - retorna opcoes cacheadas por grupo/campo do formulario.

- `gdl:consultar-rep`
  - manter comportamento atual de consulta;
  - adicionar persistencia do JSON bruto em `gdl_reps_cache`.

Todos os novos canais devem ser registrados no preload e manter a regra de seguranca atual: renderer nunca acessa `electron`, `http`, `https` ou banco diretamente.

## Formulario B602

Substituir listas fixas locais por opcoes vindas do cache GDL quando disponiveis.

Fallbacks:

- se nao houver cache, usar as listas locais atuais;
- se uma opcao salva em REP antiga nao existir no cache, exibir o valor salvo sem descarta-lo;
- se o GDL retornar campo desconhecido, preservar no JSON bruto e nao renderizar input especulativo.

Areas iniciais:

- Material Encaminhado
- Armas
- Cartuchos
- Estojos

Para cada peca mapeada com seguranca, o formulario deve preencher `campos_especificos.b602` em vez de jogar dados em `observacoes`.

## Correcao de mapeamento da REP GDL

Problema atual: em homologacao, `tipo_solicitacao` pode ser preenchido com `MOVIMENTACAO`, valor que nao representa corretamente o tipo da solicitacao.

Regra proposta:

- nao preencher `tipo_solicitacao` com valores ambiguos de andamento/movimentacao;
- mapear apenas origens reconhecidas como oficios, BOs ou equivalentes;
- quando houver ambiguidade, mostrar na revisao da consulta GDL e deixar o campo para preenchimento manual;
- nao colocar `pecas[*]` em `observacoes`;
- pecas devem alimentar estrutura propria de B602 apenas quando houver correspondencia segura.

## UX

Na pagina de configuracao GDL:

- adicionar acao "Sincronizar catalogos B602";
- exibir ambiente usado;
- exibir data da ultima sincronizacao;
- exibir quantidade de itens sincronizados;
- deixar claro quando o formulario esta usando fallback local.

No modal de consulta GDL:

- revisar campos que serao aplicados;
- destacar campos ignorados por ambiguidade;
- listar pecas encontradas na REP;
- indicar quais pecas foram mapeadas automaticamente e quais ficaram apenas preservadas no JSON bruto.

## Testes

### Automatizados

- Normalizacao de nomes GDL:
  - `CARABINA(S)` deve casar com tipo local quando houver mapeamento.
  - acentos, caixa e pluralizacao nao devem quebrar comparacao.

- Mapeamento de origem:
  - `MOVIMENTACAO` nao preenche `tipo_solicitacao`.
  - origem reconhecida como oficio preenche `Oficio` ou valor equivalente aprovado.

- Cache:
  - sincronizacao faz upsert sem duplicar catalogos;
  - leitura offline retorna dados salvos;
  - ausencia de cache ativa fallback local.

- B602:
  - opcoes cacheadas aparecem nos selects;
  - valores antigos continuam abrindo corretamente;
  - `campos_especificos.b602` serializa pecas mapeadas.

### Manuais em homologacao

1. Criar branch `feat/gdl-b602`.
2. Configurar credenciais de homologacao.
3. Sincronizar catalogos B602.
4. Abrir GDL web em homologacao e capturar fluxo de "Adicionar Peca".
5. Selecionar `CARABINA(S)` e registrar requests/respostas relevantes.
6. Consultar REP B602 real fornecida pelo usuario.
7. Aplicar dados ao formulario local.
8. Salvar REP local.
9. Reabrir REP e validar persistencia.
10. Confirmar funcionamento sem acesso ao GDL usando cache local.

## Criterios de aceitacao

- O formulario B602 usa opcoes do GDL quando sincronizadas.
- O sistema continua funcionando offline com cache ou fallback local.
- `MOVIMENTACAO` nao e aplicado como `Tipo de Solicitacao`.
- Pecas do GDL deixam de ser despejadas em `observacoes`.
- O JSON bruto de REPs consultadas fica preservado para auditoria e evolucao do mapeamento.
- A implementacao nao realiza escrita na API GDL.

## Fora do escopo inicial

- Enviar laudo pelo GDL.
- Criar, atualizar ou excluir REP no GDL.
- Sincronizar todos os tipos de exame.
- Mapear todos os tipos de peca existentes no GDL sem amostra ou metadado.
- Criar tela completa de edicao manual de schema dinamico.

## Observacoes

Este plano e intencionalmente incremental. A primeira entrega deve criar a infraestrutura para descobrir, cachear e consumir dados do GDL, reduzindo a necessidade de codificacao manual. O mapeamento especifico por tipo de peca deve crescer conforme forem capturados metadados reais ou REPs de homologacao representativas.
