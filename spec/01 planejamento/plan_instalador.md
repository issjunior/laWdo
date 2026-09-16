# Plano de robustez do instalador, atualizador e desinstalador do laWdo

## Finalidade

Este documento orienta a evolução do ciclo de instalação do laWdo no Windows, desde o primeiro uso até atualização, reparo e desinstalação. Ele registra decisões de produto, riscos, comportamento esperado, alterações técnicas e critérios de aceite.

Este é um plano de implementação, não uma descrição do estado atual. Depois da implementação e validação, as specs de estado atual dos domínios de release e atualização deverão ser revisadas pelo fluxo `/spec`.

## Objetivos

- oferecer instalação simples, previsível e exclusiva para o usuário atual;
- preservar banco, laudos, imagens, configurações e credenciais durante instalação, reparo e atualização;
- permitir remoção completa dos dados somente em uma desinstalação manual e após confirmação explícita;
- manter dois caminhos de atualização compreensíveis para o usuário;
- impedir downgrade acidental e reduzir o risco de incompatibilidade de schema;
- retirar o fluxo de atualização offline baseado em arquivos auxiliares;
- transformar instalação, atualização e desinstalação em gates verificáveis de release.

## Decisões consolidadas

| Tema | Decisão |
|---|---|
| plataforma deste plano | Windows x64 com instalador NSIS |
| escopo da instalação | somente usuário atual |
| pasta do programa | fixa em `%LOCALAPPDATA%\Programs\laWdo` |
| escolha de pasta | não oferecida |
| privilégios administrativos | não exigidos no fluxo normal |
| atalhos | Desktop e menu Iniciar |
| assinatura Authenticode | fora do escopo; o pacote continuará sem assinatura por enquanto |
| atualização manual | execução do instalador `.exe` baixado do canal oficial |
| atualização recomendada | verificação, download e instalação pelo Header do laWdo |
| atualização offline | removida; não haverá seleção manual de JSON, assinatura ou pacote auxiliar |
| dados na atualização | sempre preservados |
| dados na desinstalação interativa | opção de exclusão marcada por padrão, seguida de confirmação explícita |
| desinstalação silenciosa | preserva dados por padrão; exclusão exige parâmetro explícito |

## Fora de escopo

- instaladores macOS e Linux;
- instalação para todos os usuários da máquina;
- implantação corporativa por MSI, Intune, GPO ou ferramenta equivalente;
- aquisição e gestão de certificado de assinatura de código;
- atualização por pacote offline, pendrive ou conjunto de arquivos locais;
- restauração automática de backup pelo instalador ou desinstalador.

## Evidências do ensaio com a versão 0.1.11

O ciclo manual realizado em 16/09/2026 estabeleceu a linha de base abaixo.

### Instalação

- O SmartScreen exibiu **O Windows protegeu o computador**.
- O instalador e o executável estavam sem assinatura digital e foram mostrados como provenientes de fornecedor desconhecido.
- O instalador exibiu a escolha entre todos os usuários e apenas o usuário atual.
- A instalação por usuário usou `%LOCALAPPDATA%\Programs\laWdo`.
- A tela permitiu escolher outra pasta.
- Foram criados atalhos no Desktop e no menu Iniciar.
- A opção de executar o laWdo ao concluir estava marcada.
- Os dados existentes em `%APPDATA%\laWdo` foram reutilizados e o usuário anteriormente cadastrado conseguiu entrar normalmente.

### Desinstalação

- A página de componentes mostrou apenas `Uninstall`.
- A opção planejada para excluir banco, laudos, imagens e configurações não apareceu.
- A pasta do programa, os atalhos e o registro de desinstalação foram removidos.
- `%APPDATA%\laWdo`, o banco e as imagens foram preservados.

### Causa confirmada da opção ausente

O NSIS classifica uma seção como pertencente ao desinstalador quando o nome visível é `Uninstall` ou começa com `un.`. O script atual colocou `un.` apenas no identificador interno:

```nsis
Section /o "Excluir todos os dados locais do laWdo" un.excluirDadosLocais
```

Assim, a presença da macro fez o electron-builder criar a página de componentes, mas a seção personalizada não integrou o desinstalador. O formato correto deve aplicar o prefixo ao nome da seção:

