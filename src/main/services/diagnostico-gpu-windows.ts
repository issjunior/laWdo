import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizarEventosWindowsGpu, type EventoWindowsGpu } from './diagnostico-gpu-dados.js';

const executar = promisify(execFile);
export interface ResultadoWindowsGpu { estado: 'disponivel' | 'indisponivel' | 'nao_aplicavel'; eventos: EventoWindowsGpu[]; lacuna?: string; consultadoEm?: string; inicioIntervalo?: string; fimIntervalo?: string }

type ExecutarConsultaWindows = (arquivo: string, argumentos: string[], opcoes: { windowsHide: boolean; timeout: number; maxBuffer: number }) => Promise<{ stdout: string }>;

export async function consultarEventosWindowsGpu(inicio: number, fim: number, executarConsulta: ExecutarConsultaWindows = executar): Promise<ResultadoWindowsGpu> {
  if (process.platform !== 'win32') return { estado: 'nao_aplicavel', eventos: [] };
  const script = `
$ErrorActionPreference='Stop'
$inicio=[datetime]::Parse('${new Date(inicio).toISOString()}').ToLocalTime()
$fim=[datetime]::Parse('${new Date(fim).toISOString()}').ToLocalTime()
$saida=@()
foreach($log in @('Application','System')) {
  try { $eventos=Get-WinEvent -FilterHashtable @{LogName=$log;StartTime=$inicio;EndTime=$fim;Id=$(if($log -eq 'Application'){1001}else{4101})} -MaxEvents 50 -ErrorAction Stop }
  catch { if($_.FullyQualifiedErrorId -match 'NoMatchingEventsFound'){continue}; throw }
  foreach($evento in $eventos) {
    $dados=@{}; ([xml]$evento.ToXml()).Event.EventData.Data | ForEach-Object { $dados[[string]$_.Name]=[string]$_.'#text' }
    if($log -eq 'Application' -and ($dados.EventName -ne 'LiveKernelEvent' -or $dados.P1 -notmatch '^(141|142|117|116)$')){continue}
    if($log -eq 'System' -and $evento.ProviderName -ne 'Display'){continue}
    $dump=$null; $horarioDump=$null; $disponibilidadeDump='nao_verificada'
    if($evento.Message -match 'WATCHDOG-(\\d{8})-(\\d{4})\\.dmp') {
      $dump=$Matches[0]
      $horarioDump=[datetime]::ParseExact(($Matches[1]+$Matches[2]),'yyyyMMddHHmm',[cultureinfo]::InvariantCulture).ToUniversalTime().ToString('o')
      $disponibilidadeDump='indisponivel_ou_sem_permissao'
      try { if(Get-Item -LiteralPath (Join-Path $env:SystemRoot ('LiveKernelReports\\WATCHDOG\\'+$dump)) -ErrorAction Stop){$disponibilidadeDump='disponivel'} } catch {}
    }
    $saida+=@{horario=$evento.TimeCreated.ToUniversalTime().ToString('o');provedor=$evento.ProviderName;codigo=$(if($log -eq 'Application'){$dados.P1}else{'4101'});dump=$dump;horarioDump=$horarioDump;disponibilidadeDump=$disponibilidadeDump}
  }
}
ConvertTo-Json -InputObject @($saida) -Depth 4 -Compress
`;
  try {
    const { stdout } = await executarConsulta('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 5_000, maxBuffer: 1024 * 1024 });
    const valor: unknown = JSON.parse(stdout.replace(/^\uFEFF/, '').trim() || '[]');
    return { estado: 'disponivel', eventos: normalizarEventosWindowsGpu(valor, inicio, fim),
      ...(Array.isArray(valor) && valor.length >= 50 ? { lacuna: 'WINDOWS_EVENTOS_LIMITE_ATINGIDO' } : {}) };
  } catch (erro) {
    const codigo = erro && typeof erro === 'object' && 'code' in erro ? String(erro.code) : '';
    return { estado: 'indisponivel', eventos: [], lacuna: codigo === 'ETIMEDOUT' || (erro && typeof erro === 'object' && 'killed' in erro && erro.killed) ? 'WINDOWS_TIMEOUT' : 'WINDOWS_INDISPONIVEL_OU_SEM_PERMISSAO' };
  }
}
