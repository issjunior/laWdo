import type { REPFormData } from '../types';
import type { ExamService } from './types';

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

export const b602Service: ExamService = {
  codigo: 'B-602',

  serialize(data: REPFormData): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    const envolvidos: string[] = [];
    for (let i = 0; i < 10; i++) {
      const v = (data as Record<string, string>)[`b602_envolvidos_${i}`];
      if (v && v.trim()) envolvidos.push(v.trim());
    }

    result.envolvidos = envolvidos;
    result.data_ocorrencia = ((data as Record<string, string>)['b602_data_ocorrencia'] || '').split('T')[0];
    result.local = (data as Record<string, string>)['b602_local'] || '';
    result.numero_bo = (data as Record<string, string>)['b602_numero_bo'] || '';
    result.numero_ip = (data as Record<string, string>)['b602_numero_ip'] || '';
    result.solicitante_nome = (data as Record<string, string>)['b602_solicitante_nome'] || '';

    const materialToggle = (data as Record<string, string>)['b602_material_enc_toggle'];
    if (materialToggle === 'on') {
      const items: Record<string, string>[] = [];
      for (let i = 0; i < MAX_MATERIAL_ENC; i++) {
        const natureza = (data as Record<string, string>)[`b602_material_enc_${i}_natureza`];
        if (!natureza && i > 0) continue;
        items.push({
          natureza: natureza || 'Arma',
          quantidade: (data as Record<string, string>)[`b602_material_enc_${i}_quantidade`] || '01',
          tipo: (data as Record<string, string>)[`b602_material_enc_${i}_tipo`] || 'Pistola',
          dito_oficio: (data as Record<string, string>)[`b602_material_enc_${i}_dito_oficio`] || '""',
          numero_lacre: (data as Record<string, string>)[`b602_material_enc_${i}_numero_lacre`] || '',
        });
      }
      if (items.length > 0) result.material_enc = items;
    }

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

    return { b602: result };
  },

  deserialize(json: unknown): Partial<REPFormData> {
    const root = json as Record<string, unknown> | null;
    if (!root) return {};
    const data = root.b602 as Record<string, unknown> | undefined;
    if (!data) return {};

    const result: Record<string, string> = {};

    const envolvidos = data.envolvidos as string[] | undefined;
    if (envolvidos) {
      envolvidos.forEach((nome, i) => {
        result[`b602_envolvidos_${i}`] = nome;
      });
    }

    if (data.data_ocorrencia) result['b602_data_ocorrencia'] = String(data.data_ocorrencia);
    if (data.local) result['b602_local'] = String(data.local);
    if (data.numero_bo) result['b602_numero_bo'] = String(data.numero_bo);
    if (data.numero_ip) result['b602_numero_ip'] = String(data.numero_ip);
    if (data.solicitante_nome) result['b602_solicitante_nome'] = String(data.solicitante_nome);

    const material = data.material_enc as Record<string, string>[] | undefined;
    if (material && material.length > 0) {
      result['b602_material_enc_toggle'] = 'on';
      material.forEach((item, i) => {
        result[`b602_material_enc_${i}_natureza`] = item.natureza || 'Arma';
        result[`b602_material_enc_${i}_quantidade`] = item.quantidade || '01';
        result[`b602_material_enc_${i}_tipo`] = item.tipo || 'Pistola';
        result[`b602_material_enc_${i}_dito_oficio`] = item.dito_oficio || '""';
        result[`b602_material_enc_${i}_numero_lacre`] = item.numero_lacre || '';
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
