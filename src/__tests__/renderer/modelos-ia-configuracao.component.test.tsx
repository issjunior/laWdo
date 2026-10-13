import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ModelosIAPage } from '@/pages/ModelosIAPage';

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
    ['qualidade_imagem_ia', 'a qualidade da imagem', 'Salvar qualidade da imagem'],
  ])('bloqueia o grupo %s quando sua leitura falha', async (chaveComFalha, nomeGrupo, nomeBotao) => {
    obter.mockImplementation(async chave => chave === chaveComFalha
      ? { success: false }
      : { success: true, data: null });
    render(<ModelosIAPage />);

    await waitFor(() => expect(screen.getByText(`Não foi possível carregar ${nomeGrupo}`)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: nomeBotao })).toBeDisabled();
    expect(salvar).not.toHaveBeenCalled();
  });
});
