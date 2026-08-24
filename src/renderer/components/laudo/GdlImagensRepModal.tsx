import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckSquare, Image as ImageIcon, ImageDown, Loader2, Minus, Plus, Search, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

type FiltroFotos = 'elegiveis' | 'inelegiveis'
type OrdenacaoFotos = 'nome-crescente' | 'nome-decrescente' | 'tamanho-decrescente' | 'tamanho-crescente' | 'data-mais-recente'
type ColunasGradeFotos = 1 | 2 | 3 | 4

const CLASSES_COLUNAS_GRADE: Record<ColunasGradeFotos, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
}

const PROXIMAS_COLUNAS_GRADE: Record<ColunasGradeFotos, Record<-1 | 1, ColunasGradeFotos>> = {
  1: { '-1': 1, 1: 2 },
  2: { '-1': 1, 1: 3 },
  3: { '-1': 2, 1: 4 },
  4: { '-1': 3, 1: 4 },
}

function filtroFotosValido(valor: string): valor is FiltroFotos {
  return valor === 'elegiveis' || valor === 'inelegiveis'
}

function ordenacaoFotosValida(valor: string): valor is OrdenacaoFotos {
  return valor === 'nome-crescente' || valor === 'nome-decrescente' || valor === 'tamanho-decrescente' || valor === 'tamanho-crescente' || valor === 'data-mais-recente'
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

function formatarNumeroRep(numero: string, ano: string): string {
  const digitos = `${numero}${ano}`.replace(/\D/g, '').slice(0, 10)
  if (digitos.length <= 4) return digitos

  const anoFormatado = digitos.slice(-4)
  const numeroRep = digitos.slice(0, -4)
  const numeroFormatado = numeroRep.length > 3
    ? `${numeroRep.slice(0, -3)}.${numeroRep.slice(-3)}`
    : numeroRep

  return `${numeroFormatado}-${anoFormatado}`
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
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroFotos>('elegiveis')
  const [ordenacao, setOrdenacao] = useState<OrdenacaoFotos>('nome-crescente')
  const [colunasGrade, setColunasGrade] = useState<ColunasGradeFotos>(2)

  useEffect(() => {
    if (!aberto) return
    let ativo = true
    setCarregando(true)
    setErro(null)
    setSelecionadas(new Set())
    setSessaoId(null)
    setIdentificacaoRep(null)
    setBusca('')
    setFiltro('elegiveis')
    setOrdenacao('nome-crescente')
    setColunasGrade(2)
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

  const arquivosVisiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    const resultado = arquivos.filter(arquivo => {
      const elegivel = arquivo.provavelImagem && !arquivo.status
      return (!termo || arquivo.nomeArquivo.toLocaleLowerCase('pt-BR').includes(termo))
        && (filtro === 'elegiveis' ? elegivel : !elegivel)
    })

    return resultado.sort((primeiro, segundo) => {
      if (ordenacao === 'tamanho-decrescente') return (segundo.tamanho ?? -1) - (primeiro.tamanho ?? -1)
      if (ordenacao === 'tamanho-crescente') return (primeiro.tamanho ?? Number.MAX_SAFE_INTEGER) - (segundo.tamanho ?? Number.MAX_SAFE_INTEGER)
      if (ordenacao === 'data-mais-recente') return (Date.parse(segundo.dataUpload || '') || 0) - (Date.parse(primeiro.dataUpload || '') || 0)
      const comparacao = primeiro.nomeArquivo.localeCompare(segundo.nomeArquivo, 'pt-BR', { numeric: true, sensitivity: 'base' })
      return ordenacao === 'nome-decrescente' ? -comparacao : comparacao
    })
  }, [arquivos, busca, filtro, ordenacao])

  const idsElegiveisVisiveis = arquivosVisiveis.filter(arquivo => arquivo.provavelImagem && !arquivo.status).map(arquivo => arquivo.idSelecao)
  const todasElegiveisSelecionadas = idsElegiveisVisiveis.length > 0 && idsElegiveisVisiveis.every(idSelecao => selecionadas.has(idSelecao))

  const alternarTodasSelecoes = () => {
    setSelecionadas(atuais => {
      const proximas = new Set(atuais)
      if (todasElegiveisSelecionadas) idsElegiveisVisiveis.forEach(idSelecao => proximas.delete(idSelecao))
      else idsElegiveisVisiveis.forEach(idSelecao => proximas.add(idSelecao))
      return proximas
    })
  }

  const ajustarColunasGrade = (variacao: -1 | 1) => {
    setColunasGrade(atuais => PROXIMAS_COLUNAS_GRADE[atuais][variacao])
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
      <DialogContent className="flex w-[calc(100vw-2rem)] max-w-none flex-col sm:w-[min(92vw,1100px)] sm:max-w-none max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2"><ImageDown className="h-5 w-5 text-primary" />Lista de Fotos da REP
            {identificacaoRep && <><Badge variant="outline">REP {formatarNumeroRep(identificacaoRep.numeroRep, identificacaoRep.anoRep)}</Badge><Badge variant={identificacaoRep.ambiente === 'producao' ? 'destructive' : 'secondary'}>{identificacaoRep.ambiente === 'producao' ? 'Produção' : 'Homologação'}</Badge></>}
          </DialogTitle>
          <DialogDescription>Somente as fotos da galeria do GDL são consideradas. Vídeos e anexos são ignorados.</DialogDescription>
        </DialogHeader>
        {!carregando && !erro && arquivos.length > 0 && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-2">
            <div className="grid gap-2 sm:grid-cols-[1fr_150px_190px]">
              <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={busca} onChange={evento => setBusca(evento.target.value)} className="pl-8" placeholder="Buscar por nome" aria-label="Buscar fotos por nome" /></div>
              <Select value={filtro} onValueChange={valor => { if (filtroFotosValido(valor)) setFiltro(valor) }}><SelectTrigger aria-label="Filtrar fotos"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="elegiveis">Disponíveis</SelectItem><SelectItem value="inelegiveis">Indisponíveis</SelectItem></SelectContent></Select>
              <Select value={ordenacao} onValueChange={valor => { if (ordenacaoFotosValida(valor)) setOrdenacao(valor) }}><SelectTrigger aria-label="Ordenar fotos"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nome-crescente">Nome: A a Z</SelectItem><SelectItem value="nome-decrescente">Nome: Z a A</SelectItem><SelectItem value="tamanho-decrescente">Maior tamanho</SelectItem><SelectItem value="tamanho-crescente">Menor tamanho</SelectItem><SelectItem value="data-mais-recente">Mais recentes</SelectItem></SelectContent></Select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{arquivosVisiveis.length} de {arquivos.length} foto(s) exibida(s)</span>
            <div className="flex items-center gap-1"><span className="mr-1">Visualização:</span><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => ajustarColunasGrade(-1)} disabled={colunasGrade === 1 || capturando} aria-label="Diminuir colunas"><Minus className="h-3.5 w-3.5" /></Button><span className="min-w-16 text-center">{colunasGrade} coluna{colunasGrade > 1 ? 's' : ''}</span><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => ajustarColunasGrade(1)} disabled={colunasGrade === 4 || capturando} aria-label="Aumentar colunas"><Plus className="h-3.5 w-3.5" /></Button></div>
            {idsElegiveisVisiveis.length > 0 && (
            <Button variant="outline" size="sm" onClick={alternarTodasSelecoes} disabled={capturando}>
              {todasElegiveisSelecionadas ? <Square className="mr-2 h-4 w-4" /> : <CheckSquare className="mr-2 h-4 w-4" />}
              {todasElegiveisSelecionadas ? 'Desmarcar todas' : 'Selecionar todas'}
            </Button>
            )}</div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {carregando && <div className="grid grid-cols-2 gap-3 py-2 sm:grid-cols-3">{Array.from({ length: 6 }, (_, indice) => <Skeleton key={indice} className="h-36 w-full" />)}</div>}
          {erro && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{erro}</AlertDescription></Alert>}
          {!carregando && !erro && arquivos.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">A Lista de Fotos da REP está vazia.</p>}
          {!carregando && !erro && arquivos.length > 0 && arquivosVisiveis.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma foto encontrada com os filtros selecionados.</p>}
          {!carregando && !erro && arquivosVisiveis.length > 0 && <div className={`grid grid-cols-1 gap-3 ${CLASSES_COLUNAS_GRADE[colunasGrade]}`}>{arquivosVisiveis.map(arquivo => {
            const elegivel = arquivo.provavelImagem && !arquivo.status
            return <label key={arquivo.idSelecao} className={`group relative flex min-w-0 flex-col gap-2 rounded-md border p-2 transition-colors ${elegivel ? 'cursor-pointer hover:bg-accent' : 'opacity-70'} ${selecionadas.has(arquivo.idSelecao) ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <Checkbox className="absolute right-3 top-3 z-10 bg-background" checked={selecionadas.has(arquivo.idSelecao)} disabled={!elegivel || capturando} onCheckedChange={() => alternarSelecao(arquivo.idSelecao)} />
              <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {arquivo.thumbnailDataUri ? <img src={arquivo.thumbnailDataUri} alt={`Prévia de ${arquivo.nomeArquivo}`} className="h-full w-full object-contain" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" aria-label="Prévia indisponível" />}
                </div>
                <div className="min-w-0 space-y-1">
                  <span className="block truncate text-sm font-medium">{arquivo.nomeArquivo}</span>
                  <p className="text-xs text-muted-foreground">{formatarTamanho(arquivo.tamanho)}{arquivo.dataUpload ? ` · ${new Date(arquivo.dataUpload).toLocaleString('pt-BR')}` : ''}</p>
                  {!arquivo.thumbnailDataUri && elegivel && <p className="text-xs text-muted-foreground">Prévia indisponível</p>}
                  {arquivo.status && <p className="text-xs text-muted-foreground">{arquivo.status}</p>}
                </div>
            </label>
          })}</div>}
        </div>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Lista de Fotos pode ter até <strong>1 GB</strong> e cada foto até <strong>50 MB</strong>.</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onAbertoChange(false)} disabled={capturando}>Cancelar</Button><Button onClick={() => void capturar()} disabled={capturando || selecionadas.size === 0}>{capturando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Capturar imagens ({selecionadas.size})</Button></div></div>
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
