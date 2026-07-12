# Plano: integração B602 com peças da API GDL

## 1. Objetivo

Reproduzir no cadastro de REP B602 do laWdo o fluxo de peças do GDL, incluindo:

- os inputs comuns a todas as peças;
- os inputs personalizados de cada um dos 17 tipos de item observados;
- criação manual de peças no laWdo;
- preenchimento automático por consulta somente leitura à API GDL;
- edição e exclusão local de qualquer peça, inclusive após importação do GDL;
- persistência estruturada em `campos_especificos.b602`, sem despejar peças em `observacoes`.

O GDL continua sendo o sistema oficial. O laWdo não criará, atualizará ou excluirá peças no GDL nesta entrega.

Como o laWdo ainda está em desenvolvimento, não haverá compatibilidade nem migração de dados B602 de versões anteriores. O modelo novo deve ser implementado de forma coerente no schema inicial, nos tipos, na serialização e nos consumidores do laudo.

### 1.1 Princípio dos dois fluxos

Existem dois pontos de entrada, mas apenas um formulário, um contrato de dados e uma persistência:

- **fluxo manual:** cria uma REP vazia no laWdo e o usuário preenche os campos gerais e as peças;
- **fluxo dinâmico:** consulta uma REP no GDL, revisa o retorno e usa esse resultado para preencher o mesmo formulário local.

A diferença entre os fluxos termina depois da carga inicial. Campos, controles, obrigatoriedade, edição, exclusão, validação e salvamento são os mesmos. Não criar componentes `FormularioManualB602` e `FormularioGdlB602`, schemas paralelos ou regras de negócio duplicadas.

O preenchimento vindo do GDL não salva automaticamente a REP. Ele apenas prepara o formulário local; o usuário continua responsável por revisar e confirmar `Criar REP` ou `Atualizar REP`.

### 1.2 Estado atual da implementação

Implementado no código e coberto pelas validações locais descritas na seção 19:

- consulta somente leitura pelo modal, revisão e aplicação no mesmo formulário de REP;
- validação Zod da resposta e normalização no processo principal;
- catálogo local dos 17 tipos, editor estruturado de peças e persistência em `campos_especificos.b602.pecas`;
- criação, edição e exclusão local de peças manuais ou importadas, sem escrita no GDL;
- preenchimento de número/ano da REP, data de recebimento, número da solicitação, cidade, órgão/solicitante, responsável/contato, autoridade solicitante, BO e IP quando disponíveis;
- classificação resiliente das famílias BO e IP, com preservação do tipo exato e aviso para números conflitantes;
- preenchimento da cidade por select editável com o catálogo do Paraná;
- mapeamento confirmado de `CARABINA(S)`, `ESTOJO(S)` e, para `REVÓLVER(ES)`, somente `Nº Série`;
- preservação de campos da API ainda não mapeados, sem perda silenciosa;
- aviso quando a API não fornecer envolvidos reconhecíveis.

Limitações e pendências confirmadas na auditoria do código:

- envolvidos dependem de novo endpoint oficial do GDL;
- `Tipo de Solicitação` funciona para `BO` na REP `190/2026`, mas permanece com defeito aberto para `IP/PM` na REP `191/2026`;
- campos adicionais de `REVÓLVER(ES)` e `incinerado` de `ESTOJO(S)` permanecem apenas preservados;
- a conversão B602 ainda é chamada diretamente por `gdl.handlers.ts`; o registro genérico de adaptadores por exame ainda não existe;
- a coleção `b602.pecas` é injetada em `campos_especificos` por `REPsPage.tsx`, enquanto `b602.service.ts` ainda serializa o modelo legado antes dessa correção;
- a reabertura preserva as peças, mas `extrairMetadadosIntegracaoGdl()` restaura apenas `origemInicial` e `ultimaConsulta`; `dadosSolicitacao` e `dadosInvestigacao` persistidos não são reidratados, o que faz órgão, responsável e opções de origem GDL desaparecerem do formulário reaberto;
- `Substituir dados do GDL` atualiza peças coincidentes por `codPecaGdl`, mas ainda mantém peças importadas ausentes na nova consulta e não implementa o fluxo de confirmação para removê-las;
- os testes automatizados atuais cobrem schema/normalizador, catálogo, cidades e reconciliação de peças, mas não cobrem ainda o componente do editor, o fluxo completo de salvar/reabrir, o modal integrado nem as projeções para o laudo;
- round-trip completo dos demais tipos e validação em produção permanecem pendentes.

## 2. Evidências confirmadas em homologação

Os testes foram realizados no GDL de homologação com as REPs B602 `190/2026` e `191/2026`.

### 2.1 GDL web

- O formulário de REP é uma página ASP.NET Web Forms.
- A seleção de `Tipo do Item` dispara `__doPostBack` e o servidor renderiza os campos personalizados.
- O DOM expõe label, tipo de controle, obrigatoriedade visual e códigos das opções.
- O DOM não expõe identificador semântico estável dos campos personalizados; os controles são indexados por posição no repeater.
- Não foi identificado endpoint de metadados capaz de reconstruir sozinho o formulário.

### 2.2 API `/rep/obter`

A API devolveu três peças e preservou propriedades dinâmicas diretamente no objeto de cada peça.

Campos comuns observados no retorno:

- `codPeca`
- `tipoPeca`
- `identificacao`
- `quantidade`
- `unidadeMedida`
- `numeroAnalises`
- `examinadoInLoco`
- `dataEntrada`
- `lacreEntrada`
- `lacreSaida`
- `consumida`

Campos personalizados confirmados:

| Tipo | Código do tipo | Campo | Controle no GDL web | Obrigatório | Opções confirmadas |
|---|---:|---|---|---|---|
| `CARABINA(S)` | `476` | `Nº Série` | texto | não | — |
| `CARABINA(S)` | `476` | `Marca` | texto | não | — |
| `CARABINA(S)` | `476` | `Modelo` | texto | não | — |
| `CARABINA(S)` | `476` | `Arma é Institucional?` | lista de seleção | sim | `Indeterminado=60`, `NÃO=98`, `SIM=97` |
| `ESTOJO(S)` | `101` | `ORIGEM/COLETA` | select | sim | `DELEGACIA=95`, `LOCAL DE CRIME=93`, `NECRÓPSIA=94`, `Outro=11` |
| `ESTOJO(S)` | `101` | `incinerado` | contrato visual pendente | pendente | valor `NÃO` observado pela API na REP `191/2026` |
| `REVÓLVER(ES)` | `106` | `Nº Série` | texto | não | valor observado pela API |
| `REVÓLVER(ES)` | `106` | `Marca` | texto | não | valor observado pela API; preservado como extra, sem campo local específico |
| `REVÓLVER(ES)` | `106` | `Modelo` | texto | não | valor observado pela API; preservado como extra, sem campo local específico |
| `REVÓLVER(ES)` | `106` | `Status do Número de Série` | contrato visual pendente | pendente | `Legível` observado pela API |
| `REVÓLVER(ES)` | `106` | `Calibre Nominal Revolver` | contrato visual pendente | pendente | `.38SPL` observado pela API |
| `REVÓLVER(ES)` | `106` | `Estado Geral da Arma` | contrato visual pendente | pendente | `Regular` observado pela API |
| `REVÓLVER(ES)` | `106` | `Funcionamento` | contrato visual pendente | pendente | `Eficiente` observado pela API |
| `REVÓLVER(ES)` | `106` | `Fabricação da Arma` | select | não | preservado como extra, sem campo local específico |
| `REVÓLVER(ES)` | `106` | `Tambor` | contrato visual pendente | pendente | `reversível para a direita` observado pela API |
| `REVÓLVER(ES)` | `106` | `Arma é Institucional?` | lista de seleção | pendente | preservado como extra, sem campo local específico |

