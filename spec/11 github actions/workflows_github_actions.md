# Workflows do GitHub Actions

## Escopo e fontes de verdade

Este domínio documenta as automações de integração, atualização de dependências, preparação e promoção de releases. As fontes canônicas são:

- `.github/workflows/ci.yml` para a CI;
- `.github/dependabot.yml` para a automação gerenciada **Dependabot Updates**;
- `.github/workflows/release.yml` para **Preparar release**;
- `.github/workflows/promover-release.yml` para **Promover release**;
- `scripts/release/**` para validação, manifesto, assinatura e geração do feed;
- `package.json` para os comandos executados e o requisito de Node.js 24 ou superior;
- `electron-builder.yml` para os alvos e metadados de empacotamento.

O arquivo `spec/01 planejamento/git_realease_plan.md` é planejamento e histórico operacional da implantação. Em caso de divergência, os YAMLs e scripts acima descrevem o comportamento atual.

## Relação profunda com a atualização do aplicativo

Este domínio tem relação direta e profunda com `spec/12 atualizacao/`. Os workflows produzem a release, o manifesto, a assinatura e o feed; o aplicativo consome esses mesmos contratos para decidir se uma versão é confiável, compatível e instalável.

As duas specs formam uma única cadeia de confiança com responsabilidades separadas:

```text
GitHub Actions
  artefato + manifesto + assinatura + feed
                         |
                         v
Aplicativo
  normalização + Ed25519 + plataforma + hash + backup + instalação
```

Mudanças em versão do manifesto, serialização canônica, chave, canal, plataforma, arquitetura, formato, nome, tamanho, hash, URL, notas ou `requerBackupCompletoImagens` precisam ser avaliadas simultaneamente em `11 github actions` e `12 atualizacao`. O sucesso do workflow não basta se o consumidor não aceitar o contrato, e a flexibilidade do consumidor não torna confiável um artefato que o produtor não publicou e assinou.

## Visão geral

| Automação | Gatilho | Responsabilidade | Escrita externa |
|---|---|---|---|
| CI | `workflow_dispatch`, `pull_request` para `main` e `push` em `main` | validar tipos, lint, cobertura, scripts de release e build | nenhuma |
| Dependabot Updates | agenda de `.github/dependabot.yml` | abrir PRs mensais conjuntos de atualização para npm e GitHub Actions | PRs na `main`, gerenciados pelo GitHub |
| Preparar release | `workflow_dispatch` | validar a solicitação, construir pacotes, assinar o manifesto e criar release em rascunho | tag e rascunho no GitHub Releases |
| Promover release | `workflow_dispatch` | promover, reprocessar ou suspender uma release e implantar o feed assinado | release pública e GitHub Pages |

```text
Dependabot Updates ─┐
branch/PR ──────────┴─> CI

main + despacho manual
  -> Preparar release
  -> disparar CI manual para a referência do commit imutável
  -> confirmar a execução manual pelo SHA exato
  -> builds selecionados
  -> tag + manifesto Ed25519 + release em rascunho
  -> smoke test manual
  -> Promover release
  -> release pública
  -> feed completo assinado
  -> GitHub Pages
  -> comparação HTTPS do conteúdo implantado
```

## CI

A CI aceita despacho manual por `workflow_dispatch`, além de `pull_request` para `main` e `push` em `main`. Possui um único job `Validar` em `ubuntu-latest`, com `permissions: contents: read`. Cada execução faz checkout, configura Node.js 24 com cache do npm, instala por `npm ci` e executa nesta ordem:

1. `npm run type-check`;
2. `npm run lint`;
3. `npm run test:coverage`;
4. `npm run test:release`;
5. `npm run build`.

O grupo de concorrência combina workflow e PR ou referência. `cancel-in-progress: true` descarta a execução anterior da mesma origem quando chega uma revisão nova.

A CI não recebe segredo de assinatura e não cria tag, release, deployment ou asset. PRs criados pelo Dependabot também disparam este workflow. Pela semântica do GitHub, essas execuções são tratadas como vindas de fork, com `GITHUB_TOKEN` somente leitura e sem acesso aos secrets comuns; o workflow atual é compatível porque só solicita leitura e não consome secrets.

Limitação atual: `actions/checkout@v7` e `actions/setup-node@v7` são referenciadas por tag na CI. Os workflows de release fixam as Actions por SHA completo.

