import { describe, expect, it } from 'vitest';
import { buscarTextoNoLaudo } from '@/lib/busca-texto-laudo';
import { criarCopiaVisualizacaoPlaceholders } from '@/lib/apresentacao-placeholders';

function criarRaiz(html: string) {
  const raiz = document.createElement('div');
  raiz.innerHTML = html;
  return raiz;
}

describe('busca pelo texto apresentado do laudo', () => {
  it('encontra uma frase atravessando placeholders protegidos sem alterar o HTML', () => {
    const raiz = criarRaiz('<p>nesta <strong>cidade</strong> de&nbsp;<span contenteditable="false" data-placeholder="{{perito_lotacao}}">TELÊMACO BORBA</span> por <span contenteditable="false">João</span>.</p>');
    const anterior = raiz.innerHTML;
    const resultados = buscarTextoNoLaudo(raiz, 'NESTA cidade de TELÊMACO BORBA por João');
    expect(resultados).toHaveLength(1);
    expect(resultados[0].intervalo.toString()).toBe('nesta cidade de\u00a0TELÊMACO BORBA por João');
    expect(buscarTextoNoLaudo(raiz, 'TELÊMACO BORBA')).toHaveLength(1);
    expect(buscarTextoNoLaudo(raiz, 'TELEMACO')).toHaveLength(0);
    expect(raiz.innerHTML).toBe(anterior);
  });

  it('normaliza espaços e preserva os offsets originais do resultado', () => {
    const raiz = criarRaiz('<p>Antes 🙂 SÃO\u00a0 <b> JOÃO</b> depois</p>');
    expect(buscarTextoNoLaudo(raiz, 'são joão')[0].intervalo.toString()).toBe('SÃO\u00a0  JOÃO');
    expect(buscarTextoNoLaudo(raiz, '🙂 são')[0].intervalo.toString()).toBe('🙂 SÃO');
  });

  it('inclui prévias de tabelas sem duplicar âncoras nem pesquisar controles', () => {
    const raiz = criarRaiz('<p><span data-placeholder="{{tabela}}" style="display:none">{{tabela}}</span></p><div data-placeholder-preview="true" contenteditable="false"><button>Editar tabela</button><table><tbody><tr><td>DELEGACIA / <b>TELÊMACO BORBA</b></td><td>Segunda célula</td></tr></tbody></table></div><p hidden>TELÊMACO BORBA</p>');
    expect(buscarTextoNoLaudo(raiz, 'TELÊMACO BORBA')).toHaveLength(1);
    expect(buscarTextoNoLaudo(raiz, 'DELEGACIA / TELÊMACO BORBA')).toHaveLength(1);
    expect(buscarTextoNoLaudo(raiz, 'Editar tabela')).toHaveLength(0);
    expect(buscarTextoNoLaudo(raiz, '{{tabela}}')).toHaveLength(0);
    expect(buscarTextoNoLaudo(raiz, 'BORBA Segunda')).toHaveLength(0);
  });

  it('separa parágrafos e retorna ocorrências na ordem do documento', () => {
    const raiz = criarRaiz('<p>Laudo laudo</p><p>Laudo</p>');
    expect(buscarTextoNoLaudo(raiz, 'laudo')).toHaveLength(3);
    expect(buscarTextoNoLaudo(raiz, 'laudo laudo laudo')).toHaveLength(0);
    expect(buscarTextoNoLaudo(raiz, '   ')).toHaveLength(0);
  });

  it.each(['dados', 'chaves'] as const)('resolve cópia de seção não montada no modo %s', modo => {
    const html = '<p>cidade de <span contenteditable="false" data-placeholder="{{perito_lotacao}}">{{perito_lotacao}}</span></p>';
    const raiz = criarCopiaVisualizacaoPlaceholders(html, {
      modo, valores: { perito_lotacao: { valor: 'TELÊMACO BORBA', preenchido: true, formato: 'texto' } },
      placeholdersPersonalizados: [], descreverPendente: () => 'Pendente',
    });
    expect(buscarTextoNoLaudo(raiz, modo === 'dados' ? 'cidade de TELÊMACO BORBA' : 'cidade de {{perito_lotacao}}')).toHaveLength(1);
    expect(html).toContain('>{{perito_lotacao}}</span>');
  });
});