A peça `ARMA(S) DE PRESSÃO` retornou apenas campos comuns na amostra. O seu formulário foi posteriormente observado e tem campos personalizados; por isso, a amostra da API não substitui o round-trip com valores preenchidos.

### 2.2.1 Catálogo visual integral confirmado

Em `10/07/2026`, todos os 17 tipos foram selecionados individualmente no GDL web de homologação. A tabela a seguir é a fonte para reproduzir a interface local; ela confirma o schema visual, mas não substitui a validação de round-trip pela API descrita na seção 12.

| Código | Tipo | Campos personalizados visíveis no GDL web | Status de API |
|---:|---|---|---|
| `289` | `ARMA(S) DE CHOQUE` | `Nº Série`, `Marca`, `Modelo` — texto, opcionais | round-trip pendente |
| `613` | `ARMA(S) DE PRESSÃO` | `Nº Série`, `Marca`, `Modelo` — texto, opcionais | resposta observada sem esses valores; round-trip pendente |
| `476` | `CARABINA(S)` | `Nº Série`, `Marca`, `Modelo` opcionais; `Arma é Institucional?` obrigatório (`Indeterminado=60`, `NÃO=98`, `SIM=97`) | confirmado |
| `272` | `CARREGADOR(ES)` | `Nº Série`, `Marca`, `Modelo` — texto, opcionais | round-trip pendente |
| `472` | `ESPINGARDA(S)` | nenhum | round-trip pendente |
| `473` | `ESPOLETA(S)` | nenhum | round-trip pendente |
| `101` | `ESTOJO(S)` | `ORIGEM/COLETA` obrigatório (`DELEGACIA=95`, `LOCAL DE CRIME=93`, `NECRÓPSIA=94`, `Outro=11`); API também retornou `incinerado` | confirmado para `ORIGEM/COLETA`; contrato de `incinerado` pendente |
| `477` | `FUZIL(IS)` | nenhum | round-trip pendente |
| `475` | `GARRUCHA(S)` | nenhum | round-trip pendente |
| `178` | `OUTROS` | `Nº Série`, `Marca`, `Modelo` opcionais; `Fabricação da Arma` select opcional | round-trip pendente |
| `771` | `PEÇA TESTE` | `Nº Série`, `Marca`, `Modelo` opcionais; `Fabricação da Arma` select opcional | round-trip pendente; confirmar em produção |
| `104` | `PISTOLA(S)` | `Nº Série`, `Marca`, `Modelo` opcionais; `Fabricação da Arma` select opcional | round-trip pendente |
| `478` | `PISTOLETE(S)` | `Nº Série`, `Marca`, `Modelo` opcionais; `Fabricação da Arma` select opcional | round-trip pendente |
| `572` | `PÓLVORA` | nenhum | round-trip pendente |
| `105` | `PROJÉTEIS` | nenhum | round-trip pendente |
| `106` | `REVÓLVER(ES)` | `Nº Série`, `Marca`, `Modelo`, `Status do Número de Série`, `Calibre Nominal Revolver`, `Estado Geral da Arma`, `Funcionamento`, `Fabricação da Arma`, `Tambor`, `Arma é Institucional?` | retorno API confirmado na REP `191/2026`; opções e códigos dos campos enumerados ainda pendentes |
| `479` | `SUBMETRALHADORA(S)` | nenhum | round-trip pendente |

`Fabricação da Arma` possui as opções: `argentina=61`, `austríaca=62`, `brasileira=63`, `canadense=64`, `czechoslovakia=66`, `espanhola=67`, `filipena=68`, `finlandesa=69`, `italiana=70`, `mexicana=71`, `Não Aparente=10` e `sul-coreana=65`; o placeholder `Selecione=0` não é valor persistível.

### 2.3 Comportamento atual do laWdo

As peças retornadas pela API são normalizadas em uma coleção estruturada, revisadas no modal e aplicadas a `campos_especificos.b602.pecas`. Elas não são convertidas em linhas de `observacoes`. Peças manuais e importadas usam o mesmo editor local e podem ser alteradas ou excluídas sem modificar o GDL.

Propriedades reconhecidas pelo catálogo alimentam campos personalizados; propriedades ainda não mapeadas ficam em `extrasGdl` e são apresentadas como preservadas. A aplicação dos dados não salva a REP automaticamente.

### 2.4 Limite da evidência atual

As evidências deste plano foram obtidas exclusivamente no ambiente de homologação. A observação visual inicial indica que os campos de produção são idênticos, mas isso não substitui validação de contrato no ambiente de produção.

Produção será usada apenas depois da implementação estar aprovada em homologação e sempre em modo somente leitura. Nenhuma etapa deste plano autoriza criar, editar, excluir ou concluir REP/peça no GDL de produção.

### 2.5 Envolvidos não disponibilizados pelo endpoint atual

As REPs de homologação `190/2026` e `191/2026` possuem envolvidos visíveis no GDL, mas o endpoint oficial `/api/rep/obter` não retornou nomes reconhecíveis. O laWdo deve manter o preenchimento manual do campo `Envolvido(s)` e informar a ausência após a consulta.

Atividade futura: identificar com a equipe do GDL um endpoint oficial que forneça a coleção de envolvidos por REP, documentar seu contrato, adicionar autenticação e validação Zod e somente então habilitar o preenchimento automático. Scraping da interface web é proibido em qualquer ambiente e não pode ser usado como contingência.

### 2.6 Problema aberto — Tipo de Solicitação `IP/PM`

Na REP de homologação `191/2026`, a origem candidata `IP/PM` é reconhecida pelo normalizador, aparece entre as opções do select e fornece corretamente o número `212314/2026` para `Nº da Solicitação`. Apesar disso, o campo `Tipo de Solicitação` continua selecionando `Outros` e abre o input manual vazio. A REP `190/2026`, cuja origem candidata é `BO`, preenche o mesmo campo corretamente.

O cadastro local de solicitantes não participa desse fluxo: ele alimenta somente `Solicitante` e `Responsável/Contato`. O defeito está restrito ao estado/controlador do select e à aplicação de valores dinâmicos não presentes no catálogo estático inicial.

Foram tentados, sem resolver o smoke da REP `191/2026`:

- inclusão das origens candidatas `BO`, `IP` e `OFÍCIO` como opções dinâmicas;
- transporte conjunto de tipo e número da origem;
- distinção entre valor recebido do GDL e escolha manual de `Outros`;
- estado exclusivo para o modo manual `Outros`;
- tratamento de valores padrão durante `Mesclar`.

Atividade futura: isolar o campo em componente controlado testável, registrar em teste de UI a sequência real de `value` e `onValueChange` durante a aplicação da REP e eliminar qualquer transição automática para `Outros`. Até a correção ser comprovada por smoke, o usuário deve selecionar manualmente `IP/PM`; o número correspondente já é preenchido corretamente.

## 3. Decisão arquitetural

A solução é híbrida.

### 3.1 O que é genérico

- validação dos campos comuns do payload;
- separação automática entre propriedades comuns e personalizadas;
- preservação de campos personalizados desconhecidos;
- renderização de inputs a partir de um catálogo local de metadados;
- CRUD local de peças;
- importação, revisão e persistência estruturada.

