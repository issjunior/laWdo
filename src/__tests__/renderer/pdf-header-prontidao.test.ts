import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPdfHeaderConfig, ErroCabecalhoPdf } from '../../renderer/lib/pdf-header';
import { mensagemFalhaPdf, validarFalhaPdf } from '../../renderer/lib/falha-pdf';

const obter = vi.fn();

const configuracaoOriginal = window.ipcAPI.configuracao;
Object.assign(window.ipcAPI, { configuracao: { ...configuracaoOriginal, obter } });

afterEach(() => {
  obter.mockReset();
  Object.assign(window.ipcAPI, { configuracao: { ...configuracaoOriginal, obter } });
});

describe('cabeçalho do PDF', () => {
  it('aceita configuração legitimamente ausente', async () => {
    obter.mockResolvedValue({ success: true, data: null });
    await expect(buildPdfHeaderConfig({ estrito: true })).resolves.toMatchObject({
      headerTemplate: '',
      cabecalhoPrimeiraPagina: '',
    });
  });

  it('bloqueia PDF quando leitura falha ou retorna conteúdo inválido', async () => {
    obter.mockResolvedValueOnce({ success: false, error: 'Falha na leitura' })
      .mockResolvedValueOnce({ success: true, data: null });
    await expect(buildPdfHeaderConfig({ estrito: true })).rejects.toBeInstanceOf(ErroCabecalhoPdf);

    obter.mockResolvedValueOnce({ success: true, data: {} })
      .mockResolvedValueOnce({ success: true, data: null });
    await expect(buildPdfHeaderConfig({ estrito: true })).rejects.toBeInstanceOf(ErroCabecalhoPdf);
  });

  it('orienta a nova tentativa sem usar detalhes da resposta IPC', () => {
    const recebido: unknown = {
      codigo: 'IMAGEM_INDISPONIVEL',
      etapa: 'recursos',
      tentarNovamente: true,
      posicaoImagem: 2,
      origem: 'cabecalho',
    };
    expect(validarFalhaPdf(recebido)).toBe(true);
    if (!validarFalhaPdf(recebido)) return;
    expect(mensagemFalhaPdf(recebido)).toContain('posição 2');
    expect(validarFalhaPdf({ codigo: 'DESCONHECIDO', etapa: 'recursos' })).toBe(false);
  });
});
