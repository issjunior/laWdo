import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { connect } from 'node:net';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  criarRespostaDiagnosticoErro,
  criarRespostaDiagnosticoSucesso,
  schemaCapturarTelaEntrada,
  schemaCriarSnapshotEntrada,
  schemaDiagnosticoStatusEntrada,
  schemaExecutarAcaoEntrada,
  schemaInspecionarInterfaceEntrada,
  schemaIniciarCapturaEntrada,
  schemaStatusCapturaEntrada,
  schemaFinalizarCapturaEntrada,
  schemaConsultarCapturaEntrada,
  schemaObterEventosEntrada,
} from '../shared/diagnostico/contratos.js';

interface SessaoDescoberta { sessionId: string; pipe: string; token: string }
interface RespostaPipe { requestId: string; ok: boolean; dados?: unknown; erro?: { codigo: string; mensagem: string } }

const workspace = process.argv[2];
if (!workspace) throw new Error('O caminho absoluto do workspace é obrigatório.');

async function obterSessao(): Promise<SessaoDescoberta | null> {
  try {
    const valor: unknown = JSON.parse(await readFile(path.join(workspace, 'tmp', 'diagnostico-agente', 'sessao-ativa.json'), 'utf8'));
    if (!valor || typeof valor !== 'object') return null;
    const sessao = valor as Record<string, unknown>;
    return typeof sessao.sessionId === 'string' && typeof sessao.pipe === 'string' && /^[a-f0-9]{64}$/.test(String(sessao.token))
      ? { sessionId: sessao.sessionId, pipe: sessao.pipe, token: String(sessao.token) }
      : null;
  } catch { return null; }
}

async function encaminhar(operacao: string, payload: unknown): Promise<{ sessao: SessaoDescoberta | null; resposta: RespostaPipe | null }> {
  const sessao = await obterSessao();
  if (!sessao) return { sessao: null, resposta: null };
  const requestId = randomUUID();
  return new Promise((resolve) => {
    const socket = connect(sessao.pipe);
    let acumulado = '';
    const timeout = setTimeout(() => { socket.destroy(); resolve({ sessao, resposta: null }); }, 5_000);
    socket.setEncoding('utf8');
    socket.once('connect', () => socket.write(`${JSON.stringify({ token: sessao.token, requestId, operacao, payload })}\n`));
    socket.on('data', conteudo => {
      acumulado += conteudo;
      const linha = acumulado.split('\n')[0];
      if (!linha) return;
      clearTimeout(timeout);
      socket.end();
      try { resolve({ sessao, resposta: JSON.parse(linha) as RespostaPipe }); } catch { resolve({ sessao, resposta: null }); }
    });
    socket.once('error', () => { clearTimeout(timeout); resolve({ sessao, resposta: null }); });
  });
}

