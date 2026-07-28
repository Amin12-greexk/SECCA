'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import {
    getManagerGradeUsage,
    getManagerCapacity,
    type GradeUsageResponse,
    type CapacityResponse,
    type GradeUsageRow,
} from '@/lib/api';

/* ─── Helpers ─────────────────────────────────────────────────── */

const fmt = (value: number, fd = 0) =>
    new Intl.NumberFormat('id-ID', { minimumFractionDigits: fd, maximumFractionDigits: fd }).format(value);

const fmtDate = (v: string) =>
    new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' }).format(new Date(v));

const fmtDateFull = (v: string) =>
    new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: '2-digit' }).format(new Date(v));

const fmtTime = (v: Date) =>
    new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(v);

function getDefaultRange() {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 90);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function useAnimatedNumber(target: number, duration = 700) {
    const [value, setValue] = useState(target);
    const valueRef = useRef(target);

    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        const from = valueRef.current;
        if (from === target) return;

        let rafId = 0;
        let start: number | null = null;

        const tick = (timestamp: number) => {
            if (start == null) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const next = from + (target - from) * eased;
            valueRef.current = next;
            setValue(next);

            if (progress < 1) {
                rafId = window.requestAnimationFrame(tick);
            }
        };

        rafId = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(rafId);
    }, [target, duration]);

    return value;
}

/* ─── Palette ─────────────────────────────────────────────────── */

const DONUT_COLORS = [
    '#059669', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444',
    '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#f97316',
    '#06b6d4', '#a855f7', '#d946ef', '#22d3ee', '#fb923c',
];

/* ─── SVG Area Chart ──────────────────────────────────────────── */

function AreaChart({ data, height = 300 }: {
    data: { label: string; value: number; sublabel?: string }[];
    height?: number;
}) {
    if (data.length === 0) return null;

    return (
        <div className="w-full rounded-lg border border-gray-100 bg-gradient-to-b from-white to-green-50/40 p-2">
            <LineChart
                height={height}
                margin={{ top: 24, right: 20, bottom: 54, left: 64 }}
                xAxis={[
                    {
                        scaleType: 'point',
                        data: data.map((point) => point.label),
                        tickLabelStyle: { fontSize: 10, fill: '#6b7280' },
                    },
                ]}
                yAxis={[
                    {
                        min: 0,
                        tickLabelStyle: { fontSize: 10, fill: '#9ca3af' },
                        valueFormatter: (value: number | null) => fmt(Number(value ?? 0)),
                    },
                ]}
                series={[
                    {
                        id: 'weekly-total',
                        label: 'Total Gram',
                        data: data.map((point) => point.value),
                        valueFormatter: (value) => `${fmt(Number(value ?? 0), 1)} gr`,
                        area: true,
                        color: '#059833',
                        curve: 'monotoneX',
                        showMark: true,
                    },
                ]}
                sx={{
                    '& .MuiAreaElement-root': {
                        fill: 'rgba(5, 152, 51, 0.18)',
                    },
                    '& .MuiLineElement-root': {
                        strokeWidth: 3,
                    },
                    '& .MuiMarkElement-root': {
                        stroke: '#059833',
                        fill: '#fff',
                    },
                }}
            />
        </div>
    );
}

/* ─── SVG Donut Chart ─────────────────────────────────────────── */

