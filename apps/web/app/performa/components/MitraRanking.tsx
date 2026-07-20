'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Calculator, ChevronRight, Columns2, Search, Trophy } from 'lucide-react';
import LazyEChart from '@/components/charts/LazyEChart';
import DeltaBadge from './DeltaBadge';
import { fmtBpsId, fmtId, stripPeriode } from '@/components/charts/chart-theme';
import { useToast } from '@/lib/toast';
import {
    getPerformaSummary,
    getPerformaTrends,
    type PerformaPeriod,
    type PerformaRow,
} from '@/lib/api';
import { personTrendOption, type PersonBjdRendemenTrend } from './personTrendChart';
import { describeTenure, tenureWeeks } from './tenure';

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

    const items: Array<{ label: string; value: string; strong?: boolean }> = [
        { label: 'Lama Kerja', value: tenure?.label ?? '–' },
        { label: 'HK', value: hk == null ? '–' : `${fmtId(hk, 0)} hari` },
        { label: 'BJD / hari', value: perDay(row.totalBjd) == null ? '–' : `${fmtId(perDay(row.totalBjd) as number, 1)} g`, strong: true },
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
                                className={`text-sm font-bold ${
                                    item.strong ? 'text-green-700' : 'text-gray-900'
                                }`}
                            >
                                {item.value}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Perbandingan side-by-side satu mitra di dua periode: pembanding di kiri,
 * periode aktif di kanan, Δ = aktif − pembanding.
 */
function PeriodComparison({
    row,
    compareRow,
    periodLabel,
    compareLabel,
    loading,
}: {
    row: PerformaRow;
    compareRow: PerformaRow | null;
    periodLabel?: string;
    compareLabel: string;
    loading: boolean;
}) {
    if (loading) {
        return <div className="mb-3 h-[190px] animate-pulse rounded-lg bg-gray-50" />;
    }

    const fmtG = (value: number | null) => (value === null ? '–' : `${fmtId(value, 1)} g`);
    const pct = (bps: number | null | undefined) => (bps == null ? null : bps / 100);
    const delta = (a: number | null, b: number | null) =>
        a === null || b === null ? null : a - b;

    const items: Array<{
        label: string;
        compare: string;
        current: string;
        delta: number | null;
        deltaSuffix: string;
        strong?: boolean;
    }> = [
        {
            label: 'Lama kerja',
            compare:
                describeTenure(compareRow?.rawUserLevel, compareRow?.levelNumber)?.label ??
                '–',
            current: describeTenure(row.rawUserLevel, row.levelNumber)?.label ?? '–',
            delta: delta(
                tenureWeeks(row.rawUserLevel, row.levelNumber),
                tenureWeeks(compareRow?.rawUserLevel, compareRow?.levelNumber),
            ),
            deltaSuffix: ' mgg',
        },
        {
            label: 'HK',
            compare: compareRow?.hk == null ? '–' : `${fmtId(compareRow.hk, 0)} hari`,
            current: row.hk == null ? '–' : `${fmtId(row.hk, 0)} hari`,
            delta: delta(row.hk ?? null, compareRow?.hk ?? null),
            deltaSuffix: '',
        },
        {
            label: 'BJD / hari',
            compare: fmtG(perDayOf(compareRow, 'totalBjd')),
            current: fmtG(perDayOf(row, 'totalBjd')),
            delta: delta(perDayOf(row, 'totalBjd'), perDayOf(compareRow, 'totalBjd')),
            deltaSuffix: ' g',
            strong: true,
        },
        {
            label: 'Baku Basah / hari',
            compare: fmtG(perDayOf(compareRow, 'totalBakuBasah')),
            current: fmtG(perDayOf(row, 'totalBakuBasah')),
            delta: delta(
                perDayOf(row, 'totalBakuBasah'),
                perDayOf(compareRow, 'totalBakuBasah'),
            ),
            deltaSuffix: ' g',
        },
        {
            label: 'Rendemen',
            compare: fmtBpsId(compareRow?.rendemenPctBps),
            current: fmtBpsId(row.rendemenPctBps),
            delta: delta(pct(row.rendemenPctBps), pct(compareRow?.rendemenPctBps)),
            deltaSuffix: '%',
        },
        {
            label: 'Susut Proses',
            compare: fmtBpsId(compareRow?.susutProsesPctBps),
            current: fmtBpsId(row.susutProsesPctBps),
            delta: delta(pct(row.susutProsesPctBps), pct(compareRow?.susutProsesPctBps)),
            deltaSuffix: '%',
        },
        {
            label: 'Susut Hilang',
            compare: fmtBpsId(compareRow?.susutHilangPctBps),
            current: fmtBpsId(row.susutHilangPctBps),
            delta: delta(pct(row.susutHilangPctBps), pct(compareRow?.susutHilangPctBps)),
            deltaSuffix: '%',
        },
    ];

    return (
        <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <Columns2 className="h-3.5 w-3.5 text-green-600" />
                Perbandingan per hari kerja
            </p>

            {!compareRow ? (
                <p className="mb-2 rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                    Anak ini tidak punya data di periode {compareLabel}.
                </p>
            ) : null}

            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-400">
                            <th className="py-1.5 pr-2 text-left font-medium">Metrik</th>
                            <th className="px-2 py-1.5 text-right font-medium">
                                {stripPeriode(compareLabel)}
                            </th>
                            <th className="px-2 py-1.5 text-right font-semibold text-gray-500">
                                {periodLabel ? stripPeriode(periodLabel) : 'Periode ini'}
                            </th>
                            <th className="py-1.5 pl-2 text-right font-medium">Δ</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr
                                key={item.label}
                                className={`border-b border-gray-100 last:border-0 ${
                                    item.strong ? 'bg-green-50/60' : ''
                                }`}
                            >
                                <td className="py-1.5 pr-2 text-gray-500">{item.label}</td>
                                <td className="px-2 py-1.5 text-right text-gray-600">
                                    {item.compare}
                                </td>
                                <td
                                    className={`px-2 py-1.5 text-right font-semibold ${
                                        item.strong ? 'text-green-700' : 'text-gray-900'
                                    }`}
                                >
                                    {item.current}
                                </td>
                                <td className="py-1.5 pl-2 text-right">
                                    <DeltaBadge value={item.delta} suffix={item.deltaSuffix} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
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
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [trend, setTrend] = useState<PersonTrend | null>(null);
    const [loadingTrend, setLoadingTrend] = useState(false);
    /** Jumlah HK untuk estimasi barang jadi; default 5 hari kerja. */
    const [estDays, setEstDays] = useState(5);
    /** Periode pembanding untuk tabel side-by-side; '' = tanpa pembanding. */
    const [compareId, setCompareId] = useState('');
    const [compareRows, setCompareRows] = useState<PerformaRow[] | null>(null);
    const [loadingCompare, setLoadingCompare] = useState(false);
    const compareCache = useRef(new Map<string, PerformaRow[]>());

    const active = METRICS.find((item) => item.value === metric) ?? METRICS[0];

    // Default pembanding: periode tepat sebelum periode aktif.
    useEffect(() => {
        const index = periods.findIndex((period) => period.id === periodId);
        setCompareId(index > 0 ? periods[index - 1].id : '');
    }, [periods, periodId]);

    // Data upload baru -> daftar periode berubah -> cache pembanding basi.
    useEffect(() => {
        compareCache.current.clear();
    }, [periods]);

    useEffect(() => {
        if (!compareId) {
            setCompareRows(null);
            return;
        }
        const cached = compareCache.current.get(compareId);
        if (cached) {
            setCompareRows(cached);
            return;
        }
        let alive = true;
        setLoadingCompare(true);
        getPerformaSummary(compareId)
            .then((data) => {
                if (!alive) return;
                compareCache.current.set(compareId, data.rows);
                setCompareRows(data.rows);
            })
            .catch((error) => {
                if (alive) {
                    toast.error(
                        error instanceof Error
                            ? error.message
                            : 'Gagal memuat periode pembanding.',
                    );
                }
            })
            .finally(() => {
                if (alive) setLoadingCompare(false);
            });
        return () => {
            alive = false;
        };
        // toast stabil dari provider; tidak dijadikan dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compareId]);

    const sorted = useMemo(() => {
        const query = search.trim().toLowerCase();
        return rows
            .filter((row) => (query ? row.name.toLowerCase().includes(query) : true))
            .map((row) => ({ row, value: readMetric(row, metric) }))
            .filter((item): item is { row: PerformaRow; value: number } => item.value !== null)
            .sort((a, b) => b.value - a.value);
    }, [rows, metric, search]);

    const maxValue = sorted.length > 0 ? sorted[0].value : 0;
    const selected = rows.find((row) => row.personId === selectedId) ?? null;
    const comparePeriod = periods.find((period) => period.id === compareId) ?? null;
    const compareRow =
        compareRows?.find((row) => row.personId === selectedId) ?? null;

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

            <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
                {/* Daftar anak (ranking) */}
                <div className="max-h-[400px] overflow-y-auto rounded-lg border border-gray-100">
                    {sorted.length === 0 ? (
                        <div className="flex h-[200px] items-center justify-center text-sm text-gray-400">
                            {search
                                ? `Tidak ada anak cocok "${search}".`
                                : 'Tidak ada data untuk metrik ini.'}
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-50">
                            {sorted.map((item, index) => {
                                const isSelected = item.row.personId === selectedId;
                                const barWidth =
                                    maxValue > 0
                                        ? Math.max((item.value / maxValue) * 100, 2)
                                        : 0;
                                return (
                                    <li key={item.row.id}>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedId(item.row.personId)}
                                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                                                isSelected ? 'bg-green-50/70' : 'hover:bg-gray-50'
                                            }`}
                                        >
                                            <span
                                                className={`w-6 shrink-0 text-right font-mono text-[11px] ${
                                                    RANK_CLASS[index] ?? 'text-gray-300'
                                                }`}
                                            >
                                                {index + 1}
                                            </span>
                                            <span
                                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                style={{ backgroundColor: item.row.colorHex }}
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium text-gray-800">
                                                    {item.row.name}
                                                </span>
                                                <span className="mt-0.5 block h-1 w-full rounded-full bg-gray-100">
                                                    <span
                                                        className="block h-1 rounded-full"
                                                        style={{
                                                            width: `${barWidth}%`,
                                                            backgroundColor: active.color,
                                                            opacity: 0.65,
                                                        }}
                                                    />
                                                </span>
                                            </span>
                                            <span className="shrink-0 text-right">
                                                <span className="block text-sm font-semibold text-gray-900">
                                                    {displayValue(item.value)}
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
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Grafik BJD anak terpilih */}
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

                            {/* Pilih periode pembanding untuk tabel side-by-side */}
                            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                <span className="text-gray-500">Bandingkan dengan</span>
                                <select
                                    value={compareId}
                                    onChange={(event) => setCompareId(event.target.value)}
                                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs transition focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                    aria-label="Periode pembanding"
                                >
                                    <option value="">— tanpa pembanding —</option>
                                    {periods
                                        .filter((period) => period.id !== periodId)
                                        .map((period) => (
                                            <option key={period.id} value={period.id}>
                                                {period.label}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            {compareId && comparePeriod ? (
                                <PeriodComparison
                                    row={selected}
                                    compareRow={compareRow}
                                    periodLabel={periodLabel}
                                    compareLabel={comparePeriod.label}
                                    loading={loadingCompare}
                                />
                            ) : (
                                <PerDayBreakdown row={selected} periodLabel={periodLabel} />
                            )}

                            {loadingTrend || !trend ? (
                                <div className="h-[300px] animate-pulse rounded-lg bg-gray-50" />
                            ) : (
                                <>
                                    <LazyEChart
                                        option={personTrendOption(trend, selected.colorHex)}
                                        height={300}
                                    />

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
                            )}
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
