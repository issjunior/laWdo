import { ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import { logInfo, logError } from '../../utils/logger.js';
import { sanitizeInput } from '../../security/index.js';
import { auditCicloVida, auditDelete } from '../../services/audit-log.service.js';
import { repService } from '../../services/rep.service.js';
import { laudoService } from '../../services/laudo.service.js';
import { REPRow } from '../../types/database.js';

/**
 * Registra handlers IPC para operações de REP
 */
export const registerRepHandlers = (): void => {
  /**
   * Criar nova REP
   * template_id e perito_id são opcionais: se fornecidos, um laudo é criado automaticamente
   */
  ipcMain.handle('rep:create', async (_event, data: Omit<REPRow, 'id' | 'created_at' | 'updated_at'> & { template_id?: string; perito_id?: string }) => {
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
        data_requisicao: data.data_requisicao,
        status: 'Pendente',
      };

      if (data.solicitante_id) sanitizedData.solicitante_id = data.solicitante_id;
      if (data.tipo_exame_id) sanitizedData.tipo_exame_id = data.tipo_exame_id;
      if (data.tipo_solicitacao) sanitizedData.tipo_solicitacao = sanitizeInput(data.tipo_solicitacao);
      if (data.numero_documento) sanitizedData.numero_documento = sanitizeInput(data.numero_documento);
      if (data.data_documento) sanitizedData.data_documento = data.data_documento;
      if (data.autoridade_solicitante) sanitizedData.autoridade_solicitante = sanitizeInput(data.autoridade_solicitante);
      if (data.nome_envolvido) sanitizedData.nome_envolvido = sanitizeInput(data.nome_envolvido);
      if (data.data_acionamento) sanitizedData.data_acionamento = data.data_acionamento;
      if (data.data_chegada) sanitizedData.data_chegada = data.data_chegada;
      if (data.data_saida) sanitizedData.data_saida = data.data_saida;
      if (data.local_fato) sanitizedData.local_fato = sanitizeInput(data.local_fato);
      if (data.latitude != null) sanitizedData.latitude = data.latitude;
      if (data.longitude != null) sanitizedData.longitude = data.longitude;
      if (data.lacre_entrada) sanitizedData.lacre_entrada = sanitizeInput(data.lacre_entrada);
      if (data.lacre_saida) sanitizedData.lacre_saida = sanitizeInput(data.lacre_saida);
      if (data.usuario_id) sanitizedData.usuario_id = data.usuario_id;
      if (data.numero_bo) sanitizedData.numero_bo = sanitizeInput(data.numero_bo);
      if (data.numero_ip) sanitizedData.numero_ip = sanitizeInput(data.numero_ip);
      if (data.observacoes) sanitizedData.observacoes = sanitizeInput(data.observacoes);
      if (data.prazo) sanitizedData.prazo = data.prazo;
      if (data.campos_especificos) sanitizedData.campos_especificos = data.campos_especificos;

      const rep = await repService.create(sanitizedData);
      logInfo('REP criada', { numero: data.numero, id: rep.id });

      auditCicloVida('', 'rep', rep.id, 'criacao', `REP ${data.numero} criada`, null, {
        numero: data.numero, status: 'Pendente',
        solicitante_id: data.solicitante_id, tipo_exame_id: data.tipo_exame_id,
      });

      // Criar laudo automaticamente (exceto para template sistema "Não definido")
      if (data.template_id && data.perito_id && data.template_id !== 'tpl-nao-definido') {
        try {
          await laudoService.criarLaudoInicial({
            rep_id: rep.id,
            perito_id: data.perito_id,
            template_id: data.template_id,
          });
          logInfo('Laudo criado automaticamente para REP', { repId: rep.id });
          auditCicloVida('', 'laudo', rep.id, 'criacao',
            `Laudo criado automaticamente para REP ${data.numero}`,
            null,
            { rep_id: rep.id, perito_id: data.perito_id, template_id: data.template_id },
          );
        } catch (laudoError) {
          logError('Erro ao criar laudo automático — REP criada sem laudo', laudoError);
          // Não falha a criação da REP se o laudo falhar
        }
      }

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

  ipcMain.handle('rep:findByNumero', async (_event, numero: string) => {
    try {
      if (!numero) return { success: false, error: 'Número inválido' };
      const rep = await repService.findByNumero(numero.trim());
      if (!rep) return { success: false, error: 'REP não encontrada' };
      return { success: true, data: rep };
    } catch (error) {
      logError('Erro ao buscar REP por número', { numero, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  });

  /**
   * Atualizar REP
   */
  ipcMain.handle('rep:update', async (_event, id: string, data: Partial<REPRow> & { template_id?: string; perito_id?: string }) => {
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
      if (data.campos_especificos !== undefined) sanitizedData.campos_especificos = data.campos_especificos;

      const repAntes = await repService.findById(id);
      const statusAnterior = repAntes?.status;
      const updated = await repService.update(id, sanitizedData);

      if (sanitizedData.status && sanitizedData.status !== statusAnterior) {
        auditCicloVida('', 'rep', id, 'transicao_status',
          `REP ${repAntes?.numero ?? id}: ${statusAnterior ?? '?'} → ${sanitizedData.status}`,
          { status: statusAnterior },
          { status: sanitizedData.status },
        );
      }

      if (data.template_id && data.template_id !== 'tpl-nao-definido') {
        const laudoExistente = await laudoService.findByRepId(id);
        if (!laudoExistente) {
          if (data.perito_id) {
            try {
                await laudoService.criarLaudoInicial({
                  rep_id: id,
                  perito_id: data.perito_id,
                  template_id: data.template_id,
                });
                logInfo('Laudo criado automaticamente na atualização da REP', { repId: id });
                auditCicloVida('', 'laudo', id, 'criacao',
                  `Laudo criado automaticamente na atualização da REP ${id}`,
                  null,
                  { rep_id: id, perito_id: data.perito_id, template_id: data.template_id },
                );
            } catch (laudoError) {
              logError('Erro ao criar laudo automático na edição da REP', laudoError);
            }
          }
        } else if (laudoExistente.template_id !== data.template_id) {
          try {
            await laudoService.update(laudoExistente.id, { template_id: data.template_id });
            logInfo('Template do laudo atualizado na edição da REP', { repId: id, laudoId: laudoExistente.id });
          } catch (laudoError) {
            logError('Erro ao atualizar template do laudo', laudoError);
          }
        }
      }

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
   * Excluir REP (remove o laudo vinculado antes para evitar erro de FK)
   */
  ipcMain.handle('rep:delete', async (_event, id: string) => {
    try {
      if (!id) return { success: false, error: 'ID inválido' };

      const rep = await repService.findById(id);

      await laudoService.deletarPorRepId(id);

      await repService.delete(id);
      logInfo('REP excluída', { id });
      auditDelete('', 'reps', id, `REP ${rep?.numero ?? id} excluída`);
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
      const repAntes = await repService.findById(id);
      const statusAnterior = repAntes?.status;
      const updated = await repService.updateStatus(id, status);

      auditCicloVida('', 'rep', id, 'transicao_status',
        `REP ${repAntes?.numero ?? id}: ${statusAnterior ?? '?'} → ${status}`,
        statusAnterior ? { status: statusAnterior } : null,
        { status },
      );

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
