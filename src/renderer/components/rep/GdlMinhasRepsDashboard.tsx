import { ReiterandoBadge } from '@/components/ui/reiterando-badge';
import { useConsultarRepReiterando } from '@/contexts/AvisosReiteracaoContext';
import { apresentarNaturezaExame } from '@shared/gdl/natureza-exame';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data-table/data-table';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import type { DefinicaoColunaTabela } from '@/components/data-table/data-table-features';
import { GdlConsultaEmAndamento } from '@/components/rep/GdlConsultaEmAndamento';
import { GdlListagemPreferenciaAlert } from '@/components/rep/GdlListagemPreferenciaAlert';
import { GdlFalhaListaAlert, normalizarFalhaListaGdl } from '@/components/rep/GdlFalhaListaAlert';
import type { FalhaListaGdlApresentavel } from '@/components/rep/GdlFalhaListaAlert';
import { GdlStatusBadge } from '@/components/rep/GdlStatusBadge';
import type { MinhaRepGdl, SnapshotMinhasRepsGdl, StatusMinhaRepGdl } from '@shared/types/gdl-minhas-reps.types';
import { cacheListagemDesativadaDisponivel, VALIDADE_CACHE_LISTAGEM_DESATIVADA_MS } from '@shared/gdl/listagem';

const statusDisponiveis: StatusMinhaRepGdl[] = ['Aberta e Distribuída', 'Laudo em Execução', 'Concluída e Não Remetida'];
const esquemaSnapshot = z.object({
  atualizadoEm: z.string().datetime(),
  reps: z.array(z.object({
    idGdl: z.number().int().positive(), numero: z.string().regex(/^\d+$/), ano: z.string().regex(/^\d{4}$/),
    naturezaExame: z.string().min(1), naturezaExameComCodigo: z.string().min(1).nullable(),
    status: z.enum(statusDisponiveis), dataDesignacao: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(),
    quantidadeFotos: z.number().int().nonnegative().nullable(),
      oficioReiterando: z.boolean().optional(),
      naturezaConfirmada: z.boolean().optional(), naturezaDivergente: z.boolean().optional(),
      naturezaConsultadaEm: z.string().optional(), statusNecessitaAtualizacao: z.boolean().optional(),
  })),
});

function formatarData(valor: string | null): string {
  if (!valor) return 'Não informada';
  return `${valor.slice(8, 10)}/${valor.slice(5, 7)}/${valor.slice(0, 4)} • ${valor.slice(11, 16)}`;
}

