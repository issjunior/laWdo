import { BaseService } from './base.service.js';
import { RegraWizardRow, PecaRow } from '../types/database.js';
import { getLogger } from '../utils/logger.js';
import { executeQuery, executeNonQuery } from '../database/sqlite.js';
import { randomUUID } from 'crypto';

const log = getLogger('regra-wizard');

export interface PecaComSecao {
  peca: PecaRow;
  secao_template_id: string | null;
  regra_id: string;
  ordem: number;
}

export class RegraWizardService extends BaseService<RegraWizardRow> {
  constructor() {
    super('regras_wizard', 'id');
  }

  async findByWizard(wizardId: string): Promise<RegraWizardRow[]> {
    return executeQuery<RegraWizardRow>(
      'SELECT * FROM regras_wizard WHERE wizard_id = ? ORDER BY ordem ASC',
      [wizardId]
    );
  }

  async findByWizardWithPecas(wizardId: string): Promise<(RegraWizardRow & { peca: PecaRow; secao_nome?: string })[]> {
    const sql = `
      SELECT rw.*, p.id as peca_id_raw, p.nome as peca_nome, p.descricao as peca_descricao,
             p.conteudo as peca_conteudo, p.categoria as peca_categoria, p.tags as peca_tags,
             p.ativo as peca_ativo, p.created_at as peca_created_at, p.updated_at as peca_updated_at,
             st.nome as secao_nome
      FROM regras_wizard rw
      JOIN pecas p ON p.id = rw.peca_id
      LEFT JOIN secoes_template st ON st.id = rw.secao_template_id
      WHERE rw.wizard_id = ?
      ORDER BY rw.ordem ASC
    `;
    const rows = await executeQuery<any>(sql, [wizardId]);

    return rows.map((r: any) => ({
      id: r.id,
      wizard_id: r.wizard_id,
      peca_id: r.peca_id,
      secao_template_id: r.secao_template_id,
      condicoes: r.condicoes,
      ordem: r.ordem,
      created_at: r.created_at,
      peca: {
        id: r.peca_id,
        nome: r.peca_nome,
        descricao: r.peca_descricao,
        conteudo: r.peca_conteudo,
        categoria: r.peca_categoria,
        tags: r.peca_tags,
        ativo: r.peca_ativo,
        created_at: r.peca_created_at,
        updated_at: r.peca_updated_at,
      },
      secao_nome: r.secao_nome || undefined,
    }));
  }

  async calcularPecas(
    wizardId: string,
    respostas: Record<string, string | string[]>
  ): Promise<PecaComSecao[]> {
    const regras = await this.findByWizard(wizardId);

    const result: PecaComSecao[] = [];

    for (const regra of regras) {
      const condicoes: Record<string, string | string[]> = JSON.parse(regra.condicoes || '{}');

      // Check if all conditions are satisfied
      const todasSatisfeitas = Object.entries(condicoes).every(([etapaId, condicao]) => {
        const resposta = respostas[etapaId];
        return condicaoSatisfeita(resposta, condicao);
      });

      if (!todasSatisfeitas) continue;

      // Load the piece
      const peca = await executeQuery<PecaRow>(
        'SELECT * FROM pecas WHERE id = ?',
        [regra.peca_id]
      );

      if (peca.length > 0) {
        result.push({
          peca: peca[0],
          secao_template_id: regra.secao_template_id,
          regra_id: regra.id,
          ordem: regra.ordem,
        });
      }
    }

    return result.sort((a, b) => a.ordem - b.ordem);
  }

  async saveBatch(regras: Omit<RegraWizardRow, 'created_at'>[]): Promise<void> {
    const wizardId = regras[0]?.wizard_id;
    if (wizardId) {
      // Delete existing rules for this wizard and re-insert
      await executeNonQuery('DELETE FROM regras_wizard WHERE wizard_id = ?', [wizardId]);
    }

    for (const regra of regras) {
      const id = regra.id || randomUUID();
      const now = new Date().toISOString();

      await executeNonQuery(
        `INSERT INTO regras_wizard (id, wizard_id, peca_id, secao_template_id, condicoes, ordem, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, regra.wizard_id, regra.peca_id, regra.secao_template_id || null, regra.condicoes, regra.ordem, now]
      );
    }

    log.info('Regras salvas em lote', { wizardId, count: regras.length });
  }
}

/**
 * Verifica se uma condição da regra é satisfeita pela resposta do perito.
 *
 * | tipo_input da etapa  | resposta (tipo)  | condição na regra | match?           |
 * |----------------------|------------------|--------------------|------------------|
 * | select, radio        | string           | "revolver"         | igualdade exata  |
 * | checkbox (multipla)  | string[]         | "revolver"         | array.includes   |
 * | checkbox (multipla)  | string[]         | ["a","c"]          | TODAS no array   |
 * | text                 | string           | "qualquer"         | igualdade exata  |
 * | text                 | string           | "*"                | sempre true      |
 * | image                | string (path)    | "*"                | sempre true      |
 * | (sem resposta)       | undefined        | qualquer           | false            |
 */
export function condicaoSatisfeita(
  resposta: string | string[] | undefined,
  condicao: string | string[]
): boolean {
  if (resposta === undefined || resposta === null) return false;

  // Wildcard: condição "*" casa com qualquer resposta não-vazia
  if (condicao === '*') {
    if (Array.isArray(resposta)) return resposta.length > 0;
    return typeof resposta === 'string' && resposta.length > 0;
  }

  // Resposta é array (checkbox/multipla_escolha)
  if (Array.isArray(resposta)) {
    if (Array.isArray(condicao)) {
      // Todas as condições precisam estar no array de respostas
      return condicao.every(c => resposta.includes(c));
    }
    // Condição única: basta estar presente no array
    return resposta.includes(condicao as string);
  }

  // Resposta é string: match exato
  return resposta === condicao;
}

export const regraWizardService = new RegraWizardService();
