# Plano: integração B602 com peças da API GDL

## 1. Objetivo

Reproduzir no cadastro de REP B602 do laWdo o fluxo de peças do GDL, incluindo:

- os inputs comuns a todas as peças;
- os inputs personalizados dos 16 tipos de item mapeados; `PEÇA TESTE` é ignorada por decisão funcional;
- criação manual de peças no laWdo;
- preenchimento automático por consulta somente leitura à API GDL;
- edição e exclusão local de qualquer peça, inclusive após importação do GDL;
- persistência estruturada em `campos_especificos.b602`, sem despejar peças em `observacoes`.

O GDL continua sendo o sistema oficial. O laWdo não criará, atualizará ou excluirá peças no GDL nesta entrega.

O formato canônico novo não deve reproduzir os arrays B602 legados. A escrita atual usa `b602.pecas`, mas a leitura mantém compatibilidade controlada com estruturas anteriores que ainda podem existir em REPs locais. Essa compatibilidade é assimétrica: abrir dados antigos é permitido; recriar os dois formatos na escrita não é.

### 1.1 Princípio dos dois fluxos

Existem dois pontos de entrada, mas apenas um formulário, um contrato de dados e uma persistência:

- **fluxo manual:** cria uma REP vazia no laWdo e o usuário preenche os campos gerais e as peças;
- **fluxo dinâmico:** consulta uma REP no GDL, revisa o retorno e usa esse resultado para preencher o mesmo formulário local.

A diferença entre os fluxos termina depois da carga inicial. Campos, controles, obrigatoriedade, edição, exclusão, validação e salvamento são os mesmos. Não criar componentes `FormularioManualB602` e `FormularioGdlB602`, schemas paralelos ou regras de negócio duplicadas.

O preenchimento vindo do GDL não salva automaticamente a REP. Ele apenas prepara o formulário local; o usuário continua responsável por revisar e confirmar `Criar REP` ou `Atualizar REP`.

### 1.2 Estado atual da implementação

Implementado no código e coberto pelas validações locais descritas na seção 19:

- consulta geral somente leitura por `GdlConsultaModal`, com revisão de dados e peças antes da aplicação no mesmo formulário de REP;
- revisão exclusiva de peças por `GdlPecasModal`, acionada dentro da seção `Peças` e consultando automaticamente o número/ano já preenchido;
- validação Zod da resposta e normalização no processo principal;
- catálogo local dos 16 tipos suportados, editor estruturado de peças e persistência em `campos_especificos.b602.pecas`;
- catálogos completos de `PISTOLA(S)` e `REVÓLVER(ES)`, com selects copiados do GDL e `Marca da Arma` pesquisável entre 1.379 opções ou por texto livre;
- criação, edição e exclusão local de peças manuais ou importadas, sem escrita no GDL;
- preenchimento de número/ano da REP, data de recebimento, tipo e número da solicitação, cidade, órgão/unidade policial, autoridade solicitante, BO, IP e envolvidos quando disponíveis;
- classificação resiliente das famílias BO e IP, com preservação do tipo exato e aviso para números conflitantes;
- catálogo compartilhado dos tipos de origem do GDL e seletor controlado que trata tipo+número como um par;
- preenchimento da cidade por select editável com o catálogo do Paraná;
- round-trip confirmado dos 16 tipos suportados, com fixtures anonimizadas e reabertura por IPC/SQLite para as REPs `191/2026` e `192/2026`;
- preservação de campos da API ainda não mapeados, sem perda silenciosa;
- consulta auxiliar de envolvidos em homologação, com falha tolerada e aviso quando nenhum nome reconhecível for retornado;
- serialização canônica de peças e metadados pelo contexto tipado do `b602Service`;
- round-trip por handlers IPC e SQLite temporário, cobrindo criação, Mesclar, Substituir e reabertura sem recriar arrays legados;
- normalização comum aos 16 tipos mapeados de Data de Entrada, Data de Liberação, Quant. Descrição, Código do Vestígio e Observação, aceitando chaves canônicas ou labels visuais;
- reidratação validada de `dadosSolicitacao`, `dadosInvestigacao` e `ultimaConsulta`, incluindo leitura do nome legado `origensCandidatasSolicitacao`;
- reconciliação por `codPecaGdl`: a consulta geral inicia com todas as peças retornadas marcadas, enquanto a revisão exclusiva marca somente as peças GDL ainda presentes no formulário e mantém desmarcadas as removidas anteriormente.

Limitações e pendências confirmadas na auditoria do código:

- `Marca da Arma = Taurus (1316)` e `Tipo Acabamento = Cromado (44)` foram confirmados no retorno da API de `REVÓLVER(ES)` e passaram a ser mapeados automaticamente; `incinerado` de `ESTOJO(S)` foi confirmado como campo comum `Sim=S`/`Não=N` e não como personalizado;
- a consulta auxiliar de envolvidos existe apenas em homologação, é sequencial e pode somar até 15 segundos por filtro em caso de timeout;
- o modo `Substituir dados do GDL` e o modal exclusivo removem da coleção local peças GDL desmarcadas, inclusive as que deixaram de aparecer na consulta; peças manuais permanecem;
- os testes automatizados cobrem normalização, catálogo, reconciliação, serialização canônica, reidratação, seletor de tipo de solicitação, editor completo, `GdlPecasModal`, consulta geral, aplicação integrada à `REPsPage`, persistência por IPC/SQLite e projeções para o laudo; a rede GDL real permanece sem automação ponta a ponta;
- a validação de equivalência em produção permanece pendente.

### 1.3 Problemas encontrados e resolvidos

Os itens abaixo permanecem no plano como contexto de manutenção. Eles não devem voltar à lista de pendências sem nova evidência.

| Problema observado | Estado atual | Evidência da resolução |
|---|---|---|
| `IP/PM` era degradado para `Outros` após aplicar a REP `191/2026` | resolvido | `TipoSolicitacaoSelect.tsx` separa aplicação programática de interação do usuário; testes cobrem `IP/PM` e preservação conjunta do número |
| origens do mesmo tipo perdiam alternativas com números diferentes | resolvido | normalizador deduplica pelo par tipo normalizado+número; seletor identifica a origem pelo par exato |
| metadados persistidos não eram reidratados integralmente | resolvido | `integracao-gdl-b602.utils.ts` valida e restaura solicitação, investigação e última consulta, com compatibilidade do nome legado |
| `REPsPage` recompunha o JSON após o serializer | resolvido | `ContextoSerializacaoCamposEspecificos` leva peças e metadados ao `b602Service`, que produz diretamente o formato canônico |
| unidade policial derivada do GDL desaparecia na reabertura | resolvido | `b602.solicitante_nome` participa da escrita e leitura; órgão GDL tem precedência sobre solicitante local |
| `/rep/obter` não fornecia envolvidos reconhecíveis | parcialmente resolvido | homologação consulta também `/repsInvestigacaoPolicial/listarReps`; produção ainda não usa essa complementação |
| campos comuns existentes na API eram inicializados vazios | resolvido | Data de Liberação, Quant. Descrição, Código do Vestígio e Observação são resolvidos por chave canônica ou label; datas brasileiras/ISO são normalizadas para o input local |
| `PISTOLA(S)` expunha somente parte dos campos e mantinha `Marca` redundante | resolvido no schema local | o editor usa 11 campos confirmados visualmente; `Marca` fica em `extrasGdl` e `Marca da Arma` aceita catálogo ou texto livre |
| persistência B602 não tinha prova integrada por IPC/banco | resolvido | `rep-b602-persistencia.integration.test.ts` atravessa handlers reais e SQLite temporário nos cenários Criar, Mesclar e Substituir |

