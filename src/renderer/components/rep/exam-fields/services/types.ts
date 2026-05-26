import type { REPFormData } from '../types';

export interface ExamService {
  codigo: string;
  serialize: (data: REPFormData) => Record<string, unknown>;
  deserialize: (json: unknown) => Partial<REPFormData>;
  fieldDefaults?: Record<string, string>;
  fieldMasks?: Record<string, (value: string) => string>;
}
