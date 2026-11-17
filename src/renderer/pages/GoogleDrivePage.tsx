import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { resolverPlaceholdersExportacao } from '@/lib/exportacao-placeholders';
import { buildPdfHeaderConfig, montarCabecalhoPrimeiraPagina } from '@/lib/pdf-header';
import { AlertTriangle, CheckCircle2, Cloud, Download, FileText, FolderLock, Loader2, RefreshCw, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { CopiaGoogleDrive, EstadoGoogleDrive, LaudoElegivelGoogleDrive, PreviaRestauracaoGoogleDrive, ResumoGoogleDrive } from '@shared/types/google-drive.types';

function tamanho(bytes?: number) {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return 'Indisponível';
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
  const indice = Math.min(Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)), unidades.length - 1);
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: indice === 0 ? 0 : 1 }).format(bytes / 1024 ** indice)} ${unidades[indice]}`;
}

function criarUrlPdf(base64: string): string {
  const texto = atob(base64);
  const bytes = new Uint8Array(texto.length);
  for (let indice = 0; indice < texto.length; indice += 1) bytes[indice] = texto.charCodeAt(indice);
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

export function GoogleDrivePage() {
  const [estado, setEstado] = useState<EstadoGoogleDrive | null>(null);
  const [copias, setCopias] = useState<CopiaGoogleDrive[]>([]);
  const [resumoCopias, setResumoCopias] = useState<Pick<ResumoGoogleDrive, 'atualizadoEm' | 'origem'> | null>(null);
  const [laudos, setLaudos] = useState<LaudoElegivelGoogleDrive[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoLaudos, setCarregandoLaudos] = useState(true);
  const [conectando, setConectando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [laudoSelecionado, setLaudoSelecionado] = useState('');
  const [confirmacaoEnvioAberta, setConfirmacaoEnvioAberta] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [copiaEmLeituraId, setCopiaEmLeituraId] = useState<string | null>(null);
  const [operacaoLeitura, setOperacaoLeitura] = useState<'integridade' | 'visualizacao' | null>(null);
  const [progressoLeitura, setProgressoLeitura] = useState<{ atual: number; total: number } | null>(null);
  const [progressoDownload, setProgressoDownload] = useState<{ recebidos: number; total?: number } | null>(null);
  const [segundosLeitura, setSegundosLeitura] = useState(0);
  const [visualizacaoUrl, setVisualizacaoUrl] = useState<string | null>(null);
  const [tituloVisualizacao, setTituloVisualizacao] = useState('');
  const [numeroRepVisualizacao, setNumeroRepVisualizacao] = useState('');
  const [exclusaoIds, setExclusaoIds] = useState<string[] | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [filaRestauracao, setFilaRestauracao] = useState<CopiaGoogleDrive[] | null>(null);
  const [indiceRestauracao, setIndiceRestauracao] = useState(0);
  const [restauracaoAtual, setRestauracaoAtual] = useState<PreviaRestauracaoGoogleDrive | null>(null);
  const [restaurando, setRestaurando] = useState(false);
  const [resultadosRestauracao, setResultadosRestauracao] = useState<{ sucesso: number; falhas: string[] } | null>(null);
  const cancelamentoRestauracao = useRef(false);
  const resultadosRestauracaoRef = useRef({ sucesso: 0, falhas: [] as string[] });
  const urlPdf = useRef<string | null>(null);
  const operacaoIntegridade = useRef<string | null>(null);
  const cancelamentoIntegridade = useRef(false);

  const carregar = useCallback(async (forcarAtualizacao = false) => {
    setCarregando(true); setCarregandoLaudos(true);
    try {
      const rapido = await window.ipcAPI.googleDrive.estadoRapido();
      if (!rapido.success || !rapido.data) { toast.error(rapido.error ?? 'Não foi possível consultar o Google Drive.'); return; }
      setEstado(rapido.data);
      if (!rapido.data.conectado) { setCopias([]); setLaudos([]); setResumoCopias(null); return; }
      const [resposta, concluidos] = await Promise.all([window.ipcAPI.googleDrive.resumo(forcarAtualizacao), window.ipcAPI.googleDrive.listarLaudosConcluidos()]);
      if (resposta.success && resposta.data) {
        setEstado(resposta.data.estado); setCopias(resposta.data.copias);
        setResumoCopias({ atualizadoEm: resposta.data.atualizadoEm, origem: resposta.data.origem });
        setSelecionadas(anterior => new Set([...anterior].filter(id => resposta.data?.copias.some(copia => copia.id === id))));
      } else toast.error(resposta.error ?? 'Não foi possível concluir a atualização do Google Drive.');
      if (concluidos.success && concluidos.data) setLaudos(concluidos.data); else toast.error(concluidos.error ?? 'Não foi possível listar os laudos concluídos.');
    } finally { setCarregando(false); setCarregandoLaudos(false); }
  }, []);
  useEffect(() => { void carregar(); return () => { if (urlPdf.current) URL.revokeObjectURL(urlPdf.current); }; }, [carregar]);
  useEffect(() => {
    if (operacaoLeitura !== 'integridade') { setSegundosLeitura(0); return; }
    const inicio = Date.now();
    const temporizador = window.setInterval(() => setSegundosLeitura(Math.floor((Date.now() - inicio) / 1000)), 1000);
    return () => window.clearInterval(temporizador);
  }, [operacaoLeitura]);
  useEffect(() => window.ipcAPI.googleDrive.onProgressoVerificacao(progresso => {
    if (progresso.operacaoId === operacaoIntegridade.current) setProgressoDownload({ recebidos: progresso.recebidos, total: progresso.total });
  }), []);

  const conectar = async () => {
    setConectando(true);
    try {
      const resposta = await window.ipcAPI.googleDrive.conectar();
      if (!resposta.success) { toast.error(resposta.error ?? 'Não foi possível conectar a conta.'); return; }
      toast.success('Conta Google Drive conectada. Nenhum laudo foi enviado.'); await carregar(true);
    } finally { setConectando(false); }
  };
  const alterarAutomatico = async (ativo: boolean) => {
    const anterior = estado; setEstado(atual => atual ? { ...atual, envioAutomatico: ativo } : atual);
    const resposta = await window.ipcAPI.googleDrive.definirEnvioAutomatico(ativo);
    if (!resposta.success || !resposta.data) { setEstado(anterior); toast.error(resposta.error ?? 'Não foi possível salvar a preferência.'); return; }
    setEstado(resposta.data); toast.success(ativo ? 'Envio automático habilitado.' : 'Envio automático desativado.'); void carregar();
  };
  const enviarLaudo = async () => {
    if (!laudoSelecionado || enviando) return;
    setEnviando(true);
    try {
      const resposta = await window.ipcAPI.googleDrive.enviarLaudo(laudoSelecionado, true);
      if (!resposta.success) { toast.error(resposta.error ?? 'Não foi possível enviar o laudo.'); return; }
      setConfirmacaoEnvioAberta(false); toast.success('Cópia validada e enviada ao Google Drive.'); await carregar(true);
    } finally { setEnviando(false); }
  };
  const verificarCopias = async (itens: CopiaGoogleDrive[]) => {
    if (copiaEmLeituraId || !itens.length) return;
    const operacaoId = crypto.randomUUID();
    operacaoIntegridade.current = operacaoId;
    cancelamentoIntegridade.current = false;
    setOperacaoLeitura('integridade'); setProgressoDownload(null);
    const falhas: string[] = [];
    let verificadas = 0;
    try {
      for (const [indice, copia] of itens.entries()) {
        if (cancelamentoIntegridade.current) break;
        setCopiaEmLeituraId(copia.id); setProgressoLeitura({ atual: indice + 1, total: itens.length });
        const resposta = await window.ipcAPI.googleDrive.verificar(copia.id, operacaoId);
        if (!resposta.success || !resposta.data) falhas.push(`REP ${copia.numeroRep}: ${resposta.error ?? 'falha na integridade'}`);
        else verificadas += 1;
      }
      await carregar();
      if (cancelamentoIntegridade.current) toast.message(`Conferência interrompida: ${verificadas} de ${itens.length} cópia(s) verificadas.`);
      else if (falhas.length) toast.error(`${falhas.length} cópia(s) não passaram pela conferência de integridade.`);
      else toast.success(itens.length === 1 ? `Cópia íntegra: REP ${itens[0].numeroRep}.` : `${itens.length} cópias estão íntegras.`);
    } finally { setCopiaEmLeituraId(null); setOperacaoLeitura(null); setProgressoLeitura(null); setProgressoDownload(null); operacaoIntegridade.current = null; }
  };
  const integridade = (copiaId: string) => void verificarCopias(copias.filter(copia => copia.id === copiaId));
  const integridadeSelecionadas = () => void verificarCopias(copias.filter(copia => selecionadas.has(copia.id)));
  const cancelarIntegridade = async () => {
    cancelamentoIntegridade.current = true;
    if (!operacaoIntegridade.current) return;
    const resposta = await window.ipcAPI.googleDrive.cancelarVerificacao(operacaoIntegridade.current);
    if (!resposta.success) toast.error(resposta.error ?? 'Não foi possível interromper a conferência atual.');
  };
  const visualizar = async (copiaId: string) => {
    if (copiaEmLeituraId) return;
    setCopiaEmLeituraId(copiaId); setOperacaoLeitura('visualizacao');
    try {
      const preparada = await window.ipcAPI.googleDrive.prepararVisualizacao(copiaId);
      if (!preparada.success || !preparada.data) { toast.error(preparada.error ?? 'Não foi possível preparar a visualização.'); return; }
      const rep = preparada.data.contexto.rep;
      const repData = {
        numero: rep.numero,
        data_requisicao: rep.data_requisicao,
        prazo: rep.prazo ?? undefined,
        tipo_solicitacao: rep.tipo_solicitacao ?? undefined,
        numero_documento: rep.numero_documento ?? undefined,
        data_documento: rep.data_documento ?? undefined,
        autoridade_solicitante: rep.autoridade_solicitante ?? undefined,
        data_acionamento: rep.data_acionamento ?? undefined,
        data_chegada: rep.data_chegada ?? undefined,
        data_saida: rep.data_saida ?? undefined,
        local_fato: rep.local_fato ?? undefined,
        latitude: rep.latitude?.toString(),
        longitude: rep.longitude?.toString(),
        observacoes: rep.observacoes ?? undefined,
        campos_especificos: rep.campos_especificos ?? undefined,
      };
      const contexto = {
        repData,
        solicitanteNome: preparada.data.contexto.solicitante?.nome,
        tipoExameNome: preparada.data.contexto.tipoExame.nome,
        tipoExameCodigo: preparada.data.contexto.tipoExame.codigo,
        placeholdersPersonalizados: preparada.data.contexto.placeholders,
      };
      const apresentacao = await buildPdfHeaderConfig({
        numeroRepFallback: preparada.data.contexto.rep.numero,
        usarCopiaLaudo: Boolean(preparada.data.apresentacaoJson),
        apresentacaoJson: preparada.data.apresentacaoJson,
        contexto,
        estrito: true,
      });
      let html = resolverPlaceholdersExportacao(preparada.data.html, contexto);
      if (apresentacao.cabecalhoPrimeiraPagina) html = montarCabecalhoPrimeiraPagina(apresentacao.cabecalhoPrimeiraPagina) + html;
      html = resolverPlaceholdersExportacao(html + apresentacao.fechamentoHtml, contexto);
      const pdf = await window.ipcAPI.template.previewPDF(html, undefined, apresentacao.headerTemplate || undefined, preparada.data.titulo);
      if (!pdf.success || !pdf.data) { toast.error(pdf.error ?? 'Não foi possível gerar o PDF.'); return; }
      if (urlPdf.current) URL.revokeObjectURL(urlPdf.current);
      urlPdf.current = criarUrlPdf(pdf.data); setVisualizacaoUrl(urlPdf.current); setTituloVisualizacao(preparada.data.titulo); setNumeroRepVisualizacao(copias.find(copia => copia.id === copiaId)?.numeroRep ?? '');
    } finally { setCopiaEmLeituraId(null); setOperacaoLeitura(null); }
  };
  const proximaRestauracao = useCallback(async (fila: CopiaGoogleDrive[], indice: number, resultados: { sucesso: number; falhas: string[] }) => {
    resultadosRestauracaoRef.current = resultados;
    if (cancelamentoRestauracao.current || indice >= fila.length) { setRestaurando(false); setResultadosRestauracao(resultados); return; }
    const copia = fila[indice]; setIndiceRestauracao(indice); setRestaurando(true); setCopiaEmLeituraId(copia.id);
    try {
      const resposta = await window.ipcAPI.googleDrive.analisarRestauracao(copia.id);
      if (!resposta.success || !resposta.data) { await proximaRestauracao(fila, indice + 1, { ...resultados, falhas: [...resultados.falhas, resposta.error ?? `REP ${copia.numeroRep}`] }); return; }
      if (resposta.data.previa.bloqueio) {
        await window.ipcAPI.googleDrive.cancelarRestauracao(resposta.data.operacaoId);
        await proximaRestauracao(fila, indice + 1, { ...resultados, falhas: [...resultados.falhas, resposta.data.previa.bloqueio] }); return;
      }
      setRestauracaoAtual(resposta.data);
      if (!resposta.data.previa.substituiRep) {
        const confirmar = await window.ipcAPI.googleDrive.confirmarRestauracao(resposta.data.operacaoId, false);
        setRestauracaoAtual(null);
        if (!confirmar.success) await proximaRestauracao(fila, indice + 1, { ...resultados, falhas: [...resultados.falhas, confirmar.error ?? `REP ${copia.numeroRep}`] });
        else await proximaRestauracao(fila, indice + 1, { ...resultados, sucesso: resultados.sucesso + 1 });
      }
    } finally { setCopiaEmLeituraId(null); }
  }, []);
  const iniciarRestauracao = (itens: CopiaGoogleDrive[]) => {
    if (!itens.length || restaurando) return;
    cancelamentoRestauracao.current = false; resultadosRestauracaoRef.current = { sucesso: 0, falhas: [] }; setFilaRestauracao(itens); setResultadosRestauracao(null); void proximaRestauracao(itens, 0, resultadosRestauracaoRef.current);
  };
  const confirmarSubstituicao = async () => {
    if (!restauracaoAtual || !filaRestauracao) return;
    const resposta = await window.ipcAPI.googleDrive.confirmarRestauracao(restauracaoAtual.operacaoId, true);
    setRestauracaoAtual(null);
    const resultados = resultadosRestauracaoRef.current;
    if (!resposta.success) await proximaRestauracao(filaRestauracao, indiceRestauracao + 1, { ...resultados, falhas: [...resultados.falhas, resposta.error ?? 'Falha ao restaurar a cópia.'] });
    else await proximaRestauracao(filaRestauracao, indiceRestauracao + 1, { ...resultados, sucesso: resultados.sucesso + 1 });
  };
  const cancelarRestauracao = async () => {
    cancelamentoRestauracao.current = true;
    if (restauracaoAtual) await window.ipcAPI.googleDrive.cancelarRestauracao(restauracaoAtual.operacaoId);
    setRestauracaoAtual(null);
    setRestaurando(false);
    setResultadosRestauracao(resultadosRestauracaoRef.current);
  };
  const excluir = async () => {
    if (!exclusaoIds) return;
    setExcluindo(true); const falhas: string[] = [];
    try {
      for (const id of exclusaoIds) {
        const copia = copias.find(item => item.id === id);
        if (!copia) continue;
        const resposta = await window.ipcAPI.googleDrive.moverParaLixeira(copia.id, copia.revisao);
        if (!resposta.success) falhas.push(`REP ${copia.numeroRep}: ${resposta.error ?? 'falha'}`);
      }
      setExclusaoIds(null); setSelecionadas(new Set()); await carregar(true);
      if (falhas.length) toast.error(`${falhas.length} cópia(s) e sua(s) pasta(s) não foram enviadas para a Lixeira.`); else toast.success('Cópias e suas pastas foram enviadas para a Lixeira do Google Drive.');
    } finally { setExcluindo(false); }
  };

  const todosSelecionados = copias.length > 0 && selecionadas.size === copias.length;
  const parcialmenteSelecionados = selecionadas.size > 0 && !todosSelecionados;
  const baixarVisualizacao = () => {
    if (!visualizacaoUrl) return;
    const link = document.createElement('a');
    link.href = visualizacaoUrl;
    link.download = `laudo-${numeroRepVisualizacao || 'google-drive'}.pdf`;
    link.click();
  };
  const percentualBackups = estado?.percentualBackups ?? 0;
  const classeCota = percentualBackups >= 100 ? 'bg-destructive' : percentualBackups >= 80 ? 'bg-amber-500' : 'bg-primary';
  const bloqueado = Boolean(copiaEmLeituraId) || restaurando || excluindo;

  return <div className="space-y-6 pb-8">
    <div><h1 className="text-2xl font-semibold tracking-tight">Google Drive</h1><p className="text-sm text-muted-foreground">Backups individuais protegidos na sua conta institucional.</p></div>
    {estado?.aviso && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Atenção necessária</AlertTitle><AlertDescription>{estado.aviso}</AlertDescription></Alert>}
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5" />Conta e pasta</CardTitle><CardDescription>A integração só acessa a pasta exclusiva do laWdo.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4"><div><p className="font-medium">{estado?.conectado ? estado.email : 'Nenhuma conta conectada'}</p><p className="text-sm text-muted-foreground">{estado?.caminho ?? 'Meu Drive/laWdo'}</p></div>{estado?.conectado ? <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Conectada</Badge> : <Button onClick={() => void conectar()} disabled={conectando}>{conectando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{estado?.protecaoChave === 'reconexao_necessaria' ? 'Reconectar conta institucional' : 'Conectar conta institucional'}</Button>}</div>
      <Alert><FolderLock className="h-4 w-4" /><AlertDescription>O laWdo cria e usa somente <strong>Meu Drive/laWdo</strong>. Conectar a conta não envia laudos.</AlertDescription></Alert>
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4"><ShieldCheck className="h-5 w-5 text-primary" /><div><p className="font-medium">Chave de recuperação {estado?.protecaoChave === 'protegida' ? 'protegida' : 'privada'}</p><p className="text-sm text-muted-foreground">{estado?.protecaoChave === 'protegida' ? 'Guardada na área privada do aplicativo no Google Drive.' : 'Será criada ou recuperada na área privada do Google Drive.'}</p></div></div>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Envio e armazenamento</CardTitle><CardDescription>O envio manual e automático é habilitado somente para laudos concluídos.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="flex items-center justify-between gap-4 rounded-lg border p-4"><div><p className="font-medium">Envio automático</p><p className="text-sm text-muted-foreground">Uma nova conclusão poderá substituir a cópia vigente.</p></div><Switch checked={estado?.envioAutomatico ?? false} disabled={!estado?.conectado} onCheckedChange={ativo => void alterarAutomatico(ativo)} aria-label="Ativar envio automático" /></div>
      <div className="space-y-3 rounded-lg border p-4"><div><p className="font-medium">Enviar cópia agora</p><p className="text-sm text-muted-foreground">Somente laudos concluídos por você são exibidos.</p></div><div className="flex flex-col gap-3 sm:flex-row"><Select value={laudoSelecionado} onValueChange={setLaudoSelecionado} disabled={!estado?.conectado || carregandoLaudos || enviando}><SelectTrigger className="sm:flex-1"><SelectValue placeholder={carregandoLaudos ? 'Buscando laudos concluídos...' : laudos.length ? 'Selecione um laudo concluído' : 'Nenhum laudo concluído disponível'} /></SelectTrigger><SelectContent>{laudos.map(laudo => <SelectItem key={laudo.id} value={laudo.id}>REP {laudo.numeroRep} · concluído em {new Date(laudo.concluidoEm).toLocaleDateString('pt-BR')}</SelectItem>)}</SelectContent></Select><Button disabled={!estado?.conectado || !laudoSelecionado || enviando} onClick={() => setConfirmacaoEnvioAberta(true)}>{enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Enviar cópia</Button></div>{carregandoLaudos && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Buscando laudos concluídos...</div>}</div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><div className="space-y-2 rounded-lg border p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">Cota de backups</p><span className="text-xs text-muted-foreground">{Math.round(percentualBackups)}%</span></div><p className="font-medium">{tamanho(estado?.backupsBytes)} de {tamanho(estado?.limiteBackupsBytes)}</p><Progress value={percentualBackups} indicatorClassName={classeCota} aria-label="Uso da cota de backups" /><p className="text-xs text-muted-foreground">{tamanho(estado?.backupsDisponiveisBytes)} disponíveis</p></div><div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Uso da conta</p><p className="font-medium">{tamanho(estado?.usoBytes)}{estado?.limiteBytes ? ` de ${tamanho(estado.limiteBytes)}` : ''}</p></div><div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Último envio</p><p className="font-medium">{estado?.ultimoEnvioEm ? new Date(estado.ultimoEnvioEm).toLocaleString('pt-BR') : 'Nenhum'}</p></div><div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Pendências</p><p className="font-medium">{estado?.pendencias ?? 0}</p></div><div className="rounded-lg border p-3"><p className="text-sm text-muted-foreground">Cópias disponíveis</p><p className="font-medium">{copias.length}</p></div></div>
    </CardContent></Card>
    <Card><CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle>Laudos no Drive</CardTitle><CardDescription>Integridade, visualização e restauração são executadas sem acessar outras pastas.{resumoCopias?.atualizadoEm ? ` Atualizado em ${new Date(resumoCopias.atualizadoEm).toLocaleString('pt-BR')}${resumoCopias.origem === 'cache' ? ' (cache local).' : '.'}` : ''}</CardDescription></div><Button variant="outline" size="icon" onClick={() => void carregar(true)} disabled={carregando || bloqueado} aria-label="Atualizar cópias"><RefreshCw className={carregando ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></Button></CardHeader><CardContent className="space-y-3">
      {selecionadas.size > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3"><p className="mr-auto text-sm">{selecionadas.size} cópia(s) selecionada(s)</p><Button size="sm" variant="outline" disabled={bloqueado} onClick={integridadeSelecionadas}>Integridade selecionados</Button><Button size="sm" variant="outline" disabled={bloqueado} onClick={() => iniciarRestauracao(copias.filter(copia => selecionadas.has(copia.id)))}>Restaurar selecionados</Button><Button size="sm" variant="destructive" disabled={bloqueado} onClick={() => setExclusaoIds([...selecionadas])}><Trash2 className="mr-2 h-4 w-4" />Excluir selecionados</Button></div>}
      {!estado?.conectado ? <p className="py-8 text-center text-sm text-muted-foreground">Conecte a conta institucional para consultar as cópias.</p> : copias.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Ainda não há cópias no Drive.</p> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="w-10"><Checkbox checked={todosSelecionados ? true : parcialmenteSelecionados ? 'indeterminate' : false} onCheckedChange={valor => setSelecionadas(valor ? new Set(copias.map(copia => copia.id)) : new Set())} aria-label="Selecionar todas as cópias" /></TableHead><TableHead>REP</TableHead><TableHead>Arquivo</TableHead><TableHead>Última alteração</TableHead><TableHead>Integridade</TableHead><TableHead>Tamanho</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{copias.map(copia => { const lendo = copiaEmLeituraId === copia.id; return <TableRow key={copia.id} data-state={selecionadas.has(copia.id) && 'selected'}><TableCell><Checkbox checked={selecionadas.has(copia.id)} onCheckedChange={valor => setSelecionadas(atual => { const proximo = new Set(atual); if (valor) proximo.add(copia.id); else proximo.delete(copia.id); return proximo; })} aria-label={`Selecionar REP ${copia.numeroRep}`} /></TableCell><TableCell>{copia.numeroRep || '—'}</TableCell><TableCell>{copia.nome}</TableCell><TableCell>{copia.modificadaEm ? new Date(copia.modificadaEm).toLocaleString('pt-BR') : '—'}</TableCell><TableCell>{copia.verificadaEm ? new Date(copia.verificadaEm).toLocaleString('pt-BR') : 'Nunca'}</TableCell><TableCell>{tamanho(copia.tamanho)}</TableCell><TableCell className="min-w-[420px]"><div className="flex items-center justify-end gap-2 whitespace-nowrap"><Button variant="outline" size="sm" disabled={bloqueado} onClick={() => void integridade(copia.id)}>{lendo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Integridade</Button><Button variant="outline" size="sm" disabled={bloqueado} onClick={() => void visualizar(copia.id)}>Visualizar</Button><Button variant="outline" size="sm" disabled={bloqueado} onClick={() => iniciarRestauracao([copia])}>Restaurar</Button><Button variant="ghost" size="icon" disabled={bloqueado} onClick={() => setExclusaoIds([copia.id])} aria-label={`Excluir backup da REP ${copia.numeroRep}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell></TableRow>; })}</TableBody></Table></div>}
    </CardContent></Card>
    <AlertDialog open={confirmacaoEnvioAberta} onOpenChange={setConfirmacaoEnvioAberta}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Enviar cópia ao Google Drive?</AlertDialogTitle><AlertDialogDescription>{enviando ? 'Preparando, cifrando, enviando e validando a cópia.' : copias.some(copia => copia.laudoId === laudoSelecionado) ? 'A cópia vigente será substituída depois da validação da nova cópia.' : 'O laWdo criará uma cópia cifrada na pasta exclusiva Meu Drive/laWdo.'}</AlertDialogDescription></AlertDialogHeader>{enviando && <div className="space-y-2" aria-live="polite"><Progress value={null} /><p className="text-sm text-muted-foreground">Aguarde até a confirmação da integridade.</p></div>}<AlertDialogFooter><AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={enviando} onClick={evento => { evento.preventDefault(); void enviarLaudo(); }}>{enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{enviando ? 'Enviando...' : 'Enviar cópia'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={operacaoLeitura !== null}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{operacaoLeitura === 'integridade' ? 'Conferindo integridade' : 'Preparando visualização'}</AlertDialogTitle><AlertDialogDescription>{operacaoLeitura === 'integridade' ? 'Baixando, decifrando e validando a cópia sem alterar dados locais.' : 'Baixando, decifrando e validando a cópia antes de gerar o PDF.'}</AlertDialogDescription></AlertDialogHeader><div className="space-y-2 text-sm text-muted-foreground" aria-live="polite"><div className="flex items-center gap-3"><Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" /><span>{operacaoLeitura === 'integridade' && progressoLeitura ? `Conferindo ${progressoLeitura.atual} de ${progressoLeitura.total} · ${segundosLeitura}s decorridos.` : 'Aguarde a conclusão desta etapa.'}</span></div>{operacaoLeitura === 'integridade' && progressoDownload && <p>Recebidos: {tamanho(progressoDownload.recebidos)}{progressoDownload.total ? ` de ${tamanho(progressoDownload.total)}` : ''}.</p>}</div>{operacaoLeitura === 'integridade' && <AlertDialogFooter><Button variant="outline" onClick={() => void cancelarIntegridade()}>Cancelar verificação</Button></AlertDialogFooter>}</AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(filaRestauracao)} onOpenChange={aberto => { if (!aberto) void cancelarRestauracao(); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Restaurando backups</AlertDialogTitle><AlertDialogDescription>{filaRestauracao ? `Processando ${Math.min(indiceRestauracao + 1, filaRestauracao.length)} de ${filaRestauracao.length} cópia(s).` : ''}</AlertDialogDescription></AlertDialogHeader><div className="space-y-2" aria-live="polite"><Progress value={filaRestauracao ? (indiceRestauracao / filaRestauracao.length) * 100 : 0} /><p className="text-sm text-muted-foreground">{restauracaoAtual?.previa.substituiRep ? `A REP ${restauracaoAtual.previa.numeroRep} existe nesta instalação e precisa de confirmação.` : restaurando ? 'Conferindo a cópia, preparando figuras e gravando os dados com segurança.' : resultadosRestauracao ? `${resultadosRestauracao.sucesso} restaurada(s); ${resultadosRestauracao.falhas.length} falha(s).` : 'Preparando operação.'}</p>{resultadosRestauracao && resultadosRestauracao.falhas.length > 0 && <p className="text-sm text-destructive">{resultadosRestauracao.falhas.join(' ')}</p>}</div><AlertDialogFooter>{restauracaoAtual?.previa.substituiRep ? <><AlertDialogCancel onClick={() => void cancelarRestauracao()}>Cancelar fila</AlertDialogCancel><AlertDialogAction onClick={evento => { evento.preventDefault(); void confirmarSubstituicao(); }}>Substituir e continuar</AlertDialogAction></> : resultadosRestauracao ? <AlertDialogAction onClick={() => { setFilaRestauracao(null); setResultadosRestauracao(null); void carregar(true); }}>Concluir</AlertDialogAction> : <AlertDialogCancel onClick={() => void cancelarRestauracao()}>Cancelar após item atual</AlertDialogCancel>}</AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(exclusaoIds)} onOpenChange={aberto => { if (!aberto && !excluindo) setExclusaoIds(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Enviar backups para a Lixeira?</AlertDialogTitle><AlertDialogDescription>{exclusaoIds?.length ?? 0} cópia(s) e sua(s) pasta(s) exclusivas serão enviadas para a Lixeira do Google Drive. A chave privada de recuperação e os demais arquivos serão preservados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={excluindo} onClick={evento => { evento.preventDefault(); void excluir(); }}>{excluindo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Enviar para a Lixeira</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Dialog open={Boolean(visualizacaoUrl)} onOpenChange={aberto => { if (!aberto) { if (urlPdf.current) URL.revokeObjectURL(urlPdf.current); urlPdf.current = null; setVisualizacaoUrl(null); } }}><DialogContent className="flex h-[95vh] w-[1000px] max-w-[90vw] flex-col overflow-hidden p-0"><DialogHeader className="border-b p-4"><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Pré-visualização do Laudo (PDF){numeroRepVisualizacao && <span className="text-muted-foreground">· REP {numeroRepVisualizacao}</span>}</DialogTitle></DialogHeader><div className="flex-1 bg-slate-100 dark:bg-slate-800">{visualizacaoUrl && <iframe title={tituloVisualizacao} src={visualizacaoUrl} className="h-full w-full border-0" onError={() => toast.error('Não foi possível abrir a prévia. Baixe o PDF para visualizá-lo.')} />}</div><div className="flex justify-end gap-2 border-t bg-background p-4"><Button variant="outline" onClick={baixarVisualizacao} disabled={!visualizacaoUrl}><Download className="mr-2 h-4 w-4" />Baixar PDF</Button><Button variant="outline" onClick={() => { if (urlPdf.current) URL.revokeObjectURL(urlPdf.current); urlPdf.current = null; setVisualizacaoUrl(null); }}>Fechar</Button></div></DialogContent></Dialog>
  </div>;
}
