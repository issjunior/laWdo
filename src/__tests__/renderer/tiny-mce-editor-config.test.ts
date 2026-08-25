import { describe, expect, it } from 'vitest';
import { MEDIDAS_RECUO_PRIMEIRA_LINHA, obterPluginsTinyMce, obterRotuloIdentificacaoFullscreen, obterToolbarTinyMce, sincronizarIdentificacaoFullscreen } from '../../renderer/components/editor/TinyMceEditor';

describe('configuração do TinyMceEditor', () => {
  it('expõe apenas os plugins usados pela toolbar e adiciona autoresize quando necessário', () => {
    expect(obterPluginsTinyMce(false)).toEqual(expect.arrayContaining([
      'charmap', 'image', 'link', 'lists', 'pagebreak', 'searchreplace', 'table',
    ]));
    expect(obterPluginsTinyMce(false)).not.toEqual(expect.arrayContaining(['anchor', 'media', 'paste']));
    expect(obterPluginsTinyMce(true)).toEqual(expect.arrayContaining(['autoresize']));
  });

  it('mantém uma sequência responsiva de controles e inclui os comandos contextuais', () => {
    const toolbarSemContexto = obterToolbarTinyMce(false);

    expect(toolbarSemContexto).toBe('undo redo formatacao | bold italic underline strikethrough subscript superscript | fonte fontsize forecolor backcolor removeformat | align bullist numlist | outdent indent lineheight recuoprimeiralinha | blockquote hr | searchreplace pastetext visualblocks | link image table charmap nonbreaking pagebreak fullscreen');
    expect(toolbarSemContexto.split(/\s+/)).not.toContain('blocks');
    expect(toolbarSemContexto).not.toContain('maisferramentas');
    expect(obterToolbarTinyMce(true)).toContain('condbloco suprimirblocopericial');
  });

  it('prioriza o recuo padrão de 1,25 cm no menu', () => {
    expect(MEDIDAS_RECUO_PRIMEIRA_LINHA[0]).toEqual({ texto: '1,25 cm', valor: '35.43pt' });
  });

  it('identifica a REP somente quando seu número está disponível', () => {
    expect(obterRotuloIdentificacaoFullscreen(' 123/2026 ')).toBe('Laudo · REP 123/2026');
    expect(obterRotuloIdentificacaoFullscreen()).toBeNull();
  });

  it('mantém o identificador fora do conteúdo editável e o remove ao sair da tela cheia', () => {
    const container = document.createElement('div');
    const toolbar = document.createElement('div');
    const areaLateral = document.createElement('div');
    const areaEdicao = document.createElement('div');
    toolbar.className = 'tox-editor-header';
    areaLateral.className = 'tox-sidebar-wrap';
    areaEdicao.className = 'tox-edit-area';
    areaLateral.append(areaEdicao);
    container.append(toolbar, areaLateral);

    sincronizarIdentificacaoFullscreen(container, true, '123/2026');

    const identificacao = container.querySelector('.laudo-identificacao-fullscreen');
    expect(identificacao).toHaveTextContent('Laudo · REP 123/2026');
    expect(identificacao?.nextElementSibling).toBe(areaLateral);

    sincronizarIdentificacaoFullscreen(container, false, '123/2026');
    expect(container.querySelector('.laudo-identificacao-fullscreen')).toBeNull();
  });
});
