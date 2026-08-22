# Plano B602 — consumo da API GDL em produção

## 1. Objetivo e limites

Adaptar a integração B602 existente para consumir o GDL de produção, mantendo o fluxo somente de leitura e adotando produção como fonte canônica dos tipos, campos, opções e códigos.

### 1.1 Invariante absoluta — GDL somente leitura

O laWdo é exclusivamente consumidor de informações do GDL. A integração existe para consultar dados e agilizar o preenchimento do laudo; não é uma sincronização bidirecional e não administra o ciclo de vida da REP.

O laWdo **NÃO** pode, em homologação ou produção:

- criar REP, peça, foto, anexo ou qualquer outro registro no GDL;
- editar ou sobrescrever dados existentes no GDL;
- excluir registros ou arquivos do GDL;
- alterar situação, etapa ou status da REP, incluindo concluir, reabrir, cancelar, devolver, liberar ou movimentar a REP;
- acionar endpoint, formulário, automação de navegador ou efeito colateral que produza qualquer mutação no GDL.

As únicas operações permitidas são autenticação necessária à leitura, teste de conectividade, consultas de API e download de informações ou fotos. A classificação como leitura depende do efeito real da operação, não apenas do verbo HTTP: um endpoint que cause alteração é proibido mesmo que utilize `GET`, e um endpoint de consulta que utilize outro verbo só poderá ser consumido após comprovação de que não produz efeitos no GDL.

Depois da importação, o usuário pode complementar ou editar a cópia local no laWdo. Essas alterações pertencem somente ao banco e aos arquivos locais do laWdo e nunca são enviadas, sincronizadas ou refletidas no GDL.

Nenhum service, handler IPC, método de preload, botão ou ação de interface deverá representar operações de escrita no GDL. Qualquer necessidade futura de alterar o GDL estará fora deste contrato e não poderá ser implementada como extensão desta integração.

O escopo compreende:

- dados gerais da REP necessários ao formulário B602;
- seção **Peças**;
- campos comuns e personalizados dos 19 tipos encontrados em produção;
- normalização, revisão, importação e persistência local no laWdo;
- fase futura obrigatória para consulta, seleção e captura da **Lista de Fotos da REP**;
- compatibilidade de leitura com dados anteriormente importados da homologação.

Ficam fora do escopo:

- vídeos e anexos eletrônicos que não pertençam à Lista de Fotos da REP;
- criação, edição, exclusão ou conclusão de informações no GDL;
- alteração de qualquer REP;
- importação genérica de outras seções do GDL;
- migração destrutiva dos registros locais existentes.

A primeira entrega técnica poderá abranger somente os dados estruturados e as Peças. As fotos constituem a segunda fase deste mesmo plano e são obrigatórias antes de considerar a integração de produção concluída.

Durante a validação inicial, somente a REP `109.026/2026` poderá ser consultada. Ela permanecerá aberta e não será salva, atualizada ou concluída no GDL.

## 2. Estratégia de ambientes e segurança

### 2.1 Separação de homologação e produção

Manter separados:

- URL base;
- credenciais;
- sessão e cookies;
- identificação do ambiente nos metadados da consulta;
- logs sem dados sensíveis;
- adaptadores de entrada.

Produção será o contrato canônico usado pelo renderer e pela persistência. A homologação será tratada como fonte legada:

1. o main process recebe a resposta externa;
2. identifica o ambiente;
3. converte códigos e nomes legados para os valores canônicos de produção;
4. entrega ao renderer uma única estrutura interna;
5. o renderer não alterna catálogos conforme o ambiente.

Componentes de formulário, revisão e persistência existentes devem ser reutilizados. Não criar uma segunda implementação do formulário B602.

As telas de consulta e revisão devem mostrar de forma inequívoca:

- ambiente ativo;
- número da REP consultada;
- aviso visual destacado quando o ambiente for **Produção**.

### 2.2 Trava temporária da REP autorizada

Adicionar uma guarda central no serviço GDL que, em produção:

