import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reverte .js em imports que usam alias Vite (ex: @/pages/index.js → @/pages)
 */
function fixAliasedImports(content) {
  const lines = content.split('\n');

  return lines.map(line => {
    // Regex para capturar imports com alias @/ que terminam em .js
    const match = line.match(/(\s*(?:import|export)\b.*?\bfrom\s+['"])(@\/[^'"]*\.js)(['"].*?)$/);
    if (match) {
      let importPath = match[2];
      // Remover .js do final
      importPath = importPath.replace(/\.js$/, '');
      return match[1] + importPath + match[3];
    }
    return line;
  }).join('\n');
}

function main() {
  const files = [
    'src/renderer/App.tsx',
    'src/renderer/index.tsx',
    // Adicione outros arquivos se necessário
  ];

  let modifiedCount = 0;

  for (const relativePath of files) {
    const fullPath = path.resolve(__dirname, '..', relativePath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️ Arquivo não encontrado: ${fullPath}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    const fixed = fixAliasedImports(content);
    if (fixed !== content) {
      fs.writeFileSync(fullPath, fixed, 'utf8');
      console.log(`✅ Revertido alias: ${relativePath}`);
      modifiedCount++;
    }
  }

  console.log(`\n✨ ${modifiedCount} arquivo(s) corrigido(s)`);
}

main();
