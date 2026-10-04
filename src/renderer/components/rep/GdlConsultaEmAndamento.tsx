import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function GdlConsultaEmAndamento() {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    const inicio = Date.now();
    const intervalo = window.setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  const tempo = `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;

  return (
    <Badge variant="outline" role="status" className="gap-1.5 border-sky-200 bg-sky-50 px-2 py-1 font-normal text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
      <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden="true" />
      <span className="sr-only">Consulta ao GDL em andamento</span>
      <span className="tabular-nums" aria-hidden="true">Consultando GDL: {tempo}</span>
    </Badge>
  );
}
