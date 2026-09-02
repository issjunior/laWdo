# Fluxo de atualização do aplicativo

## Escopo e relação com GitHub Actions

Esta spec descreve o consumo de atualizações dentro do laWdo: consulta do feed, validação, download, atualização offline, autorização de reinício e instalação. A produção e publicação dos mesmos contratos está documentada em `spec/11 github actions/workflows_github_actions.md`.

A relação entre os domínios é profunda e deve permanecer explícita:

```text
spec/11 github actions
  release pública -> manifesto + assinatura -> feed por plataforma
                                            |
                                            v
spec/12 atualizacao
  consulta -> validação Ed25519 -> download -> backup -> instalação
```

Mudanças em manifesto, assinatura, canais, nomes de plataforma, arquitetura, formato, URL ou seleção de assets exigem revisão coordenada das duas specs e dos dois lados do contrato. GitHub Actions é a fonte do artefato publicado; `AtualizacaoService` é a fronteira que volta a tratar todo conteúdo remoto como não confiável.

## Fontes de verdade e responsabilidades

| Responsabilidade | Fonte atual |
|---|---|
| estado, consulta, download, offline, agendamento e instalação | `src/main/services/atualizacao.service.ts` |
| contrato compartilhado do manifesto e do estado | `src/shared/atualizacao/atualizacao.types.ts` |
| chave pública Ed25519 embutida | `src/shared/atualizacao/chave-publica-release.ts` |
| handlers e autorização de reinício | `src/main/ipc/handlers/atualizacao.handlers.ts` |
| canais permitidos e API exposta | `src/preload/index.ts` |
| interface e polling do estado | `src/renderer/components/layout/Header.tsx` |
| registro global de alterações pendentes | `src/renderer/contexts/AlteracoesPendentesContext.tsx` |
| inicialização e processamento de pendência | `src/main/index.ts` |
| backups obrigatórios | `src/main/services/backup-atualizacao.service.ts` |
| última verificação persistida | `userData/atualizacao-ultima-verificacao.json` |

O estado canônico da execução é mantido em memória pelo singleton `atualizacaoService`. Persistem em `userData`: `atualizacao-pendente.json`, usado para instalação automática na próxima inicialização; `atualizacao-ultima-verificacao.json`, que guarda `verificadoEm` em ISO 8601; e os pacotes copiados para `atualizacoes`. Esses arquivos são persistência do processo principal, não o `localStorage` do renderer.

Além do percentual legado, a resposta de estado pode conter `progressoDetalhado` com percentual inteiro, etapa e descrição. As etapas válidas são `verificando`, `baixando`, `validando`, `copiando`, `confirmando`, `backup`, `agendando` e `abrindo_instalador`.

## Estado e concorrência

Os estados públicos são:

```text
ociosa -> verificando -> disponivel -> baixando -> baixada
                                         |            |
                                         |            +-> instalando -> concluida | falhou
                                         +-> falhou
baixada -> aguardando_reinicio
```

`verificar` recusa nova operação durante verificação, download ou instalação. `baixar` exige estado `disponivel`; instalação e agendamento exigem `baixada`. O controle é uma máquina de estados em memória, não um mutex geral: a seleção offline define `verificando` diretamente e a proteção contra concorrência também depende de a interface manter apenas uma ação local ativa.

Falhas capturadas pelo serviço normalmente retornam uma resposta com `estado: falhou` e a mensagem em `erro`; o handler pode continuar retornando `success: true` porque a chamada IPC foi concluída. Erros lançados antes do bloco interno são convertidos pelo handler em `success: false`. Consumidores devem observar tanto `success` quanto `data.estado` e `data.erro`.

O serviço publica cada transição de progresso para todas as janelas não destruídas. O preload valida faixa, etapa e descrição antes de repassar `atualizacao:progresso`; o `Header` assina esse evento e combina o valor ao estado já carregado. O evento informa progresso da operação atual, não é log persistente nem mecanismo de retomada.

## Verificação online

Após o Electron ficar pronto, uma atualização agendada é processada antes da abertura do banco. Se não houver instalação pendente, a aplicação inicializa e agenda uma verificação automática com atraso aleatório entre 5 e 30 segundos.

