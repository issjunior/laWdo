import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';
import { app } from 'electron';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { SecaoTemplateRow } from '../../main/types/database';
import { buildHtml } from '../../main/services/secao-builder.service';
import { ocultarTitulosSecoesNaSaida } from '../../renderer/lib/titulos-secoes-laudo';

describe('persistência da ocultação de títulos', () => {
  let diretorio: string;
  let banco: typeof import('../../main/database/index');
  let sqlite: typeof import('../../main/database/sqlite');
  let servico: typeof import('../../main/services/template.service')['templateService'];
  let pacote: typeof import('../../main/services/template-pacote.service');
  let templateId: string;

  beforeAll(async () => {
    // O adm-zip precisa reconhecer Buffer como Uint8Array do Node, fora do realm do jsdom.
    vi.stubGlobal('Uint8Array', Object.getPrototypeOf(Buffer.prototype).constructor);
    diretorio = await fs.mkdtemp(path.join(os.tmpdir(), 'lawdo-titulo-oculto-'));
    vi.mocked(app.getPath).mockReturnValue(diretorio);
    vi.resetModules();
    banco = await import('../../main/database/index');
    sqlite = await import('../../main/database/sqlite');
    await banco.setupDatabase();
    servico = (await import('../../main/services/template.service')).templateService;
    pacote = await import('../../main/services/template-pacote.service');
    await sqlite.executeNonQuery("INSERT INTO tipos_exame (id, codigo, nome) VALUES ('tipo-titulo', 'TESTE-TITULO', 'Exame de teste')");
    const template = await servico.salvarCompleto({
      nome: 'Template com título oculto', tipo_exame_id: 'tipo-titulo',
      secoes: [
        { chave_local: 'pai', nome: 'Introdução', ocultar_titulo: true, contar_na_numeracao: false, conteudo: '<p>Texto inicial</p>' },
        { chave_local: 'filho', parent_id: 'pai', nome: 'Subseção', conteudo: '<p>Texto filho</p>' },
      ],
    });
    templateId = template.id;
  });

  afterAll(async () => {
    await sqlite?.closeDatabase();
    if (diretorio) await fs.rm(diretorio, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  function conferir(secoes: SecaoTemplateRow[]) {
    expect(secoes.map(secao => secao.ocultar_titulo)).toEqual([1, 0]);
    expect(secoes.map(secao => secao.contar_na_numeracao)).toEqual([0, 1]);
    expect(secoes[1].parent_id).toBe(secoes[0].id);
    expect(secoes[0].conteudo).toBe('<p>Texto inicial</p>');
  }

  it('instala o B-602 v11 com concordância e figuras dos cartuchos, preservando a versão anterior', async () => {
    const [integrado] = await sqlite.executeQuery<{ id: string; tipo_exame_id: string }>(
      "SELECT id, tipo_exame_id FROM templates WHERE chave_integrada = 'laudo-padrao-b602' AND versao_integrada = 11",
    );
    expect(integrado).toBeDefined();
    const secoes = await servico.findSecoesByTemplate(integrado.id);
    expect(secoes.find(secao => secao.chave_integrada === 'consideracoes-finais')?.conteudo).toContain('Lei nº 13.964/2019');
    expect(secoes.find(secao => secao.chave_integrada === 'encerramento')?.conteudo).toContain('Instrução Normativa nº 001/2020-PCP');
    expect(secoes.find(secao => secao.chave_integrada === 'dos-estojos')?.conteudo).toContain('{{b602_total_estojos_extenso}}');
    expect(secoes.find(secao => secao.chave_integrada === 'dos-estojos')?.conteudo).toContain('{{b602_estojos_descricao}}');
    expect(secoes.find(secao => secao.chave_integrada === 'dos-estojos')?.conteudo).toContain('{{b602_estojos_conclusao}}');
    const cartuchos = secoes.find(secao => secao.chave_integrada === 'dos-cartuchos')?.conteudo || '';
    expect(cartuchos).toContain('{{b602_total_cartuchos_extenso}}');
    expect(cartuchos).toContain('{{b602_cartuchos_descricao}}');
    expect(cartuchos.match(/data-dummy="true"/g)).toHaveLength(2);
    expect(secoes[0]).toMatchObject({ chave_integrada: 'preambulo', ocultar_titulo: 1, contar_na_numeracao: 0 });
    const html = buildHtml(secoes, new Map(), {});
    const documento = new DOMParser().parseFromString(html, 'text/html');
    expect(documento.querySelector('h2')?.textContent).toBe('PREÂMBULO');
    expect(documento.querySelectorAll('h2')[1].textContent).toMatch(/^1\. /);
    const saida = ocultarTitulosSecoesNaSaida(html);
    expect(new DOMParser().parseFromString(saida, 'text/html').querySelector('h2')?.textContent).toMatch(/^1\. /);
    expect(saida).toContain(secoes[0].conteudo);
    const copia = await servico.clonar(integrado.id);
    expect((await servico.findSecoesByTemplate(copia.id))[0]).toMatchObject({ ocultar_titulo: 1, contar_na_numeracao: 0 });

    await sqlite.executeNonQuery("INSERT INTO templates (id, nome, tipo_exame_id, origem, chave_integrada, versao_integrada) VALUES ('b602-legado-teste', 'B-602 anterior', ?, 'integrado', 'laudo-padrao-b602', 6)", [integrado.tipo_exame_id]);
    await sqlite.executeNonQuery("INSERT INTO secoes_template (id, template_id, nome, ordem, conteudo) VALUES ('preambulo-legado-teste', 'b602-legado-teste', 'PREÂMBULO', 0, '<p>Conteúdo anterior preservado</p>')");
    const { sincronizarTemplatesIntegrados } = await import('../../main/templates/integrados/sincronizar-templates-integrados');
    expect((await sincronizarTemplatesIntegrados())[0].status).toBe('ja_atualizado');
    expect((await sincronizarTemplatesIntegrados())[0].status).toBe('ja_atualizado');
    expect((await servico.findSecoesByTemplate('b602-legado-teste'))[0]).toMatchObject({ conteudo: '<p>Conteúdo anterior preservado</p>', ocultar_titulo: 0, contar_na_numeracao: 1 });
    expect(await sqlite.executeQuery("SELECT id FROM templates WHERE chave_integrada = 'laudo-padrao-b602' AND versao_integrada = 11")).toHaveLength(1);
  });

  it('instala o B-601 v2 com as abreviações corrigidas', async () => {
    const [integrado] = await sqlite.executeQuery<{ id: string }>(
      "SELECT id FROM templates WHERE chave_integrada = 'laudo-padrao-b601' AND versao_integrada = 2",
    );
    expect(integrado).toBeDefined();
    const secoes = await servico.findSecoesByTemplate(integrado.id);
    expect(secoes.find(secao => secao.chave_integrada === 'consideracoes-finais')?.conteudo).toContain('Lei nº 13.964/2019');
    expect(secoes.find(secao => secao.chave_integrada === 'encerramento')?.conteudo).toContain('Instrução Normativa nº 001/2020-PCP');
  });

  it('persiste, atualiza e duplica a escolha independentemente da hierarquia', async () => {
    const secoes = await servico.findSecoesByTemplate(templateId);
    conferir(secoes);
    const copia = await servico.clonar(templateId);
    conferir(await servico.findSecoesByTemplate(copia.id));
    await servico.salvarCompleto({
      id: copia.id, nome: copia.nome, tipo_exame_id: 'tipo-titulo',
      secoes: (await servico.findSecoesByTemplate(copia.id)).map(secao => ({
        id: secao.id, chave_local: secao.id, nome: secao.nome,
        parent_id: secao.parent_id, conteudo: secao.conteudo, ocultar_titulo: false, contar_na_numeracao: secao.contar_na_numeracao !== 0,
      })),
    });
    expect((await servico.findSecoesByTemplate(copia.id)).map(secao => secao.ocultar_titulo)).toEqual([0, 0]);
    conferir(await servico.findSecoesByTemplate(templateId));
  });

  it('exporta e importa o pacote mantendo preferência, conteúdo e relações', async () => {
    const caminho = path.join(diretorio, 'template.zip');
    expect(await pacote.exportarPacoteTemplate(templateId, caminho)).toEqual({ success: true });
    const conferido = new AdmZip(caminho);
    expect(() => JSON.parse(conferido.readAsText('template.json'))).not.toThrow();
    expect(() => JSON.parse(conferido.readAsText('manifest.json'))).not.toThrow();
    expect((await pacote.lerPreviaPacoteTemplate(caminho)).secoes.map(secao => secao.ocultar_titulo)).toEqual([true, false]);
    expect((await pacote.lerPreviaPacoteTemplate(caminho)).secoes.map(secao => secao.contar_na_numeracao)).toEqual([false, true]);
    const resultado = await pacote.importarPacoteTemplate(caminho, false);
    expect(resultado.success).toBe(true);
    const importados = await sqlite.executeQuery<{ id: string }>("SELECT id FROM templates WHERE nome = ?", [resultado.nome]);
    conferir(await servico.findSecoesByTemplate(importados[0].id));

    const zip = new AdmZip(caminho);
    const legado: unknown = JSON.parse(zip.readAsText('template.json'));
    if (!legado || typeof legado !== 'object' || !('secoes' in legado) || !Array.isArray(legado.secoes)) throw new Error('Pacote de teste inválido');
    const secoesLegadas: unknown[] = legado.secoes;
    for (const secao of secoesLegadas) {
      if (secao && typeof secao === 'object') {
        if ('ocultar_titulo' in secao) delete secao.ocultar_titulo;
        if ('contar_na_numeracao' in secao) delete secao.contar_na_numeracao;
      }
    }
    const dados = Buffer.from(JSON.stringify(legado));
    zip.updateFile('template.json', dados);
    zip.updateFile('manifest.json', Buffer.from(JSON.stringify({ tipo: 'template', versao: 1, checksum: crypto.createHash('sha256').update(dados).digest('hex') })));
    const caminhoLegado = path.join(diretorio, 'legado.zip');
    zip.writeZip(caminhoLegado);
    expect((await pacote.lerPreviaPacoteTemplate(caminhoLegado)).secoes.map(secao => secao.ocultar_titulo)).toEqual([false, false]);
    expect((await pacote.lerPreviaPacoteTemplate(caminhoLegado)).secoes.map(secao => secao.contar_na_numeracao)).toEqual([true, true]);
    expect((await pacote.importarPacoteTemplate(caminhoLegado, false)).success).toBe(true);
  });

  it('migra da versão 41 sem alterar conteúdo ou ocultar títulos existentes', async () => {
    await sqlite.executeNonQuery('ALTER TABLE secoes_template DROP COLUMN ocultar_titulo');
    await sqlite.executeNonQuery('ALTER TABLE secoes_template DROP COLUMN contar_na_numeracao');
    await sqlite.executeNonQuery('DELETE FROM schema_version');
    await sqlite.executeNonQuery('INSERT INTO schema_version (version) VALUES (41)');
    await sqlite.closeDatabase();
    await banco.setupDatabase();
    expect(await banco.getSchemaVersion()).toBe(banco.CURRENT_SCHEMA_VERSION);
    const secoes = await servico.findSecoesByTemplate(templateId);
    expect(secoes.map(secao => secao.ocultar_titulo)).toEqual([0, 0]);
    expect(secoes.map(secao => secao.contar_na_numeracao)).toEqual([1, 1]);
    expect(secoes[0].conteudo).toBe('<p>Texto inicial</p>');
    expect(secoes[1].parent_id).toBe(secoes[0].id);
  });

  it('migra da versão 42 preservando títulos ocultos e ativando a contagem', async () => {
    const secoesAnteriores = await servico.findSecoesByTemplate(templateId);
    await servico.updateSecao(secoesAnteriores[0].id, { ocultar_titulo: 1 });
    await sqlite.executeNonQuery('ALTER TABLE secoes_template DROP COLUMN contar_na_numeracao');
    await sqlite.executeNonQuery('DELETE FROM schema_version');
    await sqlite.executeNonQuery('INSERT INTO schema_version (version) VALUES (42)');
    await sqlite.closeDatabase();
    await banco.setupDatabase();
    expect(await banco.getSchemaVersion()).toBe(banco.CURRENT_SCHEMA_VERSION);
    const secoes = await servico.findSecoesByTemplate(templateId);
    expect(secoes.map(secao => secao.contar_na_numeracao)).toEqual([1, 1]);
    expect(secoes[0].ocultar_titulo).toBe(1);
    expect(secoes[0].conteudo).toBe('<p>Texto inicial</p>');
  });
});
