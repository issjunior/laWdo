import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bot, Crosshair, Images, Keyboard, ListRestart, NotebookTabs, SpellCheck, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { useLarguraPainelPersistida } from '@/hooks/use-largura-painel-persistida'
import { cn } from '@/lib/utils'

export type PainelLateralAtivo = 'ia' | 'ilustracoes' | null

interface PainelLateralRedimensionavelProps {
  tipo: PainelLateralAtivo
  chavePersistencia: string
  larguraPadrao: number
  larguraMinima: number
  larguraMaxima: number
  recolhido: boolean
  iaDestacada: boolean
  ilustracoesEmJanela: boolean
  operacaoEmAndamento: boolean
  onAlternarPainelIa: () => void
  onAlternarPainelIlustracoes: () => void
  onReindexarSecoes: () => void
  onAbrirNotebookLm?: () => void
  onAbrirProjeteis?: () => void
  onAbrirAtalhos: () => void
  onAbrirCorretor?: () => void
  onRecolherAutomaticamente?: () => void
  children: ReactNode
  conteudoPainel: ReactNode
}

interface BotaoTrilhoProps {
  titulo: string
  dica: string
  ativo: boolean
  desabilitado?: boolean
  icone: LucideIcon
  onClick: () => void
}

export function obterLarguraMinimaNecessaria(larguraMinimaPainel: number): number {
  return 560 + larguraMinimaPainel + 56
}

function BotaoTrilho({ titulo, dica, ativo, desabilitado, icone: Icone, onClick }: BotaoTrilhoProps) {
  return (
    <TooltipProvider delayDuration={200}><Tooltip>
      <TooltipTrigger asChild><Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'size-8 rounded-lg border border-transparent transition-[background-color,border-color,color,box-shadow] duration-200',
          ativo && 'border-border bg-accent text-accent-foreground',
        )}
        aria-label={titulo}
        aria-pressed={ativo}
        disabled={desabilitado}
        onClick={onClick}
      >
        <Icone className="size-4" />
        <span className="sr-only">{titulo}</span>
      </Button></TooltipTrigger>
      <TooltipContent side="left">{dica}</TooltipContent>
    </Tooltip></TooltipProvider>
  )
}

