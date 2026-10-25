import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CABECALHO_LAUDO_PADRAO, FECHAMENTO_LAUDO_PADRAO, lerApresentacaoLaudo } from '../../shared/configuracoes/apresentacao-laudo';

describe('preservação da apresentação por laudo', () => {
  let diretorio: string;
  let banco: typeof import('../../main/database/index');
  let sqlite: typeof import('../../main/database/sqlite');
  let laudos: typeof import('../../main/services/laudo.service')['laudoService'];
  let configuracao: typeof import('../../main/services/configuracao.service')['configuracaoService'];

  beforeAll(async () => {
    diretorio = await fs.mkdtemp(path.join(os.tmpdir(), 'lawdo-apresentacao-'));
    vi.mocked(app.getPath).mockReturnValue(diretorio);
    vi.resetModules();
    banco = await import('../../main/database/index');
    sqlite = await import('../../main/database/sqlite');
    await banco.setupDatabase();
    laudos = (await import('../../main/services/laudo.service')).laudoService;
    configuracao = (await import('../../main/services/configuracao.service')).configuracaoService;
    await sqlite.executeNonQuery("INSERT INTO users (id,nome,email,username,senha_hash,cargo,lotacao) VALUES ('perito','Perito original','perito@teste.local','perito','hash','Perito Oficial Criminal','Unidade original')");
    await sqlite.executeNonQuery("INSERT INTO templates (id,nome) VALUES ('template','Template de teste')");
    for (const id of ['rep1', 'rep2', 'rep3']) await sqlite.executeNonQuery('INSERT INTO reps (id,numero,data_requisicao) VALUES (?,?,?)', [id, id, '2026-10-16']);
  });
  afterAll(async () => {
    await sqlite?.closeDatabase();
    if (diretorio) await fs.rm(diretorio, { recursive: true, force: true });
  });

  it('instala os três conteúdos habilitados com os padrões do release', async () => {
    expect(JSON.parse((await configuracao.obter('cabecalho_documento'))!)).toEqual(CABECALHO_LAUDO_PADRAO);
    expect(JSON.parse((await configuracao.obter('fechamento_laudo'))!)).toEqual(FECHAMENTO_LAUDO_PADRAO);
    expect(CABECALHO_LAUDO_PADRAO).toMatchObject({ primeiraPaginaHabilitada: true, todasPaginasHabilitadas: true });
    expect(FECHAMENTO_LAUDO_PADRAO).toMatchObject({ habilitado: true, espacamentoAntesPt: 34 });
  });

  it('cria a cópia com o conteúdo e não a substitui após alteração de padrões, perfil ou corpo', async () => {
    await configuracao.salvar('cabecalho_documento', JSON.stringify({ habilitado: true, primeiraPagina: '<p>{{perito_nome}}</p>', todasPaginas: '<p>{{pagina}}</p>' }));
    expect(JSON.parse((await configuracao.obter('cabecalho_documento'))!)).toMatchObject({ primeiraPaginaHabilitada: true, todasPaginasHabilitadas: true });
    await configuracao.salvar('fechamento_laudo', JSON.stringify({ habilitado: true, conteudo: '<p>{{perito_lotacao}}</p>', espacamentoAntesPt: 36 }));
    const primeiro = await laudos.criarLaudoInicial({ rep_id: 'rep1', perito_id: 'perito', template_id: 'template' });
    expect(lerApresentacaoLaudo(primeiro.apresentacao_json)).toMatchObject({ perito: { perito_nome: 'Perito original', perito_lotacao: 'Unidade original' }, fechamento: { habilitado: true } });
    await configuracao.salvar('cabecalho_documento', JSON.stringify({ primeiraPaginaHabilitada: false, todasPaginasHabilitadas: true, primeiraPagina: '<p>Novo cabeçalho</p>', todasPaginas: '<p>{{pagina}}</p>' }));
    await configuracao.salvar('fechamento_laudo', JSON.stringify({ habilitado: false, conteudo: '<p>Novo fechamento</p>', espacamentoAntesPt: 10 }));
    await sqlite.executeNonQuery("UPDATE users SET nome = 'Outro nome', lotacao = 'Outra unidade' WHERE id = 'perito'");
    await laudos.updateConteudo(primeiro.id, '<p>Corpo atualizado</p>');
    expect((await laudos.findById(primeiro.id))?.apresentacao_json).toBe(primeiro.apresentacao_json);
    const segundo = await laudos.criarLaudoInicial({ rep_id: 'rep2', perito_id: 'perito', template_id: 'template' });
    expect(lerApresentacaoLaudo(segundo.apresentacao_json)).toMatchObject({ perito: { perito_nome: 'Outro nome' }, cabecalho: { primeiraPaginaHabilitada: false, todasPaginasHabilitadas: true }, fechamento: { habilitado: false, conteudo: '<p>Novo fechamento</p>' } });
  });

  it('rejeita configuração inválida sem apagar o conteúdo anterior', async () => {
    const anterior = await configuracao.obter('fechamento_laudo');
    await expect(configuracao.salvar('fechamento_laudo', '{invalido')).rejects.toThrow();
    await expect(configuracao.salvar('fechamento_laudo', JSON.stringify({ habilitado: true, conteudo: '', espacamentoAntesPt: -1 }))).rejects.toThrow();
    expect(await configuracao.obter('fechamento_laudo')).toBe(anterior);
  });

  it('substitui padrões na v44 uma única vez, preservando os laudos e alterações posteriores', async () => {
    const anteriores = await sqlite.executeQuery('SELECT id, apresentacao_json FROM laudos');
    await sqlite.executeNonQuery('DELETE FROM schema_version');
    await sqlite.executeNonQuery('INSERT INTO schema_version (version) VALUES (44)');
    await sqlite.closeDatabase();
    await banco.setupDatabase();
    expect(await banco.getSchemaVersion()).toBe(banco.CURRENT_SCHEMA_VERSION);
    expect(JSON.parse((await configuracao.obter('cabecalho_documento'))!)).toEqual(CABECALHO_LAUDO_PADRAO);
    expect(JSON.parse((await configuracao.obter('fechamento_laudo'))!)).toEqual(FECHAMENTO_LAUDO_PADRAO);
    expect(await sqlite.executeQuery('SELECT id, apresentacao_json FROM laudos')).toEqual(anteriores);
    const personalizado = { habilitado: false, conteudo: '<p>Personalização posterior</p>', espacamentoAntesPt: 0 };
    await configuracao.salvar('fechamento_laudo', JSON.stringify(personalizado));
    await configuracao.salvar('cabecalho_documento', JSON.stringify({ ...CABECALHO_LAUDO_PADRAO, primeiraPaginaHabilitada: false }));
    await sqlite.closeDatabase();
    await banco.setupDatabase();
    expect(JSON.parse((await configuracao.obter('fechamento_laudo'))!)).toEqual(personalizado);
    expect(JSON.parse((await configuracao.obter('cabecalho_documento'))!)).toMatchObject({ primeiraPaginaHabilitada: false, todasPaginasHabilitadas: true });
    expect(await sqlite.executeQuery('SELECT id, apresentacao_json FROM laudos')).toEqual(anteriores);
  });

  it('migra a versão 43 com cabeçalho legado e perfil atual, sem fechamento nem regravação na reabertura', async () => {
    await configuracao.salvar('cabecalho_laudo', '<p>Cabeçalho legado {{perito_nome}}</p>');
    await configuracao.salvar('cabecalho_paginas', '<p>{{numero_rep}} {{pagina}}</p>');
    await sqlite.executeNonQuery('ALTER TABLE laudos DROP COLUMN apresentacao_json');
    await sqlite.executeNonQuery('DELETE FROM schema_version');
    await sqlite.executeNonQuery('INSERT INTO schema_version (version) VALUES (43)');
    await sqlite.closeDatabase();
    await banco.setupDatabase();
    expect(await banco.getSchemaVersion()).toBe(banco.CURRENT_SCHEMA_VERSION);
    const migrados = await sqlite.executeQuery<{ id: string; apresentacao_json: string }>('SELECT id, apresentacao_json FROM laudos');
    expect(migrados).toHaveLength(2);
    for (const laudo of migrados) expect(lerApresentacaoLaudo(laudo.apresentacao_json)).toMatchObject({ cabecalho: { primeiraPaginaHabilitada: true, todasPaginasHabilitadas: true, primeiraPagina: '<p>Cabeçalho legado {{perito_nome}}</p>' }, fechamento: { habilitado: false, conteudo: '' }, perito: { perito_nome: 'Outro nome' } });
    await configuracao.salvar('cabecalho_laudo', '<p>Alterado depois</p>');
    await sqlite.closeDatabase();
    await banco.setupDatabase();
    expect(await sqlite.executeQuery('SELECT id, apresentacao_json FROM laudos')).toEqual(migrados);
  });
});
