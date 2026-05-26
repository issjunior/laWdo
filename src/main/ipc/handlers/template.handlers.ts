import { ipcMain, dialog, BrowserWindow, nativeImage } from 'electron';
import { logInfo, logError } from '../../utils/logger.js';
import { sanitizeInput } from '../../security/index.js';
import { templateService } from '../../services/template.service.js';
import path from 'path';
import fs from 'fs';

const CM_TO_INCHES = 1 / 2.54;

export const registerTemplateHandlers = (): void => {
  /** Listar todos os templates (com contagem de seções) */
  ipcMain.handle('template:findAll', async () => {
    try {
      const data = await templateService.findAllComSecoes();
      return { success: true, data };
    } catch (error: any) {
      logError('Erro ao listar templates', error);
      return { success: false, error: error.message };
    }
  });

  /** Buscar template por ID */
  ipcMain.handle('template:findById', async (_event, id: string) => {
    try {
      const data = await templateService.findById(id);
      if (!data) return { success: false, error: 'Template não encontrado' };
      return { success: true, data };
    } catch (error: any) {
      logError('Erro ao buscar template', error);
      return { success: false, error: error.message };
    }
  });

  /** Buscar templates por tipo de exame */
  ipcMain.handle('template:findByTipoExame', async (_event, tipoExameId: string) => {
    try {
      const data = await templateService.findByTipoExame(tipoExameId);
      return { success: true, data };
    } catch (error: any) {
      logError('Erro ao buscar templates por tipo de exame', error);
      return { success: false, error: error.message };
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
      logInfo(`Template criado: ${template.nome}`);
      return { success: true, data: template, message: 'Template criado com sucesso' };
    } catch (error: any) {
      logError('Erro ao criar template', error);
      return { success: false, error: error.message };
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
      logInfo(`Template atualizado: ${id}`);
      return { success: true, data: template, message: 'Template atualizado com sucesso' };
    } catch (error: any) {
      logError('Erro ao atualizar template', error);
      return { success: false, error: error.message };
    }
  });

  /** Excluir template */
  ipcMain.handle('template:delete', async (_event, id: string) => {
    try {
      await templateService.delete(id);
      logInfo(`Template excluído: ${id}`);
      return { success: true, message: 'Template excluído com sucesso' };
    } catch (error: any) {
      logError('Erro ao excluir template', error);
      return { success: false, error: error.message };
    }
  });

  // ─── Seções ───────────────────────────────────────────

  /** Listar seções de um template */
  ipcMain.handle('template:findSecoes', async (_event, templateId: string) => {
    try {
      const data = await templateService.findSecoesByTemplate(templateId);
      return { success: true, data };
    } catch (error: any) {
      logError('Erro ao listar seções do template', error);
      return { success: false, error: error.message };
    }
  });

  /** Criar seção */
  ipcMain.handle('template:createSecao', async (_event, data: { template_id: string; nome: string; ordem: number; conteudo?: string }) => {
    try {
      if (!data.nome || !data.nome.trim()) {
        return { success: false, error: 'Nome da seção é obrigatório' };
      }
      const secao = await templateService.createSecao({
        template_id: data.template_id,
        nome: sanitizeInput(data.nome.trim()),
        ordem: data.ordem ?? 0,
        conteudo: data.conteudo || undefined,
      });
      return { success: true, data: secao, message: 'Seção criada com sucesso' };
    } catch (error: any) {
      logError('Erro ao criar seção', error);
      return { success: false, error: error.message };
    }
  });

  /** Atualizar seção */
  ipcMain.handle('template:updateSecao', async (_event, id: string, data: { nome?: string; ordem?: number; conteudo?: string }) => {
    try {
      const updateData: Record<string, unknown> = {};
      if (data.nome !== undefined) updateData.nome = sanitizeInput(data.nome);
      if (data.ordem !== undefined) updateData.ordem = data.ordem;
      if (data.conteudo !== undefined) updateData.conteudo = data.conteudo;

      const secao = await templateService.updateSecao(id, updateData);
      return { success: true, data: secao, message: 'Seção atualizada com sucesso' };
    } catch (error: any) {
      logError('Erro ao atualizar seção', error);
      return { success: false, error: error.message };
    }
  });

  /** Excluir seção */
  ipcMain.handle('template:deleteSecao', async (_event, id: string) => {
    try {
      await templateService.deleteSecao(id);
      return { success: true, message: 'Seção excluída com sucesso' };
    } catch (error: any) {
      logError('Erro ao excluir seção', error);
      return { success: false, error: error.message };
    }
  });

  /** Reordenar seções */
  ipcMain.handle('template:reordenarSecoes', async (_event, templateId: string, idsOrdenados: string[]) => {
    try {
      await templateService.reordenarSecoes(templateId, idsOrdenados);
      return { success: true, message: 'Seções reordenadas com sucesso' };
    } catch (error: any) {
      logError('Erro ao reordenar seções', error);
      return { success: false, error: error.message };
    }
  });

  /** Gerar PDF de preview do laudo (exibido no Dialog via protocolo customizado) */
  ipcMain.handle('template:previewPDF', async (_event, opts: { html: string; margins?: { top: number; right: number; bottom: number; left: number } }) => {
    let win: BrowserWindow | null = null;
    try {
      const { html, margins } = opts;
      const hasMargins = margins && (margins.top > 0 || margins.right > 0 || margins.bottom > 0 || margins.left > 0);
      const bodyPadding = hasMargins ? '15px 20px' : '50px 60px';

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
  .placeholder-tag { color: #1a73e8; font-family: monospace; }
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

      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(docHtml)}`);
      await new Promise(resolve => setTimeout(resolve, 800));

      const pdfMargins = margins
        ? {
            top:    margins.top    * CM_TO_INCHES,
            right:  margins.right  * CM_TO_INCHES,
            bottom: margins.bottom * CM_TO_INCHES,
            left:   margins.left   * CM_TO_INCHES,
          }
        : { top: 0, bottom: 0, left: 0, right: 0 };

      const buffer = Buffer.from(await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        margins: pdfMargins,
      }));

      win.close();
      win = null;

      const base64PDF = buffer.toString('base64');
      logInfo('PDF de preview gerado com sucesso (imagens otimizadas)');
      return { success: true, data: base64PDF };
    } catch (error: any) {
      logError('Erro ao gerar PDF de preview', error);
      if (win) { try { win.close(); } catch { /* ignora */ } }
      return { success: false, error: error.message };
    }
  });
};
