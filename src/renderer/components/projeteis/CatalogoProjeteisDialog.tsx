import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SiglaProjetil } from './SiglaProjetil';
import { RaiamentoProjetil } from './RaiamentoProjetil';
import { siglasProjeteis } from '@shared/catalogos/siglas-projeteis';
import type { ProjetilReferencia } from '@shared/types/projetil.types';

const TAMANHO_PAGINA = 12;

interface CatalogoProjeteisDialogProps {
  aberto: boolean;
  aoAlterarAbertura: (aberto: boolean) => void;
  referencias: ProjetilReferencia[];
  aoNovo: () => void;
  aoEditar: (item: ProjetilReferencia) => void;
  aoExcluir: (item: ProjetilReferencia) => void;
  aoImportarCsv: (arquivo: File | undefined) => Promise<void>;
}

function faixa(minimo: number | null, maximo: number | null, unidade: string): string {
  if (minimo === null || maximo === null) return 'Não informado';
  return minimo === maximo ? `${minimo} ${unidade}` : `${minimo}–${maximo} ${unidade}`;
}

export function CatalogoProjeteisDialog({ aberto, aoAlterarAbertura, referencias, aoNovo, aoEditar, aoExcluir, aoImportarCsv }: CatalogoProjeteisDialogProps) {
  const [calibre, setCalibre] = useState('');
  const [sigla, setSigla] = useState('todas');
  const [pagina, setPagina] = useState(0);
  const siglas = useMemo(() => [...new Set(referencias.map(item => item.sigla).filter((valor): valor is string => Boolean(valor)))].sort(), [referencias]);
  const filtrados = useMemo(() => referencias.filter(item => item.calibre.toLocaleLowerCase('pt-BR').includes(calibre.trim().toLocaleLowerCase('pt-BR'))
    && (sigla === 'todas' || item.sigla === sigla)).sort((a, b) => a.calibre.localeCompare(b.calibre, 'pt-BR')
      || a.tipo.localeCompare(b.tipo, 'pt-BR') || a.id.localeCompare(b.id, 'pt-BR')), [referencias, calibre, sigla]);
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const itensPagina = filtrados.slice(paginaAtual * TAMANHO_PAGINA, (paginaAtual + 1) * TAMANHO_PAGINA);

  return <Dialog open={aberto} onOpenChange={aoAlterarAbertura}>
    {aberto && <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-4 p-4 sm:max-w-6xl sm:p-6">
      <DialogHeader><DialogTitle>Catálogo completo de projéteis</DialogTitle><DialogDescription>{referencias.length} {referencias.length === 1 ? 'projétil cadastrado' : 'projéteis cadastrados'}. Medidas aproximadas das fontes; compare cada variante com o projétil observado.</DialogDescription></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="catalogo-calibre">Calibre nominal</Label><Input id="catalogo-calibre" value={calibre} onChange={evento => { setCalibre(evento.target.value); setPagina(0); }} placeholder="Pesquisar calibre" /></div>
        <div className="space-y-1.5"><Label htmlFor="catalogo-sigla">Formato/Constituição</Label><Select value={sigla} onValueChange={valor => { setSigla(valor); setPagina(0); }}><SelectTrigger id="catalogo-sigla"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todos</SelectItem>{siglas.map(valor => <SelectItem key={valor} value={valor}>{valor} — {siglasProjeteis[valor] ?? 'Nome não documentado'}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-muted-foreground">{filtrados.length} variante{filtrados.length === 1 ? '' : 's'} encontrada{filtrados.length === 1 ? '' : 's'}</span><div className="flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"><Upload className="h-4 w-4" />Importar CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={evento => { void aoImportarCsv(evento.target.files?.[0]); evento.target.value = ''; }} /></label><Button onClick={aoNovo}><Plus className="mr-2 h-4 w-4" />Novo personalizado</Button></div></div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {itensPagina.map(item => <div key={item.id} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{item.calibre}</span><SiglaProjetil sigla={item.sigla} />{item.tipo !== item.sigla && item.tipo !== item.calibre && item.tipo !== 'Formato não informado' && <span className="text-sm text-muted-foreground">{item.tipo}</span>}{item.situacao === 'personalizada' && <Badge>Personalizado</Badge>}</div>{item.situacao === 'personalizada' && <div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Editar ${item.calibre}`} onClick={() => aoEditar(item)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`Excluir ${item.calibre}`} onClick={() => aoExcluir(item)}><Trash2 className="h-4 w-4" /></Button></div>}</div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground"><span>Massa: {item.massaGramas === null ? 'Não informada' : `${item.massaGramas} g`}</span><span>Calibre real médio: {faixa(item.calibreRealMinMm, item.calibreRealMaxMm, 'mm')}</span><span>Altura máxima: {faixa(item.alturaMinMm, item.alturaMaxMm, 'mm')}</span></div>
          <RaiamentoProjetil calibre={item.calibre} />
          {item.observacao && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{item.observacao}</p>}
          {(item.liga || item.linha || item.comprimentoEstojoMm || item.massaNucleoGramas || item.massaCamisaGramas) && <details className="mt-2 text-xs"><summary className="cursor-pointer">Detalhes da referência</summary><div className="mt-1 space-y-1 text-muted-foreground">{item.liga && <p>Liga: {item.liga}</p>}{item.linha && <p>Linha: {item.linha}</p>}{item.comprimentoEstojoMm && <p>Comprimento do estojo: {item.comprimentoEstojoMm} mm</p>}{item.massaNucleoGramas && <p>Massa do núcleo: {item.massaNucleoGramas} g</p>}{item.massaCamisaGramas && <p>Massa da camisa: {item.massaCamisaGramas} g</p>}</div></details>}
        </div>)}
        {filtrados.length === 0 && <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">Nenhuma variante corresponde aos filtros.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm"><p className="text-xs text-muted-foreground">CSV: calibre;tipo;massa_gramas;calibre_real_mm;altura_maxima_mm</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={paginaAtual === 0} onClick={() => setPagina(atual => atual - 1)}>Anterior</Button><span>{paginaAtual + 1} / {totalPaginas}</span><Button variant="outline" size="sm" disabled={paginaAtual >= totalPaginas - 1} onClick={() => setPagina(atual => atual + 1)}>Próxima</Button></div></div>
    </DialogContent>}
  </Dialog>;
}
