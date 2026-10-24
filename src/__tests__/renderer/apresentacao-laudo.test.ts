import { describe, expect, it, vi } from 'vitest';
import { buildPdfHeaderConfig } from '../../renderer/lib/pdf-header';
import { parseHtmlParaEstrutura } from '../../renderer/lib/exportacao-parser';
import { montarFechamentoHtml, resolverDadosPerito } from '../../renderer/lib/apresentacao-laudo';
import { CABECALHO_LAUDO_PADRAO, FECHAMENTO_LAUDO_PADRAO, type ApresentacaoLaudo, lerApresentacaoLaudo } from '../../shared/configuracoes/apresentacao-laudo';

function apresentacao(cabecalho = true, fechamento = true): ApresentacaoLaudo {
  return {
    versao: 1,
    cabecalho: { habilitado: cabecalho, primeiraPagina: '<p>{{perito_nome}} — {{numero_rep}}</p>', todasPaginas: '<p>{{perito_nome}} {{numero_rep}} {{pagina}}/{{totalPaginas}}</p>' },
    fechamento: { habilitado: fechamento, conteudo: '<p style="text-align:center;"><strong>{{perito_nome}}</strong></p><p style="text-align:center;">{{perito_lotacao}}</p>', espacamentoAntesPt: 36 },
    perito: { perito_nome: 'Nome preservado', perito_lotacao: 'Unidade preservada' },
  };
}

