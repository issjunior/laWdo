import React, { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckSquare, Image as ImageIcon, ImageDown, Loader2, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ArquivoRepGdl, DuplicataImagemRepGdl, ImagemRepGdlAdicionadaAoLaudo } from '@shared/types/gdl-arquivos.types'

interface GdlImagensRepModalProps {
  aberto: boolean
  laudoId: string
  onAbertoChange: (aberto: boolean) => void
  onCapturadas: (imagens: ImagemRepGdlAdicionadaAoLaudo[], permitirDuplicadas: boolean) => void
}

interface DuplicataComMiniaturas extends DuplicataImagemRepGdl {
  miniaturaSelecionada?: string
  miniaturaExistente?: string
}

interface DadosSessaoImagens {
  sessaoId: string
  ambiente: 'homologacao' | 'producao'
  numeroRep: string
  anoRep: string
  arquivos: ArquivoRepGdl[]
}

function dadosSessaoImagensValidos(valor: unknown): valor is DadosSessaoImagens {
  if (!valor || typeof valor !== 'object') return false
  const dados = valor as Record<string, unknown>
  return typeof dados.sessaoId === 'string'
    && dados.sessaoId.length > 0
    && (dados.ambiente === 'homologacao' || dados.ambiente === 'producao')
    && typeof dados.numeroRep === 'string'
    && dados.numeroRep.trim().length > 0
    && typeof dados.anoRep === 'string'
    && /^\d{4}$/.test(dados.anoRep)
    && Array.isArray(dados.arquivos)
}

function formatarTamanho(tamanho: number | null): string {
  if (tamanho === null) return 'Tamanho não informado'
  if (tamanho < 1024) return `${tamanho} bytes`
  if (tamanho < 1024 * 1024) return `${(tamanho / 1024).toFixed(1)} KB`
  return `${(tamanho / (1024 * 1024)).toFixed(1)} MB`
}

