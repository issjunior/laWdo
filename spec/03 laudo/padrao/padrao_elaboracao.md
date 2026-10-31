# Padrão de elaboração de laudos

## Objetivo e limites

Referência comum da área de edição de Laudos para estender a elaboração a novas naturezas de exame. Abrange conteúdo, ferramentas, painéis, modais, salvamento e saída. Listagem e criação permanecem em [Ciclo de vida](../laudo_ciclo_vida.md) e nas specs do wizard. As regras gerais de arquitetura e manutenção ficam no [AGENTS.md](../../../AGENTS.md).

Esta referência reúne contratos compartilhados; as specs especializadas conservam os detalhes. A disponibilidade de um recurso depende do exame e do conteúdo. Compartilhar a apresentação de ações não significa conceder as mesmas capacidades a todos os blocos.

## Fontes de verdade e responsabilidades

Os caminhos abaixo são relativos à raiz do repositório.

| Responsabilidade | Fonte |
|---|---|
| Orquestração da sessão, documento único/por seções, diálogos e operações | src/renderer/pages/LaudosPage.tsx |
| Configuração, prontidão e comandos comuns do editor | src/renderer/components/editor/TinyMceEditor.tsx |
| Cabeçalho, modos, rodapé e indicação de salvamento | src/renderer/components/laudo/editor/ControlesEditorLaudo.tsx |
| Superfície Editar/Concluir, Restaurar e Excluir | src/renderer/lib/conteudo-interativo.ts |
| Capacidades e operações por categoria de conteúdo | src/renderer/lib/adaptadores-conteudo-laudo.ts |
| Permissão de edição de campos e proteção de ancestrais | src/renderer/lib/politica-edicao-conteudo.ts |
| Confirmação assíncrona integrada à página | src/renderer/components/editor/ConfirmacaoConteudo.tsx |
| Preparação coordenada e limpeza transitória | src/renderer/lib/preparacao-conteudo-editor.ts e conteudo-interativo-limpeza.ts |
| Conteúdo atualizado e comparação de pendências | src/renderer/lib/sincronizacao-editor-laudo.ts e conteudo-comparavel-laudo.ts |
| Sessão de alterações e saída protegida | src/renderer/hooks/useGerenciadorAlteracoesLaudo.ts e src/renderer/contexts/AlteracoesPendentesContext.tsx |
| Dock, trilho e apresentação compartilhada | src/renderer/components/laudo/PainelLateralRedimensionavel.tsx e src/renderer/styles/globals.css |
| Acionadores no iframe e menus externos dos seletores | src/renderer/lib/seletores-tabela-laudo.ts e src/renderer/components/editor/SeletorTabelaLaudo.tsx |
| HTML comum das figuras e imagem dummy | src/shared/figura/html.ts |
| Resolução do conteúdo destinado à saída | src/renderer/lib/exportacao-placeholders.ts |
| Tabelas de impressão, margens e preparação PDF | src/main/services/pdf-tabelas.ts, pdf-layout.ts e pdf-prontidao.service.ts |

Durante a digitação, o DOM do editor contém o conteúdo mais recente; o estado React recebe a sincronização agrupada. Conteúdo persistido e estado visual de liberação são distintos. A gravação segue os contratos locais de laudo e imagens descritos nas specs especializadas.

## Interface, conteúdo persistido e saída

| Camada | Fonte e responsabilidade | Contrato de manutenção |
|---|---|---|
| Interface transitória | Componentes da página, controles no iframe e apresentação em globals.css | Menus, foco, temas, guias e estado de edição não compõem o documento; abrir ferramentas ou preparar controles não deve criar pendência. |
| Conteúdo persistido | HTML lido do editor pela sincronização e limpo antes do salvamento | Conserva texto, personalizações, formatação nativa, identidades e vínculos semânticos; controles e atributos transitórios são removidos. |
| Saída | Resolução de placeholders e imagens, montagem da apresentação e preparação do formato escolhido | Preserva conteúdo e formatação suportada após a resolução prevista, sem controles de edição. Prévia e exportação PDF compartilham preparação, margens e regras de tabelas. |

Tailwind e os tokens de globals.css governam a interface. O HTML do documento usa também atributos e estilos inline persistíveis, como bordas, alinhamento e espaçamento; a impressão usa suas fontes compartilhadas no main. Temas e destaques de interação não definem a aparência impressa. Uma mudança deve ser aplicada na fonte responsável e conferida nos consumidores afetados, preservando as escolhas explícitas do usuário conforme os contratos especializados.

