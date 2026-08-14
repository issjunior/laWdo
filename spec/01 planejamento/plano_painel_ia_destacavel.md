# Painel de IA — consultas precisas, desempenho e UX resiliente

## Resumo

Evoluir o painel de IA existente para separar claramente três intenções:

- `Perguntar`: consultar o conteúdo sem alterar o laudo;
- `Escrever`: criar um texto para inserção;
- `Reescrever`: transformar somente o escopo selecionado.

O modo `Perguntar` será o padrão e terá um pipeline factual próprio. Ele deverá preservar a estrutura do documento, apresentar evidências verificáveis e adaptar o processamento à complexidade da pergunta. A prioridade será a exatidão da resposta, com meta de até 30 segundos para uma consulta factual típica sobre o documento completo.

## Diagnóstico

O pedido livre atual reutiliza o pipeline destinado à transformação de fragmentos. Uma pergunta factual pode, portanto, ser tratada como instrução para reescrever todos os fragmentos do escopo.

Há ainda quatro limitações relevantes:

- o contexto textual baseado em `textContent` elimina fronteiras entre seções, listas, tabelas, armas e respectivos exames;
- documentos extensos são divididos em lotes independentes, inadequados para contagens e cruzamentos globais;
- o orçamento considera principalmente os fragmentos editáveis, embora o contexto resolvido completo também seja enviado;
- a resposta não apresenta evidências que permitam ao perito conferir quais trechos sustentam a conclusão.

A solução não será apenas uma alteração de prompt. Consulta, escrita e reescrita passarão a ter contratos, validações e comportamentos próprios.

## Diretrizes obrigatórias de implementação

### Resiliência

- Modelar o controlador com estados explícitos: `ocioso`, `preparando`, `analisando`, `consolidando`, `verificando`, `concluido`, `insuficiente`, `conflitante`, `cancelado` e `erro`.
- Evitar combinações inconsistentes de booleanos; representar as transições com tipos discriminados.
- Preservar pergunta, modo, modelo e escopo depois de erros recuperáveis.
- Validar respostas de IPC, configurações locais, JSON e provedores como `unknown` antes de alimentar estado tipado.
- Ignorar respostas atrasadas por meio de `operationId`, sessão e fingerprint do snapshot.
- Impedir submissões duplicadas e permitir cancelamento durante qualquer fase remota.
- Manter um fallback visual isolado para falhas inesperadas do painel ou da janela destacada, sem desmontar o editor.
- Tratar larguras mínimas, zoom, textos extensos, nomes longos de modelos, muitas evidências e mensagens grandes sem sobreposição ou perda de controles.
- Nunca alterar automaticamente o escopo, o modelo, o provedor ou o conteúdo do laudo.

### UX para usuários leigos

- Usar componentes shadcn compatíveis com a finalidade e já disponíveis no projeto, salvo necessidade comprovada.
- Usar `Tabs` para os modos `Perguntar`, `Escrever` e `Reescrever`, com rótulos sempre visíveis e ícones apenas como apoio.
- Permitir a troca de modo por mouse e teclado, sem enviar uma solicitação e sem apagar o texto digitado.
- Exibir uma descrição curta do modo ativo e adaptar o placeholder do campo de texto à intenção escolhida.
- Usar `Select` para escopo e modelo, `Collapsible` para evidências, `Alert` para erros recuperáveis, `AlertDialog` para decisões de fallback e `Skeleton` ou progresso para espera.
- Usar `Tooltip` somente para informação complementar; ações essenciais não podem depender exclusivamente de ícones ou tooltips.
- Aplicar divulgação progressiva: mostrar inicialmente modo, escopo, pergunta e resposta; manter evidências, detalhes técnicos e recomendações recolhidos ou contextuais.
- Exibir uma ação principal por estado e poucas ações secundárias.
- Empregar linguagem direta e acionável, sem códigos internos ou termos das APIs.
- Preservar navegação por teclado, foco visível, `aria-live` e restauração de foco após diálogos.
- Consultar primeiro os MCPs configurados quando surgir dúvida técnica: Graphify para arquitetura e relações do código, Context7 para bibliotecas, shadcn e APIs, e outros servidores adequados ao domínio.
- Interromper a implementação e consultar o usuário quando uma dúvida de usabilidade puder alterar comportamento, hierarquia visual ou fluxo de trabalho.

### Layout limpo

