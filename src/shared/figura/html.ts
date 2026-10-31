function escaparAtributo(valor: string): string {
  return valor.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const URL_FIGURA_DUMMY = 'data:image/svg+xml;base64,' + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="#3a3a3a" rx="8"/><rect x="235" y="115" width="130" height="100" rx="8" fill="none" stroke="#888" stroke-width="2.5"/><circle cx="265" cy="145" r="11" fill="none" stroke="#888" stroke-width="2.5"/><polyline points="235,195 275,162 325,195" fill="none" stroke="#888" stroke-width="2.5"/><text x="300" y="260" text-anchor="middle" fill="#aaa" font-size="20" font-family="sans-serif" font-weight="500">INSERIR IMAGEM</text><text x="300" y="290" text-anchor="middle" fill="#777" font-size="13" font-family="sans-serif">Clique para substituir</text></svg>'
);

export function criarHtmlFigura(url: string, id: string, legenda: string, dummy = false): string {
  const texto = escaparAtributo(legenda);
  return `<figure class="laudo-figure" data-image-id="${escaparAtributo(id)}"${dummy ? ' data-dummy="true"' : ''} style="text-align:center;margin:12px auto;max-width:100%${dummy ? ';cursor:pointer' : ''}">` +
    `<img src="${escaparAtributo(url)}" alt="${dummy ? 'Figura XX' : texto}" style="max-width:100%;height:auto;border:1px solid #444;border-radius:4px;padding:4px"/>` +
    `<figcaption style="font-size:13px;color:#666;font-weight:bold;margin-top:4px">Figura XX${texto ? ': ' + texto : ''}</figcaption>` +
    '</figure>';
}
