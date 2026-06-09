import { BaseService } from './base.service.js';
import { LaudoRow } from '../types/database.js';
import { getLogger } from '../utils/logger.js';
import { executeQuery, executeNonQuery } from '../database/sqlite.js';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { regraWizardService } from './regra-wizard.service.js';

const log = getLogger('laudo')

export class LaudoService extends BaseService<LaudoRow> {
  constructor() {
    super('laudos', 'id');
  }

  async criarLaudoInicial(params: {
    rep_id: string;
    perito_id: string;
    template_id: string;
  }): Promise<LaudoRow> {
    try {
      const existe = await executeQuery<LaudoRow>(
        'SELECT id FROM laudos WHERE rep_id = ?',
        [params.rep_id]
      );
      if (existe.length > 0) {
        throw new Error('Já existe um laudo para esta REP');
      }

      const secoesSql = `
        SELECT nome, conteudo
        FROM secoes_template
        WHERE template_id = ?
        ORDER BY ordem ASC
      `;
      const secoes = await executeQuery<{ nome: string; conteudo?: string }>(secoesSql, [params.template_id]);

      const conteudo = secoes
        .map((s, i) => `<h2>${i + 1}. ${s.nome}</h2>${s.conteudo || '<p>&nbsp;</p>'}`)
        .join('\n');

      const id = randomUUID();
      const now = new Date().toISOString();

      const sql = `
        INSERT INTO laudos (id, rep_id, perito_id, template_id, conteudo, status, tipo_criacao, data_inicio, versao, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'Em andamento', 'template', ?, 1, ?, ?)
      `;

      await executeNonQuery(sql, [
        id,
        params.rep_id,
        params.perito_id,
        params.template_id,
        conteudo || '<p>Laudo em elaboração.</p>',
        now,
        now,
        now,
      ]);

      log.info('Laudo criado para REP', { laudoId: id, repId: params.rep_id });

      const [laudo] = await executeQuery<LaudoRow>('SELECT * FROM laudos WHERE id = ?', [id]);
      return laudo;
    } catch (error) {
      log.error('Erro ao criar laudo inicial', error);
      throw error;
    }
  }

  async findByRepId(repId: string): Promise<LaudoRow | null> {
    try {
      const rows = await executeQuery<LaudoRow>(
        'SELECT * FROM laudos WHERE rep_id = ?',
        [repId],
      );
      return rows[0] || null;
    } catch (error) {
      log.error('Erro ao buscar laudo por REP', error);
      throw error;
    }
  }

  async findAllByRepId(repId: string): Promise<LaudoRow[]> {
    try {
      return await executeQuery<LaudoRow>(
        'SELECT * FROM laudos WHERE rep_id = ?',
        [repId],
      );
    } catch (error) {
      log.error('Erro ao buscar laudos por REP', error);
      throw error;
    }
  }

  async findAllComRep(): Promise<
    Array<
      LaudoRow & {
        rep_numero: string;
        template_nome: string;
        status_rep: string;
        tipo_exame_nome?: string;
        data_requisicao?: string;
        tipo_solicitacao?: string;
        numero_documento?: string;
      }
    >
  > {
    try {
      const sql = `
        SELECT
          l.*,
          r.numero AS rep_numero,
          r.status AS status_rep,
          r.data_requisicao,
          r.tipo_solicitacao,
          r.numero_documento,
          t.nome AS template_nome,
          te.nome AS tipo_exame_nome
        FROM laudos l
        JOIN reps r ON r.id = l.rep_id
        LEFT JOIN templates t ON t.id = l.template_id
        LEFT JOIN tipos_exame te ON te.id = r.tipo_exame_id
        ORDER BY l.updated_at DESC
      `;
      return await executeQuery<any>(sql);
    } catch (error) {
      log.error('Erro ao buscar laudos com REPs', error);
      throw error;
    }
  }

