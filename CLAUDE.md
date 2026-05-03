# CLAUDE.md

Este arquivo fornece orientação ao Claude Code (claude.ai/code) ao trabalhar com código neste repositório.

## Visão Geral do Projeto

Este é o "Laudo Pericial" - uma aplicação desktop para peritos forenses da Polícia Científica do Paraná (PCP) criar e gerenciar laudos periciais. O projeto está migrando de uma aplicação web Streamlit/Python para uma aplicação desktop Electron/TypeScript/React.

**Estrutura Dupla:**
- `laudo-streamlit/` - Aplicação Streamlit legada (referência para lógica de negócio)
- Diretório raiz - Nova aplicação Electron (foco atual de desenvolvimento)

**Status da Migração:** Seguindo planejamento baseado em sprints no diretório `migracao/`
- **Sprint 0 Completa**: Infraestrutura, segurança, banco de dados, IPC, tratamento de erros
- **Sprint 1 Em Andamento**: Validação Zod, Shadcn/ui, serviços de negócio
- **Sprints Futuras**: Componentes de UI, edição de laudos, assistência de IA, recursos de exportação

## Comandos de Desenvolvimento

```bash
# Build e Desenvolvimento
npm run dev        # Build completo e inicia Electron (desenvolvimento único)
npm run start      # Inicia Electron a partir dos arquivos construídos no diretório `out/`
npm run build      # Constrói todos os três componentes (main, preload, renderer)
npm run watch      # Modo de observação simultânea para todos os componentes

# Qualidade de Código
npm run lint       # Checagem ESLint com regras TypeScript/React
npm run lint:fix   # Correção automática ESLint
npm run format     # Formatação Prettier
npm run type-check # Checagem de tipos TypeScript (pode mostrar erros JSX - use comandos de build para compilação real)

# Builds Individuais
npm run build:main     # Compilação TypeScript para processo principal
npm run build:preload  # Compilação TypeScript para scripts de preload
npm run build:renderer # Build Vite para renderizador React

# Empacotamento (após build)
# Gera instaladores no diretório `dist/`
npx electron-builder
```

## Arquitetura

### Estrutura de Processos Electron

```
src/
├── main/           # Processo principal (Node.js, lógica de backend)
│   ├── database/   # Operações SQLite, migrações, transações
│   ├── security/   # AES-256-GCM, bcrypt, sanitização de entrada
│   ├── ipc/        # Handlers IPC organizados por categoria
│   ├── services/   # Serviços de lógica de negócio (em andamento)
│   └── utils/      # Logger Winston, helpers
├── preload/        # Ponte IPC segura (contextBridge)
└── renderer/       # Frontend React
    ├── components/ # Componentes React (ErrorBoundary, UI)
    ├── pages/      # Componentes de página (planejado)
    ├── hooks/      # Hooks customizados (planejado)
    └── styles/     # CSS com Tailwind + estilos customizados
```

### Estrutura de Saída de Build

```
out/               # Saída de build (criado por npm run build)
├── main/          # Processo principal compilado
├── preload/       # Scripts de preload compilados
└── renderer/      # Aplicação React construída (saída Vite)

dist/              # Instaladores empacotados (electron-builder)
build/             # Ícones do app e assets estáticos
public/            # Assets públicos para renderizador
```

### Esquema do Banco de Dados (8 Tabelas)

1. `users` - Peritos forenses com credenciais criptografadas
2. `solicitantes` - Órgãos solicitantes (órgãos, varas, delegacias)
3. `tipos_exame` - Tipos de exame e modelos
4. `reps` - Requisições de Exame Pericial (solicitações de trabalho)
5. `laudos` - Laudos periciais com versionamento e rastreamento de status
6. `imagens_laudo` - Imagens com legendas, dados GPS, sequenciamento
7. `placeholders` - Variáveis de template dinâmicas para geração de laudos
8. `logs_auditoria` - Trilha de auditoria abrangente de todas as ações

## Implementação de Segurança

### Recursos de Segurança Críticos

