export type UserRole = 'baku' | 'mitra' | 'koreksi' | 'manager' | 'trainer';

export interface User {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    pin?: string | null;
    role: UserRole;
    workerId?: string | null;
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
}
