export type OrigemTemplate = 'integrado' | 'usuario' | 'importado' | 'clonado';

export interface DefinicaoSecaoTemplateIntegrado {
  chave: string;
  nome: string;
  ordem: number;
  chavePai?: string;
  conteudo: string;
  condicao?: string;
  repetirPara?: string;
  repetirTitulo?: string;
}

export interface DefinicaoTemplateIntegrado {
  chave: string;
  versao: number;
  versaoFormato: 1;
  nome: string;
  descricao?: string;
  tipoExame: {
    codigo: string;
    nome: string;
    descricao?: string;
  };
  secoes: DefinicaoSecaoTemplateIntegrado[];
}

export interface ResultadoSincronizacaoTemplateIntegrado {
  chave: string;
  versao: number;
  status: 'instalado' | 'ja_atualizado' | 'adotado' | 'preservado_personalizado' | 'indisponivel' | 'falha';
  mensagem?: string;
}
