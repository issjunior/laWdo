import { cp, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const source = join(root, 'node_modules', 'tinymce');
const dest = join(root, 'src', 'renderer', 'public', 'tinymce');
const idiomaPersonalizado = join(root, 'src', 'renderer', 'assets', 'tinymce', 'pt_BR.js');

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

  if (existsSync(idiomaPersonalizado)) {
    const destinoIdioma = join(dest, 'langs', 'pt_BR.js');
    await mkdir(dirname(destinoIdioma), { recursive: true });
    await cp(idiomaPersonalizado, destinoIdioma, { force: true });
    console.log('✓ langs/pt_BR.js');
  }

  console.log('🏁 TinyMCE assets copiados para public/tinymce/');
}

main().catch(err => {
  console.error('Erro ao copiar TinyMCE:', err.message);
  process.exit(1);
});
