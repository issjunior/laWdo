import { describe, expect, it } from 'vitest';
import { MEDIDAS_RECUO_PRIMEIRA_LINHA, obterPluginsTinyMce, obterToolbarTinyMce } from '../../renderer/components/editor/TinyMceEditor';

describe('configuração do TinyMceEditor', () => {
  it('expõe apenas os plugins usados pela toolbar e adiciona autoresize quando necessário', () => {
    expect(obterPluginsTinyMce(false)).toEqual(expect.arrayContaining([
      'charmap', 'image', 'link', 'lists', 'pagebreak', 'searchreplace', 'table',
    ]));
    expect(obterPluginsTinyMce(false)).not.toEqual(expect.arrayContaining(['anchor', 'media', 'paste']));
    expect(obterPluginsTinyMce(true)).toEqual(expect.arrayContaining(['autoresize']));
  });

  it('mantém os controles condicionais fora da toolbar quando não há contexto', () => {
    expect(obterToolbarTinyMce(false)).toContain('recuoprimeiralinha');
    expect(obterToolbarTinyMce(false)).toContain('fonte');
    expect(obterToolbarTinyMce(false)).not.toContain('fontfamily');
    expect(obterToolbarTinyMce(false)).toContain('pagebreak');
    expect(obterToolbarTinyMce(false)).not.toContain('condbloco');
    expect(obterToolbarTinyMce(true)).toContain('condbloco suprimirblocopericial');
  });

  it('prioriza o recuo padrão de 1,25 cm no menu', () => {
    expect(MEDIDAS_RECUO_PRIMEIRA_LINHA[0]).toEqual({ texto: '1,25 cm', valor: '35.43pt' });
  });
});
