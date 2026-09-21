# Plano de melhoria — placeholders que renderizam tabelas no laudo

## 1. Situação e objetivo

O exame B602 possui placeholders que materializam tabelas HTML no editor do laudo. A `TABELA 2 – MATERIAL ENCAMINHADO` pode chegar a cerca de 80 itens, mas também há relatos de lentidão com apenas 6 linhas.

O objetivo é reduzir o trabalho executado ao inserir, restaurar ou atualizar um placeholder de tabela, preservando integralmente:

- o conteúdo e a formatação das tabelas;
- a edição e a restauração de tabelas personalizadas;
- o histórico de desfazer/refazer do TinyMCE;
- os modos de visualização por dados e por chaves;
- a exportação do laudo;
- o comportamento dos demais placeholders e exames.

O resultado esperado é que a inserção de uma tabela processe somente o placeholder afetado. Uma atualização completa do documento deve ocorrer apenas quando realmente necessária, como na abertura do laudo, troca do modo de visualização ou atualização dos dados da REP.

## 2. Evidências atuais

### 2.1 Captura diagnóstica

A captura de desempenho `c280477d-e128-4560-82c2-984ecaa2f351`, no cenário `uso_editor`, registrou uma alteração real do conteúdo durante a criação da tabela:

- `laudo:updateConteudo`: 8,2 ms;
- CPU do renderer: p95 de 4,07% e máximo de 4,93%;
- memória do renderer: crescimento aproximado de 9,3 MB na janela de renderização;
- atraso do event loop: p95 de 15,92 ms e máximo de 18,59 ms;
- nenhum erro, IPC lento, gargalo ou degradação da coleta.

A execução isolada não demonstrou congelamento prolongado. Porém, o fluxo atual contém reconstruções globais que podem acumular custo conforme aumentam o documento, o número de placeholders, as seções abertas e as células das tabelas.

### 2.2 Fluxo atual relevante

1. `LaudosPage.inserirPlaceholder()` executa o comando `insertPlaceholder`.
2. O comando do `TinyMceEditor` insere a âncora `<span data-placeholder>`.
3. `LaudosPage` chama `aplicarModoNoEditor()`.
4. `agendarVisualizacaoPlaceholders()` agenda `aplicarVisualizacaoPlaceholders()`.
5. A aplicação completa:
   - remove todas as prévias do editor;
   - percorre todas as âncoras `[data-placeholder]`;
   - recria as prévias HTML;
   - percorre tabelas, cabeçalhos e células para configurar edição;
   - reconfigura tabelas personalizadas e controles.

No modo de várias seções, o efeito responsável pela visualização depende de `secoes`. Alterações comuns no conteúdo geram um novo array e podem reaplicar a visualização em todos os editores, mesmo quando apenas uma seção foi modificada.

### 2.3 Hipótese principal

A quantidade de linhas da TABELA 2 amplifica o custo, mas não é sua única causa. O custo dominante tende a ser a reconstrução global do DOM do editor e, no modo de várias seções, a repetição desse trabalho em editores não relacionados.

## 3. Escopo

### Incluído

- aplicação incremental da visualização de um placeholder recém-inserido;
- preservação das prévias não afetadas;
- redução de reaplicações globais no modo de várias seções;
- otimização das consultas repetidas ao DOM durante uma aplicação completa;
- instrumentação separada para aplicação incremental e completa;
- testes automatizados com tabelas de 6 e 80 linhas;
- validação manual em modo diagnóstico.

### Não incluído

- alteração visual ou estrutural da TABELA 2;
- paginação ou virtualização das linhas dentro do TinyMCE;
- mudança no contrato dos dados B602 ou na integração GDL;
- mudança na exportação para DOCX/PDF, exceto ajustes estritamente necessários para manter compatibilidade;
- limites rígidos de tempo em testes Vitest executados no CI.

## 4. Arquitetura proposta

### 4.1 Extrair o processamento de uma âncora

Extrair de `aplicarVisualizacaoPlaceholders()` uma operação interna responsável por processar apenas uma âncora:

```ts
processarAncoraPlaceholder(
  editor,
  body,
  ancora,
  opcoes,
  contexto,
): ResultadoProcessamentoPlaceholder
```

Essa operação deve concentrar o comportamento hoje repetido para valores de texto, HTML, HTML inline, campos pendentes e tabelas personalizadas.

Requisitos:

- preservar a âncora original quando ocorrer erro;
- não gerar entrada indevida no histórico de undo;
- produzir contadores de placeholders, prévias, tabelas, linhas e células;
- reutilizar as mesmas regras na aplicação incremental e completa;
- não consultar novamente o documento inteiro para cada âncora.

### 4.2 Adicionar aplicação incremental

Criar uma função pública específica, por exemplo:

