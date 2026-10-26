'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
    BarChart3,
    CalendarRange,
    Loader2,
    RefreshCw,
    Timer,
    TrendingUp,
    Upload,
    Users,
    Wallet,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/lib/toast';
import {
    getPerformaPeriodStats,
    getPerformaPeriods,
    getPerformaPersons,
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
import StickyPeriodPicker from './components/StickyPeriodPicker';
import {
    fetchPeriodExpense,
    fetchPeriodHarian,
    fetchPeriodSummary,
    hasPeriodBundle,
    invalidatePeriodSummaries,
} from './components/summaryCache';
import { formatPeriodLabel } from './components/periodLabel';
import MitraRanking from './components/MitraRanking';
import PeriodTrends from './components/PeriodTrends';
import TotalBjdModal from './components/TotalBjdModal';
import TotalUpahModal from './components/TotalUpahModal';
import TurnoverAndShifts from './components/TurnoverAndShifts';
import BandProgressionPanel from './components/BandProgressionPanel';
import HarianPayrollPanel from './components/HarianPayrollPanel';
import MitraPayrollModal from './components/MitraPayrollModal';
import PayrollExpensePanel from './components/PayrollExpensePanel';
import MitraPaymentCard from './components/MitraPaymentCard';
import MitraPinCard from './components/MitraPinCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

const DASHBOARD_TABS = ['kapasitas', 'naik-warna', 'tren', 'penggajian', 'turnover', 'upload'] as const;
type DashboardTab = (typeof DASHBOARD_TABS)[number];

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
                        <h2 className="text-sm font-semibold text-gray-800">Upload Data Performa</h2>
                        <p className="text-xs text-gray-400">
                            Untuk dashboard ini • file .xlsx — satu sheet = satu periode
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
    const { isAuthenticated, hasModuleAccess, loading: authLoading } = useAuth();
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
    /** Naik tiap data pembayaran mitra berubah -> status PIN dimuat ulang. */
    const [paymentVersion, setPaymentVersion] = useState(0);
    /** Mitra yang rincian gajinya dibuka dari tab Penggajian. */
    const [payrollPersonId, setPayrollPersonId] = useState<string | null>(null);
    const [showBjdModal, setShowBjdModal] = useState(false);
    const [showUpahModal, setShowUpahModal] = useState(false);
    const [importWarnings, setImportWarnings] = useState<Array<{
        rowNumber: number;
        rawName: string;
        column: string;
        message: string;
    }> | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    /** Tab aktif. Dulu semua panel ditumpuk dalam satu halaman sehingga
     * scroll-nya panjang sekali; sekarang satu topik per tab, dan bisa
     * ditautkan lewat "?tab=". */
    const [tab, setTab] = useState<DashboardTab>('kapasitas');
    const changeTab = useCallback((next: string) => {
        setTab(next as DashboardTab);
        const url = new URL(window.location.href);
        if (next === 'kapasitas') url.searchParams.delete('tab');
        else url.searchParams.set('tab', next);
        window.history.replaceState(window.history.state, '', url);
    }, []);
    // Dibaca sesudah mount (bukan di initializer useState) supaya render
    // pertama sama dengan hasil server dan tidak memicu hydration mismatch.
    useEffect(() => {
        const fromUrl = new URLSearchParams(window.location.search).get('tab');
        if (DASHBOARD_TABS.includes(fromUrl as DashboardTab)) setTab(fromUrl as DashboardTab);
    }, []);

    const canManage = isAuthenticated && hasModuleAccess('dashboard', 2);
    /**
     * Semua angka rupiah — total upah, rincian pembayaran per mitra, dan
     * halaman payroll — hanya untuk yang login. Pengunjung publik cuma melihat
     * kapasitas dan grafiknya.
     *
     * Ini gate TAMPILAN saja; sumber kebenarannya di API, yang membuang kolom
     * upah & PIN dari /audit-dashboard/summary untuk pemanggil anonim dan
     * menolak endpoint expense/harian tanpa login.
     */
    const canSeePayroll = isAuthenticated;

    /** Kunci cache ringkasan periode: respons untuk anonim sudah dibuang kolom
     * upah/PIN-nya, jadi tidak boleh dipakai ulang setelah login. */
    const summaryScope = canSeePayroll ? 'auth' : 'anon';

    /** Endpoint payroll sekarang menolak pemanggil anonim (403), jadi jangan
     * ditembak sama sekali kalau belum login — bukan sekadar ditelan .catch,
     * supaya tidak ada request gagal yang mengotori log tiap ganti periode.
     * Penjagaannya sekarang ada di dalam cache (scope 'anon' langsung null). */
    const fetchExpense = useCallback(
        (id: string) => fetchPeriodExpense(id, summaryScope),
        [summaryScope],
    );
    const fetchHarian = useCallback(
        (id: string) => fetchPeriodHarian(id, summaryScope),
        [summaryScope],
    );

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

    /**
     * Penanda urutan permintaan periode. Slider tidak lagi dikunci selama
     * memuat (lihat StickyPeriodPicker di bawah), jadi beberapa perpindahan
     * bisa terbang bersamaan dan yang datang duluan belum tentu yang terakhir
     * dipilih. Hanya respons dengan token terbaru yang boleh menulis state —
     * tanpa ini, hasil periode lama bisa menimpa periode yang sedang dilihat.
     */
    const requestSeq = useRef(0);

    const loadAll = useCallback(async () => {
        const seq = ++requestSeq.current;
        setLoading(true);
        setError(null);
        try {
            const periodList = await loadBase();
            // Periode terbaru = sortOrder terbesar (backend memakai default yang sama).
            const targetId = periodId || periodList[periodList.length - 1]?.id || '';
            // Periode pembanding sudah bisa ditentukan dari daftar periode, jadi
            // ikut ditembak barengan. Sebelumnya ia di-await SETELAH batch di
            // atas selesai, yang membuat tiap pemuatan butuh dua putaran jaringan.
            const targetIndex = periodList.findIndex((p) => p.id === targetId);
            const prevId = targetIndex > 0 ? periodList[targetIndex - 1].id : null;

            const [data, expenseData, harianData, prevData] = await Promise.all([
                fetchPeriodSummary(targetId, summaryScope),
                fetchExpense(targetId),
                fetchHarian(targetId),
                prevId ? fetchPeriodSummary(prevId, summaryScope) : Promise.resolve(null),
            ]);
            if (seq !== requestSeq.current) return;
            setSummary(data);
            setExpenseSummary(expenseData);
            setHarianSummary(harianData);
            setPrevSummary(prevData);

            if (!periodId && data.period) setPeriodId(data.period.id);
        } catch (err) {
            if (seq !== requestSeq.current) return;
            setError(err instanceof Error ? err.message : 'Gagal memuat data.');
        } finally {
            if (seq === requestSeq.current) setLoading(false);
        }
        // periodId sengaja tidak jadi dependency: perpindahan periode ditangani handlePeriodChange.
        // fetchExpense/fetchHarian IKUT jadi dependency supaya data payroll
        // langsung dimuat begitu status login berubah, tanpa perlu refresh manual.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadBase, fetchExpense, fetchHarian, summaryScope]);

    /**
     * Ditahan sampai status login selesai dibaca. `isAuthenticated` mulai dari
     * false lalu berubah true setelah profil terverifikasi; tanpa penjagaan ini
     * `loadAll` berganti identitas di tengah jalan dan SELURUH data halaman
     * (termasuk period-stats yang menarik semua metrik semua periode) dimuat
     * dua kali tiap kali halaman dibuka oleh pengguna yang sudah login.
     */
    useEffect(() => {
        if (authLoading) return;
        loadAll();
    }, [loadAll, authLoading]);

    const handlePeriodChange = async (nextId: string) => {
        const seq = ++requestSeq.current;
        setPeriodId(nextId);
        setError(null);

        const currentIndex = periods.findIndex((p) => p.id === nextId);
        const prevId = currentIndex > 0 ? periods[currentIndex - 1].id : null;

        // Periode yang sudah pernah dibuka tersaji dari cache tanpa jaringan —
        // jangan nyalakan indikator muat untuk itu, supaya menggeser bolak-balik
        // tidak berkedip-kedip.
        const cached =
            hasPeriodBundle(nextId, summaryScope) &&
            (!prevId || hasPeriodBundle(prevId, summaryScope));
        if (!cached) setLoading(true);

        try {
            const [data, expenseData, harianData, prevData] = await Promise.all([
                fetchPeriodSummary(nextId, summaryScope),
                fetchExpense(nextId),
                fetchHarian(nextId),
                prevId ? fetchPeriodSummary(prevId, summaryScope) : Promise.resolve(null),
            ]);
            if (seq !== requestSeq.current) return;
            setSummary(data);
            setExpenseSummary(expenseData);
            setHarianSummary(harianData);
            setPrevSummary(prevData);
        } catch (err) {
            if (seq !== requestSeq.current) return;
            setError(err instanceof Error ? err.message : 'Gagal memuat ringkasan periode.');
        } finally {
            if (seq === requestSeq.current) setLoading(false);
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

    /** Refresh manual harus benar-benar menembak server, bukan menyajikan
     * cache periode yang sudah tersimpan. */
    const handleRefresh = useCallback(() => {
        invalidatePeriodSummaries();
        loadAll();
    }, [loadAll]);

    const handleUploaded = async () => {
        const seq = ++requestSeq.current;
        // Isi periode berubah total; entri cache lama sudah tidak sahih.
        invalidatePeriodSummaries();
        setPeriodId('');
        // Data baru/di-reset -> anak yang lagi terpilih bisa sudah tidak ada lagi,
        // lepas dulu biar auto-pilih di bawah pilih ulang dari data terbaru.
        setSelectedPersonId(null);
        setLoading(true);
        try {
            const periodList = await loadBase();
            const latest = periodList[periodList.length - 1]?.id ?? '';
            const prevId = periodList.length > 1 ? periodList[periodList.length - 2].id : null;

            const [data, expenseData, harianData, prevData] = await Promise.all([
                fetchPeriodSummary(latest, summaryScope),
                fetchExpense(latest),
                fetchHarian(latest),
                prevId ? fetchPeriodSummary(prevId, summaryScope) : Promise.resolve(null),
            ]);
            if (seq !== requestSeq.current) return;
            setSummary(data);
            setExpenseSummary(expenseData);
            setHarianSummary(harianData);
            setPrevSummary(prevData);

            if (data.period) setPeriodId(data.period.id);
        } catch (err) {
            if (seq !== requestSeq.current) return;
            toast.error(err instanceof Error ? err.message : 'Gagal memuat data terbaru.');
        } finally {
            if (seq === requestSeq.current) setLoading(false);
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
        // Dipanggil juga dari tab "Lama Naik Warna", padahal detail anak ada di tab Kapasitas.
        changeTab('kapasitas');
        requestAnimationFrame(() => {
            panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [changeTab]);

    // Datang dari /performa/target-bulanan lewat "?person=<id>" -> langsung
    // pilih & gulir ke anak itu. Dibaca dari window.location langsung (bukan
    // useSearchParams) supaya tidak menambah syarat Suspense boundary untuk
    // satu kebutuhan kecil ini; URL dibersihkan sesudahnya lewat replaceState
    // murni supaya tidak memicu navigasi/refetch App Router.
    const appliedPersonParam = useRef(false);
    useEffect(() => {
        if (appliedPersonParam.current || rows.length === 0) return;
        const personId = new URLSearchParams(window.location.search).get('person');
        if (!personId) return;
        appliedPersonParam.current = true;
        if (rows.some((row) => row.personId === personId)) {
            selectPerson(personId);
        }
        window.history.replaceState(null, '', window.location.pathname);
    }, [rows, selectPerson]);

    const stats = summary?.summary ?? null;
    // Delta tile diambil dari period-stats periode yang sedang dilihat.
    const currentStat =
        periodStats.find((stat) => stat.id === summary?.period?.id) ?? null;
    const isEmpty = !loading && !error && periods.length === 0;
    // Tab dari "?tab=" yang tidak berhak dilihat (mis. upload tanpa login)
    // jatuh ke Kapasitas, bukan halaman kosong.
    const activeTab: DashboardTab =
        (tab === 'upload' && !canManage) ||
        (tab === 'turnover' && !(canManage && prevSummary)) ||
        (tab === 'penggajian' && !canSeePayroll)
            ? 'kapasitas'
            : tab;

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
                            {/* Sengaja TIDAK dikunci saat `loading`. Mengunci slider
                                selama data periode dimuat membuat tiap langkah harus
                                menunggu jaringan sebelum langkah berikutnya bisa
                                dilakukan — itu sumber rasa "lemot" yang paling terasa.
                                Respons yang datang tidak berurutan sudah dijaga oleh
                                `requestSeq` di handlePeriodChange. */}
                            <StickyPeriodPicker
                                periods={periods}
                                value={periodId}
                                onChange={handlePeriodChange}
                                disabled={periods.length === 0}
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

                    {/* Tautan ke halaman rekap. Dulu masing-masing jadi kartu selebar
                        halaman; sekarang cukup satu baris di header. */}
                    {periods.length > 0 ? (
                        <div className="flex flex-wrap gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-2.5">
                            <Link
                                href="/performa/target-bulanan"
                                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                            >
                                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                                Rekap Bulanan &middot; Target Kapasitas
                            </Link>
                            {/* Disembunyikan untuk pengunjung publik: halaman tujuannya perlu login,
                                jadi menampilkan tautannya cuma jadi jalan buntu. */}
                            {canSeePayroll && (expenseSummary || harianSummary) ? (
                                <Link
                                    href="/performa/payroll"
                                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                                >
                                    <Wallet className="h-3.5 w-3.5 text-green-600" />
                                    Payroll &amp; Biaya Borong/Bulanan
                                </Link>
                            ) : null}
                        </div>
                    ) : null}
                </div>

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
                            {canManage ? 'Upload file Excel di bagian bawah halaman untuk mulai.' : 'Data belum diunggah.'}
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
                        {canSeePayroll ? (
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
                        ) : null}
                    </div>
                ) : null}

                {/* Satu topik per tab. Dulu semua panel ditumpuk ke bawah, sehingga
                    untuk sampai ke tren/upload harus scroll melewati panel Kapasitas
                    yang panjang. */}
                {periods.length > 0 ? (
                    <Tabs value={activeTab} onValueChange={changeTab} className="space-y-4">
                        <div className="-mx-1 overflow-x-auto px-1">
                            <TabsList>
                                <TabsTrigger value="kapasitas">
                                    <BarChart3 className="h-4 w-4" aria-hidden />
                                    Kapasitas Mitra
                                </TabsTrigger>
                                <TabsTrigger value="naik-warna">
                                    <Timer className="h-4 w-4" aria-hidden />
                                    Lama Naik Warna
                                </TabsTrigger>
                                <TabsTrigger value="tren">
                                    <TrendingUp className="h-4 w-4" aria-hidden />
                                    Tren Perusahaan
                                </TabsTrigger>
                                {canSeePayroll ? (
                                    <TabsTrigger value="penggajian">
                                        <Wallet className="h-4 w-4" aria-hidden />
                                        Penggajian
                                    </TabsTrigger>
                                ) : null}
                                {canManage && prevSummary ? (
                                    <TabsTrigger value="turnover">
                                        <Users className="h-4 w-4" aria-hidden />
                                        Keluar-Masuk
                                    </TabsTrigger>
                                ) : null}
                                {canManage ? (
                                    <TabsTrigger value="upload">
                                        <Upload className="h-4 w-4" aria-hidden />
                                        Upload
                                    </TabsTrigger>
                                ) : null}
                            </TabsList>
                        </div>

                        {/* Kapasitas per anak + detail lengkap anak terpilih (ranking, grafik, warna identitas). */}
                        <TabsContent value="kapasitas">
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
                                        canSeePayroll={canSeePayroll}
                                    />
                                    <div className="mt-2 text-sm text-gray-600 bg-white border border-gray-200 px-4 py-2 rounded-lg shadow-sm inline-flex items-center gap-2">
                                        <CalendarRange className="h-4 w-4 text-indigo-500" />
                                        Total Hari Kerja Periode Ini: <span className="font-bold text-gray-900">{stats?.totalHk ?? 0} HK</span>
                                    </div>
                                </div>
                            ) : null}
                        </TabsContent>

                        {/* Berapa minggu anak merah → kuning → hijau, plus perkiraannya. */}
                        <TabsContent value="naik-warna">
                            <BandProgressionPanel
                                periods={periods}
                                summaryScope={summaryScope}
                                onSelect={selectPerson}
                            />
                        </TabsContent>

                        <TabsContent value="tren">
                            {periodStats.length > 0 ? <PeriodTrends stats={periodStats} /> : null}
                        </TabsContent>

                        {/* Gaji mitra borong/bulanan + anak harian periode ini. Sumbernya
                            data PERFORMA (Upload Data Performa), bukan data pembayaran
                            yang dilihat mitra di halaman cek. Perlu login. */}
                        {canSeePayroll ? (
                            <TabsContent value="penggajian" className="space-y-5">
                                <PayrollExpensePanel
                                    data={expenseSummary}
                                    periodLabel={formatPeriodLabel(summary?.period)}
                                    onSelect={setPayrollPersonId}
                                />
                                <HarianPayrollPanel
                                    data={harianSummary}
                                    periodLabel={formatPeriodLabel(summary?.period)}
                                />
                            </TabsContent>
                        ) : null}

                        {/* Turnover & Shifts (Khusus Manager) */}
                        {canManage && prevSummary ? (
                            <TabsContent value="turnover">
                                <TurnoverAndShifts currentSummary={summary} prevSummary={prevSummary} />
                            </TabsContent>
                        ) : null}

                        {canManage ? (
                            <TabsContent value="upload" className="space-y-4">
                                <UploadCard onUploaded={handleUploaded} onWarnings={setImportWarnings} />
                                <MitraPaymentCard onChanged={() => setPaymentVersion((v) => v + 1)} />
                                <MitraPinCard refreshKey={paymentVersion} />
                            </TabsContent>
                        ) : null}
                    </Tabs>
                ) : null}

                {/* Belum ada periode sama sekali: tab belum muncul, tapi upload tetap harus bisa. */}
                {canManage && isEmpty ? (
                    <UploadCard onUploaded={handleUploaded} onWarnings={setImportWarnings} />
                ) : null}

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
            </div>

            <TotalBjdModal
                isOpen={showBjdModal}
                onClose={() => setShowBjdModal(false)}
                summary={stats}
                periodLabel={formatPeriodLabel(summary?.period)}
                rows={rows}
            />

            <MitraPayrollModal
                isOpen={canSeePayroll && payrollPersonId !== null}
                onClose={() => setPayrollPersonId(null)}
                row={rows.find((row) => row.personId === payrollPersonId) ?? null}
                periodLabel={formatPeriodLabel(summary?.period)}
            />

            <TotalUpahModal
                isOpen={canSeePayroll && showUpahModal}
                onClose={() => setShowUpahModal(false)}
                expenseSummary={expenseSummary?.summary ?? null}
                harianSummary={harianSummary?.summary ?? null}
                performaSummary={stats}
                periodLabel={formatPeriodLabel(summary?.period)}
            />
        </div>
    );
}
