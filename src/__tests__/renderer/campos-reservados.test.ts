import { describe, expect, it } from 'vitest';
import { encontrarCampoReservado, preencherCampoReservado } from '../../renderer/lib/campos-reservados';

describe('campos reservados do laudo', () => {
  it('identifica somente o XXX marcado como campo reservado', () => {
    document.body.innerHTML = [
      '<span class="campo-reservado" data-reservado="true">XXX</span>',
      '<span class="campo-reservado" data-reservado="true">preenchido</span>',
      '<span>XXX</span>',
    ].join('');

    const [reservado, preenchido, textoComum] = Array.from(document.body.querySelectorAll('span'));

    expect(encontrarCampoReservado(reservado)).toBe(reservado);
    expect(encontrarCampoReservado(preenchido)).toBeNull();
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

  it('desvincula o placeholder pendente ao aplicar valor local', () => {
    document.body.innerHTML = '<span class="placeholder-tag campo-reservado" contenteditable="false" data-placeholder="{{campo}}" data-reservado="true">XXX</span>';
    const campo = document.body.querySelector<HTMLElement>('span')!;

    expect(preencherCampoReservado(campo, 'Valor local')).toBe(true);
    expect(campo.textContent).toBe('Valor local');
    expect(campo.hasAttribute('data-placeholder')).toBe(false);
    expect(campo.hasAttribute('contenteditable')).toBe(false);
  });

  it('não altera o campo quando o valor informado estiver vazio', () => {
    document.body.innerHTML = '<span class="campo-reservado" data-reservado="true">XXX</span>';
    const campo = document.body.querySelector<HTMLElement>('span')!;

    expect(preencherCampoReservado(campo, '   ')).toBe(false);
    expect(campo.textContent).toBe('XXX');
    expect(campo.hasAttribute('data-reservado')).toBe(true);
  });
});
