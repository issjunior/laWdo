import { MENSAGEM_FALHA_CONSULTA_GDL } from '@/lib/consulta-reps-coleta';
import { esquemaConsultaIdentificacaoRepGdl } from '@shared/gdl/natureza-exame';
import { useEffect, useMemo, useState, useRef } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ChevronDown, Loader2, RefreshCw, TriangleAlert, WifiOff } from 'lucide-react'
import type { PreviaAtualizacaoRepGdl, ResultadoAtualizacaoRepGdl } from '@shared/types/atualizacao-rep-gdl.types'

interface AtualizarRepGdlDialogProps {
  open: boolean
  repId: string | null
  onOpenChange: (open: boolean) => void
  onConcluida: (resultado: ResultadoAtualizacaoRepGdl) => void
}

function previaAtualizacaoValida(valor: unknown): valor is PreviaAtualizacaoRepGdl {
  if (!valor || typeof valor !== 'object') return false
  const previa = valor as Record<string, unknown>
  if (previa.consultaDetalhes !== undefined && !esquemaConsultaIdentificacaoRepGdl.safeParse(previa.consultaDetalhes).success) return false
  return typeof previa.operacaoId === 'string'
    && typeof previa.repId === 'string'
    && typeof previa.repNumero === 'string'
    && typeof previa.codigoExame === 'string'
    && Array.isArray(previa.diferencas)
    && previa.diferencas.every(diferenca => (
      typeof diferenca === 'object' && diferenca !== null
      && typeof (diferenca as Record<string, unknown>).id === 'string'
      && typeof (diferenca as Record<string, unknown>).grupo === 'string'
      && typeof (diferenca as Record<string, unknown>).selecionadaPorPadrao === 'boolean'
      && (typeof (diferenca as Record<string, unknown>).resumo === 'undefined' || typeof (diferenca as Record<string, unknown>).resumo === 'string')
      && (typeof (diferenca as Record<string, unknown>).detalhes === 'undefined' || (
        Array.isArray((diferenca as Record<string, unknown>).detalhes)
        && ((diferenca as Record<string, unknown>).detalhes as unknown[]).every(detalhe => (
          typeof detalhe === 'object' && detalhe !== null
          && typeof (detalhe as Record<string, unknown>).campo === 'string'
          && typeof (detalhe as Record<string, unknown>).valorLocal === 'string'
          && typeof (detalhe as Record<string, unknown>).valorGdl === 'string'
        ))
      ))
    ))
}

