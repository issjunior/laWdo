import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelosIAPage } from '@/pages/ModelosIAPage';
import { ImagensPage } from '@/pages/ImagensPage';

const obter = vi.fn<(chave: string) => Promise<{ success: boolean; data?: unknown }>>();
const salvar = vi.fn().mockResolvedValue({ success: true });

beforeEach(() => {
  obter.mockReset();
  salvar.mockClear();
  obter.mockImplementation(async chave => chave === 'api_key_groq'
    ? { success: false }
    : { success: true, data: null });
  Object.assign(window.ipcAPI, { configuracao: { obter, salvar } });
});

describe('configurações de IA', () => {
  it('seleciona os padrões econômicos sem gravar configurações ausentes', async () => {
    render(<ImagensPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar prévia do editor' })).toBeEnabled());

    expect(within(screen.getByRole('radiogroup', { name: 'Perfil da prévia no editor' }))
      .getByRole('radio', { name: /^Econômico/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(screen.getByRole('radiogroup', { name: 'Qualidade da imagem enviada para descrição' }))
      .getByRole('radio', { name: /^Econômica/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/Limite atual: 480–640 px/)).toBeInTheDocument();
    expect(salvar).not.toHaveBeenCalled();
    expect(within(screen.getByRole('radiogroup', { name: 'Perfil da figura do laudo' }))
      .getByRole('radio', { name: /^Máxima economia/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('salva o perfil do laudo e a nova qualidade para IA de forma independente', async () => {
    render(<ImagensPage />);
    const laudo = within(screen.getByRole('radiogroup', { name: 'Perfil da figura do laudo' }));
    const ia = within(screen.getByRole('radiogroup', { name: 'Qualidade da imagem enviada para descrição' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar perfil do laudo' })).toBeEnabled());
    fireEvent.click(laudo.getByRole('radio', { name: /^Nítido/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil do laudo' }));
    await waitFor(() => expect(salvar).toHaveBeenCalledWith('perfil_figura_laudo', 'nitido', 'string', 'Perfil da figura do laudo e PDF'));
    expect(ia.getByRole('radio', { name: /^Econômica/ })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(ia.getByRole('radio', { name: /^Muito econômica/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar qualidade para IA' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Salvar qualidade para IA' }));
    await waitFor(() => expect(salvar).toHaveBeenCalledWith('qualidade_imagem_ia', JSON.stringify({ versao: 1, qualidade: 'muito_economica' }), 'json', 'Qualidade da imagem enviada para descrição por IA'));
  });

  it('mostra uma comparação sobreposta por grupo e destaca a escolha atual', async () => {
    render(<ImagensPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar perfil do laudo' })).toBeEnabled());
    expect(screen.getAllByRole('img', { name: /Comparação proporcional dos limites de imagem/ })).toHaveLength(3);
    const laudo = within(screen.getByRole('radiogroup', { name: 'Perfil da figura do laudo' }));
    expect(laudo.getAllByRole('radio').map(opcao => opcao.textContent)).toEqual([
      expect.stringContaining('Nítido'), expect.stringContaining('Equilibrado'),
      expect.stringContaining('Compacto'), expect.stringContaining('Máxima economia'),
    ]);
    const nitido = laudo.getByRole('radio', { name: /^Nítido/ });
    nitido.focus();
    expect(nitido).toHaveFocus();
    fireEvent.click(nitido);
    expect(screen.getByRole('img', { name: 'Comparação proporcional dos limites de imagem. Selecionado: Nítido' })).toBeInTheDocument();
    const ia = within(screen.getByRole('radiogroup', { name: 'Qualidade da imagem enviada para descrição' }));
    fireEvent.click(ia.getByRole('radio', { name: /^Original/ }));
    expect(screen.getByRole('img', { name: /Selecionado: Original, tamanho variável/ })).toBeInTheDocument();
  });

  it('carrega preferências válidas já salvas e conserva os dois grupos independentes', async () => {
    obter.mockImplementation(async chave => ({
      success: true,
      data: chave === 'perfil_previa_editor' ? 'nitido'
        : chave === 'qualidade_imagem_ia' ? JSON.stringify({ versao: 1, qualidade: 'alta' }) : null,
    }));
    render(<ImagensPage />);

    const previa = within(screen.getByRole('radiogroup', { name: 'Perfil da prévia no editor' }));
    const ia = within(screen.getByRole('radiogroup', { name: 'Qualidade da imagem enviada para descrição' }));
    await waitFor(() => expect(previa.getByRole('radio', { name: /^Nítido/ })).toHaveAttribute('aria-checked', 'true'));
    expect(ia.getByRole('radio', { name: /^Alta/ })).toHaveAttribute('aria-checked', 'true');
    expect(salvar).not.toHaveBeenCalled();

    fireEvent.click(previa.getByRole('radio', { name: /^Econômico/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar prévia do editor' }));
    await waitFor(() => expect(salvar).toHaveBeenCalledExactlyOnceWith(
      'perfil_previa_editor', 'economico', 'string', 'Perfil da prévia de imagens do editor',
    ));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar qualidade para IA' })).toBeEnabled());
    expect(ia.getByRole('radio', { name: /^Alta/ })).toHaveAttribute('aria-checked', 'true');

    salvar.mockClear();
    fireEvent.click(ia.getByRole('radio', { name: /^Econômica/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar qualidade para IA' }));
    await waitFor(() => expect(salvar).toHaveBeenCalledExactlyOnceWith(
      'qualidade_imagem_ia', JSON.stringify({ versao: 1, qualidade: 'economica' }), 'json', 'Qualidade da imagem enviada para descrição por IA',
    ));
    expect(previa.getByRole('radio', { name: /^Econômico/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('impede salvar chaves quando uma leitura falha e libera após nova tentativa', async () => {
    render(<ModelosIAPage />);
    fireEvent.click(screen.getByRole('button', { name: /Configurar provedor/i }));

    await waitFor(() => expect(screen.getByText(/Não foi possível carregar as configurações do provedor/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Salvar Configurações' })).toBeDisabled();
    expect(salvar).not.toHaveBeenCalled();

    obter.mockResolvedValue({ success: true, data: null });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar Configurações' })).toBeEnabled());
  });

  it.each([
    ['perfil_resposta_ia', 'as preferências das respostas', 'Salvar preferências'],
    ['privacidade_ia', 'a privacidade', 'Salvar privacidade do conteúdo'],
  ])('bloqueia o grupo %s quando sua leitura falha', async (chaveComFalha, nomeGrupo, nomeBotao) => {
    obter.mockImplementation(async chave => chave === chaveComFalha
      ? { success: false }
      : { success: true, data: null });
    render(<ModelosIAPage />);

    await waitFor(() => expect(screen.getByText(`Não foi possível carregar ${nomeGrupo}`)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: nomeBotao })).toBeDisabled();
    expect(salvar).not.toHaveBeenCalled();
  });

  it('bloqueia a qualidade da imagem para IA na página de imagens quando a leitura falha', async () => {
    obter.mockImplementation(async chave => chave === 'qualidade_imagem_ia'
      ? { success: false }
      : { success: true, data: null });
    render(<ImagensPage />);
    await waitFor(() => expect(screen.getByText('Não foi possível carregar todas as preferências de imagens.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Salvar qualidade para IA' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Salvar prévia do editor' })).toBeEnabled();
    expect(salvar).not.toHaveBeenCalled();
  });
});
