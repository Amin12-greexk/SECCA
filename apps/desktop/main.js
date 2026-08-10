const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const { setupSecurePOSPrinter } = require('electron-secure-pos-printer');
const path = require('path');
const fs = require('fs');
const { normalizeHardwarePayload } = require('./hardware-bridge');
const serialScale = require('./serial-scale');

let mainWindow;
let settingsWindow;
let cachedConfig;

const productionUrl = process.env.SECCA_PRODUCTION_URL || 'https://secca.tunasestaindonesia.com';
const developmentUrl = process.env.SECCA_DESKTOP_URL || 'http://localhost:3000';
const defaultPrintConfig = {};
const iconPath = path.join(__dirname, 'assets', 'logo-secca.png');
const getRuntimeUrl = () => (app.isPackaged ? productionUrl : developmentUrl);

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
    if (!cachedConfig.serverUrl || cachedConfig.serverUrl.includes('secca.tunasestaindonesia.com')) {
      cachedConfig.serverUrl = getRuntimeUrl();
    }
    return cachedConfig;
  } catch (error) {
    cachedConfig = { serverUrl: getRuntimeUrl(), print: { ...defaultPrintConfig } };
    return cachedConfig;
  }
};

const writeConfig = (nextConfig) => {
  cachedConfig = nextConfig;
  fs.writeFileSync(getConfigPath(), JSON.stringify(nextConfig, null, 2), 'utf8');
};

const broadcastHardwareEvent = (payload) => {
  const normalized = normalizeHardwarePayload(payload);
  BrowserWindow.getAllWindows().forEach((windowInstance) => {
    windowInstance.webContents.send('secca-hardware-event', normalized);
  });
  return normalized;
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

  // Packaged builds must always open the production frontend. A stale local
  // serverUrl from a previous development run must never override it.
  const targetUrl = app.isPackaged
    ? productionUrl
    : (config?.serverUrl || developmentUrl);
  mainWindow.loadURL(targetUrl);

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
    width: 600,
    height: 680,
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

app.whenReady().then(async () => {
  try {
    setupSecurePOSPrinter(require('electron'));
    logLine('[SECCA] secure POS printer initialized');
  } catch (error) {
    logLine('[SECCA] secure POS printer init failed', {
      error: error?.message || String(error),
    });
  }

  // ── Initialize serial scale ──────────────────────────────────────
  const config = readConfig();
  const scaleConfig = config.scale || {};
  serialScale.init(
    {
      portPath: scaleConfig.portPath || '',
      baudRate: scaleConfig.baudRate || 9600,
      dataBits: scaleConfig.dataBits || 8,
      stopBits: scaleConfig.stopBits || 1,
      parity: scaleConfig.parity || 'none',
      enabled: scaleConfig.enabled !== false, // enabled by default
    },
    (msg, meta) => logLine(msg, meta),
  );

  // Start scale connection after window is ready
  try {
    const result = await serialScale.start();
    logLine('[SECCA] Serial scale start result', result);
  } catch (err) {
    logLine('[SECCA] Serial scale start failed', { error: err?.message || String(err) });
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

app.on('before-quit', () => {
  serialScale.stop();
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
  const config = readConfig();
  if (app.isPackaged) {
    return { ...config, serverUrl: productionUrl };
  }
  return config;
});

ipcMain.handle('secca-save-config', async (event, nextConfig) => {
  if (app.isPackaged) {
    throw new Error('Server URL dikunci ke production pada build aplikasi.');
  }
  const serverUrl = typeof nextConfig?.serverUrl === 'string' ? nextConfig.serverUrl.trim() : '';
  if (!serverUrl) {
    throw new Error('Server URL wajib diisi.');
  }
  // Preserve scale config when saving server config
  const existing = readConfig();
  writeConfig({ ...existing, serverUrl });
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

ipcMain.handle('secca-hardware-payload', async (event, payload) => {
  const normalized = broadcastHardwareEvent(payload);
  logLine('[SECCA] hardware payload received', normalized);
  return normalized;
});

// ── Serial scale IPC handlers ──────────────────────────────────────

ipcMain.handle('secca-scale-get-status', async () => {
  return serialScale.getStatus();
});

ipcMain.handle('secca-scale-list-ports', async () => {
  const ports = await serialScale.listPorts();
  return ports.map((p) => ({
    path: p.path,
    manufacturer: p.manufacturer || '',
    vendorId: p.vendorId || '',
    productId: p.productId || '',
    friendlyName: p.friendlyName || p.path,
  }));
});

ipcMain.handle('secca-scale-update-config', async (event, scaleConfig) => {
  logLine('[SECCA] Scale config update requested', scaleConfig);

  // Save to disk
  const config = readConfig();
  config.scale = {
    portPath: scaleConfig.portPath || '',
    baudRate: Number(scaleConfig.baudRate) || 9600,
    dataBits: Number(scaleConfig.dataBits) || 8,
    stopBits: Number(scaleConfig.stopBits) || 1,
    parity: scaleConfig.parity || 'none',
    enabled: scaleConfig.enabled !== false,
  };
  writeConfig(config);

  // Apply to running scale
  const result = await serialScale.updateConfig(config.scale);
  logLine('[SECCA] Scale config applied', result);
  return result;
});

ipcMain.handle('secca-scale-reconnect', async () => {
  logLine('[SECCA] Scale manual reconnect requested');
  const result = await serialScale.start();
  logLine('[SECCA] Scale reconnect result', result);
  return result;
});
