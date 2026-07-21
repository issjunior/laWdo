import React, { useEffect, useState } from 'react'
import { AlertCircle, CheckSquare, Image as ImageIcon, ImageDown, Loader2, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { ArquivoRepGdl, ImagemRepGdlCapturada } from '@shared/types/gdl-arquivos.types'

interface GdlImagensRepModalProps {
  aberto: boolean
  laudoId: string
  onAbertoChange: (aberto: boolean) => void
  onCapturadas: (imagens: ImagemRepGdlCapturada[]) => void
}

function formatarTamanho(tamanho: number | null): string {
  if (tamanho === null) return 'Tamanho não informado'
  if (tamanho < 1024) return `${tamanho} bytes`
  if (tamanho < 1024 * 1024) return `${(tamanho / 1024).toFixed(1)} KB`
  return `${(tamanho / (1024 * 1024)).toFixed(1)} MB`
}

export const GdlImagensRepModal: React.FC<GdlImagensRepModalProps> = ({ aberto, laudoId, onAbertoChange, onCapturadas }) => {
  const [arquivos, setArquivos] = useState<ArquivoRepGdl[]>([])
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(false)
  const [capturando, setCapturando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    let ativo = true
    setCarregando(true)
    setErro(null)
    setSelecionadas(new Set())
    void window.ipcAPI.gdl.listarImagensLaudo(laudoId).then(resultado => {
      if (!ativo) return
      if (!resultado.success || !resultado.data) {
        setErro(resultado.error || 'Não foi possível carregar a Lista de Fotos da REP.')
        return
      }
      setArquivos(resultado.data)
    }).catch(error => {
      if (ativo) setErro(error instanceof Error ? error.message : 'Não foi possível carregar a Lista de Fotos da REP.')
    }).finally(() => {
      if (ativo) setCarregando(false)
    })
    return () => { ativo = false }
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

  const capturar = async () => {
    if (selecionadas.size === 0) return
    setCapturando(true)
    try {
      const resultado = await window.ipcAPI.gdl.capturarImagensLaudo(laudoId, [...selecionadas])
      if (!resultado.success || !resultado.data) {
        setErro(resultado.error || 'Não foi possível capturar as imagens selecionadas.')
        return
      }
      onCapturadas(resultado.data.imagens)
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
    <Dialog open={aberto} onOpenChange={onAbertoChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ImageDown className="h-5 w-5 text-primary" />Lista de Fotos da REP</DialogTitle>
          <DialogDescription>Somente as fotos da galeria do GDL são consideradas. Vídeos e anexos são ignorados.</DialogDescription>
        </DialogHeader>
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
            return <label key={arquivo.idSelecao} className={`group flex gap-3 rounded-md border p-2 transition-colors ${elegivel ? 'cursor-pointer hover:bg-accent' : 'opacity-70'} ${selecionadas.has(arquivo.idSelecao) ? 'border-primary ring-2 ring-ring' : 'border-border'}`}>
              <Checkbox className="mt-1" checked={selecionadas.has(arquivo.idSelecao)} disabled={!elegivel || capturando} onCheckedChange={() => alternarSelecao(arquivo.idSelecao)} />
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {arquivo.thumbnailDataUri ? <img src={arquivo.thumbnailDataUri} alt={`Prévia de ${arquivo.nomeArquivo}`} className="h-full w-full object-contain" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" aria-label="Prévia indisponível" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-medium">{arquivo.nomeArquivo}</span><Badge variant={arquivo.provavelImagem ? 'secondary' : 'outline'}>Lista de Fotos</Badge></div>
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
  )
}
