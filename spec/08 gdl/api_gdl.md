# Integração atual com a API GDL

## Limite e fluxos

A integração usa o GDL como fonte de consulta. Há consulta/importação individual de REP, atualização local de REP existente, fotos para ilustrações e listagem de “Minhas REPs”. O renderer recebe contratos normalizados, incluindo o identificador GDL necessário à listagem, sem JSON bruto, credenciais, URLs de download ou caminhos locais; `gdl.service.ts` controla HTTP, credenciais e normalização. O laWdo não envia alterações locais ao GDL. A atualização da listagem, manual ou automática, consulta somente a grade web `MinhasReps.aspx` e sua paginação. Não abre `REP/Default.aspx?rep_id=...` para cada REP nem aciona o caminho de detalhamento associado ao possível efeito indireto de status. Leitura individual de detalhes é um fluxo separado, não uma etapa da coleta da lista.

## Preferência da listagem de REPs

A página API GDL controla a preferência por instalação, inicialmente desativada. Ativar e desativar usam o botão da preferência, sem confirmação adicional. O Dashboard e REPs → Listar REPs não atualizam a lista quando desligada: exibem somente o snapshot anterior com menos de 30 minutos e oferecem atalho à configuração. Com a opção ativada, o cache mantém a validade de dez minutos para atualização, e a coleta percorre apenas as páginas da grade web. O processo principal bloqueia o canal de atualização quando a preferência está desligada; desligá-la durante uma consulta impede novas páginas e a publicação do resultado parcial, mantendo o snapshot anterior. Requisições já enviadas podem terminar. A preferência continua controlando a consulta remota da grade, embora a listagem atual não abra detalhes individuais.

```text
REPsPage ou LaudosPage → diálogo de revisão → preload → gdl.handlers
  → atualizacao-rep-gdl.service → consulta GDL e adaptador B-602
  → comparação seletiva → transação local de REP, laudo e seções derivadas
```

## Atualização local de REP existente

O fluxo exige número `número/ano` e exame B-602. `gdl:preparar-atualizacao-rep` gera prévia de diferenças; `gdl:aplicar-atualizacao-rep` aceita apenas o identificador efêmero, IDs emitidos pela prévia e a confirmação de reabertura. Valores vazios do GDL não são aplicáveis e o main não aceita valores arbitrários do renderer.

A prévia fica somente em memória por dez minutos e captura `updated_at` da REP e do laudo. Expiração ou alteração concorrente exige nova consulta. A seleção começa marcada e pode ser reduzida pelo usuário.

Peças são correlacionadas por `codPecaGdl`, identificador interno que não é exibido nem constitui sozinho uma diferença. `idLocal`, origem e marcador de alteração local também não participam da comparação. Cada peça alterada mostra tipo, identificação, quantidade de alterações e detalhes recolhíveis por campo, comparando explicitamente o valor local anterior ao valor atual do GDL. Peça existente preserva `idLocal`; peça nova é adicionada e peça local ausente da resposta não é removida.

A escrita ocorre em transação local: atualiza REP, reabre REP e laudo concluído ou entregue quando houver confirmação e reconcilia seções condicionais. A auditoria registra atualização e transição aplicável. Após sucesso, a operação efêmera é descartada, o diálogo fecha e a tela recarrega. O diálogo mostra a orientação genérica de conexão/VPN para qualquer erro de consulta/aplicação, inclusive erros locais; o detalhe técnico é enviado ao logWarning e não exibido. Oferece nova tentativa explícita, sem retry automático.

## Fronteiras e verificação

A API e a página web do GDL são fronteiras não confiáveis e imutáveis pelo aplicativo. 401/403, 404 e respostas inesperadas têm mensagens específicas. `atualizacao-rep-gdl.service.test.ts` cobre comparação seletiva, correlação de peças e encaminhamento do estado anterior ao laudo; `atualizar-rep-gdl-dialog.component.test.tsx` cobre a apresentação local/GDL e o fechamento após sucesso. Rede real, autenticação web e HTML de produção dependem de homologação controlada.

