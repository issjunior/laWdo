import { obterIndicadoresSecao } from '@/lib/indicadores-secao';

interface IndicadoresSecaoProps {
  ocultarTitulo?: boolean;
  contarNaNumeracao?: boolean;
}

export function IndicadoresSecao(situacao: IndicadoresSecaoProps) {
  return <span className="inline-flex flex-wrap items-center">
    {obterIndicadoresSecao(situacao).map(indicador => (
      <span key={indicador.rotulo} className="indicador-secao" title={indicador.explicacao}
        aria-label={`${indicador.rotulo}: ${indicador.explicacao}`} tabIndex={0}>
        {indicador.rotulo}
      </span>
    ))}
  </span>;
}
