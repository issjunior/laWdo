import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');

/**
 * Encontra todos os arquivos .ts/.tsx no diretório src/
 */
function findTsFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      findTsFiles(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Adiciona .js em imports relativos:
 * - Se aponta para diretório com index.ts → adiciona /index.js
 * - Se aponta para arquivo sem extensão → adiciona .js
 */
function fixImports(content, filePath) {
  let lines = content.split('\n');
  const newLines = [];

  for (const line of lines) {
    let modified = false;

    const patterns = [
      // import ... from 'path'
      /^(\s*(?:import|export)\b.*?\bfrom\s+['"])(\.[^'"]*)(['"].*?)$/,
      // dynamic import()
      /(\bimport\s*\(\s*['"])(\.[^'"]*)(['"]\s*\).*?)$/,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && !modified) {
        const prefix = match[1];
        let importPath = match[2];
        const suffix = match[3];

        // Se não tem extensão
        if (!path.extname(importPath) || path.extname(importPath) === '') {
          // Verificar se o caminho aponta para um diretório (index.ts existe)
          const resolvedDir = path.resolve(path.dirname(filePath), importPath);
          const indexTsPath = path.join(resolvedDir, 'index.ts');
          const indexTsxPath = path.join(resolvedDir, 'index.tsx');

          if (fs.existsSync(indexTsPath) || fs.existsSync(indexTsxPath)) {
            importPath = importPath.replace(/\/$/, '') + '/index.js';
          } else {
            importPath = importPath + '.js';
          }

          newLines.push(prefix + importPath + suffix);
          modified = true;
          break;
        }
      }
    }

    if (!modified) {
      newLines.push(line);
    }
  }

  return newLines.join('\n');
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`❌ Diretóriop ${SRC_DIR} não existe.`);
    process.exit(1);
  }

  const files = findTsFiles(SRC_DIR);
  let modifiedCount = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const fixed = fixImports(content, file);
    if (fixed !== content) {
      fs.writeFileSync(file, fixed, 'utf8');
      console.log(`✅ Corrigido: ${path.relative(process.cwd(), file)}`);
      modifiedCount++;
    }
  }

  console.log(`\n✨ ${modifiedCount} arquivo(s) modificado(s)`);
}

main();
