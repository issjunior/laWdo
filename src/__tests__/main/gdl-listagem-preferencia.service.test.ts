import { beforeEach, describe, expect, it, vi } from 'vitest';

const simulacao = vi.hoisted(() => ({ obter: vi.fn(), salvar: vi.fn() }));
vi.mock('../../main/services/configuracao.service.js', () => ({ configuracaoService: simulacao }));

import { definirListagemRepsGdlHabilitada, exigirListagemRepsGdlHabilitada,
  obterListagemRepsGdlHabilitada, obterVersaoPreferenciaListagem } from '../../main/services/gdl-listagem-preferencia.service';

beforeEach(() => {
  simulacao.obter.mockReset().mockResolvedValue(null);
  simulacao.salvar.mockReset().mockResolvedValue(undefined);
});

describe('preferência da listagem GDL', () => {
  it('começa desativada quando não há configuração', async () => {
    expect(await obterListagemRepsGdlHabilitada()).toBe(false);
    await expect(exigirListagemRepsGdlHabilitada()).rejects.toThrow('desativada');
  });

  it('persiste a escolha e invalida consultas iniciadas antes da alteração', async () => {
    simulacao.obter.mockResolvedValue('true');
    const versaoAnterior = obterVersaoPreferenciaListagem();
    await definirListagemRepsGdlHabilitada(false);
    expect(simulacao.salvar).toHaveBeenCalledWith('gdl_listagem_reps_habilitada', 'false', 'texto', 'Listagem de REPs do GDL');
    await expect(exigirListagemRepsGdlHabilitada(versaoAnterior)).rejects.toThrow('desativada');
  });
});
