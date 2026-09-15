# Ciclo atual de criação e edição de REP

## Fluxo entre camadas

```text
REPsPage → window.ipcAPI.rep.create/update → preload → rep.handlers
  → repService/BaseService → SQLite
```

O renderer valida e monta o payload; preload, handler e tipos mantêm o contrato IPC. Em B-602, `serializeCamposEspecificos()` produz o JSON canônico com investigação, `solicitante_nome`, `b602.pecas` e `integracaoGdl` opcional.

`rep:create` rejeita número vazio ou duplicado, gera UUID, força `Pendente`, sanitiza, registra auditoria e tenta criar laudo. Criação comum de REP e laudo não é transacional. `rep:update` persiste a REP antes de criar/trocar/sincronizar laudo; falha posterior é registrada sem desfazer a REP.

## B-602 e atualização pelo GDL

O salvamento B-602 exige dados fixos, peça completa, primeiro envolvido, ocorrência, localidade e BO ou IP. Na importação geral, `mesclar` preserva valores locais e `substituir` aplica retornos; peças são correlacionadas por `codPecaGdl` e as manuais permanecem.

A atualização de REP já persistida usa `atualizacao-rep-gdl.service.ts`, sem passar por `rep:update`. A prévia aceita apenas diferenças emitidas, expira em dez minutos e verifica `updated_at` de REP e laudo. Campos não selecionados e peças locais ausentes da resposta são preservados.

`codPecaGdl` é apenas correlação, e `idLocal`, origem e marcador local são atributos técnicos ignorados na comparação. A revisão mostra tipo, identificação e, por campo, o valor local ao lado do valor vindo do GDL.

Laudo concluído ou entregue exige confirmação de reabertura; a atualização, auditoria e sincronização de seções ocorrem na mesma transação local. Nenhum dado é enviado ao GDL. Ao concluir, o diálogo fecha e a página recarrega.

## Verificação e limites

Os testes de B-602 cobrem serialização, persistência e peças manuais. `rep-b602-persistencia.integration.test.ts` cobre CRUD com SQLite temporário e laudo mockado. `atualizacao-rep-gdl.service.test.ts` protege atualização seletiva, correlação e reabertura; `atualizar-rep-gdl-dialog.component.test.tsx` protege revisão visual e fechamento. A reconciliação de laudo com SQLite e HTML reais permanece sem teste de integração dedicado.
