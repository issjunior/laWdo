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
| CI | `pull_request` para `main` e `push` em `main` | validar tipos, lint, cobertura, scripts de release e build | nenhuma |
| Dependabot Updates | agenda de `.github/dependabot.yml` | abrir PRs de atualização para npm e GitHub Actions | PRs na `main`, gerenciados pelo GitHub |
| Preparar release | `workflow_dispatch` | validar a solicitação, construir pacotes, assinar o manifesto e criar release em rascunho | tag e rascunho no GitHub Releases |
| Promover release | `workflow_dispatch` | promover, reprocessar ou suspender uma release e implantar o feed assinado | release pública e GitHub Pages |

```text
Dependabot Updates ─┐
branch/PR ──────────┴─> CI

main + despacho manual
  -> Preparar release
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

A CI possui um único job `Validar` em `ubuntu-latest`, com `permissions: contents: read`. Cada execução faz checkout, configura Node.js 24 com cache do npm, instala por `npm ci` e executa nesta ordem:

1. `npm run type-check`;
2. `npm run lint`;
3. `npm run test:coverage`;
4. `npm run test:release`;
5. `npm run build`.

O grupo de concorrência combina workflow e PR ou referência. `cancel-in-progress: true` descarta a execução anterior da mesma origem quando chega uma revisão nova.

A CI não recebe segredo de assinatura e não cria tag, release, deployment ou asset. PRs criados pelo Dependabot também disparam este workflow. Pela semântica do GitHub, essas execuções são tratadas como vindas de fork, com `GITHUB_TOKEN` somente leitura e sem acesso aos secrets comuns; o workflow atual é compatível porque só solicita leitura e não consome secrets.

Limitação atual: `actions/checkout@v7` e `actions/setup-node@v7` são referenciadas por tag na CI. Os workflows de release fixam as Actions por SHA completo.

## Dependabot Updates

**Dependabot Updates** é uma automação hospedada pelo GitHub, não um quarto arquivo em `.github/workflows/`. `.github/dependabot.yml` define dois ecossistemas, ambos direcionados à `main`, no fuso `America/Sao_Paulo`:

| Ecossistema | Agenda | Limite de PRs abertos | Agrupamento |
|---|---|---:|---|
| npm | segunda-feira, 09:00 | 3 | produção e desenvolvimento agrupam `minor`/`patch`; segurança agrupa todas as dependências |
| github-actions | segunda-feira, 09:30 | 2 | versões agrupam `minor`/`patch`; segurança agrupa todas as Actions |

Atualizações major não pertencem aos grupos de versão `minor`/`patch`; quando propostas, permanecem isoladas. Os PRs resultantes seguem o mesmo fluxo de revisão e CI dos demais PRs. A configuração não habilita auto-merge nem concede acesso a segredos.

## Preparar release

### Entrada e gate inicial

O workflow é manual e compartilha o grupo de concorrência `release-producao` com a promoção, sem cancelar uma execução em andamento. As entradas são versão, resumo final da atualização, seleção de Windows/Linux/macOS, confirmação de omissões e modo `criar` ou `retomar`.

`scripts/release/validar-solicitacao.mjs` bloqueia a execução quando:

- a referência não é `refs/heads/main`;
- a versão não é SemVer ou diverge de `package.json`;
- o modo não é reconhecido;
- o resumo tem menos de 10 caracteres ou contém placeholder;
- nenhuma plataforma foi selecionada;
- uma plataforma foi omitida sem `CONFIRMO`.

No modo `criar`, tag e release da versão devem estar ausentes. No modo `retomar`, a tag existente define o commit; antes da agregação, a release correspondente deve ser um rascunho sem assets.

### Builds e artefatos temporários

Os jobs selecionados fazem checkout do mesmo commit, usam Node.js 24, executam `npm ci`, constroem a aplicação e empacotam sem publicar diretamente:

- Windows x64: NSIS, blockmap e `latest.yml`;
- Linux x64: AppImage, blockmap, DEB e `latest-linux.yml`;
- macOS x64 e arm64: DMG e ZIP experimentais.

O upload temporário falha se os padrões não encontrarem arquivos. O Windows possui uma barreira adicional: a versão dentro de `app.asar` e a versão de produto do executável devem coincidir com a versão solicitada. Não há verificação interna equivalente para Linux ou macOS.

### Agregação protegida

`Assinar e criar rascunho` só executa quando a validação passou e cada build foi concluído ou corretamente ignorado. O job usa o environment `release`, `contents: write` e o secret `CHAVE_PRIVADA_ASSINATURA`.

A agregação baixa os artefatos temporários, troca espaços por pontos nos nomes públicos, cria ou confirma a tag imutável e chama `gerar-manifesto.mjs`. O script identifica plataforma e arquitetura pelo nome do artefato temporário, inclui apenas formatos instaláveis, calcula tamanho e SHA-256, monta URLs HTTPS, normaliza o contrato e assina a serialização canônica com Ed25519. Windows e Linux usam o canal `stable`; macOS usa `experimental`.

A release é criada em rascunho com instaladores, metadados do electron-builder, `manifesto.json`, assinatura e notas iniciais. As notas nascem com seções pendentes e precisam ser completadas antes da promoção.

### Falhas parciais

A preparação não é transacional. A tag é enviada antes da geração do manifesto e da criação do rascunho; uma falha posterior pode deixar somente a tag. O modo `retomar` exige também um rascunho vazio, portanto não recupera automaticamente todo estado parcial possível. O fluxo falha diante de destinos ou nomes ambíguos e não substitui assets de release publicada.

## Promover release

### Modos e validação

O workflow aceita `promover`, `reprocessar-feed` e `suspender`; suspensão exige motivo. Ele só inicia na `main`, compartilha `release-producao`, usa o environment `release` e valida que a versão de `package.json` coincide com a solicitada.

Antes de alterar o estado público, o workflow confere tag, release, commit quando `targetCommitish` é um SHA completo, estado de rascunho conforme o modo, manifesto, assinatura, notas e assets. `scripts/release/validar-promocao.mjs` usa a chave pública Ed25519 embutida e bloqueia:

- assinatura inválida ou versão divergente;
- notas sem título ou seções obrigatórias, com placeholders ou sem commit, manifesto e assinatura;
- resumo das notas divergente de `manifesto.notas`;
- assets ausentes, duplicados ou com tamanho divergente;
- URL que não corresponda ao asset esperado. Durante o rascunho, a URL temporária da API do GitHub também é aceita.

`promover` publica o rascunho. `reprocessar-feed` exige release já pública e não republica binários. `suspender` mantém a release pública para download manual, acrescenta às notas um marcador idempotente e a exclui do feed subsequente.

### Feed e Pages

O workflow lista até 100 releases públicas, baixa manifesto e assinatura de cada uma e materializa `.suspensa` para releases marcadas nas notas. `gerar-feed.mjs`:

1. normaliza e verifica cada manifesto com a chave pública padrão;
2. ignora releases suspensas;
3. escolhe a maior versão SemVer por canal, plataforma e arquitetura;
4. gera um índice canônico e uma assinatura Ed25519 para cada destino;
5. inclui `index.html` e `logo.png` no conjunto estático.

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
- aceitação da URL temporária do GitHub no rascunho.

A própria CI executa esses testes. Permanecem dependentes do GitHub Actions e de validação operacional: matriz nativa de empacotamento, environments, permissões, tag/release, download/upload de assets, publicação, deploy do Pages e verificação HTTPS.

## Arquivos que mudam juntos

| Alteração | Revisar em conjunto |
|---|---|
| comandos ou gates da CI | `.github/workflows/ci.yml`, `package.json` e testes afetados |
| política de dependências | `.github/dependabot.yml`, CI e proteção da `main` |
| plataforma, arquitetura ou formato | `release.yml`, `electron-builder.yml`, `gerar-manifesto.mjs`, `manifesto.mjs`, atualizador e testes |
| manifesto ou assinatura | scripts de release, chave pública do aplicativo, serviço de atualização e testes |
| notas ou assets obrigatórios | preparação, `validar-promocao.mjs` e testes de promoção |
| canal, suspensão ou seleção da versão | `promover-release.yml`, `gerar-feed.mjs`, consumidor do feed e testes |
| publicação do feed | jobs de promoção, environments `release` e `github-pages` e URL-base consumida pelo aplicativo |