  async updateConteudo(id: string, conteudo: string): Promise<LaudoRow> {
    try {
      const sql = `
        UPDATE laudos
        SET conteudo = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      await executeNonQuery(sql, [conteudo, id]);
      const rows = await executeQuery<LaudoRow>('SELECT * FROM laudos WHERE id = ?', [id]);
      return rows[0];
    } catch (error) {
      log.error('Erro ao atualizar conteúdo do laudo', error);
      throw error;
    }
  }

  async updateStatus(id: string, status: string): Promise<LaudoRow> {
    try {
      const statusValidos = ['Em andamento', 'Concluído', 'Entregue'];
      if (!statusValidos.includes(status)) {
        throw new Error(`Status inválido. Use: ${statusValidos.join(', ')}`);
      }

      const now = new Date().toISOString();
      const updates: string[] = ['status = ?'];
      const params: string[] = [status];

      if (status === 'Concluído') {
        updates.push('data_conclusao = ?');
        params.push(now);
      }
      if (status === 'Entregue') {
        updates.push('data_entrega = ?');
        params.push(now);
      }

      params.push(id);
      const sql = `UPDATE laudos SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      await executeNonQuery(sql, params);

      const rows = await executeQuery<LaudoRow>('SELECT * FROM laudos WHERE id = ?', [id]);
      return rows[0];
    } catch (error) {
      log.error('Erro ao atualizar status do laudo', { id, status, error });
      throw error;
    }
  }

  async deletarPorRepId(repId: string): Promise<void> {
    try {
      const laudos = await executeQuery<LaudoRow>('SELECT id FROM laudos WHERE rep_id = ?', [repId]);
      for (const laudo of laudos) {
        await executeNonQuery('DELETE FROM imagens_laudo WHERE laudo_id = ?', [laudo.id]);
        const laudoDir = path.join(app.getPath('userData'), 'laudos', laudo.id);
        if (fs.existsSync(laudoDir)) {
          fs.rmSync(laudoDir, { recursive: true, force: true });
        }
      }
      await executeNonQuery('DELETE FROM laudos WHERE rep_id = ?', [repId]);
    } catch (error) {
      log.error('Erro ao deletar laudo por rep_id', { repId, error });
      throw error;
    }
  }

  async deletar(laudoId: string): Promise<{ rep_id: string }> {
    try {
      const laudo = await this.findById(laudoId);
      if (!laudo) throw new Error('Laudo não encontrado');

      const laudoDir = path.join(app.getPath('userData'), 'laudos', laudoId);
      if (fs.existsSync(laudoDir)) {
        fs.rmSync(laudoDir, { recursive: true, force: true });
      }

      await executeNonQuery('DELETE FROM imagens_laudo WHERE laudo_id = ?', [laudoId]);

      await this.delete(laudoId);

      log.info('Laudo excluído', { laudoId, repId: laudo.rep_id });
      return { rep_id: laudo.rep_id };
    } catch (error) {
      log.error('Erro ao deletar laudo', { laudoId, error });
      throw error;
    }
  }

  // ==================== WIZARD (preenchimento do laudo existente) ====================