- **Isolamento de Contexto**: Habilitado (renderizador executa em sandbox)
- **Integração Node**: Desabilitada no renderizador (ponte IPC segura necessária)
- **Política de Segurança de Conteúdo (CSP)**: Configurada para restringir carregamento de recursos
- **Criptografia**: AES-256-GCM com PBKDF2 para dados sensíveis
- **Senhas**: bcrypt com salt rounds = 10
- **Proteção contra Injeção SQL**: Prepared statements + validação de queries
- **Sanitização de Entrada**: Múltiplas camadas de validação (preload + main)

### Padrão de Comunicação IPC

```typescript
// Renderer → Preload → Main Process
const result = await window.ipcAPI.executeQuery<User[]>(
  'SELECT * FROM users WHERE active = ?',
  [1]
);

// Handler do Processo Principal (src/main/ipc/index.ts)
ipcMain.handle('execute-query', async (event, sql: string, params: any[]) => {
  // Validação de entrada + prepared statements
  return await db.executeQuery(sql, params);
});
```

### Adicionando Novos Handlers IPC

1. **Adicionar em src/main/ipc/index.ts** (função de categoria apropriada)

   ```typescript
   // Exemplo: Adicionar handler para operações de usuário
   ipcMain.handle('get-user-profile', async (event, userId: string) => {
     validateUserId(userId);
     return await userService.getProfile(userId);
   });
   ```

2. **Adicionar em src/preload/index.ts** (interface IpcAPI + contextBridge)

   ```typescript
   // Adicionar à interface IpcAPI
   interface IpcAPI {
     getUserProfile: (userId: string) => Promise<UserProfile>;
   }

   // Adicionar ao contextBridge.exposeInMainWorld
   getUserProfile: (userId: string) => ipcRenderer.invoke('get-user-profile', userId);
   ```

3. **Atualizar conjunto ALLOWED_CHANNELS** no script de preload para validação

## Tratamento de Erros

### ErrorBoundary React

Localizado em `src/renderer/components/ErrorBoundary.tsx` com 4 opções de recuperação:

1. **Reiniciar Aplicação** - Reinício completo da aplicação
2. **Ir para Início** - Navegar para o dashboard
3. **Limpar Cache** - Limpar dados locais e recarregar
4. **Reportar Erro** - Gerar relatório de erro para suporte

### Logging Estruturado

- **Logger Winston**: Rotação de arquivos (máx. 5MB), saída no console, limpeza diária
- **Níveis de Log**: error, warn, info, debug (configurado por NODE_ENV)
- **Uso**: `logError('Operação falhou', error, { userId: '123' })`

### Tratamento de Erros no Banco de Dados

```typescript
// Transações com rollback automático em caso de erro
await db.transaction(async connection => {
  await connection.run('INSERT INTO reps (...) VALUES (...)');
  await connection.run('INSERT INTO logs_auditoria (...) VALUES (...)');
  // Em caso de erro, ambas as operações são revertidas
});
```

## Padrões de Codificação

### Configuração TypeScript

- **Modo Estrito**: Habilitado (`strict: true`)
- **Target**: ES2022
- **Módulo**: CommonJS (main/preload), ESNext (renderer via Vite)
- **Paths**: `@/*` → `src/renderer/*`, `@shared/*` → `src/shared/*`

### Regras ESLint (Críticas)

- **Sem variáveis não utilizadas**: Exceto variáveis prefixadas com `_`
- **Sem console.log**: Use `console.warn` ou `console.error` em vez disso
- **React hooks**: Siga as regras dos hooks
- **Ordem de imports**: React → bibliotecas externas → módulos internos

### Configuração Prettier

- **Aspas simples**: Sim
- **Largura da tabulação**: 2 espaços
- **Largura de impressão**: 100 caracteres
- **Vírgulas finais**: ES5
- **Ponto e vírgula**: Sim

### Convenções de Nomenclatura

