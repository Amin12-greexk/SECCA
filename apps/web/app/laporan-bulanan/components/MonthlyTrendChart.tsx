'use client';

import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import LazyEChart from '@/components/charts/LazyEChart';
import {
    CHART_FONT,
    CHART_INK,
    areaGradient,
    categoryAxis,
    fmtId,
    tooltipStyle,
    valueAxis,
    zoomConfig,
} from '@/components/charts/chart-theme';
import type { AuditMonthlyPeriod } from '@/lib/api';

const BJD_COLOR = '#008300';
const REND_COLOR = '#1baf7a';

/** Total BJD (kg) & Rendemen (%) per bulan dalam satu chart 2-sumbu-Y — sama
 * persis polanya dengan chart tren periode di /performa (PeriodTrends.tsx),
 * cuma disederhanakan ke 1 kartu karena scope-nya cuma 2 metrik. */
export default function MonthlyTrendChart({ months }: { months: AuditMonthlyPeriod[] }) {
    const option = useMemo<EChartsOption>(() => {
        const labels = months.map((m) => m.label);
        const bjdKg = months.map((m) => m.totalBjd / 1000);
        const rendemenPct = months.map((m) =>
            m.weightedRendemenPctBps === null ? null : m.weightedRendemenPctBps / 100,
        );

        return {
            grid: { top: 40, right: 48, bottom: 46, left: 56 },
            dataZoom: zoomConfig(labels.length),
            legend: {
                top: 0,
                left: 'center',
                icon: 'circle',
                itemWidth: 8,
                itemHeight: 8,
                itemGap: 14,
                textStyle: { fontSize: 11, color: CHART_INK.secondary, fontFamily: CHART_FONT },
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'line', lineStyle: { color: CHART_INK.axis, width: 1, type: 'dashed' } },
                ...tooltipStyle,
                valueFormatter: (value) =>
                    value === null || value === undefined ? '–' : fmtId(Number(value), 1),
            },
            xAxis: {
                type: 'category',
                data: labels,
                boundaryGap: false,
                ...categoryAxis,
                axisLabel: { ...categoryAxis.axisLabel, hideOverlap: true },
            },
            yAxis: [
                {
                    type: 'value',
                    name: 'Total BJD (kg)',
                    nameTextStyle: { color: CHART_INK.secondary, fontSize: 11, fontFamily: CHART_FONT },
                    scale: true,
                    ...valueAxis,
                    axisLabel: { ...valueAxis.axisLabel, formatter: (v: number) => fmtId(v) },
                },
                {
                    type: 'value',
                    name: 'Rendemen (%)',
                    nameTextStyle: { color: CHART_INK.secondary, fontSize: 11, fontFamily: CHART_FONT },
                    scale: true,
                    ...valueAxis,
                    axisLabel: { ...valueAxis.axisLabel, formatter: (v: number) => `${fmtId(v, 0)}%` },
                    splitLine: { show: false },
                },
            ],
            series: [
                {
                    name: 'Total BJD',
                    type: 'line',
                    yAxisIndex: 0,
                    smooth: 0.35,
                    symbol: 'circle',
                    symbolSize: 6,
                    connectNulls: false,
                    lineStyle: { width: 2.5, color: BJD_COLOR },
                    itemStyle: { color: BJD_COLOR, borderColor: '#fff', borderWidth: 2 },
                    areaStyle: { color: areaGradient(BJD_COLOR) },
                    data: bjdKg,
                },
                {
                    name: 'Rendemen',
                    type: 'line',
                    yAxisIndex: 1,
                    smooth: 0.35,
                    symbol: 'circle',
                    symbolSize: 6,
                    connectNulls: false,
                    lineStyle: { width: 2.5, color: REND_COLOR },
                    itemStyle: { color: REND_COLOR, borderColor: '#fff', borderWidth: 2 },
                    data: rendemenPct,
                },
            ],
        };
    }, [months]);

    return <LazyEChart option={option} height={340} />;
}
