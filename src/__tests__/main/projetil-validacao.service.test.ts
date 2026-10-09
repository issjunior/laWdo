import { describe, expect, it } from 'vitest';
import { validarProjetilPersonalizado } from '@main/services/projetil.service';

const valido = {
  calibre: '9 mm Luger', tipo: 'ETOG', massaGramas: '8,03',
  calibreRealMm: '9,02', alturaMaximaMm: '15,4',
};

describe('validação de projétil personalizado', () => {
  it('aceita decimais brasileiros e normaliza as medidas', () => {
    expect(validarProjetilPersonalizado(valido)).toEqual(expect.objectContaining({
      massaGramas: 8.03, calibreRealMm: 9.02, alturaMaximaMm: 15.4,
    }));
  });

  it('recusa medidas negativas e cadastro sem dimensões', () => {
    expect(() => validarProjetilPersonalizado({ ...valido, calibreRealMm: -1 })).toThrow('positivas');
    expect(() => validarProjetilPersonalizado({ ...valido, calibreRealMm: '', alturaMaximaMm: '' })).toThrow('dimensão');
  });
});
