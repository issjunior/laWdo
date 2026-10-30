import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ArvoreWizard } from '../../main/services/wizard.service';
import type { LaudoRow } from '../../main/types/database';
import type { RespostasIncorporadas } from '../../shared/types/laudo-bkp.types';

let diretorio: string;
let sqlite: typeof import('../../main/database/sqlite');
let wizard: typeof import('../../main/services/wizard.service')['wizardService'];
let estrutura: typeof import('../../main/services/laudo-estrutura.service');
let catalogo: LaudoRow;
let incorporado: LaudoRow;

function criarEtapa(id: string, nivel = 0): ArvoreWizard['etapas'][number] {
  return { id, pergunta: `Pergunta ${id}`, tipo_input: 'radio', nivel, ordem: 0,
    obrigatorio: true, multipla_escolha: false, opcoes: [] };
}

async function prepararArvoreRamificada(): Promise<ArvoreWizard> {
  const cadastro = await wizard.findById('ramificado');
  if (!cadastro) throw new Error('Wizard sintético ausente');
  const neta = criarEtapa('neta', 2);
  neta.descricao_ajuda = 'Detalhamento da ramificação';
  neta.obrigatorio = false;
  neta.multipla_escolha = true;
  neta.tipo_input = 'checkbox';
  const irma = criarEtapa('irma', 1);
  irma.opcoes = [{ id: 'opcao-irma', label: 'Outro fim', valor: 'outro', ordem: 0 }];
  const filha = criarEtapa('filha', 1);
  filha.opcoes = [{ id: 'opcao-filha', label: 'Detalhar', valor: 'detalhar', ordem: 0, etapa_filha: neta }];
  const raiz = criarEtapa('raiz');
  raiz.opcoes = [
    { id: 'opcao-raiz', label: 'Continuar', valor: 'sim', ordem: 0, etapa_filha: filha },
    { id: 'opcao-sem-filha', label: 'Encerrar', valor: 'nao', ordem: 1 },
    { id: 'opcao-outra-ramificacao', label: 'Alternativa', valor: 'alternativa', ordem: 2, etapa_filha: irma },
  ];
  const arvore = { wizard: cadastro, etapas: [raiz] };
  await wizard.saveArvoreCompleta('ramificado', arvore);
  return arvore;
}

beforeAll(async () => {
  diretorio = await fs.mkdtemp(path.join(os.tmpdir(), 'lawdo-wizard-regressao-'));
  vi.mocked(app.getPath).mockReturnValue(diretorio);
  vi.resetModules();
  sqlite = await import('../../main/database/sqlite');
  await (await import('../../main/database/index')).setupDatabase();
  wizard = (await import('../../main/services/wizard.service')).wizardService;
  estrutura = await import('../../main/services/laudo-estrutura.service');
  await sqlite.executeNonQuery("INSERT INTO tipos_exame (id, codigo, nome) VALUES ('tipo', 'WIZARD-REGRESSAO', 'Sintético')");
  await sqlite.executeNonQuery("INSERT INTO templates (id, tipo_exame_id, nome) VALUES ('template', 'tipo', 'Sintético')");
  await sqlite.executeNonQuery("INSERT INTO secoes_template (id, template_id, nome, ordem) VALUES ('secao', 'template', 'Exame', 0)");
  for (const id of ['catalogo', 'ramificado']) {
    await sqlite.executeNonQuery('INSERT INTO wizards (id, tipo_exame_id, template_id, nome) VALUES (?, ?, ?, ?)', [id, 'tipo', 'template', id]);
  }
  for (const [id, tipo] of [['escolha', 'radio'], ['multipla', 'checkbox'], ['livre', 'text']]) {
    await sqlite.executeNonQuery('INSERT INTO etapas_wizard (id, wizard_id, pergunta, tipo_input, nivel, ordem) VALUES (?, ?, ?, ?, 0, 0)', [id, 'catalogo', id, tipo]);
  }
  const regras = [
    { id: 'exata', condicoes: { escolha: 'sim' }, ordem: 3 },
    { id: 'checkbox', condicoes: { multipla: 'a' }, ordem: 1 },
    { id: 'todos', condicoes: { multipla: ['a', 'b'] }, ordem: 2 },
    { id: 'qualquer', condicoes: { livre: '*' }, ordem: 4 },
    { id: 'conjunta', condicoes: { escolha: 'sim', livre: '*' }, ordem: 5 },
  ];
  for (const regra of regras) {
    await sqlite.executeNonQuery('INSERT INTO pecas (id, nome, conteudo) VALUES (?, ?, ?)', [regra.id, regra.id, `<p>${regra.id}</p>`]);
    await sqlite.executeNonQuery('INSERT INTO regras_wizard (id, wizard_id, peca_id, secao_template_id, condicoes, ordem) VALUES (?, ?, ?, ?, ?, ?)', [regra.id, 'catalogo', regra.id, 'secao', JSON.stringify(regra.condicoes), regra.ordem]);
  }
  catalogo = { id: 'laudo', rep_id: 'rep', perito_id: 'perito', template_id: 'template', wizard_id: 'catalogo',
    conteudo: '', status: 'Em andamento', data_inicio: '', versao: 1, created_at: '', updated_at: '' };
  incorporado = { ...catalogo, template_id: null, wizard_id: undefined,
    estrutura_incorporada_json: JSON.stringify(await estrutura.capturarEstruturaLaudo(catalogo)) };
});
afterAll(async () => {
  await sqlite?.closeDatabase();
  if (diretorio) await fs.rm(diretorio, { recursive: true, force: true });
});

