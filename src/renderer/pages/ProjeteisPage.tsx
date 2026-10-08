import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CatalogoProjeteisDialog } from '@/components/projeteis/CatalogoProjeteisDialog';
import { catalogoProjeteis } from '@shared/catalogos/projeteis.catalogo';
import { consultarProjeteis } from '@shared/utils/consulta-projeteis';
import type { ConsultaProjetil, ProjetilPersonalizadoEntrada, ProjetilReferencia, ResultadoProjetil } from '@shared/types/projetil.types';

type CampoNumero = 'massaGramas' | 'diametroMinMm' | 'diametroMaxMm' | 'comprimentoMinMm' | 'comprimentoMaxMm';
type Formulario = Record<CampoNumero, string> & { calibre: string; tipo: string };

const formularioVazio: Formulario = {
  calibre: '', tipo: '', massaGramas: '', diametroMinMm: '', diametroMaxMm: '',
  comprimentoMinMm: '', comprimentoMaxMm: '',
};

function numero(valor: string): number | null {
  if (!valor.trim()) return null;
  const convertido = Number(valor.trim().replace(',', '.'));
  return Number.isFinite(convertido) ? convertido : NaN;
}

function validarConsulta(formulario: Formulario): string | null {
  for (const nome of ['massaGramas', 'diametroMinMm', 'diametroMaxMm', 'comprimentoMinMm', 'comprimentoMaxMm'] as CampoNumero[]) {
    const valor = numero(formulario[nome]);
    if (valor !== null && (!Number.isFinite(valor) || valor <= 0)) return 'Use apenas medidas positivas.';
  }
  for (const [menor, maior] of [
    ['diametroMinMm', 'diametroMaxMm'], ['comprimentoMinMm', 'comprimentoMaxMm'],
  ] as [CampoNumero, CampoNumero][]) {
    const minimo = numero(formulario[menor]);
    const maximo = numero(formulario[maior]);
    if (minimo !== null && maximo !== null && minimo > maximo) return 'O valor mínimo deve ser menor ou igual ao máximo.';
  }
  return null;
}

function rotuloMedida(menor: number | null, maior: number | null, unidade: string): string {
  if (menor === null || maior === null) return 'Não informado';
  return menor === maior ? `${menor} ${unidade}` : `${menor}–${maior} ${unidade}`;
}

function MedidaCandidata({
  titulo, valor, estado,
}: {
  titulo: string;
  valor: string;
  estado: 'coincide' | 'ausente' | 'nao_informado';
}) {
  return <div className={`rounded-md border px-3 py-2 text-sm ${estado === 'coincide' ? 'border-emerald-500/60 bg-emerald-500/10' : estado === 'ausente' ? 'border-amber-500/40 bg-amber-500/5' : 'border-border'}`}>
    <div className="flex flex-wrap items-center justify-between gap-1"><span className="font-medium">{titulo}</span><span className={estado === 'coincide' ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}>{estado === 'coincide' ? 'Coincide' : estado === 'ausente' ? 'Sem dado' : 'Não comparado'}</span></div>
    <span>{valor}</span>
  </div>;
}

function CartaoCandidato({ resultado, posicao, consulta }: {
  resultado: ResultadoProjetil;
  posicao: number;
  consulta: ConsultaProjetil;
}) {
  const { projetil, compatibilidade, diametro, comprimento, diferencaMassaGramas } = resultado;
  return <Card>
    <CardContent className="space-y-3 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" aria-label={`Posição ${posicao}`}>{posicao}</span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{projetil.calibre}</h3><span className="text-sm text-muted-foreground">{projetil.tipo}</span></div><p className="text-xs text-muted-foreground">{compatibilidade === 'compativel' ? 'Medidas informadas compatíveis' : 'Comparação parcial'}</p></div>
        <Badge variant={projetil.situacao === 'confirmada' ? 'default' : 'outline'}>{projetil.situacao === 'confirmada' ? 'Confirmada' : projetil.situacao === 'personalizada' ? 'Personalizada' : 'Estimada'}</Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <MedidaCandidata titulo="Diâmetro real" valor={rotuloMedida(projetil.diametroMinMm, projetil.diametroMaxMm, 'mm')} estado={diametro} />
        <MedidaCandidata titulo="Comprimento" valor={rotuloMedida(projetil.comprimentoMinMm, projetil.comprimentoMaxMm, 'mm')} estado={comprimento} />
        <div className={`rounded-md border px-3 py-2 text-sm ${diferencaMassaGramas === 0 ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-border'}`}><div className="flex flex-wrap items-center justify-between gap-1"><span className="font-medium">Massa</span><span className="text-muted-foreground">{consulta.massaGramas === null ? 'Não comparada' : diferencaMassaGramas === 0 ? 'Coincide' : `Diferença: ${diferencaMassaGramas?.toFixed(3)} g`}</span></div><span>{projetil.massaGramas} g</span></div>
      </div>
      {projetil.situacao === 'estimada' && <p className="text-xs text-amber-700 dark:text-amber-400">Dados estimados; as medidas não foram integralmente confirmadas para esta variante.</p>}
    </CardContent>
  </Card>;
}

