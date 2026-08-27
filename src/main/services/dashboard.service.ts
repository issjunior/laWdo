import { executeQuery } from '../database/sqlite.js';
import { getLogger } from '../utils/logger.js';
import type {
  DashboardConsultaLaudosEntrada,
  DashboardConsultaLaudosResultado,
  DashboardCronologiaLaudo,
  DashboardIndicadorCicloProducao,
  DashboardKpiStatus,
  DashboardLaudoConsulta,
  DashboardProducaoLaudosEntrada,
  DashboardProducaoLaudosResultado,
  DashboardResumo,
} from '../../types/dashboard.js';

const log = getLogger('database');
const statusRep = ['Pendente', 'Em Andamento', 'Concluído'] as const;
const statusLaudo = ['Em andamento', 'Concluído', 'Entregue'] as const;
type LinhaContagem = { status: string | null; total: number | string | null };
type LinhaNumero = { total: number | string | null };
type LinhaAuditoria = {
  created_at: string | null;
  dados_anteriores: string | null;
  dados_novos: string | null;
};
type LinhaProducao = {
  id: string;
  codigo: string | null;
  nome: string | null;
  repDias: number | string;
  laudoDias: number | string;
};
type LinhaNatureza = { id: string; codigo: string | null; nome: string | null };

const inteiro = (valor: unknown) =>
  Number.isFinite(Number(valor)) ? Math.round(Number(valor)) : 0;
const numero = (valor: unknown) => (Number.isFinite(Number(valor)) ? Number(valor) : 0);
const preencher = (linhas: LinhaContagem[], base: readonly string[]): DashboardKpiStatus[] => {
  const totais = new Map(linhas.map(linha => [linha.status, inteiro(linha.total)]));
  return base.map(status => ({ status, total: totais.get(status) ?? 0 }));
};
const statusDoJson = (json: string | null): string | null => {
  try {
    const valor: unknown = json ? JSON.parse(json) : null;
    return typeof valor === 'object' &&
      valor !== null &&
      typeof (valor as Record<string, unknown>).status === 'string'
      ? ((valor as Record<string, unknown>).status as string)
      : null;
  } catch {
    return null;
  }
};
const resumirCiclo = (valores: number[]): DashboardIndicadorCicloProducao => {
  const itens = valores.filter(valor => valor >= 0).sort((a, b) => a - b);
  if (!itens.length) return { quantidade: 0, mediaDias: 0, medianaDias: 0 };
  const meio = Math.floor(itens.length / 2);
  const mediana =
    itens.length % 2 ? (itens[meio] ?? 0) : ((itens[meio - 1] ?? 0) + (itens[meio] ?? 0)) / 2;
  return {
    quantidade: itens.length,
    mediaDias: Number((itens.reduce((soma, valor) => soma + valor, 0) / itens.length).toFixed(1)),
    medianaDias: Number(mediana.toFixed(1)),
  };
};

export class DashboardService {
  async obterResumo(): Promise<DashboardResumo> {
    try {
      const [reps, laudos, vencidas, proximas, aguardando, parados] = await Promise.all([
        executeQuery<LinhaContagem>('SELECT status, COUNT(*) AS total FROM reps GROUP BY status'),
        executeQuery<LinhaContagem>('SELECT status, COUNT(*) AS total FROM laudos GROUP BY status'),
        executeQuery<LinhaNumero>(
          "SELECT COUNT(*) AS total FROM reps WHERE status IN ('Pendente', 'Em Andamento') AND prazo IS NOT NULL AND date(substr(prazo, 1, 10)) < date('now', 'localtime')"
        ),
        executeQuery<LinhaNumero>(
          "SELECT COUNT(*) AS total FROM reps WHERE status IN ('Pendente', 'Em Andamento') AND prazo IS NOT NULL AND date(substr(prazo, 1, 10)) BETWEEN date('now', 'localtime') AND date('now', 'localtime', '+7 days')"
        ),
        executeQuery<LinhaNumero>(
          "SELECT COUNT(*) AS total FROM laudos WHERE status = 'Concluído' AND data_entrega IS NULL"
        ),
        executeQuery<LinhaNumero>(
          "SELECT COUNT(*) AS total FROM laudos WHERE status = 'Em andamento' AND julianday('now', 'localtime') - julianday(updated_at) >= 7"
        ),
      ]);
      return {
        repsPorStatus: preencher(reps, statusRep),
        laudosPorStatus: preencher(laudos, statusLaudo),
        repsPrazoVencido: inteiro(vencidas[0]?.total),
        repsPrazoProximo: inteiro(proximas[0]?.total),
        laudosConcluidosAguardandoEntrega: inteiro(aguardando[0]?.total),
        laudosEmAndamentoSemAlteracao: inteiro(parados[0]?.total),
      };
    } catch (error) {
      log.error('Erro ao consolidar resumo do dashboard', error);
      throw error;
    }
  }

