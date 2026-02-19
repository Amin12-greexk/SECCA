'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
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

function AreaChart({ data, height = 220 }: {
    data: { label: string; value: number; sublabel?: string }[];
    height?: number;
}) {
    const animationKey = data.map((d) => `${d.label}:${d.value}`).join('|');
    const [isAnimated, setIsAnimated] = useState(false);

    const W = 860;
    const H = height;
    const padL = 52, padR = 18, padT = 20, padB = 54;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const niceMax = Math.ceil(maxVal / 5) * 5 || 5;
    const gridLines = 4;

    const points = data.map((d, i) => ({
        x: padL + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW),
        y: padT + chartH - (d.value / niceMax) * chartH,
        ...d,
    }));

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
    const areaPath = `${linePath} L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`;
    const lineLength = points.reduce((sum, p, i) => {
        if (i === 0) return 0;
        const prev = points[i - 1];
        return sum + Math.hypot(p.x - prev.x, p.y - prev.y);
    }, 0);

    useEffect(() => {
        setIsAnimated(false);
        const rafId = window.requestAnimationFrame(() => setIsAnimated(true));
        return () => window.cancelAnimationFrame(rafId);
    }, [animationKey]);

    if (data.length === 0) return null;

    return (
        <div
            className="w-full overflow-x-auto rounded-lg border border-gray-100 bg-gradient-to-b from-white to-green-50/40 p-2"
            style={{
                opacity: isAnimated ? 1 : 0.6,
                transform: `translateY(${isAnimated ? 0 : 6}px)`,
                transition: 'opacity 350ms ease, transform 350ms ease',
            }}
        >
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 540 }}>
                <defs>
                    <linearGradient id="manager-area-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.26" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="manager-line-fill" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#059669" />
                        <stop offset="100%" stopColor="#0ea5e9" />
                    </linearGradient>
                </defs>

                {/* Grid */}
                {Array.from({ length: gridLines + 1 }).map((_, i) => {
                    const y = padT + (i / gridLines) * chartH;
                    const val = niceMax - (i / gridLines) * niceMax;
                    return (
                        <g key={i}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" strokeWidth="1" strokeDasharray={i === gridLines ? "0" : "4 4"} />
                            <text x={padL - 8} y={y + 4} textAnchor="end" className="text-[10px]" fill="#9ca3af" fontSize="10">{fmt(val)}</text>
                        </g>
                    );
                })}

                {/* Area */}
                <path
                    d={areaPath}
                    fill="url(#manager-area-fill)"
                    style={{
                        opacity: isAnimated ? 1 : 0,
                        transition: 'opacity 550ms ease 120ms',
                    }}
                />

                {/* Line */}
                <path
                    d={linePath}
                    fill="none"
                    stroke="url(#manager-line-fill)"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={lineLength}
                    strokeDashoffset={isAnimated ? 0 : lineLength}
                    style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
                />

                {/* Data points + labels */}
                {points.map((p, i) => (
                    <g
                        key={i}
                        style={{
                            opacity: isAnimated ? 1 : 0,
                            transform: `translateY(${isAnimated ? 0 : 6}px)`,
                            transition: `opacity 320ms ease ${200 + (i * 40)}ms, transform 320ms ease ${200 + (i * 40)}ms`,
                        }}
                    >
                        <circle cx={p.x} cy={p.y} r="4.5" fill="#fff" stroke="#059669" strokeWidth="2" />
                        <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#059669" fontSize="10" fontWeight="600">
                            {fmt(p.value, 1)}
                        </text>
                        {/* X-axis labels */}
                        {(data.length <= 8 || i % 2 === 0 || i === data.length - 1) && (
                            <text
                                x={p.x}
                                y={padT + chartH + 18}
                                textAnchor="middle"
                                fill="#6b7280"
                                fontSize="9"
                            >
                                {p.label}
                            </text>
                        )}
                    </g>
                ))}
            </svg>
        </div>
    );
}

/* ─── SVG Donut Chart ─────────────────────────────────────────── */

