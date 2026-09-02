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

/** Total BJD (kg) per bulan — sama persis polanya dengan chart tren periode
 * di /performa (PeriodTrends.tsx), cuma disederhanakan ke 1 seri karena
 * scope-nya cuma Barang Jadi. */
export default function MonthlyTrendChart({ months }: { months: AuditMonthlyPeriod[] }) {
    const option = useMemo<EChartsOption>(() => {
        const labels = months.map((m) => m.label);
        const bjdKg = months.map((m) => m.totalBjd / 1000);

        return {
            grid: { top: 24, right: 24, bottom: 46, left: 56 },
            dataZoom: zoomConfig(labels.length),
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'line', lineStyle: { color: CHART_INK.axis, width: 1, type: 'dashed' } },
                ...tooltipStyle,
                valueFormatter: (value) =>
                    value === null || value === undefined ? '–' : `${fmtId(Number(value), 1)} kg`,
            },
            xAxis: {
                type: 'category',
                data: labels,
                boundaryGap: false,
                ...categoryAxis,
                axisLabel: { ...categoryAxis.axisLabel, hideOverlap: true },
            },
            yAxis: {
                type: 'value',
                name: 'Total BJD (kg)',
                nameTextStyle: { color: CHART_INK.secondary, fontSize: 11, fontFamily: CHART_FONT },
                scale: true,
                ...valueAxis,
                axisLabel: { ...valueAxis.axisLabel, formatter: (v: number) => fmtId(v) },
            },
            series: [
                {
                    name: 'Total BJD',
                    type: 'line',
                    smooth: 0.35,
                    symbol: 'circle',
                    symbolSize: 6,
                    connectNulls: false,
                    lineStyle: { width: 2.5, color: BJD_COLOR },
                    itemStyle: { color: BJD_COLOR, borderColor: '#fff', borderWidth: 2 },
                    areaStyle: { color: areaGradient(BJD_COLOR) },
                    data: bjdKg,
                },
            ],
        };
    }, [months]);

    return <LazyEChart option={option} height={340} />;
}
