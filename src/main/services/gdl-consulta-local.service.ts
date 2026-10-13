import { authSessaoService } from './auth-sessao.service.js';
import { obterRepRepositorioGdl, registrarConsultaRepositorioGdl } from './gdl-repositorio.service.js';
import { consultarDetalhesRepAutorizada } from './gdl.service.js';
import { observarConsultaGdl } from './gdl-diagnostico.service.js';
import { randomUUID } from 'node:crypto';
import { codigoExameParaFormulario, identificarNaturezaExame, normalizarCodigoExame } from '../../shared/gdl/natureza-exame.js';
import type { ConsultaIdentificacaoRepGdl, IdentificacaoNaturezaExameGdl } from '../../shared/gdl/natureza-exame.js';
import type { GdlConsultaResultado } from './gdl.service.js';
import { consultarRep, obterIdentidadeMinhasReps } from './gdl.service.js';
import { tipoExameService } from './tipo-exame.service.js';
import { converterRepGdl, listarCodigosImportacaoGdl } from './gdl-adaptadores.service.js';

interface ConsultaPendente {
  consultaId: string;
  identidade: string;
  expiraEm: number;
  resultado: GdlConsultaResultado;
  identificacao: IdentificacaoNaturezaExameGdl;
  numero: string;
  ano: string;
  usuarioId: string;
  controle: AbortController;
  persistenciaFalhou: boolean;
  camposVaziosConfirmados: Array<'observacoes' | 'data_requisicao'>;
  detalhes: NonNullable<ConsultaIdentificacaoRepGdl['detalhes']>;
}

const consultas = new Map<number, ConsultaPendente>();
const consultasEmAndamento = new Map<number, string>();

export function descartarConsultaRepGdl(remetenteId: number): void {
  consultas.get(remetenteId)?.controle.abort();
  consultas.delete(remetenteId);
  consultasEmAndamento.delete(remetenteId);
}

function montarIdentificacao(consulta: ConsultaPendente, tiposLocais: ConsultaIdentificacaoRepGdl['tiposLocais']): ConsultaIdentificacaoRepGdl {
  const avisos: string[] = [];
  if (consulta.persistenciaFalhou) avisos.push('A consulta foi preservada, mas não foi possível atualizar o repositório local. A lista pode continuar com dados anteriores.');
  if (!consulta.resultado.dados?.dataEntradaSolicitacao) avisos.push('A data de entrada da solicitação não foi confirmada. Confira o preenchimento local.');
  if (consulta.detalhes.estado === 'parciais') avisos.push('Não foi possível confirmar todos os detalhes. Dados anteriores foram preservados quando disponíveis.');
  if (consulta.detalhes.origemNatureza === 'cache') avisos.push('A natureza exibida foi confirmada em uma consulta anterior.');
  if (consulta.detalhes.divergencia) avisos.push('A natureza confirmada na página da REP difere da identificação anterior. Revise o tipo local antes de aplicar.');
  return { consultaId: consulta.consultaId, identificacao: consulta.identificacao, tiposLocais, avisos, detalhes: consulta.detalhes, codigosImportacaoDisponiveis: listarCodigosImportacaoGdl() };
}

async function tiposAtivos(): Promise<ConsultaIdentificacaoRepGdl['tiposLocais']> {
  return (await tipoExameService.findAllOrdered()).map(tipo => ({ id: tipo.id, codigo: tipo.codigo, nome: tipo.nome }));
}

async function validarConsulta(remetenteId: number, consulta: ConsultaPendente): Promise<void> {
  if (consultas.get(remetenteId) !== consulta || consulta.controle.signal.aborted || consulta.expiraEm <= Date.now()) throw new Error('A consulta expirou ou foi substituída.');
  if (authSessaoService.exigir(remetenteId) !== consulta.usuarioId || consulta.identidade !== await obterIdentidadeMinhasReps()) throw new Error('A sessão ou a configuração GDL mudou. Consulte novamente.');
  if (consultas.get(remetenteId) !== consulta || consulta.controle.signal.aborted || consulta.expiraEm <= Date.now()) throw new Error('A consulta expirou ou foi substituída.');
}