export function PainelLateralRedimensionavel({
  tipo,
  chavePersistencia,
  larguraPadrao,
  larguraMinima,
  larguraMaxima,
  recolhido,
  iaDestacada,
  ilustracoesEmJanela,
  operacaoEmAndamento,
  onAlternarPainelIa,
  onAlternarPainelIlustracoes,
  onReindexarSecoes,
  onAbrirNotebookLm,
  onRecolherAutomaticamente,
  onAbrirAtalhos,
  onAbrirProjeteis,
  onAbrirCorretor,
  children,
  conteudoPainel,
}: PainelLateralRedimensionavelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  const [alturaDisponivel, setAlturaDisponivel] = useState<number>()
  const ultimaLargura = useRef(larguraPadrao)
  const { largura, persistirLargura } = useLarguraPainelPersistida(
    chavePersistencia,
    larguraPadrao,
    larguraMinima,
    larguraMaxima,
  )
  const painelExpandido = tipo !== null && !recolhido
  const rotuloPainel = tipo === 'ilustracoes' ? 'ilustrações' : 'Assistente IA'

  useEffect(() => {
    const container = containerRef.current
    if (!container || !painelExpandido) return

    const larguraMinimaNecessaria = obterLarguraMinimaNecessaria(larguraMinima)
    const observar = (largura: number) => {
      if (largura > 0 && largura < larguraMinimaNecessaria) onRecolherAutomaticamente?.()
    }
    const observer = new ResizeObserver(entries => {
      const largura = entries[0]?.contentRect.width
      if (largura !== undefined) observar(largura)
    })
    observer.observe(container)
    observar(container.getBoundingClientRect().width)
    return () => observer.disconnect()
  }, [larguraMinima, onRecolherAutomaticamente, painelExpandido])

  useEffect(() => {
    const conteudoPrincipal = document.getElementById('conteudo-principal')
    const painel = painelRef.current
    if (!conteudoPrincipal || !painel || !painelExpandido) return

    const atualizarAltura = () => {
      const areaRolagem = conteudoPrincipal.getBoundingClientRect()
      const areaPainel = painel.getBoundingClientRect()
      const inicioVisivel = Math.max(areaRolagem.top, areaPainel.top)
      const altura = Math.max(0, Math.floor(areaRolagem.bottom - inicioVisivel))

      setAlturaDisponivel(atual => atual === altura ? atual : altura)
    }

    atualizarAltura()
    const observador = new ResizeObserver(atualizarAltura)
    observador.observe(conteudoPrincipal)
    observador.observe(painel)
    conteudoPrincipal.addEventListener('scroll', atualizarAltura, { passive: true })

    return () => {
      observador.disconnect()
      conteudoPrincipal.removeEventListener('scroll', atualizarAltura)
    }
  }, [painelExpandido])

  return (
    <div ref={containerRef} className="flex min-w-0 max-w-full items-start gap-2 [overflow-x:clip]">
      <ResizablePanelGroup
        orientation="horizontal"
        className={cn(
          'h-auto min-h-0 min-w-0 flex-1 items-stretch !overflow-visible',
        )}
        onLayoutChanged={(_layout, detalhes) => {
          if (detalhes.isUserInteraction && painelExpandido) {
            persistirLargura(ultimaLargura.current)
          }
        }}
      >
        <ResizablePanel id="editor-laudo" minSize={560}>
          <div className="min-w-0 max-w-full">{children}</div>
        </ResizablePanel>
        {painelExpandido && (
          <>
            <ResizableHandle
              withHandle
              className="bg-transparent transition-colors duration-200 after:bg-border/60 hover:bg-accent/40 data-[separator=active]:bg-primary/10"
              aria-label={`Redimensionar painel de ${rotuloPainel}`}
            />
            <ResizablePanel
              key={tipo}
              id={`painel-lateral-${tipo}`}
              defaultSize={largura}
              minSize={larguraMinima}
              maxSize={larguraMaxima}
              className="sticky top-0 min-h-0 self-start"
              style={alturaDisponivel ? { height: `${alturaDisponivel}px` } : undefined}
              groupResizeBehavior="preserve-pixel-size"
              onResize={(tamanho) => {
                ultimaLargura.current = tamanho.inPixels
              }}
            >
              <div ref={painelRef} className="h-full min-h-0 min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm ring-1 ring-black/5 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-safe:duration-200 dark:ring-white/5">
                {conteudoPainel}
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      <aside
        aria-label="Painéis do laudo"
        className="sticky top-0 flex w-10 shrink-0 self-start flex-col items-center gap-1 rounded-xl border border-border/70 bg-card/90 px-1 py-2 shadow-sm backdrop-blur-sm transition-[background-color,border-color,box-shadow] duration-200"
      >
        <BotaoTrilho
          titulo="Painel de IA"
          dica="IA"
          ativo={tipo === 'ia' || iaDestacada}
          icone={Bot}
          onClick={onAlternarPainelIa}
        />
        <BotaoTrilho
          titulo="Painel de Ilustrações"
          dica="Ilustrações"
          ativo={tipo === 'ilustracoes' || ilustracoesEmJanela}
          icone={Images}
          onClick={onAlternarPainelIlustracoes}
        />
        {onAbrirProjeteis && <TooltipProvider delayDuration={200}><Tooltip>
          <TooltipTrigger asChild><Button type="button" variant="ghost" size="icon"
            className="size-8 rounded-lg border border-transparent"
            aria-label="Identificação de projéteis" aria-haspopup="dialog" onClick={onAbrirProjeteis}>
            <Crosshair className="size-4" />
          </Button></TooltipTrigger>
          <TooltipContent side="left">Projéteis</TooltipContent>
        </Tooltip></TooltipProvider>}
        {onAbrirCorretor && <TooltipProvider delayDuration={200}><Tooltip>
          <TooltipTrigger asChild><Button type="button" variant="ghost" size="icon"
            className="size-8 rounded-lg border border-transparent"
            aria-label="Corretor ortográfico" aria-haspopup="dialog" onClick={onAbrirCorretor}>
            <SpellCheck className="size-4" />
          </Button></TooltipTrigger>
          <TooltipContent side="left">Corretor</TooltipContent>
        </Tooltip></TooltipProvider>}
        {onAbrirNotebookLm && <BotaoTrilho
          titulo="Abrir NotebookLM"
          dica="NotebookLM"
          ativo={false}
          icone={NotebookTabs}
          onClick={onAbrirNotebookLm}
        />}
        <BotaoTrilho
          titulo="Reindexar seções"
          dica="Reindexar"
          ativo={false}
          desabilitado={operacaoEmAndamento}
          icone={ListRestart}
          onClick={onReindexarSecoes}
        />
        <TooltipProvider delayDuration={200}><Tooltip>
          <TooltipTrigger asChild><Button type="button" variant="ghost" size="icon"
            className="size-8 rounded-lg border border-transparent transition-[background-color,border-color,color,box-shadow] duration-200"
            aria-label="Atalhos do laudo" aria-haspopup="dialog" onClick={onAbrirAtalhos}>
            <Keyboard className="size-4" />
          </Button></TooltipTrigger>
          <TooltipContent side="left">Atalhos</TooltipContent>
        </Tooltip></TooltipProvider>
      </aside>
    </div>
  )
}
