# Melhorias após o diagnóstico do laWdo

## Contexto e sequência

Este documento é um roteiro de implementação. As melhorias descritas abaixo ainda não representam o funcionamento atual do aplicativo.

A sessão diagnóstica de 11/10/2026 registrou 187 eventos e 79 chamadas IPC concluídas. Não houve erro explícito registrado. Essa ausência não confirma que todas as operações funcionaram: atualmente, uma resposta IPC com `success: false` também é registrada como sucesso. A prévia de PDF levou 1,36 s; duas consultas ao contexto da IA levaram 362 ms e 44 ms. Esses tempos isolados não demonstram regressão. Os demais riscos deste roteiro foram identificados pela leitura do código, sem comprovação de ocorrência nessa sessão.

Executar as etapas na ordem abaixo, validar cada uma antes de iniciar a seguinte e registrar separadamente evidências observadas, riscos de código e hipóteses. As etapas 2 a 4 dependem da etapa 1 para que novas falhas possam ser interpretadas corretamente. A etapa 6 depende das correções anteriores para estabelecer uma medição confiável.

## Etapa 1 — Distinguir falhas funcionais no diagnóstico

**Prioridade:** alta.

1. Na ponte IPC do preload, classificar a conclusão de cada chamada em rejeição do transporte, resposta funcional positiva, resposta funcional negativa ou resultado funcional indeterminado. Reconhecer envelopes por validação do valor recebido, sem cast direto, e preservar a resposta entregue ao chamador.
2. Acrescentar ao evento IPC apenas a classificação funcional e os metadados necessários para análise. Preservar o identificador de correlação e uma única conclusão por chamada; não registrar argumentos, respostas completas, credenciais nem conteúdo pericial.
3. Registrar respostas funcionais negativas com nível de erro e ajustar os indicadores de desempenho para não contá-las como operações bem-sucedidas. Continuar distinguindo rejeição IPC de resposta negativa.
4. Tratar eventos antigos sem a nova classificação como resultado funcional desconhecido, sem reinterpretá-los como sucesso confirmado.

**Aceite:** os quatro resultados são distinguíveis na consulta diagnóstica e nos indicadores; a chamada retorna exatamente o mesmo valor ao aplicativo; eventos antigos continuam legíveis. Validar com respostas simuladas, incluindo envelopes malformados e rejeições.

## Etapa 2 — Tornar avisos de console interpretáveis

**Prioridade:** média.

1. Preservar assinatura, nível, origem e localização. Classificar apenas padrões técnicos reconhecidos e associá-los a descrições fixas, sem copiar partes variáveis da mensagem original.
2. Para padrões desconhecidos, informar que o conteúdo foi omitido e manter a assinatura para agrupar ocorrências. Conservar a sanitização existente.
3. Se a resolução de source maps falhar, persistir o aviso com a localização original indisponível e uma razão técnica não sensível.

**Aceite:** um aviso conhecido oferece orientação técnica; um aviso desconhecido permanece agrupável; uma mensagem com dado sensível não expõe esse dado; falha de source map não elimina o evento. Validar por simulação, sem mensagens reais de usuários.

## Etapa 3 — Proteger as configurações de IA

**Prioridade:** alta.

1. Extrair a orquestração do carregamento para um hook da feature de IA. Representar, por grupo salvável, os estados carregando, pronto e erro. Manter a interface visual na página e os contratos IPC atuais.
2. Distinguir configuração legitimamente ausente, falha de leitura e valor inválido. Aplicar valores padrão apenas na ausência legítima; validar provedor, preferências estruturadas e dados recebidos antes de preencher o estado tipado.
3. Executar leituras independentes em paralelo e tratar cada resultado separadamente. Exibir o erro e permitir nova tentativa sem descartar alterações já feitas pelo usuário.
4. Impedir o salvamento de um grupo enquanto os dados necessários não estiverem prontos. Verificar especialmente que falha ao ler uma chave de API não permite gravá-la como vazia por acidente.

