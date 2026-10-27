# Componentes base de UI

## Escopo e regra de uso

`src/renderer/components/ui/` concentra wrappers compartilhados do design system local. Eles encapsulam primitivas Radix, shadcn e bibliotecas de layout, padronizam classes com `cn`/`cva` e evitam importações diretas quando já existe equivalente local. Estilos são compostos com Tailwind e tokens de `globals.css`; não há CSS avulso por componente.

## Grupos atuais

- Ações e status: `button.tsx`, `badge.tsx`.
- Containers e dados: `card.tsx`, `table.tsx`.
- Entrada: `select.tsx`, `textarea.tsx`.
- Sobreposições e menus: `dialog.tsx`, `sheet.tsx`, `dropdown-menu.tsx`, `context-menu.tsx`.
- Navegação: `sidebar.tsx`.
- Layout redimensionável: `resizable.tsx`, wrapper de `react-resizable-panels`.

`sheet.tsx` permanece disponível para fluxos em sobreposição, mas o Assistente IA do editor não usa Sheet, portal, overlay ou posicionamento fixo. O dock atual é composto por `PainelLateralRedimensionavel.tsx` sobre `resizable.tsx`, reserva espaço real e mantém o editor montado.

## Painéis, rolagem e sidebar

O layout do laudo mantém um trilho direito permanente e mostra um único dock integrado por vez. IA usa largura de 360 a 640 px e Ilustrações de 320 a 720 px. `use-largura-painel-persistida.ts` normaliza e persiste a largura em pixels somente após interação; aberto/recolhido não é persistido.

O conteúdo do laudo usa a rolagem da página. Cada dock e o trilho ficam `sticky` no topo do conteúdo, mas a altura do painel é recalculada pelo espaço realmente visível abaixo da sua posição, em vez de usar uma altura fixa da viewport. Cabeçalhos, controles e avisos ficam fora da rolagem; somente coleções internas, como a fila de ilustrações e as mensagens da IA, rolam com `overscroll` contido. Isso impede que a expansão do editor limite a viewport do dock, sem criar uma segunda rolagem para o documento.

O editor nunca recebe menos de 560 px. Quando um dock aberto não cabe junto ao editor e ao trilho, `PainelLateralRedimensionavel` calcula `560 + largura mínima do painel + 56` e pede ao controlador que o recolha via `ResizeObserver`. Esse recolhimento é uma proteção responsiva local: não altera a largura persistida, não desmonta o editor e o dock pode ser aberto novamente quando houver espaço.

A sidebar esquerda suporta recolhimento temporário enquanto o dock está expandido. Esse estado não altera o cookie da preferência normal; uma expansão manual prevalece durante a abertura atual e uma nova abertura do dock pode aplicar novamente o recolhimento temporário.

## Decisão de extensão

Features devem reutilizar wrappers existentes para botões, diálogos, menus, selects, sidebar e painéis redimensionáveis. Uma abstração nova só se justifica quando reduz duplicação real ou estabiliza um comportamento compartilhado; diferenças exclusivas de uma feature permanecem no componente da própria feature. Alterações no dock devem preservar, em conjunto, limites, persistência por interação, montagem estável do editor, rolagem externa do documento e recolhimento sob largura insuficiente.

Testes de layout cobrem limites, persistência de largura, trilho, montagem estável do editor e interação temporária com a sidebar; `painel-lateral-redimensionavel.component.test.tsx` cobre a estrutura sticky e o limiar mínimo.

## Controle de colunas da tabela compartilhada

`src/renderer/components/data-table/data-table.tsx` mantém filtro e controle de colunas no cabeçalho por padrão. Com `destinoControleColunas`, envia o controle por portal ao elemento fornecido pela página, preservando o estado da mesma tabela; quando a busca está oculta, não monta uma barra vazia. O Dashboard do GDL usa esse posicionamento para manter o controle de colunas ao lado de Atualizar.

## Preferências e rolagem das tabelas

Com `chavePreferencias`, a DataTable persiste ordenação e visibilidade em `localStorage`, no formato `{ ordenacao, visibilidade }`. A leitura inicial valida JSON com Zod, limita a ordenação à quantidade de colunas e descarta IDs inexistentes e tentativas de ocultar colunas com `enableHiding: false`. Se todas as entradas de uma ordenação salva não vazia forem desconhecidas, usa `defaultSorting`. Storage inválido ou indisponível mantém padrões; falha de gravação não impede a sessão. A leitura ocorre na montagem: mudar a chave não recarrega preferências automaticamente. Sem chave, o estado fica apenas em memória.

`densidade="compacta"` reduz altura/espaçamento; `preencherAltura` distribui o espaço restante em flex, mantém controles e paginação fora da rolagem e fixa o cabeçalho. `fixarPrimeiraColuna` mantém a primeira coluna física visível na rolagem horizontal e impõe largura mínima; com pinning habilitado, essa primeira coluna é a de pinning. `Table.containerClassName` dimensiona o contêiner rolável. A cadeia de layout em `App.tsx` usa `min-w-0` para permitir encolhimento; a paginação aceita quebra de linha.

