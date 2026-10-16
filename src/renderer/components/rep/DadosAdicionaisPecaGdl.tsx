export function DadosAdicionaisPecaGdl({ dados }: { dados: Record<string, unknown> }) {
  const campos = Object.entries(dados)
  if (!campos.length) return null

  return <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
    <p className="text-sm font-medium">Informações adicionais recebidas do GDL</p>
    <p className="text-xs text-muted-foreground">Dados preservados para conferência. Complete os campos correspondentes na edição da peça quando necessário.</p>
    <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
      {campos.map(([chave, valor]) => <div key={chave} className="min-w-0">
        <dt className="font-medium">{chave}</dt>
        <dd className="whitespace-pre-wrap break-words">{valor === null || valor === undefined || valor === '' ? 'Não informado' : typeof valor === 'object' ? JSON.stringify(valor) : String(valor)}</dd>
      </div>)}
    </dl>
  </div>
}
