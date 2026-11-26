# Plano de inclusão do template integrado I-801

## Objetivo

Integrar ao catálogo do laWdo o template **“Laudo de Exame de Veículo a Motor”**, associado à natureza **I-801 — Exame nas Numerações Identificadoras**.

- O **GDL é a fonte de verdade** para a natureza do exame, os campos, as opções e as regras de preenchimento do I-801. Quando o usuário disponibilizar a página, a inspeção orientará a definição dos campos obrigatórios do formulário e dos placeholders específicos.
- O **template criado e indicado pelo usuário no próprio laWdo** é a referência para o texto, as seções e a formatação da versão integrada.

## Ponto de partida no código

- O catálogo GDL identifica a natureza como `I801` (`idGdl: 1004`). O formulário local usa `I-801` e já possui a seção **Numerações Identificadoras**. `numeracaoService` grava os dados em `reps.campos_especificos`, no bloco `numeracao`, com `fabricacao` para o par ano de fabricação/modelo.
- O cadastro e o menu já oferecem placeholders I-801. `exportacao-placeholders.ts` lê `i801.fabricacao_modelo` e usa `i801` para os demais campos. O resumo da REP lê `numeracao`, mas procura `fabricacao_modelo`. Assim, há divergência tanto no nome do bloco quanto no campo de fabricação. A descrição do placeholder de motor indica até 12 caracteres, enquanto formulário e validação aceitam até 15.
- O registro de importação GDL e `ResultadoImportacaoGdl` abrangem B-601 e B-602. `GdlConsultaModal` e `REPsPage` têm pontos que pressupõem peças e campos balísticos. O catálogo embarcado ainda carece de um template I-801.

## Etapas

1. **Inspecionar a página do I-801 no GDL quando ela for disponibilizada.** Identificar campos, opções, formatos, obrigatoriedade e condições de preenchimento observáveis na interface. Confrontar esses dados com o contrato e as respostas conhecidas da consulta individual para identificar o que pode ser importado. Usar somente operações autorizadas com efeito de leitura comprovado e exemplos higienizados. Se uma regra de preenchimento só puder ser confirmada por uma operação com possíveis efeitos de escrita, registrá-la como pendente e usar uma evidência alternativa fornecida pelo usuário. **Concluída em 25/11/2026; registro abaixo.**

2. **Definir o formulário e os placeholders específicos.** A partir da inspeção, registrar para cada campo a obrigatoriedade e suas condições, as opções, o formato, a disponibilidade na API e o placeholder correspondente quando aplicável. Identificar quais campos poderão ser importados e quais exigirão preenchimento manual. A REP comporta múltiplas peças e, portanto, múltiplos veículos ou itens. Resolver as divergências de formato e os valores automáticos do formulário existente com base nas regras confirmadas. Distinguir ausência de informação de constatações como “sem identificação”. Manter como pendentes os pontos que a inspeção e os contratos disponíveis deixarem em aberto. **Concluída em 25/11/2026; definição abaixo.**

3. **Implementar a importação individual I-801.** Estender `gdl-adaptadores.service.ts` e o contrato discriminado `ResultadoImportacaoGdl` para os campos confirmados, reutilizando a identificação de natureza, a consulta e os campos comuns da REP. Validar e normalizar a resposta externa no main e os dados consumidos pelo renderer nas fronteiras aplicáveis. Alinhar handler, canal permitido, wrapper e tipos de preload quando o contrato IPC mudar. Em `GdlConsultaModal` e `REPsPage`, discriminar o I-801 antes dos caminhos de peças e campos balísticos. Na revisão da importação, preservar os valores locais no modo de mesclagem. Substituições devem seguir a confirmação do usuário e dados ausentes da fonte devem preservar valores locais. Usar respostas simuladas e higienizadas. A atualização seletiva de REP já salva é um fluxo separado e fica fora desta entrega.

3.1. **Confirmar e mapear os campos condicionais retornados pelo GDL.** Quando houver resposta higienizada da consulta individual ou contrato oficial, confrontar os nomes efetivamente retornados com `placa`, `placa_original`, `placa_aplicada`, `chassi_aparente`, `chassi_revelado`, `marca`, `modelo`, `prefixo_vtr`, `cor`, `ano_fabricacao`, `numero_serie` e `resultado_psa`. Mapear somente os campos comprovados para `personalizados` da peça I-801, preservando a mesclagem não destrutiva e a revisão do usuário. Enquanto a confirmação não existir, preservar os campos candidatos em `extrasGdl`, exibi-los no diálogo de importação e na edição da peça como dados que exigem revisão e emitir o aviso correspondente; extensões desconhecidas sem correspondência condicional continuam preservadas sem disparar esse aviso.

