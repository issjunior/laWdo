import { app } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { criarBackupConsistente } from '../database/sqlite.js';
import { getSchemaVersion } from '../database/index.js';
import { getLogger } from '../utils/logger.js';

const log = getLogger('atualizacao');
const NOME_MARCADOR = 'recuperacao-atualizacao-pendente.json';
const DIRETORIOS_PROTEGIDOS = ['imagens', 'avatars', 'gdl'] as const;

type EstadoRecuperacao = 'preparada' | 'iniciada';

interface MarcadorRecuperacaoAtualizacao {
  formato: 1;
  id: string;
  criadoEm: string;
  versaoOrigem: string;
  versaoDestino: string;
  schemaOrigem: number;
  diretorioSnapshot: string;
  estado: EstadoRecuperacao;
}

export interface RelatoRecuperacaoAtualizacao {
  codigo: string;
  ocorridoEm: string;
  versaoOrigem: string;
  versaoDestino: string;
  schemaOrigem: number;
  schemaDestino?: number;
  resultado: 'confirmada' | 'restaurada' | 'falhou';
}

function hashArquivo(caminho: string): string {
  return createHash('sha256').update(fs.readFileSync(caminho)).digest('hex');
}

function verificarBanco(caminho: string): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    const banco = new sqlite3.Database(caminho, sqlite3.OPEN_READONLY, erroAbertura => {
      if (erroAbertura) return rejeitar(erroAbertura);
      banco.get<{ integrity_check: string }>('PRAGMA integrity_check', (erro, linha) => {
        banco.close(() => undefined);
        if (erro) return rejeitar(erro);
        if (linha?.integrity_check !== 'ok') return rejeitar(new Error('Integridade do snapshot pré-atualização inválida.'));
        resolver();
      });
    });
  });
}

function copiarArvore(origem: string, destino: string): void {
  if (!fs.existsSync(origem)) return;
  for (const entrada of fs.readdirSync(origem, { withFileTypes: true })) {
    const origemEntrada = path.join(origem, entrada.name);
    const destinoEntrada = path.join(destino, entrada.name);
    if (entrada.isDirectory()) {
      fs.mkdirSync(destinoEntrada, { recursive: true });
      copiarArvore(origemEntrada, destinoEntrada);
    } else if (entrada.isFile()) {
      fs.mkdirSync(path.dirname(destinoEntrada), { recursive: true });
      fs.copyFileSync(origemEntrada, destinoEntrada, fs.constants.COPYFILE_EXCL);
      if (hashArquivo(origemEntrada) !== hashArquivo(destinoEntrada)) throw new Error('Falha ao validar arquivo do snapshot pré-atualização.');
    }
  }
}

export class RecuperacaoAtualizacaoService {
  constructor(private readonly diretorioDados = app.getPath('userData'), private readonly versaoAplicativo = app.getVersion()) {}

  private get caminhoMarcador(): string { return path.join(this.diretorioDados, NOME_MARCADOR); }

  private lerMarcador(): MarcadorRecuperacaoAtualizacao | undefined {
    try {
      if (!fs.existsSync(this.caminhoMarcador)) return undefined;
      const valor: unknown = JSON.parse(fs.readFileSync(this.caminhoMarcador, 'utf8'));
      if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Marcador inválido.');
      const marcador = valor as Partial<MarcadorRecuperacaoAtualizacao>;
      if (marcador.formato !== 1 || typeof marcador.id !== 'string' || typeof marcador.versaoOrigem !== 'string'
        || typeof marcador.versaoDestino !== 'string' || !Number.isSafeInteger(marcador.schemaOrigem)
        || typeof marcador.diretorioSnapshot !== 'string' || !['preparada', 'iniciada'].includes(String(marcador.estado))) throw new Error('Marcador inválido.');
      const raiz = path.resolve(this.diretorioDados, 'backups-atualizacao');
      const snapshot = path.resolve(marcador.diretorioSnapshot);
      if (!snapshot.startsWith(`${raiz}${path.sep}`)) throw new Error('Marcador aponta para snapshot inválido.');
      return marcador as MarcadorRecuperacaoAtualizacao;
    } catch (erro) {
      log.error('Marcador de recuperação pré-atualização inválido.', { erro: erro instanceof Error ? erro.message : 'erro_inesperado' });
      throw erro;
    }
  }

  private salvarMarcador(marcador: MarcadorRecuperacaoAtualizacao): void {
    const temporario = `${this.caminhoMarcador}.parcial`;
    fs.writeFileSync(temporario, JSON.stringify(marcador, null, 2), 'utf8');
    fs.renameSync(temporario, this.caminhoMarcador);
  }

