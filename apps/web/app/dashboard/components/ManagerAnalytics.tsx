'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';
import LazyEChart from '@/components/charts/LazyEChart';
import type { EChartsOption } from 'echarts';
import {
    getManagerGradeUsage,
    getManagerCapacity,
    getManagerWorkerPerformance,
    getManagerRealPerforma,
    type GradeUsageResponse,
    type CapacityResponse,
    type WorkerPerformanceResponse,
    type RealPerformaResponse,
    type GradeUsageRow,
} from '@/lib/api';

/* ─── Helpers ─────────────────────────────────────────────────── */

const fmt = (value: number, fd = 0) =>
    new Intl.NumberFormat('id-ID', { minimumFractionDigits: fd, maximumFractionDigits: fd }).format(value);

const fmtPct = (bps: number | null | undefined) =>
    bps == null ? '–' : `${fmt(bps / 100, 1)}%`;

const fmtTime = (v: Date) =>
    new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(v);

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

/* ─── Capacity Badge Component ────────────────────────────────── */

function CapacityBadge({ band }: { band: string }) {
    const styles: Record<string, string> = {
        A: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        B: 'bg-teal-50 text-teal-700 border-teal-200',
        C: 'bg-amber-50 text-amber-700 border-amber-200',
        D: 'bg-orange-50 text-orange-700 border-orange-200',
        E: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    return (
        <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold border ${styles[band] ?? styles['E']}`}>
            Kapasitas {band}
        </span>
    );
}

/* ─── SVG Area Chart ──────────────────────────────────────────── */

function AreaChart({ data, height = 300 }: {
    data: { label: string; value: number; sublabel?: string }[];
    height?: number;
}) {
    if (data.length === 0) return null;

    return (
        <div className="w-full rounded-xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/50 p-2">
            <LineChart
                height={height}
                margin={{ top: 24, right: 20, bottom: 54, left: 64 }}
                xAxis={[
                    {
                        scaleType: 'point',
                        data: data.map((point) => point.label),
                        tickLabelStyle: { fontSize: 10, fill: '#64748b' },
                    },
                ]}
                yAxis={[
                    {
                        min: 0,
                        tickLabelStyle: { fontSize: 10, fill: '#94a3b8' },
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
                        fill: 'rgba(5, 152, 51, 0.12)',
                    },
                    '& .MuiLineElement-root': {
                        strokeWidth: 2.5,
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
            {title ? <p className="mb-2 text-sm font-semibold text-slate-700">{title}</p> : null}
            {rows.length === 0 ? (
                <div className="flex h-[230px] items-center justify-center text-sm text-slate-400">
                    Tidak ada data
                </div>
            ) : (
                <>
                    <div className="relative">
                        <PieChart
                            height={240}
                            series={[
                                {
                                    data: segments,
                                    innerRadius: 68,
                                    outerRadius: 104,
                                    paddingAngle: 1.6,
                                    cornerRadius: 5,
                                    highlighted: { additionalRadius: 6 },
                                    faded: { color: 'rgba(100, 116, 139, 0.15)' },
                                    valueFormatter: (item) => {
                                        const row = segments.find((segment) => segment.id === item.id);
                                        if (!row) return '';
                                        return `${fmt(row.gram, 1)} gr - ${row.lpCount} LP - ${row.percentage.toFixed(1)}%`;
                                    },
                                },
                            ]}
                            hideLegend
                        />
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <p className="text-lg font-extrabold text-slate-900">{fmt(animatedTotal, 0)}</p>
                            <p className="text-[10px] text-slate-500 font-medium">Total periode</p>
                            <p className="text-[10px] text-slate-400">gram</p>
                        </div>
                    </div>

                    <div className="mt-2 w-full max-w-[420px] space-y-2">
                        {segments.map((segment) => (
                            <div key={segment.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
                                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                                <div className="min-w-0">
                                    <div className="truncate text-slate-700 font-medium">{segment.key}</div>
                                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
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
                                <span className="text-right text-slate-500 font-medium">{segment.percentage.toFixed(1)}%</span>
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
    const [activeTab, setActiveTab] = useState<'performa' | 'capacity' | 'grades'>('performa');
    const [trendGranularity, setTrendGranularity] = useState<'weekly' | 'daily'>('weekly');
    const [groupBy, setGroupBy] = useState<'combo' | 'shape' | 'feather' | 'color'>('combo');
    const [metric, setMetric] = useState<'initial' | 'dry'>('initial');
    const [productionScope, setProductionScope] = useState<'ALL' | 'FACTORY_ONLY' | 'MINIPLANT_ONLY'>('ALL');

    const [realPerforma, setRealPerforma] = useState<RealPerformaResponse | null>(null);
    const [capacity, setCapacity] = useState<CapacityResponse | null>(null);
    const [workerPerf, setWorkerPerf] = useState<WorkerPerformanceResponse | null>(null);
    const [gradeUsage, setGradeUsage] = useState<GradeUsageResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
    const [mitraSearch, setMitraSearch] = useState('');

    /* Derived donut data */
    const [comboUsage, setComboUsage] = useState<GradeUsageResponse | null>(null);
    const [featherUsage, setFeatherUsage] = useState<GradeUsageResponse | null>(null);
    const [colorUsage, setColorUsage] = useState<GradeUsageResponse | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [realPerf, cap, wPerf, tableUsage, comboRes, featherRes, colorRes] = await Promise.all([
                getManagerRealPerforma({ from, to, productionScope }),
                getManagerCapacity({ from, to, productionScope }),
                getManagerWorkerPerformance({ from, to, productionScope }),
                getManagerGradeUsage({ from, to, groupBy, metric, productionScope }),
                groupBy === 'combo' ? null : getManagerGradeUsage({ from, to, groupBy: 'combo', metric, productionScope }),
                groupBy === 'feather' ? null : getManagerGradeUsage({ from, to, groupBy: 'feather', metric, productionScope }),
                groupBy === 'color' ? null : getManagerGradeUsage({ from, to, groupBy: 'color', metric, productionScope }),
            ]);

            setRealPerforma(realPerf);
            setCapacity(cap);
            setWorkerPerf(wPerf);
            setGradeUsage(tableUsage);
            
            setComboUsage(groupBy === 'combo' ? tableUsage : comboRes);
            setFeatherUsage(groupBy === 'feather' ? tableUsage : featherRes);
            setColorUsage(groupBy === 'color' ? tableUsage : colorRes);

            setLastUpdatedAt(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal memuat data analitik.');
        } finally {
            setLoading(false);
        }
    }, [from, to, groupBy, metric, productionScope]);

    useEffect(() => { loadData(); }, [loadData]);

    /* ECharts Interactive Options */
    const productionTrendOption = useMemo<EChartsOption>(() => {
        if (!realPerforma) return {};
        const isDaily = trendGranularity === 'daily';
        const dataList = isDaily ? (realPerforma.dailyStats ?? []) : realPerforma.periodStats;
        if (!dataList.length) return {};

        const labels = isDaily
            ? (dataList as typeof realPerforma.dailyStats & Array<unknown>).map(d => d.dateStr)
            : realPerforma.periodStats.map(p => p.periodName);

        const bakuData = dataList.map(d => d.totalBakuKering);
        const bjdData = dataList.map(d => d.totalBjd);

        return {
            tooltip: { trigger: 'axis' },
            legend: { data: ['Baku Kering (gr)', 'Barang Jadi Output (gr)'], top: 0 },
            grid: { left: 50, right: 20, top: 36, bottom: 55 },
            dataZoom: [
                { type: 'inside', start: 0, end: 100, throttle: 50 },
                { type: 'slider', start: 0, end: 100, height: 18, bottom: 5, borderColor: '#e2e8f0', fillerColor: 'rgba(5, 152, 51, 0.12)', handleStyle: { color: '#059833' } },
            ],
            xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: '#cbd5e1' } }, axisLabel: { color: '#64748b', fontSize: 11 } },
            yAxis: { type: 'value', axisLine: { show: false }, splitLine: { lineStyle: { color: '#f1f5f9' } }, axisLabel: { color: '#94a3b8', fontSize: 11 } },
            series: [
                {
                    name: 'Baku Kering (gr)',
                    type: 'line',
                    smooth: true,
                    data: bakuData,
                    itemStyle: { color: '#2563eb' },
                    lineStyle: { width: 2.5 },
                },
                {
                    name: 'Barang Jadi Output (gr)',
                    type: 'line',
                    smooth: true,
                    data: bjdData,
                    itemStyle: { color: '#059833' },
                    lineStyle: { width: 2.5 },
                    areaStyle: { color: 'rgba(5, 152, 51, 0.12)' },
                },
            ],
        };
    }, [realPerforma, trendGranularity]);

    const efficiencyTrendOption = useMemo<EChartsOption>(() => {
        if (!realPerforma) return {};
        const isDaily = trendGranularity === 'daily';
        const dataList = isDaily ? (realPerforma.dailyStats ?? []) : realPerforma.periodStats;
        if (!dataList.length) return {};

        const labels = isDaily
            ? (dataList as typeof realPerforma.dailyStats & Array<unknown>).map(d => d.dateStr)
            : realPerforma.periodStats.map(p => p.periodName);

        return {
            tooltip: { trigger: 'axis', valueFormatter: (v) => `${(Number(v) / 100).toFixed(1)}%` },
            legend: { data: ['Rendemen Utama %', 'Rendemen Net %', 'Susut Proses %', 'Susut Hilang %'], top: 0 },
            grid: { left: 45, right: 20, top: 36, bottom: 55 },
            dataZoom: [
                { type: 'inside', start: 0, end: 100, throttle: 50 },
                { type: 'slider', start: 0, end: 100, height: 18, bottom: 5, borderColor: '#e2e8f0', fillerColor: 'rgba(5, 152, 51, 0.12)', handleStyle: { color: '#059833' } },
            ],
            xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: '#cbd5e1' } }, axisLabel: { color: '#64748b', fontSize: 11 } },
            yAxis: { type: 'value', splitLine: { lineStyle: { color: '#f1f5f9' } }, axisLabel: { color: '#94a3b8', fontSize: 11, formatter: (v: number) => `${(v / 100).toFixed(0)}%` } },
            series: [
                { name: 'Rendemen Utama %', type: 'line', smooth: true, data: dataList.map(p => p.rendemenPctBps), itemStyle: { color: '#059833' }, lineStyle: { width: 2.5 } },
                { name: 'Rendemen Net %', type: 'line', smooth: true, data: dataList.map(p => p.rendemenNetPctBps), itemStyle: { color: '#0d9488' }, lineStyle: { width: 2.5 } },
                { name: 'Susut Proses %', type: 'line', smooth: true, data: dataList.map(p => p.susutProsesPctBps), itemStyle: { color: '#d97706' }, lineStyle: { width: 2.5 } },
                { name: 'Susut Hilang %', type: 'line', smooth: true, data: dataList.map(p => p.susutHilangPctBps), itemStyle: { color: '#e11d48' }, lineStyle: { width: 2.5 } },
            ],
        };
    }, [realPerforma, trendGranularity]);

    const filteredWorkerRows = useMemo(() => {
        if (!realPerforma?.workerRows) return [];
        if (!mitraSearch.trim()) return realPerforma.workerRows;
        const q = mitraSearch.toLowerCase();
        return realPerforma.workerRows.filter(w => w.workerName.toLowerCase().includes(q));
    }, [realPerforma, mitraSearch]);

    return (
        <div className="space-y-6">

            {/* ── Sleek Action & Control Bar ──────────────────────────────── */}
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-[#059833]">
                                📊
                            </span>
                            Analitik Produksi & Performa
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Metrik real-time dari data setoran aktual database
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-1">
                            <div className="flex items-center px-2 py-1 gap-1.5 text-xs text-slate-600 font-medium">
                                <span>Dari</span>
                                <input
                                    type="date"
                                    value={from}
                                    onChange={(e) => setFrom(e.target.value)}
                                    className="bg-transparent text-slate-900 font-semibold focus:outline-none"
                                />
                            </div>
                            <span className="text-slate-300">•</span>
                            <div className="flex items-center px-2 py-1 gap-1.5 text-xs text-slate-600 font-medium">
                                <span>Sampai</span>
                                <input
                                    type="date"
                                    value={to}
                                    onChange={(e) => setTo(e.target.value)}
                                    className="bg-transparent text-slate-900 font-semibold focus:outline-none"
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={loadData}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#059833] px-4 py-2 text-xs font-bold text-white hover:bg-[#047a29] active:scale-95 disabled:opacity-50 transition-all shadow-xs"
                        >
                            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                            </svg>
                            {loading ? 'Memuat...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {/* Scope filter */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <span className="text-xs font-semibold text-slate-700">Lingkup Produksi:</span>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setProductionScope('ALL')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${productionScope === 'ALL' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Semua Produksi
                        </button>
                        <button
                            onClick={() => setProductionScope('FACTORY_ONLY')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${productionScope === 'FACTORY_ONLY' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Hanya Pabrik
                        </button>
                        <button
                            onClick={() => setProductionScope('MINIPLANT_ONLY')}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${productionScope === 'MINIPLANT_ONLY' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Hanya Miniplant
                        </button>
                    </div>
                </div>

                {/* Tab Pills Navigation */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                        onClick={() => setActiveTab('performa')}
                        className={`py-2 px-4 text-xs font-bold rounded-xl transition-all ${
                            activeTab === 'performa'
                                ? 'bg-emerald-500/10 text-[#059833] border border-emerald-500/20'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
                        }`}
                    >
                        📈 Performa Real System
                    </button>
                    <button
                        onClick={() => setActiveTab('capacity')}
                        className={`py-2 px-4 text-xs font-bold rounded-xl transition-all ${
                            activeTab === 'capacity'
                                ? 'bg-emerald-500/10 text-[#059833] border border-emerald-500/20'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
                        }`}
                    >
                        ⚡ Kapasitas & Alur LP
                    </button>
                    <button
                        onClick={() => setActiveTab('grades')}
                        className={`py-2 px-4 text-xs font-bold rounded-xl transition-all ${
                            activeTab === 'grades'
                                ? 'bg-emerald-500/10 text-[#059833] border border-emerald-500/20'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/60'
                        }`}
                    >
                        🎨 Distribusi Grade
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-center gap-2.5">
                    <svg className="w-5 h-5 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
                    <span className="text-xs font-medium text-slate-500">Memuat data analitik sistem...</span>
                </div>
            )}

            {!loading && !error && realPerforma && (
                <>
                    {/* TAB 1: PERFORMA REAL SYSTEM */}
                    {activeTab === 'performa' && (
                        <div className="space-y-6">
                            {/* ── Airy Stat Tiles Row (Light & Clean) ──────────────────── */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 transition-all hover:shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Output Barang Jadi</span>
                                        <span className="text-base">📦</span>
                                    </div>
                                    <p className="text-2xl font-black text-emerald-950 mt-2 font-mono">
                                        {fmt(realPerforma.summary.totalBjd, 0)} <span className="text-sm font-normal text-emerald-700">gr</span>
                                    </p>
                                    <p className="text-[10px] text-emerald-600/80 mt-1 font-medium">Dari {realPerforma.summary.totalSetoranLp} LP Setor</p>
                                </div>

                                <div className="rounded-2xl border border-sky-200/80 bg-sky-50/40 p-4 transition-all hover:shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">Input Baku Kering</span>
                                        <span className="text-base">🌾</span>
                                    </div>
                                    <p className="text-2xl font-black text-sky-950 mt-2 font-mono">
                                        {fmt(realPerforma.summary.totalBakuKering, 0)} <span className="text-sm font-normal text-sky-700">gr</span>
                                    </p>
                                    <p className="text-[10px] text-sky-600/80 mt-1 font-medium">Input Berat Kering</p>
                                </div>

                                <div className="rounded-2xl border border-teal-200/80 bg-teal-50/40 p-4 transition-all hover:shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider">Rendemen Utama</span>
                                        <span className="text-base">⚡</span>
                                    </div>
                                    <p className="text-2xl font-black text-teal-950 mt-2 font-mono">
                                        {fmtPct(realPerforma.summary.overallRendemenBps)}
                                    </p>
                                    <p className="text-[10px] text-teal-600/80 mt-1 font-medium">Rerata Output vs Input</p>
                                </div>

                                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 transition-all hover:shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Mitra Aktif</span>
                                        <span className="text-base">👥</span>
                                    </div>
                                    <p className="text-2xl font-black text-amber-950 mt-2 font-mono">
                                        {realPerforma.summary.totalActiveWorkers} <span className="text-sm font-normal text-amber-700">Pekerja</span>
                                    </p>
                                    <p className="text-[10px] text-amber-600/80 mt-1 font-medium">Aktif Berproduksi</p>
                                </div>

                                <div className="rounded-2xl border border-purple-200/80 bg-purple-50/40 p-4 transition-all hover:shadow-sm col-span-2 sm:col-span-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Total Setoran</span>
                                        <span className="text-base">📋</span>
                                    </div>
                                    <p className="text-2xl font-black text-purple-950 mt-2 font-mono">
                                        {realPerforma.summary.totalSetoranLp} <span className="text-sm font-normal text-purple-700">LP</span>
                                    </p>
                                    <p className="text-[10px] text-purple-600/80 mt-1 font-medium">Setoran Selesai</p>
                                </div>
                            </div>

                            {/* Granularity Switcher Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-200/70">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-700">Skala Grafik (Zoom):</span>
                                    <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 shadow-2xs">
                                        <button
                                            onClick={() => setTrendGranularity('weekly')}
                                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                                trendGranularity === 'weekly'
                                                    ? 'bg-[#059833] text-white shadow-2xs'
                                                    : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            📅 Per Minggu (Zoom Out)
                                        </button>
                                        <button
                                            onClick={() => setTrendGranularity('daily')}
                                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                                trendGranularity === 'daily'
                                                    ? 'bg-[#059833] text-white shadow-2xs'
                                                    : 'text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            🔍 Per Hari (Zoom In)
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-500 italic">
                                    💡 Scroll / pinch slider di bawah chart untuk Zoom In & Zoom Out interaktif!
                                </p>
                            </div>

                            {/* Charts Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Chart 1: Production Trend (BB vs BJD) */}
                                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-900">Tren Volume Produksi {trendGranularity === 'daily' ? 'Harian' : 'Mingguan'}</h3>
                                            <p className="text-xs text-slate-500">Berat Kering Input vs Output (gr)</p>
                                        </div>
                                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#059833] border border-emerald-200">
                                            {trendGranularity === 'daily' ? 'Skala Harian' : 'Skala Mingguan'}
                                        </span>
                                    </div>
                                    <LazyEChart option={productionTrendOption} height={320} />
                                </div>

                                {/* Chart 2: Efficiency Trend (Rendemen & Susut) */}
                                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-900">Tren Efisiensi & Rendemen {trendGranularity === 'daily' ? 'Harian' : 'Mingguan'}</h3>
                                            <p className="text-xs text-slate-500">Rendemen Utama, Rendemen Net, Susut Proses & Hilang (%)</p>
                                        </div>
                                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#059833] border border-emerald-200">
                                            {trendGranularity === 'daily' ? 'Skala Harian' : 'Skala Mingguan'}
                                        </span>
                                    </div>
                                    <LazyEChart option={efficiencyTrendOption} height={320} />
                                </div>
                            </div>

                            {/* Mitra Ranking Table */}
                            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900">Peringkat & Kapasitas Mitra Real-System</h3>
                                        <p className="text-xs text-slate-500">Hasil pengerjaan aktual mitra dari data setoran</p>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Cari nama mitra..."
                                            value={mitraSearch}
                                            onChange={(e) => setMitraSearch(e.target.value)}
                                            className="h-9 w-60 rounded-xl border border-slate-200 bg-slate-50/50 pl-3 pr-8 text-xs focus:border-[#059833] focus:bg-white focus:outline-none transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 uppercase font-semibold">
                                                <th className="py-3 px-3">Rank</th>
                                                <th className="py-3 px-3">Nama Mitra</th>
                                                <th className="py-3 px-3">Band Kapasitas</th>
                                                <th className="py-3 px-3 text-right">Rerata Output / HK</th>
                                                <th className="py-3 px-3 text-right">Total Output BJD</th>
                                                <th className="py-3 px-3 text-right">Input Kering</th>
                                                <th className="py-3 px-3 text-right">Rendemen %</th>
                                                <th className="py-3 px-3 text-center">Hari Kerja (HK)</th>
                                                <th className="py-3 px-3 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredWorkerRows.length === 0 ? (
                                                <tr>
                                                    <td colSpan={9} className="py-8 text-center text-slate-400">
                                                        Tidak ada data mitra ditemukan.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredWorkerRows.map((row, idx) => (
                                                    <tr key={row.workerId} className="hover:bg-emerald-50/30 transition-colors">
                                                        <td className="py-3 px-3 font-bold text-slate-400">#{idx + 1}</td>
                                                        <td className="py-3 px-3 font-bold text-slate-900">{row.workerName}</td>
                                                        <td className="py-3 px-3"><CapacityBadge band={row.capacityBand} /></td>
                                                        <td className="py-3 px-3 text-right font-bold text-emerald-700">{fmt(row.dailyGramPerHk, 1)} gr/HK</td>
                                                        <td className="py-3 px-3 text-right font-semibold text-slate-900">{fmt(row.totalBjd, 0)} gr</td>
                                                        <td className="py-3 px-3 text-right text-slate-500">{fmt(row.totalBakuKering, 0)} gr</td>
                                                        <td className="py-3 px-3 text-right font-bold text-teal-700">{fmtPct(row.rendemenPctBps)}</td>
                                                        <td className="py-3 px-3 text-center font-semibold text-slate-700">{row.hk} hari</td>
                                                        <td className="py-3 px-3 text-center">
                                                            {row.isWarning ? (
                                                                <span className="inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-700">
                                                                    ⚠️ Warning (&lt;25g/HK)
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                                                    ✓ Normal
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: KAPASITAS & ALUR LP REAL-TIME */}
                    {activeTab === 'capacity' && capacity && (
                        <div className="space-y-6">
                            {/* Capacity Chart Card */}
                            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-5">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-800">Kapasitas Pecah Bon Mingguan</h3>
                                        <p className="text-xs text-slate-400">Total berat bahan baku yang diproses per minggu</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5 mt-3">
                                    <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 px-4 py-3">
                                        <p className="text-[11px] font-bold text-emerald-800 uppercase">Total Gram</p>
                                        <p className="text-xl font-extrabold text-emerald-950 mt-0.5">{fmt(capacity.summary.totalGram, 1)}</p>
                                    </div>
                                    <div className="rounded-xl bg-sky-50/60 border border-sky-100 px-4 py-3">
                                        <p className="text-[11px] font-bold text-sky-800 uppercase">Total LP</p>
                                        <p className="text-xl font-extrabold text-sky-950 mt-0.5">{fmt(capacity.summary.totalLp)}</p>
                                    </div>
                                    <div className="rounded-xl bg-amber-50/60 border border-amber-100 px-4 py-3">
                                        <p className="text-[11px] font-bold text-amber-800 uppercase">Rata-rata/LP</p>
                                        <p className="text-xl font-extrabold text-amber-950 mt-0.5">{fmt(capacity.summary.avgGramPerLp, 1)} gr</p>
                                    </div>
                                    <div className="rounded-xl bg-purple-50/60 border border-purple-100 px-4 py-3">
                                        <p className="text-[11px] font-bold text-purple-800 uppercase">Minggu</p>
                                        <p className="text-xl font-extrabold text-purple-950 mt-0.5">{capacity.weekly.length}</p>
                                    </div>
                                    <div className="rounded-xl bg-indigo-50/60 border border-indigo-200 px-4 py-3">
                                        <p className="text-[11px] font-bold text-indigo-800 uppercase">Hari Kerja</p>
                                        <p className="text-xl font-extrabold text-indigo-950 mt-0.5">{capacity.summary.workingDays ?? 0}</p>
                                    </div>
                                </div>

                                {capacity.weekly.length > 0 && (
                                    <AreaChart
                                        data={capacity.weekly.map((w) => ({
                                            label: w.weekStart,
                                            value: w.totalGram,
                                            sublabel: `${w.lpCount} LP`,
                                        }))}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: DISTRIBUSI GRADE BAKU */}
                    {activeTab === 'grades' && gradeUsage && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-5">
                                <p className="text-sm font-bold text-slate-800 mb-2">Grade Combo (Bentuk/Bulu/Warna)</p>
                                <DonutChart rows={comboUsage?.rows ?? []} total={comboUsage?.totalGram ?? 0} title="" />
                            </div>

                            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-5">
                                <p className="text-sm font-bold text-slate-800 mb-2">Grade Bulu</p>
                                <DonutChart rows={featherUsage?.rows ?? []} total={featherUsage?.totalGram ?? 0} title="" />
                            </div>

                            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs p-5">
                                <p className="text-sm font-bold text-slate-800 mb-2">Grade Warna</p>
                                <DonutChart rows={colorUsage?.rows ?? []} total={colorUsage?.totalGram ?? 0} title="" />
                            </div>
                        </div>
                    )}
                </>
            )}

        </div>
    );
}
