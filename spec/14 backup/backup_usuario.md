# Backup e restauração do usuário

## Escopo e fontes de verdade

Esta spec descreve os arquivos .lawdo-backup criados manualmente em Backup > Completo ou Configuração. Eles são independentes dos snapshots obrigatórios de atualização descritos em spec/12 atualizacao/backup_pre_atualizacao.md; não compartilham formato, retenção ou restauração.

| Responsabilidade | Fonte |
| --- | --- |
| Tela, mensagens e prévia | src/renderer/pages/BackupPage.tsx |
| Usuário autenticado exibido | src/renderer/App.tsx |
| Canais permitidos e contrato do renderer | src/preload/index.ts e src/renderer/index.tsx |
| Autorização, seleção, prazos e confirmação | src/main/ipc/handlers/backup.handlers.ts e src/main/services/auth-sessao.service.ts |
| Contêiner cifrado, manifesto e integridade | src/main/services/backup-arquivo.service.ts |
| Banco completo, imagens, credenciais e reversão | src/main/services/backup.service.ts e src/main/services/backup-sqlite.service.ts |
| Configuração portável e importação | src/main/services/config-backup.service.ts |

Toda operação IPC de backup exige sessão autenticada da janela. O renderer apresenta o nome do usuário corrente, mas apenas o main valida a identidade e a senha antes de criar o arquivo. A restauração exige um usuário local autenticado; não é um fluxo de recuperação na tela de login.

## Conteúdo das modalidades

| Conteúdo | Completo | Configuração |
| --- | --- | --- |
| REPs, laudos e demais tabelas do banco | Sim, no snapshot SQLite íntegro | Não |
| Imagens dos laudos | IDs utilizados no HTML salvo e suas cadeias de imagens de origem | Não |
| Estruturas de trabalho | Sim, pelo banco | Solicitantes, tipos de exame, templates/seções, categorias/placeholders, categorias/peças e wizards/etapas/opções/regras |
| Preferências e integrações | Sim, pelo banco e segredos portáteis | Somente chaves da lista CHAVES_PORTATEIS |
| Perfil do perito e avatar | Sim | Nome, matrícula, telefone, cargo, lotação e avatar local, quando houver |
| Login, e-mail e hash da senha local | Originais não; são trocados por valores inertes no snapshot | Não são transportados |

No backup completo, `filtrarImagensDoSnapshot()` analisa `laudos.conteudo` da cópia SQLite com `htmlparser2`, remove subárvores `data-dummy="true"` e coleta `data-image-id` reais de todos os laudos salvos. Preserva esses registros e toda cadeia de `imagem_origem_id`, incluindo originais e ajustes necessários. O filtro não usa `disponivel_painel`: uma imagem usada entra mesmo disponível no painel, e uma imagem arquivada sem uso ou vínculo de origem não entra. Edições ainda não salvas no DOM não fazem parte do snapshot. A forma de tratamento do perito também acompanha o snapshot do banco. O backup de Configuração serializa uma lista explícita de campos do perfil e atualmente não transporta `forma_tratamento`; uma restauração dessa modalidade mantém o valor local de destino.

O completo usa o backup consistente do SQLite, exige schema corrente e exatamente um usuário, verifica integridade e vínculos, substitui no snapshot username/e-mail/hash por valores inertes e retira as quatro chaves secretas do banco. Valores de API Groq/Gemini e senhas GDL são obtidos pela camada de configuração e colocados em segredos.json dentro do arquivo cifrado. Cada ID utilizado deve ter formato seguro e pertencer ao mesmo laudo; origem inexistente, origem de outro laudo ou ciclo interrompe a criação. Somente na cópia SQLite, a poda de `imagens_laudo` ocorre em transação, com verificação de integridade/vínculos e rollback em erro. Caminhos preservados são normalizados e deduplicados antes da inclusão. Arquivo necessário ausente, inválido ou fora da pasta permitida impede a criação. Fotos não utilizadas e arquivos órfãos não entram, mas permanecem intactos no banco e nas pastas ativos. O avatar também deve ser arquivo local válido.

