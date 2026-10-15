import { DomUtils, parseDocument } from 'htmlparser2'
import type { SecaoTemplateRow } from '../types/database.js'
import { projetarB601ParaLaudo } from '../../shared/utils/b601-pecas-projecao.js'
import { assinaturaDescricaoB601, ehAgrupamentoB601, gerarDescricaoAgrupadaB601 } from '../../shared/utils/b601-descricao-agrupada.js'

const escapar = (valor: string): string => valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function separarComplemento(html: string) {
  const documento = parseDocument(html)
  const complementos = DomUtils.findAll(item => Boolean(item.attribs['data-b601-complemento']), documento.children)
    .filter(item => {
      for (let pai = item.parent; pai; pai = pai.parent) {
        if ('attribs' in pai && (pai.attribs['data-b601-complemento'] || pai.attribs['data-b601-revisao-secao'])) return false
      }
      return true
    })
  const complemento = complementos.map(item => DomUtils.getOuterHTML(item)).join('\n')
  complementos.forEach(item => DomUtils.removeElement(item))
  return { descricao: DomUtils.getOuterHTML(documento), complemento }
}

function identificarFigurasB601(html: string, prefixo: string): string {
  const documento = parseDocument(html)
  const figuras = DomUtils.findAll(item => item.name === 'figure' && item.attribs['data-dummy'] === 'true', documento.children)
  figuras.forEach((figura, indice) => { figura.attribs['data-image-id'] = `dummy-b601-${prefixo}-${indice + 1}` })
  return DomUtils.getOuterHTML(documento)
}

export function preservarComplementoB601(htmlBase: string, htmlAtual: string): string {
  const base = separarComplemento(htmlBase)
  const atual = separarComplemento(htmlAtual)
  const documento = parseDocument(atual.descricao)
  const possuiDescricao = documento.children.some(item => 'attribs' in item
    && (item.attribs['data-b601-grupo'] || item.attribs['data-repeat-group'] === 'b601_pecas'))
  const anteriores = possuiDescricao ? documento.children.filter(item => 'attribs' in item
    && !item.attribs['data-b601-grupo'] && item.attribs['data-repeat-group'] !== 'b601_pecas'
    && !item.attribs['data-b601-revisao-secao']).map(item => DomUtils.getOuterHTML(item))
    .filter(html => !base.descricao.includes(html)) : []
  return [base.descricao, ...anteriores, atual.complemento].filter(Boolean).join('\n')
}

export function ehRepeticaoB601(valor?: string | null): boolean {
  return /^b601_pecas(?::\d+)?$/.test(valor || '') || ehAgrupamentoB601(valor)
}

export function expandirSecaoB601(secao: SecaoTemplateRow, secoes: SecaoTemplateRow[], dados: unknown): string {
  if (!dados) return ''
  const { descricao, complemento } = separarComplemento(secao.conteudo || '')
  const final = identificarFigurasB601(complemento, `${secao.id}-complemento`)
  if (ehAgrupamentoB601(secao.repetir_para)) {
    const tipo = secao.repetir_para?.split(':')[1] === '105' ? '105' : '101'
    const gerado = gerarDescricaoAgrupadaB601(dados, tipo, secao.id)
    return gerado ? [gerado, final].filter(Boolean).join('\n') : ''
  }
  const projecao = projetarB601ParaLaudo(dados)
  const tipo = secao.repetir_para?.split(':')[1]
  const tiposComModelo = new Set(secoes.filter(item => /^b601_pecas:\d+$/.test(item.repetir_para || ''))
    .map(item => item.repetir_para?.split(':')[1]).filter(Boolean))
  const agrupados = new Set(secoes.filter(item => ehAgrupamentoB601(item.repetir_para)).map(item => item.repetir_para?.split(':')[1]))
  const pecas = projecao.pecas.filter(peca => tipo ? peca.tipoCodigo === tipo
    : !tiposComModelo.has(peca.tipoCodigo) && !agrupados.has(peca.tipoCodigo))
  if (!pecas.length) return ''
  const partes = pecas.map(peca => {
    const substituirIndice = (html: string): string => html.replace(/b601_peca_1_/g, `b601_peca_${peca.indice}_`)
    const titulo = substituirIndice(secao.repetir_titulo || 'PEÇA {{b601_peca_1_letra}} — {{b601_peca_1_tipo}}')
    const conteudo = identificarFigurasB601(substituirIndice(descricao), `${secao.id}-peca-${peca.idLocal}`)
    return `<div data-b601-peca="${escapar(peca.idLocal)}" data-b601-indice="${peca.indice}"><h4 data-b601-titulo="true">${escapar(titulo)}</h4>\n${conteudo}</div>`
  })
  return `<div data-repeat-group="b601_pecas" data-repeat-owner="${escapar(secao.id)}" data-b601-itens="${escapar(JSON.stringify(pecas.map(peca => peca.idLocal)))}">${partes.join('\n')}</div>${final}`
}

