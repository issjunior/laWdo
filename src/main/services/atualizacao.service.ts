import { app, shell } from 'electron';
import { spawn } from 'node:child_process';
import { createHash, createPublicKey, verify } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { chavePublicaRelease } from '../../shared/atualizacao/chave-publica-release.js';
import type {
  ArtefatoAtualizacao,
  AcaoAtualizacao,
  AtualizacaoDisponivel,
  CodigoFalhaAtualizacao,
  EstadoAtualizacao,
  EstadoAtualizacaoResposta,
  EtapaFalhaAtualizacao,
  FalhaAtualizacao,
  ManifestoAtualizacao,
  PlataformaAtualizacao,
  ProgressoAtualizacao,
} from '../../shared/atualizacao/atualizacao.types.js';
import { getLogger } from '../utils/logger.js';
import { backupAtualizacaoService } from './backup-atualizacao.service.js';

const log = getLogger('atualizacao');
const URL_FEED = 'https://issjunior.github.io/laWdo/stable';
const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;
const HASH_SHA256 = /^[a-f0-9]{64}$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const TIMEOUT_VERIFICACAO_MS = 20_000;

class ErroRespostaHttpAtualizacao extends Error {
  constructor(readonly status: number) {
    super(`Resposta HTTP ${status} durante a atualização.`);
    this.name = 'ErroRespostaHttpAtualizacao';
  }
}

function detalheTecnico(erro: unknown): string {
  if (!(erro instanceof Error)) return 'Erro sem detalhes técnicos disponíveis.';
  const causa = erro.cause;
  const codigoCausa = causa && typeof causa === 'object' && 'code' in causa && typeof causa.code === 'string' ? ` (${causa.code})` : '';
  return `${erro.name}: ${erro.message}${codigoCausa}`.slice(0, 500);
}

function codigoCausa(erro: unknown): string | undefined {
  if (!erro || typeof erro !== 'object' || !('cause' in erro)) return undefined;
  const causa = erro.cause;
  return causa && typeof causa === 'object' && 'code' in causa && typeof causa.code === 'string' ? causa.code : undefined;
}

function mensagemFalha(codigo: CodigoFalhaAtualizacao): string {
  return {
    REDE_INDISPONIVEL: 'O laWdo não conseguiu acessar o servidor de atualizações. A conexão pode estar indisponível ou o endereço pode estar bloqueado pela rede.',
    TEMPO_ESGOTADO: 'O servidor de atualizações não respondeu no tempo esperado. Tente novamente mais tarde.',
    SERVICO_INDISPONIVEL: 'O serviço de atualizações está indisponível no momento. Tente novamente mais tarde.',
    RECURSO_INDISPONIVEL: 'O arquivo de atualização não está disponível no servidor.',
    RESPOSTA_INVALIDA: 'O servidor enviou uma resposta de atualização inválida.',
    ASSINATURA_INVALIDA: 'Não foi possível confirmar a autenticidade da atualização recebida.',
    PACOTE_INCOMPATIVEL: 'Não há pacote de atualização compatível com este dispositivo.',
    DOWNLOAD_INTERROMPIDO: 'Não foi possível concluir o download da atualização.',
    INTEGRIDADE_INVALIDA: 'O pacote baixado não passou na verificação de integridade.',
    ARMAZENAMENTO_INDISPONIVEL: 'Não foi possível gravar os arquivos necessários para a atualização.',
    BACKUP_FALHOU: 'Não foi possível criar o backup obrigatório antes da atualização.',
    ALTERACOES_PENDENTES: 'Existem alterações não salvas. Salve ou descarte-as antes de atualizar.',
    CONFIRMACAO_EXPIRADA: 'A confirmação de fechamento seguro expirou. Tente novamente.',
    INSTALADOR_FALHOU: 'Não foi possível iniciar o instalador da atualização.',
    OPERACAO_INDISPONIVEL: 'Esta operação de atualização não está disponível agora.',
    ERRO_INESPERADO: 'Ocorreu um erro inesperado durante a atualização.',
  }[codigo];
}