**Aceite:** falha de leitura não deixa um grupo aparentemente pronto nem permite sobrescrever dados não carregados; nova tentativa preserva edições locais. Validar falha parcial, valor inválido, ausência legítima, resposta atrasada e recuperação.

## Etapa 4 — Explicitar falhas na configuração do GDL

**Prioridade:** alta.

1. Oferecer à página de configuração uma leitura estrita das preferências de ambiente, preservando o comportamento dos outros consumidores. Não apresentar produção como ambiente confirmado após falha nessa leitura.
2. Distinguir credencial ausente de credencial cuja leitura falhou. Exibir erros e nova tentativa para preferências, credenciais e estado de validação.
3. Bloquear salvar, testar conexão e validar credenciais enquanto as configurações necessárias estiverem indisponíveis. Preservar a proteção contra respostas atrasadas ao trocar de ambiente e aplicá-la também ao estado de validação.
4. Manter a preferência de listagem independente e protegida. Não ampliar permissões nem criar operações de alteração no GDL.

**Aceite:** falhas não aparecem como campos vazios, ambiente confirmado ou ausência confirmada de validação; resposta de um ambiente anterior não substitui o atual. Validar somente com respostas simuladas, sem consultar REPs reais.

## Etapa 5 — Remover consultas redundantes em Tipos de Exame

**Prioridade:** baixa.

1. Usar um único efeito para carregar a lista exibida conforme o filtro de ativos. Manter a consulta dos totais separada e retirar a segunda chamada inicial à lista de ativos.
2. Representar falha dos totais como indisponibilidade, com opção de nova tentativa, sem exibir zero como contagem confirmada.
3. Impedir que uma resposta atrasada de filtro anterior substitua a lista atual. Preservar a atualização da lista e dos totais após operações cadastrais.

**Aceite:** a abertura da página consulta uma vez a lista exibida e uma vez os totais; alternância rápida de filtros mantém o resultado correto; falhas têm tratamento visível.

## Etapa 6 — Medir antes de otimizar

**Prioridade:** após as correções.

1. Preparar uma captura guiada antes de cada cenário: abrir configurações de IA, abrir laudo, abrir assistente, carregar miniaturas e gerar prévia de PDF.
2. Usar o mesmo build, conjunto local de dados e protocolo em cada comparação. Separar a primeira abertura de três repetições por cenário e registrar qualquer degradação da coleta.
3. Comparar duração IPC, CPU, memória e responsividade quando esses dados estiverem disponíveis. Examinar especialmente a prévia de PDF de 1,36 s e as consultas ao contexto da IA de 362 ms e 44 ms observadas na sessão inicial.
4. Registrar a evidência, a hipótese e o benefício esperado antes de propor cache, processamento em segundo plano ou reorganização de módulos. Definir escopo próprio para qualquer otimização adicional sustentada pelas medições.

**Aceite:** medições reproduzíveis distinguem gargalo demonstrado, hipótese e limitação da coleta; recomendações indicam o impacto observado e como verificar o ganho.

## Validação e entrega

- Validar cada etapa antes de começar a próxima. Após alterações de código, executar `npm run type-check` e `npm run lint`, sem aumentar warnings.
- Recomendar explicitamente ao usuário os testes direcionados para as etapas 1 a 5, indicando justificativa e escopo antes de criá-los ou alterá-los, conforme `AGENTS.md`. Testes existentes podem ser executados como diagnóstico. Executar `npm test` nas etapas que alterarem IPC; se testes forem alterados, verificar cobertura.
- Após a extração estrutural da etapa 3, verificar código morto. Para capturas de desempenho, comparar somente cenários e protocolos equivalentes.
- Validar este documento por releitura e `git diff --check`. Alteração exclusivamente documental não exige build, lint ou testes.
- Manter uma branch principal para este escopo, com commits coesos por etapa. Propor atualização das specs de estado atual somente depois de cada implementação e conforme decisão do usuário.

**Premissas:** nenhuma mudança de schema do banco, nova dependência, exposição de dados sensíveis ou ampliação das permissões da integração GDL.
