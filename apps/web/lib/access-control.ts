import type { UiAccessEntry, UiAccessModuleKey, User, UserRole } from '@/lib/types/auth';

export type UiAccessLevelDefinition = {
    level: number;
    label: string;
    description: string;
};

export type UiAccessModuleDefinition = {
    key: UiAccessModuleKey;
    label: string;
    description: string;
    levels: UiAccessLevelDefinition[];
};

type RouteAccessRule = {
    matcher: RegExp;
    moduleKey: UiAccessModuleKey;
    minLevel: number;
};

export const UI_ACCESS_MODULES: UiAccessModuleDefinition[] = [
    {
        key: 'dashboard',
        label: 'Dashboard',
        description: 'Kontrol tampilan dashboard dan analytics manager.',
        levels: [
            { level: 1, label: 'Dashboard umum', description: 'Dashboard standar tanpa analytics manager.' },
            { level: 2, label: 'Analytics manager', description: 'Dashboard lengkap dengan analytics manager.' },
        ],
    },
    {
        key: 'baku',
        label: 'Baku',
        description: 'Menu operasional penerimaan bahan baku.',
        levels: [
            { level: 1, label: 'Terima Baku', description: 'Akses ke penerimaan bahan baku.' },
            { level: 2, label: 'Tambah Grading', description: 'Tambah akses grading bahan baku.' },
            { level: 3, label: 'Tambah Supplier', description: 'Tambah akses pengelolaan supplier.' },
        ],
    },
    {
        key: 'stock',
        label: 'Stock',
        description: 'Menu stock dan turunan stock.',
        levels: [
            { level: 1, label: 'Data Stock', description: 'Lihat halaman data stock.' },
            { level: 2, label: 'Rak', description: 'Akses halaman rak.' },
            { level: 3, label: 'Pecah Bon', description: 'Akses halaman pecah bon.' },
            {
                level: 4,
                label: 'Stock lanjutan',
                description: 'Akses halaman temporary, mitra order, dan menu stock lanjutan.',
            },
        ],
    },
    {
        key: 'mitra_management',
        label: 'Mitra Binaan',
        description: 'Menu daftar mitra dan pengelolaan mitra binaan.',
        levels: [
            { level: 1, label: 'Daftar Mitra', description: 'Lihat daftar mitra binaan.' },
            { level: 2, label: 'Tambah Mitra', description: 'Tambah mitra binaan.' },
        ],
    },
    {
        key: 'mitra',
        label: 'Board Mitra',
        description: 'Kartu LP pencabutan mitra.',
        levels: [
            { level: 1, label: 'Board Mitra', description: 'Lihat board kerja mitra.' },
        ],
    },
    {
        key: 'trainer_orders',
        label: 'Order Mitra',
        description: 'Menu order LP dan board pengawas.',
        levels: [
            { level: 1, label: 'Order LP', description: 'Buat order LP untuk mitra.' },
            { level: 2, label: 'Board Trainer', description: 'Lihat board trainer/pengawas.' },
        ],
    },
    {
        key: 'koreksi',
        label: 'Setoran',
        description: 'Menu setoran, barang jadi, dan riwayat setoran.',
        levels: [
            { level: 1, label: 'Setoran', description: 'Akses input setoran dan pencatatan hasil.' },
            { level: 2, label: 'Barang Jadi', description: 'Kelola master barang jadi dan by product.' },
            { level: 3, label: 'Riwayat Setoran', description: 'Lihat riwayat setoran dan barang jadi.' },
        ],
    },
    {
        key: 'admin',
        label: 'Admin',
        description: 'Pengaturan data master, akun, dan pengawas.',
        levels: [
            { level: 1, label: 'Manajemen Data', description: 'Akses ke halaman rules/manajemen data.' },
            { level: 2, label: 'Manajemen Akun', description: 'Akses ke halaman akun dan akses user.' },
            { level: 3, label: 'Assign Pengawas', description: 'Akses assign mitra dan pengawas.' },
        ],
    },
    {
        key: 'settings',
        label: 'Settings',
        description: 'Halaman pengaturan aplikasi.',
        levels: [
            { level: 1, label: 'Settings', description: 'Akses halaman settings.' },
        ],
    },
    {
        key: 'reports',
        label: 'Laporan',
        description: 'Halaman laporan.',
        levels: [
            { level: 1, label: 'Laporan', description: 'Akses halaman laporan.' },
        ],
    },
];

