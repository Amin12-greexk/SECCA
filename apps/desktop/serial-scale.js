/**
 * serial-scale.js — Serial port bridge for digital weighing scales.
 *
 * Features:
 *  - Auto-detect scale port or use a configured COM port
 *  - Configurable baud rate (default 9600)
 *  - Automatic reconnection on disconnect / error
 *  - Parses common scale output formats (continuous weight lines)
 *  - Broadcasts { type: 'weight', value: '<grams>' } to all BrowserWindows
 *
 * Typical scale output (varies by model):
 *   "ST,GS,+  123.4  g"   — stable gross
 *   "  +  123.4 g\r\n"    — continuous
 *   "123.4"               — raw number
 *   "w=  0123.4g"         — some Chinese scales
 */

const { BrowserWindow } = require('electron');

let SerialPort;
let ReadlineParser;

// Lazy-load serialport to avoid crash if not installed yet
function loadSerialPort() {
  if (SerialPort) return true;
  try {
    const sp = require('serialport');
    SerialPort = sp.SerialPort;
    ReadlineParser = sp.ReadlineParser;
    return true;
  } catch (error) {
    console.error('[SerialScale] serialport package not found:', error.message);
    return false;
  }
}

// ── State ────────────────────────────────────────────────────────────
let activePort = null;
let activeParser = null;
let reconnectTimer = null;
let currentConfig = {
  portPath: '',        // e.g. 'COM7', '/dev/ttyUSB0' — empty = auto-detect
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  enabled: true,
};
let logFn = console.log;
let lastWeight = '';
let lastStableWeight = '';
let lastBroadcastTime = 0;

// Minimum interval between broadcasts (ms) to avoid flooding the renderer
const BROADCAST_THROTTLE_MS = 200;

// Reconnect delay in ms
const RECONNECT_DELAY_MS = 3000;

// ── Weight parsing ───────────────────────────────────────────────────

/**
 * Extract a numeric weight value (in grams) from a raw line received
 * from the scale.  Handles many common formats.
 *
 * Returns { weight: string, stable: boolean } or null if unparseable.
 */
function parseLine(raw) {
  if (!raw || typeof raw !== 'string') return null;

  const line = raw.trim();
  if (!line) return null;

  // Some scales prefix with ST (stable) or US (unstable)
  const stable = /\bST\b/i.test(line);

  // Try to find the numeric part.
  // Strategy: strip known prefixes/suffixes, then find last float.
  // Remove common units: g, kg, lb, oz, ct, pcs
  let cleaned = line
    .replace(/[A-Za-z,=:]/g, ' ')  // letters → spaces (keep digits, +, -, .)
    .replace(/[^\d.\-+\s]/g, ' ')  // non-numeric → spaces
    .trim();

  // Find all number-like tokens
  const numbers = cleaned.match(/[+-]?\d+\.?\d*/g);
  if (!numbers || numbers.length === 0) return null;

  // Use the last number found (scales often have header numbers before weight)
  const numStr = numbers[numbers.length - 1];
  const num = parseFloat(numStr);
  if (!Number.isFinite(num)) return null;

  // If line contains "kg" we convert to grams
  const isKg = /kg/i.test(line);
  const value = isKg ? num * 1000 : num;

  return {
    weight: String(Math.round(value * 100) / 100), // 2 decimal places max
    stable,
  };
}

// ── Broadcasting ─────────────────────────────────────────────────────

function broadcastWeight(weight, stable) {
  const now = Date.now();
  if (now - lastBroadcastTime < BROADCAST_THROTTLE_MS) return;
  lastBroadcastTime = now;

  lastWeight = weight;
  if (stable) lastStableWeight = weight;

  const payload = { type: 'weight', value: weight, stable };
  try {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('secca-hardware-event', payload);
      }
    });
  } catch (err) {
    // Windows may be destroyed between check and send — ignore
  }
}

// ── Port detection ───────────────────────────────────────────────────

async function listPorts() {
  if (!loadSerialPort()) return [];
  try {
    return await SerialPort.list();
  } catch (err) {
    logFn('[SerialScale] Failed to list ports:', err.message);
    return [];
  }
}

/**
 * Auto-detect a likely scale port.
 * Heuristic: prefer ports with common USB-serial vendor IDs,
 * or on Windows just pick the first available COM port.
 */
async function autoDetectPort() {
  const ports = await listPorts();
  if (ports.length === 0) return null;

  // Known USB-serial chipset vendor IDs (hex lowercase)
  const knownVendors = [
    '0403', // FTDI
    '067b', // Prolific
    '10c4', // Silicon Labs CP210x
    '1a86', // QinHeng CH340/CH341
    '2341', // Arduino (sometimes used)
  ];

  // First pass: match known vendor
  for (const p of ports) {
    const vid = (p.vendorId || '').toLowerCase();
    if (knownVendors.includes(vid)) {
      logFn('[SerialScale] Auto-detected scale port by vendor:', p.path, 'VID:', vid);
      return p.path;
    }
  }

  // Second pass: on Windows pick first COM port that is NOT COM1 (usually reserved)
  if (process.platform === 'win32') {
    const candidates = ports.filter(
      (p) => /^COM\d+$/i.test(p.path) && p.path.toUpperCase() !== 'COM1'
    );
    if (candidates.length > 0) {
      logFn('[SerialScale] Auto-detected first non-COM1 port:', candidates[0].path);
      return candidates[0].path;
    }
  }

  // Fallback: first port
  logFn('[SerialScale] Auto-detected fallback port:', ports[0].path);
  return ports[0].path;
}

