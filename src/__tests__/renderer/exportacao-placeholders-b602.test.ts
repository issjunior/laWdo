import { describe, expect, it } from 'vitest'
import { buildPlaceholderMapping, construirMapaPlaceholdersResolvidos, resolverPlaceholdersExportacao } from '@/lib/exportacao-placeholders'
import { CAMPOS_ESPECIFICOS_PLACEHOLDERS } from '@/components/rep/exam-fields/placeholders'
import { laudoPadraoB602V9 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v9'
import { laudoPadraoB602V11 } from '../../main/templates/integrados/b602/laudo-padrao-b602.v11'

describe('placeholders B602 canônicos', () => {
  it.each([
    { quantidades: ['1'], total: '1', extenso: 'um', descricao: 'cartucho, próprio para uso em armas de fogo, integralmente descrito no quadro a seguir:' },
    { quantidades: ['1', '1'], total: '2', extenso: 'dois', descricao: 'cartuchos, próprios para uso em armas de fogo, integralmente descritos no quadro a seguir:' },
    { quantidades: [], total: '0', extenso: 'zero', descricao: 'cartuchos, próprios para uso em armas de fogo, integralmente descritos no quadro a seguir:' },
  ])('ajusta a descrição dos cartuchos para o total $total', ({ quantidades, total, extenso, descricao }) => {
    const contexto = { repData: { campos_especificos: JSON.stringify({ b602: {
      cartuchos: quantidades.map(quantidade => ({ quantidade })),
    } }) } }
    const conteudo = laudoPadraoB602V11.secoes.find(secao => secao.chave === 'dos-cartuchos')!.conteudo
    const html = resolverPlaceholdersExportacao(conteudo, contexto)
    const documento = new DOMParser().parseFromString(html, 'text/html')
    expect(documento.querySelector('p')?.textContent).toBe(`Trata-se de ${extenso} ${descricao}`)
    const mapa = buildPlaceholderMapping(contexto)
    expect(mapa.b602_total_cartuchos).toBe(total)
    expect(mapa.b602_total_cartuchos_extenso).toBe(extenso)
    expect(construirMapaPlaceholdersResolvidos(contexto).b602_cartuchos_descricao.valor).toBe(descricao)
    expect(CAMPOS_ESPECIFICOS_PLACEHOLDERS.find(campo => campo.chave === 'b602_total_cartuchos_extenso')).toMatchObject({ computed: true })
    expect(CAMPOS_ESPECIFICOS_PLACEHOLDERS.find(campo => campo.chave === 'b602_cartuchos_descricao')).toMatchObject({ computed: true })
  })

  it.each([
    { quantidades: ['1'], total: '1', inicio: 'Trata-se de um estojo proveniente', descricao: 'integralmente descrito no quadro a seguir:', conclusao: 'O estojo percutido e deflagrado foi retornado', embalagem: 'devidamente embalado,', final: 'encontra-se ineficiente ao fim a que se destina.' },
    { quantidades: ['1', '1'], total: '2', inicio: 'Trata-se de dois estojos provenientes', descricao: 'integralmente descritos no quadro a seguir:', conclusao: 'Os estojos percutidos e deflagrados foram retornados', embalagem: 'devidamente embalados,', final: 'encontram-se ineficientes ao fim a que se destinam.' },
    { quantidades: [], total: '0', inicio: 'Trata-se de zero estojos provenientes', descricao: 'integralmente descritos no quadro a seguir:', conclusao: 'Os estojos percutidos e deflagrados foram retornados', embalagem: 'devidamente embalados,', final: 'encontram-se ineficientes ao fim a que se destinam.' },
  ])('ajusta os dois parágrafos do template para o total $total', ({ quantidades, total, inicio, descricao, conclusao, embalagem, final }) => {
    const contexto = { repData: { campos_especificos: JSON.stringify({ b602: {
      estojos: quantidades.map(quantidade => ({ quantidade })),
    } }) } }
    const conteudo = laudoPadraoB602V9.secoes.find(secao => secao.chave === 'dos-estojos')!.conteudo
    const html = resolverPlaceholdersExportacao(conteudo, contexto)
    const documento = new DOMParser().parseFromString(html, 'text/html')
    expect(documento.querySelector('p')?.textContent).toBe(`${inicio} de munição própria para uso em armas de fogo, ${descricao}`)
    expect(documento.body.lastElementChild?.textContent).toBe(`${conclusao} à Central de Custódia, ${embalagem} garantindo a integridade das marcas de percussão para futuros exames de comparação microbalística, prestando ainda como prova material de disparo de arma de fogo. Diante da sua deflagração, ${final}`)
    expect(buildPlaceholderMapping(contexto).b602_total_estojos).toBe(total)
    const visualizacao = construirMapaPlaceholdersResolvidos(contexto)
    expect(visualizacao.b602_estojos_descricao.valor).toContain(descricao)
    expect(visualizacao.b602_estojos_conclusao.valor).toContain(final)
  })

  it.each([
    { quantidades: [], numero: '0', extenso: 'zero' },
    { quantidades: ['2'], numero: '2', extenso: 'dois' },
    { quantidades: ['10', '11'], numero: '21', extenso: 'vinte e um' },
  ])('resolve o total $numero sem alterar o placeholder numérico', ({ quantidades, numero, extenso }) => {
    const contexto = { repData: { campos_especificos: JSON.stringify({ b602: {
      estojos: quantidades.map(quantidade => ({ quantidade })),
    } }) } }
    const mapa = buildPlaceholderMapping(contexto)
    expect(mapa.b602_total_estojos).toBe(numero)
    expect(mapa.b602_total_estojos_extenso).toBe(extenso)
    expect(construirMapaPlaceholdersResolvidos(contexto).b602_total_estojos_extenso).toMatchObject({ valor: extenso, preenchido: true })
    expect(resolverPlaceholdersExportacao('Trata-se de {{b602_total_estojos_extenso}} estojos. Total: {{b602_total_estojos}}.', contexto))
      .toBe(`Trata-se de ${extenso} estojos. Total: ${numero}.`)
    expect(CAMPOS_ESPECIFICOS_PLACEHOLDERS.find(campo => campo.chave === 'b602_total_estojos_extenso')).toMatchObject({ computed: true })
  })

  it('formata a data da ocorrência da tabela de investigação no padrão brasileiro', () => {
    const resultado = resolverPlaceholdersExportacao('{{b602_tabela_dados_investigacao}}', {
      repData: {
        campos_especificos: JSON.stringify({
          b602: { data_ocorrencia: '2026-07-20' },
        }),
      },
    })

    expect(resultado).toContain('20/07/2026')
    expect(resultado).not.toContain('2026-07-20')
  })

  it('resolve dados da solicitação preservados pela integração GDL', () => {
    const camposEspecificos = {
      b602: { solicitante_nome: 'INSTITUTO SOLICITANTE' },
      integracaoGdl: {
        origemInicial: 'gdl',
        dadosSolicitacao: {
          orgao: 'ÓRGÃO GDL',
          responsavel: 'RESPONSÁVEL',
          autoridade: 'AUTORIDADE GDL',
          origensDisponiveis: [],
        },
      },
    }
    const html = [
      '<span data-placeholder="{{data_solicitacao_rep}}">{{data_solicitacao_rep}}</span>',
      '<span data-placeholder="{{solicitante_nome}}">{{solicitante_nome}}</span>',
      '<span data-placeholder="{{autoridade_solicitante_rep}}">{{autoridade_solicitante_rep}}</span>',
    ].join(' | ')

    const resultado = resolverPlaceholdersExportacao(html, {
      repData: {
        data_documento: '2026-07-20',
        campos_especificos: JSON.stringify(camposEspecificos),
      },
    })

    expect(resultado).toContain('20/07/2026 | INSTITUTO SOLICITANTE | AUTORIDADE GDL')
    expect(resultado).not.toContain('{{')
  })

  it('resolve placeholders e tabela de armas diretamente de b602.pecas', () => {
    const camposEspecificos = {
      b602: {
        pecas: [{
          idLocal: 'arma-1',
          origem: 'gdl',
          alteradaLocalmente: false,
          tipoCodigo: '104',
          tipoPeca: 'PISTOLA(S)',
          comuns: {
            identificacao: 'Pistola apreendida',
            quantidade: 1,
            unidadeMedida: 'UNIDADES',
            quantidadeDescricao: '',
            examinadoInLoco: false,
            materialIncinerado: 'N',
            dataEntrada: '',
            lacreEntrada: 'LACRE-1',
            lacreSaida: '',
            dataLiberacao: '',
            codigoVestigio: '',
            consumida: 'N',
            observacao: '',
          },
          personalizados: {
            '104:marca_arma': '2',
            '104:modelo': 'G3',
            '104:calibre_nominal': '9mm Luger',
            '104:numero_serie': 'ABC123',
            '104:funcionamento': 'Eficiente',
          },
          extrasGdl: {},
        }],
      },
    }

    const resultado = resolverPlaceholdersExportacao(
      '<p>{{b602_arma_1_tipo}} | {{b602_arma_1_marca}} | {{b602_total_armas}}</p>{{b602_tabela_armas}}',
      { repData: { campos_especificos: JSON.stringify(camposEspecificos) } },
    )

    expect(resultado).toContain('PISTOLA(S) | Taurus | 1')
    expect(resultado).toContain('TABELA 5 – ARMAS')
    expect(resultado).toContain('ABC123')
    expect(resultado).not.toContain('{{b602_')
    const documento = new DOMParser().parseFromString(resultado, 'text/html')
    expect(documento.querySelector('table')?.getAttribute('width')).toBe('100%')
  })

  it('exibe o rótulo da origem do estojo em vez do código GDL', () => {
    const camposEspecificos = {
      b602: {
        pecas: [{
          idLocal: 'estojo-1',
          origem: 'gdl',
          alteradaLocalmente: false,
          tipoCodigo: '101',
          tipoPeca: 'ESTOJO(S)',
          comuns: {
            identificacao: '9 MM LUGER', quantidade: 4, unidadeMedida: 'UNIDADES',
            quantidadeDescricao: '', examinadoInLoco: false, materialIncinerado: 'N',
            dataEntrada: '', lacreEntrada: '', lacreSaida: '', dataLiberacao: '',
            codigoVestigio: '', consumida: 'N', observacao: '',
          },
          personalizados: { '101:origem_coleta': '94' },
          extrasGdl: {},
        }],
      },
    }

    const resultado = resolverPlaceholdersExportacao('<p><span data-placeholder="{{b602_tabela_estojos}}">{{b602_tabela_estojos}}</span></p>', {
      repData: { campos_especificos: JSON.stringify(camposEspecificos) },
    })

    expect(resultado).toContain('NECRÓPSIA')
    expect(resultado).toContain('>04</td>')
    expect(resultado).not.toMatch(/>94</)
    const documento = new DOMParser().parseFromString(resultado, 'text/html')
    const tabela = documento.querySelector('table')
    expect([...documento.querySelectorAll('td')].every(celula => celula.style.textAlign === 'center')).toBe(true)
    expect(tabela?.parentElement?.tagName).not.toBe('P')
    expect(tabela?.getAttribute('width')).toBe('100%')
    expect(tabela?.style.width).toBe('100%')
  })

  it('não exporta o botão visual de supressão do bloco pericial', () => {
    const resultado = resolverPlaceholdersExportacao(
      '<div data-bloco-pericial="funcionamento"><button data-acao-suprimir-bloco="true">×</button><p>Texto pericial</p></div>',
      { repData: {} },
    )

    expect(resultado).not.toContain('data-acao-suprimir-bloco')
    expect(resultado).toContain('Texto pericial')
  })
})