## Ambiente efetivo e configuração

Produção é o ambiente padrão. Homologação só pode ser selecionada quando a preferência local `gdl_homologacao_habilitada` é `true`; `resolverAmbienteGdl()` aplica a mesma regra no renderer e no main, inclusive para consulta individual, listagem, teste de conexão e validação de credenciais. Valor ausente, desconhecido ou homologação desabilitada resolve para Produção. A página API GDL oculta Homologação até sua habilitação e, ao desabilitá-la, seleciona Produção. Credenciais são separadas por ambiente; o carregamento da UI descarta resposta atrasada de um ambiente já trocado. Salvar credenciais, selecionar ambiente e limpar o estado de validação são etapas sequenciais, sem transação única.

`gdl_homologacao_habilitada` pertence às chaves do backup de Configuração; a preferência `gdl_listagem_reps_habilitada` não pertence a essa lista. O backup Completo inclui ambas pelo banco. A preferência de listagem continua desligada por padrão mesmo quando o ambiente é Produção.

## Estado da conexão no header

A fonte canônica é o singleton de `src/main/services/gdl-conexao.service.ts`, configurado por `gdl.service.ts`. O estado de rede e acesso web fica em memória; a inicialização pode reaproveitar a validação de credenciais salva por ambiente em `userData/gdl/validacao-sessao.json`, desde que tenha data válida. Essa validação não tem expiração temporal própria e não comprova autenticação atual. A aparência considera separadamente a idade da observação de rede. A apresentação está em `spec/04 layout/componentes_ui_base.md`.

`src/shared/gdl/conexao.ts` define o schema Zod, os intervalos e a aparência derivada. O snapshot contém ambiente, revisão, rede (desconhecida/acessível/indisponível), credenciais (ausentes/pendentes/validadas/rejeitadas), acesso web (desconhecido/disponível/atenção), datas de rede/validação e andamento da verificação. Identidade da configuração, URL e autorização ficam no main.

Os canais `gdl:obter-estado-conexao` e `gdl:verificar-conexao` exigem sessão local e reconferem o usuário após a operação. O primeiro apenas lê estado; o segundo checa somente rede. O preload expõe `obterEstadoConexao`, `verificarConexao` e `onEstadoConexaoAlterado`, com cleanup do listener. O evento `gdl:estado-conexao-alterado` não transporta snapshot nem dados do Electron: leva o renderer a reler o estado autenticado. Handlers e hook validam o contrato com Zod. Payload inválido não substitui o último estado aceito e gera orientação de nova tentativa na UI. Mudanças exigem coordenação entre contrato, serviço, handlers, allowlist, `IpcAPI` e declaração legada em `src/renderer/index.tsx`.

### Checagem leve e ciclo de vida

A checagem usa exclusivamente `GET /unidadesMedida`, sem Authorization, com timeout de cinco segundos e `cache: no-store`. Funciona sem credenciais e com a listagem de REPs desativada; não consulta REP, não tenta login e não abre detalhes. Respostas 2xx e 4xx, exceto 408, comprovam alcance do servidor, não autorização; redirecionamentos são bloqueados. Transporte, timeout e 5xx indicam indisponibilidade. Um 401 desse endpoint não rejeita credenciais.

`useConexaoGdl` lê o estado ao montar. Com documento visível e janela com foco, agenda a checagem para 60 segundos após a mais recente entre a observação de rede e a última tentativa; uma observação recente evita requisição adicional na entrada ou retorno de foco. Blur e ocultação suspendem o agendamento, e foco/visibilidade recalculam a idade e o prazo. `Verificar agora` força apenas a checagem de rede. Após mais de 120 segundos sem observação, a aparência fica desconhecida/desatualizada, inclusive sem novas respostas do main. Desmontagem remove timers, eventos e assinatura; a identidade do usuário remonta o indicador no header. Requisição já enviada pode terminar.