## Dependabot Updates

**Dependabot Updates** é uma automação hospedada pelo GitHub, não um quarto arquivo em `.github/workflows/`. `.github/dependabot.yml` define o grupo multi-ecossistema `atualizacoes-mensais`, direcionado à `main`, no fuso `America/Sao_Paulo`:

| Escopo | Agenda | Limite de PRs abertos | Agrupamento |
|---|---|---:|---|
| npm + github-actions | dia 1 de cada mês, 09:00 | 1 para o grupo | atualizações de versão entram no mesmo PR multi-ecossistema |
| segurança npm | conforme o Dependabot | — | grupo `npm-seguranca` |
| segurança GitHub Actions | conforme o Dependabot | — | grupo `github-actions-seguranca` |

As atualizações de versão de npm e GitHub Actions pertencem ao mesmo PR mensal. As atualizações de segurança permanecem agrupadas separadamente por ecossistema. Os PRs resultantes seguem o mesmo fluxo de revisão e CI dos demais PRs. A configuração não habilita auto-merge nem concede acesso a segredos.

## Preparar release

### Entrada e gate inicial

O workflow é manual e compartilha o grupo de concorrência `release-producao` com a promoção, sem cancelar uma execução em andamento. As entradas são resumo final da atualização, seleção de Windows/Linux/macOS, confirmação de omissões e modo `criar` ou `retomar`. A versão não é informada manualmente: o workflow a planeja a partir da última release pública e dos metadados locais.

O gate inicial combina `validar-solicitacao.mjs`, a leitura coordenada dos metadados e `planejar-versao.mjs`. A execução é bloqueada quando:

- a referência não é `refs/heads/main`;
- `package.json`, `package-lock.json.version` e `package-lock.json.packages[""].version` não contêm a mesma versão SemVer estável;
- a versão local não é igual à última publicada nem ao próximo patch esperado;
- o modo não é reconhecido;
- o resumo tem menos de 10 caracteres ou contém placeholder;
- nenhuma plataforma foi selecionada;
- uma plataforma foi omitida sem `CONFIRMO`.

No modo `criar`, tag e release da versão devem estar ausentes. No modo `retomar`, a tag existente define o commit; antes da agregação, a release correspondente deve ser um rascunho sem assets.

### Planejamento e integração automática da versão

`planejar-versao.mjs` usa a última release pública como base. Se os metadados ainda estiverem nessa versão, calcula o próximo patch e o workflow executa `npm version patch --no-git-tag-version`, atualizando `package.json`, `package-lock.json.version` e `package-lock.json.packages[""].version`. Se os arquivos já estiverem no próximo patch, a execução continua sem incrementar novamente, o que torna segura a repetição após uma interrupção.

Quando há incremento, o workflow cria uma branch efêmera `codex/release-v<versão>-<run-id>`, abre um PR para a `main` e o integra por merge. O commit resultante da `main` passa a ser o commit imutável usado por todos os builds e pela tag. Em `retomar`, a tag existente continua sendo a fonte do commit.

O job inicial não repete instalação de dependências, tipos, lint, cobertura, testes de release nem build genérico. Depois de definir o commit imutável, ele despacha explicitamente `ci.yml` com `gh workflow run`: usa a referência `main` no modo `criar` e a tag `v<versão>` no modo `retomar`. Em seguida procura somente a execução `workflow_dispatch` associada ao SHA exato, aguardando por até 10 minutos que ela seja registrada, e usa `gh run watch --exit-status` até a conclusão. Somente uma CI bem-sucedida libera os builds nativos; ausência, cancelamento ou falha interrompem a preparação. O token desse job possui `actions: write` para disparar e acompanhar a CI e `checks: read`, além das permissões de conteúdo e PR necessárias à integração da versão.

Esse estágio escreve na `main` antes da criação do rascunho e não é transacional com os demais jobs. Proteções ou indisponibilidade que impeçam a criação/integração do PR interrompem a preparação antes dos builds. Se a CI falhar depois da integração automática, a versão permanece na `main`, mas tag, instaladores e rascunho não são criados; uma nova execução reutiliza o próximo patch já registrado sem incrementá-lo novamente.

### Builds e artefatos temporários

Os jobs selecionados fazem checkout do mesmo commit, usam Node.js 24, executam `npm ci`, constroem a aplicação e empacotam sem publicar diretamente:

