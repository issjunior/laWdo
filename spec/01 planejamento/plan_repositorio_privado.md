# Plano de migração: código privado e distribuição pública

## Objetivo

Separar o projeto em dois repositórios GitHub, preservando a página pública e o canal de atualização já usado pelo aplicativo:

| Repositório | Visibilidade | Responsabilidade |
|---|---|---|
| `issjunior/laWdo-codigo` | privado | código-fonte, histórico de desenvolvimento, Issues, Pull Requests, CI, builds, secrets e assinatura |
| `issjunior/laWdo` | público | README de apresentação, GitHub Pages, feed assinado e Releases com os instaladores oficiais |

O endereço `https://issjunior.github.io/laWdo/` deve permanecer como origem pública do feed. O aplicativo continuará consultando `https://issjunior.github.io/laWdo/stable`.

## Princípios e decisões

- O repositório público não receberá código-fonte do aplicativo, dependências, logs de CI ou a chave privada Ed25519.
- O repositório privado será a única fonte de verdade do código e a única origem dos builds.
- Toda versão do aplicativo terá dois registros distintos:
  - uma tag `vX.Y.Z` no repositório privado, apontando para o commit-fonte imutável que foi compilado;
  - uma Release pública `vX.Y.Z` no repositório público, contendo os instaladores para download.
- A tag pública é apenas um marcador de distribuição. Ela não deve ser tratada como o commit-fonte do aplicativo. O `commit` assinado dentro de `manifesto.json` permanece a referência auditável do código privado usado no build.
- O repositório público será publicado pelo branch `gh-pages`. O workflow privado enviará o feed já gerado a esse branch; assim não será necessário executar `actions/deploy-pages` no repositório privado nem expor código.
- A publicação cruzada usará um token de acesso fino, salvo exclusivamente no environment `release` do repositório privado e limitado ao repositório público `issjunior/laWdo`.

## Estado atual relevante

Atualmente `.github/workflows/release.yml` e `.github/workflows/promover-release.yml` usam `GITHUB_REPOSITORY` para duas responsabilidades que, depois da separação, serão diferentes:

1. manipular código, tags, CI e artifacts do projeto;
2. criar, consultar e publicar Releases e a página de distribuição.

Também existem dependências explícitas do destino público:

- `src/main/services/atualizacao.service.ts` fixa `URL_FEED` em `https://issjunior.github.io/laWdo/stable`;
- `release.yml` monta as URLs dos assets com `https://github.com/$GITHUB_REPOSITORY/releases/download/v$VERSAO`;
- `promover-release.yml` baixa históricos por `https://issjunior.github.io/laWdo/historico/...` e implanta o feed via GitHub Pages;
- os artifacts temporários de build não definem retenção curta e, em repositório privado, passarão a consumir armazenamento da conta.

## Variáveis de configuração propostas

Centralizar nomes de destino nos workflows, sem alterar a URL já consumida pelo aplicativo:

```yaml
env:
  REPOSITORIO_CODIGO: ${{ github.repository }}
  REPOSITORIO_DISTRIBUICAO: issjunior/laWdo
  URL_BASE_DISTRIBUICAO: https://issjunior.github.io/laWdo
```

Adicionar no environment `release` do repositório privado:

| Secret | Escopo mínimo | Finalidade |
|---|---|---|
| `CHAVE_PRIVADA_ASSINATURA` | já existente | assinar manifesto e feed no ambiente privado |
| `TOKEN_PUBLICACAO_DISTRIBUICAO` | fine-grained, somente `issjunior/laWdo`, `Contents: read/write` | criar tag/Release pública e atualizar `gh-pages` |

O token não deve ter acesso ao repositório privado, a organizações adicionais, Actions administrativas ou secrets. Preferir GitHub App se futuramente houver mais automações; para esta migração, um fine-grained PAT com validade e rotação documentadas é suficiente.

## Fase 0 — Preparação e ponto de retorno

1. Criar uma janela de manutenção: não preparar nem promover release durante a migração.
2. Registrar os valores atuais antes de qualquer mudança:
   - URL pública do Pages;
   - última Release pública, suas tags, assets e hashes;
   - configuração de Pages, environment `release`, branch protection e secrets;
   - lista de forks, Issues e PRs relevantes.