- Manter cabeçalho compacto com título, estado e controles da janela.
- Colocar seletores de modelo e escopo em uma área curta e estável, sem repetir essas informações em cada resposta.
- Mostrar os três modos em uma única linha quando houver largura suficiente e preservar rótulos legíveis na largura mínima.
- Reservar a região central para conversa, progresso e erros, evitando cards informativos permanentes sem ação.
- Manter o compositor fixo na parte inferior, com modo, campo de texto e ação de envio claramente relacionados.
- Não exibir simultaneamente confirmação, erro, recomendação, progresso detalhado e evidências expandidas quando uma informação puder ser apresentada sob demanda.

## Estado atual que deve ser preservado

- Dock lateral redimensionável e janela destacável como projeções do mesmo controlador.
- Sessão autenticada, revisão monotônica e mensagens IPC tipadas.
- Uma operação ativa por renderer, cancelamento e descarte de respostas tardias.
- Captura do alvo com fingerprint, bookmark e vínculo da proposta ao conteúdo original.
- Proteção e restauração de placeholders, números, datas, identificadores e URLs.
- Reconstrução do HTML sobre a estrutura original e aplicação atômica por transação de undo.
- Confirmação e retomada de transformações em múltiplos lotes.
- Fluxo separado de descrição de imagens, sem aplicação automática.
- Segurança do Electron com `contextIsolation`, `sandbox` e wrappers específicos no preload.

## Experiência dos três modos

### Perguntar

- Será o modo inicial do compositor.
- Responderá no painel sem modificar o laudo.
- Aceitará o escopo `Seção` ou `Documento completo` selecionado explicitamente.
- Exibirá resposta concisa, modelo utilizado e evidências recolhíveis.
- Oferecerá `Copiar` e `Inserir no cursor` como ações posteriores e explícitas.
- Quando a seção for insuficiente, informará a limitação e oferecerá `Perguntar ao documento completo`, sem ampliar o escopo automaticamente.
- Consultas ao documento completo não exigirão confirmação adicional, pois não alteram o laudo.

### Escrever

- Produzirá conteúdo novo para a posição capturada no editor.
- Manterá o texto gerado somente como proposta até o usuário escolher inseri-lo.
- Abrirá prévia curta antes da inserção, indicando o destino.
- Se o bookmark estiver inválido, preservará a resposta e solicitará que o usuário reposicione o cursor.

### Reescrever

- Transformará somente seleção, seção ou documento capturado.
- Preservará proteção de dados, fingerprint, assinatura estrutural e comparação antes da aplicação.
- Não aproveitará automaticamente respostas ou memória do modo `Perguntar`.

## Contexto estruturado

Substituir a representação linear por blocos ordenados que preservem:

- seções, subseções e títulos;
- parágrafos e listas;
- tabelas, linhas e células;
- figuras e legendas;
- grupos repetidos de armas;
- marcadores estruturais como `data-arma-chave` e `data-arma-indice`.

Cada bloco terá identificador estável, ordem, tipo, seção de origem, título legível, texto e âncora local. O identificador permitirá validar evidências e navegar de volta ao editor.

Regras do snapshot:

- `Documento completo` usa todas as seções visíveis no editor;
- `Seção` usa somente a seção selecionada;
- o snapshot será capturado no momento do envio;
- placeholders serão resolvidos sem perder a posição estrutural;
- o modo integral enviará os valores visíveis;
- o modo protegido enviará tokens opacos e fará a restauração local;
- serialização, índices auxiliares e análises intermediárias permanecerão somente em memória;
- alteração do conteúdo ou do escopo invalidará memória e caches associados ao fingerprint anterior.

## Pipeline de consulta factual

### Contrato da resposta

O provedor deverá retornar saída estruturada que diferencie:

- `respondida`;
- `insuficiente`;
- `conflitante`.

A resposta conterá texto final, IDs das evidências e, quando aplicável, itens identificados e total. O renderer exibirá os trechos recuperados do snapshot local; textos livres produzidos pelo modelo nunca serão aceitos diretamente como citações.

### Processamento adaptativo

- Usar uma chamada quando pergunta e contexto couberem com segurança e não exigirem agregação global.
- Usar extração estruturada por blocos para contagens, listas, comparações, cruzamentos ou documentos longos.
- Consolidar somente os fatos extraídos, sem reenviar o documento completo na chamada final.
- Executar uma verificação adicional apenas diante de conflito, evidência inválida ou contagem inconsistente.
- Processar blocos independentes com concorrência máxima de três chamadas.
- Não usar uma chamada adicional apenas para classificar a pergunta; o roteamento será determinístico a partir do texto e do tamanho do contexto.
- Usar temperatura factual próxima de zero e limitar a saída ao necessário.