- Windows x64: NSIS, blockmap e `latest.yml`;
- Linux x64: AppImage, blockmap, DEB e `latest-linux.yml`;
- macOS x64 e arm64: somente DMG experimental. ZIP continua aceito pelo consumidor como compatibilidade de leitura, mas não é gerado, manifestado nem publicado pelo produtor atual.

O upload temporário falha se os padrões não encontrarem arquivos. O Windows possui uma barreira adicional: a versão dentro de `app.asar` e a versão de produto do executável devem coincidir com a versão solicitada. Não há verificação interna equivalente para Linux ou macOS.

### Agregação protegida

`Assinar e criar rascunho` só executa quando a validação passou e cada build foi concluído ou corretamente ignorado. O job usa o environment `release`, `contents: write` e o secret `CHAVE_PRIVADA_ASSINATURA`.

A agregação baixa os artefatos temporários, troca espaços por pontos nos nomes públicos, cria ou confirma a tag imutável e chama `gerar-manifesto.mjs`. O script identifica plataforma e arquitetura pelo nome do artefato temporário, inclui apenas formatos instaláveis, calcula tamanho e SHA-256, monta URLs HTTPS, normaliza o contrato e assina a serialização canônica com Ed25519. Windows e Linux usam o canal `stable`; macOS usa `experimental`.

O manifesto e sua assinatura são guardados em um artefato privado do Actions chamado `manifesto-assinado-<versão>`, com retenção de 90 dias. A release em rascunho recebe somente os instaladores reconhecidos pelo manifesto; metadados do electron-builder, manifesto e assinatura não são assets públicos.

`gerar-notas-release.mjs` cria o corpo público sem repetir o título `laWdo v<versão>`. O conteúdo contém somente as seções `Alterações` e `Correções`, seguidas de uma tabela de instaladores com plataforma, arquitetura, formato e link. Os arquivos “Source code” exibidos pelo GitHub são arquivos automáticos da tag e não pertencem à lista de assets controlada pelo workflow.

### Falhas parciais

A preparação não é transacional. A tag é enviada antes da geração do manifesto e da criação do rascunho; uma falha posterior pode deixar somente a tag. O modo `retomar` exige também um rascunho vazio, portanto não recupera automaticamente todo estado parcial possível. O fluxo falha diante de destinos ou nomes ambíguos e não substitui assets de release publicada.

## Promover release

### Modos e validação

O workflow aceita `promover`, `reprocessar-feed` e `suspender`; suspensão exige motivo. Ele só inicia na `main`, compartilha `release-producao`, usa o environment `release` e valida que a versão de `package.json` coincide com a solicitada.

Antes de alterar o estado público, o workflow confere tag, release, commit quando `targetCommitish` é um SHA completo, estado de rascunho conforme o modo, manifesto, assinatura, notas e assets. `scripts/release/validar-promocao.mjs` usa a chave pública Ed25519 embutida e bloqueia:

- assinatura inválida ou versão divergente;
- notas com placeholders ou sem exatamente as seções `Alterações` e `Correções` nessa ordem; o título duplicado legado ainda é aceito com aviso;
- assets ausentes, duplicados, extras ou com tamanho divergente;
- URL que não corresponda ao asset esperado. Durante o rascunho, a URL temporária da API do GitHub também é aceita.

`promover` publica o rascunho. `reprocessar-feed` exige release já pública e não republica binários. `suspender` mantém a release pública para download manual, acrescenta às notas um marcador idempotente e a exclui do feed subsequente.

### Feed e Pages

O workflow lista até 100 releases públicas e materializa `.suspensa` para releases marcadas nas notas. Para a versão solicitada, reutiliza o manifesto já validado no diretório de trabalho. Para as demais, tenta primeiro o histórico do Pages, depois o artefato privado não expirado do Actions e, por compatibilidade legada, os assets da própria release. Essa ordem também permite que `reprocessar-feed` recupere a versão atual quando o primeiro deploy do Pages falhou. `gerar-feed.mjs`:

1. normaliza e verifica cada manifesto com a chave pública padrão;
2. ignora releases suspensas;
3. escolhe a maior versão SemVer por canal, plataforma e arquitetura;
4. gera um índice canônico e uma assinatura Ed25519 para cada destino;
5. inclui `index.html` e `logo.png` no conjunto estático.