### 3.2 O que é explícito

- catálogo dos 17 tipos e seus códigos;
- definição de label, controle, obrigatoriedade e opções de cada campo personalizado;
- aliases para labels que possam variar no GDL;
- mapeamentos semânticos para campos técnicos já usados pelo laudo, placeholders e seções repetíveis.
- catálogo e aliases dos valores enumerados dos campos gerais compartilhados, como `Tipo de Solicitação`;
- regra de precedência para substituir nomenclatura/opções locais quando um campo do laWdo e um campo do GDL tiverem comprovadamente o mesmo objetivo semântico.

### 3.2.1 Precedência semântica do GDL

Para campos presentes nos dois sistemas com o mesmo objetivo, o contrato do GDL é a fonte canônica. O laWdo deve usar o label, os valores e, quando houver, os códigos do GDL, em vez de manter uma segunda nomenclatura ou uma lista local divergente.

Regras:

- confirmar equivalência pelo significado e uso do campo, não apenas por semelhança textual;
- quando a equivalência for confirmada, substituir o nome/opções locais pelo contrato canônico do GDL em formulário, validação, persistência, revisão da importação, PDF e placeholders aplicáveis;
- preservar o valor exato recebido do GDL quando ele ainda não existir no catálogo local; nunca degradá-lo silenciosamente para `Outros`;
- `Outros` só pode representar um valor que o próprio GDL classifique como outro, ou uma escolha manual explícita do usuário;
- quando os campos tiverem significados diferentes, ambos podem coexistir com labels que deixem a distinção clara;
- campos técnicos exclusivos do laWdo permanecem disponíveis e não devem ser removidos apenas por não existirem no GDL.

Caso confirmado para implementação: o campo geral `Tipo de Solicitação` da REP `190/2026` retorna `BO` no GDL. O laWdo deve reconhecer e exibir `BO` diretamente como opção/valor canônico, sem apresentá-lo como `Outros`. O catálogo local atual (`BOU`, `BO PM`, `BO PC`, `Ofício`, `CECOMP`) deve ser reconciliado com os valores reais do GDL por fixture e teste de contrato antes de decidir quais aliases locais continuam válidos.

### 3.2.2 Classificação resiliente das origens BO e IP

As origens do GDL devem passar por uma única classificação normalizada, sem listas independentes de variantes para BO e IP:

- tipo iniciado por `BO` pertence à família BO e pode preencher `b602_numero_bo`;
- tipo iniciado por `IP` pertence à família IP e pode preencher `b602_numero_ip`;
- o tipo exato do GDL é preservado no contrato e deve ser exibido na revisão e no formulário, por exemplo `BO/PM`, `BOC`, `IP ONLINE`, `IP/PM` e `IPM/EXÉRCITO`; a falha atual de apresentação de `IP/PM` está registrada na seção 2.6;
- o número deve ser composto com o ano da origem quando a API os devolver separadamente, sem duplicar o ano quando já estiver no número;
- números repetidos sob tipos diferentes da mesma família representam uma única referência e podem preencher automaticamente o campo correspondente;
- se uma família trouxer números distintos, o laWdo não pode escolher um silenciosamente: deve preservar todas as referências, manter o campo sem preenchimento automático e emitir aviso para seleção manual;
- tipos fora dessas duas famílias permanecem preservados como origem GDL, mas não preenchem os campos `Nº BO` nem `Nº IP` sem mapeamento semântico específico aprovado. Assim, `INQUÉRITO CIVIL` não é tratado como `IP`.

Essa regra cobre novas variantes criadas pelo GDL sem atualizar uma lista fixa, mas mantém rastreabilidade suficiente para que o usuário confira a nomenclatura oficial recebida.

### 3.3 O que não será feito

- scraping da interface web do GDL em qualquer ambiente, inclusive em diagnóstico automatizado ou como contingência de integração;
- criação automática de input apenas pelo nome de uma propriedade recebida;
- cast direto de `JSON.parse` para um tipo confiável;
- equivalência por aproximação textual quando os significados forem diferentes;
- armazenamento indefinido do JSON bruto da REP;
- escrita na API GDL.

### 3.4 Extensibilidade para novos tipos de exame

A reutilização futura deve acontecer por contratos pequenos e registros explícitos, sem criar antecipadamente um framework genérico complexo.

Estrutura mínima recomendada:

```ts
interface ResultadoImportacaoExame<TDados> {
  codigoExame: string
  camposGerais: Partial<CamposGeraisREP>
  camposEspecificos: TDados
  avisos: AvisoImportacao[]
}

interface AdaptadorImportacaoExame<TPayload, TDados> {
  codigoExame: string
  validarPayload(payload: unknown): TPayload
  converter(payload: TPayload): ResultadoImportacaoExame<TDados>
}
```

Um registro como `EXAM_IMPORT_REGISTRY` resolve o adaptador pelo código ou natureza do exame. B602 será a primeira implementação. Um novo exame poderá fornecer seu catálogo, schema e adaptador sem alterar o transporte GDL nem duplicar o modal de busca.

Separação de responsabilidades:

- `gdl.service.ts`: transporte, autenticação e timeout;
- schemas/normalizador GDL: validação da fronteira externa;
- adaptador do exame: conversão do payload validado para o modelo local;
- modal de consulta: busca, revisão e escolha de aplicação;
- formulário do exame: edição e validação do modelo local;
- service do exame: serialização e desserialização.

## 4. Catálogo dos 17 tipos de item

O valor `0` (`Selecione um Tipo`) não integra o catálogo.

| Ordem | Código | Tipo no GDL | Família inicial | Status do schema | Etapa |
|---:|---:|---|---|---|---:|
| 1 | `289` | `ARMA(S) DE CHOQUE` | arma | web confirmado; round-trip pendente | 3 |
| 2 | `613` | `ARMA(S) DE PRESSÃO` | arma | web confirmado; round-trip pendente | 3 |
| 3 | `476` | `CARABINA(S)` | arma | campos e retorno API confirmados | 2 |
| 4 | `272` | `CARREGADOR(ES)` | componente | web confirmado; round-trip pendente | 4 |
| 5 | `472` | `ESPINGARDA(S)` | arma | web confirmado; round-trip pendente | 3 |
| 6 | `473` | `ESPOLETA(S)` | componente | web confirmado; round-trip pendente | 4 |
| 7 | `101` | `ESTOJO(S)` | componente balístico | campos e retorno API confirmados | 2 |
| 8 | `477` | `FUZIL(IS)` | arma | web confirmado; round-trip pendente | 3 |
| 9 | `475` | `GARRUCHA(S)` | arma | web confirmado; round-trip pendente | 3 |
| 10 | `178` | `OUTROS` | genérico | web confirmado; round-trip pendente | 5 |
| 11 | `771` | `PEÇA TESTE` | técnico/homologação | web confirmado; round-trip pendente e presença em produção a confirmar | 5 |
| 12 | `104` | `PISTOLA(S)` | arma | web confirmado; round-trip pendente | 3 |
| 13 | `478` | `PISTOLETE(S)` | arma | web confirmado; round-trip pendente | 3 |
| 14 | `572` | `PÓLVORA` | componente balístico | web confirmado; round-trip pendente | 4 |
| 15 | `105` | `PROJÉTEIS` | componente balístico | web confirmado; round-trip pendente | 4 |
| 16 | `106` | `REVÓLVER(ES)` | arma | retorno API confirmado; somente `Nº Série` mapeado, demais propriedades preservadas | 3 |
| 17 | `479` | `SUBMETRALHADORA(S)` | arma | web confirmado; round-trip pendente | 3 |

