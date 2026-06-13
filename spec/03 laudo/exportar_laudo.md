# Exportação de Laudos — Multi-formato

> **Status**: Implementado (2026-06-13)
> **Escopo**: Exportação do laudo nos formatos PDF, DOCX (Word) e ODT (LibreOffice)

---

## 1. Visão Geral

O usuário exporta o laudo em 3 formatos a partir de um botão split "Exportar" na toolbar do editor. PDF via `webContents.printToPDF()` do Electron, DOCX via `docx` npm (API programática), ODT via `libreoffice-convert` (wrapper do `soffice --headless`, requer LibreOffice instalado).

**Princípio fundamental:** Fidelidade total ao conteúdo do editor TinyMCE.

---

## 2. UI — Botão Exportar

Botão split na toolbar do editor (`LaudosPage.tsx`), substituindo o antigo "Visualizar":

```
[🖼 Ilustrações ▾] [↻] [← Voltar] [📥 Exportar ▾] [💾 Salvar]
    (outline)      (icon)  (outline)  (secondary split)  (default)
```

O botão principal "Exportar" (`variant="secondary"`) executa o preview PDF. O chevron abre dropdown com 4 itens:

```
┌─────────────────────────────────┐
│  👁  Visualizar PDF             │  ← abre diálogo de preview (handlePreview)
│  ────────────────────────────   │  ← DropdownMenuSeparator
│  📥  Baixar PDF                 │  ← laudo:exportar → printToPDF → showSaveDialog
│  📝  Baixar Word (.docx)        │  ← parse DOM → laudo:exportar → docx → showSaveDialog
│  📄  Baixar ODT (.odt)          │  ← desabilitado se LibreOffice ausente
└─────────────────────────────────┘
```

### Estados do componente

```typescript
const [exportando, setExportando] = useState(false);
const [libreOfficeDisponivel, setLibreOfficeDisponivel] = useState<boolean | null>(null);
```

- `libreOfficeDisponivel`: verificado via `window.ipcAPI.laudo.verificarLibreOffice()` no `useEffect` de inicialização. `null` = carregando, `true` = disponível, `false`/`null` = desabilita opção ODT.
- ODT desabilitado mostra texto `"Requer LibreOffice"` no item do dropdown.
- Botões `Exportar` e `Salvar` são desabilitados enquanto `exportando === true`.

---

## 3. Pipeline Técnico

### Renderer → Main

`LaudosPage.tsx` função `handleExportar(formato)`:

1. Busca dados da REP via `window.ipcAPI.rep.findById(editando.rep_id)`
2. Busca dados de relacionamento (solicitante, tipoExame)
3. Constrói cabeçalho via `buildPdfHeaderConfig()`
4. Obtém HTML do editor TinyMCE (single ou multi-seção)
5. Adiciona cabeçalho da primeira página como `<div class="cabecalho">` se existir
6. Reindexa figuras (`reindexarFiguras`)
7. Resolve placeholders via `resolverPlaceholdersExportacao(html, ctx)` — função em `exportacao-placeholders.ts`
8. Se `formato === 'docx'`: parseia HTML resolvido via `parseHtmlParaEstrutura()` → envia `estrutura` JSON
9. Envia IPC: `window.ipcAPI.laudo.exportar(payload)`

### Main process

`exportacao.service.ts` função `exportarLaudo(params: ExportarParams)`:

1. Extrai número da REP do banco: `extrairNumeroRep(laudoId)`
2. Constrói nome padrão: `buildNomeArquivo(numeroRep, formato)` → `123-2026.pdf`
3. Abre `dialog.showSaveDialog({ defaultPath, filters })`
4. Se cancelado: retorna `{ success: false, error: 'Operação cancelada pelo usuário' }`
5. Gera buffer por formato:
   - `pdf` → `gerarPDF(html, margens, headerTemplate)`
   - `docx` → `gerarDOCX(estrutura, cabecalho, margens)`
   - `odt` → `gerarODT(html)`
6. `fs.writeFileSync(filePath, buffer)`
7. Retorna `{ success: true, path: filePath }`

---

## 4. Nome do Arquivo