export const ROLE_DEFAULT_ACCESS: Record<UserRole, Partial<Record<UiAccessModuleKey, number>>> = {
    baku: {
        baku: 3,
        stock: 4,
    },
    mitra: {
        dashboard: 1,
        mitra: 1,
    },
    koreksi: {
        dashboard: 1,
        koreksi: 3,
    },
    manager: {
        dashboard: 2,
        baku: 3,
        stock: 4,
        mitra_management: 2,
        mitra: 1,
        trainer_orders: 2,
        koreksi: 3,
        admin: 3,
        settings: 1,
        reports: 1,
    },
    trainer: {
        dashboard: 1,
        mitra_management: 2,
        trainer_orders: 2,
    },
    // Admin sistem: hanya administrasi (data master, akun, assign pengawas) +
    // settings. Sengaja TIDAK diberi `dashboard`, karena level 1 pun sudah
    // membuka /performa yang memuat rincian upah mitra — lihat ROUTE_ACCESS_RULES.
    admin: {
        admin: 3,
        settings: 1,
    },
};

const ROUTE_ACCESS_RULES: RouteAccessRule[] = [
    { matcher: /^\/dashboard(?:\/|$)/, moduleKey: 'dashboard', minLevel: 1 },
    { matcher: /^\/performa(?:\/|$)/, moduleKey: 'dashboard', minLevel: 1 },
    { matcher: /^\/baku\/receive(?:\/|$)/, moduleKey: 'baku', minLevel: 1 },
    { matcher: /^\/baku\/grading(?:\/|$)/, moduleKey: 'baku', minLevel: 2 },
    { matcher: /^\/baku\/supplier(?:\/|$)/, moduleKey: 'baku', minLevel: 3 },
    { matcher: /^\/baku\/orders(?:\/|$)/, moduleKey: 'baku', minLevel: 1 },
    { matcher: /^\/stock$/, moduleKey: 'stock', minLevel: 1 },
    { matcher: /^\/stock\/asal(?:\/|$)/, moduleKey: 'stock', minLevel: 1 },
    { matcher: /^\/stock\/rak(?:\/|$)/, moduleKey: 'stock', minLevel: 2 },
    { matcher: /^\/stock\/pecah-bon(?:\/|$)/, moduleKey: 'stock', minLevel: 3 },
    { matcher: /^\/stock\/(temporary|mitra-order)(?:\/|$)/, moduleKey: 'stock', minLevel: 4 },
    { matcher: /^\/mitra\/list(?:\/|$)/, moduleKey: 'mitra_management', minLevel: 1 },
    { matcher: /^\/mitra\/add(?:\/|$)/, moduleKey: 'mitra_management', minLevel: 2 },
    { matcher: /^\/mitra\/board(?:\/|$)/, moduleKey: 'mitra', minLevel: 1 },
    { matcher: /^\/trainer\/orders(?:\/|$)/, moduleKey: 'trainer_orders', minLevel: 1 },
    { matcher: /^\/trainer\/assign(?:\/|$)/, moduleKey: 'trainer_orders', minLevel: 2 },
    { matcher: /^\/trainer\/board(?:\/|$)/, moduleKey: 'trainer_orders', minLevel: 2 },
    { matcher: /^\/koreksi\/data(?:\/|$)/, moduleKey: 'koreksi', minLevel: 1 },
    { matcher: /^\/koreksi\/barang-jadi(?:\/|$)/, moduleKey: 'koreksi', minLevel: 2 },
    { matcher: /^\/koreksi\/evaluasi(?:\/|$)/, moduleKey: 'koreksi', minLevel: 2 },
    { matcher: /^\/koreksi\/history(?:\/|$)/, moduleKey: 'koreksi', minLevel: 3 },
    { matcher: /^\/admin\/rules(?:\/|$)/, moduleKey: 'admin', minLevel: 1 },
    { matcher: /^\/admin\/users(?:\/|$)/, moduleKey: 'admin', minLevel: 2 },
    { matcher: /^\/admin\/mitra-pengawas(?:\/|$)/, moduleKey: 'admin', minLevel: 3 },
    { matcher: /^\/admin\/locations(?:\/|$)/, moduleKey: 'admin', minLevel: 1 },
    { matcher: /^\/admin\/rooms(?:\/|$)/, moduleKey: 'admin', minLevel: 1 },
    { matcher: /^\/settings(?:\/|$)/, moduleKey: 'settings', minLevel: 1 },
    { matcher: /^\/reports(?:\/|$)/, moduleKey: 'reports', minLevel: 1 },
];

