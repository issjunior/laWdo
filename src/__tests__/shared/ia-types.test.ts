import { describe, expect, it } from 'vitest';
import {
  aplicarAtualizacaoPainelIa,
  atualizacaoPainelIaValida,
  comandoPainelIaValido,
  estadoPainelIaValido,
  perfilRespostaIaValido,
  progressoIaValido,
  solicitacaoIaValida,
  type EstadoPainelIa,
} from '../../shared/types/ia.types';

describe('contratos compartilhados de IA', () => {
  it('valida perfil e solicitação textual sem aceitar fronteiras malformadas', () => {
    expect(perfilRespostaIaValido({
      versao: 1,
      tom: 'tecnico_pericial',
      detalhamento: 'equilibrado',
      instrucoesPersonalizadas: '',
    })).toBe(true);
    expect(perfilRespostaIaValido({ versao: 1, tom: 'livre' })).toBe(false);

    const solicitacao = {
      operationId: 'operacao-1',
      acao: 'clareza',
      escopo: 'secao',
      fragmentos: [{ id: 'fragmento-1', texto: 'Texto original.' }],
    };
    expect(solicitacaoIaValida(solicitacao)).toBe(true);
    expect(solicitacaoIaValida({ ...solicitacao, contextoResolvido: 'Conteúdo real da seção.' })).toBe(true);
    expect(solicitacaoIaValida({ ...solicitacao, planoId: 'plano-1', retomadaId: 'retomada-1' })).toBe(true);
    expect(solicitacaoIaValida({ ...solicitacao, planoId: '' })).toBe(false);
    expect(solicitacaoIaValida({ ...solicitacao, contextoResolvido: 'x'.repeat(200_001) })).toBe(false);
    expect(solicitacaoIaValida({
      ...solicitacao,
      fragmentos: [...solicitacao.fragmentos, solicitacao.fragmentos[0]],
    })).toBe(false);
  });

  it('valida snapshots, deltas e comandos identificados por mensagem', () => {
    const estado: EstadoPainelIa = {
      revisao: 1,
      titulo: 'Documento completo',
      carregando: false,
      erro: null,
      editorDisponivel: true,
      imagemSelecionada: false,
      contextoImagem: false,
      modoAplicacao: 'substituir',
      progresso: null,
      planoPendente: null,
      retomada: null,
      mensagens: [{ id: 'mensagem-1', role: 'assistant', content: 'Resposta', timestamp: 1 }],
      escopos: [{ id: -1, titulo: 'Documento completo' }],
    };
    expect(estadoPainelIaValido(estado)).toBe(true);
    expect(estadoPainelIaValido({ ...estado, escopoSelecionado: undefined })).toBe(false);
    expect(estadoPainelIaValido({ ...estado, avisoLimite: { mensagem: 'Limite confirmado', tentarNovamenteEm: undefined } })).toBe(true);
    expect(estadoPainelIaValido({ ...estado, mensagens: [{ content: 'Sem identidade' }] })).toBe(false);
    expect(atualizacaoPainelIaValida({ tipo: 'snapshot', estado })).toBe(true);
    expect(atualizacaoPainelIaValida({
      tipo: 'delta',
      revisao: 2,
      alteracoes: { carregando: true },
    })).toBe(true);
    expect(atualizacaoPainelIaValida({
      tipo: 'delta',
      revisao: 2,
      alteracoes: { campoDesconhecido: true },
    })).toBe(false);
    expect(comandoPainelIaValido({ tipo: 'aplicar_resposta', mensagemId: 'mensagem-1' })).toBe(true);
    expect(comandoPainelIaValido({ tipo: 'aplicar_resposta', indiceMensagem: 0 })).toBe(false);
    expect(comandoPainelIaValido({ tipo: 'confirmar_execucao' })).toBe(true);
    expect(comandoPainelIaValido({ tipo: 'limpar_conversa' })).toBe(true);
    expect(comandoPainelIaValido({ tipo: 'retomar_operacao' })).toBe(true);
    expect(progressoIaValido({
      operationId: 'operacao-1',
      fase: 'processando',
      loteAtual: 1,
      totalLotes: 2,
      tentativa: 1,
      chamadasConcluidas: 0,
    })).toBe(true);
    expect(progressoIaValido({
      operationId: 'operacao-1',
      fase: 'processando',
      loteAtual: 3,
      totalLotes: 2,
      tentativa: 1,
      chamadasConcluidas: 0,
    })).toBe(false);

    const aplicado = aplicarAtualizacaoPainelIa(estado, {
      tipo: 'delta',
      revisao: 2,
      alteracoes: { carregando: true },
    });
    expect(aplicado.estado).toEqual({ ...estado, revisao: 2, carregando: true });
    expect(aplicado.requerRessincronizacao).toBe(false);
    expect(aplicarAtualizacaoPainelIa(estado, {
      tipo: 'delta',
      revisao: 3,
      alteracoes: { carregando: true },
    }).requerRessincronizacao).toBe(true);
  });
});
