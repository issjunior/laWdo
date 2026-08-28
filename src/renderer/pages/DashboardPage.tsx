import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  CalendarSearch,
  ChevronDown,
  Clock3,
  ExternalLink,
  RefreshCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import logo from '@/assets/logo.png';
import type {
  DashboardConsultaLaudosEntrada,
  DashboardConsultaLaudosResultado,
  DashboardCronologiaLaudo,
  DashboardKpiStatus,
  DashboardLaudoConsulta,
  DashboardProducaoLaudosEntrada,
  DashboardProducaoLaudosResultado,
  DashboardResumo,
  DashboardTipoDataConsulta,
} from '../../types/dashboard.js';

type Resposta<T> = { success: boolean; data?: T; error?: string };
type TipoGrafico = 'barras' | 'rosca' | 'empilhado';
type SecaoDashboard = 'situacao' | 'cronologia' | 'producao';
type SecoesExpandidas = Record<SecaoDashboard, boolean>;
const CHAVE_GRAFICO = 'dashboard_tipo_grafico';
const CHAVE_SECOES = 'dashboard_secoes_expandidas';
const secoesPadrao: SecoesExpandidas = { situacao: true, cronologia: true, producao: true };
const cores = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
];
const texto = (valor: unknown) => (typeof valor === 'string' ? valor : '');
const numero = (valor: unknown) =>
  Number.isFinite(Number(valor)) ? Math.max(0, Math.round(Number(valor))) : 0;
const registro = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null;
const obterSecoesExpandidas = (): SecoesExpandidas => {
  try {
    const valor: unknown = JSON.parse(window.localStorage.getItem(CHAVE_SECOES) ?? '');
    if (!registro(valor)) return secoesPadrao;
    return {
      situacao: typeof valor.situacao === 'boolean' ? valor.situacao : secoesPadrao.situacao,
      cronologia:
        typeof valor.cronologia === 'boolean' ? valor.cronologia : secoesPadrao.cronologia,
      producao: typeof valor.producao === 'boolean' ? valor.producao : secoesPadrao.producao,
    };
  } catch {
    return secoesPadrao;
  }
};
const dataOpcional = (valor: unknown) => (typeof valor === 'string' && valor ? valor : null);
const normalizarResumo = (valor: unknown): DashboardResumo => {
  const dados = registro(valor) ? valor : {};
  const status = (item: unknown): DashboardKpiStatus | null =>
    registro(item) && texto(item.status)
      ? { status: texto(item.status), total: numero(item.total) }
      : null;
  return {
    repsPorStatus: Array.isArray(dados.repsPorStatus)
      ? dados.repsPorStatus.map(status).filter((item): item is DashboardKpiStatus => item !== null)
      : [],
    laudosPorStatus: Array.isArray(dados.laudosPorStatus)
      ? dados.laudosPorStatus
          .map(status)
          .filter((item): item is DashboardKpiStatus => item !== null)
      : [],
    repsPrazoVencido: numero(dados.repsPrazoVencido),
    repsPrazoProximo: numero(dados.repsPrazoProximo),
    laudosConcluidosAguardandoEntrega: numero(dados.laudosConcluidosAguardandoEntrega),
    laudosEmAndamentoSemAlteracao: numero(dados.laudosEmAndamentoSemAlteracao),
  };
};
const normalizarLaudo = (valor: unknown): DashboardLaudoConsulta | null => {
  if (!registro(valor) || !texto(valor.id) || !texto(valor.repId) || !texto(valor.repNumero))
    return null;
  return {
    id: texto(valor.id),
    repId: texto(valor.repId),
    repNumero: texto(valor.repNumero),
    tipoExameId: dataOpcional(valor.tipoExameId),
    tipoExameCodigo: dataOpcional(valor.tipoExameCodigo),
    tipoExameNome: texto(valor.tipoExameNome) || 'Tipo de exame não informado',
    status: texto(valor.status),
    createdAt: dataOpcional(valor.createdAt),
    updatedAt: dataOpcional(valor.updatedAt),
    dataConclusao: dataOpcional(valor.dataConclusao),
    dataEntrega: dataOpcional(valor.dataEntrega),
    dataOrdenacao: dataOpcional(valor.dataOrdenacao),
  };
};
const normalizarConsulta = (valor: unknown): DashboardConsultaLaudosResultado | null => {
  if (!registro(valor)) return null;
  return {
    itens: Array.isArray(valor.itens)
      ? valor.itens
          .map(normalizarLaudo)
          .filter((item): item is DashboardLaudoConsulta => item !== null)
      : [],
    total: numero(valor.total),
    pagina: Math.max(1, numero(valor.pagina)),
    tamanhoPagina: Math.max(1, numero(valor.tamanhoPagina)),
    porStatus: Array.isArray(valor.porStatus)
      ? valor.porStatus
          .map(item =>
            registro(item) && texto(item.status)
              ? { status: texto(item.status), total: numero(item.total) }
              : null
          )
          .filter((item): item is DashboardKpiStatus => item !== null)
      : [],
  };
};
const normalizarProducao = (valor: unknown): DashboardProducaoLaudosResultado[] =>
  Array.isArray(valor)
    ? valor.flatMap(item => {
        if (!registro(item) || !registro(item.natureza) || !texto(item.natureza.id)) return [];
        const ciclo = (dados: unknown) =>
          registro(dados)
            ? {
                quantidade: numero(dados.quantidade),
                mediaDias: Number(Number(dados.mediaDias || 0).toFixed(1)),
                medianaDias: Number(Number(dados.medianaDias || 0).toFixed(1)),
              }
            : { quantidade: 0, mediaDias: 0, medianaDias: 0 };
        return [
          {
            natureza: {
              id: texto(item.natureza.id),
              codigo: dataOpcional(item.natureza.codigo),
              nome: texto(item.natureza.nome) || 'Tipo de exame não informado',
            },
            repAteConclusao: ciclo(item.repAteConclusao),
            laudoAteConclusao: ciclo(item.laudoAteConclusao),
          },
        ];
      })
    : [];
