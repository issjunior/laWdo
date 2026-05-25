import { BaseService } from './base.service.js';
import { logInfo, logError } from '../utils/logger.js';
import { executeNonQuery } from '../database/sqlite.js';

export interface PlaceholderRow {
  id: string;
  chave: string;
  valor: string;
  descricao: string | null;
  categoria_id: string | null;
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
  'numeracao_veiculo': 'veiculo',
  'numeracao_placa': 'placa',
  'numeracao_fabricacao': 'fabricacao_modelo',
  'numeracao_cor': 'cor',
  'numeracao_conservacao': 'conservacao',
  'numeracao_chassi': 'chassi',
  'numeracao_chassi_revelado': 'chassi_revelado',
  'numeracao_motor': 'motor',
  'numeracao_motor_revelado': 'motor_revelado',
};

const EXAM_PLACEHOLDER_CATEGORIES = [
  { id: 'cat-exam-I-801', codigo: 'I-801', label: 'I-801 - Numerações Identificadoras', cor: 'amber', icone: 'Car', is_sistema: 1, ordem: 10 },
];

const CAMPOS_ESPECIFICOS_PLACEHOLDERS: PlaceholderCreateData[] = [
  { chave: 'veiculo',                    valor: '', descricao: 'Marca, modelo ou tipo do veículo periciado',       categoria_id: 'cat-exam-I-801' },
  { chave: 'placa',                      valor: '', descricao: 'Placa de identificação do veículo',                 categoria_id: 'cat-exam-I-801' },
  { chave: 'fabricacao_modelo',          valor: '', descricao: 'Ano de fabricação e modelo do veículo',             categoria_id: 'cat-exam-I-801' },
  { chave: 'cor',                        valor: '', descricao: 'Cor do veículo',                                     categoria_id: 'cat-exam-I-801' },
  { chave: 'conservacao',                valor: '', descricao: 'Estado de conservação do veículo',                   categoria_id: 'cat-exam-I-801' },
  { chave: 'chassi',                     valor: '', descricao: 'Nº do chassi (até 17 caracteres alfanuméricos)',    categoria_id: 'cat-exam-I-801' },
  { chave: 'chassi_revelado',            valor: '', descricao: 'Chassi após revelação química',                      categoria_id: 'cat-exam-I-801' },
  { chave: 'motor',                      valor: '', descricao: 'Nº do motor (até 12 caracteres alfanuméricos)',     categoria_id: 'cat-exam-I-801' },
  { chave: 'motor_revelado',             valor: '', descricao: 'Motor após revelação química',                       categoria_id: 'cat-exam-I-801' },
];

function getExamCategoryId(codigo: string): string {
  return `cat-exam-${codigo}`;
}

