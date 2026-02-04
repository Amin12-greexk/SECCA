'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useAuth } from '@/lib/auth/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

function DashboardContent() {
    const { user } = useAuth();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            gsap.fromTo(
                containerRef.current.children,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out' }
            );
        }
    }, []);

    const getRoleWelcomeMessage = (role: string) => {
        switch (role) {
            case 'baku':
                return 'Kelola penerimaan bahan baku dengan mudah';
            case 'mitra':
                return 'Kelola data mitra dan supplier';
            case 'koreksi':
                return 'Lakukan koreksi data dengan akurat';
            case 'manager':
                return 'Pantau seluruh operasional sistem';
            default:
                return 'Selamat datang di sistem SECCA';
        }
    };

    const getQuickActions = (role: string) => {
        switch (role) {
            case 'baku':
                return [
                    { name: 'Terima Baku Baru', href: '/baku/receive', icon: '📦' },
                    { name: 'Lihat Riwayat', href: '/baku/history', icon: '📋' },
                ];
            case 'mitra':
                return [
                    { name: 'Tambah Mitra', href: '/mitra/add', icon: '➕' },
                    { name: 'Daftar Mitra', href: '/mitra/list', icon: '👥' },
                ];
            case 'koreksi':
                return [
                    { name: 'Data Koreksi', href: '/koreksi/data', icon: '✏️' },
                    { name: 'Riwayat Koreksi', href: '/koreksi/history', icon: '📝' },
                ];
            case 'manager':
                return [
                    { name: 'Lihat Laporan', href: '/reports', icon: '📊' },
                    { name: 'Pengaturan', href: '/settings', icon: '⚙️' },
                    { name: 'Terima Baku', href: '/baku/receive', icon: '📦' },
                ];
            default:
                return [];
        }
    };

    if (!user) return null;

    const quickActions = getQuickActions(user.role);

    return (
        <div ref={containerRef} className="space-y-6">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-xl p-8 text-white">
                <h1 className="text-3xl font-bold mb-2">
                    Selamat Datang, {user.name}!
                </h1>
                <p className="text-green-100">
                    {getRoleWelcomeMessage(user.role)}
                </p>
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {quickActions.map((action) => (
                        <a
                            key={action.href}
                            href={action.href}
                            className="bg-white border border-gray-200 rounded-lg p-6 hover:border-green-500 hover:shadow-md transition-all group"
                        >
                            <div className="text-4xl mb-3">{action.icon}</div>
                            <h3 className="font-medium text-gray-900 group-hover:text-green-600 transition-colors">
                                {action.name}
                            </h3>
                        </a>
                    ))}
                </div>
            </div>

            
        </div>
    );
}

export default function DashboardPage() {
    return (
        <ProtectedRoute>
            <div className="p-8">
                <DashboardContent />
            </div>
        </ProtectedRoute>
    );
}
