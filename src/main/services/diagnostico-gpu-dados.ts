export function objetoTecnico(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}

export function sanitizarTextoGpu(texto: string): string {
  return texto.slice(0, 4096)
    .replace(/(?:https?|file):\/\/[^\s"'<>]+/gi, '[url]')
    .replace(/\b[A-Z]:[\\/][^\s"'<>]+/gi, '[caminho]')
    .replace(/\/(?:Users|home|tmp)\/[^\s"'<>]+/g, '[caminho]')
    .replace(/\b(?:password|senha|token|secret|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi, '[credencial]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[documento]');
}

function selecionar(objeto: Record<string, unknown>, chaves: string[]): Record<string, string | number | boolean> {
  const resultado: Record<string, string | number | boolean> = {};
  for (const chave of chaves) {
    const valor = objeto[chave];
    if (typeof valor === 'string') resultado[chave] = sanitizarTextoGpu(valor).slice(0, 512);
    else if (typeof valor === 'boolean' || (typeof valor === 'number' && Number.isFinite(valor))) resultado[chave] = valor;
  }
  return resultado;
}

export function normalizarAmbienteGpu(informacoes: unknown, recursos: unknown) {
  const dados = objetoTecnico(informacoes);
  return {
    adaptadores: (Array.isArray(dados.gpuDevice) ? dados.gpuDevice : []).slice(0, 8).map(item => selecionar(objetoTecnico(item), [
      'vendorId', 'deviceId', 'active', 'vendorString', 'deviceString', 'driverVendor', 'driverVersion', 'driverDate',
    ])),
    atributos: selecionar(objetoTecnico(dados.auxAttributes), [
      'glRenderer', 'glVendor', 'glVersion', 'glImplementationParts', 'displayType', 'inProcessGpu', 'sandboxed',
      'passthroughCmdDecoder', 'optimus', 'amdSwitchable', 'graphicsResetNotificationStrategy',
    ]),
    recursos: selecionar(objetoTecnico(recursos), Object.keys(objetoTecnico(recursos)).filter(chave => /^[a-z_]+$/i.test(chave)).slice(0, 64)),
  };
}

export interface ProcessoGpuDiagnostico { pid: number; tipo: 'Browser' | 'GPU' | 'Renderer'; cpu: number | null; memoriaKb: number | null }

export function normalizarProcessosGpu(valor: unknown): ProcessoGpuDiagnostico[] {
  if (!Array.isArray(valor)) return [];
  return valor.slice(0, 100).flatMap(item => {
    const dado = objetoTecnico(item);
    const tipo = dado.type === 'Tab' || dado.type === 'Renderer' ? 'Renderer' : dado.type;
    if (!['Browser', 'GPU', 'Renderer'].includes(String(tipo)) || typeof dado.pid !== 'number' || !Number.isSafeInteger(dado.pid) || dado.pid <= 0) return [];
    const cpu = objetoTecnico(dado.cpu).percentCPUUsage;
    const memoria = objetoTecnico(dado.memory).workingSetSize;
    return [{ pid: dado.pid, tipo: tipo as ProcessoGpuDiagnostico['tipo'],
      cpu: typeof cpu === 'number' && Number.isFinite(cpu) ? cpu : null,
      memoriaKb: typeof memoria === 'number' && Number.isFinite(memoria) ? memoria : null }];
  });
}

export interface EventoWindowsGpu {
  horario: string;
  provedor: string;
  codigo: string;
  dump: string | null;
  horarioDump: string | null;
  disponibilidadeDump: 'disponivel' | 'indisponivel_ou_sem_permissao' | 'nao_verificada';
  correlacao: 'contemporaneo' | 'relatorio_antigo' | 'sem_horario_dump';
}

export function normalizarEventosWindowsGpu(valor: unknown, inicio: number, fim: number): EventoWindowsGpu[] {
  return (Array.isArray(valor) ? valor : [valor]).slice(0, 50).flatMap(item => {
    const dado = objetoTecnico(item);
    if (typeof dado.horario !== 'string' || !Number.isFinite(Date.parse(dado.horario)) || typeof dado.provedor !== 'string') return [];
    const dump = typeof dado.dump === 'string' ? dado.dump.match(/WATCHDOG-\d{8}-\d{4}\.dmp/i)?.[0] ?? null : null;
    const horarioDump = typeof dado.horarioDump === 'string' && Number.isFinite(Date.parse(dado.horarioDump)) ? dado.horarioDump : null;
    const instanteDump = horarioDump ? Date.parse(horarioDump) : null;
    return [{ horario: dado.horario, provedor: sanitizarTextoGpu(dado.provedor).slice(0, 120),
      codigo: String(dado.codigo ?? '').replace(/[^a-z0-9_]/gi, '').slice(0, 40), dump, horarioDump,
      disponibilidadeDump: dado.disponibilidadeDump === 'disponivel' || dado.disponibilidadeDump === 'indisponivel_ou_sem_permissao' ? dado.disponibilidadeDump : 'nao_verificada',
      correlacao: instanteDump === null ? 'sem_horario_dump' : instanteDump < inicio || instanteDump > fim ? 'relatorio_antigo' : 'contemporaneo' }];
  });
}
