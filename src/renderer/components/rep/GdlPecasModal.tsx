import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, PackageSearch, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import type { DadosImportacaoB602, PecaB602, ResultadoImportacaoExame } from '@shared/types/b602-gdl.types'
import { TIPOS_PECA_B602_POR_CODIGO } from '@shared/catalogos/b602-gdl.catalogo'
import { montarItensReconciliacaoPecasB602 } from '@/components/rep/exam-fields/pecas-b602.utils'

interface GdlPecasModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  numeroRepCompleto: string
  pecasAtuais: PecaB602[]
  onAplicar: (
    resultado: ResultadoImportacaoExame<DadosImportacaoB602>,
    pecasRetornadasSelecionadas: PecaB602[],
    pecasImportadasSelecionadas: PecaB602[],
  ) => void
}

function separarNumeroRep(numeroCompleto: string): { numero: string; ano: string } | null {
  const correspondencia = numeroCompleto.trim().match(/^([\d.]+)-(\d{4})$/)
  if (!correspondencia) return null
  return { numero: correspondencia[1].replace(/\D/g, ''), ano: correspondencia[2] }
}

function formatarValor(valor: unknown): string {
  if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
  if (valor === null || valor === undefined) return 'Não informado'
  return JSON.stringify(valor)
}

export const GdlPecasModal: React.FC<GdlPecasModalProps> = ({
  open,
  onOpenChange,
  numeroRepCompleto,
  pecasAtuais,
  onAplicar,
}) => {
  const [resultado, setResultado] = useState<ResultadoImportacaoExame<DadosImportacaoB602> | null>(null)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const consultaExecutadaRef = useRef<string | null>(null)

  const consultarPecas = useCallback(async (): Promise<void> => {
    const referencia = separarNumeroRep(numeroRepCompleto)
    if (!referencia) {
      setErro('Informe o número da REP no formato número-ano antes de consultar as peças no GDL.')
      return
    }

    setCarregando(true)
    setErro(null)
    try {
      const resposta = await window.ipcAPI.gdl.consultarRep(referencia.numero, referencia.ano)
      if (!resposta.success || !resposta.data) {
        setErro(resposta.error || 'Não foi possível consultar as peças da REP no GDL.')
        return
      }

      const consulta: ResultadoImportacaoExame<DadosImportacaoB602> = resposta.data
      if (consulta.codigoExame !== 'B-602') {
        setErro(`A REP consultada pertence ao exame ${consulta.codigoExame}, não ao B-602.`)
        return
      }

      const itens = montarItensReconciliacaoPecasB602(pecasAtuais, consulta.camposEspecificos.pecas)
      setResultado(consulta)
      setSelecionadas(new Set(
        itens.filter(item => item.jaImportada).map(item => item.chave),
      ))
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado ao consultar as peças no GDL.')
    } finally {
      setCarregando(false)
    }
  }, [numeroRepCompleto, pecasAtuais])

  useEffect(() => {
    if (!open) {
      consultaExecutadaRef.current = null
      return
    }

    const chaveConsulta = numeroRepCompleto.trim()
    if (consultaExecutadaRef.current === chaveConsulta) return
    consultaExecutadaRef.current = chaveConsulta
    setResultado(null)
    setSelecionadas(new Set())
    void consultarPecas()
  }, [consultarPecas, numeroRepCompleto, open])

  const itens = resultado
    ? montarItensReconciliacaoPecasB602(pecasAtuais, resultado.camposEspecificos.pecas)
    : []

  const alternarSelecao = (chave: string): void => {
    setSelecionadas(atuais => {
      const proximas = new Set(atuais)
      if (proximas.has(chave)) proximas.delete(chave)
      else proximas.add(chave)
      return proximas
    })
  }

  const aplicarSelecao = (): void => {
    if (!resultado) return
    const pecasImportadasSelecionadas = itens
      .filter(item => selecionadas.has(item.chave))
      .map(item => item.peca)
    const pecasRetornadasSelecionadas = resultado.camposEspecificos.pecas.filter(
      peca => selecionadas.has(`gdl-${peca.codPecaGdl ?? peca.idLocal}`),
    )
    onAplicar(resultado, pecasRetornadasSelecionadas, pecasImportadasSelecionadas)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-[620px]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <PackageSearch className="h-5 w-5 text-primary" />
            Selecionar peças do GDL
          </DialogTitle>
          <DialogDescription>
            Revise as peças disponíveis para a REP {numeroRepCompleto || 'não informada'}.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          {carregando && (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Consultando peças no GDL...
            </div>
          )}

          {erro && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-3">
                <p>{erro}</p>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void consultarPecas()}>
                  <RefreshCw className="h-4 w-4" /> Tentar novamente
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!carregando && !erro && resultado && itens.length === 0 && (
            <Alert>
              <AlertDescription>O GDL não retornou peças para esta REP.</AlertDescription>
            </Alert>
          )}

          {!carregando && !erro && itens.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                A seleção reflete as peças presentes no formulário. Marque para importar ou desmarque para remover do laWdo.
              </p>
              <div className="space-y-2">
                {itens.map(({ chave, peca, jaImportada, retornadaPeloGdl }) => (
                  <label key={chave} className="block cursor-pointer rounded-md border border-border bg-card p-3 transition-colors hover:bg-muted/50">
                    <div className="flex items-start gap-3">
                      <Checkbox checked={selecionadas.has(chave)} onCheckedChange={() => alternarSelecao(chave)} className="mt-1" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{peca.tipoPeca}</span>
                          <Badge variant="secondary">{peca.comuns.quantidade} {peca.comuns.unidadeMedida || 'unidade(s)'}</Badge>
                          {jaImportada && <Badge variant="outline">Já importada</Badge>}
                          {!retornadaPeloGdl && <Badge variant="destructive">Não retornou nesta consulta</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{peca.comuns.identificacao || 'Sem identificação'}</p>
                        {!!Object.keys(peca.personalizados).length && (
                          <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-2">
                            {Object.entries(peca.personalizados).map(([id, valor]) => {
                              const label = TIPOS_PECA_B602_POR_CODIGO.get(peca.tipoCodigo)?.campos.find(campo => campo.id === id)?.label ?? id
                              return <div key={id} className="flex gap-1"><dt className="font-medium">{label}:</dt><dd>{formatarValor(valor)}</dd></div>
                            })}
                          </dl>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <Separator className="shrink-0" />
        <div className="flex shrink-0 justify-end gap-2 pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" onClick={aplicarSelecao} disabled={!resultado || carregando || !!erro}>Aplicar seleção</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
