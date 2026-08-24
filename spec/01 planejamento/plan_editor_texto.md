# Plano — Editor de texto (TinyMCE)

## Objetivo

Reorganizar a toolbar compartilhada do TinyMCE para priorizar a redação de laudos, adicionar recuo da primeira linha e disponibilizar quebra manual de página com exportação coerente para PDF, DOCX e ODT.

## Decisões consolidadas

- Usar a mesma toolbar-base em todos os usos do `TinyMceEditor`; botões condicionais continuam aparecendo somente quando o contexto fornece seus dados.
- Manter `toolbar_mode: 'wrap'`, com grupos ordenados para duas linhas em larguras usuais e adaptação natural em áreas estreitas.
- Oferecer recuo da primeira linha em menu próprio: sem recuo, 1 cm (`28.35pt`), 1,25 cm (`35.43pt`) e 1,5 cm (`42.52pt`).
- Aplicar o recuo somente a parágrafos atuais ou selecionados, sem afetar títulos, listas, células, legendas ou blocos estruturais.
- Incluir quebra manual de página ponta a ponta, inclusive PDF, DOCX e ODT.
- Preservar o tema controlado pelo Header, sem remount do editor e sem toggle de tema local.
- Permanecer na edição Community/GPL: `tinymce` 8.8.2 e `@tinymce/tinymce-react` 6.3.0 já são as versões estáveis mais recentes verificadas em 24/08/2026.

## Toolbar proposta

### Controles prioritários

- Histórico e estrutura: `undo`, `redo`, `blocks`.
- Texto: negrito, itálico e sublinhado.
- Parágrafo: alinhamento agrupado, listas, recuo de bloco/lista, recuo da primeira linha e entrelinha.
- Formatação complementar: família, tamanho, cores e limpar formatação.
- Inserção e produtividade: buscar/substituir, link, imagem, tabela, caracteres especiais, espaço não separável, quebra de página e tela cheia.
- Contextuais existentes: `condbloco` e `suprimirblocopericial`.

### Menu “Mais ferramentas”

- Texto avançado: tachado, subscrito, sobrescrito, citação e linha horizontal.
- Revisão e inspeção: colar sem formatação, blocos visuais, caracteres invisíveis, contagem de palavras e código HTML.
- Visualização e ajuda: preview e ajuda do TinyMCE.

### Simplificações

- Substituir os quatro botões de alinhamento pelo menu nativo `align`.
- Substituir `styles` por `blocks`, pois não há catálogo próprio de estilos.
- Remover plugins sem acesso na interface ou sem utilidade para o laudo: `emoticons`, `media`, `codesample`, `anchor` e `insertdatetime`.
- Remover `paste` da configuração: ele não existe na distribuição TinyMCE 8 instalada; os comportamentos atuais de colagem permanecem nativos.

## Implementação

- [ ] Extrair catálogo estático de plugins, toolbar, medidas e formatos para configuração reutilizável e testável.
- [ ] Criar o menu TinyMCE “1ª linha”, com estado sincronizado pela seleção e uma única transação de undo por alteração.
- [ ] Registrar formatos de parágrafo com `text-indent` em pontos; “sem recuo” deve remover a propriedade em vez de gravar `0pt`.
- [ ] Criar o menu “Mais ferramentas” com o ícone padrão `more-drawer` e submenus nativos.
- [ ] Configurar `pagebreak` com separador canônico `<div data-quebra-pagina="true" style="break-after: page;"></div>` e `pagebreak_split_block: true`.
- [ ] Centralizar o marcador de quebra de página e a normalização do legado `<!-- pagebreak -->` em utilitário puro compartilhado.
- [ ] Adicionar `QuebraPaginaExportacao` ao contrato canônico de exportação e à validação de entrada.
- [ ] Converter a quebra para CSS no PDF/previews e para `PageBreak` real no DOCX; ODT herdará a conversão canônica do DOCX.
- [ ] Garantir contraste do marcador de quebra em tema claro e escuro, mantendo o observador atual de `body.dark`.
- [ ] Preservar as interações de cursor, modo controlado/não controlado, undo, placeholders, imagens, menu de contexto e blocos condicionais.

## Verificação

- [ ] Testar catálogo de plugins, grupos visíveis e itens do menu “Mais ferramentas”.
- [ ] Testar as quatro medidas de recuo, seleção múltipla, estado ativo, remoção do recuo e undo.
- [ ] Confirmar que elementos não-parágrafo não recebem recuo da primeira linha.
- [ ] Testar o parser com `text-indent`, marcador canônico e comentário legado, mantendo a ordem dos blocos.
- [ ] Inspecionar o XML do DOCX para `w:firstLine` e `w:br w:type="page"`.
- [ ] Testar o HTML de PDF e preview para a quebra CSS.
- [ ] Fazer smoke manual em laudo único, seções, templates, importação, cabeçalhos, tema claro/escuro e blocos condicionais.
- [ ] Executar `npm run type-check`, `npm run lint`, `npm test`, `npm run test:coverage` e `npm run build`.

## Documentação após a implementação

- [ ] Criar `spec/03 laudo/editor_texto.md` para o comportamento atual do editor compartilhado.
- [ ] Atualizar `spec/03 laudo/exportar_laudo.md` com recuo e quebra de página.
- [ ] Registrar a nova spec no manifesto e validar a consistência com a documentação atual do tema escuro.
- [ ] Executar o fluxo `/spec` somente após o código estar implementado e validado.
