const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const { setupSecurePOSPrinter } = require('electron-secure-pos-printer');
const path = require('path');
const fs = require('fs');

let mainWindow;
let settingsWindow;
let cachedConfig;

const defaultUrl = process.env.SECCA_DESKTOP_URL || 'http://localhost:3000';
const defaultPrintConfig = {};
const iconPath = path.join(__dirname, 'assets', 'logo-secca.png');

const getConfigPath = () => path.join(app.getPath('userData'), 'secca-config.json');
const getLogPath = () => path.join(app.getPath('userData'), 'secca-log.txt');

const logLine = (message, meta) => {
  const timestamp = new Date().toISOString();
  const payload = meta ? `${message} ${JSON.stringify(meta)}` : message;
  const line = `[${timestamp}] ${payload}\n`;
  try {
    fs.appendFileSync(getLogPath(), line, 'utf8');
  } catch (error) {
    // ignore log file errors
  }
  console.log(payload);
};

const readConfig = () => {
  if (cachedConfig) return cachedConfig;
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    cachedConfig = JSON.parse(raw);
    return cachedConfig;
  } catch (error) {
    cachedConfig = { serverUrl: defaultUrl, print: { ...defaultPrintConfig } };
    return cachedConfig;
  }
};

const writeConfig = (nextConfig) => {
  cachedConfig = nextConfig;
  fs.writeFileSync(getConfigPath(), JSON.stringify(nextConfig, null, 2), 'utf8');
};

function createWindow() {
  const config = readConfig();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(config.serverUrl || defaultUrl);

  // Open DevTools for debugging (remove in production)
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'right' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 520,
    height: 360,
    resizable: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: 'SECCA',
      submenu: [
        {
          label: 'Pengaturan Server',
          click: () => createSettingsWindow(),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  try {
    setupSecurePOSPrinter(require('electron'));
    logLine('[SECCA] secure POS printer initialized');
  } catch (error) {
    logLine('[SECCA] secure POS printer init failed', {
      error: error?.message || String(error),
    });
  }
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('secca-print', async (event, options) => {
  const webContents = event.sender;
  const config = readConfig();
  const printConfig = { ...defaultPrintConfig, ...(config?.print ?? {}) };

  const printOptions = {
    silent: true,
    printBackground: true,
    margins: {
      marginType: 'none',
    },
    preferCSSPageSize: true,
    ...options,
  };
  logLine('[SECCA] secca-print requested', {
    deviceName: printOptions.deviceName,
    pageSize: printOptions.pageSize,
  });

  return new Promise((resolve, reject) => {
    try {
      webContents.print(printOptions, (success, failureReason) => {
        if (!success) {
          logLine('[SECCA] secca-print failed', { failureReason });
          reject(new Error(failureReason || 'Print failed'));
          return;
        }
        logLine('[SECCA] secca-print success');
        resolve(true);
      });
    } catch (error) {
      logLine('[SECCA] secca-print exception', { error: error?.message || String(error) });
      reject(error);
    }
  });
});

ipcMain.handle('secca-get-printers', async (event) => {
  try {
    if (typeof event.sender.getPrinters === 'function') {
      return event.sender.getPrinters();
    }
  } catch (error) {
    return [];
  }
  return [];
});

ipcMain.handle('secca-get-config', async () => {
  return readConfig();
});

ipcMain.handle('secca-save-config', async (event, nextConfig) => {
  const serverUrl = typeof nextConfig?.serverUrl === 'string' ? nextConfig.serverUrl.trim() : '';
  if (!serverUrl) {
    throw new Error('Server URL wajib diisi.');
  }
  writeConfig({ serverUrl });
  if (mainWindow) {
    mainWindow.loadURL(serverUrl);
  }
  return true;
});

ipcMain.handle('secca-open-settings', async () => {
  createSettingsWindow();
  return true;
});

ipcMain.handle('secca-log', async (event, payload) => {
  if (payload && typeof payload === 'object') {
    logLine('[SECCA] renderer-log', payload);
  } else if (typeof payload === 'string') {
    logLine('[SECCA] renderer-log', { message: payload });
  }
  return true;
});