export function AtualizarRepGdlDialog({ open, repId, onOpenChange, onConcluida }: AtualizarRepGdlDialogProps) {
  const geracaoConsulta = useRef(0)
  const [previa, setPrevia] = useState<PreviaAtualizacaoRepGdl | null>(null)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false)
  const [reabrirLaudo, setReabrirLaudo] = useState(false)
  const [tentativaConsulta, setTentativaConsulta] = useState(0)
  const [detalhesAbertos, setDetalhesAbertos] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open || !repId) return
    const geracao = ++geracaoConsulta.current
    let ativa = true
    setPrevia(null); setErro(null); setReabrirLaudo(false); setDetalhesAbertos(new Set()); setCarregando(true)
    void window.ipcAPI.gdl.prepararAtualizacaoRep(repId).then(resposta => {
      if (!ativa || geracao !== geracaoConsulta.current) return
      if (!resposta.success || !previaAtualizacaoValida(resposta.data)) { setErro(resposta.error || 'Não foi possível consultar a REP no GDL.'); return }
      const dados = resposta.data
      setPrevia(dados)
      setSelecionadas(new Set(dados.diferencas.filter(diferenca => diferenca.selecionadaPorPadrao).map(diferenca => diferenca.id)))
    }).catch(() => { if (ativa) setErro('Não foi possível consultar a REP no GDL.') }).finally(() => { if (ativa) setCarregando(false) })
    return () => { ativa = false; geracaoConsulta.current += 1; void window.ipcAPI.gdl.descartarConsultaRep?.().catch(() => undefined) }
  }, [open, repId, tentativaConsulta])

  const grupos = useMemo(() => {
    const resultado = new Map<string, PreviaAtualizacaoRepGdl['diferencas']>()
    previa?.diferencas.forEach(diferenca => resultado.set(diferenca.grupo, [...(resultado.get(diferenca.grupo) || []), diferenca]))
    return [...resultado.entries()]
  }, [previa])

  const alternar = (id: string, marcado: boolean) => setSelecionadas(atuais => {
    const proximas = new Set(atuais)
    if (marcado) proximas.add(id); else proximas.delete(id)
    return proximas
  })

  const alternarDetalhes = (id: string, aberto: boolean) => setDetalhesAbertos(atuais => {
    const proximos = new Set(atuais)
    if (aberto) proximos.add(id); else proximos.delete(id)
    return proximos
  })

  const aplicar = async () => {
    if (!previa) return
    setConfirmacaoAberta(false); setAplicando(true); setErro(null)
    try {
      const resposta = await window.ipcAPI.gdl.aplicarAtualizacaoRep({ operacaoId: previa.operacaoId, diferencasSelecionadas: [...selecionadas], reabrirLaudo })
      if (!resposta.success || !resposta.data) { setErro(resposta.error || 'Não foi possível aplicar a atualização.'); return }
      onOpenChange(false)
      onConcluida(resposta.data)
    } catch { setErro('Não foi possível aplicar a atualização.') } finally { setAplicando(false) }
  }

  const completarDetalhes = async (abrir: boolean) => {
    if (!repId || !previa?.consultaDetalhes) return
    const geracao = geracaoConsulta.current
    setCarregando(true); setErro(null)
    try {
      const resposta = await window.ipcAPI.gdl.completarAtualizacaoRep(repId, previa.consultaDetalhes.consultaId, abrir)
      if (geracao !== geracaoConsulta.current) return
      if (!resposta.success || !previaAtualizacaoValida(resposta.data)) throw new Error(resposta.error || 'Falha ao concluir a consulta.')
      setPrevia(resposta.data)
      setSelecionadas(new Set(resposta.data.diferencas.filter(item => item.selecionadaPorPadrao).map(item => item.id)))
    } catch (erro: unknown) { if (geracao === geracaoConsulta.current) setErro(erro instanceof Error ? erro.message : 'Falha ao concluir a consulta.') }
    finally { if (geracao === geracaoConsulta.current) setCarregando(false) }
  }

  const requerReabertura = Boolean(previa?.impactoLaudo?.requerReabertura)
  const semDiferencas = previa?.diferencas.length === 0
  const podeReconciliarLaudo = Boolean(semDiferencas && previa?.impactoLaudo)
  const podeConfirmar = !previa?.consultaDetalhes && (selecionadas.size > 0 || podeReconciliarLaudo) && (!requerReabertura || reabrirLaudo)
  useEffect(() => {
    if (erro) void window.ipcAPI.logWarning('gdl', `Falha na atualização manual da REP: ${erro}`);
  }, [erro]);
  const mensagemErro = erro ? { titulo: 'Não foi possível atualizar a REP', descricao: MENSAGEM_FALHA_CONSULTA_GDL } : null

  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><RefreshCw className="size-5" />Atualizar REP pelo GDL</DialogTitle>
          <DialogDescription>{previa ? `REP ${previa.repNumero} · ${previa.codigoExame}` : erro ? 'A consulta ao GDL não pôde ser concluída.' : 'Consultando informações atualizadas no GDL.'}</DialogDescription>
        </DialogHeader>
        {previa?.consultaDetalhes && !carregando && <Alert>
          <AlertTitle>Consulta detalhada da REP</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{previa.consultaDetalhes.detalhes?.motivoConfirmacao}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void completarDetalhes(true)}>Continuar e abrir detalhes</Button>
              <Button variant="outline" onClick={() => void completarDetalhes(false)}>Usar somente dados da API</Button>
            </div>
          </AlertDescription>
        </Alert>}
        {carregando && <div className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Consultando o GDL...</div>}
        {mensagemErro && <Alert variant="destructive">
          <WifiOff className="size-4" />
          <AlertTitle>{mensagemErro.titulo}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{mensagemErro.descricao}</p>
            <Button variant="outline" size="sm" onClick={() => setTentativaConsulta(atual => atual + 1)} disabled={carregando || aplicando}>
              <RefreshCw className="mr-2 size-4" />Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>}
        {previa && !previa.consultaDetalhes && <div className="space-y-5">
          {previa.avisos.map(aviso => <Alert key={aviso}><AlertDescription>{aviso}</AlertDescription></Alert>)}
          {semDiferencas ? <Alert><AlertDescription>{podeReconciliarLaudo ? 'A REP já está atualizada. Você ainda pode reconciliar a estrutura do laudo vinculado com os dados locais.' : 'A REP já está atualizada com as informações retornadas pelo GDL.'}</AlertDescription></Alert> : grupos.map(([grupo, diferencas]) => <section key={grupo} className="space-y-2"><h3 className="text-sm font-semibold">{grupo}</h3><div className="divide-y rounded-md border">{diferencas.map(diferenca => {
            const possuiDetalhes = Boolean(diferenca.detalhes?.length)
            const detalhesAbertosParaDiferenca = detalhesAbertos.has(diferenca.id)
            return <div key={diferenca.id} className="p-3">
              <div className="flex gap-3">
                <Checkbox
                  id={`diferenca-${diferenca.id}`}
                  checked={selecionadas.has(diferenca.id)}
                  onCheckedChange={valor => alternar(diferenca.id, valor === true)}
                />
                <div className="min-w-0 flex-1">
                  <label htmlFor={`diferenca-${diferenca.id}`} className="block cursor-pointer font-medium">{diferenca.rotulo}</label>
                  {diferenca.resumo && <span className="block text-xs text-muted-foreground">{diferenca.resumo}</span>}
                  <span className="block text-xs text-muted-foreground">Local: {diferenca.valorLocal}</span>
                  <span className="block text-xs text-primary">GDL: {diferenca.valorGdl}</span>
                  {possuiDetalhes && <Collapsible open={detalhesAbertosParaDiferenca} onOpenChange={aberto => alternarDetalhes(diferenca.id, aberto)} className="mt-2">
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" size="sm" className="h-auto px-0 text-xs">
                        {detalhesAbertosParaDiferenca ? 'Ocultar alterações' : 'Ver alterações'}
                        <ChevronDown className="ml-1 size-3" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 overflow-hidden rounded-md border bg-background text-xs">
                      <div className="hidden grid-cols-[minmax(8rem,auto)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b bg-muted/50 px-3 py-2 font-medium text-muted-foreground sm:grid">
                        <span>Campo</span>
                        <span>Dado local</span>
                        <span>Dados do GDL</span>
                      </div>
                      <div className="divide-y">
                        {diferenca.detalhes?.map(detalhe => <div key={detalhe.campo} className="grid gap-2 p-3 sm:grid-cols-[minmax(8rem,auto)_minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
                          <span className="font-medium text-foreground">{detalhe.campo}</span>
                          <div className="rounded-md bg-muted/60 px-2 py-1.5 text-muted-foreground">
                            <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">Dado local</span>
                            {detalhe.valorLocal}
                          </div>
                          <div className="rounded-md border border-primary/15 bg-primary/5 px-2 py-1.5 text-primary">
                            <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-primary/70 sm:hidden">Dados do GDL</span>
                            {detalhe.valorGdl}
                          </div>
                        </div>)}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>}
                </div>
              </div>
            </div>
          })}</div></section>)}
          {requerReabertura && <Alert className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"><TriangleAlert className="size-4" /><AlertDescription className="space-y-3"><p>O laudo vinculado está {previa.impactoLaudo?.status}. Para aplicar a atualização, ele voltará para Em andamento; as datas já registradas serão preservadas no histórico.</p><label className="flex items-center gap-2"><Checkbox checked={reabrirLaudo} onCheckedChange={valor => setReabrirLaudo(valor === true)} />Confirmo a reabertura do laudo.</label></AlertDescription></Alert>}
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onOpenChange(false)} disabled={aplicando}>Cancelar</Button><Button onClick={() => setConfirmacaoAberta(true)} disabled={!podeConfirmar || aplicando}>{aplicando ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}{podeReconciliarLaudo ? 'Reconciliar laudo' : 'Aplicar atualização'}</Button></div>
        </div>}
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmacaoAberta} onOpenChange={setConfirmacaoAberta}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{podeReconciliarLaudo ? 'Confirmar reconciliação do laudo' : 'Confirmar atualização pelo GDL'}</AlertDialogTitle><AlertDialogDescription>{podeReconciliarLaudo ? 'A REP não será alterada. As seções derivadas do laudo serão recompostas a partir dos dados locais, preservando as demais edições.' : 'Os dados selecionados substituirão os valores locais. Se houver laudo vinculado, as seções derivadas impactadas serão regeneradas e figuras nelas inseridas continuarão disponíveis no painel de ilustrações.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={aplicando}>Voltar</AlertDialogCancel><AlertDialogAction onClick={() => void aplicar()} disabled={aplicando}>{podeReconciliarLaudo ? 'Confirmar reconciliação' : 'Confirmar atualização'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </>
}
