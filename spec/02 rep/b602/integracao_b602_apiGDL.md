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

## 2. Evidências confirmadas em homologação

Os testes foram realizados no GDL web de homologação e com a REP B602 `190/2026`.

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

A peça `ARMA(S) DE PRESSÃO` retornou apenas campos comuns na amostra. Isso não prova ausência definitiva de campos personalizados; seu formulário ainda precisa ser auditado isoladamente.

### 2.3 Problema atual do laWdo

Na importação da REP `190/2026`:

- as três peças foram convertidas em três linhas de `observacoes`;
- `campos_especificos` permaneceu vazio;
- os campos personalizados devolvidos pela API não foram aplicados ao formulário;
- o usuário não recebeu estrutura local para editar ou excluir individualmente as peças importadas.

## 3. Decisão arquitetural

A solução será híbrida.

### 3.1 O que será genérico

- validação dos campos comuns do payload;
- separação automática entre propriedades comuns e personalizadas;
- preservação de campos personalizados desconhecidos;
- renderização de inputs a partir de um catálogo local de metadados;
- CRUD local de peças;
- importação, revisão e persistência estruturada.

### 3.2 O que será explícito

- catálogo dos 17 tipos e seus códigos;
- definição de label, controle, obrigatoriedade e opções de cada campo personalizado;
- aliases para labels que possam variar no GDL;
- mapeamentos semânticos para campos técnicos já usados pelo laudo, placeholders e seções repetíveis.

### 3.3 O que não será feito

- scraping do GDL web em tempo de execução;
- criação automática de input apenas pelo nome de uma propriedade recebida;
- cast direto de `JSON.parse` para um tipo confiável;
- equivalência por aproximação textual quando os significados forem diferentes;
- armazenamento indefinido do JSON bruto da REP;
- escrita na API GDL.

## 4. Catálogo dos 17 tipos de item

O valor `0` (`Selecione um Tipo`) não integra o catálogo.