## 2. Evidências confirmadas em homologação

Os testes foram realizados no GDL de homologação com as REPs B602 `190/2026`, `191/2026` e `192/2026`.

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

`numeroAnalises` pertence ao contrato bruto da API e continua sendo aceito na validação de entrada, mas não deve ser mapeado para o modelo, o formulário nem a persistência nova do laWdo. O campo não é relevante para a confecção do laudo e também não deve ser reclassificado como `extrasGdl`.

Campos personalizados confirmados:

| Tipo | Código do tipo | Campo | Controle no GDL web | Obrigatório | Opções confirmadas |
|---|---:|---|---|---|---|
| `CARABINA(S)` | `476` | `Nº Série` | texto | não | — |
| `CARABINA(S)` | `476` | `Marca` | texto | não | — |
| `CARABINA(S)` | `476` | `Modelo` | texto | não | — |
| `CARABINA(S)` | `476` | `Arma é Institucional?` | lista de seleção | sim | `Indeterminado=60`, `NÃO=98`, `SIM=97` |
| `ESTOJO(S)` | `101` | `ORIGEM/COLETA` | select | sim | `DELEGACIA=95`, `LOCAL DE CRIME=93`, `NECRÓPSIA=94`, `Outro=11` |
| `ESTOJO(S)` | `101` | `incinerado` | select comum | não | `Sim=S`, `Não=N`; valor `NÃO` observado pela API e normalizado para `materialIncinerado=N` |
| `REVÓLVER(ES)` | `106` | `Nº Série` | texto | não | valor observado pela API |
| `REVÓLVER(ES)` | `106` | `Marca` | texto, 50 | não | valor observado e mapeado pela API |
| `REVÓLVER(ES)` | `106` | `Modelo` | texto, 50 | não | valor observado e mapeado pela API |
| `REVÓLVER(ES)` | `106` | `Marca da Arma` | combobox pesquisável | não | 1.379 opções; retorno `Taurus` confirmado pela API e normalizado no campo `106:marca_arma` |
| `REVÓLVER(ES)` | `106` | `Status do Número de Série` | select | não | `Ilegível=19`, `Legível=20`, `Não Aparente=10`, `Revelado=22`, `Suprimido intencionalmente=21` |
| `REVÓLVER(ES)` | `106` | `Calibre Nominal Revolver` | select | não | `.22 Curto=24`, `.22LR=23`, `.32S&W=25`, `.357 Magnum=28`, `.38SPL=26`, `38 Curto=27` |
| `REVÓLVER(ES)` | `106` | `Tipo Acabamento` | select | não | mesmos cinco valores confirmados de `PISTOLA(S)`; retorno `Cromado` confirmado pela API e normalizado como código `44` |
| `REVÓLVER(ES)` | `106` | `Estado Geral da Arma` | select | não | `Bom=54`, `Regular=53`, `Ruim=55` |
| `REVÓLVER(ES)` | `106` | `Funcionamento` | select | sim | `Eficiente=57`, `Ineficiente=56`, `NÃO TESTADO=100` |
| `REVÓLVER(ES)` | `106` | `Fabricação da Arma` | select | não | valor observado e mapeado pela API |
| `REVÓLVER(ES)` | `106` | `Tambor` | select | não | `reversível para a direita=72`, `reversível para a esquerda=73` |
| `REVÓLVER(ES)` | `106` | `Arma é Institucional?` | lista de seleção exclusiva | sim | `Indeterminado=60`, `NÃO=98`, `SIM=97` |

A peça `ARMA(S) DE PRESSÃO` retornou apenas campos comuns na amostra. O seu formulário foi posteriormente observado e tem campos personalizados; por isso, a amostra da API não substitui o round-trip com valores preenchidos.

### 2.2.1 Catálogo visual integral confirmado

Todos os 17 tipos oferecidos pelo GDL foram selecionados individualmente em homologação. Somente 16 integram o catálogo do laWdo: `PEÇA TESTE` foi excluída por decisão funcional em `20/07/2026` e deve ser ignorada na importação. A tabela confirma o schema visual, mas não substitui a validação de round-trip pela API descrita na seção 12.

| Código | Tipo | Campos personalizados visíveis no GDL web | Status de API |
|---:|---|---|---|
| `289` | `ARMA(S) DE CHOQUE` | `Nº Série`, `Marca`, `Modelo` — texto, opcionais | retorno preenchido, importação e reabertura confirmados |
| `613` | `ARMA(S) DE PRESSÃO` | `Nº Série` (`text`, 25), `Marca` (`text`, 50), `Modelo` (`text`, 50) — opcionais | retorno API com valores preenchidos, importação e reabertura confirmados |
| `476` | `CARABINA(S)` | `Nº Série`, `Marca`, `Modelo` opcionais; `Arma é Institucional?` obrigatório (`Indeterminado=60`, `NÃO=98`, `SIM=97`) | confirmado |
| `272` | `CARREGADOR(ES)` | nenhum campo personalizado na reinspeção e no cadastro da amostra `T272-20260720` | campos comuns, importação e reabertura confirmados |
| `472` | `ESPINGARDA(S)` | 12 campos: três textos básicos, `Capacidade`, `Marca da Arma`, status do número, calibre, acabamento, estado geral, `Funcionamento`, fabricação e institucional | retorno API preenchido, importação e reabertura confirmados |
| `473` | `ESPOLETA(S)` | nenhum | campos comuns, importação e reabertura confirmados |
| `101` | `ESTOJO(S)` | `ORIGEM/COLETA` obrigatório (`DELEGACIA=95`, `LOCAL DE CRIME=93`, `NECRÓPSIA=94`, `Outro=11`); `incinerado` é campo comum `S/N` | confirmado, incluindo normalização de `incinerado` |
| `477` | `FUZIL(IS)` | `Nº Série`, `Marca`, `Modelo` opcionais; `Arma é Institucional?` obrigatório | retorno API preenchido, importação e reabertura confirmados |
| `475` | `GARRUCHA(S)` | `Nº Série`, `Marca`, `Modelo` opcionais; `Fabricação da Arma` select opcional | retorno API preenchido, importação e reabertura confirmados |
| `178` | `OUTROS` | nenhum campo personalizado na reinspeção e no cadastro da amostra `T178-20260720` | campos comuns, importação e reabertura confirmados |
| `771` | `PEÇA TESTE` | observado apenas para diagnosticar o formulário | excluído do catálogo e ignorado pela importação do laWdo por decisão funcional |
| `104` | `PISTOLA(S)` | 11 campos locais: `Nº Série`, `Modelo`, `Capacidade`, `Marca da Arma`, status do número, calibre, acabamento, estado geral, `Funcionamento`, fabricação e institucional; o texto livre `Marca` do GDL não é mapeado por decisão funcional | round-trip confirmado com a fixture anonimizada da REP `192/2026`; `Marca da Arma` aceita catálogo ou texto livre |
| `478` | `PISTOLETE(S)` | nenhum campo personalizado na reinspeção | campos comuns, importação e reabertura confirmados |
| `572` | `PÓLVORA` | nenhum | campos comuns, importação e reabertura confirmados |
| `105` | `PROJÉTEIS` | `ORIGEM/COLETA` obrigatório, com as mesmas quatro opções e códigos de `ESTOJO(S)` | retorno API preenchido, importação e reabertura confirmados |
| `106` | `REVÓLVER(ES)` | 12 campos: três textos básicos, `Marca da Arma`, status do número, calibre, acabamento, estado geral, `Funcionamento`, fabricação, `Tambor` e institucional | retorno API confirmado na REP `191/2026`; catálogo extenso de marcas exige controle pesquisável |
| `479` | `SUBMETRALHADORA(S)` | `Nº Série`, `Marca`, `Modelo` opcionais; `Arma é Institucional?` obrigatório | retorno API preenchido, importação e reabertura confirmados |

