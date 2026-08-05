import { screen, type BrowserWindow } from 'electron'

import { configuracaoService } from '../services/configuracao.service.js'
import { logError } from './logger.js'

interface DimensoesPersistidas {
  versao: 1
  largura: number
  altura: number
}

interface OpcoesDimensoesJanela {
  chave: string
  descricao: string
  larguraPadrao: number
  alturaPadrao: number
  larguraMinima: number
  alturaMinima: number
  janelaReferencia?: BrowserWindow | null
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor))
}

export function normalizarDimensoesJanela(
  valor: unknown,
  opcoes: Omit<OpcoesDimensoesJanela, 'chave' | 'descricao' | 'janelaReferencia'>,
  areaUtil: { width: number; height: number },
): DimensoesPersistidas {
  const larguraMaxima = Math.max(opcoes.larguraMinima, Math.floor(areaUtil.width * 0.9))
  const alturaMaxima = Math.max(opcoes.alturaMinima, Math.floor(areaUtil.height * 0.9))
  const registro = valor && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : null
  const configuracaoValida = registro?.versao === 1
    && Number.isFinite(registro.largura)
    && Number.isFinite(registro.altura)
  const largura = configuracaoValida ? Number(registro.largura) : opcoes.larguraPadrao
  const altura = configuracaoValida ? Number(registro.altura) : opcoes.alturaPadrao

  return {
    versao: 1,
    largura: limitar(Math.round(largura), opcoes.larguraMinima, larguraMaxima),
    altura: limitar(Math.round(altura), opcoes.alturaMinima, alturaMaxima),
  }
}

function obterAreaUtil(janela?: BrowserWindow | null): { width: number; height: number } {
  if (janela && !janela.isDestroyed()) {
    return screen.getDisplayMatching(janela.getBounds()).workAreaSize
  }
  return screen.getPrimaryDisplay().workAreaSize
}

export async function carregarDimensoesJanela(
  opcoes: OpcoesDimensoesJanela,
): Promise<DimensoesPersistidas> {
  let valor: unknown = null
  try {
    const armazenado = await configuracaoService.obter(opcoes.chave)
    valor = armazenado ? JSON.parse(armazenado) : null
  } catch (error) {
    logError(`Dimensões ignoradas para ${opcoes.chave}`, error)
  }

  return normalizarDimensoesJanela(valor, opcoes, obterAreaUtil(opcoes.janelaReferencia))
}

export function observarDimensoesJanela(
  janela: BrowserWindow,
  opcoes: Pick<OpcoesDimensoesJanela, 'chave' | 'descricao' | 'larguraMinima' | 'alturaMinima'>,
): void {
  let temporizador: NodeJS.Timeout | null = null
  let dimensoesPendentes: DimensoesPersistidas | null = null

  const salvar = () => {
    if (!dimensoesPendentes) return
    const dimensoes = dimensoesPendentes
    dimensoesPendentes = null
    void configuracaoService
      .salvar(opcoes.chave, JSON.stringify(dimensoes), 'json', opcoes.descricao)
      .catch((error: unknown) => logError(`Erro ao salvar dimensões para ${opcoes.chave}`, error))
  }

  janela.on('resize', () => {
    const [largura, altura] = janela.getSize()
    dimensoesPendentes = normalizarDimensoesJanela(
      { versao: 1, largura, altura },
      {
        larguraPadrao: largura,
        alturaPadrao: altura,
        larguraMinima: opcoes.larguraMinima,
        alturaMinima: opcoes.alturaMinima,
      },
      obterAreaUtil(janela),
    )
    if (temporizador) clearTimeout(temporizador)
    temporizador = setTimeout(() => {
      temporizador = null
      salvar()
    }, 300)
  })

  janela.once('closed', () => {
    if (temporizador) clearTimeout(temporizador)
    salvar()
  })
}