O menu oferece Ocultar somente quando `column.getCanHide()` permite. O Dashboard GDL usa `dashboard_gdl_disposicao`, designação decrescente como ordem inicial e Nº REP não ocultável. A preferência é local à instalação, sem chave por usuário. Testes de tabela/cabeçalho e `gdl-minhas-reps-dashboard.test.tsx` verificam operações e recuperação da disposição.

## Classes dinâmicas e controles compactos

As combinações montadas em execução por categorias, peças e placeholders são declaradas por `@source inline` em `src/renderer/styles/globals.css`. A cobertura atual inclui fundos 100/500 e dark 900/30, textos 600/700 e dark 300/400 e bordas 200 nas famílias de cores declaradas. `tailwind.config.js` não mantém safelist. Ao acrescentar uma combinação dinâmica, atualizar a declaração CSS correspondente; não presumir geração de toda tonalidade ou variante.

`DataTableColumnHeader` aceita `quebrarTitulo` para quebra do rótulo alinhada à esquerda; o padrão continua em uma linha. O slider compartilhado encaminha aria-label e aria-labelledby ao Thumb, mantendo identificação acessível em controles como Proximidade na ferramenta de projéteis.

## Primeiro acesso, versões e navegação

`FirstUserSetupForm.tsx` usa card de até `max-w-3xl`, cabeçalho com logo e título Primeiro acesso, e seções Dados de cadastro e Senha de acesso com campos responsivos. A orientação de restauração permanece: criar a conta local e entrar no laWdo. Persistência do último usuário e login automático estão em `spec/15 seguranca/seguranca_electron.md`.

O diálogo do Header dá destaque à versão atual, disponível e que será instalada, com algarismos tabulares; o fluxo de instalação continua descrito em `spec/12 atualizacao/fluxo_atualizacao.md`. Na sidebar, a identificação Beta pertence ao item Projéteis, sem classificar todo o grupo Ferramentas como beta.

## Indicador da conexão GDL

`Header.tsx` monta `IndicadorConexaoGdl.tsx` no grupo direito, antes do seletor de tema, com chave pela identidade do usuário. O botão mantém o texto GDL e um ícone em largura fixa, sem bloquear ações nem emitir notificações automáticas. Usa wrappers locais de Tooltip, Popover e Button, classes Tailwind, temas claro/escuro, nome acessível e foco visível. Como botão dentro de `barra-titulo-janela`, preserva a regra existente de `no-drag` dos controles da barra de título.

| Aparência | Condição |
|---|---|
| Cinza, interrogação | Sem observação de rede, rede desconhecida ou observação com mais de 120 segundos. |
| Vermelho, conexão interrompida | Evidência recente de rede indisponível. |
| Verde, confirmação | Rede acessível recente, credenciais validadas e nenhuma atenção web conhecida; a validação pode ser anterior. |
| Âmbar, alerta | Rede acessível recente com credenciais ausentes, pendentes ou rejeitadas, ou falha web conhecida. |

Cor, formato e descrição do ícone distinguem os estados. A aparência é derivada por `aparenciaConexaoGdl`, em `src/shared/gdl/conexao.ts`; não duplicar essa regra no header. Durante checagem, mantém o estado anterior e mostra andamento no painel.

Ao clicar, abre um painel compacto com ambiente, disponibilidade, credenciais da API, datas da validação/checagem e situação do acesso web. `Verificar agora` fica desabilitado enquanto verifica e checa somente rede; `Abrir API GDL` fecha o painel e navega para `/gdl-config`. O painel explica que validação anterior não garante permissão para toda operação. O serviço, IPC, ciclo de foco e limites estão em `spec/08 gdl/api_gdl.md`.

`conexao-gdl.test.tsx` cobre painel, ações, estados e ciclo do monitor; `header-atualizacao.component.test.tsx` renderiza o header com roteador e API GDL simulada para preservar a cobertura dos controles de atualização.

## Preferências visuais de imagens

O menu de configurações inclui **Imagens**, rota /imagens. A página usa cartões separados e radiogroups para perfil de prévia do editor e qualidade enviada para IA, com leitura e salvamento independentes por grupo; falha conhecida de leitura bloqueia o respectivo salvamento. O controle de qualidade não aparece mais em Modelos de IA. Formatos, valores e consumidores estão em spec/03 laudo/fluxo_ilustracao.md e spec/06 ia/painel_assistente_ia.md.

O popover GDL destaca Produção com badge destructive e Homologação com secondary; rede acessível recente recebe badge verde. Esses badges apresentam o ambiente/estado existente, sem mudar a regra compartilhada de disponibilidade nem executar operação de negócio.
