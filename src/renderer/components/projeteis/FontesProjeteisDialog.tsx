import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const documentos = [
  { arquivo: 'tabela-calibres-balistica-forense.pdf', titulo: 'Tabela de calibres — Balística Forense' },
  { arquivo: 'perfis-projeteis-eliane-baruch.pdf', titulo: 'Perfis de Projéteis — Eliane Baruch' },
];

export function FontesProjeteisDialog() {
  const [aberto, setAberto] = useState(false);
  const [documento, setDocumento] = useState(documentos[0]);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState(false);

  return <Dialog open={aberto} onOpenChange={valor => { setAberto(valor); if (valor) { setCarregado(false); setErro(false); } }}>
    <DialogTrigger asChild><Button variant="outline"><FileText className="mr-2 h-4 w-4" aria-hidden="true" />Consultar fontes</Button></DialogTrigger>
    <DialogContent className="flex h-[90vh] w-[calc(100vw-2rem)] max-w-6xl flex-col sm:max-w-6xl">
      <DialogHeader><DialogTitle>Fontes de informação</DialogTitle><DialogDescription>2 fontes preferenciais</DialogDescription></DialogHeader>
      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Fontes preferenciais">
        {documentos.map(item => <Button key={item.arquivo} variant="outline" aria-pressed={documento.arquivo === item.arquivo} onClick={() => {
          if (documento.arquivo === item.arquivo) return;
          setDocumento(item); setCarregado(false); setErro(false);
        }} className={`h-auto min-h-12 justify-start whitespace-normal px-3 py-3 text-left ${documento.arquivo === item.arquivo ? 'border-primary bg-primary/10 text-foreground hover:bg-primary/15' : ''}`}>
          <FileText className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />{item.titulo}
        </Button>)}
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded border bg-muted">
        {aberto && <iframe key={documento.arquivo} src={`${import.meta.env.BASE_URL}${documento.arquivo}`} title={`Fonte: ${documento.titulo}`} className="h-full w-full border-0" onLoad={() => setCarregado(true)} onError={() => setErro(true)} />}
        {!carregado && !erro && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground" role="status">Carregando PDF...</p>}
        {erro && <p className="absolute inset-0 flex items-center justify-center text-sm text-destructive" role="alert">Não foi possível carregar o PDF.</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
