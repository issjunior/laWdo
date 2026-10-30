import { CATEGORIAS_PLACEHOLDERS_COMUNS, PLACEHOLDERS_COMUNS as PLACEHOLDERS_SISTEMA } from '../../shared/catalogos/placeholders-comuns.catalogo.js';
import { PLACEHOLDERS_B601 } from '../../shared/catalogos/b601-placeholders.catalogo.js';
import { BaseService } from './base.service.js';
import { getLogger } from '../utils/logger.js';
import { executeNonQuery } from '../database/sqlite.js'
const log = getLogger('placeholder');

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
  'rep_local_fato': 'local_fato',
  'rep_latitude': 'latitude',
  'rep_longitude': 'longitude',
  'rep_data_acionamento': 'data_acionamento_local',
  'rep_data_chegada': 'data_chegada_local',
  'rep_data_saida': 'data_saida_local',
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
  { id: 'cat-exam-B-601', codigo: 'B-601', label: 'B-601 - Constatação de Vestígios Balísticos', cor: 'red', icone: 'Crosshair', is_sistema: 1, ordem: 12 },
  { id: 'cat-exam-I-801', codigo: 'I-801', label: 'I-801 - Numerações Identificadoras', cor: 'amber', icone: 'Car', is_sistema: 1, ordem: 10 },
  { id: 'cat-exam-B-602', codigo: 'B-602', label: 'B-602 - Eficiência e Prestabilidade', cor: 'red', icone: 'Crosshair', is_sistema: 1, ordem: 11 },
];

const CAMPOS_ESPECIFICOS_PLACEHOLDERS: PlaceholderCreateData[] = [
  ...PLACEHOLDERS_B601.map(campo => ({ chave: campo.chave, valor: '', descricao: campo.descricao, categoria_id: 'cat-exam-B-601' })),
  { chave: 'veiculo',                    valor: '', descricao: 'Marca, modelo ou tipo do veículo periciado',       categoria_id: 'cat-exam-I-801' },
  { chave: 'placa',                      valor: '', descricao: 'Placa de identificação do veículo',                 categoria_id: 'cat-exam-I-801' },
  { chave: 'fabricacao_modelo',          valor: '', descricao: 'Ano de fabricação e modelo do veículo',             categoria_id: 'cat-exam-I-801' },
  { chave: 'cor',                        valor: '', descricao: 'Cor do veículo',                                     categoria_id: 'cat-exam-I-801' },
  { chave: 'conservacao',                valor: '', descricao: 'Estado de conservação do veículo',                   categoria_id: 'cat-exam-I-801' },
  { chave: 'chassi',                     valor: '', descricao: 'Nº do chassi (até 17 caracteres alfanuméricos)',    categoria_id: 'cat-exam-I-801' },
  { chave: 'chassi_revelado',            valor: '', descricao: 'Chassi após revelação química',                      categoria_id: 'cat-exam-I-801' },
  { chave: 'motor',                      valor: '', descricao: 'Nº do motor (até 12 caracteres alfanuméricos)',     categoria_id: 'cat-exam-I-801' },
  { chave: 'motor_revelado',             valor: '', descricao: 'Motor após revelação química',                       categoria_id: 'cat-exam-I-801' },
  { chave: 'b602_envolvidos',           valor: '', descricao: 'Lista de nomes dos envolvidos (B-602)',                categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_data_ocorrencia',      valor: '', descricao: 'Data da ocorrência (B-602)',                           categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_local',                valor: '', descricao: 'Local completo (bairro / cidade / UF) (B-602)',       categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_local_bairro',          valor: '', descricao: 'Bairro do local da ocorrência (B-602)',                  categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_local_cidade',          valor: '', descricao: 'Cidade do local da ocorrência (B-602)',                  categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_local_uf',              valor: '', descricao: 'UF do local da ocorrência (B-602)',                      categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_numero_bo',            valor: '', descricao: 'Número do Boletim de Ocorrência (B-602)',              categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_numero_ip',            valor: '', descricao: 'Número do Inquérito Policial (B-602)',                 categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_total_material_enc',    valor: '', descricao: 'Total de itens do Material Encaminhado (B-602)',        categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_total_cartuchos',       valor: '', descricao: 'Total de cartuchos (B-602)',                              categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_total_estojos',         valor: '', descricao: 'Total de estojos (B-602)',                                categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_total_armas',           valor: '', descricao: 'Total de armas (B-602)',                                  categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_tabela_armas',          valor: '', descricao: 'Tabela HTML com especificações das armas (B-602)',        categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_letra',         valor: '', descricao: 'Letra sequencial da arma — valor computado em runtime (B-602)', categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_tipo',          valor: '', descricao: 'Tipo da arma (B-602)', categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_marca',         valor: '', descricao: 'Marca da arma (B-602)', categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_modelo',        valor: '', descricao: 'Modelo da arma (B-602)', categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_calibre',       valor: '', descricao: 'Calibre da arma (B-602)', categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_numeracao_serie', valor: '', descricao: 'Numeração de série da arma (B-602)', categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_numeracao_cano', valor: '', descricao: 'Numeração do cano da arma (B-602)', categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_capacidade_carregador', valor: '', descricao: 'Capacidade do carregador da arma (B-602)', categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_comprimento_cano', valor: '', descricao: 'Comprimento do cano da arma (B-602)', categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_acabamento',    valor: '', descricao: 'Acabamento da arma (B-602)', categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_funcionamento', valor: '', descricao: 'Funcionamento da arma (B-602)', categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_estado_conservacao', valor: '', descricao: 'Estado de conservação da arma (B-602)', categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_quantidade',    valor: '', descricao: 'Quantidade da arma (B-602)', categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_dito_oficio',   valor: '', descricao: 'Dito do ofício da arma (B-602)', categoria_id: 'cat-exam-B-602' },
  { chave: 'b602_arma_N_numero_lacre',  valor: '', descricao: 'Número do lacre da arma (B-602)', categoria_id: 'cat-exam-B-602' },
];

