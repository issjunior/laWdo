# OAuth do Google Drive

O laWdo usa o cliente OAuth institucional do tipo Desktop, com PKCE S256, navegador do sistema e retorno em `127.0.0.1` com porta aleatória. O `client_id` é público e fica no código. O `client_secret` exigido pelo cliente é provisionado fora do Git e incluído no instalador como recurso ofuscado; ele deve ser tratado como extraível do aplicativo, não como barreira contra engenharia reversa.

O projeto Google Cloud deve permanecer sob a organização institucional, com audiência Interna. A configuração restringe o consentimento a contas da organização. O aplicativo também verifica as claims de identidade recebidas do Google antes de persistir os tokens.

## Desenvolvimento e release

`npm run dev` e `npm run dev:diagnostico` procuram a credencial somente em `build/google-drive-oauth.local` (ignorado pelo Git) ou em `LAWDO_GOOGLE_CLIENT_SECRET`. Quando encontrada, geram `build/google-drive-oauth.dat`; sem ela, o laWdo abre com o Drive desabilitado. `npm run pack` produz um pacote de verificação sem credencial e ignora recursos temporários de outro empacotamento. `npm run dist` exige a credencial e falha antes do build se ela não estiver disponível.

O processo principal mantém access e refresh tokens fora do renderer e usa `safeStorage` para persistência. Em Linux, a integração exige um backend de segredo diferente de `basic_text`.

## Preparação institucional

1. Confirme no Google Auth Platform que o cliente é do tipo Desktop e que a audiência é Interna.
2. Valide com uma conta institucional de piloto a autorização, a renovação após expiração e a recuperação de uma cópia existente.
3. Armazene a credencial correspondente ao cliente original como `LAWDO_GOOGLE_CLIENT_SECRET` no environment `release` do GitHub. Os jobs de release a preparam antes do empacotamento e removem o arquivo intermediário mesmo em caso de erro.
