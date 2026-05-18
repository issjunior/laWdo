# Importação de Templates de Laudos (PDF/DOCX → Template)

> Criado em: 2026-05-18  
> Status: **Aguardando execução**

Implementar um fluxo completo de importação de documentos (PDF e DOCX) diretamente na `TemplatesPage`, convertendo-os em templates estruturados com seções editáveis via TinyMCE.

---

## Decisões de Design

> **Processamento no Main Process (Electron):** PDF e DOCX serão processados no processo principal via IPC, não no renderer. Isso evita problemas de CORS/CSP com pdfjs-dist em Electron, acessa o filesystem nativamente e mantém o renderer leve.

> **Biblioteca escolhida para PDF:** `unpdf` (Moderna, suportada, funciona bem em Node.js sem as complexidades do pdfjs-dist puro). Para DOCX: `mammoth` (gera HTML estruturado com formatação). Ambas rodam no main process sem necessidade de Web Workers.

> **Sanitização e Placeholders:** O fluxo deve ser: 1. Extrair texto/HTML -> 2. Detectar placeholders `{{...}}` -> 3. Sanitizar com `sanitize-html` no main process -> 4. Preservar placeholders no HTML final (evita que chaves `{` e `}` sejam escapadas).

---

## Fluxo de Importação

```
Usuário clica "Importar" → Diálogo de arquivo → IPC → Main Process
→ Detecta tipo (PDF/DOCX) → Extrai texto/HTML → Detecta seções
→ Retorna { nomeArquivo, secoes[] } → Renderer exibe ImportDialog
→ Usuário revisa/edita seções com TinyMCE → Salva como template
```

---

## Arquivos Envolvidos

### Novos

| Arquivo | Responsabilidade |
|---|---|
| `src/main/services/importacao.service.ts` | Extração PDF/DOCX + detecção de seções + sanitização |
| `src/main/ipc/handlers/importacao.handlers.ts` | Handler IPC: diálogo de arquivo, validação MIME/tamanho, orquestra serviço |
| `src/renderer/components/template/ImportTemplateDialog.tsx` | Modal 2 etapas: upload → revisão de seções com TinyMCE |

### Modificados

| Arquivo | O que muda |
|---|---|
| `package.json` | Adicionar `unpdf`, `mammoth`, `sanitize-html`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` + @types |
| `src/main/ipc/index.ts` | Registrar `registerImportacaoHandlers()` |
| `src/preload/index.ts` | Expor `template.importarArquivo` na IpcAPI + ALLOWED_CHANNELS |
| `src/renderer/pages/TemplatesPage.tsx` | Botão "Importar Documento" + estado `showImportDialog` |

---

## Dependências a Instalar

```bash
npm install unpdf mammoth sanitize-html @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install -D @types/mammoth @types/sanitize-html
```

---

## IPC: Novo Canal

```
template:importarArquivo
  → Abre dialog de seleção de arquivo (filtro: .pdf, .docx)
  → Valida extensão e tamanho (≤ 20 MB)
  → Chama importacaoService.importar(filePath)
  → Retorna: { success, data: { nomeArquivo, secoes[] } }

Retorno de secoes[]:
  {
    nome: string,       // título detectado
    conteudo: string,   // HTML sanitizado
    incluir: boolean,   // sempre true por padrão
  }