export async function identificarRepGdl(remetenteId: number, numero: string, ano: string, naturezaLista?: string): Promise<ConsultaIdentificacaoRepGdl> {
  for (const [remetente, consulta] of consultas) if (consulta.expiraEm <= Date.now()) descartarConsultaRepGdl(remetente);
  descartarConsultaRepGdl(remetenteId);
  numero = numero.replace(/^0+(?=\d)/, '');
  const usuarioId = authSessaoService.exigir(remetenteId);
  const consultaId = randomUUID();
  consultasEmAndamento.set(remetenteId, consultaId);
  const identidade = await obterIdentidadeMinhasReps();
  const resultado = await observarConsultaGdl(remetenteId, numero, ano, () => consultarRep(numero, ano));
  if (!resultado.sucesso || !resultado.dados) throw new Error(resultado.erro || 'Não foi possível consultar a REP.');
  if (consultasEmAndamento.get(remetenteId) !== consultaId) throw new Error('A consulta foi substituída. Consulte novamente a REP.');
  if (!Number.isSafeInteger(resultado.dados.codRep) || resultado.dados.codRep <= 0 || String(resultado.dados.numero) !== numero || String(resultado.dados.ano) !== ano) throw new Error('A API retornou uma REP diferente da consultada.');
  if (identidade !== await obterIdentidadeMinhasReps() || usuarioId !== authSessaoService.exigir(remetenteId)) throw new Error('A configuração do GDL mudou durante a consulta. Consulte novamente.');
  if (consultasEmAndamento.get(remetenteId) !== consultaId) throw new Error('A consulta foi substituída. Consulte novamente a REP.');
  const anterior = await obterRepRepositorioGdl(usuarioId, identidade, resultado.dados.codRep, numero, ano);
  const validarCapturaAtual = async () => {
    if (consultasEmAndamento.get(remetenteId) !== consultaId || usuarioId !== authSessaoService.exigir(remetenteId) || identidade !== await obterIdentidadeMinhasReps()) throw new Error('A consulta foi substituída ou a conexão mudou.');
    if (consultasEmAndamento.get(remetenteId) !== consultaId) throw new Error('A consulta foi substituída.');
  };
  await validarCapturaAtual();
  let persistenciaFalhou = false;
  try { await registrarConsultaRepositorioGdl(usuarioId, identidade, resultado.dados.codRep, numero, ano, { fonte: 'api', natureza: resultado.naturezaExame ?? null, status: resultado.statusRep ?? null, dados: resultado.dados }, validarCapturaAtual); }
  catch { persistenciaFalhou = true; }
  if (consultasEmAndamento.get(remetenteId) !== consultaId) throw new Error('A consulta foi substituída.');
  const naturezaAnterior = anterior?.ultimosDetalhesReconhecidos?.natureza?.valor ?? anterior?.detalhes?.dados.natureza;
  const dataAnterior = anterior?.ultimosDetalhesReconhecidos?.dataSolicitacao?.dados ?? anterior?.detalhes?.dados.dataSolicitacao;
  const quesitoAnterior = anterior?.ultimosDetalhesReconhecidos?.quesito?.dados ?? anterior?.detalhes?.dados.quesito;
  const natureza = resultado.naturezaExame || naturezaAnterior || naturezaLista || '';
  if (!resultado.dados.dataEntradaSolicitacao && dataAnterior?.estado === 'presente') resultado.dados.dataEntradaSolicitacao = dataAnterior.valor;
  if (!resultado.dados.quesitoAberto && quesitoAnterior?.estado === 'presente') resultado.dados.quesitoAberto = quesitoAnterior.valor;
  const consulta: ConsultaPendente = { consultaId, identidade, usuarioId, resultado, persistenciaFalhou,
    identificacao: identificarNaturezaExame(natureza), numero, ano, controle: new AbortController(), camposVaziosConfirmados: [], expiraEm: Date.now() + 10 * 60 * 1000,
    detalhes: { estado: 'aguardando_confirmacao', statusAtual: resultado.statusRep ?? null,
      origemNatureza: resultado.naturezaExame ? 'api' : naturezaAnterior ? 'cache' : 'catalogo' } };
  const status = resultado.statusRep?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  if (status !== 'LAUDO EM EXECUCAO') consulta.detalhes.motivoConfirmacao = status === 'ABERTA E DISTRIBUIDA'
    ? 'Abrir os detalhes pode alterar o status desta REP de “Aberta e Distribuída” para “Laudo em Execução” no GDL.'
    : 'O efeito de abrir os detalhes sobre o status desta REP não foi confirmado. Deseja continuar?';
  consultasEmAndamento.delete(remetenteId);
  consultas.set(remetenteId, consulta);
  const tipos = await tiposAtivos();
  await validarConsulta(remetenteId, consulta);
  if (status === 'LAUDO EM EXECUCAO') return completarConsultaRepGdl(remetenteId, consultaId, true);
  return montarIdentificacao(consulta, tipos);
}

