import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardService } from '../../main/services/dashboard.service';

const executeQueryMock = vi.fn();
vi.mock('../../main/database/sqlite.js', () => ({
  executeQuery: (...args: unknown[]) => executeQueryMock(...args),
}));

describe('dashboard.service', () => {
  beforeEach(() => executeQueryMock.mockReset());

  it('consolida status e as quatro prioridades operacionais', async () => {
    executeQueryMock
      .mockResolvedValueOnce([{ status: 'Pendente', total: 2 }])
      .mockResolvedValueOnce([{ status: 'Concluído', total: 3 }])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([{ total: 2 }])
      .mockResolvedValueOnce([{ total: 3 }])
      .mockResolvedValueOnce([{ total: 4 }]);
    await expect(new DashboardService().obterResumo()).resolves.toEqual({
      repsPorStatus: [
        { status: 'Pendente', total: 2 },
        { status: 'Em Andamento', total: 0 },
        { status: 'Concluído', total: 0 },
      ],
      laudosPorStatus: [
        { status: 'Em andamento', total: 0 },
        { status: 'Concluído', total: 3 },
        { status: 'Entregue', total: 0 },
      ],
      repsPrazoVencido: 1,
      repsPrazoProximo: 2,
      laudosConcluidosAguardandoEntrega: 3,
      laudosEmAndamentoSemAlteracao: 4,
    });
    expect(executeQueryMock.mock.calls[3]?.[0]).toContain("'+7 days'");
    expect(executeQueryMock.mock.calls[5]?.[0]).toContain('julianday(updated_at) >= 7');
  });

  it('aplica paginação e retorna a agregação de todo o resultado', async () => {
    executeQueryMock
      .mockResolvedValueOnce([
        {
          id: 'l-1',
          repId: 'r-1',
          repNumero: '001',
          tipoExameId: null,
          tipoExameCodigo: null,
          tipoExameNome: 'Exame',
          status: 'Concluído',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-02',
          dataConclusao: '2026-01-03',
          dataEntrega: null,
          dataOrdenacao: '2026-01-03',
        },
      ])
      .mockResolvedValueOnce([{ total: 11 }])
      .mockResolvedValueOnce([{ status: 'Concluído', total: 11 }]);
    const resultado = await new DashboardService().consultarLaudos({ tipoData: 'conclusao' });
    expect(resultado.total).toBe(11);
    expect(resultado.itens).toHaveLength(1);
    expect(resultado.porStatus[1]).toEqual({ status: 'Concluído', total: 11 });
  });

  it('aplica o fim do período de forma inclusiva na consulta cronológica', async () => {
    executeQueryMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([]);
    await new DashboardService().consultarLaudos({
      tipoData: 'entrega',
      dataInicial: '2026-01-01',
      dataFinal: '2026-01-31',
    });
    expect(executeQueryMock.mock.calls[0]?.[0]).toContain('date(l.data_entrega) <= date(?)');
    expect(executeQueryMock.mock.calls[0]?.[1]).toEqual(['2026-01-01', '2026-01-31', '10', '0']);
  });

  it('normaliza paginação, aplica filtros e preenche status sem resultado', async () => {
    executeQueryMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 'invalido' }])
      .mockResolvedValueOnce([{ status: 'Em andamento', total: '2' }]);
    const resultado = await new DashboardService().consultarLaudos({
      tipoData: 'alteracao',
      busca: ' BAL ',
      pagina: 0,
      tamanhoPagina: 999,
      dataInicial: '2026-02-01',
      dataFinal: '2026-02-28',
    });
    expect(resultado).toEqual({
      itens: [],
      total: 0,
      pagina: 1,
      tamanhoPagina: 100,
      porStatus: [
        { status: 'Em andamento', total: 2 },
        { status: 'Concluído', total: 0 },
        { status: 'Entregue', total: 0 },
      ],
    });
    expect(executeQueryMock.mock.calls[0]?.[1]).toEqual([
      '%BAL%', '%BAL%', '%BAL%', '2026-02-01', '2026-02-28', '100', '0',
    ]);
  });

  it('não consulta auditoria quando o laudo não existe', async () => {
    executeQueryMock.mockResolvedValueOnce([]);
    await expect(new DashboardService().obterCronologiaLaudo('ausente')).resolves.toBeNull();
    expect(executeQueryMock).toHaveBeenCalledTimes(1);
  });

  it('reconstrói transições usando somente a auditoria vinculada ao laudo', async () => {
    executeQueryMock
      .mockResolvedValueOnce([
        {
          id: 'l-1',
          repId: 'r-1',
          repNumero: '001',
          tipoExameId: 'te-1',
          tipoExameCodigo: 'BAL',
          tipoExameNome: 'Balística',
          status: 'Entregue',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-04',
          dataConclusao: '2026-01-03',
          dataEntrega: '2026-01-04',
          dataOrdenacao: '2026-01-04',
        },
      ])
      .mockResolvedValueOnce([
        {
          created_at: '2026-01-02',
          dados_anteriores: '{"status":"Em andamento"}',
          dados_novos: '{"status":"Concluído"}',
        },
        {
          created_at: '2026-01-03',
          dados_anteriores: '{"status":"Concluído"}',
          dados_novos: '{"status":"Em andamento"}',
        },
      ]);
    const resultado = await new DashboardService().obterCronologiaLaudo('l-1');
    expect(resultado?.marcos).toHaveLength(4);
    expect(resultado?.transicoes).toEqual([
      { data: '2026-01-02', statusAnterior: 'Em andamento', statusNovo: 'Concluído' },
      { data: '2026-01-03', statusAnterior: 'Concluído', statusNovo: 'Em andamento' },
    ]);
    expect(executeQueryMock.mock.calls[1]?.[0]).toContain('entidade_id = ?');
  });

  it('preserva transição auditável com JSON inválido e ignora data ausente', async () => {
    executeQueryMock
      .mockResolvedValueOnce([
        {
          id: 'l-1', repId: 'r-1', repNumero: '001', tipoExameId: null,
          tipoExameCodigo: null, tipoExameNome: 'Exame', status: 'Em andamento',
          createdAt: '2026-01-01', updatedAt: '2026-01-02', dataConclusao: null,
          dataEntrega: null, dataOrdenacao: '2026-01-02',
        },
      ])
      .mockResolvedValueOnce([
        { created_at: '2026-01-02', dados_anteriores: '{invalido', dados_novos: '{"status":12}' },
        { created_at: null, dados_anteriores: '{"status":"Pendente"}', dados_novos: '{"status":"Em andamento"}' },
      ]);
    const resultado = await new DashboardService().obterCronologiaLaudo('l-1');
    expect(resultado?.transicoes).toEqual([
      { data: '2026-01-02', statusAnterior: null, statusNovo: null },
    ]);
  });

  it('calcula média e mediana para ciclos de produção', async () => {
    executeQueryMock
      .mockResolvedValueOnce([{ id: 'te-1', codigo: 'BAL', nome: 'Balística' }])
      .mockResolvedValueOnce([
        { id: 'te-1', codigo: 'BAL', nome: 'Balística', repDias: 2, laudoDias: 1 },
        { id: 'te-1', codigo: 'BAL', nome: 'Balística', repDias: 4, laudoDias: 3 },
      ]);
    const [resultado] = await new DashboardService().obterProducaoLaudos({});
    expect(resultado?.repAteConclusao).toEqual({ quantidade: 2, mediaDias: 3, medianaDias: 3 });
    expect(resultado?.laudoAteConclusao).toEqual({ quantidade: 2, mediaDias: 2, medianaDias: 2 });
  });

  it('mantém a natureza concluída mesmo sem amostra válida para os ciclos', async () => {
    executeQueryMock
      .mockResolvedValueOnce([{ id: 'te-1', codigo: 'BAL', nome: 'Balística' }])
      .mockResolvedValueOnce([]);
    await expect(new DashboardService().obterProducaoLaudos({})).resolves.toEqual([
      {
        natureza: { id: 'te-1', codigo: 'BAL', nome: 'Balística' },
        repAteConclusao: { quantidade: 0, mediaDias: 0, medianaDias: 0 },
        laudoAteConclusao: { quantidade: 0, mediaDias: 0, medianaDias: 0 },
      },
    ]);
  });

  it('filtra ciclos negativos e aplica filtros de produção na consulta', async () => {
    executeQueryMock
      .mockResolvedValueOnce([{ id: 'te-1', codigo: null, nome: null }])
      .mockResolvedValueOnce([
        { id: 'te-1', codigo: null, nome: null, repDias: -1, laudoDias: 'invalido' },
        { id: 'te-1', codigo: null, nome: null, repDias: 5, laudoDias: 2 },
      ]);
    await expect(new DashboardService().obterProducaoLaudos({
      tipoExameId: 'te-1', dataInicial: '2026-01-01', dataFinal: '2026-01-31',
    })).resolves.toEqual([
      {
        natureza: { id: 'te-1', codigo: null, nome: 'Tipo de exame não informado' },
        repAteConclusao: { quantidade: 1, mediaDias: 5, medianaDias: 5 },
        laudoAteConclusao: { quantidade: 2, mediaDias: 1, medianaDias: 1 },
      },
    ]);
    expect(executeQueryMock.mock.calls[0]?.[1]).toEqual(['te-1', '2026-01-01', '2026-01-31']);
  });
});