O editor não representa uma página impressa: largura disponível, fontes, margens e motor de saída influenciam quebras e paginação. A consistência exigida é de conteúdo e formatação suportada, sem promessa de paginação idêntica entre editor, PDF e DOCX/ODT. As diferenças atuais de adaptação de tabelas estão em [Exportação](../exportar_laudo.md); a preparação comum do PDF está em [Prévia PDF](../visualizar_pdf.md).

## Semântica das ações e proteção

**Editar/Concluir** controla a liberação local do conteúdo. Concluir essa edição não salva o laudo nem muda seu status. **Salvar** persiste o rascunho pela página. **Restaurar dados da REP** recompõe conteúdo a partir da REP local e descarta as personalizações indicadas na confirmação. **Excluir** tem efeito específico por categoria.

| Conteúdo | Edição e personalização | Restauração | Exclusão pela superfície comum |
|---|---|---|---|
| Tabela resolvida da REP | Editar materializa uma tabela personalizada; Concluir volta a protegê-la | Disponível após personalização | Remove tabela e vínculo técnico correspondente |
| Tabela personalizada | Libera células elegíveis | Retorna aos dados da REP | Remove tabela e vínculo correspondente |
| Bloco condicional | Libera o texto sob a política comum | Não possui restauração vinculada à REP | Suprime com data-cond-suprimido; não equivale a remover todo o wrapper |
| Grupo descritivo B-601 | Liberação do grupo, preservando elementos protegidos | Recria pela REP vinculada, preservando complementos reconhecidos | Indisponível |
| Placeholder textual | Personalização da ocorrência pelo fluxo próprio | Restaurar valor da REP pelo fluxo próprio | Não recebe automaticamente a superfície de exclusão de blocos |
| Campo reservado XXX | Preenchimento pelo diálogo próprio | Segue o contrato do campo reservado | Não recebe automaticamente a superfície de exclusão de blocos |

Cabeçalhos de tabela, células fixas, controles e âncoras técnicas permanecem protegidos. Campos comuns exigem que todos os blocos protegidos ancestrais estejam em edição. A política admite preenchimentos reservados/personalizados e seleções pontuais reconhecidas sem liberar todo o bloco; isso não supera o modo somente leitura nem as travas de cabeçalhos e células fixas. Não reproduzir essas decisões em handlers independentes.

Restaurar e Excluir usam confirmação assíncrona com AlertDialog. Cancelar, desmontar a confirmação ou substituí-la resolve a operação como cancelada. A superfície serializa ações por instância e revalida presença, identidade, modo e conteúdo antes e depois da preparação assíncrona. Alvo obsoleto ou alterado interrompe a operação e gera feedback, sem escolher outro destino. Alterações de conteúdo são agrupadas no undo; a preparação visual usa undoManager.ignore.

As diferenças de restauração, supressão e persistência estão em [Editor](../editor_texto.md), [Condicionais](../bloco_condicional.md), [B-601](../b601.md), [Ciclo de placeholders](../../05%20placeholder/ciclo_placeholder.md) e [Campo reservado](../../05%20placeholder/campo_reservado_xxx.md).

## Apresentação, navegação e ferramentas

- Cabeçalho e rodapé compartilham ações e estado de salvamento. Os modos Dados da REP/Placeholders e Documento único/Por seções conservam suas responsabilidades; não são permissões para alterar conteúdo protegido.
- Usar wrappers locais de UI, Tailwind e a apresentação centralizada em globals.css. A superfície dentro do iframe usa as classes conteudo-laudo, cujas regras são copiadas do CSS global; não criar uma segunda identidade visual por exame. Estados distinguem origem, edição e ações indisponíveis, com motivos e nomes acessíveis. Temas e foco fazem parte do contrato.
- O trilho direito mantém um único dock integrado ativo. O documento usa a rolagem da página; docks reservam espaço real, mantêm cabeçalhos fora da rolagem interna e recolhem quando falta largura, preservando a montagem do editor. Limites e persistência ficam em [Componentes de UI](../../04%20layout/componentes_ui_base.md).
- Ferramentas auxiliares preservam a sessão do editor. A consulta de projéteis atual, disponível à família B, abre em modal, mantém a consulta em memória no mesmo laudo, devolve o foco ao acionador e bloqueia o atalho de salvar do laudo enquanto aberta. Isso é um exemplo específico, não uma regra de disponibilidade ou persistência para qualquer ferramenta futura.
- Inserções e aplicações de resultados usam o fluxo próprio, com alvo e seleção revalidados. Consultar uma ferramenta não implica aplicar seu resultado ao laudo. Mudanças de tema e abertura de painéis não devem remontar o editor; recargas externas legítimas têm chave de montagem própria.