export function GdlMinhasRepsDashboard() {
  const navegar = useNavigate();
  const consultarReiterando = useConsultarRepReiterando();
  const [snapshot, setSnapshot] = useState<SnapshotMinhasRepsGdl | null>(null);
  const [listagemHabilitada, setListagemHabilitada] = useState<boolean | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const [tentativaBloqueada, setTentativaBloqueada] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const consultaEmAndamento = useRef(false);
  const [erro, setErro] = useState<FalhaListaGdlApresentavel | null>(null);
  const [destinoControleColunas, setDestinoControleColunas] = useState<HTMLDivElement | null>(null);

  const atualizar = useCallback(async (forcar: boolean, habilitada: boolean) => {
    if (!habilitada) {
      setTentativaBloqueada(true);
      return;
    }
    if (consultaEmAndamento.current) return;
    consultaEmAndamento.current = true;
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await window.ipcAPI.gdl.atualizarMinhasRepsCache(forcar);
      if (!resposta.success) {
        const falha = normalizarFalhaListaGdl(resposta);
        setErro(falha);
        if (falha.codigo === 'desativada') setListagemHabilitada(false);
        return;
      }
      const validacao = esquemaSnapshot.safeParse(resposta.data);
      if (!validacao.success) {
        window.ipcAPI.logError('gdl', 'Lista de REPs do GDL inválida no Dashboard', {
          campos: validacao.error.issues.map(ocorrencia => ocorrencia.path.join('.')),
        });
        setErro({ codigo: 'estrutura', detalhes: 'A resposta da lista não corresponde ao formato esperado pelo laWdo.' });
        return;
      }
      setSnapshot(validacao.data);
    } catch (falha: unknown) {
      window.ipcAPI.logError('gdl', 'Falha inesperada ao atualizar a lista no Dashboard', {
        tipoErro: falha instanceof Error ? falha.name : 'Erro desconhecido',
      });
      setErro({
        codigo: 'inesperado',
        detalhes: 'A interface não conseguiu concluir a atualização da lista. Consulte o log do aplicativo.',
      });
    } finally {
      consultaEmAndamento.current = false;
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    let revisao = 0;
    const atualizarLocal = () => {
      const atual = ++revisao;
      void Promise.all([window.ipcAPI.gdl.obterPreferenciaListagem(), window.ipcAPI.gdl.obterMinhasRepsCache()]).then(([preferencia, resposta]) => {
        if (!ativo || atual !== revisao) return;
        setListagemHabilitada(preferencia.success && preferencia.data?.habilitada === true);
        const validacao = esquemaSnapshot.safeParse(resposta.data);
        setSnapshot(resposta.success && validacao.success ? validacao.data : null);
        setAgora(Date.now());
      }).catch(() => { if (ativo && atual === revisao) setListagemHabilitada(false); });
    };
    const remover = window.ipcAPI.gdl.onAvisosAlterados(atualizarLocal);
    window.addEventListener('focus', atualizarLocal);
    atualizarLocal();
    return () => { ativo = false; remover(); window.removeEventListener('focus', atualizarLocal); };
  }, []);

  useEffect(() => {
    if (listagemHabilitada !== false || !snapshot) return;
    const restante = Date.parse(snapshot.atualizadoEm) + VALIDADE_CACHE_LISTAGEM_DESATIVADA_MS - Date.now();
    if (restante <= 0) return;
    const temporizador = setTimeout(() => setAgora(Date.now()), restante);
    return () => clearTimeout(temporizador);
  }, [listagemHabilitada, snapshot]);

  const snapshotExibido = snapshot && (listagemHabilitada || cacheListagemDesativadaDisponivel(snapshot.atualizadoEm, Math.max(agora, Date.now()))) ? snapshot : null;
  const repsExibidas = useMemo(() => snapshotExibido?.reps.map(rep => ({
    ...rep,
    oficioReiterando: rep.oficioReiterando ?? consultarReiterando(`${rep.numero}/${rep.ano}`),
  })) ?? [], [snapshotExibido, consultarReiterando]);

  const selecionar = useCallback((rep: MinhaRepGdl) => {
    navegar('/reps', { state: { importarGdl: { numero: rep.numero, ano: rep.ano, naturezaExame: rep.naturezaExame } } });
  }, [navegar]);

  const colunas = useMemo<DefinicaoColunaTabela<MinhaRepGdl>[]>(() => [
    {
      id: 'numeroRep',
      enableHiding: false,
      accessorFn: rep => `${rep.ano}/${rep.numero.padStart(12, '0')}`,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Nº REP" />,
      cell: ({ row }) => <div className="flex min-w-36 max-w-72 flex-wrap items-center gap-x-2 gap-y-1">
        <Button variant="link" className="h-auto min-w-32 justify-start p-0 font-semibold" onClick={() => selecionar(row.original)}>
          {row.original.numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}/{row.original.ano}
        </Button>
        <ReiterandoBadge juntoNumero numeroRep={`${row.original.numero}/${row.original.ano}`} reiterando={row.original.oficioReiterando} />
      </div>,
    },
    {
      id: 'natureza',
      accessorFn: rep => rep.naturezaExameComCodigo ?? apresentarNaturezaExame(rep.naturezaExame),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Natureza do Exame" />,
      cell: ({ row }) => <div>{row.original.naturezaExameComCodigo ?? apresentarNaturezaExame(row.original.naturezaExame)}{row.original.naturezaDivergente && <p className="mt-1 text-xs text-muted-foreground">Natureza divergente; confirme na consulta individual.</p>}</div>,
    },
    {
      accessorKey: 'dataDesignacao',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Data de designação" />,
      cell: ({ row }) => formatarData(row.original.dataDesignacao),
    },
    {
      id: 'fotos',
      accessorFn: rep => rep.quantidadeFotos ?? -1,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fotos" />,
      cell: ({ row }) => `${row.original.quantidadeFotos ?? '—'} fotos`,
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => <div><GdlStatusBadge status={row.original.status} />{row.original.statusNecessitaAtualizacao && <p className="mt-1 text-xs text-muted-foreground">Atualize a lista para conferir o status.</p>}</div>,
    },
  ], [selecionar]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          {snapshotExibido ? <>
            <Badge variant="secondary" className="text-sm">
              {snapshotExibido.reps.length} {snapshotExibido.reps.length === 1 ? 'REP' : 'REPs'}
            </Badge>
            <span>Atualizado em {new Date(snapshotExibido.atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </> : <span>Nenhuma lista recente</span>}
          {carregando && <GdlConsultaEmAndamento />}
        </div>
        <div ref={setDestinoControleColunas} className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={carregando || listagemHabilitada === null} onClick={() => void atualizar(true, listagemHabilitada === true)}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
        </div>
      </div>
      {listagemHabilitada === false && <GdlListagemPreferenciaAlert habilitada={false} cacheVisivel={Boolean(snapshotExibido)}
        tentativaBloqueada={tentativaBloqueada} onAbrirConfiguracao={() => navegar('/gdl-config', { state: { focarListagemGdl: true } })} />}
      {erro && <GdlFalhaListaAlert falha={erro} listaSalva={Boolean(snapshotExibido)}
        onTentarNovamente={() => void atualizar(true, listagemHabilitada === true)} onConfigurarCredenciais={() => navegar('/gdl-config')} />}
      {snapshotExibido ? <DataTable columns={colunas} data={repsExibidas} hideSearch destinoControleColunas={destinoControleColunas}
        chavePreferencias="dashboard_gdl_disposicao"
        densidade="compacta" preencherAltura fixarPrimeiraColuna
        defaultSorting={[{ id: 'dataDesignacao', desc: true }]} />
        : !carregando && listagemHabilitada && <p className="rounded-md border p-5 text-center text-sm text-muted-foreground">Nenhuma lista disponível. Use Atualizar para tentar novamente.</p>}
    </div>
  );
}