- normalize formatos equivalentes de `109.026/2026`;
- permita exclusivamente esse número durante a validação;
- rejeite qualquer outro número antes de consultar credenciais, abrir sessão ou emitir HTTP;
- produza mensagem explícita, sem tentar localizar ou visualizar a REP rejeitada.

A guarda deve abranger qualquer caminho interno capaz de resolver uma REP, incluindo a listagem e a captura das fotos.

Após validação funcional e autorização expressa do responsável, remover a restrição em commit separado. A remoção não poderá ampliar o contrato para operações de escrita.

### 2.3 TLS

Remover todas as ocorrências de `rejectUnauthorized: false`, inclusive nas rotas auxiliares de download.

Regras:

- usar a verificação TLS padrão do Node.js;
- falhar de forma fechada diante de certificado inválido;
- nunca usar `NODE_TLS_REJECT_UNAUTHORIZED=0`;
- não implementar fallback automático inseguro;
- se a cadeia interna não for reconhecida, tratar a instalação da CA institucional no Windows como pré-requisito operacional, fora da lógica da aplicação.

## 3. Contrato canônico de produção

### 3.1 Campos comuns de Peças

Representar os seguintes campos encontrados em produção:

| Campo GDL | Tratamento no laWdo |
|---|---|
| Tipo do Item | Obrigatório; identifica o schema personalizado |
| Identificação | Texto, até 100 caracteres |
| Nº Análises | Receber e validar na fronteira, mas continuar intencionalmente excluído da UI e persistência B602 |
| Quantidade | Obrigatório; aceitar decimal com ponto conforme GDL |
| Medida | Obrigatório; catálogo canônico de produção |
| Quant. Descrição | Texto, até 100 caracteres |
| Examinado In Loco | Booleano |
| Data de Entrada | Obrigatória |
| Lacre Entrada | Texto, até 100 caracteres |
| Lacre Saída | Texto, até 100 caracteres |
| Data de Liberação | Data opcional |
| Código do Vestígio | Texto, até 20 caracteres |
| Consumido/Liberado no Exame? | `S`, `N` ou `P` |
| Observação | Texto livre |

Catálogo de medidas:

- `1` — HECTARE
- `2` — m2
- `3` — GRAMAS(g)
- `5` — MILILITROS(ml)
- `6` — QUILOGRAMAS(Kg)
- `8` — UNIDADES
- `10` — PORÇÃO
- `11` — AMOSTRA

### 3.2 Tipos de item canônicos

O catálogo de produção deverá conter exatamente:

| Código | Tipo |
|---:|---|
| 289 | ARMA(S) DE CHOQUE |
| 613 | ARMA(S) DE PRESSÃO |
| 476 | CARABINA(S) |
| 272 | CARREGADOR(ES) |
| 17 | CARTUCHO(S) |
| 472 | ESPINGARDA(S) |
| 473 | ESPOLETA(S) |
| 101 | ESTOJO(S) |
| 477 | FUZIL(IS) |
| 475 | GARRUCHA(S) |
| 714 | JET LOADER |
| 480 | METRALHADORA(S) |
| 178 | OUTROS |
| 104 | PISTOLA(S) |
| 478 | PISTOLETE(S) |
| 572 | PÓLVORA |
| 105 | PROJÉTEIS |
| 106 | REVÓLVER(ES) |
| 479 | SUBMETRALHADORA(S) |

O tipo de homologação `771 — PEÇA TESTE` não poderá aparecer no catálogo canônico de produção.

### 3.3 Matriz de campos personalizados

