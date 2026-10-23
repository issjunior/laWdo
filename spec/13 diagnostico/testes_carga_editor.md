# Testes de carga do editor

Ferramenta de desenvolvimento para reproduzir gargalos no Electron real. A carga gráfica não integra o CI nem aprova ou bloqueia releases. Somente os testes unitários rápidos da ferramenta integram o CI, por `npm run test:carga:unitarios`; os comandos usuais de desenvolvimento e build não iniciam a suíte. Requer Windows, Node/npm nas versões do projeto e uma sessão gráfica disponível.

O laWdo é de uso individual: a suíte simula um único usuário, em uma instância de teste por vez, com ações sequenciais. A carga vem do tamanho dos documentos, das edições repetidas e dos processamentos internos encadeados. Os vários processos do Electron pertencem à mesma instância.

```powershell
npm run test:carga
npm run test:carga -- --perfil estresse
npm run test:carga -- --perfil estresse --massa estresse
npm run test:carga -- --perfil estresse --cenario resistencia
npm run test:carga -- --cenario digitacao --semente 42
npm run test:carga -- --comparar C:\caminho\resultado.json
npm run test:carga -- --trace
npm run test:carga:unitarios
```

O comando prepara assets e um build diagnóstico antes da execução. `--sem-build` reutiliza deliberadamente os artefatos existentes em `out/`; use somente se já os tiver atualizado. Playwright utiliza o Electron instalado no projeto: não é necessário baixar navegadores adicionais. O suporte do Playwright a Electron é experimental; revalide o lançador quando atualizar essas dependências.

Feche outras sessões diagnósticas deste workspace antes de começar. Durante a execução, mantenha o laWdo fictício em primeiro plano e não use seu teclado/mouse nessa janela. A suíte autentica `carga.perito`, abre uma REP fictícia e aciona os controles do editor. Não utiliza documentos reais. Rede HTTP/HTTPS/WebSocket e fetch no processo principal ficam bloqueados somente nessa execução de desenvolvimento.

## Perfis

- `rapido`: massa representativa próxima de 4 MB, documento único e seções, aquecimento e três repetições independentes por modo. Reserve aproximadamente 10 minutos, além do build; a duração varia por máquina e pelos achados.
- `estresse`: acrescenta massa de controle e massa próxima de 16 MB, com mais tabelas, células, placeholders e imagens; inclui repetição prolongada de combinações com semente fixa. Reserve aproximadamente 40–60 minutos, podendo aumentar em máquinas com maior lentidão. O tamanho efetivo e os hashes aparecem no relatório.
- `--massa`: seleciona uma massa do perfil para investigação focal. Por exemplo, `--perfil estresse --massa estresse` executa somente a massa maior e sua resistência. Sem a opção, executa todas as massas do perfil.
- `--cenario`: limita cada repetição a `digitacao`, `texto`, `figuras`, `placeholders`, `encadeamento` ou `saida`. A massa continua representativa no perfil rápido.
- `--repeticoes`: de 1 a 10, padrão 3. Permite uma verificação focal curta durante o desenvolvimento; o roteiro padrão mantém três repetições.
- `--cenario atalho`: verificação adicional do Ctrl+S com foco no iframe. Fica fora do roteiro padrão e relata ausência de persistência como achado.
- `--cenario resistencia`: executa somente o caso separado de dez minutos na massa maior, por seções. Requer `--perfil estresse`; as repetições normais são dispensadas neste recorte.
- `--semente`: inteiro de 0 a 4294967295; padrão 22102026. Reproduz os bytes das imagens e a sequência pseudoaleatória.
- `--trace`: grava o trace de ações por caso. Altera a instrumentação, portanto não compare com uma execução sem trace.

Os cenários exercitam digitação com intervalos de 50 ms, pausas de 200/600 ms, colagem volumosa e undo/redo, inserção/remoção/reordenação de figuras, legendas, apresentação de placeholders, células, salvamento imediato, troca de modo, reabertura e cancelamento de saída. O teste posiciona a seleção para digitar no fim do parágrafo e para excluir figuras; a digitação e exclusão ocorrem por eventos nativos de teclado. As colagens de texto e HTML passam pelo evento de clipboard tratado pelo TinyMCE, sem acessar nem modificar o clipboard do usuário. Nenhum cenário substitui a digitação por `setContent`.

A verificação independente confere seções, chaves de placeholders, rótulos únicos das células, contagens e hashes, ordem/numeração das figuras e quantidade dos marcadores editados. Compara também o conteúdo das células e das figuras antes e depois do salvamento. A digitação confere o cursor após a pausa; cada inserção de imagem usa bytes fictícios distintos e determinísticos para exercitar inserções sucessivas.

O cenário de células faz três edições consecutivas na mesma célula, posicionando o cursor no fim do conteúdo antes de cada edição. Para conferir o conteúdo original, remove somente os marcadores inseridos pelo teste e os espaços adjacentes. O conteúdo completo editado continua sendo comparado antes e depois do salvamento.

## Dados e evidências

Cada execução usa `tmp/teste-carga/execucao-*/`, com marcador de isolamento, banco, caches, imagens e configurações próprios. A inicialização recusa caminhos externos, marcadores inválidos e aplicativo empacotado quando o modo de carga é solicitado. Cada repetição começa com uma cópia nova da massa base. Os dados fictícios e evidências são preservados para investigação; a suíte não remove bancos do usuário.