A configuração é serializada em configuracao.json. As tabelas e chaves portáteis aceitas são listas explícitas em config-backup.service.ts: adicionar uma nova configuração persistida não a inclui automaticamente. Segredos são exportados em valor portável dentro do contêiner cifrado e recriptografados com safeStorage local ao restaurar. O arquivo de configuração não importa nem substitui REPs ou laudos. As chaves `cabecalho_documento` e `fechamento_laudo` pertencem a `CHAVES_PORTATEIS`, junto com as chaves legadas `cabecalho_laudo` e `cabecalho_paginas`. Transportam os padrões e os controles de ativação para novos laudos; o backup completo preserva também `laudos.apresentacao_json` no snapshot SQLite. Portanto, restaurar padrões não equivale a recapturar a apresentação de laudos existentes. Os contratos e a migração das cópias estão em `spec/03 laudo/laudo_ciclo_vida.md`.

## Formato, senha e compatibilidade

O contêiner de formato 1 começa com a assinatura LAWDO-BKP-1, sal de 16 bytes e IV de 12 bytes; o payload é AES-256-GCM com tag de 16 bytes. A chave é derivada da senha com scrypt (N=32768, r=8, p=1). O manifesto interno registra modalidade, data, versão do aplicativo, versão do schema e nome/tamanho/SHA-256 das entradas. Cabeçalhos, nomes e caminhos são validados antes de extrair; a tag GCM e os hashes das entradas impedem aceitar senha errada, alteração ou truncamento. Limites atuais: 20 GiB para o arquivo e 100 mil entradas.

Na criação de ambas as modalidades, o main compara a senha digitada com a senha do usuário da sessão antes de abrir o diálogo de destino. Três tentativas erradas em menos de 30 segundos bloqueiam novas tentativas por 30 segundos naquela janela. A senha não é gravada no backup; seu texto no momento da criação protege o arquivo. Alterar a senha de login depois não recifra backups anteriores. A criação não impõe comprimento mínimo adicional ao da conta, portanto a resistência do arquivo a tentativa offline depende da senha de acesso escolhida. Arquivos criados antes desse vínculo continuam legíveis com a senha própria usada na época; na restauração não se exige que a senha do arquivo coincida com a senha local atual.

## Fluxo de restauração e limites de validação

1. O usuário escolhe primeiro um arquivo. O main guarda caminho e modalidade sob ID vinculado à janela, válido por dez minutos, e devolve apenas ID e nome para a UI.
2. Após a senha, analisar extrai para diretório temporário, valida GCM, manifesto, hashes e modalidade e produz a prévia. A seleção pode ser cancelada; a extração temporária é removida.
3. A prévia do completo valida schema exatamente igual ao atual, integridade/foreign keys do SQLite, usuário único e correspondência entre imagens vinculadas e entradas. Mostra contagens de REPs, laudos e imagens. A prévia da configuração valida a estrutura básica do JSON e retorna contagens das tabelas e indicadores de avatar/credenciais; a tela mostra as contagens e o avatar, mas a frase sobre credenciais é genérica e não usa o indicador. Validações de colunas, vínculos e conflito com dados locais ocorrem na confirmação.
4. Confirmar exige a mesma janela, ID de prévia válido por cinco minutos, mesmo tamanho/mtime e identidade do cabeçalho/tag. O main extrai e valida novamente antes de alterar dados. A senha pode ser tentada de novo na fase de análise; uma prévia expirada requer nova seleção.

No completo, a restauração preserva username, e-mail e hash da senha do usuário local, recriptografa os segredos para a máquina atual e substitui banco, árvore de imagens e avatares. Antes de trocar os arquivos, fecha o SQLite e move o estado anterior para uma pasta de reversão, com marcador em userData. Erro na troca aciona reversão; ao reiniciar, falha de inicialização tenta reverter o estado anterior. Após inicialização bem-sucedida, o estado anterior é removido. Não há mesclagem com o banco existente.