- **Componentes**: PascalCase (`ErrorBoundary`, `UserProfile`)
- **Funções/Variáveis**: camelCase (`getUserProfile`, `isLoading`)
- **Interfaces/Tipos**: PascalCase (`UserProfile`, `ApiResponse`)
- **Constantes**: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`, `DEFAULT_TIMEOUT`)
- **Tabelas do banco**: snake_case (`logs_auditoria`, `imagens_laudo`)

## Contexto da Migração

### Referência Legada (`laudo-streamlit/`)

- **Lógica de Negócio**: Referência para regras complexas e cálculos
- **Modelos**: Modelos de laudo e padrões de formatação
- **Integração Python**: Pode ser chamada via `child_process` para operações específicas

### Documentos de Planejamento (`migracao/`)

- `planejamento_migracao_tecnica.md` - Planejamento técnico detalhado com divisão por sprints
- `planejamento_migracao_checklist.md` - Checklist de sprints com rastreamento de conclusão
- `progresso_real_atual.md` - Análise do status atual e métricas

### Decisões-Chave da Migração

1. **SQLite Direto**: Usando driver nativo em vez de ORM para controle total
2. **Electron 29+**: API atualizada (`registerSchemesAsPrivileged` removida)
3. **Abordagem Híbrida**: Reutilizar lógica de negócio Python via child_process onde benéfico
4. **Desenvolvimento Baseado em Especificações**: Especificações detalhadas antes da implementação

## Fluxo de Trabalho de Desenvolvimento

### Adicionando Novas Tabelas no Banco de Dados

1. **Migração de Esquema**: Adicionar CREATE TABLE em `createDatabaseSchema()` em `src/main/database/index.ts`
2. **Índices**: Adicionar índices apropriados para performance de queries
3. **Esquema Zod**: Criar esquema de validação (planejado para Sprint 1)
4. **Handlers IPC**: Implementar operações CRUD com validação de entrada

### Criando Componentes React

1. **Localização**: `src/renderer/components/` para compartilhados, `src/renderer/pages/` para páginas
2. **Estilização**: Usar classes CSS existentes de `globals.css` ou Tailwind
3. **Acesso IPC**: Usar `window.ipcAPI` com tratamento de erros adequado
4. **Segurança de Tipos**: Definir interfaces de props com TypeScript

### Configuração de Ambiente

- **ENCRYPTION_KEY**: Necessária para operações de criptografia (padrão de desenvolvimento no código)
- **NODE_ENV**: `development` ou `production` (afecta logging, segurança)
- **Caminho do Banco**: `app.db` no diretório de dados do usuário (específico da plataforma)

## Testes e Verificação

### Checklist de Testes Manuais

1. **Verificação de Build**: `npm run build` compila sem erros
2. **Checagem de Tipos**: `npm run type-check` passa
3. **Linting**: `npm run lint` não mostra problemas críticos
4. **Início da Aplicação**: `npm run dev` inicia o Electron com sucesso
5. **Comunicação IPC**: Testar funções IPC básicas (ping, get-app-info)
6. **Operações de Banco**: Verificar se operações CRUD funcionam
7. **Recuperação de Erros**: Testar opções de recuperação do ErrorBoundary

### Caminhos Críticos para Testar

- **Autenticação**: Fluxos de login/logout com credenciais criptografadas
- **Gerenciamento de REPs**: Transições de status (Pendente → Em Andamento → Concluído)
- **Criação de Laudos**: Aplicação de modelos e substituição de placeholders
- **Gerenciamento de Imagens**: Upload, legendas, sequenciamento
- **Funções de Exportação**: Geração de PDF/DOCX/ODT

## Tarefas Comuns de Desenvolvimento

### Adicionando Novos Tipos de Exame

1. Adicionar ao esquema da tabela `tipos_exame`
2. Criar modelo em `laudo-streamlit/templates/` (referência)
3. Implementar esquema de validação Zod
4. Adicionar handlers IPC para operações CRUD
5. Criar componentes React para UI de gerenciamento

### Implementando Novas Tags de Placeholder

1. Adicionar à tabela `placeholders` com padrão de parser
2. Atualizar interpretador de placeholders na lógica de negócio
3. Adicionar ao plugin TinyMCE para integração no editor (sprint futura)
4. Testar substituição na geração de laudos

### Integrando Scripts Python

```typescript
// Padrão de execução de processo filho
const { spawn } = require('child_process');
const pythonProcess = spawn('python', ['laudo-streamlit/scripts/process.py', args]);

