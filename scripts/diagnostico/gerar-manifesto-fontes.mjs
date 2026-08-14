import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const marcadores = {
  'layout.conteudo-principal': 'src/renderer/App.tsx',
  'laudos.editor-scroll': 'src/renderer/pages/LaudosPage.tsx',
  'painel-ia.dock': 'src/renderer/components/ai/AssistenteIaPanel.tsx',
};

for (const [marcador, relativo] of Object.entries(marcadores)) {
  const caminho = path.resolve(raiz, relativo);
  if (!caminho.startsWith(`${raiz}${path.sep}`)) throw new Error(`Caminho inválido para o marcador ${marcador}.`);
  const conteudo = await readFile(caminho, 'utf8');
  if (!conteudo.includes(`data-diagnostico-id="${marcador}"`)) throw new Error(`O marcador ${marcador} não foi encontrado em ${relativo}.`);
}

const saida = path.join(raiz, 'out', 'diagnostico-marcadores.json');
await mkdir(path.dirname(saida), { recursive: true });
await writeFile(saida, JSON.stringify({ versao: 1, geradoEm: new Date().toISOString(), marcadores }, null, 2), 'utf8');