```ts
aplicarVisualizacaoPlaceholder(
  editor,
  ancora,
  opcoes,
): ResultadoAplicacaoPlaceholders
```

Ao inserir um placeholder:

1. gerar um identificador temporário ou estável para a nova âncora;
2. inserir a âncora pelo comando do TinyMCE;
3. localizar somente essa âncora no `body` do editor;
4. aplicar sua visualização sem remover outras prévias;
5. retirar o identificador auxiliar se ele não for necessário para edição/restauração futura;
6. usar a aplicação completa apenas como fallback recuperável se a âncora não puder ser localizada.

O fallback deve ser registrado na telemetria para revelar regressões silenciosas.

### 4.3 Reservar a aplicação completa para eventos globais

Manter `aplicarVisualizacaoPlaceholders()` para:

- inicialização do editor;
- troca entre os modos `dados` e `chaves`;
- mudança do mapa de valores causada por atualização da REP;
- restauração de tabela personalizada quando o estado global precisar ser recomposto;
- recuperação após inconsistência detectada no DOM.

A inserção comum de um placeholder não deve usar esse caminho.

### 4.4 Evitar reaplicação em todos os editores

Reestruturar o efeito da `LaudosPage` para não depender do conteúdo completo de `secoes`.

Alternativas aceitáveis:

- manter um registro estável dos editores montados por ID; ou
- derivar uma assinatura estrutural contendo somente IDs, quantidade e ordem das seções, sem `conteudo`.

O efeito global deve reagir somente a:

- mudança do mapa de placeholders resolvidos;
- mudança do modo de visualização;
- montagem ou desmontagem estrutural de editores;
- troca do laudo em edição.

Digitação, inserção de conteúdo ou alteração de uma seção não deve reaplicar placeholders nas demais seções.

### 4.5 Reduzir consultas repetidas ao DOM

Durante uma aplicação completa:

- construir uma vez um mapa das tabelas personalizadas por identificador;
- evitar `querySelectorAll()` global dentro do laço de cada placeholder;
- contar tabelas, linhas e células durante o mesmo percurso que prepara o DOM;
- evitar consultas adicionais apenas para telemetria;
- preservar a identidade dos nós que não precisam mudar.

Não é necessário virtualizar 80 linhas nesta etapa. O DOM correspondente é aceitável desde que seja criado uma vez e não reconstruído por alterações não relacionadas.

### 4.6 Instrumentação de desempenho

Separar as operações registradas:

- `aplicar_visualizacao_incremental`;
- `aplicar_visualizacao_completa`;
- `fallback_visualizacao_completa`.

Metadados esperados:

- `placeholders`;
- `previasCriadas`;
- `previasRemovidas`;
- `tabelas`;
- `linhas`;
- `celulas`;
- `tabelasPersonalizadas`;
- indicador booleano de aplicação incremental, se adotado no contrato permitido.

A telemetria não deve registrar conteúdo do laudo, valores de células, números de REP ou dados pessoais.

## 5. Plano de implementação

### Etapa 1 — Caracterização antes da alteração

1. Expandir os testes existentes para fixar o comportamento atual de visualização, edição, restauração e idempotência.
2. Criar fixtures B602 determinísticas com 6 e 80 itens de material encaminhado.
3. Registrar quantos placeholders, tabelas, linhas e células são processados.
4. Criar um teste inicialmente falho que demonstre que inserir um placeholder não deve substituir prévias não relacionadas.

Resultado: regressões funcionais ficam visíveis antes da refatoração.

### Etapa 2 — Refatorar sem mudar comportamento

1. Extrair `processarAncoraPlaceholder()`.
2. Extrair o contexto compartilhado de uma passagem completa, incluindo mapas e contadores.
3. Manter `aplicarVisualizacaoPlaceholders()` usando a função extraída.
4. Executar os testes existentes antes de alterar o fluxo de inserção.

Resultado: lógica central única, pronta para uso incremental.

### Etapa 3 — Implementar inserção incremental

1. Ajustar o comando `insertPlaceholder` ou seu payload para identificar a âncora criada.
2. Implementar `aplicarVisualizacaoPlaceholder()`.
3. Alterar `LaudosPage.inserirPlaceholder()` para usar o caminho incremental.
4. Adicionar fallback completo somente quando a âncora não puder ser localizada ou processada.
5. Garantir que o cursor e a seleção do TinyMCE sejam preservados.

Resultado: inserir a TABELA 2 não reconstrói as demais prévias.

### Etapa 4 — Corrigir reaplicações entre seções

1. Remover o conteúdo de `secoes` como gatilho do efeito global.
2. Adotar registro estável dos editores ou assinatura estrutural das seções.
3. Garantir aplicação inicial via `onEditorInit`.
4. Reaplicar globalmente apenas nas mudanças de modo, mapa resolvido ou estrutura.

