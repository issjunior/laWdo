import { EventEmitter } from 'node:events';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow } from 'electron';
import { ErroGeracaoPdf, gerarPdfPreparado } from '../../main/services/pdf-prontidao.service';

vi.mock('electron', () => ({
  app: { getPath: () => tmpdir() },
  BrowserWindow: vi.fn(),
}));

vi.mock('../../main/utils/logger.js', () => ({
  getLogger: () => ({ debug: vi.fn(), error: vi.fn() }),
}));

interface JanelaTeste extends EventEmitter {
  webContents: EventEmitter & {
    executeJavaScript: ReturnType<typeof vi.fn>;
    printToPDF: ReturnType<typeof vi.fn>;
  };
  loadFile: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  isDestroyed: ReturnType<typeof vi.fn>;
}

const opcoes: Electron.PrintToPDFOptions = { printBackground: true };
const pronta = { ok: true, imagens: 1, fontes: 0 };

function criarJanela(resposta: unknown = pronta): JanelaTeste {
  const janela = new EventEmitter() as JanelaTeste;
  let fechada = false;
  janela.webContents = Object.assign(new EventEmitter(), {
    executeJavaScript: vi.fn().mockResolvedValue(resposta),
    printToPDF: vi.fn().mockResolvedValue(Buffer.from('pdf')),
  });
  janela.loadFile = vi.fn().mockResolvedValue(undefined);
  janela.isDestroyed = vi.fn(() => fechada);
  janela.close = vi.fn(() => { fechada = true; janela.emit('closed'); });
  return janela;
}