```

---

## Componente: ImportTemplateDialog

### Etapa 1 — Seleção de Arquivo
- Botão "Selecionar Arquivo (PDF ou DOCX)"
- Chama `window.ipcAPI.template.importarArquivo()`
- Exibe spinner durante processamento
- Exibe erro se falhar

### Etapa 2 — Revisão de Seções
- Campo **Nome do Template** — pré-preenchido com nome do arquivo (sem extensão), editável
- Dropdown **Tipo de Exame** — obrigatório
- Lista de seções detectadas (com Drag-and-Drop usando `@dnd-kit/sortable` para reordenação suave):
  - `Checkbox` — "Incluir no template?"
  - `Input` — nome da seção (editável inline)
  - `TinyMceEditor` (height=200) — conteúdo editável
  - Botões reordenar (ícone drag) e × (remover)
- Botão **"Salvar como novo template"** → usa IPC existente `template:create` + `template:createSecao`
- Ao salvar: fecha dialog + recarrega lista de templates

---

## Algoritmo de Detecção de Seções

### Palavras-Chave Periciais (usadas em PDF e DOCX)

```
PREÂMBULO, HISTÓRICO, DO HISTÓRICO, INTRODUÇÃO, METODOLOGIA,
DO EXAME, EXAME, ANÁLISE, CONCLUSÃO, RESULTADO, CONSIDERAÇÕES,
OBJETO, OBJETIVO, DO OBJETIVO PERICIAL, QUESITOS,
RESPOSTA AOS QUESITOS, ENCERRAMENTO, CONSIDERAÇÕES FINAIS,
MOTIVO DA PERÍCIA, MATERIAL APRESENTADO A EXAME,
DO VEÍCULO, ISOLAMENTO E PRESERVAÇÃO DO LOCAL,
DAS INFORMAÇÕES, DO LOCAL, DO CADÁVER, DOS VESTÍGIOS,
DISCUSSÃO, DINÂMICA DO EVENTO, ILUSTRAÇÕES
```

### Para PDF (texto plano via `unpdf`)

```
1. Extrair texto bruto do PDF
2. Split por linhas. 
3. Concatenar linhas consecutivas que pareçam ser parte de um mesmo título (ex: maiúsculas curtas que quebram em 2 linhas).
4. Checar candidatos a título:
   a. Texto < 120 caracteres (após concatenação)
   b. EM MAIÚSCULAS inteiramente OU
   c. Contém uma das palavras-chave acima (case-insensitive)
5. Agrupar parágrafos seguintes como conteúdo da seção
6. Converter texto em <p> HTML preservando quebras de linha
7. Fallback: Se nenhuma seção for detectada no PDF inteiro, agrupar todo o conteúdo em uma única seção chamada "Documento Completo"
```

### Para DOCX (HTML via `mammoth`)

```
1. Converter DOCX → HTML com mammoth (preserva negrito/itálico/listas/tabelas)
2. Extrair headings <h1>, <h2>, <h3> como títulos de seção primários
3. Conteúdo HTML entre dois headings = corpo da seção
4. Em paralelo: aplicar as mesmas palavras-chave sobre o texto extraído
   para capturar títulos que não foram marcados como heading no Word
5. Fallback: Se nenhuma seção for detectada, criar seção única "Documento Completo"
6. Pipeline: Extrair texto -> Detectar placeholders -> Sanitizar -> Preservar placeholders
```

---

## Segurança

| Verificação | Regra |
|---|---|
| Extensão | Somente `.pdf` e `.docx` |
| Tamanho | ≤ 20 MB |
| MIME type | `application/pdf` ou `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| HTML | Whitelist: `p, br, strong, em, u, s, ol, ul, li, h1-h6, table, thead, tbody, tr, td, th, blockquote, span, a, img` |

---

## Mapeamento de Placeholders e Formatação

**Pipeline:** `Extrair texto/HTML -> Detectar placeholders -> Sanitizar -> Preservar placeholders no HTML final`. 
A varredura dos placeholders `{{...}}` DEVE ocorrer antes da sanitização. Se for feito depois, o `sanitize-html` pode escapar as chaves `{` e `}`, corrompendo as tags.

**Preservação de Formatação:**
- **DOCX:** seções importadas preservam negrito, itálico, listas e tabelas, que aparecerão corretamente formatadas no TinyMCE.
- **PDFs:** como são convertidos de texto plano estruturado, preservam apenas parágrafos e quebras de seção.

---

## Critérios de Aceitação

- [ ] Template importado preserva formatação básica (negrito/itálico/listas)
- [ ] Usuário pode excluir/editar qualquer seção antes de salvar
- [ ] Seções detectadas automaticamente pelas palavras-chave periciais
- [ ] Laudos gerados a partir do template mantêm fidelidade visual
- [ ] Tempo de processamento < 15s para documentos de 20 páginas
- [ ] Arquivo > 20 MB é rejeitado com mensagem de erro
- [ ] Tipo de arquivo inválido é rejeitado

---

## Plano de Verificação

1. Importar PDF de ~10 páginas → verificar detecção de seções
2. Importar DOCX com headings → verificar estrutura HTML preservada
3. Editar seções no TinyMCE antes de salvar
4. Salvar template → confirmar que aparece na lista com seções corretas
5. Usar template importado para criar laudo
6. Testar arquivo > 20 MB → deve rejeitar
7. Testar tipo inválido (`.png`) → deve mostrar erro
8. `npm run build` → sem erros TypeScript
