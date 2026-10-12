import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  CONFIGURACAO_IMAGEM_IA_PADRAO,
  CONFIGURACAO_PRIVACIDADE_IA_PADRAO,
  PERFIL_RESPOSTA_IA_PADRAO,
  configuracaoImagemIaValida,
  configuracaoPrivacidadeIaValida,
  perfilRespostaIaValido,
  type ConfiguracaoImagemIa,
  type ConfiguracaoPrivacidadeIa,
  type PerfilRespostaIa,
} from '@shared/types/ia.types';

export interface CamposProvedorIa {
  provedor: 'groq' | 'gemini';
  apiKeyGroq?: string;
  apiKeyGemini?: string;
  modeloGroq: string;
  modeloGemini: string;
}

export const CONFIGURACAO_PROVEDOR_IA_PADRAO: CamposProvedorIa = {
  provedor: 'groq',
  apiKeyGroq: '',
  apiKeyGemini: '',
  modeloGroq: 'llama-3.3-70b-versatile',
  modeloGemini: 'gemini-2.5-flash',
};

export type GrupoConfiguracaoIa = 'provedor' | 'perfil' | 'privacidade' | 'imagem';
export type EstadoCarregamentoIa = 'carregando' | 'pronto' | 'erro';
export type MotivoErroCarregamentoIa = 'falha_leitura' | 'valor_invalido';

const grupos: GrupoConfiguracaoIa[] = ['provedor', 'perfil', 'privacidade', 'imagem'];
const chavesPorGrupo: Record<GrupoConfiguracaoIa, string[]> = {
  provedor: ['provedor_ia', 'api_key_groq', 'api_key_gemini', 'modelo_ia_padrao', 'modelo_gemini_padrao'],
  perfil: ['perfil_resposta_ia'],
  privacidade: ['privacidade_ia'],
  imagem: ['qualidade_imagem_ia'],
};

const camposPorChave = {
  provedor_ia: 'provedor',
  api_key_groq: 'apiKeyGroq',
  api_key_gemini: 'apiKeyGemini',
  modelo_ia_padrao: 'modeloGroq',
  modelo_gemini_padrao: 'modeloGemini',
} as const;

function lerValorResposta(resposta: unknown): string | null {
  if (!resposta || typeof resposta !== 'object' || !('success' in resposta) || resposta.success !== true || !('data' in resposta)) {
    throw new Error('LEITURA_CONFIGURACAO_FALHOU');
  }
  if (resposta.data === null) return null;
  if (typeof resposta.data !== 'string') throw new Error('CONFIGURACAO_INVALIDA');
  return resposta.data;
}

function lerEstrutura<T>(valor: string | null, padrao: T, validar: (entrada: unknown) => entrada is T): T {
  if (valor === null) return padrao;
  let entrada: unknown;
  try {
    entrada = JSON.parse(valor);
  } catch {
    throw new Error('CONFIGURACAO_INVALIDA');
  }
  if (!validar(entrada)) throw new Error('CONFIGURACAO_INVALIDA');
  return entrada;
}

