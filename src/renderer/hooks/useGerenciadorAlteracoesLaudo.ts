import { useCallback, useRef, useState } from 'react';

export type EstadoSalvamentoLaudo = 'salvo' | 'pendente' | 'salvando' | 'erro';
export type OrigemAlteracaoLaudo = 'usuario' | 'ia' | 'normalizacao-inicial';

export function useGerenciadorAlteracoesLaudo() {
  const [estadoSalvamento, setEstadoSalvamento] = useState<EstadoSalvamentoLaudo>('salvo');
  const sessaoAtivaRef = useRef(false);
  const salvamentoEmAndamentoRef = useRef(false);
  const alterouDuranteSalvamentoRef = useRef(false);
  const ignorandoAlteracoesRef = useRef(0);

  const iniciarSessao = useCallback(() => {
    sessaoAtivaRef.current = true;
    salvamentoEmAndamentoRef.current = false;
    alterouDuranteSalvamentoRef.current = false;
    ignorandoAlteracoesRef.current = 0;
    setEstadoSalvamento('salvo');
  }, []);

  const encerrarSessao = useCallback(() => {
    sessaoAtivaRef.current = false;
    salvamentoEmAndamentoRef.current = false;
    alterouDuranteSalvamentoRef.current = false;
    ignorandoAlteracoesRef.current = 0;
    setEstadoSalvamento('salvo');
  }, []);

  const registrarAlteracao = useCallback((origem: OrigemAlteracaoLaudo = 'usuario') => {
    if (
      !sessaoAtivaRef.current
      || ignorandoAlteracoesRef.current > 0
      || origem === 'normalizacao-inicial'
    ) {
      return;
    }

    if (salvamentoEmAndamentoRef.current) {
      alterouDuranteSalvamentoRef.current = true;
      return;
    }

    setEstadoSalvamento('pendente');
  }, []);

  const iniciarSalvamento = useCallback((): boolean => {
    if (!sessaoAtivaRef.current || salvamentoEmAndamentoRef.current) return false;

    salvamentoEmAndamentoRef.current = true;
    alterouDuranteSalvamentoRef.current = false;
    setEstadoSalvamento('salvando');
    return true;
  }, []);

  const concluirSalvamento = useCallback(() => {
    salvamentoEmAndamentoRef.current = false;
    setEstadoSalvamento(alterouDuranteSalvamentoRef.current ? 'pendente' : 'salvo');
    alterouDuranteSalvamentoRef.current = false;
  }, []);

  const falharSalvamento = useCallback(() => {
    salvamentoEmAndamentoRef.current = false;
    alterouDuranteSalvamentoRef.current = false;
    setEstadoSalvamento('erro');
  }, []);

  const executarSemRegistrar = useCallback((acao: () => void) => {
    ignorandoAlteracoesRef.current += 1;
    try {
      acao();
    } finally {
      setTimeout(() => {
        ignorandoAlteracoesRef.current = Math.max(0, ignorandoAlteracoesRef.current - 1);
      }, 0);
    }
  }, []);

  return {
    estadoSalvamento,
    alteracoesPendentes: estadoSalvamento !== 'salvo',
    salvando: estadoSalvamento === 'salvando',
    iniciarSessao,
    encerrarSessao,
    registrarAlteracao,
    iniciarSalvamento,
    concluirSalvamento,
    falharSalvamento,
    executarSemRegistrar,
  };
}
