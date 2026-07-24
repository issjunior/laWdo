import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';
import { toast } from 'sonner';
import type { EstadoAtualizacaoResposta } from '@shared/atualizacao/atualizacao.types';

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
  const [acaoAtualizacao, setAcaoAtualizacao] = useState<'verificar' | 'baixar' | 'adiar' | 'instalar' | 'agendar' | 'offline' | null>(null);

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

  const atualizarEstadoAtualizacao = async (manual = false) => {
    const api = window.ipcAPI.atualizacao;
    if (!api) return;
    const resposta = manual ? await api.verificar() : await api.estado();
    setAtualizacao(resposta.data);
    if (!resposta.success && resposta.error) toast.error(resposta.error);
  };

  useEffect(() => {
    void atualizarEstadoAtualizacao();
    const intervalo = window.setInterval(() => void atualizarEstadoAtualizacao(), 30_000);
    return () => window.clearInterval(intervalo);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  const saudacao = formatarSaudacao(extrairNomeUsuario(currentUser));
  const atualizacaoDisponivel = atualizacao?.estado === 'disponivel' || atualizacao?.estado === 'baixando' || atualizacao?.estado === 'baixada' || atualizacao?.estado === 'aguardando_reinicio';
  const dadosAtualizacao = atualizacao?.atualizacaoDisponivel;

  const executarAcaoAtualizacao = async (acao: 'verificar' | 'baixar' | 'adiar' | 'instalar' | 'agendar' | 'offline') => {
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
              : acao === 'offline' ? await api.selecionarOffline()
              : await api.adiar();
      setAtualizacao(resposta.data);
      if (!resposta.success) toast.error(resposta.error || 'Não foi possível concluir a atualização.');
      if (resposta.success && acao === 'baixar' && resposta.data.estado === 'baixada') toast.success('Atualização baixada e validada.');
      if (resposta.success && acao === 'agendar') toast.success('Instalação agendada para a próxima inicialização.');
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível concluir a atualização.');
    } finally {
      setAcaoAtualizacao(null);
    }
  };

  return (
    <header className="header flex min-h-12 shrink-0 items-center border-b border-border px-3 py-2">
      <div className="header-content justify-between w-full flex items-center">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="-ml-1" />
          <p className="truncate text-sm font-medium text-foreground">
            {saudacao}
          </p>
        </div>
        
        <div className="flex items-center gap-6 ml-auto">
          {/* Escolha de Tema */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            className="transition-transform duration-300"
            title={isDarkMode ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            {isDarkMode ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* Informações e atualizações */}
          <Dialog>
            <DialogTrigger asChild>
              <button
                className="p-2 hover:bg-accent rounded-md transition-colors flex items-center gap-2 text-sm"
                title={dadosAtualizacao ? `Nova versão disponível: v${dadosAtualizacao.versao}` : 'Informações e atualizações'}
                aria-label={dadosAtualizacao ? `Informações e atualizações. Nova versão disponível: ${dadosAtualizacao.versao}` : 'Informações e atualizações'}
              >
                <Info size={18} className={atualizacaoDisponivel ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'} />
                <span className="hidden md:inline text-muted-foreground font-medium">Informações e atualizações</span>
                {atualizacaoDisponivel && <Badge className="hidden lg:inline-flex bg-emerald-600 hover:bg-emerald-600">Atualização disponível</Badge>}
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Informações e atualizações
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Atualizações</h3>
                      <p className="text-xs text-muted-foreground">
                        {dadosAtualizacao ? `Versão v${dadosAtualizacao.versao} disponível.` : 'Seu aplicativo será verificado sem enviar dados pessoais.'}
                      </p>
                    </div>
                    {dadosAtualizacao && <Badge className="bg-emerald-600 hover:bg-emerald-600">Disponível</Badge>}
                  </div>
                  {dadosAtualizacao && (
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p><span className="font-medium text-foreground">Publicada:</span> {new Intl.DateTimeFormat('pt-BR').format(new Date(dadosAtualizacao.dataPublicacao))}</p>
                      <p><span className="font-medium text-foreground">Pacote:</span> {dadosAtualizacao.artefato.formato} · {(dadosAtualizacao.artefato.tamanho / 1024 / 1024).toFixed(1)} MB</p>
                      <p className="whitespace-pre-wrap"><span className="font-medium text-foreground">Notas:</span> {dadosAtualizacao.notas}</p>
                    </div>
                  )}
                  {atualizacao?.erro && <p className="flex items-center gap-1.5 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5" />{atualizacao.erro}</p>}
                  {atualizacao?.estado === 'baixando' && <p className="text-xs text-muted-foreground">Baixando e validando: {atualizacao.progresso ?? 0}%</p>}
                  {atualizacao?.estado === 'baixada' && <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300"><Download className="h-3.5 w-3.5" />Pacote validado. O backup será criado antes da instalação.</p>}
                  {atualizacao?.estado === 'aguardando_reinicio' && <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300"><Clock3 className="h-3.5 w-3.5" />Instalação agendada para a próxima inicialização.</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void executarAcaoAtualizacao('verificar')} disabled={acaoAtualizacao !== null || atualizacao?.estado === 'baixando'}>
                      <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${acaoAtualizacao === 'verificar' ? 'animate-spin' : ''}`} /> Verificar atualizações
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void executarAcaoAtualizacao('offline')} disabled={acaoAtualizacao !== null || atualizacao?.estado === 'baixando'}>
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Atualização offline
                    </Button>
                    {atualizacao?.estado === 'disponivel' && <Button size="sm" onClick={() => void executarAcaoAtualizacao('baixar')} disabled={acaoAtualizacao !== null}>
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar agora
                    </Button>}
                    {atualizacao?.estado === 'baixada' && <Button size="sm" onClick={() => void executarAcaoAtualizacao('instalar')} disabled={acaoAtualizacao !== null}>
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Instalar agora
                    </Button>}
                    {atualizacao?.estado === 'baixada' && (dadosAtualizacao?.artefato.formato === 'nsis' || dadosAtualizacao?.artefato.formato === 'AppImage') && <Button size="sm" variant="outline" onClick={() => void executarAcaoAtualizacao('agendar')} disabled={acaoAtualizacao !== null}>
                      <Clock3 className="mr-1.5 h-3.5 w-3.5" /> Instalar na próxima inicialização
                    </Button>}
                    {dadosAtualizacao && atualizacao?.estado !== 'baixada' && <Button size="sm" variant="ghost" onClick={() => void executarAcaoAtualizacao('adiar')} disabled={acaoAtualizacao !== null}>
                      <Clock3 className="mr-1.5 h-3.5 w-3.5" /> Lembrar depois
                    </Button>}
                  </div>
                </section>
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

          <button 
            onClick={onLogout} 
            className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors flex items-center gap-2 text-sm" 
            title="Logout"
          >
            <LogOut size={18} />
            <span className="hidden md:inline font-medium">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