describe('composição do cabeçalho e fechamento', () => {
  it('normaliza o rótulo de cópias antigas apenas na leitura sem modificar o original', () => {
    const copia = apresentacao();
    copia.cabecalho.todasPaginas = '<p>LAUDO nº {{numero_rep}}</p>';
    const lida = lerApresentacaoLaudo(copia);
    expect(lida.cabecalho.todasPaginas).toBe('<p>LAUDO Nº {{numero_rep}}</p>');
    expect(copia.cabecalho.todasPaginas).toBe('<p>LAUDO nº {{numero_rep}}</p>');
  });
  it.each([
    { perito_nome: 'Nome A', perito_cargo: 'Perito Oficial Criminal', perito_lotacao: 'Unidade A' },
    { perito_nome: 'Nome B', perito_cargo: 'Perita Oficial Criminal', perito_lotacao: 'Unidade B' },
  ])('resolve o fechamento padrão com dados do perfil $perito_nome', perito => {
    const html = montarFechamentoHtml(FECHAMENTO_LAUDO_PADRAO, perito);
    const documento = new DOMParser().parseFromString(html, 'text/html');
    const paragrafos = Array.from(documento.querySelectorAll('p'));
    expect(documento.querySelector('[data-laudo-fechamento]')?.getAttribute('data-espacamento-antes-pt')).toBe('34');
    expect(paragrafos.map(paragrafo => paragrafo.textContent)).toEqual([
      '(assinatura digital)', perito.perito_nome, perito.perito_cargo,
      `UETC ${perito.perito_lotacao} - Polícia Científica do Paraná`,
    ]);
    expect(paragrafos[0].style.marginBottom).toBe('16pt');
    for (const paragrafo of paragrafos.slice(1)) {
      expect(paragrafo.style.lineHeight).toBe('1.15');
      expect(paragrafo.style.fontSize).toBe('16px');
      expect(paragrafo.style.marginBottom).toBe('0px');
    }
    expect(CABECALHO_LAUDO_PADRAO.primeiraPagina).not.toContain('tipo_exame_nome');
    expect(CABECALHO_LAUDO_PADRAO.todasPaginas).toContain('{{totalPaginas}}');
    expect(html).not.toContain('{{perito_');
  });

  it.each([[true, true], [true, false], [false, true], [false, false]])('respeita cabeçalho=%s e fechamento=%s sem consultar os padrões', async (cabecalho, fechamento) => {
    const obter = vi.fn();
    const original = window.ipcAPI.configuracao;
    window.ipcAPI.configuracao = { ...original, obter };
    try {
      const resultado = await buildPdfHeaderConfig({ usarCopiaLaudo: true, apresentacaoJson: JSON.stringify(apresentacao(cabecalho, fechamento)), numeroRepFallback: '123/2026' });
      expect(Boolean(resultado.cabecalhoPrimeiraPagina)).toBe(cabecalho);
      expect(Boolean(resultado.headerTemplate)).toBe(cabecalho);
      expect(Boolean(resultado.fechamentoHtml)).toBe(fechamento);
      if (cabecalho) {
        expect(resultado.headerTemplate).toContain('Nome preservado');
        expect(resultado.headerTemplate).toContain('123/2026');
        expect(resultado.headerTemplate).toContain('class="pageNumber"');
        expect(resultado.cabecalhoPrimeiraPagina).toContain('Nome preservado');
      }
      if (fechamento) {
        expect(resultado.fechamentoHtml).toContain('Nome preservado');
        expect(resultado.fechamentoHtml).toContain('Unidade preservada');
        expect(resultado.fechamentoHtml).toContain('break-inside:avoid');
      }
      expect(obter).not.toHaveBeenCalled();
    } finally { window.ipcAPI.configuracao = original; }
  });

  it('preserva texto com caracteres HTML e resolve spans sem usar o usuário conectado', () => {
    const html = resolverDadosPerito('<p><span data-placeholder="{{perito_nome}}">Nome atual</span> {{perito_lotacao}}</p>', { perito_nome: 'Nome <teste> & outro', perito_lotacao: 'Unidade' });
    expect(new DOMParser().parseFromString(html, 'text/html').body.textContent).toBe('Nome <teste> & outro Unidade');
    expect(html).not.toContain('data-placeholder');
    expect(html).not.toContain('<teste>');
  });

  it('separa o fechamento para o DOCX/ODT mantendo ordem, alinhamento, formatação e espaçamento', async () => {
    const configuracao = apresentacao();
    const fechamento = montarFechamentoHtml(configuracao.fechamento, configuracao.perito);
    const documento = parseHtmlParaEstrutura('<div class="cabecalho"><p>Título inicial</p></div><p>Corpo</p><figure><img src="data:image/png;base64,AA=="></figure>' + fechamento);
    expect(documento.secoes[0].blocos.map(bloco => bloco.tipo)).toEqual(['paragrafo', 'paragrafo', 'figura']);
    expect(documento.fechamento?.espacamentoAntesPt).toBe(36);
    expect(documento.fechamento?.blocos).toHaveLength(2);
    expect(documento.fechamento?.blocos[0]).toMatchObject({ tipo: 'paragrafo', alinhamento: 'center', trechos: [{ texto: 'Nome preservado', estilo: { negrito: true } }] });
  });

  it('não deixa espaço residual para fechamento vazio e bloqueia cópia ausente ou inválida', async () => {
    expect(montarFechamentoHtml({ habilitado: true, conteudo: '<p><br></p>', espacamentoAntesPt: 100 }, {})).toBe('');
    expect(() => lerApresentacaoLaudo('{invalido')).toThrow();
    await expect(buildPdfHeaderConfig({ usarCopiaLaudo: true, apresentacaoJson: null, estrito: true })).rejects.toThrow();
    expect(() => lerApresentacaoLaudo({ ...apresentacao(), fechamento: { ...apresentacao().fechamento, espacamentoAntesPt: -1 } })).toThrow();
  });

  it('preserva imagens e texto formatado do cabeçalho uma única vez no DOCX/ODT', () => {
    const documento = parseHtmlParaEstrutura('<div class="cabecalho"><p style="text-align:center;"><strong>Antes<img src="data:image/png;base64,AA==" width="100" height="40">Depois</strong></p></div><p>Corpo</p>');
    const blocos = documento.secoes[0].blocos;
    expect(blocos.map(bloco => bloco.tipo)).toEqual(['paragrafo', 'figura', 'paragrafo', 'paragrafo']);
    expect(blocos[0]).toMatchObject({ trechos: [{ texto: 'Antes', estilo: { negrito: true } }] });
    expect(blocos[1]).toMatchObject({ alinhamento: 'center', larguraPx: 100, alturaPx: 40 });
    expect(blocos[2]).toMatchObject({ trechos: [{ texto: 'Depois', estilo: { negrito: true } }] });
  });
});