| Tipos | Campos |
|---|---|
| 289 e 613 | Nº Série, Marca, Modelo |
| 272, 473, 714, 478 e 572 | Sem campos personalizados |
| 17 | Marca de Cartucho; Calibre Nominal Cartucho |
| 101 e 105 | Origem/Coleta |
| 178 | Resultado PSA |
| 480 | Nº Série, Marca, Modelo, Marca da Arma, Tipo Acabamento, Estado Geral, Funcionamento, Fabricação, Arma Institucional |
| 476, 477, 475 e 479 | Nº Série, Marca, Modelo, Capacidade, Marca da Arma, Status do Número de Série, Tipo Acabamento, Estado Geral, Funcionamento, Fabricação, Arma Institucional |
| 472 | Campos do grupo anterior mais Calibre Nominal Espingarda |
| 104 | Nº Série, Marca, Modelo, Capacidade, Marca da Arma, Status do Número de Série, Calibre Nominal Pistola, Tipo Acabamento, Estado Geral, Funcionamento, Fabricação, Arma Institucional |
| 106 | Nº Série, Marca, Modelo, Marca da Arma, Status do Número de Série, Calibre Nominal Revólver, Tipo Acabamento, Estado Geral, Funcionamento, Fabricação, Tambor, Arma Institucional |

Obrigatoriedade confirmada visualmente em produção:

- `Funcionamento` para tipos de arma que exibem esse campo;
- `Arma Institucional` para esses mesmos tipos;
- `Origem/Coleta` para ESTOJO e PROJÉTEIS.

Os demais campos personalizados permanecem opcionais, salvo se o payload real da API demonstrar regra adicional.

### 3.4 Catálogos personalizados

Implementar os catálogos de produção capturados:

- Status do Número de Série: 5 opções;
- Tipo Acabamento: 5 opções;
- Estado Geral: 3 opções;
- Funcionamento: 3 opções;
- Arma Institucional: 3 opções;
- Fabricação: 20 opções;
- Calibre de Espingarda: 8 opções;
- Calibre de Pistola: 7 opções;
- Calibre de Revólver: 6 opções;
- Marca de Cartucho: 9 opções;
- Calibre de Cartucho: 21 opções;
- Resultado PSA: `NEGATIVO=1473`, `POSITIVO=1472`, `POSITIVO FRACO=1475`;
- Tambor: direita `72`, esquerda `73`;
- Origem/Coleta: DELEGACIA `95`, HOSPITAL `1471`, LOCAL DE CRIME `93`, NECRÓPSIA `94`, Outro `11`.

O catálogo **Marca da Arma** deve ser substituído pela lista canônica de produção, com 1.371 opções persistíveis. Requisitos:

- preservar códigos distintos mesmo quando o rótulo for duplicado;
- corrigir diferenças de codificação de caracteres observadas na homologação;
- não reutilizar códigos da homologação apenas porque o texto coincide;
- normalizar rótulos legados na fronteira;
- preservar o valor bruto em `extrasGdl` quando uma conversão não puder ser feita sem perda.

### 3.5 Metadados de verificação

Substituir o sinal genérico de round-trip por metadados explícitos:

- `schemaVisualConfirmadoProducao`;
- `roundTripApiConfirmadoProducao`;
- data da verificação;
- REP autorizada usada na confirmação, registrada apenas em documentação de teste, não em fixture distribuída.

Todos os 19 schemas podem ser marcados como visualmente confirmados. Somente tipos efetivamente presentes no payload da REP autorizada podem ser marcados como confirmados via API. Não inferir round-trip dos demais tipos.

## 4. Consulta, normalização e persistência

### 4.1 Captura controlada da resposta real

Depois da trava da REP e da correção TLS:

1. consultar `109.026/2026` pelo fluxo IPC existente;
2. capturar somente a resposta necessária para validar o normalizador;
3. não registrar resposta bruta em log;
4. gerar fixture anonimizada;
5. remover nomes, documentos, identificadores, lacres, números de série, observações e demais valores reais;
6. manter apenas a estrutura e valores sintéticos representativos.

Nenhum payload real não anonimizado deverá ser versionado.

### 4.2 Normalizador

Atualizar a fronteira externa para:

- aceitar resposta como `unknown`;
- validar com Zod antes do acesso;
- reconhecer campos por código e por rótulo normalizado;
- traduzir códigos de homologação para valores canônicos de produção;
- manter propriedades desconhecidas em `extrasGdl`;
- excluir intencionalmente `Nº Análises`;
- emitir avisos de normalização sem interromper toda a importação quando apenas um campo opcional for desconhecido;
- rejeitar estruturas fundamentais inválidas.

