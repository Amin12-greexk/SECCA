'use client';

import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { Trophy } from 'lucide-react';
import LazyEChart from '@/components/charts/LazyEChart';
import DeltaBadge from './DeltaBadge';
import {
    CHART_FONT,
    CHART_INK,
    areaGradient,
    categoryAxis,
    fmtBpsId,
    fmtId,
    stripPeriode,
    tooltipStyle,
    valueAxis,
} from '@/components/charts/chart-theme';
import type { PerformaPeriodStat } from '@/lib/api';

/**
 * Tren antar periode gaya "production/efficiency chart":
 * garis smooth berlabel pill di tiap titik + strip statistik
 * (nilai terkini, terbaik, pertumbuhan vs periode sebelumnya).
 *
 * Kolom Koefisien belum ada di data Excel, jadi grafik efisiensi
 * hanya berisi Rendemen, SP, dan SH.
 */

const BB_COLOR = '#2a78d6';
const BJD_COLOR = '#008300';
const REND_COLOR = '#1baf7a';
const SP_COLOR = '#eda100';
const SH_COLOR = '#e34948';
const CAPACITY_COLOR = '#eda100';

/** Label pill di titik disembunyikan saat periode terlalu rapat. */
const MAX_LABELED_POINTS = 14;

const RANGE_OPTIONS = [
    { value: 0, label: 'Semua periode' },
    { value: 12, label: '12 periode terakhir' },
    { value: 8, label: '8 periode terakhir' },
    { value: 4, label: '4 periode terakhir' },
];

const SELECT_CLASS =
    'mt-3 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none transition';

/** % perubahan vs periode sebelumnya, mis. 15,08. */
function growthPct(current: number | null | undefined, previous: number | null | undefined) {
    if (current === null || current === undefined) return null;
    if (previous === null || previous === undefined || previous === 0) return null;
    return ((current - previous) / previous) * 100;
}

function xAxisFor(labels: string[]) {
    return {
        type: 'category' as const,
        data: labels,
        boundaryGap: false,
        ...categoryAxis,
        axisLabel: {
            ...categoryAxis.axisLabel,
            interval: labels.length > 8 ? ('auto' as const) : 0,
            rotate: labels.length > 4 ? 26 : 0,
            hideOverlap: true,
        },
    };
}

function lineSeries(params: {
    name: string;
    color: string;
    data: Array<number | null>;
    area?: boolean;
    labelPosition?: 'top' | 'bottom';
    showLabel?: boolean;
    decimals?: number;
}) {
    const {
        name,
        color,
        data,
        area = false,
        labelPosition = 'top',
        showLabel = true,
        decimals = 1,
    } = params;

    return {
        name,
        type: 'line' as const,
        smooth: 0.35,
        symbol: 'circle' as const,
        symbolSize: 6,
        connectNulls: false,
        lineStyle: { width: 2.5, color },
        itemStyle: { color, borderColor: '#fff', borderWidth: 2 },
        areaStyle: area ? { color: areaGradient(color) } : undefined,
        label: {
            show: showLabel,
            position: labelPosition,
            distance: 5,
            formatter: (item: { value?: unknown }) =>
                item.value === null || item.value === undefined
                    ? ''
                    : fmtId(Number(item.value), decimals),
            backgroundColor: color,
            color: '#fff',
            fontSize: 10,
            fontWeight: 600 as const,
            fontFamily: CHART_FONT,
            padding: [2, 5] as [number, number],
            borderRadius: 4,
        },
        data,
    };
}

function baseOption(params: {
    labels: string[];
    series: ReturnType<typeof lineSeries>[];
    percent?: boolean;
    legend?: boolean;
}): EChartsOption {
    const { labels, series, percent = false, legend = false } = params;

    return {
        grid: { top: legend ? 46 : 30, right: 18, bottom: 46, left: 48 },
        legend: legend
            ? {
                  top: 0,
                  left: 'center',
                  icon: 'circle',
                  itemWidth: 8,
                  itemHeight: 8,
                  itemGap: 14,
                  textStyle: { fontSize: 11, color: CHART_INK.secondary, fontFamily: CHART_FONT },
              }
            : undefined,
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'line',
                lineStyle: { color: CHART_INK.axis, width: 1, type: 'dashed' },
            },
            ...tooltipStyle,
            valueFormatter: (value) =>
                value === null || value === undefined
                    ? '–'
                    : `${fmtId(Number(value), 1)}${percent ? '%' : ''}`,
        },
        xAxis: xAxisFor(labels),
        yAxis: {
            type: 'value',
            scale: true,
            ...valueAxis,
            axisLabel: {
                ...valueAxis.axisLabel,
                formatter: (value: number) => (percent ? `${fmtId(value, 0)}%` : fmtId(value)),
            },
        },
        series,
    };
}

