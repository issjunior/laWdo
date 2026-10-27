import { describe, expect, it } from 'vitest';
import { criarDadosB601 } from '../../shared/types/b601.types';
import { criarPecaColeta } from '../fixtures/b601-coleta';
import { gerarDescricaoAgrupadaB601, gerarDescricaoColetaB601 } from '../../shared/utils/b601-descricao-agrupada';
import { sugerirRepColeta, esquemaRepsMesmoCasoGdl } from '../../shared/gdl/reps-mesmo-caso';
import { laudoPadraoB601LocalNecropsiaV1 } from '../../main/templates/integrados/b601/laudo-padrao-b601-local-necropsia.v1';
import { validarTemplateIntegrado } from '../../main/templates/integrados/validar-template-integrado';
import { preservarComplementoB601 } from '../../main/services/b601-secoes.service';


describe('template B-601 Local com Necropsia', () => {
  it('é uma definição integrada independente, sem dados do documento de exemplo', () => {
    expect(() => validarTemplateIntegrado(laudoPadraoB601LocalNecropsiaV1)).not.toThrow();
    expect(laudoPadraoB601LocalNecropsiaV1.chave).toBe('laudo-padrao-b601-local-necropsia');
    const conteudo = laudoPadraoB601LocalNecropsiaV1.secoes.map(secao => secao.conteudo).join('');
    expect(conteudo).toContain('em complemento aos exames de local');
    expect(conteudo).not.toContain('a fim de ser atendida');
    expect(conteudo).not.toContain('V230203393');
    expect(conteudo).toContain('b601_tabela_material_coleta');
    expect(conteudo).toContain('data-b601-sinab="opcional"');
    expect(conteudo).not.toContain('Cumpre ressaltar');
  });

  it('separa origens, limita cinco colunas e numera PQ continuamente', () => {
    const dados = { ...criarDadosB601(), pecas: [criarPecaColeta('necro', '94', 2), criarPecaColeta('local', '93', 6), criarPecaColeta('hospital', '1471'), criarPecaColeta('ausente', '')] };
    const documento = new DOMParser().parseFromString(gerarDescricaoColetaB601(dados, '105', 'secao'), 'text/html');
    const titulos = Array.from(documento.querySelectorAll('th[colspan]')).map(elemento => elemento.textContent);
    expect(titulos[0]).toContain('(LOCAL)');
    expect(titulos[1]).toContain('continuação');
    expect(titulos[3]).toContain('(NECRÓPSIA)');
    expect(titulos.some(titulo => titulo?.includes('(HOSPITAL)'))).toBe(true);
    expect(titulos.some(titulo => titulo?.includes('(XXX)'))).toBe(true);
    const unidades = Array.from(documento.querySelectorAll('[data-b601-origem-projetil]'));
    expect(unidades.map(elemento => elemento.getAttribute('data-b601-pq'))).toEqual(Array.from({ length: 10 }, (_, indice) => `PQ${String(indice + 1).padStart(2, '0')}`));
    expect(unidades[0].getAttribute('data-b601-peca-id')).toBe('local');
    expect(unidades[6].getAttribute('data-b601-peca-id')).toBe('necro');
    expect(documento.querySelectorAll('figure')).toHaveLength(8);
    expect(documento.body.textContent).toContain('Tipo de Raiamento');
    expect(gerarDescricaoAgrupadaB601(dados, '105', 'antigo')).not.toContain('Tipo de Raiamento');
  });

  it('preserva medidas sem contagem e separa origem/procedência dos estojos', () => {
    const peca = criarPecaColeta('massa', '94');
    peca.comuns.unidadeMedida = 'GRAMAS';
    const dados = { ...criarDadosB601(), pecas: [peca, criarPecaColeta('estojo', '93', 2, '101')] };
    expect(gerarDescricaoColetaB601(dados, '105', 'projeteis')).toContain('data-b601-peca="massa"');
    const documento = new DOMParser().parseFromString(gerarDescricaoColetaB601(dados, '101', 'estojos'), 'text/html');
    expect(Array.from(documento.querySelectorAll('thead tr:last-child th')).map(elemento => elemento.textContent))
      .toContain('Procedência');
    expect(documento.body.textContent).toContain('LOCAL DE CRIME');
    expect(documento.querySelector('tbody tr td:nth-child(4)')?.textContent).toBe('XXX');
  });

  it('sugere só uma referência compatível e não inventa vínculos para outras origens', () => {
    const referencias = esquemaRepsMesmoCasoGdl.parse({ ambiente: 'producao', numeroRep: '100', anoRep: '2026', numeroCaso: '42', consultadoEm: new Date().toISOString(),
      reps: [{ numero: '20', ano: '2026', codigoNatureza: 'M110' }, { numero: '21', ano: '2026', codigoNatureza: 'T002' }] });
    expect(sugerirRepColeta('LOCAL DE CRIME', referencias)).toBe('20/2026');
    expect(sugerirRepColeta('NECRÓPSIA', referencias)).toBe('21/2026');
    expect(sugerirRepColeta('HOSPITAL', referencias)).toBe('');
    referencias.reps.push({ numero: '22', ano: '2026', codigoNatureza: 'T002' });
    expect(sugerirRepColeta('94', referencias)).toBe('');
  });

  it('preserva fotografias e legendas ao recriar os quadros após alteração das peças', () => {
    const dados = { ...criarDadosB601(), pecas: [criarPecaColeta('local', '93'), criarPecaColeta('necro', '94')] };
    const anterior = new DOMParser().parseFromString(gerarDescricaoColetaB601(dados, '105', 'secao'), 'text/html');
    anterior.querySelector('figure')!.setAttribute('data-image-id', 'fotografia-preenchida');
    anterior.querySelector('figcaption')!.textContent = 'Figura 1 — Legenda preenchida';
    dados.pecas[0].comuns.quantidade = 6;
    const resultado = preservarComplementoB601(gerarDescricaoColetaB601(dados, '105', 'secao'), anterior.body.innerHTML);
    const documento = new DOMParser().parseFromString(resultado, 'text/html');
    expect(documento.querySelectorAll('figure')).toHaveLength(4);
    expect(documento.querySelector('[data-image-id="fotografia-preenchida"]')?.textContent).toContain('Legenda preenchida');
    expect(documento.body.textContent).toContain('PQ07');
  });
});