export function useConfiguracoesIa(formulario: Pick<UseFormReturn<CamposProvedorIa>, 'getFieldState' | 'setValue'>) {
  const formularioRef = useRef(formulario);
  formularioRef.current = formulario;
  const sequenciasRef = useRef<Record<GrupoConfiguracaoIa, number>>({ provedor: 0, perfil: 0, privacidade: 0, imagem: 0 });
  const editadoRef = useRef({ perfil: false, privacidade: false, imagem: false });
  const [estados, setEstados] = useState<Record<GrupoConfiguracaoIa, EstadoCarregamentoIa>>({
    provedor: 'carregando', perfil: 'carregando', privacidade: 'carregando', imagem: 'carregando',
  });
  const [motivosErro, setMotivosErro] = useState<Record<GrupoConfiguracaoIa, MotivoErroCarregamentoIa | null>>({
    provedor: null, perfil: null, privacidade: null, imagem: null,
  });
  const [perfil, definirPerfil] = useState<PerfilRespostaIa>(PERFIL_RESPOSTA_IA_PADRAO);
  const [privacidade, definirPrivacidade] = useState<ConfiguracaoPrivacidadeIa>(CONFIGURACAO_PRIVACIDADE_IA_PADRAO);
  const [configuracaoImagem, definirConfiguracaoImagem] = useState<ConfiguracaoImagemIa>(CONFIGURACAO_IMAGEM_IA_PADRAO);

  const setPerfil: Dispatch<SetStateAction<PerfilRespostaIa>> = useCallback(valor => {
    editadoRef.current.perfil = true;
    definirPerfil(valor);
  }, []);
  const setPrivacidade: Dispatch<SetStateAction<ConfiguracaoPrivacidadeIa>> = useCallback(valor => {
    editadoRef.current.privacidade = true;
    definirPrivacidade(valor);
  }, []);
  const setConfiguracaoImagem: Dispatch<SetStateAction<ConfiguracaoImagemIa>> = useCallback(valor => {
    editadoRef.current.imagem = true;
    definirConfiguracaoImagem(valor);
  }, []);

  const carregarGrupo = useCallback(async (grupo: GrupoConfiguracaoIa) => {
    const sequencia = ++sequenciasRef.current[grupo];
    setEstados(atuais => ({ ...atuais, [grupo]: 'carregando' }));
    setMotivosErro(atuais => ({ ...atuais, [grupo]: null }));
    const chaves = chavesPorGrupo[grupo];
    const resultados = await Promise.allSettled(chaves.map(chave => window.ipcAPI.configuracao.obter(chave)));
    if (sequenciasRef.current[grupo] !== sequencia) return;

    let motivoErro: MotivoErroCarregamentoIa | null = null;
    resultados.forEach((resultado, indice) => {
      try {
        if (resultado.status === 'rejected') throw new Error('LEITURA_CONFIGURACAO_FALHOU');
        const valor = lerValorResposta(resultado.value);
        const chave = chaves[indice];
        if (grupo === 'provedor' && chave in camposPorChave) {
          const campo = camposPorChave[chave as keyof typeof camposPorChave];
          const valorFinal = valor ?? CONFIGURACAO_PROVEDOR_IA_PADRAO[campo] ?? '';
          if (campo === 'provedor' && valorFinal !== 'groq' && valorFinal !== 'gemini') throw new Error('CONFIGURACAO_INVALIDA');
          if ((campo === 'modeloGroq' || campo === 'modeloGemini') && !valorFinal.trim()) throw new Error('CONFIGURACAO_INVALIDA');
          if (!formularioRef.current.getFieldState(campo).isDirty) formularioRef.current.setValue(campo, valorFinal);
        } else if (grupo === 'perfil') {
          const perfilLido = lerEstrutura(valor, PERFIL_RESPOSTA_IA_PADRAO, perfilRespostaIaValido);
          if (!editadoRef.current.perfil) definirPerfil(perfilLido);
        } else if (grupo === 'privacidade') {
          const privacidadeLida = lerEstrutura(valor, CONFIGURACAO_PRIVACIDADE_IA_PADRAO, configuracaoPrivacidadeIaValida);
          if (!editadoRef.current.privacidade) definirPrivacidade(privacidadeLida);
        } else if (grupo === 'imagem') {
          const imagemLida = lerEstrutura(valor, CONFIGURACAO_IMAGEM_IA_PADRAO, configuracaoImagemIaValida);
          if (!editadoRef.current.imagem) definirConfiguracaoImagem(imagemLida);
        }
      } catch (erro) {
        if (erro instanceof Error && erro.message === 'CONFIGURACAO_INVALIDA') motivoErro = 'valor_invalido';
        else if (!motivoErro) motivoErro = 'falha_leitura';
      }
    });
    setMotivosErro(atuais => ({ ...atuais, [grupo]: motivoErro }));
    setEstados(atuais => ({ ...atuais, [grupo]: motivoErro ? 'erro' : 'pronto' }));
  }, []);

  useEffect(() => {
    const sequencias = sequenciasRef.current;
    void Promise.allSettled(grupos.map(grupo => carregarGrupo(grupo)));
    return () => { grupos.forEach(grupo => { sequencias[grupo] += 1; }); };
  }, [carregarGrupo]);

  return {
    estados,
    motivosErro,
    recarregarGrupo: carregarGrupo,
    perfil,
    setPerfil,
    privacidade,
    setPrivacidade,
    configuracaoImagem,
    setConfiguracaoImagem,
  };
}
