import { projetarB601ParaLaudo } from './b601-pecas-projecao.js'
import type { PecaBalistica } from '../types/pecas-balistica.types.js'
import { criarHtmlCampoReservado } from './campo-reservado.js'
import { obterTipoProjetilB601 } from '../catalogos/b601.catalogo.js'

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

export function gerarDescricaoAgrupadaB601(dados: unknown, tipo: TipoDescricaoB601, dono: string): string {
  const projecao = projetarB601ParaLaudo(dados)
  const manuais = projecao.pecas.filter((peca, indice) => peca.tipoCodigo === tipo
    && !possuiContagemUnitariaB601(projecao.dados.pecas[indice]))
  const blocosManuais = manuais.length ? `<div data-repeat-group="b601_pecas" data-repeat-owner="${escaparDescricaoB601(dono)}:manual" data-b601-itens="${escaparDescricaoB601(JSON.stringify(manuais.map(peca => peca.idLocal)))}">${manuais.map(peca => {
    const prefixo = `b601_peca_${peca.indice}_`
    return `<div data-b601-peca="${escaparDescricaoB601(peca.idLocal)}" data-b601-indice="${peca.indice}"><h4 data-b601-titulo="true">ITEM {{${prefixo}numero}} — {{${prefixo}tipo}} — {{${prefixo}identificacao}}</h4><p>Quantidade encaminhada: {{${prefixo}quantidade}} {{${prefixo}medida}}.</p><p>${reservarManual('Descrição da peça', `Item ${peca.indice}`)}</p></div>`
  }).join('\n')}</div>` : ''
  const tiposItem = new Map(projecao.pecas.map(peca => [peca.idLocal, obterTipoProjetilB601(peca.campos.tipo)]))
  return [montarDescricao(itensDescricao(dados, tipo), tipo, dono, tiposItem), blocosManuais].filter(Boolean).join('\n')
}

export function gerarPreviaDescricaoB601(tipo: TipoDescricaoB601): string {
  return montarDescricao([{ id: 'previa', item: 1, quantidade: 5, origem: '' }], tipo, 'previa')
}

function montarDescricao(itens: ReturnType<typeof itensDescricao>, tipo: TipoDescricaoB601, dono: string, tiposItem: ReadonlyMap<string, string> = new Map()): string {
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
      const cabecalho = celula('Características', true) + lote.map((_, indice) => celula(`PQ${String(inicio + indice + 1).padStart(2, '0')}`, true)).join('')
      const linhas = CARACTERISTICAS_PROJETEIS_B601.map(caracteristica => `<tr>${celula(caracteristica, true)}${lote.map((item, indice) => celula(caracteristica === 'Origem'
        ? `<span data-b601-origem-projetil="true" data-b601-peca-id="${escaparDescricaoB601(item.id)}" data-b601-unidade="${item.unidade}" data-b601-pq="PQ${String(inicio + indice + 1).padStart(2, '0')}">${escaparDescricaoB601(item.origem) || reservarOrigem(item.item)}</span>`
        : ['Tipo', 'Constituição e formato'].includes(caracteristica)
          ? `<span data-b601-campo-projetil="${caracteristica === 'Tipo' ? 'tipo' : 'constituicao_formato'}" data-b601-peca-id="${escaparDescricaoB601(item.id)}" data-b601-unidade="${item.unidade}" data-b601-pq="PQ${String(inicio + indice + 1).padStart(2, '0')}">${caracteristica === 'Tipo' && tiposItem.get(item.id) ? escaparDescricaoB601(tiposItem.get(item.id) || '') : reservarManual(caracteristica, `PQ${String(inicio + indice + 1).padStart(2, '0')}`)}</span>`
        : reservarManual(caracteristica, `PQ${String(inicio + indice + 1).padStart(2, '0')}`))).join('')}</tr>`).join('')
      tabelas.push(`<table border="1" cellpadding="4" width="100%" style="${estiloTabela}"><thead><tr><th colspan="${lote.length + 1}" style="${estiloTitulo}">TABELA 1 – DESCRIÇÃO DOS PROJÉTEIS${inicio ? ' — continuação' : ''}</th></tr><tr>${cabecalho}</tr></thead><tbody>${linhas}</tbody></table>`)
    }
  } else {
    const titulos = ['ID', 'Marca', 'Procedência', 'Calibre Nominal', 'Composição do Estojo', 'Espoleta', 'Observações']
    const linhas = unidades.map((item, indice) => {
      const identificador = `Estojo ${String(indice + 1).padStart(2, '0')}`
      return `<tr>${celula(String(indice + 1).padStart(2, '0'))}${celula(reservarManual('Marca', identificador))}${celula(escaparDescricaoB601(item.origem) || reservarOrigem(item.item))}${titulos.slice(3).map(titulo => celula(reservarManual(titulo, identificador))).join('')}</tr>`
    }).join('')
    tabelas.push(`<table border="1" cellpadding="4" width="100%" style="${estiloTabela}"><thead><tr><th colspan="7" style="${estiloTitulo}">TABELA 1 – DESCRIÇÃO DOS ESTOJOS</th></tr><tr>${titulos.map(titulo => celula(titulo, true)).join('')}</tr></thead><tbody>${linhas}</tbody></table>`)
  }
  const legenda = projetil ? '' : '<p>LEGENDA: NTA = Non Toxic Ammunation.</p>'
  return `<div data-b601-grupo="${tipo}" data-repeat-owner="${escaparDescricaoB601(dono)}" data-b601-assinatura="${escaparDescricaoB601(JSON.stringify(itens))}"><p style="text-indent: 35.43pt;">${introducao}</p>${tabelas.join('\n')}${legenda}</div>`
}