Resultado: editar uma seção não provoca processamento nas demais.

### Etapa 5 — Otimizar a aplicação completa

1. Indexar tabelas personalizadas uma única vez por passagem.
2. Consolidar preparação e contagem de tabelas/células.
3. Evitar remoção e recriação quando a prévia existente já representa o mesmo valor, caso essa comparação possa ser feita sem complexidade excessiva.
4. Manter o comportamento idempotente.

Resultado: eventos globais também ficam mais baratos, especialmente em documentos grandes.

### Etapa 6 — Instrumentar e validar

1. Atualizar os metadados permitidos do serviço de desempenho, se necessário.
2. Registrar separadamente caminhos incremental, completo e fallback.
3. Executar validação automatizada.
4. Executar comparação diagnóstica com 6 e 80 linhas usando o mesmo computador, laudo, modo de editor e protocolo.

Resultado: a melhoria pode ser comprovada e acompanhada depois da entrega.

## 6. Plano de testes automatizados

### 6.1 Testes unitários da apresentação de placeholders

Arquivo principal:

- `src/__tests__/renderer/apresentacao-placeholders.test.ts`

Casos:

1. **Aplicação incremental básica**
   - inserir uma âncora de tabela;
   - processar somente essa âncora;
   - confirmar uma prévia e uma tabela;
   - confirmar contadores de linhas e células.

2. **Preservação das demais prévias**
   - preparar duas ou mais prévias;
   - guardar a referência DOM de uma prévia não afetada;
   - inserir ou atualizar outro placeholder;
   - confirmar que a referência original permanece a mesma.

3. **Tabela com 6 linhas**
   - gerar a TABELA 2 com 6 itens;
   - confirmar 6 linhas de dados, cabeçalhos e células esperadas;
   - confirmar que somente um placeholder foi processado.

4. **Tabela com 80 linhas**
   - gerar a TABELA 2 com 80 itens;
   - confirmar 80 linhas de dados e conteúdo do primeiro e último item;
   - confirmar ausência de truncamento ou duplicação;
   - confirmar que outras prévias não foram reconstruídas.

5. **Idempotência incremental**
   - executar duas vezes sobre a mesma âncora;
   - confirmar que permanece somente uma prévia.

6. **Falha isolada e fallback**
   - provocar erro em uma âncora;
   - preservar seu conteúdo original;
   - não remover prévias válidas;
   - confirmar registro do fallback quando aplicável.

7. **Tabela personalizada**
   - garantir que aplicação incremental em outro placeholder não restaure, remova ou substitua uma tabela personalizada.

8. **Undo/redo**
   - confirmar que a decoração visual continua fora do histórico de undo;
   - confirmar que a inserção feita pelo usuário permanece no histórico normal do TinyMCE.

### 6.2 Testes da geração da TABELA 2

Arquivos candidatos:

- `src/__tests__/renderer/exportacao-placeholders-b602.test.ts`;
- novo `src/__tests__/renderer/tabelas-placeholder.test.ts`, somente se a responsabilidade ficar mais clara em arquivo próprio.

Casos:

- geração determinística com 6 e 80 itens;
- numeração sequencial correta;
- formatação da quantidade;
- valores ausentes representados conforme o contrato atual;
- título e cabeçalhos preservados;
- HTML estrutural reconhecido como formato `html`;
- exportação contendo todas as linhas independentemente do modo de visualização do editor.

### 6.3 Teste de integração da LaudosPage

Criar ou ampliar um teste do renderer para simular dois ou mais editores montados.

Casos:

- inserir placeholder em um editor chama a aplicação incremental somente nele;
- alterar o conteúdo de uma seção não chama aplicação completa nas demais;
- mudar `modoVisualizacaoPlaceholders` reaplica todos os editores uma única vez;
- mudar o mapa resolvido após atualização da REP reaplica todos os editores uma única vez;
- montagem de nova seção aplica a visualização apenas ao novo editor.

Se testar a página inteira exigir mocks excessivos, extrair um hook pequeno de coordenação dos editores somente quando essa extração reduzir a complexidade real do teste e da implementação.

### 6.4 Critérios para testes de desempenho no CI

Não usar limites rígidos de milissegundos no Vitest. JSDOM não reproduz layout, pintura e reflow do Chromium, e máquinas de CI variam.

Os gates automatizados devem validar propriedades determinísticas:

- quantidade de placeholders processados;
- quantidade de prévias criadas e removidas;
- preservação da identidade de nós não afetados;
- ausência de aplicação em editores não relacionados;
- coalescência de solicitações rápidas;
- crescimento linear da quantidade de linhas e células;
- ausência de duplicação de prévias e listeners.

Tempos podem ser coletados como informação diagnóstica, mas não devem reprovar o CI nesta etapa.

