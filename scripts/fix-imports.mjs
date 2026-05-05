import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('out');

/**
 * Verifica se um caminho é import relativo sem extensão conhecida
 */
function isRelativeWithoutExtension(importPath) {
  if (!importPath.startsWith('.')) return false;
  // Já tem extensão?
  const ext = path.extname(importPath);
  if (ext && ext.length > 0) return false;
  return true;
}

/**
 * Adiciona .js em imports/exports relativos dentro do código
 */
function fixFileImports(content) {
  // Padrões:
  // import ... from './utils/logger'
  // export ... from './utils/logger'
  // import('./utils/logger')
  // require('./utils/logger')
  const patterns = [
    // import ... from '...'
    /(\bfrom\s+['"])(\.[^'"]*)(['"])/g,
    // export ... from '...'
    /(\bexport\s+.*?\s+from\s+['"])(\.[^'"]*)(['"])/g,
    // import(...) ou require(...)
    /(\b(?:import|require)\s*\(\s*['"])(\.[^'"]*)(['"]\s*\))/g,
  ];

  let fixed = content;
  for (const pattern of patterns) {
    fixed = fixed.replace(pattern, (match, prefix, importPath, suffix) => {
      if (isRelativeWithoutExtension(importPath)) {
        return `${prefix}${importPath}.js${suffix}`;
      }
      return match;
    });
  }
  return fixed;
}

/**
 * Varre diretório recursivamente executando callback em cada arquivo .js
 */
function walkDir(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      callback(fullPath);
    }
  }
}

function main() {
  if (!fs.existsSync(OUT_DIR)) {
    console.warn(`⚠️ Diretório ${OUT_DIR} não existe.`);
    process.exit(0);
  }

  let modifiedCount = 0;

  walkDir(OUT_DIR, (filePath) => {
    const original = fs.readFileSync(filePath, 'utf-8');
    const fixed = fixFileImports(original);
    if (fixed !== original) {
      fs.writeFileSync(filePath, fixed, 'utf-8');
      modifiedCount++;
      console.log(`✅ Corrigido: ${filePath}`);
    }
  });

  console.log(`
🏁 Script finalizado. ${modifiedCount} arquivo(s) modificado(s).`);
}

main();
