# Credencial OAuth do Google Drive

O segredo do cliente OAuth é mantido fora do repositório. Para releases, cadastre-o como `LAWDO_GOOGLE_CLIENT_SECRET` no ambiente protegido `release` do GitHub. Os jobs de empacotamento usam o segredo para criar `build/google-drive-oauth.dat`, recurso ofuscado que é incorporado ao instalador; o arquivo temporário é apagado após o empacotamento.

## Desenvolvimento local

Para desenvolvimento autorizado, crie localmente o arquivo ignorado `build/google-drive-oauth.local` contendo somente o segredo. Também é possível definir `LAWDO_GOOGLE_CLIENT_SECRET` somente na sessão local do terminal. Nunca registre, envie ou versione esse valor.

Os comandos `npm run dev` e `npm run dev:diagnostico` procuram essas duas fontes automaticamente. Quando encontram uma delas, geram `build/google-drive-oauth.dat` antes do build e usam esse arquivo na execução. Os dois arquivos em `build/` são ignorados pelo Git e permanecem apenas na máquina local.

Sem uma credencial local, os comandos continuam abrindo o laWdo, mas a conexão com o Google Drive fica indisponível e o terminal informa onde encontrar esta orientação. Para habilitá-la, obtenha o segredo com o responsável autorizado, salve-o no arquivo local e execute novamente o comando. Não compartilhe o segredo em conversas, issues, logs ou pull requests.

O segredo OAuth identifica o aplicativo laWdo perante o Google. Ele é diferente da autorização da sua conta institucional, que ocorre no navegador depois que o botão de conexão é acionado. A versão instalada já traz o recurso OAuth preparado durante o empacotamento; as execuções de desenvolvimento preparam a cópia local a partir do segredo da máquina.

## Rotação

1. Crie uma nova chave secreta para o cliente OAuth no Google Cloud e guarde-a no cofre institucional.
2. Atualize `LAWDO_GOOGLE_CLIENT_SECRET` no ambiente protegido `release`.
3. Gere uma release, conecte a conta institucional de piloto e valide conexão, reinício, renovação e um backup completo.
4. Publique a release. Instalações anteriores devem ser atualizadas e reconectadas antes da desativação da chave anterior.
5. Desative a chave anterior somente após concluir a migração.
