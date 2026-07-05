import { BaseService } from './base.service.js';
import { WizardRow, EtapaWizardRow, OpcaoEtapaRow } from '../types/database.js';
import { getLogger } from '../utils/logger.js';
import { executeQuery, executeNonQuery, withTransaction } from '../database/sqlite.js';
import { randomUUID } from 'crypto';

const log = getLogger('wizard');

interface ArvoreEtapa {
  id: string;
  pergunta: string;
  descricao_ajuda?: string;
  tipo_input: 'select' | 'radio' | 'checkbox' | 'text' | 'image';
  nivel: number;
  ordem: number;
  obrigatorio: boolean;
  multipla_escolha: boolean;
  opcoes: ArvoreOpcao[];
}

interface ArvoreOpcao {
  id: string;
  label: string;
  valor: string;
  ordem: number;
  etapa_filha?: ArvoreEtapa;
}

export interface ArvoreWizard {
  wizard: WizardRow;
  etapas: ArvoreEtapa[];
}

class WizardService extends BaseService<WizardRow> {
  constructor() {
    super('wizards', 'id');
  }

  async findByTipoExame(tipoExameId: string): Promise<WizardRow[]> {
    return executeQuery<WizardRow>(
      'SELECT * FROM wizards WHERE tipo_exame_id = ? AND ativo = 1 ORDER BY nome ASC',
      [tipoExameId]
    );
  }

  async findAllActive(): Promise<WizardRow[]> {
    return executeQuery<WizardRow>(
      'SELECT * FROM wizards WHERE ativo = 1 ORDER BY nome ASC'
    );
  }

  async getArvoreCompleta(wizardId: string): Promise<ArvoreWizard> {
    const wizard = await this.findById(wizardId);
    if (!wizard) throw new Error('Wizard não encontrado');

    const etapas = await this.buildArvoreEtapas(wizardId);
    return { wizard, etapas };
  }

  private async buildArvoreEtapas(
    wizardId: string,
    etapaPaiId: string | null = null,
    nivel: number = 0
  ): Promise<ArvoreEtapa[]> {
    const etapas = await executeQuery<EtapaWizardRow>(
      'SELECT * FROM etapas_wizard WHERE wizard_id = ? AND etapa_pai_id IS ? ORDER BY ordem ASC',
      [wizardId, etapaPaiId]
    );

    const result: ArvoreEtapa[] = [];

    for (const etapa of etapas) {
      const opcoes = await executeQuery<OpcaoEtapaRow>(
        'SELECT * FROM opcoes_etapa WHERE etapa_id = ? ORDER BY ordem ASC',
        [etapa.id]
      );

      const arvoreOpcoes: ArvoreOpcao[] = [];

      for (const opcao of opcoes) {
        const arvoreOpcao: ArvoreOpcao = {
          id: opcao.id,
          label: opcao.label,
          valor: opcao.valor,
          ordem: opcao.ordem,
        };

        if (opcao.etapa_filha_id) {
          const filhas = await this.buildArvoreEtapas(wizardId, opcao.etapa_filha_id, nivel + 1);
          if (filhas.length > 0) {
            arvoreOpcao.etapa_filha = filhas[0];
          }
        }

        arvoreOpcoes.push(arvoreOpcao);
      }

      result.push({
        id: etapa.id,
        pergunta: etapa.pergunta,
        descricao_ajuda: etapa.descricao_ajuda,
        tipo_input: etapa.tipo_input as ArvoreEtapa['tipo_input'],
        nivel: etapa.nivel,
        ordem: etapa.ordem,
        obrigatorio: !!etapa.obrigatorio,
        multipla_escolha: !!etapa.multipla_escolha,
        opcoes: arvoreOpcoes,
      });
    }

    // Also check for child etapas linked via opcao_etapa.etapa_filha_id
    // that might not be direct children of etapaPaiId
    if (etapaPaiId === null) {
      const todasEtapas = await executeQuery<EtapaWizardRow>(
        'SELECT * FROM etapas_wizard WHERE wizard_id = ? ORDER BY ordem ASC',
        [wizardId]
      );
      const idsNoResultado = new Set<string>();
      const collectIds = (items: ArvoreEtapa[]) => {
        for (const item of items) {
          idsNoResultado.add(item.id);
          for (const op of item.opcoes) {
            if (op.etapa_filha) collectIds([op.etapa_filha]);
          }
        }
      };
      collectIds(result);

      const faltando = todasEtapas.filter(e => !idsNoResultado.has(e.id));
      if (faltando.length > 0) {
        // Orphan etapas - attach at root
        for (const e of faltando) {
          const opcoes = await executeQuery<OpcaoEtapaRow>(
            'SELECT * FROM opcoes_etapa WHERE etapa_id = ? ORDER BY ordem ASC',
            [e.id]
          );
          result.push({
            id: e.id,
            pergunta: e.pergunta,
            descricao_ajuda: e.descricao_ajuda,
            tipo_input: e.tipo_input as ArvoreEtapa['tipo_input'],
            nivel: e.nivel,
            ordem: e.ordem,
            obrigatorio: !!e.obrigatorio,
            multipla_escolha: !!e.multipla_escolha,
            opcoes: opcoes.map(o => ({
              id: o.id,
              label: o.label,
              valor: o.valor,
              ordem: o.ordem,
            })),
          });
        }
      }
    }

    return result;
  }

  async saveArvoreCompleta(wizardId: string, arvore: ArvoreWizard): Promise<void> {
    await withTransaction(async () => {
      // Delete existing etapas and opcoes (CASCADE handles opcoes)
      await executeNonQuery('DELETE FROM etapas_wizard WHERE wizard_id = ?', [wizardId]);

      // Insert new etapas recursively
      await this.insertEtapasRecursive(wizardId, arvore.etapas, null);
    });

    log.info('Árvore do wizard salva', { wizardId, etapaCount: arvore.etapas.length });
  }

  private async insertEtapasRecursive(
    wizardId: string,
    etapas: ArvoreEtapa[],
    etapaPaiId: string | null
  ): Promise<void> {
    for (const etapa of etapas) {
      const id = etapa.id || randomUUID();
      const now = new Date().toISOString();

      await executeNonQuery(
        `INSERT INTO etapas_wizard (id, wizard_id, etapa_pai_id, pergunta, descricao_ajuda, tipo_input, nivel, ordem, obrigatorio, multipla_escolha, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, wizardId, etapaPaiId,
          etapa.pergunta,
          etapa.descricao_ajuda || null,
          etapa.tipo_input,
          etapa.nivel,
          etapa.ordem,
          etapa.obrigatorio ? 1 : 0,
          etapa.multipla_escolha ? 1 : 0,
          now, now,
        ]
      );

      etapa.id = id;

      // Insert opcoes and their child etapas
      for (const opcao of etapa.opcoes) {
        const opcaoId = opcao.id || randomUUID();
        let etapaFilhaId: string | null = null;

        if (opcao.etapa_filha) {
          await this.insertEtapasRecursive(wizardId, [opcao.etapa_filha], id);
          etapaFilhaId = opcao.etapa_filha.id;
        }

        await executeNonQuery(
          `INSERT INTO opcoes_etapa (id, etapa_id, label, valor, etapa_filha_id, ordem, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [opcaoId, id, opcao.label, opcao.valor, etapaFilhaId, opcao.ordem, now]
        );

        opcao.id = opcaoId;
      }
    }
  }
}

export const wizardService = new WizardService();
