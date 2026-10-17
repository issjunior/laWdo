import { z } from 'zod';
import { CABECALHO_PRIMEIRA_PAGINA_PADRAO, CABECALHO_TODAS_PAGINAS_PADRAO } from './cabecalhos-padrao.js';

export const CHAVE_CABECALHO_DOCUMENTO = 'cabecalho_documento';
export const CHAVE_FECHAMENTO_LAUDO = 'fechamento_laudo';

export const esquemaCabecalhoLaudo = z.object({
  habilitado: z.boolean(),
  primeiraPagina: z.string(),
  todasPaginas: z.string(),
});
export const esquemaFechamentoLaudo = z.object({
  habilitado: z.boolean(),
  conteudo: z.string(),
  espacamentoAntesPt: z.number().finite().min(0).max(300),
});
export const esquemaApresentacaoLaudo = z.object({
  versao: z.literal(1),
  cabecalho: esquemaCabecalhoLaudo,
  fechamento: esquemaFechamentoLaudo,
  perito: z.record(z.string(), z.string()),
});
export type CabecalhoLaudo = z.infer<typeof esquemaCabecalhoLaudo>;
export type FechamentoLaudo = z.infer<typeof esquemaFechamentoLaudo>;
export type ApresentacaoLaudo = z.infer<typeof esquemaApresentacaoLaudo>;

export const FECHAMENTO_DESATIVADO: FechamentoLaudo = { habilitado: false, conteudo: '', espacamentoAntesPt: 24 };
export const MODELO_FECHAMENTO_LAUDO = `<p style="text-align: center; text-indent: 0px; margin: 0px 0px 16pt; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.15; font-weight: normal; font-style: italic; color: #d4d4d4;">(assinatura digital)</p>
<p style="text-align: center; text-indent: 0px; margin: 0px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.15; font-weight: bold; font-style: italic; color: #000000;"><span class="placeholder-tag" contenteditable="false" data-placeholder="{{perito_nome}}">{{perito_nome}}</span></p>
<p style="text-align: center; text-indent: 0px; margin: 0px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.15; font-weight: bold; font-style: italic; color: #000000;"><span class="placeholder-tag" contenteditable="false" data-placeholder="{{perito_cargo}}">{{perito_cargo}}</span></p>
<p style="text-align: center; text-indent: 0px; margin: 0px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.15; font-weight: bold; font-style: italic; color: #000000;">UETC <span class="placeholder-tag" contenteditable="false" data-placeholder="{{perito_lotacao}}">{{perito_lotacao}}</span> - Polícia Científica do Paraná</p>`;

export const CABECALHO_LAUDO_PADRAO: CabecalhoLaudo = {
  habilitado: true,
  primeiraPagina: CABECALHO_PRIMEIRA_PAGINA_PADRAO,
  todasPaginas: CABECALHO_TODAS_PAGINAS_PADRAO,
};
export const FECHAMENTO_LAUDO_PADRAO: FechamentoLaudo = {
  habilitado: true, conteudo: MODELO_FECHAMENTO_LAUDO, espacamentoAntesPt: 34,
};

export function lerApresentacaoLaudo(valor: unknown): ApresentacaoLaudo {
  const dados: unknown = typeof valor === 'string' ? JSON.parse(valor) : valor;
  return esquemaApresentacaoLaudo.parse(dados);
}