export async function completarConsultaRepGdl(remetenteId: number, consultaId: string, abrirDetalhes: boolean): Promise<ConsultaIdentificacaoRepGdl> {
  const consulta = consultas.get(remetenteId);
  if (!consulta || consulta.consultaId !== consultaId) throw new Error('A consulta expirou ou foi substituída.');
  await validarConsulta(remetenteId, consulta);
  if (consulta.detalhes.estado !== 'aguardando_confirmacao') throw new Error('Esta consulta já foi concluída. Inicie uma nova consulta para tentar novamente.');
  // Consumir a decisão antes da rede impede repetição involuntária após timeout.
  consulta.detalhes.estado = abrirDetalhes ? 'parciais' : 'somente_api';
  if (abrirDetalhes && consulta.resultado.dados) {
    try {
      const id = consulta.resultado.dados.codRep;
      try { await registrarConsultaRepositorioGdl(consulta.usuarioId, consulta.identidade, id, consulta.numero, consulta.ano, { fonte: 'acesso_detalhes' }, () => validarConsulta(remetenteId, consulta)); }
      catch { consulta.persistenciaFalhou = true; }
      await validarConsulta(remetenteId, consulta);
      const detalhes = await consultarDetalhesRepAutorizada(id, consulta.numero, consulta.ano, () => validarConsulta(remetenteId, consulta), consulta.controle.signal);
      await validarConsulta(remetenteId, consulta);
      try { await registrarConsultaRepositorioGdl(consulta.usuarioId, consulta.identidade, id, consulta.numero, consulta.ano, { fonte: 'detalhes', dados: detalhes }, () => validarConsulta(remetenteId, consulta)); }
      catch { consulta.persistenciaFalhou = true; }
      await validarConsulta(remetenteId, consulta);
      if (detalhes.natureza) {
        const anterior = consulta.identificacao.codigoExplicito ?? consulta.identificacao.codigoSugerido;
        consulta.identificacao = identificarNaturezaExame(detalhes.natureza);
        consulta.resultado.naturezaExame = detalhes.natureza;
        consulta.detalhes.origemNatureza = 'detalhes';
        consulta.detalhes.divergencia = Boolean(anterior && anterior !== consulta.identificacao.codigoExplicito);
      }
      consulta.camposVaziosConfirmados = [
        ...(detalhes.quesito.estado === 'vazio' ? ['observacoes' as const] : []),
        ...(detalhes.dataSolicitacao.estado === 'vazio' ? ['data_requisicao' as const] : []),
      ];
      if (detalhes.quesito.estado !== 'ausente') consulta.resultado.dados.quesitoAberto = detalhes.quesito.valor;
      if (detalhes.dataSolicitacao.estado !== 'ausente') consulta.resultado.dados.dataEntradaSolicitacao = detalhes.dataSolicitacao.valor;
      consulta.detalhes.estado = detalhes.natureza && detalhes.quesito.estado !== 'ausente' && detalhes.dataSolicitacao.estado !== 'ausente' ? 'confirmados' : 'parciais';
    } catch { await validarConsulta(remetenteId, consulta); }
  }
  return montarIdentificacao(consulta, await tiposAtivos());
}

