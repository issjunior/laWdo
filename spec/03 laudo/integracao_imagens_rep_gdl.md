# Plano: integração de imagens da REP GDL com o Painel de Ilustrações

## 1. Objetivo

Permitir que o usuário, durante a elaboração de um laudo associado a uma REP, consulte os arquivos dessa REP pela API oficial do GDL, selecione imagens e as disponibilize no Painel de Ilustrações do laWdo.

O fluxo deve ser exclusivamente de leitura no GDL. A captura termina em uma cópia local incorporável ao laudo; nenhuma operação pode incluir, editar ou excluir arquivo no GDL.

Este plano pertence ao domínio Laudo porque o resultado funcional é uma nova origem de imagens para o Painel de Ilustrações. Transporte, autenticação e validação da fronteira externa continuam sob a integração GDL.

## 2. Estado atual relevante

### 2.1 API GDL

O laWdo já possui credenciais separadas por ambiente, autenticação Basic no processo principal, consulta de REP por `/rep/obter`, validação Zod, handlers IPC e preload tipado.

O contrato bruto de REP preserva propriedades adicionais como `unknown`, mas `anexosEletronicos` e `arquivosAdicionais` ainda não possuem schemas explícitos e não são transportados pelo adaptador B-602 até o renderer.

O helper HTTP atual acumula a resposta como texto. Ele serve para JSON, mas não deve ser reutilizado sem adaptação para binários, pois precisa preservar bytes, observar `Content-Type`, limitar tamanho durante o streaming e permitir cancelamento seguro.

### 2.2 Painel de Ilustrações

`IlustracoesPanel` já:

- recebe arquivos locais `image/*`;
- converte a imagem completa para data URI;
- cria miniatura JPEG;
- permite visualizar, legendar, ordenar e inserir uma ou todas as imagens;
- funciona inline e em janela destacada;
- entrega a imagem ao editor pelo contrato `ImagemLaudo`.

As imagens carregadas e ainda não inseridas são estado transitório do painel. A persistência efetiva acontece quando a figura entra no HTML do laudo e o conteúdo é salvo. A primeira versão da integração GDL deve conservar essa regra, sem reativar ou criar uma segunda galeria persistida.

### 2.3 Persistência e exportação

Figuras inseridas usam `<figure class="laudo-figure" data-image-id="...">`, com a imagem em data URI. O salvamento reindexa as figuras e persiste o HTML por `laudo.updateConteudo`. Reabertura, preview e exportação consomem esse mesmo conteúdo.

Assim, uma imagem capturada do GDL deve convergir para o mesmo `ImagemLaudo` e para o mesmo HTML usado por upload local, colagem e arraste. Não criar um caminho paralelo de renderização ou exportação.

## 3. Contrato oficial considerado

A referência normativa é `docs/api/API_GDL.txt`. Os endpoints previstos são:

| Finalidade | Endpoint oficial | Dados relevantes |
|---|---|---|
| obter REP e arquivos vinculados | `GET /api/rep/obter?numero={numero}&ano={ano}` | `anexosEletronicos`, `arquivosAdicionais`, nome, tamanho, hash, data e, em arquivos adicionais, `fileId` |
| baixar arquivo da REP | `GET /api/rep/download?fileId={fileId}` | número, ano e hash também são descritos como parâmetros; retorno pode ser `data:application...` |
| listar laudos e anexos | `GET /api/repsPortalCientifica/listaLaudos` | `fileId`, `fileName`, `fileHash`, status e link; requer número, ano, `filePassword` e `userIP` |
| resolver laudo ou anexo | `GET /api/repsPortalCientifica/downloadArquivo` | recebe `fileId` e `userIP`; retorna `caminhoArquivo` e `nomeOriginal` |

A foto existente em `/api/usuario/fichaFuncional/{id}` é exclusiva do usuário/perito e não pertence a este fluxo.

### 3.1 Confirmações obrigatórias antes da implementação final

A documentação deixa pontos que precisam ser comprovados em homologação usando somente a API:

1. em qual coleção as fotos da galeria de uma REP são devolvidas;
2. se `anexosEletronicos` reais também fornecem `fileId`, embora o exemplo documentado mostre apenas hash;
3. como número, ano e hash devem ser enviados no `GET /rep/download`, pois não devem ser enviados em corpo GET sem confirmação explícita;
4. se o retorno é binário, data URI ou JSON conforme o tipo de arquivo;
5. quais `Content-Type`, nomes e tamanhos são devolvidos;
6. se `downloadArquivo` exige uma segunda requisição para `caminhoArquivo` e qual base oficial deve ser usada;
7. se `filePassword` e `userIP` estão disponíveis no contexto autenticado do laWdo para uso dos endpoints `repsPortalCientifica`.

