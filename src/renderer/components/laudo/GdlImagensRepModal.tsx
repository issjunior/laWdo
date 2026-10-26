import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckSquare, Image as ImageIcon, ImageDown, Loader2, Minus, Plus, RefreshCw, Search, Square } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import type { ArquivoRepGdl, ImagemRepGdlAdicionadaAoLaudo, MiniaturaArquivoRepGdl, ProgressoListaFotosGdl, ResultadoCapturaImagensLaudoGdl } from '@shared/types/gdl-arquivos.types'

interface GdlImagensRepModalProps {
  aberto: boolean
  laudoId: string
  onAbertoChange: (aberto: boolean) => void
  onCapturadas: (imagens: ImagemRepGdlAdicionadaAoLaudo[], permitirDuplicadas: boolean) => void
}

interface DadosSessaoImagens {
  sessaoId: string
  ambiente: 'homologacao' | 'producao'
  numeroRep: string
  anoRep: string
  arquivos: ArquivoRepGdl[]
  fotosJaIncluidas?: number
  avisoVerificacao?: string
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
    && dados.arquivos.every((arquivo: unknown) => {
      if (!arquivo || typeof arquivo !== 'object') return false
      const item = arquivo as Record<string, unknown>
      return typeof item.idSelecao === 'string' && /^[a-f0-9]{64}$/.test(item.idSelecao)
        && typeof item.nomeArquivo === 'string'
        && typeof item.provavelImagem === 'boolean'
        && (item.status === null || typeof item.status === 'string')
        && (item.tamanho === null || typeof item.tamanho === 'number')
        && (item.dataUpload === null || typeof item.dataUpload === 'string')
    })
    && (dados.fotosJaIncluidas === undefined || (typeof dados.fotosJaIncluidas === 'number' && Number.isInteger(dados.fotosJaIncluidas) && dados.fotosJaIncluidas >= 0))
    && (dados.avisoVerificacao === undefined || typeof dados.avisoVerificacao === 'string')
}

function resultadoCapturaValido(valor: unknown): valor is ResultadoCapturaImagensLaudoGdl {
  if (!valor || typeof valor !== 'object') return false
  const dados = valor as Record<string, unknown>
  if (!Array.isArray(dados.imagens) || !Array.isArray(dados.duplicadas) || !Array.isArray(dados.falhas)) return false
  return dados.imagens.every((imagem: unknown) => {
    if (!imagem || typeof imagem !== 'object') return false
    const item = imagem as Record<string, unknown>
    return typeof item.idSelecao === 'string' && typeof item.imagemId === 'string'
      && typeof item.nomeArquivo === 'string' && typeof item.mimeType === 'string'
      && typeof item.tamanho === 'number' && typeof item.sha256 === 'string' && typeof item.sequencia === 'number'
  }) && dados.duplicadas.every((duplicada: unknown) => {
    if (!duplicada || typeof duplicada !== 'object') return false
    const item = duplicada as Record<string, unknown>
    return typeof item.idSelecao === 'string' && typeof item.nomeArquivo === 'string'
      && typeof item.imagemExistenteId === 'string' && (item.localizacao === 'painel' || item.localizacao === 'laudo')
  }) && dados.falhas.every((falha: unknown) => {
    if (!falha || typeof falha !== 'object') return false
    const item = falha as Record<string, unknown>
    return typeof item.idSelecao === 'string' && typeof item.erro === 'string'
  })
}

