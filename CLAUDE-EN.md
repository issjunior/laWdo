# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Laudo Pericial" - a desktop application for forensic experts at Polícia Científica do Paraná (PCP) to create and manage forensic reports. The project is migrating from a Streamlit/Python web application to an Electron/TypeScript/React desktop application.

**Dual Structure:**

- `laudo-streamlit/` - Legacy Streamlit application (reference for business logic)
- Root directory - New Electron application (current development focus)

**Migration Status:** Following sprint-based planning in `migracao/` directory

- **Sprint 0 Complete**: Infrastructure, security, database, IPC, error handling
- **Sprint 1 In Progress**: Zod validation, Shadcn/ui, business services
- **Future Sprints**: UI components, report editing, AI assistance, export features

## Development Commands

```bash
# Build and Development
npm run dev        # Full build then start Electron (one-time development)
npm run start      # Start Electron from built files in `out/` directory
npm run build      # Build all three components (main, preload, renderer)
npm run watch      # Concurrent watch mode for all components

# Code Quality
npm run lint       # ESLint check with TypeScript/React rules
npm run lint:fix   # ESLint fix auto-correction
npm run format     # Prettier formatting
npm run type-check # TypeScript type checking (may show JSX errors - use build commands for actual compilation)

# Individual Builds
npm run build:main     # TypeScript compilation for main process
npm run build:preload  # TypeScript compilation for preload scripts
npm run build:renderer # Vite build for React renderer

# Packaging (after build)
# Generates installers in `dist/` directory
npx electron-builder
```

## Architecture

### Electron Process Structure

```
src/
├── main/           # Main process (Node.js, backend logic)
│   ├── database/   # SQLite operations, migrations, transactions
│   ├── security/   # AES-256-GCM, bcrypt, input sanitization
│   ├── ipc/        # IPC handlers organized by category
│   ├── services/   # Business logic services (in progress)
│   └── utils/      # Winston logger, helpers
├── preload/        # Secure IPC bridge (contextBridge)
└── renderer/       # React frontend
    ├── components/ # React components (ErrorBoundary, UI)
    ├── pages/      # Page components (planned)
    ├── hooks/      # Custom hooks (planned)
    └── styles/     # CSS with Tailwind + custom styles
```

### Build Output Structure

```
out/               # Build output (created by npm run build)
├── main/          # Compiled main process
├── preload/       # Compiled preload scripts
└── renderer/      # Built React app (Vite output)

dist/              # Packaged installers (electron-builder)
build/             # App icons and static assets
public/            # Public assets for renderer
```

### Database Schema (8 Tables)

1. `users` - Forensic experts (peritos) with encrypted credentials
2. `solicitantes` - Requesting agencies (órgãos, varas, delegacias)
3. `tipos_exame` - Examination types and templates
4. `reps` - Requisições de Exame Pericial (work requests)
5. `laudos` - Forensic reports with versioning and status tracking
6. `imagens_laudo` - Images with captions, GPS data, sequencing
7. `placeholders` - Dynamic template variables for report generation
8. `logs_auditoria` - Comprehensive audit trail of all actions

## Security Implementation

### Critical Security Features

- **Context Isolation**: Enabled (renderer runs in sandbox)
- **Node Integration**: Disabled in renderer (secure IPC bridge required)
- **Content Security Policy**: Configured to restrict resource loading
- **Encryption**: AES-256-GCM with PBKDF2 for sensitive data
- **Passwords**: bcrypt with salt rounds = 10
- **SQL Injection Protection**: Prepared statements + query validation
- **Input Sanitization**: Multiple validation layers (preload + main)

### IPC Communication Pattern

```typescript
// Renderer → Preload → Main Process
const result = await window.ipcAPI.executeQuery<User[]>(
  'SELECT * FROM users WHERE active = ?',
  [1]
);

// Main Process Handler (src/main/ipc/index.ts)
ipcMain.handle('execute-query', async (event, sql: string, params: any[]) => {
  // Input validation + prepared statements
  return await db.executeQuery(sql, params);
});
```

### Adding New IPC Handlers

