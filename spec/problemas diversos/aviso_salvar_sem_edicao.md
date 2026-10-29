# Aviso de salvamento sem edição no laudo

## Sintoma e causa

Abrir um laudo existente e sair sem editar não deve apresentar **Salvar alterações do laudo?**. O HTML canônico salvo é diferente do HTML de apresentação do editor: este inclui prévias, controles e estilos temporários.

A captura de regressão em dois laudos também identificou mudanças tardias em `src` e `contenteditable` e comparação periódica contra estado anterior à preparação. Desativar `automatic_uploads` não impede a varredura assíncrona de imagens do TinyMCE.

O falso aviso ocorre quando a referência de comparação é estabelecida antes de concluir a preparação ou quando a limpeza conserva apresentação transitória. A captura diagnóstica confirmou mudanças automáticas no estilo de quatro âncoras de placeholders HTML e no atributo `src` de imagens em tabelas depois da referência inicial. As badges de seção não apareceram entre as diferenças capturadas.

## Preparação e referência da sessão

Em `src/renderer/pages/LaudosPage.tsx`, a sessão começa aguardando inicialização. O callback `onEditorInit` usa `prepararInicializacaoEditorLaudo`, que aguarda `editor.uploadImages()`, verifica sessão e instância, aplica os placeholders e confere a numeração das tabelas. Só então lê o conteúdo e chama `concluirInicializacao` para estabelecer a referência comparável do editor único.

O processamento de imagens é local: o handler de `src/renderer/components/editor/TinyMceEditor.tsx` usa FileReader para retornar data URI; não envia imagens ao GDL. O componente aceita `onEditorInit: void | Promise<void>` e aguarda sua conclusão antes de liberar a edição e marcar o iframe com `data-diagnostico-pronto`. As notificações internas e a conferência inicial das tabelas usam `normalizacao-inicial` enquanto a preparação não termina. A barra de troca de modos fica bloqueada durante a inicialização da sessão.

Falhas de imagens ou placeholders mantêm o editor indisponível, registram erro e oferecem nova tentativa. O watchdog continua ativo. Instâncias removidas, desmontadas ou substituídas não são liberadas por conclusões antigas; a página também verifica a sessão.

Os editores por seção aguardam sua preparação sem substituir a referência salva da sessão. Alternar modos não pode absorver edições como se estivessem salvas. `src/renderer/hooks/useGerenciadorAlteracoesLaudo.ts` mantém a referência por sessão e protege salvamentos concorrentes.

A comparação periódica fica suspensa durante a inicialização e lê o conteúdo atual pelo sincronizador do editor, evitando closures com HTML anterior à referência. O agrupamento de eventos de digitação permanece ativo. A troca de modos não estabelece nova referência salva.

## Limpeza do HTML de apresentação

`removerFormatacaoPlaceholders`, em `src/renderer/lib/utils.ts`, remove prévias e controles antes de salvar ou comparar:

- Âncoras com `data-placeholder-preview-id`, sem vínculo personalizado, perdem o `display` usado para escondê-las durante a prévia; os demais estilos permanecem.
- Âncoras vinculadas por `data-placeholder-tabela-personalizada-id` permanecem ocultas no HTML canônico.
- Tabelas personalizadas preservam o conteúdo editado e perdem o `display: none` usado apenas no modo de chaves.

A limpeza interativa reconhece `.cond-bloco[data-cond-bloco]`, tabelas personalizadas e grupos `data-b601-grupo` por identidade estável, mesmo sem classes transitórias. Remove `contenteditable` desses blocos e seus descendentes e dos placeholders; preserva travas de elementos comuns. A limpeza deve ser idempotente.

`src/renderer/lib/conteudo-comparavel-laudo.ts` normaliza apresentação, atributos internos e espaços estruturais. Não ignorar genericamente `style`, `src`, texto ou conteúdo das tabelas: mudanças nesses dados podem ser edições reais. O diálogo de saída continua protegendo diferenças persistentes.

## Diagnóstico e verificação

Usar `npm run dev:diagnostico` e o fluxo `diagnostico_status → iniciar_captura(finalidade=problema) → reproduzir → finalizar_captura`. Nos eventos `editor_laudo`, observar `inicializacao_concluida`, `conteudo_comparado` e `sessao_encerrada`. Diferenças após a referência, sem edição, indicam preparação tardia ou limpeza incompleta. `origem: usuario` isoladamente não prova edição: callbacks também podem decorrer de processamento automático.

A captura de validação confirmou saída sem edição sem modal, aviso para edição real e saída após desfazer. As sessões sem edição terminaram sem pendências. Repetir essa verificação no Electron após mudanças; passar testes simulados não comprova a correção no aplicativo real. Não persistir HTML pessoal em fixtures. Os testes simulados não substituem a verificação do iframe real com imagens.

Testes em `src/__tests__/renderer/`:

- `inicializacao-saida-laudo.component.test.tsx`: preparação de imagem atrasada integrada à referência de sessão, saída, alteração real, desfazer, salvamento concorrente, falha e conclusão obsoleta.

- `tiny-mce-editor-inicializacao.component.test.tsx`: preparação assíncrona, falha e instâncias encerradas.
- `conteudo-comparavel-laudo.test.ts` e `apresentacao-placeholders.test.ts`: prévias, reaplicação, chaves, personalizações e alterações reais.
- `layout-editor-laudo.component.test.tsx` e `alteracoes-pendentes-saida.component.test.tsx`: referência por sessão, bloqueio inicial, salvamento concorrente e saída.

Ao alterar esse fluxo, conferir saída sem edição, edição real, desfazer, alternância de modos e salvar seguido de nova edição.

Referências: [editor de texto](<../03 laudo/editor_texto.md>), [ciclo de vida](<../03 laudo/laudo_ciclo_vida.md>) e [diagnóstico assistido](<../13 diagnostico/diagnostico_assistido.md>).