Para `incinerado`:

- se existir no payload de produção, preservar como compatibilidade de API/legado, sem criar campo visual não existente no formulário de produção;
- se não existir, manter apenas compatibilidade de leitura com registros antigos;
- não considerá-lo campo canônico visual de ESTOJO.

### 4.3 Persistência local

Continuar persistindo as peças em `campos_especificos.b602.pecas`, sem migration de banco, pois o conteúdo é JSON.

Regras:

- persistir somente valores canônicos de produção;
- manter `ultimaConsulta.ambiente`;
- normalizar registros antigos ao carregá-los;
- não reescrever em lote registros legados;
- salvar a forma canônica apenas na próxima alteração legítima do laudo;
- preservar campos manuais durante reconsulta conforme a estratégia existente de mesclar/substituir;
- nunca salvar automaticamente o laudo depois da consulta;
- nunca enviar alterações de volta ao GDL.

Não adicionar canal IPC de escrita no GDL.

### 4.4 Fase futura obrigatória — Lista de Fotos da REP

Reutilizar o fluxo existente de imagens do GDL, sem criar uma segunda implementação:

1. o laudo fornece seu identificador pelo IPC;
2. o main process resolve a REP vinculada ao laudo;
3. a guarda de produção confirma que se trata de `109.026/2026`;
4. o serviço consulta a identificação da REP e obtém seu `codRep`;
5. o serviço baixa a Lista de Fotos pela sessão e pelas credenciais do ambiente ativo;
6. o main process valida e interpreta o ZIP;
7. o renderer recebe somente metadados e miniaturas para seleção;
8. apenas as fotos selecionadas são capturadas e persistidas no acervo do laudo;
9. a imagem permanece disponível no painel de ilustrações para legenda, ordenação e inserção no editor.

Escopo funcional da fase:

- considerar somente a galeria **Lista de Fotos da REP**;
- ignorar vídeos e anexos eletrônicos externos à galeria;
- exibir ambiente ativo e número da REP no modal de seleção;
- exigir ação explícita do usuário para selecionar e capturar fotos;
- permitir falha parcial: uma imagem inválida não deve cancelar as demais capturas válidas;
- manter nome original sanitizado, MIME detectado pelo conteúdo, tamanho, origem `gdl` e hash SHA-256;
- deduplicar por SHA-256 tanto dentro da captura atual quanto contra imagens GDL já persistidas no laudo;
- persistir pelo serviço de imagens existente, fora do banco em arquivos controlados e com os metadados já usados pelo painel;
- reutilizar o fluxo existente de backup e restauração das imagens do laudo;
- não criar vínculo automático entre foto e peça quando o GDL não fornecer um identificador estável para essa relação;
- nunca alterar, excluir ou marcar arquivos no GDL.

Requisitos de segurança e resiliência:

- aplicar a validação TLS padrão também ao download da Lista de Fotos;
- validar status HTTP, assinatura ZIP, diretório central, entradas ZIP64 e limites de deslocamento antes da leitura;
- usar somente o nome-base sanitizado, sem extrair caminhos fornecidos pelo ZIP;
- rejeitar entradas criptografadas, métodos de compactação não suportados, arquivos vazios e conteúdo cujo MIME real não seja de imagem aceita;
- definir limites explícitos e testados para tamanho total do download, número de entradas, tamanho descompactado por imagem e razão de compactação, evitando consumo excessivo de memória e ZIP bomb;
- gerar miniaturas no main process e não enviar o ZIP bruto ao renderer;
- não registrar bytes, Data URI, miniaturas ou conteúdo das imagens em logs;
- liberar buffers e Data URIs temporários após captura ou fechamento do modal;
- preservar as imagens já importadas quando uma nova consulta ou captura falhar.

Os limites numéricos devem adotar os menores valores que comportem a Lista de Fotos real da REP autorizada com margem operacional documentada. Eles deverão ser definidos a partir da medição dessa REP, sem versionar nomes ou imagens reais.

