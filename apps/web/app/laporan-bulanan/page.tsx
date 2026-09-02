'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarRange, ClipboardList, Loader2, RefreshCw, Upload } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToast } from '@/lib/toast';
import {
    getAuditMonthlyMonths,
    getAuditMonthlyPersonMetrics,
    importAuditMonthlyWorkbook,
    resetAuditMonthlyData,
    type AuditMonthlyPeriod,
    type AuditMonthlyPersonMetricsResponse,
} from '@/lib/api';
import { fmtBpsId, fmtId } from '@/components/charts/chart-theme';
import DeltaBadge from '../performa/components/DeltaBadge';
import IndividualPerformanceTable from './components/IndividualPerformanceTable';
import StickyMonthlyPeriodPicker from './components/StickyMonthlyPeriodPicker';
import MonthlyTrendChart from './components/MonthlyTrendChart';

/** Pembagi tetap untuk "Kapasitas Rata-rata / Hari": Total BJD ÷ 25 hari
 * kerja sebulan ÷ Jumlah Mitra — 25 ini konstanta tetap (bukan hari kerja
 * aktual bulan itu), sesuai keputusan produk. */
const CAPACITY_WORKING_DAYS = 25;

/** Kapasitas rata-rata per mitra per hari untuk satu bulan; null kalau bulan
 * itu belum punya rincian per mitra (totalPersons 0). */
function avgCapacityPerDay(month: AuditMonthlyPeriod | null | undefined): number | null {
    if (!month || month.totalPersons <= 0) return null;
    return month.totalBjd / CAPACITY_WORKING_DAYS / month.totalPersons;
}

/* ─── Upload card ─────────────────────────────────────────────── */

function UploadCard({ onUploaded }: { onUploaded: () => void }) {
    const toast = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [resetting, setResetting] = useState(false);

    const handleReset = async () => {
        if (!confirm('Apakah Anda yakin ingin menghapus SEMUA data laporan bulanan? Aksi ini tidak dapat dibatalkan.')) {
            return;
        }
        setResetting(true);
        try {
            const res = await resetAuditMonthlyData();
            toast.success(res.message);
            onUploaded();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal mereset data.');
        } finally {
            setResetting(false);
        }
    };

    const handleFile = async (file: File) => {
        setUploading(true);
        try {
            const result = await importAuditMonthlyWorkbook(file);
            const monthLabels = result.months.map((m) => m.label).join(', ');
            const unattributedTotal = result.months.reduce((sum, m) => sum + m.unattributedRows, 0);
            toast.success(
                `${result.months.length} bulan dimuat (${monthLabels})` +
                    (result.skippedSheets.length > 0
                        ? ` — ${result.skippedSheets.length} sheet dilewati (bukan nama bulan)`
                        : '') +
                    (unattributedTotal > 0
                        ? ` — ${unattributedTotal} baris tanpa nama (lihat catatan di Performa Individu)`
                        : ''),
            );
            onUploaded();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal mengunggah file.');
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-green-600" />
                    <div>
                        <h2 className="text-sm font-semibold text-gray-800">Upload Laporan Bulanan</h2>
                        <p className="text-xs text-gray-400">
                            File .xlsx — satu sheet = satu bulan (mis. &quot;Juni&quot;, &quot;Juli&quot;)
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={uploading || resetting}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-100 disabled:opacity-50"
                    >
                        {resetting ? 'Mereset...' : 'Reset Data'}
                    </button>
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) handleFile(file);
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading || resetting}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
                    >
                        {uploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Upload className="h-4 w-4" />
                        )}
                        {uploading ? 'Mengunggah...' : 'Pilih File'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Stat tile ───────────────────────────────────────────────── */

function StatTile({
    label,
    value,
    delta,
    deltaSuffix = '',
    accent,
}: {
    label: string;
    value: string;
    delta: number | null;
    deltaSuffix?: string;
    accent: string;
}) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
                {label}
            </p>
            <p className="mt-0.5 text-2xl font-bold text-gray-900">{value}</p>
            <div className="mt-1">
                <DeltaBadge value={delta} suffix={deltaSuffix} />
            </div>
        </div>
    );
}

/* ─── Page ────────────────────────────────────────────────────── */

/**
 * Dashboard audit BULANAN — total perusahaan per bulan (Total Baku Basah,
 * Total BJD, Rendemen), khusus role ADMIN. Terpisah total dari /performa
 * (yang publik & granularitas mingguan per-mitra): sumber datanya beda file
 * ("LAPORAN BULANAN", 1 sheet = 1 bulan), tidak ada rincian per mitra atau
 * payroll sama sekali. Lihat audit-monthly.parser.ts di backend.
 */