Nenhuma lacuna deve ser preenchida por inferência da interface web.

## 4. Decisões arquiteturais

### 4.1 Fonte e limites

- Consumir exclusivamente endpoints documentados da API GDL.
- Scraping, automação da página Web Forms, leitura de cookies e reaproveitamento da sessão do navegador são proibidos.
- A integração é genérica para imagens de qualquer REP associada a um laudo; não depende de B-602.
- O primeiro request lista apenas metadados. O conteúdo só é baixado após seleção explícita.
- Arquivos não identificados como imagem permanecem visíveis como metadados informativos, mas não entram no Painel de Ilustrações.
- Importação de PDFs, ZIPs, vídeos ou outros anexos para uma área própria fica fora da primeira versão.

### 4.2 Associação segura com a REP

O renderer informa o `laudoId`. O processo principal resolve `laudo → rep_id → número/ano` e usa essa associação na API. Não confiar em número, ano, hash, URL ou caminho arbitrário fornecido pelo renderer.

Se o número persistido não puder ser interpretado inequivocamente como número/ano do GDL, a operação deve ser bloqueada com mensagem clara. Não consultar uma REP aproximada.

### 4.3 Persistência

- Imagem baixada e ainda não inserida: estado transitório do painel, igual ao upload local.
- Imagem inserida: data URI no HTML da seção `ILUSTRAÇÕES`.
- Reabertura offline: deve funcionar porque a imagem inserida não depende mais do GDL.
- Não criar gravação paralela em `campos_especificos`, na REP ou em tabela nova na primeira versão.
- Não persistir credenciais, URLs de download, `filePassword` ou `userIP` no HTML.

### 4.4 Identidade e duplicidade

Cada item listado recebe um `idSelecao` local derivado de origem e identificadores normalizados. Após o download, calcular SHA-256 dos bytes para deduplicação e integridade local.

Na mesma sessão do painel, uma imagem já capturada não deve ser adicionada novamente. A prevenção de duplicidade após salvar e reabrir só deve ser ampliada se puder usar um digest local no markup sem expor identificadores do GDL e sem afetar exportação.

## 5. Fluxo do usuário

1. Usuário abre um laudo associado a uma REP.
2. No Painel de Ilustrações, escolhe `Buscar imagens da REP`.
3. O laWdo resolve a REP no processo principal e consulta os metadados no GDL.
4. Um modal apresenta nome, origem, tamanho, data e situação de cada arquivo.
5. Imagens prováveis são selecionáveis; demais arquivos são apenas informativos.
6. Usuário escolhe as imagens e confirma `Capturar imagens`.
7. O processo principal revalida a listagem e baixa somente os itens selecionados.
8. Cada resposta passa por limites, validação de MIME, assinatura binária e integridade.
9. Sucessos entram no Painel de Ilustrações com nome do arquivo como sugestão inicial de legenda, editável pelo usuário.
10. Falhas aparecem por item e não descartam imagens já capturadas com sucesso.
11. Usuário insere uma, várias ou todas as imagens no laudo pelo fluxo existente.
12. O salvamento, reabertura, preview e exportação seguem o ciclo atual do laudo.

O modal não deve salvar o laudo automaticamente nem inserir imagens no editor sem confirmação do usuário.

## 6. Contratos locais propostos

Criar contratos compartilhados puros, sem dependência de Node, Electron, React ou DOM:

```ts
type OrigemArquivoRepGdl =
  | 'anexo_eletronico'
  | 'arquivo_adicional'
  | 'portal_cientifica'

interface ArquivoRepGdl {
  idSelecao: string
  origem: OrigemArquivoRepGdl
  nomeArquivo: string
  tamanho: number | null
  dataUpload: string | null
  provavelImagem: boolean
  status: string | null
}

interface ImagemRepGdlCapturada {
  idSelecao: string
  nomeArquivo: string
  mimeType: string
  tamanho: number
  dataUri: string
  sha256: string
}
```

`fileId`, hash remoto, caminho e link pertencem ao processo principal. O renderer recebe apenas `idSelecao` e metadados necessários para revisão.

O retorno em lote deve discriminar sucessos e falhas:

```ts
interface ResultadoCapturaImagensRepGdl {
  imagens: ImagemRepGdlCapturada[]
  falhas: Array<{ idSelecao: string; erro: string }>
}
```

Todos os payloads externos continuam entrando como `unknown` e cruzando schema Zod antes do uso.

## 7. Listagem e normalização

### 7.1 Fonte primária

