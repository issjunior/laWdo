# Credencial OAuth do Google Drive

O segredo do cliente OAuth é mantido fora do repositório. Para releases, cadastre-o como `LAWDO_GOOGLE_CLIENT_SECRET` no ambiente protegido `release` do GitHub. Os jobs de empacotamento usam o segredo para criar `build/google-drive-oauth.dat`, recurso ofuscado que é incorporado ao instalador; o arquivo temporário é apagado após o empacotamento.

Para desenvolvimento autorizado, crie localmente o arquivo ignorado `build/google-drive-oauth.local` contendo somente o segredo. Execute `npm run preparar:oauth-google-drive` antes de iniciar o laWdo. Nunca registre, envie ou versione esse arquivo.

## Rotação

1. Crie uma nova chave secreta para o cliente OAuth no Google Cloud e guarde-a no cofre institucional.
2. Atualize `LAWDO_GOOGLE_CLIENT_SECRET` no ambiente protegido `release`.
3. Gere uma release, conecte a conta institucional de piloto e valide conexão, reinício, renovação e um backup completo.
4. Publique a release. Instalações anteriores devem ser atualizadas e reconectadas antes da desativação da chave anterior.
5. Desative a chave anterior somente após concluir a migração.
