import { useEffect, useRef, type ReactNode } from 'react'
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
        'size-8 rounded-md border border-transparent',
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
          className="size-8 rounded-md border border-transparent"
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

  return (
    <div ref={containerRef} className="flex min-w-0 max-w-full items-start [overflow-x:clip]">
      <ResizablePanelGroup
        orientation="horizontal"
        className="h-auto min-w-0 flex-1 items-start"
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
            <ResizableHandle withHandle aria-label={`Redimensionar painel de ${rotuloPainel}`} />
            <ResizablePanel
              key={tipo}
              id={`painel-lateral-${tipo}`}
              defaultSize={largura}
              minSize={larguraMinima}
              maxSize={larguraMaxima}
              groupResizeBehavior="preserve-pixel-size"
              onResize={(tamanho) => {
                ultimaLargura.current = tamanho.inPixels
              }}
            >
              <div className="sticky top-4 h-[calc(100dvh-3rem)] min-w-0 overflow-hidden border-l bg-background">
                {conteudoPainel}
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      <aside
        aria-label="Painéis do laudo"
        className="sticky top-4 flex w-10 shrink-0 self-start flex-col items-center gap-1 border-l bg-muted/20 px-1 py-2"
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
