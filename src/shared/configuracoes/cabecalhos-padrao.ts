export const CABECALHO_PRIMEIRA_PAGINA_PADRAO = `<p style="text-align: center; margin-top: 0pt;"><strong style="font-size: 16px;">LAUDO DE PERÍCIA CRIMINAL</strong></p>
<p style="text-align: right; margin-top: 0pt; margin-bottom: 3pt;">Código: <span class="placeholder-tag" contenteditable="false" data-placeholder="{{tipo_exame_codigo}}">{{tipo_exame_codigo}}</span></p>`;

export const CABECALHO_TODAS_PAGINAS_PADRAO = `<p style="text-align: right; margin-top: 0pt; margin-bottom: 0pt;">FLS. <span class="placeholder-tag" contenteditable="false" data-placeholder="{{pagina}}">{{pagina}}</span>/<span class="placeholder-tag" contenteditable="false" data-placeholder="{{totalPaginas}}">{{totalPaginas}}</span></p>
<p style="text-align: right; margin-top: 0pt; margin-bottom: 0pt;">LAUDO Nº&nbsp;<span class="placeholder-tag" contenteditable="false" data-placeholder="{{numero_rep}}">{{numero_rep}}</span></p>`;

export function normalizarRotuloCabecalho(html: string): string {
  return html.split(/(<[^>]*>)/g).map((trecho, indice) => indice % 2 === 0
    ? trecho.replace(/\bLAUDO(\s|&nbsp;)+nº/g, 'LAUDO Nº')
    : trecho).join('');
}
