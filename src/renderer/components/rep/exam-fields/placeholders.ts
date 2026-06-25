export interface CampoEspecificoPlaceholder {
  chave: string;
  label: string;
  descricao: string;
  jsonPath?: string;
  computed?: true;
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
    icone: 'Car',
  },
  {
    id: 'cat-exam-B-602',
    codigo: 'B-602',
    label: 'B-602 - Eficiência e Prestabilidade',
    cor: 'red',
    icone: 'Crosshair',
  },
];

export const CAMPOS_ESPECIFICOS_PLACEHOLDERS: CampoEspecificoPlaceholder[] = [
  { chave: 'veiculo',                    label: 'Veículo',            descricao: 'Marca, modelo ou tipo do veículo periciado',       jsonPath: 'numeracao.veiculo',          categoria_exam_codigo: 'I-801' },
  { chave: 'placa',                      label: 'Placa',              descricao: 'Placa de identificação do veículo',                 jsonPath: 'numeracao.placa',            categoria_exam_codigo: 'I-801' },
  { chave: 'fabricacao_modelo',          label: 'Fabricação/Modelo',  descricao: 'Ano de fabricação e modelo do veículo',             jsonPath: 'numeracao.fabricacao',       categoria_exam_codigo: 'I-801' },
  { chave: 'cor',                        label: 'Cor',                descricao: 'Cor do veículo',                                     jsonPath: 'numeracao.cor',              categoria_exam_codigo: 'I-801' },
  { chave: 'conservacao',                label: 'Conservação',        descricao: 'Estado de conservação do veículo',                   jsonPath: 'numeracao.conservacao',      categoria_exam_codigo: 'I-801' },
  { chave: 'chassi',                     label: 'Chassi',             descricao: 'Nº do chassi (até 17 caracteres alfanuméricos)',    jsonPath: 'numeracao.chassi',           categoria_exam_codigo: 'I-801' },
  { chave: 'chassi_revelado',            label: 'Chassi Revelado',    descricao: 'Chassi após revelação química',                      jsonPath: 'numeracao.chassi_revelado',  categoria_exam_codigo: 'I-801' },
  { chave: 'motor',                      label: 'Motor',              descricao: 'Nº do motor (até 12 caracteres alfanuméricos)',     jsonPath: 'numeracao.motor',            categoria_exam_codigo: 'I-801' },
  { chave: 'motor_revelado',             label: 'Motor Revelado',     descricao: 'Motor após revelação química',                       jsonPath: 'numeracao.motor_revelado',   categoria_exam_codigo: 'I-801' },
  { chave: 'b602_envolvidos',           label: 'Envolvidos (B-602)',            descricao: 'Lista de nomes dos envolvidos',                     jsonPath: 'b602.envolvidos',            categoria_exam_codigo: 'B-602' },
  { chave: 'b602_data_ocorrencia',      label: 'Data Ocorrência (B-602)',       descricao: 'Data da ocorrência',                                jsonPath: 'b602.data_ocorrencia',       categoria_exam_codigo: 'B-602' },
  { chave: 'b602_local',                label: 'Local (B-602)',                  descricao: 'Local completo (bairro / cidade / UF)',            jsonPath: 'b602.local',                 categoria_exam_codigo: 'B-602' },
  { chave: 'b602_local_bairro',          label: 'Bairro (B-602)',                 descricao: 'Bairro do local da ocorrência',                     jsonPath: 'b602.local.bairro',           categoria_exam_codigo: 'B-602' },
  { chave: 'b602_local_cidade',          label: 'Cidade (B-602)',                 descricao: 'Cidade do local da ocorrência',                     jsonPath: 'b602.local.cidade',           categoria_exam_codigo: 'B-602' },
  { chave: 'b602_local_uf',              label: 'UF (B-602)',                     descricao: 'UF do local da ocorrência',                         jsonPath: 'b602.local.uf',               categoria_exam_codigo: 'B-602' },
  { chave: 'b602_numero_bo',            label: 'Nº BO (B-602)',                  descricao: 'Número do Boletim de Ocorrência',                  jsonPath: 'b602.numero_bo',             categoria_exam_codigo: 'B-602' },
  { chave: 'b602_numero_ip',            label: 'Nº IP (B-602)',                  descricao: 'Número do Inquérito Policial',                     jsonPath: 'b602.numero_ip',             categoria_exam_codigo: 'B-602' },
  { chave: 'b602_total_material_enc',   label: 'Total Material Enc (B-602)',    descricao: 'Total de itens do Material Encaminhado',          jsonPath: 'b602.total_material_enc',    categoria_exam_codigo: 'B-602' },
  { chave: 'b602_total_cartuchos',      label: 'Total Cartuchos (B-602)',       descricao: 'Total de cartuchos',                              jsonPath: 'b602.total_cartuchos',       categoria_exam_codigo: 'B-602' },
  { chave: 'b602_total_estojos',        label: 'Total Estojos (B-602)',         descricao: 'Total de estojos',                                jsonPath: 'b602.total_estojos',         categoria_exam_codigo: 'B-602' },
  { chave: 'b602_total_armas',          label: 'Total Armas (B-602)',           descricao: 'Total de armas',                                  jsonPath: 'b602.total_armas',           categoria_exam_codigo: 'B-602' },
  { chave: 'b602_tabela_armas',         label: 'Tabela Armas (B-602)',          descricao: 'Tabela HTML das armas periciadas',                jsonPath: 'b602.tabela_armas',          categoria_exam_codigo: 'B-602' },
  { chave: 'b602_arma_N_letra',         label: 'Letra da Arma (B-602)',         descricao: 'Letra sequencial da arma (A, B, C...) — valor computado em runtime', computed: true, categoria_exam_codigo: 'B-602' },
  { chave: 'b602_arma_N_modelo',        label: 'Modelo da Arma (B-602)',        descricao: 'Modelo da arma',                                    jsonPath: 'b602.armas.0.modelo',          categoria_exam_codigo: 'B-602' },
  { chave: 'b602_arma_N_func_toggle',   label: 'Toggle de Funcionamento da Arma (B-602)', descricao: 'Indicador on/off para exibir o bloco de funcionamento da arma atual', computed: true, categoria_exam_codigo: 'B-602' },
  { chave: 'b602_arma_N_coleta_toggle', label: 'Toggle de Coleta da Arma (B-602)',         descricao: 'Indicador on/off para exibir o bloco de coleta balística da arma atual', computed: true, categoria_exam_codigo: 'B-602' },
];

export function getExamCategoryId(codigo: string): string {
  return `cat-exam-${codigo}`;
}

export function getPlaceholdersForExam(codigo: string): CampoEspecificoPlaceholder[] {
  return CAMPOS_ESPECIFICOS_PLACEHOLDERS.filter(p => p.categoria_exam_codigo === codigo);
}
