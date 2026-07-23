# Plano de distribuição e atualização do laWdo

> **Natureza:** plano de implementação. Este documento descreve o fluxo proposto e não representa o comportamento atualmente disponível no aplicativo.
>
> **Rastreabilidade:** issue [#67](https://github.com/issjunior/laWdo/issues/67).

## Progresso da implantação

| Etapa | Estado | Registro |
|---|---|---|
| Base de CI segura | concluída | `6afcd9c`: CI em PRs e `main`, `contents: read`, concorrência, Node 24, tipagem, lint, cobertura e build. Validação local aprovada em 23/07/2026. |
| Segurança e repositório | em andamento | Ainda requer configuração manual no GitHub: 2FA, proteção da `main`, environments `release` e `github-pages`, releases imutáveis e guarda das chaves fora do repositório. |
| Build multiplataforma | em andamento | Workflow manual criado nesta entrega: valida branch, SemVer, versão do pacote, seleção/confirmacão de plataformas e ausência prévia de tag/release; produz artefatos temporários para Windows x64, Linux x64 e macOS x64/arm64, sem publicar. Pendente: execução real no GitHub e agregação para rascunho. |
| Manifesto e assinatura | em andamento | Contrato canônico, normalização, serialização determinística, SHA-256 e assinatura/verificação Ed25519 implementados e testados. A chave pública Ed25519 foi incorporada ao aplicativo; o agregador de rascunho baixa artefatos, cria tag, gera manifesto assinado e anexa assets à release em rascunho. Pendente: cadastrar a chave privada no environment `release` e executar o fluxo real. |
| Demais etapas | pendentes | Promoção, atualizador, interface, backup, fluxo offline e transição permanecem sem implementação. |

### Ponto de retomada — 23/07/2026

- Branch publicada: `codex/implantacao-release-atualizacao`.
- Pull request em rascunho: [#68](https://github.com/issjunior/laWdo/pull/68), vinculado à issue [#67](https://github.com/issjunior/laWdo/issues/67).
- Configurações externas concluídas: environments `release` e `github-pages`; secret `CHAVE_PRIVADA_ASSINATURA` cadastrado exclusivamente em `release`.
- Chave pública Ed25519 incorporada em `src/shared/atualizacao/chave-publica-release.ts`; a chave privada não está no repositório.
- Último commit funcional: `7236cd3` (`add_chave_publica_de_release`).
- Próxima entrega: criar `promover-release.yml` para validar o rascunho, bloquear notas incompletas, publicar a release e só depois gerar, assinar e implantar o feed completo no GitHub Pages.

## 1. Objetivo

Disponibilizar atualizações online e offline do laWdo de forma simples para o desenvolvedor e segura para os usuários, sem instalar código diretamente da branch `main`.

O fluxo deve:

- construir artefatos nativos para Windows, Linux e macOS no GitHub Actions;
- publicar os artefatos em GitHub Releases públicas;
- permitir releases completas ou restritas a plataformas selecionadas;
- detectar atualizações no aplicativo sem exigir token do GitHub;
- permitir que o usuário adie a atualização ou escolha entre instalar agora e na próxima inicialização;
- autenticar os pacotes com assinatura criptográfica própria;
- criar backups antes de qualquer atualização;
- oferecer o mesmo artefato para distribuição online e offline;
- preservar rastreabilidade, versionamento e possibilidade de recuperação.

## 2. Estado inicial e versão de transição

O projeto está na versão `0.1.0` e possui duas instalações de teste sem mecanismo de atualização.

A versão `0.1.1` será a versão de transição:

1. criar um backup completo nas duas instalações atuais;
2. baixar da GitHub Release e instalar `0.1.1` manualmente;
3. confirmar preservação do banco, imagens e configurações;
4. validar o mecanismo com uma release controlada `0.1.2`;
5. usar o atualizador para as versões seguintes.

Uma versão publicada nunca poderá ser reconstruída ou substituída por outro binário com o mesmo número.

### 2.1 Primeira release pública instalável

A `0.1.1` já será a primeira versão distribuída ao usuário por uma GitHub Release pública. Ela não dependerá de uma instalação prévia para ser obtida.

Essa release deverá conter os binários executáveis produzidos pelo empacotamento nativo equivalente a `npm run dist` em cada runner selecionado:

- instalador NSIS para Windows x64;
- AppImage recomendado e pacote DEB alternativo para Linux x64;
- DMG/ZIP experimental para macOS x64;
- DMG/ZIP experimental para macOS arm64;
- metadados de atualização gerados pelo `electron-builder`;
- manifesto canônico, hashes e assinatura criptográfica própria.

Os arquivos automáticos “Source code” gerados pelo GitHub não serão apresentados como instaladores. A descrição da release indicará claramente qual arquivo baixar em cada sistema operacional.

Haverá dois fluxos de adoção:

- usuário novo: acessa a release `0.1.1`, baixa o instalador adequado e realiza a primeira instalação;
- usuário com `0.1.0`: acessa a mesma release, cria o backup recomendado e instala `0.1.1` manualmente sobre a versão existente.

Depois que `0.1.1` estiver instalada, o laWdo poderá detectar versões posteriores. A própria `0.1.1` não pode chegar automaticamente às instalações `0.1.0`, pois elas ainda não possuem o atualizador.

O campo `"private": true` do `package.json` continuará ativo: ele impede publicação acidental como pacote npm, mas não impede a publicação dos instaladores em uma GitHub Release.

## 3. Fluxo de desenvolvimento e publicação

```text
branch de trabalho
    -> pull request para main
    -> CI obrigatória
    -> merge na main
    -> workflow manual de criação de release
    -> builds das plataformas selecionadas
    -> manifesto, hashes e assinaturas
    -> GitHub Release em rascunho
    -> smoke tests
    -> promoção manual
    -> publicação da GitHub Release
    -> deploy dos índices assinados no GitHub Pages
    -> verificação pós-deploy
    -> aviso aos usuários
```

Não será criada uma branch permanente de homologação. A homologação ocorrerá sobre os artefatos reais da release em rascunho.

Neste plano:

- CI é a validação de pull requests e da `main`;
- entrega é a construção e anexação dos binários a uma GitHub Release em rascunho;
- deploy é a publicação da release seguida da implantação dos índices consumidos pelo aplicativo;
- GitHub Releases armazena os binários;
- GitHub Pages serve apenas o feed estático de atualização.

### 3.1 CI de pull request

A CI existente continuará sendo executada em pull requests e pushes para `main`, com:

- `npm run type-check`;
- `npm run lint`;
- `npm run test:coverage`;
- build quando necessário para detectar falhas de empacotamento antecipadamente.

Nenhum segredo de assinatura ficará disponível para workflows de pull request.

A CI deverá:

- usar `permissions: contents: read`;
- cancelar execuções anteriores da mesma branch ou pull request quando uma nova revisão chegar;
- manter nomes únicos para os checks exigidos pela proteção da `main`;
- impedir merge enquanto checks obrigatórios estiverem pendentes ou falhando;
- não criar tags, releases, deployments ou assets públicos.

### 3.2 Criação manual da release

Um workflow acionado por `workflow_dispatch` solicitará:

- versão a publicar;
- incluir Windows, marcado por padrão;
- incluir Linux, marcado por padrão;
- incluir macOS, marcado por padrão;
- confirmação explícita quando alguma plataforma for omitida.

Regras:

- pelo menos uma plataforma deve ser selecionada;
- o workflow deverá existir na branch padrão e abortar se `github.ref` não for `refs/heads/main`;
- a versão informada deverá ser SemVer válida e coincidir com `package.json`;
- no modo inicial, a tag `v<versão>` e a release correspondente não poderão existir previamente;
- um modo explícito de retomada poderá aceitar apenas uma tag e um rascunho já existentes que coincidam com versão e commit esperados;
- todos os artefatos devem vir do mesmo commit da `main`;
- a tag deverá apontar exatamente para esse commit e não poderá ser movida depois da publicação;
- uma falha em plataforma selecionada bloqueia a criação da release;
- uma plataforma desmarcada não é tratada como falha;
- jobs de plataforma apenas constroem e enviam artefatos temporários do workflow, com nomes exclusivos por versão, sistema e arquitetura;
- o upload deverá falhar quando o padrão esperado não encontrar arquivos;
- os digests SHA-256 produzidos pelo serviço de Artifacts deverão ser preservados e validados automaticamente no download pelo job agregador;
- um job final reúne os resultados e cria uma única GitHub Release em rascunho;
- artefatos temporários do Actions não serão tratados como assets públicos nem como fonte permanente;
- cada asset público deverá respeitar os limites vigentes do GitHub Releases;
- a release parcial deve indicar claramente as plataformas omitidas.

### 3.3 Promoção

Após os smoke tests, uma segunda ação manual deverá:

1. localizar inequivocamente a release em rascunho pela versão;
2. validar novamente tag, commit, `package.json`, release notes, manifesto, assinaturas e conjunto de assets;
3. confirmar que não existem nomes duplicados, arquivos ausentes ou plataformas divergentes;
4. publicar a GitHub Release;
5. regenerar o conjunto completo de índices a partir das releases publicadas e seus manifestos válidos;
6. assinar os índices;
7. criar e enviar o artefato estático do GitHub Pages;
8. fazer deploy no environment `github-pages`;
9. verificar por HTTPS os índices implantados, suas assinaturas e as versões promovidas;
10. registrar a promoção e a URL do deployment nos logs do GitHub Actions.

A sequência segura é publicar primeiro os binários e somente depois apontar o feed para eles. Não há transação única entre Releases e Pages, mas essa ordem é fail-safe: o aplicativo nunca deverá receber um índice que aponte para um asset ainda indisponível.

Se o deploy dos índices falhar:

- a release poderá permanecer pública para download manual;
- o aplicativo continuará usando o feed anterior;
- a promoção poderá ser reexecutada em modo de reprocessamento, sem recriar tag, release ou assets;
- o workflow deverá verificar o estado existente e executar apenas as etapas ainda pendentes.

Publicar uma release diretamente pela interface do GitHub não será o caminho operacional suportado. Mesmo que isso ocorra, ela não será anunciada ao aplicativo enquanto o workflow de promoção não validar e implantar os índices.

Publicação e deploy do feed ocorrerão dentro de `promover-release.yml`. O fluxo não dependerá de um terceiro workflow disparado pelo evento `release: published`, evitando acoplamento a eventos subsequentes gerados pelo próprio `GITHUB_TOKEN`.

### 3.4 Convenções de Git e GitHub

O fluxo de release deverá preservar as convenções gerais do projeto:

- títulos e descrições de pull requests em português do Brasil;
- commits em português, no formato snake_case e com os prefixos `add_`, `ajuste_`, `correcao_` ou `update_`;
- índices serão implantados como artefato do GitHub Pages, sem gerar commit automático em branch de conteúdo;
- nenhuma mensagem automática em inglês quando ela fizer parte do histórico mantido do repositório.

### 3.5 Release notes

Toda release deverá possuir notas em português do Brasil, voltadas ao usuário e não apenas um histórico bruto de commits. O texto será exibido tanto no GitHub quanto no aviso de atualização do laWdo.

Conteúdo mínimo obrigatório:

- versão, canal e indicação de release completa ou parcial;
- resumo curto do objetivo da versão;
- sistemas, arquiteturas e formatos disponíveis;
- alterações perceptíveis pelo usuário;
- correções relevantes;
- impacto em banco, schema, configurações e imagens;
- indicação de migration compatível, irreversível ou inexistente;
- backup que será criado;
- necessidade de reinício ou ação manual;
- limitações conhecidas, escrevendo “Nenhuma conhecida” quando aplicável;
- commit de origem e referência aos arquivos de manifesto e assinatura.

Quando aplicável:

- destacar no início que a release é parcial e listar as plataformas omitidas;
- identificar pacotes macOS como experimentais;
- destacar migrations irreversíveis e mudanças na estrutura de imagens;
- descrever correções de segurança sem publicar detalhes que facilitem exploração;
- informar passos adicionais necessários para DEB ou macOS.

As notas não deverão conter:

- dados periciais, nomes de usuários ou informações internas;
- chaves, tokens, caminhos locais do runner ou conteúdo de logs;
- hashes extensos duplicados no corpo, pois a fonte canônica será o manifesto;
- lista automática de commits sem explicação do impacto.

Modelo:

```markdown
# laWdo v<versão>

> Release <completa|parcial> · Canal <stable|experimental>

## Resumo

<Uma ou duas frases explicando o objetivo da versão.>

## Disponibilidade

| Sistema | Arquitetura | Formato | Instalação |
|---|---|---|---|
| Windows | x64 | NSIS | automática autorizada |
| Linux | x64 | AppImage | automática autorizada |
| Linux | x64 | DEB | manual assistida |
| macOS | x64/arm64 | DMG/ZIP | manual assistida, experimental |

## Alterações

- <Alteração perceptível pelo usuário.>

## Correções

- <Correção relevante ou “Nenhuma”.>

## Dados, backup e compatibilidade

- Schema: `<anterior> -> <destino>` ou “sem alteração”.
- Migration: `<inexistente|compatível|irreversível>`.
- Backup: `<dois snapshots do banco|snapshots e backup completo de imagens>`.
- Compatibilidade ou ação necessária: <descrição>.

## Como atualizar

- <Comportamento por plataforma e necessidade de reinício.>

## Limitações conhecidas

- <Limitação ou “Nenhuma conhecida”.>

## Integridade e origem

- Commit: `<sha>`.
- Manifesto: `<nome do arquivo>`.
- Assinatura: `<nome do arquivo>`.
```

O workflow criará o rascunho com esse esqueleto preenchido com os dados que puderem ser derivados do manifesto. O desenvolvedor completará o conteúdo antes da promoção. A promoção deverá falhar se restarem placeholders, se a disponibilidade divergir do manifesto ou se os campos obrigatórios estiverem ausentes.

Notas automáticas do GitHub poderão ser anexadas em uma seção técnica opcional, desde que não substituam o resumo voltado ao usuário.

### 3.6 Concorrência e idempotência

Os workflows de criação e promoção compartilharão um grupo de concorrência de produção, com cancelamento de execução em andamento desativado. Uma nova release não deverá iniciar enquanto outra estiver criando rascunho, publicando assets ou implantando índices.

Cada operação será identificada por:

- versão;
- tag;
- commit SHA;
- identificador da release;
- identificador da execução do Actions.

Reexecuções deverão ser idempotentes:

- não criar segunda release para a mesma versão;
- não mover tag existente;
- não substituir assets de release publicada;
- permitir reconstrução do rascunho somente a partir do mesmo commit;
- permitir revalidar ou reimplantar os índices sem republicar os binários;
- falhar diante de estado ambíguo em vez de escolher automaticamente um alvo.

### 3.7 Permissões e ambientes

O repositório manterá permissões padrão restritas para `GITHUB_TOKEN`. Cada job declarará somente os acessos necessários:

| Job | Permissões mínimas | Environment |
|---|---|---|
| CI | `contents: read` | nenhum |
| builds nativos | `contents: read` | nenhum |
| agregação, assinatura e rascunho | `contents: write` | `release`, com `deployment: false` |
| validação e publicação | `contents: write` | `release`, com `deployment: false` |
| geração do feed | `contents: read` e acesso à chave no estágio protegido | `release`, com `deployment: false` |
| deploy do Pages | `contents: read`, `pages: write`, `id-token: write` | `github-pages` |

O job que usa a chave privada só poderá iniciar após a aprovação do environment `release`. O job de Pages receberá somente os arquivos já assinados e não terá acesso à chave privada.

O GitHub CLI usará exclusivamente o `GITHUB_TOKEN` efêmero do job por meio de `GH_TOKEN`. Não será criado Personal Access Token para publicar releases ou Pages.

O environment `release` será usado como gate de aprovação e cofre de segredos, mas seus jobs não criarão objetos GitHub Deployment. Com `deployment: false`, required reviewers e wait timers continuam aplicáveis; custom deployment protection rules não deverão ser configuradas nesse environment, pois elas exigem um objeto Deployment.

Somente `actions/deploy-pages` criará um Deployment real, associado ao environment `github-pages` e à URL pública do feed. A própria GitHub Release já mantém o histórico dos binários, portanto duplicá-la na Deployments API não acrescentaria rastreabilidade proporcional ao custo.

Não será criado workflow adicional nem chamada direta à Deployments API. Se futuramente existirem canais beta/stable administrados separadamente, múltiplos ambientes ou exigência institucional de auditoria de promoção, essa decisão poderá ser revista.

### 3.8 Suspensão de uma release

O workflow de promoção terá um modo protegido de suspensão para conter uma versão defeituosa:

1. selecionar a versão publicada;
2. exigir aprovação no environment `release`;
3. regenerar os índices sem apontar para a versão suspensa;
4. assinar e reimplantar o feed;
5. registrar o motivo nas release notes ou em aviso visível.

A suspensão impede novas instalações automáticas, mas não faz downgrade de máquinas já atualizadas. A correção deverá receber uma nova versão. A release e seus assets serão preservados para rastreabilidade, salvo necessidade de segurança excepcional.

## 4. Builds por sistema operacional

| Sistema | Runner | Arquitetura | Artefato | Nível inicial |
|---|---|---|---|---|
| Windows | `windows-latest` | x64 | NSIS | suportado |
| Linux | `ubuntu-latest` | x64 | AppImage | suportado e recomendado |
| Linux | `ubuntu-latest` | x64 | DEB | secundário |
| macOS | `macos-latest` | x64 | DMG/ZIP | experimental |
| macOS | `macos-latest` | arm64 | DMG/ZIP | experimental |

Cada runner deve executar `npm ci`, o build do projeto e o empacotamento nativo. Dependências nativas não devem ser reaproveitadas entre sistemas.

O script atual `npm run dist` continuará sendo a base do empacotamento. No workflow, sua execução deverá receber plataforma, arquitetura e política de publicação explícitas, ou ser desdobrada em scripts equivalentes, para que cada runner produza apenas seus próprios artefatos. O job de build não deverá publicar diretamente; ele usará o equivalente a `--publish never`, deixando a criação da release para o job agregador.

A configuração atual `publish: null` em `electron-builder.yml` deverá ser substituída pela configuração necessária para gerar `app-update.yml`, arquivos `latest*.yml`, blockmaps e demais metadados, sem conceder a cada job permissão para publicar isoladamente.

No estado atual, `package.json` e `package-lock.json` são as fontes canônicas das dependências de build. Elas confirmam pelo menos dois módulos nativos relevantes:

- `sqlite3`, usado na persistência local;
- `bcrypt`, usado no hash e na comparação de senhas em `src/main/ipc/handlers/user.handlers.ts` e `src/main/services/user.service.ts`.

O fato de o PRD descrever apenas “senha criptografada” não elimina essa dependência técnica. Quando o fluxo for implementado, a documentação geral de empacotamento no `AGENTS.md` deverá registrar explicitamente que `sqlite3` e `bcrypt` precisam ser instalados ou reconstruídos em cada runner nativo.

### 4.1 Windows

- Manter NSIS com instalação por usuário (`perMachine: false`).
- Permitir atualização sem administrador quando as políticas da máquina autorizarem.
- Aceitar inicialmente o aviso de editor desconhecido.
- Preparar a configuração para adoção futura de Authenticode.

### 4.2 Linux

- Apresentar AppImage como formato recomendado.
- Atualizar AppImage dentro do aplicativo após autorização.
- Manter DEB como alternativa.
- Para DEB, detectar, baixar, verificar e orientar a instalação manual.
- Não ignorar verificações do sistema com opções como `--allow-unauthenticated`.

### 4.3 macOS

- Gerar pacotes Intel e Apple Silicon no GitHub Actions.
- Detectar, baixar e verificar a atualização.
- Orientar a instalação manual.
- Não contornar Gatekeeper nem alterar configurações de segurança.
- Identificar o suporte como experimental até existir smoke test em hardware real.

Atualização automática nativa no macOS ficará condicionada a uma futura conta Apple Developer, certificado Developer ID e notarização.

## 5. Versionamento e releases parciais

Será usada uma sequência SemVer global:

- correção: `0.1.1` -> `0.1.2`;
- funcionalidade compatível: `0.1.x` -> `0.2.0`;
- versão estável futura: `1.0.0`.

### 5.1 Compatibilidade e mudanças irreversíveis

Enquanto o produto permanecer em desenvolvimento inicial, a série `0.x` seguirá esta regra:

- PATCH (`0.1.1` -> `0.1.2`): correção compatível, sem quebra intencional de dados ou contratos;
- MINOR (`0.1.x` -> `0.2.0`): funcionalidade nova ou mudança incompatível durante a fase inicial;
- qualquer migration irreversível deverá ser declarada explicitamente nas notas e no manifesto, mesmo quando representada por incremento MINOR em `0.x`.

A passagem para `1.0.0` encerrará a fase de instabilidade inicial. Ela dependerá de:

- contratos persistidos e política de compatibilidade definidos;
- migrations, backups e recuperação validados em uso real;
- fluxo de release e atualização considerado operacionalmente estável;
- critérios de suporte por plataforma documentados.

Depois de `1.0.0`:

- mudança compatível e aditiva seguirá MINOR;
- correção compatível seguirá PATCH;
- quebra de contrato persistido, remoção de compatibilidade ou migration irreversível que impeça retorno à série anterior exigirá MAJOR, por exemplo `1.x` -> `2.0.0`.

Nem toda alteração de schema será MAJOR. Migrations aditivas que preservem leitura, escrita e recuperação podem acompanhar PATCH ou MINOR conforme o impacto funcional. Mudanças irreversíveis na estrutura de guarda das imagens exigirão, além da versão adequada, aviso destacado, backup completo e aprovação manual da release.

A disponibilidade será controlada por plataforma. Exemplo:

| Versão | Windows | Linux | macOS |
|---|---:|---:|---:|
| `0.1.1` | sim | sim | sim |
| `0.1.2` | sim | não | sim |
| `0.1.3` | não | sim | não |
| `0.2.0` | sim | sim | sim |

Nesse caso, Linux pode atualizar diretamente de `0.1.1` para `0.1.3`. Não serão criadas versões como `0.1.2-linux`.

Se um build falhar:

- enquanto a release estiver em rascunho, o artefato corrigido poderá ser reconstruído a partir do mesmo commit e validado antes da publicação;
- depois da publicação, a versão será imutável e a correção receberá um novo número.

As migrations do banco devem aceitar saltos de versão do aplicativo e aplicar sequencialmente todas as mudanças de schema pendentes.

## 6. Índices e manifesto de atualização

Haverá um índice assinado para cada combinação suportada de sistema, arquitetura e canal, por exemplo:

```text
stable/windows-x64.json
stable/linux-x64.json
experimental/macos-x64.json
experimental/macos-arm64.json
```

Uma release parcial atualizará apenas os índices correspondentes aos artefatos publicados. Assim, uma release exclusiva de Linux não será anunciada a clientes Windows ou macOS.

### 6.1 Disponibilização pelo GitHub Pages

O GitHub Pages será o endpoint público canônico dos índices. Ele não armazenará os instaladores; cada índice apontará para assets imutáveis de GitHub Releases.

O workflow de promoção deverá:

1. consultar releases publicadas e validar seus manifestos assinados;
2. calcular a versão mais recente compatível para cada plataforma, arquitetura e canal;
3. gerar o site estático completo em diretório temporário;
4. configurar Pages com a action oficial `actions/configure-pages`;
5. enviar um único artefato estático com `actions/upload-pages-artifact`;
6. fazer deploy com `actions/deploy-pages`, usando `needs` para depender da geração;
7. associar o job ao environment `github-pages`;
8. verificar o `page_url` retornado e todos os arquivos promovidos.

As Actions deverão ser fixadas por SHA completo, mesmo quando os nomes acima forem usados para identificar sua finalidade.

Cada deployment substituirá o feed como um conjunto completo. Os índices não serão atualizados parcialmente no servidor nem mantidos por commits automáticos. Para uma release parcial, o gerador preservará nos demais índices a última versão compatível já publicada.

O aplicativo terá uma URL-base HTTPS conhecida para o feed. A resposta de Pages continuará sendo considerada não confiável até a validação da assinatura.

O rótulo “Latest” do GitHub Releases não será fonte canônica para o atualizador, pois uma release parcial pode ser a mais recente globalmente sem conter pacote para todas as plataformas.

### 6.2 Manifesto da release

Cada release conterá um manifesto canônico com:

- versão e commit;
- data de publicação;
- notas da versão;
- versão de schema esperada;
- indicação de necessidade de backup completo das imagens;
- plataformas, arquiteturas e formatos disponíveis;
- nome, tamanho e hash de cada artefato;
- URLs oficiais;
- assinatura criptográfica.

Todo conteúdo remoto será tratado como fronteira insegura. O manifesto será validado e normalizado antes de ser usado.

## 7. Assinatura e segurança

Antes da ativação em produção:

- habilitar 2FA na conta GitHub;
- guardar os códigos de recuperação offline e separados da chave de assinatura;
- proteger a branch `main`, exigindo PR e checks;
- criar um ambiente protegido `release`;
- limitar os segredos ao ambiente de release;
- exigir aprovação manual antes de liberar a chave;
- manter uma cópia criptografada da chave privada em armazenamento offline;
- nunca incluir chave privada em repositório, log, artefato ou instalador;
- usar permissões mínimas em cada job;
- fixar Actions relevantes por SHA completo;
- habilitar releases imutáveis no repositório;
- montar completamente cada release enquanto ela ainda estiver em rascunho.

Será usado um par Ed25519:

- chave privada operacional no ambiente protegido do GitHub Actions;
- cópia de recuperação privada criptografada e offline;
- chave pública embutida no laWdo.

Antes de instalar, o aplicativo deverá validar:

1. assinatura do manifesto;
2. plataforma e arquitetura;
3. progressão da versão, impedindo downgrade;
4. nome e localização esperados do artefato;
5. tamanho;
6. hash do arquivo baixado;
7. correspondência entre artefato e manifesto.

HTTPS, GitHub Releases e os hashes gerados pelo `electron-builder` serão camadas adicionais, mas não substituirão a assinatura própria.

Quando disponível, o workflow também deverá gerar attestations de proveniência do GitHub para os binários e o manifesto, usando `attestations: write` e `id-token: write` somente no job correspondente. Attestations complementam a assinatura própria ao vincular artefato, repositório, workflow e commit; não garantem que o binário seja seguro e não substituem a validação realizada pelo laWdo.

## 8. Serviço de atualização no aplicativo

Toda operação privilegiada ficará no processo principal. O renderer não receberá acesso direto ao sistema de arquivos, processos ou módulos Electron.

Fluxo:

```text
Renderer
    -> IPC tipado
    -> serviço de atualização no main
    -> download e validação
    -> backup
    -> instalador da plataforma
```

O preload deverá expor somente operações específicas, como:

- verificar atualização;
- consultar estado;
- baixar;
- adiar;
- instalar agora;
- agendar para a próxima inicialização;
- selecionar atualização offline.

Todos os novos canais deverão ser adicionados em conjunto ao handler, `ALLOWED_CHANNELS`, `IpcAPI` e tipos de entrada e saída.

### 8.1 Estados

O serviço deverá possuir uma máquina de estados explícita:

```text
ociosa
-> verificando
-> disponível
-> baixando
-> baixada
-> aguardando reinício
-> instalando
-> concluída | falhou
```

Operações duplicadas ou incompatíveis devem ser recusadas. Apenas um download ou instalação poderá ocorrer por vez.

### 8.2 Verificação

- Verificar após a abertura, com pequeno atraso aleatório.
- Verificar no máximo uma vez por dia durante o uso normal.
- Oferecer ação manual “Verificar atualizações”.
- Não exigir token nem enviar telemetria.
- Falhas de rede não devem bloquear a inicialização.
- Erros serão registrados sem expor dados sensíveis.

## 9. Experiência do usuário

Quando houver atualização, mostrar:

- versão instalada e disponível;
- plataformas e formato detectados;
- tamanho;
- notas;
- estado do download;
- ações possíveis.

Opções:

- **Baixar agora**;
- **Lembrar depois**;
- **Instalar agora**;
- **Instalar na próxima inicialização**.

Atualizações serão sempre adiáveis e nunca obrigatórias.

### 9.1 Aviso no cabeçalho e central de informações

O ponto principal do aviso será o controle atualmente identificado como **“Sugestão”** no cabeçalho (`src/renderer/components/layout/Header.tsx`). Como ele já apresenta versão, dados do sistema, repositório e canais de contato, seu rótulo e título acessível deverão passar a ser **“Informações e atualizações”**. Não será criado um pop-up automático ao abrir o laWdo.

Enquanto não houver atualização, o controle preservará sua aparência neutra. Quando o serviço de atualização alcançar o estado `disponível`, ele exibirá, além do ícone, um indicador visual persistente e texto acessível, por exemplo: **“Atualização disponível”**. A cor de destaque poderá ser verde, coerente com os badges de versão já usados pela interface, mas não será a única indicação: o texto, um `Badge` e o `aria-label` comunicarão o estado também a quem não distingue cores. O `tooltip` ao passar o mouse apenas complementará a informação com “Nova versão disponível: vX.Y.Z”.

Ao abrir o modal, acima das informações técnicas e dos canais de contato, haverá uma seção de atualização com:

- versão instalada, versão disponível, data e tamanho;
- resumo das notas da release e ação para abrir as notas completas;
- estado do download e erros compreensíveis, quando houver;
- **Baixar agora**, quando ainda não houver pacote validado localmente;
- após o download validado, **Instalar agora** e **Instalar na próxima inicialização**;
- **Lembrar depois**, que fecha o modal sem impedir nova verificação futura;
- **Verificar atualizações**, disponível também quando não houver nova versão.

Os botões usarão o IPC tipado já definido na seção 8. A interface apenas solicita a ação e mostra o estado; download, validação, backup e instalação continuarão exclusivamente no processo principal. No macOS experimental, a ação informará que o pacote foi baixado e orientará a instalação manual, sem prometer atualização automática.

### 9.2 Fechamento seguro

O estado atual não possui uma proteção global contra encerramento com alterações não salvas. Antes de implementar “Instalar agora”, deverá ser criado um protocolo de fechamento seguro:

1. o main solicita ao renderer autorização para reiniciar;
2. telas editáveis registram mudanças pendentes;
3. havendo mudanças, o reinício é bloqueado;
4. o usuário salva ou descarta conscientemente;
5. o banco é fechado e o backup é criado;
6. somente então o instalador é iniciado.

“Instalar na próxima inicialização” deverá persistir um registro validado dentro de `userData`. Na próxima abertura, a versão antiga processará a pendência antes de abrir e migrar o banco, criará os backups necessários e iniciará a instalação.

## 10. Backups pré-atualização

Antes de qualquer atualização:

- fechar ou colocar o SQLite em estado consistente;
- criar uma cópia integral e exata do banco;
- executar verificação de integridade;
- registrar versão anterior, versão de destino, data e versão do schema;
- manter os dois backups automáticos mais recentes;
- remover o terceiro somente depois de validar o novo;
- bloquear a instalação se a cópia ou validação falhar.

Esses backups serão separados do backup comum da interface. O backup pré-atualização não deve remover auditoria nem alterar o conteúdo da cópia.

### 10.1 Mudanças no armazenamento de imagens

Quando o manifesto declarar alteração na estrutura de guarda das imagens:

- calcular espaço necessário;
- criar um backup completo adicional do banco e das imagens;
- validar manifesto e arquivos do backup;
- impedir a atualização se o backup completo falhar.

O backup completo especial não substituirá os dois snapshots rotativos do banco.

### 10.2 Recuperação

Cada backup deverá ser associado à versão do aplicativo que o criou. Restaurar um banco antigo poderá exigir também a reinstalação da versão compatível do laWdo.

O plano de recuperação deve evitar downgrade automático e migração reversa implícita.

## 11. Atualização offline

O fluxo offline usará os mesmos artefatos publicados:

1. baixar em uma máquina conectada o instalador, o manifesto e a assinatura;
2. transferir os arquivos por pendrive ou rede interna;
3. selecionar o manifesto em “Atualização offline”;
4. localizar o artefato correspondente na mesma origem;
5. validar assinatura, plataforma, arquitetura, versão, tamanho e hash;
6. executar o mesmo fluxo de backup e instalação usado online.

Um arquivo não será considerado confiável apenas por ter sido entregue em mídia física.

## 12. Smoke test e promoção

O smoke test é uma recomendação forte e um gate manual, sem vínculo com máquinas específicas.

Antes da promoção:

- testar Windows em máquina real, preferencialmente com usuário sem administrador;
- testar AppImage em Linux real sem privilégios;
- testar DEB quando seu empacotamento mudar;
- executar verificações automatizadas dos pacotes macOS;
- identificar macOS como não homologado em hardware real;
- usar somente dados fictícios.

Checklist mínima:

- instalação e atualização;
- versão exibida;
- preservação do banco e imagens;
- criação e rotação dos backups;
- abertura e salvamento de um laudo de teste;
- adiamento;
- instalação imediata;
- instalação na próxima inicialização;
- atualização offline;
- comportamento após falha de rede, assinatura inválida e backup inválido.

## 13. Componentes previstos

Arquivos e responsabilidades prováveis:

- `package.json`: dependência de atualização e scripts;
- `electron-builder.yml`: publicação, metadados e alvos por arquitetura;
- `.github/workflows/release.yml`: builds e criação do rascunho;
- `.github/workflows/promover-release.yml`: publicação, reprocessamento, suspensão e deploy do feed;
- GitHub Pages: endpoint estático dos índices assinados;
- `src/main/services/atualizacao.service.ts`: estado e orquestração;
- `src/main/services/backup-atualizacao.service.ts`: snapshots e retenção;
- `src/main/ipc/handlers/atualizacao.handlers.ts`: fronteira IPC;
- `src/preload/index.ts` e `src/preload/types.ts`: API tipada;
- tipos ou schemas compartilhados para manifesto e respostas;
- componentes do renderer para aviso, progresso e preferências;
- scripts de geração, hash e assinatura de manifesto;
- testes unitários e de integração.

Os nomes finais deverão seguir as convenções em português e a organização efetiva do projeto.

### 13.1 Classificação da documentação após a implementação

O fluxo de release e atualização pertence a `spec/01 planejamento/`, pois combina infraestrutura de build, empacotamento, distribuição e ciclo de atualização da aplicação.

Quando a implementação estiver concluída:

1. este plano deverá ser reavaliado e substituído por uma spec enxuta de estado atual em `spec/01 planejamento/distribuicao_atualizacao.md`;
2. o plano não deverá permanecer como histórico concorrente com a spec canônica;
3. a linha de `01 planejamento/` no `AGENTS.md` deverá passar a incluir `.github/workflows/**`;
4. `spec/09 automacao-spec/manifesto.json` deverá adicionar `.github/workflows/**` aos `globsCodigo` do grupo `01 planejamento`;
5. scripts específicos de assinatura, manifesto, índices e publicação continuarão cobertos por `scripts/**`;
6. a spec de estado atual deverá documentar conjuntamente os workflows, `electron-builder.yml`, os serviços de atualização, a fronteira IPC, os índices e o formato do manifesto.

O arquivo atual é documentação operacional e não deve ser tratado pela automação como se já descrevesse comportamento implementado.

## 14. Testes automatizados

Cobertura mínima:

- validação e normalização de manifesto;
- assinatura correta, assinatura inválida e chave incorreta;
- hash, tamanho e artefato incompatível;
- seleção por sistema e arquitetura;
- comparação SemVer e bloqueio de downgrade;
- classificação de PATCH, MINOR e MAJOR para migrations compatíveis e incompatíveis;
- release parcial e salto de versão;
- validação das release notes contra manifesto, plataformas selecionadas e placeholders pendentes;
- validação de versão, tag, commit e identidade da release;
- reexecução idempotente de criação, promoção e deploy;
- concorrência entre duas solicitações de release;
- digest divergente entre upload e download de artefato do workflow;
- geração completa do feed e preservação dos índices de plataformas omitidas;
- falha de deploy no Pages sem anúncio prematuro da versão;
- suspensão de release sem downgrade;
- máquina de estados e prevenção de concorrência;
- IPC e payloads inválidos;
- rotação de dois backups;
- falha de integridade e falta de espaço;
- exigência de backup completo para mudança de imagens;
- pendência de instalação na próxima inicialização;
- migrations a partir de schemas anteriores;
- preservação de banco, imagens e configurações.

Após alterações, executar:

```text
npm run type-check
npm run lint
npm test
npm run test:coverage
npm run pack
```

O workflow de release deverá validar o empacotamento nativo em cada runner selecionado.

## 15. Etapas de implementação

### Etapa 1 — Segurança e repositório

- ativar 2FA;
- proteger `main`;
- criar ambiente `release`;
- configurar o environment `github-pages`;
- manter permissões padrão restritas do `GITHUB_TOKEN`;
- habilitar releases imutáveis;
- gerar e guardar as chaves;
- definir permissões dos workflows.

### Etapa 2 — Build multiplataforma

- criar workflow manual;
- gerar Windows, Linux e macOS;
- implementar seleção de plataformas;
- validar `main`, versão, tag e commit;
- configurar concorrência sem cancelamento de release em andamento;
- separar artefatos temporários do Actions de assets públicos;
- reunir artefatos sem publicação parcial acidental.

### Etapa 3 — Manifesto e promoção

- criar formato canônico;
- gerar hashes e assinaturas;
- criar índices por plataforma;
- gerar o feed estático completo;
- gerar o esqueleto das release notes em português;
- validar conteúdo mínimo e coerência das notas antes da promoção;
- criar release em rascunho;
- implementar promoção manual e idempotente;
- implantar o feed com GitHub Pages;
- verificar o endpoint após o deploy;
- implementar reprocessamento e suspensão.

### Etapa 4 — Atualizador no main e IPC

- implementar máquina de estados;
- verificar, baixar e validar;
- expor IPC estrito e tipado;
- registrar logs.

### Etapa 5 — Interface e fechamento seguro

- integrar o aviso persistente ao controle “Informações e atualizações” do cabeçalho e à seção correspondente do modal;
- incluir texto acessível, indicador visual e `tooltip`, sem depender somente de cor ou hover;
- implementar progresso e adiamento;
- registrar estado não salvo;
- suportar instalação agora e na próxima inicialização.

### Etapa 6 — Backup e recuperação

- criar snapshot exato do SQLite;
- implementar retenção de dois backups;
- criar backup completo condicionado às imagens;
- bloquear instalação em caso de falha.

### Etapa 7 — Atualização offline

- selecionar manifesto e artefato;
- reutilizar validações;
- reutilizar backup e instalação.

### Etapa 8 — Transição

- gerar os instaladores e metadados de `0.1.1` nos três runners;
- criar a GitHub Release `0.1.1` em rascunho;
- executar smoke test dos binários efetivamente anexados ao rascunho;
- publicar `0.1.1` como primeira release pública instalável;
- baixar da release e instalar manualmente nas máquinas `0.1.0` existentes;
- validar que usuários novos conseguem localizar e instalar o artefato correto;
- publicar `0.1.2` controlada;
- confirmar o ciclo ponta a ponta.

## 16. Critérios de aceite

O plano estará implementado quando:

- os três sistemas forem construídos pelo GitHub Actions;
- o desenvolvedor puder selecionar plataformas;
- o workflow abortar fora da `main` ou diante de versão, tag ou release conflitante;
- somente uma operação de release poder alterar produção por vez;
- releases forem criadas inicialmente como rascunho;
- releases publicadas serem imutáveis;
- toda release possuir notas em português com conteúdo mínimo validado e coerente com o manifesto;
- artefatos temporários terem nomes exclusivos e digests validados antes de virar assets públicos;
- GitHub Releases armazenar os binários e GitHub Pages servir os índices assinados;
- uma release somente ser anunciada após deploy e verificação do feed;
- promoção e reprocessamento poderem ser reexecutados sem duplicar tag, release ou asset;
- uma versão defeituosa poder ser suspensa do feed sem downgrade automático;
- nenhum segredo for exposto a PRs ou ao aplicativo;
- o aplicativo rejeitar manifesto ou pacote adulterado;
- releases parciais não forem anunciadas a plataformas omitidas;
- Windows e AppImage atualizarem somente com consentimento;
- DEB e macOS possuírem instalação manual assistida;
- o usuário puder adiar ou escolher o momento;
- alterações não salvas impedirem reinício;
- os dois backups do banco forem criados e rotacionados;
- mudanças nas imagens exigirem backup completo;
- atualização offline passar pelas mesmas verificações;
- migrations aceitarem saltos de versão;
- a `0.1.1` existir como GitHub Release pública com instaladores nativos, metadados, manifesto, hashes e assinatura;
- usuários novos conseguirem baixar e instalar `0.1.1` diretamente da release;
- instalações `0.1.0` conseguirem fazer a transição manual usando os mesmos binários públicos da `0.1.1`;
- a `0.1.2` comprovar a atualização automática autorizada no Windows/NSIS e Linux/AppImage;
- a `0.1.2` comprovar detecção, download verificado e instalação manual assistida no Linux/DEB;
- o build macOS da `0.1.2` comprovar detecção e preparação da instalação manual assistida em CI, permanecendo experimental até homologação em hardware real.

## 17. Decisões adiadas

- aquisição de certificado Authenticode público;
- conta Apple Developer, Developer ID e notarização;
- promoção do macOS de experimental para suportado;
- telemetria de adoção ou falhas;
- atualizações obrigatórias ou versão mínima;
- rollout percentual;
- canal beta permanente;
- rollback automático do aplicativo e do schema.

Esses itens não devem bloquear a primeira versão do atualizador.