3. Fazer clone espelho local de segurança e confirmar que todas as tags `v*` estão presentes.
4. Criar uma checklist de retorno: enquanto o repositório original ainda estiver público, a volta consiste em cancelar a migração e manter os workflows atuais.
5. Não alterar `URL_FEED` no aplicativo nesta fase: a meta é preservar o mesmo endereço.

## Fase 1 — Separar os repositórios no GitHub

1. Renomear o repositório atual `issjunior/laWdo` para `issjunior/laWdo-codigo`.
2. Confirmar que o clone de desenvolvimento aponta para o novo remoto e atualizar `origin` local para `https://github.com/issjunior/laWdo-codigo.git`.
3. Alterar a visibilidade de `laWdo-codigo` para privada somente depois de validar o clone, as tags e o acesso de quem desenvolverá o projeto.
4. Criar um novo repositório público vazio chamado exatamente `issjunior/laWdo`.
5. No novo repositório público:
   - criar um `README.md` de apresentação, instalação e link para a página;
   - criar o branch `gh-pages` sem código do aplicativo;
   - configurar GitHub Pages para publicar a raiz do branch `gh-pages`;
   - confirmar que `https://issjunior.github.io/laWdo/` volta a responder antes de concluir a mudança.
6. Desativar Issues, Discussions, Wiki e Projects no repositório público se a intenção for que ele seja somente vitrine e distribuição.

> Atenção: a alteração de visibilidade pode alterar a URL do Pages e interromper temporariamente o site. A confirmação por HTTPS da URL original é um gate obrigatório antes de liberar uma nova release.

## Fase 2 — Adaptar o workflow de preparação de release

Arquivo principal: `.github/workflows/release.yml` no repositório privado.

1. Manter no repositório privado:
   - atualização de `package.json` e `package-lock.json`;
   - PR automático de versão e merge na `main` privada;
   - despacho e espera da CI privada pelo SHA exato;
   - builds Windows, Linux e macOS;
   - criação da tag privada `vX.Y.Z` no commit-fonte;
   - geração e assinatura do manifesto;
   - artifacts temporários e o artifact `manifesto-assinado-X.Y.Z`.
2. Consultar a última versão publicada no repositório público (`REPOSITORIO_DISTRIBUICAO`) ao calcular o próximo patch. Isso preserva a semântica de “última versão disponível ao usuário”, mesmo que o código privado tenha tags de tentativas interrompidas.
3. Gerar o manifesto com a URL dos assets públicos:

```text
https://github.com/issjunior/laWdo/releases/download/vX.Y.Z
```

4. Substituir a criação do rascunho no repositório privado por publicação no repositório público:
   - obter ou criar um commit marcador no repositório público;
   - criar a tag pública `vX.Y.Z` nesse commit marcador;
   - executar `gh release create` ou `gh release edit/upload` com `--repo issjunior/laWdo`;
   - enviar somente instaladores reconhecidos pelo manifesto e as notas públicas;
   - criar a Release como rascunho.
5. Não publicar `manifesto.json`, `.sig`, logs, artefatos temporários ou código no repositório público. O manifesto só aparece no feed do Pages depois de a promoção validar a release.
6. Definir `retention-days: 3` nos artifacts temporários de Windows, Linux e macOS. Manter 90 dias apenas para `manifesto-assinado-X.Y.Z`, que é pequeno e usado para reprocessar o feed.

## Fase 3 — Adaptar promoção, feed e Pages

Arquivo principal: `.github/workflows/promover-release.yml` no repositório privado.

1. Separar os alvos em todas as chamadas `gh`:
   - artifacts do Actions: `REPOSITORIO_CODIGO` privado;
   - Releases públicas e assets: `REPOSITORIO_DISTRIBUICAO` público.
2. Atualizar a validação de promoção para conferir:
   - a Release pública, seus assets e suas notas no repositório público;
   - o manifesto e assinatura obtidos do artifact privado ou do histórico do Pages;
   - o `manifesto.commit` contra a tag privada correspondente, e não contra a tag pública de distribuição.
