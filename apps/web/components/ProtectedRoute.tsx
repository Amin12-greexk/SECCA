'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import LoadingCircle from '@/components/LoadingCircle';
import type { UserRole } from '@/lib/types/auth';
import { canAccessPath, getRouteAccessRequirement } from '@/lib/access-control';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, loading, isAuthenticated } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const routeRequirement = getRouteAccessRequirement(pathname);
    const hasRouteAccess = isAuthenticated && !!user && canAccessPath(user, pathname);
    const hasRoleAccess =
        !allowedRoles || allowedRoles.length === 0
            ? true
            : allowedRoles.includes(user?.role as UserRole);
    const hasPermission = routeRequirement ? hasRouteAccess : hasRoleAccess;

    useEffect(() => {
        if (!loading) {
            // Not authenticated -> redirect to login
            if (!isAuthenticated) {
                router.push('/login');
                return;
            }

            if (!hasPermission) {
                router.push('/unauthorized');
                return;
            }
        }
    }, [hasPermission, isAuthenticated, loading, router]);

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

    if (!hasPermission) {
        return null;
    }

    // Authenticated and has permission -> render children
    return <>{children}</>;
}