Verificações simultâneas da mesma revisão compartilham uma Promise no main. Durante nova checagem, a aparência anterior permanece; `verificando` identifica o andamento no painel. Leituras locais e snapshots de lista não renovam evidência de rede. O transporte JSON e o download de fotos também usam `no-store` e registram respostas/falhas reais. O monitor não bloqueia consultas, não altera o agendamento de Minhas REPs e não repete operações de negócio que falharam.

### Autenticação, falhas parciais e concorrência

Operações autenticadas existentes alimentam a evidência da API; uma checagem de rede positiva não apaga autenticação rejeitada nem atenção web. REP inexistente e falha de parsing após resposta recebida não equivalem a queda. O 401 de consulta individual continua sujeito à confirmação por REP anteriormente validada antes de rejeitar credenciais; 403 não rejeita automaticamente a evidência do monitor. Nos fluxos individuais, 403 ainda pode limpar a validação persistida legada sem apagar a evidência positiva em memória, que nesse caso pode não ser reaproveitada na próxima abertura.

`gdl-pagina.service.ts` observa o resultado das leituras web já solicitadas. Falha web gera atenção parcial, preservando rede e credenciais da API; sucesso web limpa essa atenção, mas não valida credenciais da API. Acesso web ainda desconhecido permite aparência positiva quando rede e validação da API a sustentam. A checagem periódica não autentica a sessão web nem elimina o bloqueio temporário próprio desse fluxo.

O contexto usa a identidade efetiva de ambiente e credenciais. Salvar URL, login, senha ou CPF GDL pelo serviço de configuração limpa a validação do ambiente e reinicia o monitor; trocar ambiente ou habilitação de homologação também reinicia a observação. A preferência da listagem não invalida a conexão. Revisão/identidade descartam resultados de contexto anterior; sequências por rede, autenticação e web impedem que observação antiga sobrescreva uma mais recente. O renderer também descarta respostas atrasadas ou de revisão anterior.

Os testes `src/__tests__/main/gdl-conexao*.test.ts`, `src/__tests__/preload/gdl-conexao.test.ts` e `src/__tests__/renderer/conexao-gdl.test.tsx` cobrem estados, timeout, autenticação, falha web, troca de contexto, compartilhamento de checagem, wrappers, cleanup, foco e expiração com respostas simuladas. Não comprovam disponibilidade nem efeitos do GDL real.

## Construção do snapshot de “Minhas REPs”

`gdl-minhas-reps-cache.service.ts` associa o arquivo em `userData/gdl` ao usuário local e ao hash da identidade efetiva do GDL, que inclui ambiente e credenciais. JSON persistido é validado por Zod antes de uso. Consultas da mesma chave compartilham uma promessa; consultas de chaves diferentes entram numa fila global para não trocar a sessão/paginação web durante outra coleta. Sem `forcar`, um snapshot com menos de dez minutos evita rede quando a listagem está habilitada. Com a listagem desligada, Dashboard e modal exibem apenas snapshot com menos de 30 minutos e não iniciam atualização.

A coleta percorre no máximo 500 páginas e verifica número da página, identidade da listagem e repetição de páginas. Paginação inconsistente, estrutura inválida ou limite excedido impedem a publicação e conservam o snapshot anterior. A gravação usa arquivo temporário e renomeação; falha de cache não transforma coleta parcial em lista válida. Desabilitar a preferência incrementa uma versão em memória e impede novas páginas e a publicação do novo snapshot; requisições já enviadas podem terminar.

`gdl-minhas-reps.service.ts` extrai da grade número/ano, identificador GDL do link (sem abri-lo), natureza exibida, status, data/hora de designação, quantidade de fotos e indicador de ofício reiterando. `naturezaExameComCodigo` nasce nula no parser; o catálogo e observações já persistidas podem complementar a apresentação local, sem abertura de detalhes durante a listagem. Esse caminho não usa a consulta JSON individual `/rep/obter`; autentica na interface web, aplica o filtro da grade e percorre sua paginação.

## Falhas de listagem e interface