O catálogo local deve conter exatamente esses 17 códigos enquanto esse for o conjunto apresentado pelo GDL para B602. Alteração futura do catálogo deve ser detectada por teste de contrato, não absorvida silenciosamente.

## 5. Inputs comuns das peças

O editor local deve reproduzir todos os inputs comuns observados no GDL web, mesmo quando alguns não forem devolvidos por `/rep/obter`.

| Campo local canônico | Label observado no GDL | Retorno API confirmado | Observação |
|---|---|---|---|
| `tipoCodigo` / `tipoPeca` | Tipo do Item | somente `tipoPeca` | código vem do catálogo local |
| `identificacao` | Identificação | sim | texto |
| `numeroAnalises` | Nº Análises | sim | validar regra real de obrigatoriedade |
| `quantidade` | Quantidade | sim | número positivo |
| `unidadeMedida` | Medida | sim | select com catálogo próprio |
| `quantidadeDescricao` | Quant. Descrição | não confirmado | texto local preservado |
| `examinadoInLoco` | Examinado In Loco | sim | booleano normalizado |
| `dataEntrada` | Data de Entrada | sim | data |
| `lacreEntrada` | Lacre Entrada | sim | texto |
| `lacreSaida` | Lacre Saída | sim | texto |
| `dataLiberacao` | Data de Liberação | não confirmado | data local preservada |
| `codigoVestigio` | Código do Vestígio | não confirmado | texto local preservado |
| `consumida` | Consumido/Liberado no Exame? | sim | `Sim`, `Não` ou `Parcialmente` |
| `observacao` | Observação | não confirmado | observação da peça, não da REP inteira |

### 5.1 Campos gerais compartilhados com o GDL

Os campos gerais da REP também entram na política de precedência semântica. A importação deve mapear valores por catálogo/aliases confirmados e manter o valor original quando ainda não houver correspondência local.

Para `Tipo de Solicitação`:

- `BO`, observado na REP `190/2026`, deve ser aceito, exibido e persistido literalmente;
- a UI não deve converter automaticamente um valor GDL desconhecido em `Outros`;
- aliases como `BOU`, `BO PM` e `BO PC` só devem ser consolidados em `BO` se a equivalência funcional for confirmada;
- divergências devem gerar aviso de contrato na revisão, sem perda do valor recebido;
- fixture e testes devem cobrir a lista de valores observados em homologação e, posteriormente, em produção.

O smoke test posterior confirmou que `BO` já é exibido corretamente pelo laWdo, sem aparecer como `Outros`.

#### Ponto de retomada — catálogo de origens do GDL

Antes de consolidar aliases ou remover opções locais, executar inspeção somente leitura no GDL web de homologação. Para cada opção do select de origens/tipo de solicitação, registrar:

1. label visível;
2. atributo `value`/código enviado pelo formulário;
3. ordem exibida;
4. obrigatoriedade e valor padrão, se houver;
5. REP de exemplo em que o valor foi observado;
6. relação semântica confirmada, ambígua ou inexistente com os valores atuais do laWdo (`BOU`, `BO PM`, `BO PC`, `Ofício`, `CECOMP`).

Usar o resultado para criar fixture anonimizada, teste de contrato e catálogo local versionado. A inspeção não autoriza qualquer escrita, alteração ou conclusão de REP no GDL.

A obrigatoriedade deve ser armazenada como metadado booleano e validada localmente. Durante a descoberta, não basta copiar a quantidade de asteriscos do label: deve-se confirmar também o comportamento de validação do GDL.

## 6. Modelo de dados canônico

Peças manuais e importadas devem usar o mesmo modelo.

```ts
type OrigemPecaB602 = 'manual' | 'gdl'

interface OpcaoCampoPecaB602 {
  codigo: string
  label: string
}

interface DefinicaoCampoPecaB602 {
  id: string
  chaveGdl: string
  aliasesGdl: string[]
  label: string
  controle: 'texto' | 'numero' | 'data' | 'booleano' | 'select' | 'multiselect'
  obrigatorio: boolean
  opcoes?: OpcaoCampoPecaB602[]
}

interface PecaB602 {
  idLocal: string
  origem: OrigemPecaB602
  alteradaLocalmente: boolean
  codPecaGdl?: number
  tipoCodigo: string
  tipoPeca: string
  comuns: {
    identificacao: string
    numeroAnalises: string
    quantidade: number
    unidadeMedida: string
    quantidadeDescricao: string
    examinadoInLoco: boolean
    dataEntrada: string
    lacreEntrada: string
    lacreSaida: string
    dataLiberacao: string
    codigoVestigio: string
    consumida: 'S' | 'N' | 'P' | ''
    observacao: string
  }
  personalizados: Record<string, unknown>
  extrasGdl: Record<string, unknown>
}

interface MetadadosIntegracaoGdl {
  origemInicial: 'manual' | 'gdl'
  ultimaConsulta?: {
    ambiente: 'homologacao' | 'producao'
    numeroRep: string
    anoRep: string
    consultadoEm: string
  }
}
```

### Regras do modelo

- `idLocal` identifica o item no CRUD do laWdo.
- `codPecaGdl` é referência externa e nunca deve ser usado como chave primária local.
- `tipoCodigo` vem do catálogo de 17 tipos.
- `personalizados` usa IDs canônicos definidos no catálogo local.
- `extrasGdl` preserva propriedades ainda desconhecidas com a chave original do GDL.
- `alteradaLocalmente` registra que uma peça importada foi modificada no laWdo.
- exclusão local nunca dispara exclusão no GDL.
- `MetadadosIntegracaoGdl` registra a diferença operacional entre os pontos de entrada, mas não altera schema, validação ou permissões de edição do formulário.

## 7. Contrato e normalização da API

O payload deve entrar como `unknown` e ser validado antes de alcançar o renderer.

### 7.1 Schema da peça

O schema deve validar os campos comuns e aceitar propriedades adicionais com `catchall`/`passthrough` controlado. O tipo resultante precisa manter index signature compatível com os campos dinâmicos.

### 7.2 Separação de campos

1. validar campos comuns;
2. remover do objeto as chaves comuns conhecidas;
3. resolver o tipo pelo label e aliases do catálogo;
4. mapear as chaves restantes para os IDs canônicos de campos personalizados;
5. colocar chaves não reconhecidas em `extrasGdl`;
6. nunca descartar campo apenas por não existir no catálogo atual.

### 7.3 Labels não são identidade suficiente

Como `/rep/obter` devolve propriedades como `Marca` e `ORIGEM/COLETA`, o catálogo deve manter:

- chave original confirmada;
- aliases normalizados;
- ID local estável, por exemplo `476:marca` e `101:origem_coleta`.

Normalização de caixa, acentos e espaços serve apenas para localizar aliases conhecidos. Ela não autoriza mapear campos semanticamente diferentes.

Essa regra também vale para valores enumerados dos campos gerais. Um valor não reconhecido deve permanecer intacto e ser apresentado como pendência de catálogo; não pode ser substituído por um fallback com significado diferente.

## 8. Catálogo local de metadados

Enquanto não existir endpoint oficial de metadados, as definições dos 17 tipos ficam versionadas no código e disponíveis offline. Os payloads externos são validados por Zod no processo principal; o catálogo canônico é uma constante TypeScript pura e compartilhada entre main e renderer, sem dependência de React e ainda sem schema Zod próprio.

