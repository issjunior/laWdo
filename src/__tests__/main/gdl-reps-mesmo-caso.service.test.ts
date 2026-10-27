import { describe, expect, it, vi } from 'vitest';
import { consultarReferenciasMesmoCasoGdl } from '../../main/services/gdl-reps-mesmo-caso.service';
import { interpretarGdlListaRepsInvestigacaoJson, validarGdlRep } from '../../main/services/gdl.schema';

const principal = validarGdlRep({ codRep: 1, numero: 100, ano: 2026 });
const filtro = [{ numeroOrigem: '10', anoOrigem: 2026 }];
const registro = (numeroRep: string, numeroCaso: number, naturezaExame = 'M110 - LOCAL') => ({ numeroRep, numeroCaso, naturezaExame });
const pagina = (itens: ReturnType<typeof registro>[], total = itens.length) => interpretarGdlListaRepsInvestigacaoJson(JSON.stringify({ dadosREPs: itens, quantRegistros: total }));

describe('REPs de coleta do mesmo caso', () => {
  it('identifica o caso da REP principal e exclui outros casos com origem compartilhada', async () => {
    const carregar = vi.fn().mockResolvedValueOnce(pagina([registro('100/2026', 42, 'B601'), registro('2/2026', 99)]))
      .mockResolvedValueOnce(pagina([registro('20/2026', 42), registro('21/2026', 42, 'T002 - NECROPSIA'), registro('2/2026', 99), registro('30/2026', 42, 'B602')]));
    const resultado = await consultarReferenciasMesmoCasoGdl(principal, 'producao', filtro, carregar);
    expect(carregar).toHaveBeenLastCalledWith({ numeroCaso: 42 }, 1);
    expect(resultado.reps).toEqual([{ numero: '20', ano: '2026', codigoNatureza: 'M110' }, { numero: '21', ano: '2026', codigoNatureza: 'T002' }]);
  });

  it('percorre páginas posteriores mesmo após achar a REP e deduplica exames', async () => {
    const dez = Array.from({ length: 10 }, (_, indice) => registro(`${indice + 100}/2026`, 42, 'B601'));
    const carregar = vi.fn().mockResolvedValueOnce(pagina(dez, 11))
      .mockResolvedValueOnce(pagina([registro('200/2026', 42)], 11))
      .mockResolvedValueOnce(pagina([registro('20/2026', 42), registro('20/2026', 42), registro('21/2026', 42, 'T002')], 3));
    const resultado = await consultarReferenciasMesmoCasoGdl(principal, 'producao', filtro, carregar);
    expect(carregar).toHaveBeenNthCalledWith(2, filtro[0], 2);
    expect(resultado.reps).toHaveLength(2);
  });

  it('não publica resultado parcial se a paginação falha ou se repete', async () => {
    const dez = Array.from({ length: 10 }, (_, indice) => registro(`${indice + 100}/2026`, 42));
    const carregar = vi.fn().mockResolvedValue(pagina(dez, 30));
    await expect(consultarReferenciasMesmoCasoGdl(principal, 'producao', filtro, carregar)).rejects.toThrow('inconsistente');
    carregar.mockReset().mockResolvedValueOnce(pagina([registro('100/2026', 42)]))
      .mockResolvedValueOnce(pagina(dez, 11)).mockRejectedValueOnce(new Error('rede indisponível'));
    await expect(consultarReferenciasMesmoCasoGdl(principal, 'producao', filtro, carregar)).rejects.toThrow('rede indisponível');
  });

  it('rejeita caso ambíguo, identidade ausente e natureza divergente', async () => {
    const carregar = vi.fn().mockResolvedValue(pagina([registro('100/2026', 42), registro('100/2026', 99)]));
    await expect(consultarReferenciasMesmoCasoGdl(principal, 'producao', filtro, carregar)).rejects.toThrow('único caso');
    carregar.mockReset().mockResolvedValue(pagina([registro('999/2026', 42)]));
    await expect(consultarReferenciasMesmoCasoGdl(principal, 'producao', filtro, carregar)).rejects.toThrow('único caso');
    carregar.mockReset().mockResolvedValueOnce(pagina([registro('100/2026', 42)]))
      .mockResolvedValueOnce(pagina([registro('20/2026', 42), registro('20/2026', 42, 'T002')]));
    await expect(consultarReferenciasMesmoCasoGdl(principal, 'producao', filtro, carregar)).rejects.toThrow('naturezas divergentes');
  });
});
