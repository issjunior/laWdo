import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function ImportarProjeteisCsv({ aoImportar }: { aoImportar: (arquivo: File | undefined) => Promise<void> }) {
  const entradaArquivo = useRef<HTMLInputElement>(null);
  return <>
    <TooltipProvider delayDuration={200}><Tooltip>
      <TooltipTrigger asChild><Button type="button" variant="outline" onClick={() => entradaArquivo.current?.click()}><Upload className="mr-2 h-4 w-4" aria-hidden="true" />Importar CSV</Button></TooltipTrigger>
      <TooltipContent className="max-h-[80vh] w-[calc(100vw-3rem)] max-w-md space-y-3 overflow-y-auto p-4 text-xs leading-relaxed">
        <p className="font-semibold">Como montar o arquivo CSV</p>
        <p>Salve em <strong>UTF-8</strong>, com uma linha por projétil. Use <strong>ponto e vírgula (;)</strong> entre os campos e vírgula ou ponto nos decimais.</p>
        <div>
          <p className="mb-1 font-medium">Campos do cabeçalho, nesta ordem:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li><code className="font-semibold">calibre</code> — calibre nominal, como .38 SPL.</li>
            <li><code className="font-semibold">tipo</code> — formato/constituição, como SEPO.</li>
            <li><code className="font-semibold">massa_gramas</code> — massa em g, obrigatória.</li>
            <li><code className="font-semibold">calibre_real_mm</code> — diâmetro em mm.</li>
            <li><code className="font-semibold">altura_maxima_mm</code> — altura em mm.</li>
          </ol>
        </div>
        <div className="space-y-1">
          <p className="font-medium">Exemplo com cabeçalho e um projétil:</p>
          <pre className="whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-[11px]">{'calibre;tipo;massa_gramas;calibre_real_mm;altura_maxima_mm\n.38 SPL;SEPO;10,2;9;16,02'}</pre>
        </div>
        <p>Nas medidas, use números positivos, sem escrever as unidades. Informe ao menos uma dimensão; mantenha vazia a coluna da dimensão não informada.</p>
        <p className="text-muted-foreground">Também é aceita vírgula como separador; nesse caso, prefira ponto nos decimais. Textos que contenham o separador devem ficar entre aspas duplas.</p>
      </TooltipContent>
    </Tooltip></TooltipProvider>
    <input ref={entradaArquivo} type="file" accept=".csv,text/csv" className="hidden" onChange={evento => { void aoImportar(evento.target.files?.[0]); evento.target.value = ''; }} />
  </>;
}