Estrutura atual:

```text
src/shared/types/b602-gdl.types.ts
src/shared/catalogos/b602-gdl.catalogo.ts
src/main/services/gdl.schema.ts
src/main/services/gdl-b602-normalizador.service.ts
```

`b602-gdl.types.ts` contém somente contratos normalizados que atravessam main, preload e renderer. Os tipos crus validados da API (`GdlPecaValidada` e `GdlRepValidada`) são derivados diretamente dos schemas Zod em `gdl.schema.ts`, evitando uma segunda declaração manual sujeita a divergência.

O catálogo compartilhado é a fonte única de códigos, labels, famílias, campos, opções e IDs canônicos. O normalizador consulta essa mesma fonte e considera como personalizados apenas os campos marcados com `mapeamentoApiConfirmado`; os demais continuam preservados em `extrasGdl`. Componentes React e o catálogo de cidades permanecem no renderer.

Cada tipo deve registrar:

- código e label exatos do GDL;
- família local;
- aliases do tipo;
- lista ordenada de campos personalizados;
- controle de cada campo;
- obrigatoriedade;
- opções com códigos e labels;
- data e ambiente da última verificação;
- referência da fixture anonimizada usada no teste.

Estado atual do catálogo: os 17 códigos possuem label, família, status de round-trip e campos visuais conhecidos. A estrutura aceita aliases de tipo/campo e distingue mapeamentos de API confirmados, mas ainda faltam aliases efetivamente cadastrados, data e ambiente da última verificação, referência de fixture por tipo e validação estrutural independente. Somente `CARABINA(S)` e `ESTOJO(S)` estão marcados como `roundTripConfirmado`; `REVÓLVER(ES)` permanece não confirmado apesar do mapeamento parcial de `Nº Série`.

Não criar `gdl_catalogos` ou sincronização automática nesta primeira implementação. As opções de endpoints oficiais já existentes, como unidades de medida, podem ganhar cache separado depois. O formulário dos 17 tipos não pode depender de scraping em nenhum ambiente.

Também não criar `gdl_reps_cache` nesta fase. Após o usuário aplicar a consulta, o dado normalizado já ficará persistido na REP local. O payload bruto deve existir apenas em memória durante revisão/importação.

## 9. Formulário e CRUD local

O formulário usa um editor de peças B602 baseado em coleção tipada, compartilhado pelas peças manuais e importadas.

### 9.0 Integração obrigatória com o cadastro atual de REP

O editor faz parte do formulário B602 já orquestrado por `REPsPage.tsx`; não será uma página, janela ou cadastro paralelo.

Hoje, `REPsPage.tsx` obtém as seções por `getSectionsForExame()` e renderiza cada componente registrado em `SECTION_REGISTRY`. Para B602, a implementação deve:

1. criar uma seção canônica `pecas_b602` no registro de campos do exame;
2. renderizá-la dentro do mesmo `<Form>`/`RepStepper` usado para criar e editar a REP;
3. substituir no `EXAM_FIELD_MAP['B-602']` as seções persistentes separadas `material_enc`, `cartuchos`, `estojos` e `armas` pela seção `pecas_b602`;
4. manter `dados_investigacao` e os demais campos gerais da REP no fluxo atual;
5. tratar dados técnicos exclusivos do laWdo como sub-blocos opcionais da própria peça ou como projeções derivadas, nunca como uma segunda cópia persistida.

Na tela de REPs, manter duas ações de entrada claras:

- `Nova REP`: inicia o fluxo manual com formulário vazio;
- `Consultar GDL`: inicia o fluxo dinâmico antes do cadastro local.

O botão de consulta também pode permanecer dentro de uma REP aberta para complementar ou reconsultar dados. Nas duas posições ele reutiliza o mesmo modal e o mesmo método tipado de aplicação.

Fluxo visual obrigatório da seção `Peças`:

1. exibir a lista das peças já adicionadas ou importadas;
2. ao clicar em `Adicionar peça`, abrir o editor local inicialmente com `Tipo do Item`;
3. ao selecionar um dos 17 tipos, resolver imediatamente sua definição no catálogo local;
4. renderizar, no mesmo editor, primeiro todos os inputs comuns e depois os inputs personalizados daquele tipo;
5. não exigir consulta ao GDL nem VPN para montar os campos, pois o catálogo é local;
6. validar os obrigatórios conforme o catálogo antes de adicionar/atualizar a peça na coleção;
7. voltar à lista após confirmar, mantendo `Editar` e `Excluir` disponíveis.

Ao trocar o tipo durante a edição, os campos comuns compatíveis devem ser preservados. Valores personalizados do tipo anterior não podem ser associados silenciosamente ao novo tipo: o sistema deve pedir confirmação antes de descartá-los, salvo quando todos estiverem vazios.

Peças vindas da API devem entrar na mesma coleção e abrir exatamente no mesmo editor. A origem não pode criar um formulário alternativo nem impedir alteração ou exclusão local.

O estado do formulário precisa representar `b602.pecas` como coleção tipada. A interface atual `REPFormData`, limitada por `[key: string]: string`, deve ser ajustada ou separada em um tipo de formulário que aceite a coleção sem casts artificiais. A integração pode usar `useFieldArray` ou componente controlado equivalente, desde que criação, edição, remoção, validação e reordenação não dependam de índices fixos ou de chaves planas como `b602_armas_0_*`.

O stepper atual considera apenas `requiredFields: string[]`; isso não representa corretamente a completude de uma coleção dinâmica. `ExamSection`/`useRepStepper` deve aceitar uma regra tipada de completude, por exemplo `isComplete(data)`, ou consultar o estado de validação da seção. A seção `Peças` só pode aparecer concluída quando cada peça adicionada for válida; não deve ser concluída automaticamente apenas por ter `requiredFields: []`.

### 9.1 Lista de peças

Cada card/linha deve exibir:

- tipo;
- identificação;
- quantidade e unidade;
- origem (`Manual` ou `Importada do GDL`);
- indicador de alteração local;
- ações `Editar` e `Excluir`.

### 9.2 Inclusão manual

1. usuário abre `Adicionar peça` na seção `Peças` do formulário da REP;
2. usuário escolhe um dos 17 tipos em `Tipo do Item`;
3. laWdo renderiza imediatamente os inputs comuns;
4. laWdo renderiza em seguida os inputs personalizados do catálogo daquele tipo;
5. valida obrigatórios e tipos;
6. adiciona a peça à coleção local;
7. usuário pode reabrir, alterar ou excluir antes e depois de salvar a REP.

### 9.3 Importação do GDL

1. usuário aciona `Consultar GDL` na página de REPs ou no formulário aberto;
2. informa número e ano e executa uma única consulta;
3. payload cru é validado na fronteira IPC e convertido pelo adaptador do exame;
4. modal exibe dados gerais, todas as peças, campos não mapeados e avisos antes de qualquer alteração local;
5. usuário escolhe `Preencher formulário` e, quando aplicável, quais peças importar;
6. se a consulta começou na listagem, abrir o mesmo formulário de nova REP já preenchido;
7. se o formulário já estava aberto, aplicar `Mesclar` ou `Substituir dados do GDL` conforme a seção 9.4;
8. inserir as peças na mesma coleção usada no cadastro manual;
9. marcar visualmente cada peça como `Importada do GDL` e permitir editar ou excluir localmente;
10. manter a REP apenas no formulário até o usuário confirmar o salvamento.

