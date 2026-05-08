import { cp, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const source = join(root, 'node_modules', 'tinymce');
const dest = join(root, 'src', 'renderer', 'public', 'tinymce');

const files = ['tinymce.min.js'];
const dirs = ['skins', 'icons', 'models', 'themes', 'plugins'];

async function main() {
  if (!existsSync(dest)) {
    await mkdir(dest, { recursive: true });
  }

  for (const file of files) {
    const src = join(source, file);
    if (existsSync(src)) {
      await cp(src, join(dest, file), { force: true });
      console.log(`✓ ${file}`);
    }
  }

  for (const dir of dirs) {
    const src = join(source, dir);
    if (existsSync(src)) {
      await cp(src, join(dest, dir), { recursive: true, force: true });
      console.log(`✓ ${dir}/`);
    }
  }

  console.log('🏁 TinyMCE assets copiados para public/tinymce/');
}

main().catch(err => {
  console.error('Erro ao copiar TinyMCE:', err.message);
  process.exit(1);
});
