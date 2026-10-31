import { esquemaEstruturaIncorporada, esquemaRespostasIncorporadas, type EstruturaIncorporadaLaudo, type ContextoWizardLaudo, type EtapaIncorporadaArvore, type RespostasIncorporadas, type PecaIncorporadaCalculada } from '../../shared/types/laudo-bkp.types.js';
import type { LaudoRow, SecaoTemplateRow } from '../types/database.js';
import { executeQuery } from '../database/sqlite.js';
import { templateService } from './template.service.js';
import { wizardService } from './wizard.service.js';
import { regraWizardService } from './regra-wizard.service.js';

export function lerEstruturaIncorporada(laudo: Pick<LaudoRow, 'estrutura_incorporada_json'>): EstruturaIncorporadaLaudo | null {
  if (!laudo.estrutura_incorporada_json) return null;
  return esquemaEstruturaIncorporada.parse(JSON.parse(laudo.estrutura_incorporada_json));
}

export async function capturarEstruturaLaudo(laudo: LaudoRow): Promise<EstruturaIncorporadaLaudo> {
  const incorporada = lerEstruturaIncorporada(laudo);
  if (incorporada) return incorporada;
  if (!laudo.template_id) throw new Error('Laudo sem template ou estrutura incorporada.');
  const template = await templateService.findById(laudo.template_id);
  if (!template) throw new Error('Template do laudo não encontrado.');
  const secoes = await templateService.findSecoesByTemplate(template.id);
  const [wizard] = laudo.wizard_id
    ? await executeQuery<Record<string, unknown>>('SELECT * FROM wizards WHERE id = ?', [laudo.wizard_id]) : [];
  let estruturaWizard: unknown = null;
  if (laudo.wizard_id && !wizard) throw new Error('Wizard do laudo não encontrado.');
  if (wizard) {
    const etapas = await executeQuery<Record<string, unknown>>('SELECT * FROM etapas_wizard WHERE wizard_id = ? ORDER BY ordem', [laudo.wizard_id]);
    const opcoes = await executeQuery<Record<string, unknown>>('SELECT o.* FROM opcoes_etapa o JOIN etapas_wizard e ON e.id = o.etapa_id WHERE e.wizard_id = ? ORDER BY o.ordem', [laudo.wizard_id]);
    const regras = await executeQuery<Record<string, unknown>>('SELECT * FROM regras_wizard WHERE wizard_id = ? ORDER BY ordem', [laudo.wizard_id]);
    const pecas = await executeQuery<Record<string, unknown>>('SELECT DISTINCT p.* FROM pecas p JOIN regras_wizard r ON r.peca_id = p.id WHERE r.wizard_id = ?', [laudo.wizard_id]);
    estruturaWizard = { ...wizard, etapas, opcoes, pecas, regras: regras.map(regra => ({ ...regra,
      condicoes: esquemaRespostasIncorporadas.parse(typeof regra.condicoes === 'string' ? JSON.parse(regra.condicoes) : {}),
    })) };
  }
  return esquemaEstruturaIncorporada.parse({ formato: 1, origem: { repId: laudo.rep_id, laudoId: laudo.id }, template: { ...template, secoes }, wizard: estruturaWizard });
}

export async function obterSecoesDoLaudo(laudo: LaudoRow): Promise<SecaoTemplateRow[]> {
  const estrutura = lerEstruturaIncorporada(laudo);
  if (estrutura) return estrutura.template.secoes.map(secao => ({ ...secao, template_id: 'incorporado', created_at: '', updated_at: '' }));
  if (!laudo.template_id) throw new Error('Laudo sem estrutura de seções.');
  return templateService.findSecoesByTemplate(laudo.template_id);
}

export async function obterContextoWizardLaudo(laudo: LaudoRow): Promise<ContextoWizardLaudo | null> {
  const estrutura = lerEstruturaIncorporada(laudo);
  if (!estrutura) {
    let wizardId = laudo.wizard_id;
    if (!wizardId) {
      const [rep] = await executeQuery<{ tipo_exame_id: string }>('SELECT tipo_exame_id FROM reps WHERE id = ?', [laudo.rep_id]);
      if (rep) wizardId = (await wizardService.findByTipoExame(rep.tipo_exame_id))[0]?.id;
    }
    return wizardId ? wizardService.getArvoreCompleta(wizardId) : null;
  }
  const wizard = estrutura.wizard;
  if (!wizard) return null;
  const montar = (id: string): EtapaIncorporadaArvore => {
    const etapa = wizard.etapas.find(item => item.id === id);
    if (!etapa) throw new Error('Etapa incorporada não encontrada.');
    return { ...etapa, opcoes: wizard.opcoes.filter(opcao => opcao.etapa_id === id).sort((a, b) => a.ordem - b.ordem).map(opcao => ({
      id: opcao.id, label: opcao.label, valor: opcao.valor, ordem: opcao.ordem,
      etapa_filha: opcao.etapa_filha_id ? montar(opcao.etapa_filha_id) : undefined,
    })) };
  };
  return { wizard: { id: wizard.id, nome: wizard.nome }, etapas: wizard.etapas.filter(etapa => !etapa.etapa_pai_id).sort((a, b) => a.ordem - b.ordem).map(etapa => montar(etapa.id)) };
}

export async function calcularPecasDoLaudo(laudo: LaudoRow, respostas: RespostasIncorporadas, wizardId?: string): Promise<PecaIncorporadaCalculada[]> {
  const estrutura = lerEstruturaIncorporada(laudo);
  if (!estrutura) {
    const id = wizardId ?? laudo.wizard_id;
    if (!id) throw new Error('Wizard não informado.');
    return regraWizardService.calcularPecas(id, respostas);
  }
  if (!estrutura.wizard) throw new Error('Laudo importado sem wizard.');
  const wizard = estrutura.wizard;
  const satisfaz = (valor: string | string[] | undefined, condicao: string | string[]): boolean => {
    if (valor === undefined) return false;
    if (condicao === '*') return Array.isArray(valor) ? valor.length > 0 : valor.length > 0;
    if (Array.isArray(valor)) return Array.isArray(condicao) ? condicao.every(item => valor.includes(item)) : valor.includes(condicao);
    return condicao === valor;
  };
  return wizard.regras.filter(regra => Object.entries(regra.condicoes).every(([id, condicao]) => satisfaz(respostas[id], condicao)))
    .sort((a, b) => a.ordem - b.ordem).map(regra => {
      const peca = wizard.pecas.find(item => item.id === regra.peca_id);
      if (!peca) throw new Error('Peça incorporada ausente.');
      return { peca, secao_template_id: regra.secao_template_id, regra_id: regra.id, ordem: regra.ordem };
    });
}
