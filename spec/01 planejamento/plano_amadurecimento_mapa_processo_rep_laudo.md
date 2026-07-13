# Plano de amadurecimento — mapa do processo REP → Laudo

## Finalidade deste documento

Este plano orienta o amadurecimento de uma visão visual, cronológica e expansível do ciclo de vida iniciado por uma REP e concluído com a entrega do Laudo.

Ainda não é um plano de implementação. Seu objetivo é definir quais informações têm valor para o usuário, como construir uma narrativa histórica confiável e como apresentá-la de maneira intuitiva antes de decidir arquitetura, biblioteca, IPC, banco de dados ou divisão de tarefas.

Referência visual inicial: [wireframe_mapa_processo_rep_laudo.html](./wireframe_mapa_processo_rep_laudo.html).

## Problema que a visão deve resolver

O histórico precisa permitir que o usuário compreenda rapidamente:

- de onde a demanda surgiu;
- qual REP organiza o caso;
- quais pessoas, documentos e peças foram vinculados;
- quando o trabalho pericial efetivamente começou;
- quando o Laudo foi criado, concluído, eventualmente reaberto e entregue;
- qual é o estado atual e qual é a próxima providência;
- quem realizou cada ato relevante e em que data e hora.

A tela não deve ser apenas um log técnico mais bonito. Ela deve contar a história operacional do caso com fatos relevantes, relações explícitas e nível de detalhe progressivo.

## Princípios da experiência

### Cronologia como eixo principal

Os acontecimentos devem ser apresentados do mais antigo para o mais recente. O usuário deve reconhecer imediatamente o início, o estado atual e a próxima etapa esperada.

### Leitura em camadas

Cada acontecimento deve possuir:

1. uma síntese visível sem interação;
2. detalhes adicionais ao expandir;
3. acesso ao registro de origem quando houver uma ação útil, como abrir REP, peça, envolvido ou Laudo.

### História de negócio, não log técnico

Devem aparecer fatos que alterem a compreensão ou o andamento do caso. Autosaves, atualizações internas, eventos repetitivos e detalhes técnicos permanecem na auditoria, mas não precisam integrar a narrativa principal.

### Relações explícitas

Uma ação composta deve ser reconhecida como um único marco do processo. A criação de um Laudo e a mudança correspondente da REP, por exemplo, devem estar correlacionadas por significado, e não apenas por proximidade de horário.

### Estado atual sem apagar o passado

O histórico registra fatos imutáveis. Correções posteriores produzem novos acontecimentos, preservando o que ocorreu e explicando a mudança. Dados atuais podem ser apresentados como resumo, mas não devem reescrever retroativamente a narrativa.

### Privacidade e proporcionalidade

A visão recolhida deve mostrar apenas os dados pessoais necessários para identificar o papel de cada envolvido. Informações sensíveis ou extensas devem permanecer nos detalhes próprios da entidade, com acesso deliberado pelo usuário.

## Estrutura conceitual da tela

### 1. Resumo do processo

Faixa superior com os grandes marcos:

`REP criada → Em andamento → Laudo iniciado → Laudo concluído → Laudo entregue`

Cada marco deve indicar uma das situações:

- concluído, com data e hora;
- atual, com destaque visual;
- pendente;
- não aplicável, quando o fluxo admitir essa hipótese;
- reaberto, quando uma conclusão tiver sido revertida.

### 2. Linha do tempo expansível

Lista vertical de acontecimentos relevantes. O item recolhido mostra data e hora, título, síntese e estado. Ao expandir, revela detalhes organizados e ações contextuais.

Categorias visuais estáveis:

- REP;
- informações vinculadas, como BO, envolvidos e peças;
- Laudo;
- entrega;
- correção ou reabertura.

Cor nunca deve ser o único indicador. Ícone, rótulo e texto precisam acompanhar o significado.

### 3. Próxima etapa

Quando o processo ainda não estiver encerrado, a última posição da timeline deve indicar claramente o que falta, sem inventar prazo ou responsável não registrado.

Exemplos:

