import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle2, Cloud, FolderLock, Loader2, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { CopiaGoogleDrive, EstadoGoogleDrive, LaudoElegivelGoogleDrive, PreviaRestauracaoGoogleDrive, ResumoGoogleDrive } from '@shared/types/google-drive.types';

function tamanho(bytes?: number) {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return 'Indisponível';
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
  const indice = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)), unidades.length - 1);
  const valor = bytes / 1024 ** indice;
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: indice === 0 ? 0 : 1 }).format(valor)} ${unidades[indice]}`;
}

export function GoogleDrivePage() {
  const [estado, setEstado] = useState<EstadoGoogleDrive | null>(null);
  const [copias, setCopias] = useState<CopiaGoogleDrive[]>([]);
  const [resumoCopias, setResumoCopias] = useState<Pick<ResumoGoogleDrive, 'atualizadoEm' | 'origem' | 'desatualizado'> | null>(null);
  const [laudos, setLaudos] = useState<LaudoElegivelGoogleDrive[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoLaudos, setCarregandoLaudos] = useState(true);
  const [conectando, setConectando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [laudoSelecionado, setLaudoSelecionado] = useState<string>('');
  const [confirmacaoEnvioAberta, setConfirmacaoEnvioAberta] = useState(false);
  const [restauracao, setRestauracao] = useState<PreviaRestauracaoGoogleDrive | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const [copiaVerificandoId, setCopiaVerificandoId] = useState<string | null>(null);
  const [copiaEmAnaliseId, setCopiaEmAnaliseId] = useState<string | null>(null);
  const envioEmAndamento = useRef(false);
  const leituraEmAndamento = useRef(false);
  const restauracaoEmAndamento = useRef(false);
  const verificacoesEmAndamento = useRef(new Set<string>());
  const analisesEmAndamento = useRef(new Set<string>());

  const carregar = useCallback(async (forcarAtualizacao = false) => {
    setCarregando(true);
    setCarregandoLaudos(true);
    try {
      const rapido = await window.ipcAPI.googleDrive.estadoRapido();
      if (!rapido.success || !rapido.data) { toast.error(rapido.error ?? 'Não foi possível consultar o Google Drive.'); return; }
      setEstado(rapido.data);
      if (!rapido.data.conectado) { setCopias([]); setLaudos([]); setResumoCopias(null); return; }
      const [resposta, concluidos] = await Promise.all([window.ipcAPI.googleDrive.resumo(forcarAtualizacao), window.ipcAPI.googleDrive.listarLaudosConcluidos()]);
      if (resposta.success && resposta.data) {
        setEstado(resposta.data.estado);
        setCopias(resposta.data.copias);
        setResumoCopias({ atualizadoEm: resposta.data.atualizadoEm, origem: resposta.data.origem, desatualizado: resposta.data.desatualizado });
      } else toast.error(resposta.error ?? 'Não foi possível concluir a atualização do Google Drive.');
      if (concluidos.success && concluidos.data) setLaudos(concluidos.data); else toast.error(concluidos.error ?? 'Não foi possível listar os laudos concluídos.');
    } finally {
      setCarregando(false);
      setCarregandoLaudos(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  const conectar = async () => {
    setConectando(true);
    const resposta = await window.ipcAPI.googleDrive.conectar();
    setConectando(false);
    if (!resposta.success) { toast.error(resposta.error ?? 'Não foi possível conectar a conta.'); return; }
    toast.success('Conta Google Drive conectada. Nenhum laudo foi enviado.');
    await carregar(true);
  };

  const alterarAutomatico = async (ativo: boolean) => {
    const estadoAnterior = estado;
    setEstado(atual => atual ? { ...atual, envioAutomatico: ativo } : atual);
    const resposta = await window.ipcAPI.googleDrive.definirEnvioAutomatico(ativo);
    if (!resposta.success || !resposta.data) { setEstado(estadoAnterior); toast.error(resposta.error ?? 'Não foi possível salvar a preferência.'); return; }
    setEstado(resposta.data);
    toast.success(ativo ? 'Envio automático habilitado.' : 'Envio automático desativado.');
    void carregar();
  };

  const enviarLaudo = async () => {
    if (!laudoSelecionado || envioEmAndamento.current) return;
    envioEmAndamento.current = true;
    setEnviando(true);
    try {
      const resposta = await window.ipcAPI.googleDrive.enviarLaudo(laudoSelecionado, true);
      if (!resposta.success) { toast.error(resposta.error ?? 'Não foi possível enviar o laudo.'); return; }
      setConfirmacaoEnvioAberta(false);
      toast.success('Cópia validada e enviada ao Google Drive.');
      await carregar(true);
    } finally {
      envioEmAndamento.current = false;
      setEnviando(false);
    }
  };

  const verificar = async (copiaId: string) => {
    if (leituraEmAndamento.current || verificacoesEmAndamento.current.has(copiaId)) return;
    leituraEmAndamento.current = true;
    verificacoesEmAndamento.current.add(copiaId);
    setCopiaVerificandoId(copiaId);
    try {
      const resposta = await window.ipcAPI.googleDrive.verificar(copiaId);
      if (!resposta.success || !resposta.data) { toast.error(resposta.error ?? 'Não foi possível verificar a cópia.'); return; }
      toast.success(`Cópia íntegra: REP ${resposta.data.previa.numeroRep}.`);
      await carregar();
    } finally {
      leituraEmAndamento.current = false;
      verificacoesEmAndamento.current.delete(copiaId);
      setCopiaVerificandoId(atual => atual === copiaId ? null : atual);
    }
  };

  const analisarRestauracao = async (copiaId: string) => {
    if (leituraEmAndamento.current || analisesEmAndamento.current.has(copiaId)) return;
    leituraEmAndamento.current = true;
    analisesEmAndamento.current.add(copiaId);
    setCopiaEmAnaliseId(copiaId);
    try {
      const resposta = await window.ipcAPI.googleDrive.analisarRestauracao(copiaId);
      if (!resposta.success || !resposta.data) { toast.error(resposta.error ?? 'Não foi possível analisar a cópia.'); return; }
      setRestauracao(resposta.data);
    } finally {
      leituraEmAndamento.current = false;
      analisesEmAndamento.current.delete(copiaId);
      setCopiaEmAnaliseId(atual => atual === copiaId ? null : atual);
    }
  };

  const cancelarRestauracao = async () => {
    const operacaoId = restauracao?.operacaoId;
    setRestauracao(null);
    if (operacaoId) await window.ipcAPI.googleDrive.cancelarRestauracao(operacaoId);
  };

  const confirmarRestauracao = async () => {
    if (!restauracao || restauracaoEmAndamento.current) return;
    restauracaoEmAndamento.current = true;
    setRestaurando(true);
    try {
      const resposta = await window.ipcAPI.googleDrive.confirmarRestauracao(restauracao.operacaoId, restauracao.previa.substituiRep);
      if (!resposta.success) { toast.error(resposta.error ?? 'Não foi possível restaurar a cópia.'); return; }
      setRestauracao(null);
      toast.success('Laudo restaurado com sucesso.');
    } finally {
      restauracaoEmAndamento.current = false;
      setRestaurando(false);
    }
  };

  const percentualBackups = estado?.percentualBackups ?? 0;
  const classeCota = percentualBackups >= 100 ? 'bg-destructive' : percentualBackups >= 80 ? 'bg-amber-500' : 'bg-primary';

  return <div className="space-y-6 pb-8">
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Google Drive</h1>
      <p className="text-sm text-muted-foreground">Backups individuais protegidos na sua conta institucional.</p>
    </div>

    {estado?.aviso && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Atenção necessária</AlertTitle><AlertDescription>{estado.aviso}</AlertDescription></Alert>}

    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5" />Conta e pasta</CardTitle><CardDescription>A integração só acessa a pasta exclusiva do laWdo.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
          <div><p className="font-medium">{estado?.conectado ? estado.email : 'Nenhuma conta conectada'}</p><p className="text-sm text-muted-foreground">{estado?.caminho ?? 'Meu Drive/laWdo'}</p></div>
          {estado?.conectado ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Conectada</Badge> : <Button onClick={() => void conectar()} disabled={conectando}>{conectando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{estado?.protecaoChave === 'reconexao_necessaria' ? 'Reconectar conta institucional' : 'Conectar conta institucional'}</Button>}
        </div>
        <Alert><FolderLock className="h-4 w-4" /><AlertDescription>O laWdo cria e usa somente <strong>Meu Drive/laWdo</strong>. Conectar a conta não envia laudos.</AlertDescription></Alert>
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div><p className="font-medium">Chave de recuperação {estado?.protecaoChave === 'protegida' ? 'protegida' : 'privada'}</p><p className="text-sm text-muted-foreground">{estado?.protecaoChave === 'protegida' ? 'Guardada na área privada do aplicativo no Google Drive.' : estado?.protecaoChave === 'aguardando_primeiro_envio' ? 'Será criada na área privada no primeiro envio.' : 'Acompanhe o aviso de proteção acima.'}</p></div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Envio e armazenamento</CardTitle><CardDescription>O envio manual e automático será habilitado somente para laudos concluídos.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4"><div><p className="font-medium">Envio automático</p><p className="text-sm text-muted-foreground">Uma nova conclusão poderá substituir a cópia vigente.</p></div><Switch checked={estado?.envioAutomatico ?? false} disabled={!estado?.conectado} onCheckedChange={ativo => void alterarAutomatico(ativo)} aria-label="Ativar envio automático" /></div>
        <div className="space-y-3 rounded-lg border p-4">
          <div><p className="font-medium">Enviar cópia agora</p><p className="text-sm text-muted-foreground">Somente laudos concluídos por você são exibidos. O pacote contém a REP, a estrutura e as figuras utilizadas.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={laudoSelecionado} onValueChange={setLaudoSelecionado} disabled={!estado?.conectado || carregandoLaudos || enviando}>
              <SelectTrigger className="sm:flex-1"><SelectValue placeholder={carregandoLaudos ? 'Buscando laudos concluídos...' : laudos.length ? 'Selecione um laudo concluído' : 'Nenhum laudo concluído disponível'} /></SelectTrigger>
              <SelectContent>{laudos.map(laudo => <SelectItem key={laudo.id} value={laudo.id}>REP {laudo.numeroRep} · concluído em {new Date(laudo.concluidoEm).toLocaleDateString('pt-BR')}</SelectItem>)}</SelectContent>
            </Select>
            <Button disabled={!estado?.conectado || !laudoSelecionado || enviando} onClick={() => setConfirmacaoEnvioAberta(true)}>{enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Enviar cópia</Button>
          </div>
          {carregandoLaudos && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando laudos concluídos...</div>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div className="space-y-2 rounded-lg border p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Cota de backups</p><span className="text-xs text-muted-foreground">{Math.round(percentualBackups)}%</span></div><p className="font-medium">{tamanho(estado?.backupsBytes)} de {tamanho(estado?.limiteBackupsBytes)}</p><Progress value={percentualBackups} indicatorClassName={classeCota} aria-label="Uso da cota de backups" /><p className="text-xs text-muted-foreground">{tamanho(estado?.backupsDisponiveisBytes)} disponíveis</p></div><div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Uso da conta</p><p className="font-medium">{tamanho(estado?.usoBytes)}{estado?.limiteBytes ? ` de ${tamanho(estado.limiteBytes)}` : ''}</p></div><div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Último envio</p><p className="font-medium">{estado?.ultimoEnvioEm ? new Date(estado.ultimoEnvioEm).toLocaleString('pt-BR') : 'Nenhum'}</p></div><div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Pendências</p><p className="font-medium">{estado?.pendencias ?? 0}</p></div><div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Cópias disponíveis</p><p className="font-medium">{copias.length}</p></div></div>
        <p className="text-xs text-muted-foreground">A cota de 10 GB é exclusiva para cópias do laWdo e não representa o espaço total da conta Google.</p>
        {estado?.falhaFila && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>{estado.filaAguardaEspaco ? 'Envio automático aguardando espaço' : estado.filaAguardaCorrecao ? 'Envio automático requer correção' : 'Envio automático pendente'}</AlertTitle><AlertDescription>{estado.falhaFila}</AlertDescription></Alert>}
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle>Laudos no Drive</CardTitle><CardDescription>Verificação e restauração são executadas sem acessar outras pastas do Drive.{resumoCopias?.atualizadoEm ? ` Atualizado em ${new Date(resumoCopias.atualizadoEm).toLocaleString('pt-BR')}${resumoCopias.origem === 'cache' ? ' (cache local).' : '.'}` : ''}</CardDescription></div><Button variant="outline" size="icon" onClick={() => void carregar(true)} disabled={carregando} aria-label="Atualizar cópias"><RefreshCw className={carregando ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></Button></CardHeader>
      <CardContent>{!estado?.conectado ? <p className="py-8 text-center text-sm text-muted-foreground">Conecte a conta institucional para consultar as cópias.</p> : copias.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Ainda não há cópias no Drive.</p> : <Table><TableHeader><TableRow><TableHead>REP</TableHead><TableHead>Arquivo</TableHead><TableHead>Última alteração</TableHead><TableHead>Verificada em</TableHead><TableHead>Tamanho</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{copias.map(copia => {
        const verificando = copiaVerificandoId === copia.id;
        const analisando = copiaEmAnaliseId === copia.id;
        return <TableRow key={copia.id}><TableCell>{copia.numeroRep || '—'}</TableCell><TableCell>{copia.nome}</TableCell><TableCell>{copia.modificadaEm ? new Date(copia.modificadaEm).toLocaleString('pt-BR') : '—'}</TableCell><TableCell>{copia.verificadaEm ? new Date(copia.verificadaEm).toLocaleString('pt-BR') : 'Nunca'}</TableCell><TableCell>{tamanho(copia.tamanho)}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm" disabled={Boolean(copiaVerificandoId) || Boolean(copiaEmAnaliseId)} onClick={() => void verificar(copia.id)}>{verificando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{verificando ? 'Verificando...' : 'Verificar'}</Button><Button variant="outline" size="sm" className="ml-2" disabled={Boolean(copiaEmAnaliseId) || Boolean(copiaVerificandoId)} onClick={() => void analisarRestauracao(copia.id)}>{analisando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{analisando ? 'Preparando...' : 'Restaurar'}</Button></TableCell></TableRow>;
      })}</TableBody></Table>}</CardContent>
    </Card>
    <AlertDialog open={confirmacaoEnvioAberta} onOpenChange={setConfirmacaoEnvioAberta}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Enviar cópia ao Google Drive?</AlertDialogTitle><AlertDialogDescription>{enviando ? 'Preparando, cifrando, enviando e validando a cópia. Isso pode levar alguns instantes.' : copias.some(copia => copia.laudoId === laudoSelecionado) ? 'A cópia vigente será substituída somente depois que a nova cópia for validada.' : 'O laWdo criará uma cópia cifrada na pasta exclusiva Meu Drive/laWdo.'}</AlertDialogDescription></AlertDialogHeader>{enviando && <div className="space-y-2" aria-live="polite"><Progress value={null} aria-label="Envio em andamento" /><p className="text-sm text-muted-foreground">Aguarde até a confirmação da integridade.</p></div>}<AlertDialogFooter><AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={enviando} onClick={evento => { evento.preventDefault(); void enviarLaudo(); }}>{enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{enviando ? 'Enviando...' : 'Enviar cópia'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={Boolean(copiaEmAnaliseId)}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Preparando restauração</AlertDialogTitle><AlertDialogDescription>Baixando e validando a cópia cifrada antes de mostrar a prévia. Nenhum dado local será alterado nesta etapa.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2" aria-live="polite"><Progress value={null} aria-label="Download e validação em andamento" /><p className="text-sm text-muted-foreground">Aguarde até a análise ser concluída.</p></div></AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={Boolean(restauracao)} onOpenChange={aberto => { if (!aberto) void cancelarRestauracao(); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restaurar laudo?</AlertDialogTitle><AlertDialogDescription>{restaurando ? 'Baixando novamente, revalidando e inserindo os dados do laudo. Não feche o laWdo durante esta etapa.' : restauracao?.previa.bloqueio ?? `A cópia da REP ${restauracao?.previa.numeroRep ?? ''} inclui ${restauracao?.previa.figuras ?? 0} figura(s). ${restauracao?.previa.substituiRep ? 'A REP local será substituída após a confirmação.' : 'Os dados serão incluídos nesta instalação.'}`}</AlertDialogDescription></AlertDialogHeader>{restaurando && <div className="space-y-2" aria-live="polite"><Progress value={null} aria-label="Restauração em andamento" /><p className="text-sm text-muted-foreground">A operação é transacional: se falhar, as alterações locais serão revertidas.</p></div>}<AlertDialogFooter><AlertDialogCancel disabled={restaurando} onClick={() => void cancelarRestauracao()}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={restaurando || Boolean(restauracao?.previa.bloqueio)} onClick={evento => { evento.preventDefault(); void confirmarRestauracao(); }}>{restaurando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{restaurando ? 'Restaurando...' : 'Confirmar restauração'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}