/** Kerangka kartu: judul + dropdown rentang + strip statistik + chart. */
function ChartCard(props: {
    title: string;
    subtitle: string;
    number?: string;
    range: number;
    onRangeChange: (value: number) => void;
    totalPeriods: number;
    heroValue: string;
    heroUnit?: string;
    best: string;
    growth: number | null;
    growthSuffix: string;
    option: EChartsOption;
    height: number;
}) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                    {props.title}
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                        {props.totalPeriods} periode
                    </span>
                    {props.number ? (
                        <span className="font-mono text-[10px] font-normal text-gray-300">
                            {props.number}
                        </span>
                    ) : null}
                </h2>
                <p className="mt-0.5 text-xs text-gray-400">{props.subtitle}</p>
            </div>

            <select
                value={props.range}
                onChange={(event) => props.onRangeChange(Number(event.target.value))}
                className={SELECT_CLASS}
                aria-label={`Rentang periode ${props.title}`}
            >
                {RANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-2.5">
                <p className="text-2xl font-bold text-gray-900">
                    {props.heroValue}
                    {props.heroUnit ? (
                        <span className="ml-1 text-sm font-semibold text-gray-500">
                            {props.heroUnit}
                        </span>
                    ) : null}
                </p>
                <div className="flex items-center gap-4">
                    <span
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600"
                        title="Terbaik di rentang ini"
                    >
                        <Trophy className="h-4 w-4" />
                        {props.best}
                    </span>
                    <DeltaBadge value={props.growth} suffix={props.growthSuffix} />
                </div>
            </div>

            <div className="mt-2">
                <LazyEChart option={props.option} height={props.height} />
            </div>
        </div>
    );
}

/** Slice N periode terakhir; 0 = semua. */
function sliceRange(stats: PerformaPeriodStat[], range: number) {
    return range > 0 ? stats.slice(-range) : stats;
}

/** Rata-rata kapasitas harian: gram BJD per HK. */
function capacityOf(stat: PerformaPeriodStat | null) {
    return stat && stat.totalHk > 0 ? stat.totalBjd / stat.totalHk : null;
}

function ProductionCard({ stats }: { stats: PerformaPeriodStat[] }) {
    const [range, setRange] = useState(0);
    const visible = useMemo(() => sliceRange(stats, range), [stats, range]);

    const latest = stats[stats.length - 1] ?? null;
    const previous = stats.length > 1 ? stats[stats.length - 2] : null;

    const option = useMemo(() => {
        const labels = visible.map((stat) => stripPeriode(stat.label));
        const showLabel = visible.length <= MAX_LABELED_POINTS;
        const toKg = (grams: number | null) => (grams === null ? null : grams / 1000);

        return baseOption({
            labels,
            legend: true,
            series: [
                lineSeries({
                    name: 'Baku Basah',
                    color: BB_COLOR,
                    data: visible.map((stat) => toKg(stat.totalBakuBasah)),
                    area: true,
                    labelPosition: 'top',
                    showLabel,
                }),
                lineSeries({
                    name: 'Barang Jadi (BJD)',
                    color: BJD_COLOR,
                    data: visible.map((stat) => toKg(stat.totalBjd)),
                    area: true,
                    labelPosition: 'bottom',
                    showLabel,
                }),
            ],
        });
    }, [visible]);

    const bestKg = Math.max(...visible.map((stat) => stat.totalBjd ?? 0)) / 1000;

    return (
        <ChartCard
            title="Grafik Produksi"
            subtitle="Total Baku Basah vs Barang Jadi per periode (kg)"
            number="03"
            range={range}
            onRangeChange={setRange}
            totalPeriods={visible.length}
            heroValue={latest ? fmtId(latest.totalBjd / 1000, 1) : '–'}
            heroUnit="Kg"
            best={visible.length > 0 ? `${fmtId(bestKg, 1)} Kg` : '–'}
            growth={growthPct(latest?.totalBjd, previous?.totalBjd)}
            growthSuffix="%"
            option={option}
            height={280}
        />
    );
}

