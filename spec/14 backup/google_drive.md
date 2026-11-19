# Cópias de laudos no Google Drive

## Escopo e fontes de verdade

Esta spec cobre as cópias remotas cifradas de laudos no Google Drive. Elas usam o pacote de um laudo e não substituem o backup local `.lawdo-backup`: modalidades, senha e restauração do arquivo local permanecem em [Backup do usuário](backup_usuario.md).

| Responsabilidade | Fonte |
| --- | --- |
| Página, confirmação de envio, prévia e restauração | `src/renderer/pages/GoogleDrivePage.tsx` e `src/renderer/components/google-drive/EnviarCopiaGoogleDriveDialog.tsx` |
| Contratos do renderer | `src/shared/types/google-drive.types.ts`, `src/preload/index.ts` e `src/renderer/index.tsx` |
| Autorização IPC, cache temporário e restauração | `src/main/ipc/handlers/google-drive.handlers.ts` |
| OAuth, Drive, fila e consistência remota | `src/main/services/google-drive.service.ts` |
| Credencial empacotada e pacote cifrado | `src/main/services/google-drive-oauth.service.ts` e `src/main/services/google-drive-pacote.service.ts` |
| Formato do conteúdo e importação do laudo | `src/main/services/laudo-bkp.service.ts` |

A conta é vinculada ao usuário autenticado da janela; o handler sempre exige a sessão antes de executar. A integração aceita apenas conta institucional `@policiacientifica.pr.gov.br`, depende de `safeStorage` e de uma credencial OAuth distribuída com a instalação. A ausência de qualquer um desses requisitos bloqueia a conexão em vez de degradar para armazenamento de token em texto.

## Conexão, estado e persistência

A conexão abre uma autorização OAuth local e solicita identidade, `drive.file` e `drive.appdata`. Tokens, e-mail, preferência de envio automático, fila, revisões conhecidas, verificações e resumo em cache são chaves por usuário na configuração local. Tokens são gravados como segredo via `safeStorage`; respostas JSON dessa configuração são validadas antes do uso. Desconectar remove credenciais e estado da conexão e descarta os pacotes temporários da janela.

A raiz visível é `Meu Drive/laWdo`; a chave de recuperação do pacote permanece na área privada do aplicativo do Drive. Antes de permitir cópias, o serviço verifica essa chave. Cópias existentes sem chave impedem novos envios: criar outra chave não recuperaria o conteúdo já publicado. A página pode mostrar uma lista de até cinco minutos em cache quando a atualização remota falha, sinalizando que ela está desatualizada; ações de conteúdo continuam conferindo o Drive.

## Criação, cifragem e substituição

O envio gera primeiro o pacote local de um único laudo, incluindo apresentação e figuras, calcula seu SHA-256 e então cifra o resultado em AES-256-GCM. O arquivo remoto começa com `LAWDO-DRIVE-1`, IV de 12 bytes e tag de 16 bytes; o tamanho máximo é 20 GiB. O pacote é organizado por ano, mês e REP, e recebe metadados com identificador do laudo, REP, hash e versão.

O envio manual pode incluir laudo em andamento; o automático aceita apenas concluído ou entregue. Os dois exigem data de referência válida. Se a cópia remota tiver o mesmo hash, não há novo upload. Havendo cópia diferente, o envio manual exige confirmação explícita; o automático recusa divergência remota para não sobrescrever alteração feita por outra instalação. A nova cópia é baixada, decifrada e lida localmente antes de as cópias anteriores serem removidas. Portanto, uma falha ao excluir a cópia antiga pode deixar uma nova cópia válida junto da anterior.

O envio automático enfileira a conclusão quando ativado e processa uma fila por usuário, sem concorrência entre processamentos da mesma conta. Falhas transitórias permanecem pendentes e são reagendadas; conteúdo com imagem externa e falta de cota ficam em `aguardando_correcao`, sem repetição automática até correção ou nova condição. Falhas registram etapa, código e tentativa para diagnóstico.

## Consulta, verificação, prévia e restauração

A listagem aceita somente arquivos marcados como backup sob a raiz do laWdo. Verificar baixa, decifra e lê o pacote, transmite progresso por evento IPC e pode ser cancelado apenas pela mesma janela e usuário que iniciou a operação. O resultado registra a revisão verificada.

Prévia e restauração reutilizam um cache de pacote associado à janela e ao usuário, válido por cinco minutos. Antes de visualizar, restaurar ou mover à lixeira, o main confere que a cópia ainda pertence à raiz e que sua revisão não mudou. A prévia entrega HTML e contexto; a restauração primeiro calcula conflitos, devolve uma operação temporária e só importa depois de confirmação explícita. A confirmação requer a mesma janela, usuário, operação não expirada e revisão inalterada, e delega a importação ao fluxo de `laudo-bkp`. Fechar a janela, desconectar, expirar ou encerrar o app descarta cache, operações e downloads temporários.

Excluir não apaga a chave privada nem arquivos compartilhados: envia para a Lixeira apenas a pasta exclusiva da cópia, após conferir a revisão. O cache local correspondente é descartado.

## Contratos e alterações coordenadas

Os canais `google-drive:*` são wrappers específicos do preload; cada resposta segue `RespostaGoogleDrive` e devolve diagnóstico de etapa/código em falha. Adicionar uma ação exige manter alinhados handler, lista permitida, wrapper, `ApiGoogleDrive`, declaração de `window.ipcAPI`, página e testes. Mudanças no formato do pacote ou na importação exigem revisar esta spec junto de `laudo-bkp.service.ts` e da documentação de backup local.

A cobertura atual está em `src/__tests__/main/google-drive.service.test.ts` e `src/__tests__/main/google-drive.handlers.test.ts`; ela usa respostas simuladas e não acessa contas nem arquivos reais do Drive.
