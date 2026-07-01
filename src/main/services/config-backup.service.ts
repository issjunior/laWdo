import fs from 'fs';
import AdmZip from 'adm-zip';
import { getLogger } from '../utils/logger.js';
import { executeQuery, executeNonQuery, withTransaction } from '../database/sqlite.js'
const log = getLogger('configuracao');

const CHAVES_IA_EXCLUIDAS = ['api_key_groq', 'api_key_gemini', 'modelo_ia_padrao', 'modelo_gemini_padrao', 'provedor_ia'];

interface ManifestConfig {
  version: number;
  tipo: 'config';
  data: string;
  tabelas: string[];
}

type LinhaConfig = Record<string, unknown> & {
  chave?: string;
};

function isLinhaConfig(valor: unknown): valor is LinhaConfig {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

const TABELAS_CONFIG: { tabela: string; ordem: number }[] = [
  { tabela: 'tipos_exame', ordem: 1 },
  { tabela: 'templates', ordem: 2 },
  { tabela: 'secoes_template', ordem: 3 },
  { tabela: 'categorias_placeholders', ordem: 4 },
  { tabela: 'placeholders', ordem: 5 },
  { tabela: 'solicitantes', ordem: 6 },
  { tabela: 'configuracoes', ordem: 7 },
];

const NOMES_TABELAS = TABELAS_CONFIG.map((t) => t.tabela);

/**
 * Exporta tabelas de configuração para um arquivo ZIP.
 * Cada tabela vira um JSON. Configuracoes sao filtradas (sem chaves de IA).
 */
export const exportarConfig = async (
  destino: string
): Promise<{ success: boolean; path?: string; error?: string }> => {
  try {
    const zip = new AdmZip();
    const manifest: ManifestConfig = {
      version: 1,
      tipo: 'config',
      data: new Date().toISOString(),
      tabelas: NOMES_TABELAS,
    };

    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'));

    for (const { tabela } of TABELAS_CONFIG) {
      const rows = await executeQuery<LinhaConfig>(`SELECT * FROM ${tabela}`);

      if (tabela === 'configuracoes') {
        const filtrado = rows.filter(
          (r) => typeof r.chave !== 'string' || !CHAVES_IA_EXCLUIDAS.includes(r.chave)
        );
        zip.addFile(`${tabela}.json`, Buffer.from(JSON.stringify(filtrado, null, 2), 'utf-8'));
        log.info(`Tabela ${tabela} exportada: ${filtrado.length} registros (${rows.length - filtrado.length} IA excluidos)`);
      } else {
        zip.addFile(`${tabela}.json`, Buffer.from(JSON.stringify(rows, null, 2), 'utf-8'));
        log.info(`Tabela ${tabela} exportada: ${rows.length} registros`);
      }
    }

    zip.writeZip(destino);
    log.info('Backup de configuracao criado com sucesso', { destino });
    return { success: true, path: destino };
  } catch (error) {
    log.error('Erro ao exportar configuracao', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao exportar configuracao',
    };
  }
};

/**
 * Importa tabelas de configuracao de um ZIP.
 * Usa UPSERT: INSERT OR REPLACE (adiciona novos, atualiza existentes, mantem nao listados).
 * A ordem respeita dependencias de FK.
 */
export const importarConfig = async (
  origem: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!fs.existsSync(origem)) {
      throw new Error('Arquivo de backup nao encontrado');
    }

    const zip = new AdmZip(origem);

    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) {
      throw new Error('Arquivo invalido: manifest.json nao encontrado');
    }

    const manifest: ManifestConfig = JSON.parse(manifestEntry.getData().toString('utf-8'));

    if (manifest.tipo !== 'config') {
      throw new Error('Arquivo nao e um backup de configuracao');
    }

    const tabelasOrdenadas = TABELAS_CONFIG.filter(({ tabela }) =>
      manifest.tabelas.includes(tabela) && zip.getEntry(`${tabela}.json`)
    );

    if (tabelasOrdenadas.length === 0) {
      throw new Error('Nenhuma tabela valida encontrada no arquivo');
    }

    for (const { tabela } of tabelasOrdenadas) {
      const entry = zip.getEntry(`${tabela}.json`);
      if (!entry) continue;

      const registrosRaw: unknown = JSON.parse(entry.getData().toString('utf-8'));

      if (!Array.isArray(registrosRaw) || registrosRaw.length === 0) {
        log.info(`Tabela ${tabela}: vazia, nada a importar`);
        continue;
      }

      const registros = registrosRaw.filter(isLinhaConfig);
      if (registros.length === 0) {
        log.info(`Tabela ${tabela}: sem registros validos, nada a importar`);
        continue;
      }

      await withTransaction(async () => {
        const colunas = Object.keys(registros[0]);
        const placeholders = colunas.map(() => '?').join(', ');
        const sql = `INSERT OR REPLACE INTO ${tabela} (${colunas.join(', ')}) VALUES (${placeholders})`;

        for (const registro of registros) {
          const valores = colunas.map((col: string) => {
            const val = registro[col];
            if (typeof val === 'boolean') return val ? 1 : 0;
            return val ?? null;
          });
          await executeNonQuery(sql, valores);
        }
      });

      log.info(`Tabela ${tabela}: ${registros.length} registros importados`);
    }

    log.info('Configuracao importada com sucesso');
    return { success: true };
  } catch (error) {
    log.error('Erro ao importar configuracao', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao importar configuracao',
    };
  }
};