export const GdlImagensRepModal: React.FC<GdlImagensRepModalProps> = ({ aberto, laudoId, onAbertoChange, onCapturadas }) => {
  const [arquivos, setArquivos] = useState<ArquivoRepGdl[]>([])
  const [sessaoId, setSessaoId] = useState<string | null>(null)
  const sessaoIdRef = useRef<string | null>(null)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(false)
  const [capturando, setCapturando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [identificacaoRep, setIdentificacaoRep] = useState<Omit<DadosSessaoImagens, 'sessaoId' | 'arquivos'> | null>(null)
  const [duplicadasPendentes, setDuplicadasPendentes] = useState<DuplicataComMiniaturas[]>([])

  useEffect(() => {
    if (!aberto) return
    let ativo = true
    setCarregando(true)
    setErro(null)
    setSelecionadas(new Set())
    setSessaoId(null)
    setIdentificacaoRep(null)
    sessaoIdRef.current = null
    void window.ipcAPI.gdl.listarImagensLaudo(laudoId).then(resultado => {
      if (!ativo) {
        if (resultado.success && dadosSessaoImagensValidos(resultado.data)) void window.ipcAPI.gdl.fecharSessaoImagensLaudo(laudoId, resultado.data.sessaoId)
        return
      }
      if (!resultado.success || !dadosSessaoImagensValidos(resultado.data)) {
        setErro(resultado.error || 'Não foi possível carregar a Lista de Fotos da REP.')
        return
      }
      setSessaoId(resultado.data.sessaoId)
      sessaoIdRef.current = resultado.data.sessaoId
      setIdentificacaoRep({
        ambiente: resultado.data.ambiente,
        numeroRep: resultado.data.numeroRep,
        anoRep: resultado.data.anoRep,
      })
      setArquivos(resultado.data.arquivos)
    }).catch(error => {
      if (ativo) setErro(error instanceof Error ? error.message : 'Não foi possível carregar a Lista de Fotos da REP.')
    }).finally(() => {
      if (ativo) setCarregando(false)
    })
    return () => {
      ativo = false
      if (sessaoIdRef.current) void window.ipcAPI.gdl.fecharSessaoImagensLaudo(laudoId, sessaoIdRef.current)
      sessaoIdRef.current = null
    }
  }, [aberto, laudoId])

  const alternarSelecao = (idSelecao: string) => {
    setSelecionadas(atuais => {
      const proximas = new Set(atuais)
      if (proximas.has(idSelecao)) proximas.delete(idSelecao)
      else proximas.add(idSelecao)
      return proximas
    })
  }

  const idsElegiveis = arquivos.filter(arquivo => arquivo.provavelImagem && !arquivo.status).map(arquivo => arquivo.idSelecao)
  const todasElegiveisSelecionadas = idsElegiveis.length > 0 && idsElegiveis.every(idSelecao => selecionadas.has(idSelecao))

  const alternarTodasSelecoes = () => {
    setSelecionadas(todasElegiveisSelecionadas ? new Set() : new Set(idsElegiveis))
  }

  const prepararDuplicadas = async (duplicadas: DuplicataImagemRepGdl[]): Promise<DuplicataComMiniaturas[]> => {
    const miniaturasPorId = new Map<string, string>()
    for (let indice = 0; indice < duplicadas.length; indice += 30) {
      const ids = duplicadas.slice(indice, indice + 30).map(duplicada => duplicada.imagemExistenteId)
      const resultado = await window.ipcAPI.ilustracoes.obterMiniaturas(laudoId, ids)
      if (!resultado.success) continue
      for (const miniatura of resultado.data || []) miniaturasPorId.set(miniatura.id, miniatura.thumbnailDataUri)
    }
    const selecionadasPorId = new Map(arquivos.map(arquivo => [arquivo.idSelecao, arquivo.thumbnailDataUri]))
    return duplicadas.map(duplicada => ({
      ...duplicada,
      miniaturaSelecionada: selecionadasPorId.get(duplicada.idSelecao),
      miniaturaExistente: miniaturasPorId.get(duplicada.imagemExistenteId),
    }))
  }

  const capturar = async (idsSelecao = [...selecionadas], permitirDuplicadas = false) => {
    if (idsSelecao.length === 0 || !sessaoId) return
    setCapturando(true)
    try {
      const resultado = await window.ipcAPI.gdl.capturarImagensLaudo(laudoId, sessaoId, idsSelecao, permitirDuplicadas)
      if (!resultado.success || !resultado.data) {
        setErro(resultado.error || 'Não foi possível capturar as imagens selecionadas.')
        return
      }
      onCapturadas(resultado.data.imagens, permitirDuplicadas)
      if (resultado.data.duplicadas.length > 0 && !permitirDuplicadas) {
        setDuplicadasPendentes(await prepararDuplicadas(resultado.data.duplicadas))
        return
      }
      if (resultado.data.falhas.length > 0) {
        toast.warning(`${resultado.data.imagens.length} imagem(ns) capturada(s); ${resultado.data.falhas.length} falharam.`)
      } else {
        toast.success(`${resultado.data.imagens.length} imagem(ns) adicionada(s) ao painel.`)
      }
      if (resultado.data.imagens.length > 0) onAbertoChange(false)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível capturar as imagens selecionadas.')
    } finally {
      setCapturando(false)
    }
  }

  return (
    <>
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ImageDown className="h-5 w-5 text-primary" />Lista de Fotos da REP</DialogTitle>
          <DialogDescription>Somente as fotos da galeria do GDL são consideradas. Vídeos e anexos são ignorados.</DialogDescription>
        </DialogHeader>
        {identificacaoRep && (
          <Alert variant={identificacaoRep.ambiente === 'producao' ? 'destructive' : 'default'}>
            <AlertDescription>
              Ambiente: <strong>{identificacaoRep.ambiente === 'producao' ? 'Produção' : 'Homologação'}</strong>
              {' · '}REP: <strong>{identificacaoRep.numeroRep}/{identificacaoRep.anoRep}</strong>
            </AlertDescription>
          </Alert>
        )}
        {!carregando && !erro && idsElegiveis.length > 0 && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={alternarTodasSelecoes} disabled={capturando}>
              {todasElegiveisSelecionadas ? <Square className="mr-2 h-4 w-4" /> : <CheckSquare className="mr-2 h-4 w-4" />}
              {todasElegiveisSelecionadas ? 'Desmarcar todas' : 'Selecionar todas'}
            </Button>
          </div>
        )}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {carregando && <div className="grid grid-cols-2 gap-3 py-2 sm:grid-cols-3">{Array.from({ length: 6 }, (_, indice) => <Skeleton key={indice} className="h-36 w-full" />)}</div>}
          {erro && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{erro}</AlertDescription></Alert>}
          {!carregando && !erro && arquivos.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">A Lista de Fotos da REP está vazia.</p>}
          {!carregando && !erro && arquivos.map(arquivo => {
            const elegivel = arquivo.provavelImagem && !arquivo.status
            return <label key={arquivo.idSelecao} className={`group flex gap-3 rounded-md border p-2 transition-colors ${elegivel ? 'cursor-pointer hover:bg-accent' : 'opacity-70'} ${selecionadas.has(arquivo.idSelecao) ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <Checkbox className="mt-1" checked={selecionadas.has(arquivo.idSelecao)} disabled={!elegivel || capturando} onCheckedChange={() => alternarSelecao(arquivo.idSelecao)} />
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {arquivo.thumbnailDataUri ? <img src={arquivo.thumbnailDataUri} alt={`Prévia de ${arquivo.nomeArquivo}`} className="h-full w-full object-contain" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" aria-label="Prévia indisponível" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <span className="block truncate text-sm font-medium">{arquivo.nomeArquivo}</span>
                  <p className="text-xs text-muted-foreground">{formatarTamanho(arquivo.tamanho)}{arquivo.dataUpload ? ` · ${new Date(arquivo.dataUpload).toLocaleString('pt-BR')}` : ''}</p>
                  {!arquivo.thumbnailDataUri && elegivel && <p className="text-xs text-muted-foreground">Prévia indisponível</p>}
                  {arquivo.status && <p className="text-xs text-muted-foreground">{arquivo.status}</p>}
                </div>
              </div>
            </label>
          })}
        </div>
        <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => onAbertoChange(false)} disabled={capturando}>Cancelar</Button><Button onClick={() => void capturar()} disabled={capturando || selecionadas.size === 0}>{capturando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Capturar imagens ({selecionadas.size})</Button></div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={duplicadasPendentes.length > 0} onOpenChange={aberto => { if (!aberto) setDuplicadasPendentes([]) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Foto já incluída no laudo</AlertDialogTitle>
          <AlertDialogDescription>
            {duplicadasPendentes.length === 1
              ? 'A foto selecionada já está armazenada neste laudo.'
              : `${duplicadasPendentes.length} fotos selecionadas já estão armazenadas neste laudo.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="max-h-64 space-y-3 overflow-y-auto text-sm text-muted-foreground">
          {duplicadasPendentes.map(duplicada => (
            <li key={duplicada.idSelecao} className="rounded-md border p-2">
              <p><span className="font-medium text-foreground">{duplicada.nomeArquivo}</span>: já está em {duplicada.localizacao === 'painel' ? 'Painel de ilustrações' : 'Figuras inseridas no laudo'}.</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div><span className="mb-1 block">Selecionada agora</span><div className="flex h-20 items-center justify-center overflow-hidden rounded border bg-muted">{duplicada.miniaturaSelecionada ? <img src={duplicada.miniaturaSelecionada} alt="Foto selecionada agora" className="h-full w-full object-contain" /> : <ImageIcon className="h-4 w-4" />}</div></div>
                <div><span className="mb-1 block">Já incluída</span><div className="flex h-20 items-center justify-center overflow-hidden rounded border bg-muted">{duplicada.miniaturaExistente ? <img src={duplicada.miniaturaExistente} alt="Foto já incluída" className="h-full w-full object-contain" /> : <ImageIcon className="h-4 w-4" />}</div></div>
              </div>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Não adicionar repetidas</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            const ids = duplicadasPendentes.map(duplicada => duplicada.idSelecao)
            setDuplicadasPendentes([])
            void capturar(ids, true)
          }}>Adicionar mesmo assim</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