function DonutChart({ rows, total, title }: {
    rows: GradeUsageRow[];
    total: number;
    title: string;
}) {
    const size = 230;
    const cx = size / 2, cy = size / 2;
    const r = 78;
    const stroke = 28;
    const circumference = 2 * Math.PI * r;
    const animatedTotal = useAnimatedNumber(total, 650);
    const [isAnimated, setIsAnimated] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [tooltip, setTooltip] = useState<{ x: number; y: number; index: number } | null>(null);

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
                key: "Lainnya",
                gram: Math.round(otherGram * 100) / 100,
                percentage: Math.round((otherGram / total) * 10000) / 100,
                lpCount: otherLp,
            },
        ];
    }, [rows, total]);

    const segments = useMemo(() => {
        if (normalizedRows.length === 0 || total <= 0) return [];
        let currentOffset = 0;
        return normalizedRows.map((row, i) => {
            const fraction = row.gram / total;
            const dash = Math.max(fraction * circumference, 0);
            const segment = {
                ...row,
                color: DONUT_COLORS[i % DONUT_COLORS.length],
                dash,
                offset: currentOffset,
            };
            currentOffset -= dash;
            return segment;
        });
    }, [normalizedRows, total, circumference]);

    const segmentKey = normalizedRows.map((row) => `${row.key}:${row.gram}`).join('|');

    useEffect(() => {
        setIsAnimated(false);
        const rafId = window.requestAnimationFrame(() => setIsAnimated(true));
        return () => window.cancelAnimationFrame(rafId);
    }, [segmentKey, total]);

    const hideTooltip = () => {
        setHoveredIndex(null);
        setTooltip(null);
    };

    const updateTooltip = (index: number, event: ReactMouseEvent<SVGCircleElement>) => {
        const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
        if (!bounds) return;
        setHoveredIndex(index);
        setTooltip({
            index,
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
        });
    };

    return (
        <div className="flex flex-col items-center">
            {title ? <p className="text-sm font-semibold text-gray-700 mb-2">{title}</p> : null}
            {rows.length === 0 ? (
                <div className="flex items-center justify-center h-[230px] text-sm text-gray-400">
                    Tidak ada data
                </div>
            ) : (
                <>
                    <div className="relative">
                        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                            <circle
                                cx={cx}
                                cy={cy}
                                r={r}
                                fill="none"
                                stroke="#ecfdf5"
                                strokeWidth={stroke}
                            />
                            {segments.map((segment, i) => {
                                const isHovered = hoveredIndex === i;
                                return (
                                    <g
                                        key={i}
                                        transform={`rotate(-90 ${cx} ${cy})`}
                                        style={{
                                            transformOrigin: `${cx}px ${cy}px`,
                                            transform: isHovered ? 'scale(1.035)' : 'scale(1)',
                                            filter: isHovered ? 'drop-shadow(0 3px 10px rgba(15, 23, 42, 0.16))' : 'none',
                                            transition: 'transform 180ms ease, filter 180ms ease',
                                        }}
                                    >
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={r}
                                            fill="none"
                                            stroke={segment.color}
                                            strokeWidth={isHovered ? stroke + 2 : stroke}
                                            strokeLinecap="butt"
                                            strokeDasharray={isAnimated ? `${segment.dash} ${circumference}` : `0 ${circumference}`}
                                            strokeDashoffset={isAnimated ? segment.offset : 0}
                                            onMouseEnter={(event) => updateTooltip(i, event)}
                                            onMouseMove={(event) => updateTooltip(i, event)}
                                            onMouseLeave={hideTooltip}
                                            style={{
                                                cursor: 'pointer',
                                                transition: `stroke-dasharray 650ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 50}ms, stroke-dashoffset 650ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 50}ms, stroke-width 180ms ease`,
                                            }}
                                        />
                                    </g>
                                );
                            })}
                            {/* Center text */}
                            <text x={cx} y={cy - 10} textAnchor="middle" fill="#111827" fontSize="16" fontWeight="700">
                                {fmt(animatedTotal, 0)}
                            </text>
                            <text x={cx} y={cy + 8} textAnchor="middle" fill="#6b7280" fontSize="10">
                                Total periode
                            </text>
                            <text x={cx} y={cy + 22} textAnchor="middle" fill="#9ca3af" fontSize="9">
                                gram
                            </text>
                        </svg>

                        {tooltip && segments[tooltip.index] ? (
                            <div
                                className="pointer-events-none absolute z-20 min-w-[180px] rounded-lg border border-gray-800 bg-gray-900/95 px-3 py-2 text-left text-xs text-white shadow-xl"
                                style={{
                                    left: `${Math.min(Math.max(tooltip.x + 12, 8), size - 190)}px`,
                                    top: `${Math.min(Math.max(tooltip.y - 12, 8), size - 92)}px`,
                                }}
                            >
                                <p className="font-semibold leading-tight">{segments[tooltip.index].key}</p>
                                <p className="mt-1 text-[11px] text-gray-200">
                                    {fmt(segments[tooltip.index].gram, 1)} gr · {segments[tooltip.index].lpCount} LP
                                </p>
                                <p className="text-[11px] text-emerald-300">
                                    {segments[tooltip.index].percentage.toFixed(1)}%
                                </p>
                            </div>
                        ) : null}
                    </div>

                    {/* Legend */}
                    <div className="mt-2 w-full max-w-[420px] space-y-2">
                        {segments.map((segment, i) => (
                            <div key={i} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs">
                                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                                <div className="min-w-0">
                                    <div className="truncate text-gray-700">{segment.key}</div>
                                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                                        <div
                                            className="h-full rounded-full"
                                            style={{
                                                width: `${Math.min(isAnimated ? segment.percentage : 0, 100)}%`,
                                                backgroundColor: segment.color,
                                                transition: `width 500ms ease ${120 + (i * 60)}ms`,
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

/* ─── Main Component ──────────────────────────────────────────── */

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

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [gu, cap] = await Promise.all([
                getManagerGradeUsage({ from, to, groupBy, metric }),
                getManagerCapacity({ from, to }),
            ]);
            setGradeUsage(gu);
            setCapacity(cap);
            setLastUpdatedAt(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal memuat data analitik.');
        } finally {
            setLoading(false);
        }
    }, [from, to, groupBy, metric]);

    useEffect(() => { loadData(); }, [loadData]);

    /* Derived donut data by combo, feather, and color */
    const [comboUsage, setComboUsage] = useState<GradeUsageResponse | null>(null);
    const [featherUsage, setFeatherUsage] = useState<GradeUsageResponse | null>(null);
    const [colorUsage, setColorUsage] = useState<GradeUsageResponse | null>(null);

    useEffect(() => {
        if (!from || !to) return;
        Promise.all([
            getManagerGradeUsage({ from, to, groupBy: 'combo', metric }),
            getManagerGradeUsage({ from, to, groupBy: 'feather', metric }),
            getManagerGradeUsage({ from, to, groupBy: 'color', metric }),
        ]).then(([c, f, w]) => {
            setComboUsage(c);
            setFeatherUsage(f);
            setColorUsage(w);
        }).catch(() => { /* already handled by main load */ });
    }, [from, to, metric]);

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
