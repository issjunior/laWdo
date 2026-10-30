import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { app } from 'electron';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

let diretorio: string;
let sqlite: typeof import('../../main/database/sqlite');
let servico: typeof import('../../main/services/laudo-bkp.service');
let estrutura: typeof import('../../main/services/laudo-estrutura.service');
let arquivo: string;
let extraido: string;

beforeEach(async () => {
  diretorio = await mkdtemp(path.join(os.tmpdir(), 'lawdo-caso-portavel-'));
  vi.mocked(app.getPath).mockReturnValue(diretorio);
  vi.resetModules();
  const banco = await import('../../main/database/index');
  sqlite = await import('../../main/database/sqlite');
  await banco.setupDatabase();
  servico = await import('../../main/services/laudo-bkp.service');
  estrutura = await import('../../main/services/laudo-estrutura.service');
  await sqlite.executeNonQuery("INSERT INTO users (id, nome, email, username, senha_hash) VALUES ('perito', 'Origem', 'local@teste.local', 'acesso-local', 'segredo-local')");
  await sqlite.executeNonQuery("INSERT INTO tipos_exame (id, codigo, nome) VALUES ('tipo', 'TESTE', 'Exame de teste')");
  await sqlite.executeNonQuery("INSERT INTO templates (id, nome, tipo_exame_id) VALUES ('template', 'Modelo de origem', 'tipo')");
  await sqlite.executeNonQuery("INSERT INTO secoes_template (id, template_id, nome, ordem, conteudo) VALUES ('secao', 'template', 'Seção', 1, '<p>{{minha_chave}}</p>')");
  await sqlite.executeNonQuery("INSERT INTO placeholders (id, chave, valor) VALUES ('personalizado', 'minha_chave', 'Valor de origem')");
  await sqlite.executeNonQuery("INSERT INTO reps (id, numero, tipo_exame_id, data_requisicao, usuario_id) VALUES ('rep', 'TESTE/2026', 'tipo', '2026-10-30', 'perito')");
  const laudos = (await import('../../main/services/laudo.service')).laudoService;
  const laudo = await laudos.criarLaudoInicial({ rep_id: 'rep', perito_id: 'perito', template_id: 'template' });
  await sqlite.executeNonQuery("UPDATE laudos SET id = 'laudo', conteudo = ?, status = 'Entregue', data_conclusao = '2026-10-29', data_entrega = '2026-10-30' WHERE id = ?", ['<h2 data-secao-id="secao">Seção</h2><p>{{minha_chave}}</p>', laudo.id]);
  arquivo = path.join(diretorio, 'caso.bkp');
  extraido = path.join(diretorio, 'extraido');
});
afterEach(async () => {
  vi.restoreAllMocks();
  await sqlite?.closeDatabase();
  if (diretorio) await rm(diretorio, { recursive: true, force: true });
});