const normalizarCronologia = (valor: unknown): DashboardCronologiaLaudo | null => {
  if (!registro(valor)) return null;
  const laudo = normalizarLaudo(valor.laudo);
  if (!laudo) return null;
  return {
    laudo,
    marcos: Array.isArray(valor.marcos)
      ? valor.marcos.flatMap(marco =>
          registro(marco) && texto(marco.nome)
            ? [{ nome: texto(marco.nome), data: dataOpcional(marco.data) }]
            : []
        )
      : [],
    transicoes: Array.isArray(valor.transicoes)
      ? valor.transicoes.flatMap(evento =>
          registro(evento) && texto(evento.data)
            ? [
                {
                  data: texto(evento.data),
                  statusAnterior: dataOpcional(evento.statusAnterior),
                  statusNovo: dataOpcional(evento.statusNovo),
                },
              ]
            : []
        )
      : [],
  };
};
const formatarData = (valor: string | null) =>
  valor
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(valor)
      )
    : 'Não registrado';
const formatarDia = (valor: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(`${valor}T00:00:00`));
const rotuloTipoData: Record<DashboardTipoDataConsulta, string> = {
  criacao: 'Criação',
  alteracao: 'Alteração',
  conclusao: 'Conclusão',
  entrega: 'Entrega/envio',
};
const descreverPeriodo = (dataInicial?: string, dataFinal?: string) => {
  if (dataInicial && dataFinal) return `${formatarDia(dataInicial)} a ${formatarDia(dataFinal)}`;
  if (dataInicial) return `a partir de ${formatarDia(dataInicial)}`;
  if (dataFinal) return `até ${formatarDia(dataFinal)}`;
  return 'todo o período';
};

