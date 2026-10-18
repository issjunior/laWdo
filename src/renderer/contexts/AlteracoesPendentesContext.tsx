import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router';
import type { AutorizacaoReinicioAtualizacao } from '@shared/atualizacao/atualizacao.types';
import { DialogoSaidaLaudo } from '@/components/laudo/editor/DialogoSaidaLaudo';

interface RegistroAlteracoes {
  pendente: boolean;
  salvando: boolean;
  verificar: () => boolean;
  salvar: () => Promise<boolean>;
  erro: () => string | null;
}

interface AlteracoesPendentesContexto {
  registrar: (chave: string, registro: RegistroAlteracoes | null) => void;
  solicitarSaida: (acao: () => void) => void;
}

const ContextoAlteracoesPendentes = createContext<AlteracoesPendentesContexto | null>(null);

export function AlteracoesPendentesProvider({ children }: { children: ReactNode }) {
  const registrosRef = useRef(new Map<string, RegistroAlteracoes>());
  const [revisao, setRevisao] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const acaoPendenteRef = useRef<(() => void) | null>(null);
  const ocupadoRef = useRef(false);

  const registroAtivo = useCallback(() => Array.from(registrosRef.current.values()).find(registro => registro.verificar() || registro.salvando), []);
  const bloqueador = useBlocker(() => Boolean(registroAtivo()));

  const registrar = useCallback((chave: string, registro: RegistroAlteracoes | null) => {
    if (registro) registrosRef.current.set(chave, registro);
    else registrosRef.current.delete(chave);
    setRevisao(valor => valor + 1);
  }, []);

  const solicitarSaida = useCallback((acao: () => void) => {
    if (acaoPendenteRef.current || ocupadoRef.current) return;
    if (!registroAtivo()) { acao(); return; }
    acaoPendenteRef.current = acao;
    setErro(null);
    setAberto(true);
  }, [registroAtivo]);

  useEffect(() => {
    if (bloqueador.state !== 'blocked' || acaoPendenteRef.current) return;
    solicitarSaida(() => bloqueador.proceed());
  }, [bloqueador, solicitarSaida]);

  useEffect(() => window.ipcAPI.onSolicitarFechamento(() => {
    if (acaoPendenteRef.current) {
      void window.ipcAPI.cancelarFechamento();
      return;
    }
    solicitarSaida(() => { void window.ipcAPI.confirmarFechamento(); });
  }), [solicitarSaida]);

  useEffect(() => {
    window.ipcAPI.protegerFechamento(true);
    return () => window.ipcAPI.protegerFechamento(false);
  }, []);

  const cancelar = useCallback(() => {
    if (ocupadoRef.current) return;
    acaoPendenteRef.current = null;
    setAberto(false);
    setErro(null);
    void window.ipcAPI.cancelarFechamento();
    if (bloqueador.state === 'blocked') bloqueador.reset();
  }, [bloqueador]);

  const concluir = useCallback(() => {
    const acao = acaoPendenteRef.current;
    acaoPendenteRef.current = null;
    setAberto(false);
    setErro(null);
    acao?.();
  }, []);

  const salvar = useCallback(async () => {
    if (ocupadoRef.current) return;
    const registro = registroAtivo();
    if (!registro) { concluir(); return; }
    ocupadoRef.current = true;
    setSalvando(true);
    setErro(null);
    try {
      const salvo = await registro.salvar();
      if (salvo) concluir();
      else setErro(registro.erro() || 'Não foi possível salvar todas as alterações. Tente novamente.');
    } catch (falha: unknown) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível salvar o laudo.');
    } finally {
      ocupadoRef.current = false;
      setSalvando(false);
    }
  }, [concluir, registroAtivo]);

  const obterAutorizacaoReinicio = useCallback((): AutorizacaoReinicioAtualizacao => {
    const impedimentos = Array.from(registrosRef.current.entries())
      .filter(([, registro]) => registro.verificar() || registro.salvando)
      .map(([chave]) => chave === 'editor-laudo'
        ? 'O Editor de Laudos possui alterações não salvas.'
        : chave === 'importacao-template' ? 'A revisão de importação de template possui alterações não salvas.'
        : chave === 'cadastro-rep-b601' ? 'O cadastro da REP B-601 possui alterações não salvas.'
        : 'O Wizard de Laudos possui alterações não salvas.');
    return { autorizado: impedimentos.length === 0, impedimentos };
  }, []);

  useEffect(() => {
    const api = window.ipcAPI.atualizacao;
    return api?.onSolicitarReinicio(obterAutorizacaoReinicio);
  }, [obterAutorizacaoReinicio]);

  useEffect(() => {
    if (!aberto || ocupadoRef.current || registroAtivo()) return;
    concluir();
  }, [aberto, concluir, registroAtivo, revisao]);

  const valor = useMemo(() => ({ registrar, solicitarSaida }), [registrar, solicitarSaida]);
  return (
    <ContextoAlteracoesPendentes.Provider value={valor}>
      {children}
      <DialogoSaidaLaudo
        titulo={registrosRef.current.get('importacao-template')?.verificar() ? 'Salvar revisão do template?' : registrosRef.current.get('cadastro-rep-b601')?.verificar() ? 'Salvar alterações da REP?' : undefined}
        descricao={registrosRef.current.get('importacao-template')?.verificar() ? 'A revisão da importação ainda não foi salva. Deseja salvar antes de sair?' : registrosRef.current.get('cadastro-rep-b601')?.verificar() ? 'O cadastro da REP possui alterações não salvas. Deseja salvar antes de sair?' : undefined}
        aberto={aberto}
        salvando={salvando || Array.from(registrosRef.current.values()).some(registro => registro.salvando)}
        erro={erro}
        aoAlterarAbertura={novoEstado => { if (!novoEstado) cancelar(); }}
        aoDescartar={concluir}
        aoSalvar={() => { void salvar(); }}
      />
    </ContextoAlteracoesPendentes.Provider>
  );
}

export function useSolicitarSaida(): AlteracoesPendentesContexto['solicitarSaida'] {
  const contexto = useContext(ContextoAlteracoesPendentes);
  if (!contexto) throw new Error('O controle de saída requer seu provider.');
  return contexto.solicitarSaida;
}

export function useRegistrarAlteracoesPendentes(chave: string, registro: RegistroAlteracoes): void {
  const contexto = useContext(ContextoAlteracoesPendentes);
  if (!contexto) throw new Error('O registro de alterações pendentes requer seu provider.');
  const atualRef = useRef(registro);
  atualRef.current = registro;
  useEffect(() => {
    const ponte: RegistroAlteracoes = {
      get pendente() { return atualRef.current.pendente; },
      get salvando() { return atualRef.current.salvando; },
      verificar: () => atualRef.current.verificar(),
      salvar: () => atualRef.current.salvar(),
      erro: () => atualRef.current.erro(),
    };
    contexto.registrar(chave, ponte);
    return () => contexto.registrar(chave, null);
  }, [chave, contexto, registro.pendente, registro.salvando]);
}
