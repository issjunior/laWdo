import { useState } from 'react'
import { Edit, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATALOGO_TIPOS_PECA_I801, CAMPOS_I801 } from '@shared/catalogos/i801.catalogo'
import type { CampoI801 } from '@shared/catalogos/i801.catalogo'
import type { PecaI801 } from '@shared/types/i801.types'
import type { ExamSectionProps } from './types'

function criarPeca(): PecaI801 {
  return { idLocal: crypto.randomUUID(), origem: 'manual', alteradaLocalmente: false, tipoCodigo: '', tipoPeca: '',
    comuns: { identificacao: '', numeroAnalises: 1, quantidade: 1, unidadeMedida: '', quantidadeDescricao: '', examinadoInLoco: false, dataEntrada: '', lacreEntrada: '', lacreSaida: '', dataLiberacao: '', codigoVestigio: '', consumida: 'N', observacao: '' }, personalizados: {}, extrasGdl: {} }
}

export function PecasI801Fields({ dadosI801, onDadosI801Change }: ExamSectionProps) {
  const [editando, setEditando] = useState<PecaI801 | null>(null)
  if (!dadosI801 || !onDadosI801Change) return null
  const tipo = CATALOGO_TIPOS_PECA_I801.find(item => item.codigo === editando?.tipoCodigo)
  const atualizar = (campo: CampoI801, valor: string) => setEditando(atual => atual ? { ...atual, personalizados: { ...atual.personalizados, [campo]: valor } } : atual)
  const salvar = () => {
    if (!editando || !tipo) return
    const peca = editando.origem === 'gdl' ? { ...editando, alteradaLocalmente: true } : editando
    const existe = dadosI801.pecas.some(item => item.idLocal === peca.idLocal)
    onDadosI801Change({ pecas: existe ? dadosI801.pecas.map(item => item.idLocal === peca.idLocal ? peca : item) : [...dadosI801.pecas, peca] })
    setEditando(null)
  }
  if (editando) return <div className="space-y-4 rounded-lg border p-4">
    <div className="space-y-2"><Label>Tipo do Item *</Label><Select value={editando.tipoCodigo} onValueChange={codigo => { const selecionado = CATALOGO_TIPOS_PECA_I801.find(item => item.codigo === codigo); if (selecionado) setEditando({ ...editando, tipoCodigo: codigo, tipoPeca: selecionado.label }) }}><SelectTrigger><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger><SelectContent>{CATALOGO_TIPOS_PECA_I801.map(item => <SelectItem key={item.codigo} value={item.codigo}>{item.label}</SelectItem>)}</SelectContent></Select></div>
    {tipo && <><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Identificação</Label><Input value={editando.comuns.identificacao} onChange={e => setEditando({ ...editando, comuns: { ...editando.comuns, identificacao: e.target.value } })} /></div><div className="space-y-2"><Label>Nº Análises</Label><Input type="number" min="1" value={editando.comuns.numeroAnalises} onChange={e => setEditando({ ...editando, comuns: { ...editando.comuns, numeroAnalises: Math.max(1, Number(e.target.value) || 1) } })} /></div><div className="space-y-2"><Label>Quantidade</Label><Input type="number" min="0" step="any" value={editando.comuns.quantidade} onChange={e => setEditando({ ...editando, comuns: { ...editando.comuns, quantidade: Number(e.target.value) || 0 } })} /></div><div className="space-y-2"><Label>Medida *</Label><Input value={editando.comuns.unidadeMedida} onChange={e => setEditando({ ...editando, comuns: { ...editando.comuns, unidadeMedida: e.target.value } })} /></div><div className="space-y-2"><Label>Data de entrada *</Label><Input type="date" value={editando.comuns.dataEntrada} onChange={e => setEditando({ ...editando, comuns: { ...editando.comuns, dataEntrada: e.target.value } })} /></div></div><div className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">{tipo.campos.map(campo => <div className="space-y-2" key={campo}><Label>{CAMPOS_I801[campo]}</Label>{campo === 'resultado_psa' ? <Select value={String(editando.personalizados[campo] ?? '')} onValueChange={valor => atualizar(campo, valor)}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="negativo">Negativo</SelectItem><SelectItem value="positivo">Positivo</SelectItem><SelectItem value="positivo_fraco">Positivo Fraco</SelectItem></SelectContent></Select> : <Input value={String(editando.personalizados[campo] ?? '')} onChange={e => atualizar(campo, e.target.value)} />}</div>)}</div></>}
    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button><Button type="button" disabled={!tipo || !editando.comuns.unidadeMedida || !editando.comuns.dataEntrada} onClick={salvar}>Confirmar peça</Button></div>
  </div>
  return <div className="space-y-3">{dadosI801.pecas.map(peca => <div key={peca.idLocal} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{peca.tipoPeca || 'Tipo não informado'}</p><p className="text-sm text-muted-foreground">{peca.comuns.identificacao || 'Sem identificação'} · {peca.comuns.quantidade} {peca.comuns.unidadeMedida}</p></div><div className="flex gap-1"><Button type="button" variant="ghost" size="icon" onClick={() => setEditando(structuredClone(peca))}><Edit size={16} /></Button><Button type="button" variant="ghost" size="icon" onClick={() => onDadosI801Change({ pecas: dadosI801.pecas.filter(item => item.idLocal !== peca.idLocal) })}><Trash2 size={16} /></Button></div></div>)}<Button type="button" variant="outline" className="gap-2" onClick={() => setEditando(criarPeca())}><Plus size={16} />Adicionar peça</Button></div>
}
