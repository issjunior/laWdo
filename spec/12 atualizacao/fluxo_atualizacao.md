# Fluxo de atualização do aplicativo

## Escopo e fontes de verdade

O laWdo consulta o feed assinado, valida o artefato, baixa-o e aciona a instalação quando o formato permite. O produtor do feed está em `spec/11 github actions/workflows_github_actions.md`; o consumidor é `src/main/services/atualizacao.service.ts`. O contrato remoto continua sendo normalizado e verificado com a chave Ed25519 de `src/shared/atualizacao/chave-publica-release.ts` antes de qualquer download ou execução.

A atualização persistida usa `userData/atualizacoes` para pacote e pendência, e `userData/backups-atualizacao` para a transação de recuperação. O renderer não mantém esse estado em localStorage. `Header.tsx` apenas consulta e apresenta o contrato tipado via preload e handlers.

## Consulta, download e instalação

O serviço consulta o feed estável por plataforma e arquitetura, com timeout, valida SemVer, formato, nome, URL HTTPS, tamanho, SHA-256 e assinatura. Somente versão superior e artefato compatível tornam a atualização disponível. O download usa arquivo parcial e só promove o pacote após validar tamanho e hash.

Antes da instalação imediata, o processo principal recebe a autorização de reinício do mesmo webContents; alterações pendentes impedem o avanço. Durante uma pendência agendada, a validação do pacote local é repetida. NSIS instala silenciosamente; AppImage substitui e reabre quando aplicável; DEB, DMG e ZIP permanecem instalação manual.

## Transação de recuperação de dados

`RecuperacaoAtualizacaoService`, em `src/main/services/recuperacao-atualizacao.service.ts`, substitui o backup pré-atualização usado pelo fluxo automático. Antes de executar o instalador, ele cria uma transação com identificador aleatório e marcador atômico `recuperacao-atualizacao-pendente.json`. O marcador inclui versões de origem e destino, schema de origem, diretório do snapshot e o estado `preparada` ou `iniciada`.

O snapshot inclui uma cópia consistente e validada do SQLite e, quando existirem, as árvores `imagens`, `avatars` e `gdl`. Cópias de arquivos são conferidas por SHA-256. Caches, logs e temporários fora dessas árvores não pertencem ao conjunto protegido. A ausência do banco, falha de cópia, hash divergente ou `PRAGMA integrity_check` diferente de `ok` impede a instalação.

Na abertura da versão destino, o marcador passa para `iniciada` antes do banco ser preparado. A atualização é confirmada somente após o banco migrar, os serviços essenciais serem inicializados e a janela principal ser criada. A confirmação remove apenas o marcador; o snapshot permanece para inspeção e não há retenção automática implementada para essas transações.

Se a abertura falhar antes dessa confirmação, o processo fecha a conexão SQLite e tenta restaurar. Na abertura seguinte da mesma versão destino, o serviço valida novamente o snapshot, move banco e árvores ativos para `recuperacao-atualizacao-falha-<id>` e repõe o conjunto protegido. O marcador só é removido depois da reposição. Snapshot inválido, ausente ou falha de I/O não sobrescrevem os dados ativos e preservam os artefatos para investigação.

A recuperação automática cobre dados locais, não o binário. Após restaurar os dados, o usuário pode abrir a versão atual conscientemente ou fechar o aplicativo e reinstalar manualmente a versão anterior. Não há download nem reinstalação automática de instalador histórico neste estado.

## Diagnóstico e interface

Em uma recuperação, o processo principal gera um relato sanitizado e o copia para a área de transferência antes de mostrar o diálogo. O relato contém código estável, horário, versões e schema de origem/destino quando disponível, resultado e a orientação de anexar logs pelo canal autorizado. Ele termina com `izaias.santos@policiacientifica.pr.gov.br` e `https://github.com/issjunior/laWdo`.

O relato não inclui conteúdo de REP ou laudo, nomes, credenciais, chaves, URLs recebidas do feed, caminhos pessoais nem stack traces. O modal de Atualizações mantém a cópia dos detalhes de falhas usuais, com a mesma orientação e contatos.

## Invariantes e verificação

- Nenhum pacote é instalado sem manifesto assinado, nome, tamanho e hash validados.
- O snapshot consistente e seu marcador precisam existir antes de iniciar o instalador.
- Dados ativos só são substituídos depois de validar novamente o SQLite de recuperação.
- Falha de recuperação nunca é apresentada como sucesso e conserva marcador ou artefatos para diagnóstico.
- A restauração automática não deve ser confundida com rollback de binário.

`src/__tests__/main/atualizacao.service.test.ts` cobre as etapas de atualização já existentes. `src/__tests__/main/recuperacao-atualizacao.service.test.ts` cobre snapshot, interrupção da primeira abertura, restauração de banco/imagens/avatares/GDL, confirmação de saúde, snapshot corrompido e relato sanitizado. `src/__tests__/renderer/header-atualizacao.component.test.tsx` cobre a cópia dos contatos no diagnóstico de atualização. A validação de instalador NSIS ou AppImage real permanece manual e é necessária quando Electron, electron-builder, NSIS, permissões ou o mecanismo de atualização forem alterados.