const DEFAULT_ROUTE_PRIORITY: Array<{ path: string; moduleKey: UiAccessModuleKey; minLevel: number }> = [
    { path: '/dashboard', moduleKey: 'dashboard', minLevel: 1 },
    { path: '/performa', moduleKey: 'dashboard', minLevel: 1 },
    { path: '/baku/receive', moduleKey: 'baku', minLevel: 1 },
    { path: '/stock', moduleKey: 'stock', minLevel: 1 },
    { path: '/trainer/orders', moduleKey: 'trainer_orders', minLevel: 1 },
    { path: '/mitra/board', moduleKey: 'mitra', minLevel: 1 },
    { path: '/koreksi/data', moduleKey: 'koreksi', minLevel: 1 },
    { path: '/admin/rules', moduleKey: 'admin', minLevel: 1 },
    { path: '/settings', moduleKey: 'settings', minLevel: 1 },
];

export function normalizeUiAccessEntries(entries: UiAccessEntry[] | undefined) {
    if (!entries) {
        return [];
    }

    const byKey = new Map<string, number>();
    for (const entry of entries) {
        if (!entry?.moduleKey || typeof entry.level !== 'number' || entry.level <= 0) {
            continue;
        }

        byKey.set(entry.moduleKey, Math.max(byKey.get(entry.moduleKey) ?? 0, entry.level));
    }

    return Array.from(byKey.entries()).map(([moduleKey, level]) => ({ moduleKey, level }));
}

export function getEffectiveAccessMap(user: User | null | undefined) {
    if (!user) {
        return {} as Partial<Record<UiAccessModuleKey, number>>;
    }

    if (user.useCustomUiAccess) {
        const normalized = normalizeUiAccessEntries(user.uiAccesses);
        return normalized.reduce<Partial<Record<UiAccessModuleKey, number>>>((acc, entry) => {
            acc[entry.moduleKey as UiAccessModuleKey] = entry.level;
            return acc;
        }, {});
    }

    const normalizedRole = (user.role?.toLowerCase() ?? '') as UserRole;
    return { ...(ROLE_DEFAULT_ACCESS[normalizedRole] ?? {}) };
}

export function hasModuleAccess(
    user: User | null | undefined,
    moduleKey: UiAccessModuleKey,
    minLevel = 1,
) {
    const accessMap = getEffectiveAccessMap(user);
    return (accessMap[moduleKey] ?? 0) >= minLevel;
}

export function getRouteAccessRequirement(pathname: string) {
    return ROUTE_ACCESS_RULES.find((rule) => rule.matcher.test(pathname));
}

export function canAccessPath(user: User | null | undefined, pathname: string) {
    const requirement = getRouteAccessRequirement(pathname);
    if (!requirement) {
        return true;
    }

    return hasModuleAccess(user, requirement.moduleKey, requirement.minLevel);
}

export function getDefaultAuthorizedPath(user: User | null | undefined) {
    for (const item of DEFAULT_ROUTE_PRIORITY) {
        if (hasModuleAccess(user, item.moduleKey, item.minLevel)) {
            return item.path;
        }
    }

    return '/profile';
}

export function getModuleDefinition(moduleKey: UiAccessModuleKey) {
    return UI_ACCESS_MODULES.find((module) => module.key === moduleKey) ?? null;
}
