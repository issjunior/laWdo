import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../main/services/auth-sessao.service.js', () => ({ authSessaoService: { exigir: () => 'usuario-teste' } }));
vi.mock('../../main/services/gdl-repositorio.service.js', () => ({ obterRepRepositorioGdl: simulacao.anterior, registrarConsultaRepositorioGdl: simulacao.registrar }));

const simulacao = vi.hoisted(() => ({ consultar: vi.fn(), identidade: vi.fn(), listarTipos: vi.fn(), buscarTipo: vi.fn(), converter: vi.fn(), detalhes: vi.fn(), anterior: vi.fn(), registrar: vi.fn() }));
vi.mock('../../main/services/gdl.service.js', () => ({ consultarRep: simulacao.consultar, obterIdentidadeMinhasReps: simulacao.identidade, consultarDetalhesRepAutorizada: simulacao.detalhes }));
vi.mock('../../main/services/tipo-exame.service.js', () => ({ tipoExameService: { findAllOrdered: simulacao.listarTipos, findById: simulacao.buscarTipo } }));
vi.mock('../../main/services/gdl-adaptadores.service.js', () => ({ converterRepGdl: simulacao.converter, listarCodigosImportacaoGdl: () => ['B-602'] }));

import { completarConsultaRepGdl, converterConsultaRepGdl, descartarConsultaRepGdl, identificarRepGdl } from '../../main/services/gdl-consulta-local.service';

beforeEach(() => {
  vi.clearAllMocks();
  descartarConsultaRepGdl(1);
  descartarConsultaRepGdl(2);
  simulacao.identidade.mockResolvedValue('instalacao-a');
  simulacao.anterior.mockResolvedValue(null);
  simulacao.registrar.mockResolvedValue(undefined);
  simulacao.detalhes.mockResolvedValue({ natureza: 'I806 - EXAME DE CONSTATAÇÃO', quesito: { estado: 'presente', valor: 'Quesito detalhado' }, dataSolicitacao: { estado: 'presente', valor: '2026-08-21' } });
  simulacao.consultar.mockImplementation(async (numero: string, ano: string) => ({ sucesso: true, naturezaExame: 'EXAME DE CONSTATAÇÃO', dados: { codRep: Number(numero), numero: Number(numero), ano: Number(ano), quesitoAberto: '', dataEntradaSolicitacao: '' } }));
  simulacao.listarTipos.mockResolvedValue([{ id: 'b601', codigo: 'B-601', nome: 'Nome local livre', ativo: true }, { id: 'i806', codigo: 'I806', nome: 'Outro nome livre', ativo: true }]);
  simulacao.buscarTipo.mockImplementation(async (id: string) => ({ id, codigo: id.toUpperCase(), ativo: true }));
  simulacao.converter.mockReturnValue({ codigoExame: 'I-806', camposGerais: {}, camposEspecificos: {}, avisos: [] });
});