export function preservarDescricaoAgrupadaB601(htmlBase: string, htmlAtual: string): string {
  const base = parseDocument(htmlBase)
  const atual = parseDocument(htmlAtual)
  for (const grupo of DomUtils.findAll(item => Boolean(item.attribs['data-b601-grupo']), base.children)) {
    const anterior = DomUtils.findOne(item => item.attribs['data-b601-grupo'] === grupo.attribs['data-b601-grupo']
      && item.attribs['data-repeat-owner'] === grupo.attribs['data-repeat-owner'], atual.children)
    if (anterior) DomUtils.replaceElement(grupo, parseDocument(DomUtils.getOuterHTML(anterior)).children[0])
  }
  return DomUtils.getOuterHTML(base)
}

export function criarRevisaoSecaoB601(id: string, htmlAnterior: string, htmlBase: string): string {
  const anterior = parseDocument(htmlAnterior)
  const base = parseDocument(htmlBase)
  const idsMovidos = new Set(DomUtils.findAll(item => Boolean(item.attribs['data-b601-peca']), base.children)
    .map(item => item.attribs['data-b601-peca']))
  for (const item of DomUtils.findAll(elemento => idsMovidos.has(elemento.attribs['data-b601-peca']), anterior.children)) DomUtils.removeElement(item)
  for (const grupo of DomUtils.findAll(item => item.attribs['data-repeat-group'] === 'b601_pecas', anterior.children)) {
    if (!DomUtils.getText(grupo).trim()) DomUtils.removeElement(grupo)
  }
  for (const bloco of DomUtils.findAll(item => (item.attribs['data-cond-bloco'] || '').startsWith('b601_'), anterior.children)) {
    delete bloco.attribs['data-cond-bloco']
  }
  if (!DomUtils.textContent(anterior).replace(/\u00a0/g, ' ').trim() && !DomUtils.findOne(item => ['table', 'figure', 'img'].includes(item.name), anterior.children)) return ''
  return `<div data-b601-revisao-secao="${escapar(id)}"><p><strong>Conteúdo preservado para revisão: a seção deixou de atender à condição dos materiais da REP.</strong> <span class="campo-reservado" data-reservado="true">XXX</span></p>${DomUtils.getOuterHTML(anterior)}</div>`
}

export function preservarRevisoesB601(htmlBase: string, htmlAtual: string): string {
  const base = parseDocument(htmlBase)
  const atual = parseDocument(htmlAtual)
  const ids = new Set(DomUtils.findAll(item => Boolean(item.attribs['data-b601-revisao-secao']), base.children).map(item => item.attribs['data-b601-revisao-secao']))
  const revisoes = DomUtils.findAll(item => Boolean(item.attribs['data-b601-revisao-secao']), atual.children)
    .filter(item => {
      if (ids.has(item.attribs['data-b601-revisao-secao'])) return false
      for (let pai = item.parent; pai; pai = pai.parent) {
        if ('attribs' in pai && pai.attribs['data-b601-revisao-secao']) return false
      }
      return true
    })
  return [htmlBase, ...revisoes.map(item => DomUtils.getOuterHTML(item))].filter(Boolean).join('\n')
}