- aguardando criação do Laudo;
- aguardando conclusão;
- aguardando entrega;
- aguardando complementação solicitada.

## O que é importante registrar

### Identificação e abertura da REP

- número da REP;
- tipo de exame;
- data e hora de criação ou recebimento;
- solicitante e unidade de origem;
- responsável pela criação;
- situação inicial;
- referência ao BO ou expediente de origem, quando existente.

### BO ou expediente de origem

- vinculação, substituição ou remoção;
- número e órgão de origem;
- data relevante do documento, quando disponível;
- motivo da alteração, quando uma referência anterior for substituída.

O histórico recolhido não deve reproduzir o conteúdo integral do BO.

### Envolvidos

- inclusão, alteração de papel ou desvinculação;
- papel no caso, como periciando, vítima, responsável ou solicitante;
- identificação mínima suficiente para diferenciar pessoas;
- autor e momento da alteração.

Mudanças cadastrais sem impacto no entendimento do caso podem permanecer apenas na auditoria detalhada.

### Peças e documentos

- inclusão, substituição, classificação ou remoção;
- categoria da peça;
- nome ou identificação amigável;
- origem;
- data e hora do vínculo;
- responsável pela ação;
- motivo, quando removida ou substituída.

O histórico deve informar a existência e a função da peça, sem expor seu conteúdo automaticamente.

### Andamento da REP

- transições de situação;
- data e hora de cada transição;
- responsável;
- justificativa para cancelamento, reabertura ou retorno de etapa;
- relação com o acontecimento que provocou a transição.

### Formação do Laudo

- criação do Laudo e REP de origem;
- modelo ou tipo utilizado;
- responsável;
- início efetivo da elaboração;
- acontecimentos editoriais realmente relevantes, evitando registrar cada salvamento;
- conclusão;
- reabertura e respectivo motivo;
- nova conclusão após reabertura;
- eventual cancelamento ou exclusão, com motivo.

### Entrega do Laudo

- data e hora da entrega;
- destinatário;
- meio de entrega;
- número de protocolo ou comprovante, quando houver;
- responsável pelo registro;
- observação necessária para compreender a entrega;
- eventual correção ou anulação do registro.

## Campos mínimos de todo acontecimento

Todo acontecimento apresentado na narrativa deve possuir, quando aplicável:

- identificador próprio;
- categoria;
- tipo do acontecimento;
- data e hora efetivas;
- título amigável;
- resumo curto;
- entidade relacionada;
- responsável pela ação;
- origem da informação;
- situação resultante;
- correlação com outros acontecimentos do mesmo ato;
- detalhes estruturados;
- justificativa ou observação relevante;
- indicação de correção, cancelamento ou substituição.

É necessário distinguir a data em que o fato ocorreu da data em que foi registrado, caso o sistema permita lançamentos posteriores.

## Hierarquia de relevância

### Marcos principais

Sempre visíveis no resumo e na timeline:

- criação da REP;
- início do atendimento;
- criação do Laudo;
- conclusão;
- reabertura;
- entrega;
- cancelamento.

### Acontecimentos contextuais

Visíveis na timeline, com possibilidade de agrupamento:

- BO vinculado;
- envolvidos incluídos ou removidos;
- peças adicionadas, substituídas ou removidas;
- mudança de responsável;
- complementação relevante.

### Auditoria técnica

Não aparece por padrão na narrativa principal:

- autosaves;
- atualizações repetitivas sem mudança de significado;
- consultas e carregamentos;
- detalhes internos de IPC, banco ou sincronização;
- mensagens técnicas de erro.

Esses registros continuam disponíveis no sistema de logs para auditoria e diagnóstico.

## Comportamentos de apresentação a avaliar

- expansão individual de cada acontecimento;
- agrupamento de várias peças ou envolvidos incluídos na mesma operação;
- destaque do acontecimento atual;
- indicação visual de reabertura e retorno no fluxo;
- alternância opcional entre visão resumida e completa;
- filtros por categoria somente se o volume real justificar;
- acesso contextual à REP, ao Laudo, à peça ou ao envolvido;
- adaptação para telas menores sem navegação horizontal obrigatória;
- preservação da posição de leitura ao abrir e fechar detalhes.