A URL-base atual é fixa em `https://issjunior.github.io/laWdo/stable`. O serviço deriva `<plataforma>-<arquitetura>.json` e baixa em paralelo o índice e seu arquivo `.sig`. A verificação automática é limitada a uma vez a cada 24 horas usando `verificadoEm`, carregado de `userData/atualizacao-ultima-verificacao.json` ao criar o serviço. A verificação manual ignora esse limite.

`verificadoEm` só é atualizado depois que índice e assinatura foram obtidos, normalizados, autenticados e contêm artefato compatível; falhas anteriores preservam a data anterior. O arquivo é tratado como fronteira insegura: JSON inválido, objeto inesperado ou data inválida são ignorados com log de aviso. Uma falha de escrita não invalida a verificação corrente, mas pode fazer a próxima execução perder a data.

O manifesto remoto passa por normalização de tipos, SemVer, data, canais, formatos, tamanho, SHA-256, nome simples de arquivo e URL HTTPS. Em seguida, sua serialização canônica é validada com a chave pública Ed25519 embutida. Somente uma versão superior à instalada produz o estado `disponivel`.

A normalização do consumidor é implementada separadamente da normalização do produtor em `scripts/release/manifesto.mjs`. Elas precisam permanecer compatíveis, mas não compartilham a mesma função. O consumidor é atualmente menos estrito em alguns pontos: não valida o formato recebido de `versaoManifesto`, não exige padrão hexadecimal para `commit`, não exige canais não vazios nem rejeita combinações duplicadas de artefatos.

O serviço seleciona o primeiro artefato que coincidir com plataforma e arquitetura; não existe uma tabela explícita de prioridade entre formatos no consumidor. A ordenação produzida pelo feed influencia essa escolha.

### Limitação atual do canal macOS

O produtor publica pacotes macOS no canal `experimental`, mas a URL online do aplicativo está fixada em `stable`. Assim, índices macOS localizados sob `/experimental` não são descobertos pela verificação online atual. O fluxo offline ainda pode carregar um manifesto experimental válido e compatível.

## Download e atualização offline

No download online, o pacote é gravado como `<nome>.parcial` em `userData/atualizacoes`. Tamanho e SHA-256 são calculados durante o streaming; somente após coincidirem com o manifesto o arquivo é renomeado para o nome final e o estado passa a `baixada`.

Divergência de tamanho ou hash remove o arquivo parcial. Outras falhas de rede ou escrita podem deixar um `.parcial`, pois não há limpeza geral no `catch`. O pacote final existente pode ser substituído pela renomeação conforme a semântica do sistema operacional.

Na atualização offline, o usuário escolhe um JSON. A assinatura deve estar ao lado dele como `<nome-do-manifesto>.sig`, e o artefato deve estar no mesmo diretório com o nome registrado. O serviço valida assinatura, versão superior, plataforma, arquitetura, tamanho e hash antes de copiar; depois revalida a cópia dentro do diretório controlado. Online e offline convergem no mesmo estado `baixada` e reutilizam backup e instalação.

## IPC e fechamento seguro

A superfície exposta pelo preload contém consulta de estado, verificação, download, adiamento, preparação de reinício, instalação imediata, agendamento, seleção offline e resposta ao pedido de reinício. Todos os canais constam em `ALLOWED_CHANNELS`.

Antes da instalação imediata, o main envia `atualizacao:solicitar-reinicio` ao mesmo `webContents` que iniciou a ação. A resposta usa um UUID, deve vir do mesmo remetente e expira após 15 segundos. `AlteracoesPendentesProvider` autoriza somente quando nenhum registro ativo está pendente; `LaudosPage` e `WizardLaudoPage` são os registradores atuais. O mesmo contexto também usa `beforeunload` para impedir fechamento comum sem confirmação.

A autorização não salva nem descarta conteúdo: apenas permite ou bloqueia. Depois dela, o backup obrigatório precisa terminar antes de o instalador ser iniciado.

