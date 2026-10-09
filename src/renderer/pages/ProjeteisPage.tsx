import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CatalogoProjeteisDialog } from '@/components/projeteis/CatalogoProjeteisDialog';
import { SiglaProjetil } from '@/components/projeteis/SiglaProjetil';
import { catalogoProjeteis } from '@shared/catalogos/projeteis.catalogo';
import { siglasProjeteis } from '@shared/catalogos/siglas-projeteis';
import { consultarProjeteis } from '@shared/utils/consulta-projeteis';
import type { ComparacaoMedida, ConsultaProjetil, EstadoProjetil, MedidaProjetil, ProjetilPersonalizadoEntrada, ProjetilReferencia, ResultadoProjetil } from '@shared/types/projetil.types';

type Formulario = Record<MedidaProjetil, string>;
const formularioVazio: Formulario = { calibreRealMm: '', alturaMaximaMm: '', massaGramas: '' };
const pdfUrl = `${import.meta.env.BASE_URL}tabela-calibres-balistica-forense.pdf`;
const campos: { chave: MedidaProjetil; titulo: string; unidade: string }[] = [
  { chave: 'calibreRealMm', titulo: 'Calibre real médio', unidade: 'mm' },
  { chave: 'alturaMaximaMm', titulo: 'Altura máxima', unidade: 'mm' },
  { chave: 'massaGramas', titulo: 'Massa', unidade: 'g' },
];

function numero(valor: string): number | null {
  if (!valor.trim()) return null;
  const convertido = Number(valor.trim().replace(',', '.'));
  return Number.isFinite(convertido) ? convertido : NaN;
}

function erroMedidas(formulario: Formulario): string | null {
  return campos.some(campo => {
    const valor = numero(formulario[campo.chave]);
    return valor !== null && (!Number.isFinite(valor) || valor <= 0);
  }) ? 'Use apenas medidas positivas.' : null;
}

function formatar(valor: number): string { return valor.toLocaleString('pt-BR', { maximumFractionDigits: 4 }); }

function MedidaCandidata({ titulo, unidade, comparacao }: { titulo: string; unidade: string; comparacao: ComparacaoMedida }) {
  const { observado, referenciaMin, referenciaMax, diferenca, confiavel } = comparacao;
  const referencia = referenciaMin === null || referenciaMax === null ? 'Não informado na fonte'
    : referenciaMin === referenciaMax ? `${formatar(referenciaMin)} ${unidade}` : `${formatar(referenciaMin)}–${formatar(referenciaMax)} ${unidade}`;
  const situacao = observado === null ? 'Não medido' : diferenca === null ? 'Sem comparação'
    : !confiavel ? 'Fora da classificação' : diferenca === 0 ? 'Dentro da faixa' : `Diferença: ${diferenca > 0 ? '+' : ''}${formatar(diferenca)} ${unidade}`;
  return <div className={`rounded-md border px-3 py-2 text-sm ${confiavel && diferenca === 0 ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-border'}`}>
    <div className="flex flex-wrap justify-between gap-1"><span className="font-medium">{titulo}</span><span className="text-muted-foreground">{situacao}</span></div>
    <p>Referência: {referencia}</p><p>Medido: {observado === null ? 'Não informado' : `${formatar(observado)} ${unidade}`}</p>
    {observado !== null && diferenca !== null && !confiavel && <p className="text-muted-foreground">Diferença observada: {diferenca > 0 ? '+' : ''}{formatar(diferenca)} {unidade}</p>}
  </div>;
}

function CartaoCandidato({ resultado, posicao, perdaMassa }: { resultado: ResultadoProjetil; posicao: number; perdaMassa: boolean }) {
  const { projetil, calibreReal, altura, massa, dadosAusentes, grupoMassa } = resultado;
  return <Card><CardContent className="space-y-3 py-4">
    <div className="flex flex-wrap items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground" aria-label={`Posição ${posicao}`}>{posicao}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{projetil.calibre}</h3><SiglaProjetil sigla={projetil.sigla} /><span className="text-sm text-muted-foreground">{projetil.tipo}</span></div><p className="text-xs text-muted-foreground">{dadosAusentes ? 'Comparação parcial: referência sem medida selecionada' : 'Ordenado pelas medidas selecionadas'}</p></div>{projetil.situacao === 'personalizada' && <Badge>Personalizado</Badge>}</div>
    <div className="grid gap-2 sm:grid-cols-3"><MedidaCandidata titulo="Calibre real médio" unidade="mm" comparacao={calibreReal} /><MedidaCandidata titulo="Altura máxima" unidade="mm" comparacao={altura} /><MedidaCandidata titulo="Massa" unidade="g" comparacao={massa} /></div>
    {perdaMassa && massa.observado !== null && <p className="text-xs text-muted-foreground">{grupoMassa === 0 ? 'Massa de referência igual ou superior à observada' : grupoMassa === 1 ? 'Massa não informada na fonte' : 'Massa de referência inferior à observada'}. A diferença não estima a perda.</p>}
    <p className="text-xs text-muted-foreground">Fonte: {projetil.fonte} · {projetil.localizacao}</p>
    {projetil.observacao && <p className="text-xs text-amber-700 dark:text-amber-400">{projetil.observacao}</p>}
    {(projetil.liga || projetil.linha || projetil.comprimentoEstojoMm || projetil.massaNucleoGramas || projetil.massaCamisaGramas) && <details className="text-xs"><summary className="cursor-pointer">Detalhes da referência</summary><div className="mt-1 space-y-1 text-muted-foreground">{projetil.liga && <p>Liga: {projetil.liga}</p>}{projetil.linha && <p>Linha: {projetil.linha}</p>}{projetil.comprimentoEstojoMm && <p>Comprimento do estojo: {projetil.comprimentoEstojoMm} mm</p>}{projetil.massaNucleoGramas && <p>Massa do núcleo: {projetil.massaNucleoGramas} g</p>}{projetil.massaCamisaGramas && <p>Massa da camisa: {projetil.massaCamisaGramas} g</p>}</div></details>}
  </CardContent></Card>;
}

