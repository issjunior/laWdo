import React, { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Cloud, Database, Download, Loader2, Settings, Upload } from 'lucide-react';
import { GoogleDrivePage } from '@/pages/GoogleDrivePage';
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
    resumo: 'Salva REPs, laudos, imagens utilizadas e suas originais vinculadas, perfil, avatar e configurações, incluindo credenciais GDL e IA.',
    exclusao: 'Não inclui fotos não utilizadas nos laudos, login, e-mail de acesso nem senha do laWdo. As fotos permanecem nesta instalação.',
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

export const BackupPage: React.FC<{ currentUser: Record<string, unknown> | null }> = ({ currentUser }) => {
  const [parametrosBusca, definirParametrosBusca] = useSearchParams();
  const aba = parametrosBusca.get('aba') === 'google-drive' ? 'google-drive' : 'local';
  const nomeUsuario = [currentUser?.name, currentUser?.nome, currentUser?.username]
    .find((valor): valor is string => typeof valor === 'string' && valor.trim().length > 0) || 'usuário atual';
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
      <div className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <Database className="h-6 w-6" />
          </div>
          <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Backup e restauração</h1>
          <p className="text-sm text-muted-foreground">Os novos backups são protegidos pela senha de acesso ao laWdo usada no momento da criação.</p>
          </div>
        </div>
      </div>
      <Tabs value={aba} onValueChange={valor => {
        const proximosParametros = new URLSearchParams(parametrosBusca);
        if (valor === 'google-drive') proximosParametros.set('aba', valor);
        else proximosParametros.delete('aba');
        definirParametrosBusca(proximosParametros);
      }}>
        <TabsList className="grid h-auto w-full grid-cols-2 sm:w-auto">
          <TabsTrigger value="local" className="min-w-0 px-3 sm:px-4"><Database className="mr-2 h-4 w-4 shrink-0" />Backup local</TabsTrigger>
          <TabsTrigger value="google-drive" className="min-w-0 px-3 sm:px-4"><Cloud className="mr-2 h-4 w-4 shrink-0" />Google Drive</TabsTrigger>
        </TabsList>
        <TabsContent value="local" className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Tipos de backup local</h2>
            <p className="text-sm text-muted-foreground">Escolha o conteúdo que deseja salvar ou restaurar nesta instalação.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {(['completo', 'configuracao'] as const).map(tipo => {
              const Icone = tipo === 'completo' ? Database : Settings;
              return (
                <Card key={tipo} className="flex flex-col overflow-hidden">
                  <CardHeader className="space-y-3 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icone className="h-5 w-5" /></div>
                      <CardTitle className="text-lg">{MODALIDADES[tipo].titulo}</CardTitle>
                    </div>
                    <CardDescription className="space-y-3 leading-relaxed">
                      <span className="block text-foreground/90">{MODALIDADES[tipo].resumo}</span>
                      <span className="block rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">{MODALIDADES[tipo].exclusao}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto space-y-4">
                    <div className="rounded-md border-l-2 border-primary/60 bg-muted/30 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ao restaurar</p>
                      <p className="mt-1 text-sm text-muted-foreground">{MODALIDADES[tipo].restauracao}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button onClick={() => void iniciar(tipo, 'criar')} disabled={ocupado}>
                        <Download className="mr-2 h-4 w-4" />Criar backup
                      </Button>
                      <Button variant="outline" onClick={() => void iniciar(tipo, 'restaurar')} disabled={ocupado}>
                        <Upload className="mr-2 h-4 w-4" />Restaurar backup
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="google-drive">
          <GoogleDrivePage />
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(operacao)} onOpenChange={aberto => { if (!aberto && !ocupado) fechar(); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-xl">
          <DialogHeader>
            <DialogTitle className="pr-6 leading-snug">{operacao?.acao === 'criar' ? 'Criar' : 'Restaurar'} {operacao ? MODALIDADES[operacao.tipo].titulo.toLowerCase() : 'backup'}</DialogTitle>
            <DialogDescription>
              {previa ? 'Confira os dados antes de substituir o conteúdo local.' : operacao?.acao === 'criar'
                ? <>Este backup será protegido pela senha de acesso de <span className="font-medium text-foreground">{nomeUsuario}</span>.</>
                : 'Informe a senha usada quando este backup foi criado.'}
            </DialogDescription>
          </DialogHeader>
          {!previa ? (
            <div className="space-y-3">
              {operacao?.acao === 'restaurar' && (
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="text-muted-foreground">Arquivo selecionado:</p>
                  <p className="break-words font-medium [overflow-wrap:anywhere]">{nomeArquivo}</p>
                </div>
              )}
              <label className="block space-y-1 text-sm font-medium">
                <span>{operacao?.acao === 'criar' ? 'Senha de acesso ao laWdo' : 'Senha do backup'}</span>
                <Input type="password" value={senha} onChange={evento => setSenha(evento.target.value)} autoComplete={operacao?.acao === 'criar' ? 'current-password' : 'off'} />
              </label>
              <p className="text-xs text-muted-foreground">{operacao?.acao === 'criar'
                ? 'Observação: se mudá-la depois, este arquivo ainda exigirá a senha usada hoje.'
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
            <Button className="whitespace-nowrap" variant={previa ? 'destructive' : 'default'} onClick={() => void (previa ? confirmarRestauracao() : executar())} disabled={ocupado}>
              {ocupado && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {previa ? 'Confirmar restauração' : operacao?.acao === 'criar' ? 'Selecionar destino' : 'Analisar backup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
