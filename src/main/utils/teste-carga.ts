import { app } from 'electron';
import { mkdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

export function prepararIsolamentoTesteCarga(): void {
  if (process.env.LAWDO_TESTE_CARGA !== '1') return;
  if (app.isPackaged || process.env.LAWDO_SMOKE_JANELA !== '1' || !process.env.LAWDO_SMOKE_USER_DATA) {
    throw new Error('Teste de carga permitido somente em desenvolvimento com dados isolados.');
  }
  const raiz = realpathSync(path.join(process.cwd(), 'tmp', 'teste-carga'));
  const diretorio = realpathSync(process.env.LAWDO_SMOKE_USER_DATA);
  const relativo = path.relative(raiz, diretorio);
  if (!relativo || relativo === '..' || relativo.startsWith(`..${path.sep}`) || path.isAbsolute(relativo)) {
    throw new Error('Diretório do teste de carga fora da raiz permitida.');
  }
  const marcador: unknown = JSON.parse(readFileSync(path.join(diretorio, 'isolamento.json'), 'utf8'));
  if (!marcador || typeof marcador !== 'object' || !('finalidade' in marcador) || marcador.finalidade !== 'teste-carga'
    || !('versao' in marcador) || marcador.versao !== 1) throw new Error('Isolamento do teste de carga não confirmado.');
  app.setPath('userData', diretorio);
  const sessao = path.join(diretorio, 'sessao');
  mkdirSync(sessao, { recursive: true });
  app.setPath('sessionData', sessao);
  globalThis.fetch = async () => { throw new Error('Rede externa desabilitada no teste de carga.'); };
  app.on('session-created', sessaoCriada => {
    sessaoCriada.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_detalhes, responder) => responder({ cancel: true }));
  });
}
