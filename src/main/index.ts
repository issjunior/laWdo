import { app, BrowserWindow, shell, globalShortcut } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import squirrelStartup from 'electron-squirrel-startup';
import { setupSecurity } from './security/index.js';
import { setupDatabase } from './database/index.js';
import { getLogger, setupLogging } from './utils/logger.js';
import { registerIpcHandlers } from './ipc/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const log = getLogger('sistema');

// Configurações de segurança
if (squirrelStartup) {
  app.quit();
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (squirrelStartup) {
  app.quit();
}

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
    title: 'laWdo',
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
      mainWindow.maximize();
      mainWindow.show();
    }
  });

  // Abrir links externos no navegador padrão
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
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
    const preloadPath = path.join(__dirname, '../preload/index.js');
    const rendererHtmlPath = path.join(__dirname, '../renderer/index.html');
    const isDev = process.env.NODE_ENV === 'development';
    registerIpcHandlers({ preloadPath, rendererHtmlPath, isDev });

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
        log.debug(`Atalho registrado: ${shortcut}`);
      }
    });

    log.debug('Aplicação Electron inicializada com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar aplicação:', error);
    app.quit();
  }
});

// Sair quando todas as janelas forem fechadas
app.on('window-all-closed', () => {
  // Desregistrar todos os atalhos de teclado
  globalShortcut.unregisterAll();
  log.debug('Atalhos de teclado desregistrados');

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

