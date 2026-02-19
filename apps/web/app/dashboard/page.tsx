'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useAuth } from '@/lib/auth/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToast } from '@/lib/toast';
import { getWorkerWeeklyStats, type WorkerWeeklyStatsResponse } from '@/lib/api';
import ManagerAnalytics from './components/ManagerAnalytics';

function DashboardContent() {
    const { user } = useAuth();
    const toast = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const [weeklyStats, setWeeklyStats] = useState<WorkerWeeklyStatsResponse | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);

    useEffect(() => {
        if (containerRef.current) {
            gsap.fromTo(
                containerRef.current.children,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out' }
            );
        }
    }, []);

    const loadWeeklyStats = async (workerId: string) => {
        setStatsLoading(true);
        try {
            const data = await getWorkerWeeklyStats(workerId, 6);
            setWeeklyStats(data);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat statistik.');
        } finally {
            setStatsLoading(false);
        }
    };

    useEffect(() => {
        if (!user || user.role !== 'mitra') return;
        if (!user.workerId) return;
        loadWeeklyStats(user.workerId);
    }, [user]);

    const getRoleWelcomeMessage = (role: string) => {
        switch (role) {
            case 'baku':
                return 'Kelola penerimaan bahan baku dengan mudah';
            case 'mitra':
                return 'Pantau progres pengerjaan mingguan';
            case 'koreksi':
                return 'Data koreksi sementara hanya menampilkan detail lp (ttd AMIN)';
            case 'trainer':
                return 'Atur order mitra sesuai kapasitas';
            case 'manager':
                return 'Monitor Baku, kapasitas mitra dan juga kapasitas mingguan';
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
                return [];
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
    const formatNumber = (value: number, fractionDigits = 0) =>
        new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        }).format(value);

    const formatDateLabel = (value: string) =>
        new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'short',
        }).format(new Date(value));

    const weeklySummary = useMemo(() => {
        if (!weeklyStats?.weeks?.length) return null;
        const weeks = weeklyStats.weeks;
        const current = weeks[weeks.length - 1];
        const previous = weeks[weeks.length - 2];
        const delta = (current?.totalDryInGram ?? 0) - (previous?.totalDryInGram ?? 0);
        const deltaLabel =
            delta === 0 ? 'Stabil' : delta > 0 ? `+${formatNumber(delta)} gr` : `${formatNumber(delta)} gr`;
        return { current, previous, delta, deltaLabel };
    }, [weeklyStats]);

    return (
        <div ref={containerRef} className="space-y-6">
            {/* Welcome Section */}
            <div className="bg-green-600 rounded-xl p-8 text-white">
                <h1 className="text-3xl font-bold mb-2">
                    Selamat Datang, {user.name}!
                </h1>
                <p className="text-green-100">
                    {getRoleWelcomeMessage(user.role)}
                </p>
            </div>

            {user.role === 'mitra' ? (
                <div className="space-y-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Ringkasan Mingguan</h2>
                                <p className="text-sm text-gray-500">
                                    Rekap hasil pengerjaan kamu selama 6 minggu terakhir.
                                </p>
                            </div>
                            {user.workerId && (
                                <button
                                    type="button"
                                    onClick={() => loadWeeklyStats(user.workerId as string)}
                                    className="text-sm font-medium text-green-700 hover:text-green-800"
                                >
                                    Refresh
                                </button>
                            )}
                        </div>

                        {!user.workerId && (
                            <div className="mt-4 rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                                Akun mitra belum terhubung ke data mitra. Hubungi admin.
                            </div>
                        )}

                        {statsLoading && (
                            <div className="mt-4 text-sm text-gray-500">Memuat statistik...</div>
                        )}

                        {user.workerId && !statsLoading && weeklyStats && (
                            <div className="mt-5 space-y-5">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-lg border border-gray-200 p-4">
                                        <p className="text-xs text-gray-500">Minggu Ini</p>
                                        <p className="text-2xl font-semibold text-gray-900">
                                            {formatNumber(weeklySummary?.current?.totalDryInGram ?? 0)} gr
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {weeklySummary?.current?.items ?? 0} item selesai
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-gray-200 p-4">
                                        <p className="text-xs text-gray-500">Minggu Lalu</p>
                                        <p className="text-2xl font-semibold text-gray-900">
                                            {formatNumber(weeklySummary?.previous?.totalDryInGram ?? 0)} gr
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {weeklySummary?.previous?.items ?? 0} item selesai
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                                        <p className="text-xs text-green-700">Perubahan</p>
                                        <p className="text-2xl font-semibold text-green-900">
                                            {weeklySummary?.deltaLabel ?? 'Stabil'}
                                        </p>
                                        <p className="text-xs text-green-700">Dibanding minggu sebelumnya</p>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-gray-200 p-4">
                                    <p className="text-sm font-semibold text-gray-700">Tren 6 Minggu</p>
                                    <div className="mt-4 flex items-end gap-2">
                                        {weeklyStats.weeks.map((week) => {
                                            const max = Math.max(
                                                ...weeklyStats.weeks.map((item) => item.totalDryInGram),
                                                1
                                            );
                                            const height = Math.max(
                                                12,
                                                Math.round((week.totalDryInGram / max) * 100)
                                            );
                                            return (
                                                <div key={week.weekStart} className="flex flex-1 flex-col items-center">
                                                    <div className="flex h-24 w-full items-end rounded-md bg-green-100">
                                                        <div
                                                            className="w-full rounded-md bg-green-500"
                                                            style={{ height: `${height}%` }}
                                                        />
                                                    </div>
                                                    <span className="mt-2 text-[10px] text-gray-500">
                                                        {formatDateLabel(week.weekStart)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="rounded-lg border border-gray-200 p-4">
                                    <p className="text-sm font-semibold text-gray-700">Detail Mingguan</p>
                                    <div className="mt-3 space-y-2">
                                        {weeklyStats.weeks.map((week) => (
                                            <div
                                                key={week.weekStart}
                                                className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm"
                                            >
                                                <span className="text-gray-600">
                                                    {formatDateLabel(week.weekStart)} - {formatDateLabel(week.weekEnd)}
                                                </span>
                                                <span className="font-semibold text-gray-900">
                                                    {formatNumber(week.totalDryInGram)} gr
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {user.workerId && !statsLoading && !weeklyStats && (
                            <div className="mt-4 rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                                Belum ada data statistik minggu ini.
                            </div>
                        )}
                    </div>
                </div>
            ) : user.role !== 'manager' && quickActions.length > 0 ? (
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
            ) : null}

            {user.role === 'manager' && (
                <ManagerAnalytics />
            )}


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
