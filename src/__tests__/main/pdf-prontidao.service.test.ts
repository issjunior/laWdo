import { EventEmitter } from 'node:events';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow } from 'electron';
import { ErroGeracaoPdf, gerarPdfPreparado } from '../../main/services/pdf-prontidao.service';
import { criarOpcoesPdf } from '../../main/services/pdf-layout';

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

  it('mede o cabeçalho pronto antes de reservar sua altura nas opções de impressão', async () => {
    vi.mocked(BrowserWindow).mockImplementation(function () {
      const janela = criarJanela();
      if (janelas.length === 1) janela.webContents.executeJavaScript.mockResolvedValueOnce(pronta).mockResolvedValueOnce(96);
      janelas.push(janela);
      return janela as unknown as BrowserWindow;
    });
    const cabecalho = '<p>FLS. <span class="pageNumber"></span></p>';
    await gerarPdfPreparado('<p>Laudo</p>', criarOpcoesPdf({ top: 4, left: 3, right: 2, bottom: 2.5 }, cabecalho), cabecalho);
    expect(janelas[1].webContents.executeJavaScript).toHaveBeenCalledTimes(2);
    const opcoesRecebidas = janelas[0].webContents.printToPDF.mock.calls[0][0] as Electron.PrintToPDFOptions;
    expect((opcoesRecebidas.margins?.top ?? 0) * 2.54).toBeCloseTo(4 + 2.54 + 0.3);
    expect(opcoesRecebidas.headerTemplate).toContain('top: 4cm');
    expect(janelas.every(janela => janela.close.mock.calls.length === 1)).toBe(true);
  });

  it.each([null, 1500])('bloqueia cabeçalho que não pode ser medido ou não cabe na folha: %s', altura => {
    vi.mocked(BrowserWindow).mockImplementation(function () {
      const janela = criarJanela();
      if (janelas.length === 1) janela.webContents.executeJavaScript.mockResolvedValueOnce(pronta).mockResolvedValueOnce(altura);
      janelas.push(janela);
      return janela as unknown as BrowserWindow;
    });
    const cabecalho = '<p>Cabeçalho</p>';
    return expect(gerarPdfPreparado('<p>Laudo</p>', criarOpcoesPdf(undefined, cabecalho), cabecalho)).rejects.toMatchObject({
      falhaPdf: { codigo: 'CABECALHO_INDISPONIVEL', origem: 'cabecalho', tentarNovamente: false },
    });
  });

  it('ignora cabeçalho visualmente vazio sem reservar espaço adicional', async () => {
    vi.mocked(BrowserWindow).mockImplementation(function () {
      const janela = criarJanela();
      if (janelas.length === 1) janela.webContents.executeJavaScript.mockResolvedValueOnce(pronta).mockResolvedValueOnce(0);
      janelas.push(janela);
      return janela as unknown as BrowserWindow;
    });
    const cabecalho = '<p></p>';
    await gerarPdfPreparado('<p>Laudo</p>', criarOpcoesPdf({ top: 4, left: 3, right: 2, bottom: 2.5 }, cabecalho), cabecalho);
    expect(janelas[0].webContents.printToPDF).toHaveBeenCalledWith(expect.objectContaining({
      displayHeaderFooter: false, headerTemplate: undefined,
      margins: { top: 4 / 2.54, left: 3 / 2.54, right: 2 / 2.54, bottom: 2.5 / 2.54 },
    }));
  });

  it('ajusta tabelas de balística na largura útil das margens antes de imprimir', async () => {
    const html = '<table data-tabela-laudo="balistica"><tr><td>DELEGACIA</td></tr></table>';
    await gerarPdfPreparado(html, criarOpcoesPdf({ top: 3.5, left: 5, right: 5, bottom: 1.5 }));
    expect(janelas[0].webContents.executeJavaScript).toHaveBeenCalledTimes(2);
    const script = janelas[0].webContents.executeJavaScript.mock.calls[1][0];
    expect(script).toContain(String(11 * 96 / 2.54));
    expect(script).toContain('data-tabela-laudo');
    expect(janelas[0].webContents.printToPDF).toHaveBeenCalledTimes(1);
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
