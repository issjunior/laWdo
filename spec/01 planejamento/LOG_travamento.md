# Plano operacional — investigação de travamentos por tabelas e ilustrações

## Objetivo

Criar na versão oficial do laWdo uma captura local e limitada de desempenho, integrada à tela de Logs. O objetivo é registrar o que acontece nos minutos anteriores ao congelamento sem armazenar conteúdo do laudo, HTML, textos, legendas, nomes de arquivos ou imagens.

A primeira versão será somente diagnóstica. As otimizações serão escolhidas depois da análise do CSV, evitando corrigir uma hipótese sem comprovação.

## Hipóteses iniciais

- Reconstrução completa das prévias de placeholders e das tabelas no DOM ao abrir ou alternar a visualização.
- Busca repetida de tabelas dentro do processamento de cada placeholder.
- Acúmulo de imagens completas como data URI no renderer.
- Leitura e conversão para base64 de todas as imagens após salvar cada nova imagem.
- Carregamento simultâneo de todas as imagens no carrossel ou em **Inserir todas**.
- Renderização integral da lista do painel com animação e drag-and-drop, sem virtualização.
- Operações síncronas de arquivos e miniaturas bloqueando o processo principal.

## Implementação da captura

### Persistência

- Adicionar o módulo técnico `desempenho`.
- Gravar as amostras em `performance.log`, no diretório `userData/logs`, em formato NDJSON.
- Manter esse arquivo separado de `combined.log` para que amostras de desempenho não removam erros técnicos durante a rotação.
- Configurar rotação de 10 MB, mantendo no máximo três arquivos.

### Perfis de captura

1. **Detalhado**
   - Iniciado manualmente.
   - Duração máxima de 15 minutos.
   - Amostras a cada 2 segundos.
   - Registra todas as operações diagnósticas suportadas.
   - Interações são agregadas e limitadas; texto digitado e conteúdo dos elementos nunca são registrados.
   - Ao terminar ou reiniciar o aplicativo, retorna ao perfil **Importante**.

2. **Importante**
   - Perfil padrão.
   - Amostras a cada 10 segundos.
   - Registra operações lentas, crescimento relevante de memória, Long Tasks e atrasos do event loop.

3. **Crítico**
   - Registra somente renderer sem resposta, encerramento do processo, erros fatais e operações acima do limite crítico.

A preferência entre **Importante** e **Crítico** poderá ser persistida. O perfil **Detalhado** será sempre temporário.

### Privacidade e correlação

- Cada captura terá um UUID próprio.
- O laudo será representado por um identificador derivado por hash com salt da sessão; o ID real não será exportado.
- Registrar somente versão do laWdo, Electron/Chromium, Windows, arquitetura, quantidade de CPUs e memória total.
- Não registrar:
  - conteúdo ou HTML do laudo;
  - valores de placeholders;
  - texto digitado ou copiado;
  - legendas;
  - nomes e caminhos de arquivos;
  - imagens ou trechos de base64;
  - dados pessoais da REP.

### Métricas e limiares

- Usar `app.getAppMetrics()` para CPU por processo.
- Coletar no renderer, quando suportado:
  - heap usado e limite do heap;
  - atraso do event loop;
  - Long Tasks;
  - contagens agregadas do DOM do editor.
- Métricas indisponíveis devem ficar nulas, sem interromper a captura.
- Persistir os eventos já detectados por `unresponsive`, `responsive` e `render-process-gone` também no log oficial.

Limiares iniciais:

| Métrica | Importante | Crítico |
|---|---:|---:|
| Atraso do event loop | 200 ms | 1.000 ms |
| Duração de operação funcional | 250 ms | 2.000 ms |
| Heap | 75% do limite ou crescimento de 256 MB em 5 minutos | esgotamento iminente ou falha |
| Long Task | contabilizar acima de 50 ms; registrar agregado a partir de 200 ms | 1.000 ms |

## Pontos de instrumentação

### Placeholders e tabelas

Registrar, sem conteúdo:

- duração da aplicação da visualização;
- modo `dados` ou `chaves`;
- tamanho total do documento em caracteres;
- quantidade de placeholders;
- quantidade de prévias criadas e removidas;
- quantidade de tabelas, linhas e células;
- quantidade de tabelas personalizadas;
- falhas e repetições do agendamento.

### Painel de Ilustrações

Registrar duração, quantidades e bytes agregados de:

- reconciliação de imagens;
- listagem do painel;
- geração e obtenção de miniaturas;
- upload;
- abertura do carrossel;
- carregamento de imagem completa;
- inserção individual e em lote;
- reordenação;
- substituição e exclusão.

Também registrar quantas imagens completas permanecem em memória e quantos itens o painel renderiza.

### Serviço de imagens

Registrar:

- tempo de leitura do arquivo;
- tempo de resize e codificação JPEG;
- tempo de conversão para base64;
- tempo de persistência;
- tamanho de entrada e de saída;
- quantidade de arquivos relidos por operação;
- duração total do handler IPC.

### Renderer e IPC

- Registrar heap, atraso do event loop, Long Tasks e totais de nós, tabelas, células e imagens no editor.
- Registrar canal IPC permitido, duração, sucesso ou falha e tamanho aproximado do payload.
- Nunca registrar o payload propriamente dito.

## Contratos e IPC

