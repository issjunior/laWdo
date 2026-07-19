import React, { useMemo, useState } from 'react'
import { Edit, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { PecaB602 } from '@shared/types/b602-gdl.types'
import { CATALOGO_TIPOS_PECA_B602, TIPOS_PECA_B602_POR_CODIGO } from '@shared/catalogos/b602-gdl.catalogo'

interface PecasB602FieldsProps {
  pecas: PecaB602[]
  onChange: (pecas: PecaB602[]) => void
  onRevisarPecasGdl?: () => void
}

function criarPecaVazia(): PecaB602 {
  return {
    idLocal: crypto.randomUUID(), origem: 'manual', alteradaLocalmente: false,
    tipoCodigo: '', tipoPeca: '',
    comuns: {
      identificacao: '', numeroAnalises: '', quantidade: 1, unidadeMedida: '', quantidadeDescricao: '',
      examinadoInLoco: false, dataEntrada: '', lacreEntrada: '', lacreSaida: '', dataLiberacao: '',
      codigoVestigio: '', consumida: '', observacao: '',
    },
    personalizados: {}, extrasGdl: {},
  }
}

export const PecasB602Fields: React.FC<PecasB602FieldsProps> = ({ pecas, onChange, onRevisarPecasGdl }) => {
  const [editando, setEditando] = useState<PecaB602 | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const definicao = useMemo(
    () => editando ? TIPOS_PECA_B602_POR_CODIGO.get(editando.tipoCodigo) : undefined,
    [editando],
  )

  const atualizarComum = <K extends keyof PecaB602['comuns']>(campo: K, valor: PecaB602['comuns'][K]) => {
    setEditando(atual => atual ? { ...atual, comuns: { ...atual.comuns, [campo]: valor } } : atual)
  }

  const trocarTipo = (codigo: string) => {
    if (!editando) return
    const possuiPersonalizados = Object.values(editando.personalizados).some(valor => valor !== '' && valor != null)
    if (possuiPersonalizados && !window.confirm('A troca do tipo descartará os campos personalizados preenchidos. Continuar?')) return
    const tipo = TIPOS_PECA_B602_POR_CODIGO.get(codigo)
    if (!tipo) return
    setEditando({ ...editando, tipoCodigo: codigo, tipoPeca: tipo.label, personalizados: {} })
    setErro(null)
  }

  const salvar = () => {
    if (!editando || !definicao) return setErro('Selecione o Tipo do Item.')
    if (editando.comuns.quantidade <= 0) return setErro('A quantidade deve ser maior que zero.')
    const ausente = definicao.campos.find(campo => campo.obrigatorio && !editando.personalizados[campo.id])
    if (ausente) return setErro(`${ausente.label} é obrigatório.`)
    const peca = editando.origem === 'gdl' ? { ...editando, alteradaLocalmente: true } : editando
    const indice = pecas.findIndex(item => item.idLocal === peca.idLocal)
    onChange(indice >= 0 ? pecas.map(item => item.idLocal === peca.idLocal ? peca : item) : [...pecas, peca])
    setEditando(null)
    setErro(null)
  }

  const excluir = (peca: PecaB602) => {
    const aviso = peca.origem === 'gdl'
      ? 'A peça será excluída somente do laWdo; o GDL não será alterado. Continuar?'
      : 'Excluir esta peça?'
    if (window.confirm(aviso)) onChange(pecas.filter(item => item.idLocal !== peca.idLocal))
  }

  if (editando) {
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
          <SelectContent>{CATALOGO_TIPOS_PECA_B602.map(tipo => <SelectItem key={tipo.codigo} value={tipo.codigo}>{tipo.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {definicao && <>
        {!definicao.roundTripConfirmado && <Alert><AlertDescription>Schema visual confirmado; round-trip da API ainda pendente.</AlertDescription></Alert>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>Identificação</Label><Input value={editando.comuns.identificacao} onChange={e => atualizarComum('identificacao', e.target.value)} /></div>
          <div className="space-y-2"><Label>Nº Análises</Label><Input value={editando.comuns.numeroAnalises} onChange={e => atualizarComum('numeroAnalises', e.target.value)} /></div>
          <div className="space-y-2"><Label>Quantidade</Label><Input type="number" min={1} value={editando.comuns.quantidade} onChange={e => atualizarComum('quantidade', Number(e.target.value))} /></div>
          <div className="space-y-2"><Label>Medida</Label><Input value={editando.comuns.unidadeMedida} onChange={e => atualizarComum('unidadeMedida', e.target.value)} /></div>
          <div className="space-y-2"><Label>Quant. Descrição</Label><Input value={editando.comuns.quantidadeDescricao} onChange={e => atualizarComum('quantidadeDescricao', e.target.value)} /></div>
          <div className="space-y-2"><Label>Data de Entrada</Label><Input type="date" value={editando.comuns.dataEntrada} onChange={e => atualizarComum('dataEntrada', e.target.value)} /></div>
          <div className="space-y-2"><Label>Lacre Entrada</Label><Input value={editando.comuns.lacreEntrada} onChange={e => atualizarComum('lacreEntrada', e.target.value)} /></div>
          <div className="space-y-2"><Label>Lacre Saída</Label><Input value={editando.comuns.lacreSaida} onChange={e => atualizarComum('lacreSaida', e.target.value)} /></div>
          <div className="space-y-2"><Label>Data de Liberação</Label><Input type="date" value={editando.comuns.dataLiberacao} onChange={e => atualizarComum('dataLiberacao', e.target.value)} /></div>
          <div className="space-y-2"><Label>Código do Vestígio</Label><Input value={editando.comuns.codigoVestigio} onChange={e => atualizarComum('codigoVestigio', e.target.value)} /></div>
          <div className="space-y-2"><Label>Examinado In Loco</Label><Select value={editando.comuns.examinadoInLoco ? 'sim' : 'nao'} onValueChange={v => atualizarComum('examinadoInLoco', v === 'sim')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="nao">Não</SelectItem><SelectItem value="sim">Sim</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Consumido/Liberado no Exame?</Label><Select value={editando.comuns.consumida || 'vazio'} onValueChange={v => atualizarComum('consumida', v === 'vazio' ? '' : v as 'S' | 'N' | 'P')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="vazio">Não informado</SelectItem><SelectItem value="S">Sim</SelectItem><SelectItem value="N">Não</SelectItem><SelectItem value="P">Parcialmente</SelectItem></SelectContent></Select></div>
        </div>
        {definicao.campos.length > 0 && <div className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
          {definicao.campos.map(campo => <div className="space-y-2" key={campo.id}><Label>{campo.label}{campo.obrigatorio ? ' *' : ''}</Label>{campo.controle === 'select'
            ? <Select value={String(editando.personalizados[campo.id] ?? '') || undefined} onValueChange={valor => setEditando({ ...editando, personalizados: { ...editando.personalizados, [campo.id]: valor } })}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{campo.opcoes?.map(opcao => <SelectItem key={opcao.codigo} value={opcao.codigo}>{opcao.label}</SelectItem>)}</SelectContent></Select>
            : <Input value={String(editando.personalizados[campo.id] ?? '')} onChange={e => setEditando({ ...editando, personalizados: { ...editando.personalizados, [campo.id]: e.target.value } })} />}</div>)}
        </div>}
        <div className="space-y-2"><Label>Observação</Label><Input value={editando.comuns.observacao} onChange={e => atualizarComum('observacao', e.target.value)} /></div>
      </>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button><Button type="button" onClick={salvar}>Confirmar peça</Button></div>
    </div>
  }

  return <div className="space-y-3">
    {pecas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma peça adicionada.</p>}
    {pecas.map(peca => <div key={peca.idLocal} className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{peca.tipoPeca}</span><Badge variant="secondary">{peca.origem === 'gdl' ? 'Importada do GDL' : 'Manual'}</Badge>{peca.alteradaLocalmente && <Badge variant="outline">Alterada localmente</Badge>}</div><p className="truncate text-sm text-muted-foreground">{peca.comuns.identificacao || 'Sem identificação'} · {peca.comuns.quantidade} {peca.comuns.unidadeMedida}</p></div>
      <div className="flex shrink-0 gap-1"><Button type="button" variant="ghost" size="icon" onClick={() => setEditando(structuredClone(peca))} title="Editar"><Edit size={16} /></Button><Button type="button" variant="ghost" size="icon" onClick={() => excluir(peca)} title="Excluir"><Trash2 size={16} /></Button></div>
    </div>)}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" className="gap-2" onClick={() => setEditando(criarPecaVazia())}><Plus size={16} />Adicionar peça</Button>
      {onRevisarPecasGdl && <Button type="button" variant="outline" className="gap-2" onClick={onRevisarPecasGdl}><RefreshCw size={16} />Selecionar peças do GDL</Button>}
    </div>
  </div>
}
