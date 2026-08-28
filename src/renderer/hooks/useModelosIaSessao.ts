import { useEffect, useState } from 'react';

export function useModelosIaSessao(laudoId: string | undefined) {
  const [modeloIaSessao, setModeloIaSessao] = useState<string | null>(null);
  const [provedorIaSessao, setProvedorIaSessao] = useState<'groq' | 'gemini' | null>(null);

  useEffect(() => {
    if (!laudoId) {
      setModeloIaSessao(null);
      setProvedorIaSessao(null);
      return;
    }

    let ativo = true;
    void window.ipcAPI.ia.obterContexto().then(resposta => {
      const dados: unknown = resposta.data;
      if (!ativo || !resposta.success || !dados || typeof dados !== 'object') return;
      const contexto = dados as { provedor?: unknown; modelo?: unknown };
      if ((contexto.provedor === 'groq' || contexto.provedor === 'gemini') && typeof contexto.modelo === 'string') {
        setProvedorIaSessao(contexto.provedor);
        setModeloIaSessao(contexto.modelo);
      }
    }).catch(() => undefined);

    return () => { ativo = false; };
  }, [laudoId]);

  return {
    modeloIaSessao,
    setModeloIaSessao,
    provedorIaSessao,
  };
}