O modal aplica um `ResultadoImportacaoExame` tipado, mantendo separadamente `camposGerais`, `camposEspecificos`, `pecas` e `avisos`; peças não são achatadas nem enviadas para `observacoes`.

Se o tipo de exame retornado pelo GDL for reconhecido, selecionar o tipo local pelo código do exame. Se houver conflito com um tipo já escolhido no formulário, bloquear a aplicação até o usuário confirmar a troca; nunca misturar peças B602 em outro tipo de exame.

### 9.4 Mesclar e substituir

`Mesclar`:

- preenche apenas campos vazios da REP;
- adiciona peça cujo `codPecaGdl` ainda não exista localmente;
- para peça já importada, preenche somente valores vazios;
- preserva alterações locais.

`Substituir dados do GDL`:

- substitui campos gerais mapeados;
- substitui peças já importadas que tenham o mesmo `codPecaGdl`;
- não exclui peças de origem manual;
- antes de remover peça importada ausente na nova consulta, exige confirmação explícita.

O texto atual `Substituir tudo` deve ser revisto para deixar esse limite claro.

Estado atual: a implementação substitui campos gerais mapeados e peças importadas coincidentes, preserva peças manuais e não remove automaticamente nenhuma peça ausente. A confirmação e remoção opcional de peças importadas que deixaram de vir na consulta continuam pendentes.

Para uma REP local ainda vazia, não exibir a escolha entre mesclar e substituir: a ação única é `Preencher formulário`. A escolha só aparece quando existem dados locais relevantes.

### 9.5 Origem, auditoria de UX e desempenho

A origem serve para informar e controlar reconciliação, não para bifurcar validação ou UI:

- REP iniciada vazia: `origemPreenchimento = 'manual'`;
- REP iniciada ou complementada pela consulta: metadados da última consulta GDL, incluindo ambiente, número/ano e instante;
- peça manual: `origem = 'manual'`;
- peça importada: `origem = 'gdl'` e `codPecaGdl` quando disponível;
- edição de peça importada: `alteradaLocalmente = true`;
- exclusão de peça importada: confirmação informa explicitamente que a exclusão ocorre somente no laWdo.

Esses metadados não devem impedir o usuário de editar os mesmos campos nos dois fluxos.

Na persistência atual, o objeto completo é gravado em `campos_especificos.integracaoGdl`, mas a desserialização restaura somente `origemInicial` e `ultimaConsulta`. A reidratação validada de `dadosSolicitacao` e `dadosInvestigacao` é pendência necessária para que a reabertura reproduza integralmente o formulário salvo.

Regras de desempenho e renderização:

- carregar o catálogo local uma vez e indexar tipos/campos por código;
- renderizar somente o editor da peça ativa, não os formulários dos 17 tipos simultaneamente;
- exibir as demais peças como cards/resumos leves;
- usar `useWatch` apenas nos campos necessários ao tipo ativo e à completude, evitando observar toda a REP em cada card;
- estabilizar callbacks e definições de catálogo para evitar remontagem dos inputs;
- manter uma única chamada à API por consulta e não refazer consulta ao trocar ou editar tipo local;
- preservar o formulário intacto em timeout, falha de VPN ou cancelamento do modal.

## 10. Persistência e integração com o laudo

`campos_especificos.b602.pecas` será a fonte canônica das peças.

`campos_especificos.integracaoGdl` pode guardar `MetadadosIntegracaoGdl`, separado do domínio B602, para que o mesmo metadado seja reutilizável por outros exames. Não persistir credenciais nem o payload bruto nessa estrutura.

Não persistir cópias divergentes da mesma peça em `material_enc`, `armas`, `estojos` e outros arrays. Criar seletores/adaptadores derivados para os consumidores atuais:

- material encaminhado;
- tabelas de armas, estojos e demais famílias;
- placeholders simples e indexados;
- seções repetíveis por arma;
- toggles `func_toggle` e `coleta_toggle` quando aplicáveis;
- PDF da REP;
- sincronização de seções do laudo.

Estado atual: `REPsPage.tsx` remove os arrays legados do JSON e acrescenta `b602.pecas` antes de enviar a REP. A coleção ainda não é responsabilidade direta de `b602.service.ts`, e as projeções derivadas para placeholders, tabelas, PDF e seções repetíveis do laudo permanecem pendentes. Até essa consolidação, não considerar concluída a integração da coleção canônica com todos os consumidores.

O mapeamento de família não deve inventar equivalências. Exemplos:

- `Nº Série` de arma pode alimentar campo técnico local equivalente quando o tipo estiver mapeado; outros atributos só ganham campo local após decisão funcional explícita;
- `ORIGEM/COLETA` de `ESTOJO(S)` não equivale ao campo local `origem` que representa país;
- campos técnicos próprios do laWdo podem coexistir com os campos reproduzidos do GDL.

## 11. Etapas de execução

### Etapa 1 — Fundação e correções do contrato — núcleo implementado, consolidação pendente

- criar tipos compartilhados da REP e das peças GDL;
- criar schemas Zod para resposta, origem, andamento e peça dinâmica;
- remover casts diretos após `JSON.parse`;
- centralizar os tipos hoje duplicados entre main e renderer;
- criar normalizador comum/personalizado/extras;
- criar contrato tipado `ResultadoImportacaoExame` e registro mínimo de adaptadores por exame;
- separar no modal consulta/revisão da conversão específica do B602;
- corrigir o schema inicial para garantir `campos_especificos` em banco novo;
- substituir o envio de peças para `observacoes` por revisão estruturada;
- criar fixtures anonimizadas do formato confirmado em `190/2026`.
- inventariar os campos gerais compartilhados e seus valores enumerados, começando por `Tipo de Solicitação = BO`;
- substituir fallbacks locais que convertam valores GDL desconhecidos em `Outros` por preservação literal acompanhada de aviso de contrato.

Pendências desta etapa:

- criar o registro mínimo de adaptadores por exame; hoje o handler instancia diretamente o conversor B602;
- adicionar validação estrutural do catálogo local e seus aliases, separada do schema Zod do payload da API;
- evitar que a composição final de `b602.pecas` dependa de lógica específica em `REPsPage.tsx`.

### Etapa 2 — Editor genérico + tipos já confirmados — núcleo implementado, validação integrada pendente

- implementar coleção canônica e CRUD manual;
- integrar a seção `pecas_b602` ao `SECTION_REGISTRY` e ao `EXAM_FIELD_MAP['B-602']` consumidos por `REPsPage.tsx`;
- substituir a edição persistente separada de `material_enc`, `cartuchos`, `estojos` e `armas` pelo editor único de peças;
- implementar renderer dos inputs comuns;
- implementar a reação à seleção de `Tipo do Item`, exibindo no mesmo editor os campos comuns e personalizados do catálogo;
- adaptar a completude do stepper para coleções dinâmicas;
- disponibilizar `Nova REP` e `Consultar GDL` como entradas convergentes para o mesmo formulário;
- cadastrar metadados completos de `CARABINA(S)` e `ESTOJO(S)`;
- importar ambas pela API;
- permitir editar e excluir localmente;
- persistir e reabrir sem perda;
- validar comportamento offline.

Pendências desta etapa:

- reidratar sem perda os metadados de solicitação e investigação ao reabrir a REP;
- cobrir com testes de componente o CRUD, a troca de tipo, os obrigatórios e a preservação de campos comuns;
- cobrir o ciclo integrado de importar, selecionar peças, salvar, reabrir, mesclar e substituir;
- confirmar por teste que a serialização canônica não recria arrays legados.