function GraficoStatus({
  titulo,
  dados,
  aoSelecionar,
  tipo,
}: {
  titulo: string;
  dados: DashboardKpiStatus[];
  aoSelecionar: (status: string) => void;
  tipo: TipoGrafico;
}) {
  const preenchidos = dados.map((item, indice) => ({ ...item, cor: cores[indice % cores.length] }));
  const dadosEmpilhados = [
    preenchidos.reduce<Record<string, string | number>>(
      (acumulado, item) => ({ ...acumulado, [item.status]: item.total }),
      { grupo: 'Quantidade' }
    ),
  ];
  const vazio = preenchidos.every(item => item.total === 0);
  return (
    <Card>
      <CardHeader className="space-y-1 p-4 pb-2">
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>
          {vazio
            ? 'Sem dados para o período atual.'
            : 'Selecione um segmento para filtrar a lista correspondente.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="h-56 p-4 pt-0">
        {vazio ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Nenhum registro encontrado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {tipo === 'rosca' ? (
              <PieChart>
                <Pie
                  data={preenchidos}
                  dataKey="total"
                  nameKey="status"
                  innerRadius={58}
                  outerRadius={90}
                  onClick={item => aoSelecionar(texto(item.status))}
                >
                  {preenchidos.map(item => (
                    <Cell key={item.status} fill={item.cor} />
                  ))}
                </Pie>
                <Tooltip
                  allowEscapeViewBox={{ x: true, y: true }}
                  reverseDirection={{ x: true, y: true }}
                  cursor={false}
                  offset={8}
                />
                <Legend />
              </PieChart>
            ) : tipo === 'empilhado' ? (
              <BarChart data={dadosEmpilhados}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="grupo" width={90} />
                <Tooltip
                  allowEscapeViewBox={{ x: true, y: true }}
                  reverseDirection={{ x: true, y: true }}
                  cursor={false}
                  offset={8}
                />
                <Legend />
                {preenchidos.map(item => (
                  <Bar
                    key={item.status}
                    dataKey={item.status}
                    stackId="status"
                    fill={item.cor}
                    onClick={() => aoSelecionar(item.status)}
                  />
                ))}
              </BarChart>
            ) : (
              <BarChart data={preenchidos} layout="vertical">
                <XAxis type="number" />
                <YAxis type="category" dataKey="status" width={110} />
                <Tooltip
                  allowEscapeViewBox={{ x: true, y: true }}
                  reverseDirection={{ x: true, y: true }}
                  cursor={false}
                  offset={8}
                />
                <Legend />
                <Bar
                  dataKey="total"
                  name="Quantidade"
                  onClick={item => aoSelecionar(texto(item.status))}
                >
                  {preenchidos.map(item => (
                    <Cell key={item.status} fill={item.cor} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const navegar = useNavigate();
  const [resumo, setResumo] = useState<DashboardResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>(() => {
    const valor = window.localStorage.getItem(CHAVE_GRAFICO);
    return valor === 'barras' || valor === 'empilhado' ? valor : 'rosca';
  });
  const [filtros, setFiltros] = useState<DashboardConsultaLaudosEntrada>({
    tipoData: 'criacao',
    pagina: 1,
    tamanhoPagina: 10,
  });
  const [consulta, setConsulta] = useState<DashboardConsultaLaudosResultado | null>(null);
  const [buscaLaudo, setBuscaLaudo] = useState('');
  const [resultadoBuscaLaudo, setResultadoBuscaLaudo] =
    useState<DashboardConsultaLaudosResultado | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [erroConsulta, setErroConsulta] = useState<string | null>(null);
  const [erroProducao, setErroProducao] = useState<string | null>(null);
  const [erroCronologia, setErroCronologia] = useState<string | null>(null);
  const [carregandoProducao, setCarregandoProducao] = useState(false);
  const [cronologia, setCronologia] = useState<DashboardCronologiaLaudo | null>(null);
  const [graficoConsultaAberto, setGraficoConsultaAberto] = useState(false);
  const [producao, setProducao] = useState<DashboardProducaoLaudosResultado[]>([]);
  const [naturezasProducao, setNaturezasProducao] = useState<
    DashboardProducaoLaudosResultado['natureza'][]
  >([]);
  const [filtrosProducao, setFiltrosProducao] = useState<DashboardProducaoLaudosEntrada>({});
  const [secoesExpandidas, setSecoesExpandidas] = useState<SecoesExpandidas>(() =>
    obterSecoesExpandidas()
  );
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = (await window.ipcAPI.dashboard.resumo()) as Resposta<DashboardResumo>;
      if (!resposta.success) throw new Error(resposta.error);
      setResumo(normalizarResumo(resposta.data));
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar dashboard');
    } finally {
      setCarregando(false);
    }
  }, []);
  const carregarProducao = useCallback(async (entrada: DashboardProducaoLaudosEntrada = {}) => {
    setCarregandoProducao(true);
    setErroProducao(null);
    try {
      const resposta = (await window.ipcAPI.dashboard.producaoLaudos(entrada)) as Resposta<unknown>;
      if (!resposta.success)
        throw new Error(resposta.error || 'Erro ao consultar produção de laudos');
      const dados = normalizarProducao(resposta.data);
      setProducao(dados);
      if (!entrada.tipoExameId && !entrada.dataInicial && !entrada.dataFinal) {
        setNaturezasProducao(dados.map(item => item.natureza));
      }
    } catch (error) {
      setErroProducao(
        error instanceof Error ? error.message : 'Erro ao consultar produção de laudos'
      );
    } finally {
      setCarregandoProducao(false);
    }
  }, []);
  useEffect(() => {
    void carregar();
    void carregarProducao();
  }, [carregar, carregarProducao]);
  const consultar = async (pagina = 1) => {
    setConsultando(true);
    setErroConsulta(null);
    const entrada = { ...filtros, pagina };
    try {
      const resposta = (await window.ipcAPI.dashboard.consultarLaudos(
        entrada
      )) as Resposta<unknown>;
      if (!resposta.success) throw new Error(resposta.error || 'Erro ao consultar laudos');
      setConsulta(normalizarConsulta(resposta.data));
    } catch (error) {
      setConsulta(null);
      setErroConsulta(error instanceof Error ? error.message : 'Erro ao consultar laudos');
    } finally {
      setConsultando(false);
    }
  };
  const consultarPorLaudo = async () => {
    setErroConsulta(null);
    setConsultando(true);
    try {
      const resposta = (await window.ipcAPI.dashboard.consultarLaudos({
        tipoData: 'criacao',
        busca: buscaLaudo,
        pagina: 1,
        tamanhoPagina: 10,
      })) as Resposta<unknown>;
      if (!resposta.success) throw new Error(resposta.error || 'Erro ao consultar laudos');
      setResultadoBuscaLaudo(normalizarConsulta(resposta.data));
    } catch (error) {
      setResultadoBuscaLaudo(null);
      setErroConsulta(error instanceof Error ? error.message : 'Erro ao consultar laudos');
    } finally {
      setConsultando(false);
    }
  };
  const abrirCronologia = async (laudoId: string) => {
    setErroCronologia(null);
    const resposta = (await window.ipcAPI.dashboard.cronologiaLaudo(laudoId)) as Resposta<unknown>;
    const dados = resposta.success ? normalizarCronologia(resposta.data) : null;
    if (dados) setCronologia(dados);
    else setErroCronologia(resposta.error || 'Não foi possível carregar a cronologia do laudo');
  };
  const selecionarGrafico = (status: string, rota: '/reps' | '/laudos') =>
    navegar(`${rota}?status=${encodeURIComponent(status)}`);
  const prioridades = useMemo(
    () =>
      resumo
        ? [
            {
              titulo: 'REPs vencidas',
              total: resumo.repsPrazoVencido,
              rota: '/reps?prioridade=vencida',
            },
            {
              titulo: 'REPs vencendo em até 7 dias',
              total: resumo.repsPrazoProximo,
              rota: '/reps?prioridade=proxima',
            },
            {
              titulo: 'Laudos concluídos aguardando entrega',
              total: resumo.laudosConcluidosAguardandoEntrega,
              rota: '/laudos?prioridade=aguardando-entrega',
            },
            {
              titulo: 'Laudos sem alteração há 7 dias',
              total: resumo.laudosEmAndamentoSemAlteracao,
              rota: '/laudos?prioridade=sem-alteracao',
            },
          ]
        : [],
    [resumo]
  );
  const mudarGrafico = (valor: TipoGrafico) => {
    setTipoGrafico(valor);
    window.localStorage.setItem(CHAVE_GRAFICO, valor);
  };
  const alternarSecao = (secao: SecaoDashboard) => {
    const proximas = { ...secoesExpandidas, [secao]: !secoesExpandidas[secao] };
    window.localStorage.setItem(CHAVE_SECOES, JSON.stringify(proximas));
    setSecoesExpandidas(proximas);
  };
  if (carregando) return <div className="p-6 text-muted-foreground">Carregando dashboard...</div>;
  if (erro)
    return (
      <Card className="m-6 border-destructive">
        <CardContent className="flex items-center gap-3 p-6">
          <AlertTriangle />
          <span>{erro}</span>
          <Button variant="outline" onClick={() => void carregar()}>
            <RefreshCcw />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  return (
    <div className="relative isolate min-h-full overflow-hidden">
      <img
        src={logo}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-[min(42rem,72vw)] -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.035] grayscale dark:opacity-[0.06]"
      />
      <div className="container relative z-10 mx-auto space-y-3 p-3 md:p-4">
        <Card>
          <CardHeader className="flex min-h-[72px] flex-row items-center justify-between space-y-0 p-4 pb-2">
            <div className="space-y-0.5">
              <CardTitle className="flex gap-2">
                <BarChart3 />
                Situação atual
              </CardTitle>
              <CardDescription>
                Status das REPs e laudos, com prioridades operacionais.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={secoesExpandidas.situacao}
              onClick={() => alternarSecao('situacao')}
            >
              {secoesExpandidas.situacao ? 'Recolher' : 'Expandir'}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${secoesExpandidas.situacao ? 'rotate-180' : ''}`}
              />
            </Button>
          </CardHeader>
          {secoesExpandidas.situacao && (
            <CardContent className="space-y-3 p-4 pt-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="tipo-grafico">Visualização</Label>
                <Select
                  value={tipoGrafico}
                  onValueChange={valor => mudarGrafico(valor as TipoGrafico)}
                >
                  <SelectTrigger id="tipo-grafico" className="h-9 w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="barras">Barras horizontais</SelectItem>
                    <SelectItem value="rosca">Rosca</SelectItem>
                    <SelectItem value="empilhado">Barras empilhadas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <GraficoStatus
                  titulo="Status das REPs"
                  dados={resumo?.repsPorStatus ?? []}
                  tipo={tipoGrafico}
                  aoSelecionar={status => selecionarGrafico(status, '/reps')}
                />
                <GraficoStatus
                  titulo="Status dos laudos"
                  dados={resumo?.laudosPorStatus ?? []}
                  tipo={tipoGrafico}
                  aoSelecionar={status => selecionarGrafico(status, '/laudos')}
                />
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {prioridades.map(item => (
                  <button
                    key={item.titulo}
                    type="button"
                    onClick={() => navegar(item.rota)}
                    className="rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
                  >
                    <p className="text-2xl font-bold">{item.total}</p>
                    <p className="text-sm text-muted-foreground">{item.titulo}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
        <Card>
          <CardHeader className="flex min-h-[72px] flex-row items-center justify-between space-y-0 p-4 pb-2">
            <div className="space-y-0.5">
              <CardTitle className="flex gap-2">
                <CalendarSearch />
                Consulta cronológica
              </CardTitle>
              <CardDescription>
                Por período, com a distribuição de todos os resultados filtrados.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={secoesExpandidas.cronologia}
              onClick={() => alternarSecao('cronologia')}
            >
              {secoesExpandidas.cronologia ? 'Recolher' : 'Expandir'}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${secoesExpandidas.cronologia ? 'rotate-180' : ''}`}
              />
            </Button>
          </CardHeader>
          {secoesExpandidas.cronologia && (
            <CardContent className="p-4 pt-0">
              <Tabs defaultValue="periodo">
                <TabsList>
                  <TabsTrigger value="periodo">Por período</TabsTrigger>
                  <TabsTrigger value="laudo">Por laudo</TabsTrigger>
                </TabsList>
                <TabsContent value="periodo" className="space-y-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(14rem,0.7fr)_minmax(28rem,1.3fr)]">
                    <Card className="border-border/80 bg-muted/20 shadow-none">
                      <CardContent className="space-y-2 p-4">
                        <Label htmlFor="busca-cronologica">Busca</Label>
                        <Input
                          id="busca-cronologica"
                          placeholder="REP, código ou natureza"
                          value={filtros.busca ?? ''}
                          onChange={evento =>
                            setFiltros({ ...filtros, busca: evento.target.value })
                          }
                        />
                      </CardContent>
                    </Card>
                    <Card className="border-primary/20 bg-accent/30 shadow-none">
                      <CardContent className="grid gap-3 p-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="marco-cronologico">Marco consultado</Label>
                          <Select
                            value={filtros.tipoData}
                            onValueChange={valor =>
                              setFiltros({
                                ...filtros,
                                tipoData: valor as DashboardTipoDataConsulta,
                              })
                            }
                          >
                            <SelectTrigger id="marco-cronologico">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="criacao">Criação</SelectItem>
                              <SelectItem value="alteracao">Alteração</SelectItem>
                              <SelectItem value="conclusao">Conclusão</SelectItem>
                              <SelectItem value="entrega">Entrega/envio</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="inicio-cronologico">Data inicial</Label>
                          <Input
                            id="inicio-cronologico"
                            type="date"
                            value={filtros.dataInicial ?? ''}
                            onChange={evento =>
                              setFiltros({
                                ...filtros,
                                dataInicial: evento.target.value || undefined,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fim-cronologico">Data final</Label>
                          <Input
                            id="fim-cronologico"
                            type="date"
                            value={filtros.dataFinal ?? ''}
                            onChange={evento =>
                              setFiltros({
                                ...filtros,
                                dataFinal: evento.target.value || undefined,
                              })
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <Button onClick={() => void consultar()} disabled={consultando}>
                    {consultando ? 'Consultando...' : 'Consultar'}
                  </Button>
                  {erroConsulta && <p className="text-sm text-destructive">{erroConsulta}</p>}
                  {consulta && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {consulta.total} resultado(s)
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={consulta.total === 0}
                          onClick={() => setGraficoConsultaAberto(true)}
                        >
                          Gerar gráfico
                        </Button>
                      </div>
                      {consulta.itens.length ? (
                        consulta.itens.map(item => (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => void abrirCronologia(item.id)}
                            className="flex w-full justify-between rounded border p-3 text-left hover:bg-accent"
                          >
                            <span>
                              REP {item.repNumero} · {item.tipoExameNome}
                            </span>
                            <span>
                              {item.status} · {formatarData(item.dataOrdenacao)}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                          Nenhum laudo encontrado para os filtros informados.
                        </p>
                      )}
                      {consulta.total > consulta.tamanhoPagina && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            disabled={consulta.pagina === 1}
                            onClick={() => void consultar(consulta.pagina - 1)}
                          >
                            Anterior
                          </Button>
                          <Button
                            variant="outline"
                            disabled={consulta.pagina * consulta.tamanhoPagina >= consulta.total}
                            onClick={() => void consultar(consulta.pagina + 1)}
                          >
                            Próxima
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="laudo" className="space-y-4">
                  <div className="flex gap-3 rounded-lg border border-primary/20 bg-accent/30 p-4">
                    <Input
                      placeholder="Número da REP, código ou natureza"
                      value={buscaLaudo}
                      onChange={evento => setBuscaLaudo(evento.target.value)}
                    />
                    <Button
                      disabled={!buscaLaudo.trim() || consultando}
                      onClick={() => void consultarPorLaudo()}
                    >
                      {consultando ? 'Buscando...' : 'Buscar laudo'}
                    </Button>
                    {erroConsulta && <p className="text-sm text-destructive">{erroConsulta}</p>}
                  </div>
                  {resultadoBuscaLaudo && (
                    <div className="space-y-2">
                      {resultadoBuscaLaudo.itens.length ? (
                        resultadoBuscaLaudo.itens.map(item => (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => void abrirCronologia(item.id)}
                            className="flex w-full justify-between rounded border p-3 text-left transition-colors hover:bg-accent"
                          >
                            <span>
                              REP {item.repNumero} · {item.tipoExameNome}
                            </span>
                            <span className="text-sm text-muted-foreground">{item.status}</span>
                          </button>
                        ))
                      ) : (
                        <p className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                          Nenhum laudo encontrado para esta busca.
                        </p>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              {erroCronologia && <p className="mt-3 text-sm text-destructive">{erroCronologia}</p>}
            </CardContent>
          )}
        </Card>
        <Card>
          <CardHeader className="flex min-h-[72px] flex-row items-center justify-between space-y-0 p-4 pb-2">
            <div className="space-y-0.5">
              <CardTitle className="flex gap-2">
                <Clock3 />
                Produção de laudos
              </CardTitle>
              <CardDescription>
                Ciclos em dias corridos para todo o histórico concluído.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={secoesExpandidas.producao}
              onClick={() => alternarSecao('producao')}
            >
              {secoesExpandidas.producao ? 'Recolher' : 'Expandir'}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${secoesExpandidas.producao ? 'rotate-180' : ''}`}
              />
            </Button>
          </CardHeader>
          {secoesExpandidas.producao && (
            <CardContent className="space-y-3 p-4 pt-0">
              <div className="grid gap-3 rounded-lg border border-primary/20 bg-accent/30 p-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="natureza-producao">Natureza</Label>
                  <Select
                    value={filtrosProducao.tipoExameId ?? 'todos'}
                    onValueChange={valor =>
                      setFiltrosProducao({
                        ...filtrosProducao,
                        tipoExameId: valor === 'todos' ? undefined : valor,
                      })
                    }
                  >
                    <SelectTrigger id="natureza-producao">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas as naturezas</SelectItem>
                      {naturezasProducao.map(natureza => (
                        <SelectItem key={natureza.id} value={natureza.id}>
                          {natureza.codigo ? `${natureza.codigo} — ` : ''}
                          {natureza.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inicio-producao">Conclusão inicial</Label>
                  <Input
                    id="inicio-producao"
                    type="date"
                    value={filtrosProducao.dataInicial ?? ''}
                    onChange={evento =>
                      setFiltrosProducao({
                        ...filtrosProducao,
                        dataInicial: evento.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fim-producao">Conclusão final</Label>
                  <Input
                    id="fim-producao"
                    type="date"
                    value={filtrosProducao.dataFinal ?? ''}
                    onChange={evento =>
                      setFiltrosProducao({
                        ...filtrosProducao,
                        dataFinal: evento.target.value || undefined,
                      })
                    }
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={carregandoProducao}
                    onClick={() => void carregarProducao(filtrosProducao)}
                  >
                    {carregandoProducao ? 'Consultando...' : 'Aplicar filtros'}
                  </Button>
                </div>
              </div>
              {erroProducao && <p className="text-sm text-destructive">{erroProducao}</p>}
              <div className="grid gap-3 md:grid-cols-2">
                {producao.length ? (
                  producao.map(item => (
                    <div key={item.natureza.id} className="rounded border p-4">
                      <p className="font-medium">
                        {item.natureza.codigo ? `${item.natureza.codigo} — ` : ''}
                        {item.natureza.nome}
                      </p>
                      <p className="mt-2 text-sm">
                        REP até conclusão: média {item.repAteConclusao.mediaDias.toFixed(1)} ·
                        mediana {item.repAteConclusao.medianaDias.toFixed(1)} (
                        {item.repAteConclusao.quantidade})
                      </p>
                      <p className="text-sm">
                        Laudo até conclusão: média {item.laudoAteConclusao.mediaDias.toFixed(1)} ·
                        mediana {item.laudoAteConclusao.medianaDias.toFixed(1)} (
                        {item.laudoAteConclusao.quantidade})
                      </p>
                      {item.repAteConclusao.quantidade === 1 && (
                        <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                          A amostra possui apenas um laudo.
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma amostra válida encontrada.
                  </p>
                )}
              </div>
            </CardContent>
          )}
        </Card>
        <Dialog open={graficoConsultaAberto} onOpenChange={setGraficoConsultaAberto}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Distribuição por status — {rotuloTipoData[filtros.tipoData]} ·{' '}
                {descreverPeriodo(filtros.dataInicial, filtros.dataFinal)} ({consulta?.total ?? 0}{' '}
                laudos)
              </DialogTitle>
            </DialogHeader>
            <GraficoStatus
              titulo="Resultado da consulta"
              dados={consulta?.porStatus ?? []}
              tipo={tipoGrafico}
              aoSelecionar={() => undefined}
            />
          </DialogContent>
        </Dialog>
        <Dialog open={Boolean(cronologia)} onOpenChange={aberto => !aberto && setCronologia(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cronologia — REP {cronologia?.laudo.repNumero}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {cronologia && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navegar(`/laudos/${cronologia.laudo.id}/wizard`)}
                >
                  <ExternalLink />
                  Abrir laudo
                </Button>
              )}
              {cronologia?.marcos.map(marco => (
                <div key={marco.nome}>
                  <p className="font-medium">{marco.nome}</p>
                  <p className="text-sm text-muted-foreground">{formatarData(marco.data)}</p>
                </div>
              ))}
              <div>
                <p className="font-medium">Transições auditadas</p>
                {cronologia?.transicoes.length ? (
                  cronologia.transicoes.map(evento => (
                    <p
                      key={`${evento.data}-${evento.statusNovo}`}
                      className="text-sm text-muted-foreground"
                    >
                      {formatarData(evento.data)}: {evento.statusAnterior ?? '?'} →{' '}
                      {evento.statusNovo ?? '?'}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma transição auditada utilizável.
                  </p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
