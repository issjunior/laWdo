import { ipcMain } from 'electron';
import { logDebug, logError } from '../../utils/logger.js';
import { auditCicloVida, auditDelete } from '../../services/audit-log.service.js';
import { laudoService } from '../../services/laudo.service.js';
import { repService } from '../../services/rep.service.js';
import {
  exportarLaudo,
  verificarLibreOffice,
  type ExportarParams,
} from '../../services/exportacao.service.js';

type RespostasWizard = Record<string, string | string[]>;

type GerarWizardParams = {
  laudo_id: string;
  wizard_id: string;
  template_id: string;
  respostas: RespostasWizard;
  pecas_selecionadas?: string[];
};

/**
 * Registra handlers IPC para operações de Laudo
 */
export const registerLaudoHandlers = (): void => {
  /**
   * Buscar laudo por ID
   */
  ipcMain.handle('laudo:findById', async (_event, id: string) => {
    try {
      if (!id) return { success: false, error: 'ID inválido' };
      const laudo = await laudoService.findById(id);
      return { success: true, data: laudo };
    } catch (error) {
      logError('Erro ao buscar laudo por ID', { id, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  /**
   * Buscar laudo por REP (retorna o primeiro — compatibilidade legada)
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
   * Buscar todos os laudos de uma REP (template + wizard)
   */
  ipcMain.handle('laudo:findAllByRepId', async (_event, repId: string) => {
    try {
      if (!repId) return { success: false, error: 'ID da REP inválido' };
      const laudos = await laudoService.findAllByRepId(repId);
      return { success: true, data: laudos };
    } catch (error) {
      logError('Erro ao buscar laudos por REP', { repId, error });
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

      const rep = await repService.findById(laudo.rep_id);
      const repNumero = rep?.numero ?? laudo.rep_id;

      auditCicloVida('', 'laudo', laudoId, 'atualizacao',
        `Laudo da Requisição ${repNumero} salvo (versão ${laudo?.versao ?? '?'})`,
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

      const rep = await repService.findById(data.rep_id);
      const repNumero = rep?.numero ?? data.rep_id;

      auditCicloVida('', 'laudo', laudo.id, 'criacao',
        `Laudo da Requisição ${repNumero} iniciado`,
        null,
        { rep_id: data.rep_id, perito_id: data.perito_id, template_id: data.template_id, status: 'Em andamento', versao: 1 },
      );

      return { success: true, data: laudo };
    } catch (error) {
      logError('Erro ao criar laudo para Requisição', { rep_id: data.rep_id, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  });

  /**
   * Gerar laudo wizard (preenche laudo existente com peças)
   */
  ipcMain.handle('laudo:gerarWizard', async (_event, params: GerarWizardParams) => {
    try {
      const laudo = await laudoService.gerarLaudoWizard(params);
      return { success: true, data: laudo };
    } catch (error) {
      logError('Erro ao gerar laudo pelo assistente', { laudo_id: params.laudo_id, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  /**
   * Salvar progresso do wizard (respostas parciais)
   */
  ipcMain.handle('laudo:salvarProgressoWizard', async (_event, laudoId: string, respostas: RespostasWizard) => {
    try {
      await laudoService.salvarProgressoWizard(laudoId, respostas);
      return { success: true, message: 'Progresso salvo' };
    } catch (error) {
      logError('Erro ao salvar progresso do assistente', { laudoId, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  /**
   * Buscar respostas salvas de um laudo wizard
   */
  ipcMain.handle('laudo:getRespostasWizard', async (_event, laudoId: string) => {
    try {
      const respostas = await laudoService.getRespostasWizard(laudoId);
      return { success: true, data: respostas };
    } catch (error) {
      logError('Erro ao buscar respostas do wizard', { laudoId, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  /**
   * Excluir laudo e resetar status da REP para Pendente
   * @param laudoId ID do laudo
   * @param userId ID do usuário (opcional, para auditoria)
   */
  ipcMain.handle('laudo:delete', async (_event, laudoId: string, userId?: string) => {
    try {
      if (!laudoId) return { success: false, error: 'ID do laudo inválido' };

      const laudo = await laudoService.findById(laudoId);
      if (!laudo) return { success: false, error: 'Laudo não encontrado' };

      const statusAnterior = laudo.status;
      const { rep_id } = await laudoService.deletar(laudoId);
      await repService.updateStatus(rep_id, 'Pendente');

      const rep = await repService.findById(rep_id);
      const repNumero = rep?.numero ?? rep_id;

      const uid = userId || '';
      logDebug('Laudo excluído e REP resetada para Pendente', { laudoId, repId: rep_id, status: statusAnterior });
      auditDelete(uid, 'laudos', laudoId,
        `Laudo da Requisição ${repNumero} excluído. Requisição ${repNumero} voltou a Pendente`,
        `REP ${rep_id} resetada para Pendente`);
      auditCicloVida(uid, 'rep', rep_id, 'transicao_status',
        `Requisição ${repNumero} voltou a Pendente`,
        { status: statusAnterior },
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

      const rep = await repService.findById(laudoAntes.rep_id);
      const repNumero = rep?.numero ?? laudoAntes.rep_id;

      auditCicloVida('', 'laudo', laudoId, 'transicao_status',
        `Laudo da Requisição ${repNumero}: ${statusAnterior ?? '?'} → ${novoStatus}`,
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

  /**
   * Exportar laudo (PDF, DOCX ou ODT)
   */
  ipcMain.handle('laudo:exportar', async (_event, params: ExportarParams) => {
    try {
      if (!params.laudoId || !params.formato) {
        return { success: false, error: 'Parâmetros inválidos' };
      }
      const result = await exportarLaudo(params);
      return result;
    } catch (error) {
      logError('Erro ao exportar laudo', { laudoId: params.laudoId, formato: params.formato, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  /**
   * Sincronizar seções condicionais/repetíveis do laudo com o template e dados da REP
   */
  ipcMain.handle('laudo:sincronizarSecoes', async (_event, laudoId: string) => {
    try {
      if (!laudoId) return { success: false, error: 'ID do laudo inválido' };
      await laudoService.sincronizarSecoesCondicionais(laudoId);
      return { success: true, message: 'Seções sincronizadas com sucesso' };
    } catch (error) {
      logError('Erro ao sincronizar seções do laudo', { laudoId, error });
      return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
    }
  });

  /**
   * Verificar se LibreOffice está disponível (para habilitar opção ODT)
   */
  ipcMain.handle('laudo:verificarLibreOffice', async () => {
    try {
      const disponivel = await verificarLibreOffice();
      return { success: true, data: disponivel };
    } catch {
      return { success: true, data: false };
    }
  });
};