Consulte [Ferramenta de projéteis](../../16%20ferramentas/identificacao_projeteis.md), [Assistente IA](../../06%20ia/painel_assistente_ia.md), [Ilustrações](../fluxo_ilustracao.md) e [Menu de contexto](../menu_contexto.md) para ciclos e exceções.

## Menus e seletores nas tabelas

O menu de contexto pode variar conforme o alvo reconhecido. Na página Laudos, campos compatíveis dos quadros descritivos B-601 usam o menu de preenchimento; demais locais e editores de templates/cabeçalhos conservam o menu de placeholders. Essa especialização não se aplica automaticamente a todas as tabelas ou exames. As opções e os atalhos ficam em [Menu de contexto](../menu_contexto.md), com elegibilidade em [B-601](../b601.md).

Menu e atalho compartilham a operação, revalidam os alvos e a política de edição e agrupam o preenchimento em uma transação de undo. A política mantém suas exceções para campos reservados e seleções pontuais; abrir o menu não concede permissão adicional. Os atalhos de preenchimento usam Ctrl + Shift + letra (P para Prejudicado, A para Ausente), preservando Ctrl + A para selecionar tudo e Ctrl + P para imprimir. O clique simples identifica a célula para o atalho sem exigir seleção de texto, com referência transitória por instância. O menu devolve o foco uma vez, ao fechar, usando foco sem rolagem automática; o atalho restaura o foco após aplicar. Preservar o alvo e a seleção ao atravessar iframe e interface externa.

Os seletores transitórios usam a apresentação compartilhada de globals.css, copiada para o iframe por seletores-tabela-laudo.ts. O acionador de texto livre, usado no calibre nominal provável, fica centralizado e limitado a min(100%, 10rem), sem ocupar obrigatoriamente toda a célula; a entrada sobreposta acompanha sua geometria. Controles e menus não integram o documento salvo ou exportado.

## Figuras de exemplo e quadros fotográficos

Novas figuras dummy usam o SVG de `src/shared/figura/html.ts` (`URL_FIGURA_DUMMY`): proporção 600 × 400, fundo cinza #3a3a3a, ícone de fotografia, “INSERIR IMAGEM” e “Clique para substituir”. Inserção no editor de laudos/templates, importações e fotografias automáticas B-601 reutilizam essa fonte. As cores são literais no SVG antes da codificação base64. A moldura individual e a legenda da figura permanecem independentes da tabela que a organiza.

Os modelos integrados ativos e novos quadros fotográficos automáticos B-601 usam formatação HTML nativa sem bordas: `border="0"` na tabela e `border:0` na tabela e em todas as células, incluindo cabeçalhos. Não há classe especial por exame. O usuário pode reproduzir a formatação pelo menu de propriedades de tabela do TinyMCE, definindo a largura da borda como zero; as propriedades de célula permitem ajustes pontuais. Copiar a tabela conserva a formatação, que permanece ao substituir as dummies por fotografias reais. Guias pontilhadas são auxílio visual do editor, não linhas do documento impresso.

O estilo compartilhado de impressão em `src/main/services/pdf-tabelas.ts`, consumido pela prévia e exportação, respeita `border="0"` também nas células sem estilo explícito. Estilos de borda definidos na própria célula continuam prevalecendo; tabelas de dados conservam suas bordas. A preparação do editor não converte figuras ou tabelas já salvas. Novas inserções recebem o padrão mesmo em documentos existentes; laudos, clones e templates personalizados não são migrados automaticamente. As versões integradas estão em [Templates integrados](../templates_integrados.md).

`src/__tests__/main/templates-figuras-padrao.test.ts` cobre o SVG, os modelos ativos, a preservação das versões-fonte e as bordas de impressão. A validação visual no Electron deve conferir também o menu nativo, cópia da tabela, substituição da figura e PDF.

## Integridade da sessão, salvamento e saída