// ── Connection management ────────────────────────────────────────────

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  clearReconnectTimer();
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    logFn('[SerialScale] Attempting reconnect...');
    connectScale().catch((err) => {
      logFn('[SerialScale] Reconnect failed:', err.message);
    });
  }, RECONNECT_DELAY_MS);
}

function closePort() {
  clearReconnectTimer();
  if (activeParser) {
    activeParser.removeAllListeners();
    activeParser = null;
  }
  if (activePort) {
    const port = activePort;
    activePort = null;
    try {
      if (port.isOpen) {
        port.close((err) => {
          if (err) logFn('[SerialScale] Error closing port:', err.message);
        });
      }
    } catch (err) {
      // ignore
    }
  }
}

async function connectScale(overrideConfig) {
  if (!loadSerialPort()) {
    throw new Error('serialport package not installed');
  }

  const cfg = overrideConfig || currentConfig;
  if (!cfg.enabled) {
    logFn('[SerialScale] Scale disabled in config');
    closePort();
    return { connected: false, reason: 'disabled' };
  }

  // Close existing connection
  closePort();

  // Determine port path
  let portPath = cfg.portPath;
  if (!portPath) {
    portPath = await autoDetectPort();
    if (!portPath) {
      logFn('[SerialScale] No serial port found');
      scheduleReconnect();
      return { connected: false, reason: 'no_port_found' };
    }
  }

  logFn(`[SerialScale] Connecting to ${portPath} @ ${cfg.baudRate} baud...`);

  return new Promise((resolve) => {
    try {
      const port = new SerialPort({
        path: portPath,
        baudRate: cfg.baudRate,
        dataBits: cfg.dataBits || 8,
        stopBits: cfg.stopBits || 1,
        parity: cfg.parity || 'none',
        autoOpen: false,
      });

      const parser = port.pipe(new ReadlineParser({
        delimiter: '\r\n',
        includeDelimiter: false,
      }));

      // Also handle \n only (some scales use just LF)
      // ReadlineParser with \r\n also handles \n on its own in most cases

      parser.on('data', (line) => {
        const result = parseLine(line);
        if (result) {
          broadcastWeight(result.weight, result.stable);
        }
      });

      port.on('error', (err) => {
        logFn('[SerialScale] Port error:', err.message);
        closePort();
        scheduleReconnect();
      });

      port.on('close', () => {
        logFn('[SerialScale] Port closed');
        activePort = null;
        activeParser = null;
        if (currentConfig.enabled) {
          scheduleReconnect();
        }
      });

      port.open((err) => {
        if (err) {
          logFn('[SerialScale] Failed to open port:', err.message);
          scheduleReconnect();
          resolve({ connected: false, reason: err.message, portPath });
          return;
        }

        logFn(`[SerialScale] Connected to ${portPath}`);
        activePort = port;
        activeParser = parser;
        resolve({ connected: true, portPath, baudRate: cfg.baudRate });
      });
    } catch (err) {
      logFn('[SerialScale] Connection exception:', err.message);
      scheduleReconnect();
      resolve({ connected: false, reason: err.message });
    }
  });
}

// ── Public API ───────────────────────────────────────────────────────

function init(config, logger) {
  if (logger) logFn = logger;
  if (config) {
    currentConfig = { ...currentConfig, ...config };
  }
  logFn('[SerialScale] Initialized with config:', JSON.stringify(currentConfig));
}

async function start() {
  if (!currentConfig.enabled) {
    logFn('[SerialScale] Scale is disabled, skipping start');
    return { connected: false, reason: 'disabled' };
  }
  return connectScale();
}

function stop() {
  logFn('[SerialScale] Stopping serial scale');
  closePort();
}

function updateConfig(newConfig) {
  const wasEnabled = currentConfig.enabled;
  const oldPort = currentConfig.portPath;
  const oldBaud = currentConfig.baudRate;

  currentConfig = { ...currentConfig, ...newConfig };
  logFn('[SerialScale] Config updated:', JSON.stringify(currentConfig));

  // Reconnect if port or baud changed, or if re-enabled
  const needReconnect =
    currentConfig.portPath !== oldPort ||
    currentConfig.baudRate !== oldBaud ||
    (!wasEnabled && currentConfig.enabled);

  if (needReconnect && currentConfig.enabled) {
    return connectScale();
  }

  if (!currentConfig.enabled) {
    closePort();
    return Promise.resolve({ connected: false, reason: 'disabled' });
  }

  return Promise.resolve({ connected: !!activePort, portPath: currentConfig.portPath });
}

function getStatus() {
  return {
    connected: !!(activePort && activePort.isOpen),
    portPath: activePort ? activePort.path : currentConfig.portPath || '(auto)',
    baudRate: currentConfig.baudRate,
    enabled: currentConfig.enabled,
    lastWeight,
    lastStableWeight,
  };
}

module.exports = {
  init,
  start,
  stop,
  updateConfig,
  getStatus,
  listPorts,
  parseLine, // exported for testing
};
