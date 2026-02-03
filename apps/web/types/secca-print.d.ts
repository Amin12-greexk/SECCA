export {};

declare global {
  interface Window {
    seccaPrint?: {
      print: (options?: Record<string, unknown>) => Promise<boolean>;
      getPrinters: () => Promise<unknown[]>;
    };
    seccaDesktop?: {
      getConfig: () => Promise<{ serverUrl?: string } | null>;
      saveConfig: (config: { serverUrl: string }) => Promise<boolean>;
      openSettings: () => Promise<boolean>;
      log: (payload: Record<string, unknown> | string) => Promise<boolean>;
    };
    securePOSPrinter?: {
      getPrinters: () => Promise<Array<{ name: string; displayName?: string }>>;
      print: (data: Array<Record<string, unknown>>, options?: Record<string, unknown>) => Promise<void>;
    };
  }
}