function referenciaValida(valor: unknown): valor is ProjetilReferencia {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const dado = valor as Record<string, unknown>;
  return typeof dado.id === 'string' && typeof dado.calibre === 'string' && typeof dado.tipo === 'string'
    && dado.situacao === 'personalizada' && typeof dado.massaGramas === 'number' && Number.isFinite(dado.massaGramas) && dado.massaGramas > 0
    && (['calibreRealMinMm', 'calibreRealMaxMm', 'alturaMinMm', 'alturaMaxMm'] as const)
      .every(chave => dado[chave] === null || (typeof dado[chave] === 'number' && Number.isFinite(dado[chave]) && dado[chave] > 0));
}

export function ProjeteisPage() {
  const [consultaForm, setConsultaForm] = useState<Formulario>(formularioVazio);
  const [estado, setEstado] = useState<EstadoProjetil>('integro');
  const [confiaveis, setConfiaveis] = useState<Record<MedidaProjetil, boolean>>({ calibreRealMm: true, alturaMaximaMm: true, massaGramas: true });
  const [sigla, setSigla] = useState('todas');
  const [mostrarMais, setMostrarMais] = useState(false);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [pdfAberto, setPdfAberto] = useState(false);
  const [pdfCarregado, setPdfCarregado] = useState(false);
  const [pdfErro, setPdfErro] = useState(false);
  const [personalizados, setPersonalizados] = useState<ProjetilReferencia[]>([]);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [cadastroForm, setCadastroForm] = useState<Formulario & { calibre: string; tipo: string }>({ ...formularioVazio, calibre: '', tipo: '' });
  const [salvando, setSalvando] = useState(false);

  const carregarPersonalizados = useCallback(async () => {
    try {
      const resposta = await window.ipcAPI.projetil.listarPersonalizados();
      if (!resposta.success || !Array.isArray(resposta.data)) throw new Error(resposta.error || 'Falha ao carregar projéteis personalizados.');
      setPersonalizados(resposta.data.filter(referenciaValida));
    } catch (erro) { toast.error(erro instanceof Error ? erro.message : 'Falha ao carregar projéteis personalizados.'); }
  }, []);
  useEffect(() => { void carregarPersonalizados(); }, [carregarPersonalizados]);

  const erroConsulta = erroMedidas(consultaForm);
  const consulta = useMemo<ConsultaProjetil>(() => ({
    calibreRealMm: numero(consultaForm.calibreRealMm), alturaMaximaMm: numero(consultaForm.alturaMaximaMm),
    massaGramas: numero(consultaForm.massaGramas), estado, medidasConfiaveis: confiaveis,
    sigla: sigla === 'todas' ? null : sigla,
  }), [consultaForm, estado, confiaveis, sigla]);
  const possuiConsulta = campos.some(campo => consulta[campo.chave] !== null) || consulta.sigla !== null;
  const possuiClassificacao = campos.some(campo => consulta[campo.chave] !== null && confiaveis[campo.chave] && (estado !== 'perda_massa' || campo.chave !== 'massaGramas'));
  const referencias = useMemo(() => [...catalogoProjeteis, ...personalizados], [personalizados]);
  const siglas = useMemo(() => [...new Set(referencias.map(item => item.sigla).filter((valor): valor is string => Boolean(valor)))].sort(), [referencias]);
  const resultados = useMemo(() => erroConsulta || !possuiConsulta ? [] : consultarProjeteis(referencias, consulta), [referencias, consulta, erroConsulta, possuiConsulta]);
  const primeirosDez = resultados.slice(0, 10);
  const candidatosVisiveis = primeirosDez.slice(0, mostrarMais ? 10 : 3);

  function alterarEstado(valor: EstadoProjetil) {
    setEstado(valor);
    setConfiaveis(valor === 'integro'
      ? { calibreRealMm: true, alturaMaximaMm: true, massaGramas: true }
      : { calibreRealMm: false, alturaMaximaMm: false, massaGramas: false });
    setMostrarMais(false);
  }

  function abrirCadastro(item?: ProjetilReferencia) {
    setCatalogoAberto(false);
    setEditandoId(item?.id ?? null);
    setCadastroForm({
      calibre: item?.calibre ?? '', tipo: item?.tipo ?? '',
      calibreRealMm: item?.calibreRealMinMm?.toString() ?? '',
      alturaMaximaMm: item?.alturaMinMm?.toString() ?? '',
      massaGramas: item?.massaGramas?.toString() ?? '',
    });
    setDialogoAberto(true);
  }

  async function salvarCadastro() {
    const erro = erroMedidas(cadastroForm);
    if (erro) { toast.error(erro); return; }
    const dados: ProjetilPersonalizadoEntrada = {
      calibre: cadastroForm.calibre.trim(), tipo: cadastroForm.tipo.trim(),
      calibreRealMm: numero(cadastroForm.calibreRealMm), alturaMaximaMm: numero(cadastroForm.alturaMaximaMm),
      massaGramas: numero(cadastroForm.massaGramas) ?? 0,
    };
    setSalvando(true);
    try {
      const resposta = await window.ipcAPI.projetil.salvarPersonalizado(dados, editandoId ?? undefined);
      if (!resposta.success) throw new Error(resposta.error || 'Não foi possível salvar o projétil.');
      setDialogoAberto(false);
      await carregarPersonalizados();
      setCatalogoAberto(true);
      toast.success('Projétil personalizado salvo.');
    } catch (erroSalvar) { toast.error(erroSalvar instanceof Error ? erroSalvar.message : 'Falha ao salvar.'); }
    finally { setSalvando(false); }
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

  return <div className="space-y-6 pb-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1"><h1 className="text-2xl font-semibold">Identificação de projéteis</h1><p className="text-sm text-muted-foreground">Compare referências aproximadas. A ordem não determina o calibre por si só.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setPdfCarregado(false); setPdfErro(false); setPdfAberto(true); }}><FileText className="mr-2 h-4 w-4" />Consultar tabela em PDF</Button><Button variant="outline" onClick={() => setCatalogoAberto(true)}><BookOpen className="mr-2 h-4 w-4" />Ver catálogo completo</Button></div></div>
    <Card><CardHeader><CardTitle className="text-lg">Medidas observadas</CardTitle></CardHeader><CardContent className="space-y-5">
      <div className="max-w-sm space-y-1.5"><Label htmlFor="estado-projetil">Estado do projétil</Label><Select value={estado} onValueChange={alterarEstado}><SelectTrigger id="estado-projetil"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="integro">Íntegro</SelectItem><SelectItem value="deformado">Deformado</SelectItem><SelectItem value="perda_massa">Com perda de massa</SelectItem></SelectContent></Select></div>
      <div className="grid gap-4 sm:grid-cols-3">{campos.map(campo => <div key={campo.chave} className="space-y-2"><Label htmlFor={`consulta-${campo.chave}`}>{campo.titulo} ({campo.unidade})</Label><Input id={`consulta-${campo.chave}`} inputMode="decimal" value={consultaForm[campo.chave]} onChange={evento => { setConsultaForm(atual => ({ ...atual, [campo.chave]: evento.target.value })); setMostrarMais(false); }} placeholder="Opcional" />{estado !== 'integro' && (campo.chave !== 'massaGramas' || estado === 'deformado') && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={confiaveis[campo.chave]} onChange={evento => setConfiaveis(atual => ({ ...atual, [campo.chave]: evento.target.checked }))} />Medida confiável para ordenar</label>}</div>)}</div>
      <div className="max-w-sm space-y-1.5"><Label htmlFor="consulta-sigla">Formato/Constituição</Label><Select value={sigla} onValueChange={valor => { setSigla(valor); setMostrarMais(false); }}><SelectTrigger id="consulta-sigla"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todos</SelectItem>{siglas.map(valor => <SelectItem key={valor} value={valor}>{valor} — {siglasProjeteis[valor] ?? 'Nome não documentado'}</SelectItem>)}</SelectContent></Select></div>
      <p className="text-xs text-muted-foreground">Use vírgula ou ponto decimal. Informe somente medidas preservadas como confiáveis; diferenças das demais continuam visíveis.</p>
      <p className="text-xs text-muted-foreground">Raiamento e orientação constam no resumo geral por grupos de calibre da fonte textual; não identificam individualmente as variantes deste catálogo.</p>
      {estado === 'perda_massa' && <p className="text-xs text-muted-foreground">A massa observada é um limite inferior: referências com massa igual ou maior aparecem primeiro, sem estimativa da perda.</p>}
      {erroConsulta && <p className="text-sm text-destructive" role="alert">{erroConsulta}</p>}
    </CardContent></Card>
    <section className="space-y-3" aria-labelledby="titulo-candidatos"><div><h2 id="titulo-candidatos" className="text-lg font-semibold">{possuiClassificacao ? 'Referências por proximidade' : estado === 'perda_massa' && consulta.massaGramas !== null ? 'Referências por relação de massa' : 'Referências filtradas'}</h2><p className="text-xs text-muted-foreground">{possuiConsulta && !erroConsulta ? `${resultados.length} referência${resultados.length === 1 ? '' : 's'}; mostrando até ${mostrarMais ? 10 : 3}.` : 'Informe ao menos uma medida ou selecione um formato para consultar.'}</p></div>
      {candidatosVisiveis.map((resultado, indice) => <CartaoCandidato key={resultado.projetil.id} resultado={resultado} posicao={indice + 1} perdaMassa={estado === 'perda_massa'} />)}
      {!possuiConsulta && !erroConsulta && <p className="rounded-md border p-6 text-sm text-muted-foreground">O catálogo permanece disponível em “Ver catálogo completo”.</p>}
      {possuiConsulta && !erroConsulta && candidatosVisiveis.length === 0 && <p className="rounded-md border p-6 text-sm text-muted-foreground">Nenhuma referência corresponde ao formato selecionado.</p>}
      {primeirosDez.length > 3 && <div className="flex justify-center"><Button variant="outline" onClick={() => setMostrarMais(atual => !atual)}>{mostrarMais ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}{mostrarMais ? 'Mostrar menos' : `Mostrar mais opções (${primeirosDez.length - 3})`}</Button></div>}
    </section>
    <CatalogoProjeteisDialog aberto={catalogoAberto} aoAlterarAbertura={setCatalogoAberto} referencias={referencias} aoNovo={() => abrirCadastro()} aoEditar={abrirCadastro} aoExcluir={item => { void excluirCadastro(item); }} aoImportarCsv={importarCsv} />
    <Dialog open={pdfAberto} onOpenChange={setPdfAberto}><DialogContent className="flex h-[90vh] w-[calc(100vw-2rem)] max-w-6xl flex-col sm:max-w-6xl"><DialogHeader><DialogTitle>Tabela de calibres — referência visual</DialogTitle><DialogDescription>Documento original, com dimensões aproximadas.</DialogDescription></DialogHeader><div className="relative min-h-0 flex-1 overflow-hidden rounded border bg-muted">{pdfAberto && <iframe src={pdfUrl} title="Tabela de calibres em PDF" className="h-full w-full border-0" onLoad={() => setPdfCarregado(true)} onError={() => setPdfErro(true)} />}{!pdfCarregado && !pdfErro && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Carregando PDF...</p>}{pdfErro && <p className="absolute inset-0 flex items-center justify-center text-sm text-destructive">Não foi possível carregar o PDF.</p>}</div></DialogContent></Dialog>
    <Dialog open={dialogoAberto} onOpenChange={aberto => { setDialogoAberto(aberto); if (!aberto) setCatalogoAberto(true); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editandoId ? 'Editar projétil personalizado' : 'Novo projétil personalizado'}</DialogTitle><DialogDescription>Informe a massa e ao menos uma dimensão. Os dados ficam neste computador.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="cadastro-calibre">Calibre</Label><Input id="cadastro-calibre" value={cadastroForm.calibre} onChange={evento => setCadastroForm(atual => ({ ...atual, calibre: evento.target.value }))} /></div><div className="space-y-1.5"><Label htmlFor="cadastro-tipo">Tipo</Label><Input id="cadastro-tipo" value={cadastroForm.tipo} onChange={evento => setCadastroForm(atual => ({ ...atual, tipo: evento.target.value }))} /></div>{campos.map(campo => <div key={campo.chave} className="space-y-1.5"><Label htmlFor={`cadastro-${campo.chave}`}>{campo.titulo} ({campo.unidade})</Label><Input id={`cadastro-${campo.chave}`} inputMode="decimal" value={cadastroForm[campo.chave]} onChange={evento => setCadastroForm(atual => ({ ...atual, [campo.chave]: evento.target.value }))} /></div>)}</div><DialogFooter><Button variant="outline" onClick={() => { setDialogoAberto(false); setCatalogoAberto(true); }}>Cancelar</Button><Button disabled={salvando} onClick={() => { void salvarCadastro(); }}>{salvando ? 'Salvando...' : 'Salvar'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