A página `index.html` agrupa downloads por Windows, Linux e macOS e exibe arquitetura, formato, versão e tamanho legível. Ela filtra ZIPs de manifestos legados e oferece apenas os formatos instaláveis publicados atualmente; os índices assinados por destino continuam independentes dessa apresentação.

A seleção por destino preserva uma versão anterior para plataformas omitidas ou para uma versão mais nova suspensa. O feed completo é enviado como artefato, preparado para Pages e implantado no environment `github-pages`. Esse job não recebe a chave privada; recebe somente o feed já assinado.

Após o deploy, todos os arquivos locais do feed são baixados pela URL HTTPS retornada pelo Pages e comparados byte a byte. Divergência, ausência ou erro HTTP falha a execução.

### Consistência e reexecução

GitHub Releases e GitHub Pages não participam de uma transação única. A release pode já estar pública ou marcada como suspensa quando a geração ou o deploy do feed falha; enquanto isso, o aplicativo continua vendo o feed anterior. O modo `reprocessar-feed` é o caminho idempotente para regenerar e reimplantar o feed sem recriar tag, release ou assets.

A geração está limitada às 100 releases retornadas por `gh release list --limit 100`. Se o repositório ultrapassar esse volume, versões antigas fora da janela não participam da reconstrução.

## Contratos e invariantes compartilhados

- `manifesto.json` versão 1 é a fonte assinada para versão, commit, data, canais, schema, necessidade de backup completo, notas e artefatos.
- Cada combinação plataforma/arquitetura/formato é única; arquiteturas aceitas são `x64` e `arm64`.
- URLs devem usar HTTPS, hashes devem ser SHA-256 hexadecimal e a assinatura deve ser Ed25519.
- A chave privada existe somente no secret do environment `release`; a chave pública fica no código e valida manifesto e feed.
- `release-producao` serializa preparação e promoção, mas não impede ações manuais externas à automação.
- O feed só anuncia assets de releases públicas, assinadas, válidas e não suspensas.
- Publicar diretamente pela interface do GitHub não atualiza o feed.
- A release pode ser parcial; o feed é calculado independentemente por plataforma e arquitetura.

## Verificação e cobertura

`npm run test:release` executa os testes Node em `scripts/release/*.test.mjs`. A cobertura atual comprova:

- normalização, ordenação, serialização canônica, assinatura e rejeição de adulteração do manifesto;
- preservação da versão mais recente por plataforma no feed;
- exclusão de release suspensa com preservação da versão anterior;
- bloqueio de notas incompletas;
- aceitação da URL temporária do GitHub no rascunho;
- planejamento idempotente do próximo patch e bloqueio de divergências entre `package.json` e lockfile;
- geração das notas sem título duplicado e com tabela de instaladores por plataforma;
- página do feed agrupada por plataforma, com tamanhos legíveis e exclusão de ZIP dos downloads exibidos.

A própria CI executa esses testes, e o workflow de preparação dispara e consome uma execução manual dedicada em vez de repetir as validações no job inicial. Permanecem dependentes do GitHub Actions e de validação operacional: despacho pela referência correta, associação da execução manual ao SHA exato, espera pelo resultado, matriz nativa de empacotamento, environments, permissões, tag/release, download/upload de assets, publicação, deploy do Pages e verificação HTTPS.

## Arquivos que mudam juntos

| Alteração | Revisar em conjunto |
|---|---|
| comandos ou gates da CI | `.github/workflows/ci.yml`, `package.json` e testes afetados |
| política de dependências | `.github/dependabot.yml`, CI e proteção da `main` |
| plataforma, arquitetura ou formato | `release.yml`, `electron-builder.yml`, `gerar-manifesto.mjs`, `manifesto.mjs`, atualizador e testes |
| manifesto ou assinatura | scripts de release, chave pública do aplicativo, serviço de atualização e testes |
| versão do projeto | `package.json`, os dois campos de versão do `package-lock.json`, `planejar-versao.mjs`, workflow de preparação e testes |
| notas ou assets obrigatórios | gerador de notas, preparação, `validar-promocao.mjs` e testes de promoção |
| canal, suspensão ou seleção da versão | `promover-release.yml`, `gerar-feed.mjs`, consumidor do feed e testes |
| publicação do feed | jobs de promoção, environments `release` e `github-pages` e URL-base consumida pelo aplicativo |
