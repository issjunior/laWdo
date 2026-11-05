import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { apresentarConexaoGdl, esquemaEstadoConexaoGdl, INTERVALO_CONEXAO_GDL_MS, type EstadoConexaoGdl } from '@shared/gdl/conexao';

const esquemaResposta = z.object({ success: z.literal(true), data: esquemaEstadoConexaoGdl });

function useMonitorConexaoGdl() {
  const [estado, setEstado] = useState<EstadoConexaoGdl | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const verificarRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    let ativo = true;
    let atual: EstadoConexaoGdl | null = null;
    let ultimaTentativa = 0;
    let sequencia = 0;
    let ultimaAplicada = 0;
    let emVerificacao = false;
    let verificacaoPendente: Promise<void> | undefined;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const janelaAtiva = () => document.visibilityState === 'visible' && document.hasFocus();

    const agendar = () => {
      clearTimeout(temporizador);
      if (!ativo || !janelaAtiva() || emVerificacao) return;
      const ultimaRede = Math.max(atual?.redeVerificadaEm ? Date.parse(atual.redeVerificadaEm) : 0, atual?.acessoAutenticado?.realizadaEm ? Date.parse(atual.acessoAutenticado.realizadaEm) : 0);
      const restante = Math.max(0, Math.max(ultimaRede, ultimaTentativa) + INTERVALO_CONEXAO_GDL_MS - Date.now());
      temporizador = setTimeout(() => { void verificar(); }, restante);
    };

    const aplicar = (resposta: unknown, pedido: number) => {
      if (!ativo || pedido < ultimaAplicada) return;
      const validacao = esquemaResposta.safeParse(resposta);
      if (!validacao.success) {
        ultimaAplicada = pedido;
        setErro('Não foi possível obter o estado do GDL. Tente verificar novamente.');
        return;
      }
      const recebido = validacao.data.data;
      if (atual && (recebido.revisao < atual.revisao || recebido.versaoEstado < atual.versaoEstado)) return;
      if (atual && recebido.revisao !== atual.revisao) ultimaTentativa = 0;
      ultimaAplicada = pedido;
      atual = recebido;
      setEstado(recebido);
      setErro(null);

    };

    const atualizar = async (verificar: boolean) => {
      if (!ativo || (verificar && emVerificacao)) return;
      const pedido = ++sequencia;
      if (verificar) {
        emVerificacao = true;
        ultimaTentativa = Date.now();
        setVerificando(true);
      }
      try {
        const resposta = verificar ? await window.ipcAPI.gdl.verificarConexao() : await window.ipcAPI.gdl.obterEstadoConexao();
        aplicar(resposta, pedido);
      } catch {
        if (ativo && pedido >= ultimaAplicada) setErro('Não foi possível obter o estado do GDL. Tente verificar novamente.');
      } finally {
        if (verificar) {
          emVerificacao = false;
          if (ativo) setVerificando(false);
        }
        agendar();
      }
    };

    const verificar = () => {
      if (verificacaoPendente) return verificacaoPendente;
      verificacaoPendente = atualizar(true).finally(() => { verificacaoPendente = undefined; });
      return verificacaoPendente;
    };
    verificarRef.current = verificar;
    const remover = window.ipcAPI.gdl.onEstadoConexaoAlterado(recebido => {
      aplicar({ success: true, data: recebido }, ++sequencia);
      agendar();
    });
    const aoAlterarAtividade = () => { agendar(); };
    window.addEventListener('focus', aoAlterarAtividade);
    window.addEventListener('blur', aoAlterarAtividade);
    document.addEventListener('visibilitychange', aoAlterarAtividade);
    void atualizar(false);
    return () => {
      ativo = false;
      verificarRef.current = async () => undefined;
      clearTimeout(temporizador);
      remover();
      window.removeEventListener('focus', aoAlterarAtividade);
      window.removeEventListener('blur', aoAlterarAtividade);
      document.removeEventListener('visibilitychange', aoAlterarAtividade);
    };
  }, []);

  const verificarAgora = useCallback(() => verificarRef.current(), []);
  const resumo: ReturnType<typeof apresentarConexaoGdl> = useMemo(() => erro ? { aparencia: 'atencao' as const,
    mensagem: 'Não foi possível obter o estado do GDL', orientacao: erro } : apresentarConexaoGdl(estado), [estado, erro]);
  return { estado, erro, resumo, verificando: verificando || Boolean(estado?.verificando), verificarAgora };
}

export const ContextoConexaoGdl = createContext<ReturnType<typeof useMonitorConexaoGdl> | null>(null);

export function ConexaoGdlProvider({ children }: { children: ReactNode }) {
  const valor = useMonitorConexaoGdl();
  return <ContextoConexaoGdl.Provider value={valor}>{children}</ContextoConexaoGdl.Provider>;
}
