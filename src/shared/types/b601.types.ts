import type { PecaBalistica } from './pecas-balistica.types.js'

export interface DadosB601 {
  versao: 1
  semPecas: boolean
  pecas: PecaBalistica[]
  envolvidos: string[]
  data_ocorrencia: string
  local: { bairro: string; cidade: string; uf: string }
  numero_bo: string
  numero_ip: string
  solicitante_nome: string
  [chave: string]: unknown
}

export function ehRegistroB601(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

export function criarDadosB601(): DadosB601 {
  return {
    versao: 1, semPecas: false, pecas: [], envolvidos: [], data_ocorrencia: '',
    local: { bairro: '', cidade: '', uf: '' }, numero_bo: '', numero_ip: '', solicitante_nome: '',
  }
}

function ehPecaB601(valor: unknown): valor is PecaBalistica {
  if (!ehRegistroB601(valor) || typeof valor.idLocal !== 'string' || !valor.idLocal.trim()
    || !['manual', 'gdl'].includes(String(valor.origem)) || typeof valor.alteradaLocalmente !== 'boolean'
    || typeof valor.tipoCodigo !== 'string' || typeof valor.tipoPeca !== 'string'
    || !ehRegistroB601(valor.comuns) || !ehRegistroB601(valor.personalizados) || !ehRegistroB601(valor.extrasGdl)) return false
  if (valor.codPecaGdl !== undefined && (typeof valor.codPecaGdl !== 'number' || !Number.isSafeInteger(valor.codPecaGdl))) return false
  const comuns = valor.comuns
  const textos = ['identificacao', 'unidadeMedida', 'quantidadeDescricao', 'dataEntrada', 'lacreEntrada', 'lacreSaida', 'dataLiberacao', 'codigoVestigio', 'observacao']
  return textos.every(chave => typeof comuns[chave] === 'string')
    && typeof comuns.quantidade === 'number' && Number.isFinite(comuns.quantidade)
    && typeof comuns.examinadoInLoco === 'boolean'
    && ['S', 'N', 'P'].includes(String(comuns.consumida))
    && (comuns.materialIncinerado === undefined || comuns.materialIncinerado === 'S' || comuns.materialIncinerado === 'N')
}

export function validarDadosB601(valor: unknown): DadosB601 {
  const local = ehRegistroB601(valor) && ehRegistroB601(valor.local) ? valor.local : null
  if (!ehRegistroB601(valor) || valor.versao !== 1 || typeof valor.semPecas !== 'boolean'
    || !Array.isArray(valor.pecas) || !valor.pecas.every(ehPecaB601)
    || new Set(valor.pecas.map(peca => peca.idLocal)).size !== valor.pecas.length
    || !Array.isArray(valor.envolvidos) || !valor.envolvidos.every(item => typeof item === 'string')
    || !local || !['bairro', 'cidade', 'uf'].every(chave => typeof local[chave] === 'string')
    || !['data_ocorrencia', 'numero_bo', 'numero_ip', 'solicitante_nome'].every(chave => typeof valor[chave] === 'string')
    || (valor.semPecas && valor.pecas.length > 0)) {
    throw new Error('Os dados específicos do B-601 estão inválidos. O conteúdo original foi preservado.')
  }
  return {
    ...valor, versao: 1, semPecas: valor.semPecas, pecas: valor.pecas, envolvidos: valor.envolvidos,
    local: { bairro: String(local.bairro), cidade: String(local.cidade), uf: String(local.uf) },
    data_ocorrencia: String(valor.data_ocorrencia), numero_bo: String(valor.numero_bo),
    numero_ip: String(valor.numero_ip), solicitante_nome: String(valor.solicitante_nome),
  }
}

export function lerDadosB601(json: string | null | undefined): { dados: DadosB601; raiz: Record<string, unknown> } {
  if (!json) return { dados: criarDadosB601(), raiz: {} }
  const raiz: unknown = JSON.parse(json)
  if (!ehRegistroB601(raiz)) throw new Error('O conteúdo específico da REP não é um objeto válido.')
  if (raiz.b601 === undefined && Object.keys(raiz).length === 0) return { dados: criarDadosB601(), raiz }
  return { dados: validarDadosB601(raiz.b601), raiz }
}