Na raiz da execução:

- `resultado.json`: contexto, massas, resultados, métricas, limitações e comparação opcional.
- `relatorio.html`: relatório navegável que pode ser aberto diretamente no navegador.
- `base-*/massa.json`: parâmetros, contagens e hashes dos dados de entrada.

Em cada caso:

- `acoes.json`: sequência e horários, incluindo falha e etapas executadas.
- `processos.json`: amostras de CPU e memória por papel, preservando os PIDs como evidência.
- `diagnostico.json`: capturas de desempenho segmentadas em janelas de 30 segundos; o último segmento pode ser encerrado antecipadamente.
- `evidencia.png`: tela de uma falha, quando disponível, fora do intervalo medido.
- `trace.zip`: somente com `--trace`.
- `userData/`: banco fictício, imagens e logs de desempenho originais.

## Interpretação

**Duração da ação não é latência de digitação**: inclui a cadência programada, esperas e interações da automação. A métrica de entrada até o próximo frame é uma aproximação da resposta visual, não uma confirmação do instante de pintura na tela. A referência de p95 de 100 ms é observacional.

A digitação cadenciada envia eventos nativos pelo Chromium em intervalos programados, sem aguardar uma resposta por tecla. A fila fica limitada a 32 comandos; eventuais esperas por contrapressão e os horários de envio ficam em `acoes.json`. O relatório inclui a cadência de recebimento para evidenciar quando o aplicativo ou o gerador não acompanha a frequência solicitada. O resumo do caso agrega as ações, preservando amostras de iframes substituídos durante a troca de modo.

A suíte mede long tasks, atraso do renderer, etapas do editor, IPC, CPU e memória. Separa origem/categoria das operações para não misturar tempo do processo principal e ida e volta do renderer. Long tasks observadas em mais de um frame são deduplicadas por horário/duração. Crescimento de memória sem outras evidências não comprova vazamento. Janelas ocultas ou sem foco, entradas sem frame concluído, APIs ausentes, amostras descartadas e degradação diagnóstica são limitações explícitas. Amostras dos iframes substituídos são preservadas como dados clonados no contexto principal, sem guardar referências a suas janelas.

A comparação requer mesma máquina, semente, massa, roteiro e instrumentação. O identificador da instrumentação inclui scripts, Node e Playwright. Não usa igualdade de PID entre execuções. Diferenças de código/build são registradas para investigação; resultados incompatíveis não recebem deltas conclusivos. A resistência usa duração fixa e termina a ação em curso; sua quantidade de ações pode variar, com a sequência efetiva preservada no relatório.

`concluido` significa que o cenário e as verificações de integridade terminaram. `achado` registra um problema durante o exercício. `inconclusivo` identifica preparação/instrumentação indisponível. Após falhar, as ações dependentes daquele caso não continuam; a próxima repetição começa limpa.

O comando retorna 0 quando consegue executar e gerar o relatório, mesmo com achados funcionais. Retorna 1 para falha de infraestrutura/execução incompleta e 130 para interrupção. `Ctrl+C` cancela a execução, encerra apenas os processos que a suíte criou e tenta preservar o relatório. Os limites são 12 minutos por caso, 15 minutos para o caso de resistência e 90 minutos para a execução completa; preparação e build também têm limites próprios.

Comece pelas operações de maior p95 e correlacione os horários com as ações e amostras de processos. Repita o mesmo comando após uma alteração pequena. O diagnóstico não exige registro de novos canais IPC ou execução livre de código pelo MCP.

## Fontes de verdade e integração

`package.json` define os comandos e mantém Playwright somente nas dependências de desenvolvimento. `scripts/carga/executar.mjs` supervisiona sinais e executa o worker; executor.mjs prepara o build, gera bases e lança casos sequenciais; configuracao.mjs define massas, argumentos e compatibilidade; cenarios.mjs exerce a interface e valida integridade; entrada.mjs controla a cadência; diagnostico.mjs coleta e segmenta métricas; relatorio.mjs consolida evidências. preparar.mjs gera apenas o banco fictício. processos.mjs encerra somente handles criados pela execução.

`src/main/utils/teste-carga.ts` é chamado no bootstrap antes de carregar os serviços: sem LAWDO_TESTE_CARGA=1 retorna imediatamente. Quando solicitado, exige execução não empacotada, LAWDO_SMOKE_JANELA=1, userData descendente real de tmp/teste-carga e marcador isolamento.json com finalidade teste-carga e versão 1. Caminhos são resolvidos com realpath para rejeitar escapes por links. O bootstrap isola userData/sessionData, bloqueia fetch global no main e requisições HTTP/HTTPS/WebSocket das sessões Electron. Não constitui bloqueio genérico de todo transporte Node; os cenários não devem adicionar integrações externas. Nenhum canal IPC novo é criado.

`src/__tests__/main/teste-carga-isolamento.test.ts` cobre as guardas do bootstrap; `src/__tests__/renderer/sincronizacao-editor-laudo.test.ts` protege agrupamento e leitura imediata. Os testes Node em scripts/carga verificam geração determinística, integridade, comparabilidade, limites de fila, falha de transporte e escape do relatório sem janela real. A passagem desses unitários não substitui a carga manual. Como achados funcionais podem retornar código 0, consultar sempre os estados dos casos e as limitações no relatório.
