# Recuperação pré-atualização

## Responsabilidade

A proteção de dados antes da instalação automática é responsabilidade de `RecuperacaoAtualizacaoService`, em `src/main/services/recuperacao-atualizacao.service.ts`. `AtualizacaoService` chama `preparar(versaoDestino)` após a autorização de reinício, ou antes de executar uma pendência agendada. Esta política substitui o uso ativo de `BackupAtualizacaoService` no fluxo de atualização.

O mecanismo protege uma atualização interrompida antes de a versão nova completar a abertura. Ele não é o backup comum do usuário, não substitui exportações de backup e não faz rollback automático do executável.

## Conjunto protegido e formato persistido

| Item | Origem | Destino no snapshot |
|---|---|---|
| SQLite | `userData/laudopericial.db` | `backups-atualizacao/transacao-<id>/laudopericial.db` |
| imagens | `userData/imagens` | `transacao-<id>/imagens` |
| avatares | `userData/avatars` | `transacao-<id>/avatars` |
| estado local GDL | `userData/gdl` | `transacao-<id>/gdl` |
| marcador | — | `userData/recuperacao-atualizacao-pendente.json` |

O marcador JSON formato 1 é gravado por arquivo temporário e rename. Ele guarda ID, data, versões origem/destino, schema de origem, diretório do snapshot e estado. O caminho do snapshot é aceito na leitura apenas se estiver dentro de `userData/backups-atualizacao`, evitando que um JSON inválido direcione cópias para outro local.

Caches, logs e temporários não fazem parte da transação. Cada arquivo copiado nas árvores protegidas é validado por SHA-256. O banco é criado por `criarBackupConsistente` e validado em modo somente leitura por `PRAGMA integrity_check`.

## Ciclo de vida e falhas

A preparação cria primeiro o diretório da transação, depois o banco validado e as árvores; por último escreve o marcador em `preparada`. Qualquer falha de preparação remove somente a transação parcial e bloqueia a instalação.

Na versão destino, `iniciarVersaoDestino` muda o marcador para `iniciada`. `confirmarSaude` remove o marcador somente depois do banco migrado, dos serviços essenciais e da criação da janela. O diretório do snapshot é deliberadamente mantido; não existe política de retenção automática para esse conjunto no estado atual.

Quando há falha antes da confirmação, `restaurarSeInterrompida` valida novamente o banco do snapshot, fecha o banco aberto quando a falha ocorreu durante inicialização, move o estado ativo para `recuperacao-atualizacao-falha-<id>` e repõe banco e árvores protegidas. O marcador é removido apenas após a reposição. Falha de validação ou restauração preserva o ativo e os artefatos disponíveis para investigação.

Após recuperação bem-sucedida, o processo mostra e copia um diagnóstico sanitizado. O usuário pode abrir a versão atual assumindo o risco ou fechá-la e reinstalar manualmente uma versão anterior. Instalador anterior ausente não é baixado automaticamente.

## Invariantes e testes

- O instalador não começa sem snapshot SQLite íntegro e marcador persistido.
- O conjunto restaurado é banco, imagens, avatares e estado local GDL; conteúdo de REP e laudo não é mostrado no diagnóstico.
- Snapshot inválido não pode substituir o banco ativo.
- Uma recuperação preserva o estado falho separado para suporte.
- A recuperação de dados não confirma compatibilidade ou reinstala o binário anterior.

`src/__tests__/main/recuperacao-atualizacao.service.test.ts` protege a restauração completa, a confirmação de saúde, a recusa de snapshot corrompido e o relato sanitizado.
