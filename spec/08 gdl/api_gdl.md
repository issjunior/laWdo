# Integração atual com a API GDL

## Limite e fluxos

A integração usa o GDL como fonte de consulta. Há consulta/importação individual de REP, atualização local de REP existente, fotos para ilustrações e listagem de “Minhas REPs”. O renderer não recebe JSON bruto, credenciais, URLs de download, caminhos locais nem identificadores remotos; `gdl.service.ts` controla HTTP, credenciais e normalização. O laWdo não envia alterações locais ao GDL. Exceção temporária: a listagem ativada abre detalhes das REPs e pode marcá-las como “Laudo em Execução” no GDL, mesmo sem chamada explícita de alteração de status. Essa exceção não se estende à consulta individual.

## Preferência da listagem de REPs

A página API GDL controla a preferência por instalação, inicialmente desativada. Ativar e desativar usam o botão da preferência, sem confirmação adicional. O possível efeito indireto no status continua restrito à listagem ativada. O Dashboard e REPs → Listar REPs não atualizam a lista quando desligada: exibem somente o snapshot anterior com menos de 30 minutos e oferecem atalho à configuração. Com a opção ativada, o cache mantém a validade de dez minutos para atualização, e a lista segue consultando páginas e detalhes. O processo principal bloqueia o canal de atualização quando a preferência está desligada; desligá-la durante uma consulta impede novas páginas/detalhes e descarta o resultado parcial, mantendo o snapshot anterior. Requisições já enviadas podem terminar. Quando existir endpoint de listagem comprovadamente sem esse efeito, revisar a consulta automática de detalhes e retirar a exceção.

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

## Ambiente efetivo e configuração

Produção é o ambiente padrão. Homologação só pode ser selecionada quando a preferência local `gdl_homologacao_habilitada` é `true`; `resolverAmbienteGdl()` aplica a mesma regra no renderer e no main, inclusive para consulta individual, listagem, teste de conexão e validação de credenciais. Valor ausente, desconhecido ou homologação desabilitada resolve para Produção. A página API GDL oculta Homologação até sua habilitação e, ao desabilitá-la, seleciona Produção. Credenciais são separadas por ambiente; o carregamento da UI descarta resposta atrasada de um ambiente já trocado. Salvar credenciais, selecionar ambiente e limpar o estado de validação são etapas sequenciais, sem transação única.

`gdl_homologacao_habilitada` pertence às chaves do backup de Configuração; a preferência `gdl_listagem_reps_habilitada` não pertence a essa lista. O backup Completo inclui ambas pelo banco. A preferência de listagem continua desligada por padrão mesmo quando o ambiente é Produção.

## Construção do snapshot de “Minhas REPs”

`gdl-minhas-reps-cache.service.ts` associa o arquivo em `userData/gdl` ao usuário local e ao hash da identidade efetiva do GDL, que inclui ambiente e credenciais. JSON persistido é validado por Zod antes de uso. Consultas da mesma chave compartilham uma promessa; consultas de chaves diferentes entram numa fila global para não trocar a sessão/paginação web durante outra coleta. Sem `forcar`, um snapshot com menos de dez minutos evita rede quando a listagem está habilitada. Com a listagem desligada, Dashboard e modal exibem apenas snapshot com menos de 30 minutos e não iniciam atualização.

A coleta percorre no máximo 500 páginas, verifica número, identidade da listagem e repetição de páginas e, depois, abre os detalhes para obter os códigos de exame. Se faltar detalhe, o número de códigos divergir ou a paginação mudar, descarta o resultado inteiro e conserva o snapshot anterior. A gravação usa arquivo temporário e renomeação; falha de cache não transforma a coleta parcial em lista válida. Desabilitar a preferência incrementa uma versão em memória, interrompe os detalhes pendentes e impede novas páginas, detalhes e a publicação do novo snapshot; requisições já enviadas podem terminar. Essa leitura de detalhes é a exceção com possível efeito indireto de status no GDL.

## Falhas de listagem e interface

O handler `gdl:atualizar-minhas-reps-cache` exige sessão e preferência ativa, classifica a falha por etapa/código, registra no log uma referência UUID e devolve ao renderer apenas detalhes limitados e sanitizados. Os códigos distinguem desativação, credenciais, autenticação, rede, timeout, limite do GDL, servidor, sessão, mudança de estrutura, detalhes incompletos, lista inconsistente e cache local; erro desconhecido vira mensagem genérica. O renderer valida esse envelope com Zod antes de mostrar mensagem por categoria e nova tentativa explícita. **Detalhes** expande uma orientação ao usuário, como conferir credenciais; não apresenta o texto técnico retornado nem a referência UUID. A referência permanece no envelope e nos logs para correlação. Snapshot anterior válido continua visível após falha. O Dashboard e o modal sinalizam a preferência desativada e oferecem acesso à página API GDL; abrir uma REP do snapshot ainda inicia a consulta individual permitida.

`gdl-listagem-preferencia.service.test.ts`, `gdl-minhas-reps-cache.service.test.ts`, `gdl-minhas-reps-erro.service.test.ts`, `gdl-config-page.component.test.tsx`, `gdl-minhas-reps-dashboard.test.tsx` e `gdl-minhas-reps-modal.test.tsx` cobrem guardas, cache, classificação e apresentação com respostas simuladas. O efeito real da abertura de detalhes no GDL permanece dependente de verificação controlada.

## Limite atual do B-601

O cadastro local B-601 usa catálogo próprio conferido na interface do GDL. Esta implementação não acrescenta adaptador de conversão automática de peças B-601 à consulta ou à atualização remota descrita acima. O reconhecimento da natureza B601 pelo catálogo geral não comprova compatibilidade dos dados personalizados. O cadastro, as obrigatoriedades e a preservação do JSON ficam em spec/02 rep/b601.md.

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
