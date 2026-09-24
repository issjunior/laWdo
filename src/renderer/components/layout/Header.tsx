import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Info,
  LogOut,
  Code2,
  Mail,
  Moon,
  Sun,
  AlertCircle,
  Clock3,
  Download,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import type { EstadoAtualizacaoResposta } from '@shared/atualizacao/atualizacao.types';
import type { EstadoCapturaLogs } from '@shared/captura-logs/contratos';

interface HeaderProps {
  onLogout: () => void;
  currentUser: Record<string, unknown> | null;
}

const formatadorDataCompleta = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const nomesSondasCaptura: Record<string, string> = {
  sistema: 'Sistema',
  auditoria: 'Auditoria',
  linha_tempo: 'Linha do tempo',
  desempenho: 'Desempenho',
};

const extrairNomeUsuario = (usuario: Record<string, unknown> | null): string => {
  if (!usuario) return '';

  const nome = usuario.nome;
  if (typeof nome === 'string') {
    return nome;
  }

  const name = usuario.name;
  return typeof name === 'string' ? name : '';
};

const formatarSaudacao = (nome: string, data = new Date()): string => {
  const hora = data.getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const nomeLimpo = nome.trim() || 'Perito';
  return `${saudacao}, ${nomeLimpo} - ${formatadorDataCompleta.format(data)}`;
};

