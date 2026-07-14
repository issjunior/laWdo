# Campos específicos por tipo de exame

## Finalidade e fontes de verdade

O mecanismo de campos específicos permite variar o formulário de REP sem levar detalhes de cada exame para o service genérico do main. A configuração ativa fica em `src/renderer/components/rep/exam-fields/index.ts`.

| Responsabilidade | Fonte atual |
|---|---|
| seções disponíveis | `SECTION_REGISTRY` |
| seções exibidas por exame | `EXAM_FIELD_MAP` |
| serialização por exame | `EXAM_SERVICE_REGISTRY` |
| menu de placeholders | `EXAM_MENU_REGISTRY` |
| contrato textual do formulário | `REPFormData` |
| coleção estruturada de peças B-602 | `PecaB602[]` mantido por `REPsPage` |

`SECTION_REGISTRY` é um catálogo, não a lista de funcionalidades ativas. Uma seção só aparece no formulário e no stepper quando seu id também está em `EXAM_FIELD_MAP`.

## Mapeamento ativo

| Código | Seções renderizadas | Persistência específica |
|---|---|---|
| `LOC` | `local_fato`, `acionamento` | colunas nativas de `reps` |
| `I-801` | `numeracao` | JSON por `numeracaoService` |
| `B-602` | `dados_investigacao`, `pecas_b602` | JSON por `b602Service` mais composição de `PecaB602[]` |

As seções `material_enc`, `cartuchos`, `estojos` e `armas` permanecem registradas por compatibilidade, mas não são editadas pelo fluxo ativo do B-602.

## Critério para escolher onde um dado deve viver

| Natureza do dado | Local preferido no estado atual | Motivo |
|---|---|---|
| campo comum à REP, consultado pelo main | coluna nativa de `reps` | consulta, ordenação e ciclo de vida independem do tipo de exame |
| campo escalar específico de um exame | `REPFormData` + service do exame | integra-se ao formulário e ao JSON sem alterar o banco |
| coleção indexada simples e limitada | chaves dinâmicas em `REPFormData` | compatibilidade com `react-hook-form` e placeholders existentes |
| coleção heterogênea com objetos e metadados | estado tipado separado, como `PecaB602[]` | `REPFormData` aceita somente strings e não representa objetos com segurança |
| contrato puro usado em mais de uma camada | `src/shared/` | evita dependência entre renderer e main |

Não mover um dado para `shared/` apenas para facilitar import. Ele deve ser puro, estável e realmente compartilhado.

## Contrato das seções

`ExamSection` define:

- identidade, rótulo, ícone e componente
- `requiredFields` para completude simples
- `isComplete(data, contexto)` quando a completude depende de estado externo ao formulário

`ExamSectionProps` fornece o formulário, controle de placeholders e, quando necessário, peças B-602, callback de alteração e campos marcados como importados do GDL.

Invariantes:

- `isComplete` deve ser pura e barata, pois é recalculada durante alterações do formulário
- ids de seção devem ser estáveis: o stepper e os alvos `step-*` dependem deles
- campos usados por `requiredFields` precisam existir nos defaults e na validação da página
- estado externo precisa participar de renderização, completude, salvamento e restauração

## Dados dinâmicos e fronteiras

`REPFormData` possui assinatura `[key: string]: string` para chaves indexadas. Isso não elimina a necessidade de validação: IPC, JSON, storage e API continuam sendo fronteiras inseguras.

No B-602, cada envolvido ocupa um par:

- `b602_envolvidos_qualificacao_N`
- `b602_envolvidos_N`

A UI mantém as partes separadas; a persistência combina e separa na fronteira. As peças usam contrato próprio porque contêm números, booleanos, objetos dinâmicos e metadados de origem.

## Pipeline de persistência

`serializeCamposEspecificos()` aplica defaults e delega ao service. `deserializeCamposEspecificos()` protege o parse e retorna `{}` quando o conteúdo é ausente, inválido ou não possui service.

O B-602 tem uma segunda etapa em `REPsPage`: o JSON produzido pelo service é recomposto para incluir `b602.pecas` e `integracaoGdl`. Portanto, o service isolado não representa sozinho o formato final persistido.

## Inclusão ou alteração de exame

Antes de criar abstração nova, verificar se o dado cabe em um dos padrões existentes. Para uma nova seção:

1. criar o componente com `ExamSectionProps`
2. adicionar defaults e validação ao contrato do formulário
3. registrar a seção em `SECTION_REGISTRY`
4. ativá-la no `EXAM_FIELD_MAP`
5. definir `requiredFields` ou `isComplete`
6. alinhar o bloqueio final de salvamento em `REPsPage`
7. registrar serialização e desserialização se houver JSON
8. conferir preload, IPC e consumidores do JSON quando o formato cruzar camadas
9. adicionar placeholders somente quando existir consumidor atual

## Desempenho e resiliência

O stepper observa o formulário e recalcula completude a cada alteração. Evitar consultas, parses grandes ou mutações dentro de `isComplete`. Coleções maiores devem permanecer em estado próprio e usar atualizações imutáveis.

JSON inválido é tolerado na leitura, mas pode resultar em formulário vazio. Uma edição posterior pode substituir o conteúdo inválido pelo formato atual; por isso mudanças de contrato precisam preservar leitura legada ou oferecer migração explícita.

## Matriz mínima de impacto

| Mudança | Verificar junto |
|---|---|
| nova seção | registry, map, stepper, pendências e renderização |
| novo campo textual | defaults, schema, service, placeholders e edição |
| nova coleção estruturada | tipo shared, editor, completude, persistência, restauração e merge |
| mudança no JSON | leitores legados, laudo, exportação, testes e compatibilidade |
| dado vindo do GDL | schema do main, normalizador, contrato shared, modal e aplicação no formulário |
