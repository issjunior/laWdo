import { z } from 'zod';
import {
  CHAVE_CABECALHO_DOCUMENTO, CHAVE_FECHAMENTO_LAUDO, FECHAMENTO_DESATIVADO,
  esquemaCabecalhoLaudo, esquemaFechamentoLaudo, type ApresentacaoLaudo,
} from '../../shared/configuracoes/apresentacao-laudo.js';
import { obterFormasPerito } from '../../shared/utils/perito-tratamento.js';
import { executeQuery } from '../database/sqlite.js';
import { configuracaoService } from './configuracao.service.js';

const esquemaPerito = z.object({
  nome: z.string(), cargo: z.string().nullable(), lotacao: z.string().nullable(), matricula: z.string().nullable(),
  forma_tratamento: z.enum(['masculino', 'feminino']),
});

export async function capturarApresentacaoLaudo(peritoId: string, legado = false): Promise<ApresentacaoLaudo> {
  const cabecalhoSalvo = legado ? null : await configuracaoService.obter(CHAVE_CABECALHO_DOCUMENTO);
  const fechamentoSalvo = legado ? null : await configuracaoService.obter(CHAVE_FECHAMENTO_LAUDO);
  const cabecalho = cabecalhoSalvo !== null
    ? esquemaCabecalhoLaudo.parse(JSON.parse(cabecalhoSalvo))
    : { primeiraPaginaHabilitada: true, todasPaginasHabilitadas: true, primeiraPagina: await configuracaoService.obter('cabecalho_laudo') ?? '', todasPaginas: await configuracaoService.obter('cabecalho_paginas') ?? '' };
  const fechamento = fechamentoSalvo !== null ? esquemaFechamentoLaudo.parse(JSON.parse(fechamentoSalvo)) : { ...FECHAMENTO_DESATIVADO };
  const [registro] = await executeQuery<unknown>(
    'SELECT nome, cargo, lotacao, matricula, forma_tratamento FROM users WHERE id = ?', [peritoId],
  );
  const usuario = registro === undefined ? undefined : esquemaPerito.parse(registro);
  const formas = obterFormasPerito(usuario?.cargo, usuario?.forma_tratamento);
  return {
    versao: 1, cabecalho, fechamento,
    perito: {
      ...formas, perito_nome: usuario?.nome ?? '', 'perito.nome': usuario?.nome ?? '', 'perito.cargo': formas.perito_cargo,
      perito_lotacao: usuario?.lotacao ?? '', 'perito.lotacao': usuario?.lotacao ?? '',
      perito_matricula: usuario?.matricula ?? '', 'perito.matricula': usuario?.matricula ?? '', 'perito.especialidade': '',
    },
  };
}
