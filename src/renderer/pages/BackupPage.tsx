import React, { useState } from 'react';
import { Database, Download, Loader2, Settings, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type TipoBackup = 'completo' | 'configuracao';
type Acao = 'criar' | 'restaurar';

interface Operacao {
  tipo: TipoBackup;
  acao: Acao;
}

const MODALIDADES = {
  completo: {
    titulo: 'Backup completo',
    resumo: 'Salva REPs, laudos, imagens, perfil, avatar e configurações, incluindo credenciais GDL e IA.',
    exclusao: 'Não inclui login, e-mail de acesso nem senha do laWdo.',
    restauracao: 'Substitui banco, imagens e perfil. Preserva o acesso local e reinicia o aplicativo.',
  },
  configuracao: {
    titulo: 'Backup de configuração',
    resumo: 'Salva estruturas de trabalho, preferências, perfil, avatar e credenciais GDL e IA.',
    exclusao: 'Não inclui REPs, laudos, imagens de laudos nem credenciais de acesso ao laWdo.',
    restauracao: 'Substitui a configuração atual. A restauração é bloqueada se houver REPs ou laudos vinculados.',
  },
} as const;

function numero(valor: unknown): string {
  return typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : '—';
}

export const BackupPage: React.FC = () => {
  const [operacao, setOperacao] = useState<Operacao | null>(null);
  const [senha, setSenha] = useState('');
  const [selecaoId, setSelecaoId] = useState<string | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [preparacaoId, setPreparacaoId] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Record<string, unknown> | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const fechar = () => {
    if (preparacaoId) void window.ipcAPI.backup.cancelar(preparacaoId);
    if (selecaoId) void window.ipcAPI.backup.cancelar(selecaoId);
    setOperacao(null);
    setSenha('');
    setSelecaoId(null);
    setNomeArquivo('');
    setPreparacaoId(null);
    setPrevia(null);
  };

  const iniciar = async (tipo: TipoBackup, acao: Acao) => {
    fechar();
    if (acao === 'criar') {
      setOperacao({ tipo, acao });
      return;
    }
    setOcupado(true);
    try {
      const resultado = await window.ipcAPI.backup.selecionar(tipo);
      if (resultado.success && resultado.selecaoId && resultado.nomeArquivo) {
        setSelecaoId(resultado.selecaoId);
        setNomeArquivo(resultado.nomeArquivo);
        setOperacao({ tipo, acao });
      } else if (!resultado.canceled) toast.error(resultado.error || 'Não foi possível selecionar o backup.');
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Falha ao selecionar o backup.');
    } finally {
      setOcupado(false);
    }
  };

  const executar = async () => {
    if (!operacao) return;
    if (!senha) {
      toast.error('Informe a senha de acesso usada na criação do backup.');
      return;
    }
    setOcupado(true);
    try {
      if (operacao.acao === 'criar') {
        const resultado = await window.ipcAPI.backup.criar(operacao.tipo, senha);
        if (resultado.success) {
          toast.success('Backup criado com sucesso.', { description: resultado.path });
          fechar();
        } else if (!resultado.canceled) toast.error(resultado.error || 'Não foi possível criar o backup.');
      } else {
        if (!selecaoId) throw new Error('Selecione o arquivo de backup novamente.');
        const resultado = await window.ipcAPI.backup.analisar(selecaoId, senha);
        if (resultado.success && resultado.operacaoId && resultado.previa) {
          setSelecaoId(null);
          setPreparacaoId(resultado.operacaoId);
          setPrevia(resultado.previa);
        } else if (!resultado.canceled) toast.error(resultado.error || 'Não foi possível analisar o backup.');
      }
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Falha ao acessar o backup.');
    } finally {
      setOcupado(false);
    }
  };

  const confirmarRestauracao = async () => {
    if (!preparacaoId || !operacao) return;
    setOcupado(true);
    try {
      const resultado = await window.ipcAPI.backup.confirmar(preparacaoId, senha);
      if (!resultado.success) {
        toast.error(resultado.error || 'Não foi possível restaurar o backup.');
        setPreparacaoId(null);
        setPrevia(null);
        return;
      }
      toast.success(operacao.tipo === 'completo' ? 'Restauração concluída. O aplicativo será reiniciado.' : 'Configuração restaurada. Entre novamente.');
      fechar();
      if (operacao.tipo === 'configuracao') window.location.reload();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Falha ao restaurar o backup.');
    } finally {
      setOcupado(false);
    }
  };

  const previaContagens = previa?.quantidades;
  const quantidades = previaContagens && typeof previaContagens === 'object' && !Array.isArray(previaContagens)
    ? Object.entries(previaContagens as Record<string, unknown>) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Database className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup e restauração</h1>
          <p className="text-sm text-muted-foreground">Os novos backups são protegidos pela senha de acesso ao laWdo usada no momento da criação.</p>
        </div>
      </div>
      <Tabs defaultValue="completo">
        <TabsList>
          <TabsTrigger value="completo"><Database className="mr-2 h-4 w-4" />Completo</TabsTrigger>
          <TabsTrigger value="configuracao"><Settings className="mr-2 h-4 w-4" />Configuração</TabsTrigger>
        </TabsList>
        {(['completo', 'configuracao'] as const).map(tipo => (
          <TabsContent key={tipo} value={tipo} className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{MODALIDADES[tipo].titulo}</CardTitle>
                <CardDescription className="space-y-2">
                  <span className="block">{MODALIDADES[tipo].resumo}</span>
                  <span className="block">{MODALIDADES[tipo].exclusao}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <Button onClick={() => void iniciar(tipo, 'criar')} disabled={ocupado}>
                  <Download className="mr-2 h-4 w-4" />Criar backup
                </Button>
                <Button variant="outline" onClick={() => void iniciar(tipo, 'restaurar')} disabled={ocupado}>
                  <Upload className="mr-2 h-4 w-4" />Restaurar backup
                </Button>
              </CardContent>
            </Card>
            <p className="text-sm text-muted-foreground">Ao restaurar: {MODALIDADES[tipo].restauracao}</p>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={Boolean(operacao)} onOpenChange={aberto => { if (!aberto && !ocupado) fechar(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{operacao?.acao === 'criar' ? 'Criar' : 'Restaurar'} {operacao ? MODALIDADES[operacao.tipo].titulo.toLowerCase() : 'backup'}</DialogTitle>
            <DialogDescription>
              {previa ? 'Confira os dados antes de substituir o conteúdo local.' : operacao?.acao === 'criar'
                ? 'Informe sua senha atual de acesso ao laWdo. Ela protegerá este backup.'
                : 'Informe a senha usada quando este backup foi criado.'}
            </DialogDescription>
          </DialogHeader>
          {!previa ? (
            <div className="space-y-3">
              {operacao?.acao === 'restaurar' && <p className="break-all text-sm">Arquivo selecionado: {nomeArquivo}</p>}
              <label className="block space-y-1 text-sm font-medium">
                <span>{operacao?.acao === 'criar' ? 'Senha de acesso ao laWdo' : 'Senha do backup'}</span>
                <Input type="password" value={senha} onChange={evento => setSenha(evento.target.value)} autoComplete={operacao?.acao === 'criar' ? 'current-password' : 'off'} />
              </label>
              <p className="text-xs text-muted-foreground">{operacao?.acao === 'criar'
                ? 'Use uma senha de acesso forte (recomendamos 12 ou mais caracteres). Se mudá-la depois, este arquivo ainda exigirá a senha usada hoje.'
                : 'Backups anteriores podem exigir uma senha própria. A senha não pode ser recuperada pelo laWdo.'}</p>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p>Criado em: {typeof previa.criadoEm === 'string' ? new Date(previa.criadoEm).toLocaleString('pt-BR') : '—'}</p>
              {operacao?.tipo === 'completo' ? (
                <p>{numero(previa.reps)} REPs · {numero(previa.laudos)} laudos · {numero(previa.imagens)} imagens de laudos</p>
              ) : (
                <p>{quantidades.map(([nome, total]) => `${nome}: ${numero(total)}`).join(' · ')}</p>
              )}
              <p>Perfil do perito{previa.possuiAvatar ? ' e avatar' : ''}; configurações e credenciais presentes no arquivo.</p>
              <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 font-medium text-foreground">
                {typeof previa.aviso === 'string' ? previa.aviso : 'Os dados locais serão substituídos.'}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={fechar} disabled={ocupado}>Cancelar</Button>
            <Button variant={previa ? 'destructive' : 'default'} onClick={() => void (previa ? confirmarRestauracao() : executar())} disabled={ocupado}>
              {ocupado && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {previa ? 'Confirmar restauração' : operacao?.acao === 'criar' ? 'Selecionar destino' : 'Analisar backup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
