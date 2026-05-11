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

/** Mapeamento de renomeação: chave_antiga -> chave_nova (migração do prefixo rep_) */
const RENOMEACOES: Record<string, string> = {
  'rep_numero': 'numero_rep',
  'rep_data_requisicao': 'data_recebimento_rep',
  'rep_tipo_solicitacao': 'tipo_solicitacao_rep',
  'rep_numero_documento': 'numero_solicitacao_rep',
  'rep_data_documento': 'data_solicitacao_rep',
  'rep_autoridade_solicitante': 'autoridade_solicitante_rep',
  'rep_nome_envolvido': 'nome_envolvido',
  'rep_local_fato': 'local_fato',
  'rep_latitude': 'latitude',
  'rep_longitude': 'longitude',
  'rep_data_acionamento': 'data_acionamento_local',
  'rep_data_chegada': 'data_chegada_local',
  'rep_data_saida': 'data_saida_local',
  'rep_numero_bo': 'numero_bo',
  'rep_numero_ip': 'numero_ip',
  'rep_lacre_entrada': 'lacre_entrada',
  'rep_lacre_saida': 'lacre_saida',
  'rep_observacoes': 'observacoes_rep',
};

const PLACEHOLDERS_SISTEMA: PlaceholderCreateData[] = [
  // Tabela reps (18)
  { chave: 'numero_rep', valor: '', descricao: 'Nº da REP', categoria: 'REP' },
  { chave: 'data_recebimento_rep', valor: '', descricao: 'Data de recebimento da REP', categoria: 'REP' },
  { chave: 'tipo_solicitacao_rep', valor: '', descricao: 'Tipo de solicitação (Ofício, BOU, BO PM, etc.)', categoria: 'REP' },
  { chave: 'numero_solicitacao_rep', valor: '', descricao: 'Nº da Solicitação (Ofício/Requisição)', categoria: 'REP' },
  { chave: 'data_solicitacao_rep', valor: '', descricao: 'Data do documento de solicitação', categoria: 'REP' },
  { chave: 'autoridade_solicitante_rep', valor: '', descricao: 'Autoridade solicitante', categoria: 'REP' },
  { chave: 'nome_envolvido', valor: '', descricao: 'Nome da pessoa envolvida', categoria: 'REP' },
  { chave: 'local_fato', valor: '', descricao: 'Local do fato (exames de local)', categoria: 'REP' },
  { chave: 'latitude', valor: '', descricao: 'Latitude do local (exames de local)', categoria: 'REP' },
  { chave: 'longitude', valor: '', descricao: 'Longitude do local (exames de local)', categoria: 'REP' },
  { chave: 'data_acionamento_local', valor: '', descricao: 'Data/Hora do acionamento (exames de local)', categoria: 'REP' },
  { chave: 'data_chegada_local', valor: '', descricao: 'Data/Hora de chegada ao local (exames de local)', categoria: 'REP' },
  { chave: 'data_saida_local', valor: '', descricao: 'Data/Hora de saída do local (exames de local)', categoria: 'REP' },
  { chave: 'numero_bo', valor: '', descricao: 'Nº do Boletim de Ocorrência', categoria: 'REP' },
  { chave: 'numero_ip', valor: '', descricao: 'Nº do Inquérito Policial', categoria: 'REP' },
  { chave: 'lacre_entrada', valor: '', descricao: 'Nº do lacre de entrada', categoria: 'REP' },
  { chave: 'lacre_saida', valor: '', descricao: 'Nº do lacre de saída', categoria: 'REP' },
  { chave: 'observacoes_rep', valor: '', descricao: 'Observações gerais da REP', categoria: 'REP' },
  // Relacionamentos (3)
  { chave: 'solicitante_nome', valor: '', descricao: 'Nome do órgão solicitante', categoria: 'REP' },
  { chave: 'tipo_exame_nome', valor: '', descricao: 'Nome do tipo de exame', categoria: 'REP' },
  { chave: 'tipo_exame_codigo', valor: '', descricao: 'Código do exame no GDL', categoria: 'REP' },
  // Perito (4)
  { chave: 'perito_nome', valor: '', descricao: 'Nome completo do perito', categoria: 'Perito' },
  { chave: 'perito_cargo', valor: '', descricao: 'Cargo do perito', categoria: 'Perito' },
  { chave: 'perito_lotacao', valor: '', descricao: 'Lotação/unidade do perito', categoria: 'Perito' },
  { chave: 'perito_matricula', valor: '', descricao: 'Matrícula funcional do perito', categoria: 'Perito' },
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

    if (row.categoria === 'REP' || row.categoria === 'Perito') {
      throw new Error('Placeholders do sistema não podem ser excluídos.');
    }

    return super.delete(id);
  }

  /**
   * Migrar placeholders do sistema renomeando chaves antigas para as novas.
   * Idempotente: pode ser executado múltiplas vezes sem efeitos colaterais.
   */
  async migrateSistema(): Promise<{ migradas: number; puladas: number }> {
    let migradas = 0;
    let puladas = 0;
    try {
      for (const [oldChave, newChave] of Object.entries(RENOMEACOES)) {
        // Verifica se a chave nova já existe (já migrado ou instalação limpa)
        const jaMigrado = await this.executeCustomQuery<{ id: string }>(
          'SELECT id FROM placeholders WHERE chave = ?', [newChave]
        );
        if (jaMigrado.length > 0) {
          puladas++;
          continue;
        }
        // Verifica se a chave antiga existe (instalação existente)
        const existeAntigo = await this.executeCustomQuery<{ id: string }>(
          'SELECT id FROM placeholders WHERE chave = ?', [oldChave]
        );
        if (existeAntigo.length > 0) {
          await this.executeCustomQuery(
            'UPDATE placeholders SET chave = ?, updated_at = ? WHERE chave = ?',
            [newChave, new Date().toISOString(), oldChave]
          );
          migradas++;
        }
      }
      logInfo('Migração de placeholders concluída', { migradas, puladas });
    } catch (error) {
      logError('Erro ao migrar placeholders', error);
      throw error;
    }
    return { migradas, puladas };
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
