function escaparAtributo(valor: string): string {
  return valor.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const URL_FIGURA_DUMMY = 'data:image/svg+xml;base64,' + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#eee"/><rect x="220" y="110" width="160" height="110" fill="none" stroke="#888"/><text x="300" y="280" text-anchor="middle" fill="#555" font-size="22">INSERIR IMAGEM</text></svg>'
);

export function criarHtmlFigura(url: string, id: string, legenda: string, dummy = false): string {
  const texto = escaparAtributo(legenda);
  return `<figure class="laudo-figure" data-image-id="${escaparAtributo(id)}"${dummy ? ' data-dummy="true"' : ''} style="text-align:center;margin:12px auto;max-width:100%${dummy ? ';cursor:pointer' : ''}">` +
    `<img src="${escaparAtributo(url)}" alt="${dummy ? 'Figura XX' : texto}" style="max-width:100%;height:auto;border:1px solid #444;border-radius:4px;padding:4px"/>` +
    `<figcaption style="font-size:13px;color:#666;font-weight:bold;margin-top:4px">Figura XX${texto ? ': ' + texto : ''}</figcaption>` +
    '</figure>';
}
