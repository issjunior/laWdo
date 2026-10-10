# Integração atual com a API GDL

## Limite e fluxos

A integração usa o GDL como fonte de consulta. Há consulta/importação individual de REP, atualização local de REP existente, fotos para ilustrações e listagem de “Minhas REPs”. O renderer não recebe JSON bruto, credenciais, URLs de download, caminhos locais nem identificadores remotos; `gdl.service.ts` controla HTTP, credenciais e normalização. O laWdo não envia alterações locais ao GDL. Exceção temporária: a listagem ativada abre detalhes das REPs e pode marcá-las como “Laudo em Execução” no GDL, mesmo sem chamada explícita de alteração de status. Essa exceção não se estende à consulta individual.

## Preferência da listagem de REPs

A página API GDL controla a preferência por instalação, inicialmente desativada. Ativar exige confirmação sobre o possível efeito no status; desativar é imediato. O Dashboard e REPs → Listar REPs não atualizam a lista quando desligada: exibem somente o snapshot anterior com menos de 30 minutos e oferecem atalho à configuração. Com a opção ativada, o cache mantém a validade de dez minutos para atualização, e a lista segue consultando páginas e detalhes. O processo principal bloqueia o canal de atualização quando a preferência está desligada; desligá-la durante uma consulta impede novas páginas/detalhes e descarta o resultado parcial, mantendo o snapshot anterior. Requisições já enviadas podem terminar. Quando existir endpoint de listagem comprovadamente sem esse efeito, revisar a consulta automática de detalhes e retirar a exceção.

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

O handler `gdl:atualizar-minhas-reps-cache` exige sessão e preferência ativa, classifica a falha por etapa/código, registra no log uma referência UUID e devolve ao renderer apenas detalhes limitados e sanitizados. Os códigos distinguem desativação, credenciais, autenticação, rede, timeout, limite do GDL, servidor, sessão, mudança de estrutura, detalhes incompletos, lista inconsistente e cache local; erro desconhecido vira mensagem genérica. O renderer valida esse envelope antes de exibir orientação, referência para o log e nova tentativa explícita. Snapshot anterior válido continua visível após falha. O Dashboard e o modal sinalizam a preferência desativada e oferecem acesso à página API GDL; abrir uma REP do snapshot ainda inicia a consulta individual permitida.

`gdl-listagem-preferencia.service.test.ts`, `gdl-minhas-reps-cache.service.test.ts`, `gdl-minhas-reps-erro.service.test.ts`, `gdl-config-page.component.test.tsx`, `gdl-minhas-reps-dashboard.test.tsx` e `gdl-minhas-reps-modal.test.tsx` cobrem guardas, cache, classificação e apresentação com respostas simuladas. O efeito real da abertura de detalhes no GDL permanece dependente de verificação controlada.
