'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search, Users } from 'lucide-react';
import { fmtBpsId, fmtId } from '@/components/charts/chart-theme';
import type { AuditMonthlyPersonMetricsResponse } from '@/lib/api';

const PAGE_SIZE_OPTIONS = [30, 50, 100] as const;

/**
 * Rincian per mitra untuk bulan yang sedang dipilih di slider header
 * (MonthlyPeriodPicker) — Baku Basah, BJD, Rendemen. Dikelompokkan HANYA
 * dari kolom NAMA di sumber Excel (bukan NO. LP), jadi pekerjaan tanpa
 * NO. LP "resmi" (mis. kode batch) tetap ikut terhitung ke kapasitas orang
 * itu selama namanya terbaca — lihat komentar di audit-monthly.parser.ts.
 *
 * Komponen ini di-`key`-kan ke id bulan terpilih oleh parent, jadi search &
 * paginasi otomatis reset begitu bulan berganti tanpa perlu efek tersendiri.
 */
export default function IndividualPerformanceTable({
    periodLabel,
    data,
    loading,
}: {
    periodLabel?: string;
    data: AuditMonthlyPersonMetricsResponse | null;
    loading: boolean;
}) {
    const [search, setSearch] = useState('');
    const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        const persons = data?.persons ?? [];
        const sorted = [...persons].sort((a, b) => b.totalBjd - a.totalBjd);
        return query ? sorted.filter((p) => p.rawName.toLowerCase().includes(query)) : sorted;
    }, [data, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    // Dijaga tetap valid kalau totalPages menyusut di render ini (mis. hasil
    // pencarian tiba-tiba lebih pendek dari halaman yang sedang dibuka).
    // Reset ke halaman 1 yang sesungguhnya terjadi langsung di handler
    // onChange bulan/pencarian/ukuran halaman di bawah, bukan lewat efek.
    const currentPage = Math.min(page, totalPages);
    const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    <div>
                        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                            Performa Individu
                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                {filtered.length} mitra
                            </span>
                        </h2>
                        <p className="text-xs text-gray-400">
                            Baku Basah, BJD & Rendemen per mitra
                            {periodLabel ? ` — ${periodLabel}` : ''}
                        </p>
                    </div>
                </div>

                <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(event) => {
                            setSearch(event.target.value);
                            setPage(1);
                        }}
                        placeholder="Cari nama..."
                        className="w-48 rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-700 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                </div>
            </div>

            <div className="mt-3 overflow-x-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-10 text-gray-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">
                        {search ? 'Tidak ada mitra yang cocok.' : 'Belum ada data untuk bulan ini.'}
                    </p>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">#</th>
                                <th className="px-3 py-2 text-left font-medium">Nama</th>
                                <th className="px-3 py-2 text-right font-medium">Baku Basah</th>
                                <th className="px-3 py-2 text-right font-medium">BJD</th>
                                <th className="px-3 py-2 text-right font-medium">Rendemen</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paged.map((person, index) => (
                                <tr key={person.id} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-gray-400">
                                        {(currentPage - 1) * pageSize + index + 1}
                                    </td>
                                    <td className="px-3 py-2 font-medium text-gray-800">{person.rawName}</td>
                                    <td className="px-3 py-2 text-right text-gray-700">
                                        {fmtId(person.totalBakuBasah, 1)} g
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold text-gray-800">
                                        {fmtId(person.totalBjd, 1)} g
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-700">
                                        {fmtBpsId(person.weightedRendemenPctBps)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {!loading && filtered.length > 0 ? (
                <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        Tampilkan
                        <select
                            value={pageSize}
                            onChange={(event) => {
                                setPageSize(Number(event.target.value));
                                setPage(1);
                            }}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                        >
                            {PAGE_SIZE_OPTIONS.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                        per halaman
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>
                            Halaman {currentPage} dari {totalPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage >= totalPages}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