4. **Completar o formulário e a persistência da REP.** Aplicar na seção existente os campos e as regras de obrigatoriedade confirmados no levantamento. Manter `numeracao` e `fabricacao` como ponto de partida da representação local. Se o levantamento exigir mudança de formato, preservar a leitura dos registros existentes e definir uma única forma de gravação. Validar o JSON antes de reidratar os campos. Verificar a criação manual, a importação e a reabertura de REPs existentes.

5. **Disponibilizar os placeholders no laWdo.** Reaproveitar as chaves existentes para os mesmos conceitos, cadastrar as novas chaves confirmadas no levantamento e alinhar formulário, menu e resolução. O resumo da REP, o editor, o índice, a prévia e a exportação leem os dados locais da REP, importados do GDL ou complementados pelo usuário. Manter ausências como pendências pelo fluxo de `XXX` e preservar as personalizações locais do laudo. Entregar a lista das chaves disponíveis para uso na autoria do template.

6. **Receber a indicação do template criado no laWdo.** O usuário cria o template na tela de Templates e indica qual registro deve ser versionado. Se for preciso transferi-lo de outra instalação, usar a ação **Exportar Template**. Conferir no registro indicado o vínculo com o I-801 e os placeholders que ele usa. A versão integrada deve reproduzir o texto, a hierarquia, a ordem das seções, a formatação, os quadros e as figuras do template indicado.

7. **Versionar o template indicado no catálogo do laWdo.** Converter o registro indicado na definição integrada v1, com chave estável, chaves locais de seção e vínculo pelo código `I-801`. Comparar o resultado com o original e aplicar validação, checksum e sincronização do catálogo. A adoção de um registro existente segue a regra de equivalência do sincronizador. Confirmar disponibilidade na seleção da REP, proteção de edição do integrado e clonagem para personalização. Preservar os vínculos de REPs existentes e o conteúdo de laudos e clones já gravados.

8. **Validar o fluxo de ponta a ponta.** Após estabilizar a implementação, propor os testes novos ou ajustados, informando justificativa e escopo conforme `AGENTS.md`. A rejeição atual do I-801 em `gdl-adaptadores.service.test.ts` deve dar lugar à cobertura do novo adaptador, preservando um caso de rejeição para natureza sem suporte. Cobrir importação simulada com campos parciais ou inválidos, preservação de preenchimento local, ciclo de gravação e reabertura, resolução de valores preenchidos e ausentes, instalação e seleção do modelo. Executar `npm run type-check`, `npm run lint` e `npm test`, incluindo as regressões de GDL, templates integrados, placeholders e saída sem edição. No Electron, confirmar criação, saída sem edição, edição real com undo/redo, salvamento e reabertura. Comparar editor, HTML salvo, prévia e exportação PDF com dados fictícios e conferir as demais saídas afetadas. Validar paginação, numeração e figuras conforme a estrutura do modelo.

**Execução em 26/11/2026:** testes focados de importação, persistência, diálogo de peças e seleção de template I-801 foram aprovados; `npm run type-check`, `npm run lint` e `git diff --check` foram concluídos sem erro. No Electron em modo diagnóstico, o usuário executou o fluxo local de criação via API GDL, salvamento e reabertura sem erro observado; a consulta posterior ao diagnóstico não retornou eventos de erro ou aviso. As 2 falhas de `exportacao-parser.test.ts` foram corrigidas ao alinhar a expectativa de altura padrão de pares de figuras a 67%, conforme a regra compartilhada. A execução completa da suíte, com acesso permitido apenas ao servidor simulado local, passou com **257 arquivos e 1.946 testes aprovados**. As falhas anteriores de `gdl.service.test.ts` eram causadas exclusivamente pelo bloqueio do ambiente isolado ao mock em `127.0.0.1`, sem relação com VPN, GDL real ou o fluxo I-801.

