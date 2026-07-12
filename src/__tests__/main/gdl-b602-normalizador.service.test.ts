import { describe, expect, it } from 'vitest'
import fixture from '../fixtures/gdl/rep-190-2026.json'
import { interpretarGdlRepJson, validarGdlRep } from '../../main/services/gdl.schema'
import { converterRepB602 } from '../../main/services/gdl-b602-normalizador.service'

describe('contrato GDL B602', () => {
  it('rejeita payload estruturalmente inválido', () => {
    expect(() => validarGdlRep({ numero: 190, ano: 2026, pecas: 'inválido' })).toThrow()
  })

  it('informa JSON inválido sem usar cast direto', () => {
    expect(() => interpretarGdlRepJson('{')).toThrow('O GDL retornou JSON inválido.')
  })

  it('preserva propriedades dinâmicas adicionais', () => {
    const rep = validarGdlRep(fixture)
    expect(rep.pecas[0]['Nº Série']).toBe('SERIE-ANONIMIZADA')
    expect(rep.pecas[1]['Campo Futuro']).toBe('preservar')
  })

  it('normaliza CARABINA, ESTOJO e REVÓLVER sem enviar peças para observações', () => {
    const resultado = converterRepB602(validarGdlRep(fixture))
    const [carabina, estojo, revolver] = resultado.camposEspecificos.pecas

    expect(resultado.codigoExame).toBe('B-602')
    expect(resultado.camposGerais).not.toHaveProperty('observacoes')
    expect(carabina.tipoCodigo).toBe('476')
    expect(carabina.personalizados).toMatchObject({
      '476:numero_serie': 'SERIE-ANONIMIZADA',
      '476:marca': 'MARCA TESTE',
      '476:modelo': 'MODELO TESTE',
      '476:arma_institucional': '97',
    })
    expect(estojo.tipoCodigo).toBe('101')
    expect(estojo.personalizados['101:origem_coleta']).toBe('93')
    expect(estojo.extrasGdl['Campo Futuro']).toBe('preservar')
    expect(estojo.comuns.consumida).toBe('P')
    expect(revolver.personalizados).toEqual({ '106:numero_serie': 'DHGEHY54' })
    expect(revolver.extrasGdl).toMatchObject({
      Marca: 'TAURUS',
      Modelo: 'XX',
      'Fabricação da Arma': 'brasileira',
      'Arma é Institucional?': 'NÃO',
    })
    expect(revolver.extrasGdl.Funcionamento).toBe('Eficiente')
  })

  it('preserva BO como tipo de solicitação canônico do GDL', () => {
    const resultado = converterRepB602(validarGdlRep(fixture))

    expect(resultado.camposGerais.tipo_solicitacao).toBe('BO')
    expect(resultado.camposGerais.b602_local_cidade).toBe('LONDRINA')
    expect(resultado.camposGerais.autoridade_solicitante).toBe('AUTORIDADE TESTE')
    expect(resultado.camposGerais.b602_numero_bo).toBe('123/2026')
    expect(resultado.camposGerais.b602_numero_ip).toBe('456/2026')
    expect(resultado.camposGerais.b602_envolvidos_0).toBe('ENVOLVIDO TESTE')
    expect(resultado.camposGerais.b602_envolvidos_1).toBe('OUTRO ENVOLVIDO')
    expect(resultado.camposEspecificos.dadosSolicitacao).toEqual({
      orgao: 'ÓRGÃO TESTE',
      responsavel: 'RESPONSÁVEL TESTE',
      autoridade: 'AUTORIDADE TESTE',
      origensCandidatasSolicitacao: [
        { tipo: 'BO', numero: '123/2026' },
        { tipo: 'BO/PM', numero: '123/2026' },
        { tipo: 'IP/APFD', numero: '456/2026' },
        { tipo: 'IP/PM', numero: '456/2026' },
      ],
    })
    expect(resultado.camposEspecificos.dadosInvestigacao.inqueritosPoliciais).toEqual([
      { tipo: 'IP/APFD', numero: '456/2026' },
      { tipo: 'IP/PM', numero: '456/2026' },
    ])
    expect(resultado.camposEspecificos.dadosInvestigacao.boletinsOcorrencia).toEqual([
      { tipo: 'BO', numero: '123/2026' },
      { tipo: 'BO/PM', numero: '123/2026' },
    ])
  })

  it('seleciona a primeira origem das famílias BO, IP ou OFÍCIO e preserva as demais opções', () => {
    const rep = validarGdlRep({
      ...fixture,
      origens: [
        { tipo: 'PROCESSO', numero: '1', ano: 2026, cidade: 'LONDRINA' },
        { tipo: 'IP/PM', numero: '2', ano: 2026, cidade: 'LONDRINA' },
        { tipo: 'OFÍCIO REQUISITANTE', numero: '3', ano: 2026, cidade: 'LONDRINA' },
        { tipo: 'BO/PM', numero: '4', ano: 2026, cidade: 'LONDRINA' },
      ],
    })

    const resultado = converterRepB602(rep)

    expect(resultado.camposGerais.tipo_solicitacao).toBe('IP/PM')
    expect(resultado.camposGerais.numero_documento).toBe('2/2026')
    expect(resultado.camposEspecificos.dadosSolicitacao.origensCandidatasSolicitacao).toEqual([
      { tipo: 'IP/PM', numero: '2/2026' },
      { tipo: 'OFÍCIO REQUISITANTE', numero: '3/2026' },
      { tipo: 'BO/PM', numero: '4/2026' },
    ])
  })

  it('propaga apenas os metadados seguros da consulta', () => {
    const resultado = converterRepB602(validarGdlRep(fixture), {
      origemInicial: 'gdl',
      dadosSolicitacao: {
        orgao: 'ÓRGÃO TESTE',
        responsavel: 'RESPONSÁVEL TESTE',
        autoridade: 'AUTORIDADE TESTE',
        origensCandidatasSolicitacao: [
          { tipo: 'BO', numero: '123/2026' },
          { tipo: 'BO/PM', numero: '123/2026' },
          { tipo: 'IP/APFD', numero: '456/2026' },
          { tipo: 'IP/PM', numero: '456/2026' },
        ],
      },
      ultimaConsulta: {
        ambiente: 'homologacao',
        numeroRep: '190',
        anoRep: '2026',
        consultadoEm: '2026-07-12T12:00:00.000Z',
      },
    })

    expect(resultado.metadadosIntegracaoGdl).toEqual({
      origemInicial: 'gdl',
      dadosSolicitacao: {
        orgao: 'ÓRGÃO TESTE',
        responsavel: 'RESPONSÁVEL TESTE',
        autoridade: 'AUTORIDADE TESTE',
        origensCandidatasSolicitacao: [
          { tipo: 'BO', numero: '123/2026' },
          { tipo: 'BO/PM', numero: '123/2026' },
          { tipo: 'IP/APFD', numero: '456/2026' },
          { tipo: 'IP/PM', numero: '456/2026' },
        ],
      },
      dadosInvestigacao: {
        envolvidos: ['ENVOLVIDO TESTE', 'OUTRO ENVOLVIDO'],
        boletinsOcorrencia: [
          { tipo: 'BO', numero: '123/2026' },
          { tipo: 'BO/PM', numero: '123/2026' },
        ],
        inqueritosPoliciais: [
          { tipo: 'IP/APFD', numero: '456/2026' },
          { tipo: 'IP/PM', numero: '456/2026' },
        ],
      },
      ultimaConsulta: {
        ambiente: 'homologacao',
        numeroRep: '190',
        anoRep: '2026',
        consultadoEm: '2026-07-12T12:00:00.000Z',
      },
    })
  })

  it('não escolhe um IP quando o GDL retorna números diferentes', () => {
    const rep = validarGdlRep({
      ...fixture,
      origens: [
        ...fixture.origens,
        { tipo: 'IP ONLINE', numero: '999', ano: 2026, cidade: 'LONDRINA' },
      ],
    })
    const resultado = converterRepB602(rep)

    expect(resultado.camposGerais.b602_numero_ip).toBe('')
    expect(resultado.avisos).toContainEqual(expect.objectContaining({
      codigo: 'MULTIPLOS_NUMEROS_IP',
    }))
  })

  it('avisa quando a API não retorna nomes de envolvidos', () => {
    const fixtureSemEnvolvidos = Object.fromEntries(
      Object.entries(fixture).filter(([chave]) => chave !== 'dadosComplementares'),
    )
    const resultado = converterRepB602(validarGdlRep(fixtureSemEnvolvidos))

    expect(resultado.camposGerais.b602_envolvidos_0).toBeUndefined()
    expect(resultado.avisos).toContainEqual(expect.objectContaining({
      codigo: 'ENVOLVIDOS_NAO_RETORNADOS',
    }))
  })

  it('classifica variantes BO pelo prefixo, sem lista fixa de tipos', () => {
    const rep = validarGdlRep({
      ...fixture,
      origens: [{ tipo: 'BOC', numero: '777', ano: 2026, cidade: 'LONDRINA' }],
    })
    const resultado = converterRepB602(rep)

    expect(resultado.camposGerais.b602_numero_bo).toBe('777/2026')
    expect(resultado.camposEspecificos.dadosInvestigacao.boletinsOcorrencia).toEqual([
      { tipo: 'BOC', numero: '777/2026' },
    ])
  })
})
