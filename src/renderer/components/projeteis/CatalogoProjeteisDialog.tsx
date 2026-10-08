import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProjetilReferencia, SituacaoProjetil } from '@shared/types/projetil.types';

const TAMANHO_PAGINA = 12;
type FiltroSituacao = SituacaoProjetil | 'todas';
type FiltroMedidas = 'todas' | 'completas' | 'incompletas';

interface CatalogoProjeteisDialogProps {
  aberto: boolean;
  aoAlterarAbertura: (aberto: boolean) => void;
  referencias: ProjetilReferencia[];
  aoNovo: () => void;
  aoEditar: (item: ProjetilReferencia) => void;
  aoExcluir: (item: ProjetilReferencia) => void;
  aoImportarCsv: (arquivo: File | undefined) => Promise<void>;
}

function rotuloMedida(minimo: number | null, maximo: number | null): string {
  if (minimo === null || maximo === null) return 'Não informado';
  return minimo === maximo ? `${minimo} mm` : `${minimo}–${maximo} mm`;
}

export function CatalogoProjeteisDialog({
  aberto, aoAlterarAbertura, referencias, aoNovo, aoEditar, aoExcluir, aoImportarCsv,
}: CatalogoProjeteisDialogProps) {
  const [calibre, setCalibre] = useState('');
  const [tipo, setTipo] = useState('');
  const [situacao, setSituacao] = useState<FiltroSituacao>('todas');
  const [medidas, setMedidas] = useState<FiltroMedidas>('todas');
  const [pagina, setPagina] = useState(0);

  const filtrados = useMemo(() => {
    if (!aberto) return [];
    const termoCalibre = calibre.trim().toLocaleLowerCase('pt-BR');
    const termoTipo = tipo.trim().toLocaleLowerCase('pt-BR');
    return referencias.filter(item => {
      const completo = item.diametroMinMm !== null && item.diametroMaxMm !== null
        && item.comprimentoMinMm !== null && item.comprimentoMaxMm !== null;
      return item.calibre.toLocaleLowerCase('pt-BR').includes(termoCalibre)
        && item.tipo.toLocaleLowerCase('pt-BR').includes(termoTipo)
        && (situacao === 'todas' || item.situacao === situacao)
        && (medidas === 'todas' || (medidas === 'completas' ? completo : !completo));
    }).sort((a, b) => a.calibre.localeCompare(b.calibre, 'pt-BR')
      || a.tipo.localeCompare(b.tipo, 'pt-BR')
      || a.massaGramas - b.massaGramas);
  }, [aberto, referencias, calibre, tipo, situacao, medidas]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const itensPagina = filtrados.slice(paginaAtual * TAMANHO_PAGINA, (paginaAtual + 1) * TAMANHO_PAGINA);

  return <Dialog open={aberto} onOpenChange={aoAlterarAbertura}>
    {aberto && <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-4 p-4 sm:max-w-6xl sm:p-6">
      <DialogHeader>
        <DialogTitle>Catálogo completo de projéteis</DialogTitle>
        <DialogDescription>Consulte todas as variantes disponíveis. Os filtros deste catálogo não alteram os candidatos da consulta.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5"><Label htmlFor="catalogo-calibre">Calibre</Label><Input id="catalogo-calibre" value={calibre} onChange={evento => { setCalibre(evento.target.value); setPagina(0); }} placeholder="Pesquisar calibre" /></div>
        <div className="space-y-1.5"><Label htmlFor="catalogo-tipo">Tipo</Label><Input id="catalogo-tipo" value={tipo} onChange={evento => { setTipo(evento.target.value); setPagina(0); }} placeholder="Pesquisar tipo" /></div>
        <div className="space-y-1.5"><Label htmlFor="catalogo-situacao">Nível</Label><Select value={situacao} onValueChange={(valor: FiltroSituacao) => { setSituacao(valor); setPagina(0); }}><SelectTrigger id="catalogo-situacao"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todos</SelectItem><SelectItem value="confirmada">Confirmada</SelectItem><SelectItem value="estimada">Estimada</SelectItem><SelectItem value="personalizada">Personalizada</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="catalogo-medidas">Medidas</Label><Select value={medidas} onValueChange={(valor: FiltroMedidas) => { setMedidas(valor); setPagina(0); }}><SelectTrigger id="catalogo-medidas"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas</SelectItem><SelectItem value="completas">Diâmetro e comprimento</SelectItem><SelectItem value="incompletas">Alguma medida ausente</SelectItem></SelectContent></Select></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{filtrados.length} variante{filtrados.length === 1 ? '' : 's'} encontrada{filtrados.length === 1 ? '' : 's'}</span>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent"><Upload className="h-4 w-4" />Importar CSV<input type="file" accept=".csv,text/csv" className="sr-only" onChange={evento => { void aoImportarCsv(evento.target.files?.[0]); evento.target.value = ''; }} /></label>
          <Button onClick={aoNovo}><Plus className="mr-2 h-4 w-4" />Novo personalizado</Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {itensPagina.map(item => <div key={item.id} className="rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{item.calibre}</span><span className="text-sm text-muted-foreground">{item.tipo}</span><Badge variant={item.situacao === 'confirmada' ? 'default' : 'outline'}>{item.situacao === 'confirmada' ? 'Confirmada' : item.situacao === 'personalizada' ? 'Personalizada' : 'Estimada'}</Badge></div>
            {item.situacao === 'personalizada' && <div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Editar ${item.calibre}`} onClick={() => aoEditar(item)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" aria-label={`Excluir ${item.calibre}`} onClick={() => aoExcluir(item)}><Trash2 className="h-4 w-4" /></Button></div>}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground"><span>Massa: {item.massaGramas} g</span><span>Diâmetro: {rotuloMedida(item.diametroMinMm, item.diametroMaxMm)}</span><span>Comprimento: {rotuloMedida(item.comprimentoMinMm, item.comprimentoMaxMm)}</span></div>
        </div>)}
        {filtrados.length === 0 && <p className="rounded-md border p-6 text-center text-sm text-muted-foreground">Nenhuma variante corresponde aos filtros.</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
        <p className="text-xs text-muted-foreground">CSV: calibre;tipo;massa_gramas;diametro_min_mm;diametro_max_mm;comprimento_min_mm;comprimento_max_mm</p>
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={paginaAtual === 0} onClick={() => setPagina(atual => atual - 1)}>Anterior</Button><span>{paginaAtual + 1} / {totalPaginas}</span><Button variant="outline" size="sm" disabled={paginaAtual >= totalPaginas - 1} onClick={() => setPagina(atual => atual + 1)}>Próxima</Button></div>
      </div>
    </DialogContent>}
  </Dialog>;
}
