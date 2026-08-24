import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Braces,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Database,
  Download,
  Eye,
  File,
  FileDown,
  FileText,
  Layers3,
  Loader2,
  Save,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { EstadoSalvamentoLaudo } from '@/hooks/useGerenciadorAlteracoesLaudo';
import { cn } from '@/lib/utils';

export type FormatoExportacaoLaudo = 'pdf' | 'docx' | 'odt';
export type ModoConteudoLaudo = 'dados' | 'chaves';
export type ModoOrganizacaoLaudo = 'single' | 'multi';

export function obterClasseBadgeStatusLaudo(status: string): string {
  const statusNormalizado = status.trim().toLocaleLowerCase('pt-BR');

  if (statusNormalizado === 'concluído' || statusNormalizado === 'concluido') {
    return 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300';
  }

  if (statusNormalizado === 'entregue') {
    return 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
  }

  if (statusNormalizado === 'em andamento' || statusNormalizado === 'pendente') {
    return 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
  }

  return 'border-border bg-muted text-muted-foreground';
}

interface OpcaoSegmentada<T extends string> {
  valor: T;
  rotulo: string;
  icone: LucideIcon;
}

interface ControleSegmentadoProps<T extends string> {
  rotulo: string;
  valor: T;
  opcoes: Array<OpcaoSegmentada<T>>;
  onChange: (valor: T) => void;
}

