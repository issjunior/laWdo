# Visualização de PDF no Electron — Problema e Solução

## Contexto

Ao implementar a pré-visualização de laudos em PDF dentro de um Dialog na aplicação Electron, o PDF gerado via `webContents.printToPDF()` precisava ser exibido em um `<iframe>` ou `<embed>` dentro do renderer.

## Problema

Todas as tentativas de exibir o PDF diretamente resultaram em `ERR_BLOCKED_BY_RESPONSE`:

| Abordagem | Resultado |
|-----------|-----------|
| `<embed src="data:application/pdf;base64,...">` | Bloqueado — CSP `frame-src`/`object-src` restringe `data:` |
| `<iframe src="data:application/pdf;base64,...">` | Bloqueado — mesmo motivo |
| Protocolo customizado `laudo-preview://pdf` via `protocol.handle()` | Bloqueado — `ERR_BLOCKED_BY_RESPONSE` mesmo com handler registrado |
| Abrir PDF externamente com `shell.openPath()` | Funciona, mas quebra a experiência de preview dentro do app |

A causa raiz: o Chromium/Electron bloqueia navegação de iframes para URLs `data:` com tipo MIME `application/pdf`, e protocolos customizados não são confiáveis para exibição inline de PDF no renderer.

## Solução

**Blob URL** — método padrão dos browsers para exibir dados binários sem restrições CSP.

### Fluxo

```
1. Main process: webContents.printToPDF() → Buffer
2. Main process: Buffer → base64 string
3. IPC: retorna { success: true, data: base64 }
4. Renderer: base64 → Uint8Array → Blob → URL.createObjectURL()
5. Renderer: <iframe src={blobUrl}>
6. Ao fechar: URL.revokeObjectURL(blobUrl)
```

### Código no Main Process (`template.handlers.ts`)

```typescript
ipcMain.handle('template:previewPDF', async (_event, html: string) => {
  let win: BrowserWindow | null = null;
  try {
    win = new BrowserWindow({
      width: 800, height: 600, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(docHtml)}`);
    await new Promise(resolve => setTimeout(resolve, 600));

    const buffer = Buffer.from(await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    }));
    win.close();

    return { success: true, data: buffer.toString('base64') };
  } catch (error) {
    if (win) { try { win.close(); } catch { /* ignora */ } }
    return { success: false, error: error.message };
  }
});
```

### Código no Renderer (`TemplatesPage.tsx`)

```typescript
const result = await window.ipcAPI.template.previewPDF(fullHtml);
if (result.success && result.data) {
  // Converter base64 para Blob URL (bypass CSP)
  const byteChars = atob(result.data);
  const byteNums = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNums[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNums)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  setPreviewBlobUrl(url);
}
```

### JSX do Dialog

```tsx
<Dialog open={showPreview} onOpenChange={(open) => {
  if (!open && previewBlobUrl) {
    URL.revokeObjectURL(previewBlobUrl);
    setPreviewBlobUrl('');
  }
  setShowPreview(open);
}}>
  <DialogContent>
    <iframe src={previewBlobUrl} className="w-full h-full min-h-[70vh]" />
  </DialogContent>
