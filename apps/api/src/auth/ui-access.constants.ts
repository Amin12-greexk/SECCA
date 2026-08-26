export type UiAccessModuleKey =
  | 'dashboard'
  | 'baku'
  | 'stock'
  | 'mitra_management'
  | 'mitra'
  | 'trainer_orders'
  | 'koreksi'
  | 'admin'
  | 'settings'
  | 'reports';

export type RequestUserUiAccess = {
  moduleKey: string;
  level: number;
};

export type RequestAuthUser = {
  sub?: string;
  role?: string;
  useCustomUiAccess?: boolean;
  uiAccesses?: RequestUserUiAccess[];
};

type ApiAccessRule = {
  pattern: RegExp;
  anyOf: Array<{
    moduleKey: UiAccessModuleKey;
    minLevel: number;
  }>;
  methods?: string[];
};

const API_ACCESS_RULES: ApiAccessRule[] = [
  {
    pattern: /^\/api\/analytics(?:\/|$)/i,
    anyOf: [{ moduleKey: 'dashboard', minLevel: 2 }],
  },
  // Endpoint GET dashboard performa bersifat @Public; hanya tulis yang diatur di sini.
  {
    pattern: /^\/api\/audit-dashboard\/import$/i,
    anyOf: [{ moduleKey: 'dashboard', minLevel: 2 }],
    methods: ['POST'],
  },
  {
    pattern: /^\/api\/audit-dashboard\/persons\/[^/]+\/color$/i,
    anyOf: [{ moduleKey: 'dashboard', minLevel: 2 }],
    methods: ['PATCH'],
  },
  {
    pattern: /^\/api\/audit-dashboard\/reset$/i,
    anyOf: [{ moduleKey: 'dashboard', minLevel: 2 }],
    methods: ['POST'],
  },
  {
    pattern: /^\/api\/users(?:\/|$)/i,
    anyOf: [{ moduleKey: 'admin', minLevel: 2 }],
  },
  {
    pattern: /^\/api\/workers\/[^/]+\/weekly-stats(?:\/|$)/i,
    anyOf: [
      { moduleKey: 'dashboard', minLevel: 2 },
      { moduleKey: 'mitra', minLevel: 1 },
      { moduleKey: 'trainer_orders', minLevel: 3 },
    ],
  },
  {
    pattern: /^\/api\/workers(?:\/|$)/i,
    anyOf: [
      { moduleKey: 'admin', minLevel: 2 },
      { moduleKey: 'mitra_management', minLevel: 1 },
      { moduleKey: 'trainer_orders', minLevel: 1 },
    ],
  },
  {
    pattern: /^\/api\/barang-jadi(?:\/|$)/i,
    anyOf: [{ moduleKey: 'koreksi', minLevel: 2 }],
  },
  {
    pattern: /^\/api\/finish\/receipts(?:\/|$)/i,
    anyOf: [{ moduleKey: 'koreksi', minLevel: 3 }],
  },
  {
    pattern: /^\/api\/finish(?:\/|$)/i,
    anyOf: [{ moduleKey: 'koreksi', minLevel: 1 }],
  },
  {
    pattern: /^\/api\/suppliers(?:\/|$)/i,
    anyOf: [
      { moduleKey: 'baku', minLevel: 3 },
      { moduleKey: 'stock', minLevel: 4 },
    ],
  },
  {
    pattern: /^\/api\/grades(?:\/|$)/i,
    anyOf: [
      { moduleKey: 'baku', minLevel: 2 },
      { moduleKey: 'stock', minLevel: 3 },
      { moduleKey: 'koreksi', minLevel: 1 },
      { moduleKey: 'admin', minLevel: 1 },
    ],
  },
  {
    pattern: /^\/api\/rules\/pecah-bon-presets(?:\/|$)/i,
    anyOf: [
      { moduleKey: 'stock', minLevel: 3 },
      { moduleKey: 'admin', minLevel: 1 },
    ],
  },
  {
    pattern: /^\/api\/rules(?:\/|$)/i,
    anyOf: [{ moduleKey: 'admin', minLevel: 1 }],
  },
  {
    // Dipakai halaman /stock/rak (stock) dan /admin/locations "Manajemen Rak" (admin).
    pattern: /^\/api\/locations(?:\/|$)/i,
    anyOf: [
      { moduleKey: 'stock', minLevel: 2 },
      { moduleKey: 'admin', minLevel: 1 },
    ],
  },
  {
    // Halaman /admin/rooms "Ruang Produksi"; dropdown ruang produksi di /admin/users.
    pattern: /^\/api\/production-rooms(?:\/|$)/i,
    anyOf: [
      { moduleKey: 'admin', minLevel: 1 },
      { moduleKey: 'stock', minLevel: 3 },
    ],
  },
  {
    pattern: /^\/api\/reports(?:\/|$)/i,
    anyOf: [{ moduleKey: 'reports', minLevel: 1 }],
  },
  {
    pattern: /^\/api\/lots(?:\/|$)/i,
    anyOf: [{ moduleKey: 'stock', minLevel: 2 }],
  },
  {
    pattern: /^\/api\/baku\/receive$/i,
    anyOf: [{ moduleKey: 'baku', minLevel: 1 }],
    methods: ['POST'],
  },
  {
    pattern: /^\/api\/baku\/raw-batch\/merge$/i,
    anyOf: [{ moduleKey: 'baku', minLevel: 1 }],
    methods: ['POST'],
  },
  {
    pattern: /^\/api\/baku\/pecah-bon-entry\/[^/]+\/printed$/i,
    anyOf: [{ moduleKey: 'stock', minLevel: 3 }],
    methods: ['POST'],
  },
  {
    pattern: /^\/api\/baku\/pecah-bon-entry\/[^/]+$/i,
    anyOf: [{ moduleKey: 'stock', minLevel: 3 }],
    methods: ['PATCH'],
  },
  {
    pattern: /^\/api\/baku\/pecah-bon\/history$/i,
    anyOf: [{ moduleKey: 'stock', minLevel: 3 }],
  },
  {
    pattern: /^\/api\/baku\/pecah-bon\/[^/]+$/i,
    anyOf: [{ moduleKey: 'stock', minLevel: 3 }],
  },
  {
    pattern: /^\/api\/baku\/[^/]+\/pecah-bon(?:\/paginated)?$/i,
    anyOf: [{ moduleKey: 'stock', minLevel: 3 }],
  },
  {
    pattern: /^\/api\/baku\/[^/]+\/pecah-bon$/i,
    anyOf: [{ moduleKey: 'stock', minLevel: 3 }],
    methods: ['POST'],
  },
  {
    pattern: /^\/api\/baku\/raw-batch\/[^/]+$/i,
    anyOf: [{ moduleKey: 'stock', minLevel: 1 }],
    methods: ['PATCH'],
  },
  {
    pattern: /^\/api\/baku(?:\/paginated)?$/i,
    anyOf: [{ moduleKey: 'stock', minLevel: 1 }],
  },
  {
    pattern: /^\/api\/baku\/[^/]+$/i,
    anyOf: [{ moduleKey: 'stock', minLevel: 1 }],
  },
  {
    pattern: /^\/api\/mitra-orders\/trainer\/workers$/i,
    anyOf: [
      { moduleKey: 'mitra_management', minLevel: 1 },
      { moduleKey: 'trainer_orders', minLevel: 1 },
      { moduleKey: 'stock', minLevel: 4 },
    ],
  },
  {
    pattern: /^\/api\/mitra-orders\/requests\/trainer-bulk$/i,
    anyOf: [{ moduleKey: 'trainer_orders', minLevel: 1 }],
    methods: ['POST'],
  },
  {
    pattern: /^\/api\/mitra-orders\/requests\/[^/]+\/assign-worker$/i,
    anyOf: [{ moduleKey: 'trainer_orders', minLevel: 2 }],
    methods: ['POST'],
  },
  {
    pattern: /^\/api\/mitra-orders\/requests\/[^/]+\/(approve|reject)$/i,
    anyOf: [
      { moduleKey: 'trainer_orders', minLevel: 1 },
      { moduleKey: 'stock', minLevel: 4 },
    ],
    methods: ['POST'],
  },
  {
    pattern: /^\/api\/mitra-orders\/requests\/[^/]+\/fulfill$/i,
    anyOf: [{ moduleKey: 'stock', minLevel: 4 }],
    methods: ['POST'],
  },
  {
    pattern: /^\/api\/mitra-orders\/requests(?:\/|$)/i,
    anyOf: [
      { moduleKey: 'mitra', minLevel: 1 },
      { moduleKey: 'trainer_orders', minLevel: 1 },
      { moduleKey: 'stock', minLevel: 4 },
    ],
  },
  {
    pattern: /^\/api\/work-orders\/board$/i,
    anyOf: [
      { moduleKey: 'mitra', minLevel: 1 },
      { moduleKey: 'trainer_orders', minLevel: 3 },
    ],
  },
  {
    pattern: /^\/api\/work-orders\/assign-from-mitra-order$/i,
    anyOf: [
      { moduleKey: 'trainer_orders', minLevel: 2 },
      { moduleKey: 'stock', minLevel: 4 },
    ],
    methods: ['POST'],
  },
  {
    pattern: /^\/api\/work-orders\/[^/]+\/close$/i,
    anyOf: [
      { moduleKey: 'koreksi', minLevel: 3 },
      { moduleKey: 'stock', minLevel: 4 },
    ],
    methods: ['POST'],
  },
  {
    pattern: /^\/api\/work-orders(?:\/|$)/i,
    anyOf: [
      { moduleKey: 'trainer_orders', minLevel: 2 },
      { moduleKey: 'stock', minLevel: 4 },
    ],
  },
  {
    pattern: /^\/api\/work-items\/[^/]+\/complete-dry-qc$/i,
    anyOf: [{ moduleKey: 'koreksi', minLevel: 1 }],
    methods: ['POST'],
  },
  {
    pattern: /^\/api\/work-items(?:\/|$)/i,
    anyOf: [
      { moduleKey: 'mitra', minLevel: 1 },
      { moduleKey: 'trainer_orders', minLevel: 3 },
    ],
  },
  {
    pattern: /^\/api\/attendance\/me$/i,
    anyOf: [{ moduleKey: 'mitra', minLevel: 1 }],
  },
];

export function normalizeApiRequestPath(path: string | undefined) {
  if (!path) {
    return '';
  }

  return path.split('?')[0] ?? '';
}

export function getApiAccessRequirement(path: string, method?: string) {
  const normalizedPath = normalizeApiRequestPath(path);
  const normalizedMethod = method?.toUpperCase();

  return API_ACCESS_RULES.find((rule) => {
    if (
      rule.methods &&
      normalizedMethod &&
      !rule.methods.includes(normalizedMethod)
    ) {
      return false;
    }

    return rule.pattern.test(normalizedPath);
  });
}

export function hasExplicitUiAccess(
  user: RequestAuthUser | undefined,
  moduleKey: UiAccessModuleKey,
  minLevel = 1,
) {
  if (!user?.useCustomUiAccess) {
    return false;
  }

  const level =
    user.uiAccesses
      ?.filter((entry) => entry.moduleKey === moduleKey)
      .reduce((max, entry) => Math.max(max, entry.level), 0) ?? 0;

  return level >= minLevel;
}
