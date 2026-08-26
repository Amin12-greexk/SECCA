'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
    ArrowRight,
    BarChart3,
    CalendarRange,
    Loader2,
    RefreshCw,
    Upload,
    Wallet,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/lib/toast';
import {
    getPerformaExpenseSummary,
    getPerformaHarianSummary,
    getPerformaPeriodStats,
    getPerformaPeriods,
    getPerformaPersons,
    getPerformaSummary,
    importPerformaWorkbook,
    resetPerformaData,
    type PerformaPerson,
    type PerformaPeriod,
    type PerformaPeriodStat,
    type PerformaRow,
    type PerformaSummaryResponse,
    type PerformaExpenseSummaryResponse,
    type PerformaHarianSummaryResponse,
} from '@/lib/api';
import DeltaBadge from './components/DeltaBadge';
import PeriodPicker from './components/PeriodPicker';
import { formatPeriodLabel } from './components/periodLabel';
import MitraRanking from './components/MitraRanking';
import PeriodTrends from './components/PeriodTrends';
import TotalBjdModal from './components/TotalBjdModal';
import TotalUpahModal from './components/TotalUpahModal';
import TurnoverAndShifts from './components/TurnoverAndShifts';

/* ─── Helpers ─────────────────────────────────────────────────── */

const fmt = (value: number, fd = 0) =>
    new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: fd,
        maximumFractionDigits: fd,
    }).format(value);

/** bps -> "76,0%" (1% = 100 bps). */
const fmtBps = (value: number | null | undefined, fd = 1) =>
    value === null || value === undefined ? '–' : `${fmt(value / 100, fd)}%`;

const fmtNum = (value: number | null | undefined, fd = 1) =>
    value === null || value === undefined ? '–' : fmt(value, fd);

/* ─── Stat tile ───────────────────────────────────────────────── */

function StatTile({
    label,
    value,
    hint,
    delta = null,
    deltaSuffix = '',
    accent,
    hero = false,
    onClick,
}: {
    label: string;
    value: string;
    hint?: string;
    delta?: number | null;
    deltaSuffix?: string;
    accent?: string;
    hero?: boolean;
    /** Kalau diisi, tile jadi bisa diklik (mis. buka modal rincian). */
    onClick?: () => void;
}) {
    const clickableProps = onClick
        ? {
              type: 'button' as const,
              onClick,
              title: 'Klik untuk rincian',
          }
        : {};
    const Tag = onClick ? 'button' : 'div';

    if (hero) {
        return (
            <Tag
                {...clickableProps}
                className={`relative overflow-hidden rounded-xl bg-gradient-to-br from-[#047f2b] to-emerald-500 px-4 py-3 text-white shadow-sm text-left w-full ${onClick ? 'cursor-pointer transition-transform hover:scale-[1.01] hover:shadow-md' : ''}`}
            >
                <div className="absolute -right-6 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-50/80">
                    {label}
                </p>
                <p className="mt-0.5 text-2xl font-bold">{value}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                    <DeltaBadge value={delta} suffix={deltaSuffix} tone="dark" />
                    {hint ? <p className="text-[10px] text-emerald-50/70">{hint}</p> : null}
                </div>
            </Tag>
        );
    }

    return (
        <Tag
            {...clickableProps}
            className={`rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm text-left w-full ${onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}`}
        >
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                {accent ? (
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
                ) : null}
                {label}
            </p>
            <p className="mt-0.5 text-2xl font-bold text-gray-900">{value}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
                <DeltaBadge value={delta} suffix={deltaSuffix} />
                {hint ? <p className="text-[10px] text-gray-400">{hint}</p> : null}
            </div>
        </Tag>
    );
}

/* ─── Upload card ─────────────────────────────────────────────── */

