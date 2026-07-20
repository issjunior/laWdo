import { TIPOS_PECA_B602_POR_CODIGO } from '../catalogos/b602-gdl.catalogo.js'
import type { PecaB602 } from '../types/b602-gdl.types.js'

export interface ProjecaoB602Laudo {
  materialEncaminhado: Record<string, unknown>[]
  cartuchos: Record<string, unknown>[]
  estojos: Record<string, unknown>[]
  armas: Record<string, unknown>[]
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function ehPecaB602(valor: unknown): valor is PecaB602 {
  return ehRegistro(valor)
    && typeof valor.tipoCodigo === 'string'
    && typeof valor.tipoPeca === 'string'
    && ehRegistro(valor.comuns)
    && ehRegistro(valor.personalizados)
}

function lerColecaoLegada(
  b602: Record<string, unknown>,
  chave: string,
): Record<string, unknown>[] {
  const valor = b602[chave]
  return Array.isArray(valor) ? valor.filter(ehRegistro) : []
}

function texto(valor: unknown): string {
  return valor === null || valor === undefined ? '' : String(valor)
}

function obterPersonalizado(peca: PecaB602, sufixos: string[]): string {
  for (const sufixo of sufixos) {
    const campoId = `${peca.tipoCodigo}:${sufixo}`
    const valor = peca.personalizados[campoId]
    const valorTexto = texto(valor).trim()
    if (!valorTexto) continue

    const campo = TIPOS_PECA_B602_POR_CODIGO.get(peca.tipoCodigo)?.campos
      .find(candidato => candidato.id === campoId)
    const opcao = campo?.opcoes?.find(candidata => (
      candidata.codigo === valorTexto || candidata.label === valorTexto
    ))
    return opcao?.label ?? valorTexto
  }
  return ''
}

function projetarMaterialEncaminhado(peca: PecaB602): Record<string, unknown> {
  const tipo = TIPOS_PECA_B602_POR_CODIGO.get(peca.tipoCodigo)
  return {
    natureza: tipo?.familia === 'arma' ? 'Arma' : peca.tipoPeca,
    quantidade: String(peca.comuns.quantidade),
    tipo: peca.tipoPeca,
    dito_oficio: peca.comuns.identificacao,
    numero_lacre: peca.comuns.lacreEntrada,
  }
}

function projetarEstojo(peca: PecaB602): Record<string, unknown> {
  return {
    quantidade: String(peca.comuns.quantidade),
    calibre: obterPersonalizado(peca, ['calibre_nominal', 'calibre']),
    marca: obterPersonalizado(peca, ['marca_arma', 'marca']),
    origem: obterPersonalizado(peca, ['origem_coleta']),
    espoleta: obterPersonalizado(peca, ['espoleta']),
    estojo: peca.comuns.identificacao,
    observacao: peca.comuns.observacao,
  }
}

function projetarArma(peca: PecaB602): Record<string, unknown> {
  const funcionamento = obterPersonalizado(peca, ['funcionamento'])
  return {
    tipo: peca.tipoPeca,
    marca: obterPersonalizado(peca, ['marca_arma', 'marca']),
    modelo: obterPersonalizado(peca, ['modelo']),
    calibre: obterPersonalizado(peca, ['calibre_nominal', 'calibre']),
    numeracao_serie: obterPersonalizado(peca, ['numero_serie']),
    numeracao_cano: obterPersonalizado(peca, ['numero_cano']),
    capacidade_carregador: obterPersonalizado(peca, ['capacidade']),
    comprimento_cano: obterPersonalizado(peca, ['comprimento_cano']),
    acabamento: obterPersonalizado(peca, ['tipo_acabamento', 'acabamento']),
    funcionamento,
    estado_conservacao: obterPersonalizado(peca, ['estado_geral', 'estado_conservacao']),
    quantidade: String(peca.comuns.quantidade),
    dito_oficio: peca.comuns.identificacao,
    numero_lacre: peca.comuns.lacreEntrada,
    func_toggle: funcionamento ? 'on' : 'off',
    coleta_toggle: 'off',
  }
}

export function projetarB602ParaLaudo(b602: unknown): ProjecaoB602Laudo {
  if (!ehRegistro(b602)) {
    return { materialEncaminhado: [], cartuchos: [], estojos: [], armas: [] }
  }

  const pecas = Array.isArray(b602.pecas) ? b602.pecas.filter(ehPecaB602) : []
  if (pecas.length === 0) {
    return {
      materialEncaminhado: lerColecaoLegada(b602, 'material_enc'),
      cartuchos: lerColecaoLegada(b602, 'cartuchos'),
      estojos: lerColecaoLegada(b602, 'estojos'),
      armas: lerColecaoLegada(b602, 'armas'),
    }
  }

  return {
    materialEncaminhado: pecas.map(projetarMaterialEncaminhado),
    cartuchos: lerColecaoLegada(b602, 'cartuchos'),
    estojos: pecas.filter(peca => peca.tipoCodigo === '101').map(projetarEstojo),
    armas: pecas
      .filter(peca => TIPOS_PECA_B602_POR_CODIGO.get(peca.tipoCodigo)?.familia === 'arma')
      .map(projetarArma),
  }
}
