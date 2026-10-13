import { describe, expect, it } from 'vitest';
import { NATUREZAS_EXAME_GDL } from '../../shared/catalogos/naturezas-exame-gdl.catalogo';
import { apresentarNaturezaExame, identificarNaturezaExame, normalizarCodigoExame } from '../../shared/gdl/natureza-exame';

describe('identificação local da natureza de exame', () => {
  it('usa exclusivamente as opções da seção da REP, sem a duplicação de I802', () => {
    expect(NATUREZAS_EXAME_GDL).toHaveLength(99);
    expect(NATUREZAS_EXAME_GDL.filter(item => item.codigo === 'I802')).toHaveLength(1);
    expect(NATUREZAS_EXAME_GDL.some(item => item.codigo === 'Q840')).toBe(false);
  });

  it('normaliza a descrição sem correspondência aproximada', () => {
    expect(identificarNaturezaExame('  exame de eficiencia   e prestabilidade ').codigoSugerido).toBe('B602');
    expect(identificarNaturezaExame('EXAME DE EFICIÊNCIA').candidatos).toEqual([]);
    expect(normalizarCodigoExame(' b-602 ')).toBe('B602');
  });

  it('sugere os padrões somente nas descrições ambíguas', () => {
    const constatacao = identificarNaturezaExame('EXAME DE CONSTATAÇÃO');
    expect(constatacao.codigoSugerido).toBe('B601');
    expect(constatacao.candidatos.map(item => item.codigo)).toEqual(['B601', 'I806']);
    const diversa = identificarNaturezaExame('EXAME DE NATUREZA DIVERSA');
    expect(diversa.codigoSugerido).toBe('A440');
    expect(diversa.candidatos.map(item => item.codigo)).toEqual(['A440', 'E340', 'M140', 'P241']);
    expect(apresentarNaturezaExame('EXAME DE CONSTATAÇÃO')).toBe('B601 - EXAME DE CONSTATAÇÃO');
  });

  it('preserva o código explícito mesmo fora do catálogo', () => {
    expect(identificarNaturezaExame('I-806 - EXAME DE CONSTATAÇÃO')).toMatchObject({ codigoExplicito: 'I806', codigoSugerido: 'I806', origem: 'gdl' });
    expect(identificarNaturezaExame('Q840 - EXAME DE CONSTATAÇÃO')).toMatchObject({ codigoExplicito: 'Q840', codigoSugerido: 'Q840', candidatos: [] });
    expect(identificarNaturezaExame('0000 - NADA CONSTA').codigoExplicito).toBe('0000');
    expect(identificarNaturezaExame('').codigoSugerido).toBeNull();
  });
});