const PLACEHOLDERS_SISTEMA: PlaceholderCreateData[] = [
  // Tabela reps (18)
  { chave: 'numero_rep', valor: '', descricao: 'Nº da REP', categoria_id: 'cat-rep' },
  { chave: 'data_recebimento_rep', valor: '', descricao: 'Data de recebimento da REP', categoria_id: 'cat-rep' },
  { chave: 'tipo_solicitacao_rep', valor: '', descricao: 'Tipo de solicitação (Ofício, BOU, BO PM, etc.)', categoria_id: 'cat-rep' },
  { chave: 'numero_solicitacao_rep', valor: '', descricao: 'Nº da Solicitação (Ofício/Requisição)', categoria_id: 'cat-rep' },
  { chave: 'data_solicitacao_rep', valor: '', descricao: 'Data do documento de solicitação', categoria_id: 'cat-rep' },
  { chave: 'autoridade_solicitante_rep', valor: '', descricao: 'Autoridade solicitante', categoria_id: 'cat-rep' },
  { chave: 'nome_envolvido', valor: '', descricao: 'Nome da pessoa envolvida', categoria_id: 'cat-rep' },
  { chave: 'local_fato', valor: '', descricao: 'Local do fato (exames de local)', categoria_id: 'cat-rep' },
  { chave: 'latitude', valor: '', descricao: 'Latitude do local (exames de local)', categoria_id: 'cat-rep' },
  { chave: 'longitude', valor: '', descricao: 'Longitude do local (exames de local)', categoria_id: 'cat-rep' },
  { chave: 'data_acionamento_local', valor: '', descricao: 'Data/Hora do acionamento (exames de local)', categoria_id: 'cat-rep' },
  { chave: 'data_chegada_local', valor: '', descricao: 'Data/Hora de chegada ao local (exames de local)', categoria_id: 'cat-rep' },
  { chave: 'data_saida_local', valor: '', descricao: 'Data/Hora de saída do local (exames de local)', categoria_id: 'cat-rep' },
  { chave: 'numero_bo', valor: '', descricao: 'Nº do Boletim de Ocorrência', categoria_id: 'cat-rep' },
  { chave: 'numero_ip', valor: '', descricao: 'Nº do Inquérito Policial', categoria_id: 'cat-rep' },
  { chave: 'lacre_entrada', valor: '', descricao: 'Nº do lacre de entrada', categoria_id: 'cat-rep' },
  { chave: 'lacre_saida', valor: '', descricao: 'Nº do lacre de saída', categoria_id: 'cat-rep' },
  { chave: 'observacoes_rep', valor: '', descricao: 'Observações gerais da REP', categoria_id: 'cat-rep' },
  // Relacionamentos (3)
  { chave: 'solicitante_nome', valor: '', descricao: 'Nome do órgão solicitante', categoria_id: 'cat-rep' },
  { chave: 'tipo_exame_nome', valor: '', descricao: 'Nome do tipo de exame', categoria_id: 'cat-rep' },
  { chave: 'tipo_exame_codigo', valor: '', descricao: 'Código do exame no GDL', categoria_id: 'cat-rep' },
  // Perito (4)
  { chave: 'perito_nome', valor: '', descricao: 'Nome completo do perito', categoria_id: 'cat-perito' },
  { chave: 'perito_cargo', valor: '', descricao: 'Cargo do perito', categoria_id: 'cat-perito' },
  { chave: 'perito_lotacao', valor: '', descricao: 'Lotação/unidade do perito', categoria_id: 'cat-perito' },
  { chave: 'perito_matricula', valor: '', descricao: 'Matrícula funcional do perito', categoria_id: 'cat-perito' },
  // Datas (2)
  { chave: 'data_atual', valor: '', descricao: 'Data atual do sistema', categoria_id: 'cat-datas' },
  { chave: 'data_extenso_recebimento_rep', valor: '', descricao: 'Data de recebimento da REP por extenso (ex: 23 de maio de 2026)', categoria_id: 'cat-datas' },
];

class PlaceholderService extends BaseService<PlaceholderRow> {
  constructor() {
    super('placeholders', 'id');
  }

