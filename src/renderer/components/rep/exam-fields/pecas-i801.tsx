import { useState } from 'react'
import { Edit, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CATALOGO_TIPOS_PECA_I801 } from '@shared/catalogos/i801.catalogo'
import type { CampoI801 } from '@shared/catalogos/i801.catalogo'
import type { PecaI801 } from '@shared/types/i801.types'
import { DadosAdicionaisPecaI801Gdl } from '../DadosAdicionaisPecaI801Gdl'
import type { ExamSectionProps } from './types'

function criarPeca(): PecaI801 {
  return {
    idLocal: crypto.randomUUID(), origem: 'manual', alteradaLocalmente: false, tipoCodigo: '', tipoPeca: '',
    comuns: {
      identificacao: '', numeroAnalises: 1, quantidade: 1, unidadeMedida: '', quantidadeDescricao: '',
      examinadoInLoco: false, dataEntrada: '', lacreEntrada: '', lacreSaida: '', dataLiberacao: '',
      codigoVestigio: '', consumida: 'N', observacao: '',
    },
    personalizados: {}, extrasGdl: {},
  }
}

export function PecasI801Fields({ dadosI801, onDadosI801Change, onRevisarPecasGdl }: ExamSectionProps) {
  const [editando, setEditando] = useState<PecaI801 | null>(null)

  if (!dadosI801 || !onDadosI801Change) return null

  const tipo = CATALOGO_TIPOS_PECA_I801.find(item => item.codigo === editando?.tipoCodigo)
  const atualizarComum = <K extends keyof PecaI801['comuns']>(campo: K, valor: PecaI801['comuns'][K]) => {
    setEditando(atual => atual ? { ...atual, comuns: { ...atual.comuns, [campo]: valor } } : atual)
  }
  const atualizarPersonalizado = (campo: CampoI801, valor: string) => {
    setEditando(atual => atual ? { ...atual, personalizados: { ...atual.personalizados, [campo]: valor } } : atual)
  }
  const salvar = () => {
    if (!editando || !tipo) return
    const peca = editando.origem === 'gdl' ? { ...editando, alteradaLocalmente: true } : editando
    const existe = dadosI801.pecas.some(item => item.idLocal === peca.idLocal)
    onDadosI801Change({ pecas: existe ? dadosI801.pecas.map(item => item.idLocal === peca.idLocal ? peca : item) : [...dadosI801.pecas, peca] })
    setEditando(null)
  }

  if (editando) {
    return <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label>Tipo do Item *</Label>
        <Select value={editando.tipoCodigo} onValueChange={codigo => {
          const selecionado = CATALOGO_TIPOS_PECA_I801.find(item => item.codigo === codigo)
          if (selecionado) setEditando({ ...editando, tipoCodigo: codigo, tipoPeca: selecionado.label })
        }}>
          <SelectTrigger><SelectValue placeholder="Selecione o tipo..." /></SelectTrigger>
          <SelectContent>{CATALOGO_TIPOS_PECA_I801.map(item => <SelectItem key={item.codigo} value={item.codigo}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {tipo && <>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>Identificação</Label><Input value={editando.comuns.identificacao} onChange={evento => atualizarComum('identificacao', evento.target.value)} /></div>
          <div className="space-y-2"><Label>Nº Análises</Label><Input type="number" min="1" value={editando.comuns.numeroAnalises} onChange={evento => atualizarComum('numeroAnalises', Math.max(1, Number(evento.target.value) || 1))} /></div>
          <div className="space-y-2"><Label>Quantidade</Label><Input type="number" min="0" step="any" value={editando.comuns.quantidade} onChange={evento => atualizarComum('quantidade', Number(evento.target.value) || 0)} /></div>
          <div className="space-y-2"><Label>Medida *</Label><Input value={editando.comuns.unidadeMedida} onChange={evento => atualizarComum('unidadeMedida', evento.target.value)} /></div>
          <div className="space-y-2"><Label>Quant. Descrição</Label><Input value={editando.comuns.quantidadeDescricao} onChange={evento => atualizarComum('quantidadeDescricao', evento.target.value)} /></div>
          <div className="space-y-2"><Label>Data de Entrada *</Label><Input type="date" value={editando.comuns.dataEntrada} onChange={evento => atualizarComum('dataEntrada', evento.target.value)} /></div>
          <div className="space-y-2"><Label>Lacre Entrada</Label><Input value={editando.comuns.lacreEntrada} onChange={evento => atualizarComum('lacreEntrada', evento.target.value)} /></div>
          <div className="space-y-2"><Label>Lacre Saída</Label><Input value={editando.comuns.lacreSaida} onChange={evento => atualizarComum('lacreSaida', evento.target.value)} /></div>
          <div className="space-y-2"><Label>Data de Liberação</Label><Input type="date" value={editando.comuns.dataLiberacao} onChange={evento => atualizarComum('dataLiberacao', evento.target.value)} /></div>
          <div className="space-y-2"><Label>Código do Vestígio</Label><Input value={editando.comuns.codigoVestigio} onChange={evento => atualizarComum('codigoVestigio', evento.target.value)} /></div>
        </div>
        <div className="grid grid-cols-1 gap-4 border-t pt-4 md:grid-cols-2">
          {tipo.campos.map(campo => <div className="space-y-2" key={campo.id}>
            <Label>{campo.label}</Label>
            {campo.id === 'resultado_psa'
              ? <Select value={String(editando.personalizados[campo.id] ?? '')} onValueChange={valor => atualizarPersonalizado(campo.id, valor)}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent><SelectItem value="negativo">Negativo</SelectItem><SelectItem value="positivo">Positivo</SelectItem><SelectItem value="positivo_fraco">Positivo Fraco</SelectItem></SelectContent></Select>
              : <Input value={String(editando.personalizados[campo.id] ?? '')} onChange={evento => atualizarPersonalizado(campo.id, evento.target.value)} />}
          </div>)}
        </div>
        <div className="grid grid-cols-1 items-end gap-4 border-t pt-4 md:grid-cols-3">
          <div className="space-y-2"><Label>Examinado In Loco</Label><Select value={editando.comuns.examinadoInLoco ? 'S' : 'N'} onValueChange={valor => atualizarComum('examinadoInLoco', valor === 'S')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="S">Sim</SelectItem><SelectItem value="N">Não</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Consumido/Liberado no Exame?</Label><Select value={editando.comuns.consumida} onValueChange={valor => atualizarComum('consumida', valor === 'S' ? 'S' : valor === 'P' ? 'P' : 'N')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="S">Sim</SelectItem><SelectItem value="N">Não</SelectItem><SelectItem value="P">Parcialmente</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Observação</Label><Input value={editando.comuns.observacao} onChange={evento => atualizarComum('observacao', evento.target.value)} /></div>
        </div>
      </>}
      <DadosAdicionaisPecaI801Gdl dados={editando.extrasGdl} tipoCodigo={editando.tipoCodigo} personalizados={editando.personalizados} />
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button><Button type="button" disabled={!tipo || !editando.comuns.unidadeMedida || !editando.comuns.dataEntrada} onClick={salvar}>Confirmar peça</Button></div>
    </div>
  }

  return <div className="space-y-3">
    {dadosI801.pecas.map(peca => <div key={peca.idLocal} className="flex items-center justify-between rounded-lg border p-3"><div><p className="font-medium">{peca.tipoPeca || 'Tipo não informado'}</p><p className="text-sm text-muted-foreground">{peca.comuns.identificacao || 'Sem identificação'} · {peca.comuns.quantidade} {peca.comuns.unidadeMedida}</p></div><div className="flex gap-1"><Button type="button" variant="ghost" size="icon" onClick={() => setEditando(structuredClone(peca))}><Edit size={16} /></Button><Button type="button" variant="ghost" size="icon" onClick={() => onDadosI801Change({ pecas: dadosI801.pecas.filter(item => item.idLocal !== peca.idLocal) })}><Trash2 size={16} /></Button></div></div>)}
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" className="gap-2" onClick={() => setEditando(criarPeca())}><Plus size={16} />Adicionar peça</Button>
      {onRevisarPecasGdl && <Button type="button" variant="outline" className="gap-2" onClick={onRevisarPecasGdl}><RefreshCw size={16} />Selecionar peças do GDL</Button>}
    </div>
  </div>
}