### Validação local

- Toda evidência deverá existir no snapshot e pertencer ao escopo solicitado.
- IDs duplicados ou desconhecidos invalidarão a resposta.
- Em enumerações, o total deverá corresponder aos itens únicos consolidados.
- Evidências contraditórias resultarão em estado `conflitante`, sem inferência silenciosa.
- Ausência de suporte suficiente resultará em estado `insuficiente`.
- A resposta somente será mostrada após a validação estrutural e factual.

### Memória curta

- Manter no máximo três interações consultivas anteriores do mesmo escopo e fingerprint.
- Usar a memória apenas para perguntas de continuação, como “e quais calibres?”.
- Limpar a memória ao alterar documento ou escopo.
- Não incluir o histórico visual completo em novas solicitações.

## Seleção e fallback de modelos

- Transformar o nome do modelo no cabeçalho em um `Select` shadcn compacto.
- Agrupar modelos por provedor e apresentar rótulos compreensíveis: `rápido`, `equilibrado` e `maior precisão`.
- Manter a escolha somente durante a sessão do laudo; a configuração geral continuará definindo o modelo inicial.
- Consultar a disponibilidade pelos endpoints oficiais dos provedores e aplicar cache local curto.
- Cruzar a lista remota com o catálogo local de capacidades e limites.
- Se a descoberta falhar, indicar `Não verificado` e permitir tentativa; não declarar indisponibilidade sem evidência.
- Nunca trocar modelo ou provedor automaticamente.
- Quando o modelo puder responder, concluir a operação e mostrar depois uma recomendação discreta se houver opção mais adequada.
- Quando estiver removido, incompatível ou sem chave, abrir `AlertDialog` oferecendo:
  - reenviar com o fallback recomendado;
  - selecionar outro modelo;
  - abrir as configurações;
  - cancelar.
- Preservar pergunta, modo e escopo enquanto o usuário decide.
- Sincronizar o modelo selecionado e sua disponibilidade entre dock e janela destacada.

## Resiliência e desempenho

- Calcular o orçamento sobre instruções, schema, pergunta, memória, contexto e reserva de resposta.
- Não repetir o contexto resolvido completo dentro de cada lote.
- Reutilizar o plano de execução já preparado, evitando nova leitura de configurações, perfil e orçamento entre planejamento e execução.
- Memorizar durante a sessão quais modelos aceitam JSON Schema, evitando repetir fallback incompatível.
- Organizar instruções estáticas no início do prompt e dados variáveis no final, favorecendo caching automático sem criar cache remoto persistente.
- Publicar progresso pelas fases reais: preparação, análise, consolidação e verificação.
- Manter input e resposta anterior visíveis durante retries recuperáveis.
- Não transmitir conteúdo parcial ainda não verificado.
- Preservar cancelamento, retomada e aplicação atômica dos fluxos de transformação.
- Registrar somente metadados operacionais: provedor, modelo, duração, lotes, tentativas, estado e tamanhos. Não registrar conteúdo pericial, pergunta ou resposta.

## Diagnóstico assistido durante a implementação

O modo diagnóstico atual não será considerado suficiente para homologar ou corrigir falhas deste plano. A sessão real usada para investigar o salto de rolagem materializou 108 eventos, dos quais 91 eram IPCs periódicos e somente quatro eram ações; o snapshot foi criado depois da reprodução, trouxe o histórico da sessão inteira e a inspeção estrutural terminou truncada por profundidade. Os eventos de rolagem informaram apenas posição e um nome derivado de `textContent`, sem intenção do usuário, dimensões do contêiner, mudança de layout ou vínculo estável com o componente. Erros do renderer também chegaram pelo arquivo empacotado, sem stack original resolvida.

Esse resultado permite perceber que houve rolagem e que existem erros concorrentes, mas não permite decidir com segurança entre *scroll anchoring*, carregamento de imagem, remontagem do TinyMCE, efeito da abertura do dock ou outra causa. A hipótese registrada no checkpoint abaixo permanece provisória até uma reprodução com evidência causal.

A implementação deste plano adotará como dependência o fluxo detalhado em [`diagnostico.md`](diagnostico.md), com estes requisitos mínimos:

