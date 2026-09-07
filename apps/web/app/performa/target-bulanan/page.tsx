'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { getPerformaPeriods, type PerformaPeriod } from '@/lib/api';
import { useToast } from '@/lib/toast';
import MonthlyCapacityRecap from '../components/MonthlyCapacityRecap';

/**
 * Rekap Bulanan · Target Kapasitas — dipisah dari /performa (bukan cuma
 * ditaruh di bawah panel-panel lain) karena isinya sendiri sudah panjang:
 * tangga target, meter tiap bulan, rincian per angkatan, lalu daftar mitra.
 * Digabung ke dashboard utama artinya scroll dua kali lebih jauh untuk
 * sampai ke bagian lain dashboard.
 */
function TargetBulananContent() {
    const router = useRouter();
    const toast = useToast();
    const [periods, setPeriods] = useState<PerformaPeriod[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setPeriods(await getPerformaPeriods());
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat daftar periode.');
        } finally {
            setLoading(false);
        }
        // toast stabil dari provider; tidak dijadikan dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // Klik satu mitra di sini pindah ke panel detail mingguannya di dashboard
    // utama — rincian per-periode itu bukan bagian dari rekap bulanan ini.
    const selectPerson = useCallback(
        (personId: string) => {
            router.push(`/performa?person=${personId}`);
        },
        [router],
    );

    return (
        <div className="p-4 sm:p-8">
            <div className="mx-auto max-w-6xl space-y-5">
                <div className="rounded-xl border border-gray-200 bg-white px-5 pt-5 pb-4 shadow-sm">
                    <Link
                        href="/performa"
                        className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Kembali ke Dashboard Performa
                    </Link>
                    <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        Rekap Bulanan · Target Kapasitas
                    </h1>
                    <p className="mt-0.5 text-xs text-gray-500">Tiap mitra ditagih sesuai umur kerjanya</p>
                </div>

                {loading && periods.length === 0 ? (
                    <div className="flex h-[300px] items-center justify-center rounded-xl border border-gray-200 bg-white text-sm text-gray-400">
                        Memuat...
                    </div>
                ) : periods.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
                        <TrendingUp className="mx-auto h-8 w-8 text-gray-300" />
                        <p className="mt-3 text-sm font-medium text-gray-700">Belum ada data periode</p>
                        <p className="mt-1 text-xs text-gray-400">
                            Upload data dulu di halaman Dashboard Performa.
                        </p>
                    </div>
                ) : (
                    <MonthlyCapacityRecap periods={periods} onSelect={selectPerson} />
                )}
            </div>
        </div>
    );
}

/**
 * TANPA ProtectedRoute — rekap ini konten yang sama dengan yang tadinya
 * tampil langsung di /performa (dashboard publik), cuma dipindah ke halaman
 * sendiri karena kepanjangan. Membungkusnya dengan ProtectedRoute di sini
 * akan diam-diam menggembok data yang sebelumnya bisa dilihat siapa saja.
 */
export default function TargetBulananPage() {
    return <TargetBulananContent />;
}