Usar `/rep/obter` como fonte primária porque o laWdo já consulta esse endpoint com as credenciais configuradas. Tipar explicitamente:

- `anexoEletronico` e `tipoAnexoEletronico`;
- `anexosEletronicos[]`;
- `arquivosAdicionais[]`;
- aliases de capitalização observados e aprovados por fixture.

### 7.2 Complementação

Usar `repsPortalCientifica/listaLaudos` apenas quando:

- a fonte primária não fornecer identificador suficiente para download;
- `filePassword` e `userIP` tiverem origem autorizada e contrato confirmado;
- o retorno real tiver fixture e testes próprios.

O campo `link` devolvido pela API é dado externo, não autorização para request arbitrário. Downloads devem reconstruir URLs a partir da base GDL configurada e de caminhos oficiais permitidos.

### 7.3 Classificação inicial

Nome/extensão servem apenas para marcar `provavelImagem`. A aceitação final depende do conteúdo baixado.

Extensões inicialmente reconhecidas: `.jpg`, `.jpeg`, `.png`, `.gif` e `.bmp`, alinhadas aos formatos já aceitos na exportação. SVG não deve ser aceito nesta etapa devido ao conteúdo ativo possível. Outros formatos só entram após prova de compatibilidade com editor, preview e exportação.

## 8. Download e validação binária

Criar transporte binário específico que:

- devolva `Buffer`, status e headers;
- imponha timeout;
- interrompa o stream ao ultrapassar o limite;
- não converta bytes para string antes da validação;
- trate resposta data URI, JSON intermediário e binário conforme contrato confirmado;
- nunca siga redirecionamento para host fora da lista permitida;
- permita concorrência pequena e controlada.

### 8.1 Limites iniciais

Valores propostos para a primeira versão, centralizados em constantes revisáveis:

- 25 MB por imagem;
- 100 MB por operação de captura;
- no máximo 20 imagens por lote;
- no máximo 2 downloads simultâneos;
- timeout de 30 segundos por arquivo.

Se o metadado já exceder o limite, desabilitar a seleção antes do download. O limite durante o stream continua obrigatório porque tamanho externo não é confiável.

### 8.2 Validação

Antes de criar a data URI:

1. validar status HTTP;
2. conferir `Content-Type`, quando presente;
3. detectar assinatura real dos bytes;
4. rejeitar divergência entre conteúdo e tipo permitido;
5. conferir tamanho anunciado, sem depender dele para segurança;
6. validar o hash remoto somente após confirmar o algoritmo usado pelo GDL;
7. calcular SHA-256 local;
8. construir a data URI com MIME derivado dos bytes, nunca apenas da extensão.

## 9. Integração com o Painel de Ilustrações

Adicionar ao painel:

- botão `Buscar imagens da REP`, ao lado de `Carregar Imagens`;
- modal de consulta e seleção;
- estados de listagem, captura, progresso parcial e falha;
- indicação `Origem: GDL` nos cartões capturados, sem alterar o markup final da figura;
- prevenção de duplicidade durante a sessão;
- comportamento idêntico nos modos inline e pop-out.

Converter `ImagemRepGdlCapturada` para `ImagemLaudo`:

- `id`: novo UUID local;
- `url`: data URI validada;
- `thumbnailUrl`: miniatura gerada pelo fluxo comum;
- `legenda`: descrição oficial quando houver; caso contrário, nome sem extensão como sugestão;
- sequência e número: calculados pelo painel;
- data de criação: instante da captura local.

Extração de arquivo local e imagem GDL deve convergir para uma função comum de criação de `ImagemLaudo`, evitando duas regras de miniatura, legenda ou ordenação.

## 10. IPC e segurança Electron

Adicionar canais específicos, mantendo `contextIsolation: true`, `nodeIntegration: false` e `sandbox: true`:

- `gdl:listar-imagens-laudo` com `laudoId`;
- `gdl:capturar-imagens-laudo` com `laudoId` e `idSelecao[]`.

Para cada canal, atualizar em conjunto:

1. handler;
2. `ALLOWED_CHANNELS`;
3. interface `IpcAPI`;
4. wrapper do preload;
5. tipos de entrada e saída;
6. testes de fronteira.

O handler de captura deve refazer ou validar a listagem no processo principal. Não aceitar do renderer URL, caminho, MIME, tamanho, hash ou conteúdo remoto como verdade.

Credenciais, senhas de arquivo, hashes remotos e URLs assinadas não entram em logs. Logs podem registrar ambiente, `laudoId`, REP, quantidade solicitada, quantidade concluída, duração e classe do erro.