describe('preparação compartilhada de PDF', () => {
  const janelas: JanelaTeste[] = [];

  beforeEach(() => {
    janelas.length = 0;
    vi.mocked(BrowserWindow).mockImplementation(function () {
      const janela = criarJanela();
      janelas.push(janela);
      return janela as unknown as BrowserWindow;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('imprime assim que corpo e cabeçalho ficam prontos e limpa ambas as janelas', async () => {
    const resultado = await gerarPdfPreparado('<p>laudo</p>', opcoes, '<img src="data:image/png;base64,AA==">');
    expect(resultado.toString()).toBe('pdf');
    expect(janelas).toHaveLength(2);
    expect(janelas[0].webContents.printToPDF).toHaveBeenCalledTimes(1);
    expect(janelas[1].webContents.printToPDF).not.toHaveBeenCalled();
    expect(janelas.every(janela => janela.close.mock.calls.length === 1)).toBe(true);
  });

  it('bloqueia impressão quando uma imagem falha e informa a posição', async () => {
    vi.mocked(BrowserWindow).mockImplementation(function () {
      const janela = criarJanela({ ok: false, codigo: 'IMAGEM_INDISPONIVEL', posicaoImagem: 2, imagens: 3, fontes: 0 });
      janelas.push(janela);
      return janela as unknown as BrowserWindow;
    });
    await expect(gerarPdfPreparado('<img>', opcoes)).rejects.toMatchObject({
      falhaPdf: { codigo: 'IMAGEM_INDISPONIVEL', etapa: 'recursos', posicaoImagem: 2, origem: 'corpo' },
    });
    expect(janelas[0].webContents.printToPDF).not.toHaveBeenCalled();
    expect(janelas[0].close).toHaveBeenCalledTimes(1);
  });

  it('aguarda um recurso lento antes de iniciar a impressão', async () => {
    let liberar: (resultado: unknown) => void = () => undefined;
    vi.mocked(BrowserWindow).mockImplementation(function () {
      const janela = criarJanela();
      janela.webContents.executeJavaScript.mockImplementation(() => new Promise(resolve => { liberar = resolve; }));
      janelas.push(janela);
      return janela as unknown as BrowserWindow;
    });
    const geracao = gerarPdfPreparado('<img>', opcoes);
    await vi.waitFor(() => expect(janelas[0]?.webContents.executeJavaScript).toHaveBeenCalled());
    expect(janelas[0].webContents.printToPDF).not.toHaveBeenCalled();
    liberar(pronta);
    await expect(geracao).resolves.toBeInstanceOf(Buffer);
    expect(janelas[0].webContents.printToPDF).toHaveBeenCalledTimes(1);
  });

  it('bloqueia a geração quando a fonte do cabeçalho falha', async () => {
    vi.mocked(BrowserWindow).mockImplementation(function () {
      const janela = criarJanela(janelas.length === 0 ? pronta : { ok: false, codigo: 'FONTE_INDISPONIVEL', imagens: 0, fontes: 1 });
      janelas.push(janela);
      return janela as unknown as BrowserWindow;
    });
    await expect(gerarPdfPreparado('<p>laudo</p>', opcoes, '<p>cabeçalho</p>')).rejects.toMatchObject({
      falhaPdf: { codigo: 'FONTE_INDISPONIVEL', origem: 'cabecalho' },
    });
    expect(janelas[0].webContents.printToPDF).not.toHaveBeenCalled();
    expect(janelas.every(janela => janela.close.mock.calls.length === 1)).toBe(true);
  });

  it('encerra uma preparação travada e permite nova tentativa', async () => {
    vi.useFakeTimers();
    vi.mocked(BrowserWindow).mockImplementationOnce(function () {
      const janela = criarJanela();
      janela.loadFile.mockImplementation(() => new Promise(() => undefined));
      janelas.push(janela);
      return janela as unknown as BrowserWindow;
    });
    const tentativa = gerarPdfPreparado('<p>laudo</p>', opcoes);
    const falha = expect(tentativa).rejects.toMatchObject({
      falhaPdf: { codigo: 'TEMPO_EXCEDIDO', etapa: 'carregamento' },
    });
    await vi.advanceTimersByTimeAsync(15_001);
    await falha;
    expect(janelas[0].close).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    await expect(gerarPdfPreparado('<p>laudo</p>', opcoes)).resolves.toBeInstanceOf(Buffer);
  });

  it('encerra a impressão travada sem aceitar resultado posterior', async () => {
    vi.useFakeTimers();
    vi.mocked(BrowserWindow).mockImplementation(function () {
      const janela = criarJanela();
      janela.webContents.printToPDF.mockImplementation(() => new Promise(() => undefined));
      janelas.push(janela);
      return janela as unknown as BrowserWindow;
    });
    const tentativa = gerarPdfPreparado('<p>laudo</p>', opcoes);
    const falha = expect(tentativa).rejects.toMatchObject({
      falhaPdf: { codigo: 'TEMPO_EXCEDIDO', etapa: 'impressao' },
    });
    await vi.advanceTimersByTimeAsync(30_001);
    await falha;
    expect(janelas[0].close).toHaveBeenCalledTimes(1);
  });

  it('trata encerramento do renderer e rejeição da impressão', async () => {
    vi.mocked(BrowserWindow).mockImplementationOnce(function () {
      const janela = criarJanela();
      janela.webContents.printToPDF.mockRejectedValue(new Error('falha interna'));
      janelas.push(janela);
      return janela as unknown as BrowserWindow;
    });
    await expect(gerarPdfPreparado('<p>laudo</p>', opcoes)).rejects.toBeInstanceOf(ErroGeracaoPdf);
    vi.mocked(BrowserWindow).mockImplementationOnce(function () {
      const janela = criarJanela();
      janela.loadFile.mockImplementation(() => {
        queueMicrotask(() => janela.webContents.emit('render-process-gone'));
        return new Promise(() => undefined);
      });
      janelas.push(janela);
      return janela as unknown as BrowserWindow;
    });
    await expect(gerarPdfPreparado('<p>laudo</p>', opcoes)).rejects.toMatchObject({
      falhaPdf: { codigo: 'FALHA_PDF', etapa: 'carregamento' },
    });
  });
});
