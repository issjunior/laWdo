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
| `src/preload/index.ts` | Ponte IPC `template.previewPDF` |

## Lições aprendidas

1. **`data:` URI para PDF é bloqueado** em iframes no Electron/Chromium — usar Blob URL
2. **`protocol.handle()`** não garante que iframes consigam carregar recursos de protocolos customizados para exibição inline
3. **`URL.createObjectURL()` + `Blob`** é o método canônico para exibir conteúdo binário em iframes
4. **Sempre revogar** Blob URLs com `URL.revokeObjectURL()` ao fechar para evitar memory leak
5. **CSP precisa de `blob:`** em `frame-src` e `object-src` para iframes carregarem Blob URLs
