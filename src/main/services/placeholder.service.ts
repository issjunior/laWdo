import { BaseService } from './base.service.js';
import { logInfo, logError } from '../utils/logger.js';

export interface PlaceholderRow {
  id: string;
  chave: string;
  valor: string;
  descricao: string | null;
  categoria: string | null;
  created_at: string;
  updated_at: string;
}

type PlaceholderCreateData = Omit<PlaceholderRow, 'id' | 'created_at' | 'updated_at'>;

const PLACEHOLDERS_SISTEMA: PlaceholderCreateData[] = [
  // Tabela reps (19)
  { chave: 'rep_numero', valor: '', descricao: 'Nº da REP', categoria: 'REP' },
  { chave: 'rep_data_requisicao', valor: '', descricao: 'Data de recebimento da REP', categoria: 'REP' },
  { chave: 'rep_prazo', valor: '', descricao: 'Prazo da REP', categoria: 'REP' },
  { chave: 'rep_tipo_solicitacao', valor: '', descricao: 'Tipo de solicitação (Ofício, BOU, BO PM, etc.)', categoria: 'REP' },
  { chave: 'rep_numero_documento', valor: '', descricao: 'Nº da Solicitação (Ofício/Requisição)', categoria: 'REP' },
  { chave: 'rep_data_documento', valor: '', descricao: 'Data do documento de solicitação', categoria: 'REP' },
  { chave: 'rep_autoridade_solicitante', valor: '', descricao: 'Autoridade solicitante', categoria: 'REP' },
  { chave: 'rep_nome_envolvido', valor: '', descricao: 'Nome da pessoa envolvida', categoria: 'REP' },
  { chave: 'rep_local_fato', valor: '', descricao: 'Local do fato (exames de local)', categoria: 'REP' },
  { chave: 'rep_latitude', valor: '', descricao: 'Latitude do local (exames de local)', categoria: 'REP' },
  { chave: 'rep_longitude', valor: '', descricao: 'Longitude do local (exames de local)', categoria: 'REP' },
  { chave: 'rep_data_acionamento', valor: '', descricao: 'Data/Hora do acionamento (exames de local)', categoria: 'REP' },
  { chave: 'rep_data_chegada', valor: '', descricao: 'Data/Hora de chegada ao local (exames de local)', categoria: 'REP' },
  { chave: 'rep_data_saida', valor: '', descricao: 'Data/Hora de saída do local (exames de local)', categoria: 'REP' },
  { chave: 'rep_numero_bo', valor: '', descricao: 'Nº do Boletim de Ocorrência', categoria: 'REP' },
  { chave: 'rep_numero_ip', valor: '', descricao: 'Nº do Inquérito Policial', categoria: 'REP' },
  { chave: 'rep_lacre_entrada', valor: '', descricao: 'Nº do lacre de entrada', categoria: 'REP' },
  { chave: 'rep_lacre_saida', valor: '', descricao: 'Nº do lacre de saída', categoria: 'REP' },
  { chave: 'rep_observacoes', valor: '', descricao: 'Observações gerais da REP', categoria: 'REP' },
  // Relacionamentos (3)
  { chave: 'solicitante_nome', valor: '', descricao: 'Nome do órgão solicitante', categoria: 'REP' },
  { chave: 'tipo_exame_nome', valor: '', descricao: 'Nome do tipo de exame', categoria: 'REP' },
  { chave: 'tipo_exame_codigo', valor: '', descricao: 'Código do exame no GDL', categoria: 'REP' },
];

class PlaceholderService extends BaseService<PlaceholderRow> {
  constructor() {
    super('placeholders', 'id');
  }

  /**
   * Excluir um placeholder (apenas se não for do sistema)
   */
  async delete(id: string): Promise<boolean> {
    const row = await this.findById(id);
    if (!row) return false;

    if (row.categoria === 'REP') {
      throw new Error('Placeholders do sistema não podem ser excluídos.');
    }

    return super.delete(id);
  }

  /**
   * Semear placeholders do sistema (UPSERT por chave)
   */
  async seedSistema(): Promise<void> {
    try {
      for (const p of PLACEHOLDERS_SISTEMA) {
        const existing = await this.executeCustomQuery<PlaceholderRow>(
          'SELECT id FROM placeholders WHERE chave = ?',
          [p.chave]
        );

        if (existing.length === 0) {
          await this.create(p);
        }
      }
      logInfo('Seed de placeholders do sistema concluído', { total: PLACEHOLDERS_SISTEMA.length });
    } catch (error) {
      logError('Erro ao semear placeholders do sistema', error);
      throw error;
    }
  }
}

export const placeholderService = new PlaceholderService();
export default placeholderService;
