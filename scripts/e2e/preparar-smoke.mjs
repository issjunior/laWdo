import { app } from 'electron';
import bcrypt from 'bcrypt';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const diretorio = process.argv[2];

if (!diretorio) throw new Error('Diretório isolado ausente para o smoke E2E.');

app.setPath('userData', diretorio);

async function preparar() {
  let fecharBanco;
  try {
    await app.whenReady();
    const importar = nome => import(pathToFileURL(path.join(workspace, 'out/main', nome)).href);
    const { setupDatabase } = await importar('database/index.js');
    const { closeDatabase, executeNonQuery } = await importar('database/sqlite.js');
    fecharBanco = closeDatabase;

    await setupDatabase();
    await executeNonQuery(
      'INSERT INTO users (id, nome, email, username, senha_hash, forma_tratamento, ativo) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['e2e-perito', 'Perito Smoke E2E', 'e2e@exemplo.invalid', 'smoke.perito', await bcrypt.hash('SmokeE2E!2026', 10), 'masculino', 1],
    );
    await executeNonQuery(
      'INSERT INTO tipos_exame (id, nome, codigo) VALUES (?, ?, ?)',
      ['e2e-exame', 'SMOKE', 'E2E'],
    );
    await executeNonQuery(
      "INSERT INTO templates (id, tipo_exame_id, nome, origem, disponivel_novos_laudos) VALUES (?, ?, ?, 'usuario', 1)",
      ['e2e-template', 'e2e-exame', 'Template Smoke E2E'],
    );
    await executeNonQuery(
      'INSERT INTO secoes_template (id, template_id, nome, ordem, conteudo) VALUES (?, ?, ?, ?, ?)',
      ['e2e-secao', 'e2e-template', 'SEÇÃO SMOKE', 0, '<p>Conteúdo inicial do smoke.</p>'],
    );
    await executeNonQuery(
      "INSERT INTO reps (id, numero, tipo_exame_id, data_requisicao, usuario_id, status, campos_especificos) VALUES (?, ?, ?, ?, ?, 'Pendente', '{}')",
      ['e2e-rep', '123456/2026', 'e2e-exame', '2026-01-01', 'e2e-perito'],
    );
    await closeDatabase();
    app.exit(0);
  } catch (erro) {
    await fecharBanco?.().catch(() => undefined);
    console.error(erro);
    app.exit(1);
  }
}

void preparar();