### 6.5 Validação diagnóstica manual

Executar duas capturas `uso_editor`, sem outras ações concorrentes:

1. inserir a TABELA 2 com 6 linhas;
2. inserir a TABELA 2 com 80 linhas.

Para cada cenário, registrar:

- duração de `aplicar_visualizacao_incremental`;
- placeholders, tabelas, linhas e células processados;
- CPU e memória do processo `Tab`;
- p95 e máximo do atraso do event loop;
- long tasks;
- erros, fallbacks e IPCs lentos;
- tempo percebido até a tabela ficar disponível.

Critérios iniciais de aceitação manual:

- exatamente um placeholder processado na inserção;
- nenhuma prévia não relacionada removida;
- nenhum outro editor reaplicado;
- nenhuma long task igual ou superior a 200 ms;
- nenhum erro ou fallback no fluxo nominal;
- tabela de 80 linhas completa e editável conforme o contrato atual;
- interface permanece interativa durante e imediatamente após a inserção.

Limites de duração mais restritos devem ser definidos após obter uma linha de base repetível no mesmo equipamento. A comparação válida exige o mesmo laudo, conjunto de dados, modo do editor e protocolo de captura.

## 7. Arquivos com alteração provável

- `src/renderer/lib/apresentacao-placeholders.ts` — processamento incremental e completo;
- `src/renderer/components/editor/TinyMceEditor.tsx` — identificação da âncora inserida, se necessária;
- `src/renderer/pages/LaudosPage.tsx` — escolha entre aplicação incremental e global e coordenação dos editores;
- `src/renderer/lib/tabelas-placeholder.ts` — apenas se a geração ou os contadores precisarem de ajuste;
- `src/main/services/desempenho.service.ts` — metadados permitidos da telemetria, se necessário;
- `src/shared/desempenho/contratos.ts` — somente se o contrato tipado precisar de novo campo;
- `src/__tests__/renderer/apresentacao-placeholders.test.ts` — regressão principal;
- `src/__tests__/renderer/exportacao-placeholders-b602.test.ts` — geração/exportação B602;
- teste de integração da `LaudosPage` ou hook extraído — prevenção de reaplicação entre editores.

## 8. Riscos e mitigação

### Prévia desatualizada após mudança global

Mitigação: manter o caminho completo para troca de modo, atualização do mapa da REP e montagem do editor.

### Perda de edição de tabela personalizada

Mitigação: preservar IDs e nós personalizados; cobrir explicitamente com teste de identidade e restauração.

### Regressão no undo/redo ou no cursor

Mitigação: manter decorações dentro de `undoManager.ignore()` e inserções do usuário no fluxo normal; testar seleção e histórico no nível possível com mocks e validar manualmente no TinyMCE real.

### Divergência entre visualização e exportação

Mitigação: não alterar o contrato de `buildPlaceholderMapping()` ou `resolverPlaceholdersExportacao()` sem testes de exportação com 6 e 80 linhas.

### Otimização excessivamente acoplada ao B602

Mitigação: implementar o caminho incremental de forma genérica para placeholders HTML, usando a TABELA 2 como cenário crítico, sem codificar regras exclusivas do exame dentro do editor.

## 9. Validação técnica obrigatória

Após a implementação:

```text
npm run type-check
npm run lint
npm test -- src/__tests__/renderer/apresentacao-placeholders.test.ts src/__tests__/renderer/exportacao-placeholders-b602.test.ts
npm test
git diff --check
```

Executar também `npm run build` se houver mudança na integração do TinyMCE, divisão de módulos ou carregamento do renderer.

## 10. Critérios de conclusão

A melhoria estará concluída quando:

- inserir um placeholder de tabela usar o caminho incremental;
- apenas a âncora afetada for processada;
- prévias e tabelas personalizadas não relacionadas preservarem seus nós;
- alterações comuns de uma seção não reaplicarem todos os editores;
- os testes de 6 e 80 linhas passarem;
- exportação, modo por chaves, restauração e undo/redo permanecerem corretos;
- type-check, lint e testes passarem sem novos avisos;
- a captura diagnóstica não indicar long task, erro ou fallback no fluxo nominal;
- a telemetria permitir diferenciar aplicação incremental de aplicação completa.

## 11. Documentação após a implementação

Depois que o comportamento estiver implementado e validado, sugerir ao usuário a atualização das especificações de estado atual mais relacionadas:

- `spec/05 placeholder/ciclo_placeholder.md`;
- `spec/03 laudo/editor_texto.md`;
- documentação B602 somente se o comportamento funcional percebido pelo usuário ou o contrato da TABELA 2 mudar.

Essa atualização deve seguir o fluxo `/spec` somente após aprovação do usuário e deve descrever o estado final, não reproduzir este plano.
