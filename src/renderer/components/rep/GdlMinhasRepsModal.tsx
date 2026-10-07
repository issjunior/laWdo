import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { CalendarDays, Camera, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GdlConsultaEmAndamento } from '@/components/rep/GdlConsultaEmAndamento';
import { GdlFalhaListaAlert, normalizarFalhaListaGdl } from '@/components/rep/GdlFalhaListaAlert';
import type { FalhaListaGdlApresentavel } from '@/components/rep/GdlFalhaListaAlert';
import { classesStatusRepGdl, GdlStatusBadge } from '@/components/rep/GdlStatusBadge';
import type { MinhaRepGdl, StatusMinhaRepGdl } from '@shared/types/gdl-minhas-reps.types';

const statusDisponiveis: StatusMinhaRepGdl[] = [
  'Aberta e Distribuída',
  'Laudo em Execução',
  'Concluída e Não Remetida',
];

const esquemaSnapshot = z.object({
  reps: z.array(
    z.object({
      idGdl: z.number().int().positive(),
      numero: z.string().regex(/^\d+$/),
      ano: z.string().regex(/^\d{4}$/),
      naturezaExame: z.string().min(1),
      naturezaExameComCodigo: z.string().min(1).nullable(),
      status: z.enum(statusDisponiveis),
      dataDesignacao: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
        .nullable(),
      quantidadeFotos: z.number().int().nonnegative().nullable(),
    })
  ),
  atualizadoEm: z.string().datetime(),
});

function formatarNumeroRep(rep: MinhaRepGdl): string {
  return `${rep.numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}/${rep.ano}`;
}

function formatarDataDesignacao(data: string): string {
  return `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)} ${data.slice(11, 16)}`;
}

function naturezaExibida(rep: MinhaRepGdl): string {
  return rep.naturezaExameComCodigo ?? rep.naturezaExame;
}

interface GdlMinhasRepsModalProps {
  open: boolean;
  onOpenChange: (aberto: boolean) => void;
  onSelecionar: (rep: MinhaRepGdl) => void;
  onConfigurarCredenciais: () => void;
}

