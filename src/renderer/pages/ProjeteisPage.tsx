import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, ChevronDown, ChevronUp, Medal, MoveVertical, RotateCcw, Ruler, Weight, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { LIMITE_PROXIMIDADE_PERCENTUAL } from '@shared/utils/proximidade-medida';
import { ControleProximidade } from '@/components/projeteis/ControleProximidade';
import { FormatoProjetilCombobox } from '@/components/projeteis/FormatoProjetilCombobox';
import { AjudaPerdaMaterial } from '@/components/projeteis/AjudaPerdaMaterial';
import { AjudaProjeteisDialog } from '@/components/projeteis/AjudaProjeteisDialog';
import { FontesProjeteisDialog } from '@/components/projeteis/FontesProjeteisDialog';
import { CatalogoProjeteisDialog } from '@/components/projeteis/CatalogoProjeteisDialog';
import { SiglaProjetil } from '@/components/projeteis/SiglaProjetil';
import { RaiamentoProjetil } from '@/components/projeteis/RaiamentoProjetil';
import { catalogoProjeteis } from '@shared/catalogos/projeteis.catalogo';
import { siglasProjeteis } from '@shared/catalogos/siglas-projeteis';
import { consultarProjeteis } from '@shared/utils/consulta-projeteis';
import type { ComparacaoMedida, ConsultaProjetil, MedidaProjetil, ProjetilPersonalizadoEntrada, ProjetilReferencia, ResultadoProjetil } from '@shared/types/projetil.types';