function LaporanBulananContent() {
    const toast = useToast();
    const [months, setMonths] = useState<AuditMonthlyPeriod[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [periodId, setPeriodId] = useState('');
    const [personData, setPersonData] = useState<AuditMonthlyPersonMetricsResponse | null>(null);
    const [personLoading, setPersonLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getAuditMonthlyMonths();
            setMonths(data);
            // Bulan terpilih (slider header + performa individu) default ke yang
            // terbaru, tapi kalau user sudah memilih bulan lain, pilihannya
            // dipertahankan selama bulan itu masih ada di daftar (mis. setelah
            // Refresh).
            setPeriodId((current) => {
                if (current && data.some((m) => m.id === current)) return current;
                return data.length > 0 ? data[data.length - 1].id : '';
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal memuat data laporan bulanan.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!periodId) {
            setPersonData(null);
            return;
        }
        let alive = true;
        setPersonLoading(true);
        getAuditMonthlyPersonMetrics(periodId)
            .then((data) => {
                if (alive) setPersonData(data);
            })
            .catch((err) => {
                if (alive) {
                    toast.error(err instanceof Error ? err.message : 'Gagal memuat performa individu.');
                }
            })
            .finally(() => {
                if (alive) setPersonLoading(false);
            });
        return () => {
            alive = false;
        };
        // toast stabil dari provider; tidak dijadikan dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodId]);

    const handleUploaded = () => {
        load();
    };

    const handleRefresh = async () => {
        try {
            await load();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Gagal memuat ulang data.');
        }
    };

    const selectedIndex = months.findIndex((m) => m.id === periodId);
    const selected = selectedIndex >= 0 ? months[selectedIndex] : null;
    const previousMonth = selectedIndex > 0 ? months[selectedIndex - 1] : null;
    const isEmpty = !loading && !error && months.length === 0;

    const capacityPerDay = avgCapacityPerDay(selected);
    const previousCapacityPerDay = avgCapacityPerDay(previousMonth);
    const deltaCapacityPerDay =
        capacityPerDay !== null && previousCapacityPerDay !== null
            ? capacityPerDay - previousCapacityPerDay
            : null;

    return (
        <div className="p-4 sm:p-8">
            <div className="mx-auto max-w-6xl space-y-5">
                {/* Header */}
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 px-5 pt-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                                <ClipboardList className="h-5 w-5 text-green-600" />
                                Laporan Bulanan (Audit)
                            </h1>
                            <p className="mt-0.5 text-xs text-gray-500">
                                {selected ? selected.label : 'Total perusahaan per bulan'}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-end gap-3">
                            <StickyMonthlyPeriodPicker
                                months={months}
                                value={periodId}
                                onChange={setPeriodId}
                                disabled={loading}
                            />

                            <button
                                type="button"
                                onClick={handleRefresh}
                                disabled={loading}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                {loading ? 'Memuat...' : 'Refresh'}
                            </button>
                        </div>
                    </div>
                </div>

                <UploadCard onUploaded={handleUploaded} />

                {error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}

                {isEmpty ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
                        <CalendarRange className="mx-auto h-8 w-8 text-gray-300" />
                        <p className="mt-3 text-sm font-medium text-gray-700">Belum ada data bulanan</p>
                        <p className="mt-1 text-xs text-gray-400">Upload file Excel untuk mulai.</p>
                    </div>
                ) : null}

                {selected ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <StatTile
                            label="Total BJD"
                            value={`${fmtId(selected.totalBjd / 1000, 1)} kg`}
                            delta={selected.deltaBjd !== null ? selected.deltaBjd / 1000 : null}
                            deltaSuffix=" kg"
                            accent="#008300"
                        />
                        <StatTile
                            label="Total Baku Basah"
                            value={`${fmtId(selected.totalBakuBasah / 1000, 1)} kg`}
                            delta={selected.deltaBakuBasah !== null ? selected.deltaBakuBasah / 1000 : null}
                            deltaSuffix=" kg"
                            accent="#2a78d6"
                        />
                        <StatTile
                            label="Rendemen"
                            value={fmtBpsId(selected.weightedRendemenPctBps)}
                            delta={selected.deltaRendemenPctBps !== null ? selected.deltaRendemenPctBps / 100 : null}
                            deltaSuffix="%"
                            accent="#1baf7a"
                        />
                        <StatTile
                            label="Kapasitas Rata-rata / Hari Per Mitra"
                            value={capacityPerDay !== null ? `${fmtId(capacityPerDay, 1)} g` : '–'}
                            delta={deltaCapacityPerDay}
                            deltaSuffix=" g"
                            accent="#eda100"
                        />
                    </div>
                ) : null}

                {months.length > 0 ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                        <h2 className="text-sm font-semibold text-gray-800">Tren Bulanan</h2>
                        <p className="mt-0.5 text-xs text-gray-400">Total BJD & Rendemen per bulan</p>
                        <div className="mt-3">
                            <MonthlyTrendChart months={months} />
                        </div>
                    </div>
                ) : null}

                {months.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left font-medium">Bulan</th>
                                        <th className="px-4 py-2.5 text-right font-medium">Total Baku Basah</th>
                                        <th className="px-4 py-2.5 text-right font-medium">Total BJD</th>
                                        <th className="px-4 py-2.5 text-right font-medium">Rendemen</th>
                                        <th className="px-4 py-2.5 text-right font-medium">Jumlah Mitra</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {[...months].reverse().map((m) => (
                                        <tr key={m.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-2.5 font-medium text-gray-800">{m.label}</td>
                                            <td className="px-4 py-2.5 text-right text-gray-700">
                                                {fmtId(m.totalBakuBasah, 1)} g
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-gray-700">
                                                {fmtId(m.totalBjd, 1)} g
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-gray-700">
                                                {fmtBpsId(m.weightedRendemenPctBps)}
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-gray-700">
                                                {fmtId(m.totalPersons)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : null}

                {months.length > 0 ? (
                    <IndividualPerformanceTable
                        key={periodId}
                        periodLabel={selected?.label}
                        data={personData}
                        loading={personLoading}
                    />
                ) : null}
            </div>
        </div>
    );
}

export default function LaporanBulananPage() {
    return (
        <ProtectedRoute allowedRoles={['admin']}>
            <LaporanBulananContent />
        </ProtectedRoute>
    );
}