  async preparar(versaoDestino: string): Promise<RelatoRecuperacaoAtualizacao> {
    const banco = path.join(this.diretorioDados, 'laudopericial.db');
    if (!fs.existsSync(banco)) throw new Error('Banco de dados não encontrado para recuperação pré-atualização.');
    const schemaOrigem = await getSchemaVersion();
    const id = randomUUID();
    const diretorioSnapshot = path.join(this.diretorioDados, 'backups-atualizacao', `transacao-${id}`);
    fs.mkdirSync(diretorioSnapshot, { recursive: true });
    try {
      const bancoSnapshot = path.join(diretorioSnapshot, 'laudopericial.db');
      await criarBackupConsistente(bancoSnapshot);
      if (!fs.existsSync(bancoSnapshot) || fs.statSync(bancoSnapshot).size === 0) throw new Error('Snapshot do banco inválido.');
      await verificarBanco(bancoSnapshot);
      for (const diretorio of DIRETORIOS_PROTEGIDOS) copiarArvore(path.join(this.diretorioDados, diretorio), path.join(diretorioSnapshot, diretorio));
      const marcador: MarcadorRecuperacaoAtualizacao = {
        formato: 1, id, criadoEm: new Date().toISOString(), versaoOrigem: this.versaoAplicativo,
        versaoDestino, schemaOrigem, diretorioSnapshot, estado: 'preparada',
      };
      this.salvarMarcador(marcador);
      return { codigo: 'ATUALIZACAO_PREPARADA', ocorridoEm: marcador.criadoEm, versaoOrigem: marcador.versaoOrigem, versaoDestino, schemaOrigem, resultado: 'confirmada' };
    } catch (erro) {
      fs.rmSync(diretorioSnapshot, { recursive: true, force: true });
      throw erro;
    }
  }

  iniciarVersaoDestino(): void {
    const marcador = this.lerMarcador();
    if (!marcador || marcador.versaoDestino !== this.versaoAplicativo || marcador.estado === 'iniciada') return;
    marcador.estado = 'iniciada';
    this.salvarMarcador(marcador);
  }

  confirmarSaude(schemaDestino: number): void {
    const marcador = this.lerMarcador();
    if (!marcador || marcador.versaoDestino !== this.versaoAplicativo) return;
    fs.rmSync(this.caminhoMarcador, { force: true });
    log.info('Atualização confirmada após abertura saudável.', { versaoOrigem: marcador.versaoOrigem, versaoDestino: marcador.versaoDestino, schemaDestino });
  }

  async restaurarSeInterrompida(): Promise<RelatoRecuperacaoAtualizacao | undefined> {
    const marcador = this.lerMarcador();
    if (!marcador || marcador.estado !== 'iniciada' || marcador.versaoDestino !== this.versaoAplicativo) return undefined;
    const bancoSnapshot = path.join(marcador.diretorioSnapshot, 'laudopericial.db');
    if (!fs.existsSync(bancoSnapshot)) throw new Error('Snapshot pré-atualização não encontrado.');
    await verificarBanco(bancoSnapshot);
    const diretorioAnterior = path.join(this.diretorioDados, `recuperacao-atualizacao-falha-${marcador.id}`);
    fs.mkdirSync(diretorioAnterior, { recursive: true });
    const bancoAtivo = path.join(this.diretorioDados, 'laudopericial.db');
    try {
      if (fs.existsSync(bancoAtivo)) fs.renameSync(bancoAtivo, path.join(diretorioAnterior, 'laudopericial.db'));
      fs.copyFileSync(bancoSnapshot, bancoAtivo, fs.constants.COPYFILE_EXCL);
      for (const diretorio of DIRETORIOS_PROTEGIDOS) {
        const ativo = path.join(this.diretorioDados, diretorio);
        const anterior = path.join(diretorioAnterior, diretorio);
        const snapshot = path.join(marcador.diretorioSnapshot, diretorio);
        if (fs.existsSync(ativo)) fs.renameSync(ativo, anterior);
        if (fs.existsSync(snapshot)) copiarArvore(snapshot, ativo);
      }
      fs.rmSync(this.caminhoMarcador, { force: true });
      return { codigo: 'ATUALIZACAO_REVERTIDA', ocorridoEm: new Date().toISOString(), versaoOrigem: marcador.versaoOrigem, versaoDestino: marcador.versaoDestino, schemaOrigem: marcador.schemaOrigem, resultado: 'restaurada' };
    } catch (erro) {
      log.error('Falha ao restaurar atualização interrompida.', { erro: erro instanceof Error ? erro.message : 'erro_inesperado' });
      throw erro;
    }
  }
}

export const recuperacaoAtualizacaoService = new RecuperacaoAtualizacaoService();

export function formatarRelatoRecuperacao(relato: RelatoRecuperacaoAtualizacao): string {
  return [
    'Relato de recuperação de atualização do laWdo',
    `Código: ${relato.codigo}`,
    `Ocorrido em: ${relato.ocorridoEm}`,
    `Versão de origem: v${relato.versaoOrigem}`,
    `Versão de destino: v${relato.versaoDestino}`,
    `Schema de origem: ${relato.schemaOrigem}`,
    ...(relato.schemaDestino === undefined ? [] : [`Schema de destino: ${relato.schemaDestino}`]),
    `Resultado: ${relato.resultado}`,
    'Anexe os logs locais pelo canal autorizado, sem incluir dados de REPs, laudos, credenciais ou chaves.',
    'Desenvolvedor: izaias.santos@policiacientifica.pr.gov.br',
    'Projeto: https://github.com/issjunior/laWdo',
  ].join('\n');
}