function registrarFerramenta(nome: string, schema: z.ZodType, descricao: string, imagem = false): void {
  const inputSchema = schema instanceof z.ZodObject
    ? schema.shape
    : { finalidade: z.enum(['problema', 'desempenho']), cenario: z.string().optional(), janelaId: z.number().int().positive().optional(), categorias: z.array(z.enum(['sessao', 'janela', 'acao', 'console', 'erro', 'ipc'])).optional(), duracaoSegundos: z.number().int().min(30).max(300).optional(), cenarioDesempenho: z.enum(['ocioso', 'abertura_laudo', 'uso_editor', 'painel_ia', 'geral']).optional() };
  servidor.registerTool(nome, { description: descricao, inputSchema }, async entrada => {
    const requestId = randomUUID();
    const resultado = await encaminhar(nome, entrada);
    if (!resultado.resposta) {
      const dados = nome === 'diagnostico_status'
        ? { conectado: false, modoDiagnostico: false, sessionId: null, iniciadoEm: null, pid: null, ultimoCursor: 0, janelas: [], orientacao: 'Execute npm run dev:diagnostico no workspace.' }
        : undefined;
      const envelope = dados
        ? criarRespostaDiagnosticoSucesso(requestId, null, dados)
        : criarRespostaDiagnosticoErro(requestId, resultado.sessao?.sessionId ?? null, 'SESSAO_INDISPONIVEL', 'A sessão diagnóstica não está disponível.', true);
      return { content: [], structuredContent: envelope as unknown as Record<string, unknown> };
    }
    const codigoErro = resultado.resposta.erro?.codigo;
    const codigosConhecidos = new Set(['ENTRADA_INVALIDA', 'SESSAO_INDISPONIVEL', 'AUTENTICACAO_FALHOU', 'VERSAO_INCOMPATIVEL', 'JANELA_NAO_ENCONTRADA', 'JANELA_INDISPONIVEL', 'SNAPSHOT_EXPIRADO', 'ELEMENTO_NAO_ENCONTRADO', 'ACAO_NAO_SUPORTADA', 'TIMEOUT', 'CAPTURA_PARCIAL', 'CAPTURA_EM_ANDAMENTO', 'CAPTURA_NAO_ENCONTRADA', 'CAPTURA_EXPIRADA', 'CAPTURA_INCOMPATIVEL', 'ERRO_INTERNO']);
    const deveRetornarImagem = imagem || (nome === 'consultar_captura' && typeof (entrada as Record<string, unknown>).componente === 'string' && String((entrada as Record<string, unknown>).componente).startsWith('tela_'));
    const dadosEstruturados = deveRetornarImagem && resultado.resposta.dados && typeof resultado.resposta.dados === 'object'
      ? Object.fromEntries(Object.entries(resultado.resposta.dados as Record<string, unknown>).filter(([chave]) => chave !== 'imagemBase64'))
      : resultado.resposta.dados;
    const envelope = resultado.resposta.ok
      ? criarRespostaDiagnosticoSucesso(requestId, resultado.sessao?.sessionId ?? null, dadosEstruturados)
      : criarRespostaDiagnosticoErro(
        requestId,
        resultado.sessao?.sessionId ?? null,
        codigosConhecidos.has(codigoErro ?? '') ? codigoErro as Parameters<typeof criarRespostaDiagnosticoErro>[2] : 'ERRO_INTERNO',
        resultado.resposta.erro?.mensagem ?? 'Falha na operação diagnóstica.',
        true,
      );
    if (!deveRetornarImagem || !resultado.resposta.ok || !resultado.resposta.dados || typeof resultado.resposta.dados !== 'object') return { content: [], structuredContent: envelope as unknown as Record<string, unknown> };
    const dados = resultado.resposta.dados as Record<string, unknown>;
    const imagemBase64 = typeof dados.imagemBase64 === 'string' ? dados.imagemBase64 : null;
    if (!imagemBase64) return { content: [], structuredContent: envelope as unknown as Record<string, unknown> };
    return { content: [{ type: 'image' as const, data: imagemBase64, mimeType: 'image/png' }], structuredContent: envelope as unknown as Record<string, unknown> };
  });
}

const servidor = new McpServer({ name: 'lawdo-diagnostico', version: '0.1.0' });
registrarFerramenta('diagnostico_status', schemaDiagnosticoStatusEntrada, 'Informa o estado da sessão diagnóstica local.');
registrarFerramenta('capturar_tela', schemaCapturarTelaEntrada, 'Captura uma janela ou região da interface real.', true);
registrarFerramenta('inspecionar_interface', schemaInspecionarInterfaceEntrada, 'Obtém a estrutura acessível e revisionada da interface.');
registrarFerramenta('executar_acao', schemaExecutarAcaoEntrada, 'Clica ou digita sobre um elemento da última revisão.');
registrarFerramenta('obter_eventos', schemaObterEventosEntrada, 'Consulta eventos já persistidos pela sessão.');
registrarFerramenta('criar_snapshot', schemaCriarSnapshotEntrada, 'Cria um artefato diagnóstico coerente da sessão.');
registrarFerramenta('iniciar_captura', schemaIniciarCapturaEntrada, 'Inicia uma captura guiada de problema ou desempenho.');
registrarFerramenta('status_captura', schemaStatusCapturaEntrada, 'Informa o estado resumido de uma captura guiada.');
registrarFerramenta('finalizar_captura', schemaFinalizarCapturaEntrada, 'Finaliza uma captura guiada e gera o dossiê local.');
registrarFerramenta('consultar_captura', schemaConsultarCapturaEntrada, 'Lê uma parte tipada de uma captura já finalizada.');
await servidor.connect(new StdioServerTransport());
