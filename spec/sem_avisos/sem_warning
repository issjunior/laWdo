Plano de Implementação: Migração para ESM (Otimizado)
Migrar o projeto Electron para ESM eliminando avisos de depreciação do Vite com mínimos passos necessários.

[!IMPORTANT] A migração exige extensões explícitas em imports (ex: ./utils/logger.js). Um script automatizado resolve isso na saída de build.

Mudanças Propostas
1. Configuração Base (Essencial)
[MODIFICAR] package.json

Adicionar "type": "module"
Adicionar script pós-build: "postbuild": "node scripts/fix-imports.mjs"
[MODIFICAR] tsconfig.json

"module": "ES2022", "moduleResolution": "NodeNext", "target": "ES2022"
"esModuleInterop": false, "allowSyntheticDefaultImports": true
[MODIFICAR] tsconfig.main.json e tsconfig.preload.json

Herdar do tsconfig.json base
2. Main Process
[MODIFICAR] src/main/index.ts

Converter require() → import
Implementar __dirname: import { fileURLToPath } from 'url'; const __dirname = dirname(fileURLToPath(import.meta.url));
Usar createRequire apenas para electron-squirrel-startup se necessário
3. Automação
[NOVO] scripts/fix-imports.mjs

Adiciona extensões .js em imports relativos na pasta out/ após build
Executado automaticamente pelo postbuild