## 11. Tratamento de erros

Mensagens devem distinguir:

- laudo sem REP associada;
- número/ano inválidos;
- credenciais ausentes ou rejeitadas;
- REP inexistente;
- REP sem arquivos;
- REP com arquivos, mas sem imagens compatíveis;
- identificador de download ausente;
- endpoint complementar sem `filePassword`/`userIP` autorizado;
- arquivo excedendo limite;
- tipo de arquivo incompatível;
- hash divergente;
- timeout ou indisponibilidade da rede;
- captura parcial.

Falha de uma imagem não deve remover outras já adicionadas ao painel. Uma nova tentativa deve reaproveitar metadados válidos somente dentro do prazo e escopo definidos; não manter cache indefinido de links ou identificadores sensíveis.

## 12. Arquivos e responsabilidades previstas

| Área | Responsabilidade prevista |
|---|---|
| `src/shared/types/gdl-arquivos.types.ts` | contratos normalizados de listagem e captura |
| `src/main/services/gdl.schema.ts` ou schema específico | validação dos metadados e respostas oficiais |
| `src/main/services/gdl.service.ts` | listagem, autenticação e composição dos endpoints oficiais |
| helper HTTP binário no domínio GDL | streaming limitado, headers, timeout e bytes íntegros |
| `src/main/ipc/handlers/gdl.handlers.ts` | resolver laudo/REP e expor operações somente leitura |
| `src/preload/index.ts` e `src/preload/types.ts` | canais permitidos e chamadas tipadas |
| `src/renderer/components/laudo/GdlImagensRepModal.tsx` | revisão, seleção e progresso da captura |
| `src/renderer/components/laudo/IlustracoesPanel.tsx` | acionar consulta e incorporar resultados ao estado existente |
| `src/renderer/pages/IlustracoesPanelWindow.tsx` | preservar o fluxo na janela destacada |
| `src/renderer/pages/LaudosPage.tsx` | fornecer contexto/sincronização sem criar persistência paralela |
| testes e fixtures GDL | contrato, segurança, UI, persistência e exportação |

A localização final pode ser ajustada durante a implementação se a responsabilidade real indicar um módulo próprio; evitar arquivos minúsculos criados apenas por simetria.

## 13. Etapas de execução

### Etapa 1 — Prova de contrato em homologação

1. escolher uma REP autorizada com imagens;
2. consultar `/rep/obter` pela API;
3. anonimizar e registrar somente a estrutura necessária;
4. identificar coleção, `fileId`, hash, tamanho e nomes;
5. testar o download oficial de uma imagem pequena;
6. registrar formato real do request e da resposta;
7. decidir se `repsPortalCientifica` é necessário;
8. interromper o plano e registrar a lacuna caso nenhum endpoint oficial forneça o conteúdo.

### Etapa 2 — Contratos, schemas e transporte

1. criar tipos compartilhados;
2. ampliar schemas Zod;
3. criar normalização da listagem;
4. implementar transporte binário limitado;
5. validar MIME, assinatura, tamanho e hash;
6. adicionar fixtures sem dados pessoais nem conteúdo pericial real.

### Etapa 3 — IPC somente leitura

1. resolver a REP pelo `laudoId` no main;
2. implementar listagem e captura;
3. atualizar preload, tipos e canais permitidos;
4. garantir que nenhum método de escrita GDL seja usado;
5. cobrir autenticação, timeout e falhas parciais.

### Etapa 4 — UX no Painel de Ilustrações

1. criar modal;
2. listar metadados sem baixar tudo;
3. selecionar imagens elegíveis;
4. mostrar limites e progresso;
5. incorporar sucessos ao painel;
6. manter upload local e janela pop-out funcionando;
7. não inserir nem salvar automaticamente.

### Etapa 5 — Persistência e exportação

1. inserir uma e várias imagens GDL;
2. salvar e reabrir o laudo;
3. testar modos single e multi;
4. testar reordenação, legenda, exclusão e substituição;
5. verificar preview e exportação;
6. confirmar funcionamento offline após salvar.

### Etapa 6 — Homologação e promoção

1. executar testes automatizados completos;
2. testar REP sem arquivos, com imagem única, múltiplas imagens e anexos mistos;
3. testar limites e falha parcial;
4. comparar metadados e bytes com a origem autorizada;
5. confirmar ausência de escrita no GDL;
6. atualizar specs de estado atual via `/spec` após a implementação;
7. validar produção somente em leitura e com REP autorizada.

## 14. Testes automatizados

### Contrato e serviço

