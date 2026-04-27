'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { login as apiLogin, logout as apiLogout, getProfile } from '@/lib/api';
import type { UiAccessModuleKey, User, UserRole } from '@/lib/types/auth';
import { getDefaultAuthorizedPath, hasModuleAccess as canUseModuleAccess } from '@/lib/access-control';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string, remember?: boolean) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    hasRole: (roles: UserRole | UserRole[]) => boolean;
    hasModuleAccess: (moduleKey: UiAccessModuleKey, minLevel?: number) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Load user from session on mount
    useEffect(() => {
        const loadUser = async () => {
            try {
                const token = localStorage.getItem('token') ?? sessionStorage.getItem('token');
                const savedUser = localStorage.getItem('user') ?? sessionStorage.getItem('user');

                if (token && savedUser) {
                    // Try to verify token with backend
                    try {
                        const profile = await getProfile();
                        setUser(profile as User);
                    } catch (error) {
                        // Token invalid, clear session
                        console.error('Token validation failed:', error);
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        sessionStorage.removeItem('token');
                        sessionStorage.removeItem('user');
                        setUser(null);
                    }
                }
            } catch (error) {
                console.error('Error loading user:', error);
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, []);

    const login = useCallback(async (email: string, password: string, remember = true) => {
        try {
            const response = await apiLogin({ email, password });

            // Save session
            if (remember) {
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
                localStorage.setItem('token', response.token);
                localStorage.setItem('user', JSON.stringify(response.user));
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                sessionStorage.setItem('token', response.token);
                sessionStorage.setItem('user', JSON.stringify(response.user));
            }

            setUser(response.user as User);

            // Redirect based on role
            router.push(getDefaultAuthorizedPath(response.user as User));
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }, [router]);

    const logout = useCallback(() => {
        // Call API logout (fire and forget)
        apiLogout().catch(console.error);

        // Clear local session
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        setUser(null);

        // Redirect to login
        router.push('/login');
    }, [router]);

    const hasRole = useCallback((roles: UserRole | UserRole[]) => {
        if (!user) return false;

        const roleArray = Array.isArray(roles) ? roles : [roles];
        return roleArray.includes(user.role as UserRole);
    }, [user]);

    const hasModuleAccess = useCallback(
        (moduleKey: UiAccessModuleKey, minLevel = 1) =>
            canUseModuleAccess(user, moduleKey, minLevel),
        [user],
    );

    const value: AuthContextType = {
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        hasRole,
        hasModuleAccess,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
