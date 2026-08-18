import { describe, expect, it, vi } from 'vitest';
import { navegarParaEvidenciaIa, obterEditorIdParaEvidenciaIa, obterIndiceSecaoDaEvidenciaIa } from '@/lib/ia-evidencia-navegacao';

describe('navegação de evidências da IA', () => {
  it('usa o editor único mesmo quando a evidência pertence a uma seção', () => {
    expect(obterEditorIdParaEvidenciaIa('single', 'secao-3')).toBe('laudo-single-editor');
  });

  it('preserva o editor da seção no modo múltiplo', () => {
    expect(obterEditorIdParaEvidenciaIa('multi', 'secao-3')).toBe('secao-3');
  });

  it('identifica somente identificadores de seção válidos', () => {
    expect(obterIndiceSecaoDaEvidenciaIa('secao-3')).toBe(3);
    expect(obterIndiceSecaoDaEvidenciaIa('laudo-completo')).toBeNull();
  });

  it('navega no editor único sem alterar o contexto da conversa', () => {
    const corpo = document.createElement('div');
    const ancora = document.createElement('p');
    ancora.id = 'tabela-armas';
    corpo.append(ancora);
    const obterEditor = vi.fn(() => ({ getBody: () => corpo }));
    const expandirSecao = vi.fn();
    const agendar = vi.fn((callback: () => void) => callback());
    Element.prototype.scrollIntoView = vi.fn();

    navegarParaEvidenciaIa({
      modoEditor: 'single',
      evidencia: { id: 'secao-0:1', tipo: 'tabela', ordem: 0, secaoId: 'secao-0', secaoTitulo: 'Armas', titulo: 'Tabela', texto: 'Arma A', ancora: 'tabela-armas' },
      obterEditor,
      expandirSecao,
      agendar,
    });

    expect(obterEditor).toHaveBeenCalledWith('laudo-single-editor');
    expect(expandirSecao).not.toHaveBeenCalled();
    expect(ancora.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('expande a seção correspondente somente no modo múltiplo', () => {
    const corpo = document.createElement('div');
    const obterEditor = vi.fn(() => ({ getBody: () => corpo }));
    const expandirSecao = vi.fn();

    navegarParaEvidenciaIa({
      modoEditor: 'multi',
      evidencia: { id: 'secao-3:1', tipo: 'paragrafo', ordem: 0, secaoId: 'secao-3', secaoTitulo: 'Conclusão', titulo: 'Parágrafo', texto: 'Texto', ancora: 'inexistente' },
      obterEditor,
      expandirSecao,
      agendar: callback => callback(),
    });

    expect(expandirSecao).toHaveBeenCalledWith(3);
    expect(obterEditor).toHaveBeenCalledWith('secao-3');
  });

  it('localiza a âncora de reserva de um título sem id no editor único', () => {
    const corpo = document.createElement('div');
    const preambulo = document.createElement('h2');
    preambulo.textContent = 'PREÂMBULO';
    corpo.append(preambulo, document.createElement('p'));
    const obterEditor = vi.fn(() => ({ getBody: () => corpo }));
    Element.prototype.scrollIntoView = vi.fn();

    navegarParaEvidenciaIa({
      modoEditor: 'single',
      evidencia: { id: 'secao-0:1', tipo: 'titulo', ordem: 0, secaoId: 'secao-0', secaoTitulo: 'Laudo', titulo: 'PREÂMBULO', texto: 'PREÂMBULO', ancora: 'secao-0-1' },
      obterEditor,
      expandirSecao: vi.fn(),
      agendar: callback => callback(),
    });

    expect(preambulo.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });
});
