export interface CampoEspecificoPlaceholder {
  chave: string;
  label: string;
  descricao: string;
  jsonPath: string;
  categoria_exam_codigo: string;
}

export interface ExamPlaceholderCategory {
  id: string;
  codigo: string;
  label: string;
  cor: string;
  icone: string;
}

export const EXAM_PLACEHOLDER_CATEGORIES: ExamPlaceholderCategory[] = [
  {
    id: 'cat-exam-I-801',
    codigo: 'I-801',
    label: 'I-801 - Numerações Identificadoras',
    cor: 'amber',
    icone: 'Hash',
  },
];

export const CAMPOS_ESPECIFICOS_PLACEHOLDERS: CampoEspecificoPlaceholder[] = [
  { chave: 'numeracao_veiculo',          label: 'Veículo',            descricao: 'Marca, modelo ou tipo do veículo periciado',       jsonPath: 'numeracao.veiculo',          categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_placa',            label: 'Placa',              descricao: 'Placa de identificação do veículo',                 jsonPath: 'numeracao.placa',            categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_fabricacao',       label: 'Fabricação/Modelo',  descricao: 'Ano de fabricação e modelo do veículo',             jsonPath: 'numeracao.fabricacao',       categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_cor',              label: 'Cor',                descricao: 'Cor do veículo',                                     jsonPath: 'numeracao.cor',              categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_conservacao',      label: 'Conservação',        descricao: 'Estado de conservação do veículo',                   jsonPath: 'numeracao.conservacao',      categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_chassi',           label: 'Chassi',             descricao: 'Nº do chassi (até 17 caracteres alfanuméricos)',    jsonPath: 'numeracao.chassi',           categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_chassi_revelado',  label: 'Chassi Revelado',    descricao: 'Chassi após revelação química',                      jsonPath: 'numeracao.chassi_revelado',  categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_motor',            label: 'Motor',              descricao: 'Nº do motor (até 12 caracteres alfanuméricos)',     jsonPath: 'numeracao.motor',            categoria_exam_codigo: 'I-801' },
  { chave: 'numeracao_motor_revelado',   label: 'Motor Revelado',     descricao: 'Motor após revelação química',                       jsonPath: 'numeracao.motor_revelado',   categoria_exam_codigo: 'I-801' },
];

export function getExamCategoryId(codigo: string): string {
  return `cat-exam-${codigo}`;
}

export function getPlaceholdersForExam(codigo: string): CampoEspecificoPlaceholder[] {
  return CAMPOS_ESPECIFICOS_PLACEHOLDERS.filter(p => p.categoria_exam_codigo === codigo);
}