1. **Add to src/main/ipc/index.ts** (appropriate category function)

   ```typescript
   // Example: Add handler for user operations
   ipcMain.handle('get-user-profile', async (event, userId: string) => {
     validateUserId(userId);
     return await userService.getProfile(userId);
   });
   ```

2. **Add to src/preload/index.ts** (IpcAPI interface + contextBridge)

   ```typescript
   // Add to IpcAPI interface
   interface IpcAPI {
     getUserProfile: (userId: string) => Promise<UserProfile>;
   }

   // Add to contextBridge.exposeInMainWorld
   getUserProfile: (userId: string) => ipcRenderer.invoke('get-user-profile', userId);
   ```

3. **Update ALLOWED_CHANNELS set** in preload script for validation

## Error Handling

### React ErrorBoundary

Located at `src/renderer/components/ErrorBoundary.tsx` with 4 recovery options:

1. **Restart Application** - Full application restart
2. **Go to Home** - Navigate to dashboard
3. **Clear Cache** - Clear local data and reload
4. **Report Error** - Generate error report for support

### Structured Logging

- **Winston Logger**: File rotation (5MB max), console output, daily cleanup
- **Log Levels**: error, warn, info, debug (configured by NODE_ENV)
- **Usage**: `logError('Operation failed', error, { userId: '123' })`

### Database Error Handling

```typescript
// Transactions with automatic rollback on error
await db.transaction(async connection => {
  await connection.run('INSERT INTO reps (...) VALUES (...)');
  await connection.run('INSERT INTO logs_auditoria (...) VALUES (...)');
  // On error, both operations are rolled back
});
```

## Coding Standards

### TypeScript Configuration

- **Strict Mode**: Enabled (`strict: true`)
- **Target**: ES2022
- **Module**: CommonJS (main/preload), ESNext (renderer via Vite)
- **Paths**: `@/*` → `src/renderer/*`, `@shared/*` → `src/shared/*`

### ESLint Rules (Critical)

- **No unused variables**: Except variables prefixed with `_`
- **No console.log**: Use `console.warn` or `console.error` instead
- **React hooks**: Follow rules of hooks
- **Import order**: React → external libraries → internal modules

### Prettier Configuration

- **Single quotes**: Yes
- **Tab width**: 2 spaces
- **Print width**: 100 characters
- **Trailing commas**: ES5
- **Semicolons**: Yes

### Naming Conventions

