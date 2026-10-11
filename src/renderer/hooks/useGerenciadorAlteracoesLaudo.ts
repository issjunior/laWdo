import { useCallback, useRef, useState } from 'react';
import type { EventoEditorLaudo } from '@shared/diagnostico/contratos';
import { capturaProblemaLaudoAtiva, registrarDiagnosticoEditorLaudo, resumirComparacaoEditorLaudo } from '@/lib/diagnostico-editor-laudo';

export type EstadoSalvamentoLaudo = 'salvo' | 'pendente' | 'salvando' | 'erro';
export type OrigemAlteracaoLaudo = 'usuario' | 'ia' | 'normalizacao-inicial';

export function useGerenciadorAlteracoesLaudo(obterContexto?: () => Pick<EventoEditorLaudo, 'montagem' | 'modo'>) {
  const [estadoSalvamento, setEstadoSalvamento] = useState<EstadoSalvamentoLaudo>('salvo');
  const [alteracoesPendentes, setAlteracoesPendentes] = useState(false);
  const [revisaoAlteracoes, setRevisaoAlteracoes] = useState(0);
  const [inicializando, setInicializando] = useState(false);
  const sessaoRef = useRef(0);
  const sessaoAtivaRef = useRef(false);
  const salvamentoEmAndamentoRef = useRef(false);
  const conteudoSalvoRef = useRef('');
  const aguardandoInicializacaoRef = useRef(false);
  const pendenteRef = useRef(false);
  const contextoRef = useRef(obterContexto);
  contextoRef.current = obterContexto;
  const registrar = useCallback((evento: EventoEditorLaudo['evento'], dados: Partial<EventoEditorLaudo> = {}) => {
    if (!capturaProblemaLaudoAtiva()) return;
    registrarDiagnosticoEditorLaudo({ evento, sessao: sessaoRef.current, montagem: contextoRef.current?.().montagem ?? 0, modo: contextoRef.current?.().modo ?? 'single', ...dados });
  }, []);
  const registrarComparacao = useCallback((referencia: string, atual: string, origem?: EventoEditorLaudo['origem']) => {
    if (!capturaProblemaLaudoAtiva()) return;
    registrar('conteudo_comparado', { origem, ...resumirComparacaoEditorLaudo(referencia, atual) });
  }, [registrar]);

  const iniciarSessao = useCallback((conteudoSalvo = '', aguardarInicializacao = false) => {
    sessaoRef.current += 1;
    sessaoAtivaRef.current = true;
    salvamentoEmAndamentoRef.current = false;
    conteudoSalvoRef.current = conteudoSalvo;
    aguardandoInicializacaoRef.current = aguardarInicializacao;
    pendenteRef.current = false;
    registrar('sessao_aberta', { referenciaTamanho: conteudoSalvo.length, motivo: aguardarInicializacao ? 'aguardando_inicializacao' : undefined });
    setInicializando(aguardarInicializacao);
    setAlteracoesPendentes(false);
    setEstadoSalvamento('salvo');
  }, [registrar]);

  const encerrarSessao = useCallback(() => {
    registrar('sessao_encerrada', { pendente: pendenteRef.current });
    sessaoRef.current += 1;
    sessaoAtivaRef.current = false;
    salvamentoEmAndamentoRef.current = false;
    conteudoSalvoRef.current = '';
    aguardandoInicializacaoRef.current = false;
    pendenteRef.current = false;
    setInicializando(false);
    setAlteracoesPendentes(false);
    setEstadoSalvamento('salvo');
  }, [registrar]);

  const atualizarConteudo = useCallback((conteudo: string, momento: 'automatico' | 'voltar' = 'automatico'): boolean => {
    if (!sessaoAtivaRef.current || aguardandoInicializacaoRef.current) {
      if (momento === 'voltar') registrar('voltar_solicitado', { pendente: false, motivo: sessaoAtivaRef.current ? 'aguardando_inicializacao' : 'sessao_inativa' });
      return false;
    }
    const pendente = conteudo !== conteudoSalvoRef.current;
    if (momento === 'voltar') registrar('voltar_solicitado', { pendente, motivo: pendente ? 'alteracao_real' : 'sem_alteracao' });
    if (momento === 'voltar' || pendente !== pendenteRef.current) registrarComparacao(conteudoSalvoRef.current, conteudo, 'automatica');
    pendenteRef.current = pendente;
    setAlteracoesPendentes(pendente);
    if (!salvamentoEmAndamentoRef.current) setEstadoSalvamento(pendente ? 'pendente' : 'salvo');
    return pendente;
  }, [registrar, registrarComparacao]);

  const registrarAlteracao = useCallback((origem: OrigemAlteracaoLaudo = 'usuario') => {
    registrar('alteracao_recebida', { origem, motivo: aguardandoInicializacaoRef.current ? 'aguardando_inicializacao' : undefined });
    if (sessaoAtivaRef.current && origem !== 'normalizacao-inicial') {
      aguardandoInicializacaoRef.current = false;
      setInicializando(false);
      setRevisaoAlteracoes(revisao => revisao + 1);
    }
  }, [registrar]);

  const concluirInicializacao = useCallback((conteudo: string, sessao: number) => {
    const motivo = !sessaoAtivaRef.current ? 'sessao_inativa'
      : sessaoRef.current !== sessao ? 'sessao_anterior'
        : !aguardandoInicializacaoRef.current ? 'inicializacao_nao_pendente'
          : salvamentoEmAndamentoRef.current ? 'salvamento_em_andamento' : null;
    if (motivo) {
      registrar('inicializacao_ignorada', { motivo, atualTamanho: conteudo.length });
      return;
    }
    registrarComparacao(conteudoSalvoRef.current, conteudo, 'normalizacao-inicial');
    registrar('inicializacao_concluida', { atualTamanho: conteudo.length });
    aguardandoInicializacaoRef.current = false;
    setInicializando(false);
    conteudoSalvoRef.current = conteudo;
    pendenteRef.current = false;
    setAlteracoesPendentes(false);
    setEstadoSalvamento('salvo');
  }, [registrar, registrarComparacao]);

  const iniciarSalvamento = useCallback((): boolean => {
    if (!sessaoAtivaRef.current || salvamentoEmAndamentoRef.current || aguardandoInicializacaoRef.current) return false;

    salvamentoEmAndamentoRef.current = true;
    registrar('salvamento_iniciado', { pendente: pendenteRef.current });
    aguardandoInicializacaoRef.current = false;
    setEstadoSalvamento('salvando');
    return true;
  }, [registrar]);

  const concluirSalvamento = useCallback((conteudoSalvo: string, conteudoAtual: string, sessao: number) => {
    if (!sessaoAtivaRef.current || sessaoRef.current !== sessao) return;
    salvamentoEmAndamentoRef.current = false;
    conteudoSalvoRef.current = conteudoSalvo;
    const pendente = conteudoAtual !== conteudoSalvo;
    registrarComparacao(conteudoSalvo, conteudoAtual, 'automatica');
    registrar('salvamento_concluido', { pendente, referenciaTamanho: conteudoSalvo.length, atualTamanho: conteudoAtual.length });
    pendenteRef.current = pendente;
    setAlteracoesPendentes(pendente);
    setEstadoSalvamento(pendente ? 'pendente' : 'salvo');
  }, [registrar, registrarComparacao]);

  const falharSalvamento = useCallback((sessao: number) => {
    if (!sessaoAtivaRef.current || sessaoRef.current !== sessao) return;
    salvamentoEmAndamentoRef.current = false;
    registrar('salvamento_falhou', { motivo: 'erro', pendente: pendenteRef.current });
    setEstadoSalvamento('erro');
  }, [registrar]);

  const obterSessao = useCallback(() => sessaoRef.current, []);
  const sessaoAtual = useCallback((sessao: number) => sessaoAtivaRef.current && sessaoRef.current === sessao, []);
  const estaSalvando = useCallback(() => salvamentoEmAndamentoRef.current, []);

  return {
    estadoSalvamento,
    inicializando,
    alteracoesPendentes,
    salvando: estadoSalvamento === 'salvando',
    iniciarSessao,
    concluirInicializacao,
    encerrarSessao,
    registrarAlteracao,
    revisaoAlteracoes,
    atualizarConteudo,
    iniciarSalvamento,
    concluirSalvamento,
    falharSalvamento,
    obterSessao,
    sessaoAtual,
    estaSalvando,
  };
}
