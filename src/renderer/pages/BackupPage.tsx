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
  const [confirmacaoSenha, setConfirmacaoSenha] = useState('');
  const [preparacaoId, setPreparacaoId] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Record<string, unknown> | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const fechar = () => {
    if (preparacaoId) void window.ipcAPI.backup.cancelar(preparacaoId);
    setOperacao(null);
    setSenha('');
    setConfirmacaoSenha('');
    setPreparacaoId(null);
    setPrevia(null);
  };

  const iniciar = (tipo: TipoBackup, acao: Acao) => {
    fechar();
    setOperacao({ tipo, acao });
  };

  const executar = async () => {
    if (!operacao) return;
    if (senha.length < 12) {
      toast.error('A senha do arquivo deve ter pelo menos 12 caracteres.');
      return;
    }
    if (operacao.acao === 'criar' && senha !== confirmacaoSenha) {
      toast.error('As senhas do arquivo não conferem.');
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
        const resultado = await window.ipcAPI.backup.analisar(operacao.tipo, senha);
        if (resultado.success && resultado.operacaoId && resultado.previa) {
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
          <p className="text-sm text-muted-foreground">Os dois arquivos são protegidos por uma senha definida por você.</p>
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
                <Button onClick={() => iniciar(tipo, 'criar')} disabled={ocupado}>
                  <Download className="mr-2 h-4 w-4" />Criar backup
                </Button>
                <Button variant="outline" onClick={() => iniciar(tipo, 'restaurar')} disabled={ocupado}>
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
              {previa ? 'Confira os dados antes de substituir o conteúdo local.' : 'Informe a senha que protegerá ou abrirá este arquivo. Ela não é a senha de acesso ao laWdo.'}
            </DialogDescription>
          </DialogHeader>
          {!previa ? (
            <div className="space-y-3">
              <label className="block space-y-1 text-sm font-medium">
                <span>Senha do arquivo</span>
                <Input type="password" value={senha} onChange={evento => setSenha(evento.target.value)} autoComplete="new-password" />
              </label>
              {operacao?.acao === 'criar' && (
                <label className="block space-y-1 text-sm font-medium">
                  <span>Confirmar senha</span>
                  <Input type="password" value={confirmacaoSenha} onChange={evento => setConfirmacaoSenha(evento.target.value)} autoComplete="new-password" />
                </label>
              )}
              <p className="text-xs text-muted-foreground">Use pelo menos 12 caracteres. O laWdo não poderá recuperar essa senha.</p>
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
              {previa ? 'Confirmar restauração' : operacao?.acao === 'criar' ? 'Selecionar destino' : 'Selecionar arquivo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