9. **Atualizar as specs necessárias.** **Concluída em 26/11/2026** pelo fluxo `/spec`, após aprovação do usuário. Atualizadas `spec/02 rep/criar_input_personalizados_exame.md`, `spec/02 rep/steps_preenchimento_form.md`, `spec/02 rep/salvar_input_personalizado.md`, `spec/05 placeholder/ciclo_placeholder.md` e `spec/03 laudo/templates_integrados.md`. `spec/08 gdl/api_gdl.md` já refletia o adaptador I-801 e permaneceu inalterada; as demais candidatas da auditoria foram tratadas como falsos positivos.

## Registro da etapa 1 — inspeção do I-801 no GDL

### Complemento de 26/11/2026

Foi inspecionada, somente em leitura, outra REP I-801 disponibilizada pelo usuário. A natureza exibida foi **I801 — Exame nas Numerações Identificadoras**. A grade de peças confirmou que a interface expõe, por item, **Tipo do Item**, uma coluna de **Placa**, **Identificação**, **Quantidade**, **Data de Entrada** e **Consumida**. A inclusão de peça mantém os campos comuns previstos no manual: identificação, número de análises, quantidade, medida, examinado in loco, datas, lacres, código do vestígio, consumo/liberação e observação.

Esta REP não exibiu campos condicionais preenchidos na resposta visual; por isso, a inspeção confirma o mapeamento dos campos comuns, mas não comprova os nomes retornados pela API para placa, chassi, marca, modelo ou os demais condicionais. A pendência da etapa 3.1 permanece: o adaptador deve conservá-los em `extrasGdl` e solicitar revisão até receber contrato oficial ou carga higienizada.

Inspeção manual realizada em 25/11/2026 em uma REP I-801 disponibilizada pelo usuário. Foram usadas somente leituras da interface e mudanças transitórias da seleção de **Tipo do Item**, sem adicionar peças, acionar pesquisas, salvar ou gerar laudo.

- A seção **Peças** admite inclusão repetida e exibe uma lista de peças já cadastradas; portanto, a representação local deve suportar múltiplos itens I-801, sem assumir um único veículo.
- Campos comuns observados: **Tipo do Item** (marcado como obrigatório), Identificação, Nº Análises, Quantidade, Medida (marcada como obrigatória), Quant. Descrição, Examinado In Loco, Data de Entrada (marcada como obrigatória), Lacre Entrada, Lacre Saída, Data de Liberação, Código do Vestígio, Consumido/Liberado no Exame e Observação.
- Quando Nº Análises não recebe valor, o GDL informa que atribui `1` automaticamente. Para Quantidade, a interface exige ponto como separador decimal.
- Nenhum campo condicional observado traz marcação de obrigatoriedade. Essa ausência não comprova que a API aceite campos vazios: a regra de validação no envio permanece pendente.
- Foram mapeados os 32 tipos disponíveis. Os campos condicionais se agrupam assim:

| Campos condicionais | Tipos |
|---|---|
| Placa, Placa Original, Placa Aplicada, Chassi Aparente, Chassi Revelado, Marca, Modelo, Prefixo VTR, Cor, Ano de Fabricação | Automóvel, Caminhão, Caminhonete, Camioneta |
| Placa, Placa Original, Placa Aplicada, Chassi Aparente, Chassi Revelado, Marca, Modelo | Carroçaria, Motoneta, Reboque, Semirreboque |
| Chassi Aparente, Chassi Revelado | Eixo, Escavadeira, Esmerilhadeira, Furadeira, Longarina, Máquina Agrícola, Módulo Eletrônico, Monobloco, Motocicleta |
| Chassi Aparente, Chassi Revelado, Nº Série, Marca, Modelo | Motor |
| Chassi Aparente, Chassi Revelado, Marca, Modelo | Segmento de Monobloco |
| Placa, Placa Original, Placa Aplicada, Chassi Aparente, Chassi Revelado, Marca, Modelo, Cor, Ano de Fabricação | Ônibus, Veículo Aquático |
| Placa, Placa Original, Placa Aplicada, Chassi Aparente, Chassi Revelado, Marca, Modelo, Prefixo VTR | Utilitário |
| Nº Série, Marca, Modelo | Bicicleta, Caixa de Direção, Caixa de Câmbio |
| Marca, Modelo | Motosserra, Quadro de Motocicleta, Roçadeira, Segmento de Longarina |
| Resultado PSA: Selecione, Negativo, Positivo, Positivo Fraco | Outros, Placa Automotiva |
| Nenhum | Politriz |