```typescript
// exportacao.service.ts

function removerZerosEsquerda(numero: string): string {
  return numero.replace(/^0+/, '') || '0';
}

function buildNomeArquivo(numeroRep: string, formato: string): string {
  const partes = numeroRep.split('/');     // "2026/000123" → ["2026", "000123"]
  const numero = removerZerosEsquerda(partes[1]);  // "123"
  const ano = partes[0];                           // "2026"
  return `${numero}-${ano}.${formato}`;            // "123-2026.pdf"
}
```

| REP | PDF | DOCX | ODT |
|-----|-----|------|-----|
| `2026/000123` | `123-2026.pdf` | `123-2026.docx` | `123-2026.odt` |
| `2026/001500` | `1500-2026.pdf` | `1500-2026.docx` | `1500-2026.odt` |

---

## 5. Canais IPC

| Canal | Direção | Descrição |
|-------|---------|-----------|
| `laudo:exportar` | Renderer → Main | Exporta laudo no formato escolhido |
| `laudo:verificarLibreOffice` | Renderer → Main | Verifica se LibreOffice está disponível (habilita ODT) |

### Payload `laudo:exportar`

```typescript
interface ExportarParams {
  laudoId: string;
  formato: 'pdf' | 'docx' | 'odt';
  html: string;                                                   // HTML resolvido
  estrutura?: any;                                                // LaudoEstrutura (só docx)
  cabecalho?: { logoBase64?: string; texto?: string; alinhamento?: string };
  margens?: { top: number; right: number; bottom: number; left: number };
  nomeArquivo?: string;                                           // não usado (gerado no main)
}
```

---

## 6. Resolução de Placeholders

**Arquivo:** `src/renderer/lib/exportacao-placeholders.ts`

Função `resolverPlaceholdersExportacao(html, ctx)`:

- Usa `DOMParser` para encontrar `<span data-placeholder="{{chave}}">` e substituir pelo valor real
- Fallback: regex `\{\{chave\}\}` para placeholders textuais
- Mapeamento inclui: campos da REP (18), relacionamentos (3), perito (4), datas (2), campos específicos de exame (I-801, B-602)
- Campos reservados `XXX` permanecem como texto, sem estilo

```typescript
interface ExportacaoContext {
  repData: any;
  solicitanteNome?: string;
  tipoExameNome?: string;
  tipoExameCodigo?: string;
}
```

---

## 7. Parse DOM → Estrutura DOCX

**Arquivo:** `src/renderer/lib/exportacao-parser.ts`

Função `parseHtmlParaEstrutura(html: string): LaudoEstrutura`.

Usa `DOMParser` nativo do navegador — **sem dependência cheerio**.

### Tipos

```typescript
interface LaudoEstrutura {
  fontFamily: string;       // detectada do primeiro parágrafo ou fallback 'Calibri'
  fontSize: string;         // detectada ou fallback '12pt'
  secoes: SecaoExportacao[];
  imagens: ImagemExportacao[];
}

interface SecaoExportacao {
  titulo: string;           // conteúdo do <h2>, ex: "1. PREÂMBULO"
  elementos: ElementoExportacao[];
}

interface ImagemExportacao {
  id: string;               // data-image-id do <figure>
  base64: string;           // conteúdo puro (sem prefixo data:image/...;base64,)
  formato: string;          // 'jpeg' | 'png'
  legenda: string;
  numero: number;           // extraído do <figcaption>
}

type ElementoExportacao =
  | ElementoParagrafo    // { tipo: 'paragrafo'; html: string; alinhamento?: string; nivelTitulo?: number }
  | ElementoTabela       // { tipo: 'tabela'; linhas: string[][]; cabecalho?: boolean }
  | ElementoLista        // { tipo: 'lista'; items: string[]; ordenada: boolean; nivel: number }
  | ElementoFigura       // { tipo: 'figura'; imagemId: string; legenda: string; numero: number }
  | ElementoQuebra;      // { tipo: 'quebra' }
```

### Algoritmo de parse

