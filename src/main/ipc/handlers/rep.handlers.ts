import { ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import { logInfo, logError } from '../../utils/logger.js';
import { sanitizeInput } from '../../security/index.js';
import { repService } from '../../services/rep.service.js';
import { REPRow } from '../../types/database.js';

/**
 * Registra handlers IPC para operações de REP
 */
export const registerRepHandlers = (): void => {
  /**
   * Criar nova REP
   */
  ipcMain.handle('rep:create', async (_event, data: Omit<REPRow, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      if (!data.numero || !data.numero.trim()) {
        return { success: false, error: 'Número da REP é obrigatório.' };
      }

      // Verificar duplicidade
      const existing = await repService.findByNumero(data.numero.trim());
      if (existing) {
        return { success: false, error: `Já existe outra REP com o número '${data.numero}'.` };
      }

      const sanitizedData: any = {
        id: randomUUID(),
        numero: sanitizeInput(data.numero.trim()),
        solicitante_id: data.solicitante_id || null,
        tipo_exame_id: data.tipo_exame_id || null,
        data_requisicao: data.data_requisicao,
        status: 'Pendente',
        tipo_solicitacao: data.tipo_solicitacao ? sanitizeInput(data.tipo_solicitacao) : null,
        numero_documento: data.numero_documento ? sanitizeInput(data.numero_documento) : null,
        data_documento: data.data_documento || null,
        autoridade_solicitante: data.autoridade_solicitante ? sanitizeInput(data.autoridade_solicitante) : null,
        nome_envolvido: data.nome_envolvido ? sanitizeInput(data.nome_envolvido) : null,
        data_acionamento: data.data_acionamento || null,
        data_chegada: data.data_chegada || null,
        data_saida: data.data_saida || null,
        local_fato: data.local_fato ? sanitizeInput(data.local_fato) : null,
        latitude: data.latitude != null ? data.latitude : null,
        longitude: data.longitude != null ? data.longitude : null,
        lacre_entrada: data.lacre_entrada ? sanitizeInput(data.lacre_entrada) : null,
        lacre_saida: data.lacre_saida ? sanitizeInput(data.lacre_saida) : null,
        usuario_id: data.usuario_id || null,
        numero_bo: data.numero_bo ? sanitizeInput(data.numero_bo) : null,
        numero_ip: data.numero_ip ? sanitizeInput(data.numero_ip) : null,
        observacoes: data.observacoes ? sanitizeInput(data.observacoes) : null,
        prazo: data.prazo || null,
      };

      const rep = await repService.create(sanitizedData);
      logInfo('REP criada', { numero: data.numero, id: rep.id });
      return { success: true, data: rep };
    } catch (error) {
      logError('Erro ao criar REP', { data, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  });

  /**
   * Buscar todas as REPs
   */
  ipcMain.handle('rep:findAll', async () => {
    try {
      const reps = await repService.findAllOrdered();
      return { success: true, data: reps, total: reps.length };
    } catch (error) {
      logError('Erro ao buscar REPs', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  });

  /**
   * Buscar REP por ID
   */
  ipcMain.handle('rep:findById', async (_event, id: string) => {
    try {
      if (!id) return { success: false, error: 'ID inválido' };
      const rep = await repService.findById(id);
      if (!rep) return { success: false, error: 'REP não encontrada' };
      return { success: true, data: rep };
    } catch (error) {
      logError('Erro ao buscar REP por ID', { id, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  });

  /**
   * Atualizar REP
   */
  ipcMain.handle('rep:update', async (_event, id: string, data: Partial<REPRow>) => {
    try {
      if (!id) return { success: false, error: 'ID inválido' };

      const sanitizedData: any = {};
      if (data.numero) sanitizedData.numero = sanitizeInput(data.numero);
      if (data.solicitante_id !== undefined) sanitizedData.solicitante_id = data.solicitante_id;
      if (data.tipo_exame_id !== undefined) sanitizedData.tipo_exame_id = data.tipo_exame_id;
      if (data.data_requisicao) sanitizedData.data_requisicao = data.data_requisicao;
      if (data.status) sanitizedData.status = data.status;
      if (data.tipo_solicitacao !== undefined) sanitizedData.tipo_solicitacao = sanitizeInput(data.tipo_solicitacao);
      if (data.numero_documento !== undefined) sanitizedData.numero_documento = sanitizeInput(data.numero_documento);
      if (data.data_documento !== undefined) sanitizedData.data_documento = data.data_documento;
      if (data.autoridade_solicitante !== undefined) sanitizedData.autoridade_solicitante = sanitizeInput(data.autoridade_solicitante);
      if (data.nome_envolvido !== undefined) sanitizedData.nome_envolvido = sanitizeInput(data.nome_envolvido);
      if (data.data_acionamento !== undefined) sanitizedData.data_acionamento = data.data_acionamento;
      if (data.data_chegada !== undefined) sanitizedData.data_chegada = data.data_chegada;
      if (data.data_saida !== undefined) sanitizedData.data_saida = data.data_saida;
      if (data.local_fato !== undefined) sanitizedData.local_fato = sanitizeInput(data.local_fato);
      if (data.latitude !== undefined) sanitizedData.latitude = data.latitude;
      if (data.longitude !== undefined) sanitizedData.longitude = data.longitude;
      if (data.lacre_entrada !== undefined) sanitizedData.lacre_entrada = sanitizeInput(data.lacre_entrada);
      if (data.lacre_saida !== undefined) sanitizedData.lacre_saida = sanitizeInput(data.lacre_saida);
      if (data.numero_bo !== undefined) sanitizedData.numero_bo = sanitizeInput(data.numero_bo);
      if (data.numero_ip !== undefined) sanitizedData.numero_ip = sanitizeInput(data.numero_ip);
      if (data.observacoes !== undefined) sanitizedData.observacoes = sanitizeInput(data.observacoes);
      if (data.prazo !== undefined) sanitizedData.prazo = data.prazo;

      const updated = await repService.update(id, sanitizedData);
      return { success: true, data: updated };
    } catch (error) {
      logError('Erro ao atualizar REP', { id, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  });

  /**
   * Excluir REP
   */
  ipcMain.handle('rep:delete', async (_event, id: string) => {
    try {
      if (!id) return { success: false, error: 'ID inválido' };
      await repService.delete(id);
      return { success: true, message: 'REP excluída com sucesso!' };
    } catch (error) {
      logError('Erro ao excluir REP', { id, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  });

  /**
   * Atualizar status da REP
   */
  ipcMain.handle('rep:updateStatus', async (_event, id: string, status: string) => {
    try {
      if (!id) return { success: false, error: 'ID inválido' };
      const validStatuses = ['Pendente', 'Em Andamento', 'Concluído'];
      if (!validStatuses.includes(status)) {
        return { success: false, error: 'Status inválido' };
      }
      const updated = await repService.updateStatus(id, status);
      return { success: true, data: updated, message: `Status atualizado para "${status}"` };
    } catch (error) {
      logError('Erro ao atualizar status da REP', { id, status, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  });
}
