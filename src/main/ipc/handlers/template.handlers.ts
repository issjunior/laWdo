import { ipcMain, BrowserWindow, app } from 'electron';
import { logDebug, logError } from '../../utils/logger.js';
import { auditDelete } from '../../services/audit-log.service.js';
import { sanitizeInput } from '../../security/index.js';
import { templateService } from '../../services/template.service.js';
import path from 'path';
import fs from 'fs';

const CM_TO_INCHES = 1 / 2.54;

const mensagemErro = (error: unknown): string =>
  error instanceof Error ? error.message : 'Erro desconhecido';

export const registerTemplateHandlers = (): void => {
  /** Listar todos os templates (com contagem de seções) */
  ipcMain.handle('template:findAll', async () => {
    try {
      const data = await templateService.findAllComSecoes();
      return { success: true, data };
    } catch (error: unknown) {
      logError('Erro ao listar templates', error);
      return { success: false, error: mensagemErro(error) };
    }
  });

  /** Buscar template por ID */
  ipcMain.handle('template:findById', async (_event, id: string) => {
    try {
      const data = await templateService.findById(id);
      if (!data) return { success: false, error: 'Template não encontrado' };
      return { success: true, data };
    } catch (error: unknown) {
      logError('Erro ao buscar template', error);
      return { success: false, error: mensagemErro(error) };
    }
  });

  /** Buscar templates por tipo de exame */
  ipcMain.handle('template:findByTipoExame', async (_event, tipoExameId: string) => {
    try {
      const data = await templateService.findByTipoExame(tipoExameId);
      return { success: true, data };
    } catch (error: unknown) {
      logError('Erro ao buscar templates por tipo de exame', error);
      return { success: false, error: mensagemErro(error) };
    }
  });

  /** Criar template */
  ipcMain.handle('template:create', async (_event, data: { nome: string; tipo_exame_id: string; descricao?: string }) => {
    try {
      if (!data.nome || !data.nome.trim()) {
        return { success: false, error: 'Nome do template é obrigatório' };
      }
      if (!data.tipo_exame_id) {
        return { success: false, error: 'Tipo de exame é obrigatório' };
      }
      const template = await templateService.create({
        nome: sanitizeInput(data.nome.trim()),
        tipo_exame_id: data.tipo_exame_id,
        descricao: data.descricao ? sanitizeInput(data.descricao) : undefined,
      });
      logDebug(`Template criado: ${template.nome}`);
      return { success: true, data: template, message: 'Template criado com sucesso' };
    } catch (error: unknown) {
      logError('Erro ao criar template', error);
      return { success: false, error: mensagemErro(error) };
    }
  });

  /** Atualizar template */
  ipcMain.handle('template:update', async (_event, id: string, data: { nome?: string; tipo_exame_id?: string; descricao?: string }) => {
    try {
      const updateData: Record<string, unknown> = {};
      if (data.nome !== undefined) updateData.nome = sanitizeInput(data.nome);
      if (data.tipo_exame_id !== undefined) updateData.tipo_exame_id = data.tipo_exame_id;
      if (data.descricao !== undefined) updateData.descricao = data.descricao ? sanitizeInput(data.descricao) : null;

      const template = await templateService.update(id, updateData);
      logDebug(`Template atualizado: ${id}`);
      return { success: true, data: template, message: 'Template atualizado com sucesso' };
    } catch (error: unknown) {
      logError('Erro ao atualizar template', error);
      return { success: false, error: mensagemErro(error) };
    }
  });

  /** Excluir template */
  ipcMain.handle('template:delete', async (_event, id: string) => {
    try {
      await templateService.delete(id);
      logDebug(`Template excluído: ${id}`);
      auditDelete('', 'templates', id, `Template ${id} excluído`);
      return { success: true, message: 'Template excluído com sucesso' };
    } catch (error: unknown) {
      logError('Erro ao excluir template', error);
      return { success: false, error: mensagemErro(error) };
    }
  });

  // ─── Seções ───────────────────────────────────────────

  /** Listar seções de um template */
  ipcMain.handle('template:findSecoes', async (_event, templateId: string) => {
    try {
      const data = await templateService.findSecoesByTemplate(templateId);
      return { success: true, data };
    } catch (error: unknown) {
      logError('Erro ao listar seções do template', error);
      return { success: false, error: mensagemErro(error) };
    }
  });

  /** Criar seção */
  ipcMain.handle('template:createSecao', async (_event, data: { template_id: string; nome: string; ordem: number; parent_id?: string | null; conteudo?: string; condicao?: string | null; repetir_para?: string | null; repetir_titulo?: string | null }) => {
    try {
      if (!data.nome || !data.nome.trim()) {
        return { success: false, error: 'Nome da seção é obrigatório' };
      }
      const secao = await templateService.createSecao({
        template_id: data.template_id,
        nome: sanitizeInput(data.nome.trim()),
        ordem: data.ordem ?? 0,
        parent_id: data.parent_id || undefined,
        conteudo: data.conteudo || undefined,
        condicao: data.condicao || undefined,
        repetir_para: data.repetir_para || undefined,
        repetir_titulo: data.repetir_titulo || undefined,
      });
      return { success: true, data: secao, message: 'Seção criada com sucesso' };
    } catch (error: unknown) {
      logError('Erro ao criar seção', error);
      return { success: false, error: mensagemErro(error) };
    }
  });

  /** Atualizar seção */
  ipcMain.handle('template:updateSecao', async (_event, id: string, data: { nome?: string; ordem?: number; parent_id?: string | null; conteudo?: string; condicao?: string | null; repetir_para?: string | null; repetir_titulo?: string | null }) => {
    try {
      const updateData: Record<string, unknown> = {};
      if (data.nome !== undefined) updateData.nome = sanitizeInput(data.nome);
      if (data.ordem !== undefined) updateData.ordem = data.ordem;
      if (data.parent_id !== undefined) updateData.parent_id = data.parent_id;
      if (data.conteudo !== undefined) updateData.conteudo = data.conteudo;
      if (data.condicao !== undefined) updateData.condicao = data.condicao;
      if (data.repetir_para !== undefined) updateData.repetir_para = data.repetir_para;
      if (data.repetir_titulo !== undefined) updateData.repetir_titulo = data.repetir_titulo;

      const secao = await templateService.updateSecao(id, updateData);
      return { success: true, data: secao, message: 'Seção atualizada com sucesso' };
    } catch (error: unknown) {
      logError('Erro ao atualizar seção', error);
      return { success: false, error: mensagemErro(error) };
    }
  });

  /** Excluir seção */
  ipcMain.handle('template:deleteSecao', async (_event, id: string) => {
    try {
      await templateService.deleteSecao(id);
      return { success: true, message: 'Seção excluída com sucesso' };
    } catch (error: unknown) {
      logError('Erro ao excluir seção', error);
      return { success: false, error: mensagemErro(error) };
    }
  });

  /** Reordenar seções */
  ipcMain.handle('template:reordenarSecoes', async (_event, templateId: string, idsOrdenados: string[]) => {
    try {
      await templateService.reordenarSecoes(templateId, idsOrdenados);
      return { success: true, message: 'Seções reordenadas com sucesso' };
    } catch (error: unknown) {
      logError('Erro ao reordenar seções', error);
      return { success: false, error: mensagemErro(error) };
    }
  });

  /** Gerar PDF de preview do laudo (exibido no Dialog via protocolo customizado) */
  ipcMain.handle('template:previewPDF', async (_event, opts: { html: string; margins?: { top: number; right: number; bottom: number; left: number }; headerTemplate?: string }) => {
    let win: BrowserWindow | null = null;
    let tmpPath: string | null = null;
    try {
      const { html, margins, headerTemplate } = opts;
       const hasMargins = margins && (margins.top > 0 || margins.right > 0 || margins.bottom > 0 || margins.left > 0);
      const bodyPadding = hasMargins ? '0 0 12px 0' : '50px 60px';
      const leftPad = hasMargins ? `${margins!.left}cm` : '60px';
      const rightPad = hasMargins ? `${margins!.right}cm` : '60px';

      const docHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    line-height: 1.7;
    color: #1a1a1a;
    padding: ${bodyPadding};
    max-width: 210mm;
    margin: 0 auto;
  }
  h1 { font-size: 20px; margin-bottom: 12px; }
  h2 { font-size: 16px; margin-top: 28px; margin-bottom: 10px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 14px; margin-top: 20px; margin-bottom: 8px; }
  p { margin-bottom: 8px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  table th, table td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  table th { background: #f5f5f5; font-weight: 600; }
  ul, ol { margin: 8px 0; padding-left: 24px; }
  li { margin-bottom: 4px; }
  img { max-width: 100%; height: auto; display: block; margin: 10px auto; }
  .laudo-figure { text-align: center; margin: 12px auto; page-break-inside: avoid; }
  figcaption { font-size: 12px; color: #444; font-weight: bold; margin-top: 4px; }
  .placeholder-tag { background-color: #e8f0fe; color: #1a73e8; border-radius: 4px; padding: 2px 6px; font-weight: 500; }
  .campo-reservado { background-color: rgba(255,193,7,0.2); color: #b45309; border-bottom: 2px dotted #f59e0b; border-radius: 4px; padding: 2px 6px; font-weight: 500; }
</style>
</head>
<body>${html}</body>
</html>`;

      win = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      tmpPath = path.join(app.getPath('temp'), `preview-${Date.now()}.html`);
      fs.writeFileSync(tmpPath, docHtml, 'utf-8');
      await win.loadFile(tmpPath);
      await new Promise(resolve => setTimeout(resolve, 800));

      const pdfMargins = margins
        ? {
            top:    margins.top    * CM_TO_INCHES,
            right:  margins.right  * CM_TO_INCHES,
            bottom: margins.bottom * CM_TO_INCHES,
            left:   margins.left   * CM_TO_INCHES,
          }
        : { top: 0, bottom: 0, left: 0, right: 0 };

      const printOptions: Electron.PrintToPDFOptions = {
        printBackground: true,
        preferCSSPageSize: true,
        margins: pdfMargins,
      };

      if (headerTemplate) {
        const alignMatch = headerTemplate.match(/^\{\{ALIGN:([^}]+)\}\}/);
        const align = alignMatch ? alignMatch[1] : 'flex-start';
        const cleanTemplate = headerTemplate.replace(/^\{\{ALIGN:[^}]+\}\}/, '');
        const textAlign = align === 'flex-end' ? 'right' : align === 'center' ? 'center' : 'left';

        printOptions.displayHeaderFooter = true;
        printOptions.headerTemplate = `<style>
  .header-container {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    text-align: ${textAlign};
    padding-left: ${leftPad};
    padding-right: ${rightPad};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    line-height: 1.1;
    color: #1a1a1a;
  }
  .header-container p, .header-container div {
    margin: 0;
    padding: 0;
    line-height: 1.1;
  }
</style>
<div class="header-container">${cleanTemplate}</div>`;
        printOptions.footerTemplate = '<html><head></head><body></body></html>';
      }

      const buffer = Buffer.from(await win.webContents.printToPDF(printOptions));

      win.close();
      win = null;

      try { fs.unlinkSync(tmpPath); } catch { /* ignora */ }

      const base64PDF = buffer.toString('base64');
      logDebug('PDF de preview gerado com sucesso (imagens otimizadas)');
      return { success: true, data: base64PDF };
    } catch (error: unknown) {
      logError('Erro ao gerar PDF de preview', error);
      if (tmpPath) { try { fs.unlinkSync(tmpPath); } catch { /* ignora */ } }
      if (win) { try { win.close(); } catch { /* ignora */ } }
      return { success: false, error: mensagemErro(error) };
    }
  });
};