describe('transferência portável de um laudo', () => {
  it('transporta a cadeia da imagem editada e remapeia as figuras e seus originais na substituição', async () => {
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=', 'base64');
    await mkdir(path.join(diretorio, 'imagens/laudos/laudo'), { recursive: true });
    for (const [id, origem] of [['original', null], ['editada', 'original'], ['sem-uso', null]]) {
      const relativo = `imagens/laudos/laudo/${id}.png`;
      await writeFile(path.join(diretorio, relativo), bytes);
      await sqlite.executeNonQuery('INSERT INTO imagens_laudo (id, laudo_id, nome_arquivo, caminho_relativo, mime_type, tamanho, sha256, imagem_origem_id, legenda) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, 'laudo', `${id}.png`, relativo, 'image/png', bytes.length, createHash('sha256').update(bytes).digest('hex'), origem, `Legenda ${id}`]);
    }
    await sqlite.executeNonQuery('UPDATE laudos SET conteudo = ? WHERE id = ?',
      [`<figure data-image-id="editada" data-image-original-id="original"><img src="data:image/png;base64,${bytes.toString('base64')}"><figcaption>Legenda preservada</figcaption></figure>`, 'laudo']);
    await servico.exportarBkpLaudo('laudo', arquivo);
    const pacote = await servico.lerBkpLaudo(arquivo, extraido);
    expect(pacote.imagens.map(imagem => imagem.id).sort()).toEqual(['editada', 'original']);
    const previa = await servico.analisarConflitosBkp(pacote);
    const id = await servico.importarBkpLaudo(pacote, extraido, 'perito', previa.identidade, true);
    expect(id).toBe('laudo');
    const imagens = await sqlite.executeQuery<{ id: string; imagem_origem_id: string | null; caminho_relativo: string; nome_arquivo: string }>('SELECT * FROM imagens_laudo WHERE laudo_id = ?', [id]);
    expect(imagens).toHaveLength(2);
    const original = imagens.find(imagem => imagem.nome_arquivo === 'original.png');
    const editada = imagens.find(imagem => imagem.nome_arquivo === 'editada.png');
    expect(original?.id).toBeDefined();
    expect(editada?.id).toBeDefined();
    expect(original?.id).not.toBe('original');
    expect(editada?.id).not.toBe('editada');
    expect(editada?.imagem_origem_id).toBe(original?.id);
    const [laudo] = await sqlite.executeQuery<{ conteudo: string }>('SELECT conteudo FROM laudos WHERE id = ?', [id]);
    expect(laudo.conteudo).toContain(`data-image-id="${editada?.id}"`);
    expect(laudo.conteudo).toContain(`data-image-original-id="${original?.id}"`);
    expect(laudo.conteudo).toContain('Legenda preservada');
    for (const imagem of imagens) expect(await readFile(path.join(diretorio, imagem.caminho_relativo))).toEqual(bytes);
    await servico.exportarBkpLaudo(id, path.join(diretorio, 'imagens-reexportadas.bkp'));
  });

  it('remapeia conflitos transitivos de placeholders sem sobrescrever valores locais', async () => {
    await sqlite.executeNonQuery("INSERT INTO placeholders (id, chave, valor) VALUES ('intermediario', 'intermediario', '{{minha_chave}}'), ('externo', 'externo', '{{intermediario}}')");
    await sqlite.executeNonQuery("UPDATE laudos SET conteudo = '<p>{{externo}}</p>' WHERE id = 'laudo'");
    await servico.exportarBkpLaudo('laudo', arquivo);
    const pacote = await servico.lerBkpLaudo(arquivo, extraido);
    expect(pacote.placeholders.map(item => item.chave).sort()).toEqual(['externo', 'intermediario', 'minha_chave']);
    await sqlite.executeNonQuery("UPDATE placeholders SET valor = 'Valor exclusivo do destino' WHERE chave = 'minha_chave'");
    const locaisAntes = await sqlite.executeQuery('SELECT * FROM placeholders ORDER BY id');
    const previa = await servico.analisarConflitosBkp(pacote);
    const id = await servico.importarBkpLaudo(pacote, extraido, 'perito', previa.identidade, true);
    expect(await sqlite.executeQuery("SELECT * FROM placeholders WHERE chave NOT LIKE '%_importado_%' ORDER BY id")).toEqual(locaisAntes);
    const importados = await sqlite.executeQuery<{ chave: string; valor: string }>("SELECT chave, valor FROM placeholders WHERE chave LIKE '%_importado_%'");
    const interno = importados.find(item => item.chave.startsWith('minha_chave_importado_'));
    const intermediario = importados.find(item => item.chave.startsWith('intermediario_importado_'));
    const externo = importados.find(item => item.chave.startsWith('externo_importado_'));
    expect(importados).toHaveLength(3);
    expect(interno?.valor).toBe('Valor de origem');
    expect(intermediario?.valor).toBe(`{{${interno?.chave}}}`);
    expect(externo?.valor).toBe(`{{${intermediario?.chave}}}`);
    const [laudo] = await sqlite.executeQuery<{ conteudo: string; estrutura_incorporada_json: string }>('SELECT conteudo, estrutura_incorporada_json FROM laudos WHERE id = ?', [id]);
    expect(laudo.conteudo).toBe(`<p>{{${externo?.chave}}}</p>`);
    expect(estrutura.lerEstruturaIncorporada(laudo)?.template.secoes[0].conteudo).toBe(`<p>{{${interno?.chave}}}</p>`);
    const novoArquivo = path.join(diretorio, 'reexportado.bkp');
    await servico.exportarBkpLaudo(id, novoArquivo);
    const reexportado = await servico.lerBkpLaudo(novoArquivo, path.join(diretorio, 'reexportado'));
    expect(reexportado.placeholders.map(item => item.chave).sort()).toEqual(importados.map(item => item.chave).sort());
  });

  it.each([
    ['script', '<script>executar()</script>'],
    ['evento', '<p onclick="executar()">Texto</p>'],
    ['URL ativa', '<a href="javascript:executar()">Texto</a>'],
    ['CSS externo', '<p style="background:url(https://exemplo.invalid/imagem.png)">Texto</p>'],
    ['imagem externa', '<img src="https://exemplo.invalid/imagem.png">'],
    ['figura ausente', '<figure data-image-id="ausente">Foto</figure>'],
  ])('recusa %s no conteúdo importado antes de permitir substituição', async (_tipo, html) => {
    await servico.exportarBkpLaudo('laudo', arquivo);
    const pacote = await servico.lerBkpLaudo(arquivo, extraido);
    pacote.laudo.conteudo = html;
    const { criarArquivoLaudo } = await import('../../main/services/laudo-bkp-arquivo.service');
    const alterado = path.join(diretorio, 'alterado.bkp');
    await criarArquivoLaudo(alterado, '0.1.22', [{ nome: 'laudo.json', conteudo: Buffer.from(JSON.stringify(pacote)) }]);
    const antes = await sqlite.executeQuery('SELECT * FROM laudos');
    await expect(servico.lerBkpLaudo(alterado, path.join(diretorio, 'alterado'))).rejects.toThrow(/não permitido|não permitida|ausente/);
    expect(await sqlite.executeQuery('SELECT * FROM laudos')).toEqual(antes);
  });

  it('importa sem cadastro do template e preserva acesso, outros cadastros, autoria local, status e datas', async () => {
    await servico.exportarBkpLaudo('laudo', arquivo);
    expect((await readFile(arquivo)).includes(Buffer.from('segredo-local'))).toBe(false);
    const pacote = await servico.lerBkpLaudo(arquivo, extraido);
    const colunasRep = await sqlite.executeQuery<{ name: string }>('PRAGMA table_info(reps)');
    expect(Object.keys(pacote.rep).every(chave => colunasRep.some(coluna => coluna.name === chave))).toBe(true);
    await sqlite.executeNonQuery("DELETE FROM laudos WHERE id = 'laudo'");
    await sqlite.executeNonQuery("DELETE FROM secoes_template WHERE template_id = 'template'");
    await sqlite.executeNonQuery("DELETE FROM templates WHERE id = 'template'");
    await sqlite.executeNonQuery("UPDATE users SET nome = 'Destino' WHERE id = 'perito'");
    await sqlite.executeNonQuery("UPDATE placeholders SET valor = 'Valor local' WHERE chave = 'minha_chave'");
    const templatesAntes = await sqlite.executeQuery('SELECT * FROM templates ORDER BY id');
    const credenciaisAntes = await sqlite.executeQuery('SELECT * FROM users ORDER BY id');
    const configuracoesAntes = await sqlite.executeQuery('SELECT * FROM configuracoes ORDER BY chave');
    const previa = await servico.analisarConflitosBkp(pacote);
    const id = await servico.importarBkpLaudo(pacote, extraido, 'perito', previa.identidade, true);
    const [laudo] = await sqlite.executeQuery<{ template_id: null; apresentacao_json: string; estrutura_incorporada_json: string; status: string; data_entrega: string; conteudo: string }>('SELECT * FROM laudos WHERE id = ?', [id]);
    expect(laudo).toMatchObject({ template_id: null, status: 'Entregue', data_entrega: '2026-10-30' });
    expect(laudo.apresentacao_json).toContain('Destino');
    expect(laudo.conteudo).toContain('minha_chave_importado_');
    expect(estrutura.lerEstruturaIncorporada(laudo)?.template.nome).toBe('Modelo de origem');
    expect(await sqlite.executeQuery('SELECT * FROM templates ORDER BY id')).toEqual(templatesAntes);
    expect(await sqlite.executeQuery('SELECT * FROM users ORDER BY id')).toEqual(credenciaisAntes);
    expect(await sqlite.executeQuery('SELECT * FROM configuracoes ORDER BY chave')).toEqual(configuracoesAntes);
    await servico.exportarBkpLaudo(id, path.join(diretorio, 'segunda.bkp'));
  });

  it('impede substituição sem confirmação, prévia desatualizada e REP com vários laudos', async () => {
    await servico.exportarBkpLaudo('laudo', arquivo);
    const pacote = await servico.lerBkpLaudo(arquivo, extraido);
    const previa = await servico.analisarConflitosBkp(pacote);
    await expect(servico.importarBkpLaudo(pacote, extraido, 'perito', previa.identidade, false)).rejects.toThrow('Confirme');
    await sqlite.executeNonQuery("UPDATE laudos SET conteudo = '<p>Edição local</p>' WHERE id = 'laudo'");
    await expect(servico.importarBkpLaudo(pacote, extraido, 'perito', previa.identidade, true)).rejects.toThrow('alterado após');
    await sqlite.executeNonQuery('DROP INDEX idx_laudos_rep_unico');
    await sqlite.executeNonQuery("INSERT INTO laudos (id, rep_id, perito_id, template_id, conteudo) VALUES ('outro', 'rep', 'perito', 'template', 'Outro laudo')");
    expect((await servico.analisarConflitosBkp(pacote)).previa.bloqueio).toContain('vários laudos');
  });

  it('leva apenas a figura usada e reverte registros e arquivos se ocorrer falha na transação', async () => {
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII=', 'base64');
    const relativo = 'imagens/laudos/laudo/foto.png';
    await mkdir(path.join(diretorio, 'imagens/laudos/laudo'), { recursive: true });
    await writeFile(path.join(diretorio, relativo), bytes);
    for (const id of ['usada', 'nao-usada']) await sqlite.executeNonQuery('INSERT INTO imagens_laudo (id, laudo_id, nome_arquivo, caminho_relativo, mime_type, tamanho, sha256) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, 'laudo', 'foto.png', relativo, 'image/png', bytes.length, createHash('sha256').update(bytes).digest('hex')]);
    await sqlite.executeNonQuery('UPDATE laudos SET conteudo = ? WHERE id = ?', [`<figure data-image-id="usada"><img src="data:image/png;base64,${bytes.toString('base64')}" /></figure>`, 'laudo']);
    await servico.exportarBkpLaudo('laudo', arquivo);
    const pacote = await servico.lerBkpLaudo(arquivo, extraido);
    expect(pacote.imagens.map(imagem => imagem.id)).toEqual(['usada']);
    const previa = await servico.analisarConflitosBkp(pacote);
    const laudosAntes = await sqlite.executeQuery('SELECT * FROM laudos');
    const imagensAntes = await sqlite.executeQuery('SELECT * FROM imagens_laudo ORDER BY id');
    const executar = sqlite.executeNonQuery;
    vi.spyOn(sqlite, 'executeNonQuery').mockImplementation(async (sql, parametros) => {
      if (sql.startsWith('INSERT INTO logs_auditoria')) throw new Error('falha simulada de persistência');
      return executar(sql, parametros);
    });
    await expect(servico.importarBkpLaudo(pacote, extraido, 'perito', previa.identidade, true)).rejects.toThrow('falha simulada');
    expect(await sqlite.executeQuery('SELECT * FROM laudos')).toEqual(laudosAntes);
    expect(await sqlite.executeQuery('SELECT * FROM imagens_laudo ORDER BY id')).toEqual(imagensAntes);
    expect(await readFile(path.join(diretorio, relativo))).toEqual(bytes);
  });
  it('retoma o wizard incorporado sem cadastrar etapas, regras ou peças no destino', async () => {
    await sqlite.executeNonQuery("INSERT INTO wizards (id, tipo_exame_id, template_id, nome) VALUES ('wizard', 'tipo', 'template', 'Assistente original')");
    await sqlite.executeNonQuery("INSERT INTO etapas_wizard (id, wizard_id, pergunta, tipo_input, nivel, ordem) VALUES ('etapa', 'wizard', 'Escolha', 'radio', 0, 1)");
    await sqlite.executeNonQuery("INSERT INTO opcoes_etapa (id, etapa_id, label, valor, ordem) VALUES ('opcao', 'etapa', 'Sim', 'sim', 1)");
    await sqlite.executeNonQuery("INSERT INTO pecas (id, nome, conteudo) VALUES ('peca', 'Peça original', '<p>Peça do wizard</p>')");
    await sqlite.executeNonQuery('INSERT INTO regras_wizard (id, wizard_id, peca_id, secao_template_id, condicoes, ordem) VALUES (?, ?, ?, ?, ?, ?)',
      ['regra', 'wizard', 'peca', 'secao', JSON.stringify({ etapa: 'sim' }), 1]);
    await sqlite.executeNonQuery('UPDATE laudos SET wizard_id = ?, respostas_wizard = ? WHERE id = ?', ['wizard', JSON.stringify({ etapa: 'sim' }), 'laudo']);
    await servico.exportarBkpLaudo('laudo', arquivo);
    const pacote = await servico.lerBkpLaudo(arquivo, extraido);
    const previa = await servico.analisarConflitosBkp(pacote);
    const id = await servico.importarBkpLaudo(pacote, extraido, 'perito', previa.identidade, true);
    const laudos = (await import('../../main/services/laudo.service')).laudoService;
    const importado = await laudos.findById(id);
    if (!importado) throw new Error('Laudo não importado.');
    expect(importado.template_id).toBeNull();
    expect(importado.wizard_id).toBeNull();
    const contexto = await estrutura.obterContextoWizardLaudo(importado);
    expect(contexto?.wizard.nome).toBe('Assistente original');
    const respostas = await laudos.getRespostasWizard(id);
    expect(contexto?.etapas[0].id).not.toBe('etapa');
    expect(respostas[contexto?.etapas[0].id ?? '']).toBe('sim');
    expect(await estrutura.calcularPecasDoLaudo(importado, respostas)).toEqual([expect.objectContaining({ peca: expect.objectContaining({ nome: 'Peça original' }) })]);
    await laudos.salvarProgressoWizard(id, respostas);
    expect(await laudos.getRespostasWizard(id)).toEqual(respostas);
    await laudos.gerarLaudoWizard({ laudo_id: id, wizard_id: contexto?.wizard.id ?? '', template_id: null, respostas });
    expect((await laudos.findById(id))?.conteudo).toContain('Peça do wizard');
    expect(await sqlite.executeQuery('SELECT * FROM respostas_wizard WHERE laudo_id = ?', [id])).toEqual([]);
    expect(await sqlite.executeQuery('SELECT id FROM wizards')).toEqual([{ id: 'wizard' }]);
    expect(await sqlite.executeQuery('SELECT id FROM pecas')).toEqual([{ id: 'peca' }]);
  });

  it('mantém seções e edições ao sincronizar um template ausente do catálogo', async () => {
    await servico.exportarBkpLaudo('laudo', arquivo);
    const pacote = await servico.lerBkpLaudo(arquivo, extraido);
    const previa = await servico.analisarConflitosBkp(pacote);
    const id = await servico.importarBkpLaudo(pacote, extraido, 'perito', previa.identidade, true);
    await sqlite.executeNonQuery("DELETE FROM secoes_template WHERE template_id = 'template'");
    await sqlite.executeNonQuery("DELETE FROM templates WHERE id = 'template'");
    await sqlite.executeNonQuery('UPDATE laudos SET conteudo = REPLACE(conteudo, ?, ?) WHERE id = ?', ['{{minha_chave}}', 'Edição feita no destino', id]);
    const laudos = (await import('../../main/services/laudo.service')).laudoService;
    await laudos.sincronizarSecoesCondicionais(id);
    expect((await laudos.findById(id))?.conteudo).toContain('Edição feita no destino');
    expect(await sqlite.executeQuery("SELECT id FROM templates WHERE id = 'template'")).toEqual([]);
  });

  it('preserva estrutura e apresentação ao reconciliar uma restrição legada por REP', async () => {
    await servico.exportarBkpLaudo('laudo', arquivo);
    const pacote = await servico.lerBkpLaudo(arquivo, extraido);
    const previa = await servico.analisarConflitosBkp(pacote);
    const id = await servico.importarBkpLaudo(pacote, extraido, 'perito', previa.identidade, true);
    const antes = await sqlite.executeQuery('SELECT * FROM laudos WHERE id = ?', [id]);
    await sqlite.executeNonQuery('DROP INDEX idx_laudos_rep_unico');
    await sqlite.executeNonQuery('CREATE UNIQUE INDEX legado_laudos_rep_unico ON laudos(rep_id)');
    const banco = await import('../../main/database/index');
    await banco.setupDatabase();
    expect(await sqlite.executeQuery('SELECT * FROM laudos WHERE id = ?', [id])).toEqual(antes);
    const colunas = await sqlite.executeQuery<{ name: string; notnull: number }>('PRAGMA table_info(laudos)');
    expect(colunas.find(coluna => coluna.name === 'template_id')?.notnull).toBe(0);
    expect(await sqlite.executeQuery('PRAGMA foreign_key_check')).toEqual([]);
    await expect(sqlite.executeNonQuery("INSERT INTO laudos (id, rep_id, perito_id, template_id, conteudo) VALUES ('segundo', 'rep', 'perito', 'template', 'Segundo')")).rejects.toThrow('UNIQUE');
  });

});