function ControleSegmentado<T extends string>({
  rotulo,
  valor,
  opcoes,
  onChange,
}: ControleSegmentadoProps<T>) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
      <div
        role="group"
        aria-label={rotulo}
        className="flex min-w-0 items-center gap-1 rounded-lg border bg-muted/50 p-1"
      >
        {opcoes.map(opcao => {
          const Icone = opcao.icone;
          const selecionada = valor === opcao.valor;
          return (
            <Button
              key={opcao.valor}
              type="button"
              variant={selecionada ? 'default' : 'ghost'}
              size="sm"
              aria-pressed={selecionada}
              onClick={() => onChange(opcao.valor)}
              className="h-8 min-w-0 gap-1.5 px-2.5 text-xs"
            >
              <Icone className="size-3.5" />
              <span className="truncate">{opcao.rotulo}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

const configuracaoEstadoSalvamento: Record<
  EstadoSalvamentoLaudo,
  { rotulo: string; icone: LucideIcon; classe: string }
> = {
  salvo: {
    rotulo: 'Salvo',
    icone: CheckCircle2,
    classe: 'text-muted-foreground',
  },
  pendente: {
    rotulo: 'Alterações não salvas',
    icone: Clock3,
    classe: 'text-amber-700 dark:text-amber-400',
  },
  salvando: {
    rotulo: 'Salvando...',
    icone: Loader2,
    classe: 'text-muted-foreground',
  },
  erro: {
    rotulo: 'Falha ao salvar',
    icone: CircleAlert,
    classe: 'text-destructive',
  },
};

export function IndicadorSalvamento({ estado }: { estado: EstadoSalvamentoLaudo }) {
  const configuracao = configuracaoEstadoSalvamento[estado];
  const Icone = configuracao.icone;
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center gap-1.5 text-xs font-medium', configuracao.classe)}
    >
      <Icone className={cn('size-3.5', estado === 'salvando' && 'animate-spin')} />
      {configuracao.rotulo}
    </span>
  );
}

interface CabecalhoEditorLaudoProps {
  repNumero: string;
  tipoExameCodigo?: string;
  tipoExameNome?: string;
  nomeEnvolvido?: string;
  status: string;
  estadoSalvamento: EstadoSalvamentoLaudo;
  operacaoEmAndamento: boolean;
  carregandoPreview: boolean;
  exportando: boolean;
  libreOfficeDisponivel: boolean | null;
  onVoltar: () => void;
  onIrAoFinal: () => void;
  onVisualizar: () => void;
  onExportar: (formato: FormatoExportacaoLaudo) => void;
  onSalvar: () => void;
}

export function CabecalhoEditorLaudo({
  repNumero,
  tipoExameCodigo,
  tipoExameNome,
  status,
  estadoSalvamento,
  operacaoEmAndamento,
  carregandoPreview,
  exportando,
  libreOfficeDisponivel,
  onVoltar,
  onIrAoFinal,
  onVisualizar,
  onExportar,
  onSalvar,
}: CabecalhoEditorLaudoProps) {
  return (
    <header className="-mx-4 -mt-6 overflow-hidden border-b bg-background px-4 py-2 md:-mx-8 md:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onVoltar}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            Voltar para laudos
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onIrAoFinal}
            className="gap-2"
          >
            <ArrowDown className="size-4" />
            Ir ao final
          </Button>
          <span aria-hidden="true" className="text-muted-foreground">|</span>
          <h1 className="whitespace-nowrap text-lg font-bold leading-tight tracking-tight text-primary">
            REP {repNumero}
          </h1>
          <span aria-hidden="true" className="text-muted-foreground">|</span>
          <p className="min-w-0 flex-1 truncate text-sm leading-tight text-muted-foreground">
            {[tipoExameCodigo, tipoExameNome].filter(Boolean).join(' · ') || 'Editor de laudo'}
          </p>
          <Badge variant="outline" className={obterClasseBadgeStatusLaudo(status)}>
            {status}
          </Badge>
        </div>

        <div className="flex flex-none items-center gap-2">
          <div className="mr-1">
            <IndicadorSalvamento estado={estadoSalvamento} />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onVisualizar}
            disabled={operacaoEmAndamento}
            className="gap-2"
          >
            {carregandoPreview ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
            {carregandoPreview ? 'Gerando...' : 'Visualizar'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={operacaoEmAndamento}
                className="gap-2"
              >
                {exportando ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                {exportando ? 'Exportando...' : 'Exportar'}
                <ChevronDown className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => onExportar('pdf')}>
                <FileDown className="mr-2 size-4" />
                Baixar PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onExportar('docx')}>
                <FileText className="mr-2 size-4" />
                Baixar Word (.docx)
                <Badge
                  variant="outline"
                  title="Em desenvolvimento"
                  className="ml-auto shrink-0 border-amber-300 bg-amber-100 px-1.5 py-0 text-[10px] text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                >
                  Beta
                </Badge>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onExportar('odt')}
                disabled={libreOfficeDisponivel !== true}
              >
                <File className="mr-2 size-4" />
                Baixar ODT (.odt)
                <Badge
                  variant="outline"
                  title={`Em desenvolvimento${libreOfficeDisponivel !== true ? ` · ${libreOfficeDisponivel === null ? 'Verificando LibreOffice' : 'Requer LibreOffice'}` : ''}`}
                  className="ml-auto shrink-0 border-amber-300 bg-amber-100 px-1.5 py-0 text-[10px] text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                >
                  Beta
                </Badge>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            size="sm"
            onClick={onSalvar}
            disabled={operacaoEmAndamento}
            className="gap-2"
          >
            {estadoSalvamento === 'salvando'
              ? <Loader2 className="size-4 animate-spin" />
              : <Save className="size-4" />}
            {estadoSalvamento === 'salvando' ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
    </header>
  );
}

interface BarraEditorLaudoProps {
  modoConteudo: ModoConteudoLaudo;
  modoOrganizacao: ModoOrganizacaoLaudo;
  onModoConteudoChange: (modo: ModoConteudoLaudo) => void;
  onModoOrganizacaoChange: (modo: ModoOrganizacaoLaudo) => void;
}

export function BarraEditorLaudo({
  modoConteudo,
  modoOrganizacao,
  onModoConteudoChange,
  onModoOrganizacaoChange,
}: BarraEditorLaudoProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-3 border-t pt-4">
      <ControleSegmentado
        rotulo="Conteúdo exibido"
        valor={modoConteudo}
        onChange={onModoConteudoChange}
        opcoes={[
          { valor: 'dados', rotulo: 'Dados da REP', icone: Database },
          { valor: 'chaves', rotulo: 'Placeholders', icone: Braces },
        ]}
      />
      <ControleSegmentado
        rotulo="Organização"
        valor={modoOrganizacao}
        onChange={onModoOrganizacaoChange}
        opcoes={[
          { valor: 'single', rotulo: 'Documento único', icone: FileText },
          { valor: 'multi', rotulo: 'Por seções', icone: Layers3 },
        ]}
      />
    </div>
  );
}

interface RodapeEditorLaudoProps {
  estadoSalvamento: EstadoSalvamentoLaudo;
  operacaoEmAndamento: boolean;
  onVoltar: () => void;
  onVoltarAoTopo: () => void;
  onSalvar: () => void;
}

export function RodapeEditorLaudo({
  estadoSalvamento,
  operacaoEmAndamento,
  onVoltar,
  onVoltarAoTopo,
  onSalvar,
}: RodapeEditorLaudoProps) {
  return (
    <footer
      id="rodape-editor-laudo"
      className="mt-6 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_auto] sm:items-center"
    >
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" variant="secondary" size="sm" onClick={onVoltar} className="gap-2">
          <ArrowLeft className="size-4" />
          Voltar para laudos
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onVoltarAoTopo}
          className="gap-2"
        >
          <ArrowUp className="size-4" />
          Voltar ao topo
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <IndicadorSalvamento estado={estadoSalvamento} />
        <Button
          type="button"
          onClick={onSalvar}
          disabled={operacaoEmAndamento}
          className="gap-2"
        >
          {estadoSalvamento === 'salvando'
            ? <Loader2 className="size-4 animate-spin" />
            : <Save className="size-4" />}
          {estadoSalvamento === 'salvando' ? 'Salvando...' : 'Salvar laudo'}
        </Button>
      </div>
    </footer>
  );
}
