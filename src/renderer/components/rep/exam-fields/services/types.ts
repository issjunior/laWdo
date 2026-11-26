import type { REPFormData } from '../types';
import type { MetadadosIntegracaoGdl, PecaB602 } from '@shared/types/b602-gdl.types';
import type { DadosB601 } from '@shared/types/b601.types';
import type { DadosI801 } from '@shared/types/i801.types';

export interface ContextoSerializacaoCamposEspecificos {
  b601?: { dados: DadosB601; raiz: Record<string, unknown> };
  b602?: {
    pecas: PecaB602[];
    metadadosIntegracaoGdl: MetadadosIntegracaoGdl | null;
  };
  i801?: { dados: DadosI801; raiz: Record<string, unknown> };
}

export interface ExamService {
  codigo: string;
  serialize: (
    data: REPFormData,
    contexto?: ContextoSerializacaoCamposEspecificos,
  ) => Record<string, unknown>;
  deserialize: (json: unknown) => Partial<REPFormData>;
  fieldDefaults?: Record<string, string>;
  fieldMasks?: Record<string, (value: string) => string>;
}