  async delete(id: string): Promise<boolean> {
    const row = await this.findById(id);
    if (!row) return false;

    const sistemaChaves = [
      ...PLACEHOLDERS_SISTEMA.map(p => p.chave),
      ...CAMPOS_ESPECIFICOS_PLACEHOLDERS.map(p => p.chave),
    ];
    if (sistemaChaves.includes(row.chave)) {
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
      // Safety net: garantir categorias de sistema antes do seed, resolvendo conflitos de label
      const categoriasSistema = [
        { id: 'cat-rep', chave: 'REP', label: 'REP/Laudo', descricao: 'Dados da Requisição de Exame Pericial e do Laudo', cor: 'blue', icone: 'FileText', is_sistema: 1, ordem: 1 },
        { id: 'cat-perito', chave: 'Perito', label: 'Perito', descricao: 'Informações do perito responsável', cor: 'violet', icone: 'UserCheck', is_sistema: 1, ordem: 2 },
        { id: 'cat-lacres', chave: 'Lacres', label: 'Lacres', descricao: 'Lacres de entrada e saída', cor: 'emerald', icone: 'ShieldCheck', is_sistema: 1, ordem: 3 },
        { id: 'cat-solicitante', chave: 'Solicitante', label: 'Solicitante', descricao: 'Dados do órgão solicitante', cor: 'orange', icone: 'Building2', is_sistema: 1, ordem: 4 },
        { id: 'cat-local', chave: 'Local', label: 'Local', descricao: 'Dados do local do fato', cor: 'teal', icone: 'MapPin', is_sistema: 1, ordem: 5 },
        { id: 'cat-datas', chave: 'Datas', label: 'Datas', descricao: 'Datas e informações temporais', cor: 'amber', icone: 'Calendar', is_sistema: 1, ordem: 6 },
        { id: 'cat-personalizados', chave: 'Personalizados', label: 'Personalizados', descricao: 'Placeholders personalizados pelo usuário', cor: 'pink', icone: 'Edit', is_sistema: 0, ordem: 7 },
        { id: 'cat-sem-categoria', chave: 'sem_categoria', label: 'Sem Categoria', descricao: 'Placeholders sem categoria definida', cor: 'slate', icone: 'Puzzle', is_sistema: 1, ordem: 999 },
      ];

      for (const cat of categoriasSistema) {
        // Resolve conflito: categoria com mesmo label mas ID diferente (criada pelo usuário)
        const conflitantes = await this.executeCustomQuery<{ id: string }>(
          'SELECT id FROM categorias_placeholders WHERE label = ? AND id != ?',
          [cat.label, cat.id]
        );

        // Guarda placeholders antes de deletar (FK ON DELETE SET NULL)
        const placeholderIds: string[] = [];
        for (const conflito of conflitantes) {
          const pids = await this.executeCustomQuery<{ id: string }>(
            'SELECT id FROM placeholders WHERE categoria_id = ?', [conflito.id]
          );
          placeholderIds.push(...pids.map(p => p.id));
        }

        // Deleta conflitantes
        for (const conflito of conflitantes) {
          await executeNonQuery('DELETE FROM categorias_placeholders WHERE id = ?', [conflito.id]);
        }

        // Insere ou atualiza a categoria do sistema
        const existente = await this.executeCustomQuery<{ id: string }>(
          'SELECT id FROM categorias_placeholders WHERE id = ?', [cat.id]
        );

        if (existente.length === 0) {
          await executeNonQuery(
            'INSERT INTO categorias_placeholders (id, chave, label, descricao, cor, icone, is_sistema, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [cat.id, cat.chave, cat.label, cat.descricao, cat.cor, cat.icone, cat.is_sistema, cat.ordem]
          );
        } else {
          await executeNonQuery(
            'UPDATE categorias_placeholders SET is_sistema = ?, chave = ?, descricao = ?, cor = ?, icone = ?, ordem = ?, updated_at = ? WHERE id = ?',
            [cat.is_sistema, cat.chave, cat.descricao, cat.cor, cat.icone, cat.ordem, new Date().toISOString(), cat.id]
          );
        }

        // Move placeholders órfãos para a categoria sistema
        for (const pid of placeholderIds) {
          await executeNonQuery(
            'UPDATE placeholders SET categoria_id = ?, updated_at = ? WHERE id = ?',
            [cat.id, new Date().toISOString(), pid]
          );
        }
      }

      for (const examCat of EXAM_PLACEHOLDER_CATEGORIES) {
        const conflitantes = await this.executeCustomQuery<{ id: string }>(
          'SELECT id FROM categorias_placeholders WHERE label = ? AND id != ?',
          [examCat.label, examCat.id]
        );
        for (const conflito of conflitantes) {
          await executeNonQuery('DELETE FROM categorias_placeholders WHERE id = ?', [conflito.id]);
        }

        const existente = await this.executeCustomQuery<{ id: string }>(
          'SELECT id FROM categorias_placeholders WHERE id = ?', [examCat.id]
        );
        if (existente.length === 0) {
          await executeNonQuery(
            'INSERT INTO categorias_placeholders (id, chave, label, descricao, cor, icone, is_sistema, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [examCat.id, examCat.codigo, examCat.label, `Placeholders do exame ${examCat.codigo}`, examCat.cor, examCat.icone, examCat.is_sistema, examCat.ordem]
          );
        } else {
          await executeNonQuery(
            'UPDATE categorias_placeholders SET is_sistema = 1, chave = ?, label = ?, descricao = ?, cor = ?, icone = ?, updated_at = ? WHERE id = ?',
            [examCat.codigo, examCat.label, `Placeholders do exame ${examCat.codigo}`, examCat.cor, examCat.icone, new Date().toISOString(), examCat.id]
          );
        }
      }

      for (const p of PLACEHOLDERS_SISTEMA) {
        const existing = await this.executeCustomQuery<PlaceholderRow>(
          'SELECT id FROM placeholders WHERE chave = ?',
          [p.chave]
        );

        if (existing.length === 0) {
          await this.create(p);
        }
      }
      for (const p of CAMPOS_ESPECIFICOS_PLACEHOLDERS) {
        const existing = await this.executeCustomQuery<PlaceholderRow>(
          'SELECT id FROM placeholders WHERE chave = ?',
          [p.chave]
        );

        if (existing.length === 0) {
          await this.create(p);
        }
      }
      logInfo('Seed de placeholders do sistema concluído', { total: PLACEHOLDERS_SISTEMA.length + CAMPOS_ESPECIFICOS_PLACEHOLDERS.length });
    } catch (error) {
      logError('Erro ao semear placeholders do sistema', error);
      throw error;
    }
  }
}

export const placeholderService = new PlaceholderService();
export default placeholderService;
