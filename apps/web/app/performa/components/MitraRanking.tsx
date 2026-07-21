'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    CalendarDays,
    Calculator,
    ChevronRight,
    Filter,
    Search,
    TrendingUp,
    Trophy,
} from 'lucide-react';
import LazyEChart from '@/components/charts/LazyEChart';
import { fmtBpsId, fmtId, stripPeriode } from '@/components/charts/chart-theme';
import { useToast } from '@/lib/toast';
import {
    getPerformaSummary,
    getPerformaTrends,
    type PerformaPeriod,
    type PerformaRow,
} from '@/lib/api';
import { personTrendOption, type PersonBjdRendemenTrend } from './personTrendChart';
import { describeTenure, isVeteranTenure } from './tenure';
import CapacityBadge from './CapacityBadge';
import { CAPACITY_BANDS, classifyCapacity, type CapacityBand } from './capacityBand';
import { capacityTrendOption } from './capacityTrendChart';

/**
 * Kapasitas mitra sebagai daftar (bukan bar chart raksasa) — jumlah anak
 * per periode bisa 200-an. Klik anak di daftar untuk melihat grafik
 * Barang Jadi (BJD) yang sudah dia kerjakan antar periode.
 */

type RankMetric = 'bjd' | 'rendemen' | 'hk';

/** Urutan tab mengikuti prioritas data: BJD dulu, lalu Rendemen, lalu HK. */
const METRICS: Array<{
    value: RankMetric;
    label: string;
    color: string;
    isBps: boolean;
    fd: number;
}> = [
    { value: 'bjd', label: 'BJD', color: '#008300', isBps: false, fd: 1 },
    { value: 'rendemen', label: 'Rendemen', color: '#2a78d6', isBps: true, fd: 1 },
    { value: 'hk', label: 'HK', color: '#eda100', isBps: false, fd: 0 },
];

const RANK_CLASS: Record<number, string> = {
    0: 'text-amber-500 font-bold',
    1: 'text-gray-500 font-bold',
    2: 'text-orange-400 font-bold',
};

/** Trend chart butuh BJD & Rendemen; HK ditambah khusus untuk kalkulator estimasi di bawah. */
type PersonTrend = PersonBjdRendemenTrend & { hk: Array<number | null> };

function readMetric(row: PerformaRow, metric: RankMetric): number | null {
    switch (metric) {
        case 'rendemen':
            return row.rendemenPctBps ?? null;
        case 'hk':
            return row.hk ?? null;
        case 'bjd':
        default:
            return row.totalBjd ?? null;
    }
}

/** Nilai harian: total ÷ HK; null bila HK kosong/nol. */
function perDayOf(
    row: PerformaRow | null,
    key: 'totalBjd' | 'totalBakuBasah',
): number | null {
    if (!row || row.hk == null || row.hk <= 0) return null;
    const value = row[key];
    return value == null ? null : value / row.hk;
}

/**
 * Sudah >20 minggu kerja (Mandiri) tapi kapasitas masih di bawah band biru
 * (< 50 g/HK) — sinyal anak ini butuh perhatian ekstra, bukan lagi wajar
 * untuk mitra yang seharusnya sudah berpengalaman.
 */
function needsCapacityWarning(row: PerformaRow): boolean {
    if (!isVeteranTenure(row.rawUserLevel, row.levelNumber)) return false;
    const gramPerHk = perDayOf(row, 'totalBjd');
    if (gramPerHk == null) return false;
    return classifyCapacity(gramPerHk)?.key !== 'blue';
}

/**
 * Rincian satu periode dipecah per hari kerja: BJD & Baku Basah dibagi HK
 * jadi angka harian; Rendemen/SP/SH tetap (rasio, tidak berubah oleh pembagian).
 */