O handler `gdl:atualizar-minhas-reps-cache` exige sessão e preferência ativa, classifica a falha por etapa/código, registra no log uma referência UUID e devolve ao renderer apenas detalhes limitados e sanitizados. Os códigos distinguem desativação, credenciais, autenticação, rede, timeout, limite do GDL, servidor, sessão, mudança de estrutura, detalhes incompletos, lista inconsistente e cache local; erro desconhecido vira mensagem genérica. O renderer valida esse envelope com Zod antes de mostrar mensagem por categoria e nova tentativa explícita. **Detalhes** expande uma orientação ao usuário, como conferir credenciais; não apresenta o texto técnico retornado nem a referência UUID. A referência permanece no envelope e nos logs para correlação. Snapshot anterior válido continua visível após falha. O Dashboard e o modal sinalizam a preferência desativada e oferecem acesso à página API GDL; abrir uma REP do snapshot ainda inicia a consulta individual permitida.

`gdl-listagem-preferencia.service.test.ts`, `gdl-minhas-reps-cache.service.test.ts`, `gdl-minhas-reps-erro.service.test.ts`, `gdl-config-page.component.test.tsx`, `gdl-minhas-reps-dashboard.test.tsx` e `gdl-minhas-reps-modal.test.tsx` cobrem guardas, cache, classificação e apresentação com respostas simuladas. Os testes usam respostas simuladas e não comprovam efeitos do servidor real. A leitura individual de detalhes, quando solicitada em seu fluxo próprio, permanece sujeita às regras de verificação controlada; não integra a atualização da listagem.

## Limite atual do B-601

A consulta/importação individual possui adaptadores ativos para B-601 e B-602 em `gdl-adaptadores.service.ts`. O B-601 usa normalizador e catálogo próprios, preserva dados não confirmados em `extrasGdl` e não reutiliza a conversão B-602. A consulta geral pode revisar/importar esses dados no formulário local; aplicar a revisão não salva automaticamente a REP. O fluxo específico de atualização seletiva de uma REP já salva (`gdl:preparar-atualizacao-rep`/`gdl:aplicar-atualizacao-rep`) continua restrito ao B-602 e rejeita B-601. Não confundir capacidade de importação com capacidade de atualização seletiva. Cadastro, obrigatoriedades, validação e preservação do JSON B-601 ficam em `spec/02 rep/b601.md`.

## Atualização automática e falhas web

`GdlMinhasRepsDashboard` lê preferência/cache ao montar e, se habilitado, solicita atualização sem forçar; o main evita rede para snapshot com menos de dez minutos. O renderer agenda a próxima atualização forçada pelo vencimento do snapshot, limitada a dez minutos a partir da resposta. Após falha, preserva a lista e espera dez minutos antes de repetir. A guarda em referência impede consultas sobrepostas; o temporizador é removido na desmontagem ou quando a preferência local fica desativada. Resposta de falha `desativada` também desliga esse estado. Retorno de foco apenas relê cache local, sem rede. A expiração visual de 30 minutos continua aplicada com a listagem desligada. O modal de seleção não adota esse agendamento automático.

`gdl-pagina.service.ts` preserva etapa, causa e status HTTP da falha de autenticação web. Após falhar, bloqueia novas tentativas dessa sessão por 60 segundos; respostas durante o bloqueio conservam a causa anterior e informam segundos restantes, sem presumir senha incorreta. Sucesso limpa falha e bloqueio. A classificação percorre até oito causas sem ciclos e distingue transporte, timeout, HTTP, autenticação, estrutura e falha local.

`FalhaListaRepsGdl` aceita etapa e código de sistema de listas fechadas, HTTP entre 100–599 e bloqueio temporário com prazo inteiro de 1–60 segundos, além de código, detalhes e referência. A UI informa o prazo; o bloqueio efetivo pertence ao main. Listas e normalizadores do diagnóstico devem permanecer alinhados conforme `spec/13 diagnostico/diagnostico_assistido.md`.

## Repositório local e aviso de reiteração

