import { projetarB601ParaLaudo } from './b601-pecas-projecao.js'
import type { PecaBalistica } from '../types/pecas-balistica.types.js'

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

const reservado = '<span class="campo-reservado" data-reservado="true">XXX</span>'
const celula = (texto: string, cabecalho = false) => `<${cabecalho ? 'th' : 'td'}>${texto}</${cabecalho ? 'th' : 'td'}>`

export function gerarDescricaoAgrupadaB601(dados: unknown, tipo: TipoDescricaoB601, dono: string): string {
  const projecao = projetarB601ParaLaudo(dados)
  const manuais = projecao.pecas.filter((peca, indice) => peca.tipoCodigo === tipo
    && !possuiContagemUnitariaB601(projecao.dados.pecas[indice]))
  const blocosManuais = manuais.length ? `<div data-repeat-group="b601_pecas" data-repeat-owner="${escaparDescricaoB601(dono)}:manual" data-b601-itens="${escaparDescricaoB601(JSON.stringify(manuais.map(peca => peca.idLocal)))}">${manuais.map(peca => {
    const prefixo = `b601_peca_${peca.indice}_`
    return `<div data-b601-peca="${escaparDescricaoB601(peca.idLocal)}" data-b601-indice="${peca.indice}"><h4 data-b601-titulo="true">ITEM {{${prefixo}numero}} — {{${prefixo}tipo}} — {{${prefixo}identificacao}}</h4><p>Quantidade encaminhada: {{${prefixo}quantidade}} {{${prefixo}medida}}.</p><p>${reservado}</p></div>`
  }).join('\n')}</div>` : ''
  return [montarDescricao(itensDescricao(dados, tipo), tipo, dono), blocosManuais].filter(Boolean).join('\n')
}

export function gerarPreviaDescricaoB601(tipo: TipoDescricaoB601): string {
  return montarDescricao([{ id: 'previa', item: 1, quantidade: 5, origem: '' }], tipo, 'previa')
}

function montarDescricao(itens: ReturnType<typeof itensDescricao>, tipo: TipoDescricaoB601, dono: string): string {
  if (!itens.length) return ''
  const unidades = itens.flatMap(item => Array.from({ length: item.quantidade }, () => item))
  const projetil = tipo === '105'
  const singular = unidades.length === 1
  const nome = projetil ? (singular ? 'projétil' : 'projéteis') : (singular ? 'estojo' : 'estojos')
  const introducao = `Trata-se de ${nome} ${singular ? 'proveniente' : 'provenientes'} de munição própria para uso em armas de fogo, integralmente ${singular ? 'descrito' : 'descritos'} no ${projetil && unidades.length > 5 ? 'conjunto de quadros' : 'quadro'} a seguir:`
  const tabelas: string[] = []
  if (projetil) {
    for (let inicio = 0; inicio < unidades.length; inicio += 5) {
      const lote = unidades.slice(inicio, inicio + 5)
      const cabecalho = celula('Características', true) + lote.map((item, indice) => celula(`PQ${String(inicio + indice + 1).padStart(2, '0')} · Item ${item.item}`, true)).join('')
      const linhas = CARACTERISTICAS_PROJETEIS_B601.map(caracteristica => `<tr>${celula(caracteristica, true)}${lote.map(item => celula(caracteristica === 'Origem' ? escaparDescricaoB601(item.origem) || reservado : reservado)).join('')}</tr>`).join('')
      tabelas.push(`<table border="1" cellpadding="4" width="100%"><thead><tr><th colspan="${lote.length + 1}">TABELA 1 – DESCRIÇÃO DOS PROJÉTEIS${inicio ? ' — continuação' : ''}</th></tr><tr>${cabecalho}</tr></thead><tbody>${linhas}</tbody></table>`)
    }
  } else {
    const titulos = ['ID', 'Marca', 'Procedência', 'Calibre Nominal', 'Composição do Estojo', 'Espoleta', 'Observações']
    const linhas = unidades.map((item, indice) => `<tr>${celula(`${String(indice + 1).padStart(2, '0')} · Item ${item.item}`)}${celula(reservado)}${celula(escaparDescricaoB601(item.origem) || reservado)}${Array.from({ length: 4 }, () => celula(reservado)).join('')}</tr>`).join('')
    tabelas.push(`<table border="1" cellpadding="4" width="100%"><thead><tr><th colspan="7">TABELA 1 – DESCRIÇÃO DOS ESTOJOS</th></tr><tr>${titulos.map(titulo => celula(titulo, true)).join('')}</tr></thead><tbody>${linhas}</tbody></table>`)
  }
  const legenda = projetil
    ? 'LEGENDA: CHOG = Chumbo Ogival; ETOG = Encamisado Total Ogival; EXPO = Expansivo Ponta Oca.'
    : 'LEGENDA: NTA = Non Toxic Ammunation.'
  return `<div data-b601-grupo="${tipo}" data-repeat-owner="${escaparDescricaoB601(dono)}" data-b601-assinatura="${escaparDescricaoB601(JSON.stringify(itens))}"><p style="text-indent: 35.43pt;">${introducao}</p>${tabelas.join('\n')}<p>${legenda}</p></div>`
}
