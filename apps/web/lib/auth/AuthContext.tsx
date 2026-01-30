'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { login as apiLogin, logout as apiLogout, getProfile } from '@/lib/api';
import type { User, UserRole } from '@/lib/types/auth';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    hasRole: (roles: UserRole | UserRole[]) => boolean;
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
                const token = localStorage.getItem('token');
                const savedUser = localStorage.getItem('user');

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

    const login = useCallback(async (email: string, password: string) => {
        try {
            const response = await apiLogin({ email, password });

            // Save to localStorage
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));

            setUser(response.user as User);

            // Redirect based on role
            if (response.user.role === 'baku') {
                router.push('/baku/receive');
            } else {
                router.push('/dashboard');
            }
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
        setUser(null);

        // Redirect to login
        router.push('/login');
    }, [router]);

    const hasRole = useCallback((roles: UserRole | UserRole[]) => {
        if (!user) return false;

        const roleArray = Array.isArray(roles) ? roles : [roles];
        return roleArray.includes(user.role as UserRole);
    }, [user]);

    const value: AuthContextType = {
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        hasRole,
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