A fase será considerada validada somente após listar, pré-visualizar, capturar, persistir, reabrir e inserir no editor ao menos uma foto da REP autorizada, sem qualquer mudança no GDL.

## 5. Interface e comportamento

Reutilizar `GdlConsultaModal`, `GdlPecasModal`, `GdlImagensRepModal`, `IlustracoesPanel` e o formulário dinâmico B602.

A interface deverá:

- identificar claramente **Produção** ou **Homologação**;
- mostrar a REP alvo antes da consulta;
- exigir confirmação consciente para consultar produção;
- exibir peças normalizadas antes da importação;
- destacar campos desconhecidos ou parcialmente convertidos;
- manter as opções de mesclar/substituir já suportadas;
- não consultar automaticamente outra REP;
- não oferecer botões que alterem, salvem ou concluam a REP no GDL;
- manter o formulário local editável mesmo para tipos apenas confirmados visualmente;
- na fase de fotos, mostrar miniaturas e o estado de elegibilidade de cada entrada antes da captura;
- informar separadamente capturas bem-sucedidas, duplicadas e falhas.

## 6. Sequência de implementação

**Fase 1 — dados estruturados e Peças**

1. Adicionar a trava temporária da REP de produção e seus testes.
2. Corrigir a validação TLS e garantir falha fechada em todos os caminhos GDL.
3. Capturar e anonimizar o payload estruturado autorizado.
4. Introduzir o catálogo canônico de produção com 19 tipos.
5. Atualizar schemas, campos e opções personalizados.
6. Criar o adaptador de compatibilidade da homologação.
7. Atualizar normalizador e metadados de confirmação.
8. Ajustar revisão, badges de ambiente e mensagens de erro.
9. Validar persistência e reabertura de registros novos e legados.
10. Realizar smoke test dos dados estruturados no Windows/VPN somente com `109.026/2026`.

**Fase 2 — fotos**

11. Auditar e endurecer o fluxo existente de download e interpretação do ZIP.
12. Definir e testar os limites de download e descompactação a partir da REP autorizada.
13. Aplicar ambiente, identificação da REP e mensagens de segurança ao modal de fotos.
14. Validar listagem, miniaturas, seleção, falhas parciais e deduplicação.
15. Validar persistência, reabertura, backup, restauração e inserção das fotos no editor.
16. Realizar smoke test das fotos no Windows/VPN somente com `109.026/2026`.

**Liberação**

17. Obter aprovação expressa das duas fases.
18. Remover a trava temporária em commit separado, sem adicionar operações de escrita.
19. Atualizar as specs de estado atual de REP/GDL somente depois da implementação e da aprovação pelo fluxo `/spec`.

## 7. Testes e critérios de aceitação

### Testes automatizados

- catálogo contém exatamente os 19 tipos de produção;
- código 771 não aparece em produção;
- cada tipo expõe exatamente seus campos personalizados;
- obrigatoriedade coincide com o formulário capturado;
- catálogos preservam códigos de produção;
- catálogo de marcas possui 1.371 opções persistíveis;
- rótulos duplicados não eliminam códigos distintos;
- caracteres corrompidos da homologação são normalizados;
- resposta de homologação resulta no mesmo modelo canônico;
- `Nº Análises` é descartado;
- desconhecidos vão para `extrasGdl`;
- fixture não contém `109.026/2026` nem valores pessoais/reais;
- qualquer outra REP em produção é bloqueada antes do HTTP;
- homologação não é afetada pela trava;
- certificado inválido encerra a consulta;
- nenhuma opção desabilita a validação TLS;
- consulta não salva automaticamente o laudo;
- não existe chamada de escrita para o GDL;
- services, handlers IPC, preload e renderer não expõem criação, edição, exclusão ou mudança de status no GDL;
- testes de contrato comprovam que os fluxos de consulta e fotos não acionam endpoints com efeitos de mutação;
- alterações feitas pelo usuário na cópia local não geram requisição de sincronização com o GDL;
- importação, reabertura e edição preservam os dados canônicos;
- registros legados continuam legíveis;
- listagem e captura de fotos também rejeitam qualquer REP diferente da autorizada antes do download;
- ZIP inválido, truncado, ZIP64 inconsistente ou acima dos limites é rejeitado;
- caminhos internos do ZIP não controlam o destino local;
- conteúdo com extensão de imagem e MIME incompatível é rejeitado;
- vídeos, anexos e métodos de compactação não suportados ficam inelegíveis;
- miniaturas são geradas sem expor o ZIP bruto ao renderer;
- seleção vazia não inicia captura;
- falha de uma foto não impede a captura das demais;
- duplicatas no lote e no laudo são detectadas por SHA-256;
- fotos capturadas mantêm origem `gdl`, nome sanitizado, hash e sequência;
- reabertura, backup e restauração preservam arquivos e metadados das fotos;
- falha de rede ou captura não remove imagens já persistidas;
- logs não contêm ZIP, bytes ou Data URI.

