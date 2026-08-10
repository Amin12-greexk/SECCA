export {};

declare global {
  interface Window {
    seccaPrint?: {
      print: (options?: Record<string, unknown>) => Promise<boolean>;
      getPrinters: () => Promise<unknown[]>;
    };
    seccaDesktop?: {
      getConfig: () => Promise<{ serverUrl?: string; scale?: SeccaScaleConfig } | null>;
      saveConfig: (config: { serverUrl: string }) => Promise<boolean>;
      openSettings: () => Promise<boolean>;
      log: (payload: Record<string, unknown> | string) => Promise<boolean>;
      sendHardwarePayload: (payload: unknown) => Promise<{ type: string; value: string }>;
      onHardwareEvent: (callback: (payload: unknown) => void) => () => void;
      scale?: {
        getStatus: () => Promise<SeccaScaleStatus>;
        listPorts: () => Promise<SeccaSerialPortInfo[]>;
        updateConfig: (config: Partial<SeccaScaleConfig>) => Promise<{ connected: boolean; portPath?: string; reason?: string }>;
        reconnect: () => Promise<{ connected: boolean; portPath?: string; reason?: string }>;
      };
    };
    securePOSPrinter?: {
      getPrinters: () => Promise<Array<{ name: string; displayName?: string }>>;
      print: (data: Array<Record<string, unknown>>, options?: Record<string, unknown>) => Promise<void>;
    };
  }

  interface SeccaScaleConfig {
    portPath: string;
    baudRate: number;
    dataBits: number;
    stopBits: number;
    parity: string;
    enabled: boolean;
  }

  interface SeccaScaleStatus {
    connected: boolean;
    portPath: string;
    baudRate: number;
    enabled: boolean;
    lastWeight: string;
    lastStableWeight: string;
  }

  interface SeccaSerialPortInfo {
    path: string;
    manufacturer: string;
    vendorId: string;
    productId: string;
    friendlyName: string;
  }
}