- Para campos veiculares, a interface mostrou controles de consulta denominados **Enviar** junto de algumas identificações. Eles não foram acionados porque seu efeito não foi comprovado como estritamente de leitura.
- O contrato atual de consulta individual possui campos genéricos de peça e preserva campos desconhecidos, mas ainda não discrimina I-801; os adaptadores e o resultado tipado atendem somente B-601/B-602. Logo, a disponibilidade real dos campos condicionais na resposta da API continua pendente até haver amostra higienizada ou evidência contratual.

## Registro da etapa 2 — definição de formulário e placeholders

### Padrão reutilizável para templates com múltiplas peças

Todo novo template que represente mais de uma peça deve adotar o padrão estabelecido em B-601/B-602 e aplicado ao I-801: catálogo tipado por natureza, estado próprio da coleção, persistência contextual em `campos_especificos.<natureza>.pecas`, validação por item, normalização na fronteira GDL e mesclagem não destrutiva que preserve edição manual. O componente visual e os tipos só devem ser compartilhados quando forem semanticamente neutros; não reutilizar componentes ou tipos de outra natureza apenas por terem estrutura semelhante.

### Modelo local e compatibilidade

- A versão integrada deve seguir o padrão já estabelecido para coleções de peças em B-601 e B-602: estado próprio da natureza fora de `REPFormData`, serialização contextual para `campos_especificos.i801.pecas[]`, validação por catálogo e mesclagem que preserve edições locais. I-801 não introduz uma nova arquitetura; apenas especializa esse padrão para seus tipos e campos condicionais. `tipo_item` é obrigatório em cada entrada.
- Cada peça terá: `tipo_item`, `identificacao`, `numero_analises`, `quantidade`, `medida`, `quantidade_descricao`, `examinado_in_loco`, `data_entrada`, `lacre_entrada`, `lacre_saida`, `data_liberacao`, `codigo_vestigio`, `consumido_liberado`, `observacao` e os condicionais permitidos para o tipo selecionado.
- Campos condicionais normalizados: `placa`, `placa_original`, `placa_aplicada`, `chassi_aparente`, `chassi_revelado`, `marca`, `modelo`, `prefixo_vtr`, `cor`, `ano_fabricacao`, `numero_serie` e `resultado_psa`. `resultado_psa` terá somente `negativo`, `positivo` e `positivo_fraco` como valores persistidos.
- `numero_analises` ausente será normalizado localmente para `1`; `quantidade` aceita decimal com ponto; os demais formatos só receberão restrição adicional quando forem comprovados por contrato ou por validação local justificável.
- Os campos atuais em `numeracao` devem continuar legíveis para REPs já gravadas. Durante a transição, o primeiro item compatível poderá alimentar os placeholders legados; a nova gravação deve usar uma única representação canônica em `i801.pecas` depois da migração de leitura ser implementada.
- O componente atual `PecasBalisticaFields` é a referência funcional mais próxima, mas tem tipos e regras próprias de balística. I-801 deve reutilizar seu desenho de estado, catálogo, serialização e mesclagem; uma extração de componente genérico só será feita na etapa 4 se reduzir duplicação real sem acoplar os domínios.
- `conservacao`, `motor` e `motor_revelado` são dados do formulário legado, mas não foram observados como campos condicionais gerais do GDL. Não devem ser copiados automaticamente para o novo modelo sem outra evidência. O tipo de item **Motor(es)** usa os campos observados para chassi, nº de série, marca e modelo.

### Obrigatoriedade e preenchimento manual

| Campo | Regra definida | Importação atual |
|---|---|---|
| Tipo do item | obrigatório por peça | pendente de adaptador I-801 |
| Medida e data de entrada | obrigatórios na interface do GDL; preservar a marcação no formulário integrado | campos genéricos da peça podem estar disponíveis, mas precisam de amostra higienizada |
| Nº de análises | padrão `1` quando ausente | campo genérico potencialmente disponível |
| Quantidade | decimal com ponto | campo genérico potencialmente disponível |
| Campos condicionais | exibidos somente para os tipos mapeados na etapa 1; nenhum foi confirmado como obrigatório | preenchimento manual até confirmação contratual |
| Resultado PSA | lista fechada: negativo, positivo, positivo fraco; somente em Outros e Placa Automotiva | preenchimento manual até confirmação contratual |

