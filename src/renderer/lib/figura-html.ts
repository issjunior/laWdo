function escaparAtributo(valor: string): string {
  return valor.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function criarHtmlFigura(url: string, id: string, legenda: string, dummy = false): string {
  const texto = escaparAtributo(legenda);
  return `<figure class="laudo-figure" data-image-id="${escaparAtributo(id)}"${dummy ? ' data-dummy="true"' : ''} style="text-align:center;margin:12px auto;max-width:100%${dummy ? ';cursor:pointer' : ''}">` +
    `<img src="${escaparAtributo(url)}" alt="${dummy ? 'Figura XX' : texto}" style="max-width:100%;height:auto;border:1px solid #444;border-radius:4px;padding:4px"/>` +
    `<figcaption style="font-size:13px;color:#666;font-weight:bold;margin-top:4px">Figura XX${texto ? ': ' + texto : ''}</figcaption>` +
    '</figure>';
}
