import { BaseService } from './base.service.js';
import { TemplateRow, SecaoTemplateRow } from '../types/database.js';
import { getLogger } from '../utils/logger.js';
import { executeQuery, executeNonQuery, withTransaction } from '../database/sqlite.js';
import { randomUUID } from 'crypto'
const log = getLogger('template');
const MENSAGEM_TEMPLATE_INTEGRADO = 'Este template é integrado ao laWdo e não pode ser alterado. Crie uma cópia personalizada para editar.';

export interface SecaoCompletaTemplateInput {
  id?: string;
  chave_local: string;
  nome: string;
  parent_id?: string | null;
  conteudo?: string | null;
  condicao?: string | null;
  repetir_para?: string | null;
  repetir_titulo?: string | null;
}

export interface SalvarTemplateCompletoInput {
  id?: string;
  nome: string;
  tipo_exame_id: string;
  descricao?: string | null;
  secoes: SecaoCompletaTemplateInput[];
}

class TemplateService extends BaseService<TemplateRow> {
  constructor() {
    super('templates', 'id');
  }

  private async assegurarEditavel(templateId: string): Promise<TemplateRow> {
    const template = await this.findById(templateId);
    if (!template) throw new Error('Template não encontrado');
    if (template.origem === 'integrado') throw new Error(MENSAGEM_TEMPLATE_INTEGRADO);
    return template;
  }

  private async obterTemplateDaSecao(secaoId: string): Promise<TemplateRow> {
    const rows = await executeQuery<TemplateRow>(
      'SELECT t.* FROM templates t JOIN secoes_template s ON s.template_id = t.id WHERE s.id = ?',
      [secaoId],
    );
    if (!rows[0]) throw new Error('Seção de template não encontrada');
    return rows[0];
  }

  /** Buscar templates por tipo de exame (inclui templates genéricos com tipo_exame_id NULL) */
  async findByTipoExame(tipoExameId: string): Promise<TemplateRow[]> {
    try {
      const sql = `
        SELECT * FROM templates
        WHERE (tipo_exame_id = ? OR tipo_exame_id IS NULL)
          AND COALESCE(disponivel_novos_laudos, 1) = 1
        ORDER BY CASE WHEN tipo_exame_id IS NULL THEN 1 ELSE 0 END, nome ASC
      `;
      return await executeQuery<TemplateRow>(sql, [tipoExameId]);
    } catch (error) {
      log.error('Erro ao buscar templates por tipo de exame', error);
      throw error;
    }
  }

  /** Buscar todos os templates com contagem de seções */
  async findAllComSecoes(): Promise<(TemplateRow & { qtd_secoes: number; tipo_exame_nome?: string; tipo_exame_codigo?: string })[]> {
    try {
      const sql = `
        SELECT t.*, COUNT(st.id) as qtd_secoes, te.nome as tipo_exame_nome, te.codigo as tipo_exame_codigo
        FROM templates t
        LEFT JOIN secoes_template st ON st.template_id = t.id
        LEFT JOIN tipos_exame te ON te.id = t.tipo_exame_id
        WHERE t.origem <> 'integrado' OR COALESCE(t.disponivel_novos_laudos, 1) = 1
        GROUP BY t.id
        ORDER BY CASE WHEN t.origem = 'integrado' THEN 0 ELSE 1 END, t.created_at DESC
      `;
      return await executeQuery<TemplateRow & { qtd_secoes: number; tipo_exame_nome?: string; tipo_exame_codigo?: string }>(sql);
    } catch (error) {
      log.error('Erro ao buscar templates com seções', error);
      throw error;
    }
  }

  // ─── Seções ───────────────────────────────────────────

  /** Buscar todas as seções de um template */
  async findSecoesByTemplate(templateId: string): Promise<SecaoTemplateRow[]> {
    try {
      const sql = 'SELECT * FROM secoes_template WHERE template_id = ? ORDER BY ordem ASC';
      return await executeQuery<SecaoTemplateRow>(sql, [templateId]);
    } catch (error) {
      log.error('Erro ao buscar seções do template', error);
      throw error;
    }
  }

  override async update(id: string, data: Partial<Omit<TemplateRow, 'id' | 'created_at'>>): Promise<TemplateRow | null> {
    await this.assegurarEditavel(id);
    return super.update(id, data);
  }