### Validação manual

Na REP autorizada:

- abrir somente `109.026/2026`;
- confirmar ambiente e número na interface;
- consultar dados gerais e Peças;
- revisar o tipo efetivamente existente;
- importar para um laudo de teste;
- fechar e reabrir o laudo;
- confirmar persistência e ausência de alteração no GDL;
- na fase futura, abrir a Lista de Fotos pelo laudo vinculado à mesma REP;
- conferir ambiente, REP, miniaturas e entradas inelegíveis;
- selecionar um subconjunto de fotos, capturar e confirmar as falhas parciais quando aplicável;
- reabrir o laudo, editar legenda, ordenar e inserir uma foto no editor;
- confirmar que uma nova captura da mesma foto é tratada como duplicada;
- incluir as imagens em um backup de teste e validar sua restauração;
- não clicar em salvar, incluir, excluir ou concluir no GDL;
- registrar quais tipos tiveram round-trip real.

### Verificações do projeto

Executar:

- `npm run type-check`;
- `npm run lint`;
- `npm test`;
- `npm run test:coverage`;
- `npm run build`;
- `npm run pack`;
- smoke test no Windows conectado à rede/VPN institucional.

## 8. Condições de conclusão

A integração estará pronta para liberação quando:

- produção estiver claramente separada da homologação;
- TLS estiver seguro;
- o catálogo canônico refletir os 19 tipos capturados;
- a REP autorizada puder ser consultada e importada sem qualquer escrita no GDL;
- uma inspeção dos serviços, canais IPC e ações da interface confirmar que a integração externa é integralmente somente leitura;
- a Lista de Fotos da REP autorizada puder ser consultada e as fotos selecionadas puderem ser incorporadas ao laudo;
- limites de ZIP e imagem estiverem definidos, testados e documentados;
- deduplicação, persistência, reabertura, backup e restauração das fotos estiverem validados;
- dados legados de homologação continuarem utilizáveis;
- testes automatizados e smoke test passarem;
- a fixture estiver anonimizada;
- o responsável confirmar que a REP permaneceu inalterada e não concluída;
- a remoção da trava temporária for autorizada explicitamente.

## 9. Premissas fixadas

- GDL de produção é a fonte de verdade.
- A integração com o GDL permanece integralmente somente de leitura; alterações locais no laWdo nunca retornam ao GDL.
- `Nº Análises` continua excluído por decisão funcional.
- Produção define o contrato persistido; homologação é compatibilidade legada.
- Não haverá migration SQL.
- Fotos podem ser implementadas depois de Peças, mas pertencem ao escopo obrigatório desta integração.
- Somente a Lista de Fotos será consumida; vídeos e outros anexos permanecem fora do escopo.
- As fotos serão vinculadas ao laudo pelo acervo de ilustrações existente; vínculo automático com uma peça só será implementado se a API fornecer relação estável e verificável.
- Não serão inventados schemas de API para tipos ausentes da resposta autorizada.
- Não serão versionados dados reais da REP.
- A trava de `109.026/2026` é temporária e sua retirada exige aprovação após as fases de Peças e fotos.