  async consultarLaudos(
    entrada: DashboardConsultaLaudosEntrada
  ): Promise<DashboardConsultaLaudosResultado> {
    const pagina = Math.max(1, Math.floor(entrada.pagina ?? 1));
    const tamanhoPagina = Math.min(100, Math.max(1, Math.floor(entrada.tamanhoPagina ?? 10)));
    const coluna = {
      criacao: 'l.created_at',
      alteracao: 'l.updated_at',
      conclusao: 'l.data_conclusao',
      entrega: 'l.data_entrega',
    }[entrada.tipoData];
    const clausulas = [`${coluna} IS NOT NULL`];
    const parametros: string[] = [];
    if (entrada.busca?.trim()) {
      clausulas.push('(r.numero LIKE ? OR te.codigo LIKE ? OR te.nome LIKE ?)');
      parametros.push(...Array(3).fill(`%${entrada.busca.trim()}%`));
    }
    if (entrada.dataInicial) {
      clausulas.push(`date(${coluna}) >= date(?)`);
      parametros.push(entrada.dataInicial);
    }
    if (entrada.dataFinal) {
      clausulas.push(`date(${coluna}) <= date(?)`);
      parametros.push(entrada.dataFinal);
    }
    const de = `FROM laudos l JOIN reps r ON r.id = l.rep_id LEFT JOIN tipos_exame te ON te.id = r.tipo_exame_id WHERE ${clausulas.join(' AND ')}`;
    const [itens, contagem, porStatus] = await Promise.all([
      executeQuery<DashboardLaudoConsulta>(
        `SELECT l.id, l.rep_id AS repId, r.numero AS repNumero, te.id AS tipoExameId, te.codigo AS tipoExameCodigo, COALESCE(te.nome, 'Tipo de exame não informado') AS tipoExameNome, l.status, l.created_at AS createdAt, l.updated_at AS updatedAt, l.data_conclusao AS dataConclusao, l.data_entrega AS dataEntrega, ${coluna} AS dataOrdenacao ${de} ORDER BY datetime(${coluna}) DESC LIMIT ? OFFSET ?`,
        [...parametros, String(tamanhoPagina), String((pagina - 1) * tamanhoPagina)]
      ),
      executeQuery<LinhaNumero>(`SELECT COUNT(*) AS total ${de}`, parametros),
      executeQuery<LinhaContagem>(
        `SELECT l.status, COUNT(*) AS total ${de} GROUP BY l.status`,
        parametros
      ),
    ]);
    return {
      itens,
      total: inteiro(contagem[0]?.total),
      pagina,
      tamanhoPagina,
      porStatus: preencher(porStatus, statusLaudo),
    };
  }

