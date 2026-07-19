import { describe, expect, it } from 'vitest'
import fixture from '../fixtures/gdl/rep-190-2026.json'
import {
  interpretarGdlListaRepsInvestigacaoJson,
  interpretarGdlRepJson,
  validarGdlRep,
} from '../../main/services/gdl.schema'
import { converterRepB602 } from '../../main/services/gdl-b602-normalizador.service'
import { extrairFiltrosParaConsultaInvestigacao } from '../../main/services/gdl.service'
import { CATALOGO_TIPOS_PECA_B602 } from '../../shared/catalogos/b602-gdl.catalogo'

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
    expect(carabina.comuns).not.toHaveProperty('numeroAnalises')
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

  it('normaliza consumida vazia como Não, seguindo o padrão do GDL', () => {
    const rep = validarGdlRep({
      ...fixture,
      pecas: fixture.pecas.map((peca, indice) => indice === 0 ? { ...peca, consumida: '' } : peca),
    })

    expect(converterRepB602(rep).camposEspecificos.pecas[0].comuns.consumida).toBe('N')
  })

  it('mapeia os valores salvos de ARMA(S) DE CHOQUE para o formulário do laWdo', () => {
    const resultado = converterRepB602(validarGdlRep({
      codRep: 1902026,
      numero: 190,
      ano: 2026,
      pecas: [{
        codPeca: 1004,
        tipoPeca: 'ARMA(S) DE CHOQUE',
        identificacao: 'TESTE UX ARMA CHOQUE',
        quantidade: 1,
        unidadeMedida: 'UNIDADES',
        numeroAnalises: '1',
        examinadoInLoco: false,
        dataEntrada: '19/07/2026',
        lacreEntrada: '',
        lacreSaida: '',
        consumida: 'Não',
        'Nº Série': 'UX289-SERIE-01',
        Marca: 'UX289-MARCA',
        Modelo: 'UX289-MODELO',
      }],
    }))
    const [armaChoque] = resultado.camposEspecificos.pecas

    expect(armaChoque.comuns.dataEntrada).toBe('2026-07-19')
    expect(armaChoque.personalizados).toEqual({
      '289:numero_serie': 'UX289-SERIE-01',
      '289:marca': 'UX289-MARCA',
      '289:modelo': 'UX289-MODELO',
    })
    expect(armaChoque.extrasGdl).toEqual({})
  })

  it('mapeia os campos de PISTOLA e mantém Marca fora do formulário do laWdo', () => {
    const resultado = converterRepB602(validarGdlRep({
      codRep: 1922026,
      numero: 192,
      ano: 2026,
      pecas: [{
        codPeca: 1127750,
        tipoPeca: 'PISTOLA(S)',
        identificacao: 'TAURUS PT99-D',
        quantidade: 2,
        unidadeMedida: 'UNIDADES',
        numeroAnalises: '1',
        examinadoInLoco: false,
        dataEntrada: '13/07/2026',
        lacreEntrada: 'L2312313',
        lacreSaida: 'L789789',
        dataLiberacao: '18/07/2026',
        consumida: 'Não',
        'Nº Série': 'SA56FG4SA5',
        Marca: 'TAURUS',
        Modelo: 'PT99-D',
        Capacidade: '',
        'Marca da Arma': '1316',
        'Status do Número de Série': 'Legível',
        'Calibre Nominal Pistola': '9mm Luger',
        'Tipo Acabamento': 'Cromado',
        'Estado Geral da Arma': 'Regular',
        Funcionamento: 'Eficiente',
        'Fabricação da Arma': 'brasileira',
        'Arma é Institucional?': 'NÃO',
      }],
    }))
    const [pistola] = resultado.camposEspecificos.pecas

    expect(pistola.comuns.dataEntrada).toBe('2026-07-13')
    expect(pistola.comuns.dataLiberacao).toBe('2026-07-18')
    expect(pistola.personalizados).toEqual({
      '104:numero_serie': 'SA56FG4SA5',
      '104:modelo': 'PT99-D',
      '104:capacidade': '',
      '104:marca_arma': 'Taurus',
      '104:status_numero_serie': '20',
      '104:calibre_nominal': '39',
      '104:tipo_acabamento': '44',
      '104:estado_geral': '53',
      '104:funcionamento': '57',
      '104:fabricacao_arma': '63',
      '104:arma_institucional': '98',
    })
    expect(pistola.extrasGdl).toEqual({ Marca: 'TAURUS' })
  })

  it('normaliza Data de Entrada para todos os tipos do catálogo B602', () => {
    const formatosApi = [
      '19/07/2026',
      '19/07/2026 08:30:00',
      '2026-07-19',
      '2026-07-19T08:30:00',
    ]
    const resultado = converterRepB602(validarGdlRep({
      codRep: 1902026,
      numero: 190,
      ano: 2026,
      pecas: CATALOGO_TIPOS_PECA_B602.map((tipo, indice) => ({
        codPeca: 2000 + indice,
        tipoPeca: tipo.label,
        identificacao: `ITEM ${tipo.codigo}`,
        quantidade: 1,
        unidadeMedida: 'UNIDADES',
        numeroAnalises: '1',
        examinadoInLoco: false,
        dataEntrada: formatosApi[indice % formatosApi.length],
        lacreEntrada: '',
        lacreSaida: '',
        dataLiberacao: formatosApi[(indice + 1) % formatosApi.length],
        quantidadeDescricao: `DESCRIÇÃO ${tipo.codigo}`,
        codigoVestigio: `VESTÍGIO-${tipo.codigo}`,
        consumida: 'Não',
        observacao: `OBSERVAÇÃO ${tipo.codigo}`,
      })),
    }))

    expect(resultado.camposEspecificos.pecas).toHaveLength(CATALOGO_TIPOS_PECA_B602.length)
    expect(resultado.camposEspecificos.pecas.map(peca => peca.comuns.dataEntrada))
      .toEqual(CATALOGO_TIPOS_PECA_B602.map(() => '2026-07-19'))
    expect(resultado.camposEspecificos.pecas.map(peca => peca.comuns.dataLiberacao))
      .toEqual(CATALOGO_TIPOS_PECA_B602.map(() => '2026-07-19'))
    expect(resultado.camposEspecificos.pecas.every(peca => (
      peca.comuns.quantidadeDescricao === `DESCRIÇÃO ${peca.tipoCodigo}`
      && peca.comuns.codigoVestigio === `VESTÍGIO-${peca.tipoCodigo}`
      && peca.comuns.observacao === `OBSERVAÇÃO ${peca.tipoCodigo}`
    ))).toBe(true)
    expect(resultado.camposEspecificos.pecas.find(peca => peca.tipoCodigo === '104')?.comuns.dataEntrada)
      .toBe('2026-07-19')
  })

  it('reconhece os labels visuais dos campos comuns sem duplicá-los em extras', () => {
    const resultado = converterRepB602(validarGdlRep({
      codRep: 1922026,
      numero: 192,
      ano: 2026,
      pecas: [{
        codPeca: 3001,
        tipoPeca: 'PISTOLA(S)',
        identificacao: 'PISTOLA COM ALIASES',
        quantidade: 1,
        unidadeMedida: 'UNIDADES',
        numeroAnalises: '1',
        examinadoInLoco: false,
        dataEntrada: '13/07/2026',
        lacreEntrada: '',
        lacreSaida: '',
        consumida: 'Não',
        'Quant. Descrição': 'UMA ARMA',
        'Data de Liberação': '18/07/2026 10:30:00',
        'Código do Vestígio': 'VEST-192',
        Observação: 'OBSERVAÇÃO IMPORTADA',
        Funcionamento: 'Eficiente',
        'Arma é Institucional?': 'NÃO',
      }],
    }))
    const [pistola] = resultado.camposEspecificos.pecas

    expect(pistola.comuns).toMatchObject({
      quantidadeDescricao: 'UMA ARMA',
      dataLiberacao: '2026-07-18',
      codigoVestigio: 'VEST-192',
      observacao: 'OBSERVAÇÃO IMPORTADA',
    })
    expect(pistola.extrasGdl).toEqual({})
  })

  it('preserva BO como tipo de solicitação canônico do GDL', () => {
    const resultado = converterRepB602(validarGdlRep(fixture))

    expect(resultado.camposGerais.tipo_solicitacao).toBe('BO')
    expect(resultado.camposGerais.b602_local_cidade).toBe('LONDRINA')
    expect(resultado.camposGerais.autoridade_solicitante).toBe('AUTORIDADE TESTE')
    expect(resultado.camposGerais.b602_numero_bo).toBe('123/2026')
    expect(resultado.camposGerais.b602_numero_ip).toBe('456/2026')
    expect(resultado.camposGerais.b602_solicitante_nome).toBe('ÓRGÃO TESTE')
    expect(resultado.camposGerais.b602_envolvidos_0).toBe('ENVOLVIDO TESTE')
    expect(resultado.camposGerais.b602_envolvidos_1).toBe('OUTRO ENVOLVIDO')
    expect(resultado.camposEspecificos.dadosSolicitacao).toEqual({
      orgao: 'ÓRGÃO TESTE',
      responsavel: 'RESPONSÁVEL TESTE',
      autoridade: 'AUTORIDADE TESTE',
      origensDisponiveis: [
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

  it('sugere a primeira origem das famílias BO, IP ou OFÍCIO e preserva todas as demais opções', () => {
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
    expect(resultado.camposEspecificos.dadosSolicitacao.origensDisponiveis).toEqual([
      { tipo: 'PROCESSO', numero: '1/2026' },
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
        origensDisponiveis: [
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
        origensDisponiveis: [
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

  it('normaliza envolvidos retornados pela listagem de investigação', () => {
    const resposta = interpretarGdlListaRepsInvestigacaoJson(JSON.stringify({
      dadosREPs: [{ envolvidos: ['VÍTIMA: PESSOA TESTE', 'AUTOR: OUTRA PESSOA'] }],
    }))
    const resultado = converterRepB602(validarGdlRep({
      ...fixture,
      envolvidos: resposta.dadosREPs.map(rep => rep.envolvidos),
    }))

    expect(resultado.camposGerais.b602_envolvidos_qualificacao_0).toBe('VÍTIMA:')
    expect(resultado.camposGerais.b602_envolvidos_0).toBe('PESSOA TESTE')
    expect(resultado.camposGerais.b602_envolvidos_qualificacao_1).toBe('AUTOR:')
    expect(resultado.camposGerais.b602_envolvidos_1).toBe('OUTRA PESSOA')
  })

  it('extrai o ano incorporado ao número da origem para consultar envolvidos', () => {
    const rep = validarGdlRep({
      ...fixture,
      numeroCaso: 321312,
      origens: [{ tipo: 'IP/PM', numero: '212314/2026', ano: '', cidade: 'LONDRINA' }],
    })

    expect(extrairFiltrosParaConsultaInvestigacao(rep)).toEqual([
      { numeroOrigem: '212314', anoOrigem: 2026 },
    ])
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

  it('preserva origens de mesmo tipo quando possuem números diferentes', () => {
    const rep = validarGdlRep({
      ...fixture,
      origens: [
        { tipo: 'BO', numero: '100', ano: 2026, cidade: 'LONDRINA' },
        { tipo: 'BO', numero: '200', ano: 2026, cidade: 'LONDRINA' },
      ],
    })

    const resultado = converterRepB602(rep)

    expect(resultado.camposEspecificos.dadosSolicitacao.origensDisponiveis).toEqual([
      { tipo: 'BO', numero: '100/2026' },
      { tipo: 'BO', numero: '200/2026' },
    ])
  })
})
