export const COMPANY_CODE = 'SECCA';

export const DEFAULT_MOISTURE_BPS = 1200;

export const LOCATION_CODES = {
  PRE_SALE: 'RAK_SEMENTARA',
  MITRA_ORDER: 'RAK_MITRA_ORDER',
  FINISHED: 'RAK_FINISHED',
  FINISHED_MINIPLANT: 'RAK_FINISHED_MINIPLANT',
} as const;

export const workerRackCode = (workerId: string) => `RAK_MITRA_${workerId}`;
