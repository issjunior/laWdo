import { act, renderHook, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONFIGURACAO_PROVEDOR_IA_PADRAO,
  useConfiguracoesIa,
  type CamposProvedorIa,
} from '@/hooks/useConfiguracoesIa';

const obter = vi.fn<(chave: string) => Promise<{ success: boolean; data?: unknown }>>();
const obterEstadoCredenciais = vi.fn();

function useConfiguracoesTeste() {
  const formulario = useForm<CamposProvedorIa>({ defaultValues: CONFIGURACAO_PROVEDOR_IA_PADRAO });
  return { formulario, ...useConfiguracoesIa(formulario) };
}

beforeEach(() => {
  obter.mockReset();
  obter.mockResolvedValue({ success: true, data: null });
  obterEstadoCredenciais.mockReset();
  obterEstadoCredenciais.mockResolvedValue({ success: true, data: { groqConfigurada: false, geminiConfigurada: false } });
  Object.assign(window.ipcAPI, { configuracao: { obter }, ia: { obterEstadoCredenciais } });
});

describe('useConfiguracoesIa', () => {
  it('aplica padrões apenas para configurações ausentes', async () => {
    const { result } = renderHook(useConfiguracoesTeste);

    await waitFor(() => expect(Object.values(result.current.estados)).toEqual(['pronto', 'pronto', 'pronto', 'pronto']));
    expect(result.current.formulario.getValues()).toEqual(CONFIGURACAO_PROVEDOR_IA_PADRAO);
    expect(result.current.privacidade.enviarConteudoIntegral).toBe(true);
    expect(obter).toHaveBeenCalledTimes(6);
    expect(obterEstadoCredenciais).toHaveBeenCalledTimes(1);
  });

  it('isola falha parcial e preserva um campo editado na nova tentativa', async () => {
    obterEstadoCredenciais.mockResolvedValueOnce({ success: false });
    const { result } = renderHook(useConfiguracoesTeste);
    await waitFor(() => expect(result.current.estados.provedor).toBe('erro'));
    expect(result.current.motivosErro.provedor).toBe('falha_leitura');
    expect(result.current.estados.perfil).toBe('pronto');

    act(() => result.current.formulario.setValue('modeloGroq', 'modelo editado', { shouldDirty: true }));
    obterEstadoCredenciais.mockResolvedValue({ success: true, data: { groqConfigurada: true, geminiConfigurada: false } });
    await act(async () => { await result.current.recarregarGrupo('provedor'); });

    expect(result.current.estados.provedor).toBe('pronto');
    expect(result.current.formulario.getValues('modeloGroq')).toBe('modelo editado');
    expect(result.current.chavesConfiguradas.groq).toBe(true);
  });

  it('recusa valores estruturados inválidos e preserva uma edição após recuperar a leitura', async () => {
    obter.mockImplementation(async chave => ({ success: true, data: chave === 'privacidade_ia' ? '{invalido' : null }));
    const { result } = renderHook(useConfiguracoesTeste);
    await waitFor(() => expect(result.current.estados.privacidade).toBe('erro'));
    expect(result.current.motivosErro.privacidade).toBe('valor_invalido');

    act(() => result.current.setPrivacidade({ versao: 1, enviarConteudoIntegral: false }));
    obter.mockResolvedValue({ success: true, data: JSON.stringify({ versao: 1, enviarConteudoIntegral: true }) });
    await act(async () => { await result.current.recarregarGrupo('privacidade'); });

    expect(result.current.estados.privacidade).toBe('pronto');
    expect(result.current.privacidade.enviarConteudoIntegral).toBe(false);
  });

  it('não aceita provedor nem perfil salvos com valores inválidos', async () => {
    obter.mockImplementation(async chave => ({
      success: true,
      data: chave === 'provedor_ia' ? 'outro' : chave === 'perfil_resposta_ia' ? '{}' : null,
    }));
    const { result } = renderHook(useConfiguracoesTeste);

    await waitFor(() => expect(result.current.estados.provedor).toBe('erro'));
    await waitFor(() => expect(result.current.estados.perfil).toBe('erro'));
    expect(result.current.motivosErro.provedor).toBe('valor_invalido');
    expect(result.current.motivosErro.perfil).toBe('valor_invalido');
  });

  it('ignora resposta atrasada de tentativa anterior', async () => {
    let resolverPrimeira: ((valor: { success: boolean; data: string }) => void) | undefined;
    const primeira = new Promise<{ success: boolean; data: string }>(resolver => { resolverPrimeira = resolver; });
    obter.mockImplementation(chave => chave === 'provedor_ia' ? primeira : Promise.resolve({ success: true, data: null }));
    const { result } = renderHook(useConfiguracoesTeste);
    await waitFor(() => expect(obter).toHaveBeenCalledWith('provedor_ia'));

    obter.mockResolvedValue({ success: true, data: null });
    await act(async () => { await result.current.recarregarGrupo('provedor'); });
    expect(result.current.estados.provedor).toBe('pronto');

    await act(async () => { resolverPrimeira?.({ success: true, data: 'gemini' }); await primeira; });
    expect(result.current.formulario.getValues('provedor')).toBe('groq');
  });
});
