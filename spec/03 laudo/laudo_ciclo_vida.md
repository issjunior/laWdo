# Ciclo de vida atual do laudo

## Criacao

O laudo nasce em `criarLaudoInicial()` com status fixo `Em andamento`.

Fluxo atual:

1. impede duplicidade por `rep_id`
2. busca as secoes do template
3. le `campos_especificos` da REP
4. filtra secoes ativas
5. expande secoes repetiveis
6. monta `conteudo`
7. grava o laudo com `tipo_criacao = 'template'`, `versao = 1` e `data_inicio`

Fallback de conteudo:

```html
<p>Laudo em elaboracao.</p>
```

## Consultas principais

`laudo.service.ts` hoje expoe:

- `findByRepId(repId)`
- `findAllByRepId(repId)`
- `findAllComRep()`
- `updateConteudo(id, conteudo)`
- `updateStatus(id, status)`
- `deletarPorRepId(repId)`
- `deletar(laudoId)`
- `gerarLaudoWizard(...)`
- `salvarProgressoWizard(...)`
- `getRespostasWizard(laudoId)`
- `sincronizarSecoesCondicionais(laudoId)`

`findAllComRep()` ja retorna contexto de listagem com:

- numero da REP
- nome do template
- status da REP
- tipo de exame
- data da requisicao

## Status validos

`updateStatus()` aceita apenas:

- `Em andamento`
- `Concluido`
- `Entregue`

Comportamento atual:

- ao concluir, preenche `data_conclusao`
- ao entregar, preenche `data_entrega`
- sempre atualiza `updated_at`

## Conteudo do laudo

`updateConteudo()` apenas troca `conteudo` e `updated_at`.
A evolucao estrutural do laudo fica separada em `sincronizarSecoesCondicionais()`, que reconstroi a base a partir do template e reconcilia com o HTML salvo.

## Exclusao

`deletar(laudoId)`:

1. busca o laudo
2. remove o diretorio fisico do laudo em `userData/laudos/{id}`
3. remove `imagens_laudo`
4. remove a linha do banco
5. retorna `rep_id`

`deletarPorRepId(repId)` repete o processo para todos os laudos da REP antes de apagar as linhas.

## Wizard

O wizard nao cria um laudo paralelo.
Ele atualiza o laudo existente:

- recalcula pecas por secao
- injeta blocos com `data-peca-id` e `data-peca-hash`
- reaplica pecas sem sobrescrever edicoes manuais detectadas por hash
- persiste `respostas_wizard` no laudo e na tabela dedicada

## Regra pratica

No estado atual, o laudo nao e apenas um texto editavel.
Ele e o resultado de tres fontes combinadas:

1. template
2. dados da REP
3. intervencoes do usuario no editor e no wizard

Toda manutencao que mexa em qualquer um desses tres lados precisa considerar o comportamento de reconciliacao do service.