type Formulario = Record<MedidaProjetil, string>;
const formularioVazio: Formulario = { calibreRealMm: '', alturaMaximaMm: '', massaGramas: '' };
const campos: { chave: MedidaProjetil; titulo: string; unidade: string; icone: LucideIcon }[] = [
  { chave: 'calibreRealMm', titulo: 'Calibre real médio', unidade: 'mm', icone: Ruler },
  { chave: 'alturaMaximaMm', titulo: 'Altura máxima', unidade: 'mm', icone: MoveVertical },
  { chave: 'massaGramas', titulo: 'Massa', unidade: 'g', icone: Weight },
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

function MedidaCandidata({ titulo, unidade, comparacao, perdaMassa = false, proxima = false, className }: { titulo: string; unidade: string; comparacao: ComparacaoMedida; perdaMassa?: boolean; proxima?: boolean; className?: string }) {
  const { observado, referenciaMin, referenciaMax, diferenca, utilizada } = comparacao;
  const referencia = referenciaMin === null || referenciaMax === null ? 'Não informada'
    : referenciaMin === referenciaMax ? `${formatar(referenciaMin)} ${unidade}` : `${formatar(referenciaMin)}–${formatar(referenciaMax)} ${unidade}`;
  const motivoDesconsiderada = observado === null ? 'Não usada: medida não preenchida'
    : perdaMassa ? 'Massa usada como limite inferior' : !utilizada ? 'Não usada: referência sem esta medida' : null;
  const desvio = diferenca;
  const limiteReferencia = observado === null || referenciaMin === null || referenciaMax === null ? null
    : observado < referenciaMin ? referenciaMin : observado > referenciaMax ? referenciaMax : observado;
  const percentual = desvio !== null && limiteReferencia !== null && limiteReferencia > 0 ? desvio / limiteReferencia * 100 : null;
  const percentualFormatado = percentual === null ? '' : `${Number(percentual.toPrecision(12)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' })}%`;
  const detalhe = observado === null ? 'Não informada'
    : desvio === null ? 'Referência sem esta medida'
      : perdaMassa ? 'Massa como limite inferior'
        : desvio === 0 ? `0 ${unidade} (0,00%) · ${referenciaMin === referenciaMax ? 'Mesmo valor' : 'Dentro da faixa'}`
          : `${desvio > 0 ? '+' : ''}${formatar(desvio)} ${unidade} (${percentualFormatado})`;
  return <div role="group" aria-label={`Medida: ${titulo}`} className={cn('min-w-0 rounded-md border px-3 py-3 text-sm', proxima ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-border', className)}>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-1"><span className="font-medium">{titulo}</span>{proxima && diferenca !== 0 && <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Próxima da referência</span>}{motivoDesconsiderada && <span className="text-xs text-muted-foreground">{motivoDesconsiderada}</span>}</div>
    <div className="grid grid-cols-2 gap-2">
      <div><p className="text-xs text-muted-foreground">Referência</p><p className="font-semibold tabular-nums">{referencia}</p></div>
      <div><p className="text-xs text-muted-foreground">Medido</p><p className="font-semibold tabular-nums">{observado === null ? 'Não informado' : `${formatar(observado)} ${unidade}`}</p></div>
    </div>
    <p className="mt-3 border-t pt-2 text-xs"><span className="font-medium">Diferença: </span><span className="text-muted-foreground">{detalhe}</span></p>
  </div>;
}

const coresMedalha = [
  'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
];

function CartaoCandidato({ resultado, posicao, perdaMassa, destaque = false }: { resultado: ResultadoProjetil; posicao: number; perdaMassa: boolean; destaque?: boolean }) {
  const { projetil, calibreReal, altura, massa, grupoMassa, pontuacao } = resultado;
  const totalMedidas = [calibreReal, altura, ...(!perdaMassa ? [massa] : [])].filter(medida => medida.observado !== null).length;
  const classesMedida = destaque ? '@[1024px]/resultados:col-span-2 @[1024px]/resultados:[&>div:first-child]:min-h-10' : undefined;
  // A contenção por largura fica no conteúdo; no cartão ela impediria o alinhamento por subgrid.
  return <Card className={cn('flex min-w-0 overflow-hidden', destaque && '@[1024px]/resultados:row-span-5 @[1024px]/resultados:grid @[1024px]/resultados:grid-cols-[4rem_minmax(0,1fr)] @[1024px]/resultados:grid-rows-subgrid @[1024px]/resultados:gap-x-3 @[1024px]/resultados:p-4')}>
    <div className={cn('flex w-20 shrink-0 items-center justify-center border-r bg-muted/40 sm:w-24', destaque && '@[1024px]/resultados:col-start-1 @[1024px]/resultados:row-start-1 @[1024px]/resultados:w-16 @[1024px]/resultados:self-start @[1024px]/resultados:border-0 @[1024px]/resultados:bg-transparent')} role="img" aria-label={`Posição ${posicao} na ordem das referências`}>
      {posicao <= 3 ? <div className={`flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl ${coresMedalha[posicao - 1]}`}><Medal className="h-8 w-8" aria-hidden="true" /><span className="text-sm font-bold leading-none">{posicao}º</span></div>
        : <span className="flex h-12 w-12 items-center justify-center rounded-full border bg-background text-lg font-semibold text-muted-foreground">{posicao}</span>}
    </div>
    <CardContent className={cn('@container/cartao min-w-0 flex-1 space-y-3 px-4 py-4 sm:px-5', destaque && '@[1024px]/resultados:contents @[1024px]/resultados:space-y-0 @[1024px]/resultados:[container-type:normal]')}>
      <div className={cn('flex min-w-0 flex-wrap items-start gap-3', destaque && '@[1024px]/resultados:col-start-2 @[1024px]/resultados:row-start-1 @[1024px]/resultados:self-start @[1024px]/resultados:flex-col')}>
        <div className={cn('min-w-0 flex-1', destaque && '@[1024px]/resultados:w-full')}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 max-w-full break-words text-xl font-bold leading-tight tracking-tight text-primary sm:text-2xl">{projetil.calibre}</h3>
            <SiglaProjetil sigla={projetil.sigla} />
            {projetil.tipo !== projetil.sigla && projetil.tipo !== projetil.calibre && projetil.tipo !== 'Formato não informado' && <span className="text-sm text-muted-foreground">{projetil.tipo}</span>}
          </div>
          {pontuacao === null && <p className="text-xs text-muted-foreground">Sem comparação por proximidade</p>}
          {totalMedidas > 0 && <p className="mt-1 text-xs font-medium text-muted-foreground">{resultado.medidasProximas.length} de {totalMedidas} {totalMedidas === 1 ? 'medida próxima' : 'medidas próximas'}</p>}
        </div>
        {projetil.situacao === 'personalizada' && <Badge>Personalizado</Badge>}
      </div>
      <div className={cn('grid gap-2 @[640px]/cartao:grid-cols-3', destaque && '@[1024px]/resultados:contents')}>
        <MedidaCandidata titulo="Calibre real médio" unidade="mm" comparacao={calibreReal} proxima={resultado.medidasProximas.includes('calibreRealMm')} className={cn(classesMedida, destaque && '@[1024px]/resultados:row-start-2')} />
        <MedidaCandidata titulo="Altura máxima" unidade="mm" comparacao={altura} proxima={resultado.medidasProximas.includes('alturaMaximaMm')} className={cn(classesMedida, destaque && '@[1024px]/resultados:row-start-3')} />
        <MedidaCandidata titulo="Massa" unidade="g" comparacao={massa} proxima={resultado.medidasProximas.includes('massaGramas')} perdaMassa={perdaMassa} className={cn(classesMedida, destaque && '@[1024px]/resultados:row-start-4')} />
      </div>
      <div className={cn('space-y-3', destaque && '@[1024px]/resultados:col-span-2 @[1024px]/resultados:row-start-5')}>
        {perdaMassa && massa.observado !== null && <p className="text-xs text-muted-foreground">{grupoMassa === 0 ? 'Massa de referência igual ou superior à observada' : grupoMassa === 1 ? 'Massa não informada na fonte' : 'Massa de referência inferior à observada'}.</p>}
        <RaiamentoProjetil calibre={projetil.calibre} />
        {(projetil.observacao || projetil.liga || projetil.linha || projetil.comprimentoEstojoMm || projetil.massaNucleoGramas || projetil.massaCamisaGramas) && <details className="text-xs"><summary className="cursor-pointer">Detalhes da referência</summary><div className="mt-1 space-y-1 text-muted-foreground">{projetil.observacao && <p>{projetil.observacao}</p>}{projetil.liga && <p>Liga: {projetil.liga}</p>}{projetil.linha && <p>Linha: {projetil.linha}</p>}{projetil.comprimentoEstojoMm && <p>Comprimento do estojo: {projetil.comprimentoEstojoMm} mm</p>}{projetil.massaNucleoGramas && <p>Massa do núcleo: {projetil.massaNucleoGramas} g</p>}{projetil.massaCamisaGramas && <p>Massa da camisa: {projetil.massaCamisaGramas} g</p>}</div></details>}
      </div>
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
  const [medidaPrioritaria, setMedidaPrioritaria] = useState<MedidaProjetil>('massaGramas');
  const [perdaMaterial, setPerdaMaterial] = useState(false);
  const [limiteProximidade, setLimiteProximidade] = useState(LIMITE_PROXIMIDADE_PERCENTUAL);
  const [textoProximidade, setTextoProximidade] = useState('5,00');
  const [sigla, setSigla] = useState('todas');
  const [mostrarMais, setMostrarMais] = useState(false);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
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
    massaGramas: numero(consultaForm.massaGramas), medidaPrioritaria, perdaMaterial, limiteProximidadePercentual: limiteProximidade,
    sigla: sigla === 'todas' ? null : sigla,
  }), [consultaForm, medidaPrioritaria, perdaMaterial, sigla, limiteProximidade]);
  const possuiConsulta = campos.some(campo => consulta[campo.chave] !== null) || consulta.sigla !== null;
  const possuiClassificacao = campos.some(campo => consulta[campo.chave] !== null && (!perdaMaterial || campo.chave !== 'massaGramas'));
  const referencias = useMemo(() => [...catalogoProjeteis, ...personalizados], [personalizados]);
  const siglas = useMemo(() => [...new Set(referencias.map(item => item.sigla).filter((valor): valor is string => Boolean(valor)))].sort(), [referencias]);
  const resultados = useMemo(() => erroConsulta || !possuiConsulta ? [] : consultarProjeteis(referencias, consulta), [referencias, consulta, erroConsulta, possuiConsulta]);
  const primeirosDez = resultados.slice(0, 10);
  const candidatosPrincipais = primeirosDez.slice(0, 3);
  const candidatosAdicionais = mostrarMais ? primeirosDez.slice(3) : [];
  const colunasPrincipais = candidatosPrincipais.length === 3 ? '@[1024px]/resultados:grid-cols-3'
    : candidatosPrincipais.length === 2 ? '@[1024px]/resultados:grid-cols-2' : 'grid-cols-1';

  function limparConsulta() {
    setConsultaForm(formularioVazio);
    setMedidaPrioritaria('massaGramas');
    setPerdaMaterial(false);
    setLimiteProximidade(LIMITE_PROXIMIDADE_PERCENTUAL);
    setTextoProximidade('5,00');
    setSigla('todas');
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
    <div className="flex flex-wrap items-start justify-between gap-3"><h1 className="text-2xl font-semibold">Identificação de projéteis</h1><div className="flex flex-wrap gap-2"><AjudaProjeteisDialog limiteProximidade={limiteProximidade} /><FontesProjeteisDialog /><Button variant="outline" onClick={() => setCatalogoAberto(true)}><BookOpen className="mr-2 h-4 w-4" />Ver catálogo completo</Button></div></div>
    <Card className="@container/medicoes"><CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0"><CardTitle className="text-lg">Medidas observadas</CardTitle><Button variant="ghost" size="sm" onClick={limparConsulta}><RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />Limpar resultados</Button></CardHeader><CardContent className="space-y-4">
      <fieldset className="space-y-4" aria-describedby="ajuda-prioridade">
        <legend className="sr-only">Medida prioritária para classificação</legend>
        <div className="grid gap-4 @[768px]/medicoes:grid-cols-3">{campos.map(campo => <div key={campo.chave} className={`min-w-0 space-y-3 rounded-lg border p-3 ${medidaPrioritaria === campo.chave ? 'border-primary/60 bg-primary/5' : 'border-border'}`}>
          <div className="space-y-1.5">
          <Label htmlFor={`consulta-${campo.chave}`} className="flex items-center gap-2"><campo.icone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />{campo.titulo} ({campo.unidade})</Label>
          <Input id={`consulta-${campo.chave}`} inputMode="decimal" value={consultaForm[campo.chave]} onChange={evento => { setConsultaForm(atual => ({ ...atual, [campo.chave]: evento.target.value })); setMostrarMais(false); }} placeholder="Opcional" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs"><input type="radio" name="medida-prioritaria" value={campo.chave} checked={medidaPrioritaria === campo.chave} aria-label={`Priorizar ${campo.titulo.toLocaleLowerCase('pt-BR')}`} onChange={() => { setMedidaPrioritaria(campo.chave); setMostrarMais(false); }} className="h-4 w-4 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" />Priorizar esta medida</label>
          {campo.chave === 'massaGramas' && <div className="flex items-center gap-1 border-t pt-3"><label className="flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" aria-describedby="descricao-perda-material" checked={perdaMaterial} onChange={evento => { setPerdaMaterial(evento.target.checked); setMostrarMais(false); }} className="h-4 w-4 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" />Houve perda de material</label><AjudaPerdaMaterial /></div>}
        </div>)}</div>
      </fieldset>
      {erroConsulta && <p className="text-sm text-destructive" role="alert">{erroConsulta}</p>}
      <fieldset className="grid gap-4 rounded-lg border bg-muted/20 p-3 @[512px]/medicoes:grid-cols-2">
        <legend className="sr-only">Ajustes da comparação</legend>
        <div className="min-w-0 space-y-1.5"><Label htmlFor="consulta-sigla">Formato/Constituição</Label><Select value={sigla} onValueChange={valor => { setSigla(valor); setMostrarMais(false); }}><SelectTrigger id="consulta-sigla"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todos</SelectItem>{siglas.map(valor => <SelectItem key={valor} value={valor}>{valor} — {siglasProjeteis[valor] ?? 'Nome não documentado'}</SelectItem>)}</SelectContent></Select></div>
        <ControleProximidade limite={limiteProximidade} texto={textoProximidade} aoAlterarTexto={setTextoProximidade} aoAlterarLimite={valor => { setLimiteProximidade(valor); setMostrarMais(false); }} />
      <div id="ajuda-prioridade" className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground @[512px]/medicoes:col-span-2" role="status">
        <span>Prioridade: <span className="font-medium text-foreground">{campos.find(campo => campo.chave === medidaPrioritaria)?.titulo}</span></span>
        {consulta[medidaPrioritaria] === null && <span>Prioridade sem valor</span>}
        {perdaMaterial && <span>Massa como limite inferior</span>}
      </div>
      </fieldset>
    </CardContent></Card>
    <section className="@container/resultados space-y-3" aria-labelledby="titulo-candidatos">
      <div><h2 id="titulo-candidatos" className="text-lg font-semibold">{possuiClassificacao ? 'Referências por proximidade' : perdaMaterial && consulta.massaGramas !== null ? 'Referências por relação de massa' : 'Referências filtradas'}</h2><p className="text-xs text-muted-foreground">{possuiConsulta && !erroConsulta ? `${resultados.length} referência${resultados.length === 1 ? '' : 's'}; mostrando até ${mostrarMais ? 10 : 3}.` : 'Informe ao menos uma medida ou selecione um formato para consultar.'}</p></div>
      {candidatosPrincipais.length > 0 && <div role="group" aria-label="Primeiras referências" className={cn('grid grid-cols-1 gap-3', colunasPrincipais)}>
        {candidatosPrincipais.map((resultado, indice) => <CartaoCandidato key={resultado.projetil.id} resultado={resultado} posicao={indice + 1} perdaMassa={perdaMaterial} destaque={candidatosPrincipais.length > 1} />)}
      </div>}
      {candidatosAdicionais.length > 0 && <div role="group" aria-label="Referências adicionais" className="space-y-3">
        {candidatosAdicionais.map((resultado, indice) => <CartaoCandidato key={resultado.projetil.id} resultado={resultado} posicao={indice + 4} perdaMassa={perdaMaterial} />)}
      </div>}
      {!possuiConsulta && !erroConsulta && <p className="rounded-md border p-6 text-sm text-muted-foreground">O catálogo permanece disponível em “Ver catálogo completo”.</p>}
      {possuiConsulta && !erroConsulta && candidatosPrincipais.length === 0 && <p className="rounded-md border p-6 text-sm text-muted-foreground">Nenhuma referência apta à classificação corresponde ao formato selecionado. Consulte também o catálogo completo.</p>}
      {primeirosDez.length > 3 && <div className="flex justify-center"><Button variant="outline" onClick={() => setMostrarMais(atual => !atual)}>{mostrarMais ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}{mostrarMais ? 'Mostrar menos' : `Mostrar mais opções (${primeirosDez.length - 3})`}</Button></div>}

    </section>
    <CatalogoProjeteisDialog aberto={catalogoAberto} aoAlterarAbertura={setCatalogoAberto} referencias={referencias} aoNovo={() => abrirCadastro()} aoEditar={abrirCadastro} aoExcluir={item => { void excluirCadastro(item); }} aoImportarCsv={importarCsv} />

    <Dialog open={dialogoAberto} onOpenChange={aberto => { setDialogoAberto(aberto); if (!aberto) setCatalogoAberto(true); }}><DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{editandoId ? 'Editar projétil personalizado' : 'Novo projétil personalizado'}</DialogTitle><DialogDescription>Informe a massa e ao menos uma dimensão. Os dados ficam neste computador.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-3"><div className="min-w-0 space-y-1.5"><Label htmlFor="cadastro-calibre">Calibre nominal</Label><Input id="cadastro-calibre" value={cadastroForm.calibre} onChange={evento => setCadastroForm(atual => ({ ...atual, calibre: evento.target.value }))} /></div><div className="min-w-0 space-y-1.5 sm:col-span-2"><Label htmlFor="cadastro-tipo">Formato/Constituição</Label><FormatoProjetilCombobox valor={cadastroForm.tipo} siglas={siglas} personalizados={personalizados.map(item => item.tipo)} aoSelecionar={tipo => setCadastroForm(atual => ({ ...atual, tipo }))} /></div>{campos.map(campo => <div key={campo.chave} className="space-y-1.5"><Label htmlFor={`cadastro-${campo.chave}`}>{campo.titulo} ({campo.unidade})</Label><Input id={`cadastro-${campo.chave}`} inputMode="decimal" value={cadastroForm[campo.chave]} onChange={evento => setCadastroForm(atual => ({ ...atual, [campo.chave]: evento.target.value }))} /></div>)}</div><DialogFooter><Button variant="outline" onClick={() => { setDialogoAberto(false); setCatalogoAberto(true); }}>Cancelar</Button><Button disabled={salvando} onClick={() => { void salvarCadastro(); }}>{salvando ? 'Salvando...' : 'Salvar'}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