`Fabricação da Arma` possui as opções: `argentina=61`, `austríaca=62`, `brasileira=63`, `canadense=64`, `czechoslovakia=66`, `espanhola=67`, `filipena=68`, `finlandesa=69`, `italiana=70`, `mexicana=71`, `Não Aparente=10` e `sul-coreana=65`; o placeholder `Selecione=0` não é valor persistível.

`Arma é Institucional?` é exibido pelo GDL como três checkboxes (`Indeterminado=60`, `NÃO=98`, `SIM=97`), embora represente uma escolha única obrigatória. O laWdo deve conservar a aparência de checkbox e impor exclusividade no estado para impedir múltiplos valores simultâneos.

### 2.3 Comportamento atual do laWdo

As peças retornadas pela API são normalizadas em uma coleção estruturada e aplicadas a `campos_especificos.b602.pecas`. Elas não são convertidas em linhas de `observacoes`. Peças manuais e importadas usam o mesmo editor local e podem ser alteradas ou excluídas sem modificar o GDL.

Há dois comportamentos de seleção:

- na consulta geral por `GdlConsultaModal`, todas as peças retornadas vêm marcadas por padrão na primeira importação;
- no botão `Selecionar peças do GDL`, `GdlPecasModal` consulta automaticamente a REP já informada e reflete a coleção atual: peça GDL presente fica marcada, peça nova ou removida anteriormente fica desmarcada e peça local que não retornou continua visível com essa indicação.

Ao aplicar a revisão exclusiva, peças GDL desmarcadas são removidas localmente e as marcadas são reconciliadas por `codPecaGdl`; peças manuais não participam da remoção. Propriedades reconhecidas pelo catálogo alimentam campos personalizados; propriedades ainda não mapeadas ficam em `extrasGdl`. Nenhum dos fluxos salva a REP automaticamente.

### 2.4 Limite da evidência atual

As evidências deste plano foram obtidas exclusivamente no ambiente de homologação. A observação visual inicial indica que os campos de produção são idênticos, mas isso não substitui validação de contrato no ambiente de produção.

Produção será usada apenas depois da implementação estar aprovada em homologação e sempre em modo somente leitura. Nenhuma etapa deste plano autoriza criar, editar, excluir ou concluir REP/peça no GDL de produção.

### 2.5 Consulta auxiliar de envolvidos em homologação

As REPs de homologação `190/2026` e `191/2026` possuem envolvidos visíveis no GDL, mas `/api/rep/obter` não retornou nomes reconhecíveis. A integração passou a consultar também `POST /repsInvestigacaoPolicial/listarReps` em homologação.

O fluxo atual:

- extrai filtros únicos das origens, aceitando ano separado ou incorporado ao número;
- usa `numeroCaso` positivo como fallback;
- exige CPF com 11 dígitos;
- processa os filtros sequencialmente, com timeout de 15 segundos por filtro;
- valida a resposta auxiliar por Zod e acrescenta os envolvidos ao payload principal;
- tolera CPF inválido, ausência de filtros, status diferente de 200, JSON inválido e timeout, preservando a consulta principal e registrando `warn`.

Limitação restante: a complementação está habilitada somente em homologação. O campo continua disponível para preenchimento manual e o normalizador emite aviso quando nenhum envolvido reconhecível for encontrado. Scraping da interface web permanece proibido.

### 2.6 Problema resolvido — Tipo de Solicitação `IP/PM`

Na REP de homologação `191/2026`, a origem candidata `IP/PM` era reconhecida pelo normalizador, aparecia entre as opções e fornecia corretamente o número `212314/2026`, mas o campo `Tipo de Solicitação` mudava para `Outros` e abria o input manual vazio. A REP `190/2026`, cuja origem candidata é `BO`, não apresentava o defeito.

O cadastro local de solicitantes não participava desse defeito. A causa estava no estado/controlador do select e na aplicação programática de valores dinâmicos não presentes no catálogo estático inicial.

Antes da correção, foram tentados sem sucesso:

- inclusão das origens candidatas `BO`, `IP` e `OFÍCIO` como opções dinâmicas;
- transporte conjunto de tipo e número da origem;
- distinção entre valor recebido do GDL e escolha manual de `Outros`;
- estado exclusivo para o modo manual `Outros`;
- tratamento de valores padrão durante `Mesclar`.

A correção final isolou o comportamento em `TipoSolicitacaoSelect.tsx`. O componente:

- distingue aplicação programática de interação real do usuário com `interacaoUsuarioRef`;
- usa uma chave interna por índice para origens GDL e identifica a seleção pelo par exato tipo+número;
- preserva valores do catálogo GDL e valores desconhecidos efetivamente recebidos do GDL;
- mantém valores manuais livres no modo `Outros`;
- atualiza tipo e número juntos ao escolher origem GDL;
- limpa o número ao escolher um tipo manual ou `Outros`, evitando associação residual.

Os testes de helper e de componente cobrem `IP/PM`, aplicação da API sem apagamento, seleção manual posterior, origens repetidas do mesmo tipo e valor livre.

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

- catálogo dos 16 tipos mapeados e seus códigos;
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
- o tipo exato do GDL é preservado no contrato e exibido na revisão e no formulário, por exemplo `BO/PM`, `BOC`, `IP ONLINE`, `IP/PM` e `IPM/EXÉRCITO`; a correção da apresentação de `IP/PM` está registrada na seção 2.6;
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

O registro em `gdl-adaptadores.service.ts` resolve o adaptador pelo código do exame. B602 é a primeira implementação; um código sem adaptador produz erro explícito. Um novo exame poderá fornecer seu catálogo, schema e adaptador sem alterar o transporte GDL nem duplicar o modal de busca.