1. `detectarFonte(doc)`: `window.getComputedStyle()` no primeiro `<p>` ou `<h2>`, fallback `Calibri 12pt`
2. Encontra todos `<h2>` como delimitadores de seção
3. Itera siblings entre `<h2>` consecutivos:
   - `<figure class="laudo-figure">` → `ElementoFigura`, extrai data URI e armazena em `imagensMap`
   - `<table>` → `ElementoTabela`, extrai `<tr>` → `string[][]`, detecta `thead th` como cabeçalho
   - `<ul>` → `ElementoLista` ordenada=false, `<ol>` → ordenada=true
   - `<hr>` → `ElementoQuebra`
   - `<p>`, `<div>`, `<blockquote>`, `<pre>` → `ElementoParagrafo` com innerHTML e alinhamento
   - `<h3>`-`<h6>` → `ElementoParagrafo` com `nivelTitulo`
   - `<img>` sem `<figure>` → ignorado

---

## 8. Montagem DOCX

**Arquivo:** `src/main/services/exportacao.service.ts`, função `gerarDOCX(estrutura, cabecalho, margens)`

Usa `docx` npm (`Document`, `Packer`, `Paragraph`, `TextRun`, `Table`, `TableRow`, `TableCell`, `ImageRun`, `Header`, `HeadingLevel`, `AlignmentType`, `WidthType`).

### Mapeamento de elementos

| Estrutura | docx API |
|-----------|----------|
| `{ tipo: 'paragrafo' }` | `new Paragraph({ children: parseInlineHtml(html), alignment })` |
| `{ tipo: 'paragrafo', nivelTitulo: 3 }` | `new Paragraph({ heading: 'Heading3', children })` |
| `{ tipo: 'tabela' }` | `new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })` |
| `{ tipo: 'lista', ordenada: false }` | `new Paragraph({ bullet: { level: nivel-1 } })` |
| `{ tipo: 'lista', ordenada: true }` | `new Paragraph({ numbering: { reference, level } })` |
| `{ tipo: 'figura' }` | `new Paragraph({ children: [ImageRun] })` + `new Paragraph({ children: [TextRun(legenda, italics)] })` |
| `{ tipo: 'quebra' }` | `new Paragraph({ children: [] })` |

### Formatação inline (parseInlineHtml)

Regex sobre o HTML inline do parágrafo:
- `<strong>`, `<b>` → `new TextRun({ bold: true })`
- `<em>`, `<i>` → `new TextRun({ italics: true })`
- `<u>` → `new TextRun({ underline: { type: 'single' } })`
- `<s>`, `<strike>` → `new TextRun({ strike: true })`
- `<br>` → `new TextRun({ break: 1 })`

### Cabeçalho

Headers reais do Word (`headers.first`):
- Logo: se `cabecalho.logoBase64` → `ImageRun` (PNG, 120x60)
- Texto: `new Paragraph({ alignment, children: [TextRun(texto)] })`

Alinhamento mapeado: `center` → `AlignmentType.CENTER`, `right` → `AlignmentType.RIGHT`, `left` → `AlignmentType.LEFT`.

### Margens

Cm convertido para twips (1 cm = 567 twips). Aplicado em `section.properties.page.margin`.

### Fonte

`styles.default.document.run.font` com `fontFamily` e `size` (pt * 2 = half-points) do `LaudoEstrutura`.

---

## 9. PDF — printToPDF

**Arquivo:** `src/main/services/exportacao.service.ts`, função `gerarPDF(html, margens, headerTemplate)`

Lógica idêntica ao preview existente (`template.handlers.ts:168-287`):
- Envolve HTML em template com CSS inline
- Abre `BrowserWindow` oculta → `win.loadFile(tmpPath)` → espera 800ms
- `win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins })`
- Se `headerTemplate` fornecido: `displayHeaderFooter: true` com `headerTemplate` + `footerTemplate` vazio
- Converte margens cm → polegadas (× `CM_TO_INCHES = 1/2.54`)

---

## 10. ODT — libreoffice-convert

**Arquivo:** `src/main/services/exportacao.service.ts`, função `gerarODT(html)`