export function normalizarFalhaAtualizacao(erro: unknown, etapa: EtapaFalhaAtualizacao, acaoSugerida?: AcaoAtualizacao): FalhaAtualizacao {
  const mensagem = erro instanceof Error ? erro.message : '';
  const mensagemNormalizada = mensagem.toLowerCase();
  const causa = codigoCausa(erro);
  let codigo: CodigoFalhaAtualizacao = 'ERRO_INESPERADO';
  if (erro instanceof ErroRespostaHttpAtualizacao) codigo = erro.status === 404 ? 'RECURSO_INDISPONIVEL' : 'SERVICO_INDISPONIVEL';
  else if (erro instanceof Error && erro.name === 'TimeoutError') codigo = 'TEMPO_ESGOTADO';
  else if (['ENOTFOUND', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'UND_ERR_CONNECT_TIMEOUT'].includes(causa ?? '') || mensagemNormalizada.includes('fetch failed')) codigo = 'REDE_INDISPONIVEL';
  else if (mensagemNormalizada.includes('índice de atualização indisponível')) codigo = 'SERVICO_INDISPONIVEL';
  else if (mensagemNormalizada.includes('assinatura')) codigo = 'ASSINATURA_INVALIDA';
  else if (mensagemNormalizada.includes('artefato compatível')) codigo = 'PACOTE_INCOMPATIVEL';
  else if (mensagemNormalizada.includes('manifesto') || mensagemNormalizada.includes('json')) codigo = 'RESPOSTA_INVALIDA';
  else if (mensagemNormalizada.includes('não corresponde ao manifesto')) codigo = 'INTEGRIDADE_INVALIDA';
  else if (mensagemNormalizada.includes('backup')) codigo = 'BACKUP_FALHOU';
  else if (mensagemNormalizada.includes('alterações não salvas')) codigo = 'ALTERACOES_PENDENTES';
  else if (mensagemNormalizada.includes('confirmação de fechamento')) codigo = 'CONFIRMACAO_EXPIRADA';
  else if (mensagemNormalizada.includes('instalador') || mensagemNormalizada.includes('appimage')) codigo = 'INSTALADOR_FALHOU';
  else if (['eacces', 'enospc', 'eperm', 'write'].some(termo => mensagemNormalizada.includes(termo))) codigo = 'ARMAZENAMENTO_INDISPONIVEL';
  else if (mensagemNormalizada.includes('download') || etapa === 'download') codigo = 'DOWNLOAD_INTERROMPIDO';
  else if (mensagemNormalizada.includes('não há ') || mensagemNormalizada.includes('operação de atualização')) codigo = 'OPERACAO_INDISPONIVEL';
  return { codigo, etapa, mensagem: mensagemFalha(codigo), detalheTecnico: detalheTecnico(erro), ocorridoEm: new Date().toISOString(), acaoSugerida };
}

function calcularHash(caminho: string): string {
  return createHash('sha256').update(fs.readFileSync(caminho)).digest('hex');
}

interface PendenciaInstalacao {
  formato: ArtefatoAtualizacao['formato'];
  nome: string;
  tamanho: number;
  hashSha256: string;
  versao: string;
  requerBackupCompletoImagens: boolean;
}

interface RegistroUltimaVerificacao {
  verificadoEm: string;
}

interface RegistroPacotePronto {
  atualizacao: AtualizacaoDisponivel;
}

function compararVersoes(primeira: string, segunda: string): number {
  const primeiraPartes = primeira.match(SEMVER);
  const segundaPartes = segunda.match(SEMVER);
  if (!primeiraPartes || !segundaPartes) throw new Error('Versão SemVer inválida.');

  for (let indice = 1; indice <= 3; indice += 1) {
    const diferenca = Number(primeiraPartes[indice]) - Number(segundaPartes[indice]);
    if (diferenca !== 0) return diferenca;
  }

  const prePrimeira = primeiraPartes[4];
  const preSegunda = segundaPartes[4];
  if (!prePrimeira && !preSegunda) return 0;
  if (!prePrimeira) return 1;
  if (!preSegunda) return -1;
  return prePrimeira.localeCompare(preSegunda, 'en');
}

function serializarCanonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(serializarCanonico).join(',')}]`;
  if (typeof valor === 'object' && valor !== null) {
    const objeto = valor as Record<string, unknown>;
    return `{${Object.keys(objeto).sort().map(chave => `${JSON.stringify(chave)}:${serializarCanonico(objeto[chave])}`).join(',')}}`;
  }
  if (typeof valor === 'undefined' || typeof valor === 'function' || typeof valor === 'symbol') {
    throw new Error('Manifesto contém valor não serializável.');
  }
  return JSON.stringify(valor);
}

function textoObrigatorio(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || valor.trim() === '') throw new Error(`${campo} inválido.`);
  return valor.trim();
}

function plataformaAtual(): PlataformaAtualizacao {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'linux') return 'linux';
  if (process.platform === 'darwin') return 'macos';
  throw new Error('Sistema operacional sem suporte a atualização.');
}

function normalizarManifesto(valor: unknown): ManifestoAtualizacao {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) throw new Error('Manifesto inválido.');
  const manifesto = valor as Record<string, unknown>;
  const versao = textoObrigatorio(manifesto.versao, 'versao');
  if (!SEMVER.test(versao)) throw new Error('Versão do manifesto inválida.');
  const artefatosBrutos = manifesto.artefatos;
  if (!Array.isArray(artefatosBrutos) || artefatosBrutos.length === 0) throw new Error('Manifesto sem artefatos.');
  const artefatos = artefatosBrutos.map((valorArtefato): ArtefatoAtualizacao => {
    if (typeof valorArtefato !== 'object' || valorArtefato === null || Array.isArray(valorArtefato)) throw new Error('Artefato inválido.');
    const artefato = valorArtefato as Record<string, unknown>;
    const plataforma = textoObrigatorio(artefato.plataforma, 'plataforma');
    const arquitetura = textoObrigatorio(artefato.arquitetura, 'arquitetura');
    const formato = textoObrigatorio(artefato.formato, 'formato');
    const canal = textoObrigatorio(artefato.canal, 'canal');
    const hashSha256 = textoObrigatorio(artefato.hashSha256, 'hashSha256').toLowerCase();
    const url = textoObrigatorio(artefato.url, 'url');
    if (!['windows', 'linux', 'macos'].includes(plataforma) || !['x64', 'arm64'].includes(arquitetura)
      || !['nsis', 'AppImage', 'deb', 'dmg', 'zip'].includes(formato) || !['stable', 'experimental'].includes(canal)
      || !HASH_SHA256.test(hashSha256) || !Number.isSafeInteger(artefato.tamanho) || (artefato.tamanho as number) < 0
      || new URL(url).protocol !== 'https:') throw new Error('Artefato do manifesto inválido.');
    const nome = textoObrigatorio(artefato.nome, 'nome');
    if (path.basename(nome) !== nome) throw new Error('Nome do artefato inválido.');
    return { plataforma: plataforma as ArtefatoAtualizacao['plataforma'], arquitetura: arquitetura as ArtefatoAtualizacao['arquitetura'], formato: formato as ArtefatoAtualizacao['formato'], canal: canal as ArtefatoAtualizacao['canal'], nome, tamanho: artefato.tamanho as number, hashSha256, url };
  });
  const canais = manifesto.canais;
  if (!Array.isArray(canais) || !canais.every(canal => canal === 'stable' || canal === 'experimental')) throw new Error('Canais do manifesto inválidos.');
  if (typeof manifesto.requerBackupCompletoImagens !== 'boolean' || !Number.isSafeInteger(manifesto.versaoSchema) || (manifesto.versaoSchema as number) < 0) throw new Error('Metadados do manifesto inválidos.');
  const dataPublicacao = textoObrigatorio(manifesto.dataPublicacao, 'dataPublicacao');
  if (Number.isNaN(Date.parse(dataPublicacao))) throw new Error('Data de publicação inválida.');
  return { versaoManifesto: 1, versao, commit: textoObrigatorio(manifesto.commit, 'commit').toLowerCase(), dataPublicacao: new Date(dataPublicacao).toISOString(), canais: [...canais] as ManifestoAtualizacao['canais'], versaoSchema: manifesto.versaoSchema as number, requerBackupCompletoImagens: manifesto.requerBackupCompletoImagens, notas: textoObrigatorio(manifesto.notas, 'notas'), artefatos };
}

export class AtualizacaoService {
  private estado: EstadoAtualizacao = 'ociosa';
  private atualizacaoDisponivel?: AtualizacaoDisponivel;
  private caminhoDownload?: string;
  private falha?: FalhaAtualizacao;
  private progresso?: number;
  private progressoDetalhado?: ProgressoAtualizacao;
  private verificadoEm?: string;
  private readonly ouvintesProgresso = new Set<(progresso: ProgressoAtualizacao) => void>();

  constructor() {
    this.verificadoEm = this.carregarUltimaVerificacao();
    this.restaurarPacotePronto();
  }

  private get diretorioAtualizacoes(): string {
    return path.join(app.getPath('userData'), 'atualizacoes');
  }

  private get caminhoPendencia(): string {
    return path.join(app.getPath('userData'), 'atualizacao-pendente.json');
  }

  private get caminhoUltimaVerificacao(): string {
    return path.join(app.getPath('userData'), 'atualizacao-ultima-verificacao.json');
  }

  private get caminhoPacotePronto(): string {
    return path.join(app.getPath('userData'), 'atualizacao-pacote-pronto.json');
  }

  obterEstado(): EstadoAtualizacaoResposta {
    return { estado: this.estado, versaoInstalada: app.getVersion(), atualizacaoDisponivel: this.atualizacaoDisponivel, caminhoDownload: this.caminhoDownload, progresso: this.progresso, progressoDetalhado: this.progressoDetalhado, falha: this.falha, verificadoEm: this.verificadoEm };
  }

  onProgresso(ouvinte: (progresso: ProgressoAtualizacao) => void): () => void {
    this.ouvintesProgresso.add(ouvinte);
    return () => this.ouvintesProgresso.delete(ouvinte);
  }

  async verificar(manual = false): Promise<EstadoAtualizacaoResposta> {
    if (this.estado === 'verificando' || this.estado === 'baixando' || this.estado === 'instalando') throw new Error('Há uma operação de atualização em andamento.');
    if (!manual && this.verificadoEm && Date.now() - Date.parse(this.verificadoEm) < UM_DIA_EM_MS) return this.obterEstado();
    this.definirEstado('verificando');
    this.definirProgresso(5, 'verificando', 'Consultando atualizações disponíveis.');
    try {
      const plataforma = plataformaAtual();
      const arquitetura = process.arch === 'arm64' ? 'arm64' : 'x64';
      const indiceUrl = `${URL_FEED}/${plataforma}-${arquitetura}.json`;
      const sinal = AbortSignal.timeout(TIMEOUT_VERIFICACAO_MS);
      const [manifestoResposta, assinaturaResposta] = await Promise.all([fetch(indiceUrl, { signal: sinal }), fetch(`${indiceUrl}.sig`, { signal: sinal })]);
      if (!manifestoResposta.ok) throw new ErroRespostaHttpAtualizacao(manifestoResposta.status);
      if (!assinaturaResposta.ok) throw new ErroRespostaHttpAtualizacao(assinaturaResposta.status);
      this.definirProgresso(45, 'validando', 'Validando a atualização encontrada.');
      const manifestoBruto = await manifestoResposta.json() as unknown;
      const assinatura = (await assinaturaResposta.text()).trim();
      const manifesto = normalizarManifesto(manifestoBruto);
      const assinaturaValida = verify(null, Buffer.from(serializarCanonico(manifesto), 'utf8'), createPublicKey(chavePublicaRelease), Buffer.from(assinatura, 'base64'));
      if (!assinaturaValida) throw new Error('Assinatura do índice inválida.');
      const artefato = manifesto.artefatos.find(item => item.plataforma === plataforma && item.arquitetura === arquitetura);
      if (!artefato) throw new Error('Índice não possui artefato compatível com este dispositivo.');
      this.registrarUltimaVerificacao();
      if (compararVersoes(manifesto.versao, app.getVersion()) <= 0) {
        this.atualizacaoDisponivel = undefined;
        this.caminhoDownload = undefined;
        this.removerPacotePronto();
        this.definirEstado('ociosa');
        return this.obterEstado();
      }
      const pacotePronto = this.caminhoDownload && this.estado === 'baixada' && this.atualizacaoDisponivel?.versao === manifesto.versao;
      this.atualizacaoDisponivel = { versao: manifesto.versao, dataPublicacao: manifesto.dataPublicacao, notas: manifesto.notas, versaoSchema: manifesto.versaoSchema, requerBackupCompletoImagens: manifesto.requerBackupCompletoImagens, artefato };
      if (pacotePronto) {
        this.definirEstado('baixada');
      } else {
        this.caminhoDownload = undefined;
        this.removerPacotePronto();
        this.definirEstado('disponivel');
      }
      this.definirProgresso(100, 'validando', 'Atualização pronta para baixar.');
    } catch (erro) {
      this.definirFalha(erro, 'verificacao', 'verificar');
    }
    return this.obterEstado();
  }

  async baixar(): Promise<EstadoAtualizacaoResposta> {
    if ((this.estado !== 'disponivel' && !(this.estado === 'falhou' && this.falha?.acaoSugerida === 'baixar')) || !this.atualizacaoDisponivel) throw new Error('Não há atualização disponível para download.');
    this.definirEstado('baixando');
    this.definirProgresso(0, 'baixando', 'Iniciando download do pacote.');
    try {
      const resposta = await fetch(this.atualizacaoDisponivel.artefato.url);
      if (!resposta.ok) throw new ErroRespostaHttpAtualizacao(resposta.status);
      if (!resposta.body) throw new Error('Não foi possível baixar o instalador.');
      const destinoDir = path.join(app.getPath('userData'), 'atualizacoes');
      fs.mkdirSync(destinoDir, { recursive: true });
      const destino = path.join(destinoDir, this.atualizacaoDisponivel.artefato.nome);
      const temporario = `${destino}.parcial`;
      const arquivo = fs.createWriteStream(temporario, { flags: 'w' });
      const hash = createHash('sha256');
      let recebido = 0;
      const corpo = resposta.body as unknown as Parameters<typeof Readable.fromWeb>[0];
      for await (const parte of Readable.fromWeb(corpo)) {
        const bytes = Buffer.isBuffer(parte) ? parte : Buffer.from(parte);
        recebido += bytes.length;
        hash.update(bytes);
        if (!arquivo.write(bytes)) await new Promise<void>(resolve => arquivo.once('drain', resolve));
        this.definirProgresso(Math.min(95, Math.round((recebido / this.atualizacaoDisponivel.artefato.tamanho) * 95)), 'baixando', 'Baixando o pacote de atualização.');
      }
      await new Promise<void>((resolve, reject) => arquivo.end((erro?: Error | null) => erro ? reject(erro) : resolve()));
      const artefato = this.atualizacaoDisponivel.artefato;
      this.definirProgresso(96, 'validando', 'Validando a integridade do pacote.');
      if (recebido !== artefato.tamanho || hash.digest('hex') !== artefato.hashSha256) {
        fs.rmSync(temporario, { force: true });
        throw new Error('Arquivo baixado não corresponde ao manifesto.');
      }
      fs.renameSync(temporario, destino);
      this.caminhoDownload = destino;
      this.salvarPacotePronto();
      this.definirProgresso(100, 'validando', 'Pacote baixado e validado.');
      this.definirEstado('baixada');
    } catch (erro) {
      this.definirFalha(erro, 'download', 'baixar');
    }
    return this.obterEstado();
  }

  adiar(): EstadoAtualizacaoResposta {
    if (this.estado === 'baixando' || this.estado === 'instalando') throw new Error('Não é possível adiar uma operação em andamento.');
    if (this.atualizacaoDisponivel && this.estado !== 'baixada') this.definirEstado('disponivel');
    return this.obterEstado();
  }

  async instalarAgora(solicitarAutorizacao: () => Promise<void>): Promise<EstadoAtualizacaoResposta> {
    if ((this.estado !== 'baixada' && !(this.estado === 'falhou' && this.falha?.acaoSugerida === 'instalar')) || !this.atualizacaoDisponivel || !this.caminhoDownload) {
      throw new Error('Não há pacote validado pronto para instalação.');
    }
    this.definirEstado('instalando');
    try {
      this.definirProgresso(10, 'confirmando', 'Verificando se é seguro fechar o laWdo.');
      await solicitarAutorizacao();
      this.definirProgresso(35, 'backup', 'Criando backup antes da atualização.');
      await this.criarBackupObrigatorio();
      this.definirProgresso(90, 'abrindo_instalador', 'Abrindo o instalador. O laWdo será fechado.');
      await this.executarInstalador(this.atualizacaoDisponivel.artefato, this.caminhoDownload);
      this.definirEstado('concluida');
    } catch (erro) {
      this.definirFalha(erro, 'instalacao', 'instalar');
    }
    return this.obterEstado();
  }

  agendarParaProximaInicializacao(): EstadoAtualizacaoResposta {
    if (this.estado !== 'baixada' || !this.atualizacaoDisponivel || !this.caminhoDownload) {
      throw new Error('Não há pacote validado pronto para agendamento.');
    }
    if (!this.suportaInstalacaoAutomatica(this.atualizacaoDisponivel.artefato)) {
      throw new Error('Este formato requer instalação manual e não pode ser agendado.');
    }
    this.validarArquivoLocal(this.atualizacaoDisponivel.artefato, this.caminhoDownload);
    const pendencia: PendenciaInstalacao = {
      formato: this.atualizacaoDisponivel.artefato.formato,
      nome: this.atualizacaoDisponivel.artefato.nome,
      tamanho: this.atualizacaoDisponivel.artefato.tamanho,
      hashSha256: this.atualizacaoDisponivel.artefato.hashSha256,
      versao: this.atualizacaoDisponivel.versao,
      requerBackupCompletoImagens: this.atualizacaoDisponivel.requerBackupCompletoImagens,
    };
    fs.mkdirSync(path.dirname(this.caminhoPendencia), { recursive: true });
    const temporario = `${this.caminhoPendencia}.parcial`;
    fs.writeFileSync(temporario, JSON.stringify(pendencia), 'utf8');
    fs.renameSync(temporario, this.caminhoPendencia);
    this.definirEstado('aguardando_reinicio');
    this.definirProgresso(100, 'agendando', 'Atualização agendada para o próximo reinício.');
    return this.obterEstado();
  }

  async processarPendenciaInicializacao(): Promise<boolean> {
    if (!fs.existsSync(this.caminhoPendencia)) return false;
    try {
      const bruto = JSON.parse(fs.readFileSync(this.caminhoPendencia, 'utf8')) as unknown;
      const pendencia = this.normalizarPendencia(bruto);
      const artefato: ArtefatoAtualizacao = {
        plataforma: plataformaAtual(),
        arquitetura: process.arch === 'arm64' ? 'arm64' : 'x64',
        formato: pendencia.formato,
        canal: 'stable',
        nome: pendencia.nome,
        tamanho: pendencia.tamanho,
        hashSha256: pendencia.hashSha256,
        url: 'https://arquivo-local.invalid',
      };
      if (!this.suportaInstalacaoAutomatica(artefato)) throw new Error('A pendência possui formato sem instalação automática.');
      const caminhoDownload = path.join(this.diretorioAtualizacoes, pendencia.nome);
      this.validarArquivoLocal(artefato, caminhoDownload);
      if (pendencia.requerBackupCompletoImagens) await backupAtualizacaoService.criarBackupCompleto(pendencia.versao);
      else await backupAtualizacaoService.criarSnapshot(pendencia.versao);
      await this.executarInstalador(artefato, caminhoDownload);
      fs.rmSync(this.caminhoPendencia, { force: true });
      return true;
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Erro inesperado ao processar atualização agendada.';
      log.error('Falha ao processar atualização agendada.', { mensagem });
      return false;
    }
  }

  private async criarBackupObrigatorio(): Promise<void> {
    if (!this.atualizacaoDisponivel) throw new Error('Atualização indisponível para backup.');
    if (this.atualizacaoDisponivel.requerBackupCompletoImagens) {
      await backupAtualizacaoService.criarBackupCompleto(this.atualizacaoDisponivel.versao);
    } else {
      await backupAtualizacaoService.criarSnapshot(this.atualizacaoDisponivel.versao);
    }
  }

  private suportaInstalacaoAutomatica(artefato: ArtefatoAtualizacao): boolean {
    return (artefato.plataforma === 'windows' && artefato.formato === 'nsis')
      || (artefato.plataforma === 'linux' && artefato.formato === 'AppImage');
  }

  private validarArquivoLocal(artefato: ArtefatoAtualizacao, caminhoArquivo: string): void {
    const diretorioResolvido = path.resolve(this.diretorioAtualizacoes);
    const arquivoResolvido = path.resolve(caminhoArquivo);
    if (!arquivoResolvido.startsWith(`${diretorioResolvido}${path.sep}`) || path.basename(arquivoResolvido) !== artefato.nome) {
      throw new Error('Caminho do pacote local inválido.');
    }
    this.validarArquivo(artefato, arquivoResolvido);
  }

  private validarArquivo(artefato: ArtefatoAtualizacao, caminhoArquivo: string): void {
    if (!fs.existsSync(caminhoArquivo)) throw new Error('Pacote agendado não foi encontrado.');
    const estatisticas = fs.statSync(caminhoArquivo);
    if (!estatisticas.isFile() || estatisticas.size !== artefato.tamanho || calcularHash(caminhoArquivo) !== artefato.hashSha256) {
      throw new Error('Pacote agendado não corresponde ao manifesto validado.');
    }
  }

  private normalizarPendencia(valor: unknown): PendenciaInstalacao {
    if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) throw new Error('Registro de atualização agendada inválido.');
    const pendencia = valor as Record<string, unknown>;
    const formato = textoObrigatorio(pendencia.formato, 'formato');
    const nome = textoObrigatorio(pendencia.nome, 'nome');
    const hashSha256 = textoObrigatorio(pendencia.hashSha256, 'hashSha256').toLowerCase();
    const versao = textoObrigatorio(pendencia.versao, 'versao');
    if (!['nsis', 'AppImage'].includes(formato) || path.basename(nome) !== nome || !HASH_SHA256.test(hashSha256)
      || !Number.isSafeInteger(pendencia.tamanho) || (pendencia.tamanho as number) < 0 || !SEMVER.test(versao)
      || typeof pendencia.requerBackupCompletoImagens !== 'boolean') throw new Error('Registro de atualização agendada inválido.');
    return { formato: formato as PendenciaInstalacao['formato'], nome, tamanho: pendencia.tamanho as number, hashSha256, versao, requerBackupCompletoImagens: pendencia.requerBackupCompletoImagens };
  }

  private async executarInstalador(artefato: ArtefatoAtualizacao, caminhoArquivo: string): Promise<void> {
    this.validarArquivoLocal(artefato, caminhoArquivo);
    if (artefato.plataforma === 'windows' && artefato.formato === 'nsis') {
      const erro = await shell.openPath(caminhoArquivo);
      if (erro) throw new Error(`Não foi possível abrir o instalador: ${erro}`);
      app.quit();
      return;
    }
    if (artefato.plataforma === 'linux' && artefato.formato === 'AppImage') {
      const appImageAtual = process.env.APPIMAGE;
      if (!appImageAtual || !path.isAbsolute(appImageAtual)) throw new Error('A instalação automática do AppImage exige que o aplicativo esteja em execução como AppImage.');
      const script = path.join(this.diretorioAtualizacoes, `aplicar-atualizacao-${Date.now()}.sh`);
      fs.writeFileSync(script, '#!/bin/sh\nsleep 1\ncp "$1" "$2" && chmod +x "$2" && "$2" >/dev/null 2>&1 &\nrm -f "$0"\n', { encoding: 'utf8', mode: 0o700 });
      const processo = spawn('/bin/sh', [script, caminhoArquivo, appImageAtual], { detached: true, stdio: 'ignore' });
      processo.unref();
      app.quit();
      return;
    }
    const erro = await shell.openPath(caminhoArquivo);
    if (erro) throw new Error(`Não foi possível abrir o instalador para instalação manual: ${erro}`);
  }

  mostrarPacoteBaixado(): boolean {
    if (!this.atualizacaoDisponivel || !this.caminhoDownload) return false;
    this.validarArquivoLocal(this.atualizacaoDisponivel.artefato, this.caminhoDownload);
    shell.showItemInFolder(this.caminhoDownload);
    return true;
  }

  private salvarPacotePronto(): void {
    if (!this.atualizacaoDisponivel || !this.caminhoDownload) return;
    this.validarArquivoLocal(this.atualizacaoDisponivel.artefato, this.caminhoDownload);
    const temporario = `${this.caminhoPacotePronto}.parcial`;
    fs.writeFileSync(temporario, JSON.stringify({ atualizacao: this.atualizacaoDisponivel } satisfies RegistroPacotePronto), 'utf8');
    fs.renameSync(temporario, this.caminhoPacotePronto);
  }

  private removerPacotePronto(): void {
    fs.rmSync(this.caminhoPacotePronto, { force: true });
  }

  private restaurarPacotePronto(): void {
    try {
      if (!fs.existsSync(this.caminhoPacotePronto)) return;
      const bruto = JSON.parse(fs.readFileSync(this.caminhoPacotePronto, 'utf8')) as unknown;
      if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto) || !('atualizacao' in bruto)) throw new Error('Registro de pacote pronto inválido.');
      const atualizacaoBruta = (bruto as Record<string, unknown>).atualizacao;
      const manifesto = normalizarManifesto({
        versaoManifesto: 1,
        versao: (atualizacaoBruta as Record<string, unknown>)?.versao,
        commit: 'pacote-local-validado',
        dataPublicacao: (atualizacaoBruta as Record<string, unknown>)?.dataPublicacao,
        canais: ['stable'],
        versaoSchema: (atualizacaoBruta as Record<string, unknown>)?.versaoSchema,
        requerBackupCompletoImagens: (atualizacaoBruta as Record<string, unknown>)?.requerBackupCompletoImagens,
        notas: (atualizacaoBruta as Record<string, unknown>)?.notas,
        artefatos: [(atualizacaoBruta as Record<string, unknown>)?.artefato],
      });
      const plataforma = plataformaAtual();
      const arquitetura = process.arch === 'arm64' ? 'arm64' : 'x64';
      const artefato = manifesto.artefatos.find(item => item.plataforma === plataforma && item.arquitetura === arquitetura);
      if (!artefato || compararVersoes(manifesto.versao, app.getVersion()) <= 0) throw new Error('Pacote pronto incompatível com a versão instalada.');
      const caminhoDownload = path.join(this.diretorioAtualizacoes, artefato.nome);
      this.validarArquivoLocal(artefato, caminhoDownload);
      this.atualizacaoDisponivel = { versao: manifesto.versao, dataPublicacao: manifesto.dataPublicacao, notas: manifesto.notas, versaoSchema: manifesto.versaoSchema, requerBackupCompletoImagens: manifesto.requerBackupCompletoImagens, artefato };
      this.caminhoDownload = caminhoDownload;
      this.estado = 'baixada';
      this.progresso = 100;
      this.progressoDetalhado = { percentual: 100, etapa: 'validando', descricao: 'Pacote validado e pronto para instalar.' };
    } catch (erro) {
      log.warn('Pacote de atualização persistido foi descartado.', { mensagem: detalheTecnico(erro) });
      this.removerPacotePronto();
    }
  }

  private definirEstado(estado: EstadoAtualizacao): void {
    this.estado = estado;
    this.falha = undefined;
  }

  private definirProgresso(percentual: number, etapa: ProgressoAtualizacao['etapa'], descricao: string): void {
    const progresso = { percentual: Math.max(0, Math.min(100, Math.round(percentual))), etapa, descricao };
    this.progresso = progresso.percentual;
    this.progressoDetalhado = progresso;
    for (const ouvinte of this.ouvintesProgresso) ouvinte(progresso);
  }

  private carregarUltimaVerificacao(): string | undefined {
    try {
      if (!fs.existsSync(this.caminhoUltimaVerificacao)) return undefined;
      const conteudo = JSON.parse(fs.readFileSync(this.caminhoUltimaVerificacao, 'utf8')) as unknown;
      if (typeof conteudo !== 'object' || conteudo === null || Array.isArray(conteudo)) return undefined;
      const { verificadoEm } = conteudo as Partial<RegistroUltimaVerificacao>;
      if (typeof verificadoEm !== 'string' || Number.isNaN(Date.parse(verificadoEm))) return undefined;
      return new Date(verificadoEm).toISOString();
    } catch (erro) {
      log.warn('Não foi possível carregar a data da última verificação de atualização.', {
        mensagem: erro instanceof Error ? erro.message : 'Erro inesperado.',
      });
      return undefined;
    }
  }

  private registrarUltimaVerificacao(): void {
    this.verificadoEm = new Date().toISOString();
    try {
      fs.writeFileSync(this.caminhoUltimaVerificacao, JSON.stringify({ verificadoEm: this.verificadoEm }), 'utf8');
    } catch (erro) {
      log.warn('Não foi possível salvar a data da última verificação de atualização.', {
        mensagem: erro instanceof Error ? erro.message : 'Erro inesperado.',
      });
    }
  }

  private definirFalha(erro: unknown, etapa: EtapaFalhaAtualizacao, acaoSugerida?: AcaoAtualizacao): void {
    const falha = normalizarFalhaAtualizacao(erro, etapa, acaoSugerida);
    this.estado = 'falhou';
    this.falha = falha;
    log.warn('Falha na atualização.', { codigo: falha.codigo, etapa, detalheTecnico: falha.detalheTecnico });
  }
}

export const atualizacaoService = new AtualizacaoService();
