import { screen, type BrowserWindow } from 'electron'

import { configuracaoService } from '../services/configuracao.service.js'
import { logError } from './logger.js'

const CHAVE_ESTADO_JANELA_PRINCIPAL = 'janela_principal_estado'
const LARGURA_MINIMA = 1024
const ALTURA_MINIMA = 768
const LARGURA_PADRAO = 1200
const ALTURA_PADRAO = 800

interface AreaMonitor {
  x: number
  y: number
  largura: number
  altura: number
}

interface EstadoJanelaPrincipal {
  versao: 2
  x: number
  y: number
  largura: number
  altura: number
  monitorId: number
  areaMonitor: AreaMonitor
  escalaMonitor: number
  maximizada: boolean
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor))
}

function areaContemPonto(area: Electron.Rectangle, x: number, y: number): boolean {
  return x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return Boolean(valor) && typeof valor === 'object' && !Array.isArray(valor)
}

function criarAreaMonitor(area: Electron.Rectangle): AreaMonitor {
  return { x: area.x, y: area.y, largura: area.width, altura: area.height }
}

function ehAreaMonitor(valor: unknown): valor is AreaMonitor {
  return ehRegistro(valor)
    && Number.isFinite(valor.x)
    && Number.isFinite(valor.y)
    && Number.isFinite(valor.largura)
    && Number.isFinite(valor.altura)
    && Number(valor.largura) > 0
    && Number(valor.altura) > 0
}

function areaMudou(
  areaSalva: AreaMonitor,
  areaAtual: Electron.Rectangle,
  escalaSalva: number,
  escalaAtual: number,
): boolean {
  return areaSalva.x !== areaAtual.x
    || areaSalva.y !== areaAtual.y
    || areaSalva.largura !== areaAtual.width
    || areaSalva.altura !== areaAtual.height
    || escalaSalva !== escalaAtual
}

function calcularProporcao(posicao: number, inicio: number, espaco: number): number {
  if (espaco <= 0) return 0.5
  return limitar((posicao - inicio) / espaco, 0, 1)
}

function estadoPadrao(): EstadoJanelaPrincipal {
  const monitor = screen.getPrimaryDisplay()
  const { x, y, width, height } = monitor.workArea
  const largura = limitar(LARGURA_PADRAO, LARGURA_MINIMA, Math.max(LARGURA_MINIMA, Math.floor(width * 0.9)))
  const altura = limitar(ALTURA_PADRAO, ALTURA_MINIMA, Math.max(ALTURA_MINIMA, Math.floor(height * 0.9)))
  return {
    versao: 2,
    x: x + Math.floor((width - largura) / 2),
    y: y + Math.floor((height - altura) / 2),
    largura,
    altura,
    monitorId: monitor.id,
    areaMonitor: criarAreaMonitor(monitor.workArea),
    escalaMonitor: monitor.scaleFactor,
    maximizada: true,
  }
}

