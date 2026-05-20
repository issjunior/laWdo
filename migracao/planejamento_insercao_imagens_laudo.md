# Inserção de Imagens e Seção de Ilustrações com Legendas Automáticas (Design Premium)

Este plano descreve a implementação completa da inserção manual de imagens no editor e o gerenciamento da seção "ILUSTRAÇÕES" com drag-and-drop. O plano foi otimizado para lidar com grandes volumes de imagens, garantir segurança, embutir imagens e reduzir o tamanho do PDF final, oferecendo uma experiência de usuário (UX/UI) profissional.

---

## Proposed Technical Solutions & UX Design

### 1. Inserção Manual & Sistema de Legendas Automáticas
- **Inserção via TinyMCE**: Um botão personalizado na barra de ferramentas permitirá carregar imagens no cursor. Ao inserir, a imagem será estruturada como:
  ```html
  <figure class="laudo-figure" data-image-id="${imageId}" style="text-align: center; margin: 12px auto; max-width: 100%;">
    <img src="${url}" alt="${legenda}" style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px; padding: 4px;" />
    <figcaption style="font-size: 13px; color: #666; font-weight: bold; margin-top: 4px;">Figura XX: ${legenda}</figcaption>
  </figure>
  ```
- **Reindexação Física Sequencial**: Uma rotina varrerá o HTML (de cima para baixo) renomeando as figuras (`Figura 01`, `Figura 02`...).
- **Organização Manual da Numeração**: O usuário poderá organizar a ordem das figuras através de reordenação no painel (Drag & Drop) e também editar o texto da legenda diretamente no editor ou via campo de texto, dando total flexibilidade se desejar sobrescrever o formato padrão.

### 2. Otimização do PDF & Imagens Embutidas
- **Imagens Embutidas**: No backend, o handler de geração de PDF (`template:previewPDF`) interceptará todas as URLs `laudo-img://` e as converterá em strings inline base64 (`data:image/jpeg;base64,...`). Isso resolve os problemas de permissão de origem e garante que as imagens fiquem 100% incorporadas no arquivo PDF final.
- **Redimensionamento Automático no PDF**: Durante a conversão para base64 para o PDF, usaremos a API `nativeImage` do Electron para redimensionar imagens grandes para uma largura máxima de 1000px e comprimi-las em JPEG a 75% de qualidade. Isso reduz drasticamente o tamanho do PDF resultante sem degradar a qualidade de impressão visual.

### 3. Otimização de Escala no Editor (50+ Imagens)
- **Indexador em Memória**: Em vez de fazer o parse do HTML completo a cada alteração, manteremos um índice leve em memória (`Map<imageId, {url, caption}>`) no estado do componente `LaudosPage`, atualizado através dos hooks `onNodeChange` e `onChange` do TinyMCE.
- **Processamento Assíncrono**: A reindexação de figuras será executada de forma assíncrona usando `requestIdleCallback` para que a digitação nunca trave.

### 4. Painel Lateral de Ilustrações (UX Premium)
- **Animações Fluidas**: A grade de miniaturas no painel utilizará `framer-motion` (`AnimatePresence` e `<motion.div layout>`) para garantir transições suaves.
- **Draggable com `@dnd-kit`**: Reordenação de imagens por drag-and-drop.
- **Ordenação Inteligente**: Controles para ordenar a grade rapidamente:
  - Ordenação manual (Drag & Drop)
  - Alfabética (por nome do arquivo)
  - Por data de inserção
- **Edição Inline de Legendas**: Campo de texto inline com salvamento automático (debounce de 400ms ao digitar, ou ao desfocar do campo).
- **Lightbox com `yet-another-react-lightbox`**: Integração da biblioteca `yet-another-react-lightbox` com o plugin de Zoom. Isso fornecerá gestos de pinça, arrasto e navegação extremamente ergonômicos e fluidos.

### 5. Tratamento de Erros e Concorrência no Upload
- **Mensagens de Erro Detalhadas**: Validação rigorosa de uploads no frontend e backend. Se o upload falhar, exibir um toast indicando o nome do arquivo e a causa exata da falha:
  - Formato não suportado (apenas JPG, JPEG, PNG, GIF, BMP, WEBP são aceitos).
  - Arquivo original não encontrado ou ilegível (caminho inválido).
  - Erro de permissão de gravação no disco.
- **Fila de Upload Concorrente**: Classe simples de fila assíncrona com limite de 3 uploads paralelos simultâneos para evitar gargalos em lotes de 50+ imagens.