```nsis
Section "un.Excluir todos os dados locais do laWdo" un.excluirDadosLocais
```

A ausência de `/o` é intencional: a decisão de produto é deixar essa opção marcada por padrão.

## Experiência pretendida

### 1. Instalação inicial

O usuário executa o instalador oficial e percorre somente as etapas necessárias:

1. SmartScreen, enquanto o pacote permanecer sem assinatura;
2. apresentação do laWdo e confirmação de instalação;
3. progresso;
4. conclusão, com opção de iniciar o aplicativo.

O instalador não deve perguntar para quem instalar nem onde instalar. O destino é fixo e pertence ao perfil atual.

Ao concluir:

- o executável deve existir em `%LOCALAPPDATA%\Programs\laWdo`;
- os dois atalhos devem apontar para o executável instalado;
- a entrada de Aplicativos instalados deve registrar nome e versão corretos;
- dados preexistentes em `%APPDATA%\laWdo` devem permanecer intactos;
- a primeira abertura deve criar o banco apenas quando ele ainda não existir.

### 2. Reinstalação da mesma versão

A mesma versão poderá ser executada como reparo. O instalador deve informar que já existe uma instalação da mesma versão e pedir confirmação antes de substituir os arquivos do programa.

O reparo:

- não altera nem remove `userData`;
- recria arquivos do programa ausentes ou corrompidos;
- recria atalhos conforme a política definida para o produto;
- não reaplica migrações já registradas;
- não oferece exclusão de dados.

### 3. Atualização por instalador baixado

O usuário baixa uma versão mais recente no canal oficial e executa o `.exe`.

O instalador deve:

1. detectar a instalação existente pelo registro do usuário;
2. ler e comparar a versão instalada com a versão do pacote;
3. bloquear versão inferior;
4. tratar versão igual como reparo;
5. tratar versão superior como atualização;
6. exigir que o laWdo esteja fechado antes de substituir arquivos;
7. chamar o desinstalador anterior no modo de atualização;
8. preservar todos os dados e atalhos aplicáveis;
9. instalar a nova versão na mesma pasta fixa;
10. iniciar o aplicativo somente depois de a substituição terminar.

Esse caminho não possui as validações internas do atualizador do laWdo. Enquanto não houver assinatura Authenticode, a página oficial de distribuição deve apresentar, para cada versão:

- nome exato do instalador;
- versão;
- tamanho;
- SHA-256;
- orientação de que o SmartScreen mostrará fornecedor desconhecido;
- recomendação de criar backup pelo próprio laWdo antes de uma atualização manual.

O instalador nunca deve tentar migrar o SQLite diretamente. Na primeira abertura da nova versão, o fluxo normal de banco continua responsável por snapshot pré-migração, integridade e migrations.

### 4. Atualização online pelo Header

Este é o caminho recomendado. O laWdo continua responsável por:

1. consultar o feed da plataforma e arquitetura atuais;
2. normalizar o manifesto remoto;
3. verificar a assinatura Ed25519;
4. exigir versão superior à instalada;
5. selecionar o instalador NSIS compatível;
6. baixar para `userData/atualizacoes` usando arquivo parcial;
7. validar tamanho e SHA-256;
8. liberar instalação imediata ou agendamento;
9. consultar a interface sobre alterações não salvas;
10. criar o backup pré-atualização obrigatório;
11. executar o instalador com `/S`;
12. encerrar o aplicativo e deixar o NSIS substituir a versão anterior.

A atualização online nunca pode acionar a exclusão de dados. `isUpdated` deve ter precedência absoluta sobre qualquer seleção padrão ou parâmetro destrutivo do desinstalador.

### 5. Remoção da atualização offline

Não será distribuído um terceiro arquivo ou pacote para instalação manual. A opção **Atualização offline** deverá desaparecer do Header.

Remover de forma coordenada:

- o botão e o estado de ação `offline` no Header;
- `selecionarOffline` das superfícies tipadas do renderer e preload;
- o canal `atualizacao:selecionar-offline` de `ALLOWED_CHANNELS`;
- o handler que abre o seletor de JSON;
- `carregarAtualizacaoOffline` do serviço;
- mensagens e ramificações usadas apenas por pacote offline;
- o teste exclusivo de assinatura offline;
- referências nas specs de atualização.