  override async delete(id: string): Promise<boolean> {
    await this.assegurarEditavel(id);
    return super.delete(id);
  }

  /** Criar seção */
  async createSecao(data: Omit<SecaoTemplateRow, 'id' | 'created_at' | 'updated_at'>): Promise<SecaoTemplateRow> {
    try {
      await this.assegurarEditavel(data.template_id);
      const id = randomUUID();
      const sql = `
        INSERT INTO secoes_template (id, template_id, nome, ordem, parent_id, conteudo, condicao, repetir_para, repetir_titulo, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;
      await executeNonQuery(sql, [
        id,
        data.template_id,
        data.nome,
        data.ordem,
        data.parent_id || null,
        data.conteudo || null,
        data.condicao || null,
        data.repetir_para || null,
        data.repetir_titulo || null,
      ]);
      const rows = await executeQuery<SecaoTemplateRow>('SELECT * FROM secoes_template WHERE id = ?', [id]);
      return rows[0];
    } catch (error) {
      log.error('Erro ao criar seção do template', error);
      throw error;
    }
  }

  /** Atualizar seção */
  async updateSecao(id: string, data: Partial<Omit<SecaoTemplateRow, 'id' | 'template_id' | 'created_at' | 'updated_at'>>): Promise<SecaoTemplateRow> {
    try {
      const template = await this.obterTemplateDaSecao(id);
      if (template.origem === 'integrado') throw new Error(MENSAGEM_TEMPLATE_INTEGRADO);
      const sets: string[] = [];
      const params: unknown[] = [];

      if (data.nome !== undefined) { sets.push('nome = ?'); params.push(data.nome); }
      if (data.ordem !== undefined) { sets.push('ordem = ?'); params.push(data.ordem); }
      if (data.parent_id !== undefined) { sets.push('parent_id = ?'); params.push(data.parent_id); }
      if (data.conteudo !== undefined) { sets.push('conteudo = ?'); params.push(data.conteudo); }
      if (data.condicao !== undefined) { sets.push('condicao = ?'); params.push(data.condicao); }
      if (data.repetir_para !== undefined) { sets.push('repetir_para = ?'); params.push(data.repetir_para); }
      if (data.repetir_titulo !== undefined) { sets.push('repetir_titulo = ?'); params.push(data.repetir_titulo); }

      if (sets.length === 0) {
        const rows = await executeQuery<SecaoTemplateRow>('SELECT * FROM secoes_template WHERE id = ?', [id]);
        return rows[0];
      }

      sets.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      await executeNonQuery(`UPDATE secoes_template SET ${sets.join(', ')} WHERE id = ?`, params);
      const rows = await executeQuery<SecaoTemplateRow>('SELECT * FROM secoes_template WHERE id = ?', [id]);
      return rows[0];
    } catch (error) {
      log.error('Erro ao atualizar seção do template', error);
      throw error;
    }
  }

  /** Excluir seção */
  async deleteSecao(id: string): Promise<void> {
    try {
      const template = await this.obterTemplateDaSecao(id);
      if (template.origem === 'integrado') throw new Error(MENSAGEM_TEMPLATE_INTEGRADO);
      await executeNonQuery('DELETE FROM secoes_template WHERE id = ?', [id]);
    } catch (error) {
      log.error('Erro ao excluir seção do template', error);
      throw error;
    }
  }

  /** Reordenar seções (recebe array de ids na nova ordem) */
  async reordenarSecoes(templateId: string, idsOrdenados: string[]): Promise<void> {
    try {
      await this.assegurarEditavel(templateId);
      await withTransaction(async () => {
        for (let i = 0; i < idsOrdenados.length; i++) {
          await executeNonQuery(
            'UPDATE secoes_template SET ordem = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND template_id = ?',
            [i, idsOrdenados[i], templateId]
          );
        }
      });
    } catch (error) {
      log.error('Erro ao reordenar seções do template', error);
      throw error;
    }
  }

  async clonar(templateId: string): Promise<TemplateRow> {
    const original = await this.findById(templateId);
    if (!original) throw new Error('Template não encontrado');
    const secoes = await this.findSecoesByTemplate(templateId);
    return withTransaction(async () => {
      const id = randomUUID();
      const nomeBase = `${original.nome} - (Cópia)`;
      let nome = nomeBase;
      let contador = 2;
      while ((await executeQuery<{ id: string }>('SELECT id FROM templates WHERE tipo_exame_id IS ? AND nome = ?', [original.tipo_exame_id, nome])).length > 0) {
        nome = `${nomeBase} ${contador++}`;
      }
      await executeNonQuery(
        `INSERT INTO templates (id, tipo_exame_id, nome, descricao, origem, derivado_de_chave, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'clonado', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, original.tipo_exame_id, nome, original.descricao ?? null, original.chave_integrada ?? null],
      );
      const ids = new Map(secoes.map(secao => [secao.id, randomUUID()]));
      for (const secao of secoes) {
        await executeNonQuery(
          `INSERT INTO secoes_template (id, template_id, nome, ordem, parent_id, conteudo, condicao, repetir_para, repetir_titulo, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [ids.get(secao.id), id, secao.nome, secao.ordem, secao.parent_id ? ids.get(secao.parent_id) : null, secao.conteudo ?? null, secao.condicao ?? null, secao.repetir_para ?? null, secao.repetir_titulo ?? null],
        );
      }
      const copia = await this.findById(id);
      if (!copia) throw new Error('Falha ao recuperar cópia do template');
      return copia;
    });
  }

  async salvarCompleto(input: SalvarTemplateCompletoInput): Promise<TemplateRow> {
    if (!input.secoes.length) throw new Error('O template precisa conter ao menos uma seção');
    const chaves = new Set<string>();
    for (const secao of input.secoes) {
      if (!secao.nome.trim() || !secao.chave_local || chaves.has(secao.chave_local)) throw new Error('Seções do template inválidas');
      chaves.add(secao.chave_local);
    }
    for (const secao of input.secoes) {
      if (secao.parent_id && (!chaves.has(secao.parent_id) || secao.parent_id === secao.chave_local)) {
        throw new Error('Hierarquia de seções inválida');
      }
    }
    return withTransaction(async () => {
      let templateId = input.id;
      if (templateId) {
        await this.assegurarEditavel(templateId);
        await executeNonQuery('UPDATE templates SET nome = ?, tipo_exame_id = ?, descricao = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [input.nome, input.tipo_exame_id, input.descricao ?? null, templateId]);
      } else {
        templateId = randomUUID();
        await executeNonQuery(`INSERT INTO templates (id, tipo_exame_id, nome, descricao, origem, created_at, updated_at) VALUES (?, ?, ?, ?, 'usuario', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [templateId, input.tipo_exame_id, input.nome, input.descricao ?? null]);
      }
      const atuais = await this.findSecoesByTemplate(templateId);
      const idsMantidos = new Set(input.secoes.flatMap(secao => secao.id ? [secao.id] : []));
      for (const secao of atuais) if (!idsMantidos.has(secao.id)) await executeNonQuery('DELETE FROM secoes_template WHERE id = ?', [secao.id]);
      const ids = new Map<string, string>();
      for (const secao of input.secoes) ids.set(secao.chave_local, secao.id ?? randomUUID());
      for (const [ordem, secao] of input.secoes.entries()) {
        const id = ids.get(secao.chave_local)!;
        const pai = secao.parent_id ? ids.get(secao.parent_id) ?? null : null;
        if (secao.id) {
          await executeNonQuery(`UPDATE secoes_template SET nome = ?, ordem = ?, parent_id = ?, conteudo = ?, condicao = ?, repetir_para = ?, repetir_titulo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND template_id = ?`, [secao.nome, ordem, pai, secao.conteudo ?? null, secao.condicao ?? null, secao.repetir_para ?? null, secao.repetir_titulo ?? null, id, templateId]);
        } else {
          await executeNonQuery(`INSERT INTO secoes_template (id, template_id, nome, ordem, parent_id, conteudo, condicao, repetir_para, repetir_titulo, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [id, templateId, secao.nome, ordem, pai, secao.conteudo ?? null, secao.condicao ?? null, secao.repetir_para ?? null, secao.repetir_titulo ?? null]);
        }
      }
      const salvo = await this.findById(templateId);
      if (!salvo) throw new Error('Falha ao salvar template');
      return salvo;
    });
  }
}

export const templateService = new TemplateService();
