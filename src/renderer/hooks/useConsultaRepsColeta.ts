import { useEffect, useRef } from 'react';
import type { RepsMesmoCasoGdl } from '@shared/gdl/reps-mesmo-caso';
import { consultarRepsColetaLaudo } from '@/lib/consulta-reps-coleta';

interface OpcoesConsultaColeta {
  laudoId?: string;
  sessao: number;
  habilitada: boolean;
  aoAplicar: (referencias: RepsMesmoCasoGdl) => void;
  aoFalhar: (erro: unknown) => void;
}

export function useConsultaRepsColeta(opcoes: OpcoesConsultaColeta): void {
  const callbacks = useRef(opcoes);
  callbacks.current = opcoes;
  const consulta = useRef<{ chave: string; promessa: Promise<RepsMesmoCasoGdl> } | null>(null);
  const { laudoId, sessao, habilitada } = opcoes;
  useEffect(() => {
    if (!laudoId || !habilitada) return;
    const chave = JSON.stringify([laudoId, sessao]);
    if (consulta.current?.chave !== chave) consulta.current = { chave, promessa: consultarRepsColetaLaudo(laudoId) };
    let ativa = true;
    const contextoAtual = () => ativa && callbacks.current.laudoId === laudoId && callbacks.current.sessao === sessao && callbacks.current.habilitada;
    void consulta.current.promessa.then(referencias => {
      if (contextoAtual()) callbacks.current.aoAplicar(referencias);
    }).catch((erro: unknown) => {
      if (contextoAtual()) callbacks.current.aoFalhar(erro);
    });
    return () => { ativa = false; };
  }, [laudoId, sessao, habilitada]);
}