Não remover:

- manifesto e assinatura utilizados pelo feed online;
- normalização e verificação Ed25519 do conteúdo remoto;
- validações de nome, tamanho e SHA-256;
- diretório controlado de downloads;
- instalação imediata e agendada;
- backup pré-atualização.

### 6. Desinstalação preservando dados

O usuário abre a desinstalação pelo Windows e encontra:

- **Remover o aplicativo laWdo**, obrigatório;
- **Excluir todos os dados locais do laWdo**, marcado por padrão.

Para preservar os dados, o usuário desmarca a segunda opção. A desinstalação remove:

- pasta do programa;
- atalhos;
- entrada de Aplicativos instalados;
- registros pertencentes ao instalador.

Ela preserva integralmente:

- `%APPDATA%\laWdo`;
- `%APPDATA%\laudo-pericial-electron`, se ainda existir;
- banco, laudos, imagens, configurações, credenciais, logs e backups locais.

Uma reinstalação posterior deve reconhecer o usuário, o banco e as imagens anteriores.

### 7. Desinstalação com exclusão completa

Se a opção de exclusão permanecer marcada, antes de apagar os dados o desinstalador deve exibir confirmação explícita com:

- indicação de que a ação é permanente;
- enumeração de banco, laudos, imagens, configurações, credenciais, logs, backups internos e atualizações baixadas;
- botões inequívocos para excluir ou preservar;
- preservação completa quando a confirmação for recusada.

Após confirmação, remover somente os diretórios exatos:

```text
%APPDATA%\laWdo
%APPDATA%\laudo-pericial-electron
```

Não usar curingas, caminho calculado sem validação ou remoção de diretórios pais. O instalador baixado e backups salvos pelo usuário fora de `AppData` não pertencem ao aplicativo e nunca devem ser excluídos.

### 8. Desinstalação silenciosa e atualização silenciosa

O comportamento de linha de comando deve ser explícito:

| Comando/contexto | Dados locais |
|---|---|
| desinstalação interativa, opção desmarcada | preservar |
| desinstalação interativa, opção marcada e confirmação recusada | preservar |
| desinstalação interativa, opção marcada e confirmação aceita | excluir |
| desinstalação com `/S` | preservar |
| desinstalação com `/S --delete-app-data` | excluir |
| desinstalação interna durante atualização (`--updated`) | preservar sempre |

O modo silencioso não deve abrir caixa de diálogo. Se `/S` for usado sem `--delete-app-data`, a seleção marcada por padrão na interface não pode provocar perda de dados.

## Alterações técnicas planejadas

### Configuração do electron-builder

Em `electron-builder.yml`:

- manter `target: nsis` e `arch: x64`;
- manter `oneClick: false` para suportar conclusão e fluxo assistido;
- manter `perMachine: false`;
- definir `allowToChangeInstallationDirectory: false`;
- definir `allowElevation: false`;
- manter atalhos e ícones;
- manter `include: build/installer.nsh`;
- garantir nome de artefato estável e previsível para publicação e comparação de hash.

O modo por usuário deve ser forçado no include NSIS com `customInstallMode`, definindo `isForceCurrentInstall`, para que a página de escopo seja omitida inclusive em instalação limpa.

### Include NSIS

Em `build/installer.nsh`:

- corrigir o nome visível da seção para começar com `un.`;
- remover `/o` para deixá-la selecionada por padrão;
- nomear a seção principal de forma compreensível em português;
- remover ou substituir a página de boas-vindas que hoje aparece depois da página de componentes;
- distinguir desinstalação manual, silenciosa e atualização;
- fazer `isUpdated` vencer qualquer caminho de exclusão;
- exigir `--delete-app-data` no modo silencioso;
- restaurar o contexto de shell depois de qualquer mudança;
- excluir somente os dois diretórios de dados conhecidos;
- manter mensagens e detalhes em português.

### Comparação de versão no instalador manual

Adicionar uma verificação anterior à substituição dos arquivos:

- versão instalada menor: continuar como atualização;
- versão instalada igual: apresentar reparo e pedir confirmação;
- versão instalada maior: bloquear downgrade e informar as duas versões;
- valor de versão ausente ou inválido: não assumir segurança; interromper com mensagem orientando desinstalação ou suporte.