`gdl-repositorio.service.ts` mantém `userData/gdl/reps-<hash>.json`, versão 1, separado por usuário local e identidade efetiva GDL. Reúne grade/listagem e observações da API/detalhes por REP; Zod valida leitura/escrita, e a fila por arquivo serializa alterações com temporário e rename. Arquivo ausente permite começar vazio. Leitura tolerante pode devolver vazio diante de corrupção; escrita e leitura de avisos exigem validação e preservam o arquivo inválido. Registros crescem com as REPs observadas, sem expiração/pruning próprio; a lista usa IDs do último snapshot, mas avisos percorrem todos os registros.

`src/shared/gdl/reiteracao.ts` define `AvisoReiteracaoGdl` com número, ano, booleano, fonte e instante da consulta. A grade HTML reconhece imagens com alt/title normalizado exatamente como OFICIO REITERANDO na célula do número. O booleano HTML, inclusive falso, prevalece sobre a API. Sem valor HTML conhecido, uma origem da API desse tipo registra evidência positiva em `reiteracaoApiEm`; consultas posteriores sem essa origem não apagam a evidência. Grade sem o campo conserva o último booleano conhecido. A precedência não depende apenas da data mais recente. O aviso representa evidência local, sem validade temporal própria nem nova consulta ao GDL.

Na consulta individual, `gdl:consultar-rep` verifica número/ano retornados e sessão/identidade antes e depois do registro local; falha de persistência gera log e não impede consulta válida. A obtenção de avisos usa `gdl:obter-avisos-reiteracao`, autenticado e com reconferência de contexto. O preload expõe `obterAvisosReiteracao` e assinatura removível `onAvisosAlterados`. Após gravar o repositório, o main emite `gdl:avisos-alterados` às janelas; salvar configuração `gdl_*` emite o mesmo evento com reinício do estado.

`AvisosReiteracaoProvider` fica na área autenticada de `App.tsx`, remontado pela identidade do usuário local. Busca somente avisos locais na montagem, foco e evento, valida resposta com Zod e descarta respostas atrasadas por revisão/desmontagem. Evento com reinício limpa avisos antes da busca. Falha ou resposta inválida preserva o último estado aceito, salvo limpeza explícita. O conjunto é indexado por número/ano normalizados; o arquivo separa identidades GDL.

`ReiterandoBadge` mostra REITERANDO com tooltip no Dashboard, seleção de REP GDL, listas/formulários de REP e laudo, prévias PDF e wizard. É indicação visual externa ao conteúdo exportado. O Dashboard usa o booleano do snapshot quando presente e recorre ao contexto quando ausente. Alterações exigem coordenação entre parser, repositório, contrato, handlers, preload, provider e consumidores. Testes existentes cobrem parsing da grade e apresentação no Dashboard; eventos/contexto e precedência persistida não têm cobertura dedicada ponta a ponta.

## Cidade do órgão solicitante

`gdl-balistica-normalizador.service.ts` extrai `DadosSolicitacaoGdl.cidade?` junto do órgão para os adaptadores B-601/B-602. Se o órgão veio da primeira origem, usa a cidade dessa mesma origem; somente quando o órgão vem da raiz usa a cidade da raiz. Sem órgão ou cidade reconhecida, omite o campo. Não combina órgão de uma fonte com cidade de outra e não deriva esse valor do local de ocorrência.

O metadado acompanha `integracaoGdl.dadosSolicitacao` e o schema de reidratação aceita a string opcional, preservando compatibilidade com REPs antigas. A resolução dos quadros de investigação mostra **órgão / cidade** com escape HTML, sem alterar o nome do solicitante persistido. Não há nova consulta remota ao pré-visualizar/exportar. `gdl-b601-normalizador.service.test.ts`, `gdl-b602-normalizador.service.test.ts`, `integracao-gdl-b602.utils.test.ts` e `rep-b602-persistencia.integration.test.ts` protegem extração, contrato e persistência com dados simulados.

## Referências de coleta no mesmo caso

gdl:consultar-reps-mesmo-caso recebe somente laudoId e exige sessão local. O main resolve a REP vinculada, confirma seu número/ano pela identificação GDL e usa repsInvestigacaoPolicial/listarReps por POST como consulta de leitura, com CPF configurado de 11 dígitos, autenticação e timeout de 15 segundos por página. Primeiro confirma um único caso contendo a REP; depois lista somente referências M110/T002 desse caso, sem abrir detalhes de cada resultado e sem alterar seu status. Não é o fluxo de atualização seletiva B-602 nem a listagem Minhas REPs.

