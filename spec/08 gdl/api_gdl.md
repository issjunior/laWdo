# Integração atual com a API GDL

## Dependência do banco local

Antes de registrar handlers, sincronizar templates ou iniciar qualquer consulta ao GDL, `setupDatabase()` prepara o SQLite. A tabela `configuracoes` é obrigatória porque guarda URLs e credenciais da integração.

Em instalação nova, o schema-base é criado e as migrations são executadas antes do registro da versão atual. Em atualização, a migration v33 garante `configuracoes` e a verificação de integridade recompõe estruturas complementares e índices ausentes. A versão só é registrada depois que as migrations terminam.

Se ainda faltarem estruturas obrigatórias, a inicialização falha para preservar os dados locais; o processo principal informa o erro e encerra o aplicativo. Nessa condição, nenhum handler nem consulta ao GDL é iniciado.

## Limite e fluxos

A integração é exclusivamente de leitura no GDL. Há dois consumidores ativos:

```text
Consulta de REP: modal → preload → gdl.handlers → gdl.service
  → /api/rep/obter → schemas Zod → adaptador B-602 → REPsPage

Fotos da REP: Painel de Ilustrações → preload → gdl.handlers
  → resolve laudo → REP → gdl.service → Lista de Fotos ZIP
  → thumbnails temporárias ou imagens validadas → fila persistida do laudo
```

`gdl.service.ts` controla HTTP, credenciais e leitura do arquivo retornado; o renderer não recebe JSON bruto, credenciais, URL de download, caminho local ou identificadores remotos.

## Importação de REP B-602

`gdl:consultar-rep` normaliza o número informado, consulta somente os endpoints de leitura do GDL e exige uma natureza de exame identificável. No estado atual, somente o código `B-602` pode ser aplicado ao formulário: natureza ausente ou outro código interrompe a importação sem preencher dados locais.

O modal apresenta uma revisão antes da escrita. Ele separa identificação, solicitação e investigação, permite selecionar as peças reconciliadas e no máximo os dez primeiros envolvidos. Quando o GDL retorna origens de solicitação, BO, IP e Ofício têm preferência; se houver origens mas nenhuma delas pertencer a essas famílias, uma delas precisa ser escolhida para habilitar a aplicação.

A escolha é preservada apenas nos metadados locais da integração como `origemSolicitacaoSelecionada` (`tipo`, `numero`, e opcionalmente `dataDocumento` e `iniciais`). Ela não altera o registro nem a situação da REP no GDL. O texto local `observacoes` é apresentado como **Quesito aberto** na REP e na visualização gerada.

## Lista de Fotos, thumbnails e captura

Para imagens, o main parte exclusivamente de `laudoId`, resolve a REP e só continua se `rep.numero` estiver no formato `número/ano`. O download da Lista de Fotos usa Basic Auth e CPF quando configurado, recebe ZIP com timeout de 30 segundos e lê metadados inclusive ZIP64.

A listagem expõe metadados públicos, `idSelecao` derivado e `thumbnailDataUri` opcional. A prévia é criada no main a partir da entrada ZIP elegível, usando imagem JPEG de no máximo 320 px no maior lado. Não há persistência ou fallback para a imagem original quando a decodificação da thumbnail falha; o cliente deve manter a foto selecionável e informar a ausência de prévia.

A captura rebaixa e revalida a lista, deduplica IDs e extrai somente itens selecionados. A seleção final exige imagem provável, entrada não criptografada, bytes íntegros e formato aceito. Cada sucesso retorna `dataUri`, MIME, tamanho e SHA-256. A thumbnail serve apenas à escolha visual: a persistência local e a exportação usam sempre o arquivo original validado.

## Fronteira externa e verificação

A API não é alterada pelo aplicativo. 401/403, 404 e respostas inesperadas recebem mensagens específicas; falhas de captura são isoladas por item. A listagem/captura de imagens é coberta no renderer pelo modal; a rede real continua dependente de homologação controlada.
