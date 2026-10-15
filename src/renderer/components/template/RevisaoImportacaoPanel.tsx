import type { AvisoImportacaoTemplate, SecaoImportadaTemplate } from '@shared/types/importacao-template.types';
import { localizarSecoes } from './importacao-revisao';

interface Propriedades {
  secoes: SecaoImportadaTemplate[];
  avisos: AvisoImportacaoTemplate[];
  resumo: { tabelas: number; figuras: number };
}

interface GrupoAvisos {
  codigo: string;
  categoria: AvisoImportacaoTemplate['categoria'];
  mensagens: Set<string>;
  locais: Set<string>;
  quantidade: number;
}

export function RevisaoImportacaoPanel({ secoes, avisos, resumo }: Propriedades) {
  const grupos = new Map<string, GrupoAvisos>();
  for (const item of avisos) {
    const afetadas = localizarSecoes(secoes, item);
    if (!afetadas.length) continue;
    const chave = `${item.categoria}:${item.codigo}`;
    const grupo = grupos.get(chave) || { codigo: item.codigo, categoria: item.categoria, mensagens: new Set<string>(), locais: new Set<string>(), quantidade: 0 };
    grupo.quantidade++;
    grupo.mensagens.add(item.mensagem);
    if (item.pagina) grupo.locais.add(`Página ${item.pagina}`);
    else if (item.elementoId || item.secaoId) for (const secao of afetadas) grupo.locais.add(secao.nome);
    else grupo.locais.add('Documento');
    grupos.set(chave, grupo);
  }
  return <div className="space-y-2">
    <p className="text-sm">{secoes.length} seções · {resumo.tabelas} tabelas · {resumo.figuras} figuras substituídas</p>
    <p className="text-sm text-muted-foreground">O texto das tabelas foi preservado. Substitua os dados específicos por placeholders ou XXX no editor antes de salvar.</p>
    {grupos.size > 0 && <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">Detalhes da importação ({grupos.size} grupos)</summary>
      <div className="mt-3 space-y-3">
        {[...grupos.entries()].map(([chave, grupo]) => <div key={chave} className="space-y-1 border-t pt-2">
          <p className="text-sm font-medium">{grupo.categoria === 'adaptacao' ? 'Adaptação' : 'Limitação'} · {grupo.quantidade} {grupo.quantidade === 1 ? 'ocorrência' : 'ocorrências'}</p>
          {[...grupo.mensagens].map(mensagem => <p key={mensagem} className="text-sm text-muted-foreground">{mensagem}</p>)}
          <p className="text-xs text-muted-foreground">Localização: {[...grupo.locais].join(', ')}</p>
        </div>)}
      </div>
    </details>}
  </div>;
}
