import { BaseService } from './base.service.js';
import { executeNonQuery, executeQuery } from '../database/sqlite.js';
import type { ProjetilPersonalizadoEntrada, ProjetilReferencia } from '../../shared/types/projetil.types.js';

interface ProjetilPersonalizadoRow {
  id: string;
  calibre: string;
  tipo: string;
  massa_gramas: number;
  calibre_real_mm: number | null;
  altura_maxima_mm: number | null;
  created_at: string;
  updated_at: string;
}

function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const normalizado = typeof valor === 'string' ? Number(valor.trim().replace(',', '.')) : valor;
  return typeof normalizado === 'number' && Number.isFinite(normalizado) ? normalizado : NaN;
}

export function validarProjetilPersonalizado(valor: unknown): ProjetilPersonalizadoEntrada {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Dados do projétil inválidos.');
  const dados = valor as Record<string, unknown>;
  const calibre = typeof dados.calibre === 'string' ? dados.calibre.trim() : '';
  const tipo = typeof dados.tipo === 'string' ? dados.tipo.trim() : '';
  const massaGramas = numero(dados.massaGramas);
  const calibreRealMm = numero(dados.calibreRealMm);
  const alturaMaximaMm = numero(dados.alturaMaximaMm);
  if (!calibre || calibre.length > 120 || !tipo || tipo.length > 120) {
    throw new Error('Informe calibre e tipo com até 120 caracteres.');
  }
  if (massaGramas === null || !Number.isFinite(massaGramas) || massaGramas <= 0) {
    throw new Error('A massa deve ser um número positivo.');
  }
  if ([calibreRealMm, alturaMaximaMm].some(medida => medida !== null && (!Number.isFinite(medida) || medida <= 0))) {
    throw new Error('Use apenas medidas positivas.');
  }
  if (calibreRealMm === null && alturaMaximaMm === null) {
    throw new Error('Informe ao menos uma dimensão do projétil.');
  }
  return { calibre, tipo, massaGramas, calibreRealMm, alturaMaximaMm };
}

function converter(row: ProjetilPersonalizadoRow): ProjetilReferencia {
  return {
    id: row.id,
    calibre: row.calibre,
    tipo: row.tipo,
    massaGramas: row.massa_gramas,
    sigla: /\b[A-Z]{3,5}\b/.exec(row.tipo)?.[0] ?? null,
    calibreRealMinMm: row.calibre_real_mm,
    calibreRealMaxMm: row.calibre_real_mm,
    alturaMinMm: row.altura_maxima_mm,
    alturaMaxMm: row.altura_maxima_mm,
    situacao: 'personalizada',
    fonte: 'Cadastro local',
    localizacao: 'Neste computador',
  };
}

function paraLinha(dados: ProjetilPersonalizadoEntrada) {
  return {
    calibre: dados.calibre,
    tipo: dados.tipo,
    massa_gramas: dados.massaGramas,
    calibre_real_mm: dados.calibreRealMm,
    altura_maxima_mm: dados.alturaMaximaMm,
  };
}

function chaveDuplicata(dados: ProjetilPersonalizadoEntrada): string {
  return JSON.stringify([
    dados.calibre.toLocaleLowerCase('pt-BR'), dados.tipo.toLocaleLowerCase('pt-BR'),
    dados.massaGramas, dados.calibreRealMm, dados.alturaMaximaMm,
  ]);
}

function lerCsv(texto: string): string[][] {
  if (texto.length > 1_000_000) throw new Error('CSV excede 1 MB.');
  const primeiraLinha = texto.split(/\r?\n/, 1)[0] ?? '';
  const separador = primeiraLinha.includes(';') ? ';' : ',';
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = '';
  let entreAspas = false;
  for (let i = 0; i < texto.length; i += 1) {
    const caractere = texto[i];
    if (caractere === '"') {
      if (entreAspas && texto[i + 1] === '"') { campo += '"'; i += 1; }
      else entreAspas = !entreAspas;
    } else if (caractere === separador && !entreAspas) {
      linha.push(campo.trim()); campo = '';
    } else if ((caractere === '\n' || caractere === '\r') && !entreAspas) {
      if (caractere === '\r' && texto[i + 1] === '\n') i += 1;
      linha.push(campo.trim()); campo = '';
      if (linha.some(Boolean)) linhas.push(linha);
      linha = [];
    } else campo += caractere;
  }
  if (entreAspas) throw new Error('CSV contém aspas não fechadas.');
  linha.push(campo.trim());
  if (linha.some(Boolean)) linhas.push(linha);
  return linhas;
}

