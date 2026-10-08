import { describe, expect, it } from 'vitest';
import { validarProjetilPersonalizado } from '@main/services/projetil.service';

const valido = {
  calibre: '9 mm Luger', tipo: 'ETOG', massaGramas: '8,03',
  diametroMinMm: '9', diametroMaxMm: '9,02',
  comprimentoMinMm: '15,3', comprimentoMaxMm: '15,4',
};

describe('validação de projétil personalizado', () => {
  it('aceita decimais brasileiros e normaliza as medidas', () => {
    expect(validarProjetilPersonalizado(valido)).toEqual(expect.objectContaining({
      massaGramas: 8.03, diametroMaxMm: 9.02, comprimentoMaxMm: 15.4,
    }));
  });

  it('recusa faixa invertida e dados parciais inconsistentes', () => {
    expect(() => validarProjetilPersonalizado({ ...valido, diametroMinMm: 9.1 })).toThrow('Diâmetro');
    expect(() => validarProjetilPersonalizado({ ...valido, comprimentoMaxMm: '' })).toThrow('Comprimento');
  });
});
