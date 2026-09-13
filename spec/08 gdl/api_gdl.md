# Integração atual com a API GDL

## Limite e fluxos

A integração é exclusivamente de leitura no GDL. Há três consumidores: consulta/importação de REP, atualização local de REP existente e fotos para ilustrações. O renderer não recebe JSON bruto, credenciais, URLs de download, caminhos locais nem identificadores remotos; `gdl.service.ts` controla HTTP, credenciais e normalização. O laWdo nunca cria, edita, exclui ou altera status de qualquer registro no GDL.

```text
REPsPage ou LaudosPage → diálogo de revisão → preload → gdl.handlers
  → atualizacao-rep-gdl.service → consulta GDL e adaptador B-602
  → comparação seletiva → transação local de REP, laudo e seções derivadas
```

## Atualização local de REP existente

O fluxo exige número `número/ano` e exame B-602. `gdl:preparar-atualizacao-rep` gera prévia de diferenças; `gdl:aplicar-atualizacao-rep` aceita apenas o identificador efêmero, IDs emitidos pela prévia e a confirmação de reabertura. Valores vazios do GDL não são aplicáveis e o main não aceita valores arbitrários do renderer.

A prévia fica somente em memória por dez minutos e captura `updated_at` da REP e do laudo. Expiração ou alteração concorrente exige nova consulta. A seleção começa marcada e pode ser reduzida pelo usuário.

Peças são correlacionadas por `codPecaGdl`, identificador interno que não é exibido nem constitui sozinho uma diferença. `idLocal`, origem e marcador de alteração local também não participam da comparação. Cada peça alterada mostra tipo, identificação, quantidade de alterações e detalhes recolhíveis por campo, comparando explicitamente o valor local anterior ao valor atual do GDL. Peça existente preserva `idLocal`; peça nova é adicionada e peça local ausente da resposta não é removida.

A escrita ocorre em transação local: atualiza REP, reabre REP e laudo concluído ou entregue quando houver confirmação e reconcilia seções condicionais. A auditoria registra atualização e transição aplicável. Após sucesso, a operação efêmera é descartada, o diálogo fecha e a tela recarrega. Falhas de rede orientam sobre rede/VPN, oferecem nova tentativa explícita e não têm retry automático.

## Fronteiras e verificação

A API e a página web do GDL são fronteiras não confiáveis e imutáveis pelo aplicativo. 401/403, 404 e respostas inesperadas têm mensagens específicas. `atualizacao-rep-gdl.service.test.ts` cobre comparação seletiva, correlação de peças e encaminhamento do estado anterior ao laudo; `atualizar-rep-gdl-dialog.component.test.tsx` cobre a apresentação local/GDL e o fechamento após sucesso. Rede real, autenticação web e HTML de produção dependem de homologação controlada.
