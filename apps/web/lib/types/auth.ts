export type UserRole = 'baku' | 'mitra' | 'koreksi' | 'manager' | 'trainer' | 'admin';

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

export interface UiAccessEntry {
    moduleKey: UiAccessModuleKey | string;
    level: number;
}

export interface User {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    pin?: string | null;
    role: UserRole;
    workerId?: string | null;
    useCustomUiAccess?: boolean;
    /** Akun hanya-lihat: tambah/ubah/hapus dikunci di server. */
    readOnly?: boolean;
    uiAccesses?: UiAccessEntry[];
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    user: User;
    token: string;
}

export interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string, remember?: boolean) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    hasRole: (roles: UserRole | UserRole[]) => boolean;
    hasModuleAccess: (moduleKey: UiAccessModuleKey, minLevel?: number) => boolean;
}
