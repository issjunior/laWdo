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

Durante a digitação, o DOM do editor contém o conteúdo mais recente; o estado React recebe a sincronização agrupada. Conteúdo persistido e estado visual de liberação são distintos. A gravação segue os contratos locais de laudo e imagens descritos nas specs especializadas.

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