export function reterDescricoesPendentesB601(
  todas: SecaoTemplateRow[], ativas: SecaoTemplateRow[], expansoes: Map<string, string>, htmlAtual: string,
): SecaoTemplateRow[] {
  const ids = new Set(ativas.map(secao => secao.id))
  const documento = parseDocument(htmlAtual)
  for (const grupo of DomUtils.findAll(item => Boolean(item.attribs['data-b601-grupo']), documento.children)) {
    const secao = todas.find(item => item.id === grupo.attribs['data-repeat-owner']
      && item.repetir_para === `b601_agrupados:${grupo.attribs['data-b601-grupo']}`)
    if (!secao || expansoes.get(secao.id)?.includes('data-b601-grupo=')) continue
    ids.add(secao.id)
    if (secao.parent_id) ids.add(secao.parent_id)
    expansoes.set(secao.id, [DomUtils.getOuterHTML(grupo), expansoes.get(secao.id) || ''].filter(Boolean).join('\n'))
  }
  return todas.filter(secao => ids.has(secao.id))
}

export function sinalizarDescricaoDesatualizadaB601(html: string, dados: unknown): string {
  const documento = parseDocument(html)
  for (const grupo of DomUtils.findAll(item => ['105', '101'].includes(item.attribs['data-b601-grupo']), documento.children)) {
    const tipo = grupo.attribs['data-b601-grupo'] === '105' ? '105' : '101'
    const aviso = DomUtils.findOne(item => item.attribs['data-b601-aviso-tabela'] === 'true', grupo.children)
    if (grupo.attribs['data-b601-assinatura'] === assinaturaDescricaoB601(dados, tipo)) {
      if (aviso) DomUtils.removeElement(aviso)
      continue
    }
    if (!aviso) {
      const mensagem = parseDocument('<p data-b601-aviso-tabela="true"><strong>Dados da REP alterados. Revise e recrie esta tabela para atualizar sua descrição.</strong> <span class="campo-reservado" data-reservado="true">XXX</span></p>').children[0]
      if (mensagem) DomUtils.prependChild(grupo, mensagem)
    }
  }
  return DomUtils.getOuterHTML(documento)
}

