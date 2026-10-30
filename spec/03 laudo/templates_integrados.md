# Templates integrados ao laWdo

## Estado canônico

O catálogo embarcado vive em `src/main/templates/integrados/`. Cada definição declara `chave` estável, `versao`, tipo de exame, seções e chaves locais de seção; os modelos ativos são `laudo-padrao-b602` v12, `laudo-padrao-b601` v3 e `laudo-padrao-b601-local-necropsia` v4. O catálogo importa somente essas definições atuais, que herdam versões-fonte anteriores. Registros de versões anteriores já instalados permanecem no banco, mas indisponíveis para novos laudos; uma instalação nova não instala cada versão intermediária. O conteúdo do catálogo é a fonte para novas instalações e atualizações, enquanto SQLite é o estado local sincronizado usado pelo restante do aplicativo.

A serialização canônica e o SHA-256 cobrem os campos funcionais do template. Elementos transitórios do editor — como `data-image-id` e artefatos dummy — são ignorados no checksum para permitir adoção segura de dados legados equivalentes. A validação do catálogo rejeita chave, versão, ordens, referências de pai ou seções duplicadas inválidas antes da persistência.

## Persistência e sincronização

A migration v32 acrescenta em `templates` a origem (`integrado`, `usuario`, `importado` ou `clonado`), chave, versão, checksum, disponibilidade e referência de derivação; `secoes_template` recebe sua chave integrada. Índices preservam unicidade por chave/versão de template integrado e por chave de seção dentro do template.

Após criar ou migrar o banco, `setupDatabase()` sincroniza o catálogo. Cada template é processado em transação própria:

1. localiza ou cria o tipo de exame pelo código;
2. mantém a versão local quando chave, versão e checksum coincidem;
3. adota um único template legado de origem `usuario` somente se sua estrutura e checksum forem compatíveis;
4. caso contrário instala um novo registro e suas seções;
5. deixa versões integradas anteriores indisponíveis para novos laudos.

Em desenvolvimento (`app.isPackaged === false`), uma divergência de checksum na mesma chave e versão substitui o conteúdo e as seções do registro integrado local, preservando seu ID físico. Isso permite iterar o catálogo em desenvolvimento com dados fictícios. Em aplicativo empacotado, a divergência continua sendo falha: o registro local é preservado e o catálogo não o sobrescreve. Uma versão publicada deve ser imutável; alteração posterior usa nova versão e torna a anterior indisponível para novos laudos.

Tipo de exame inativo torna o template indisponível, sem apagá-lo. O último resultado é exposto somente para diagnóstico e aviso na tela de templates.

## Uso, edição e clonagem

A listagem de templates mostra a origem e a versão; a origem integrada é apresentada como `Modelo laWdo · vN`. Templates integrados são somente leitura no main process: atualizar, excluir, alterar seção ou reordenar seção falha com orientação para criar cópia personalizada. A proteção não depende da interface.

`template:clonar` duplica template e seções em uma única transação, remapeando relações de pai e gravando origem `clonado` com a chave integrada de origem. O clone é editável e não recebe atualizações do catálogo. Templates trazidos por pacote são gravados com origem `importado`.

A edição comum usa `template:salvarCompleto`: o handler valida e sanitiza a fronteira IPC e o serviço grava template e seções em transação, validando seções não vazias, chaves locais únicas e referências de pai. Isso evita estados parciais entre template, seções e ordem.

## Consumo pelos laudos

O B-602 v12 conserva os placeholders de concordância do perito, lacres de saída, seções condicionais e repetição por armas. DOS ESTOJOS usa `b602_total_estojos_extenso`, `b602_estojos_descricao` e `b602_estojos_conclusao`; o resolvedor escolhe singular para uma unidade e plural nos demais totais. Os textos-base vivem no catálogo compartilhado `b602-textos-estojos.catalogo.ts`. A referência normativa usa `Lei nº` e `Instrução Normativa nº`. Ausência de lacre permanece `XXX`; prosa livre não recebe flexão automática. `templates-figuras-padrao.test.ts` valida os modelos ativos, `templates-integrados.test.ts` conserva a cobertura das versões-fonte e `exportacao-placeholders-b602.test.ts` verifica os textos derivados.

Na criação, `laudoService` exige que o template exista. Para origem integrada, recusa tipos indisponíveis e catálogo sem seções; assim não aplica o fallback de documento vazio a uma falha de sincronização. Laudos existentes mantêm seu conteúdo próprio e não são modificados pela troca de versão do template.

## Visibilidade e numeração das seções

Cada seção mantém ocultar_titulo e contar_na_numeracao. As migrations 42 e 43 acrescentam esses campos com os padrões de título visível e participação na numeração. A estrutura conserva pai, ordem e conteúdo mesmo quando o cabeçalho fica oculto. O editor mostra os indicadores “Título oculto” e “Fora da numeração” sem inseri-los no documento exportado.

calcularNumeracaoSecoes(), em src/shared/utils/numeracao-secoes.ts, é a fonte comum da sequência para edição, prévias, PDF, DOCX e ODT. Uma seção oculta pode consumir número; se também deixar de contar, a sequência principal avança somente na próxima seção participante. Filhos de um pai que não conta ficam sem prefixo numérico. Importação/exportação de pacotes, clonagem, persistência e reconciliação do laudo conservam as preferências.

