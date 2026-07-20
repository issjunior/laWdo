import { describe, expect, it } from 'vitest'
import {
  CATALOGO_TIPOS_PECA_B602,
  OPCOES_UNIDADE_MEDIDA_B602,
  pecaB602EstaCompleta,
  UNIDADE_MEDIDA_PADRAO_B602,
  validarCatalogoTiposPecaB602,
} from '../../shared/catalogos/b602-gdl.catalogo'

describe('catálogo B602', () => {
  it('possui exatamente os 16 códigos mapeados, sem PEÇA TESTE nem código zero', () => {
    const codigos = CATALOGO_TIPOS_PECA_B602.map(tipo => tipo.codigo)
    expect(codigos).toHaveLength(16)
    expect(new Set(codigos).size).toBe(16)
    expect(codigos).not.toContain('0')
    expect(codigos).not.toContain('771')
    expect(() => validarCatalogoTiposPecaB602()).not.toThrow()
  })

  it('rejeita IDs e opções duplicados na validação estrutural', () => {
    const catalogoInvalido = structuredClone(CATALOGO_TIPOS_PECA_B602)
    catalogoInvalido[0].campos[1].id = catalogoInvalido[0].campos[0].id

    expect(() => validarCatalogoTiposPecaB602(catalogoInvalido)).toThrow('ID de campo B602 inválido ou duplicado')
  })

  it('marca como round-trip confirmado somente os tipos validados por API, persistência e reabertura', () => {
    const confirmados = CATALOGO_TIPOS_PECA_B602.filter(tipo => tipo.roundTripConfirmado).map(tipo => tipo.codigo)
    expect(confirmados).toEqual([
      '289', '613', '476', '272', '472', '473', '101', '477',
      '475', '178', '104', '478', '572', '105', '106', '479',
    ])
  })

  it('reproduz os controles de texto e limites visuais de ARMA(S) DE CHOQUE', () => {
    const armaChoque = CATALOGO_TIPOS_PECA_B602.find(tipo => tipo.codigo === '289')

    expect(armaChoque?.campos).toEqual([
      expect.objectContaining({ id: '289:numero_serie', controle: 'texto', obrigatorio: false, maxLength: 25, mapeamentoApiConfirmado: true }),
      expect.objectContaining({ id: '289:marca', controle: 'texto', obrigatorio: false, maxLength: 50, mapeamentoApiConfirmado: true }),
      expect.objectContaining({ id: '289:modelo', controle: 'texto', obrigatorio: false, maxLength: 50, mapeamentoApiConfirmado: true }),
    ])
  })

  it('reproduz os controles de texto e limites visuais de ARMA(S) DE PRESSÃO', () => {
    const armaPressao = CATALOGO_TIPOS_PECA_B602.find(tipo => tipo.codigo === '613')

    expect(armaPressao?.campos).toEqual([
      expect.objectContaining({ id: '613:numero_serie', controle: 'texto', obrigatorio: false, maxLength: 25 }),
      expect.objectContaining({ id: '613:marca', controle: 'texto', obrigatorio: false, maxLength: 50 }),
      expect.objectContaining({ id: '613:modelo', controle: 'texto', obrigatorio: false, maxLength: 50 }),
    ])
  })

  it('mantém o catálogo visual de medidas e o preenchimento padrão do GDL', () => {
    expect(UNIDADE_MEDIDA_PADRAO_B602).toBe('UNIDADES')
    expect(OPCOES_UNIDADE_MEDIDA_B602).toEqual([
      { codigo: '1', label: 'HECTARE' },
      { codigo: '2', label: 'm2' },
      { codigo: '3', label: 'GRAMAS(g)' },
      { codigo: '5', label: 'MILILITROS(ml)' },
      { codigo: '6', label: 'QUILOGRAMAS(Kg)' },
      { codigo: '8', label: 'UNIDADES' },
      { codigo: '10', label: 'PORÇÃO' },
      { codigo: '11', label: 'AMOSTRA' },
    ])
  })

  it('reflete a reinspeção visual de GARRUCHA e PISTOLETE', () => {
    const garrucha = CATALOGO_TIPOS_PECA_B602.find(tipo => tipo.codigo === '475')
    const pistolete = CATALOGO_TIPOS_PECA_B602.find(tipo => tipo.codigo === '478')

    expect(garrucha?.campos.map(campo => campo.label)).toEqual([
      'Nº Série', 'Marca', 'Modelo', 'Fabricação da Arma',
    ])
    expect(garrucha?.campos.slice(0, 3).map(campo => campo.maxLength)).toEqual([25, 50, 50])
    expect(pistolete?.campos).toEqual([])
  })

  it('reflete a reinspeção visual de CARREGADOR, OUTROS e PROJÉTEIS', () => {
    const carregador = CATALOGO_TIPOS_PECA_B602.find(tipo => tipo.codigo === '272')
    const outros = CATALOGO_TIPOS_PECA_B602.find(tipo => tipo.codigo === '178')
    const projeteis = CATALOGO_TIPOS_PECA_B602.find(tipo => tipo.codigo === '105')

    expect(carregador?.campos).toEqual([])
    expect(outros?.campos).toEqual([])
    expect(projeteis?.campos).toEqual([
      expect.objectContaining({
        id: '105:origem_coleta',
        label: 'ORIGEM/COLETA',
        controle: 'select',
        obrigatorio: true,
        mapeamentoApiConfirmado: true,
        opcoes: [
          { codigo: '95', label: 'DELEGACIA' },
          { codigo: '93', label: 'LOCAL DE CRIME' },
          { codigo: '94', label: 'NECRÓPSIA' },
          { codigo: '11', label: 'Outro' },
        ],
      }),
    ])
  })

  it('reproduz todos os campos e opções observados de PISTOLA sem mapear Marca', () => {
    const pistola = CATALOGO_TIPOS_PECA_B602.find(tipo => tipo.codigo === '104')

    expect(pistola?.campos.map(campo => campo.label)).toEqual([
      'Nº Série', 'Modelo', 'Capacidade', 'Marca da Arma', 'Status do Número de Série',
      'Calibre Nominal Pistola', 'Tipo Acabamento', 'Estado Geral da Arma',
      'Funcionamento', 'Fabricação da Arma', 'Arma é Institucional?',
    ])
    expect(pistola?.campos.some(campo => campo.label === 'Marca')).toBe(false)
    expect(pistola?.campos.slice(0, 3).map(campo => campo.maxLength)).toEqual([25, 50, 50])

    const marcaArma = pistola?.campos.find(campo => campo.id === '104:marca_arma')
    expect(marcaArma).toMatchObject({ controle: 'combobox', obrigatorio: false })
    expect(marcaArma?.opcoes).toHaveLength(1379)
    expect(marcaArma?.opcoes).toContainEqual({ codigo: '1316', label: 'Taurus' })

    expect(pistola?.campos.find(campo => campo.id === '104:status_numero_serie')?.opcoes).toEqual([
      { codigo: '19', label: 'Ilegível' },
      { codigo: '20', label: 'Legível' },
      { codigo: '10', label: 'Não Aparente' },
      { codigo: '22', label: 'Revelado' },
      { codigo: '21', label: 'Suprimido intencionalmente' },
    ])
    expect(pistola?.campos.find(campo => campo.id === '104:calibre_nominal')?.opcoes)
      .toContainEqual({ codigo: '39', label: '9mm Luger' })
    expect(pistola?.campos.find(campo => campo.id === '104:tipo_acabamento')?.opcoes)
      .toContainEqual({ codigo: '44', label: 'Cromado' })
    expect(pistola?.campos.find(campo => campo.id === '104:estado_geral')?.opcoes)
      .toContainEqual({ codigo: '53', label: 'Regular' })
    expect(pistola?.campos.find(campo => campo.id === '104:funcionamento')).toMatchObject({
      controle: 'select', obrigatorio: true,
      opcoes: [
        { codigo: '57', label: 'Eficiente' },
        { codigo: '56', label: 'Ineficiente' },
        { codigo: '100', label: 'NÃO TESTADO' },
      ],
    })
  })

  it('reproduz os 12 campos e opções observados de REVÓLVER', () => {
    const revolver = CATALOGO_TIPOS_PECA_B602.find(tipo => tipo.codigo === '106')

    expect(revolver?.campos.map(campo => campo.label)).toEqual([
      'Nº Série', 'Marca', 'Modelo', 'Marca da Arma', 'Status do Número de Série',
      'Calibre Nominal Revolver', 'Tipo Acabamento', 'Estado Geral da Arma',
      'Funcionamento', 'Fabricação da Arma', 'Tambor', 'Arma é Institucional?',
    ])
    expect(revolver?.campos.slice(0, 3).map(campo => campo.maxLength)).toEqual([25, 50, 50])
    expect(revolver?.campos.find(campo => campo.id === '106:marca_arma')).toMatchObject({
      controle: 'combobox', obrigatorio: false, mapeamentoApiConfirmado: true,
    })
    expect(revolver?.campos.find(campo => campo.id === '106:tipo_acabamento')).toMatchObject({
      controle: 'select', obrigatorio: false, mapeamentoApiConfirmado: true,
      opcoes: expect.arrayContaining([{ codigo: '44', label: 'Cromado' }]),
    })
    expect(revolver?.campos.find(campo => campo.id === '106:calibre_nominal')?.opcoes).toEqual([
      { codigo: '24', label: '.22 Curto' },
      { codigo: '23', label: '.22LR' },
      { codigo: '25', label: '.32S&W' },
      { codigo: '28', label: '.357 Magnum' },
      { codigo: '26', label: '.38SPL' },
      { codigo: '27', label: '38 Curto' },
    ])
    expect(revolver?.campos.find(campo => campo.id === '106:tambor')?.opcoes).toEqual([
      { codigo: '72', label: 'reversível para a direita' },
      { codigo: '73', label: 'reversível para a esquerda' },
    ])
  })

  it('reproduz os 12 campos e calibres observados de ESPINGARDA', () => {
    const espingarda = CATALOGO_TIPOS_PECA_B602.find(tipo => tipo.codigo === '472')

    expect(espingarda?.campos.map(campo => campo.label)).toEqual([
      'Nº Série', 'Marca', 'Modelo', 'Capacidade', 'Marca da Arma',
      'Status do Número de Série', 'Calibre Nominal Espingarda', 'Tipo Acabamento',
      'Estado Geral da Arma', 'Funcionamento', 'Fabricação da Arma', 'Arma é Institucional?',
    ])
    expect(espingarda?.campos.slice(0, 4).map(campo => campo.maxLength)).toEqual([25, 50, 50, 50])
    expect(espingarda?.campos.find(campo => campo.id === '472:marca_arma')).toMatchObject({
      controle: 'combobox', obrigatorio: false,
    })
    expect(espingarda?.campos.find(campo => campo.id === '472:calibre_nominal')?.opcoes).toEqual([
      { codigo: '29', label: '12GA' },
      { codigo: '30', label: '16GA' },
      { codigo: '31', label: '20GA' },
      { codigo: '32', label: '24GA' },
      { codigo: '33', label: '28GA' },
      { codigo: '34', label: '32GA' },
      { codigo: '35', label: '36GA' },
      { codigo: '36', label: '40GA' },
    ])
  })

  it('reproduz os checkboxes exclusivos de arma institucional', () => {
    for (const codigo of ['104', '106', '472', '476', '477', '479']) {
      const campo = CATALOGO_TIPOS_PECA_B602
        .find(tipo => tipo.codigo === codigo)?.campos
        .find(item => item.id === `${codigo}:arma_institucional`)

      expect(campo).toMatchObject({
        controle: 'checkbox',
        obrigatorio: true,
        opcoes: [
          { codigo: '60', label: 'Indeterminado' },
          { codigo: '98', label: 'Não' },
          { codigo: '97', label: 'Sim' },
        ],
      })
    }
  })

  it('exige os campos personalizados obrigatórios na completude', () => {
    expect(pecaB602EstaCompleta({ tipoCodigo: '476', comuns: { quantidade: 1 }, personalizados: {} })).toBe(false)
    expect(pecaB602EstaCompleta({ tipoCodigo: '476', comuns: { quantidade: 1 }, personalizados: { '476:arma_institucional': '60' } })).toBe(true)
  })

  it('permite concluir manualmente cada um dos 16 tipos com seus obrigatórios preenchidos', () => {
    for (const tipo of CATALOGO_TIPOS_PECA_B602) {
      const obrigatorios = tipo.campos.filter(campo => campo.obrigatorio)
      const personalizados = Object.fromEntries(obrigatorios.map(campo => [
        campo.id,
        campo.opcoes?.[0]?.codigo ?? 'VALOR TESTE',
      ]))

      expect(pecaB602EstaCompleta({
        tipoCodigo: tipo.codigo,
        comuns: { quantidade: 1 },
        personalizados,
      }), tipo.label).toBe(true)

      for (const campoOmitido of obrigatorios) {
        const semObrigatorio = { ...personalizados }
        delete semObrigatorio[campoOmitido.id]

        expect(pecaB602EstaCompleta({
          tipoCodigo: tipo.codigo,
          comuns: { quantidade: 1 },
          personalizados: semObrigatorio,
        }), `${tipo.label}: ${campoOmitido.label}`).toBe(false)
      }
    }
  })
})
