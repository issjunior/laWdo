export interface TipoExame {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  ativo: boolean;
  data_criacao: Date;
  data_atualizacao: Date;
}

export type CreateTipoExameInput = Pick<TipoExame, 'codigo' | 'nome' | 'descricao'>;
