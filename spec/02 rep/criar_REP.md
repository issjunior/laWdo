# Ciclo atual de criação e edição de REP

## Fluxo entre camadas

```text
REPsPage
  → window.ipcAPI.rep.create/update
  → preload
  → rep.handlers
  → repService/BaseService
  → SQLite
```

O renderer valida e monta o payload. O preload restringe os canais. O handler sanitiza campos textuais, aplica regras de ciclo de vida e delega o CRUD.

## Fontes de validação

O renderer combina schema Zod, `react-hook-form`, pendências específicas por exame e validação estrutural das peças B-602.

O handler do main não repete todo o schema. Na criação ele exige número, verifica duplicidade e sanitiza campos conhecidos. Na atualização aceita payload parcial e sanitiza somente os campos presentes.

Consequência: o renderer é a principal barreira de domínio, mas o IPC continua sendo fronteira insegura. Novas chamadas ou campos precisam manter payload, handler, preload e tipos alinhados.

## Montagem do payload

`prepareForApi()` separa colunas comuns, ids opcionais, coordenadas numéricas, template/perito e `campos_especificos`.

Para B-602, a página passa `PecaB602[]` e `MetadadosIntegracaoGdl | null` como contexto de `serializeCamposEspecificos()`. O `b602Service` produz diretamente o JSON canônico com investigação, `solicitante_nome`, `b602.pecas` e `integracaoGdl` opcional.

## Criação

`rep:create`:

1. rejeita número vazio ou duplicado
2. gera UUID
3. força status `Pendente`
4. sanitiza textos
5. cria a REP
6. registra auditoria
7. tenta criar laudo se template e perito forem enviados e o template não for `tpl-nao-definido`

REP e laudo não são criados em uma transação. Se o laudo falhar, a REP permanece criada, o erro é registrado e a resposta da REP continua sendo sucesso.

## Edição

Na abertura:

1. resolve tipo, template e laudo vinculado
2. desserializa campos escalares específicos
3. valida e extrai peças e metadados B-602
4. restaura `origensDisponiveis` para o seletor de solicitação
5. combina dados persistidos com `emptyForm()`
6. preserva snapshots legados de toggles e armas para avisos

Na atualização, o handler persiste a REP primeiro. Depois cria laudo ausente, troca template ou sincroniza seções condicionais. Falhas dessas etapas são registradas, mas não desfazem a atualização da REP.

## Exclusão

`rep:delete` remove primeiro o laudo vinculado e depois a REP. As duas operações não estão numa transação visível. Se a segunda falhar após a primeira, pode restar uma REP sem o laudo anterior.

## B-602

Seções ativas:

- Dados da Investigação
- Peças

O salvamento exige dados fixos, ao menos uma peça completa, primeiro envolvido, data da ocorrência, cidade, UF e BO ou IP.

Peças ficam fora de `react-hook-form`. A validade usa o catálogo compartilhado. O JSON novo não é equivalente aos arrays legados ainda usados por parte do laudo.

`b602_solicitante_nome` usa o órgão dos metadados GDL quando disponível; caso contrário acompanha o solicitante local. O valor é persistido dentro do bloco B-602.

## Aplicação do GDL

A consulta produz contrato B-602 tipado. Ao aplicar:

- sem tipo selecionado, a página seleciona B-602
- com outro tipo, interrompe e exige confirmação da troca
- `mesclar` preserva valores locais não vazios
- `substituir` aplica os valores retornados
- formulário sem dados relevantes é tratado como substituição
- na primeira consulta geral, todas as peças retornadas começam marcadas
- no modo substituir, peças GDL desmarcadas são removidas localmente e peças manuais permanecem
- peças são reconciliadas por `codPecaGdl`
- todas as origens válidas retornadas ficam disponíveis para escolha posterior

O normalizador sugere inicialmente a primeira origem cuja família começa por BO, IP ou OFÍCIO; se não houver, usa a primeira origem disponível. Tipo e número são aplicados como par.

`TipoSolicitacaoSelect` separa origens da REP e opções de preenchimento manual. Selecionar uma origem GDL altera conjuntamente `tipo_solicitacao` e `numero_documento`. Selecionar tipo manual ou `Outros` limpa o número para evitar associação acidental a outra origem. O par exato tipo+número identifica origens repetidas do mesmo tipo.

Valores do catálogo GDL e tipos legados aparecem como opções manuais. Valor livre permanece em `Outros`; valor desconhecido recebido do GDL é preservado como opção enquanto os metadados indicarem origem GDL.

O botão `Selecionar peças do GDL`, exibido na seção B-602, abre um fluxo separado da consulta geral. Ele usa o número da REP já preenchido, consulta automaticamente e altera somente `PecaB602[]` e os metadados da última consulta. O checkbox inicia marcado apenas para peças GDL ainda presentes no formulário; peça nova ou removida anteriormente inicia desmarcada. Aplicar a seleção remove localmente as importadas desmarcadas e preserva todas as peças manuais.

O destaque verde é estado de sessão e não é persistido. Avisos do normalizador não bloqueiam salvamento. A revisão exclusiva mostra uma mensagem de sucesso por cinco segundos após aplicar a seleção.

## Acoplamento legado com o laudo

`handleSalvar` ainda verifica toggles e snapshots de armas do modelo antigo para alertar sobre laudo vinculado. Como as seções legadas não estão ativas e a escrita canônica remove seus arrays, esse caminho não representa as peças atuais.

Antes de reutilizá-lo para `PecaB602`, é necessário definir conversão ou migrar consumidores. Não associar automaticamente uma peça da família arma a `b602.armas` sem regra explícita.

## Desempenho e concorrência

- listas e templates são carregados por IPC; o formulário fica local
- salvamento é uma chamada por REP, seguida de recarga da lista
- não há controle otimista por `updated_at`; edições concorrentes podem sobrescrever campos
- criação automática e sincronização do laudo acrescentam operações sequenciais

Evitar consultas por campo ou peça durante renderização. Dados derivados devem ser calculados localmente ou carregados em lote.

## Verificação e lacunas

Testes do seletor cobrem aplicação programática sem apagar tipo/número, seleção manual, valores catalogados, valor livre e origens repetidas. Testes do service cobrem persistência canônica. O teste de `GdlPecasModal` cobre consulta automática, peça nova desmarcada, peça já importada marcada e aplicação da seleção; helpers cobrem reconciliação e preservação de peças manuais.

Não há teste automatizado direto dos handlers `rep:create` e `rep:update` atravessando persistência e laudo, nem teste end-to-end de reabertura pelo IPC.