  async obterCronologiaLaudo(id: string): Promise<DashboardCronologiaLaudo | null> {
    const itens = await executeQuery<DashboardLaudoConsulta>(
      "SELECT l.id, l.rep_id AS repId, r.numero AS repNumero, te.id AS tipoExameId, te.codigo AS tipoExameCodigo, COALESCE(te.nome, 'Tipo de exame não informado') AS tipoExameNome, l.status, l.created_at AS createdAt, l.updated_at AS updatedAt, l.data_conclusao AS dataConclusao, l.data_entrega AS dataEntrega, l.updated_at AS dataOrdenacao FROM laudos l JOIN reps r ON r.id = l.rep_id LEFT JOIN tipos_exame te ON te.id = r.tipo_exame_id WHERE l.id = ?",
      [id]
    );
    const laudo = itens[0];
    if (!laudo) return null;
    const linhas = await executeQuery<LinhaAuditoria>(
      "SELECT created_at, dados_anteriores, dados_novos FROM logs_auditoria WHERE entidade_id = ? AND modulo IN ('laudo', 'laudos') AND tipo_acao = 'transicao_status' ORDER BY datetime(created_at) ASC",
      [id]
    );
    return {
      laudo,
      marcos: [
        { nome: 'Criação', data: laudo.createdAt },
        { nome: 'Última alteração registrada', data: laudo.updatedAt },
        { nome: 'Conclusão', data: laudo.dataConclusao },
        { nome: 'Entrega/envio', data: laudo.dataEntrega },
      ],
      transicoes: linhas.flatMap(linha =>
        linha.created_at
          ? [
              {
                data: linha.created_at,
                statusAnterior: statusDoJson(linha.dados_anteriores),
                statusNovo: statusDoJson(linha.dados_novos),
              },
            ]
          : []
      ),
    };
  }

  async obterProducaoLaudos(
    entrada: DashboardProducaoLaudosEntrada
  ): Promise<DashboardProducaoLaudosResultado[]> {
    const clausulas = ["l.status IN ('Concluído', 'Entregue')", 'l.data_conclusao IS NOT NULL'];
    const parametros: string[] = [];
    if (entrada.tipoExameId) {
      clausulas.push('te.id = ?');
      parametros.push(entrada.tipoExameId);
    }
    if (entrada.dataInicial) {
      clausulas.push('date(l.data_conclusao) >= date(?)');
      parametros.push(entrada.dataInicial);
    }
    if (entrada.dataFinal) {
      clausulas.push('date(l.data_conclusao) <= date(?)');
      parametros.push(entrada.dataFinal);
    }
    const de = `FROM laudos l JOIN reps r ON r.id = l.rep_id JOIN tipos_exame te ON te.id = r.tipo_exame_id WHERE ${clausulas.join(' AND ')}`;
    const [naturezas, linhas] = await Promise.all([
      executeQuery<LinhaNatureza>(
        `SELECT DISTINCT te.id, te.codigo, te.nome ${de} ORDER BY te.nome COLLATE NOCASE ASC`,
        parametros
      ),
      executeQuery<LinhaProducao>(
        `SELECT te.id, te.codigo, te.nome, julianday(l.data_conclusao) - julianday(r.created_at) AS repDias, julianday(l.data_conclusao) - julianday(l.data_inicio) AS laudoDias ${de} AND l.data_inicio IS NOT NULL AND r.created_at IS NOT NULL AND julianday(l.data_conclusao) >= julianday(r.created_at) AND julianday(l.data_conclusao) >= julianday(l.data_inicio) ORDER BY te.nome COLLATE NOCASE ASC`,
        parametros
      ),
    ]);
    const grupos = new Map<string, LinhaProducao[]>();
    for (const linha of linhas) grupos.set(linha.id, [...(grupos.get(linha.id) ?? []), linha]);
    return naturezas.map(natureza => {
      const grupo = grupos.get(natureza.id) ?? [];
      return {
        natureza: {
          id: natureza.id,
          codigo: natureza.codigo,
          nome: natureza.nome ?? 'Tipo de exame não informado',
        },
        repAteConclusao: resumirCiclo(grupo.map(linha => numero(linha.repDias))),
        laudoAteConclusao: resumirCiclo(grupo.map(linha => numero(linha.laudoDias))),
      };
    });
  }
}
export const dashboardService = new DashboardService();