### Etapa 3 — Família de armas — em andamento

Implementar o schema web já confirmado e executar o round-trip de API, um por vez:

1. `ARMA(S) DE CHOQUE` (`289`)
2. `ARMA(S) DE PRESSÃO` (`613`)
3. `ESPINGARDA(S)` (`472`)
4. `FUZIL(IS)` (`477`)
5. `GARRUCHA(S)` (`475`)
6. `PISTOLA(S)` (`104`)
7. `PISTOLETE(S)` (`478`)
8. `REVÓLVER(ES)` (`106`)
9. `SUBMETRALHADORA(S)` (`479`)

`CARABINA(S)` já integra a Etapa 2.

`REVÓLVER(ES)` possui retorno de API confirmado na REP `191/2026`, mas somente `Nº Série` está mapeado no laWdo. Os demais atributos retornados permanecem preservados como extras por decisão funcional.

Ao final, adaptar seções repetíveis, placeholders e toggles para trabalhar com todas as peças classificadas como arma, não apenas com o formato antigo de `b602.armas`.

### Etapa 4 — Componentes e materiais balísticos — pendente

Implementar o schema web já confirmado e executar o round-trip de API:

1. `CARREGADOR(ES)` (`272`)
2. `ESPOLETA(S)` (`473`)
3. `PÓLVORA` (`572`)
4. `PROJÉTEIS` (`105`)

`ESTOJO(S)` já integra a Etapa 2.

Confirmar separadamente o tratamento de `Cartuchos` existente no laWdo, pois `CARTUCHO(S)` não apareceu entre os 17 tipos oferecidos pelo GDL na amostra. Não remover o recurso local sem decisão funcional específica.

### Etapa 5 — Tipos genéricos e de homologação — pendente

- implementar e validar por API `OUTROS` (`178`), incluindo seus campos livres confirmados;
- implementar e validar por API `PEÇA TESTE` (`771`);
- confirmar se `PEÇA TESTE` existe em produção;
- manter o tipo disponível por ambiente conforme o catálogo confirmado, sem misturar dados de homologação e produção.

### Etapa 6 — Consolidação dos 17 tipos — pendente

- executar teste de contrato do catálogo completo;
- revisar obrigatoriedade e opções de todos os campos;
- revisar aliases da API;
- validar cadastro manual, importação, edição, exclusão e reabertura para os 17 tipos;
- atualizar placeholders/tabelas do laudo somente onde houver equivalência semântica aprovada;
- realizar teste exploratório final em homologação.

### Etapa 7 — Validação de promoção em produção — pendente

Após a aprovação integral em homologação:

1. configurar as credenciais de produção no laWdo;
2. consultar somente REPs de produção autorizadas para teste;
3. comparar catálogo de tipos, códigos, labels, obrigatoriedade e opções contra o catálogo validado em homologação;
4. comparar a estrutura de `/rep/obter`, incluindo campos comuns e propriedades personalizadas;
5. importar em uma REP local descartável usando `Mesclar`;
6. confirmar persistência, edição e exclusão apenas locais;
7. registrar divergências de contrato antes de liberar o ambiente de produção para uso regular.

Se produção divergir de homologação, o catálogo não deve ser atualizado silenciosamente: a divergência precisa de fixture, teste e decisão explícita.

## 12. Protocolo obrigatório de confirmação por tipo

Os 17 schemas visuais já foram coletados em homologação; os 15 tipos sem retorno de API confirmado não devem ser considerados concluídos por suposição. Para cada um deles:

1. selecionar o tipo no GDL web de homologação;
2. registrar código e label exatos;
3. enumerar todos os campos personalizados na ordem exibida;
4. registrar controle, obrigatoriedade, opções e códigos;
5. testar validação deixando obrigatórios vazios;
6. preencher valores distintivos e adicionar a peça a uma REP de teste;
7. consultar a REP por `/rep/obter`;
8. comparar chaves e valores devolvidos pela API;
9. criar fixture anonimizada;
10. cadastrar/atualizar a definição no catálogo local;
11. criar testes de cadastro manual e importação;
12. marcar o tipo como confirmado somente depois do round-trip completo.

## 13. IPC e segurança

Manter a integração somente leitura.

O canal `gdl:consultar-rep` deve devolver contrato validado e normalizado, incluindo peças estruturadas. Não são necessários novos canais de catálogo enquanto os metadados forem locais.

Se o contrato IPC mudar, atualizar em conjunto:

- handler;
- `ALLOWED_CHANNELS`;
- `IpcAPI`/preload;
- tipos compartilhados;
- consumidor no renderer.

Regras adicionais:

- renderer não acessa HTTP, Electron ou SQLite diretamente;
- credenciais não entram em logs, fixtures ou payloads do renderer;
- payload externo sempre cruza schema Zod;
- campos inesperados são preservados, não executados nem renderizados como HTML;
- revisar `rejectUnauthorized: false` antes de habilitar produção, preferindo instalar/confiar explicitamente na cadeia de certificados do GDL.

## 14. Arquivos e responsabilidades previstas

| Área | Responsabilidade |
|---|---|
| `src/shared/types/b602-gdl.types.ts` | contratos normalizados GDL/B602 compartilhados entre main, preload e renderer |
| `src/shared/catalogos/b602-gdl.catalogo.ts` | fonte canônica dos 17 tipos, campos, opções, aliases e mapeamentos de API confirmados |
| `src/main/services/gdl.schema.ts` | validação Zod da fronteira externa, interpretação segura do JSON e derivação dos tipos crus validados |
| `src/main/services/gdl.service.ts` | transporte e autenticação |
| `src/main/services/gdl-b602-normalizador.service.ts` | normalização da REP, peças, origens, envolvidos e avisos após a validação Zod, consumindo o catálogo compartilhado |
| `src/main/ipc/handlers/gdl.handlers.ts` | fronteira IPC somente leitura |
| `src/preload/index.ts` e tipos | exposição segura e tipada |
| `GdlConsultaModal.tsx` | revisão e seleção das peças a aplicar |
| registro/adaptadores de importação | pendente; converter o resultado validado pelo exame sem acoplar `gdl.handlers.ts` diretamente ao B602 |
| `exam-fields/index.ts` | registrar `pecas_b602` e substituir as seções B602 persistentes antigas no mapa do formulário |
| `exam-fields/pecas-b602.tsx` | seção `Peças`, lista, seleção do tipo e editor dinâmico de campos comuns/personalizados |
| `exam-fields/pecas-b602.utils.ts` | mesclagem e substituição por `codPecaGdl`, preservando alterações locais e peças manuais |
| `exam-fields/services/b602.service.ts` | serialização do restante do formulário B602; migração da coleção canônica para este serviço ainda pendente |
| `exam-fields/types.ts` | props tipadas para a coleção controlada separadamente do mapa de campos string |
| `REPsPage.tsx` | orquestrar o formulário, aplicar a consulta, manter a coleção em estado próprio e compor `b602.pecas`/`integracaoGdl` na persistência |
| `secao-builder.service.ts` | projeções para seções/toggles derivados |
| exportação e placeholders | projeções aprovadas da coleção canônica |

Extrair componentes e hooks por responsabilidade quando o editor crescer; não concentrar catálogo, normalização, UI e persistência em `b602.tsx` ou `REPsPage.tsx`.

## 15. Testes automatizados

