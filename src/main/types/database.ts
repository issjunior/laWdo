/**
 * Tipos para as entidades do banco de dados
 * Correspondem à estrutura das tabelas SQLite
 */

export interface DatabaseRow {}

// Usuário/Perito
export interface UserRow extends DatabaseRow {
  id: string
  nome: string
  email: string
  matricula?: string | null
  telefone?: string | null
  cargo?: string | null
  lotacao?: string | null
  username: string
  senha_hash: string
  foto_url?: string | null
  ativo: boolean | number
  data_criacao: string
  data_atualizacao: string
}

// Solicitante (órgão/vara/delegacia)
export interface SolicitanteRow extends DatabaseRow {
  id: string
  nome: string
  tipo: string
  endereco?: string | null
  telefone?: string | null
  email?: string | null
  ativo?: boolean | number
  created_at: string
  updated_at: string
}

// Tipo de Exame
export interface TipoExameRow extends DatabaseRow {
  id: string
  codigo: string
  nome: string
  descricao?: string | null
  template_padrao?: string
  ativo?: boolean | number
  created_at: string
  updated_at?: string
}

// REP (Requisição de Exame Pericial)
export interface REPRow extends DatabaseRow {
  id: string
  numero: string
  solicitante_id: string
  tipo_exame_id: string
  data_requisicao: string
  prazo?: string
  status: string
  tipo_solicitacao?: string
  numero_documento?: string
  data_documento?: string
  autoridade_solicitante?: string
  data_acionamento?: string
  data_chegada?: string
  data_saida?: string
  local_fato?: string
  latitude?: number
  longitude?: number
  usuario_id?: string
  observacoes?: string
  campos_especificos?: string
  created_at: string
  updated_at: string
}

// Laudo
export interface LaudoRow extends DatabaseRow {
  id: string
  rep_id: string
  perito_id: string
  template_id: string
  conteudo: string
  status: string
  data_inicio: string
  data_conclusao?: string
  data_entrega?: string
  versao: number
  created_at: string
  updated_at: string
  tipo_criacao?: string
  wizard_id?: string
  respostas_wizard?: string
}

// Template de Laudo
export interface TemplateRow extends DatabaseRow {
  id: string
  tipo_exame_id: string | null
  nome: string
  descricao?: string
  created_at: string
  updated_at: string
}

// Seção de Template
export interface SecaoTemplateRow extends DatabaseRow {
  id: string
  template_id: string
  nome: string
  ordem: number
  parent_id?: string | null
  conteudo?: string
  condicao?: string | null
  repetir_para?: string | null
  repetir_titulo?: string | null
  created_at: string
  updated_at: string
}

// Wizard
export interface WizardRow extends DatabaseRow {
  id: string
  tipo_exame_id: string
  template_id: string
  nome: string
  descricao?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

// Etapa do Wizard
export interface EtapaWizardRow extends DatabaseRow {
  id: string
  wizard_id: string
  etapa_pai_id: string | null
  pergunta: string
  descricao_ajuda?: string
  tipo_input: 'select' | 'radio' | 'checkbox' | 'text' | 'image'
  nivel: number
  ordem: number
  obrigatorio: boolean
  multipla_escolha: boolean
  created_at: string
  updated_at: string
}

// Opção de Etapa
export interface OpcaoEtapaRow extends DatabaseRow {
  id: string
  etapa_id: string
  label: string
  valor: string
  etapa_filha_id: string | null
  ordem: number
  created_at: string
}

// Categoria de Peça
export interface CategoriaPecaRow extends DatabaseRow {
  id: string
  chave: string
  label: string
  descricao?: string | null
  cor?: string
  icone?: string
  parent_id?: string | null
  is_sistema: number
  ordem: number
  created_at: string
  updated_at: string
}

// Peça (Banco de Peças)
export interface PecaRow extends DatabaseRow {
  id: string
  nome: string
  descricao?: string
  conteudo: string
  categoria_id?: string
  tags?: string
  ativo: boolean
  created_at: string
  updated_at: string
}

// Regra do Wizard
export interface RegraWizardRow extends DatabaseRow {
  id: string
  wizard_id: string
  peca_id: string
  secao_template_id: string | null
  condicoes: string
  ordem: number
  created_at: string
}

