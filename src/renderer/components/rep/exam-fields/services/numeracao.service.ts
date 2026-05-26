import type { REPFormData } from '../types';
import type { ExamService } from './types';

export const numeracaoService: ExamService = {
  codigo: 'I-801',

  serialize(data: REPFormData): Record<string, unknown> {
    return {
      numeracao: {
        veiculo: data.numeracao_veiculo || '',
        placa: data.numeracao_placa || '',
        fabricacao: data.numeracao_fabricacao || '',
        cor: data.numeracao_cor || '',
        conservacao: data.numeracao_conservacao || 'regular',
        chassi: data.numeracao_chassi || '',
        chassi_revelado: data.numeracao_chassi_revelado || '',
        motor: data.numeracao_motor || '',
        motor_revelado: data.numeracao_motor_revelado || '',
      },
    };
  },

  deserialize(json: unknown): Partial<REPFormData> {
    const root = json as Record<string, unknown> | null;
    if (!root) return {};
    const data = root.numeracao as Record<string, string> | undefined;
    if (!data) return {};
    return {
      numeracao_veiculo: data.veiculo || '',
      numeracao_placa: data.placa === 'sem identificação' ? '' : (data.placa || ''),
      numeracao_fabricacao: data.fabricacao || '',
      numeracao_cor: data.cor || '',
      numeracao_conservacao: data.conservacao || 'regular',
      numeracao_chassi: data.chassi || '',
      numeracao_chassi_revelado: data.chassi_revelado || '',
      numeracao_motor: data.motor || '',
      numeracao_motor_revelado: data.motor_revelado || '',
    };
  },

  fieldDefaults: {
    numeracao_placa: 'sem identificação',
  },

  fieldMasks: {
    numeracao_fabricacao: (v: string) => {
      const digits = v.replace(/\D/g, '').slice(0, 8);
      if (digits.length <= 4) return digits;
      return digits.slice(0, 4) + '/' + digits.slice(4);
    },
  },
};
