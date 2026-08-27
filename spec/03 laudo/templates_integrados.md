# Templates integrados ao laWdo

## Estado canônico

O catálogo embarcado vive em `src/main/templates/integrados/`. Cada definição declara `chave` estável, `versao`, tipo de exame, seções e chaves locais de seção; o B-602 atual é `laudo-padrao-b602` v1. O conteúdo do catálogo é a fonte para novas instalações e atualizações, enquanto SQLite é o estado local sincronizado usado pelo restante do aplicativo.

A serialização canônica e o SHA-256 cobrem os campos funcionais do template. Elementos transitórios do editor — como `data-image-id` e artefatos dummy — são ignorados no checksum para permitir adoção segura de dados legados equivalentes. A validação do catálogo rejeita chave, versão, ordens, referências de pai ou seções duplicadas inválidas antes da persistência.

## Persistência e sincronização

A migration v32 acrescenta em `templates` a origem (`integrado`, `usuario`, `importado` ou `clonado`), chave, versão, checksum, disponibilidade e referência de derivação; `secoes_template` recebe sua chave integrada. Índices preservam unicidade por chave/versão de template integrado e por chave de seção dentro do template.

Após criar ou migrar o banco, `initializeDatabase()` sincroniza o catálogo. Cada template é processado em transação própria:

1. localiza ou cria o tipo de exame pelo código;
2. mantém a versão local quando chave, versão e checksum coincidem;
3. adota um único template legado de origem `usuario` somente se sua estrutura e checksum forem compatíveis;
4. caso contrário instala um novo registro e suas seções;
5. deixa versões integradas anteriores indisponíveis para novos laudos.

A adoção conserva os IDs físicos existentes. Se a mesma chave e versão tiver checksum divergente, a versão local é preservada e o resultado da sincronização registra falha; um template defeituoso não bloqueia a inicialização dos demais. Tipo de exame inativo torna o template indisponível, sem apagá-lo. O último resultado é exposto somente para diagnóstico e aviso na tela de templates.

## Uso, edição e clonagem

A listagem de templates mostra a origem e a versão; a origem integrada é apresentada como `Modelo laWdo · vN`. Templates integrados são somente leitura no main process: atualizar, excluir, alterar seção ou reordenar seção falha com orientação para criar cópia personalizada. A proteção não depende da interface.

`template:clonar` duplica template e seções em uma única transação, remapeando relações de pai e gravando origem `clonado` com a chave integrada de origem. O clone é editável e não recebe atualizações do catálogo. Templates trazidos por pacote são gravados com origem `importado`.

A edição comum usa `template:salvarCompleto`: o handler valida e sanitiza a fronteira IPC e o serviço grava template e seções em transação, validando seções não vazias, chaves locais únicas e referências de pai. Isso evita estados parciais entre template, seções e ordem.

## Consumo pelos laudos

Na criação, `laudoService` exige que o template exista. Para origem integrada, recusa tipos indisponíveis e catálogo sem seções; assim não aplica o fallback de documento vazio a uma falha de sincronização. Laudos existentes mantêm seu conteúdo próprio e não são modificados pela troca de versão do template.

## Impacto e verificação

Uma alteração de contrato deve manter alinhados catálogo, serialização/validação, migration, sincronizador, `TemplateService`, handlers IPC, allowlist e tipos do preload, além da tela de templates.

`src/__tests__/main/templates-integrados.test.ts` cobre estrutura B-602, repetição por armas, estabilidade do checksum e rejeição de chaves duplicadas. A verificação manual confirma a presença única do modelo, bloqueio de edição/exclusão, clonagem editável, criação de laudo e persistência após reinicializar o aplicativo.
