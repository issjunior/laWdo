# Linha do tempo entre REP e laudo

## Pontos de acesso

A timeline hoje pode ser aberta de tres lugares:

- tabela de REPs
- tabela de laudos
- aba `Linha do Tempo` da `LogsPage`

No caso da `LogsPage`, o usuario informa o numero da REP, a pagina resolve o id via `window.ipcAPI.rep.findByNumero(numero)` e so depois monta a timeline.

## Fonte dos dados

O backend usa `getTimelineRep(repId)` em `src/main/services/audit-log.service.ts`.

Query atual:

```sql
SELECT la.*, 'REP' as origem FROM logs_auditoria la
WHERE la.modulo IN ('rep', 'reps') AND la.entidade_id = ?
UNION ALL
SELECT la.*, 'Laudo' as origem FROM logs_auditoria la
LEFT JOIN laudos ld ON la.entidade_id = ld.id
WHERE ld.rep_id = ?
   OR (la.modulo IN ('laudo', 'laudos') AND la.entidade_id = ?)
ORDER BY created_at ASC
```

Esse desenho cobre:

- eventos de REP gravados por `auditCicloVida`
- exclusoes gravadas por `auditDelete`
- eventos de laudo vinculados diretamente ao `laudo.id`

## Papel da `LogsPage`

`src/renderer/pages/LogsPage.tsx` nao reconstrui a timeline manualmente.
Ela apenas:

1. resolve a REP pelo numero informado
2. guarda `timelineRepId`
3. renderiza `DualTrackTimeline`

Se a busca falhar, a pagina exibe o erro retornado pelo IPC e nao tenta montar a trilha.

## Relacao com a auditoria

A timeline depende integralmente de `logs_auditoria`.
Logo, qualquer alteracao no fluxo de status ou exclusao de REP/laudo precisa manter os eventos de auditoria coerentes para nao quebrar a narrativa cronologica.