- A prontidão aguarda preparação assíncrona, incluindo imagens e apresentação inicial, antes de estabelecer a referência comparável. Callbacks de sessões ou instâncias antigas não liberam a atual. No modo por seções, a montagem de uma seção não substitui a referência salva da sessão.
- A sincronização agrupa alterações por 400 ms e trata composição de texto. Salvar e trocar de modo leem o conteúdo atual pelo sincronizador, sem depender apenas do estado React ou do término do temporizador. Uma edição durante a gravação continua pendente quando não foi incluída nela.
- A preparação comum agrupa eventos em um requestAnimationFrame por editor: superfície na prioridade 0, seletores na prioridade padrão 10. A remoção cancela trabalho e listeners. Normalização visual não cria edição de usuário; alteração semântica real deve continuar detectável.
- Controles, classes de edição e contenteditable transitórios são limpos antes da serialização, comparação e saída; identidades, vínculos e personalizações persistíveis precisam sobreviver. Não usar normalização ampla para esconder diferenças de conteúdo.
- Salvamento aguarda reconciliação de imagens em curso; imagens em processamento bloqueiam salvar e trocar de modo. Saída usa o gerenciador comum de alterações pendentes. Abrir, buscar, consultar ou fechar recursos sem editar não estabelece nova referência nem deve criar falsa pendência.

Contratos completos em [Editor](../editor_texto.md), [Ciclo de vida](../laudo_ciclo_vida.md), [Falsa pendência](../../problemas%20diversos/aviso_salvar_sem_edicao.md), [Exportação](../exportar_laudo.md) e [Prévia PDF](../visualizar_pdf.md).

## Decisões para novos exames

1. Identificar se o recurso é conteúdo derivado da REP, personalização local, controle transitório ou ferramenta de consulta. Consultar o contrato existente antes de criar outra implementação.
2. Para conteúdo protegido atendido pela superfície comum, estender capacidades no adaptador e alinhar seleção/proteção na política; conservar confirmação, preparação e limpeza compartilhadas. Regras exclusivas do exame permanecem no domínio correspondente.
3. Conferir juntos os consumidores afetados: montagem, edição, undo/redo, comparação, salvamento/reabertura, busca, prévia e exportação. Novos atributos semânticos precisam sobreviver à limpeza; novos controles visuais precisam ser removidos pela limpeza.
4. Para ferramentas, definir o vínculo com a sessão, o alvo de eventual aplicação e os efeitos em foco e atalhos, seguindo os wrappers existentes. Reutilização não justifica expor recurso em exames incompatíveis.
5. Identificar e justificar exceções ao padrão. Sugerir a atualização desta referência ou da spec especializada pelo fluxo /spec, com aprovação do usuário. Padrões futuros só integram o estado atual depois de implementados.

## Evidências e limites de verificação

Os arquivos abaixo ficam em src/__tests__/renderer/; esta tabela identifica cobertura existente, não registra uma execução.

| Cenário | Testes existentes |
|---|---|
| Proteções, liberação, cancelamento, concorrência e supressão | conteudo-protegido.test.ts e conteudo-interativo.test.ts |
| Preparação agrupada e sessões independentes | preparacao-conteudo-editor.test.ts |
| Abertura sem editar, edição real e preparação tardia | inicializacao-saida-laudo.component.test.tsx e conteudo-comparavel-laudo.test.ts |
| Sincronização, undo/redo e leitura antes do temporizador | sincronizacao-editor-laudo.test.ts |
| Organização, docks e montagem estável | layout-editor-laudo.component.test.tsx e painel-lateral-redimensionavel.component.test.tsx |
| Consulta auxiliar, foco, atalho e identidade do editor | projeteis-laudo.component.test.tsx |

O DOM simulado não comprova seleção, aparência, foco entre iframe/janela ou histórico real do TinyMCE no Electron. Mudanças nesses contratos exigem smoke proporcional: abrir e sair sem editar; editar, desfazer/refazer, salvar e reabrir; alternar organização; abrir/fechar ferramentas; conferir temas e saída sem controles transitórios.

Quando o layout do documento mudar, conferir também prévia e PDF exportado com as mesmas margens e conteúdo: textos longos, tabela que atravesse uma página, cabeçalhos repetidos e figuras novas/substituídas conforme o recurso afetado. Verificar preservação das bordas escolhidas, legendas e numeração, além da independência da impressão em relação ao tema claro/escuro. Usar os três modelos integrados como amostras quando a mudança atingir o padrão comum; diferenças de capacidade permanecem regidas pelas specs de cada exame. Resultados de uma execução pertencem ao relatório da tarefa, não a esta documentação de estado atual.