As releases de produção continuam usando SemVer estável `X.Y.Z`. Não introduzir comparação lexical simples.

### Atualizador e IPC

Remover a superfície offline mantendo as demais operações:

- consultar estado;
- verificar atualização;
- baixar;
- adiar;
- instalar agora;
- agendar;
- responder ao pedido de reinício;
- receber progresso.

Depois da remoção, alinhar handler, `ALLOWED_CHANNELS`, `IpcAPI`, tipos do renderer e consumidores. Nenhuma declaração `any` deve ser criada para compensar a remoção.

### Release e distribuição

Manter o pipeline responsável por:

- compilar o instalador Windows x64;
- gerar manifesto e assinatura usados pelo feed online;
- calcular e registrar SHA-256 do instalador;
- publicar somente artefatos reconhecidos pelo manifesto;
- expor versão, tamanho e hash na página oficial;
- testar instalação, atualização e desinstalação antes da promoção.

A falta de Authenticode deve ser tratada como limitação conhecida. Hash e assinatura do manifesto protegem o canal do laWdo, mas não eliminam o alerta do SmartScreen quando o usuário executa o instalador manualmente.

## Fases de implementação

### Fase 1 — Instalação individual e determinística

1. Fixar instalação no perfil atual.
2. Remover escolha de usuário e diretório.
3. Manter atalhos e execução ao concluir.
4. Implementar comparação entre versão instalada e pacote.
5. Validar instalação limpa, reparo, atualização e bloqueio de downgrade.

### Fase 2 — Desinstalação segura

1. Corrigir a seção NSIS ausente.
2. Marcar exclusão de dados por padrão.
3. Adicionar confirmação explícita.
4. Diferenciar fluxo interativo, `/S`, `--delete-app-data` e `--updated`.
5. Validar remoção seletiva e completa.

### Fase 3 — Simplificação do atualizador

1. Remover botão e estado offline do Header.
2. Remover IPC, preload, método do serviço e tipos exclusivos.
3. Remover o teste que cobre somente atualização offline.
4. Preservar integralmente o contrato online assinado.
5. Revisar mensagens do modal para distinguir atualização online de instalador manual.

### Fase 4 — Gates de release no Windows

1. Automatizar verificações do artefato empacotado.
2. Executar o ciclo em ambiente Windows limpo.
3. Registrar evidências de preservação e remoção de dados.
4. Impedir promoção quando instalação, atualização ou desinstalação falharem.
5. Atualizar as specs de estado atual somente depois de o comportamento ser comprovado.

## Estratégia de testes

Testes específicos são recomendados porque o fluxo modifica instalação e pode excluir dados periciais. A criação ou alteração desses testes deverá ocorrer junto da implementação aprovada deste plano.

### Validações automatizadas do código

- `npm run type-check`;
- `npm run lint`;
- `npm test`;
- `npm run test:release`;
- `npm run build`;
- `npm run pack`;
- `git diff --check`.

### Inspeção do artefato

- confirmar versão do executável empacotado;
- confirmar arquitetura x64;
- confirmar pasta padrão por usuário;
- confirmar presença do desinstalador;
- confirmar atalhos e entrada de desinstalação;
- registrar tamanho e SHA-256;
- confirmar que instalador e executável permanecem `NotSigned` enquanto essa for a decisão vigente.

### Matriz funcional

| Cenário | Resultado esperado |
|---|---|
| instalação limpa sem `userData` | cria programa e inicia fluxo de primeiro usuário |
| instalação limpa com `userData` preexistente | reconhece usuário, banco e imagens |
| tentativa de escolher todos os usuários | opção inexistente |
| tentativa de escolher outra pasta | opção inexistente |
| reparo da mesma versão | substitui programa e preserva dados |
| atualização manual para versão superior | substitui programa e preserva dados |
| tentativa de downgrade | bloqueada antes de alterar arquivos |
| atualização online válida | valida, cria backup, instala e preserva dados |
| manifesto remoto inválido | atualização bloqueada |
| hash ou tamanho divergente | atualização bloqueada e parcial descartado |
| alterações não salvas | instalação online bloqueada até autorização |
| desinstalação com exclusão desmarcada | remove programa e preserva dados |
| exclusão marcada com confirmação recusada | remove programa e preserva dados |
| exclusão marcada com confirmação aceita | remove programa e dados conhecidos |
| `/S` | remove programa e preserva dados |
| `/S --delete-app-data` | remove programa e dados conhecidos |
| atualização silenciosa | nunca exclui dados |