- aceita `anexosEletronicos` e `arquivosAdicionais` válidos;
- rejeita estruturas inválidas sem cast direto;
- normaliza aliases aprovados;
- não expõe `fileId`, hash remoto ou URL ao renderer;
- usa somente hosts e caminhos oficiais;
- preserva bytes binários;
- rejeita arquivo acima dos limites;
- rejeita MIME incompatível e assinatura falsa;
- trata data URI, binário e JSON intermediário conforme fixtures confirmadas;
- calcula SHA-256 e deduplica;
- mantém sucesso parcial quando um download falha.

### IPC

- resolve a REP pelo `laudoId`;
- rejeita laudo inexistente ou sem REP;
- não aceita URL arbitrária;
- revalida os itens selecionados;
- não registra credenciais nem dados sensíveis;
- não chama endpoints POST, PUT, PATCH ou DELETE.

### Renderer

- exibe botão nos painéis inline e pop-out;
- lista sem iniciar downloads completos;
- desabilita arquivos inelegíveis ou acima do limite;
- captura somente os selecionados;
- apresenta progresso e falhas por item;
- converte resultados para `ImagemLaudo`;
- não duplica imagem na mesma sessão;
- mantém upload local inalterado;
- não salva ou insere automaticamente.

### Ciclo do laudo

- insere uma e várias imagens;
- cria a seção `ILUSTRAÇÕES` quando necessário;
- mantém IDs e numeração coerentes;
- salva e reabre com data URIs válidas;
- funciona offline após persistência;
- preserva imagens no preview e na exportação;
- exclusão local não chama o GDL.

## 15. Validação manual

1. abrir laudo ligado a REP autorizada com imagens;
2. comparar lista do laWdo com a resposta oficial da API;
3. capturar uma imagem e depois um lote;
4. conferir miniatura, lightbox, nome e legenda;
5. inserir, reordenar, editar legenda e excluir localmente;
6. salvar, fechar e reabrir;
7. desligar VPN e confirmar a imagem já salva;
8. gerar preview e exportar;
9. testar janela destacada;
10. provocar arquivo incompatível, limite e falha de rede;
11. confirmar nos logs do GDL que ocorreram apenas consultas/downloads.

## 16. Critérios de aceitação

- A busca parte do laudo e resolve automaticamente sua REP.
- Somente a API oficial é usada; não existe scraping ou dependência da sessão do navegador.
- Metadados são exibidos antes de qualquer download completo.
- Apenas imagens selecionadas e compatíveis são capturadas.
- Tamanho, MIME e assinatura binária são validados no processo principal.
- Credenciais e identificadores sensíveis não chegam ao HTML nem aos logs.
- Imagens GDL e locais usam o mesmo `ImagemLaudo` e o mesmo fluxo de inserção.
- O usuário pode revisar, legendar, ordenar, inserir e excluir localmente.
- Nada é salvo ou inserido automaticamente.
- Imagens inseridas sobrevivem à reabertura e funcionam offline.
- Preview e exportação preservam as figuras.
- Falha parcial não perde capturas bem-sucedidas.
- Nenhuma operação escreve no GDL.
- TypeScript, lint e testes permanecem aprovados sem novos warnings.

## 17. Fora do escopo

- scraping ou automação da interface web do GDL;
- uso de cookies ou sessão do navegador;
- upload, alteração ou exclusão de arquivos no GDL;
- sincronização bidirecional;
- importação automática de todas as imagens;
- anexar documentos, vídeos, ZIPs ou outros formatos ao laudo;
- foto funcional do usuário/perito;
- OCR, descrição automática por IA ou geração automática de legenda;
- cache permanente de arquivos GDL não inseridos;
- migração ou reativação da tabela `imagens_laudo` sem decisão arquitetural separada.

## 18. Referências

- `docs/api/API_GDL.txt` — contrato oficial dos endpoints GDL;
- `spec/08 gdl/api_gdl.md` — estado atual da integração GDL;
- `spec/03 laudo/fluxo_ilustracao.md` — contrato e ciclo do Painel de Ilustrações;
- `spec/03 laudo/laudo_ciclo_vida.md` — criação, conteúdo, salvamento e reabertura;
- `spec/03 laudo/exportar_laudo.md` — invariantes de preview e exportação;
- `spec/02 rep/b602/integracao_b602_apiGDL.md` — padrão de fronteira externa, IPC, homologação e promoção;
- `src/main/services/gdl.service.ts` e `gdl.schema.ts` — transporte e validação atuais;
- `src/renderer/components/laudo/IlustracoesPanel.tsx` — painel e `ImagemLaudo`;
- `src/renderer/pages/LaudosPage.tsx` — inserção, persistência e exportação das figuras.