Estado em `12/07/2026`: existem 17 testes focados, distribuídos entre schema/normalizador GDL B602 (10), catálogo B602 (3), reconciliação de peças (3) e catálogo de cidades (1). Eles passam localmente. As listas abaixo continuam sendo a cobertura-alvo; itens de componente, persistência integrada e laudo ainda não estão implementados.

### Contrato GDL

- rejeitar payload estruturalmente inválido;
- aceitar propriedades personalizadas adicionais;
- preservar campo desconhecido em `extrasGdl`;
- garantir que credenciais e valores brutos não sejam logados;
- fixture de `CARABINA(S)` contém os quatro campos personalizados confirmados;
- fixture de `ESTOJO(S)` contém `ORIGEM/COLETA`;
- peça sem campo personalizado continua válida.

### Catálogo

- possuir exatamente 17 códigos únicos;
- não aceitar código `0`;
- garantir label, família e aliases únicos;
- validar IDs canônicos de campos;
- validar opções sem códigos duplicados;
- falhar enquanto algum tipo marcado como concluído não tiver fixture de round-trip.

### CRUD local

- selecionar o tipo abre os campos comuns e personalizados corretos no formulário da REP;
- trocar o tipo preserva campos comuns e confirma descarte de personalizados preenchidos;
- criar manualmente cada tipo;
- validar campos obrigatórios;
- editar campos comuns e personalizados;
- excluir somente a peça selecionada;
- persistir e reabrir a coleção;
- preservar campos técnicos exclusivos do laWdo.

### Importação

- iniciar consulta pela listagem e abrir o mesmo formulário de nova REP preenchido;
- consultar dentro de formulário existente sem perder dados em erro ou cancelamento;
- não salvar automaticamente após aplicar a consulta;
- selecionar automaticamente B602 apenas quando o código retornado for compatível;
- não colocar peças em `observacoes`;
- importar todas as peças selecionadas;
- deduplicar por `codPecaGdl`;
- mesclar sem sobrescrever alteração local;
- substituir somente dados originados do GDL;
- preservar peças manuais;
- permitir editar e excluir peça importada;
- preservar propriedade desconhecida da API.
- exibir e persistir valores gerais recebidos do GDL sem degradação semântica, incluindo `Tipo de Solicitação = BO`;
- sinalizar valor enumerado ainda não catalogado sem convertê-lo para `Outros`.

### Integração com laudo

- projetar corretamente peças da família arma;
- manter seções repetíveis e toggles por arma;
- gerar tabelas e placeholders sem duplicar dados persistidos;
- não tratar `ORIGEM/COLETA` como país de origem;
- sincronizar o laudo após alteração ou exclusão local de peça.

## 16. Validação manual

Para cada etapa:

1. cadastrar peça manualmente;
2. salvar e reabrir a REP local;
3. importar peça equivalente do GDL;
4. testar `Mesclar`;
5. testar `Substituir dados do GDL`;
6. editar a peça importada;
7. excluir a peça localmente;
8. confirmar que nenhuma operação alterou o GDL;
9. desligar a VPN e validar cadastro/edição offline;
10. gerar/sincronizar laudo quando o tipo possuir projeção aprovada;
11. após a aprovação em homologação, executar a validação somente leitura em produção.

## 17. Critérios de aceitação

Os itens abaixo são critérios globais de conclusão e não representam, por si só, estado concluído. Na auditoria atual, permanecem abertos principalmente a reidratação integral dos metadados, a semântica completa de substituição, o registro de adaptadores, as projeções para o laudo, os testes integrados e os round-trips restantes.

- Os 17 tipos do catálogo podem ser selecionados no laWdo.
- `Nova REP` inicia o formulário vazio e `Consultar GDL` inicia o mesmo formulário com carga revisada da API.
- Aplicar dados do GDL nunca salva a REP automaticamente.
- A seção `Peças` é exibida no cadastro e na edição da REP B602 dentro de `REPsPage.tsx`/`RepStepper`.
- Ao selecionar `Tipo do Item`, o mesmo editor exibe imediatamente os inputs comuns e os personalizados daquele tipo, sem consultar o GDL.
- Todos os campos comuns do formulário GDL estão disponíveis localmente.
- Todos os campos personalizados confirmados de cada tipo são reproduzidos com controle, obrigatoriedade e opções corretos.
- O usuário pode criar, editar e excluir qualquer peça localmente.
- A consulta GDL preenche automaticamente campos comuns e personalizados devolvidos pela API.
- Peças importadas e manuais usam a mesma estrutura e o mesmo editor.
- A origem manual/GDL permanece visível sem criar diferenças de campos ou de validação.
- Campos desconhecidos da API são preservados e apresentados como não mapeados, sem perda silenciosa.
- Peças não são gravadas em `observacoes`.
- `campos_especificos.b602.pecas` é a única fonte persistida das peças.
- Mesclar preserva dados e alterações locais.
- Substituir não remove peça manual sem confirmação explícita.
- O laWdo funciona offline para cadastro, edição, exclusão e reabertura.
- Nenhuma ação do fluxo realiza escrita no GDL.
- Produção é liberada somente após validação de equivalência com homologação ou registro explícito das divergências aprovadas.
- Campos equivalentes entre laWdo e GDL usam o contrato canônico do GDL; campos exclusivos do laWdo permanecem separados.
- `Tipo de Solicitação = BO` é exibido e persistido como `BO`, e não como `Outros`.
- TypeScript, lint e testes ficam verdes sem aumentar warnings.

## 18. Fora do escopo

- criar, atualizar ou excluir peça no GDL;
- enviar REP ou laudo ao GDL;
- sincronização bidirecional;
- scraping da interface web do GDL, em qualquer ambiente ou como contingência; a integração deve consumir exclusivamente endpoints oficiais da API GDL;
- geração automática de metadados confiáveis somente a partir dos nomes das propriedades;
- sincronizar tipos de item de outras naturezas de exame;
- compatibilidade com o formato B602 persistido antes desta implementação.

## 19. Branch e validação técnica

A implementação está na branch exclusiva `codex/gdl-b602`.

Regras da branch:

- conter somente mudanças relacionadas à integração GDL/B602 e às adaptações estruturais necessárias para suportá-la;
- não misturar correções ou funcionalidades sem relação com este plano;
- preservar alterações locais preexistentes do usuário antes de criar ou trocar de branch;
- implementar e validar as etapas em incrementos revisáveis, evitando uma única alteração monolítica;
- somente integrar à branch principal depois que os critérios de aceitação, testes automatizados e validação exploratória em homologação estiverem concluídos;
- validações de produção permanecem posteriores à aprovação em homologação e não impedem que a implementação seja revisada em pull request.

Após cada etapa:

```bash
npm run type-check
npm run lint
npm test
```

Executar também `npm run test:coverage` quando forem adicionadas as fixtures e a nova camada de normalização.

### Última validação local

Em `12/07/2026`, sobre a árvore de trabalho auditada:

- `npm run type-check`: aprovado;
- `npm run lint`: aprovado;
- `npm run build`: aprovado;
- testes focados de schema/normalizador, catálogo, cidades e reconciliação: 17 aprovados em 4 arquivos;
- `npm test`: 9 arquivos aprovados, 60 testes aprovados e 1 ignorado;
- `npm run test:coverage`: aprovado com 56,7% de statements, 45,7% de branches, 71,72% de functions e 58,92% de lines no conjunto instrumentado.

Os avisos emitidos pelo Vite durante os testes referem-se à depreciação das opções `esbuild` do plugin React e não causaram falha nas validações.