export function normalizarEstadoJanelaPrincipal(valor: unknown): EstadoJanelaPrincipal {
  const padrao = estadoPadrao()
  if (!ehRegistro(valor)) return padrao
  const estado = valor
  if (
    (estado.versao !== 1 && estado.versao !== 2)
    || !Number.isFinite(estado.x)
    || !Number.isFinite(estado.y)
    || !Number.isFinite(estado.largura)
    || !Number.isFinite(estado.altura)
    || !Number.isFinite(estado.monitorId)
    || typeof estado.maximizada !== 'boolean'
  ) return padrao

  const monitores = screen.getAllDisplays()
  const monitorComMesmoId = monitores.find(item => item.id === estado.monitorId)
  const monitor = monitorComMesmoId
    || monitores.find(item => areaContemPonto(item.workArea, Number(estado.x), Number(estado.y)))
    || screen.getPrimaryDisplay()
  const { x, y, width, height } = monitor.workArea
  const areaMonitorSalva = estado.versao === 2 && ehAreaMonitor(estado.areaMonitor)
    ? estado.areaMonitor
    : null
  const escalaMonitorSalva = estado.versao === 2 && Number.isFinite(estado.escalaMonitor)
    ? Number(estado.escalaMonitor)
    : monitor.scaleFactor
  const restaurarProporcionalmente = areaMonitorSalva !== null
    && (!monitorComMesmoId || areaMudou(areaMonitorSalva, monitor.workArea, escalaMonitorSalva, monitor.scaleFactor))
  const larguraOriginal = Number(estado.largura)
  const alturaOriginal = Number(estado.altura)
  const larguraProporcional = restaurarProporcionalmente
    ? Math.round((larguraOriginal / areaMonitorSalva.largura) * width)
    : larguraOriginal
  const alturaProporcional = restaurarProporcionalmente
    ? Math.round((alturaOriginal / areaMonitorSalva.altura) * height)
    : alturaOriginal
  const largura = limitar(larguraProporcional, LARGURA_MINIMA, Math.max(LARGURA_MINIMA, Math.floor(width * 0.9)))
  const altura = limitar(alturaProporcional, ALTURA_MINIMA, Math.max(ALTURA_MINIMA, Math.floor(height * 0.9)))
  const xMaximo = x + Math.max(0, width - largura)
  const yMaximo = y + Math.max(0, height - altura)
  const xProporcional = restaurarProporcionalmente
    ? x + Math.round(calcularProporcao(Number(estado.x), areaMonitorSalva.x, areaMonitorSalva.largura - larguraOriginal) * (xMaximo - x))
    : Number(estado.x)
  const yProporcional = restaurarProporcionalmente
    ? y + Math.round(calcularProporcao(Number(estado.y), areaMonitorSalva.y, areaMonitorSalva.altura - alturaOriginal) * (yMaximo - y))
    : Number(estado.y)
  return {
    versao: 2,
    x: limitar(xProporcional, x, xMaximo),
    y: limitar(yProporcional, y, yMaximo),
    largura,
    altura,
    monitorId: monitor.id,
    areaMonitor: criarAreaMonitor(monitor.workArea),
    escalaMonitor: monitor.scaleFactor,
    maximizada: estado.maximizada,
  }
}

export async function carregarEstadoJanelaPrincipal(): Promise<EstadoJanelaPrincipal> {
  try {
    const armazenado = await configuracaoService.obter(CHAVE_ESTADO_JANELA_PRINCIPAL)
    return normalizarEstadoJanelaPrincipal(armazenado ? JSON.parse(armazenado) : null)
  } catch (error) {
    logError('Estado da janela principal ignorado', error)
    return estadoPadrao()
  }
}

export function observarEstadoJanelaPrincipal(janela: BrowserWindow): void {
  let temporizador: NodeJS.Timeout | null = null
  const salvar = () => {
    temporizador = null
    if (janela.isDestroyed()) return
    const limites = janela.isMaximized() ? janela.getNormalBounds() : janela.getBounds()
    const monitor = screen.getDisplayMatching(janela.getBounds())
    const estado: EstadoJanelaPrincipal = {
      versao: 2,
      x: limites.x,
      y: limites.y,
      largura: limites.width,
      altura: limites.height,
      monitorId: monitor.id,
      areaMonitor: criarAreaMonitor(monitor.workArea),
      escalaMonitor: monitor.scaleFactor,
      maximizada: janela.isMaximized(),
    }
    void configuracaoService.salvar(
      CHAVE_ESTADO_JANELA_PRINCIPAL,
      JSON.stringify(estado),
      'json',
      'Estado da janela principal',
    ).catch(error => logError('Erro ao salvar estado da janela principal', error))
  }
  const agendar = () => {
    if (temporizador) clearTimeout(temporizador)
    temporizador = setTimeout(salvar, 300)
  }
  janela.on('move', agendar)
  janela.on('resize', agendar)
  janela.on('maximize', agendar)
  janela.on('unmaximize', agendar)
  janela.once('close', () => {
    if (temporizador) clearTimeout(temporizador)
    salvar()
  })
}
