import type { REPFormData } from '../types';
import type { ContextoSerializacaoCamposEspecificos, ExamService } from './types';
import { combinarEnvolvido, separarEnvolvido } from '@shared/utils/envolvido';

function formatarNumeroBO(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 4) return digits;
  const year = digits.slice(0, 4);
  const num = digits.slice(4, 10);
  return `${year}/${num}`;
}

const MAX_MATERIAL_ENC = 20;
const MAX_CARTUCHOS = 20;
const MAX_ESTOJOS = 20;
const MAX_ARMAS = 20;

const ARMA_CAMPOS = [
  'tipo', 'marca', 'modelo', 'calibre', 'numeracao_serie', 'numeracao_cano',
  'capacidade_carregador', 'comprimento_cano', 'acabamento',
  'funcionamento', 'estado_conservacao', 'quantidade', 'dito_oficio', 'numero_lacre',
];

const ARMA_CAMPOS_MATERIAL = [
  'marca', 'calibre', 'numeracao_serie', 'numeracao_cano',
  'capacidade_carregador', 'comprimento_cano', 'acabamento',
  'funcionamento', 'estado_conservacao',
];

export const b602Service: ExamService = {
  codigo: 'B-602',

  serialize(
    data: REPFormData,
    contexto?: ContextoSerializacaoCamposEspecificos,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    const envolvidos: string[] = [];
    for (let i = 0; i < 10; i++) {
      const nome = (data as Record<string, string>)[`b602_envolvidos_${i}`] || '';
      const qualificacao = (data as Record<string, string>)[`b602_envolvidos_qualificacao_${i}`] || '';
      const envolvido = combinarEnvolvido(qualificacao, nome);
      if (envolvido) envolvidos.push(envolvido);
    }

    result.envolvidos = envolvidos;
    result.data_ocorrencia = ((data as Record<string, string>)['b602_data_ocorrencia'] || '').split('T')[0];
    const localBairro = ((data as Record<string, string>)['b602_local_bairro'] || '').trim();
    const localCidade = ((data as Record<string, string>)['b602_local_cidade'] || '').trim();
    const localUf = ((data as Record<string, string>)['b602_local_uf'] || '').trim();
    result.local = { bairro: localBairro, cidade: localCidade, uf: localUf };
    result.numero_bo = (data as Record<string, string>)['b602_numero_bo'] || '';
    result.numero_ip = (data as Record<string, string>)['b602_numero_ip'] || '';
    result.solicitante_nome = (data as Record<string, string>)['b602_solicitante_nome'] || '';


    const items: Record<string, string>[] = [];
    for (let i = 0; i < MAX_MATERIAL_ENC; i++) {
      const natureza = (data as Record<string, string>)[`b602_material_enc_${i}_natureza`];
      if (!natureza && i > 0) continue;
      const item: Record<string, string> = {
        natureza: natureza || 'Arma',
        quantidade: (data as Record<string, string>)[`b602_material_enc_${i}_quantidade`] || '01',
        tipo: (data as Record<string, string>)[`b602_material_enc_${i}_tipo`] || 'Pistola',
        dito_oficio: (data as Record<string, string>)[`b602_material_enc_${i}_dito_oficio`] || '""',
        numero_lacre: (data as Record<string, string>)[`b602_material_enc_${i}_numero_lacre`] || '',
      };
      for (const campo of ARMA_CAMPOS_MATERIAL) {
        const val = (data as Record<string, string>)[`b602_material_enc_${i}_arma_${campo}`];
        if (val) item[`arma_${campo}`] = val;
      }
      items.push(item);
    }
    result.material_enc = items;

    const cartuchosToggle = (data as Record<string, string>)['b602_cartuchos_toggle'];
    if (cartuchosToggle === 'on') {
      const items: Record<string, unknown>[] = [];
      for (let i = 0; i < MAX_CARTUCHOS; i++) {
        const calibre = (data as Record<string, string>)[`b602_cartuchos_${i}_calibre`];
        if (!calibre && i > 0) continue;
        const obsRaw = (data as Record<string, string>)[`b602_cartuchos_${i}_observacao`] || '';
        items.push({
          quantidade: (data as Record<string, string>)[`b602_cartuchos_${i}_quantidade`] || '',
          calibre: calibre || '',
          marca: (data as Record<string, string>)[`b602_cartuchos_${i}_marca`] || 'CBC',
          origem: (data as Record<string, string>)[`b602_cartuchos_${i}_origem`] || 'Brasil',
          espoleta: (data as Record<string, string>)[`b602_cartuchos_${i}_espoleta`] || '',
          estojo: (data as Record<string, string>)[`b602_cartuchos_${i}_estojo`] || '',
          projetil: (data as Record<string, string>)[`b602_cartuchos_${i}_projetil`] || '',
          observacao: obsRaw ? obsRaw.split(',').filter(Boolean) : [],
        });
      }
      if (items.length > 0) result.cartuchos = items;
    }

    const estojosToggle = (data as Record<string, string>)['b602_estojos_toggle'];
    if (estojosToggle === 'on') {
      const items: Record<string, unknown>[] = [];
      for (let i = 0; i < MAX_ESTOJOS; i++) {
        const calibre = (data as Record<string, string>)[`b602_estojos_${i}_calibre`];
        if (!calibre && i > 0) continue;
        const obsRaw = (data as Record<string, string>)[`b602_estojos_${i}_observacao`] || '';
        items.push({
          quantidade: (data as Record<string, string>)[`b602_estojos_${i}_quantidade`] || '',
          calibre: calibre || '',
          marca: (data as Record<string, string>)[`b602_estojos_${i}_marca`] || 'CBC',
          origem: (data as Record<string, string>)[`b602_estojos_${i}_origem`] || 'Brasil',
          espoleta: (data as Record<string, string>)[`b602_estojos_${i}_espoleta`] || '',
          estojo: (data as Record<string, string>)[`b602_estojos_${i}_estojo`] || '',
          observacao: obsRaw ? obsRaw.split(',').filter(Boolean) : [],
        });
      }
      if (items.length > 0) result.estojos = items;
    }

    const armasToggle = (data as Record<string, string>)['b602_armas_toggle'];
    result.armas_toggle = armasToggle === 'on' ? 'on' : 'off';
    if (armasToggle === 'on') {
      const items: Record<string, unknown>[] = [];
      for (let i = 0; i < MAX_ARMAS; i++) {
        const item: Record<string, unknown> = {};
        let possuiDados = false;
        for (const campo of ARMA_CAMPOS) {
          const val = (data as Record<string, string>)[`b602_armas_${i}_${campo}`];
          if (val) {
            item[campo] = val;
            possuiDados = true;
          }
        }
        if (!possuiDados) continue;
        item.func_toggle = (data as Record<string, string>)[`b602_armas_${i}_func_toggle`] || 'off';
        item.coleta_toggle = (data as Record<string, string>)[`b602_armas_${i}_coleta_toggle`] || 'off';
        items.push(item);
      }
      if (items.length > 0) result.armas = items;
    }

    const contextoB602 = contexto?.b602;
    if (!contextoB602) return { b602: result };

    delete result.material_enc;
    delete result.cartuchos;
    delete result.estojos;
    delete result.armas;
    delete result.armas_toggle;
    result.pecas = contextoB602.pecas;

    return {
      b602: result,
      ...(contextoB602.metadadosIntegracaoGdl
        ? { integracaoGdl: contextoB602.metadadosIntegracaoGdl }
        : {}),
    };
  },

  deserialize(json: unknown): Partial<REPFormData> {
    const root = json as Record<string, unknown> | null;
    if (!root) return {};
    const data = root.b602 as Record<string, unknown> | undefined;
    if (!data) return {};

    const result: Record<string, string> = {};

    const envolvidos = data.envolvidos as string[] | undefined;
    if (envolvidos) {
      envolvidos.forEach((envolvido, i) => {
        const { qualificacao, nome } = separarEnvolvido(envolvido);
        result[`b602_envolvidos_qualificacao_${i}`] = qualificacao;
        result[`b602_envolvidos_${i}`] = nome;
      });
    }

    if (data.data_ocorrencia) result['b602_data_ocorrencia'] = String(data.data_ocorrencia);
    if (data.local) {
      if (typeof data.local === 'string') {
        // Compatibilidade com formato antigo: "bairro / cidade / UF"
        const partes = data.local.split('/').map(s => s.trim()).filter(Boolean);
        if (partes.length === 3) {
          result['b602_local_bairro'] = partes[0];
          result['b602_local_cidade'] = partes[1];
          result['b602_local_uf'] = partes[2];
        } else if (partes.length === 2) {
          result['b602_local_cidade'] = partes[0];
          result['b602_local_uf'] = partes[1];
        }
      } else if (typeof data.local === 'object' && data.local !== null) {
        const loc = data.local as Record<string, string>;
        if (loc.bairro) result['b602_local_bairro'] = loc.bairro;
        if (loc.cidade) result['b602_local_cidade'] = loc.cidade;
        if (loc.uf) result['b602_local_uf'] = loc.uf;
      }
    }
    if (data.numero_bo) result['b602_numero_bo'] = String(data.numero_bo);
    if (data.numero_ip) result['b602_numero_ip'] = String(data.numero_ip);
    if (data.solicitante_nome) result['b602_solicitante_nome'] = String(data.solicitante_nome);


    const material = data.material_enc as Record<string, string>[] | undefined;
    if (material && material.length > 0) {
      material.forEach((item, i) => {
        result[`b602_material_enc_${i}_natureza`] = item.natureza || 'Arma';
        result[`b602_material_enc_${i}_quantidade`] = item.quantidade || '01';
        result[`b602_material_enc_${i}_tipo`] = item.tipo || 'Pistola';
        result[`b602_material_enc_${i}_dito_oficio`] = item.dito_oficio || '""';
        result[`b602_material_enc_${i}_numero_lacre`] = item.numero_lacre || '';
        for (const campo of ARMA_CAMPOS_MATERIAL) {
          const val = item[`arma_${campo}`];
          if (val) result[`b602_material_enc_${i}_arma_${campo}`] = String(val);
        }
      });
    }

    const cartuchos = data.cartuchos as Record<string, unknown>[] | undefined;
    if (cartuchos && cartuchos.length > 0) {
      result['b602_cartuchos_toggle'] = 'on';
      cartuchos.forEach((item, i) => {
        result[`b602_cartuchos_${i}_quantidade`] = String(item.quantidade || '');
        result[`b602_cartuchos_${i}_calibre`] = String(item.calibre || '');
        result[`b602_cartuchos_${i}_marca`] = String(item.marca || 'CBC');
        result[`b602_cartuchos_${i}_origem`] = String(item.origem || 'Brasil');
        result[`b602_cartuchos_${i}_espoleta`] = String(item.espoleta || '');
        result[`b602_cartuchos_${i}_estojo`] = String(item.estojo || '');
        result[`b602_cartuchos_${i}_projetil`] = String(item.projetil || '');
        result[`b602_cartuchos_${i}_observacao`] = Array.isArray(item.observacao) ? (item.observacao as string[]).join(',') : '';
      });
    }

    const estojos = data.estojos as Record<string, unknown>[] | undefined;
    if (estojos && estojos.length > 0) {
      result['b602_estojos_toggle'] = 'on';
      estojos.forEach((item, i) => {
        result[`b602_estojos_${i}_quantidade`] = String(item.quantidade || '');
        result[`b602_estojos_${i}_calibre`] = String(item.calibre || '');
        result[`b602_estojos_${i}_marca`] = String(item.marca || 'CBC');
        result[`b602_estojos_${i}_origem`] = String(item.origem || 'Brasil');
        result[`b602_estojos_${i}_espoleta`] = String(item.espoleta || '');
        result[`b602_estojos_${i}_estojo`] = String(item.estojo || '');
        result[`b602_estojos_${i}_observacao`] = Array.isArray(item.observacao) ? (item.observacao as string[]).join(',') : '';
      });
    }

    const armas = data.armas as Record<string, unknown>[] | undefined;
    if (armas && armas.length > 0) {
      result['b602_armas_toggle'] = 'on';
      armas.forEach((item, i) => {
        for (const campo of ARMA_CAMPOS) {
          const val = item[campo];
          if (val !== undefined) result[`b602_armas_${i}_${campo}`] = String(val);
        }
        result[`b602_armas_${i}_func_toggle`] = String(item.func_toggle || 'off');
        result[`b602_armas_${i}_coleta_toggle`] = String(item.coleta_toggle || 'off');
      });
    }

    return result as Partial<REPFormData>;
  },

  fieldDefaults: {
    b602_material_enc_0_dito_oficio: '""',
    b602_material_enc_0_quantidade: '01',
    b602_material_enc_0_natureza: 'Arma',
    b602_material_enc_0_tipo: 'Pistola',
    b602_cartuchos_0_marca: 'CBC',
    b602_cartuchos_0_origem: 'Brasil',
    b602_estojos_0_marca: 'CBC',
    b602_estojos_0_origem: 'Brasil',
  },

  fieldMasks: {
    b602_numero_bo: formatarNumeroBO,
  },
};

export function getGroupCount(prefix: string, b602Data: Record<string, unknown> | undefined): number {
  if (!b602Data) return 0;
  if (prefix === 'b602_envolvido_') {
    const arr = b602Data.envolvidos as unknown[] | undefined;
    return Array.isArray(arr) ? arr.filter(Boolean).length : 0;
  }
  if (prefix === 'b602_material_enc_') {
    const arr = b602Data.material_enc as unknown[] | undefined;
    return Array.isArray(arr) ? arr.length : 0;
  }
  if (prefix === 'b602_cartucho_') {
    const arr = b602Data.cartuchos as unknown[] | undefined;
    return Array.isArray(arr) ? arr.length : 0;
  }
  if (prefix === 'b602_estojo_') {
    const arr = b602Data.estojos as unknown[] | undefined;
    return Array.isArray(arr) ? arr.length : 0;
  }
  if (prefix === 'b602_arma_') {
    const arr = b602Data.armas as unknown[] | undefined;
    return Array.isArray(arr) ? arr.length : 0;
  }
  return 0;
}