Na configuração, se o banco local contiver qualquer REP ou laudo, a confirmação é bloqueada. Caso contrário, as tabelas e chaves portáteis são substituídas em transação SQLite; perfil e caminho do novo avatar são atualizados, mas login/e-mail/hash permanecem locais. O novo avatar é copiado antes da transação e removido se ela falhar. O avatar antigo não é excluído na conclusão, podendo permanecer como arquivo órfão. O renderer recarrega para novo login; no completo, o main reinicia o aplicativo.

## Consistência, custo e verificação

Criar backup não exige fechar o laWdo: o banco é copiado pela API de backup do SQLite. Banco e arquivos de imagem/avatar, porém, não formam uma transação única; uma alteração concorrente na árvore de arquivos pode interromper a criação ou capturar momentos diferentes. A criação calcula SHA-256 das entradas e as lê novamente ao cifrar, com conferência durante a serialização. Volumes grandes custam I/O, CPU e espaço temporário. A extração também usa armazenamento temporário antes de tocar os dados ativos.

src/__tests__/main/backup-arquivo.service.test.ts cobre sigilo do payload, senha incorreta, corrupção e rejeição de caminhos inseguros. `src/__tests__/main/backup-completo-imagens.integration.test.ts` exercita SQLite/arquivos e o contêiner para seleção por HTML salvo, cadeias de origem, deduplicação, exclusão de dummy/não utilizadas, erros de referências/arquivos, preservação dos dados ativos e restauração dos registros selecionados com manutenção do acesso local. Também protege a leitura de backups antigos com imagens não utilizadas. Não há teste automatizado ponta a ponta da seleção e autenticação IPC, da modalidade Configuração nem da reversão após interrupção; essas propriedades dependem hoje de validação manual e do código do main. Mudanças no formato, senha, seleção ou restauração precisam manter alinhados renderer, preload, handlers, serviços e testes pertinentes.

## Preferências GDL e projéteis personalizados

O backup de Configuração inclui `gdl_homologacao_habilitada` na lista explícita de chaves portáteis. Não inclui `gdl_listagem_reps_habilitada` nem a tabela `projeteis_personalizados`; importar apenas configurações não ativa a listagem e não transfere cadastros de projéteis. O backup Completo incorpora essas informações pelo snapshot do banco, sujeito à exigência de schema exatamente igual na prévia e restauração. A migration v39 recria a tabela de projéteis vazia; a restauração exige igualdade com `CURRENT_SCHEMA_VERSION` do aplicativo de destino (atualmente 48), não apenas compatibilidade com a tabela de projéteis. Backups completos de schema anterior, inclusive 43/44, não passam diretamente pela prévia no aplicativo de schema 48; a existência de migrations na inicialização normal não torna a restauração permissiva.

## Compatibilidade da seleção de imagens

A seleção reduz somente novos backups completos; não muda o formato 1 nem a exigência de schema igual. Prévia/restauração continuam aceitando backups anteriores que contêm registros e arquivos não utilizados no HTML, sem aplicar retroativamente a poda. A contagem de imagens da prévia corresponde aos arquivos incluídos, que podem ser menos que os registros quando compartilham caminho. Após restaurar um backup novo, fotos excluídas pelo filtro não estarão na fila da instalação restaurada; a criação do arquivo não as remove da instalação de origem. O backup pré-atualização mantém seu contrato independente.

## Preferências e imagens em estágio

CHAVES_PORTATEIS inclui perfil_previa_editor e qualidade_imagem_ia, independentes entre si. A primeira é texto com perfil de prévia; a segunda é JSON versão 1 da qualidade enviada para IA, ambos editados em /imagens. O cabeçalho transporta as duas flags atuais de ativação, mantendo leitura compatível do habilitado legado.

Imagens que só estão no estágio em memória do main não entram em backup. Depois da inserção, o arquivo pode existir com temporaria_sessao=1, mas sua inclusão no completo continua determinada pelo HTML salvo e pela cadeia de origem. O marcador não exclui uma figura usada do snapshot; o backup precisa preservar o arquivo original, pois o HTML pode conter apenas prévia reduzida. A restauração exige igualdade com o schema atual 48, que inclui o marcador. A limpeza posterior respeita referências salvas, conforme spec/03 laudo/fluxo_ilustracao.md.
