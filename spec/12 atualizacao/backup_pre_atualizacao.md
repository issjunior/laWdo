# Backup pré-atualização

## Responsabilidade e vínculo com o fluxo

`BackupAtualizacaoService` protege o estado local antes de qualquer instalação. Ele é chamado por `AtualizacaoService` depois da autorização de reinício na instalação imediata ou durante o processamento de uma atualização agendada. O campo assinado `requerBackupCompletoImagens`, produzido pelo fluxo descrito em `spec/11 github actions/workflows_github_actions.md`, decide entre snapshot do banco e backup completo.

Esta spec complementa `fluxo_atualizacao.md`: aquela define quando o backup é exigido; esta define o que é criado, validado, retido e deixado em caso de falha.

## Fontes e armazenamento

| Dado | Local atual |
|---|---|
| banco de origem | `userData/laudopericial.db` |
| snapshots e manifestos | `userData/backups-atualizacao` |
| imagens de origem | `userData/imagens` |
| implementação | `src/main/services/backup-atualizacao.service.ts` |
| schema registrado | `getSchemaVersion()` em `src/main/database/index.ts` |
| checkpoint do banco aberto | `executeNonQuery()` em `src/main/database/sqlite.ts` |

Os backups pré-atualização são separados do backup comum da aplicação. Não existe restauração automática ou interface de recuperação para esses artefatos.

## Snapshot do SQLite

`criarSnapshot(versaoDestino)` executa:

1. exige que `laudopericial.db` exista;
2. solicita `PRAGMA wal_checkpoint(FULL)` na conexão ativa;
3. lê a versão atual do schema;
4. copia o banco com `COPYFILE_EXCL` para um nome que contém data, versão de origem e destino;
5. abre a cópia em modo somente leitura e exige `PRAGMA integrity_check = ok`;
6. calcula tamanho e SHA-256;
7. grava um manifesto JSON formato 1;
8. aplica a retenção dos snapshots;
9. retorna os caminhos e metadados.

Falha após a criação remove o banco e o manifesto daquele snapshot. O checkpoint e a cópia não formam uma transação única com a futura instalação; a instalação só prossegue se a Promise do backup concluir.

O manifesto registra caminhos absolutos locais, versões de origem e destino, schema, criação, tamanho e hash. Ele descreve recuperação e auditoria local, não é assinado nem publicado.

## Retenção

A retenção considera manifestos `pre-atualizacao_*.json`, ordenados por `mtime`, e mantém os dois mais recentes. Para cada excedente, remove o banco somente se o caminho registrado estiver no mesmo diretório dos snapshots; depois remove o manifesto.

Falha ao interpretar ou remover um snapshot antigo não desfaz o snapshot novo: é registrada como warning e a retenção pode permanecer acima de dois itens.

Diretórios de backup completo não entram nessa varredura. Portanto, o limite de dois vale apenas para pares snapshot/manifesto; backups completos de imagens permanecem sem retenção automática.

## Backup completo de banco e imagens

`criarBackupCompleto` cria primeiro um snapshot válido. Depois:

1. enumera recursivamente arquivos em `userData/imagens`;
2. registra caminho relativo, tamanho e SHA-256 de cada imagem;
3. cria um diretório `pre-atualizacao_completo_*`;
4. copia o snapshot do banco para esse diretório e compara seu hash;
5. copia cada imagem preservando o caminho relativo;
6. valida tamanho e hash de cada cópia;
7. grava `manifesto.json` dentro do backup completo.

Se o diretório `imagens` não existir, o backup completo ainda é válido com lista vazia. Links simbólicos e entradas que não sejam arquivo ou diretório não são incluídos.

Uma falha remove o diretório completo parcial, mas preserva o snapshot criado no início. Logo, snapshot e backup completo não são uma operação transacional única; a instalação é bloqueada, mas pode restar um snapshot válido sujeito à retenção normal.

## Consistência, desempenho e espaço

O checkpoint protege a cópia do SQLite, mas não existe congelamento transacional conjunto entre banco e árvore de imagens. As imagens são enumeradas e copiadas sequencialmente; uma alteração externa durante o processo pode causar divergência e falha ou produzir um conjunto capturado em momentos diferentes.

As operações de cópia e hash usam APIs síncronas e leem arquivos completos para calcular SHA-256. Backups com muitas imagens bloqueiam o processo principal por mais tempo e calculam hashes na origem e novamente no destino. Não há cálculo prévio de espaço livre; falta de espaço aparece como falha de I/O e bloqueia a atualização.

O banco aparece no snapshot e novamente dentro do backup completo. Essa duplicação é deliberada no comportamento atual, mas aumenta o espaço necessário.

## Invariantes

- A ausência do banco, falha do checkpoint, integridade diferente de `ok`, cópia incompleta ou hash divergente bloqueia a instalação.
- O snapshot sempre registra versão de origem, versão de destino e schema.
- O backup completo nunca substitui a exigência do snapshot: ele é construído a partir de um snapshot já validado.
- Caminhos relativos das imagens precisam permanecer dentro da árvore de dados ao serem reconstruídos.
- Alterar `requerBackupCompletoImagens` no manifesto afeta conjuntamente GitHub Actions, assinatura, `AtualizacaoService` e esta política de backup.
- Retenção de snapshots e retenção de backups completos são comportamentos diferentes; atualmente apenas a primeira existe.

## Cobertura atual

`src/__tests__/main/backup-atualizacao.service.test.ts` comprova checkpoint WAL, criação de snapshot íntegro com versão/schema/hash e backup completo com imagem registrada. Não há cobertura automatizada para retenção acima de dois, corrupção no destino, falta de espaço, falha parcial durante várias imagens, concorrência com alterações de imagens ou recuperação manual.
