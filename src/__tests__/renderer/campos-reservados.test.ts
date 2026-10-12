import { describe, expect, it } from 'vitest';
import { encontrarCampoReservado, preencherCampoReservado, restaurarCampoReservado } from '../../renderer/lib/campos-reservados';
import { removerFormatacaoPlaceholders } from '../../renderer/lib/utils';
import { resolverPlaceholdersExportacao } from '../../renderer/lib/exportacao-placeholders';
import { aplicarVisualizacaoPlaceholders } from '../../renderer/lib/apresentacao-placeholders';
import type { Editor as TinyMceEditorInstance } from 'tinymce';

describe('campos reservados do laudo', () => {
  it('identifica XXX e placeholders azuis, sem capturar texto comum', () => {
    document.body.innerHTML = [
      '<span class="campo-reservado" data-reservado="true">XXX</span>',
      '<span class="campo-reservado" data-reservado="true">preenchido</span>',
      '<span>XXX</span>',
    ].join('');

    const [reservado, preenchido, textoComum] = Array.from(document.body.querySelectorAll('span'));

    expect(encontrarCampoReservado(reservado)).toBe(reservado);
    expect(encontrarCampoReservado(preenchido)).toBe(preenchido);
    expect(encontrarCampoReservado(textoComum)).toBeNull();
  });

  it('preenche um campo autoral e remove a marcação âmbar', () => {
    document.body.innerHTML = '<span class="campo-reservado" data-reservado="true" data-tooltip-xxx="true">XXX</span>';
    const campo = document.body.querySelector<HTMLElement>('span')!;

    expect(preencherCampoReservado(campo, 'Informação manual')).toBe(true);
    expect(campo.textContent).toBe('Informação manual');
    expect(campo.classList.contains('campo-reservado')).toBe(false);
    expect(campo.hasAttribute('data-reservado')).toBe(false);
  });

  it('mantém o vínculo ao personalizar e permite restaurar o valor da REP', () => {
    document.body.innerHTML = '<span class="placeholder-tag campo-reservado" contenteditable="false" data-placeholder="{{campo}}" data-reservado="true">XXX</span>';
    const campo = document.body.querySelector<HTMLElement>('span')!;

    expect(preencherCampoReservado(campo, 'Valor local')).toBe(true);
    expect(campo.textContent).toBe('Valor local');
    expect(campo.getAttribute('data-placeholder')).toBe('{{campo}}');
    expect(campo.classList.contains('placeholder-personalizado')).toBe(true);
    expect(restaurarCampoReservado(campo)).toBe(true);
    expect(campo.hasAttribute('data-placeholder-personalizado-html')).toBe(false);
  });

  it('mantém formatação local no salvamento e exporta sem destaque violeta', () => {
    document.body.innerHTML = '<span class="placeholder-tag" data-placeholder="{{campo}}">Valor da REP</span>';
    const campo = document.body.querySelector<HTMLElement>('span')!;
    expect(preencherCampoReservado(campo, '<strong>Valor</strong><br><em>local</em>')).toBe(true);
    const salvo = removerFormatacaoPlaceholders(document.body.innerHTML);
    expect(salvo).toContain('data-placeholder-personalizado-html');
    const exportado = resolverPlaceholdersExportacao(salvo, { repData: {}, placeholdersPersonalizados: [{ chave: 'campo', valor: 'Valor novo da REP' }] });
    expect(exportado).toContain('<strong>Valor</strong><br><em>local</em>');
    expect(exportado).not.toContain('placeholder-personalizado');
    expect(exportado).not.toContain('Valor novo da REP');
  });

  it('personaliza somente a ocorrência clicada quando a chave aparece duas vezes', () => {
    document.body.innerHTML = '<p><span data-placeholder="{{campo}}">Valor da REP</span> e <span data-placeholder="{{campo}}">Valor da REP</span></p>';
    const [primeiro] = document.body.querySelectorAll<HTMLElement>('[data-placeholder]');
    preencherCampoReservado(primeiro, '<strong>Valor local</strong>');
    const salvo = removerFormatacaoPlaceholders(document.body.innerHTML);
    const exportado = resolverPlaceholdersExportacao(salvo, { repData: {}, placeholdersPersonalizados: [{ chave: 'campo', valor: 'Valor novo da REP' }] });
    expect(exportado).toContain('<strong>Valor local</strong> e Valor novo da REP');
  });

  it('descarta HTML não permitido mesmo quando o atributo salvo foi adulterado', () => {
    const html = encodeURIComponent('<img src="x" onerror="alert(1)"><strong>Seguro</strong><script>alert(1)</script>');
    const exportado = resolverPlaceholdersExportacao(`<span data-placeholder="{{campo}}" data-placeholder-personalizado-html="${html}">{{campo}}</span>`, { repData: {} });
    expect(exportado).toContain('<strong>Seguro</strong>');
    expect(exportado).not.toContain('<img');
    expect(exportado).not.toContain('<script');
  });

  it('restaura o valor mais recente da REP local após desfazer a personalização', () => {
    const body = document.createElement('body');
    body.innerHTML = '<span data-placeholder="{{campo}}">Valor antigo</span>';
    document.body.append(body);
    const campo = body.querySelector<HTMLElement>('span')!;
    preencherCampoReservado(campo, 'Valor manual');
    restaurarCampoReservado(campo);
    const editor = { initialized: true, destroyed: false, removed: false, getBody: () => body, undoManager: { ignore: (acao: () => void) => acao() } } as unknown as TinyMceEditorInstance;
    aplicarVisualizacaoPlaceholders(editor, {
      modo: 'dados', valores: { campo: { valor: 'Valor novo', preenchido: true, formato: 'texto' } },
      placeholdersPersonalizados: [], descreverPendente: () => 'Pendente',
    });
    expect(campo.textContent).toBe('Valor novo');
  });

  it('não altera o campo quando o valor informado estiver vazio', () => {
    document.body.innerHTML = '<span class="campo-reservado" data-reservado="true">XXX</span>';
    const campo = document.body.querySelector<HTMLElement>('span')!;

    expect(preencherCampoReservado(campo, '   ')).toBe(false);
    expect(campo.textContent).toBe('XXX');
    expect(campo.hasAttribute('data-reservado')).toBe(true);
  });
});
