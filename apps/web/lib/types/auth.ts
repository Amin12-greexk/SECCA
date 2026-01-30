export type UserRole = 'baku' | 'mitra' | 'koreksi' | 'manager';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
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
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    hasRole: (roles: UserRole | UserRole[]) => boolean;
}
