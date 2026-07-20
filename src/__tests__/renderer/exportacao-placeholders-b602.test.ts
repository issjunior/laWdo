import { describe, expect, it } from 'vitest'
import { resolverPlaceholdersExportacao } from '@/lib/exportacao-placeholders'

describe('placeholders B602 canônicos', () => {
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
            '104:marca_arma': 'Taurus',
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

    const resultado = resolverPlaceholdersExportacao('{{b602_tabela_estojos}}', {
      repData: { campos_especificos: JSON.stringify(camposEspecificos) },
    })

    expect(resultado).toContain('NECRÓPSIA')
    expect(resultado).toContain('>04</td>')
    expect(resultado).not.toMatch(/>94</)
    const documento = new DOMParser().parseFromString(resultado, 'text/html')
    expect([...documento.querySelectorAll('td')].every(celula => celula.style.textAlign === 'center')).toBe(true)
  })
})