function UploadCard({
    onUploaded,
    onWarnings,
}: {
    onUploaded: () => void;
    onWarnings: (
        warnings: Array<{
            rowNumber: number;
            rawName: string;
            column: string;
            message: string;
        }> | null,
    ) => void;
}) {
    const toast = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [resetting, setResetting] = useState(false);

    const handleReset = async () => {
        if (!confirm('Apakah Anda yakin ingin menghapus SEMUA data performa? Aksi ini tidak dapat dibatalkan.')) {
            return;
        }
        setResetting(true);
        try {
            const res = await resetPerformaData();
            toast.success(res.message);
            onWarnings(null);
            onUploaded(); // this will trigger reload of data
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal mereset data.');
        } finally {
            setResetting(false);
        }
    };

    const handleFile = async (file: File) => {
        setUploading(true);
        try {
            const result = await importPerformaWorkbook(file);
            const replaced = result.periods.filter((period) => period.replaced).length;
            toast.success(
                `${result.totalSheets} periode • ${result.totalRows} baris dimuat` +
                    (replaced > 0 ? ` (${replaced} periode diperbarui)` : ''),
            );
            if (result.warnings && result.warnings.length > 0) {
                onWarnings(result.warnings);
            } else {
                onWarnings(null);
            }
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
                        <h2 className="text-sm font-semibold text-gray-800">Upload Data</h2>
                        <p className="text-xs text-gray-400">File .xlsx — satu sheet = satu periode</p>
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

/* ─── Page ────────────────────────────────────────────────────── */

/**
 * Dashboard performa SENGAJA bisa dibuka tanpa login — halaman awal `/` punya
 * tombol "Buka Dashboard" yang mengarah ke sini untuk pengunjung yang belum
 * masuk. Jangan bungkus dengan ProtectedRoute.
 *
 * Pembedaannya ada di `canManage` (login + dashboard level 2), yang menentukan
 * upload, reset, dan panel Turnover & Shift — bukan di akses halamannya.
 */
export default function PerformaPage() {
    const { isAuthenticated, hasModuleAccess } = useAuth();
    const toast = useToast();

    const [periods, setPeriods] = useState<PerformaPeriod[]>([]);
    const [persons, setPersons] = useState<PerformaPerson[]>([]);
    const [periodStats, setPeriodStats] = useState<PerformaPeriodStat[]>([]);
    const [periodId, setPeriodId] = useState('');
    const [summary, setSummary] = useState<PerformaSummaryResponse | null>(null);
    const [prevSummary, setPrevSummary] = useState<PerformaSummaryResponse | null>(null);
    const [expenseSummary, setExpenseSummary] = useState<PerformaExpenseSummaryResponse | null>(null);
    const [harianSummary, setHarianSummary] = useState<PerformaHarianSummaryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [showBjdModal, setShowBjdModal] = useState(false);
    const [showUpahModal, setShowUpahModal] = useState(false);
    const [importWarnings, setImportWarnings] = useState<Array<{
        rowNumber: number;
        rawName: string;
        column: string;
        message: string;
    }> | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const canManage = isAuthenticated && hasModuleAccess('dashboard', 2);

    const loadBase = useCallback(async () => {
        const [periodList, personList, statsResponse] = await Promise.all([
            getPerformaPeriods(),
            getPerformaPersons(),
            getPerformaPeriodStats(),
        ]);
        setPeriods(periodList);
        setPersons(personList);
        setPeriodStats(statsResponse.periods);
        return periodList;
    }, []);

    const loadAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const periodList = await loadBase();
            // Periode terbaru = sortOrder terbesar (backend memakai default yang sama).
            const targetId = periodId || periodList[periodList.length - 1]?.id || '';
            const [data, expenseData, harianData] = await Promise.all([
                getPerformaSummary(targetId || undefined),
                getPerformaExpenseSummary(targetId || undefined).catch(() => null),
                getPerformaHarianSummary(targetId || undefined).catch(() => null),
            ]);
            setSummary(data);
            setExpenseSummary(expenseData);
            setHarianSummary(harianData);

            const currentIndex = periodList.findIndex(p => p.id === (data.period?.id ?? targetId));
            const prevId = currentIndex > 0 ? periodList[currentIndex - 1].id : null;
            if (prevId) {
                setPrevSummary(await getPerformaSummary(prevId));
            } else {
                setPrevSummary(null);
            }

            if (!periodId && data.period) setPeriodId(data.period.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal memuat data.');
        } finally {
            setLoading(false);
        }
        // periodId sengaja tidak jadi dependency: perpindahan periode ditangani handlePeriodChange.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadBase]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const handlePeriodChange = async (nextId: string) => {
        setPeriodId(nextId);
        setLoading(true);
        setError(null);
        try {
            const [data, expenseData, harianData] = await Promise.all([
                getPerformaSummary(nextId || undefined),
                getPerformaExpenseSummary(nextId || undefined).catch(() => null),
                getPerformaHarianSummary(nextId || undefined).catch(() => null),
            ]);
            setSummary(data);
            setExpenseSummary(expenseData);
            setHarianSummary(harianData);

            const currentIndex = periods.findIndex(p => p.id === (data.period?.id ?? nextId));
            const prevId = currentIndex > 0 ? periods[currentIndex - 1].id : null;
            if (prevId) {
                setPrevSummary(await getPerformaSummary(prevId));
            } else {
                setPrevSummary(null);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal memuat ringkasan periode.');
        } finally {
            setLoading(false);
        }
    };

    const handleColorSaved = (updated: PerformaPerson) => {
        setPersons((current) =>
            current.map((person) =>
                person.id === updated.id
                    ? { ...person, colorHex: updated.colorHex, hasCustomColor: updated.hasCustomColor }
                    : person,
            ),
        );
        setSummary((current) =>
            current
                ? {
                      ...current,
                      rows: current.rows.map((row) =>
                          row.personId === updated.id ? { ...row, colorHex: updated.colorHex } : row,
                      ),
                  }
                : current,
        );
    };

    const handleUploaded = async () => {
        setPeriodId('');
        // Data baru/di-reset -> anak yang lagi terpilih bisa sudah tidak ada lagi,
        // lepas dulu biar auto-pilih di bawah pilih ulang dari data terbaru.
        setSelectedPersonId(null);
        setLoading(true);
        try {
            const periodList = await loadBase();
            const latest = periodList[periodList.length - 1]?.id;
            const [data, expenseData, harianData] = await Promise.all([
                getPerformaSummary(latest),
                getPerformaExpenseSummary(latest).catch(() => null),
                getPerformaHarianSummary(latest).catch(() => null),
            ]);
            setSummary(data);
            setExpenseSummary(expenseData);
            setHarianSummary(harianData);

            const prevId = periodList.length > 1 ? periodList[periodList.length - 2].id : null;
            if (prevId) {
                setPrevSummary(await getPerformaSummary(prevId));
            } else {
                setPrevSummary(null);
            }

            if (data.period) setPeriodId(data.period.id);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Gagal memuat data terbaru.');
        } finally {
            setLoading(false);
        }
    };

    // "Cabut Rumah" (cabut bulu di rumah, di luar pabrik) tidak punya konsep
    // BJD/kapasitas/target sama sekali — disaring dari ranking kapasitas di sini
    // supaya tidak nongol sebagai baris "0 g/hk" yang membingungkan. Tetap ikut
    // di payroll (Upah Borong) karena upahnya tetap biaya perusahaan yang sah.
    const rows = useMemo(
        () => (summary?.rows ?? []).filter((row) => !/cabut rumah/i.test(row.rawUserLevel ?? '')),
        [summary],
    );

    // Auto-pilih anak dengan BJD tertinggi (produksi + reprocess digabung, sama seperti
    // urutan ranking di MitraRanking) supaya panel individu tidak kosong.
    useEffect(() => {
        if (!selectedPersonId && rows.length > 0) {
            const combinedBjd = (row: PerformaRow) => (row.totalBjd ?? 0) + (row.reprocessBjd ?? 0);
            const top = [...rows].sort((a, b) => combinedBjd(b) - combinedBjd(a))[0];
            setSelectedPersonId(top.personId);
        }
    }, [rows, selectedPersonId]);

    /** Klik dari ranking/tabel: pilih anak lalu gulir ke panelnya. */
    const selectPerson = useCallback((personId: string) => {
        setSelectedPersonId(personId);
        requestAnimationFrame(() => {
            panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, []);

    const stats = summary?.summary ?? null;
    // Delta tile diambil dari period-stats periode yang sedang dilihat.
    const currentStat =
        periodStats.find((stat) => stat.id === summary?.period?.id) ?? null;
    const isEmpty = !loading && !error && periods.length === 0;

    // Total Upah gabungan = mitra borong/bulanan + anak harian, supaya kartu
    // ini mencerminkan biaya tenaga kerja perusahaan seutuhnya, bukan cuma mitra.
    const totalUpahMitra =
        expenseSummary?.summary?.totalNetWageRp ??
        (expenseSummary?.summary?.totalBorongWageRp ??
            expenseSummary?.summary?.totalPieceworkWageRp ??
            0) + (expenseSummary?.summary?.totalBulananWageRp ?? 0);
    const totalUpahHarian = harianSummary?.summary?.totalUpahBersihRp ?? 0;
    const totalUpahGabungan = totalUpahMitra + totalUpahHarian;

    return (
        <div className="p-4 sm:p-8">
            <div className="mx-auto max-w-6xl space-y-5">
                {/* Header */}
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 px-5 pt-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                                <BarChart3 className="h-5 w-5 text-green-600" />
                                Dashboard Performa
                            </h1>
                            <p className="mt-0.5 text-xs text-gray-500">
                                {summary?.period ? formatPeriodLabel(summary.period) : 'Data periode'}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-end gap-3">
                            <PeriodPicker
                                periods={periods}
                                value={periodId}
                                onChange={handlePeriodChange}
                                disabled={loading}
                            />

                            <button
                                type="button"
                                onClick={loadAll}
                                disabled={loading}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                {loading ? 'Memuat...' : 'Refresh'}
                            </button>
                        </div>
                    </div>
                </div>

                {canManage ? <UploadCard onUploaded={handleUploaded} onWarnings={setImportWarnings} /> : null}

                {importWarnings && importWarnings.length > 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        <div className="flex items-center justify-between">
                            <div className="font-semibold flex items-center gap-1.5">
                                ⚠️ Perhatian: {importWarnings.length} formula Excel belum ter-recalculate di file sumber
                            </div>
                            <button 
                                onClick={() => setImportWarnings(null)}
                                className="text-xs text-amber-600 hover:text-amber-900 font-medium underline"
                            >
                                Tutup
                            </button>
                        </div>
                        <p className="mt-1 text-xs text-amber-700">
                            Beberapa sel pada kolom payroll (mis. Subsidi, Premi, Potongan, Gaji/Upah Bersih) tidak memiliki cached value (mungkin mereferensi file/workbook luar yang tidak terhubung).
                        </p>
                        <ul className="mt-2 list-disc pl-5 space-y-0.5 text-xs text-amber-700">
                            {importWarnings.slice(0, 5).map((warn, i) => (
                                <li key={i}>
                                    Baris {warn.rowNumber} ({warn.rawName}) • Kolom: {warn.column === 'netWage' ? 'Upah Bersih' : warn.column === 'pieceworkWage' ? 'Upah Borong' : warn.column === 'subsidy' ? 'Subsidi' : warn.column === 'premium' ? 'Premi' : warn.column === 'mealAllowance' ? 'Uang Makan' : warn.column === 'deduction' ? 'Potongan' : warn.column}
                                </li>
                            ))}
                            {importWarnings.length > 5 ? (
                                <li className="list-none font-medium mt-1">
                                    + {importWarnings.length - 5} sel lainnya...
                                </li>
                            ) : null}
                        </ul>
                        <div className="mt-2 text-xs font-semibold">
                            SOP: Buka file di Excel → tekan <kbd className="bg-amber-100 px-1 py-0.5 rounded border border-amber-300">Ctrl+Alt+F9</kbd> untuk full recalculate → simpan ulang file, lalu upload kembali file tersebut.
                        </div>
                    </div>
                ) : null}

                {error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}

                {isEmpty ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
                        <CalendarRange className="mx-auto h-8 w-8 text-gray-300" />
                        <p className="mt-3 text-sm font-medium text-gray-700">Belum ada data periode</p>
                        <p className="mt-1 text-xs text-gray-400">
                            {canManage ? 'Upload file Excel untuk mulai.' : 'Data belum diunggah.'}
                        </p>
                    </div>
                ) : null}

                {/* Ringkasan Summary: 4 KPI produksi inti + 1 total upah gabungan.
                    Rincian Borong/Bulanan/Subsidi/dst ada di panel Payroll & Biaya di bawah — tidak diulang di sini. */}
                {stats ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        <StatTile
                            hero
                            label="Total BJD"
                            value={fmtNum(stats.totalBjdWithReprocess ?? stats.totalBjd)}
                            hint={`Rendemen ${fmtBps(stats.weightedRendemenPctBps)}`}
                            delta={currentStat?.deltaBjdWithReprocess ?? currentStat?.deltaBjd ?? null}
                            onClick={() => setShowBjdModal(true)}
                        />
                        <StatTile
                            label="Total Baku Basah"
                            value={fmtNum(stats.totalBakuBasah)}
                            hint={`SP ${fmtBps(stats.weightedSusutProsesPctBps)} · SH ${fmtBps(stats.weightedSusutHilangPctBps)}`}
                            delta={currentStat?.deltaBakuBasah ?? null}
                            accent="#2a78d6"
                        />
                        <StatTile
                            label="Total Mitra"
                            value={fmt(stats.totalPeople)}
                            hint="Pekerja aktif"
                            accent="#4a3aa7"
                        />
                        <StatTile
                            label="Total HK"
                            value={`${fmt(stats.totalHk)} HK`}
                            hint={`Rata-rata ${(stats.totalHk / (stats.totalPeople || 1)).toFixed(1)} HK/mitra`}
                            delta={currentStat?.deltaHk ?? null}
                            accent="#eda100"
                        />
                        <StatTile
                            label="Total Upah"
                            value={new Intl.NumberFormat('id-ID', {
                                style: 'currency',
                                currency: 'IDR',
                                maximumFractionDigits: 0,
                                notation: 'compact',
                            }).format(totalUpahGabungan)}
                            hint="Klik untuk upah per kg"
                            accent="#1baf7a"
                            onClick={() => setShowUpahModal(true)}
                        />
                    </div>
                ) : null}

                {/* 01 — Kapasitas per anak + detail lengkap anak terpilih (ranking, grafik, warna identitas
                    semua digabung jadi satu panel di sini — sebelumnya tersebar di 2 tempat terpisah). */}
                {rows.length > 0 ? (
                    <div ref={panelRef} className="scroll-mt-24">
                        <MitraRanking
                            rows={rows}
                            periods={periods}
                            periodId={periodId}
                            periodLabel={formatPeriodLabel(summary?.period)}
                            onSelect={selectPerson}
                            externalSelectedId={selectedPersonId}
                            persons={persons}
                            canManage={canManage}
                        />
                        <div className="mt-2 text-sm text-gray-600 bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm inline-flex items-center gap-2">
                            <CalendarRange className="h-4 w-4 text-indigo-500" />
                            Total Hari Kerja Periode Ini: <span className="font-bold text-gray-900">{stats?.totalHk ?? 0} HK</span>
                        </div>
                    </div>
                ) : null}

                {/* Payroll & Biaya Perusahaan (mitra borong/bulanan + anak harian) dipindah ke
                    halaman sendiri supaya dashboard ini tetap ringkas — cukup link ke sana. */}
                {expenseSummary || harianSummary ? (
                    <Link
                        href="/performa/payroll"
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm transition-colors hover:bg-gray-50"
                    >
                        <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            <Wallet className="h-4 w-4 text-green-600" />
                            Payroll &amp; Biaya Borong/Bulanan
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                            Lihat rincian lengkap
                            <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                    </Link>
                ) : null}

                {/* Turnover & Shifts (Khusus Manager) */}
                {canManage && prevSummary && (
                    <TurnoverAndShifts currentSummary={summary} prevSummary={prevSummary} />
                )}

                {/* 02 — Tren antar periode (perusahaan) */}
                {periodStats.length > 0 ? <PeriodTrends stats={periodStats} /> : null}
            </div>

            <TotalBjdModal
                isOpen={showBjdModal}
                onClose={() => setShowBjdModal(false)}
                summary={stats}
                periodLabel={formatPeriodLabel(summary?.period)}
                rows={rows}
            />

            <TotalUpahModal
                isOpen={showUpahModal}
                onClose={() => setShowUpahModal(false)}
                expenseSummary={expenseSummary?.summary ?? null}
                harianSummary={harianSummary?.summary ?? null}
                performaSummary={stats}
                periodLabel={formatPeriodLabel(summary?.period)}
            />
        </div>
    );
}
