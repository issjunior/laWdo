import { ipcMain } from 'electron';
import { logError, logInfo } from '../../utils/logger.js';
import { auditCicloVida, auditDelete } from '../../services/audit-log.service.js';
import { laudoService } from '../../services/laudo.service.js';
import { repService } from '../../services/rep.service.js';

/**
 * Registra handlers IPC para operações de Laudo
 */
export const registerLaudoHandlers = (): void => {
  /**
   * Buscar laudo por REP
   */
  ipcMain.handle('laudo:findByRepId', async (_event, repId: string) => {
    try {
      if (!repId) return { success: false, error: 'ID da REP inválido' };
      const laudo = await laudoService.findByRepId(repId);
      return { success: true, data: laudo };
    } catch (error) {
      logError('Erro ao buscar laudo por REP', { repId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });

  /**
   * Listar todos os laudos com dados da REP e template
   */
  ipcMain.handle('laudo:findAll', async () => {
    try {
      const laudos = await laudoService.findAllComRep();
      return { success: true, data: laudos };
    } catch (error) {
      logError('Erro ao buscar todos os laudos', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });

  /**
   * Atualizar conteúdo HTML de um laudo
   */
  ipcMain.handle('laudo:updateConteudo', async (_event, laudoId: string, conteudo: string) => {
    try {
      if (!laudoId) return { success: false, error: 'ID do laudo inválido' };
      if (typeof conteudo !== 'string') return { success: false, error: 'Conteúdo inválido' };
      const laudo = await laudoService.updateConteudo(laudoId, conteudo);

      auditCicloVida('', 'laudo', laudoId, 'atualizacao',
        `Conteúdo do laudo ${laudoId} atualizado (versão ${laudo?.versao ?? '?'})`,
        null,
        { versao: laudo?.versao },
      );

      return { success: true, data: laudo };
    } catch (error) {
      logError('Erro ao atualizar conteúdo do laudo', { laudoId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });

  /**
   * Criar laudo para uma REP existente (via botão "Criar Laudo" na tabela de REPs)
   */
  ipcMain.handle('laudo:create', async (_event, data: { rep_id: string; perito_id: string; template_id: string }) => {
    try {
      if (!data.rep_id) return { success: false, error: 'ID da REP é obrigatório' };
      if (!data.perito_id) return { success: false, error: 'ID do perito é obrigatório' };
      if (!data.template_id) return { success: false, error: 'ID do template é obrigatório' };

      const laudo = await laudoService.criarLaudoInicial({
        rep_id: data.rep_id,
        perito_id: data.perito_id,
        template_id: data.template_id,
      });

      auditCicloVida('', 'laudo', laudo.id, 'criacao',
        `Laudo criado para REP ${data.rep_id}`,
        null,
        { rep_id: data.rep_id, perito_id: data.perito_id, template_id: data.template_id, status: 'Em andamento', versao: 1 },
      );

      return { success: true, data: laudo };
    } catch (error) {
      logError('Erro ao criar laudo', { data, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });

  /**
   * Excluir laudo e resetar status da REP para Pendente
   */
  ipcMain.handle('laudo:delete', async (_event, laudoId: string) => {
    try {
      if (!laudoId) return { success: false, error: 'ID do laudo inválido' };

      const { rep_id } = await laudoService.deletar(laudoId);
      await repService.updateStatus(rep_id, 'Pendente');

      logInfo('Laudo excluído e REP resetada para Pendente', { laudoId, repId: rep_id });
      auditDelete('', 'laudos', laudoId, `Laudo ${laudoId} excluído`, `REP ${rep_id} resetada para Pendente`);
      auditCicloVida('', 'rep', rep_id, 'transicao_status',
        `REP ${rep_id} resetada para Pendente (laudo excluído)`,
        { status: 'Concluído' },
        { status: 'Pendente', motivo: 'laudo_excluido' },
      );
      return { success: true, message: 'Laudo excluído. A REP voltou para o status Pendente.' };
    } catch (error) {
      logError('Erro ao excluir laudo', { laudoId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });

  /**
   * Atualizar status do laudo (Em andamento → Concluído → Entregue)
   */
  ipcMain.handle('laudo:updateStatus', async (_event, laudoId: string, novoStatus: string) => {
    try {
      if (!laudoId) return { success: false, error: 'ID do laudo inválido' };
      const statusValidos = ['Em andamento', 'Concluído', 'Entregue'];
      if (!statusValidos.includes(novoStatus)) {
        return { success: false, error: `Status inválido. Use: ${statusValidos.join(', ')}` };
      }

      const laudoAntes = await laudoService.findById(laudoId);
      if (!laudoAntes) return { success: false, error: 'Laudo não encontrado' };

      const statusAnterior = laudoAntes.status;
      const laudo = await laudoService.updateStatus(laudoId, novoStatus);

      auditCicloVida('', 'laudo', laudoId, 'transicao_status',
        `Laudo ${laudoId}: ${statusAnterior ?? '?'} → ${novoStatus}`,
        { status: statusAnterior, data_conclusao: laudoAntes.data_conclusao, data_entrega: laudoAntes.data_entrega },
        { status: novoStatus, data_conclusao: laudo.data_conclusao, data_entrega: laudo.data_entrega },
      );

      return { success: true, data: laudo, message: `Status do laudo atualizado para "${novoStatus}"` };
    } catch (error) {
      logError('Erro ao atualizar status do laudo', { laudoId, novoStatus, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });
};
