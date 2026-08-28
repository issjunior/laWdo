import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bot, Images, ListRestart, Wrench, type LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  onRecolherAutomaticamente?: () => void
  children: ReactNode
  conteudoPainel: ReactNode
}

interface BotaoTrilhoProps {
  titulo: string
  ativo: boolean
  icone: LucideIcon
  onClick: () => void
}

export function obterLarguraMinimaNecessaria(larguraMinimaPainel: number): number {
  return 560 + larguraMinimaPainel + 56
}

function BotaoTrilho({ titulo, ativo, icone: Icone, onClick }: BotaoTrilhoProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'size-8 rounded-lg border border-transparent transition-[background-color,border-color,color,box-shadow] duration-200',
        ativo && 'border-border bg-accent text-accent-foreground',
      )}
      aria-label={titulo}
      aria-pressed={ativo}
      onClick={onClick}
    >
      <Icone className="size-4" />
      <span className="sr-only">{titulo}</span>
    </Button>
  )
}

function BotaoFerramentasTrilho({
  operacaoEmAndamento,
  onReindexarSecoes,
}: Pick<PainelLateralRedimensionavelProps, 'operacaoEmAndamento' | 'onReindexarSecoes'>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-lg border border-transparent transition-[background-color,border-color,color,box-shadow] duration-200"
          aria-label="Ferramentas"
        >
          <Wrench className="size-4" />
          <span className="sr-only">Ferramentas</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="left" align="start" className="w-52">
        <DropdownMenuItem onClick={onReindexarSecoes} disabled={operacaoEmAndamento}>
          <ListRestart className="mr-2 size-4" />
          Reindexar seções
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  onRecolherAutomaticamente,
  children,
  conteudoPainel,
}: PainelLateralRedimensionavelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
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
    if (!conteudoPrincipal) return
    const atualizarAltura = () => setAlturaDisponivel(conteudoPrincipal.clientHeight || undefined)
    atualizarAltura()
    const observador = new ResizeObserver(atualizarAltura)
    observador.observe(conteudoPrincipal)
    return () => observador.disconnect()
  }, [])

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
              <div className="h-full min-h-0 min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-sm ring-1 ring-black/5 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2 motion-safe:duration-200 dark:ring-white/5">
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
          ativo={tipo === 'ia' || iaDestacada}
          icone={Bot}
          onClick={onAlternarPainelIa}
        />
        <BotaoTrilho
          titulo="Painel de Ilustrações"
          ativo={tipo === 'ilustracoes' || ilustracoesEmJanela}
          icone={Images}
          onClick={onAlternarPainelIlustracoes}
        />
        <BotaoFerramentasTrilho
          operacaoEmAndamento={operacaoEmAndamento}
          onReindexarSecoes={onReindexarSecoes}
        />
      </aside>
    </div>
  )
}
