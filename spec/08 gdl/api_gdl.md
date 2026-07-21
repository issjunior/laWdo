# Integração atual com a API GDL

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

## Lista de Fotos, thumbnails e captura

Para imagens, o main parte exclusivamente de `laudoId`, resolve a REP e só continua se `rep.numero` estiver no formato `número/ano`. O download da Lista de Fotos usa Basic Auth e CPF quando configurado, recebe ZIP com timeout de 30 segundos e lê metadados inclusive ZIP64.

A listagem expõe metadados públicos, `idSelecao` derivado e `thumbnailDataUri` opcional. A prévia é criada no main a partir da entrada ZIP elegível, usando imagem JPEG de no máximo 320 px no maior lado. Não há persistência ou fallback para a imagem original quando a decodificação da thumbnail falha; o cliente deve manter a foto selecionável e informar a ausência de prévia.

A captura rebaixa e revalida a lista, deduplica IDs e extrai somente itens selecionados. A seleção final exige imagem provável, entrada não criptografada, bytes íntegros e formato aceito. Cada sucesso retorna `dataUri`, MIME, tamanho e SHA-256. A thumbnail serve apenas à escolha visual: a persistência local e a exportação usam sempre o arquivo original validado.

## Fronteira externa e verificação

A API não é alterada pelo aplicativo. 401/403, 404 e respostas inesperadas recebem mensagens específicas; falhas de captura são isoladas por item. A listagem/captura de imagens é coberta no renderer pelo modal; a rede real continua dependente de homologação controlada.
