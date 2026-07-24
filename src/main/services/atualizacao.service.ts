import { app, shell } from 'electron';
import { spawn } from 'node:child_process';
import { createHash, createPublicKey, verify } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { chavePublicaRelease } from '../../shared/atualizacao/chave-publica-release.js';
import type {
  ArtefatoAtualizacao,
  AtualizacaoDisponivel,
  EstadoAtualizacao,
  EstadoAtualizacaoResposta,
  ManifestoAtualizacao,
  PlataformaAtualizacao,
} from '../../shared/atualizacao/atualizacao.types.js';
import { getLogger } from '../utils/logger.js';
import { backupAtualizacaoService } from './backup-atualizacao.service.js';

const log = getLogger('atualizacao');
const URL_FEED = 'https://issjunior.github.io/laWdo/stable';
const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;
const HASH_SHA256 = /^[a-f0-9]{64}$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

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
  private erro?: string;
  private progresso?: number;
  private verificadoEm?: string;

  private get diretorioAtualizacoes(): string {
    return path.join(app.getPath('userData'), 'atualizacoes');
  }

  private get caminhoPendencia(): string {
    return path.join(app.getPath('userData'), 'atualizacao-pendente.json');
  }

  obterEstado(): EstadoAtualizacaoResposta {
    return { estado: this.estado, versaoInstalada: app.getVersion(), atualizacaoDisponivel: this.atualizacaoDisponivel, caminhoDownload: this.caminhoDownload, progresso: this.progresso, erro: this.erro, verificadoEm: this.verificadoEm };
  }

  async verificar(manual = false): Promise<EstadoAtualizacaoResposta> {
    if (this.estado === 'verificando' || this.estado === 'baixando' || this.estado === 'instalando') throw new Error('Há uma operação de atualização em andamento.');
    if (!manual && this.verificadoEm && Date.now() - Date.parse(this.verificadoEm) < UM_DIA_EM_MS) return this.obterEstado();
    this.definirEstado('verificando');
    try {
      const plataforma = plataformaAtual();
      const arquitetura = process.arch === 'arm64' ? 'arm64' : 'x64';
      const indiceUrl = `${URL_FEED}/${plataforma}-${arquitetura}.json`;
      const [manifestoResposta, assinaturaResposta] = await Promise.all([fetch(indiceUrl), fetch(`${indiceUrl}.sig`)]);
      if (!manifestoResposta.ok || !assinaturaResposta.ok) throw new Error('Índice de atualização indisponível.');
      const manifestoBruto = await manifestoResposta.json() as unknown;
      const assinatura = (await assinaturaResposta.text()).trim();
      const manifesto = normalizarManifesto(manifestoBruto);
      const assinaturaValida = verify(null, Buffer.from(serializarCanonico(manifesto), 'utf8'), createPublicKey(chavePublicaRelease), Buffer.from(assinatura, 'base64'));
      if (!assinaturaValida) throw new Error('Assinatura do índice inválida.');
      const artefato = manifesto.artefatos.find(item => item.plataforma === plataforma && item.arquitetura === arquitetura);
      if (!artefato) throw new Error('Índice não possui artefato compatível com este dispositivo.');
      this.verificadoEm = new Date().toISOString();
      if (compararVersoes(manifesto.versao, app.getVersion()) <= 0) {
        this.atualizacaoDisponivel = undefined;
        this.caminhoDownload = undefined;
        this.definirEstado('ociosa');
        return this.obterEstado();
      }
      this.atualizacaoDisponivel = { versao: manifesto.versao, dataPublicacao: manifesto.dataPublicacao, notas: manifesto.notas, versaoSchema: manifesto.versaoSchema, requerBackupCompletoImagens: manifesto.requerBackupCompletoImagens, artefato };
      this.caminhoDownload = undefined;
      this.definirEstado('disponivel');
    } catch (erro) {
      this.definirFalha(erro);
    }
    return this.obterEstado();
  }

  async baixar(): Promise<EstadoAtualizacaoResposta> {
    if (this.estado !== 'disponivel' || !this.atualizacaoDisponivel) throw new Error('Não há atualização disponível para download.');
    this.definirEstado('baixando');
    try {
      const resposta = await fetch(this.atualizacaoDisponivel.artefato.url);
      if (!resposta.ok || !resposta.body) throw new Error('Não foi possível baixar o instalador.');
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
        this.progresso = Math.min(100, Math.round((recebido / this.atualizacaoDisponivel.artefato.tamanho) * 100));
      }
      await new Promise<void>((resolve, reject) => arquivo.end((erro?: Error | null) => erro ? reject(erro) : resolve()));
      const artefato = this.atualizacaoDisponivel.artefato;
      if (recebido !== artefato.tamanho || hash.digest('hex') !== artefato.hashSha256) {
        fs.rmSync(temporario, { force: true });
        throw new Error('Arquivo baixado não corresponde ao manifesto.');
      }
      fs.renameSync(temporario, destino);
      this.caminhoDownload = destino;
      this.progresso = 100;
      this.definirEstado('baixada');
    } catch (erro) {
      this.definirFalha(erro);
    }
    return this.obterEstado();
  }

  async carregarAtualizacaoOffline(caminhoManifesto: string): Promise<EstadoAtualizacaoResposta> {
    this.definirEstado('verificando');
    try {
      const diretorio = path.dirname(caminhoManifesto);
      const assinatura = fs.readFileSync(path.join(diretorio, `${path.basename(caminhoManifesto)}.sig`), 'utf8').trim();
      const manifesto = normalizarManifesto(JSON.parse(fs.readFileSync(caminhoManifesto, 'utf8')) as unknown);
      if (!verify(null, Buffer.from(serializarCanonico(manifesto), 'utf8'), createPublicKey(chavePublicaRelease), Buffer.from(assinatura, 'base64'))) throw new Error('Assinatura do manifesto offline inválida.');
      if (compararVersoes(manifesto.versao, app.getVersion()) <= 0) throw new Error('A atualização offline não é mais recente que a versão instalada.');
      const plataforma = plataformaAtual();
      const arquitetura = process.arch === 'arm64' ? 'arm64' : 'x64';
      const artefato = manifesto.artefatos.find(item => item.plataforma === plataforma && item.arquitetura === arquitetura);
      if (!artefato) throw new Error('O manifesto offline não possui pacote compatível com este dispositivo.');
      const origem = path.join(diretorio, artefato.nome);
      this.validarArquivo(artefato, origem, false);
      fs.mkdirSync(this.diretorioAtualizacoes, { recursive: true });
      const destino = path.join(this.diretorioAtualizacoes, artefato.nome);
      fs.copyFileSync(origem, destino);
      this.validarArquivoLocal(artefato, destino);
      this.atualizacaoDisponivel = { versao: manifesto.versao, dataPublicacao: manifesto.dataPublicacao, notas: manifesto.notas, versaoSchema: manifesto.versaoSchema, requerBackupCompletoImagens: manifesto.requerBackupCompletoImagens, artefato };
      this.caminhoDownload = destino;
      this.progresso = 100;
      this.definirEstado('baixada');
    } catch (erro) { this.definirFalha(erro); }
    return this.obterEstado();
  }

  adiar(): EstadoAtualizacaoResposta {
    if (this.estado === 'baixando' || this.estado === 'instalando') throw new Error('Não é possível adiar uma operação em andamento.');
    if (this.atualizacaoDisponivel && this.estado !== 'baixada') this.definirEstado('disponivel');
    return this.obterEstado();
  }

  async prepararReinicio(solicitarAutorizacao: () => Promise<void>): Promise<EstadoAtualizacaoResposta> {
    if (this.estado !== 'baixada' || !this.atualizacaoDisponivel || !this.caminhoDownload) {
      throw new Error('Não há pacote validado pronto para instalação.');
    }
    this.definirEstado('instalando');
    try {
      await solicitarAutorizacao();
      if (this.atualizacaoDisponivel.requerBackupCompletoImagens) {
        await backupAtualizacaoService.criarBackupCompleto(this.atualizacaoDisponivel.versao);
      } else {
        await backupAtualizacaoService.criarSnapshot(this.atualizacaoDisponivel.versao);
      }
      this.definirEstado('aguardando_reinicio');
    } catch (erro) {
      this.definirFalha(erro);
    }
    return this.obterEstado();
  }

  async instalarAgora(solicitarAutorizacao: () => Promise<void>): Promise<EstadoAtualizacaoResposta> {
    if (this.estado !== 'baixada' || !this.atualizacaoDisponivel || !this.caminhoDownload) {
      throw new Error('Não há pacote validado pronto para instalação.');
    }
    this.definirEstado('instalando');
    try {
      await solicitarAutorizacao();
      await this.criarBackupObrigatorio();
      await this.executarInstalador(this.atualizacaoDisponivel.artefato, this.caminhoDownload);
      this.definirEstado('concluida');
    } catch (erro) {
      this.definirFalha(erro);
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
      fs.rmSync(this.caminhoPendencia, { force: true });
      await this.executarInstalador(artefato, caminhoDownload);
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
    this.validarArquivo(artefato, arquivoResolvido, true);
  }

  private validarArquivo(artefato: ArtefatoAtualizacao, caminhoArquivo: string, controlado: boolean): void {
    if (!fs.existsSync(caminhoArquivo)) throw new Error(controlado ? 'Pacote agendado não foi encontrado.' : 'Pacote offline não foi encontrado ao lado do manifesto.');
    const estatisticas = fs.statSync(caminhoArquivo);
    if (!estatisticas.isFile() || estatisticas.size !== artefato.tamanho || calcularHash(caminhoArquivo) !== artefato.hashSha256) {
      throw new Error(controlado ? 'Pacote agendado não corresponde ao manifesto validado.' : 'Pacote offline não corresponde ao manifesto.');
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
      const processo = spawn(caminhoArquivo, ['/S'], { detached: true, stdio: 'ignore' });
      processo.unref();
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

  private definirEstado(estado: EstadoAtualizacao): void {
    this.estado = estado;
    this.erro = undefined;
  }

  private definirFalha(erro: unknown): void {
    const mensagem = erro instanceof Error ? erro.message : 'Falha inesperada ao atualizar.';
    this.estado = 'falhou';
    this.erro = mensagem;
    log.warn('Falha na verificação ou download de atualização.', { mensagem });
  }
}

export const atualizacaoService = new AtualizacaoService();