- migrar primeiro o listener `WebContents.console-message` do Electron 43 dos argumentos posicionais depreciados para o objeto moderno com `level`, `message`, `lineNumber`, `sourceId` e `frame`, eliminando o aviso observado no `npm run dev:diagnostico`;
- para problema reproduzível: `diagnostico_status` → `iniciar_captura(finalidade=problema)` → reprodução do usuário → `finalizar_captura`;
- para saúde e desempenho: `diagnostico_status` → `iniciar_captura(finalidade=desempenho)` → coleta e finalização automáticas → `consultar_captura`;
- recorte fechado entre linha de base e término, com estado visual e estrutural antes/depois;
- sonda temporária que diferencie `wheel`/tecla/pointer, rolagem efetiva, mudança de dimensões, *layout shift*, carga de imagem e remontagem do editor, inclusive no documento interno do iframe do TinyMCE;
- descritores estáveis por `data-diagnostico-id`, sem `textContent`, valores de campos ou conteúdo pericial nos eventos;
- captura de `error`, `unhandledrejection`, console e IPC com correlação temporal, stack original por source map e metadados da revisão executada;
- dossiê compacto devolvido diretamente pela ferramenta, contendo linha do tempo essencial, fatos anômalos, eventos de suporte, lacunas, marcadores da interface e arquivos-fonte candidatos;
- aprofundamento por ferramenta MCP própria, sem exigir que o agente conheça caminhos temporários ou use shell para abrir o pacote;
- distinção explícita entre fato, classe de causa candidata e hipótese do agente; a automação não escolherá nem aplicará correção sozinha;
- ciclo de verificação após a correção: teste automatizado de regressão, repetição do mesmo smoke e comparação entre os dois pacotes.
- perfil de desempenho com arquivos locais, métricas agregadas de processos, event loop, frames, IPC e responsividade, respeitando orçamento próprio de overhead e sem aplicar otimizações automaticamente.

O agente somente decidirá uma solução quando a hipótese tiver evidência de suporte, alvo de código rastreável e teste capaz de refutá-la. Se duas causas continuarem igualmente plausíveis, deverá aprofundar a captura ou pedir uma nova reprodução, em vez de selecionar silenciosamente a alternativa mais conveniente.

## Contratos e interfaces

Introduzir contratos compartilhados equivalentes a:

- `ModoInteracaoIa = 'perguntar' | 'escrever' | 'reescrever'`;
- `BlocoContextoIa` com ID, tipo, ordem, seção, título, texto e âncora;
- `SolicitacaoConsultaIa` com operação, pergunta, escopo, modelo, fingerprint, blocos e memória curta;
- `RespostaConsultaIa` com estado, resposta, evidências, itens, total, modelo e recomendação opcional;
- `EvidenciaConsultaIa` referenciando somente IDs de blocos existentes;
- progresso discriminado pelas fases da consulta;
- catálogo de disponibilidade e capacidade dos modelos.

Adicionar IPC específico para:

- planejar e executar consulta;
- cancelar consulta;
- publicar progresso;
- listar e verificar modelos disponíveis.

Os canais deverão ser registrados em conjunto no handler, `ALLOWED_CHANNELS`, preload e tipos públicos. O renderer continuará sem acesso direto a chaves ou APIs externas.

## Etapas de implementação

1. Extrair o estado e o controlador do painel para reduzir a concentração de responsabilidades em `LaudosPage`.
2. Introduzir os contratos de modo, contexto, consulta, evidência, progresso e modelos.
3. Implementar a serialização estruturada e seus fingerprints.
4. Criar o serviço consultivo com roteamento adaptativo, extração, consolidação e validação.
5. Adicionar descoberta de modelos, escolha por sessão, recomendações e fallback confirmado.
6. Reorganizar o painel com `Tabs`, seletores compactos, compositor por modo e divulgação progressiva.
7. Implementar evidências navegáveis, cópia e inserção consultiva com prévia.
8. Integrar dock e janela destacada ao mesmo estado.
9. Homologar a captura guiada e o dossiê para o agente conforme `diagnostico.md`.
10. Ampliar testes e executar o smoke manual do caso que revelou a regressão; somente corrigir a rolagem depois de obter evidência causal e repetir o mesmo cenário após a correção.

## Testes e critérios de aceite

### Contexto e consulta

- Serializar corretamente títulos, listas, tabelas, placeholders, figuras e seções repetidas.
- Criar fixture B-602 com três armas:
  - arma A com exame de prestabilidade;
  - arma B com coleta de padrão;
  - arma C com ambos.
