import { describe, expect, it } from 'vitest'
import { normalizarApresentacaoTabelas } from '@/lib/tabelas-apresentacao'
import { converterPlaceholdersTextuais } from '@/lib/utils'
import { buildPlaceholderMapping, resolverPlaceholdersExportacao } from '@/lib/exportacao-placeholders'
import { gerarDescricaoAgrupadaB601 } from '@shared/utils/b601-descricao-agrupada'
import { criarDadosB601 } from '@shared/types/b601.types'

function dadosComProjeteis() {
  return { ...criarDadosB601(), pecas: [{
    idLocal: 'projetil-1', origem: 'manual' as const, alteradaLocalmente: false, tipoCodigo: '105', tipoPeca: 'PROJÉTEIS',
    comuns: { identificacao: '', quantidade: 6, unidadeMedida: 'UNIDADES', quantidadeDescricao: '', examinadoInLoco: false,
      dataEntrada: '', lacreEntrada: '', lacreSaida: '', dataLiberacao: '', codigoVestigio: '', consumida: 'N' as const, observacao: '' },
    personalizados: { '105:origem_coleta': '94' }, extrasGdl: {},
  }] }
}

describe('apresentação das tabelas B601', () => {
  it('gera quadros de continuação com PQ01 a PQ06, sombreamento e fonte Arial', () => {
    const doc = new DOMParser().parseFromString(gerarDescricaoAgrupadaB601(dadosComProjeteis(), '105', 'grupo'), 'text/html')
    expect(doc.querySelectorAll('table')).toHaveLength(2)
    expect(Array.from(doc.querySelectorAll('thead th')).map(celula => celula.textContent).filter(texto => texto?.startsWith('PQ'))).toEqual(['PQ01', 'PQ02', 'PQ03', 'PQ04', 'PQ05', 'PQ06'])
    expect(doc.body.textContent).not.toContain('Item 1')
    expect(Array.from(doc.querySelectorAll('table')).every(tabela => tabela.style.fontFamily.startsWith('Arial'))).toBe(true)
    expect(Array.from(doc.querySelectorAll<HTMLElement>('th')).every(celula => Boolean(celula.style.backgroundColor))).toBe(true)
    expect(Array.from(doc.querySelectorAll<HTMLElement>('th, td')).every(celula => celula.style.textAlign === 'center' && celula.style.verticalAlign === 'middle')).toBe(true)
    expect(doc.querySelector('thead th')?.getAttribute('style')).toContain('#d9d9d9')
  })

  it('gera estojos com IDs simples e normaliza os antigos sem alterar marca ou procedência', () => {
    const dados = dadosComProjeteis()
    const estojos = { ...dados, pecas: dados.pecas.map(peca => ({ ...peca, tipoCodigo: '101', tipoPeca: 'ESTOJO(S)', personalizados: { '101:origem_coleta': '95' } })) }
    const gerado = new DOMParser().parseFromString(gerarDescricaoAgrupadaB601(estojos, '101', 'estojos'), 'text/html')
    expect(Array.from(gerado.querySelectorAll('tbody tr > td:first-child')).map(celula => celula.textContent)).toEqual(['01', '02', '03', '04', '05', '06'])
    const antigo = '<div data-b601-grupo="101"><table><thead><tr><th>ID</th><th>Marca</th><th>Procedência</th></tr></thead><tbody><tr><td>01 · Item 1</td><td><strong>Marca preenchida</strong></td><td>DELEGACIA</td></tr></tbody></table></div>'
    const exportado = resolverPlaceholdersExportacao(antigo, { repData: {} })
    const doc = new DOMParser().parseFromString(exportado, 'text/html')
    expect(doc.querySelector('tbody td')?.textContent).toBe('01')
    expect(doc.querySelector('strong')?.textContent).toBe('Marca preenchida')
    expect(doc.body.textContent).toContain('DELEGACIA')
    expect(Array.from(doc.querySelectorAll<HTMLElement>('th, td')).every(celula => celula.style.textAlign === 'center' && celula.style.verticalAlign === 'middle')).toBe(true)
  })

  it('padroniza tabelas existentes sem recriar preenchimentos, assinatura ou figuras', () => {
    const html = '<div data-b601-grupo="105" data-b601-assinatura="original"><table><thead><tr><th colspan="2">TABELA 3</th></tr><tr><th>Características</th><th>PQ01 · Item 2</th></tr></thead><tbody><tr><th>Massa</th><td><strong>8,5 g preenchidos</strong></td></tr></tbody></table></div><div data-b601-complemento="true"><figure><img src="foto.png"><figcaption>Legenda preenchida</figcaption></figure></div>'
    const doc = new DOMParser().parseFromString(converterPlaceholdersTextuais(html, []), 'text/html')
    const antes = doc.body.innerHTML
    normalizarApresentacaoTabelas(doc.body)
    expect(doc.body.innerHTML).toBe(antes)
    expect(doc.querySelector('td')?.innerHTML).toBe('<strong>8,5 g preenchidos</strong>')
    expect(doc.querySelector('[data-b601-grupo]')?.getAttribute('data-b601-assinatura')).toBe('original')
    expect(doc.querySelector('figcaption')?.textContent).toBe('Legenda preenchida')
    const exportado = resolverPlaceholdersExportacao(html, { repData: {} })
    expect(exportado).not.toContain('Item 2')
    expect(exportado).toContain('PQ01')
    expect(exportado).toContain('8,5 g preenchidos')
  })

  it('define fonte nas duas tabelas dos placeholders B601 e corrige tabelas personalizadas antigas', () => {
    const mapa = buildPlaceholderMapping({ repData: { campos_especificos: JSON.stringify({ b601: dadosComProjeteis() }) } })
    for (const chave of ['b601_tabela_dados_investigacao', 'b601_tabela_material_enc']) {
      const doc = new DOMParser().parseFromString(mapa[chave], 'text/html')
      expect(doc.querySelector('table')?.style.fontFamily.startsWith('Arial')).toBe(true)
    }
    const html = '<code><div data-placeholder-tabela-personalizada="true"><table><tr><td>Conteúdo preservado</td></tr></table></div></code>'
    const doc = new DOMParser().parseFromString(resolverPlaceholdersExportacao(html, { repData: {} }), 'text/html')
    expect(doc.querySelector('table')?.style.fontFamily.startsWith('Arial')).toBe(true)
    expect(doc.querySelector('td')?.textContent).toBe('Conteúdo preservado')
  })
})
