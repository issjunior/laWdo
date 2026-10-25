import { afterEach, expect, it, vi } from 'vitest';
import { consultarRepsColetaLaudo, possuiTabelaColetaB601 } from '@/lib/consulta-reps-coleta';
import { esquemaRepsMesmoCasoGdl } from '../../shared/gdl/reps-mesmo-caso';

const apiOriginal = window.ipcAPI;
const referencias = esquemaRepsMesmoCasoGdl.parse({ ambiente: 'producao', numeroRep: '100', anoRep: '2026', numeroCaso: '42', consultadoEm: new Date().toISOString(), reps: [] });
afterEach(() => { window.ipcAPI = apiOriginal; });

it('identifica o placeholder sem depender do nome ou código do template', () => {
  expect(possuiTabelaColetaB601('<p>{{b601_tabela_material_coleta}}</p>')).toBe(true);
  expect(possuiTabelaColetaB601('<div data-b601-coleta="true"></div>')).toBe(true);
  expect(possuiTabelaColetaB601('{{b601_tabela_material_enc}}')).toBe(false);
});

it('compartilha a chamada pendente e libera nova consulta após erro ou conclusão', async () => {
  let concluir: (valor: unknown) => void = () => undefined;
  const consultar = vi.fn().mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; }))
    .mockResolvedValueOnce({ success: false, error: 'Sem conexão' })
    .mockResolvedValueOnce({ success: true, data: { reps: [] } })
    .mockResolvedValueOnce({ success: true, data: referencias });
  Object.defineProperty(window, 'ipcAPI', { writable: true, value: { ...apiOriginal, gdl: { ...apiOriginal.gdl, consultarRepsMesmoCaso: consultar } } });
  const primeira = consultarRepsColetaLaudo('laudo-teste');
  expect(consultarRepsColetaLaudo('laudo-teste')).toBe(primeira);
  concluir({ success: true, data: referencias });
  await expect(primeira).resolves.toEqual(referencias);
  await expect(consultarRepsColetaLaudo('laudo-teste')).rejects.toThrow('Sem conexão');
  await expect(consultarRepsColetaLaudo('laudo-teste')).rejects.toThrow('referências inválidas');
  await expect(consultarRepsColetaLaudo('laudo-teste')).resolves.toEqual(referencias);
  expect(consultar).toHaveBeenCalledTimes(4);
});