| Ordem | Código | Tipo no GDL | Família inicial | Status do schema | Etapa |
|---:|---:|---|---|---|---:|
| 1 | `289` | `ARMA(S) DE CHOQUE` | arma | pendente de descoberta | 3 |
| 2 | `613` | `ARMA(S) DE PRESSÃO` | arma | retorno API observado; formulário pendente | 3 |
| 3 | `476` | `CARABINA(S)` | arma | campos e retorno API confirmados | 2 |
| 4 | `272` | `CARREGADOR(ES)` | componente | pendente de descoberta | 4 |
| 5 | `472` | `ESPINGARDA(S)` | arma | pendente de descoberta | 3 |
| 6 | `473` | `ESPOLETA(S)` | componente | pendente de descoberta | 4 |
| 7 | `101` | `ESTOJO(S)` | componente balístico | campos e retorno API confirmados | 2 |
| 8 | `477` | `FUZIL(IS)` | arma | pendente de descoberta | 3 |
| 9 | `475` | `GARRUCHA(S)` | arma | pendente de descoberta | 3 |
| 10 | `178` | `OUTROS` | genérico | pendente de descoberta | 5 |
| 11 | `771` | `PEÇA TESTE` | técnico/homologação | pendente; confirmar presença em produção | 5 |
| 12 | `104` | `PISTOLA(S)` | arma | pendente de descoberta | 3 |
| 13 | `478` | `PISTOLETE(S)` | arma | pendente de descoberta | 3 |
| 14 | `572` | `PÓLVORA` | componente balístico | pendente de descoberta | 4 |
| 15 | `105` | `PROJÉTEIS` | componente balístico | pendente de descoberta | 4 |
| 16 | `106` | `REVÓLVER(ES)` | arma | pendente de descoberta | 3 |
| 17 | `479` | `SUBMETRALHADORA(S)` | arma | pendente de descoberta | 3 |

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
```

### Regras do modelo

- `idLocal` identifica o item no CRUD do laWdo.
- `codPecaGdl` é referência externa e nunca deve ser usado como chave primária local.
- `tipoCodigo` vem do catálogo de 17 tipos.
- `personalizados` usa IDs canônicos definidos no catálogo local.
- `extrasGdl` preserva propriedades ainda desconhecidas com a chave original do GDL.
- `alteradaLocalmente` registra que uma peça importada foi modificada no laWdo.
- exclusão local nunca dispara exclusão no GDL.

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

## 8. Catálogo local de metadados

Enquanto não existir endpoint oficial de metadados, as definições dos 17 tipos ficarão versionadas no código, validadas por Zod e disponíveis offline.

Estrutura sugerida:

```text
src/shared/types/b602-gdl.types.ts
src/renderer/components/rep/exam-fields/catalogos/b602-gdl.catalogo.ts
src/main/services/gdl-b602-normalizador.service.ts
```

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

Não criar `gdl_catalogos` ou sincronização automática nesta primeira implementação. As opções de endpoints oficiais já existentes, como unidades de medida, podem ganhar cache separado depois. O formulário dos 17 tipos não deve depender de scraping em produção.

Também não criar `gdl_reps_cache` nesta fase. Após o usuário aplicar a consulta, o dado normalizado já ficará persistido na REP local. O payload bruto deve existir apenas em memória durante revisão/importação.

## 9. Formulário e CRUD local

Criar um editor de peças B602 baseado em coleção tipada, substituindo a multiplicação de chaves planas por tipo de peça.

### 9.1 Lista de peças

Cada card/linha deve exibir:

- tipo;
- identificação;
- quantidade e unidade;
- origem (`Manual` ou `Importada do GDL`);
- indicador de alteração local;
- ações `Editar` e `Excluir`.

### 9.2 Inclusão manual

1. usuário escolhe um dos 17 tipos;
2. laWdo renderiza os inputs comuns;
3. laWdo renderiza os inputs personalizados do catálogo daquele tipo;
4. valida obrigatórios e tipos;
5. adiciona a peça à coleção local;
6. usuário pode reabrir, alterar ou excluir antes e depois de salvar a REP.

### 9.3 Importação do GDL

1. consultar REP;
2. normalizar todas as peças;
3. exibir revisão individual por peça;
4. destacar campos mapeados, extras e ambiguidades;
5. permitir selecionar quais peças importar;
6. aplicar as peças selecionadas à mesma coleção usada no cadastro manual;
7. manter edição e exclusão local disponíveis.

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

## 10. Persistência e integração com o laudo

`campos_especificos.b602.pecas` será a fonte canônica das peças.

Não persistir cópias divergentes da mesma peça em `material_enc`, `armas`, `estojos` e outros arrays. Criar seletores/adaptadores derivados para os consumidores atuais:

- material encaminhado;
- tabelas de armas, estojos e demais famílias;
- placeholders simples e indexados;
- seções repetíveis por arma;
- toggles `func_toggle` e `coleta_toggle` quando aplicáveis;
- PDF da REP;
- sincronização de seções do laudo.

O mapeamento de família não deve inventar equivalências. Exemplos:

- `Marca`, `Modelo` e `Nº Série` de arma podem alimentar campos técnicos locais equivalentes;
- `ORIGEM/COLETA` de `ESTOJO(S)` não equivale ao campo local `origem` que representa país;
- campos técnicos próprios do laWdo podem coexistir com os campos reproduzidos do GDL.

## 11. Etapas de execução

### Etapa 1 — Fundação e correções do contrato

- criar tipos compartilhados da REP e das peças GDL;
- criar schemas Zod para resposta, origem, andamento e peça dinâmica;
- remover casts diretos após `JSON.parse`;
- centralizar os tipos hoje duplicados entre main e renderer;
- criar normalizador comum/personalizado/extras;
- corrigir o schema inicial para garantir `campos_especificos` em banco novo;
- substituir o envio de peças para `observacoes` por revisão estruturada;
- criar fixtures anonimizadas do formato confirmado em `190/2026`.

### Etapa 2 — Editor genérico + tipos já confirmados

- implementar coleção canônica e CRUD manual;
- implementar renderer dos inputs comuns;
- cadastrar metadados completos de `CARABINA(S)` e `ESTOJO(S)`;
- importar ambas pela API;
- permitir editar e excluir localmente;
- persistir e reabrir sem perda;
- validar comportamento offline.

### Etapa 3 — Família de armas

Auditar e implementar, um por vez:

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

Ao final, adaptar seções repetíveis, placeholders e toggles para trabalhar com todas as peças classificadas como arma, não apenas com o formato antigo de `b602.armas`.

### Etapa 4 — Componentes e materiais balísticos

Auditar e implementar:

1. `CARREGADOR(ES)` (`272`)
2. `ESPOLETA(S)` (`473`)
3. `PÓLVORA` (`572`)
4. `PROJÉTEIS` (`105`)

`ESTOJO(S)` já integra a Etapa 2.

Confirmar separadamente o tratamento de `Cartuchos` existente no laWdo, pois `CARTUCHO(S)` não apareceu entre os 17 tipos oferecidos pelo GDL na amostra. Não remover o recurso local sem decisão funcional específica.

### Etapa 5 — Tipos genéricos e de homologação

- auditar `OUTROS` (`178`), incluindo possíveis campos livres;
- auditar `PEÇA TESTE` (`771`);
- confirmar se `PEÇA TESTE` existe em produção;
- manter o tipo disponível por ambiente conforme o catálogo confirmado, sem misturar dados de homologação e produção.

### Etapa 6 — Consolidação dos 17 tipos

- executar teste de contrato do catálogo completo;
- revisar obrigatoriedade e opções de todos os campos;
- revisar aliases da API;
- validar cadastro manual, importação, edição, exclusão e reabertura para os 17 tipos;
- atualizar placeholders/tabelas do laudo somente onde houver equivalência semântica aprovada;
- realizar teste exploratório final em homologação.

## 12. Protocolo obrigatório de descoberta por tipo

Nenhum dos 15 schemas pendentes deve ser preenchido por suposição. Para cada tipo:

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
| `src/shared/types/` | contratos GDL/B602 compartilhados |
| `src/main/services/gdl.service.ts` | transporte e autenticação |
| `src/main/services/gdl-b602-normalizador.service.ts` | validação e normalização das peças |
| `src/main/ipc/handlers/gdl.handlers.ts` | fronteira IPC somente leitura |
| `src/preload/index.ts` e tipos | exposição segura e tipada |
| `GdlConsultaModal.tsx` | revisão e seleção das peças a aplicar |
| `exam-fields/catalogos/b602-gdl.catalogo.ts` | catálogo versionado dos 17 tipos |
| `exam-fields/b602.tsx` ou componentes extraídos | lista e editor de peças |
| `exam-fields/services/b602.service.ts` | serialização da coleção canônica |
| `REPsPage.tsx` | orquestração, validação e aplicação da consulta |
| `secao-builder.service.ts` | projeções para seções/toggles derivados |
| exportação e placeholders | projeções aprovadas da coleção canônica |

Extrair componentes e hooks por responsabilidade quando o editor crescer; não concentrar catálogo, normalização, UI e persistência em `b602.tsx` ou `REPsPage.tsx`.

## 15. Testes automatizados

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

- criar manualmente cada tipo;
- validar campos obrigatórios;
- editar campos comuns e personalizados;
- excluir somente a peça selecionada;
- persistir e reabrir a coleção;
- preservar campos técnicos exclusivos do laWdo.

### Importação

- não colocar peças em `observacoes`;
- importar todas as peças selecionadas;
- deduplicar por `codPecaGdl`;
- mesclar sem sobrescrever alteração local;
- substituir somente dados originados do GDL;
- preservar peças manuais;
- permitir editar e excluir peça importada;
- preservar propriedade desconhecida da API.

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
10. gerar/sincronizar laudo quando o tipo possuir projeção aprovada.

## 17. Critérios de aceitação

- Os 17 tipos do catálogo podem ser selecionados no laWdo.
- Todos os campos comuns do formulário GDL estão disponíveis localmente.
- Todos os campos personalizados confirmados de cada tipo são reproduzidos com controle, obrigatoriedade e opções corretos.
- O usuário pode criar, editar e excluir qualquer peça localmente.
- A consulta GDL preenche automaticamente campos comuns e personalizados devolvidos pela API.
- Peças importadas e manuais usam a mesma estrutura e o mesmo editor.
- Campos desconhecidos da API são preservados e apresentados como não mapeados, sem perda silenciosa.
- Peças não são gravadas em `observacoes`.
- `campos_especificos.b602.pecas` é a única fonte persistida das peças.
- Mesclar preserva dados e alterações locais.
- Substituir não remove peça manual sem confirmação explícita.
- O laWdo funciona offline para cadastro, edição, exclusão e reabertura.
- Nenhuma ação do fluxo realiza escrita no GDL.
- TypeScript, lint e testes ficam verdes sem aumentar warnings.

## 18. Fora do escopo

- criar, atualizar ou excluir peça no GDL;
- enviar REP ou laudo ao GDL;
- sincronização bidirecional;
- scraping do GDL web em produção;
- geração automática de metadados confiáveis somente a partir dos nomes das propriedades;
- sincronizar tipos de item de outras naturezas de exame;
- compatibilidade com o formato B602 persistido antes desta implementação.

## 19. Branch e validação técnica

Branch sugerida:

```bash
git switch -c codex/gdl-b602
```

Após cada etapa:

```bash
npm run type-check
npm run lint
npm test
```

Executar também `npm run test:coverage` quando forem adicionadas as fixtures e a nova camada de normalização.