3. Preservar os três modos atuais:
   - `promover`: publicar o rascunho público e gerar o novo feed;
   - `reprocessar-feed`: usar Release pública + histórico Pages + artifact privado para reconstruir o feed;
   - `suspender`: registrar a marca de suspensão nas notas da Release pública e removê-la do feed seguinte.
4. Substituir os jobs `preparar-pages` e `implantar-pages` por um job no repositório privado que:
   - faz checkout autenticado do branch público `gh-pages`;
   - substitui somente o conteúdo gerado do feed (`stable/`, `experimental/`, `historico/`, `index.html` e `logo.png`);
   - cria um commit de publicação sem incluir dados privados;
   - envia o commit ao `gh-pages` público usando `TOKEN_PUBLICACAO_DISTRIBUICAO`;
   - baixa novamente todos os arquivos por `https://issjunior.github.io/laWdo/` e compara byte a byte, como já ocorre hoje.
5. Proteger o branch `gh-pages` público para que apenas o token/app de distribuição possa atualizá-lo; não permitir contribuição comum nesse branch.

## Fase 4 — Ajustar testes e documentação técnica

1. Atualizar os testes em `scripts/release/*.test.mjs` para distinguir:
   - `repositorioCodigo` privado;
   - `repositorioDistribuicao` público;
   - tag privada de origem;
   - tag pública de distribuição.
2. Adicionar cenários de falha:
   - token de publicação ausente ou sem permissão;
   - Release pública criada, mas push do feed falhou;
   - tag privada válida com tag pública ausente;
   - Release pública com asset divergente;
   - reprocessamento depois de expirar um artifact privado.
3. Revisar `spec/11 github actions/workflows_github_actions.md` e `spec/12 atualizacao/` após a implementação, pois a cadeia de confiança e a origem dos assets passam a ter dois repositórios.
4. Atualizar o README público para deixar claro que ele contém distribuição e documentação, enquanto o código é privado.

## Fase 5 — Teste de migração sem impacto ao usuário

Executar uma release de teste controlada, preferencialmente uma versão de patch real, seguindo esta ordem:

1. disparar `Preparar release` no repositório privado;
2. confirmar CI, builds, assinatura e criação do rascunho no repositório público;
3. validar manualmente que uma pessoa sem login no GitHub consegue abrir a página e baixar cada instalador público;
4. promover a release;
5. confirmar que `stable/` e os arquivos em `historico/vX.Y.Z/` são públicos e que suas assinaturas validam;
6. usar uma instalação anterior do laWdo, sem sessão GitHub, para consultar, baixar e instalar a atualização;
7. testar `reprocessar-feed`;
8. validar os fluxos de suspensão e de plataforma omitida.

## Critérios de aceite

- `laWdo-codigo` é privado e contém todo o código-fonte e os secrets.
- `laWdo` é público e não contém código-fonte do aplicativo nem dados sensíveis.
- `https://issjunior.github.io/laWdo/` e `https://issjunior.github.io/laWdo/stable` respondem publicamente.
- A Release pública possui somente os instaladores e notas previstos.
- Uma máquina sem acesso ao GitHub consegue atualizar o aplicativo.
- O workflow privado consegue preparar, promover, reprocessar e suspender versões.
- Os artifacts temporários têm retenção curta e o uso mensal de Actions é acompanhado.
- Não existe token com acesso de escrita mais amplo do que o necessário.

## Rollback

Se algum gate falhar antes da primeira release pública validada:

1. não tornar `laWdo-codigo` privado ou restaurar sua visibilidade pública temporariamente;
2. reverter os workflows para usar um único `GITHUB_REPOSITORY`;
3. manter ou restaurar o Pages original em `https://issjunior.github.io/laWdo/`;
4. não publicar uma versão cuja atualização ponta para assets inacessíveis;
5. registrar a causa e repetir a migração somente após corrigir o ponto de falha.

Depois de uma Release pública distribuída pelo novo desenho, rollback exige preservar também o repositório público `laWdo`, pois instalações existentes dependerão dele para feed e downloads.
