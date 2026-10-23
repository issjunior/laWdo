export async function enviarDigitacaoCadenciada(sessao, texto, intervaloMs, esperar = ms => new Promise(resolver => setTimeout(resolver, ms))) {
  const pendentes = new Set();
  const conclusoes = [];
  const horarios = [];
  let contrapressoes = 0;
  const enviar = parametros => {
    const promessa = sessao.send('Input.dispatchKeyEvent', parametros, { timeout: 15_000 });
    pendentes.add(promessa);
    promessa.then(() => pendentes.delete(promessa), () => pendentes.delete(promessa));
    conclusoes.push(promessa);
  };
  for (const caractere of texto) {
    while (pendentes.size > 30) { contrapressoes++; await Promise.race(pendentes); }
    const horario = performance.timeOrigin + performance.now();
    horarios.push(horario);
    enviar({ type: 'keyDown', key: caractere, text: caractere, unmodifiedText: caractere, timestamp: horario / 1000 });
    enviar({ type: 'keyUp', key: caractere, timestamp: horario / 1000 });
    await esperar(intervaloMs);
  }
  await Promise.all(conclusoes);
  return { intervaloProgramadoMs: intervaloMs, contrapressoes, horarios };
}

export async function digitarCadenciado(pagina, texto, intervaloMs) {
  const sessao = await pagina.context().newCDPSession(pagina);
  try { return await enviarDigitacaoCadenciada(sessao, texto, intervaloMs); }
  finally { await sessao.detach().catch(() => undefined); }
}