gdl-reps-mesmo-caso.service.ts percorre páginas de dez registros, até cem por consulta, valida total estável, páginas não repetidas, completude e número das referências. Casos ambíguos, número inválido ou naturezas divergentes para a mesma referência abortam; a deduplicação usa número/ano. O contrato Zod shared/gdl/reps-mesmo-caso.ts contém ambiente, identificação da REP, caso, data e referências. Main e renderer validam o retorno.

Chamadas do mesmo webContents, usuário, identidade GDL e laudo compartilham Promise no handler. Antes da escrita local, revalida sessão, configuração e vínculo. repService.salvarReferenciasMesmoCaso grava integracaoGdl.repsMesmoCaso preservando o JSON restante, com compare-and-swap e até três tentativas; edição concorrente persistente pede nova consulta. O snapshot não tem TTL próprio: seu uso confere identificação e ambiente, e nova sessão de edição pode renová-lo. Erro não apaga o snapshot anterior. A consulta independe da preferência Minhas REPs e não cria operações de escrita no GDL.

gdl-reps-mesmo-caso.service.test.ts, gdl-reps-mesmo-caso.handlers.test.ts e base-rep.service.test.ts cobrem paginação, identidade e gravação concorrente com respostas simuladas. A aplicação das sugestões e as escolhas manuais estão em spec/03 laudo/b601.md.

## Fotos, duplicatas e cache local

Abrir sessão de fotos baixa a Lista de Fotos como ZIP temporário e calcula SHA-256 durante o streaming. A sessão serve listagem, miniaturas e captura do mesmo arquivo. Na abertura, o handler reúne hashes de todos os registros persistidos do laudo; se essa leitura falhar, prossegue com aviso de verificação incompleta. Fotos reconhecidas por hash já presente são retiradas da lista retornada e contabilizadas em fotosJaIncluidas. A seleção inicial inclui imagens prováveis sem status impeditivo; ausência de seleção ou lista composta só por fotos já incluídas tem apresentação própria no modal.

gdl-fotos-cache.service.ts persiste somente pares de ID de seleção/hash em userData/gdl/cache-fotos. A chave combina ambiente, número/ano, hash do ZIP e versão de processamento original-local-v1. Leitura rejeita entrada acima de 1 MiB e filtra hashes inválidos; cache inválido vira vazio. Salva por temporário/renomeação e retém vinte arquivos mais recentes; falha de cache não impede captura. Cache não contém fotos e não elimina novo download do ZIP. Verificação de duplicatas percorre fotos sequencialmente, usa SHA-256 dos bytes originais e compara também a antiga otimização JPEG de 1600 px/qualidade 82 para compatibilidade. Publica progresso a cada cinco e cede ao event loop por foto; custo acompanha o ZIP e as imagens ainda não reconhecidas.

Falha individual na verificação conserva a foto elegível e retorna aviso. A captura mantém validação das entradas ZIP, detecção de MIME, deduplicação do lote e resultado parcial com imagens, duplicadas e falhas. O handler compara hashes da fila persistida e estagia as novas imagens em memória, sem gravar fotos apenas selecionadas. Esse caminho passa registrarCache=false: selecionar/capturar não deve marcar estágio como imagem já incluída persistida. Inserir no editor promove bytes originais ao arquivo local e gera prévia separada; fechamento descarta estágio e limpa temporárias sem referência salva. O ciclo completo e seus limites estão em spec/03 laudo/fluxo_ilustracao.md.

gdl.service.test.ts e gdl-imagens-rep-modal.component.test.tsx cobrem cache, duplicatas, seleção e resultados simulados; disponibilidade ou efeitos do servidor real não são inferidos desses testes. O cache de fotos não compartilha identidade, validade ou finalidade com o snapshot de Minhas REPs.
