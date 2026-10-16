import { DadosAdicionaisPecaGdl } from '../DadosAdicionaisPecaGdl'
import React, { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Edit, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MarcaArmaCombobox } from './marca-arma-combobox'
import type { CampoPersonalizadoBalistica, OpcaoCampoBalistica, PecaBalistica } from '@shared/types/pecas-balistica.types'
import { preencherOrigemColetaB601 } from '@shared/gdl/b601-campos-adicionais'

interface TipoPecaEditor { codigo: string; label: string; campos: readonly CampoPersonalizadoBalistica[] }
interface PecasBalisticaProps<T extends PecaBalistica> {
  pecas: T[]
  onChange: (pecas: T[]) => void
  onRevisarPecasGdl?: () => void
  catalogo: readonly TipoPecaEditor[]
  opcoesMedida: readonly OpcaoCampoBalistica[]
  codigoExame: 'b601' | 'b602'
  criarPeca: () => T
  validarPeca: (peca: T) => string | null
  estaCompleta?: (peca: T) => boolean
  permitirReordenacao?: boolean
  exibirMaterialIncinerado?: boolean
  preservarPersonalizados?: boolean
  onEdicaoChange?: (pendente: boolean) => void
}

export function PecasBalisticaFields<T extends PecaBalistica>({
  pecas, onChange, onRevisarPecasGdl, catalogo, opcoesMedida, codigoExame, criarPeca, validarPeca, estaCompleta, permitirReordenacao,
  exibirMaterialIncinerado = false, preservarPersonalizados = false, onEdicaoChange,
}: PecasBalisticaProps<T>) {
  const [editando, setEditando] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const definicao = useMemo(
    () => editando ? catalogo.find(tipo => tipo.codigo === editando.tipoCodigo) : undefined,
    [catalogo, editando],
  )

  const atualizarComum = <K extends keyof T['comuns']>(campo: K, valor: T['comuns'][K]) => {
    setEditando(atual => atual ? { ...atual, comuns: { ...atual.comuns, [campo]: valor } } : atual)
  }

  useEffect(() => { onEdicaoChange?.(editando !== null) }, [editando, onEdicaoChange])

  const trocarTipo = (codigo: string) => {
    if (!editando) return
    const possuiPersonalizados = Object.values(editando.personalizados).some(valor => valor !== '' && valor != null)
    if (!preservarPersonalizados && possuiPersonalizados && !window.confirm('A troca do tipo descartará os campos personalizados preenchidos. Continuar?')) return
    const tipo = catalogo.find(tipo => tipo.codigo === codigo)
    if (!tipo) return
    setEditando({ ...editando, tipoCodigo: codigo, tipoPeca: tipo.label, personalizados: preservarPersonalizados ? editando.personalizados : {} })
    setErro(null)
  }

  const salvar = () => {
    if (!editando || !definicao) return setErro('Selecione o Tipo do Item.')
    const pendencia = validarPeca(editando)
    if (pendencia) return setErro(pendencia)
    const peca = editando.origem === 'gdl' ? { ...editando, alteradaLocalmente: true } : editando
    const indice = pecas.findIndex(item => item.idLocal === peca.idLocal)
    onChange(indice >= 0 ? pecas.map(item => item.idLocal === peca.idLocal ? peca : item) : [...pecas, peca])
    setEditando(null)
    setErro(null)
  }

  const excluir = (peca: T) => {
    const aviso = peca.origem === 'gdl'
      ? 'A peça será excluída somente do laWdo; o GDL não será alterado. Continuar?'
      : 'Excluir esta peça?'
    if (window.confirm(aviso)) onChange(pecas.filter(item => item.idLocal !== peca.idLocal))
  }

  const mover = (indice: number, deslocamento: number) => {
    const destino = indice + deslocamento
    if (destino < 0 || destino >= pecas.length) return
    const ordenadas = [...pecas]
    const [peca] = ordenadas.splice(indice, 1)
    if (!peca) return
    ordenadas.splice(destino, 0, peca)
    onChange(ordenadas)
  }

  if (editando) {
    const campoArmaInstitucional = definicao?.campos.find(campo => campo.chaveGdl === 'Arma é Institucional?')
    const camposPersonalizadosPrincipais = definicao?.campos.filter(campo => campo !== campoArmaInstitucional) ?? []

    return <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{pecas.some(p => p.idLocal === editando.idLocal) ? 'Editar peça' : 'Adicionar peça'}</h4>
        <Button type="button" variant="ghost" size="icon" onClick={() => setEditando(null)}><X size={16} /></Button>
      </div>
      {erro && <Alert variant="destructive"><AlertDescription>{erro}</AlertDescription></Alert>}
      <div className="space-y-2">
        <Label>Tipo do Item</Label>
        <Select value={editando.tipoCodigo || undefined} onValueChange={trocarTipo}>
          <SelectTrigger><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
          <SelectContent>{catalogo.map(tipo => <SelectItem key={tipo.codigo} value={tipo.codigo}>{tipo.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {definicao && <>
        {preservarPersonalizados && Object.keys(editando.personalizados).some(chave => !definicao.campos.some(campo => campo.id === chave)) && <p className="text-xs text-muted-foreground">Os campos de tipos anteriores continuam preservados e voltam a aparecer ao selecionar o tipo correspondente.</p>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>Identificação</Label><Input value={editando.comuns.identificacao} onChange={e => atualizarComum('identificacao', e.target.value)} /></div>
          <div className="space-y-2"><Label>Quantidade</Label><Input type="number" min={codigoExame === 'b601' ? 0 : 1} step={codigoExame === 'b601' && editando.comuns.unidadeMedida !== 'UNIDADES' ? 'any' : 1} value={editando.comuns.quantidade} onChange={e => atualizarComum('quantidade', Number(e.target.value))} /></div>
          <div className="space-y-2"><Label>Medida</Label><Select value={editando.comuns.unidadeMedida} onValueChange={valor => atualizarComum('unidadeMedida', valor)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{editando.comuns.unidadeMedida && !opcoesMedida.some(opcao => opcao.label === editando.comuns.unidadeMedida) && <SelectItem value={editando.comuns.unidadeMedida}>{editando.comuns.unidadeMedida}</SelectItem>}{opcoesMedida.map(opcao => <SelectItem key={opcao.codigo} value={opcao.label}>{opcao.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Quant. Descrição</Label><Input value={editando.comuns.quantidadeDescricao} onChange={e => atualizarComum('quantidadeDescricao', e.target.value)} /></div>
          <div className="space-y-2"><Label>Data de Entrada</Label><Input type="date" value={editando.comuns.dataEntrada} onChange={e => atualizarComum('dataEntrada', e.target.value)} /></div>
          <div className="space-y-2"><Label>Lacre Entrada</Label><Input value={editando.comuns.lacreEntrada} onChange={e => atualizarComum('lacreEntrada', e.target.value)} /></div>
          <div className="space-y-2"><Label>Lacre Saída</Label><Input value={editando.comuns.lacreSaida} onChange={e => atualizarComum('lacreSaida', e.target.value)} /></div>
          <div className="space-y-2"><Label>Data de Liberação</Label><Input type="date" value={editando.comuns.dataLiberacao} onChange={e => atualizarComum('dataLiberacao', e.target.value)} /></div>
          <div className="space-y-2"><Label>Código do Vestígio</Label><Input value={editando.comuns.codigoVestigio} onChange={e => atualizarComum('codigoVestigio', e.target.value)} /></div>
        </div>
        {camposPersonalizadosPrincipais.length > 0 && <div className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
          {camposPersonalizadosPrincipais.map(campo => <div className="space-y-2" key={campo.id}><Label>{campo.label}{campo.obrigatorio ? ' *' : ''}{campo.obrigatorioConclusao ? ' (exigido para conclusão no GDL)' : ''}</Label>{campo.controle === 'combobox'
            ? <MarcaArmaCombobox opcoes={campo.opcoes ?? []} value={String(editando.personalizados[campo.id] ?? '')} onChange={valor => setEditando({ ...editando, personalizados: { ...editando.personalizados, [campo.id]: valor } })} />
            : campo.controle === 'select'
              ? <Select value={String(editando.personalizados[campo.id] ?? '') || undefined} onValueChange={valor => setEditando({ ...editando, personalizados: { ...editando.personalizados, [campo.id]: valor } })}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{campo.opcoes?.map(opcao => <SelectItem key={opcao.codigo} value={opcao.codigo}>{opcao.label}</SelectItem>)}</SelectContent></Select>
            : campo.controle === 'checkbox'
              ? <div className="flex flex-wrap gap-4" role="group" aria-label={campo.label}>{campo.opcoes?.map(opcao => <label className="flex cursor-pointer items-center gap-2" key={opcao.codigo}><Checkbox checked={editando.personalizados[campo.id] === opcao.codigo} onCheckedChange={marcado => setEditando({ ...editando, personalizados: { ...editando.personalizados, [campo.id]: marcado === true ? opcao.codigo : '' } })} /><span className="text-sm">{opcao.label}</span></label>)}</div>
              : <Input type="text" maxLength={campo.maxLength} value={String(editando.personalizados[campo.id] ?? '')} onChange={e => setEditando({ ...editando, personalizados: { ...editando.personalizados, [campo.id]: e.target.value } })} />}</div>)}
        </div>}
        <div className="space-y-2"><Label>Observação</Label><Input value={editando.comuns.observacao} onChange={e => atualizarComum('observacao', e.target.value)} /></div>
        <div className="grid grid-cols-1 items-end gap-4 border-t pt-4 md:grid-cols-4">
          <div className="space-y-2"><Label>Examinado In Loco</Label><Select value={editando.comuns.examinadoInLoco ? 'S' : 'N'} onValueChange={valor => atualizarComum('examinadoInLoco', valor === 'S')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="S">Sim</SelectItem><SelectItem value="N">Não</SelectItem></SelectContent></Select></div>
          {campoArmaInstitucional
            ? <div className="space-y-2"><Label>{campoArmaInstitucional.label}{campoArmaInstitucional.obrigatorio ? ' *' : ''}</Label><Select value={String(editando.personalizados[campoArmaInstitucional.id] ?? '') || undefined} onValueChange={valor => setEditando({ ...editando, personalizados: { ...editando.personalizados, [campoArmaInstitucional.id]: valor } })}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{campoArmaInstitucional.opcoes?.map(opcao => <SelectItem key={opcao.codigo} value={opcao.codigo}>{opcao.label}</SelectItem>)}</SelectContent></Select></div>
            : <div className="hidden md:block" aria-hidden="true" />}
          {exibirMaterialIncinerado && <div className="space-y-2"><Label>Mat. Incinerado?</Label><Select value={editando.comuns.materialIncinerado} onValueChange={valor => atualizarComum('materialIncinerado', valor === 'S' ? 'S' : 'N')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="S">Sim</SelectItem><SelectItem value="N">Não</SelectItem></SelectContent></Select></div>}
          <div className="space-y-2"><Label>Consumido/Liberado no Exame?</Label><Select value={editando.comuns.consumida} onValueChange={v => atualizarComum('consumida', v === 'S' ? 'S' : v === 'P' ? 'P' : 'N')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="S">Sim</SelectItem><SelectItem value="N">Não</SelectItem><SelectItem value="P">Parcialmente</SelectItem></SelectContent></Select></div>
        </div>
      </>}
      {codigoExame === 'b601' && <DadosAdicionaisPecaGdl dados={editando.extrasGdl} tipoCodigo={editando.tipoCodigo} personalizados={editando.personalizados} />}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button><Button type="button" onClick={salvar}>Confirmar peça</Button></div>
    </div>
  }

  return <div className="space-y-3">
    {pecas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma peça adicionada.</p>}
    {pecas.map((peca, indice) => {
      const estaIncompleta = estaCompleta ? !estaCompleta(peca) : Boolean(validarPeca(peca))

      return <div
        key={peca.idLocal}
        id={`peca-${codigoExame}-${peca.idLocal}`}
        tabIndex={-1}
        className={`flex items-center justify-between gap-3 rounded-lg border p-3 outline-none ${estaIncompleta ? 'border-amber-400 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/20' : ''}`}
      >
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{peca.tipoPeca}</span><Badge variant="secondary">{peca.origem === 'gdl' ? 'Importada do GDL' : 'Manual'}</Badge>{estaIncompleta && <Badge variant="outline" className="border-amber-400 text-amber-800 dark:border-amber-700 dark:text-amber-300">Pendente</Badge>}{peca.alteradaLocalmente && <Badge variant="outline">Alterada localmente</Badge>}</div><p className="truncate text-sm text-muted-foreground">{peca.comuns.identificacao || 'Sem identificação'} · {peca.comuns.quantidade} {peca.comuns.unidadeMedida}</p></div>
        <div className="flex shrink-0 gap-1">
          {permitirReordenacao && <>
            <Button type="button" variant="ghost" size="icon" disabled={indice === 0} onClick={() => mover(indice, -1)} title="Mover peça para cima"><ArrowUp size={16} /></Button>
            <Button type="button" variant="ghost" size="icon" disabled={indice === pecas.length - 1} onClick={() => mover(indice, 1)} title="Mover peça para baixo"><ArrowDown size={16} /></Button>
          </>}
          <Button type="button" variant="ghost" size="icon" onClick={() => setEditando(structuredClone(codigoExame === 'b601' ? preencherOrigemColetaB601(peca) : peca))} title="Editar"><Edit size={16} /></Button><Button type="button" variant="ghost" size="icon" onClick={() => excluir(peca)} title="Excluir"><Trash2 size={16} /></Button>
        </div>
      </div>
    })}
    <div className="flex flex-wrap gap-2">
      <Button id={`adicionar-peca-${codigoExame}`} type="button" variant="outline" className="gap-2" onClick={() => setEditando(criarPeca())}><Plus size={16} />Adicionar peça</Button>
      {onRevisarPecasGdl && <Button type="button" variant="outline" className="gap-2" onClick={onRevisarPecasGdl}><RefreshCw size={16} />Selecionar peças do GDL</Button>}
    </div>
  </div>
}