export const Header: React.FC<HeaderProps> = ({ onLogout, currentUser }) => {
  const [appInfo, setAppInfo] = useState<{
    version: string;
    name: string;
    platform: string;
    osVersion: string;
    arch: string;
    memory: string;
    dbVersion: number;
  } | null>(null);
  const [atualizacao, setAtualizacao] = useState<EstadoAtualizacaoResposta | null>(null);
  const [acaoAtualizacao, setAcaoAtualizacao] = useState<'verificar' | 'baixar' | 'adiar' | 'instalar' | 'agendar' | 'mostrar' | null>(null);
  const [confirmacaoInstalacaoAberta, setConfirmacaoInstalacaoAberta] = useState(false);
  const [capturaLogs, setCapturaLogs] = useState<EstadoCapturaLogs>({ ativa: null });
  const [agoraCaptura, setAgoraCaptura] = useState(Date.now());

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const fetchAppInfo = async () => {
      try {
        const info = await window.ipcAPI.getAppInfo();
        setAppInfo(info);
      } catch {
        // opcional
      }
    };
    fetchAppInfo();
  }, []);

  useEffect(() => {
    const api = window.ipcAPI.capturaLogs;
    if (!api) return;
    void api.estado().then(resposta => {
      if (resposta.success && resposta.data) setCapturaLogs(resposta.data);
    });
    return api.onEstadoAlterado(setCapturaLogs);
  }, []);

  useEffect(() => {
    if (!capturaLogs.ativa) return;
    const temporizador = window.setInterval(() => setAgoraCaptura(Date.now()), 1_000);
    return () => window.clearInterval(temporizador);
  }, [capturaLogs.ativa]);

  const atualizarEstadoAtualizacao = async (manual = false) => {
    const api = window.ipcAPI.atualizacao;
    if (!api) return;
    const resposta = manual ? await api.verificar() : await api.estado();
    setAtualizacao({ ...resposta.data, falha: resposta.falha ?? resposta.data.falha });
    if (manual && !resposta.success && resposta.falha) toast.error(resposta.falha.mensagem);
  };

  useEffect(() => {
    void atualizarEstadoAtualizacao();
    const intervalo = window.setInterval(() => void atualizarEstadoAtualizacao(), 30_000);
    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    const api = window.ipcAPI.atualizacao;
    if (!api) return;
    return api.onProgresso(progresso => {
      setAtualizacao(atual => atual ? { ...atual, progresso: progresso.percentual, progressoDetalhado: progresso } : atual);
    });
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  const saudacao = formatarSaudacao(extrairNomeUsuario(currentUser));
  const atualizacaoDisponivel = atualizacao?.estado === 'disponivel' || atualizacao?.estado === 'baixando' || atualizacao?.estado === 'baixada' || atualizacao?.estado === 'aguardando_reinicio';
  const dadosAtualizacao = atualizacao?.atualizacaoDisponivel;
  const progressoAtualizacao = atualizacao?.progressoDetalhado;
  const falhaAtualizacao = atualizacao?.falha;
  const restanteCaptura = capturaLogs.ativa ? Math.max(0, Math.ceil((Date.parse(capturaLogs.ativa.terminaEm) - agoraCaptura) / 1_000)) : null;

  const formatarPacote = () => {
    if (!dadosAtualizacao) return '';
    const plataforma = {
      windows: 'Windows',
      linux: 'Linux',
      macos: 'macOS',
    }[dadosAtualizacao.artefato.plataforma];
    return `${plataforma} ${dadosAtualizacao.artefato.arquitetura} · ${(dadosAtualizacao.artefato.tamanho / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
  };

  const executarAcaoAtualizacao = async (acao: 'verificar' | 'baixar' | 'adiar' | 'instalar' | 'agendar') => {
    const api = window.ipcAPI.atualizacao;
    if (!api) {
      toast.error('Atualizações não estão disponíveis neste ambiente.');
      return;
    }
    setAcaoAtualizacao(acao);
    try {
      const resposta = acao === 'verificar' ? await api.verificar()
        : acao === 'baixar' ? await api.baixar()
          : acao === 'instalar' ? await api.instalarAgora()
            : acao === 'agendar' ? await api.agendar()
              : await api.adiar();
      setAtualizacao({ ...resposta.data, falha: resposta.falha ?? resposta.data.falha });
      if (!resposta.success) toast.error((resposta.falha ?? resposta.data.falha)?.mensagem || 'Não foi possível concluir a atualização.');
      if (resposta.success && acao === 'baixar' && resposta.data.estado === 'baixada') toast.success('Atualização baixada e validada.');
      if (resposta.success && acao === 'agendar') toast.success('Instalação agendada para a próxima inicialização.');
    } catch {
      toast.error('Não foi possível concluir a atualização.');
    } finally {
      setAcaoAtualizacao(null);
    }
  };

  const mostrarPacoteAtualizacao = async () => {
    const api = window.ipcAPI.atualizacao;
    if (!api) return;
    setAcaoAtualizacao('mostrar');
    try {
      const resposta = await api.mostrarPacote();
      if (!resposta.success) toast.error('Não foi possível localizar o pacote de atualização.');
    } catch {
      toast.error('Não foi possível abrir a pasta do instalador.');
    } finally {
      setAcaoAtualizacao(null);
    }
  };

  const copiarDetalhesFalha = async () => {
    if (!falhaAtualizacao) return;
    const detalhes = [
      `Código: ${falhaAtualizacao.codigo}`,
      `Etapa: ${falhaAtualizacao.etapa}`,
      `Ocorrido em: ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(falhaAtualizacao.ocorridoEm))}`,
      `Versão do laWdo: v${appInfo?.version ?? atualizacao?.versaoInstalada ?? 'não identificada'}`,
      `Detalhe técnico: ${falhaAtualizacao.detalheTecnico}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(detalhes);
      toast.success('Detalhes do erro copiados.');
    } catch {
      toast.error('Não foi possível copiar os detalhes do erro.');
    }
  };

  return (
    <header className="barra-titulo-janela flex h-11 shrink-0 items-center border-b border-sidebar-border bg-sidebar px-3 pr-[148px] text-sidebar-foreground">
      <div className="flex w-full min-w-0 items-center">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="-ml-1 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {saudacao}
          </p>
        </div>
        
        <div className="ml-auto flex items-center gap-2">
          {capturaLogs.ativa && <div className="flex max-w-[430px] items-center gap-2 rounded-md bg-amber-500/15 px-2 py-1 text-xs">
            <Clock3 className="h-4 w-4 text-amber-600" />
            <span className="truncate">Captura: {capturaLogs.ativa.sondas.map(sonda => nomesSondasCaptura[sonda] ?? sonda).join(', ')} · {Math.floor((restanteCaptura ?? 0) / 60)}m {(restanteCaptura ?? 0) % 60}s</span>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={async () => {
              const resposta = await window.ipcAPI.capturaLogs.parar();
              if (!resposta.success) toast.error(resposta.error || 'Não foi possível encerrar a captura.');
              else toast.success('Captura encerrada e preservada.');
            }}>Parar</Button>
          </div>}
          {/* Escolha de Tema */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            className="text-sidebar-foreground transition-transform duration-300 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            title={isDarkMode ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            {isDarkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* Informações do aplicativo */}
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-md p-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                title="Informações"
                aria-label="Informações"
              >
                <Info size={18} />
                <span className="hidden lg:inline font-medium">Informações</span>
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Informações
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {appInfo ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Nome da Aplicação</span>
                      <span className="text-sm font-bold">laWdo</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Versão Sistema</span>
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">v{appInfo.version}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Versão Banco de Dados</span>
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">v{appInfo.dbVersion}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Ambiente</span>
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600 capitalize">
                        {import.meta.env.DEV ? 'Desenvolvimento' : 'Produção'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">Edição do SO</span>
                      <span className="text-xs font-semibold">{appInfo.osVersion} ({appInfo.arch})</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Memória RAM</span>
                      <span className="text-xs font-semibold">{appInfo.memory}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    Carregando...
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-border">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Canais de Contato</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <a
                      href="https://github.com/issjunior/laWdo"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors group"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20">
                        <Code2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">Repositório GitHub</span>
                        <span className="text-[10px] text-muted-foreground">issjunior/laWdo</span>
                      </div>
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('izaias.santos@policiacientifica.pr.gov.br');
                        toast.success('Email copiado!');
                      }}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors group cursor-pointer w-full text-left"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20">
                        <Mail className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">Dúvidas e sugestões</span>
                        <span className="text-[10px] text-muted-foreground">izaias.santos@policiacientifica.pr.gov.br</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-primary/5 p-3 border border-primary/10">
                  <p className="text-[10px] text-center text-muted-foreground italic">
                    Sistema desenvolvido para automatização de laudos periciais.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Atualizações do aplicativo */}
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="flex items-center gap-2 rounded-md p-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                title={dadosAtualizacao ? `Nova versão disponível: v${dadosAtualizacao.versao}` : 'Atualizações'}
                aria-label={dadosAtualizacao ? `Atualizações. Nova versão disponível: ${dadosAtualizacao.versao}` : 'Atualizações'}
              >
                <Download size={18} className={atualizacaoDisponivel ? 'text-emerald-300' : undefined} />
                {atualizacaoDisponivel && <span className="font-medium">Atualização</span>}
                {atualizacaoDisponivel && <Badge className="bg-emerald-600 hover:bg-emerald-600">Nova versão</Badge>}
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" />
                  Atualizações
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {dadosAtualizacao && (
                  <div className="rounded-lg border border-primary/25 bg-primary/10 p-4" aria-live="polite">
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Nova versão disponível</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Versão atual</p>
                        <p className="font-semibold">v{appInfo?.version ?? atualizacao?.versaoInstalada}</p>
                      </div>
                      <span className="text-lg font-semibold text-primary" aria-hidden="true">→</span>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Nova versão</p>
                        <p className="text-lg font-bold text-primary">v{dadosAtualizacao.versao}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">O laWdo criará um backup, fechará com segurança e abrirá o instalador. O processo costuma levar alguns minutos.</p>
                  </div>
                )}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-muted-foreground">Versão atual do laWdo</span>
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600">{appInfo ? `v${appInfo.version}` : 'Carregando...'}</Badge>
                  </div>
                  {atualizacao?.verificadoEm && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-muted-foreground">Última verificação</span>
                      <span className="text-xs font-semibold">
                        {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(atualizacao.verificadoEm))}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
                    <span className="text-sm font-medium text-muted-foreground">Status</span>
                    {falhaAtualizacao ? (
                      <Badge variant="destructive">Falha na atualização</Badge>
                    ) : dadosAtualizacao ? (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">Atualização disponível</Badge>
                    ) : (
                      <span className="text-xs font-semibold">Nenhuma atualização disponível</span>
                    )}
                  </div>
                </div>
                {dadosAtualizacao && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Detalhes da atualização</h4>
                    <div className="space-y-2 text-xs text-muted-foreground">
                    <p><span className="font-medium text-foreground">Versão que será instalada:</span> v{dadosAtualizacao.versao}</p>
                    <p><span className="font-medium text-foreground">Publicada:</span> {new Intl.DateTimeFormat('pt-BR').format(new Date(dadosAtualizacao.dataPublicacao))}</p>
                    <p><span className="font-medium text-foreground">Sistema:</span> {formatarPacote()}</p>
                    <Collapsible>
                      <CollapsibleTrigger className="text-left font-medium text-foreground underline underline-offset-2">Ver notas desta versão</CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 whitespace-pre-wrap">{dadosAtualizacao.notas}</CollapsibleContent>
                    </Collapsible>
                    </div>
                  </div>
                )}
                {falhaAtualizacao && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Não foi possível concluir a atualização</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>{falhaAtualizacao.mensagem}</p>
                      <Collapsible>
                        <CollapsibleTrigger className="text-xs font-medium underline underline-offset-2">Ver detalhes técnicos</CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 space-y-2 rounded-md bg-destructive/10 p-2 text-xs">
                          <p><span className="font-medium">Código:</span> {falhaAtualizacao.codigo}</p>
                          <p><span className="font-medium">Etapa:</span> {falhaAtualizacao.etapa}</p>
                          <p><span className="font-medium">Detalhe:</span> {falhaAtualizacao.detalheTecnico}</p>
                          <Button type="button" size="sm" variant="outline" className="h-7" onClick={() => void copiarDetalhesFalha()}>
                            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar detalhes
                          </Button>
                        </CollapsibleContent>
                      </Collapsible>
                    </AlertDescription>
                  </Alert>
                )}
                {progressoAtualizacao && ['verificando', 'baixando', 'instalando', 'aguardando_reinicio'].includes(atualizacao?.estado ?? '') && (
                  <div className="space-y-2 rounded-lg border border-primary/15 bg-primary/5 p-3" aria-live="polite">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-foreground">{progressoAtualizacao.descricao}</span>
                      <span className="font-semibold tabular-nums text-primary">{progressoAtualizacao.percentual}%</span>
                    </div>
                    <Progress value={progressoAtualizacao.percentual} aria-label={progressoAtualizacao.descricao} />
                  </div>
                )}
                {atualizacao?.estado === 'baixada' && <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300"><Download className="h-3.5 w-3.5" />Pacote validado. O backup será criado antes da instalação.</p>}
                {atualizacao?.estado === 'aguardando_reinicio' && <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300"><Clock3 className="h-3.5 w-3.5" />Instalação agendada. Na próxima abertura, o laWdo validará o pacote e criará o backup antes de iniciar o instalador.</p>}
                <div className="space-y-2 pt-2 border-t border-border">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Ações</h4>
                  <div className="grid grid-cols-1 gap-2">
                    <Button size="sm" variant="outline" className="w-full" onClick={() => void executarAcaoAtualizacao('verificar')} disabled={acaoAtualizacao !== null || atualizacao?.estado === 'baixando'}>
                      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${acaoAtualizacao === 'verificar' ? 'animate-spin' : ''}`} /> Verificar atualizações
                    </Button>
                    {falhaAtualizacao?.acaoSugerida === 'baixar' && (
                      <Button size="sm" className="w-full" onClick={() => void executarAcaoAtualizacao('baixar')} disabled={acaoAtualizacao !== null}>
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Tentar baixar novamente
                      </Button>
                    )}
                    {falhaAtualizacao?.acaoSugerida === 'instalar' && (
                      <Button size="sm" className="w-full" onClick={() => setConfirmacaoInstalacaoAberta(true)} disabled={acaoAtualizacao !== null}>
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Tentar instalar novamente
                      </Button>
                    )}
                    {falhaAtualizacao?.acaoSugerida === 'instalar' && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => void mostrarPacoteAtualizacao()} disabled={acaoAtualizacao !== null}>
                        Abrir pasta do instalador
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {atualizacao?.estado === 'disponivel' && <Button size="sm" className="w-full" onClick={() => void executarAcaoAtualizacao('baixar')} disabled={acaoAtualizacao !== null}>
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar agora
                    </Button>}
                    {atualizacao?.estado === 'baixada' && <Button size="sm" className="w-full" onClick={() => setConfirmacaoInstalacaoAberta(true)} disabled={acaoAtualizacao !== null}>
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Reiniciar e instalar
                    </Button>}
                    {atualizacao?.estado === 'baixada' && (dadosAtualizacao?.artefato.formato === 'nsis' || dadosAtualizacao?.artefato.formato === 'AppImage') && <Button size="sm" variant="outline" className="w-full" onClick={() => void executarAcaoAtualizacao('agendar')} disabled={acaoAtualizacao !== null}>
                      <Clock3 className="mr-1.5 h-3.5 w-3.5" /> Instalar na próxima inicialização
                    </Button>}
                    {dadosAtualizacao && atualizacao?.estado !== 'baixada' && <Button size="sm" variant="ghost" className="w-full" onClick={() => void executarAcaoAtualizacao('adiar')} disabled={acaoAtualizacao !== null}>
                      <Clock3 className="mr-1.5 h-3.5 w-3.5" /> Lembrar depois
                    </Button>}
                  </div>
                </div>
                <div className="rounded-lg bg-primary/5 p-3 border border-primary/10">
                  <p className="text-[10px] text-center text-muted-foreground italic">
                    As atualizações são verificadas sem enviar dados pessoais.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <AlertDialog open={confirmacaoInstalacaoAberta} onOpenChange={setConfirmacaoInstalacaoAberta}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reiniciar e instalar a atualização?</AlertDialogTitle>
                <AlertDialogDescription>
                  O laWdo criará um backup, fechará todas as janelas com segurança e abrirá o instalador para atualizar de v{appInfo?.version ?? atualizacao?.versaoInstalada} para v{dadosAtualizacao?.versao}. Ao terminar, o instalador reabrirá o laWdo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={acaoAtualizacao !== null}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => { setConfirmacaoInstalacaoAberta(false); void executarAcaoAtualizacao('instalar'); }} disabled={acaoAtualizacao !== null}>Reiniciar e instalar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <button 
            onClick={onLogout} 
            className="flex items-center gap-2 rounded-md p-2 text-sm transition-colors hover:bg-destructive/20 hover:text-destructive-foreground"
            title="Logout"
          >
            <LogOut size={18} />
            <span className="hidden lg:inline font-medium">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
