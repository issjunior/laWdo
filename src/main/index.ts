import { app, BrowserWindow, ipcMain, shell, globalShortcut, protocol, net } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import squirrelStartup from 'electron-squirrel-startup';
import { setupSecurity } from './security/index.js';
import { setupDatabase } from './database/index.js';
import { setupLogging } from './utils/logger.js';
import { registerIpcHandlers } from './ipc/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações de segurança
if (squirrelStartup) {
  app.quit();
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (squirrelStartup) {
  app.quit();
}

// Registrar protocolo customizado laudo-img:// para servir imagens locais
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'laudo-img',
    privileges: { standard: true, secure: true, bypassCSP: true, supportFetchAPI: true },
  },
]);

// Variável global para a janela principal
let mainWindow: BrowserWindow | null = null;

const createWindow = (): void => {
  // Criar a janela do navegador
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    icon: path.join(__dirname, '../../public/assets/icon.png'),
    title: 'Laudo Pericial PCP',
    show: false, // Mostrar apenas quando estiver pronto
  });

  // Carregar a aplicação React
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Mostrar quando estiver pronto
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // Abrir links externos no navegador padrão
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Lidar com fechamento da janela
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Função para alternar DevTools
const toggleDevTools = () => {
  if (mainWindow) {
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools();
    } else {
      mainWindow.webContents.openDevTools();
    }
  }
};

// Este método será chamado quando o Electron terminar de inicializar
app.whenReady().then(async () => {
  try {
    // Inicializar sistemas
    setupSecurity();
    await setupDatabase();
    setupLogging();

    // Registrar handlers IPC
    registerIpcHandlers();

    // Registrar protocolo laudo-img:// para servir imagens do userData
    protocol.handle('laudo-img', request => {
      const url = new URL(request.url);
      const filePath = path.join(app.getPath('userData'), 'imagens', url.host, url.pathname.replace(/^\//, ''));
      return net.fetch(`file:///${filePath.replace(/\\/g, '/')}`);
    });

    // Criar janela
    createWindow();

    // Registrar atalhos de teclado para DevTools
    // Ctrl+Shift+I - Alternar DevTools (padrão Chrome/Electron)
    // F12 - Alternar DevTools (alternativo)
    // Ctrl+Shift+D - Alternar DevTools (alternativo)
    const shortcuts = [
      'CommandOrControl+Shift+I',
      'F12',
      'CommandOrControl+Shift+D'
    ];

    shortcuts.forEach(shortcut => {
      const ret = globalShortcut.register(shortcut, toggleDevTools);
      if (!ret) {
        console.warn(`❌ Não foi possível registrar atalho: ${shortcut}`);
      } else {
        console.log(`✅ Atalho registrado: ${shortcut}`);
      }
    });

    console.log('✅ Aplicação Electron inicializada com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar aplicação:', error);
    app.quit();
  }
});

// Sair quando todas as janelas forem fechadas
app.on('window-all-closed', () => {
  // Desregistrar todos os atalhos de teclado
  globalShortcut.unregisterAll();
  console.log('🔧 Atalhos de teclado desregistrados');

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // No macOS, recriar uma janela no app quando
  // o ícone do dock for clicado e não houver janelas abertas
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Capturar erros não tratados
process.on('uncaughtException', error => {
  console.error('❌ Erro não tratado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
});
