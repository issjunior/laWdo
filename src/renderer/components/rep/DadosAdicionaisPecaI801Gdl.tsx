import { obterTipoPecaI801PorCodigo } from '@shared/catalogos/i801.catalogo'
import { separarCamposAdicionaisI801 } from '@shared/gdl/i801-campos-adicionais'

export function DadosAdicionaisPecaI801Gdl({ dados, tipoCodigo, personalizados }: {
  dados: Record<string, unknown>
  tipoCodigo?: string
  personalizados?: Record<string, unknown>
}) {
  const tipo = tipoCodigo ? obterTipoPecaI801PorCodigo(tipoCodigo) : undefined
  const { revisao, informativos } = separarCamposAdicionaisI801(dados, tipo, personalizados)
  const campos = [...revisao, ...informativos]
  if (!campos.length) return null

  return <details className="rounded-md border border-border bg-muted/30 p-3">
    <summary className="cursor-pointer text-sm text-muted-foreground">Dados adicionais do GDL que exigem revisão</summary>
    <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
      {campos.map(({ chave, rotulo, valor }) => <div key={chave} className="min-w-0">
        <dt className="font-medium">{rotulo}</dt>
        <dd className="whitespace-pre-wrap break-words">{valor === null || valor === undefined || valor === '' ? 'Não informado' : typeof valor === 'object' ? JSON.stringify(valor) : String(valor)}</dd>
      </div>)}
    </dl>
  </details>
}