`prepararReinicio` também solicita autorização, cria o backup e muda para `aguardando_reinicio`, mas não é chamado pela interface atual. O caminho visível usa `instalarAgora` ou `agendar`.

## Instalação por plataforma

| Plataforma/formato | Instalação imediata | Agendamento |
|---|---|---|
| Windows/NSIS | inicia o instalador com `/S`, destacado, e encerra o app | suportado |
| Linux/AppImage | exige `APPIMAGE` absoluto; cria script que substitui, torna executável e reabre | suportado |
| Linux/DEB | abre o pacote pelo sistema para instalação manual | não suportado |
| macOS/DMG ou ZIP | abre o pacote pelo sistema para instalação manual | não suportado |

No instalador NSIS do Windows, a desinstalação manual oferece uma seção opcional para apagar os dados locais do laWdo, após confirmação explícita. Ela remove diretórios de dados do produto no escopo de instalação, incluindo laudos, imagens, configurações, credenciais, logs e pacotes locais. Atualizações (`isUpdated`) não exibem nem executam essa remoção; o fluxo de atualização preserva dados e continua exigindo o backup prévio normal.

O agendamento grava `atualizacao-pendente.json` por arquivo temporário e renomeação, depois muda para `aguardando_reinicio`. Na abertura seguinte, antes do banco, o registro é normalizado, o pacote controlado é revalidado e o backup é criado. O arquivo de pendência é removido antes de chamar o instalador; se a chamada falhar depois da remoção, não há retry automático. Falhas são registradas e a inicialização normal prossegue.

## Interface

`Header` consulta o estado ao montar e repete a consulta a cada 30 segundos. A interface separa duas responsabilidades:

- **Informações** permanece visível com nome, versão do sistema e banco, ambiente, sistema operacional, memória e contatos;
- **Atualizações** aparece normalmente somente como ícone. Quando o estado indica atualização disponível, o gatilho acrescenta o texto **Atualização**, usa destaque verde e mostra o badge **Nova versão**.

O modal **Atualizações** segue a mesma largura, hierarquia visual e cores do modal **Informações**. Ele sempre mostra a versão atual do laWdo; mostra também a última verificação persistida, quando válida, e o status. Verificação manual e seleção offline ficam centralizadas na primeira linha de ações. Download, instalação, agendamento e adiamento aparecem conforme o estado. O renderer apresenta versão disponível, data, formato, tamanho, notas, progresso e erro; o processo principal continua responsável por rede, arquivos, assinatura, backup e execução.

O botão de agendamento só aparece para NSIS ou AppImage. O indicador acessível considera `disponivel`, `baixando`, `baixada` e `aguardando_reinicio` como atualização disponível.

## Invariantes e alterações coordenadas

- Nenhum pacote pode ser instalado sem assinatura válida do manifesto e validação local de nome, tamanho e SHA-256.
- Apenas arquivos dentro de `userData/atualizacoes` podem ser executados ou agendados.
- Versão igual ou inferior à instalada não é aceita.
- Backup pré-atualização é obrigatório antes de instalar; o tipo depende de `requerBackupCompletoImagens`.
- Alterações em canais, manifesto, chave ou formatos devem revisar `spec/11 github actions/workflows_github_actions.md`, scripts de release, tipos compartilhados e consumidor.
- Novos canais IPC exigem handler, `ALLOWED_CHANNELS`, API do preload e tipos alinhados.
- Novas telas editáveis que devam bloquear atualização precisam registrar seu estado em `AlteracoesPendentesContext`.
- `verificadoEm` precisa continuar sendo validado ao cruzar o arquivo JSON de `userData`; não deve ser movido para `localStorage`, pois o processo principal usa essa data antes e independentemente do renderer.

## Cobertura atual

`src/__tests__/main/atualizacao.service.test.ts` cobre estado inicial, falha de índice, recusa de download sem versão disponível, assinatura offline inválida, persistência da última verificação entre inicializações e persistência de pacote automático validado. Permanecem sem teste automatizado ponta a ponta: download válido, autorização IPC e timeout, instalação por processo, AppImage real, integração do Header, consulta ao Pages e ciclo completo entre release publicada e aplicativo.