pythonProcess.stdout.on('data', data => {
  // Processar saída do script Python
});

pythonProcess.stderr.on('data', data => {
  logError('Erro no script Python', new Error(data.toString()));
});
```

## Notas Importantes

- **Nunca comitar dados sensíveis**: Chaves de criptografia, credenciais, informações pessoais
- **Seguir planejamento de sprints**: Verificar documentos em `migracao/` para prioridades atuais
- **Manter segurança**: Todos os novos recursos devem seguir padrões de segurança
- **Preservar lógica de negócio**: Verificar mudanças contra implementação legada Streamlit
- **Documentar decisões**: Atualizar documentos de planejamento ao desviar do plano

## Solução de Problemas

### Problemas de Configuração TypeScript

O projeto usa configurações TypeScript separadas:

- `tsconfig.main.json` - Compilação do processo principal (Node.js)
- `tsconfig.preload.json` - Compilação de scripts de preload
- Vite trata a compilação TypeScript do renderizador (React + JSX)

**Problema**: Executar `npm run type-check` da raiz pode mostrar erros JSX porque o `tsconfig.json` base não tem `jsx` configurado.
**Solução**: Use comandos de build individuais em vez disso:

```bash
npm run build:main     # Checar tipos do processo principal
npm run build:preload  # Checar tipos de scripts de preload
npm run build:renderer # Checar tipos do renderizador (via Vite)
```

### Problemas de Configuração ESLint

**Problema**: Executar `npm run lint` pode mostrar erros do diretório `laudo-streamlit/` (projeto Python legado).
**Solução**: ESLint executa em todos os arquivos `.ts`/`.tsx` incluindo arquivos de definição TypeScript no diretório legado.
**Workaround**: Atualmente fazendo lint do diretório legado; pode precisar de atualização de configuração ESLint para excluir `laudo-streamlit/`.

### Avisos de Build

- **CJS Build Depreciado**: Vite alerta sobre API CJS mas ainda funciona
- **Tipo de Módulo PostCSS**: Adicionar `"type": "module"` ao package.json para eliminar aviso
- **API Electron 29+**: Algumas APIs mudaram (`registerSchemesAsPrivileged` removida)

### Workarounds de Desenvolvimento

1. **Hot Reload**: Use `npm run watch` para reconstrução simultânea
2. **Depuração**: Use `window.ipcAPI.openDevTools()` para abrir Chrome DevTools
3. **Logs**: Verificar `logs/app.log` para logs da aplicação (rotação Winston)

Este projeto segue uma abordagem de migração disciplinada com forte ênfase em segurança, segurança de tipos e manutenibilidade. Sempre referencie padrões existentes ao adicionar nova funcionalidade.

---

**INSTRUÇÃO PERMANENTE PARA TODAS AS INSTÂNCIAS DO CLAUDE**:
- **Todos os diálogos** com o usuário devem ser em português do Brasil
- **Todos os arquivos gerados** devem ser em português do Brasil
- **Todos os comentários no código** devem ser em português do Brasil
- **Toda a documentação** deve ser em português do Brasil
- **Toda a comunicação** deve ser em português do Brasil

**Contexto**: Este é um projeto da Polícia Científica do Paraná (PCP) para o sistema "Laudo Pericial", utilizado por peritos forenses brasileiros. Todo o domínio do projeto, terminologia técnica e contexto organizacional são em português do Brasil.

**Exceções**:
- Nomes de bibliotecas/frameworks/externos permanecem em inglês
- Termos técnicos padrão da indústria podem permanecer em inglês quando não houver equivalente comum em português
- Código de terceiros não deve ser modificado apenas para tradução