Separação de responsabilidades:

- `gdl.service.ts`: transporte, autenticação e timeout;
- schemas/normalizador GDL: validação da fronteira externa;
- adaptador do exame: conversão do payload validado para o modelo local;
- modal de consulta: busca, revisão e escolha de aplicação;
- formulário do exame: edição e validação do modelo local;
- service do exame: serialização e desserialização.

## 4. Catálogo dos 16 tipos mapeados

O valor `0` (`Selecione um Tipo`) não integra o catálogo.

| Ordem | Código | Tipo no GDL | Família inicial | Status do schema | Etapa |
|---:|---:|---|---|---|---:|
| 1 | `289` | `ARMA(S) DE CHOQUE` | arma | round-trip confirmado | 3 |
| 2 | `613` | `ARMA(S) DE PRESSÃO` | arma | round-trip confirmado | 3 |
| 3 | `476` | `CARABINA(S)` | arma | campos e retorno API confirmados | 2 |
| 4 | `272` | `CARREGADOR(ES)` | componente | round-trip confirmado, sem personalizados | 4 |
| 5 | `472` | `ESPINGARDA(S)` | arma | round-trip confirmado | 3 |
| 6 | `473` | `ESPOLETA(S)` | componente | round-trip confirmado, sem personalizados | 4 |
| 7 | `101` | `ESTOJO(S)` | componente balístico | campos e retorno API confirmados | 2 |
| 8 | `477` | `FUZIL(IS)` | arma | round-trip confirmado | 3 |
| 9 | `475` | `GARRUCHA(S)` | arma | round-trip confirmado | 3 |
| 10 | `178` | `OUTROS` | genérico | round-trip confirmado, sem personalizados | 5 |
| 11 | `104` | `PISTOLA(S)` | arma | round-trip confirmado pela fixture da REP `192/2026`, incluindo persistência e reabertura por IPC/SQLite | 3 |
| 12 | `478` | `PISTOLETE(S)` | arma | round-trip confirmado, sem personalizados | 3 |
| 13 | `572` | `PÓLVORA` | componente balístico | round-trip confirmado, sem personalizados | 4 |
| 14 | `105` | `PROJÉTEIS` | componente balístico | round-trip confirmado | 4 |
| 15 | `106` | `REVÓLVER(ES)` | arma | round-trip confirmado pela fixture da REP `191/2026`, incluindo os dez campos preenchidos e reabertura por IPC/SQLite | 3 |
| 16 | `479` | `SUBMETRALHADORA(S)` | arma | round-trip confirmado | 3 |

O catálogo local deve conter exatamente esses 16 códigos. O GDL oferece também `PEÇA TESTE` (`771`), mas o normalizador deve descartá-la antes de montar `b602.pecas`. Alteração futura do catálogo deve ser detectada por teste de contrato, não absorvida silenciosamente.

## 5. Inputs comuns das peças

O editor local deve reproduzir os inputs comuns relevantes para a confecção do laudo, mesmo quando alguns não forem devolvidos por `/rep/obter`. Campos administrativos sem uso pericial podem ser descartados explicitamente conforme decisão registrada neste plano.

| Campo local canônico | Label observado no GDL | Retorno API confirmado | Observação |
|---|---|---|---|
| `tipoCodigo` / `tipoPeca` | Tipo do Item | somente `tipoPeca` | código vem do catálogo local |
| `identificacao` | Identificação | sim | texto |
| — | Nº Análises | sim | não mapear; dado administrativo sem relevância para a confecção do laudo |
| `quantidade` | Quantidade | sim | número positivo |
| `unidadeMedida` | Medida | sim | select preenchido por padrão com `UNIDADES`; opções copiadas do catálogo visual do GDL |
| `quantidadeDescricao` | Quant. Descrição | não confirmado | texto local preservado e preenchido quando a API devolver a chave canônica ou o label visual |
| `examinadoInLoco` | Examinado In Loco | sim | checkbox, booleano normalizado |
| `dataEntrada` | Data de Entrada | sim | regra comum aos 16 tipos mapeados: normalizar `DD/MM/AAAA`, data brasileira com horário ou ISO para `AAAA-MM-DD`, formato do input local |
| `lacreEntrada` | Lacre Entrada | sim | texto |
| `lacreSaida` | Lacre Saída | sim | texto |
| `dataLiberacao` | Data de Liberação | sim | regra comum aos 16 tipos mapeados: normalizar data brasileira, com horário, ou ISO para `AAAA-MM-DD` |
| `codigoVestigio` | Código do Vestígio | não confirmado | texto local preservado e preenchido quando a API devolver a chave canônica ou o label visual |
| `consumida` | Consumido/Liberado no Exame? | sim | `Sim`, `Não` ou `Parcialmente`; padrão `Não`, sem opção vazia |
| `observacao` | Observação | não confirmado | observação da peça, não da REP inteira; preencher quando a API devolver a chave canônica ou o label visual |

### 5.1 Campos gerais compartilhados com o GDL

Os campos gerais da REP também entram na política de precedência semântica. A importação deve mapear valores por catálogo/aliases confirmados e manter o valor original quando ainda não houver correspondência local.

Para `Tipo de Solicitação`:

- `BO`, observado na REP `190/2026`, deve ser aceito, exibido e persistido literalmente;
- a UI não deve converter automaticamente um valor GDL desconhecido em `Outros`;
- aliases como `BOU`, `BO PM` e `BO PC` só devem ser consolidados em `BO` se a equivalência funcional for confirmada;
- divergências devem gerar aviso de contrato na revisão, sem perda do valor recebido;
- fixture e testes devem cobrir a lista de valores observados em homologação e, posteriormente, em produção.

O smoke test posterior confirmou que `BO` já é exibido corretamente pelo laWdo, sem aparecer como `Outros`.

#### Catálogo de origens do GDL — inspeção concluída

Em `14/07/2026`, a lista do campo `Origens > Tipo` foi registrada em `src/shared/catalogos/tipos-origem-gdl.catalogo.ts`, preservando código, label e ordem observados no GDL. A aplicação persiste o label porque esse é o valor retornado pela API da REP.

O catálogo base é compartilhado; regras de seleção continuam na feature REP. `TipoSolicitacaoSelect.tsx` combina:

- todos os labels do catálogo GDL;
- opções locais legadas (`BOU`, `BO PM`, `BO PC`, `Ofício`, `CECOMP`);
- origens efetivamente retornadas pela REP;
- valor desconhecido recebido do GDL, sem degradá-lo para `Outros`;
- entrada manual livre por `Outros`.

O teste `tipos-origem-gdl.catalogo.test.ts` protege unicidade de códigos e labels. Pendente: confirmar o mesmo catálogo em produção e decidir, com evidência funcional, quais opções locais legadas são aliases reais e quais devem permanecer distintas.

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
    quantidade: number
    unidadeMedida: string
    quantidadeDescricao: string
    examinadoInLoco: boolean
    dataEntrada: string
    lacreEntrada: string
    lacreSaida: string
    dataLiberacao: string
    codigoVestigio: string
    consumida: 'S' | 'N' | 'P'
    observacao: string
  }
  personalizados: Record<string, unknown>
  extrasGdl: Record<string, unknown>
}