  /**
   * Gera conteúdo do wizard e salva no laudo EXISTENTE.
   * O status permanece "Em andamento" — o usuário pode continuar editando no TinyMCE.
   */
  async gerarLaudoWizard(params: {
    laudo_id: string;
    wizard_id: string;
    template_id: string;
    respostas: Record<string, string | string[]>;
    pecas_selecionadas?: string[];
  }): Promise<LaudoRow> {
    const laudo = await this.findById(params.laudo_id);
    if (!laudo) throw new Error('Laudo não encontrado');

    // 1. Carregar seções do template
    const secoes = await executeQuery<{ id: string; nome: string; conteudo?: string }>(
      'SELECT id, nome, conteudo FROM secoes_template WHERE template_id = ? ORDER BY ordem ASC',
      [params.template_id]
    );

    // 2. Calcular peças
    const pecasComSecao = await regraWizardService.calcularPecas(params.wizard_id, params.respostas);

    // 3. Filtrar por selecionadas
    const pecasFiltradas = params.pecas_selecionadas
      ? pecasComSecao.filter(p => params.pecas_selecionadas!.includes(p.peca.id))
      : pecasComSecao;

    // 4. Montar HTML por seção
    const secoesHtml = secoes.map(secao => {
      const pecasDaSecao = pecasFiltradas.filter(p => p.secao_template_id === secao.id);
      const pecasHtml = pecasDaSecao.map(p => {
        const conteudo = p.peca.conteudo || '';
        return `<div data-peca-id="${p.peca.id}" data-peca-hash="${this._hashContent(conteudo)}" class="peca-wizard">${conteudo}</div>`;
      }).join('\n');
      return `<h2>${secao.nome}</h2>\n${secao.conteudo || ''}\n${pecasHtml}`;
    });

    const conteudoHtml = secoesHtml.join('\n') || '<p>Laudo gerado pelo Wizard.</p>';
    const respostasJson = JSON.stringify({
      ...params.respostas,
      _wizard_id: params.wizard_id,
      _atualizado_em: new Date().toISOString(),
    });

    const now = new Date().toISOString();

    // Reaplicação com hash detection
    const conteudoFinal = this._reaplicarBlocosPeca(laudo.conteudo, conteudoHtml);

    await executeNonQuery(
      `UPDATE laudos SET conteudo = ?, respostas_wizard = ?, wizard_id = ?, updated_at = ? WHERE id = ?`,
      [conteudoFinal, respostasJson, params.wizard_id, now, laudo.id]
    );

    // Sobrescrever respostas_wizard (tabela)
    await executeNonQuery('DELETE FROM respostas_wizard WHERE laudo_id = ?', [laudo.id]);
    for (const [etapaId, valor] of Object.entries(params.respostas)) {
      const valorTexto = Array.isArray(valor) ? JSON.stringify(valor) : String(valor);
      await executeNonQuery(
        `INSERT INTO respostas_wizard (id, laudo_id, etapa_id, valor_texto, created_at) VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), laudo.id, etapaId, valorTexto, now]
      );
    }

    const [updated] = await executeQuery<LaudoRow>('SELECT * FROM laudos WHERE id = ?', [laudo.id]);
    return updated;
  }

  async salvarProgressoWizard(
    laudoId: string,
    respostas: Record<string, string | string[]>
  ): Promise<void> {
    const laudo = await this.findById(laudoId);
    if (!laudo) throw new Error('Laudo não encontrado');

    const cacheJson = JSON.stringify({
      ...respostas,
      _wizard_id: laudo.wizard_id,
      _atualizado_em: new Date().toISOString(),
    });
    await executeNonQuery(
      'UPDATE laudos SET respostas_wizard = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [cacheJson, laudoId]
    );

    await executeNonQuery('DELETE FROM respostas_wizard WHERE laudo_id = ?', [laudoId]);

    const now = new Date().toISOString();
    for (const [etapaId, valor] of Object.entries(respostas)) {
      const valorTexto = Array.isArray(valor) ? JSON.stringify(valor) : String(valor);
      await executeNonQuery(
        `INSERT INTO respostas_wizard (id, laudo_id, etapa_id, valor_texto, created_at) VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), laudoId, etapaId, valorTexto, now]
      );
    }
  }

  async getRespostasWizard(laudoId: string): Promise<Record<string, string | string[]>> {
    const rows = await executeQuery<{ etapa_id: string; valor_texto: string }>(
      'SELECT etapa_id, valor_texto FROM respostas_wizard WHERE laudo_id = ?',
      [laudoId]
    );
    const respostas: Record<string, string | string[]> = {};
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.valor_texto);
        respostas[row.etapa_id] = Array.isArray(parsed) ? parsed : row.valor_texto;
      } catch {
        respostas[row.etapa_id] = row.valor_texto;
      }
    }
    return respostas;
  }

  // ==================== HELPERS ====================

  private _hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private _reaplicarBlocosPeca(htmlAtual: string, novoHtml: string): string {
    if (!htmlAtual || htmlAtual.trim() === '') return novoHtml;

    const H2_REGEX = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
    const normalizeH2 = (h2: string) =>
      h2.replace(/<\/?h2[^>]*>/gi, '').replace(/^\d+\.\s*/, '').trim().toLowerCase();

    // Parse HTML into sections delimited by <h2> tags
    function parseSections(html: string) {
      const positions: { h2: string; name: string; start: number; end: number }[] = [];
      H2_REGEX.lastIndex = 0;
      let m;
      while ((m = H2_REGEX.exec(html)) !== null) {
        positions.push({ h2: m[0], name: normalizeH2(m[0]), start: m.index, end: 0 });
      }
      for (let i = 0; i < positions.length; i++) {
        positions[i].end = i + 1 < positions.length ? positions[i + 1].start : html.length;
      }
      return positions;
    }

    const novoSecoes = parseSections(novoHtml);
    const atualSecoes = parseSections(htmlAtual);

    // Build lookup: section name -> old section HTML
    const atualContent = new Map<string, string>();
    for (const s of atualSecoes) {
      atualContent.set(s.name, htmlAtual.substring(s.start, s.end));
    }

    // Fallback: no H2 sections in novoHtml — reconcile flat (preserve existing behavior)
    if (novoSecoes.length === 0) {
      return this._reconcileFlat(htmlAtual, novoHtml);
    }

    const resultParts: string[] = [];

    // Preserve content before the first H2 in the old HTML
    if (atualSecoes.length > 0 && atualSecoes[0].start > 0) {
      resultParts.push(htmlAtual.substring(0, atualSecoes[0].start));
    }

    // Walk through novoHtml sections, reconcile peças within each
    const matchedAtualNames = new Set<string>();

    for (let i = 0; i < novoSecoes.length; i++) {
      const novoSec = novoSecoes[i];
      const novoSecHtml = novoHtml.substring(novoSec.start, novoSec.end);
      const atualSecHtml = atualContent.get(novoSec.name);

      if (atualSecHtml) {
        matchedAtualNames.add(novoSec.name);
        resultParts.push(this._mergeSectionPecas(atualSecHtml, novoSecHtml));
      } else {
        resultParts.push(novoSecHtml);
      }
    }

    // Preserve sections from old HTML that are not in novoHtml (user-added sections)
    for (const s of atualSecoes) {
      if (!matchedAtualNames.has(s.name)) {
        resultParts.push(htmlAtual.substring(s.start, s.end));
      }
    }

    // Preserve content after the last H2 in the old HTML (if novoHtml has fewer sections or no sections)
    if (atualSecoes.length > 0) {
      const lastAtual = atualSecoes[atualSecoes.length - 1];
      // Check if there's trailing content after the last section and novoHtml didn't cover it
      const afterLast = htmlAtual.substring(lastAtual.end);
      if (afterLast.trim() && !matchedAtualNames.has(lastAtual.name)) {
        // Only append if the last section wasn't already merged
      }
    }

    return resultParts.join('\n') || htmlAtual;
  }

  private _reconcileFlat(htmlAtual: string, novoHtml: string): string {
    const PECA_REGEX = /<div data-peca-id="([^"]*)"[^>]*>([\s\S]*?)<\/div>/gi;
    const novosBlocos = new Map<string, string>();
    let m;
    while ((m = PECA_REGEX.exec(novoHtml)) !== null) {
      novosBlocos.set(m[1], m[0]);
    }

    let result = htmlAtual;
    PECA_REGEX.lastIndex = 0;
    while ((m = PECA_REGEX.exec(result)) !== null) {
      const pecaId = m[1];
      const blocoNovo = novosBlocos.get(pecaId);
      if (!blocoNovo) {
        result = result.replace(m[0], '');
      } else {
        const hashAtualMatch = m[0].match(/data-peca-hash="([^"]*)"/);
        const hashAtual = hashAtualMatch ? hashAtualMatch[1] : null;
        const conteudoAtual = m[0].replace(/<div[^>]*>|<\/div>/g, '').trim();
        const hashCalculado = this._hashContent(conteudoAtual);
        if (hashAtual && hashAtual !== hashCalculado) {
          novosBlocos.delete(pecaId);
        } else {
          result = result.replace(m[0], blocoNovo);
          novosBlocos.delete(pecaId);
        }
      }
    }

    for (const [pecaId, bloco] of novosBlocos) {
      if (!result.includes(`data-peca-id="${pecaId}"`)) {
        result += '\n' + bloco;
      }
    }
    return result;
  }

  private _mergeSectionPecas(atualSectionHtml: string, novoSectionHtml: string): string {
    const PECA_REGEX = /<div data-peca-id="([^"]*)"[^>]*>([\s\S]*?)<\/div>/gi;

    const novosBlocos = new Map<string, string>();
    PECA_REGEX.lastIndex = 0;
    let m;
    while ((m = PECA_REGEX.exec(novoSectionHtml)) !== null) {
      novosBlocos.set(m[1], m[0]);
    }

    let result = atualSectionHtml;

    PECA_REGEX.lastIndex = 0;
    while ((m = PECA_REGEX.exec(atualSectionHtml)) !== null) {
      const pecaId = m[1];
      const blocoNovo = novosBlocos.get(pecaId);

      if (!blocoNovo) {
        result = result.replace(m[0], '');
      } else {
        const hashAtualMatch = m[0].match(/data-peca-hash="([^"]*)"/);
        const hashAtual = hashAtualMatch ? hashAtualMatch[1] : null;
        const conteudoAtual = m[0].replace(/<div[^>]*>|<\/div>/g, '').trim();
        const hashCalculado = this._hashContent(conteudoAtual);

        if (hashAtual && hashAtual !== hashCalculado) {
          novosBlocos.delete(pecaId);
        } else {
          result = result.replace(m[0], blocoNovo);
          novosBlocos.delete(pecaId);
        }
      }
    }

    for (const [pecaId, bloco] of novosBlocos) {
      if (!result.includes(`data-peca-id="${pecaId}"`)) {
        result += '\n' + bloco;
      }
    }

    return result;
  }
}

export const laudoService = new LaudoService();
