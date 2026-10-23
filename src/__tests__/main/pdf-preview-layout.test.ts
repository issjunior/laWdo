import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';

const preparar = vi.hoisted(() => vi.fn());
vi.mock('../../main/services/pdf-prontidao.service.js', () => ({
  gerarPdfPreparado: preparar,
  ErroGeracaoPdf: class extends Error {},
}));
vi.mock('../../main/utils/logger.js', () => ({ logDebug: vi.fn(), logError: vi.fn() }));
vi.mock('../../main/services/audit-log.service.js', () => ({ auditDelete: vi.fn(), auditExport: vi.fn() }));
vi.mock('../../main/security/index.js', () => ({ sanitizeInput: vi.fn() }));
vi.mock('../../main/services/template.service.js', () => ({ templateService: {} }));
vi.mock('../../main/services/template-pacote.service.js', () => ({ exportarPacoteTemplate: vi.fn(), importarPacoteTemplate: vi.fn(), lerPreviaPacoteTemplate: vi.fn() }));
vi.mock('../../main/templates/integrados/sincronizar-templates-integrados.js', () => ({ obterEstadoTemplatesIntegrados: vi.fn() }));
vi.mock('../../main/services/importacao/sanitizacao.js', () => ({ sanitizarHtmlImportacao: vi.fn() }));

import { registerTemplateHandlers } from '../../main/ipc/handlers/template.handlers';

describe('layout da prévia de PDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preparar.mockResolvedValue(Buffer.from('pdf'));
    registerTemplateHandlers();
  });

  it.each([undefined, '{{ALIGN:flex-end}}<p>LAUDO Nº TESTE</p>'])('usa o mesmo layout A4 da exportação com cabeçalho %s', async cabecalho => {
    const registro = vi.mocked(ipcMain.handle).mock.calls.find(([canal]) => canal === 'template:previewPDF');
    if (!registro) throw new Error('Handler da prévia não registrado');
    const resultado: unknown = await registro[1]({} as Electron.IpcMainInvokeEvent, {
      html: '<p>Laudo</p>', margins: { top: 4, right: 2, bottom: 2.5, left: 3 }, headerTemplate: cabecalho,
    });
    expect(resultado).toMatchObject({ success: true });
    expect(preparar).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      pageSize: 'A4', landscape: false, preferCSSPageSize: false,
      margins: { top: 4 / 2.54, right: 2 / 2.54, bottom: 2.5 / 2.54, left: 3 / 2.54 },
      ...(cabecalho ? { headerTemplate: expect.stringContaining('top: 4cm; left: 3cm;') } : {}),
    }), cabecalho);
  });
});