interface MetadadosIntegracaoGdl {
  origemInicial: 'manual' | 'gdl'
  dadosSolicitacao?: {
    orgao: string
    responsavel: string
    autoridade: string
    origensDisponiveis: Array<{ tipo: string; numero: string }>
  }
  dadosInvestigacao?: {
    envolvidos: string[]
    boletinsOcorrencia: Array<{ tipo: string; numero: string }>
    inqueritosPoliciais: Array<{ tipo: string; numero: string }>
  }
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
- `tipoCodigo` vem do catálogo dos 16 tipos mapeados.
- `personalizados` usa IDs canônicos definidos no catálogo local.
- `extrasGdl` preserva propriedades ainda desconhecidas com a chave original do GDL.
- `alteradaLocalmente` registra que uma peça importada foi modificada no laWdo.
- exclusão local nunca dispara exclusão no GDL.
- `MetadadosIntegracaoGdl` registra a origem operacional, os dados normalizados usados para reabrir o formulário e a última consulta, sem persistir credenciais ou payload bruto.
- `dadosSolicitacao.origensDisponiveis` é a escrita atual; a leitura também aceita o nome legado `origensCandidatasSolicitacao` e o normaliza.

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

Enquanto não existir endpoint oficial de metadados, as definições dos 16 tipos mapeados ficam versionadas no código e disponíveis offline. Os payloads externos são validados por Zod no processo principal; o catálogo canônico é uma constante TypeScript pura e compartilhada entre main e renderer, sem dependência de React e ainda sem schema Zod próprio.

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

Estado atual do catálogo: os 16 códigos suportados possuem label, família, status de round-trip e campos visuais conhecidos. A validação estrutural independente rejeita quantidade de tipos incorreta, códigos zero/duplicados, labels ou aliases duplicados, IDs de campos fora do prefixo do tipo e códigos de opções zero/duplicados. `PEÇA TESTE` não integra o catálogo e é filtrada na conversão. As fixtures das REPs `191/2026` e `192/2026` cobrem os 16 tipos, todos marcados como `roundTripConfirmado` após importação, persistência e reabertura.

Não criar `gdl_catalogos` ou sincronização automática nesta primeira implementação. As opções de endpoints oficiais já existentes, como unidades de medida, podem ganhar cache separado depois. O formulário dos 16 tipos mapeados não pode depender de scraping em nenhum ambiente.

Também não criar `gdl_reps_cache` nesta fase. Após o usuário aplicar a consulta, o dado normalizado já ficará persistido na REP local. O payload bruto deve existir apenas em memória durante revisão/importação.

## 9. Formulário e CRUD local

O formulário usa um editor de peças B602 baseado em coleção tipada, compartilhado pelas peças manuais e importadas.

### 9.0 Integração obrigatória com o cadastro atual de REP

O editor faz parte do formulário B602 já orquestrado por `REPsPage.tsx`; não será uma página, janela ou cadastro paralelo.

`REPsPage.tsx` obtém as seções por `getSectionsForExame()` e renderiza cada componente registrado em `SECTION_REGISTRY`. Para B602, a implementação atual:

1. registra a seção canônica `pecas_b602` no mapa do exame;
2. renderiza a seção dentro do mesmo `<Form>`/`RepStepper` usado para criar e editar a REP;
3. deixa `material_enc`, `cartuchos`, `estojos` e `armas` fora do fluxo persistente ativo;
4. mantém `dados_investigacao` e os demais campos gerais no fluxo atual;
5. mantém dados técnicos exclusivos do laWdo fora de uma segunda cópia persistida; projeções downstream ainda precisam de adaptador derivado.

Na tela de REPs, manter duas ações de entrada claras:

- `Nova REP`: inicia o fluxo manual com formulário vazio;
- `Consultar GDL`: inicia o fluxo dinâmico antes do cadastro local.

Dentro de uma REP B602 aberta, a seção `Peças` oferece `Selecionar peças do GDL`. Essa ação não reabre a busca geral: usa o número completo já preenchido, consulta automaticamente a mesma API e apresenta somente a seleção de peças. A aplicação altera `PecaB602[]` e os metadados da última consulta, sem reaplicar os demais campos gerais.

Fluxo visual obrigatório da seção `Peças`:

1. exibir a lista das peças já adicionadas ou importadas;
2. ao clicar em `Adicionar peça`, abrir o editor local inicialmente com `Tipo do Item`;
3. ao selecionar um dos 16 tipos mapeados, resolver imediatamente sua definição no catálogo local;
4. renderizar, no mesmo editor, primeiro todos os inputs comuns e depois os inputs personalizados daquele tipo;
5. não exigir consulta ao GDL nem VPN para montar os campos, pois o catálogo é local;
6. validar os obrigatórios conforme o catálogo antes de adicionar/atualizar a peça na coleção;
7. voltar à lista após confirmar, mantendo `Editar` e `Excluir` disponíveis.

Ao trocar o tipo durante a edição, os campos comuns compatíveis devem ser preservados. Valores personalizados do tipo anterior não podem ser associados silenciosamente ao novo tipo: o sistema deve pedir confirmação antes de descartá-los, salvo quando todos estiverem vazios.

Peças vindas da API devem entrar na mesma coleção e abrir exatamente no mesmo editor. A origem não pode criar um formulário alternativo nem impedir alteração ou exclusão local.

O estado atual representa `b602.pecas` como `PecaB602[]` controlado separadamente do mapa string de `REPFormData`. A página passa a coleção pelo `ContextoSerializacaoCamposEspecificos`; criação, edição, remoção e validação não dependem de chaves planas como `b602_armas_0_*`.

`ExamSection` aceita `isComplete`, e a seção `Peças` usa `pecaB602EstaCompleta()` sobre a coleção controlada. O stepper só marca a seção como concluída quando existe peça e todas atendem ao catálogo; o bloqueio final de salvamento continua sendo a autoridade.

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
2. usuário escolhe um dos 16 tipos suportados em `Tipo do Item`;
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

O rótulo foi corrigido para `Substituir dados do GDL`, deixando explícito que peças manuais não são apagadas.

Estado atual: no modo substituir, a lista selecionada é a referência para as peças GDL. Correspondências são atualizadas, peças GDL desmarcadas ou ausentes da seleção são removidas localmente e peças manuais permanecem. No modal exclusivo, essa mesma reconciliação é aplicada sem substituir campos gerais.

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

Na persistência atual, o objeto completo é gravado em `campos_especificos.integracaoGdl`. `extrairMetadadosIntegracaoGdl()` reidrata `origemInicial`, `dadosSolicitacao`, `dadosInvestigacao` e `ultimaConsulta` por schema Zod. A leitura converte `origensCandidatasSolicitacao` legado para `origensDisponiveis`; payload inválido retorna `null`.

Regras de desempenho e renderização:

- carregar o catálogo local uma vez e indexar tipos/campos por código;
- renderizar somente o editor da peça ativa, não os formulários dos 16 tipos simultaneamente;
- exibir as demais peças como cards/resumos leves;
- usar `useWatch` apenas nos campos necessários ao tipo ativo e à completude, evitando observar toda a REP em cada card;
- estabilizar callbacks e definições de catálogo para evitar remontagem dos inputs;
- manter uma única chamada à API por consulta e não refazer consulta ao trocar ou editar tipo local;
- preservar o formulário intacto em timeout, falha de VPN ou cancelamento do modal.

## 10. Persistência e integração com o laudo

`campos_especificos.b602.pecas` é a fonte canônica das peças.

`campos_especificos.integracaoGdl` guarda `MetadadosIntegracaoGdl` separado do bloco B602. Não persistir credenciais nem o payload bruto nessa estrutura.

Não persistir cópias divergentes da mesma peça em `material_enc`, `armas`, `estojos` e outros arrays. Criar seletores/adaptadores derivados para os consumidores atuais:

- material encaminhado;
- tabelas de armas, estojos e demais famílias;
- placeholders simples e indexados;
- seções repetíveis por arma;
- toggles `func_toggle` e `coleta_toggle` quando aplicáveis;
- PDF da REP;
- sincronização de seções do laudo.

Estado atual: `prepareForApi()` passa `pecas` e `metadadosIntegracaoGdl` em `ContextoSerializacaoCamposEspecificos`. O próprio `b602Service.serialize()` remove os arrays legados, grava `b602.pecas` e inclui `integracaoGdl` quando presente. O teste do service confirma que a escrita canônica não recria `material_enc`, `cartuchos`, `estojos` ou `armas`.

`projetarB602ParaLaudo()` implementa a visão derivada para placeholders, tabelas, preview/PDF da REP e seções repetíveis do laudo. Os consumidores atualizados priorizam `b602.pecas` e aceitam os arrays antigos somente como fallback de leitura. Testes protegem a projeção compartilhada, a exportação e o `secao-builder`; não há escrita duplicada dos arrays legados.

O mapeamento de família não deve inventar equivalências. Exemplos:

- `Nº Série` de arma pode alimentar campo técnico local equivalente quando o tipo estiver mapeado; outros atributos só ganham campo local após decisão funcional explícita;
- `ORIGEM/COLETA` de `ESTOJO(S)` não equivale ao campo local `origem` que representa país;
- campos técnicos próprios do laWdo podem coexistir com os campos reproduzidos do GDL.

## 11. Etapas de execução

### Ordem de retomada a partir do estado atual

1. executar a validação somente leitura em produção.

O registro genérico de adaptadores está implementado com B602 como primeira entrada e rejeição explícita de exames não registrados.

### Etapa 1 — Fundação e correções do contrato — concluída

- criar tipos compartilhados da REP e das peças GDL;
- criar schemas Zod para resposta, origem, andamento e peça dinâmica;
- remover casts diretos após `JSON.parse`;
- centralizar os tipos hoje duplicados entre main e renderer;
- criar normalizador comum/personalizado/extras;
- criar contrato tipado `ResultadoImportacaoExame`;
- separar no modal consulta/revisão da conversão específica do B602;
- corrigir o schema inicial para garantir `campos_especificos` em banco novo;
- substituir o envio de peças para `observacoes` por revisão estruturada;
- criar fixtures anonimizadas do formato confirmado em `190/2026`.
- inventariar os campos gerais compartilhados e seus valores enumerados, começando por `Tipo de Solicitação = BO`;
- substituir fallbacks locais que convertam valores GDL desconhecidos em `Outros` por preservação literal acompanhada de aviso de contrato.
- transportar peças e metadados pelo contexto tipado do service, sem recomposição posterior em `REPsPage`;
- reidratar metadados completos e manter leitura do nome legado das origens;
- criar catálogo compartilhado de tipos de origem e corrigir o fluxo `IP/PM`.

Concluído em `20/07/2026`:

- registro mínimo de adaptadores por exame entre o handler e o conversor B602;
- validação estrutural do catálogo local separada do schema Zod do payload da API.

### Etapa 2 — Editor genérico + tipos já confirmados — concluída

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

Concluído:

- reidratação integral de solicitação e investigação;
- round-trip canônico de peças, metadados e unidade policial;
- teste garantindo que a escrita canônica não recria arrays legados;
- testes de helper e componente do seletor de tipo de solicitação.
- testes de componente do editor cobrindo CRUD, troca de tipo, obrigatórios, campos comuns e edição/exclusão de peça GDL;
- testes do `GdlConsultaModal` cobrindo seleção inicial, Mesclar, Substituir, desmarcação e cancelamento;
- teste integrado `GdlConsultaModal` → `REPsPage`, confirmando preenchimento do formulário, importação das peças e ausência de salvamento automático.
- teste integrado por handlers IPC e SQLite temporário, confirmando criação, atualização, reabertura, metadados e ausência dos arrays legados;
- round-trip persistido dos cenários Mesclar e Substituir, preservando peças manuais.

### Etapa 3 — Família de armas — concluída

O schema visual foi coletado para toda a família. A implementação local e o round-trip de API avançam um tipo por vez:

Decisão transversal registrada em `19/07/2026`: `Nº Análises` não integra o modelo local; `Medida` deve usar o mesmo catálogo visual do select do GDL, com `UNIDADES` como padrão; `Examinado In Loco` deve ser reproduzido como checkbox. A API pode continuar devolvendo `numeroAnalises`, mas o normalizador o descarta deliberadamente.

| Tipo | Estado local atual | Próxima confirmação |
|---|---|---|
| `ARMA(S) DE CHOQUE` (`289`) | retorno preenchido, importação e reabertura confirmados | concluído |
| `ARMA(S) DE PRESSÃO` (`613`) | retorno preenchido, importação e reabertura confirmados | concluído |
| `ESPINGARDA(S)` (`472`) | 12 campos, retorno preenchido, importação e reabertura confirmados | concluído |
| `FUZIL(IS)` (`477`) | retorno preenchido, importação e reabertura confirmados | concluído |
| `GARRUCHA(S)` (`475`) | retorno preenchido, importação e reabertura confirmados | concluído |
| `PISTOLA(S)` (`104`) | round-trip confirmado com a fixture da REP `192/2026` e reabertura por IPC/SQLite | concluído |
| `PISTOLETE(S)` (`478`) | campos comuns, importação e reabertura confirmados | concluído |
| `REVÓLVER(ES)` (`106`) | round-trip confirmado com a fixture da REP `191/2026`; `Marca da Arma = Taurus` e `Tipo Acabamento = Cromado` retornaram pela API e são normalizados como `106:marca_arma = Taurus` e `106:tipo_acabamento = 44` | concluído |
| `SUBMETRALHADORA(S)` (`479`) | retorno preenchido, importação e reabertura confirmados | concluído |

`CARABINA(S)` já integra a Etapa 2.

`PISTOLA(S)` possui fixture anonimizada da REP `192/2026`. A fixture da REP `191/2026` inclui as demais amostras confirmadas, todas submetidas ao fluxo integrado de normalização, serialização canônica, criação por handler IPC, SQLite e reabertura sem perda.

Seções repetíveis, placeholders e toggles já trabalham com a projeção derivada de `b602.pecas`, mantendo fallback de leitura do formato antigo de `b602.armas`.

### Etapa 4 — Componentes e materiais balísticos — concluída

Os schemas visuais foram reinspecionados e as amostras distintivas da REP `191/2026` foram importadas, persistidas e reabertas no laWdo:

1. `CARREGADOR(ES)` (`272`): somente campos comuns, round-trip confirmado;
2. `ESPOLETA(S)` (`473`): somente campos comuns, round-trip confirmado;
3. `PÓLVORA` (`572`): somente campos comuns, round-trip confirmado;
4. `PROJÉTEIS` (`105`): `ORIGEM/COLETA` obrigatório, com as opções `95`, `93`, `94` e `11`; retorno API, importação e reabertura confirmados.

`ESTOJO(S)` já integra a Etapa 2.

Confirmar separadamente o tratamento de `Cartuchos` existente no laWdo, pois `CARTUCHO(S)` não apareceu entre os tipos oferecidos pelo GDL na amostra. Não remover o recurso local sem decisão funcional específica.

### Etapa 5 — Tipo genérico — concluída

- manter `OUTROS` (`178`) sem campos personalizados, conforme reinspeção e cadastro da amostra `T178-20260720`;
- round-trip dos campos comuns de `OUTROS` confirmado por importação e reabertura;
- ignorar `PEÇA TESTE` (`771`) na conversão e não disponibilizá-la no editor do laWdo.

### Etapa 6 — Consolidação dos 16 tipos — concluída

- manter os testes que protegem os 16 códigos e a exclusão de `771`, além da validação estrutural de aliases, IDs e códigos de opções;
- revisar obrigatoriedade e opções de todos os campos;
- revisar aliases da API;
- importação e reabertura dos 16 tipos estão confirmadas;
- a cobertura automatizada parametrizada confirma que cada tipo pode ser concluído com seus obrigatórios e que a omissão de qualquer obrigatório bloqueia a peça; CRUD genérico, Mesclar e Substituir permanecem protegidos pelos testes de componente e utilitários;
- atualizar placeholders/tabelas do laudo somente onde houver equivalência semântica aprovada;
- teste exploratório final em homologação executado pelo usuário em `20/07/2026`, sem erros observados no repasse manual.

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

Os 16 schemas mapeados e seus round-trips foram confirmados em homologação. Para novos tipos ou futuras divergências do contrato, repetir o protocolo:

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

## 14. Arquivos e responsabilidades atuais

| Área | Responsabilidade |
|---|---|
| `src/shared/types/b602-gdl.types.ts` | contratos normalizados GDL/B602 compartilhados entre main, preload e renderer |
| `src/shared/catalogos/b602-gdl.catalogo.ts` | fonte canônica dos 16 tipos mapeados, campos, opções, aliases e mapeamentos de API confirmados |
| `src/shared/catalogos/b602-marcas-armas.catalogo.ts` | 1.379 opções observadas para `Marca da Arma`, usadas pelo combobox com fallback de texto livre |
| `src/main/services/gdl.schema.ts` | validação Zod da fronteira externa, interpretação segura do JSON e derivação dos tipos crus validados |
| `src/main/services/gdl.service.ts` | transporte e autenticação |
| `src/main/services/gdl-b602-normalizador.service.ts` | normalização da REP, peças, origens, envolvidos e avisos após a validação Zod, consumindo o catálogo compartilhado |
| `src/main/services/gdl-adaptadores.service.ts` | registro dos conversores por código de exame; B602 é a primeira entrada e exames desconhecidos são rejeitados |
| `src/main/ipc/handlers/gdl.handlers.ts` | fronteira IPC somente leitura |
| `src/preload/index.ts` e tipos | exposição segura e tipada |
| `GdlConsultaModal.tsx` | busca geral, revisão de campos e seleção inicial de peças, todas marcadas por padrão |
| `GdlPecasModal.tsx` | consulta automática e revisão exclusiva das peças conforme a coleção atual do formulário |
| `TipoSolicitacaoSelect.tsx` | seleção controlada de origem GDL ou tipo manual, mantendo tipo e número coerentes |
| `src/shared/catalogos/tipos-origem-gdl.catalogo.ts` | códigos e labels observados no campo de origem do GDL |
| `exam-fields/index.ts` | registrar `pecas_b602` e substituir as seções B602 persistentes antigas no mapa do formulário |
| `exam-fields/pecas-b602.tsx` | seção `Peças`, lista, seleção do tipo e editor dinâmico de campos comuns/personalizados |
| `exam-fields/pecas-b602.utils.ts` | mesclagem e substituição por `codPecaGdl`, preservando alterações locais e peças manuais |
| `exam-fields/services/types.ts` | contexto tipado de serialização para coleções externas ao mapa string do formulário |
| `exam-fields/services/b602.service.ts` | escrita canônica de investigação, unidade policial, peças e metadados; leitura de escalares e arrays legados |
| `exam-fields/integracao-gdl-b602.utils.ts` | validação e extração de peças/metadados persistidos, incluindo compatibilidade de origens legadas |
| `exam-fields/types.ts` | props tipadas para a coleção controlada separadamente do mapa de campos string |
| `REPsPage.tsx` | orquestrar formulário, aplicar consulta, manter peças/metadados em estado próprio e fornecê-los ao service no salvamento |
| `secao-builder.service.ts` | projeções para seções/toggles derivados |
| exportação e placeholders | projeções aprovadas da coleção canônica |

Extrair componentes e hooks por responsabilidade quando o editor crescer; não concentrar catálogo, normalização, UI e persistência em `b602.tsx` ou `REPsPage.tsx`.

## 15. Testes automatizados

Estado em `19/07/2026`: além de schema/normalizador, catálogo B602, reconciliação, cidades, serialização, reidratação e seletor de solicitação, existem testes de componente para o editor, `GdlPecasModal` e `GdlConsultaModal`, integração da consulta geral com `REPsPage` e persistência por handlers IPC/SQLite. O consumo pelo laudo e a rede GDL real ainda não estão cobertos ponta a ponta.

### Contrato GDL

- rejeitar payload estruturalmente inválido;
- aceitar propriedades personalizadas adicionais;
- preservar campo desconhecido em `extrasGdl`;
- garantir que credenciais e valores brutos não sejam logados;
- fixture de `CARABINA(S)` contém os quatro campos personalizados confirmados;
- fixture de `ESTOJO(S)` contém `ORIGEM/COLETA`;
- peça sem campo personalizado continua válida.

### Catálogo

- possuir exatamente 16 códigos únicos e não incluir `771`;
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
- iniciar a primeira consulta geral com todas as peças retornadas marcadas;
- refletir no modal exclusivo a coleção atual, sem remarcar peça removida anteriormente;
- importar todas as peças selecionadas e remover localmente as peças GDL desmarcadas no modo substituir;
- deduplicar por `codPecaGdl`;
- mesclar sem sobrescrever alteração local;
- substituir somente dados originados do GDL;
- preservar peças manuais;
- permitir editar e excluir peça importada;
- preservar propriedade desconhecida da API.
- exibir e persistir valores gerais recebidos do GDL sem degradação semântica, incluindo `Tipo de Solicitação = BO`;
- sinalizar valor enumerado ainda não catalogado sem convertê-lo para `Outros`.
- preservar `IP/PM` e o número correspondente quando a aplicação é programática;
- distinguir origens repetidas pelo par tipo+número;
- reidratar metadados atuais e converter `origensCandidatasSolicitacao` legado.

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

Os itens abaixo combinam invariantes implementadas e a validação ainda aberta em produção. Os round-trips funcionais dos 16 tipos e o teste exploratório consolidado em homologação estão confirmados. Registro de adaptadores, validação estrutural, persistência por IPC/SQLite, substituição baseada na seleção, reidratação integral, serialização canônica, seleção `IP/PM` e projeções canônicas para o laudo estão implementados. A ampliação da cobertura de placeholders será planejada separadamente após a conclusão deste plano.

- Os 16 tipos do catálogo podem ser selecionados no laWdo; `PEÇA TESTE` não é oferecida nem importada.
- `Nova REP` inicia o formulário vazio e `Consultar GDL` inicia o mesmo formulário com carga revisada da API.
- Aplicar dados do GDL nunca salva a REP automaticamente.
- A seção `Peças` é exibida no cadastro e na edição da REP B602 dentro de `REPsPage.tsx`/`RepStepper`.
- Ao selecionar `Tipo do Item`, o mesmo editor exibe imediatamente os inputs comuns e os personalizados daquele tipo, sem consultar o GDL.
- Todos os campos comuns relevantes para a confecção do laudo estão disponíveis localmente; `Nº Análises` é descartado por decisão funcional explícita.
- Todos os campos personalizados confirmados de cada tipo são reproduzidos com controle, obrigatoriedade e opções corretos.
- O usuário pode criar, editar e excluir qualquer peça localmente.
- A consulta GDL preenche automaticamente campos comuns e personalizados devolvidos pela API.
- Peças importadas e manuais usam a mesma estrutura e o mesmo editor.
- A origem manual/GDL permanece visível sem criar diferenças de campos ou de validação.
- Campos desconhecidos da API são preservados e apresentados como não mapeados, sem perda silenciosa.
- Peças não são gravadas em `observacoes`.
- `campos_especificos.b602.pecas` é a única fonte persistida das peças.
- Mesclar preserva dados e alterações locais.
- Substituir usa a seleção atual para reconciliar peças GDL e nunca remove peças manuais.
- A consulta geral marca todas as peças por padrão; a revisão exclusiva reflete as peças ainda presentes no formulário.
- O laWdo funciona offline para cadastro, edição, exclusão e reabertura.
- Nenhuma ação do fluxo realiza escrita no GDL.
- Produção é liberada somente após validação de equivalência com homologação ou registro explícito das divergências aprovadas.
- Campos equivalentes entre laWdo e GDL usam o contrato canônico do GDL; campos exclusivos do laWdo permanecem separados.
- `Tipo de Solicitação = BO` é exibido e persistido como `BO`, e não como `Outros`.
- `Tipo de Solicitação = IP/PM` aplicado pelo GDL permanece selecionado e conserva o número da origem.
- TypeScript, lint e testes ficam verdes sem aumentar warnings.

## 18. Fora do escopo

- criar, atualizar ou excluir peça no GDL;
- enviar REP ou laudo ao GDL;
- sincronização bidirecional;
- scraping da interface web do GDL, em qualquer ambiente ou como contingência; a integração deve consumir exclusivamente endpoints oficiais da API GDL;
- geração automática de metadados confiáveis somente a partir dos nomes das propriedades;
- sincronizar tipos de item de outras naturezas de exame;
- migração destrutiva ou reescrita em lote do formato B602 anterior; a leitura compatível existente deve ser preservada enquanto houver consumidores legados.

## 19. Verificação atual

Em `20/07/2026`, após a reinspeção dos tipos pendentes, a exclusão funcional de `PEÇA TESTE` e os testes do editor, da consulta geral e da persistência integrada:

- `npm run type-check`: aprovado;
- `npm run lint`: aprovado;
- `npm test`: 26 arquivos aprovados, 171 testes aprovados e 1 ignorado;
- `pecas-b602.component.test.tsx` protege acionamento da revisão GDL, validações, inclusão manual, troca de tipo, preservação de campos comuns e edição/exclusão local;
- `gdl-pecas-modal.component.test.tsx` protege consulta automática, estado inicial dos checkboxes e aplicação da seleção;
- `gdl-consulta-modal.component.test.tsx` protege seleção inicial, Mesclar, Substituir, desmarcação de peças e cancelamento;
- `reps-gdl-integration.test.tsx` protege a aplicação no mesmo formulário da `REPsPage`, a importação estruturada e a ausência de chamada automática a `rep.create`;
- testes de reconciliação protegem remoção opcional de peças GDL ausentes ou desmarcadas e preservação das peças manuais;
- `rep-b602-persistencia.integration.test.ts` protege criação, atualização e reabertura por handlers IPC e SQLite temporário nos cenários Mesclar e Substituir, além dos round-trips completos das fixtures de `PISTOLA(S)` e `REVÓLVER(ES)`;
- testes do normalizador cobrem os campos comuns dos tipos mapeados, aliases visuais, datas, a exclusão de `PEÇA TESTE` e o mapeamento completo de `PISTOLA(S)` e dos valores preenchidos de `REVÓLVER(ES)` na fixture da REP `191/2026`;
- testes de catálogo e componente protegem os 16 tipos suportados, a ausência de `771`, `ORIGEM/COLETA` obrigatório de `PROJÉTEIS` e a ordem, controles, limites e opções dos 12 campos de `REVÓLVER(ES)` e `ESPINGARDA(S)` observados no GDL web.
- o teste parametrizado de catálogo confirma completude manual e obrigatórios para todos os 16 tipos; o normalizador protege `incinerado` como campo comum `S/N`, sem promovê-lo a `extrasGdl`;
- testes do registro de adaptadores protegem a seleção de B602 e a rejeição explícita de exames ainda não registrados.
- a consulta pelo modal do laWdo, seguida de importação, salvamento e reabertura, confirmou também `289`, `272`, `473`, `178`, `478` e `572`; a fixture da REP `191/2026` e o teste integrado de persistência agora cobrem os 16 tipos suportados.
- o usuário executou o repasse exploratório final pela interface em homologação e não observou erros.

A cobertura não foi recalculada nesta atualização documental. A rede GDL real continua sem teste automatizado ponta a ponta; o consumo de `b602.pecas` pelo laudo possui cobertura nas projeções compartilhadas, exportação e construção de seções.