function referenciaValida(valor: unknown): valor is ProjetilReferencia {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const dado = valor as Record<string, unknown>;
  return typeof dado.id === 'string' && typeof dado.calibre === 'string'
    && typeof dado.tipo === 'string' && typeof dado.massaGramas === 'number'
    && Number.isFinite(dado.massaGramas) && dado.massaGramas > 0 && dado.situacao === 'personalizada'
    && (['diametroMinMm', 'diametroMaxMm', 'comprimentoMinMm', 'comprimentoMaxMm'] as const)
      .every(chave => dado[chave] === null || (typeof dado[chave] === 'number' && Number.isFinite(dado[chave]) && dado[chave] > 0))
    && (dado.diametroMinMm === null && dado.diametroMaxMm === null
      || typeof dado.diametroMinMm === 'number' && typeof dado.diametroMaxMm === 'number' && dado.diametroMinMm <= dado.diametroMaxMm)
    && (dado.comprimentoMinMm === null && dado.comprimentoMaxMm === null
      || typeof dado.comprimentoMinMm === 'number' && typeof dado.comprimentoMaxMm === 'number' && dado.comprimentoMinMm <= dado.comprimentoMaxMm);
}

export function ProjeteisPage() {
  const [consultaForm, setConsultaForm] = useState<Formulario>(formularioVazio);
  const [mostrarMais, setMostrarMais] = useState(false);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [personalizados, setPersonalizados] = useState<ProjetilReferencia[]>([]);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [cadastroForm, setCadastroForm] = useState<Formulario>(formularioVazio);
  const [salvando, setSalvando] = useState(false);

  const carregarPersonalizados = useCallback(async () => {
    try {
      const resposta = await window.ipcAPI.projetil.listarPersonalizados();
      if (!resposta.success || !Array.isArray(resposta.data)) throw new Error(resposta.error || 'Falha ao carregar projéteis personalizados.');
      setPersonalizados(resposta.data.filter(referenciaValida));
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Falha ao carregar projéteis personalizados.');
    }
  }, []);

  useEffect(() => { void carregarPersonalizados(); }, [carregarPersonalizados]);

  const erroConsulta = validarConsulta(consultaForm);
  const consulta = useMemo<ConsultaProjetil>(() => ({
    massaGramas: numero(consultaForm.massaGramas),
    diametroMinMm: numero(consultaForm.diametroMinMm),
    diametroMaxMm: numero(consultaForm.diametroMaxMm),
    comprimentoMinMm: numero(consultaForm.comprimentoMinMm),
    comprimentoMaxMm: numero(consultaForm.comprimentoMaxMm),
  }), [consultaForm]);
  const possuiConsulta = Object.values(consulta).some(valor => valor !== null);
  const referencias = useMemo(() => [...catalogoProjeteis, ...personalizados], [personalizados]);
  const resultados = useMemo(() => {
    return erroConsulta || !possuiConsulta ? [] : consultarProjeteis(referencias, consulta);
  }, [consulta, referencias, erroConsulta, possuiConsulta]);
  const primeirosDez = resultados.slice(0, 10);
  const candidatosVisiveis = primeirosDez.slice(0, mostrarMais ? 10 : 3);

  function alterarConsulta(chave: CampoNumero, valor: string) {
    setConsultaForm(atual => ({ ...atual, [chave]: valor }));
    setMostrarMais(false);
  }

  function abrirCadastro(item?: ProjetilReferencia) {
    setCatalogoAberto(false);
    setEditandoId(item?.id ?? null);
    setCadastroForm(item ? {
      calibre: item.calibre, tipo: item.tipo, massaGramas: String(item.massaGramas),
      diametroMinMm: item.diametroMinMm === null ? '' : String(item.diametroMinMm),
      diametroMaxMm: item.diametroMaxMm === null ? '' : String(item.diametroMaxMm),
      comprimentoMinMm: item.comprimentoMinMm === null ? '' : String(item.comprimentoMinMm),
      comprimentoMaxMm: item.comprimentoMaxMm === null ? '' : String(item.comprimentoMaxMm),
    } : formularioVazio);
    setDialogoAberto(true);
  }

  function alterarAberturaCadastro(aberto: boolean) {
    setDialogoAberto(aberto);
    if (!aberto) setCatalogoAberto(true);
  }

  async function salvarCadastro() {
    const erro = validarConsulta(cadastroForm);
    if (erro) { toast.error(erro); return; }
    const dados: ProjetilPersonalizadoEntrada = {
      calibre: cadastroForm.calibre.trim(), tipo: cadastroForm.tipo.trim(),
      massaGramas: numero(cadastroForm.massaGramas) ?? 0,
      diametroMinMm: numero(cadastroForm.diametroMinMm),
      diametroMaxMm: numero(cadastroForm.diametroMaxMm),
      comprimentoMinMm: numero(cadastroForm.comprimentoMinMm),
      comprimentoMaxMm: numero(cadastroForm.comprimentoMaxMm),
    };
    setSalvando(true);
    try {
      const resposta = await window.ipcAPI.projetil.salvarPersonalizado(dados, editandoId ?? undefined);
      if (!resposta.success) throw new Error(resposta.error || 'Não foi possível salvar o projétil.');
      setDialogoAberto(false);
      await carregarPersonalizados();
      setCatalogoAberto(true);
      toast.success('Projétil personalizado salvo.');
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : 'Falha ao salvar.');
    } finally { setSalvando(false); }
  }

  async function excluirCadastro(item: ProjetilReferencia) {
    if (!window.confirm(`Excluir o projétil personalizado ${item.calibre} — ${item.tipo}?`)) return;
    try {
      const resposta = await window.ipcAPI.projetil.excluirPersonalizado(item.id);
      if (!resposta.success) throw new Error(resposta.error || 'Não foi possível excluir.');
      await carregarPersonalizados();
      toast.success('Projétil personalizado excluído.');
    } catch (erro) { toast.error(erro instanceof Error ? erro.message : 'Falha ao excluir.'); }
  }

  async function importarCsv(arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      const resposta = await window.ipcAPI.projetil.importarCsv(await arquivo.text());
      if (!resposta.success) throw new Error(resposta.error || 'Falha ao importar CSV.');
      await carregarPersonalizados();
      toast.success(`${resposta.data ?? 0} projéteis importados.`);
    } catch (erro) { toast.error(erro instanceof Error ? erro.message : 'Falha ao importar CSV.'); }
  }

  const campos: { chave: CampoNumero; titulo: string }[] = [
    { chave: 'diametroMinMm', titulo: 'Diâmetro mínimo (mm)' },
    { chave: 'diametroMaxMm', titulo: 'Diâmetro máximo (mm)' },
    { chave: 'comprimentoMinMm', titulo: 'Comprimento mínimo (mm)' },
    { chave: 'comprimentoMaxMm', titulo: 'Comprimento máximo (mm)' },
    { chave: 'massaGramas', titulo: 'Massa (g)' },
  ];

  return <div className="space-y-6 pb-8">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Identificação de projéteis</h1>
        <p className="text-sm text-muted-foreground">Compare as medidas observadas para localizar variantes candidatas. O resultado não determina o calibre por si só.</p>
      </div>
      <Button variant="outline" onClick={() => setCatalogoAberto(true)}><BookOpen className="mr-2 h-4 w-4" />Ver catálogo completo</Button>
    </div>

    <Card>
      <CardHeader><CardTitle className="text-lg">Medidas observadas</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3" aria-labelledby="titulo-diametro">
          <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">1</span><h2 id="titulo-diametro" className="font-medium">Diâmetro real do projétil</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="consulta-diametroMinMm">Mínimo (mm)</Label><Input id="consulta-diametroMinMm" inputMode="decimal" value={consultaForm.diametroMinMm} onChange={evento => alterarConsulta('diametroMinMm', evento.target.value)} placeholder="Opcional" /></div>
            <div className="space-y-1.5"><Label htmlFor="consulta-diametroMaxMm">Máximo (mm)</Label><Input id="consulta-diametroMaxMm" inputMode="decimal" value={consultaForm.diametroMaxMm} onChange={evento => alterarConsulta('diametroMaxMm', evento.target.value)} placeholder="Opcional" /></div>
          </div>
        </section>
        <section className="space-y-3 border-t pt-5" aria-labelledby="titulo-comprimento">
          <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">2</span><h2 id="titulo-comprimento" className="font-medium">Comprimento do projétil</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="consulta-comprimentoMinMm">Mínimo (mm)</Label><Input id="consulta-comprimentoMinMm" inputMode="decimal" value={consultaForm.comprimentoMinMm} onChange={evento => alterarConsulta('comprimentoMinMm', evento.target.value)} placeholder="Opcional" /></div>
            <div className="space-y-1.5"><Label htmlFor="consulta-comprimentoMaxMm">Máximo (mm)</Label><Input id="consulta-comprimentoMaxMm" inputMode="decimal" value={consultaForm.comprimentoMaxMm} onChange={evento => alterarConsulta('comprimentoMaxMm', evento.target.value)} placeholder="Opcional" /></div>
          </div>
        </section>
        <section className="space-y-3 border-t pt-5" aria-labelledby="titulo-massa">
          <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">3</span><h2 id="titulo-massa" className="font-medium">Massa do projétil</h2></div>
          <div className="max-w-sm space-y-1.5"><Label htmlFor="consulta-massaGramas">Massa (g)</Label><Input id="consulta-massaGramas" inputMode="decimal" value={consultaForm.massaGramas} onChange={evento => alterarConsulta('massaGramas', evento.target.value)} placeholder="Opcional" /></div>
        </section>
        <p className="text-xs text-muted-foreground">Use vírgula ou ponto decimal. Para uma medida única, informe apenas um dos limites. A massa ordena candidatos, sem eliminá-los.</p>
        {erroConsulta && <p className="text-sm text-destructive" role="alert">{erroConsulta}</p>}
      </CardContent>
    </Card>

    <section className="space-y-3" aria-labelledby="titulo-candidatos">
      <div><h2 id="titulo-candidatos" className="text-lg font-semibold">Candidatos mais compatíveis</h2><p className="text-xs text-muted-foreground">{possuiConsulta && !erroConsulta ? `${resultados.length} candidato${resultados.length === 1 ? '' : 's'} elegível${resultados.length === 1 ? '' : 'eis'}; mostrando até ${mostrarMais ? 10 : 3}.` : 'Informe ao menos uma medida para ver os candidatos.'}</p></div>
      {candidatosVisiveis.map((resultado, indice) => <CartaoCandidato key={resultado.projetil.id} resultado={resultado} posicao={indice + 1} consulta={consulta} />)}
      {!possuiConsulta && !erroConsulta && <p className="rounded-md border p-6 text-sm text-muted-foreground">O catálogo permanece disponível em “Ver catálogo completo”.</p>}
      {possuiConsulta && !erroConsulta && candidatosVisiveis.length === 0 && <p className="rounded-md border p-6 text-sm text-muted-foreground">Nenhuma variante é compatível com as dimensões informadas. Revise as medidas ou consulte o catálogo completo.</p>}
      {primeirosDez.length > 3 && <div className="flex justify-center"><Button variant="outline" onClick={() => setMostrarMais(atual => !atual)}>{mostrarMais ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}{mostrarMais ? 'Mostrar menos' : `Mostrar mais opções (${primeirosDez.length - 3})`}</Button></div>}
      {mostrarMais && resultados.length > 10 && <p className="text-center text-xs text-muted-foreground">Exibidos os dez primeiros candidatos na ordem de compatibilidade.</p>}
    </section>

    <CatalogoProjeteisDialog aberto={catalogoAberto} aoAlterarAbertura={setCatalogoAberto} referencias={referencias} aoNovo={() => abrirCadastro()} aoEditar={abrirCadastro} aoExcluir={item => { void excluirCadastro(item); }} aoImportarCsv={importarCsv} />

    <Dialog open={dialogoAberto} onOpenChange={alterarAberturaCadastro}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{editandoId ? 'Editar projétil personalizado' : 'Novo projétil personalizado'}</DialogTitle><DialogDescription>Informe a massa e ao menos uma dimensão. Os dados serão armazenados neste computador.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="cadastro-calibre">Calibre</Label><Input id="cadastro-calibre" value={cadastroForm.calibre} onChange={evento => setCadastroForm(atual => ({ ...atual, calibre: evento.target.value }))} /></div>
          <div className="space-y-1.5"><Label htmlFor="cadastro-tipo">Tipo</Label><Input id="cadastro-tipo" value={cadastroForm.tipo} onChange={evento => setCadastroForm(atual => ({ ...atual, tipo: evento.target.value }))} /></div>
          {campos.map(campo => <div key={campo.chave} className="space-y-1.5"><Label htmlFor={`cadastro-${campo.chave}`}>{campo.titulo}</Label><Input id={`cadastro-${campo.chave}`} inputMode="decimal" value={cadastroForm[campo.chave]} onChange={evento => setCadastroForm(atual => ({ ...atual, [campo.chave]: evento.target.value }))} /></div>)}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => alterarAberturaCadastro(false)}>Cancelar</Button><Button disabled={salvando} onClick={() => { void salvarCadastro(); }}>{salvando ? 'Salvando...' : 'Salvar'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
