import { separarCamposAdicionaisB601 } from '@shared/gdl/b601-campos-adicionais'

export function DadosAdicionaisPecaGdl({ dados, tipoCodigo, personalizados }: {
  dados: Record<string, unknown>
  tipoCodigo?: string
  personalizados?: Record<string, unknown>
}) {
  const { revisao, informativos } = separarCamposAdicionaisB601(dados, tipoCodigo, personalizados)
  const campos = [...revisao, ...informativos].filter(campo => campo.rotulo !== 'Nº Análises')
  if (!campos.length) return null

  return <details className="rounded-md border border-border bg-muted/30 p-3">
      <summary className="cursor-pointer text-sm text-muted-foreground">Dados adicionais do GDL</summary>
      <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {campos.map(({ chave, rotulo, valor }) => <div key={chave} className="min-w-0">
          <dt className="font-medium">{rotulo}</dt>
          <dd className="whitespace-pre-wrap break-words">{valor === null || valor === undefined || valor === '' ? 'Não informado' : typeof valor === 'object' ? JSON.stringify(valor) : String(valor)}</dd>
        </div>)}
      </dl>
    </details>
}