- Responder total `3`, prestabilidade `A e C` e coleta `B e C`, com evidências corretas.
- Distribuir as armas entre blocos diferentes e validar extração, deduplicação e consolidação.
- Cobrir conteúdo integral, conteúdo protegido e restauração de tokens.
- Rejeitar evidência inventada, duplicada, fora do escopo ou associada ao fingerprint anterior.
- Tratar informação insuficiente e conflito sem completar lacunas.

### Interface e resiliência

- Alternar entre os três modos sem perder o texto digitado.
- Validar uso por mouse e teclado e foco após diálogos.
- Testar o layout entre 360 e 640 px, zoom, nomes longos, muitas evidências e temas claro/escuro.
- Confirmar que erro de renderização, rede ou modelo não desmonta o editor nem apaga pergunta e resposta.
- Testar copiar, prévia de inserção, bookmark inválido e navegação com destaque temporário.
- Testar sincronização completa entre dock e janela destacada.
- Em uma reprodução controlada do salto de rolagem, diferenciar ação humana, rolagem programática, *layout shift* e remontagem do editor, apontando eventos de suporte e marcadores de código.
- Confirmar que o dossiê diagnóstico não contém conteúdo do laudo, valores de campos, chaves, tokens ou nomes derivados de `textContent`.
- Confirmar que erro do renderer é apresentado com stack original resolvida e revisão do build, não apenas com o nome do arquivo minificado.

### Modelos e desempenho

- Cobrir modelo disponível, não verificado, removido, incompatível e sem chave.
- Cobrir recomendação não bloqueante e fallback confirmado.
- Garantir que o orçamento inclua o prompt completo.
- Garantir que o documento não seja duplicado por lote.
- Validar limite de concorrência, cancelamento e descarte de respostas tardias.
- Executar `npm run type-check`, `npm run lint` e `npm test`.
- Realizar smoke manual na REP 190-2026 com Gemini 2.5 Flash, esperando três armas e o mapeamento real dos exames em até 30 segundos.

## Checkpoint — 12/08/2026

### Concluído

- Modos `Perguntar`, `Escrever` e `Reescrever` com `Perguntar` como padrão, sincronizados entre dock e janela destacada.
- Consulta factual com snapshot estruturado, validação de evidências locais, cancelamento e tentativa corretiva quando o provedor não respeita o JSON.
- Tabelas Markdown renderizadas no painel, copiadas em formato tabular/HTML e inseridas como tabela HTML segura no TinyMCE.
- Memória curta: até três pares de pergunta/resposta por escopo e fingerprint, limpa ao limpar a conversa.
- Resolução de placeholders no HTML estruturado antes da consulta, incluindo tabelas.
- Validações executadas: `npm run type-check`, `npm run lint` e `npm test` (325 testes aprovados, 1 ignorado).

### Pendente

- Evidências recolhíveis e navegáveis no editor; prévia explícita de inserção consultiva.
- Pipeline adaptativo para documentos extensos: extração por blocos, consolidação, concorrência máxima de três e verificação de conflitos/contagens.
- Catálogo remoto de modelos, seleção por sessão, disponibilidade, recomendação e fallback confirmado.
- Testes B-602 de agregação global, memória por mudança de fingerprint, respostas conflitantes e modelo indisponível.
- Homologação da captura guiada e do perfil automatizado de desempenho descritos em `diagnostico.md`; a v1 atual produz evidência fragmentada, ruidosa e insuficiente para orientar a correção ou comparar desempenho.
- Correção da rolagem automática observada ao abrir laudos com imagens: *reflow*/*scroll anchoring*, remontagem do TinyMCE e efeitos concorrentes continuam como hipóteses; nenhuma será adotada antes de uma captura causal reproduzível.
- Smoke manual da REP 190-2026, incluindo consulta de continuação em tabela com valores de placeholders resolvidos.

## Premissas

- A fonte factual será exclusivamente o snapshot visível do editor.
- `Perguntar` será o modo inicial.
- A escolha de modelo no painel não alterará a configuração global.
- Não haverá troca silenciosa de modelo nem ampliação automática de escopo.
- Não será criado cache remoto persistente.
- Testes automatizados usarão provedores simulados; não haverá chamadas live no CI.
- Dados reais serão enviados integralmente somente quando a preferência correspondente estiver ativa; nos demais casos será aplicado o mascaramento.
- O arquivo documenta o plano vigente e não funcionará como changelog ou registro de progresso.