export async function obterConsultaRepConcluida(remetenteId: number, consultaId: string) {
  const consulta = consultas.get(remetenteId);
  if (!consulta || consulta.consultaId !== consultaId) throw new Error('A consulta expirou ou foi substituída.');
  await validarConsulta(remetenteId, consulta);
  if (consulta.detalhes.estado === 'aguardando_confirmacao') throw new Error('Confirme a consulta detalhada antes de continuar.');
  return { resultado: consulta.resultado, numero: consulta.numero, ano: consulta.ano, identificacao: consulta.identificacao,
    avisos: montarIdentificacao(consulta, []).avisos, camposVaziosConfirmados: consulta.camposVaziosConfirmados };
}

export async function converterConsultaRepGdl(remetenteId: number, consultaId: string, tipoExameId: string) {
  const consulta = consultas.get(remetenteId);
  if (!consulta || consulta.consultaId !== consultaId || consulta.expiraEm <= Date.now()) {
    throw new Error('A consulta expirou ou foi substituída. Consulte novamente a REP.');
  }
  await validarConsulta(remetenteId, consulta);
  if (consulta.detalhes.estado === 'aguardando_confirmacao') throw new Error('Escolha se deseja abrir os detalhes ou usar somente a API.');
  if (consulta.identidade !== await obterIdentidadeMinhasReps()) {
    consultas.delete(remetenteId);
    throw new Error('A configuração do GDL mudou. Consulte novamente a REP.');
  }
  const tipo = await tipoExameService.findById(tipoExameId);
  if (!tipo || !tipo.ativo) throw new Error('Cadastre ou ative o tipo de exame local antes de continuar.');
  const codigo = normalizarCodigoExame(tipo.codigo);
  const { codigoExplicito, candidatos } = consulta.identificacao;
  if (codigoExplicito && codigo !== codigoExplicito) throw new Error('O código informado pelo GDL deve ser preservado.');
  if (!codigoExplicito && candidatos.length && !candidatos.some(item => item.codigo === codigo)) {
    throw new Error('O tipo escolhido não corresponde à descrição recebida do GDL.');
  }
  if (!consulta.resultado.dados) throw new Error('Dados da REP indisponíveis.');
  const identificacaoEscolhida: IdentificacaoNaturezaExameGdl = {
    ...consulta.identificacao, codigoSugerido: codigo,
    origem: codigoExplicito ? 'gdl' : codigo === consulta.identificacao.codigoSugerido ? 'catalogo' : 'usuario',
  };
  const codigoAdaptador = codigoExameParaFormulario(codigo);
  const importacao = converterRepGdl(codigoAdaptador, consulta.resultado.dados, {
    origemInicial: 'gdl',
    identificacaoNatureza: identificacaoEscolhida,
    ultimaConsulta: {
      ambiente: consulta.resultado.ambiente ?? 'producao', numeroRep: consulta.numero,
      anoRep: consulta.ano, consultadoEm: new Date().toISOString(),
    },
  });
  return {
    ...importacao,
    camposVaziosConfirmados: consulta.camposVaziosConfirmados,
    camposGerais: { ...importacao.camposGerais, ...Object.fromEntries(consulta.camposVaziosConfirmados.map(campo => [campo, ''])) },
    naturezaExameGdl: consulta.identificacao.textoOriginal,
    identificacaoNatureza: identificacaoEscolhida,
  };
}