describe('persistência e regras do wizard', () => {
  it('salva e relê ramificações na opção correspondente sem promover filhas à raiz', async () => {
    const { etapas: [raiz] } = await prepararArvoreRamificada();
    const relido = await wizard.getArvoreCompleta('ramificado');
    expect(relido.etapas).toHaveLength(1);
    expect(relido.etapas[0]).toMatchObject(raiz);
    expect(relido.etapas[0].opcoes[1].etapa_filha).toBeUndefined();
  });

  it.each([false, true])('recusa ciclo e recupera a leitura após correção, sem raiz: %s', async semRaiz => {
    await prepararArvoreRamificada();
    await sqlite.executeNonQuery("UPDATE opcoes_etapa SET etapa_filha_id = 'raiz' WHERE id = 'opcao-filha'");
    if (semRaiz) await sqlite.executeNonQuery("UPDATE etapas_wizard SET etapa_pai_id = 'filha' WHERE id = 'raiz'");
    try {
      await expect(wizard.getArvoreCompleta('ramificado')).rejects.toThrow('Referência cíclica nas etapas do wizard');
    } finally {
      await sqlite.executeNonQuery("UPDATE opcoes_etapa SET etapa_filha_id = 'neta' WHERE id = 'opcao-filha'");
      await sqlite.executeNonQuery("UPDATE etapas_wizard SET etapa_pai_id = NULL WHERE id = 'raiz'");
    }
    const relido = await wizard.getArvoreCompleta('ramificado');
    expect(relido.etapas).toHaveLength(1);
    expect(relido.etapas[0].opcoes[0].etapa_filha?.opcoes[0].etapa_filha?.id).toBe('neta');
  });

  it('não incorpora uma etapa vinculada que pertence a outro wizard', async () => {
    await prepararArvoreRamificada();
    await sqlite.executeNonQuery("UPDATE opcoes_etapa SET etapa_filha_id = 'escolha' WHERE id = 'opcao-sem-filha'");
    try {
      const relido = await wizard.getArvoreCompleta('ramificado');
      expect(relido.etapas).toHaveLength(1);
      expect(relido.etapas[0].opcoes[1].etapa_filha).toBeUndefined();
    } finally {
      await sqlite.executeNonQuery("UPDATE opcoes_etapa SET etapa_filha_id = NULL WHERE id = 'opcao-sem-filha'");
    }
  });

  it('recupera ramificação órfã sem duplicar na raiz uma neta lida antes da filha', async () => {
    await prepararArvoreRamificada();
    await sqlite.executeNonQuery("UPDATE opcoes_etapa SET etapa_filha_id = NULL WHERE id = 'opcao-raiz'");
    await sqlite.executeNonQuery("UPDATE etapas_wizard SET ordem = 10 WHERE id = 'filha'");
    try {
      const relido = await wizard.getArvoreCompleta('ramificado');
      expect(relido.etapas.map(etapa => etapa.id)).toEqual(['raiz', 'filha']);
      expect(relido.etapas[0].opcoes[0].etapa_filha).toBeUndefined();
      expect(relido.etapas[0].opcoes[2].etapa_filha?.id).toBe('irma');
      expect(relido.etapas[1].opcoes[0].etapa_filha?.id).toBe('neta');
    } finally {
      await sqlite.executeNonQuery("UPDATE opcoes_etapa SET etapa_filha_id = 'filha' WHERE id = 'opcao-raiz'");
      await sqlite.executeNonQuery("UPDATE etapas_wizard SET ordem = 0 WHERE id = 'filha'");
    }
  });

  it('reverte a exclusão da árvore anterior e inserções parciais se uma opção falha', async () => {
    const cadastro = await wizard.findById('catalogo');
    if (!cadastro) throw new Error('Wizard sintético ausente');
    const etapasAntes = await sqlite.executeQuery('SELECT * FROM etapas_wizard ORDER BY id');
    const opcoesAntes = await sqlite.executeQuery('SELECT * FROM opcoes_etapa ORDER BY id');
    const regrasAntes = await sqlite.executeQuery('SELECT * FROM regras_wizard ORDER BY id');
    const nova = criarEtapa('nova');
    nova.opcoes = [{ id: 'falhar', label: 'Falhar', valor: 'falha', ordem: 0 }];
    await sqlite.executeNonQuery("CREATE TRIGGER falha_wizard_regressao BEFORE INSERT ON opcoes_etapa WHEN NEW.id = 'falhar' BEGIN SELECT RAISE(ABORT, 'falha sintética na opção'); END");
    try {
      await expect(wizard.saveArvoreCompleta('catalogo', { wizard: cadastro, etapas: [nova] })).rejects.toThrow('falha sintética');
      expect(await sqlite.executeQuery('SELECT * FROM etapas_wizard ORDER BY id')).toEqual(etapasAntes);
      expect(await sqlite.executeQuery('SELECT * FROM opcoes_etapa ORDER BY id')).toEqual(opcoesAntes);
      expect(await sqlite.executeQuery('SELECT * FROM regras_wizard ORDER BY id')).toEqual(regrasAntes);
      expect(await sqlite.executeQuery('PRAGMA foreign_key_check')).toEqual([]);
    } finally {
      await sqlite.executeNonQuery('DROP TRIGGER falha_wizard_regressao');
    }
  });

  const cenarios: Array<{ caso: string; respostas: RespostasIncorporadas; esperadas: string[] }> = [
    { caso: 'resposta ausente', respostas: {}, esperadas: [] },
    { caso: 'igualdade exata', respostas: { escolha: 'sim' }, esperadas: ['exata'] },
    { caso: 'resposta divergente', respostas: { escolha: 'nao' }, esperadas: [] },
    { caso: 'seleção parcial', respostas: { multipla: ['a'] }, esperadas: ['checkbox'] },
    { caso: 'seleção fora da condição', respostas: { multipla: ['b'] }, esperadas: [] },
    { caso: 'curinga com string', respostas: { livre: 'texto' }, esperadas: ['qualquer'] },
    { caso: 'curinga com lista', respostas: { livre: ['imagem'] }, esperadas: ['qualquer'] },
    { caso: 'curinga com string vazia', respostas: { livre: '' }, esperadas: [] },
    { caso: 'curinga com lista vazia', respostas: { livre: [] }, esperadas: [] },
    { caso: 'todas as condições e ordenação', respostas: { escolha: 'sim', multipla: ['b', 'a'], livre: 'texto' }, esperadas: ['checkbox', 'todos', 'exata', 'qualquer', 'conjunta'] },
  ];
  it.each(cenarios)('seleciona as peças esperadas nos dois caminhos: $caso', async ({ respostas, esperadas }) => {
    for (const laudo of [catalogo, incorporado]) {
      const pecas = await estrutura.calcularPecasDoLaudo(laudo, respostas);
      expect(pecas.map(item => item.peca.id)).toEqual(esperadas);
      expect(pecas.map(item => item.regra_id)).toEqual(esperadas);
      expect(pecas.every(item => item.secao_template_id === 'secao')).toBe(true);
    }
  });
});
