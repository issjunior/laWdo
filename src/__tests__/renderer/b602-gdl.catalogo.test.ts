import { describe, expect, it } from 'vitest'
import {
  CATALOGO_TIPOS_PECA_B602,
  OPCOES_UNIDADE_MEDIDA_B602,
  pecaB602EstaCompleta,
  UNIDADE_MEDIDA_PADRAO_B602,
} from '../../shared/catalogos/b602-gdl.catalogo'

describe('catálogo B602', () => {
  it('possui exatamente os 17 códigos únicos e não contém zero', () => {
    const codigos = CATALOGO_TIPOS_PECA_B602.map(tipo => tipo.codigo)
    expect(codigos).toHaveLength(17)
    expect(new Set(codigos).size).toBe(17)
    expect(codigos).not.toContain('0')
  })

  it('mantém somente CARABINA e ESTOJO como round-trip confirmado', () => {
    const confirmados = CATALOGO_TIPOS_PECA_B602.filter(tipo => tipo.roundTripConfirmado).map(tipo => tipo.codigo)
    expect(confirmados).toEqual(['476', '101'])
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

  it('reproduz os checkboxes exclusivos de arma institucional', () => {
    for (const codigo of ['104', '476', '477', '479']) {
      const campo = CATALOGO_TIPOS_PECA_B602
        .find(tipo => tipo.codigo === codigo)?.campos
        .find(item => item.id === `${codigo}:arma_institucional`)

      expect(campo).toMatchObject({
        controle: 'checkbox',
        obrigatorio: true,
        opcoes: [
          { codigo: '60', label: 'Indeterminado' },
          { codigo: '98', label: 'NÃO' },
          { codigo: '97', label: 'SIM' },
        ],
      })
    }
  })

  it('exige os campos personalizados obrigatórios na completude', () => {
    expect(pecaB602EstaCompleta({ tipoCodigo: '476', comuns: { quantidade: 1 }, personalizados: {} })).toBe(false)
    expect(pecaB602EstaCompleta({ tipoCodigo: '476', comuns: { quantidade: 1 }, personalizados: { '476:arma_institucional': '60' } })).toBe(true)
  })
})