### Ensaio de preservação

1. Criar usuário, REP, laudo e imagens de teste.
2. Registrar versão, hash do banco, quantidade e hashes das imagens.
3. Instalar ou atualizar.
4. Abrir o laWdo e confirmar login e acesso aos registros.
5. Desinstalar com exclusão desmarcada.
6. Confirmar ausência do programa, atalhos e registro.
7. Confirmar presença dos dados.
8. Reinstalar e confirmar recuperação automática do estado anterior.

### Ensaio de exclusão completa e restauração

1. Criar e verificar um backup ZIP pelo recurso existente do laWdo, salvo fora de `AppData`.
2. Desinstalar com exclusão marcada.
3. Recusar a confirmação e comprovar preservação.
4. Repetir a desinstalação e aceitar a confirmação.
5. Confirmar ausência do programa, atalhos, registro e diretórios de dados atual e legado.
6. Reinstalar e confirmar o fluxo de primeiro usuário.
7. Restaurar o backup externo.
8. Validar usuário, REP, laudo, banco e imagens restaurados.

### Ensaio de atualização entre versões

1. Instalar uma versão anterior com dados de teste.
2. Atualizar pelo instalador baixado e validar preservação.
3. Restaurar o estado inicial do ensaio.
4. Atualizar pelo Header e validar assinatura, hash, backup e preservação.
5. Confirmar que nenhuma atualização exibiu ou executou a exclusão de dados.
6. Tentar instalar uma versão anterior e confirmar o bloqueio de downgrade.

## Critérios de aceite

- a instalação normal ocorre sem UAC e sem escolha de usuário ou diretório;
- o caminho instalado é sempre `%LOCALAPPDATA%\Programs\laWdo`;
- instalação e reparo nunca removem `userData`;
- atualização manual para versão superior funciona e downgrade é bloqueado;
- atualização online continua validando assinatura, versão, compatibilidade, tamanho e hash;
- o Header não apresenta atualização offline;
- não existe canal IPC nem método público residual para selecionar manifesto local;
- toda atualização cria o backup exigido pelo seu fluxo antes de substituir a versão;
- a desinstalação oferece a escolha de excluir dados e a exibe marcada por padrão;
- a confirmação negativa preserva integralmente os dados;
- a confirmação positiva remove somente os diretórios previstos;
- `/S` preserva dados e `/S --delete-app-data` os remove;
- `--updated` nunca permite exclusão de dados;
- reinstalação após preservação reconhece o cadastro e o conteúdo anteriores;
- restauração do backup após exclusão completa recupera banco e imagens;
- os checks e ensaios Windows obrigatórios passam antes da promoção da release.

## Rollback

Se a nova configuração impedir instalação ou atualização:

1. suspender a release no feed antes de promover outro pacote;
2. manter disponível o último instalador estável conhecido;
3. orientar o usuário a preservar `%APPDATA%\laWdo` e executar o instalador estável;
4. não recomendar downgrade quando o schema local já tiver sido migrado para uma versão incompatível;
5. restaurar backup somente pelo fluxo próprio do laWdo;
6. corrigir e republicar uma versão superior, sem reutilizar artefato ou tag já publicados.

Se a falha envolver exclusão indevida de dados, interromper imediatamente a distribuição e não retomar até reproduzir o cenário em ambiente isolado, corrigir a causa e validar restauração a partir de backup externo.

## Atualizações documentais após a implementação

Depois de comprovar o novo comportamento, executar `/spec` para revisar ao menos:

- `spec/12 atualizacao/fluxo_atualizacao.md`;
- `spec/11 github actions/workflows_github_actions.md`, caso os gates ou artefatos de release mudem;
- manifesto de cobertura das specs, se os padrões de arquivos precisarem ser ampliados.

As specs finais devem registrar somente o estado implementado. Este plano permanece como roteiro e critérios de decisão, sem ser usado como fonte de verdade sobre funcionalidades ainda não entregues.