```typescript
async function gerarODT(html: string): Promise<Buffer> {
  const { promisify } = await import('util');
  const libre = await import('libreoffice-convert');
  const convertAsync = promisify(libre.convert);

  // 1. Extrai data: URIs → arquivos temp
  const dataUriRegex = /<img[^>]+src="(data:image\/[^"]+)"[^>]*>/gi;
  html = html.replace(dataUriRegex, (full, dataUri) => {
    const parsed = dataUriToBuffer(dataUri);
    if (!parsed) return full;
    const tempPath = path.join(os.tmpdir(), `laudo-img-${Date.now()}-${idx++}.${ext}`);
    fs.writeFileSync(tempPath, parsed.buffer);
    return full.replace(dataUri, `file:///${tempPath.replace(/\\/g, '/')}`);
  });

  // 2. Escreve HTML temporário
  fs.writeFileSync(tmpHtmlPath, html, 'utf-8');

  // 3. Converte via LibreOffice headless
  const htmlBuffer = fs.readFileSync(tmpHtmlPath);
  const odtBuffer = await convertAsync(htmlBuffer, 'odt', undefined);

  // 4. Limpa arquivos temporários
  return odtBuffer;
}
```

- `dataUriToBuffer(dataUri)`: regex extrai formato (jpeg/png) e conteúdo base64, retorna `{ buffer: Buffer, formato: string }`
- Fallback: se regex falhar, a tag `<img>` original é mantida
- Limpeza de temp files no bloco `finally`

### Verificação de disponibilidade

**Arquivo:** `src/main/services/exportacao.service.ts`, função `verificarLibreOffice()`

```typescript
export async function verificarLibreOffice(): Promise<boolean> {
  try {
    const libre = await import('libreoffice-convert');
    const convertAsync = promisify(libre.convert);
    const testHtml = '<html><body><p>test</p></body></html>';
    const result = await convertAsync(Buffer.from(testHtml, 'utf-8'), 'odt', undefined);
    return Buffer.isBuffer(result) && result.length > 0;
  } catch { return false; }
}
```

Chamada no handler `laudo:verificarLibreOffice` → exposta no preload como `window.ipcAPI.laudo.verificarLibreOffice()`.

---

## 11. Tratamento de Erros

| Cenário | Comportamento |
|---------|--------------|
| LibreOffice ausente | Opção ODT desabilitada, texto "Requer LibreOffice" no item |
| Falha na conversão DOCX | `setError(error.message)` exibido no Alert do editor |
| Falha no `printToPDF` | `setError(error.message)` |
| Falha no `libreoffice-convert` | `setError(error.message)` |
| Usuário cancela `showSaveDialog` | Retorna `{ success: false, error: 'Operação cancelada pelo usuário' }` — tratado silenciosamente |
| Placeholder não resolvido | Mantém `{{chave}}` literal no HTML |
| Data URI inválida | Imagem ignorada, documento gerado sem ela |

---

## 12. Dependências

```json
{
  "docx": "^9.x",
  "libreoffice-convert": "^1.x"
}
```

`cheerio` não adicionada — parse DOM feito no renderer com `DOMParser` nativo.

---

## 13. Arquivos

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/renderer/lib/exportacao-placeholders.ts` | Novo | Resolução de placeholders (renderer) |
| `src/renderer/lib/exportacao-parser.ts` | Novo | Parse DOM → `LaudoEstrutura` para DOCX |
| `src/main/services/exportacao.service.ts` | Novo | Geração PDF/DOCX/ODT, salvamento, verificação LibreOffice |
| `src/main/ipc/handlers/laudo.handlers.ts` | Editado | Handlers `laudo:exportar` + `laudo:verificarLibreOffice` |
| `src/preload/index.ts` | Editado | Canais + API `laudo.exportar()` / `laudo.verificarLibreOffice()` |
| `src/renderer/pages/LaudosPage.tsx` | Editado | Botão split Exportar ▾, estado `exportando`/`libreOfficeDisponivel`, `handleExportar()` |
| `src/main/utils/logger.ts` | Editado | `'exportacao'` adicionado ao `LogModule` |
| `package.json` | Editado | Dependências `docx`, `libreoffice-convert` |
