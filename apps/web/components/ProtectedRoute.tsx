'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import LoadingCircle from '@/components/LoadingCircle';
import type { UserRole } from '@/lib/types/auth';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, loading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            // Not authenticated -> redirect to login
            if (!isAuthenticated) {
                router.push('/login');
                return;
            }

            // Check role if allowedRoles specified
            if (allowedRoles && allowedRoles.length > 0) {
                const hasPermission = allowedRoles.includes(user?.role as UserRole);

                if (!hasPermission) {
                    router.push('/unauthorized');
                    return;
                }
            }
        }
    }, [loading, isAuthenticated, user, allowedRoles, router]);

    // Show loading while checking auth
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <LoadingCircle size="lg" />
            </div>
        );
    }

    // Not authenticated or no permission -> show nothing (will redirect)
    if (!isAuthenticated) {
        return null;
    }

    if (allowedRoles && allowedRoles.length > 0) {
        const hasPermission = allowedRoles.includes(user?.role as UserRole);
        if (!hasPermission) {
            return null;
        }
    }

    // Authenticated and has permission -> render children
    return <>{children}</>;
}