Ausência de dado importado significa campo não informado: não será convertida em “sem identificação”. Esse texto, se necessário, é uma escolha explícita do usuário no formulário ou no laudo.

### Placeholders definidos

- Manter as chaves legadas `veiculo`, `placa`, `fabricacao_modelo`, `cor`, `conservacao`, `chassi`, `chassi_revelado`, `motor` e `motor_revelado` apenas para leitura de REPs existentes, corrigindo o resolvedor para ler também `numeracao` e `fabricacao`.
- Para o novo formato, criar placeholders indexados de item: `i801_item_N_tipo`, `i801_item_N_identificacao`, `i801_item_N_placa`, `i801_item_N_chassi_aparente`, `i801_item_N_chassi_revelado`, `i801_item_N_marca`, `i801_item_N_modelo`, `i801_item_N_numero_serie`, `i801_item_N_cor`, `i801_item_N_ano_fabricacao`, `i801_item_N_resultado_psa` e os dados comuns necessários ao texto do laudo.
- Criar `i801_tabela_pecas` como placeholder computado, para representar todos os itens em tabela HTML quando o template precisar de listagem completa. O template de veículo a motor pode usar os placeholders indexados do primeiro item sem perder a capacidade de informar os demais.
- Ajustar a descrição do placeholder legado `motor` para o limite realmente aplicado pelo formulário atual (15 caracteres), até sua substituição pelo modelo de itens.

### Pendências preservadas

- Confirmar, por resposta higienizada da consulta individual ou contrato oficial, os nomes e a presença dos campos condicionais na API; até lá, o adaptador só deve preencher campos genéricos comprovados e preservar dados locais.
- Confirmar a validação executada pelo GDL ao adicionar/salvar peça, sem realizar operação de escrita. Não inferir obrigatoriedade dos campos condicionais pela ausência de asterisco.

### Dependência de implementação identificada

A inclusão do I-801 no discriminante `ResultadoImportacaoGdl` deve ser entregue junto com o estado `pecasI801`, a revisão de peças e a persistência contextual no renderer. O diálogo e a página de REP hoje só sabem reconciliar B-601/B-602; registrar o novo adaptador antes dessa conexão permitiria receber peças sem um destino seguro. Por isso, o catálogo I-801 é preparado antes, mas o adaptador será registrado somente na entrega coesa das etapas 3 e 4.

## Dependências

- A inspeção começa quando o usuário disponibilizar a página do GDL. Os campos obrigatórios e a lista final de placeholders dependem dessa inspeção.
- O versionamento começa quando o usuário indicar o template que criou no laWdo. Se a indicação vier antes do levantamento, a versão integrada será conferida depois que as chaves do I-801 forem definidas.

## Referências

- [AGENTS.md](../../AGENTS.md) e [Integração atual com a API GDL](../08%20gdl/api_gdl.md).
- [Manual local da API GDL](../../docs/api/API_GDL.txt), seção **Obter Dados da REP** (linhas 274–359): a consulta individual é somente leitura (`GET /api/rep/obter/{id}` ou `GET /api/rep/obter?numero={numero}&ano={ano}`) e documenta, por peça, `codPeca`, `tipoPeca`, `identificacao`, `quantidade`, `unidadeMedida`, `examinadoInLoco`, `numeroAnalises`, `dataEntrada` e `consumida`. A mesma seção não discrimina os campos condicionais do I-801, como placa, chassi, marca, modelo, número de série ou resultado PSA; portanto, ela confirma o contrato comum já importado, mas não autoriza o mapeamento automático desses campos. O catálogo de tipos por natureza está na seção **Tipos de Peças** (linhas 222–230), via `GET /api/tiposPecas?codNaturezaExame={codNaturezaExame}`.
- [Etapas do formulário](../02%20rep/steps_preenchimento_form.md) e [Persistência dos campos específicos da REP](../02%20rep/salvar_input_personalizado.md).
- [Ciclo de placeholders](../05%20placeholder/ciclo_placeholder.md) e [Menu de contexto do laudo](../03%20laudo/menu_contexto.md).
- [Padrão de elaboração](../03%20laudo/padrao/padrao_elaboracao.md), [Templates integrados](../03%20laudo/templates_integrados.md) e [Exportação do laudo](../03%20laudo/exportar_laudo.md).
- [Aviso de salvamento sem edição](../problemas%20diversos/aviso_salvar_sem_edicao.md).