class PlaceholderService extends BaseService<PlaceholderRow> {
  constructor() {
    super('placeholders', 'id');
  }

  ehChaveSistema(chave: string): boolean {
    return chave.startsWith('perito.') || PLACEHOLDERS_SISTEMA.some(item => item.chave === chave)
      || CAMPOS_ESPECIFICOS_PLACEHOLDERS.some(item => item.chave === chave);
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
      log.info('Migração de placeholders concluída', { migradas, puladas });
    } catch (error) {
      log.error('Erro ao migrar placeholders', error);
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
        ...CATEGORIAS_PLACEHOLDERS_COMUNS,
        { id: 'cat-lacres', chave: 'Lacres', label: 'Lacres', descricao: 'Lacres de entrada e saída', cor: 'emerald', icone: 'ShieldCheck', is_sistema: 1, ordem: 3 },
        { id: 'cat-solicitante', chave: 'Solicitante', label: 'Solicitante', descricao: 'Dados do órgão solicitante', cor: 'orange', icone: 'Building2', is_sistema: 1, ordem: 4 },
        { id: 'cat-local', chave: 'Local', label: 'Local', descricao: 'Dados do local do fato', cor: 'teal', icone: 'MapPin', is_sistema: 1, ordem: 5 },
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
        } else if (p.chave === 'observacoes_rep') {
          await executeNonQuery(
            'UPDATE placeholders SET descricao = ?, updated_at = ? WHERE chave = ?',
            [p.descricao, new Date().toISOString(), p.chave]
          );
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
      log.info('Seed de placeholders do sistema concluído', { total: PLACEHOLDERS_SISTEMA.length + CAMPOS_ESPECIFICOS_PLACEHOLDERS.length });
    } catch (error) {
      log.error('Erro ao semear placeholders do sistema', error);
      throw error;
    }
  }
}

export const placeholderService = new PlaceholderService();
