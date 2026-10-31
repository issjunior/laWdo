import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { AnaliseBkpLaudo } from '@shared/types/laudo-bkp.types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';

export function ImportarBkpLaudo({ onImportado }: { onImportado: (laudoId: string) => Promise<void> }) {
  const [aberto, setAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [analise, setAnalise] = useState<AnaliseBkpLaudo | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [erro, setErro] = useState('');
  const operacaoRef = useRef<string | null>(null);
  const montadoRef = useRef(true);
  const cancelar = async () => {
    const id = operacaoRef.current;
    operacaoRef.current = null;
    if (id) await window.ipcAPI.laudo.cancelarBkp(id);
  };
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      const id = operacaoRef.current;
      if (id) void window.ipcAPI.laudo.cancelarBkp(id).catch(() => undefined);
    };
  }, []);
  const iniciar = async () => {
    setAberto(true); setOcupado(true); setErro(''); setAnalise(null); setConfirmado(false);
    try {
      await cancelar();
      const selecao = await window.ipcAPI.laudo.selecionarBkp();
      if (selecao.canceled) { if (montadoRef.current) setAberto(false); return; }
      if (!selecao.success || !selecao.data) throw new Error(selecao.error || 'Não foi possível selecionar o arquivo.');
      operacaoRef.current = selecao.data.selecaoId;
      if (!montadoRef.current) { await cancelar(); return; }
      const resultado = await window.ipcAPI.laudo.analisarBkp(selecao.data.selecaoId);
      if (!resultado.success || !resultado.data) throw new Error(resultado.error || 'Não foi possível analisar o BKP.');
      operacaoRef.current = resultado.data.operacaoId;
      if (!montadoRef.current) { await cancelar(); return; }
      setAnalise(resultado.data);
    } catch (falha) {
      await cancelar();
      if (montadoRef.current) setErro(falha instanceof Error ? falha.message : 'Erro inesperado ao analisar o BKP.');
    } finally { if (montadoRef.current) setOcupado(false); }
  };
  const importar = async () => {
    if (!analise) return;
    setOcupado(true); setErro('');
    try {
      const resultado = await window.ipcAPI.laudo.importarBkp(analise.operacaoId, confirmado);
      operacaoRef.current = null;
      if (!resultado.success || !resultado.data) throw new Error(resultado.error || 'Não foi possível importar o laudo.');
      if (!montadoRef.current) return;
      setAberto(false); setAnalise(null);
      await onImportado(resultado.data.laudoId);
      toast.success('Laudo importado. Ele está disponível na lista de Laudos.');
    } catch (falha) {
      if (montadoRef.current) { setAnalise(null); setErro(falha instanceof Error ? falha.message : 'Erro inesperado ao importar o BKP.'); }
    } finally { if (montadoRef.current) setOcupado(false); }
  };
  const previa = analise?.previa;
  return <>
    <Button variant="outline" disabled={ocupado} onClick={() => void iniciar()}><Upload className="mr-2 size-4" />Importar BKP</Button>
    <Dialog open={aberto} onOpenChange={valor => { if (!ocupado) { setAberto(valor); if (!valor) void cancelar(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Importar BKP de um laudo</DialogTitle><DialogDescription>Importe um caso sem substituir suas credenciais ou configurações.</DialogDescription></DialogHeader>
        {ocupado && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />Processando BKP...</p>}
        {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}
        {previa && <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2"><dt>REP</dt><dd>{previa.numeroRep}</dd><dt>Exame</dt><dd>{previa.tipoExame}</dd><dt>Status</dt><dd>{previa.status}</dd><dt>Figuras</dt><dd>{previa.figuras}</dd></dl>
          <p>O laudo usará seu nome de perito e seus padrões de cabeçalho e fechamento. O texto, o status e as datas do arquivo serão preservados.</p>
          {previa.bloqueio ? <Alert variant="destructive"><AlertDescription>{previa.bloqueio}</AlertDescription></Alert> : previa.substituiRep && <label className="flex items-start gap-3 rounded-md border p-3"><Checkbox checked={confirmado} disabled={ocupado} onCheckedChange={valor => setConfirmado(valor === true)} /><span>Confirmo substituir os dados da REP{previa.substituiLaudo ? ' e o laudo existente, incluindo suas imagens' : ''} pelos dados deste arquivo.</span></label>}
        </div>}
        <DialogFooter>
          <Button variant="outline" disabled={ocupado} onClick={() => { setAberto(false); void cancelar(); }}>Cancelar</Button>
          {!analise && <Button disabled={ocupado} onClick={() => void iniciar()}>Selecionar arquivo</Button>}
          {analise && <Button disabled={ocupado || Boolean(previa?.bloqueio) || Boolean(previa?.substituiRep && !confirmado)} onClick={() => void importar()}>Importar laudo</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