### 6. Segurança e Protocolo `laudo-img://`
- **Validação de Path Traversal**: Proteção no `protocol.handle('laudo-img')` no `src/main/index.ts` usando `path.relative` para assegurar que apenas arquivos dentro de `userData/imagens/<laudoId>/` sejam servidos.

### 7. Ordem de Precedência da Seção "ILUSTRAÇÕES"
- Se a seção não existir ao sincronizar, ela será criada automaticamente:
  1. Imediatamente antes de `"CONSIDERAÇÕES FINAIS"` (se existir).
  2. Senão, imediatamente antes de `"CONCLUSÃO"` (se existir).
  3. Senão, ao final do laudo.

---

## Proposed Changes

### Dependências
- Instalar `yet-another-react-lightbox`.

### Backend

#### [MODIFY] [index.ts](file:///c:/Users/Jr/Documents/Codigos/LaudoPericial/src/main/index.ts)
- Adicionar validação de segurança contra Path Traversal no protocolo `laudo-img://`.

#### [MODIFY] [template.handlers.ts](file:///c:/Users/Jr/Documents/Codigos/LaudoPericial/src/main/ipc/handlers/template.handlers.ts)
- Atualizar `template:previewPDF` para:
  1. Interceptar tags de imagem com o protocolo `laudo-img://`.
  2. Ler a imagem correspondente, redimensioná-la em memória usando a API `nativeImage` do Electron (largura máxima: 1000px, qualidade JPEG a 75%).
  3. Substituir o `src` pelo data URI em base64 correspondente antes de renderizar e gerar o PDF.

#### [MODIFY] [imagem.handlers.ts](file:///c:/Users/Jr/Documents/Codigos/LaudoPericial/src/main/ipc/handlers/imagem.handlers.ts)
- Criar/atualizar handlers:
  - `imagem:pickAndUpload`: Retorna erros amigáveis de validação física e formato. Gera miniaturas otimizadas em tempo real usando `nativeImage`.
  - `imagem:deletarArquivo`: Exclui fisicamente o arquivo e miniatura do disco.
  - `imagem:iniciarGC`: Varre e remove arquivos na pasta do laudo que não estão referenciados no HTML.

#### [MODIFY] [laudo.service.ts](file:///c:/Users/Jr/Documents/Codigos/LaudoPericial/src/main/services/laudo.service.ts)
- Ajustar remoção do laudo para deletar recursivamente a pasta física de imagens em `userData`.

### Frontend

#### [NEW] [figuras.ts](file:///c:/Users/Jr/Documents/Codigos/LaudoPericial/src/renderer/utils/figuras.ts)
- Funções utilitárias assíncronas para reindexar e renumerar figuras no HTML.

#### [NEW] [uploadQueue.ts](file:///c:/Users/Jr/Documents/Codigos/LaudoPericial/src/renderer/utils/uploadQueue.ts)
- Fila assíncrona concorrente (limite = 3) para controlar o progresso e tratamento individual de falhas no upload em lote.

#### [NEW] [IlustracoesPanel.tsx](file:///c:/Users/Jr/Documents/Codigos/LaudoPericial/src/renderer/components/laudo/IlustracoesPanel.tsx)
- Painel lateral com drag-and-drop (`@dnd-kit`), animações do `framer-motion`, ordenações, inputs com debounce e integração com o Lightbox do `yet-another-react-lightbox`.

#### [MODIFY] [LaudosPage.tsx](file:///c:/Users/Jr/Documents/Codigos/LaudoPericial/src/renderer/pages/LaudosPage.tsx)
- Integrar painel e implementar a criação ordenada de `"ILUSTRAÇÕES"` antes de `"CONSIDERAÇÕES FINAIS"` ou `"CONCLUSÃO"`.

---

## Verification Plan

### Automated & Manual Tests
1. **Redimensionamento e Compactação do PDF**:
   - Adicionar 10 imagens de câmera de alta resolução (ex: 4000x3000px, ~5MB cada).
   - Gerar o PDF e validar se o arquivo final é reduzido para alguns megabytes e se as imagens aparecem nítidas e totalmente embutidas.
2. **Tratamento de Falha de Upload**:
   - Tentar selecionar um arquivo corrupto ou de extensão inválida (ex: `.zip`). Validar que um toast é disparado explicitando o nome do arquivo e informando que o formato não é aceito.
3. **Lightbox com Zoom**:
   - Clicar na miniatura e realizar gestos de zoom/pinça/arrasto e navegação horizontal entre as imagens usando a galeria.
4. **Posicionamento da Seção**:
   - Validar a precedência de criação automática da seção `"ILUSTRAÇÕES"`.
