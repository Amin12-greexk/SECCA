'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
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
import { getGrades, getRackLotsByCodePaginated, type Grade, type RackLotsPaginatedResponse } from '@/lib/api';
import { useToast } from '@/lib/toast';

const RACK_CODE = 'RAK_MITRA_ORDER';

function MitraOrderContent() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [data, setData] = useState<RackLotsPaginatedResponse | null>(null);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [gradeId, setGradeId] = useState('ALL');
    const [printed, setPrinted] = useState<'all' | 'printed' | 'unprinted'>('all');

    useEffect(() => {
        const handler = window.setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 300);
        return () => window.clearTimeout(handler);
    }, [searchInput]);

    const loadGrades = async () => {
        try {
            const gradeList = await getGrades();
            setGrades(gradeList.filter((item) => item.type === 'BENTUK'));
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat daftar grade.');
        }
    };

    const loadLots = async (refresh = false) => {
        if (refresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const response = await getRackLotsByCodePaginated(RACK_CODE, {
                page,
                limit,
                search: search || undefined,
                gradeId: gradeId === 'ALL' ? undefined : gradeId,
                printed,
            });
            setData(response);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat data rak mitra order.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadGrades();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        loadLots();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, limit, search, gradeId, printed]);

    const locationName = data?.location?.name ?? 'Rak Mitra Order';
    const lots = data?.lots ?? [];
    const total = data?.total ?? 0;
    const totalWetWeightGram = data?.totalWetWeightGram ?? 0;
    const totalPages = data?.totalPages ?? 1;
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    const gradeSummary = useMemo(() => {
        const map = new Map<string, number>();
        lots.forEach((lot) => {
            const key = lot.grade?.code ?? '-';
            map.set(key, (map.get(key) ?? 0) + 1);
        });
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    }, [lots]);

    return (
        <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-4 md:p-6">
            <div className="mx-auto max-w-7xl space-y-4 md:space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">Rak Mitra Order</h1>
                        <p className="text-sm text-gray-600">
                            Pool LP dari baku sebelum otomatis dialokasikan ke mitra sesuai template order.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => loadLots(true)} disabled={loading || refreshing}>
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-3">
                        <p className="text-xs text-gray-500">Lokasi</p>
                        <p className="font-semibold text-gray-900">{locationName}</p>
                        <p className="text-xs text-gray-500">{RACK_CODE}</p>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                        <p className="text-xs text-blue-700">Total LP</p>
                        <p className="text-2xl font-semibold text-blue-800">{total.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs text-emerald-700">Total Gram</p>
                        <p className="text-2xl font-semibold text-emerald-800">{totalWetWeightGram.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs text-amber-700">Grade Terbanyak</p>
                        <p className="font-semibold text-amber-800">
                            {gradeSummary[0] ? `${gradeSummary[0][0]} (${gradeSummary[0][1]} LP)` : '-'}
                        </p>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-1.5 xl:col-span-2">
                            <p className="text-xs font-medium text-gray-600">Cari LP / Grade</p>
                            <Input
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                placeholder="Contoh: LP000123, MK, TEI-0221-26"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-xs font-medium text-gray-600">Filter Grade</p>
                            <Select
                                value={gradeId}
                                onValueChange={(value) => {
                                    setGradeId(value);
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Semua Grade</SelectItem>
                                    {grades.map((grade) => (
                                        <SelectItem key={grade.id} value={grade.id}>
                                            {grade.code}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <p className="text-xs font-medium text-gray-600">Status Cetak</p>
                            <Select
                                value={printed}
                                onValueChange={(value) => {
                                    setPrinted(value as 'all' | 'printed' | 'unprinted');
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua</SelectItem>
                                    <SelectItem value="printed">Sudah Cetak</SelectItem>
                                    <SelectItem value="unprinted">Belum Cetak</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                        <p>
                            Menampilkan {from} - {to} dari {total} LP
                        </p>
                        <div className="flex items-center gap-2">
                            <span>Per halaman</span>
                            <Select
                                value={String(limit)}
                                onValueChange={(value) => {
                                    setLimit(Number(value));
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger className="h-8 w-20">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 md:hidden">
                    {loading ? (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                            Memuat data rak mitra order...
                        </div>
                    ) : lots.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                            Tidak ada LP pada filter ini.
                        </div>
                    ) : (
                        lots.map((lot) => (
                            <div key={lot.id} className="rounded-xl border border-gray-200 bg-white p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <p className="font-medium text-gray-900">{lot.externalId ?? lot.lotNumber}</p>
                                        <p className="text-xs text-gray-500">Lot: {lot.lotNumber}</p>
                                    </div>
                                    <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700">
                                        {lot.grade?.code ?? '-'}
                                    </span>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                                    <div>Berat: {lot.wetWeightGram.toLocaleString('id-ID')} gr</div>
                                    <div>Moisture: {(lot.moistureBps / 100).toLocaleString('id-ID')}%</div>
                                    <div>Status: {lot.status}</div>
                                    <div>Cetak: {lot.printedAt ? 'Sudah' : 'Belum'}</div>
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
                                    <th className="px-3 py-2 text-left">Nomor LP</th>
                                    <th className="px-3 py-2 text-left">Grade</th>
                                    <th className="px-3 py-2 text-left">Berat (gr)</th>
                                    <th className="px-3 py-2 text-left">Kadar Air</th>
                                    <th className="px-3 py-2 text-left">Status</th>
                                    <th className="px-3 py-2 text-left">Cetak</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">
                                            Memuat data rak mitra order...
                                        </td>
                                    </tr>
                                ) : lots.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">
                                            Tidak ada LP pada filter ini.
                                        </td>
                                    </tr>
                                ) : (
                                    lots.map((lot) => (
                                        <tr key={lot.id}>
                                            <td className="px-3 py-2">
                                                <p className="font-medium text-gray-900">{lot.externalId ?? lot.lotNumber}</p>
                                                <p className="text-xs text-gray-500">{lot.lotNumber}</p>
                                            </td>
                                            <td className="px-3 py-2 text-gray-700">{lot.grade?.code ?? '-'}</td>
                                            <td className="px-3 py-2 text-gray-700">{lot.wetWeightGram.toLocaleString('id-ID')}</td>
                                            <td className="px-3 py-2 text-gray-700">{(lot.moistureBps / 100).toLocaleString('id-ID')}%</td>
                                            <td className="px-3 py-2 text-gray-700">{lot.status}</td>
                                            <td className="px-3 py-2 text-gray-700">{lot.printedAt ? 'Sudah Cetak' : 'Belum Cetak'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-500">
                        Halaman {page} dari {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={page <= 1 || loading}
                        >
                            Sebelumnya
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={page >= totalPages || loading}
                        >
                            Berikutnya
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function MitraOrderPage() {
    return (
        <ProtectedRoute>
            <MitraOrderContent />
        </ProtectedRoute>
    );
}
