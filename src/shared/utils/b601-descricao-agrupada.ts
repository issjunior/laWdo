import { projetarB601ParaLaudo } from './b601-pecas-projecao.js'
import type { PecaBalistica } from '../types/pecas-balistica.types.js'
import { criarHtmlCampoReservado } from './campo-reservado.js'
import { obterTipoProjetilB601 } from '../catalogos/b601.catalogo.js'
import { codigoColetaPorOrigem } from '../gdl/reps-mesmo-caso.js'
import { criarHtmlFigura, URL_FIGURA_DUMMY } from '../figura/html.js'

export type TipoDescricaoB601 = '105' | '101'

const CARACTERISTICAS_PROJETEIS_B601 = [
  'Origem', 'Tipo', 'Constituição e formato', 'Massa (g)', 'Diâmetro médio (mm)',
  'Altura (mm)', 'Calibre nominal (provável)', 'Cavados e Ressaltos',
  'Raiamento e Orientação', 'Deformações Acidentais', 'Aderências',
] as const

function escaparDescricaoB601(valor: string): string {
  return valor.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function ehAgrupamentoB601(valor?: string | null): boolean {
  return /^b601_agrupados:(105|101)$/.test(valor || '')
}

export function possuiComplementoB601(valor?: string | null): boolean {
  return ehAgrupamentoB601(valor) || /^b601_pecas(?::\d+)?$/.test(valor || '')
}

export function possuiContagemUnitariaB601(peca: PecaBalistica): boolean {
  return ['UNIDADES', '8'].includes(peca.comuns.unidadeMedida) && Number.isSafeInteger(peca.comuns.quantidade) && peca.comuns.quantidade > 0
}

function itensDescricao(dados: unknown, tipo: TipoDescricaoB601) {
  const projecao = projetarB601ParaLaudo(dados)
  return projecao.pecas.flatMap((peca, indice) => {
    const original = projecao.dados.pecas[indice]
    return peca.tipoCodigo === tipo && possuiContagemUnitariaB601(original)
      ? [{ id: peca.idLocal, item: peca.indice, quantidade: original.comuns.quantidade, origem: peca.campos.origem_coleta || '' }]
      : []
  })
}

export function assinaturaDescricaoB601(dados: unknown, tipo: TipoDescricaoB601): string {
  return JSON.stringify(itensDescricao(dados, tipo))
}

const reservarManual = (campo: string, identificador: string) => criarHtmlCampoReservado(`Campo de preenchimento manual no laudo: ${campo} — ${identificador}`)
const reservarOrigem = (item: number) => criarHtmlCampoReservado(`Campo pendente na REP: ORIGEM/COLETA — Item ${item}`, `b601_peca_${item}_origem_coleta`)
const celula = (texto: string, cabecalho = false) => `<${cabecalho ? 'th' : 'td'} style="text-align:center;vertical-align:middle${cabecalho ? ';background-color:#e8e8e8;color:#000' : ''}">${texto}</${cabecalho ? 'th' : 'td'}>`
const estiloTabela = 'font-family:Arial,Helvetica,sans-serif;font-size:12px;border-collapse:collapse;width:100%'
const estiloTitulo = 'background-color:#d9d9d9;color:#000;text-align:center;vertical-align:middle'

function gerarBlocosManuaisB601(dados: unknown, tipo: TipoDescricaoB601, dono: string): string {
  const projecao = projetarB601ParaLaudo(dados)
  const manuais = projecao.pecas.filter((peca, indice) => peca.tipoCodigo === tipo
    && !possuiContagemUnitariaB601(projecao.dados.pecas[indice]))
  return manuais.length ? `<div data-repeat-group="b601_pecas" data-repeat-owner="${escaparDescricaoB601(dono)}:manual" data-b601-itens="${escaparDescricaoB601(JSON.stringify(manuais.map(peca => peca.idLocal)))}">${manuais.map(peca => {
    const prefixo = `b601_peca_${peca.indice}_`
    return `<div data-b601-peca="${escaparDescricaoB601(peca.idLocal)}" data-b601-indice="${peca.indice}"><h4 data-b601-titulo="true">ITEM {{${prefixo}numero}} — {{${prefixo}tipo}} — {{${prefixo}identificacao}}</h4><p>Quantidade encaminhada: {{${prefixo}quantidade}} {{${prefixo}medida}}.</p><p>${reservarManual('Descrição da peça', `Item ${peca.indice}`)}</p></div>`
  }).join('\n')}</div>` : ''
}

export function gerarDescricaoAgrupadaB601(dados: unknown, tipo: TipoDescricaoB601, dono: string): string {
  const projecao = projetarB601ParaLaudo(dados)
  const blocosManuais = gerarBlocosManuaisB601(dados, tipo, dono)
  const tiposItem = new Map(projecao.pecas.map(peca => [peca.idLocal, obterTipoProjetilB601(peca.campos.tipo)]))
  const calibres = new Map(projecao.pecas.map(peca => [peca.idLocal, peca.campos.calibre_nominal_provavel || '']))
  return [montarDescricao(itensDescricao(dados, tipo), tipo, dono, tiposItem, undefined, new Map(), calibres), blocosManuais].filter(Boolean).join('\n')
}

export function gerarPreviaDescricaoB601(tipo: TipoDescricaoB601, coleta = false, fotosPorOrigem: ReadonlyMap<string, string> = new Map()): string {
  if (coleta) {
    const grupos = (tipo === '105' ? ['LOCAL', 'NECRÓPSIA'] : ['ESTOJOS']).map((origem, indice) =>
      montarDescricao([{ id: `previa-${indice}`, item: indice + 1, quantidade: 5, origem }], tipo, 'previa', new Map(), { origem, inicio: indice * 5 })
      + criarFotosColetaB601(`previa-${indice}`, origem, fotosPorOrigem)).join('\n')
    return `<div data-b601-grupo="${tipo}" data-b601-modelo-coleta="true">${grupos}</div>`
  }
  return montarDescricao([{ id: 'previa', item: 1, quantidade: 5, origem: '' }], tipo, 'previa')
}

function montarDescricao(itens: ReturnType<typeof itensDescricao>, tipo: TipoDescricaoB601, dono: string, tiposItem: ReadonlyMap<string, string> = new Map(), coleta?: { origem: string; inicio: number }, raiamentos: ReadonlyMap<string, string> = new Map(), calibres: ReadonlyMap<string, string> = new Map()): string {
  if (!itens.length) return ''
  const unidades = itens.flatMap(item => Array.from({ length: item.quantidade }, (_, indice) => ({ ...item, unidade: indice + 1 })))
  const projetil = tipo === '105'
  const singular = unidades.length === 1
  const nome = projetil ? (singular ? 'projétil' : 'projéteis') : (singular ? 'estojo' : 'estojos')
  const introducao = `Trata-se de ${nome} ${singular ? 'proveniente' : 'provenientes'} de munição própria para uso em armas de fogo, integralmente ${singular ? 'descrito' : 'descritos'} no ${projetil && unidades.length > 5 ? 'conjunto de quadros' : 'quadro'} a seguir:`
  const tabelas: string[] = []
  if (projetil) {
    for (let inicio = 0; inicio < unidades.length; inicio += 5) {
      const lote = unidades.slice(inicio, inicio + 5)
      const deslocamento = coleta?.inicio ?? 0
      const numeroPq = (indice: number) => String(deslocamento + inicio + indice + 1).padStart(2, '0')
      const cabecalho = celula('Características', true) + lote.map((_, indice) => celula(`PQ${numeroPq(indice)}`, true)).join('')
      const caracteristicas = coleta ? [...CARACTERISTICAS_PROJETEIS_B601.slice(0, 9), 'Tipo de Raiamento', ...CARACTERISTICAS_PROJETEIS_B601.slice(9)] : CARACTERISTICAS_PROJETEIS_B601
      const linhas = caracteristicas.map(caracteristica => `<tr>${celula(caracteristica, true)}${lote.map((item, indice) => celula(caracteristica === 'Origem'
        ? `<span data-b601-origem-projetil="true" data-b601-peca-id="${escaparDescricaoB601(item.id)}" data-b601-unidade="${item.unidade}" data-b601-pq="PQ${numeroPq(indice)}">${escaparDescricaoB601(item.origem) || reservarOrigem(item.item)}</span>`
        : caracteristica === 'Calibre nominal (provável)'
          ? `<span data-b601-campo-projetil="calibre_nominal_provavel" data-b601-peca-id="${escaparDescricaoB601(item.id)}" data-b601-unidade="${item.unidade}" data-b601-pq="PQ${numeroPq(indice)}">${escaparDescricaoB601(calibres.get(item.id) || '') || reservarManual(caracteristica, `PQ${numeroPq(indice)}`)}</span>`
        : caracteristica === 'Tipo de Raiamento'
          ? `<span data-b601-campo-projetil="tipo_raiamento" data-b601-peca-id="${escaparDescricaoB601(item.id)}" data-b601-unidade="${item.unidade}" data-b601-pq="PQ${numeroPq(indice)}">${escaparDescricaoB601(raiamentos.get(item.id) || '') || reservarManual(caracteristica, `PQ${numeroPq(indice)}`)}</span>`
        : ['Tipo', 'Constituição e formato'].includes(caracteristica)
          ? `<span data-b601-campo-projetil="${caracteristica === 'Tipo' ? 'tipo' : 'constituicao_formato'}" data-b601-peca-id="${escaparDescricaoB601(item.id)}" data-b601-unidade="${item.unidade}" data-b601-pq="PQ${numeroPq(indice)}">${caracteristica === 'Tipo' && tiposItem.get(item.id) ? escaparDescricaoB601(tiposItem.get(item.id) || '') : reservarManual(caracteristica, `PQ${numeroPq(indice)}`)}</span>`
        : reservarManual(caracteristica, `PQ${numeroPq(indice)}`))).join('')}</tr>`).join('')
      tabelas.push(`<table data-tabela-laudo="balistica" border="1" cellpadding="4" width="100%" style="${estiloTabela}"><thead><tr><th colspan="${lote.length + 1}" style="${estiloTitulo}">TABELA 1 – DESCRIÇÃO DOS PROJÉTEIS${coleta ? ` (${escaparDescricaoB601(coleta.origem)})` : ''}${inicio ? ' — continuação' : ''}</th></tr><tr>${cabecalho}</tr></thead><tbody>${linhas}</tbody></table>`)
    }
  } else {
    const titulos = coleta ? ['ID', 'Origem', 'Marca', 'Procedência', 'Composição', 'Espoleta', 'Calibre Nominal', 'Observações'] : ['ID', 'Marca', 'Procedência', 'Calibre Nominal', 'Composição do Estojo', 'Espoleta', 'Observações']
    const camposEstojos: Record<string, string> = { Marca: 'marca', 'Calibre Nominal': 'calibre_nominal', Composição: 'composicao', 'Composição do Estojo': 'composicao', Espoleta: 'espoleta' }
    const linhas = unidades.map((item, indice) => {
      const identificador = `Estojo ${String(indice + 1).padStart(2, '0')}`
      const campoManual = (titulo: string): string => {
        const campo = camposEstojos[titulo]
        const valor = reservarManual(titulo, identificador)
        return celula(campo ? `<span data-b601-campo-estojo="${campo}" data-b601-peca-id="${escaparDescricaoB601(item.id)}" data-b601-unidade="${item.unidade}" data-b601-identificador="${identificador}">${valor}</span>` : valor)
      }
      if (coleta) return `<tr>${celula(String(indice + 1).padStart(2, '0'))}${celula(escaparDescricaoB601(item.origem) || reservarOrigem(item.item))}${titulos.slice(2).map(campoManual).join('')}</tr>`
      return `<tr>${celula(String(indice + 1).padStart(2, '0'))}${campoManual('Marca')}${celula(escaparDescricaoB601(item.origem) || reservarOrigem(item.item))}${titulos.slice(3).map(campoManual).join('')}</tr>`
    }).join('')
    tabelas.push(`<table data-tabela-laudo="balistica" border="1" cellpadding="4" width="100%" style="${estiloTabela}"><thead><tr><th colspan="${titulos.length}" style="${estiloTitulo}">TABELA 1 – DESCRIÇÃO DOS ESTOJOS</th></tr><tr>${titulos.map(titulo => celula(titulo, true)).join('')}</tr></thead><tbody>${linhas}</tbody></table>`)
  }
  const conteudo = `<p style="text-indent: 35.43pt;">${introducao}</p>${tabelas.join('\n')}`
  return coleta ? conteudo : `<div data-b601-grupo="${tipo}" data-repeat-owner="${escaparDescricaoB601(dono)}" data-b601-assinatura="${escaparDescricaoB601(JSON.stringify(itens))}">${conteudo}</div>`
}

export function gerarDescricaoColetaB601(dados: unknown, tipo: TipoDescricaoB601, dono: string, fotosPorOrigem: ReadonlyMap<string, string> = new Map()): string {
  const itens = itensDescricao(dados, tipo)
  const projecao = projetarB601ParaLaudo(dados)
  const tipos = new Map(projecao.pecas.map(peca => [peca.idLocal, obterTipoProjetilB601(peca.campos.tipo)]))
  const raiamentos = new Map(projecao.pecas.map(peca => [peca.idLocal, peca.campos.tipo_raiamento || '']))
  const calibres = new Map(projecao.pecas.map(peca => [peca.idLocal, peca.campos.calibre_nominal_provavel || '']))
  const origens = [...new Set(itens.map(item => item.origem))].sort((a, b) => {
    const prioridade = (origem: string) => codigoColetaPorOrigem(origem) === 'M110' ? 0 : codigoColetaPorOrigem(origem) === 'T002' ? 1 : 2
    return prioridade(a) - prioridade(b)
  })
  let inicio = 0
  const grupos = tipo === '105' ? origens.map(origem => {
    const grupo = itens.filter(item => item.origem === origem)
    const titulo = codigoColetaPorOrigem(origem) === 'M110' ? 'LOCAL' : codigoColetaPorOrigem(origem) === 'T002' ? 'NECRÓPSIA' : origem || 'XXX'
    const html = montarDescricao(grupo, tipo, dono, tipos, { origem: titulo, inicio }, raiamentos, calibres) + criarFotosColetaB601(`${dono}-${inicio}`, titulo, fotosPorOrigem)
    inicio += grupo.reduce((total, item) => total + item.quantidade, 0)
    return html
  }).join('\n') : itens.length ? montarDescricao(itens, tipo, dono, tipos, { origem: '', inicio: 0 }) + criarFotosColetaB601(dono, 'ESTOJOS', fotosPorOrigem) : ''
  const manuais = gerarBlocosManuaisB601(dados, tipo, dono)
  return grupos || manuais ? `<div data-b601-grupo="${tipo}" data-b601-modelo-coleta="true" data-repeat-owner="${escaparDescricaoB601(dono)}" data-b601-assinatura="${escaparDescricaoB601(assinaturaDescricaoB601(dados, tipo))}">${grupos}${manuais}</div>` : ''
}

function criarFotosColetaB601(id: string, origem: string, fotosPorOrigem: ReadonlyMap<string, string>): string {
  const conteudo = fotosPorOrigem.get(origem) ?? `<p>&nbsp;</p><table border="0" width="100%" style="border:0"><thead><tr><th colspan="2" style="border:0">TABELA 1 – TOMADAS FOTOGRÁFICAS (${escaparDescricaoB601(origem)})</th></tr></thead><tbody><tr>${[1, 2].map(numero => `<td style="border:0">${criarHtmlFigura(URL_FIGURA_DUMMY, `dummy-b601-${id}-${numero}`, '', true)}</td>`).join('')}</tr></tbody></table>`
  return `<div data-b601-complemento="true" data-b601-fotos-origem="${escaparDescricaoB601(origem)}">${conteudo}</div>`
}
