import { randomUUID } from 'node:crypto';
import { connect } from 'node:net';
import { StringDecoder } from 'node:string_decoder';

export interface RespostaPipeDiagnosticoCliente {
  requestId: string;
  ok: boolean;
  dados?: unknown;
  erro?: { codigo: string; mensagem: string };
}
const limiteResposta = 32 * 1024 * 1024;

function validarResposta(valor: unknown, requestId: string): valor is RespostaPipeDiagnosticoCliente {
  if (!valor || typeof valor !== 'object' || !('requestId' in valor) || valor.requestId !== requestId
    || !('ok' in valor) || typeof valor.ok !== 'boolean') return false;
  if (valor.ok) return 'dados' in valor;
  return 'erro' in valor && !!valor.erro && typeof valor.erro === 'object'
    && 'codigo' in valor.erro && typeof valor.erro.codigo === 'string' && valor.erro.codigo.length > 0
    && 'mensagem' in valor.erro && typeof valor.erro.mensagem === 'string';
}

export function solicitarDiagnostico(pipe: string, token: string, operacao: string, payload: unknown): Promise<RespostaPipeDiagnosticoCliente> {
  const requestId = randomUUID();
  return new Promise(resolve => {
    let socket: ReturnType<typeof connect>;
    try { socket = connect(pipe); } catch {
      resolve({ requestId, ok: false, erro: { codigo: 'SESSAO_INDISPONIVEL', mensagem: 'Não foi possível conectar à sessão diagnóstica.' } });
      return;
    }
    const decodificador = new StringDecoder('utf8');
    let conectado = false;
    let finalizado = false;
    let acumulado = '';
    let bytes = 0;
    const finalizar = (resposta: RespostaPipeDiagnosticoCliente) => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(temporizador);
      socket.removeAllListeners();
      socket.on('error', () => undefined);
      socket.destroy();
      resolve(resposta);
    };
    const falhar = (codigo: string, mensagem: string) => finalizar({ requestId, ok: false, erro: { codigo, mensagem } });
    const temporizador = setTimeout(() => falhar('TIMEOUT', 'A solicitação diagnóstica excedeu cinco segundos.'), 5_000);
    socket.once('connect', () => {
      conectado = true;
      socket.write(`${JSON.stringify({ token, requestId, operacao, payload })}\n`);
    });
    socket.on('data', (fragmento: Buffer) => {
      bytes += fragmento.length;
      if (bytes > limiteResposta) { falhar('ERRO_INTERNO', 'A resposta diagnóstica ultrapassou o limite de 32 MiB.'); return; }
      const trecho = decodificador.write(fragmento);
      const fim = trecho.indexOf('\n');
      acumulado += fim < 0 ? trecho : trecho.slice(0, fim);
      if (fim < 0) return;
      try {
        const valor: unknown = JSON.parse(acumulado);
        if (!validarResposta(valor, requestId)) { falhar('ERRO_INTERNO', 'Resposta diagnóstica inválida ou sem correlação.'); return; }
        finalizar(valor);
      } catch { falhar('ERRO_INTERNO', 'A resposta diagnóstica contém JSON inválido.'); }
    });
    socket.once('end', () => falhar('ERRO_INTERNO', 'A resposta diagnóstica foi encerrada antes do delimitador.'));
    socket.once('close', () => falhar(conectado ? 'ERRO_INTERNO' : 'SESSAO_INDISPONIVEL', conectado ? 'A conexão diagnóstica foi encerrada antes da resposta.' : 'A sessão diagnóstica não está disponível.'));
    socket.once('error', () => falhar('SESSAO_INDISPONIVEL', 'Não foi possível concluir a conexão diagnóstica.'));
  });
}
