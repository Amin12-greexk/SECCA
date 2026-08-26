'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import LoadingCircle from '@/components/LoadingCircle';
import type { UserRole } from '@/lib/types/auth';
import { canAccessPath, getRouteAccessRequirement } from '@/lib/access-control';

interface ProtectedRouteProps {
    children: React.ReactNode;
    /**
     * Fallback berbasis role, HANYA dipakai kalau pathname tidak punya entry di
     * ROUTE_ACCESS_RULES (lihat lib/access-control.ts). Begitu sebuah route punya
     * rule, module-level access yang menang dan prop ini diabaikan — jadi jangan
     * pakai ini untuk halaman yang sudah terdaftar di sana, karena akan terbaca
     * seolah menjaga padahal tidak. Sumber kebenaran akses = access-control.ts.
     */
    allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
    const { user, loading, isAuthenticated } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    const routeRequirement = getRouteAccessRequirement(pathname);
    const hasRouteAccess = isAuthenticated && !!user && canAccessPath(user, pathname);
    const userRole = (user?.role?.toLowerCase() ?? '') as UserRole;
    const hasRoleAccess =
        !allowedRoles || allowedRoles.length === 0
            ? true
            : allowedRoles.map((r) => r.toLowerCase()).includes(userRole);
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
