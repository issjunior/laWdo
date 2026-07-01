import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Info,
  LogOut,
  Github,
  Mail,
  Moon,
  Sun,
} from 'lucide-react';
import { toast } from 'sonner';

interface HeaderProps {
  onLogout: () => void;
  currentUser: Record<string, unknown> | null;
}

export const Header: React.FC<HeaderProps> = ({ onLogout, currentUser: _currentUser }) => {
  const [appInfo, setAppInfo] = useState<{
    version: string;
    name: string;
    platform: string;
    osVersion: string;
    arch: string;
    memory: string;
    dbVersion: number;
  } | null>(null);

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

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  return (
    <header className="header flex items-center px-3 h-12 shrink-0 border-b border-border">
      <div className="header-content justify-between w-full flex items-center">
        <SidebarTrigger className="-ml-1" />
        
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

          {/* Informação (Dialog) */}
          <Dialog>
            <DialogTrigger asChild>
              <button className="p-2 hover:bg-accent rounded-md transition-colors flex items-center gap-2 text-sm" title="Sugestão">
                <Info size={18} className="text-muted-foreground" />
                <span className="hidden md:inline text-muted-foreground font-medium">Sugestão</span>
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  Sugestão
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
                        <Github className="h-4 w-4 text-primary" />
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
