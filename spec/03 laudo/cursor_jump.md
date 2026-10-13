# Estabilidade do cursor no editor de laudos

## Fontes de verdade e identidade

`TinyMceEditor.tsx` concentra a montagem do editor; `LaudosPage.tsx` compõe editor único e editores por seção. `PlaceholderContextMenu` é importado de `src/renderer/components/editor/PlaceholderContextMenu.tsx`, com identidade estável entre renders. Definir esse componente dentro da página criaria um novo tipo React a cada render, desmontando o TinyMCE e perdendo seleção e estado interno.

## Conteúdo inicial e alterações programáticas

O TinyMCE normaliza HTML de seções, atributos e estilos. Realimentar continuamente esse HTML pela prop controlada `value` pode provocar `setContent()` durante a digitação e reposicionar o cursor. Nos laudos, ambos os modos usam `initialValue`; o componente captura `stableInitialValue` com `useState` na montagem e não encaminha `value` nesse modo.

Alterar o estado React não substitui automaticamente o DOM do editor montado. Uma atualização externa do laudo usa `handleEditar()` para recarregar o banco e incrementar a versão da chave de montagem. Escritas programáticas durante a sessão devem usar a instância do editor e o fluxo específico da operação. Aplicações de IA revalidam o alvo e agrupam a escrita no undo manager; não dependem da sincronização de uma prop controlada.

`EditorCampoLaudo.tsx` segue a mesma regra: o valor inicial do modal fica estável enquanto se digita, e o rascunho atual é mantido separadamente. Não remontar o modal nem atualizar seu `initialValue` a cada tecla.

## Salvamento, restauração e concorrência

`handleSalvar()` inicia o salvamento pela sessão de `useGerenciadorAlteracoesLaudo.ts`, reconcilia imagens e lê o conteúdo atual dos editores, com fallback para seções desmontadas. Após remover ilustrações realmente vazias e montar o HTML canônico, envia `laudo.updateConteudo`. Respostas de sessão encerrada não alteram a sessão atual.

O HTML enviado torna-se a referência salva. A página compara o conteúdo atual com essa referência antes de restaurar a visualização. Sem edição concorrente, recompõe os editores montados e chama `restaurarVisualizacaoAposSalvar()` de `apresentacao-placeholders.ts`: o helper executa `setContent()` e reaplica o modo de apresentação de placeholders. Se o usuário editou durante o IPC, a página preserva o DOM novo, não reaplica o HTML enviado e mantém a diferença pendente. **Salvar e sair** só prossegue quando não restar pendência.

A referência inicial é estabelecida após a normalização de prontidão do editor, em `init_instance_callback`; eventos anteriores não contam como digitação do usuário. Mudanças nessa ordem podem produzir falsa pendência ou restaurar conteúdo antigo. O contrato completo de sessão e saída está em `spec/03 laudo/laudo_ciclo_vida.md`; a prontidão está em `spec/03 laudo/editor_texto.md`.

## Invariantes e verificação

- Manter a identidade dos componentes que envolvem o TinyMCE e as chaves de montagem estáveis durante a digitação.
- Usar `initialValue` para HTML estruturado; reservar a troca de instância para recarga deliberada.
- Não substituir o DOM por uma resposta antiga nem reaplicar conteúdo salvo sobre edição concorrente.
- Manter apresentação transitória fora da comparação canônica e do HTML persistido.

`tiny-mce-editor-config.test.ts` cobre configuração e chave de montagem; `tiny-mce-editor-inicializacao.component.test.tsx` cobre prontidão; `conteudo-comparavel-laudo.test.ts` e `layout-editor-laudo.component.test.tsx` cobrem comparação e salvamento concorrente; `editor-campo-laudo.component.test.tsx` cobre estabilidade do valor inicial do modal. Seleção e cursor no iframe Electron real exigem verificação visual.