function miniaturaArquivoRepGdlValida(valor: unknown): valor is MiniaturaArquivoRepGdl {
  if (!valor || typeof valor !== 'object') return false
  const miniatura = valor as Record<string, unknown>
  return typeof miniatura.idSelecao === 'string'
    && /^[a-f0-9]{64}$/.test(miniatura.idSelecao)
    && typeof miniatura.thumbnailDataUri === 'string'
    && miniatura.thumbnailDataUri.startsWith('data:image/jpeg;base64,')
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

function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const GdlImagensRepModal: React.FC<GdlImagensRepModalProps> = ({ aberto, laudoId, onAbertoChange, onCapturadas }) => {
  const [arquivos, setArquivos] = useState<ArquivoRepGdl[]>([])
  const [sessaoId, setSessaoId] = useState<string | null>(null)
  const sessaoIdRef = useRef<string | null>(null)
  const containerFotosRef = useRef<HTMLDivElement | null>(null)
  const elementosFotosRef = useRef<Map<string, HTMLElement>>(new Map())
  const idsMiniaturasSolicitadasRef = useRef<Set<string>>(new Set())
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(false)
  const [progresso, setProgresso] = useState<ProgressoListaFotosGdl | null>(null)
  const [tentativaCarregamento, setTentativaCarregamento] = useState(0)
  const [idsMiniaturasCarregando, setIdsMiniaturasCarregando] = useState<Set<string>>(new Set())
  const [idsMiniaturasIndisponiveis, setIdsMiniaturasIndisponiveis] = useState<Set<string>>(new Set())
  const [capturando, setCapturando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [identificacaoRep, setIdentificacaoRep] = useState<Omit<DadosSessaoImagens, 'sessaoId' | 'arquivos'> | null>(null)
  const [fotosJaIncluidas, setFotosJaIncluidas] = useState(0)
  const [avisoVerificacao, setAvisoVerificacao] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<FiltroFotos>('elegiveis')
  const [ordenacao, setOrdenacao] = useState<OrdenacaoFotos>('nome-crescente')
  const [colunasGrade, setColunasGrade] = useState<ColunasGradeFotos>(2)

  useEffect(() => {
    if (!aberto) return
    let ativo = true
    setCarregando(true)
    setProgresso(null)
    setErro(null)
    setSelecionadas(new Set())
    setSessaoId(null)
    setIdentificacaoRep(null)
    setArquivos([])
    setFotosJaIncluidas(0)
    setAvisoVerificacao(null)
    setBusca('')
    setFiltro('elegiveis')
    setOrdenacao('nome-crescente')
    setColunasGrade(2)
    setIdsMiniaturasCarregando(new Set())
    setIdsMiniaturasIndisponiveis(new Set())
    idsMiniaturasSolicitadasRef.current.clear()
    elementosFotosRef.current.clear()
    sessaoIdRef.current = null
    const removerProgresso = window.ipcAPI.gdl.onProgressoImagensLaudo?.(progressoAtual => {
      if (ativo && progressoAtual.laudoId === laudoId) setProgresso(progressoAtual)
    }) ?? (() => undefined)
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
      setFotosJaIncluidas(resultado.data.fotosJaIncluidas ?? 0)
      setAvisoVerificacao(resultado.data.avisoVerificacao ?? null)
      setSelecionadas(new Set(resultado.data.arquivos
        .filter(arquivo => arquivo.provavelImagem && !arquivo.status)
        .map(arquivo => arquivo.idSelecao)))
    }).catch(error => {
      if (ativo) setErro(error instanceof Error ? error.message : 'Não foi possível carregar a Lista de Fotos da REP.')
    }).finally(() => {
      if (ativo) {
        setCarregando(false)
        setProgresso(null)
      }
    })
    return () => {
      ativo = false
      removerProgresso()
      if (sessaoIdRef.current) void window.ipcAPI.gdl.fecharSessaoImagensLaudo(laudoId, sessaoIdRef.current)
      sessaoIdRef.current = null
    }
  }, [aberto, laudoId, tentativaCarregamento])

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

  useEffect(() => {
    if (!aberto || !sessaoId) return
    const candidatos = arquivosVisiveis.filter(arquivo => arquivo.provavelImagem && !arquivo.status && !arquivo.thumbnailDataUri)
    if (candidatos.length === 0) return

    const solicitarMiniaturas = async (ids: string[]) => {
      const idsPendentes = ids
        .filter(id => !idsMiniaturasSolicitadasRef.current.has(id))
        .slice(0, 30)
      if (idsPendentes.length === 0) return
      idsPendentes.forEach(id => idsMiniaturasSolicitadasRef.current.add(id))
      setIdsMiniaturasCarregando(atuais => new Set([...atuais, ...idsPendentes]))

      try {
        const obterMiniaturas = window.ipcAPI.gdl.obterMiniaturasImagensLaudo
        if (typeof obterMiniaturas !== 'function') throw new Error('Carregamento progressivo de miniaturas indisponível.')
        const resultado = await obterMiniaturas(laudoId, sessaoId, idsPendentes)
        if (sessaoIdRef.current !== sessaoId) return

        const miniaturas = Array.isArray(resultado.data)
          ? resultado.data.filter(miniaturaArquivoRepGdlValida)
          : []
        const miniaturasPorId = new Map(miniaturas.map(miniatura => [miniatura.idSelecao, miniatura.thumbnailDataUri]))
        if (resultado.success && miniaturasPorId.size > 0) {
          setArquivos(atuais => atuais.map(arquivo => {
            const thumbnailDataUri = miniaturasPorId.get(arquivo.idSelecao)
            return thumbnailDataUri ? { ...arquivo, thumbnailDataUri } : arquivo
          }))
        }
        const idsSemMiniatura = idsPendentes.filter(id => !miniaturasPorId.has(id))
        if (idsSemMiniatura.length > 0) {
          setIdsMiniaturasIndisponiveis(atuais => new Set([...atuais, ...idsSemMiniatura]))
        }
      } catch {
        if (sessaoIdRef.current === sessaoId) {
          setIdsMiniaturasIndisponiveis(atuais => new Set([...atuais, ...idsPendentes]))
        }
      } finally {
        if (sessaoIdRef.current === sessaoId) {
          setIdsMiniaturasCarregando(atuais => {
            const proximos = new Set(atuais)
            idsPendentes.forEach(id => proximos.delete(id))
            return proximos
          })
        }
      }
    }

    if (typeof IntersectionObserver === 'undefined') {
      void solicitarMiniaturas(candidatos.slice(0, 6).map(arquivo => arquivo.idSelecao))
      return
    }

    const observer = new IntersectionObserver(entradas => {
      const idsVisiveis: string[] = []
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue
        const elemento = entrada.target as HTMLElement
        const idSelecao = elemento.dataset.idSelecao
        if (idSelecao) idsVisiveis.push(idSelecao)
        observer.unobserve(elemento)
      }
      if (idsVisiveis.length > 0) void solicitarMiniaturas(idsVisiveis)
    }, {
      root: containerFotosRef.current,
      rootMargin: '240px 0px',
    })

    candidatos.forEach(arquivo => {
      const elemento = elementosFotosRef.current.get(arquivo.idSelecao)
      if (elemento) observer.observe(elemento)
    })

    return () => observer.disconnect()
  }, [aberto, arquivosVisiveis, laudoId, sessaoId])

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

  const capturar = async () => {
    const idsSelecao = [...selecionadas]
    if (idsSelecao.length === 0 || !sessaoId) return
    setCapturando(true)
    try {
      const resultado = await window.ipcAPI.gdl.capturarImagensLaudo(laudoId, sessaoId, idsSelecao, false)
      if (!resultado.success || !resultadoCapturaValido(resultado.data)) {
        setErro(resultado.error || 'Não foi possível capturar as imagens selecionadas.')
        return
      }
      const dados = resultado.data
      if (dados.imagens.length > 0) onCapturadas(dados.imagens, false)
      const idsProcessados = new Set([...dados.imagens.map(imagem => imagem.idSelecao), ...dados.duplicadas.map(duplicada => duplicada.idSelecao)])
      setArquivos(atuais => atuais.filter(arquivo => !idsProcessados.has(arquivo.idSelecao)))
      setSelecionadas(atuais => new Set([...atuais].filter(id => !idsProcessados.has(id))))
      setFotosJaIncluidas(atual => atual + dados.duplicadas.length)
      if (resultado.data.duplicadas.length > 0 || resultado.data.falhas.length > 0) {
        toast.warning(`${resultado.data.imagens.length} imagem(ns) capturada(s); ${resultado.data.duplicadas.length} já incluída(s); ${resultado.data.falhas.length} falha(s).`)
      } else if (resultado.data.imagens.length > 0) {
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
      <DialogContent className="flex w-[calc(100vw-2rem)] max-w-none flex-col sm:w-[min(92vw,1100px)] sm:max-w-none max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2"><ImageDown className="h-5 w-5 text-primary" />Lista de Fotos da REP
            {identificacaoRep && <><Badge variant="outline">REP {formatarNumeroRep(identificacaoRep.numeroRep, identificacaoRep.anoRep)}</Badge><Badge variant={identificacaoRep.ambiente === 'producao' ? 'destructive' : 'secondary'}>{identificacaoRep.ambiente === 'producao' ? 'Produção' : 'Homologação'}</Badge></>}
          </DialogTitle>
          <DialogDescription>Somente as fotos da galeria do GDL são consideradas. Vídeos e anexos são ignorados.</DialogDescription>
        </DialogHeader>
        {avisoVerificacao && <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>{avisoVerificacao} <Button variant="link" className="h-auto p-0" onClick={() => setTentativaCarregamento(atual => atual + 1)}>Tentar novamente</Button></AlertDescription></Alert>}
        {fotosJaIncluidas > 0 && <p className="text-xs text-muted-foreground">{fotosJaIncluidas} foto(s) já incluída(s) neste laudo foram ocultada(s).</p>}
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
        <div ref={containerFotosRef} className="min-h-0 flex-1 overflow-y-auto">
          {carregando && <div className="space-y-4 py-2">
            <div className="space-y-2 rounded-md border bg-muted/30 p-3" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-medium"><Loader2 className="h-4 w-4 animate-spin" />{progresso?.descricao || 'Iniciando consulta ao GDL…'}</span>
                {progresso?.percentual !== null && progresso?.percentual !== undefined && <span>{progresso.percentual}%</span>}
              </div>
              <Progress value={progresso?.percentual ?? null} aria-label={progresso?.descricao || 'Carregando Lista de Fotos da REP'} />
              {progresso?.fase === 'baixando' && progresso.bytesRecebidos > 0 && <p className="text-xs text-muted-foreground">{formatarBytes(progresso.bytesRecebidos)}{progresso.totalBytes ? ` de ${formatarBytes(progresso.totalBytes)}` : ' recebidos'}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{Array.from({ length: 6 }, (_, indice) => <Skeleton key={indice} className="h-36 w-full" />)}</div>
          </div>}
          {erro && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"><span>{erro}</span><Button variant="outline" size="sm" onClick={() => setTentativaCarregamento(atual => atual + 1)}><RefreshCw className="mr-2 h-4 w-4" />Tentar novamente</Button></AlertDescription></Alert>}
          {!carregando && !erro && arquivos.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{fotosJaIncluidas > 0 ? 'Todas as fotos disponíveis da REP já estão incluídas neste laudo.' : 'A Lista de Fotos da REP está vazia.'}</p>}
          {!carregando && !erro && arquivos.length > 0 && arquivosVisiveis.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{filtro === 'elegiveis' && !busca.trim() && fotosJaIncluidas > 0 && arquivos.every(arquivo => !arquivo.provavelImagem || arquivo.status) ? 'Todas as fotos disponíveis da REP já estão incluídas neste laudo.' : 'Nenhuma foto encontrada com os filtros selecionados.'}</p>}
          {!carregando && !erro && arquivosVisiveis.length > 0 && <div className={`grid grid-cols-1 gap-3 ${CLASSES_COLUNAS_GRADE[colunasGrade]}`}>{arquivosVisiveis.map(arquivo => {
            const elegivel = arquivo.provavelImagem && !arquivo.status
            return <label
              key={arquivo.idSelecao}
              ref={elemento => {
                if (elemento) elementosFotosRef.current.set(arquivo.idSelecao, elemento)
                else elementosFotosRef.current.delete(arquivo.idSelecao)
              }}
              data-id-selecao={arquivo.idSelecao}
              className={`group relative flex min-w-0 flex-col gap-2 rounded-md border p-2 transition-colors ${elegivel ? 'cursor-pointer hover:bg-accent' : 'opacity-70'} ${selecionadas.has(arquivo.idSelecao) ? 'border-primary bg-primary/5' : 'border-border'}`}
            >
              <Checkbox className="absolute right-3 top-3 z-10 bg-background" checked={selecionadas.has(arquivo.idSelecao)} disabled={!elegivel || capturando} onCheckedChange={() => alternarSelecao(arquivo.idSelecao)} />
              <div className="flex h-36 w-full items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {arquivo.thumbnailDataUri
                    ? <img src={arquivo.thumbnailDataUri} alt={`Prévia de ${arquivo.nomeArquivo}`} className="h-full w-full object-contain" />
                    : idsMiniaturasCarregando.has(arquivo.idSelecao)
                      ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Carregando prévia" />
                      : <ImageIcon className="h-5 w-5 text-muted-foreground" aria-label={idsMiniaturasIndisponiveis.has(arquivo.idSelecao) ? 'Prévia indisponível' : 'Prévia aguardando carregamento'} />}
                </div>
                <div className="min-w-0 space-y-1">
                  <span className="block truncate text-sm font-medium">{arquivo.nomeArquivo}</span>
                  <p className="text-xs text-muted-foreground">{formatarTamanho(arquivo.tamanho)}{arquivo.dataUpload ? ` · ${new Date(arquivo.dataUpload).toLocaleString('pt-BR')}` : ''}</p>
                  {!arquivo.thumbnailDataUri && elegivel && idsMiniaturasCarregando.has(arquivo.idSelecao) && <p className="text-xs text-muted-foreground">Carregando prévia…</p>}
                  {!arquivo.thumbnailDataUri && elegivel && idsMiniaturasIndisponiveis.has(arquivo.idSelecao) && <p className="text-xs text-muted-foreground">Prévia indisponível</p>}
                  {arquivo.status && <p className="text-xs text-muted-foreground">{arquivo.status}</p>}
                </div>
            </label>
          })}</div>}
        </div>
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Lista de Fotos pode ter até <strong>1 GB</strong> e cada foto até <strong>50 MB</strong>.</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => onAbertoChange(false)} disabled={capturando}>{carregando ? 'Fechar' : 'Cancelar'}</Button><Button onClick={() => void capturar()} disabled={carregando || capturando || selecionadas.size === 0}>{capturando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Capturar imagens ({selecionadas.size})</Button></div></div>
      </DialogContent>
    </Dialog>
  )
}