describe('consulta e conversão separadas do GDL', () => {
  it('reutiliza a consulta ao trocar o código e não muda o padrão das próximas REPs', async () => {
    const consulta = await identificarRepGdl(1, '123', '2026');
    await completarConsultaRepGdl(1, consulta.consultaId, false);
    expect(consulta.identificacao.codigoSugerido).toBe('B601');
    expect(consulta.avisos).toEqual(['A data de entrada da solicitação não foi confirmada. Confira o preenchimento local.']);
    const escolhida = await converterConsultaRepGdl(1, consulta.consultaId, 'i806');
    expect(escolhida.identificacaoNatureza).toMatchObject({ codigoSugerido: 'I806', origem: 'usuario' });
    await converterConsultaRepGdl(1, consulta.consultaId, 'b601');
    expect(simulacao.consultar).toHaveBeenCalledTimes(1);
    expect(simulacao.converter).toHaveBeenLastCalledWith('B-601', expect.any(Object), expect.any(Object));
    expect((await identificarRepGdl(2, '124', '2026')).identificacao.codigoSugerido).toBe('B601');
  });

  it('respeita o código explícito da API e rejeita troca ou tipo inativo', async () => {
    simulacao.consultar.mockResolvedValue({ sucesso: true, naturezaExame: 'I806 - EXAME DE CONSTATAÇÃO', dados: { codRep: 123, numero: 123, ano: 2026 } });
    const consulta = await identificarRepGdl(1, '123', '2026', 'EXAME DE CONSTATAÇÃO');
    await completarConsultaRepGdl(1, consulta.consultaId, false);
    await expect(converterConsultaRepGdl(1, consulta.consultaId, 'b601')).rejects.toThrow('deve ser preservado');
    simulacao.buscarTipo.mockResolvedValue({ codigo: 'I806', ativo: false });
    await expect(converterConsultaRepGdl(1, consulta.consultaId, 'i806')).rejects.toThrow('ative');
    expect(simulacao.converter).not.toHaveBeenCalled();
  });

  it('aceita escolha manual sem descrição e rejeita códigos fora dos candidatos conhecidos', async () => {
    const conhecida = await identificarRepGdl(1, '123', '2026');
    await completarConsultaRepGdl(1, conhecida.consultaId, false);
    await expect(converterConsultaRepGdl(1, conhecida.consultaId, 'b602')).rejects.toThrow('não corresponde');
    simulacao.consultar.mockResolvedValue({ sucesso: true, dados: { codRep: 123, numero: 123, ano: 2026 } });
    const manual = await identificarRepGdl(1, '123', '2026');
    await completarConsultaRepGdl(1, manual.consultaId, false);
    await expect(converterConsultaRepGdl(1, manual.consultaId, 'b602')).resolves.toBeDefined();
  });

  it('usa a descrição da lista somente quando a API não identifica a natureza', async () => {
    simulacao.consultar.mockResolvedValue({ sucesso: true, dados: { codRep: 123, numero: 123, ano: 2026 } });
    expect((await identificarRepGdl(1, '123', '2026', 'EXAME DE NATUREZA DIVERSA')).identificacao.codigoSugerido).toBe('A440');
  });

  it('isola remetentes e rejeita consultas substituídas, expiradas ou com credenciais alteradas', async () => {
    const primeira = await identificarRepGdl(1, '123', '2026');
    await expect(converterConsultaRepGdl(2, primeira.consultaId, 'b601')).rejects.toThrow('expirou');
    const segunda = await identificarRepGdl(1, '124', '2026');
    await completarConsultaRepGdl(1, segunda.consultaId, false);
    await expect(converterConsultaRepGdl(1, primeira.consultaId, 'b601')).rejects.toThrow('substituída');
    const agora = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60 * 1000);
    await expect(converterConsultaRepGdl(1, segunda.consultaId, 'b601')).rejects.toThrow('expirou');
    agora.mockRestore();
    simulacao.identidade.mockResolvedValue('instalacao-b');
    await expect(converterConsultaRepGdl(1, segunda.consultaId, 'b601')).rejects.toThrow('configuração');
  });

  it('não deixa uma resposta antiga substituir a consulta mais recente', async () => {
    let liberar: (valor: unknown) => void = () => undefined;
    simulacao.consultar.mockImplementationOnce(() => new Promise(resolve => { liberar = resolve; }));
    const primeira = identificarRepGdl(1, '123', '2026');
    const rejeicao = expect(primeira).rejects.toThrow('substituída');
    await vi.waitFor(() => expect(simulacao.consultar).toHaveBeenCalledTimes(1));
    const segunda = await identificarRepGdl(1, '124', '2026');
    await completarConsultaRepGdl(1, segunda.consultaId, false);
    liberar({ sucesso: true, naturezaExame: 'EXAME DE CONSTATAÇÃO', dados: { codRep: 123, numero: 123, ano: 2026 } });
    await rejeicao;
    await expect(converterConsultaRepGdl(1, segunda.consultaId, 'b601')).resolves.toBeDefined();
  });
});