function PerDayBreakdown({
    row,
    periodLabel,
}: {
    row: PerformaRow;
    periodLabel?: string;
}) {
    const hk = row.hk ?? null;
    const perDay = (value: number | null | undefined) =>
        hk && hk > 0 && value != null ? value / hk : null;

    const tenure = describeTenure(row.rawUserLevel, row.levelNumber);
    const bjdPerDay = perDay(row.totalBjd);

    const items: Array<{ label: string; value: string; strong?: boolean; badge?: number | null }> = [
        { label: 'Lama Kerja', value: tenure?.label ?? '–' },
        { label: 'HK', value: hk == null ? '–' : `${fmtId(hk, 0)} hari` },
        {
            label: 'BJD / hari',
            value: bjdPerDay == null ? '–' : `${fmtId(bjdPerDay, 1)} g`,
            strong: true,
            badge: bjdPerDay,
        },
        { label: 'Baku Basah / hari', value: perDay(row.totalBakuBasah) == null ? '–' : `${fmtId(perDay(row.totalBakuBasah) as number, 1)} g` },
        { label: 'Rendemen', value: fmtBpsId(row.rendemenPctBps) },
        { label: 'Susut Proses', value: fmtBpsId(row.susutProsesPctBps) },
        { label: 'Susut Hilang', value: fmtBpsId(row.susutHilangPctBps) },
    ];

    return (
        <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <CalendarDays className="h-3.5 w-3.5 text-green-600" />
                Rincian per hari kerja{periodLabel ? ` · ${periodLabel}` : ''}
            </p>
            {hk == null || hk <= 0 ? (
                <p className="text-xs text-gray-400">
                    HK tidak tersedia di periode ini, angka harian tidak bisa dihitung.
                </p>
            ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {items.map((item) => (
                        <div
                            key={item.label}
                            className={`rounded-md border px-2.5 py-1.5 ${
                                item.strong
                                    ? 'border-green-200 bg-green-50'
                                    : 'border-gray-100 bg-white'
                            }`}
                        >
                            <p className="text-[10px] uppercase tracking-wide text-gray-400">
                                {item.label}
                            </p>
                            <p
                                className={`flex items-center gap-1.5 text-sm font-bold ${
                                    item.strong ? 'text-green-700' : 'text-gray-900'
                                }`}
                            >
                                {item.value}
                                {item.badge !== undefined ? (
                                    <CapacityBadge gramPerHk={item.badge} variant="pill" />
                                ) : null}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Satu kolom periode dalam tabel perbandingan multi-periode. */
type WindowColumn = {
    period: PerformaPeriod;
    row: PerformaRow | null;
    isCurrent: boolean;
};

/** Titik warna kecil untuk legenda band kapasitas. */
function CapacityLegend() {
    return (
        <div className="flex flex-wrap items-center gap-2.5">
            {CAPACITY_BANDS.map((band) => (
                <span key={band.key} className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: band.color }} />
                    {band.label}
                </span>
            ))}
        </div>
    );
}

/**
 * Tren kapasitas (gram BJD/HK) satu mitra melintasi N periode — grafik
 * garis dengan pita latar band & tiap titik diwarnai sesuai bandnya,
 * supaya naik/turun antar periode langsung kelihatan tanpa tabel.
 */
function CapacityTrendChart({
    columns,
    loading,
    missingLabels,
}: {
    columns: WindowColumn[];
    loading: boolean;
    missingLabels: string[];
}) {
    if (loading) {
        return <div className="h-[260px] animate-pulse rounded-lg bg-gray-50" />;
    }
    if (columns.length === 0) return null;

    const points = columns.map((c) => ({
        label: stripPeriode(c.period.label),
        gramPerHk: perDayOf(c.row, 'totalBjd'),
    }));

    return (
        <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    Tren kapasitas · {columns.length} periode terakhir
                </p>
                <CapacityLegend />
            </div>

            {missingLabels.length > 0 ? (
                <p className="mb-2 rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                    Anak ini tidak punya data di: {missingLabels.join(', ')}.
                </p>
            ) : null}

            <LazyEChart option={capacityTrendOption(points)} height={220} />
        </div>
    );
}

export default function MitraRanking({
    rows,
    periods,
    periodId,
    onPeriodChange,
    periodLabel,
    onSelect,
}: {
    rows: PerformaRow[];
    /** Semua periode (urut kronologis) — untuk ganti periode & pembanding. */
    periods: PerformaPeriod[];
    periodId: string;
    onPeriodChange: (periodId: string) => void;
    periodLabel?: string;
    onSelect: (personId: string) => void;
}) {
    const toast = useToast();
    const [metric, setMetric] = useState<RankMetric>('bjd');
    const [search, setSearch] = useState('');
    /** Filter daftar anak berdasar band kapasitas gram/HK; null = semua. */
    const [bandFilter, setBandFilter] = useState<CapacityBand['key'] | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [trend, setTrend] = useState<PersonTrend | null>(null);
    const [loadingTrend, setLoadingTrend] = useState(false);
    /** Jumlah HK untuk estimasi barang jadi; default 5 hari kerja. */
    const [estDays, setEstDays] = useState(5);
    /** Jumlah periode yang dibandingkan sekaligus; 0 = semua periode. */
    const [periodWindow, setPeriodWindow] = useState(4);
    const [rowsByPeriod, setRowsByPeriod] = useState<Record<string, PerformaRow[]>>({});
    const [loadingWindow, setLoadingWindow] = useState(false);

    const active = METRICS.find((item) => item.value === metric) ?? METRICS[0];

    const currentIndex = periods.findIndex((period) => period.id === periodId);
    /** N periode terakhir yang berakhir tepat di periode aktif (urut kronologis). */
    const windowPeriods = useMemo(() => {
        if (currentIndex < 0) return [] as PerformaPeriod[];
        const size = periodWindow <= 0 ? periods.length : periodWindow;
        const start = Math.max(0, currentIndex - size + 1);
        return periods.slice(start, currentIndex + 1);
    }, [periods, currentIndex, periodWindow]);

    // Data upload baru -> daftar periode berubah -> cache jendela basi.
    useEffect(() => {
        setRowsByPeriod({});
    }, [periods]);

    useEffect(() => {
        const missing = windowPeriods.filter(
            (period) => period.id !== periodId && !(period.id in rowsByPeriod),
        );
        if (missing.length === 0) return;
        let alive = true;
        setLoadingWindow(true);
        Promise.all(
            missing.map((period) =>
                getPerformaSummary(period.id).then((data) => [period.id, data.rows] as const),
            ),
        )
            .then((entries) => {
                if (!alive) return;
                setRowsByPeriod((prev) => {
                    const next = { ...prev };
                    for (const [id, rows] of entries) next[id] = rows;
                    return next;
                });
            })
            .catch((error) => {
                if (alive) {
                    toast.error(
                        error instanceof Error ? error.message : 'Gagal memuat periode pembanding.',
                    );
                }
            })
            .finally(() => {
                if (alive) setLoadingWindow(false);
            });
        return () => {
            alive = false;
        };
        // toast stabil dari provider; tidak dijadikan dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowPeriods, periodId]);

    const sorted = useMemo(() => {
        const query = search.trim().toLowerCase();
        return rows
            .filter((row) => (query ? row.name.toLowerCase().includes(query) : true))
            .filter((row) =>
                bandFilter ? classifyCapacity(perDayOf(row, 'totalBjd'))?.key === bandFilter : true,
            )
            .map((row) => ({ row, value: readMetric(row, metric) }))
            .filter((item): item is { row: PerformaRow; value: number } => item.value !== null)
            .sort((a, b) => b.value - a.value);
    }, [rows, metric, search, bandFilter]);

    const warningCount = useMemo(
        () => rows.filter((row) => needsCapacityWarning(row)).length,
        [rows],
    );

    const selected = rows.find((row) => row.personId === selectedId) ?? null;

    const windowColumns = useMemo<WindowColumn[]>(
        () =>
            windowPeriods.map((period) => ({
                period,
                isCurrent: period.id === periodId,
                row:
                    period.id === periodId
                        ? selected
                        : (rowsByPeriod[period.id]?.find((row) => row.personId === selectedId) ?? null),
            })),
        [windowPeriods, periodId, selected, rowsByPeriod, selectedId],
    );
    const missingWindowLabels = useMemo(
        () => windowColumns.filter((c) => !c.isCurrent && !c.row).map((c) => stripPeriode(c.period.label)),
        [windowColumns],
    );

    // Default: anak peringkat teratas — juga saat ganti periode dan anak
    // yang terpilih tidak punya data di periode baru.
    useEffect(() => {
        const stillExists =
            selectedId !== null && rows.some((row) => row.personId === selectedId);
        if (!stillExists && sorted.length > 0) {
            setSelectedId(sorted[0].row.personId);
        }
    }, [rows, sorted, selectedId]);

    useEffect(() => {
        if (!selectedId) {
            setTrend(null);
            return;
        }
        let alive = true;
        setLoadingTrend(true);
        Promise.all([
            getPerformaTrends([selectedId], 'totalBjd'),
            getPerformaTrends([selectedId], 'rendemen'),
            getPerformaTrends([selectedId], 'hk'),
        ])
            .then(([bjd, rendemen, hk]) => {
                if (!alive) return;
                setTrend({
                    labels: bjd.periods.map((period) => stripPeriode(period.label)),
                    bjd: bjd.series[0]?.points ?? [],
                    rendemen: (rendemen.series[0]?.points ?? []).map((point) =>
                        point === null ? null : Math.round(point) / 100,
                    ),
                    hk: hk.series[0]?.points ?? [],
                });
            })
            .catch((error) => {
                if (alive) {
                    toast.error(
                        error instanceof Error ? error.message : 'Gagal memuat grafik BJD anak.',
                    );
                }
            })
            .finally(() => {
                if (alive) setLoadingTrend(false);
            });
        return () => {
            alive = false;
        };
        // toast stabil dari provider; tidak dijadikan dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    const displayValue = (value: number) =>
        active.isBps ? `${fmtId(value / 100, active.fd)}%` : fmtId(value, active.fd);

    const trendSummary = useMemo(() => {
        if (!trend) return null;
        const filled = trend.bjd.filter((point): point is number => point !== null);
        if (filled.length === 0) return null;

        // Rata-rata tertimbang: total BJD ÷ total HK seluruh periode aktif,
        // supaya periode dengan HK sedikit tidak mendistorsi angka harian.
        const totalBjd = filled.reduce((acc, point) => acc + point, 0);
        const totalHk = trend.hk.reduce<number>((acc, point) => acc + (point ?? 0), 0);

        return {
            total: totalBjd,
            periods: filled.length,
            avgPerHk: totalHk > 0 ? totalBjd / totalHk : null,
        };
    }, [trend]);

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-green-600" />
                    <div>
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            Kapasitas Mitra
                            <span className="font-mono text-[10px] font-normal text-gray-300">01</span>
                        </h2>
                        <p className="text-xs text-gray-400">
                            {periodLabel ? `${periodLabel} · ` : ''}
                            {rows.length} anak · klik anak untuk lihat grafik BJD-nya
                        </p>
                    </div>
                    {warningCount > 0 ? (
                        <span
                            className="ml-2 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700"
                            title="Sudah >20 minggu kerja (Mandiri) tapi kapasitas masih di bawah 50 g/HK"
                        >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {warningCount} mitra perlu perhatian
                        </span>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-green-600" />
                        <select
                            value={periodId}
                            onChange={(event) => onPeriodChange(event.target.value)}
                            disabled={periods.length === 0}
                            className="rounded-lg border border-gray-300 bg-gray-50 py-1.5 pl-8 pr-3 text-sm transition focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                            aria-label="Ganti periode"
                        >
                            {periods.map((period) => (
                                <option key={period.id} value={period.id}>
                                    {period.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Cari anak..."
                            className="w-44 rounded-lg border border-gray-300 bg-gray-50 py-1.5 pl-8 pr-3 text-sm transition focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                    </div>

                    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                        {METRICS.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => setMetric(item.value)}
                                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                    metric === item.value
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filter band kapasitas — mempersempit pencarian berdasar warna */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
                    <Filter className="h-3 w-3" />
                    Filter kapasitas:
                </span>
                <button
                    type="button"
                    onClick={() => setBandFilter(null)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        bandFilter === null
                            ? 'border-gray-800 bg-gray-800 text-white'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    Semua
                </button>
                {CAPACITY_BANDS.map((band) => (
                    <button
                        key={band.key}
                        type="button"
                        onClick={() => setBandFilter((current) => (current === band.key ? null : band.key))}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            bandFilter === band.key
                                ? 'border-transparent text-white'
                                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                        style={bandFilter === band.key ? { backgroundColor: band.color } : undefined}
                    >
                        <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: bandFilter === band.key ? '#fff' : band.color }}
                        />
                        {band.label}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {/* Daftar anak (ranking) — kartu grid, lebar penuh */}
                <div className="max-h-[360px] overflow-y-auto rounded-lg border border-gray-100 p-2">
                    {sorted.length === 0 ? (
                        <div className="flex h-[160px] items-center justify-center text-sm text-gray-400">
                            {search || bandFilter
                                ? 'Tidak ada anak cocok filter ini.'
                                : 'Tidak ada data untuk metrik ini.'}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {sorted.map((item, index) => {
                                const isSelected = item.row.personId === selectedId;
                                const warn = needsCapacityWarning(item.row);
                                return (
                                    <button
                                        key={item.row.id}
                                        type="button"
                                        onClick={() => setSelectedId(item.row.personId)}
                                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                                            isSelected
                                                ? 'border-green-300 bg-green-50/70'
                                                : warn
                                                  ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
                                                  : 'border-gray-100 hover:bg-gray-50'
                                        }`}
                                    >
                                        <span
                                            className={`w-5 shrink-0 text-right font-mono text-[10px] ${
                                                RANK_CLASS[index] ?? 'text-gray-300'
                                            }`}
                                        >
                                            {index + 1}
                                        </span>
                                        <span
                                            className="h-2 w-2 shrink-0 rounded-full"
                                            style={{ backgroundColor: item.row.colorHex }}
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-1 truncate text-xs font-medium text-gray-800">
                                                {item.row.name}
                                                {warn ? (
                                                    <AlertTriangle
                                                        className="h-3 w-3 shrink-0 text-amber-500"
                                                        aria-label="Perlu perhatian"
                                                    />
                                                ) : null}
                                            </span>
                                            <span
                                                className="block text-[10px] text-gray-400"
                                                title={item.row.rawUserLevel ?? undefined}
                                            >
                                                {describeTenure(
                                                    item.row.rawUserLevel,
                                                    item.row.levelNumber,
                                                )?.short ?? '–'}
                                            </span>
                                        </span>
                                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-gray-900">
                                            {displayValue(item.value)}
                                            <CapacityBadge
                                                gramPerHk={perDayOf(item.row, 'totalBjd')}
                                                variant="dot"
                                            />
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Grafik BJD anak terpilih — sekarang lebar penuh */}
                <div className="min-w-0 rounded-lg border border-gray-100 p-4">
                    {selected ? (
                        <>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span
                                        className="h-3 w-3 shrink-0 rounded-full"
                                        style={{ backgroundColor: selected.colorHex }}
                                    />
                                    <div className="min-w-0">
                                        <p className="flex items-center gap-2 truncate text-sm font-semibold text-gray-800">
                                            {selected.name}
                                            {(() => {
                                                const tenure = describeTenure(
                                                    selected.rawUserLevel,
                                                    selected.levelNumber,
                                                );
                                                return tenure ? (
                                                    <span
                                                        className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700"
                                                        title={selected.rawUserLevel ?? undefined}
                                                    >
                                                        {tenure.label}
                                                    </span>
                                                ) : null;
                                            })()}
                                            {needsCapacityWarning(selected) ? (
                                                <span
                                                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                                                    title="Sudah >20 minggu kerja tapi kapasitas masih di bawah 50 g/HK"
                                                >
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Perlu perhatian
                                                </span>
                                            ) : null}
                                        </p>
                                        <p className="text-[11px] text-gray-400">
                                            BJD &amp; Rendemen per periode
                                            {trendSummary
                                                ? ` · total BJD ${fmtId(trendSummary.total, 1)} · ${trendSummary.periods} periode aktif`
                                                : ''}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onSelect(selected.personId)}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-100"
                                >
                                    Detail lengkap
                                    <ChevronRight className="h-3 w-3" />
                                </button>
                            </div>

                            {/* Jumlah periode yang dibandingkan sekaligus */}
                            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                <span className="text-gray-500">Bandingkan</span>
                                <select
                                    value={periodWindow}
                                    onChange={(event) => setPeriodWindow(Number(event.target.value))}
                                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs transition focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                    aria-label="Jumlah periode dibandingkan"
                                >
                                    <option value={2}>2 periode terakhir</option>
                                    <option value={4}>4 periode terakhir</option>
                                    <option value={8}>8 periode terakhir</option>
                                    <option value={0}>Semua periode</option>
                                </select>
                            </div>

                            {windowColumns.length > 1 ? (
                                <div className="grid gap-3 lg:grid-cols-2">
                                    <CapacityTrendChart
                                        columns={windowColumns}
                                        loading={loadingWindow}
                                        missingLabels={missingWindowLabels}
                                    />
                                    {loadingTrend || !trend ? (
                                        <div className="h-[260px] animate-pulse rounded-lg bg-gray-50" />
                                    ) : (
                                        <LazyEChart
                                            option={personTrendOption(trend, selected.colorHex)}
                                            height={260}
                                        />
                                    )}
                                </div>
                            ) : (
                                <>
                                    <PerDayBreakdown row={selected} periodLabel={periodLabel} />
                                    {loadingTrend || !trend ? (
                                        <div className="h-[300px] animate-pulse rounded-lg bg-gray-50" />
                                    ) : (
                                        <LazyEChart
                                            option={personTrendOption(trend, selected.colorHex)}
                                            height={300}
                                        />
                                    )}
                                </>
                            )}

                            {trendSummary?.avgPerHk != null ? (
                                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-green-100 bg-green-50/50 px-3 py-2 text-xs text-gray-600">
                                    <Calculator className="h-3.5 w-3.5 shrink-0 text-green-600" />
                                    <span>
                                        Rata-rata{' '}
                                        <b className="text-gray-900">
                                            {fmtId(trendSummary.avgPerHk, 1)} g/HK
                                        </b>
                                    </span>
                                    <span className="text-gray-300">·</span>
                                    <span>estimasi dengan</span>
                                    <select
                                        value={estDays}
                                        onChange={(event) =>
                                            setEstDays(Number(event.target.value))
                                        }
                                        className="rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-xs focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                        aria-label="Jumlah hari kerja untuk estimasi"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                                            <option key={days} value={days}>
                                                {days} HK
                                            </option>
                                        ))}
                                    </select>
                                    <span>
                                        ≈{' '}
                                        <b className="text-green-700">
                                            {fmtId(trendSummary.avgPerHk * estDays, 1)} g
                                        </b>{' '}
                                        barang jadi
                                    </span>
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
                            Klik anak di daftar untuk melihat grafik BJD-nya.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
