import { describe, expect, it } from 'vitest';
import { obterNomeArquivoLaudo, obterNomeArquivoRep, obterIdentificacaoBkpLaudo } from '@shared/utils/nomes-documentos-rep';

describe('nomes de documentos da REP', () => {
  it('mantém o padrão de exportação do laudo baseado na REP', () => {
    expect(obterNomeArquivoLaudo('2026/00109026', 'pdf')).toBe('109026-2026.pdf');
  });

  it('identifica a visualização da REP pelo número correspondente', () => {
    expect(obterNomeArquivoRep('2026/00109026', 'pdf')).toBe('REP-109026-2026.pdf');
  });

  it('usa apenas o número quando a REP não informa ano', () => {
    expect(obterNomeArquivoLaudo('000123', 'pdf')).toBe('123.pdf');
  });
  it.each(['2022/00039259', '39.259-22', '39259/2022'])('identifica o BKP pelo número do laudo: %s', numero => {
    expect(obterIdentificacaoBkpLaudo(numero)).toEqual({ nomeArquivo: 'laudo-39259-22.bkp', numeroFormatado: '39.259-22' });
  });

});