O B-602 v12 mantém o preâmbulo oculto sem consumir número. Registros integrados anteriores continuam preservados quando já instalados; a troca de versão não reescreve laudos existentes. As verificações de títulos, numeração e template integrado cobrem a persistência e as exportações.

## Impacto e verificação

Uma alteração de contrato deve manter alinhados catálogo, serialização/validação, sincronizador, `TemplateService`, handlers IPC, allowlist e tipos do preload, além da tela de templates. A alteração de uma versão publicada também exige a estratégia de migração correspondente.

`src/__tests__/main/templates-integrados.test.ts` cobre estrutura B-602, repetição por armas, estabilidade do checksum e rejeição de chaves duplicadas. A verificação manual confirma a presença única do modelo, bloqueio de edição/exclusão, clonagem editável, criação de laudo e persistência após reinicializar o aplicativo.

## Modelo B-601

`b601/laudo-padrao-b601.v3.ts`, registrado em `catalogo.ts` e derivado da definição v2, distribui nove seções: preâmbulo, objetivo, material apresentado, exame com subseções de projéteis, estojos e demais materiais, considerações finais e encerramento. O preâmbulo fica oculto e não conta na numeração. Os grupos usam `b601_agrupados:105`, `b601_agrupados:101` e `b601_pecas`; o modo genérico exclui tipos já atendidos pelos agrupamentos. O modelo contém placeholders de investigação, material encaminhado, tratamento do perito e lacres, além de figuras substituíveis e complementos após as descrições.

O B-601 v3 usa `Lei nº` nas considerações finais e `Instrução Normativa nº` no encerramento, conservando a estrutura, placeholders e complementos da definição-base. Aplicam-se ao B-601 as mesmas regras de sincronização, disponibilidade e clonagem dos demais integrados. A instalação do catálogo não reescreve HTML de laudos existentes nem templates personalizados. Expansão, seletores por unidade, preservação de complementos e limites da assinatura estão em `spec/03 laudo/b601.md`.

## Variação B-601 Local com Necropsia e cartuchos B-602

`laudo-padrao-b601-local-necropsia.v4.ts` é o modelo ativo dessa chave, derivado da variação v3. O preâmbulo conserva somente o texto pericial, sem os dois parágrafos iniciais de título e código. Coexiste com o B-601 padrão, mantém nove seções e b601_tabela_material_coleta e fornece conteúdo próprio de preâmbulo, objetivo, material, fotografias e textos finais. Grupos de projéteis/estojos usam data-b601-modelo-coleta="true", fotos-modelo por LOCAL, NECRÓPSIA e ESTOJOS e identidades dummy locais ao catálogo. As considerações finais contêm o condicional de lacres de saída, sem a área opcional BNPB/SINAB da versão-fonte. Não converte laudos existentes nem clones. Aplicam-se sincronização, somente leitura e imutabilidade de versão publicada; versões anteriores instaladas ficam indisponíveis para novos laudos.

O B-602 v12 deriva do v11 e mantém DOS CARTUCHOS com b602_total_cartuchos_extenso, b602_cartuchos_descricao, a tabela de cartuchos e suas figuras dummy. O catálogo compartilhado de textos controla concordância singular/plural; versões anteriores permanecem apenas como fontes ou registros já instalados. templates-integrados.test.ts e exportacao-placeholders-b602.test.ts cobrem o catálogo ativo e a nova resolução. O fluxo B-601 de coleta está em b601.md.

## Apresentação das figuras

As definições ativas B-601 v3, Local com Necropsia v4 e B-602 v12 passam por `padronizarFigurasTemplate()`, em `src/main/templates/integrados/padronizar-figuras.ts`. A transformação copia as seções, troca somente o `src` das imagens de figuras dummy pelo SVG compartilhado e aplica borda zero às tabelas que as envolvem e às suas células, incluindo cabeçalhos. Preserva identificadores, legendas, títulos e disposição; não muda tabelas de dados independentes. Versões-fonte conservam seu HTML e a variação histórica Local com Necropsia mantém seu SVG claro localmente, sem depender da constante visual atual.

O incremento de versão é necessário mesmo para essa mudança visual: o checksum ignora tabelas e figuras dummy, portanto trocar somente a imagem não atualizaria o conteúdo de uma versão já instalada. A sincronização instala a nova versão para novos laudos e mantém registros anteriores e documentos existentes. Clones e templates personalizados salvos não recebem conversão automática. O contrato comum de apresentação e edição nativa das bordas está em [Padrão de elaboração](padrao/padrao_elaboracao.md#figuras-de-exemplo-e-quadros-fotográficos), com cobertura em `src/__tests__/main/templates-figuras-padrao.test.ts`.

## Atualização de partes no editor de templates

Ao editar descrição, complemento ou fotos por origem B-601, TemplatesPage recompõe cada parte a partir do conteúdo mais recente da seção com atualização funcional de estado, preservando alterações de editores irmãos. A recomposição e as tabelas fotográficas estão em spec/03 laudo/b601.md, com cobertura em template-fotos-b601.test.ts.