function DonutChart({ rows, total, title }: {
    rows: GradeUsageRow[];
    total: number;
    title: string;
}) {
    const animatedTotal = useAnimatedNumber(total, 650);

    const normalizedRows = useMemo(() => {
        if (rows.length === 0 || total <= 0) return [];
        const sorted = [...rows].sort((a, b) => b.gram - a.gram);
        if (sorted.length <= 6) return sorted;
        const head = sorted.slice(0, 6);
        const tail = sorted.slice(6);
        const otherGram = tail.reduce((sum, row) => sum + row.gram, 0);
        const otherLp = tail.reduce((sum, row) => sum + row.lpCount, 0);
        return [
            ...head,
            {
                key: 'Lainnya',
                gram: Math.round(otherGram * 100) / 100,
                percentage: Math.round((otherGram / total) * 10000) / 100,
                lpCount: otherLp,
            },
        ];
    }, [rows, total]);

    const segments = useMemo(
        () =>
            normalizedRows.map((row, index) => ({
                ...row,
                id: index,
                value: row.gram,
                label: row.key,
                color: DONUT_COLORS[index % DONUT_COLORS.length],
            })),
        [normalizedRows],
    );

    return (
        <div className="flex flex-col items-center">
            {title ? <p className="mb-2 text-sm font-semibold text-gray-700">{title}</p> : null}
            {rows.length === 0 ? (
                <div className="flex h-[230px] items-center justify-center text-sm text-gray-400">
                    Tidak ada data
                </div>
            ) : (
                <>
                    <div className="relative">
                        <PieChart
                            height={250}
                            series={[
                                {
                                    data: segments,
                                    innerRadius: 70,
                                    outerRadius: 108,
                                    paddingAngle: 1.6,
                                    cornerRadius: 5,
                                    highlighted: { additionalRadius: 6 },
                                    faded: { color: 'rgba(107, 114, 128, 0.15)' },
                                    valueFormatter: (item) => {
                                        const row = segments.find((segment) => segment.id === item.id);
                                        if (!row) return '';
                                        return `${fmt(row.gram, 1)} gr - ${row.lpCount} LP - ${row.percentage.toFixed(1)}%`;
                                    },
                                },
                            ]}
                            hideLegend
                            sx={{
                                '& .MuiChartsTooltip-paper': {
                                    borderRadius: '10px',
                                    border: '1px solid rgba(17, 24, 39, 0.08)',
                                },
                            }}
                        />
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <p className="text-lg font-bold text-gray-900">{fmt(animatedTotal, 0)}</p>
                            <p className="text-[10px] text-gray-500">Total periode</p>
                            <p className="text-[10px] text-gray-400">gram</p>
                        </div>
                    </div>

                    <div className="mt-2 w-full max-w-[420px] space-y-2">
                        {segments.map((segment) => (
                            <div key={segment.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
                                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                                <div className="min-w-0">
                                    <div className="truncate text-gray-700">{segment.key}</div>
                                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                                        <div
                                            className="h-full rounded-full"
                                            style={{
                                                width: `${Math.min(segment.percentage, 100)}%`,
                                                backgroundColor: segment.color,
                                                transition: 'width 450ms ease',
                                            }}
                                        />
                                    </div>
                                </div>
                                <span className="text-right text-gray-500">{segment.percentage.toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

/* --- Main Component -------------------------------------------- */

export default function ManagerAnalytics() {
    const defaults = getDefaultRange();
    const [from, setFrom] = useState(defaults.from);
    const [to, setTo] = useState(defaults.to);
    const [groupBy, setGroupBy] = useState<'combo' | 'shape' | 'feather' | 'color'>('combo');
    const [metric, setMetric] = useState<'initial' | 'dry'>('initial');

    const [gradeUsage, setGradeUsage] = useState<GradeUsageResponse | null>(null);
    const [capacity, setCapacity] = useState<CapacityResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

    /* Derived donut data by combo, feather, and color */
    const [comboUsage, setComboUsage] = useState<GradeUsageResponse | null>(null);
    const [featherUsage, setFeatherUsage] = useState<GradeUsageResponse | null>(null);
    const [colorUsage, setColorUsage] = useState<GradeUsageResponse | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const reqs = {
                capacity: getManagerCapacity({ from, to }),
                tableUsage: getManagerGradeUsage({ from, to, groupBy, metric }),
                combo: groupBy === 'combo' ? null : getManagerGradeUsage({ from, to, groupBy: 'combo', metric }),
                feather: groupBy === 'feather' ? null : getManagerGradeUsage({ from, to, groupBy: 'feather', metric }),
                color: groupBy === 'color' ? null : getManagerGradeUsage({ from, to, groupBy: 'color', metric }),
            };

            const [cap, tableUsage, comboRes, featherRes, colorRes] = await Promise.all([
                reqs.capacity,
                reqs.tableUsage,
                reqs.combo,
                reqs.feather,
                reqs.color,
            ]);

            setCapacity(cap);
            setGradeUsage(tableUsage);
            
            setComboUsage(reqs.combo === null ? tableUsage : comboRes);
            setFeatherUsage(reqs.feather === null ? tableUsage : featherRes);
            setColorUsage(reqs.color === null ? tableUsage : colorRes);

            setLastUpdatedAt(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal memuat data analitik.');
        } finally {
            setLoading(false);
        }
    }, [from, to, groupBy, metric]);

    useEffect(() => { loadData(); }, [loadData]);

    const animatedTotalGram = useAnimatedNumber(capacity?.summary.totalGram ?? 0, 700);
    const animatedTotalLp = useAnimatedNumber(capacity?.summary.totalLp ?? 0, 700);
    const animatedAvgGram = useAnimatedNumber(capacity?.summary.avgGramPerLp ?? 0, 700);
    const animatedWeeklyCount = useAnimatedNumber(capacity?.weekly.length ?? 0, 650);
    const animatedUsageTotal = useAnimatedNumber(gradeUsage?.totalGram ?? 0, 700);

    return (
        <div className="space-y-5">

            {/* ── Header + Filters ──────────────────────────────── */}
            <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                            Analitik Manager
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">Kapasitas & Penggunaan Baku</p>
                        <div className="mt-1 inline-flex items-center gap-2 text-[11px] text-gray-500">
                            <span className={`h-2 w-2 rounded-full ${loading ? 'animate-pulse bg-amber-500' : 'bg-emerald-500'}`} />
                            {loading
                                ? 'Memperbarui data...'
                                : lastUpdatedAt
                                    ? `Realtime • update ${fmtTime(lastUpdatedAt)}`
                                    : 'Belum ada update'}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={loadData}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
                        {loading ? 'Memuat...' : 'Refresh'}
                    </button>
                </div>

                {/* Filter row */}
                <div className="px-5 pb-4 flex flex-wrap gap-3 items-end border-t border-gray-100 pt-3">
                    <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Dari</label>
                        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none transition" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Sampai</label>
                        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none transition" />
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Grup</label>
                        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
                            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none transition">
                            <option value="combo">Combo (Bentuk/Bulu/Warna)</option>
                            <option value="shape">Bentuk</option>
                            <option value="feather">Bulu</option>
                            <option value="color">Warna</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1 uppercase tracking-wide">Metrik</label>
                        <select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)}
                            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none transition">
                            <option value="initial">Berat Awal</option>
                            <option value="dry">Berat Kering</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-200 border-t-green-600" />
                    <span className="text-sm text-gray-500">Memuat data analitik...</span>
                </div>
            )}

            {!loading && !error && gradeUsage && capacity && (
                <>
                    {/* ── Capacity Area Chart Card ──────────────────── */}
                    <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-800">Kapasitas Pecah Bon</h3>
                                <p className="text-xs text-gray-400">Mingguan</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                    <span className="w-2 h-2 rounded-full bg-green-600" /> Total Gram
                                </span>
                            </div>
                        </div>

                        {/* Summary row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 mt-3">
                            <div className="rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 px-4 py-3">
                                <p className="text-[11px] font-medium text-green-700 uppercase tracking-wide">Total Gram</p>
                                <p className="text-xl font-bold text-green-900 mt-0.5">{fmt(animatedTotalGram, 1)}</p>
                            </div>
                            <div className="rounded-lg bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-100 px-4 py-3">
                                <p className="text-[11px] font-medium text-blue-700 uppercase tracking-wide">Total LP</p>
                                <p className="text-xl font-bold text-blue-900 mt-0.5">{fmt(animatedTotalLp)}</p>
                            </div>
                            <div className="rounded-lg bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-100 px-4 py-3">
                                <p className="text-[11px] font-medium text-amber-700 uppercase tracking-wide">Rata-rata/LP</p>
                                <p className="text-xl font-bold text-amber-900 mt-0.5">{fmt(animatedAvgGram, 1)} gr</p>
                            </div>
                            <div className="rounded-lg bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100 px-4 py-3">
                                <p className="text-[11px] font-medium text-purple-700 uppercase tracking-wide">Minggu</p>
                                <p className="text-xl font-bold text-purple-900 mt-0.5">{fmt(animatedWeeklyCount)}</p>
                            </div>
                        </div>

                        {/* Area chart */}
                        {capacity.weekly.length > 0 ? (
                            <AreaChart
                                data={capacity.weekly.map((w) => ({
                                    label: fmtDateFull(w.weekStart),
                                    value: w.totalGram,
                                    sublabel: `${w.lpCount} LP`,
                                }))}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-40 text-sm text-gray-400">
                                Tidak ada data kapasitas.
                            </div>
                        )}

                        {/* Bucket distribution */}
                        {capacity.buckets.some((b) => b.lpCount > 0) && (
                            <div className="mt-5 pt-4 border-t border-gray-100">
                                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Distribusi Berat LP</p>
                                <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
                                    {capacity.buckets.map((bucket) => {
                                        const maxLp = Math.max(...capacity.buckets.map((b) => b.lpCount), 1);
                                        const pct = (bucket.lpCount / maxLp) * 100;
                                        return (
                                            <div key={bucket.label} className="relative rounded-lg border border-gray-200 p-3 text-center overflow-hidden">
                                                <div
                                                    className="absolute bottom-0 left-0 right-0 bg-green-50 transition-all duration-500"
                                                    style={{ height: `${pct}%` }}
                                                />
                                                <div className="relative">
                                                    <p className="text-xs text-gray-500 font-medium">
                                                        {bucket.label === 'other' ? 'Lainnya' : `${bucket.label} gr`}
                                                    </p>
                                                    <p className="text-lg font-bold text-gray-900 mt-0.5">{bucket.lpCount}</p>
                                                    <p className="text-[10px] text-gray-400">LP</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Donut Charts Row ──────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {/* Combo Donut */}
                        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-800">Grade Chart</span>
                                    <span className="text-[10px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Combo</span>
                                </div>
                            </div>
                            <DonutChart
                                rows={comboUsage?.rows ?? []}
                                total={comboUsage?.totalGram ?? 0}
                                title=""
                            />
                        </div>

                        {/* Feather (Bulu) Donut */}
                        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-800">Raw Grade Chart</span>
                                    <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Bulu</span>
                                </div>
                            </div>
                            <DonutChart
                                rows={featherUsage?.rows ?? []}
                                total={featherUsage?.totalGram ?? 0}
                                title=""
                            />
                        </div>

                        {/* Color (Warna) Donut */}
                        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-800">Color Grade Chart</span>
                                    <span className="text-[10px] font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">Warna</span>
                                </div>
                            </div>
                            <DonutChart
                                rows={colorUsage?.rows ?? []}
                                total={colorUsage?.totalGram ?? 0}
                                title=""
                            />
                        </div>
                    </div>

                    {/* ── Grade Usage Table Card ────────────────────── */}
                    <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-800">Penggunaan Baku Detail</h3>
                                <p className="text-xs text-gray-400">
                                    Grup: <span className="font-medium text-gray-600">{groupBy}</span> · Metrik: <span className="font-medium text-gray-600">{metric === 'initial' ? 'Berat Awal' : 'Berat Kering'}</span>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-gray-500">Total Periode</p>
                                <p className="text-lg font-bold text-gray-900">{fmt(animatedUsageTotal, 1)} <span className="text-xs font-normal text-gray-500">gr</span></p>
                            </div>
                        </div>

                        {gradeUsage.rows.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
                                Tidak ada data dalam periode ini.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="pb-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">#</th>
                                            <th className="pb-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Grade</th>
                                            <th className="pb-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Distribusi</th>
                                            <th className="pb-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Gram</th>
                                            <th className="pb-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">%</th>
                                            <th className="pb-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">LP</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gradeUsage.rows.map((row, i) => (
                                            <tr key={row.key} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                                <td className="py-2.5 text-gray-400 text-xs">{i + 1}</td>
                                                <td className="py-2.5 font-medium text-gray-900">{row.key}</td>
                                                <td className="py-2.5 w-40">
                                                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{
                                                                width: `${Math.max(row.percentage, 0.5)}%`,
                                                                backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length],
                                                            }}
                                                        />
                                                    </div>
                                                </td>
                                                <td className="py-2.5 text-right text-gray-700 font-medium">{fmt(row.gram, 1)}</td>
                                                <td className="py-2.5 text-right text-gray-600">{row.percentage.toFixed(1)}%</td>
                                                <td className="py-2.5 text-right text-gray-600">{row.lpCount}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* ── Weekly Detail Compact ─────────────────────── */}
                    {capacity.weekly.length > 0 && (
                        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5">
                            <h3 className="text-sm font-semibold text-gray-800 mb-3">Detail Mingguan</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="pb-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Periode</th>
                                            <th className="pb-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">LP</th>
                                            <th className="pb-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Gram</th>
                                            <th className="pb-2 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Avg/LP</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {capacity.weekly.map((week) => (
                                            <tr key={week.weekStart} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                                                <td className="py-2 text-gray-700">{fmtDate(week.weekStart)} – {fmtDate(week.weekEnd)}</td>
                                                <td className="py-2 text-right text-gray-600">{week.lpCount}</td>
                                                <td className="py-2 text-right font-medium text-gray-900">{fmt(week.totalGram, 1)}</td>
                                                <td className="py-2 text-right text-gray-600">{fmt(week.avgGramPerLp, 1)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