class ProjetilService extends BaseService<ProjetilPersonalizadoRow> {
  constructor() { super('projeteis_personalizados'); }

  async listar(): Promise<ProjetilReferencia[]> {
    const linhas = await executeQuery<ProjetilPersonalizadoRow>(
      'SELECT * FROM projeteis_personalizados ORDER BY calibre, tipo, created_at',
    );
    return linhas.map(converter);
  }

  async salvar(valor: unknown, id?: string): Promise<ProjetilReferencia> {
    const dados = validarProjetilPersonalizado(valor);
    const duplicado = (await this.listar()).some(item => item.id !== id && chaveDuplicata({
      calibre: item.calibre, tipo: item.tipo, massaGramas: item.massaGramas ?? 0,
      calibreRealMm: item.calibreRealMinMm, alturaMaximaMm: item.alturaMinMm,
    }) === chaveDuplicata(dados));
    if (duplicado) throw new Error('Já existe um projétil personalizado com os mesmos dados.');
    const linha = paraLinha(dados);
    if (id) {
      const existente = await this.findById(id);
      if (!existente) throw new Error('Projétil personalizado não encontrado.');
      const atualizado = await this.update(id, linha);
      if (!atualizado) throw new Error('Não foi possível atualizar o projétil.');
      return converter(atualizado);
    }
    const criado = await this.create(linha);
    return converter(criado);
  }

  async excluir(id: string): Promise<void> {
    if (!await this.findById(id)) throw new Error('Projétil personalizado não encontrado.');
    await this.delete(id);
  }

  async importarCsv(texto: string): Promise<number> {
    const linhas = lerCsv(texto.replace(/^\uFEFF/, ''));
    const cabecalho = linhas.shift()?.map(campo => campo.toLowerCase()) ?? [];
    const colunas = ['calibre', 'tipo', 'massa_gramas', 'calibre_real_mm', 'altura_maxima_mm'];
    if (!colunas.every((coluna, indice) => cabecalho[indice] === coluna) || cabecalho.length !== colunas.length) {
      throw new Error(`Cabeçalho CSV esperado: ${colunas.join(';')}`);
    }
    if (linhas.length === 0 || linhas.length > 500) throw new Error('O CSV deve conter entre 1 e 500 projéteis.');
    const entradas = linhas.map((campos, indice) => {
      if (campos.length !== colunas.length) throw new Error(`Linha ${indice + 2}: quantidade de colunas inválida.`);
      try {
        return validarProjetilPersonalizado({
          calibre: campos[0], tipo: campos[1], massaGramas: campos[2],
          calibreRealMm: campos[3], alturaMaximaMm: campos[4],
        });
      } catch (erro) {
        throw new Error(`Linha ${indice + 2}: ${erro instanceof Error ? erro.message : 'dados inválidos'}`);
      }
    });
    const chavesExistentes = new Set((await this.listar()).map(item => chaveDuplicata({
      calibre: item.calibre, tipo: item.tipo, massaGramas: item.massaGramas ?? 0,
      calibreRealMm: item.calibreRealMinMm, alturaMaximaMm: item.alturaMinMm,
    })));
    const novasEntradas = entradas.filter(entrada => {
      const chave = chaveDuplicata(entrada);
      if (chavesExistentes.has(chave)) return false;
      chavesExistentes.add(chave);
      return true;
    });
    if (novasEntradas.length === 0) return 0;
    await executeNonQuery('BEGIN IMMEDIATE');
    try {
      for (const entrada of novasEntradas) await this.create(paraLinha(entrada));
      await executeNonQuery('COMMIT');
    } catch (erro) {
      await executeNonQuery('ROLLBACK');
      throw erro;
    }
    return novasEntradas.length;
  }
}

export const projetilService = new ProjetilService();