- **Components**: PascalCase (`ErrorBoundary`, `UserProfile`)
- **Functions/Variables**: camelCase (`getUserProfile`, `isLoading`)
- **Interfaces/Types**: PascalCase (`UserProfile`, `ApiResponse`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`, `DEFAULT_TIMEOUT`)
- **Database tables**: snake_case (`logs_auditoria`, `imagens_laudo`)

## Migration Context

### Legacy Reference (`laudo-streamlit/`)

- **Business Logic**: Reference for complex rules and calculations
- **Templates**: Report templates and formatting patterns
- **Python Integration**: May be called via `child_process` for specific operations

### Planning Documents (`migracao/`)

- `planejamento_migracao_tecnica.md` - Detailed technical planning with sprint breakdown
- `planejamento_migracao_checklist.md` - Sprint checklist with completion tracking
- `progresso_real_atual.md` - Current status analysis and metrics

### Key Migration Decisions

1. **SQLite Direct**: Using native driver instead of ORM for full control
2. **Electron 29+**: Updated API (`registerSchemesAsPrivileged` removed)
3. **Hybrid Approach**: Reuse Python business logic via child_process where beneficial
4. **Spec-Driven Development**: Detailed specifications before implementation

## Development Workflow

### Adding New Database Tables

1. **Schema Migration**: Add CREATE TABLE to `createDatabaseSchema()` in `src/main/database/index.ts`
2. **Indexes**: Add appropriate indexes for query performance
3. **Zod Schema**: Create validation schema (planned for Sprint 1)
4. **IPC Handlers**: Implement CRUD operations with input validation

### Creating React Components

1. **Location**: `src/renderer/components/` for shared, `src/renderer/pages/` for pages
2. **Styling**: Use existing CSS classes from `globals.css` or Tailwind
3. **IPC Access**: Use `window.ipcAPI` with proper error handling
4. **Type Safety**: Define prop interfaces with TypeScript

### Environment Configuration

- **ENCRYPTION_KEY**: Required for crypto operations (development default in code)
- **NODE_ENV**: `development` or `production` (affects logging, security)
- **Database Path**: `app.db` in user data directory (platform-specific)

## Testing & Verification

### Manual Testing Checklist

1. **Build Verification**: `npm run build` compiles without errors
2. **Type Checking**: `npm run type-check` passes
3. **Linting**: `npm run lint` shows no critical issues
4. **Application Start**: `npm run dev` launches Electron successfully
5. **IPC Communication**: Test basic IPC functions (ping, get-app-info)
6. **Database Operations**: Verify CRUD operations work
7. **Error Recovery**: Test ErrorBoundary recovery options

### Critical Paths to Test

- **Authentication**: Login/logout flows with encrypted credentials
- **REP Management**: Status transitions (Pendente → Em Andamento → Concluído)
- **Laudo Creation**: Template application and placeholder replacement
- **Image Management**: Upload, captioning, sequencing
- **Export Functions**: PDF/DOCX/ODT generation

## Common Development Tasks

### Adding New Examination Types

1. Add to `tipos_exame` table schema
2. Create template in `laudo-streamlit/templates/` (reference)
3. Implement Zod validation schema
4. Add IPC handlers for CRUD operations
5. Create React components for management UI

### Implementing New Placeholder Tags

1. Add to `placeholders` table with parser pattern
2. Update placeholder interpreter in business logic
3. Add to TinyMCE plugin for editor integration (future sprint)
4. Test replacement in report generation

### Integrating Python Scripts

```typescript
// Child process execution pattern
const { spawn } = require('child_process');
const pythonProcess = spawn('python', ['laudo-streamlit/scripts/process.py', args]);

pythonProcess.stdout.on('data', data => {
  // Process Python script output
});

pythonProcess.stderr.on('data', data => {
  logError('Python script error', new Error(data.toString()));
});
```

## Important Notes

- **Never commit sensitive data**: Encryption keys, credentials, personal information
- **Follow sprint planning**: Check `migracao/` documents for current priorities
- **Maintain security**: All new features must follow security patterns
- **Preserve business logic**: Verify changes against legacy Streamlit implementation
- **Document decisions**: Update planning documents when deviating from plan

## Troubleshooting

### TypeScript Configuration Issues

The project uses separate TypeScript configurations:

- `tsconfig.main.json` - Main process compilation (Node.js)
- `tsconfig.preload.json` - Preload scripts compilation
- Vite handles renderer TypeScript compilation (React + JSX)

**Issue**: Running `npm run type-check` from root may show JSX errors because the base `tsconfig.json` doesn't have `jsx` configured.
**Solution**: Use individual build commands instead:

```bash
npm run build:main     # Check main process types
npm run build:preload  # Check preload script types
npm run build:renderer # Check renderer types (via Vite)
```

### ESLint Configuration Issues

**Issue**: Running `npm run lint` may show errors from `laudo-streamlit/` directory (legacy Python project).
**Solution**: ESLint runs on all `.ts`/`.tsx` files including TypeScript definition files in the legacy directory.
**Workaround**: Currently linting the legacy directory; may need ESLint config update to exclude `laudo-streamlit/`.

### Build Warnings

- **CJS Build Deprecated**: Vite warns about CJS API but still works
- **PostCSS Module Type**: Add `"type": "module"` to package.json to eliminate warning
- **Electron 29+ API**: Some APIs changed (`registerSchemesAsPrivileged` removed)

### Development Workarounds

1. **Hot Reload**: Use `npm run watch` for concurrent rebuilding
2. **Debugging**: Use `window.ipcAPI.openDevTools()` to open Chrome DevTools
3. **Logs**: Check `logs/app.log` for application logs (Winston rotation)

This project follows a disciplined migration approach with strong emphasis on security, type safety, and maintainability. Always reference existing patterns when adding new functionality.
