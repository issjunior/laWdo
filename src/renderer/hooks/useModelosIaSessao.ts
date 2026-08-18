import { useEffect, useState } from 'react';

export type DisponibilidadeModeloIa = 'disponivel' | 'nao_verificado' | 'removido' | 'sem_chave';

export interface ModeloIaSessao {
  id: string;
  rotulo: string;
  disponibilidade: DisponibilidadeModeloIa;
}

export function useModelosIaSessao(laudoId: string | undefined) {
  const [modeloIaSessao, setModeloIaSessao] = useState<string | null>(null);
  const [provedorIaSessao, setProvedorIaSessao] = useState<'groq' | 'gemini' | null>(null);
  const [modelosIaSessao, setModelosIaSessao] = useState<ModeloIaSessao[]>([]);

  useEffect(() => {
    if (!laudoId) {
      setModeloIaSessao(null);
      setProvedorIaSessao(null);
      setModelosIaSessao([]);
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

    void window.ipcAPI.ia.listarModelos().then(resposta => {
      const dados: unknown = resposta.data;
      if (!ativo || !resposta.success || !Array.isArray(dados)) return;
      const modelos = dados.flatMap(item => {
        if (!item || typeof item !== 'object') return [];
        const modelo = item as Record<string, unknown>;
        return typeof modelo.id === 'string' && typeof modelo.rotulo === 'string'
          && ['disponivel', 'nao_verificado', 'removido', 'sem_chave'].includes(String(modelo.disponibilidade))
          ? [{ id: modelo.id, rotulo: modelo.rotulo, disponibilidade: modelo.disponibilidade as DisponibilidadeModeloIa }]
          : [];
      });
      setModelosIaSessao(modelos);
    }).catch(() => undefined);

    return () => { ativo = false; };
  }, [laudoId]);

  return {
    modeloIaSessao,
    setModeloIaSessao,
    provedorIaSessao,
    modelosIaSessao,
  };
}
