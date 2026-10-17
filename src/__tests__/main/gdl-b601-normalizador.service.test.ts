import { describe, expect, it } from 'vitest'
import { converterRepB601 } from '../../main/services/gdl-b601-normalizador.service'
import { converterRepB602 } from '../../main/services/gdl-b602-normalizador.service'
import { validarGdlRep } from '../../main/services/gdl.schema'
import { preencherOrigemColetaB601, separarCamposAdicionaisB601 } from '../../shared/gdl/b601-campos-adicionais'

function criarRep(campos: Record<string, unknown>) {
  return validarGdlRep({
    codRep: 1, numero: 1, ano: 2026, origens: [],
    pecas: [{ codPeca: 10, tipoPeca: 'ESTOJO(S)', quantidade: 2, unidadeMedida: 'UNIDADES', ...campos }],
  })
}

describe('importação B601 com campos adicionais', () => {
  it.each(['NECRÓPSIA', '94', 94])('preenche a origem dos projéteis a partir de %s', valor => {
    const resultado = converterRepB601(criarRep({ tipoPeca: 'PROJÉTEIS', 'ORIGEM/COLETA': valor }))
    expect(resultado.camposEspecificos.pecas[0].personalizados['105:origem_coleta']).toBe('94')
  })

  it.each(['ESTOJO(S)', 'PROJÉTEIS'])('recupera a origem de %s já importado sem alterar o original', tipoPeca => {
    const peca = converterRepB601(criarRep({ tipoPeca })).camposEspecificos.pecas[0]
    peca.extrasGdl = { 'ORIGEM/COLETA': 'NECRÓPSIA' }
    const copia = structuredClone(peca)
    const preenchida = preencherOrigemColetaB601(peca)
    expect(preenchida.personalizados[`${peca.tipoCodigo}:origem_coleta`]).toBe('94')
    expect(preenchida.extrasGdl).toEqual(copia.extrasGdl)
    expect(peca).toEqual(copia)
    expect(preencherOrigemColetaB601({ ...peca, personalizados: { [`${peca.tipoCodigo}:origem_coleta`]: '95' } }).personalizados[`${peca.tipoCodigo}:origem_coleta`]).toBe('95')
    expect(preencherOrigemColetaB601({ ...peca, extrasGdl: { 'ORIGEM/COLETA': 'NOVA ORIGEM' } }).personalizados).toEqual({})
  })

  it.each(['DELEGACIA', '95', 95, ' delegacia '])('preenche a origem de estojos a partir de %s', valor => {
    const resultado = converterRepB601(criarRep({ 'ORIGEM/COLETA': valor, numeroAnalises: '1' }))
    const peca = resultado.camposEspecificos.pecas[0]
    expect(peca.personalizados['101:origem_coleta']).toBe('95')
    expect(peca.extrasGdl).toEqual({ numeroAnalises: '1' })
    expect(resultado.avisos.some(aviso => aviso.codigo === 'CAMPOS_B601_PARA_REVISAO')).toBe(false)
  })

  it.each(['1', '0'])('preserva Nº Análises %s como informação, sem aviso de revisão', valor => {
    const resultado = converterRepB601(criarRep({ numeroAnalises: valor }))
    const peca = resultado.camposEspecificos.pecas[0]
    expect(peca.extrasGdl.numeroAnalises).toBe(valor)
    expect(resultado.avisos.some(aviso => aviso.codigo === 'CAMPOS_B601_PARA_REVISAO')).toBe(false)
    expect(separarCamposAdicionaisB601(peca.extrasGdl).informativos).toEqual([
      { chave: 'numeroAnalises', rotulo: 'Nº Análises', valor },
    ])
  })

  it('identifica o campo com valor desconhecido e conserva seu conteúdo integral', () => {
    const resultado = converterRepB601(criarRep({ 'ORIGEM/COLETA': 'ORIGEM NOVA', numeroAnalises: '1' }))
    const peca = resultado.camposEspecificos.pecas[0]
    expect(peca.personalizados['101:origem_coleta']).toBeUndefined()
    expect(peca.extrasGdl).toEqual({ 'ORIGEM/COLETA': 'ORIGEM NOVA', numeroAnalises: '1' })
    const aviso = resultado.avisos.find(item => item.codigo === 'CAMPOS_B601_PARA_REVISAO')
    expect(aviso?.mensagem).toContain('Peça 1 (ESTOJO(S)): confira ORIGEM/COLETA.')
    expect(aviso?.mensagem).not.toContain('numeroAnalises')
    expect(aviso?.contexto).toEqual({ campos: ['ORIGEM/COLETA'] })
  })

  it('preserva objetos desconhecidos e avisa com o nome do campo', () => {
    const valor = { codigo: 'novo', descricao: 'Dado de origem' }
    const resultado = converterRepB601(criarRep({ 'Campo novo': valor }))
    expect(resultado.camposEspecificos.pecas[0].extrasGdl['Campo novo']).toEqual(valor)
    expect(resultado.avisos.find(item => item.codigo === 'CAMPOS_B601_PARA_REVISAO')?.mensagem).toContain('Campo novo')
  })

  it('conserva extras vazios sem pedir revisão e mantém zero e falso como valores preenchidos', () => {
    const extras = { vazio: ' ', nulo: null, lista: [], objeto: {}, zero: 0, falso: false }
    const copia = structuredClone(extras)
    const separado = separarCamposAdicionaisB601(extras)
    expect(separado.revisao.map(campo => campo.chave)).toEqual(['zero', 'falso'])
    expect(separado.informativos.map(campo => campo.chave)).toEqual(['vazio', 'nulo', 'lista', 'objeto'])
    expect(extras).toEqual(copia)
    const resultado = converterRepB601(criarRep({ 'Campo vazio': '', 'Campo ausente': null }))
    expect(resultado.camposEspecificos.pecas[0].extrasGdl).toEqual({ 'Campo vazio': '', 'Campo ausente': null })
    expect(resultado.avisos.some(aviso => aviso.codigo === 'CAMPOS_B601_PARA_REVISAO')).toBe(false)
  })

  it('trata a origem legada já preenchida como informação sem apagar o original', () => {
    const extras = { 'ORIGEM/COLETA': 'DELEGACIA', numeroAnalises: '1' }
    const separado = separarCamposAdicionaisB601(extras, '101', { '101:origem_coleta': '95' })
    expect(separado.revisao).toEqual([])
    expect(separado.informativos).toHaveLength(2)
    expect(extras['ORIGEM/COLETA']).toBe('DELEGACIA')
  })

  it('mantém para conferência uma origem legada que difere do preenchimento local', () => {
    const separado = separarCamposAdicionaisB601({ 'ORIGEM/COLETA': 'DELEGACIA' }, '101', { '101:origem_coleta': '93' })
    expect(separado.revisao).toEqual([{ chave: 'ORIGEM/COLETA', rotulo: 'ORIGEM/COLETA', valor: 'DELEGACIA' }])
  })

  it('preserva datas não reconhecidas e as identifica no aviso', () => {
    const resultado = converterRepB601(criarRep({ dataEntrada: 'data indefinida' }))
    expect(resultado.camposEspecificos.pecas[0].extrasGdl.dataEntrada).toBe('data indefinida')
    expect(resultado.avisos.find(item => item.codigo === 'CAMPOS_B601_PARA_REVISAO')?.contexto).toEqual({ campos: ['dataEntrada'] })
  })

  it('mantém o tratamento anterior de Nº Análises no B602', () => {
    const resultado = converterRepB602(criarRep({ numeroAnalises: '1' }))
    expect(resultado.camposEspecificos.pecas[0].extrasGdl).not.toHaveProperty('numeroAnalises')
  })
})