## Situações especiais que precisam ser definidas

- REP sem BO;
- REP com mais de um BO ou expediente;
- múltiplos envolvidos com papéis diferentes;
- muitas peças adicionadas de uma só vez;
- Laudo excluído e posteriormente recriado;
- Laudo concluído, reaberto e concluído novamente;
- entrega corrigida ou anulada;
- acontecimentos lançados retroativamente;
- datas ausentes ou inconsistentes;
- usuário ou responsável posteriormente desativado;
- dados históricos cuja entidade relacionada já foi removida;
- possibilidade futura de mais de um Laudo relacionado à mesma REP.

## Perguntas de produto a amadurecer

1. O histórico será apenas consultivo ou permitirá ações, como abrir documentos e entidades?
2. Quais dados pessoais podem aparecer na visão recolhida?
3. Alterações de campos da REP devem aparecer individualmente ou somente quando forem relevantes ao andamento?
4. Qual é o critério para considerar uma edição do Laudo um acontecimento histórico?
5. A conclusão e a entrega exigem justificativa, destinatário ou protocolo obrigatórios?
6. Como representar visualmente reaberturas sem quebrar a leitura cronológica?
7. É necessário comparar valores anteriores e novos em algum tipo de acontecimento?
8. O usuário precisa exportar ou imprimir essa narrativa?
9. A visão deve substituir a timeline atual ou coexistir com a auditoria detalhada?
10. Quais perfis de usuário podem visualizar cada nível de detalhe?

## Etapas de amadurecimento

### Etapa A — validar a narrativa

- reunir exemplos reais representativos de REP concluída, pendente, reaberta e entregue;
- ordenar manualmente os acontecimentos que um usuário considera importantes;
- identificar quais registros atuais são ruído e quais informações ainda não são registradas;
- validar os nomes amigáveis dos acontecimentos.

### Etapa B — fechar o catálogo de acontecimentos

- definir categorias e tipos oficiais;
- estabelecer campos obrigatórios por tipo;
- definir regras de agrupamento e correlação;
- decidir como fatos corrigidos, anulados ou retroativos aparecem;
- classificar cada acontecimento como marco, contexto ou auditoria técnica.

### Etapa C — validar a experiência

- revisar o wireframe com usuários;
- testar leitura rápida do estado atual;
- testar localização de data de conclusão e entrega;
- verificar se a expansão entrega contexto suficiente sem excesso;
- validar comportamento em casos longos e telas menores;
- ajustar linguagem, ícones, cores e hierarquia visual.

### Etapa D — preparar o planejamento de implementação

Somente depois das etapas anteriores:

- consolidar o contrato conceitual dos dados;
- mapear quais informações já existem e quais precisam passar a ser registradas;
- decidir se a timeline atual será evoluída ou substituída;
- escolher a estratégia visual adequada à complexidade confirmada;
- converter as decisões deste documento em requisitos e critérios de aceitação.

## Critérios para considerar a ideia madura

A ideia estará pronta para planejamento de implementação quando:

- houver um catálogo aprovado de acontecimentos;
- cada acontecimento tiver campos e relevância definidos;
- os casos de reabertura, exclusão e entrega estiverem resolvidos;
- a diferença entre narrativa do usuário e auditoria técnica estiver clara;
- o wireframe tiver sido validado com exemplos realistas;
- os dados pessoais exibidos estiverem delimitados;
- for possível responder, pela tela, quando o caso começou, onde está, o que aconteceu e o que falta;
- as informações inexistentes no estado atual estiverem identificadas.

## Fora de escopo neste momento

- escolha definitiva de biblioteca visual;
- desenho de tabelas ou migrations;
- definição de canais IPC;
- divisão em componentes ou serviços;
- estimativas e cronograma de desenvolvimento;
- implementação do fluxo;
- substituição imediata da timeline atual.

