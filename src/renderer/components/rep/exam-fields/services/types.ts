import type { REPFormData } from '../types';
import type { MetadadosIntegracaoGdl, PecaB602 } from '@shared/types/b602-gdl.types';
import type { DadosB601 } from '@shared/types/b601.types';

export interface ContextoSerializacaoCamposEspecificos {
  b601?: { dados: DadosB601; raiz: Record<string, unknown> };
  b602?: {
    pecas: PecaB602[];
    metadadosIntegracaoGdl: MetadadosIntegracaoGdl | null;
  };
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