function EfficiencyCard({ stats }: { stats: PerformaPeriodStat[] }) {
    const [range, setRange] = useState(0);
    const visible = useMemo(() => sliceRange(stats, range), [stats, range]);

    const latest = stats[stats.length - 1] ?? null;
    const bestBps = visible.reduce<number | null>(
        (acc, stat) =>
            stat.weightedRendemenPctBps === null
                ? acc
                : Math.max(acc ?? Number.NEGATIVE_INFINITY, stat.weightedRendemenPctBps),
        null,
    );

    const option = useMemo(() => {
        const labels = visible.map((stat) => stripPeriode(stat.label));
        const showLabel = visible.length <= MAX_LABELED_POINTS;
        const pct = (bps: number | null) => (bps === null ? null : Math.round(bps) / 100);

        return baseOption({
            labels,
            legend: true,
            percent: true,
            series: [
                lineSeries({
                    name: 'Rendemen',
                    color: REND_COLOR,
                    data: visible.map((stat) => pct(stat.weightedRendemenPctBps)),
                    area: true,
                    labelPosition: 'top',
                    showLabel,
                }),
                lineSeries({
                    name: 'Susut Proses',
                    color: SP_COLOR,
                    data: visible.map((stat) => pct(stat.weightedSusutProsesPctBps)),
                    labelPosition: 'top',
                    showLabel,
                }),
                lineSeries({
                    name: 'Susut Hilang',
                    color: SH_COLOR,
                    data: visible.map((stat) => pct(stat.weightedSusutHilangPctBps)),
                    labelPosition: 'bottom',
                    showLabel,
                }),
            ],
        });
    }, [visible]);

    return (
        <ChartCard
            title="Grafik Efisiensi"
            subtitle="Rendemen tertimbang · rata-rata Susut Proses & Susut Hilang"
            range={range}
            onRangeChange={setRange}
            totalPeriods={visible.length}
            heroValue={latest ? fmtBpsId(latest.weightedRendemenPctBps) : '–'}
            best={bestBps === null ? '–' : fmtBpsId(bestBps)}
            growth={
                latest?.deltaRendemenPctBps == null ? null : latest.deltaRendemenPctBps / 100
            }
            growthSuffix="%"
            option={option}
            height={280}
        />
    );
}

function CapacityCard({ stats }: { stats: PerformaPeriodStat[] }) {
    const [range, setRange] = useState(0);
    const visible = useMemo(() => sliceRange(stats, range), [stats, range]);

    const latest = capacityOf(stats[stats.length - 1] ?? null);
    const previous = capacityOf(stats.length > 1 ? stats[stats.length - 2] : null);
    const best = visible.reduce<number | null>((acc, stat) => {
        const value = capacityOf(stat);
        return value === null ? acc : Math.max(acc ?? Number.NEGATIVE_INFINITY, value);
    }, null);

    const option = useMemo(() => {
        const labels = visible.map((stat) => stripPeriode(stat.label));
        const showLabel = visible.length <= MAX_LABELED_POINTS;

        return baseOption({
            labels,
            series: [
                lineSeries({
                    name: 'Gram BJD / HK',
                    color: CAPACITY_COLOR,
                    data: visible.map((stat) => capacityOf(stat)),
                    area: true,
                    labelPosition: 'top',
                    showLabel,
                }),
            ],
        });
    }, [visible]);

    return (
        <ChartCard
            title="Rata-rata Kapasitas Harian per Anak"
            subtitle="Gram Barang Jadi per HK di tiap periode"
            range={range}
            onRangeChange={setRange}
            totalPeriods={visible.length}
            heroValue={latest === null ? '–' : fmtId(latest, 1)}
            heroUnit="Gr"
            best={best === null ? '–' : `${fmtId(best, 1)} Gr`}
            growth={growthPct(latest, previous)}
            growthSuffix="%"
            option={option}
            height={240}
        />
    );
}

export default function PeriodTrends({ stats }: { stats: PerformaPeriodStat[] }) {
    if (stats.length === 0) return null;

    return (
        <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
                <ProductionCard stats={stats} />
                <EfficiencyCard stats={stats} />
            </div>
            <CapacityCard stats={stats} />
        </div>
    );
}