</Dialog>
```

### CSP necessário

```diff
- frame-src 'none';
- object-src 'none';
+ frame-src 'self' data: blob:;
+ object-src 'self' data: blob:;
```

## Arquivos relevantes

| Arquivo | Papel |
|---------|-------|
| `src/main/ipc/handlers/template.handlers.ts` | Handler `template:previewPDF` — gera PDF via `printToPDF()` |
| `src/main/security/index.ts` | CSP — `frame-src` e `object-src` com `blob:` |
| `src/renderer/pages/TemplatesPage.tsx` | UI — botão, Dialog, conversão base64→Blob URL |
| `src/renderer/pages/REPsPage.tsx` | `buildRepHtml()` — gera HTML das tabelas da REP (B-602, veículo, etc.) |
| `src/preload/index.ts` | Ponte IPC `template.previewPDF` |

---

## Estrutura HTML do preview da REP (`buildRepHtml`)

A função `buildRepHtml()` em `REPsPage.tsx` monta o HTML do preview PDF da REP a partir dos dados da requisição e dos `campos_especificos` (JSON). As seções seguem uma ordem fixa de tabelas com estilo consistente via `REP_TABLE_STYLES`.

### Tabelas renderizadas (ordem)

| # | Tabela | Condição | Colunas |
|---|--------|----------|---------|
| 1 | DADOS DA SOLICITAÇÃO | sempre | 4 (label-value 2-col) |
| 2 | TRAMITAÇÃO | se houver datas | 4 (label-value 2-col) |
| 3 | DADOS DO VEÍCULO | se `numeracao` tiver dados | 4 (label-value 2-col) |
| 4 | DADOS DA INVESTIGAÇÃO | se `b602.envolvidos` tiver dados | 4 |
| 5 | MATERIAL ENCAMINHADO | se `b602.material_enc` tiver dados | 6 (Natureza, Qtd, Tipo, Dito Ofício, Nº Lacre) |
| 6 | CARTUCHOS | se `b602.cartuchos` tiver dados | 9 (Qtd, Calibre, Marca, Origem, Espoleta, Estojo, Projétil, Obs) |
| 7 | ESTOJOS | se `b602.estojos` tiver dados | 8 (Qtd, Calibre, Marca, Origem, Espoleta, Estojo, Obs) |
| 8 | ARMAS (wrapper) | se `b602.armas` tiver dados | wrapper + 2 sub-tabelas |
| 9 | LOCAL DO FATO | se `ce.local_fato` ≠ `rep.local_fato` | 2 (label-value) |
| 10 | OBSERVAÇÕES | se `rep.observacoes` | 1 |

### Tabela wrapper — ARMAS

A seção ARMAS possui 13 campos por arma (14 colunas com Item), o que não cabe em A4 retrato. A solução adotada é uma **tabela wrapper** com título "ARMAS" contendo duas sub-tabelas aninhadas:

```
┌─ ARMAS ───────────────────────────────┐  ← wrapper (título cinza, colspan=1)
│                                        │  ← célula container (padding, sem borda)
│  ┌─ ARMAS - IDENTIFICAÇÃO ──────────┐ │
│  │ Item | Tipo | Marca | Calibre    │ │  ← 7 colunas
│  │      | Nº Série | Nº Cano | Qtd  │ │
│  └──────────────────────────────────┘ │
│  ┌─ ARMAS - DADOS TÉCNICOS ─────────┐ │
│  │ Item | Cap. Carreg. | Compr. Cano│ │  ← 8 colunas
│  │      | Acabamento | Funcionamento │ │
│  │      | Est. Conservação           │ │
│  │      | Dito Ofício | Nº Lacre     │ │
│  └──────────────────────────────────┘ │
└───────────────────────────────────────┘
```

A wrapper usa `buildRepTableTitle('ARMAS', 1)` para o título externo. As sub-tabelas são geradas com `buildRepNumberedTable()` e ficam dentro de uma `<td style="padding:4px 0 0 0;border:none">`. Cada sub-tabela tem seu próprio `margin:12px 0` (do `REP_TABLE_STYLES.table`), garantindo separação visual entre elas.

### Helpers de tabela

| Helper | Uso |
|--------|-----|
| `buildRepTableTitle(titulo, colspan)` | Linha de título (fundo cinza, centralizado) |
| `buildRepTwoCol(a,b,c,d)` | Linha 4 colunas (label 25% + valor 25% × 2) |
| `buildRepLabelValue(label, valor, labelW?)` | Linha 2 colunas (label + valor) |
| `buildRepNumberedTable(titulo, headers, rows)` | Tabela numerada com Item + colunas dinâmicas |

`buildRepNumberedTable` é usada para as tabelas de Material Encaminhado, Cartuchos, Estojos e as sub-tabelas de Armas. Ela gera um `<table>` completo com linha de título, cabeçalho e corpo com numeração automática de itens.

---

## Placeholder Resolution Pipeline

Antes de gerar o PDF, o HTML do laudo passa por duas funções de resolução de placeholders, dependendo do fluxo:

| Fluxo | Função | Arquivo |
|-------|--------|---------|
| Preview PDF (Visualizar) | `aplicarPlaceholders()` | `src/renderer/pages/LaudosPage.tsx:115` |
| Exportação PDF/DOCX/ODT | `resolverPlaceholdersExportacao()` / `buildPlaceholderMapping()` | `src/renderer/lib/exportacao-placeholders.ts:44` |

### Funcionamento

1. **Mapeamento geral** — placeholders comuns (`rep_numero`, `perito_nome`, etc.) são mapeados diretamente a partir dos dados da REP e do perito logado.
2. **Campos específicos (B-602)** — o JSON em `repData.campos_especificos` é parseado, e placeholders de cada grupo são resolvidos em laços individuais:
   - `{{b602_envolvidos}}` / `{{b602_envolvido_N}}`
   - `{{b602_material_enc_N_{campo}}}` — natureza, quantidade, tipo, dito_oficio, numero_lacre
   - `{{b602_cartucho_N_{campo}}}` — quantidade, calibre, marca, origem, espoleta, estojo, projetil, observacao
   - `{{b602_estojo_N_{campo}}}` — quantidade, calibre, marca, origem, espoleta, estojo, observacao
   - **`{{b602_arma_N_{campo}}}`** — tipo, marca, modelo, calibre, numeracao_serie, numeracao_cano, capacidade_carregador, comprimento_cano, acabamento, funcionamento, estado_conservacao, quantidade, dito_oficio, numero_lacre
   - **`{{b602_arma_N_letra}}`** — letra sequencial da arma, computada em runtime
   - **`{{b602_arma_N_func_toggle}}` / `{{b602_arma_N_coleta_toggle}}`** — estado on/off usado pelos blocos condicionais por arma
3. **DOMParser** — spans com `data-placeholder="{{chave}}"` são substituídos pelos valores do mapping.
4. **Regex residual** — `{{chave}}` remanescentes (digitados manualmente) são substituídos como fallback.

### Manutenção futura

Ao adicionar suporte a placeholders individuais de um novo grupo dentro do B-602 (ou de outro tipo de exame), o padrão é sempre o mesmo:

1. O placeholder é inserido no editor via `PlaceholderContextMenu` (ver `spec/03 laudo/menu_contexto.md`)
2. A chave segue o formato `{prefixo}_{N}_{campo}`, onde `N` é 1-based
3. Ambos os arquivos abaixo **devem** ser atualizados com um `forEach` idêntico:

```ts
grupo.forEach((item, i) => {
  const idx = i + 1;
  mapping[`prefixo_${idx}_campo1`] = item.campo1 || '';
  mapping[`prefixo_${idx}_campo2`] = item.campo2 || '';
  // ...
});
```

| Arquivo | Função a modificar |
|---------|-------------------|
| `src/renderer/pages/LaudosPage.tsx` | `aplicarPlaceholders` (bloco `if (b602)`) |
| `src/renderer/lib/exportacao-placeholders.ts` | `buildPlaceholderMapping` (bloco `if (b602)`) |

### Arquivos relevantes da pipeline

| Arquivo | Papel |
|---------|-------|
| `src/renderer/pages/LaudosPage.tsx` | `aplicarPlaceholders()` — resolução para preview PDF |
| `src/renderer/lib/exportacao-placeholders.ts` | `buildPlaceholderMapping()` + `resolverPlaceholdersExportacao()` — resolução para exportação |
| `src/renderer/lib/tabelas-placeholder.ts` | Construtores de tabelas HTML (`buildArmasTabela`, `buildNumberedTable`, `buildDadosInvestigacaoTable`) |
| `src/renderer/components/rep/exam-fields/placeholders.ts` | Manifest de placeholders de campos específicos (`CAMPOS_ESPECIFICOS_PLACEHOLDERS`) |
| `src/renderer/components/rep/exam-fields/services/b602.service.ts` | `ARMA_CAMPOS` — lista de campos de arma usada tanto na serialização quanto no menu de contexto |
| `spec/05 placeholder/ciclo_placeholder.md` | Ciclo completo de placeholders de campos específicos |

## Lições aprendidas

1. **`data:` URI para PDF é bloqueado** em iframes no Electron/Chromium — usar Blob URL
2. **`protocol.handle()`** não garante que iframes consigam carregar recursos de protocolos customizados para exibição inline
3. **`URL.createObjectURL()` + `Blob`** é o método canônico para exibir conteúdo binário em iframes
4. **Sempre revogar** Blob URLs com `URL.revokeObjectURL()` ao fechar para evitar memory leak
5. **CSP precisa de `blob:`** em `frame-src` e `object-src` para iframes carregarem Blob URLs
