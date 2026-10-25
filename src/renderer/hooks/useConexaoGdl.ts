import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { esquemaEstadoConexaoGdl, INTERVALO_CONEXAO_GDL_MS, VALIDADE_CONEXAO_GDL_MS, type EstadoConexaoGdl } from '@shared/gdl/conexao';

const esquemaResposta = z.object({ success: z.literal(true), data: esquemaEstadoConexaoGdl });

export function useConexaoGdl() {
  const [estado, setEstado] = useState<EstadoConexaoGdl | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [agora, setAgora] = useState(Date.now);
  const verificarRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    let ativo = true;
    let atual: EstadoConexaoGdl | null = null;
    let ultimaTentativa = 0;
    let sequencia = 0;
    let ultimaAplicada = 0;
    let emVerificacao = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let vencimento: ReturnType<typeof setTimeout> | undefined;
    const janelaAtiva = () => document.visibilityState === 'visible' && document.hasFocus();

    const agendar = () => {
      clearTimeout(temporizador);
      if (!ativo || !janelaAtiva() || emVerificacao) return;
      const ultimaRede = atual?.redeVerificadaEm ? Date.parse(atual.redeVerificadaEm) : 0;
      const restante = Math.max(0, Math.max(ultimaRede, ultimaTentativa) + INTERVALO_CONEXAO_GDL_MS - Date.now());
      temporizador = setTimeout(() => { void atualizar(true); }, restante);
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
      if (atual && recebido.revisao < atual.revisao) return;
      if (atual && recebido.revisao !== atual.revisao) ultimaTentativa = 0;
      ultimaAplicada = pedido;
      atual = recebido;
      setEstado(recebido);
      setErro(null);
      setAgora(Date.now());
      clearTimeout(vencimento);
      if (recebido.redeVerificadaEm) {
        const restante = Date.parse(recebido.redeVerificadaEm) + VALIDADE_CONEXAO_GDL_MS + 1 - Date.now();
        if (restante > 0) vencimento = setTimeout(() => { if (ativo) setAgora(Date.now()); }, restante);
      }
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

    verificarRef.current = () => atualizar(true);
    const remover = window.ipcAPI.gdl.onEstadoConexaoAlterado(() => { void atualizar(false); });
    const aoAlterarAtividade = () => { setAgora(Date.now()); agendar(); };
    window.addEventListener('focus', aoAlterarAtividade);
    window.addEventListener('blur', aoAlterarAtividade);
    document.addEventListener('visibilitychange', aoAlterarAtividade);
    void atualizar(false);
    return () => {
      ativo = false;
      verificarRef.current = async () => undefined;
      clearTimeout(temporizador);
      clearTimeout(vencimento);
      remover();
      window.removeEventListener('focus', aoAlterarAtividade);
      window.removeEventListener('blur', aoAlterarAtividade);
      document.removeEventListener('visibilitychange', aoAlterarAtividade);
    };
  }, []);

  const verificarAgora = useCallback(() => verificarRef.current(), []);
  return { estado, erro, verificando: verificando || Boolean(estado?.verificando), agora, verificarAgora };
}
