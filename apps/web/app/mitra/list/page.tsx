'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LoaderCircle, RefreshCw, UserPlus } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/lib/toast';
import { getTrainerOrderWorkers, type TrainerWorkerOrderCandidate } from '@/lib/api';

type StatusFilter = 'ALL' | 'ELIGIBLE' | 'BUSY' | 'UNASSIGNED';
type StatusInfo = {
    label: string;
    className: string;
    spinning?: boolean;
};

function StatusBadge({ status }: { status: StatusInfo }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${status.className}`}
        >
            {status.spinning ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
            {status.label}
        </span>
    );
}

function MitraListContent() {
    const toast = useToast();
    const [workers, setWorkers] = useState<TrainerWorkerOrderCandidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

    const loadWorkers = async (refresh = false) => {
        if (refresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const data = await getTrainerOrderWorkers({ includeUnassigned: true });
            setWorkers(data);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat daftar mitra.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadWorkers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredWorkers = useMemo(() => {
        const query = search.trim().toLowerCase();
        return workers
            .filter((worker) => {
                if (statusFilter === 'ELIGIBLE') return worker.isOrderEligible;
                if (statusFilter === 'BUSY') return !worker.isOrderEligible;
                if (statusFilter === 'UNASSIGNED') return !worker.trainerId;
                return true;
            })
            .filter((worker) => {
                if (!query) return true;
                const values = [
                    worker.name,
                    worker.code ?? '',
                    worker.pin ?? '',
                    worker.trainer?.name ?? '',
                ];
                return values.some((value) => value.toLowerCase().includes(query));
            })
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [search, statusFilter, workers]);

    const stats = useMemo(() => {
        const ready = workers.filter((worker) => worker.isOrderEligible).length;
        const busy = workers.length - ready;
        const unassigned = workers.filter((worker) => !worker.trainerId).length;
        const monthlyTotalGram = workers.reduce(
            (sum, worker) => sum + (worker.capacityStats?.monthlyDryInGram ?? 0),
            0
        );
        const currentWeekTotalGram = workers.reduce(
            (sum, worker) => sum + (worker.capacityStats?.currentWeekDryInGram ?? 0),
            0
        );
        const activeWorkers = workers.filter((worker) => (worker.capacityStats?.weeksWithSetoran ?? 0) > 0);
        const avgWeeklyPerWorkerGram =
            activeWorkers.length > 0
                ? activeWorkers.reduce(
                    (sum, worker) => sum + (worker.capacityStats?.avgWeeklyDryInGram ?? 0),
                    0
                ) / activeWorkers.length
                : 0;

        return {
            total: workers.length,
            ready,
            busy,
            unassigned,
            monthlyTotalGram,
            currentWeekTotalGram,
            avgWeeklyPerWorkerGram,
        };
    }, [workers]);

    const getStatusInfo = (worker: TrainerWorkerOrderCandidate) => {
        if (worker.isOrderEligible) {
            return {
                label: 'Siap Diorder',
                className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            } satisfies StatusInfo;
        }
        if (worker.hasActiveWorkOrder) {
            return {
                label: 'Sedang Produksi',
                className: 'border-amber-200 bg-amber-50 text-amber-700',
                spinning: true,
            } satisfies StatusInfo;
        }
        if (worker.pendingOrderCount > 0) {
            return {
                label: 'Order Pending',
                className: 'border-blue-200 bg-blue-50 text-blue-700',
            } satisfies StatusInfo;
        }
        return {
            label: 'Menunggu',
            className: 'border-gray-200 bg-gray-50 text-gray-600',
        } satisfies StatusInfo;
    };

    return (
        <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-4 md:p-6">
            <div className="mx-auto max-w-6xl space-y-4 md:space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">Daftar Mitra Binaan</h1>
                        <p className="text-sm text-gray-600">
                            Pantau status kesiapan order tiap mitra secara cepat.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href="/mitra/add">
                            <Button className="gap-2">
                                <UserPlus className="h-4 w-4" />
                                Tambah Mitra
                            </Button>
                        </Link>
                        <Button variant="outline" onClick={() => loadWorkers(true)} disabled={loading || refreshing}>
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                        <p className="text-xs text-gray-500">Total Mitra</p>
                        <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs text-emerald-700">Siap Diorder</p>
                        <p className="text-2xl font-semibold text-emerald-800">{stats.ready}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs text-amber-700">Sedang Proses / Pending</p>
                        <p className="text-2xl font-semibold text-amber-800">{stats.busy}</p>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                        <p className="text-xs text-blue-700">Belum Assign Pengawas</p>
                        <p className="text-2xl font-semibold text-blue-800">{stats.unassigned}</p>
                    </div>
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                        <p className="text-xs text-violet-700">Setoran Minggu Ini</p>
                        <p className="text-2xl font-semibold text-violet-800">
                            {stats.currentWeekTotalGram.toLocaleString('id-ID')} gr
                        </p>
                    </div>
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                        <p className="text-xs text-indigo-700">Rekap Bulan Ini</p>
                        <p className="text-lg font-semibold text-indigo-900">
                            {stats.monthlyTotalGram.toLocaleString('id-ID')} gr
                        </p>
                        <p className="text-xs text-indigo-700">
                            Rata2/minggu: {stats.avgWeeklyPerWorkerGram.toLocaleString('id-ID', { maximumFractionDigits: 2 })} gr/mitra
                        </p>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                        <div className="space-y-1.5">
                            <p className="text-xs font-medium text-gray-600">Cari Mitra</p>
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Nama / kode / PIN"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-xs font-medium text-gray-600">Filter Status</p>
                            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Semua</SelectItem>
                                    <SelectItem value="ELIGIBLE">Siap Diorder</SelectItem>
                                    <SelectItem value="BUSY">Sedang Proses / Pending</SelectItem>
                                    <SelectItem value="UNASSIGNED">Belum Assign Pengawas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                        Status dipakai untuk cek kesiapan order: <b>Siap Diorder</b> berarti tidak ada order pending dan tidak ada LP aktif.
                    </p>
                </div>

                <div className="space-y-3 md:hidden">
                    {loading ? (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                            Memuat daftar mitra...
                        </div>
                    ) : filteredWorkers.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                            Tidak ada data mitra untuk filter ini.
                        </div>
                    ) : (
                        filteredWorkers.map((worker) => (
                            <div key={worker.id} className="rounded-xl border border-gray-200 bg-white p-4">
                                {(() => {
                                    const status = getStatusInfo(worker);
                                    return (
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-medium text-gray-900">{worker.name}</p>
                                        <p className="text-xs text-gray-500">{worker.code ?? worker.id.slice(0, 8)}</p>
                                    </div>
                                    <StatusBadge status={status} />
                                </div>
                                    );
                                })()}
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                                    <div>PIN: {worker.pin ?? '-'}</div>
                                    <div>
                                        Minggu ini: {(worker.capacityStats?.currentWeekDryInGram ?? 0).toLocaleString('id-ID')} gr
                                    </div>
                                    <div>
                                        Bulan ini: {(worker.capacityStats?.monthlyDryInGram ?? 0).toLocaleString('id-ID')} gr
                                    </div>
                                    <div>
                                        Rata2/minggu: {(worker.capacityStats?.avgWeeklyDryInGram ?? 0).toLocaleString('id-ID')} gr
                                    </div>
                                    <div className="col-span-2">Pengawas: {worker.trainer?.name ?? 'Belum assign'}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white md:block">
                    <div className="max-h-[65vh] overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                <tr>
                                    <th className="px-3 py-2 text-left">Mitra</th>
                                    <th className="px-3 py-2 text-left">PIN</th>
                                    <th className="px-3 py-2 text-left">Rekap Kapasitas Aktual</th>
                                    <th className="px-3 py-2 text-left">Pengawas</th>
                                    <th className="px-3 py-2 text-left">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                                            Memuat daftar mitra...
                                        </td>
                                    </tr>
                                ) : filteredWorkers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                                            Tidak ada data mitra untuk filter ini.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredWorkers.map((worker) => (
                                        <tr key={worker.id}>
                                            <td className="px-3 py-2">
                                                <p className="font-medium text-gray-900">{worker.name}</p>
                                                <p className="text-xs text-gray-500">{worker.code ?? worker.id.slice(0, 8)}</p>
                                            </td>
                                            <td className="px-3 py-2 text-gray-700">{worker.pin ?? '-'}</td>
                                            <td className="px-3 py-2 text-gray-700">
                                                <div className="text-xs text-gray-700">
                                                    <p>Minggu ini: {(worker.capacityStats?.currentWeekDryInGram ?? 0).toLocaleString('id-ID')} gr</p>
                                                    <p>Bulan ini: {(worker.capacityStats?.monthlyDryInGram ?? 0).toLocaleString('id-ID')} gr</p>
                                                    <p className="text-gray-500">
                                                        Rata2/minggu: {(worker.capacityStats?.avgWeeklyDryInGram ?? 0).toLocaleString('id-ID')} gr
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-gray-700">{worker.trainer?.name ?? 'Belum assign'}</td>
                                            <td className="px-3 py-2">
                                                {(() => {
                                                    const status = getStatusInfo(worker);
                                                    return <StatusBadge status={status} />;
                                                })()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function MitraListPage() {
    return (
        <ProtectedRoute allowedRoles={['trainer', 'manager']}>
            <MitraListContent />
        </ProtectedRoute>
    );
}
