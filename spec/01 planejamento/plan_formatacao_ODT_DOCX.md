# Plano — fidelidade de formatação nas exportações ODT e DOCX

## 1. Objetivo e critério de fidelidade

Corrigir as exportações DOCX e ODT para preservar todos os recursos de formatação editáveis oferecidos pelo TinyMCE do laWdo.

A aceitação será:

- DOCX validado no Microsoft Word para Windows;
- ODT validado no LibreOffice Writer para Windows;
- conteúdo permanece editável;
- pequenas diferenças inevitáveis de paginação, quebra de linha e substituição de fonte ausente são aceitáveis;
- PDF permanece inalterado e continua sendo a referência visual produzida pelo Chromium.

Devem ser preservados:

- fonte, tamanho, cor, realce e espaçamento entre linhas;
- negrito, itálico, sublinhado, tachado, subscrito e sobrescrito;
- alinhamento, recuo e espaçamento de parágrafos;
- títulos e níveis hierárquicos;
- listas numeradas e com marcadores, inclusive níveis aninhados;
- links, caracteres especiais e espaços não separáveis;
- citações, blocos pré-formatados e linhas horizontais;
- tabelas, bordas, larguras, alinhamentos, cores e células mescladas;
- imagens, proporção, dimensão, alinhamento, sequência e legendas;
- margens e cabeçalho da primeira página.

Elementos exclusivamente visuais da interface, como indicadores de placeholder, botões, destaques do modo escuro e controles de blocos condicionais, não devem ser exportados.

## 2. Modelo canônico e fluxo de exportação

- Substituir a estrutura simplificada atual por um modelo canônico tipado e compartilhado entre renderer, preload e main.
- O renderer deve converter o HTML já resolvido do TinyMCE em blocos e trechos formatados, sem depender de `getComputedStyle` sobre documento desconectado.
- Centralizar os estilos documentais padrão do editor para que TinyMCE, DOCX e ODT usem a mesma fonte, tamanho, espaçamento e regras de figuras.
- Representar explicitamente:
  - estilos de texto;
  - propriedades de parágrafo;
  - títulos;
  - listas e níveis;
  - tabelas, linhas e células;
  - figuras e dimensões;
  - cabeçalho, margens e metadados do documento.
- Validar o payload IPC como `unknown` antes de gerar arquivos. Estruturas inválidas devem interromper a exportação com mensagem clara, sem gerar documento parcial.
- Manter o PDF usando o HTML resolvido atual.

Fluxo final:

```text
HTML resolvido do TinyMCE
          ↓
Modelo canônico de documento
       ↙           ↘
DOCX nativo       PDF pelo Chromium
       ↓
Conversão DOCX → ODT pelo LibreOffice
```

O ODT deve ser derivado do mesmo DOCX canônico, em vez de converter diretamente o HTML. Isso reduz divergências entre Word e LibreOffice.

## 3. Geração dos arquivos

### DOCX

- Mapear os estilos inline para `TextRun`, `ExternalHyperlink` e propriedades nativas de parágrafo.
- Criar configurações próprias para listas numeradas e marcadores, preservando níveis e reinícios.
- Gerar tabelas nativas com largura útil da página, bordas, preenchimento, alinhamento, `colspan` e `rowspan`.
- Preservar a proporção das imagens; limitar somente quando ultrapassarem a área útil da página.
- Não usar dimensões fixas como `450 × 300`.
- Gerar legendas como parágrafos vinculados à figura, evitando separação indevida entre páginas.
- Mapear `<hr>` como linha horizontal, não como parágrafo vazio ou quebra de página.
- Configurar cabeçalho da primeira página, margens, estilos de títulos e fonte padrão no documento.

### ODT

- Gerar primeiro o DOCX canônico em memória.
- Converter esse buffer para ODT com `convertWithOptions`, informando nome de origem `.docx`, perfil isolado e caminhos conhecidos do LibreOffice.
- Não criar HTML intermediário nem arquivos temporários de imagens mantidos pelo laWdo.
- Preservar o tratamento atual de indisponibilidade do LibreOffice.
- Se a conversão falhar, não produzir arquivo incompleto e apresentar a mensagem de erro ao usuário.

### Compatibilidade

- Manter os formatos e ações atuais da interface.
- Alterar apenas o contrato interno de `laudo:exportar`.
- PDF, salvamento do laudo, placeholders e imagens persistidas não devem sofrer mudanças.
- Conteúdos antigos devem ser exportáveis, pois a conversão parte do HTML armazenado e não exige migração de banco.

## 4. Testes e validação

Criar uma fixture de formatação contendo todos os recursos do editor em combinações representativas.

Testes automatizados:

- parser preserva todos os estilos inline e propriedades de bloco;
- estilos aninhados geram trechos separados sem perder texto;
- entidades HTML, caracteres especiais e espaços não separáveis permanecem corretos;
- listas aninhadas mantêm nível, marcador e numeração;
- tabelas preservam conteúdo formatado, dimensões, bordas e células mescladas;
- imagens mantêm proporção e respeitam a largura útil da página;
- cabeçalho e margens são aplicados;
- elementos exclusivos da interface são removidos;
- payload IPC inválido é rejeitado;
- DOCX contém os elementos e propriedades esperados no OOXML;
- ODT contém conteúdo e estilos equivalentes em `content.xml` e `styles.xml`;
- ODT usa o DOCX canônico como origem;
- falha do LibreOffice não deixa arquivo parcial;
- PDF permanece no fluxo atual.

Validação manual no Windows:

1. Criar um laudo com a fixture completa de formatação.
2. Exportar PDF, DOCX e ODT.
3. Comparar conteúdo e formatação lado a lado.
4. Abrir DOCX no Microsoft Word e ODT no LibreOffice Writer.
5. Editar e salvar ambos para confirmar que o conteúdo continua nativo e editável.
6. Confirmar figuras, legendas, tabelas e listas em páginas diferentes.
7. Repetir com uma fonte indisponível para confirmar fallback previsível.
8. Executar `type-check`, `lint`, testes, cobertura, build e empacotamento.

## 5. Premissas e limites

- “Exatamente” significa equivalência semântica e visual dos recursos editáveis do laWdo, não igualdade pixel a pixel.
- Paginação pode variar conforme aplicativo, impressora padrão, métricas de fonte e versão instalada.
- Fontes não serão incorporadas aos arquivos; o computador de destino precisa possuir a fonte escolhida ou usará uma substituta.
- Recursos HTML sem equivalente confiável no Word/ODT devem usar aproximação documentada, sem rasterizar texto.
- Microsoft Word e LibreOffice Writer no Windows são as aplicações oficiais de aceitação.
