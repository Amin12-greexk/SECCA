const { contextBridge, ipcRenderer } = require('electron');

console.log('[SECCA Preload] Starting preload script...');

// Expose seccaPrint (for webContents.print)
contextBridge.exposeInMainWorld('seccaPrint', {
  print: (options) => ipcRenderer.invoke('secca-print', options),
  getPrinters: () => ipcRenderer.invoke('secca-get-printers'),
});
console.log('[SECCA Preload] seccaPrint exposed');

// Expose seccaDesktop (for config, logging, settings, hardware, scale)
contextBridge.exposeInMainWorld('seccaDesktop', {
  getConfig: () => ipcRenderer.invoke('secca-get-config'),
  saveConfig: (config) => ipcRenderer.invoke('secca-save-config', config),
  openSettings: () => ipcRenderer.invoke('secca-open-settings'),
  log: (payload) => ipcRenderer.invoke('secca-log', payload),
  sendHardwarePayload: (payload) => ipcRenderer.invoke('secca-hardware-payload', payload),
  onHardwareEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('secca-hardware-event', listener);
    return () => ipcRenderer.removeListener('secca-hardware-event', listener);
  },

  // ── Serial scale APIs ──────────────────────────────────────────
  scale: {
    getStatus: () => ipcRenderer.invoke('secca-scale-get-status'),
    listPorts: () => ipcRenderer.invoke('secca-scale-list-ports'),
    updateConfig: (config) => ipcRenderer.invoke('secca-scale-update-config', config),
    reconnect: () => ipcRenderer.invoke('secca-scale-reconnect'),
  },
});
console.log('[SECCA Preload] seccaDesktop exposed (with scale API)');

// Setup electron-secure-pos-printer bridge (for thermal printer)
// Wrap in try-catch to prevent preload crash if package has issues
try {
  console.log('[SECCA Preload] Loading electron-secure-pos-printer...');
  const { setupSecureBridge } = require('electron-secure-pos-printer');
  console.log('[SECCA Preload] setupSecureBridge loaded, calling...');
  setupSecureBridge(contextBridge, ipcRenderer);
  console.log('[SECCA Preload] securePOSPrinter exposed successfully');
} catch (error) {
  console.error('[SECCA Preload] Failed to setup securePOSPrinter bridge:', error);
  console.error('[SECCA Preload] Error message:', error.message);

  // Manual fallback - expose securePOSPrinter via IPC
  console.log('[SECCA Preload] Attempting manual securePOSPrinter exposure...');
  try {
    contextBridge.exposeInMainWorld('securePOSPrinter', {
      print: (data, options) => ipcRenderer.invoke('secure-pos-printer:print', data, options),
      cancelPrint: (docId) => ipcRenderer.invoke('secure-pos-printer:cancelPrint', docId),
      getPrinters: () => ipcRenderer.invoke('secure-pos-printer:getPrinters'),
    });
    console.log('[SECCA Preload] Manual securePOSPrinter exposed');
  } catch (e2) {
    console.error('[SECCA Preload] Manual exposure also failed:', e2);
  }
}

console.log('[SECCA Preload] Preload script completed');