export function preservarTextoPecasB601(htmlBase: string, htmlAtual: string, dados: unknown): string {
  if (!htmlAtual.includes('data-repeat-group="b601_pecas"')) return htmlBase
  const idsAtivos = new Set(projetarB601ParaLaudo(dados).pecas.map(peca => peca.idLocal))
  const base = parseDocument(htmlBase)
  const atual = parseDocument(htmlAtual)
  const pecasAtuais = DomUtils.findAll(elemento => Boolean(elemento.attribs['data-b601-peca']), atual.children)
  const gruposAtuais = DomUtils.findAll(elemento => elemento.attribs['data-repeat-group'] === 'b601_pecas', atual.children)
  const porId = new Map(pecasAtuais.map(peca => [peca.attribs['data-b601-peca'], peca]))
  const porDono = new Map(gruposAtuais.map(grupo => [grupo.attribs['data-repeat-owner'],
    new Map(DomUtils.findAll(item => Boolean(item.attribs['data-b601-peca']), grupo.children)
      .map(peca => [peca.attribs['data-b601-peca'], peca])),
  ]))
  const idsBase = new Set(DomUtils.findAll(elemento => Boolean(elemento.attribs['data-b601-peca']), base.children)
    .map(peca => peca.attribs['data-b601-peca']))
  for (const grupo of DomUtils.findAll(elemento => elemento.attribs['data-repeat-group'] === 'b601_pecas', base.children)) {
    const anterior = gruposAtuais.find(item => item.attribs['data-repeat-owner'] === grupo.attribs['data-repeat-owner'])
    let idsAnteriores: string[] = []
    try {
      const valor: unknown = JSON.parse(anterior?.attribs['data-b601-itens'] || '[]')
      if (Array.isArray(valor) && valor.every(item => typeof item === 'string')) idsAnteriores = valor
    } catch { /* Metadados antigos ausentes não impedem preservar o texto existente. */ }
    for (const peca of DomUtils.findAll(elemento => Boolean(elemento.attribs['data-b601-peca']), grupo.children)) {
      const id = peca.attribs['data-b601-peca']
      const existente = porDono.get(grupo.attribs['data-repeat-owner'])?.get(id) ?? porId.get(id)
      if (!existente) {
        if (idsAnteriores.includes(id)) DomUtils.removeElement(peca)
        continue
      }
      const indice = peca.attribs['data-b601-indice']
      const copia = parseDocument(DomUtils.getOuterHTML(existente).replace(/b601_peca_\d+_/g, `b601_peca_${indice}_`)).children[0]
      if (!copia || !('attribs' in copia)) continue
      copia.attribs['data-b601-indice'] = indice
      delete copia.attribs['data-b601-removida']
      const tituloAntigo = DomUtils.findOne(item => item.attribs['data-b601-titulo'] === 'true', copia.children)
      const tituloNovo = DomUtils.findOne(item => item.attribs['data-b601-titulo'] === 'true', peca.children)
      if (tituloAntigo && tituloNovo) DomUtils.replaceElement(tituloAntigo, tituloNovo)
      DomUtils.replaceElement(peca, copia)
    }
    for (const peca of anterior ? DomUtils.findAll(item => Boolean(item.attribs['data-b601-peca']), anterior.children) : []) {
      if (idsBase.has(peca.attribs['data-b601-peca']) || idsAtivos.has(peca.attribs['data-b601-peca'])) continue
      const preservada = parseDocument(DomUtils.getOuterHTML(peca)).children[0]
      if (!preservada || !('attribs' in preservada)) continue
      DomUtils.appendChild(grupo, preservada)
    }
  }
  return DomUtils.getOuterHTML(base)
}

export function revisarPecasAusentesB601(html: string, dados: unknown): string {
  const idsAtivos = new Set(projetarB601ParaLaudo(dados).pecas.map(peca => peca.idLocal))
  const documento = parseDocument(html)
  const encontrados = new Set<string>()
  for (const peca of DomUtils.findAll(item => Boolean(item.attribs['data-b601-peca']), documento.children)) {
    const id = peca.attribs['data-b601-peca']
    const duplicada = encontrados.has(id)
    encontrados.add(id)
    if (idsAtivos.has(id) && !duplicada) continue
    peca.attribs['data-b601-removida'] = 'true'
    if (!DomUtils.findOne(item => item.attribs['data-b601-aviso'] === 'true', peca.children)) {
      const mensagem = duplicada
        ? 'Bloco adicional da mesma peça: texto preservado para revisão da organização do laudo.'
        : 'Peça removida da REP: revise este texto antes de excluir o bloco.'
      const aviso = parseDocument(`<p data-b601-aviso="true">${mensagem} <span class="campo-reservado" data-reservado="true">XXX</span></p>`).children[0]
      if (aviso) DomUtils.prependChild(peca, aviso)
    }
    for (const marcador of DomUtils.findAll(item => (item.attribs['data-placeholder'] || '').includes('b601_peca_'), peca.children)) {
      const reservado = parseDocument('<span class="campo-reservado" data-reservado="true">XXX</span>').children[0]
      if (reservado) DomUtils.replaceElement(marcador, reservado)
    }
    const htmlInterno = DomUtils.getInnerHTML(peca).replace(/\{\{b601_peca_\d+_[^}]+\}\}/g, 'XXX')
    const conteudo = parseDocument(htmlInterno)
    for (const filho of [...peca.children]) DomUtils.removeElement(filho)
    for (const filho of [...conteudo.children]) DomUtils.appendChild(peca, filho)
  }
  return DomUtils.getOuterHTML(documento)
}