export const GdlMinhasRepsModal: React.FC<GdlMinhasRepsModalProps> = ({
  open,
  onOpenChange,
  onSelecionar,
  onConfigurarCredenciais,
}) => {
  const [reps, setReps] = useState<MinhaRepGdl[] | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<FalhaListaGdlApresentavel | null>(null);
  const [statusFiltro, setStatusFiltro] = useState<StatusMinhaRepGdl | 'todos'>('todos');
  const [naturezaFiltro, setNaturezaFiltro] = useState('todos');
  const [dataInicial, setDataInicial] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const geracaoCarga = useRef(0);

  const carregarTodas = useCallback(async (forcar = false) => {
    const geracao = ++geracaoCarga.current;
    setCarregando(true);
    if (!forcar) {
      setReps(null);
      setAtualizadoEm(null);
    }
    setSelecionada(null);
    setErro(null);
    try {
      if (!forcar) {
        const cache = await window.ipcAPI.gdl.obterMinhasRepsCache();
        if (geracao !== geracaoCarga.current) return;
        const validacaoCache = esquemaSnapshot.safeParse(cache.data);
        if (cache.success && validacaoCache.success) {
          setReps(validacaoCache.data.reps);
          setAtualizadoEm(validacaoCache.data.atualizadoEm);
        }
      }
      const resposta = await window.ipcAPI.gdl.atualizarMinhasRepsCache(forcar);
      if (geracao !== geracaoCarga.current) return;
      if (!resposta.success) {
        setErro(normalizarFalhaListaGdl(resposta));
        return;
      }
      const validacao = esquemaSnapshot.safeParse(resposta.data);
      if (!validacao.success) {
        window.ipcAPI.logError('gdl', 'Lista de REPs do GDL inválida no diálogo', {
          campos: validacao.error.issues.map(ocorrencia => ocorrencia.path.join('.')),
        });
        setErro({ codigo: 'estrutura', detalhes: 'A resposta da lista não corresponde ao formato esperado pelo laWdo.' });
        return;
      }
      setReps(validacao.data.reps);
      setAtualizadoEm(validacao.data.atualizadoEm);
    } catch (falha: unknown) {
      if (geracao === geracaoCarga.current) {
        window.ipcAPI.logError('gdl', 'Falha inesperada ao atualizar a lista no diálogo', {
          tipoErro: falha instanceof Error ? falha.name : 'Erro desconhecido',
        });
        setErro({
          codigo: 'inesperado',
          detalhes: 'A interface não conseguiu concluir a atualização da lista. Consulte o log do aplicativo.',
        });
      }
    } finally {
      if (geracao === geracaoCarga.current) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setStatusFiltro('todos');
    setNaturezaFiltro('todos');
    setDataInicial('');
    setDataFinal('');
    void carregarTodas();
    return () => {
      geracaoCarga.current += 1;
    };
  }, [open, carregarTodas]);

  const naturezas = useMemo(
    () =>
      [...new Set(reps?.map(naturezaExibida) ?? [])].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [reps]
  );
  const intervaloInvalido = Boolean(dataInicial && dataFinal && dataInicial > dataFinal);
  const repsFiltradas = useMemo(
    () =>
      (reps ?? []).filter(rep => {
        if (intervaloInvalido) return false;
        if (statusFiltro !== 'todos' && rep.status !== statusFiltro) return false;
        if (naturezaFiltro !== 'todos' && naturezaExibida(rep) !== naturezaFiltro) return false;
        const dia = rep.dataDesignacao?.slice(0, 10);
        if (dataInicial && (!dia || dia < dataInicial)) return false;
        if (dataFinal && (!dia || dia > dataFinal)) return false;
        return true;
      }),
    [reps, statusFiltro, naturezaFiltro, dataInicial, dataFinal, intervaloInvalido]
  );
  const repSelecionada = repsFiltradas.find(rep => `${rep.numero}/${rep.ano}` === selecionada);
  const filtrosAtivos =
    statusFiltro !== 'todos' || naturezaFiltro !== 'todos' || Boolean(dataInicial || dataFinal);

  const limparFiltros = () => {
    setStatusFiltro('todos');
    setNaturezaFiltro('todos');
    setDataInicial('');
    setDataFinal('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-h-[800px] w-[calc(100vw-2rem)] max-w-4xl flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0 pr-6">
          <DialogTitle>Listar REPs do GDL</DialogTitle>
          <DialogDescription className="sr-only">
            Selecione uma REP para continuar no importador do GDL.
          </DialogDescription>
        </DialogHeader>
        {erro && <GdlFalhaListaAlert falha={erro} listaSalva={Boolean(reps)}
          onTentarNovamente={() => void carregarTodas(true)} onConfigurarCredenciais={onConfigurarCredenciais} />}
        <div className="shrink-0 space-y-3 border-b pb-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]">
            <div className="min-w-0">
              <Label className="mb-1 block text-xs" htmlFor="filtro-status-rep">
                Status
              </Label>
              <Select
                value={statusFiltro}
                onValueChange={valor => {
                  setStatusFiltro(statusDisponiveis.find(status => status === valor) ?? 'todos');
                  setSelecionada(null);
                }}
                disabled={!reps}
              >
                <SelectTrigger
                  id="filtro-status-rep"
                  className="h-9 min-w-0 overflow-hidden [&>span]:min-w-0 [&>span]:flex-1 [&>span]:text-left [&>svg]:shrink-0"
                >
                  <SelectValue>
                    {statusFiltro === 'todos' ? (
                      'Todos os status'
                    ) : (
                      <span
                        className={`block max-w-full truncate whitespace-nowrap rounded-md border px-2 py-0.5 ${classesStatusRepGdl[statusFiltro]}`}
                      >
                        {statusFiltro}
                      </span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {statusDisponiveis.map(status => (
                    <SelectItem key={status} value={status}>
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 ${classesStatusRepGdl[status]}`}
                      >
                        {status}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0">
              <Label
                className="mb-1 flex items-center gap-1.5 text-xs"
                htmlFor="filtro-natureza-rep"
              >
                Tipo de exame
              </Label>
              <Select
                value={naturezaFiltro}
                onValueChange={valor => {
                  setNaturezaFiltro(valor);
                  setSelecionada(null);
                }}
                disabled={!reps}
              >
                <SelectTrigger id="filtro-natureza-rep" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os exames</SelectItem>
                  {naturezas.map(natureza => (
                    <SelectItem key={natureza} value={natureza}>
                      {natureza}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-1 lg:flex-nowrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={dataInicial || dataFinal ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-9 whitespace-nowrap"
                    disabled={!reps}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" /> Data da designação
                    {dataInicial || dataFinal ? ' · ativa' : ''}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 space-y-3">
                  <div>
                    <Label htmlFor="rep-data-inicial">De</Label>
                    <Input
                      id="rep-data-inicial"
                      type="date"
                      value={dataInicial}
                      onChange={evento => {
                        setDataInicial(evento.target.value);
                        setSelecionada(null);
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rep-data-final">Até</Label>
                    <Input
                      id="rep-data-final"
                      type="date"
                      value={dataFinal}
                      onChange={evento => {
                        setDataFinal(evento.target.value);
                        setSelecionada(null);
                      }}
                    />
                  </div>
                  {intervaloInvalido && (
                    <p className="text-xs text-destructive">
                      A data inicial deve ser anterior ou igual à final.
                    </p>
                  )}
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="sm"
                className="h-9 whitespace-nowrap disabled:opacity-70"
                onClick={limparFiltros}
                disabled={!filtrosAtivos}
              >
                Limpar filtros
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 whitespace-nowrap"
                onClick={() => void carregarTodas(true)}
                disabled={carregando}
                title="Atualizar lista"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span aria-live="polite">
              {reps ? `${repsFiltradas.length} de ${reps.length} REPs` : '— REPs'}
              {atualizadoEm &&
                ` · Atualizado em ${new Date(atualizadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
            </span>
            {carregando && <GdlConsultaEmAndamento />}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
          {carregando && !reps ? (
            <div className="flex h-full min-h-40 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Aguardando a resposta do GDL...
            </div>
          ) : reps && repsFiltradas.length > 0 ? (
            <div role="radiogroup" aria-label="Selecionar REP do GDL" className="divide-y">
              {repsFiltradas.map(rep => {
                const chave = `${rep.numero}/${rep.ano}`;
                return (
                  <label
                    key={chave}
                    className="flex cursor-pointer items-start gap-3 p-3 hover:bg-accent/50 has-[:checked]:bg-accent/70"
                  >
                    <input
                      type="radio"
                      name="rep-gdl-selecionada"
                      value={chave}
                      checked={selecionada === chave}
                      onChange={() => setSelecionada(chave)}
                      className="mt-1 accent-primary"
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">REP {formatarNumeroRep(rep)}</span>
                        <GdlStatusBadge status={rep.status} />
                      </span>
                      <span
                        className="mt-1 block truncate text-muted-foreground"
                        title={naturezaExibida(rep)}
                      >
                        {naturezaExibida(rep)}
                      </span>
                      {(rep.dataDesignacao || (rep.quantidadeFotos ?? 0) > 0) && (
                        <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {rep.dataDesignacao && (
                            <span>Designação: {formatarDataDesignacao(rep.dataDesignacao)}</span>
                          )}
                          {(rep.quantidadeFotos ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Camera className="h-3.5 w-3.5" />
                              {rep.quantidadeFotos} fotos
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : reps ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {reps.length === 0
                ? 'Nenhuma REP com os status indicados foi encontrada.'
                : 'Nenhuma REP corresponde aos filtros.'}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!repSelecionada}
            onClick={() => {
              if (repSelecionada) onSelecionar(repSelecionada);
            }}
          >
            Importar selecionada
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
