# Integração atual com a API GDL

## Limite e fluxos

A integração é exclusivamente de leitura no GDL. Há dois consumidores ativos:

```text
Consulta de REP: modal → preload → gdl.handlers → gdl.service
  → /api/rep/obter → schemas Zod → adaptador B-602 → REPsPage

Fotos da REP: Painel de Ilustrações → preload → gdl.handlers
  → resolve laudo → REP → gdl.service → Lista de Fotos ZIP
  → imagens validadas → fila persistida do laudo
```

`gdl.service.ts` controla HTTP, ambiente, credenciais e leitura do arquivo retornado; `gdl.schema.ts` valida JSON externo; `gdl-adaptadores.service.ts` seleciona a conversão por código de exame. O renderer não recebe JSON bruto, credenciais, URL de download, caminho local ou identificadores remotos.

## Consulta e fronteira externa

`consultarRep(numero, ano)` exige credenciais, chama `/rep/obter`, interpreta a resposta como `unknown`, valida com Zod e então normaliza. O request JSON tem timeout de 15 segundos e não possui retry/backoff. Em homologação, a consulta auxiliar de envolvidos tolera falhas e pode acrescentar até 15 segundos por filtro, pois é sequencial.

Schemas preservam propriedades dinâmicas como `unknown`. Campos conhecidos são normalizados e extras ficam em `extrasGdl`. Falhas de autenticação limpam a validação local; timeout, 404 e falhas genéricas não a limpam. `rejectUnauthorized: false` permanece uma limitação de TLS antes do uso regular em produção.

## Lista de Fotos e captura

Para imagens, o main parte exclusivamente de `laudoId`, resolve a REP associada e só continua se `rep.numero` estiver no formato `número/ano`. `consultarIdentificacaoDaRep()` obtém `codRep`; em seguida `gdl.service.ts` monta o endpoint `Rep/Controls/PictureHandler.ashx` com `repId` e `repNumberYear`. O download usa Basic Auth e CPF quando configurado.

A Lista de Fotos é recebida como binário ZIP com timeout de 30 segundos. O serviço lê metadados ZIP, inclusive ZIP64, e não confia em nome, extensão ou seleção enviados pelo renderer. A listagem expõe somente metadados públicos e um `idSelecao` derivado; a captura rebaixa e revalida a lista, deduplica os IDs solicitados e extrai somente itens selecionados.

A seleção final requer imagem provável, sem status impeditivo, entrada ZIP não criptografada, bytes íntegros e formato aceito (JPEG, PNG, GIF ou BMP). Cada sucesso retorna `dataUri`, MIME, tamanho e SHA-256. Falhas são isoladas por item em `ResultadoCapturaImagensRepGdl`; 401/403, 404 e demais respostas do endpoint recebem mensagens específicas. A cópia resultante passa a ser persistência local do laudo; o GDL não é alterado.

## Conversão B-602

`converterRepB602()` produz dados gerais, peças, origens, investigação, metadados e avisos. Tipos são resolvidos por label/alias normalizado contra `b602-gdl.catalogo.ts`, fonte de verdade dos 16 tipos suportados. `PEÇA TESTE` (`771`) é ignorada e nunca chega ao editor.

Campos comuns aceitam chaves canônicas ou labels visuais; datas brasileiras ou ISO são normalizadas para `AAAA-MM-DD`. `numeroAnalises` é aceito no payload bruto, mas descartado do modelo local. Enumerados aceitam código ou label e se tornam valor canônico. Somente campos confirmados no catálogo entram em `personalizados`; os restantes permanecem em `extrasGdl`.

Os 16 tipos têm round-trip coberto por fixtures anonimizados, normalização, IPC, SQLite e reabertura. A rede GDL real e a validação em produção continuam fora da automação.

## Aplicação local

A consulta geral inicia as peças retornadas marcadas e permite Mesclar ou Substituir sem salvar automaticamente. A revisão exclusiva de peças consulta a REP já preenchida e reconcilia `PecaB602[]`: peças GDL presentes ficam marcadas, removidas localmente ficam desmarcadas e peças manuais são preservadas.

Mesclar mantém alterações locais; Substituir reconcilia por `codPecaGdl` e pode remover peças GDL desmarcadas ou ausentes da seleção. Nenhuma ação desse fluxo cria, atualiza ou exclui dados no GDL.

## Verificação

A integração é coberta por schemas, normalizador, adaptadores, catálogo, modais, aplicação no formulário e persistência por handlers IPC/SQLite. A captura de imagens possui teste do modal e teste de migração de imagens locais; a comunicação real com o endpoint de fotos ainda requer homologação controlada.