Criar contratos compartilhados e tipados para:

- `PerfilCapturaLogs`;
- `SessaoCapturaDesempenho`;
- `AmostraDesempenho`;
- eventos discriminados de placeholder, ilustração, IPC e processo.

O preload deve expor somente métodos específicos para:

- consultar e configurar o perfil;
- iniciar e parar a captura detalhada;
- registrar o marcador **Problema aconteceu agora**;
- listar eventos de desempenho;
- exportar o diagnóstico.

Não expor acesso genérico a arquivos, processos ou módulos do Electron.

## Alterações na tela de Logs

Adicionar a aba **Desempenho** com:

- seletor de perfil;
- status da captura e tempo restante;
- botão **Iniciar captura**;
- botão **Problema aconteceu agora**;
- botão **Parar captura**;
- botão **Exportar diagnóstico CSV**;
- instrução para iniciar a captura antes de abrir o laudo afetado.

O CSV deve ser cronológico e conter:

- sessão e horário;
- perfil e severidade;
- origem, categoria e evento;
- duração;
- CPU e memória;
- atraso do event loop e Long Tasks;
- contagens de DOM, placeholders, tabelas, células e imagens;
- identificador opaco do contexto;
- metadados agregados permitidos.

A exportação deve incluir erros técnicos ocorridos na mesma janela temporal, mas não os registros de auditoria de usuários. A limpeza protegida já existente também deverá remover os logs de desempenho.

## Protocolo no PC afetado

1. Instalar a versão oficial contendo a captura.
2. Abrir **Logs > Desempenho**.
3. Selecionar **Detalhado** e iniciar a captura.
4. Abrir o laudo afetado.
5. Reproduzir separadamente:
   - abertura do laudo;
   - alternância entre **Dados da REP** e **Placeholders**;
   - abertura do Painel de Ilustrações;
   - abertura do carrossel;
   - inserção individual de imagem;
   - inserção em lote;
   - cenário combinado de tabela e painel.
6. Ao perceber a lentidão, clicar em **Problema aconteceu agora**.
7. Se houver congelamento, aguardar a recuperação. O processo principal deverá registrar `unresponsive` mesmo com o renderer bloqueado.
8. Parar a captura e exportar o CSV.
9. Encaminhar o CSV para análise.

## Análise do CSV

Correlacionar a linha do tempo para responder:

- A duração da visualização cresce com o número de placeholders, tabelas ou células?
- O DOM anterior é removido e recriado integralmente em cada alternância?
- A memória cresce após abrir o painel e não retorna depois de fechá-lo?
- O carrossel ou **Inserir todas** materializa todas as imagens completas simultaneamente?
- Cada upload provoca releitura das imagens anteriores?
- O congelamento coincide com CPU alta, Long Task, atraso do event loop, IPC lento ou filesystem?
- O problema está no renderer, no main process ou na combinação dos dois?

## Reprodução local controlada

Criar cenários sintéticos usando o mesmo fluxo real da aplicação:

- tabelas de 6, 20, 40 e 80 colunas;
- diferentes quantidades de linhas, priorizando o total de células;
- múltiplos placeholders de tabela no mesmo documento;
- alternâncias repetidas entre os modos de visualização;
- lotes crescentes de imagens e diferentes resoluções;
- abertura e fechamento repetido do painel e do carrossel;
- execução isolada e combinada dos cenários.

Comparar sempre o mesmo cenário e protocolo antes e depois de qualquer otimização.

## Testes recomendados

Esta instrumentação exige testes próprios porque cruza privacidade, persistência, IPC e exportação:

- sanitização impede HTML, textos, legendas, nomes de arquivos, teclas e base64;
- cada perfil libera somente os eventos previstos;
- o modo detalhado expira após 15 minutos;
- limiares e agregações geram a severidade correta;
- rotação limita o espaço ocupado;
- CSV permanece válido com campos ausentes, vírgulas e aspas;
- encerramento ou congelamento do renderer preserva amostras já recebidas pelo main;
- a tela inicia, marca, encerra e exporta uma captura;
- payloads IPC inválidos são rejeitados sem interromper o logger.

## Validação da implementação

Executar:

- `npm run type-check`;
- `npm run lint`;
- `npm test`;
- `npm run build`;
- `npm run pack`;
- smoke test no Windows.

No perfil **Importante**, a instrumentação não deverá:

- gerar mais de uma amostra IPC a cada 10 segundos por janela;
- aumentar em mais de 5% a mediana das operações medidas no cenário de referência;
- crescer indefinidamente em memória ou disco;
- alterar o conteúdo ou o estado de edição do laudo.

## Critério para iniciar correções

Não aplicar otimizações estruturais antes da primeira captura representativa. Depois da análise, abrir um plano de correção separado para a causa comprovada, priorizando:

1. bloqueios do renderer e crescimento de memória;
2. operações quadráticas ou releitura integral;
3. trabalho síncrono no main process;
4. renderização integral e animações da lista;
5. ajustes de UX para operações inevitavelmente grandes.

## Premissas

- A coleta será exclusivamente local e não terá envio automático.
- **Importante** será o perfil padrão.
- IDs serão correlacionáveis somente dentro da captura.
- A primeira entrega mede e exporta; não altera ainda os algoritmos suspeitos.
- Este documento é um plano operacional e não descreve o comportamento atual do sistema.