describe('consulta individual detalhada autorizada', () => {
  it.each(['ABERTA E DISTRIBUÍDA', 'LAUDO EM EXECUÇÃO', undefined])('mantém B601 somente na API com status %s', async statusRep => {
    simulacao.consultar.mockResolvedValue({ sucesso: true, statusRep, naturezaExame: 'B601 - EXAME DE CONSTATAÇÃO', dados: { codRep: 123, numero: 123, ano: 2026, quesitoAberto: 'Da API', dataEntradaSolicitacao: '2026-08-22' } });
    const consulta = await identificarRepGdl(1, '123', '2026');
    expect(consulta.detalhes?.estado).toBe('somente_api');
    expect(consulta.identificacao.codigoExplicito).toBe('B601');
    await converterConsultaRepGdl(1, consulta.consultaId, 'b601');
    expect(simulacao.converter).toHaveBeenCalledWith('B-601', expect.objectContaining({ quesitoAberto: 'Da API', dataEntradaSolicitacao: '2026-08-22' }), expect.any(Object));
    expect(simulacao.detalhes).not.toHaveBeenCalled();
    expect(simulacao.registrar).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({ fonte: 'acesso_detalhes' }), expect.anything());
    await expect(completarConsultaRepGdl(1, consulta.consultaId, true)).rejects.toThrow('já foi concluída');
    expect(simulacao.detalhes).not.toHaveBeenCalled();
  });

  it('exige decisão para aberta e não abre detalhes ao usar somente API', async () => {
    simulacao.consultar.mockResolvedValue({ sucesso: true, statusRep: 'ABERTA E DISTRIBUÍDA', naturezaExame: 'B602 - EXAME BALÍSTICO', dados: { codRep: 123, numero: 123, ano: 2026 } });
    const consulta = await identificarRepGdl(1, '123', '2026');
    expect(consulta.detalhes?.motivoConfirmacao).toContain('Laudo em Execução');
    expect(simulacao.detalhes).not.toHaveBeenCalled();
    await expect(converterConsultaRepGdl(1, consulta.consultaId, 'b602')).rejects.toThrow('Escolha');
    expect((await completarConsultaRepGdl(1, consulta.consultaId, false)).detalhes?.estado).toBe('somente_api');
    expect(simulacao.detalhes).not.toHaveBeenCalled();
  });
  it('a página corrige o código explícito da API depois de confirmação e é lida só uma vez', async () => {
    simulacao.consultar.mockResolvedValue({ sucesso: true, naturezaExame: 'B602 - EXAME BALÍSTICO', dados: { codRep: 123, numero: 123, ano: 2026 } });
    const inicial = await identificarRepGdl(1, '123', '2026');
    const detalhada = await completarConsultaRepGdl(1, inicial.consultaId, true);
    expect(detalhada).toMatchObject({ identificacao: { codigoExplicito: 'I806' }, detalhes: { estado: 'confirmados', origemNatureza: 'detalhes', divergencia: true } });
    await converterConsultaRepGdl(1, inicial.consultaId, 'i806');
    expect(simulacao.converter).toHaveBeenCalledWith('I-806', expect.objectContaining({ quesitoAberto: 'Quesito detalhado', dataEntradaSolicitacao: '2026-08-21' }), expect.any(Object));
    await expect(completarConsultaRepGdl(1, inicial.consultaId, true)).rejects.toThrow('já foi concluída');
    expect(simulacao.detalhes).toHaveBeenCalledTimes(1);
    expect(simulacao.registrar).toHaveBeenCalledWith('usuario-teste', 'instalacao-a', 123, '123', '2026', expect.objectContaining({ fonte: 'detalhes' }), expect.any(Function));
  });
  it('abre sem aviso quando o status atual é Laudo em Execução', async () => {
    simulacao.consultar.mockResolvedValue({ sucesso: true, statusRep: 'LAUDO EM EXECUÇÃO', dados: { codRep: 123, numero: 123, ano: 2026 } });
    const consulta = await identificarRepGdl(1, '123', '2026');
    expect(consulta.detalhes?.estado).toBe('confirmados');
    expect(consulta.detalhes?.motivoConfirmacao).toBeUndefined();
    expect(simulacao.detalhes).toHaveBeenCalledTimes(1);
  });
  it('preserva campos da API após falha e não repete a leitura', async () => {
    simulacao.consultar.mockResolvedValue({ sucesso: true, dados: { codRep: 123, numero: 123, ano: 2026, quesitoAberto: 'Da API', dataEntradaSolicitacao: '2026-08-22' } });
    simulacao.detalhes.mockRejectedValue(new Error('Timeout'));
    const inicial = await identificarRepGdl(1, '123', '2026');
    const consulta = await completarConsultaRepGdl(1, inicial.consultaId, true);
    expect(consulta.detalhes?.estado).toBe('parciais');
    await converterConsultaRepGdl(1, inicial.consultaId, 'b601');
    expect(simulacao.converter.mock.calls[0][1]).toMatchObject({ quesitoAberto: 'Da API', dataEntradaSolicitacao: '2026-08-22' });
    expect(simulacao.detalhes).toHaveBeenCalledTimes(1);
  });
  it('distingue vazio confirmado de ausência e mantém o valor anterior ausente', async () => {
    simulacao.consultar.mockResolvedValue({ sucesso: true, dados: { codRep: 123, numero: 123, ano: 2026, quesitoAberto: 'Anterior', dataEntradaSolicitacao: '2026-08-22' } });
    simulacao.detalhes.mockResolvedValue({ natureza: 'B601 - EXAME DE CONSTATAÇÃO', quesito: { estado: 'vazio', valor: '' }, dataSolicitacao: { estado: 'ausente', valor: '' } });
    const inicial = await identificarRepGdl(1, '123', '2026');
    await completarConsultaRepGdl(1, inicial.consultaId, true);
    const importacao = await converterConsultaRepGdl(1, inicial.consultaId, 'b601');
    expect(importacao.camposVaziosConfirmados).toEqual(['observacoes']);
    expect(importacao.camposGerais.observacoes).toBe('');
    expect(simulacao.converter.mock.calls[0][1].dataEntradaSolicitacao).toBe('2026-08-22');
  });
  it('rejeita identidade divergente da API sem acessar a página', async () => {
    simulacao.consultar.mockResolvedValue({ sucesso: true, dados: { codRep: 123, numero: 999, ano: 2026 } });
    await expect(identificarRepGdl(1, '123', '2026')).rejects.toThrow('diferente');
    expect(simulacao.detalhes).not.toHaveBeenCalled();
  });
});
