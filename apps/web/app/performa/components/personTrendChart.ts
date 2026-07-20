import type { EChartsOption } from 'echarts';
import {
    CHART_FONT,
    CHART_INK,
    areaGradient,
    categoryAxis,
    fmtId,
    tooltipStyle,
    valueAxis,
} from '@/components/charts/chart-theme';

/**
 * Chart gabungan BJD + Rendemen dipakai di dua tempat (ranking & panel
 * individu) supaya kenaikan/penurunan anak terlihat konsisten di mana pun
 * dilihat. Diekstrak ke sini agar tidak ada dua implementasi yang bisa
 * diam-diam berbeda.
 */

export const REND_LINE_COLOR = '#2a78d6';

export type PersonBjdRendemenTrend = {
    labels: string[];
    bjd: Array<number | null>;
    /** Sudah dalam persen (bps ÷ 100). */
    rendemen: Array<number | null>;
};

/** BJD (garis area, sumbu kiri) + Rendemen (garis %, sumbu kanan) dalam satu chart. */
export function personTrendOption(
    trend: PersonBjdRendemenTrend,
    color: string,
): EChartsOption {
    const showLabel = trend.labels.length <= 14;

    const pillLabel = (pillColor: string, suffix: string, position: 'top' | 'bottom') => ({
        show: showLabel,
        position,
        distance: 5,
        formatter: (item: { value?: unknown }) =>
            item.value === null || item.value === undefined
                ? ''
                : `${fmtId(Number(item.value), 1)}${suffix}`,
        backgroundColor: pillColor,
        color: '#fff',
        fontSize: 10,
        fontWeight: 600 as const,
        fontFamily: CHART_FONT,
        padding: [2, 5] as [number, number],
        borderRadius: 4,
    });

    return {
        grid: { top: 46, right: 52, bottom: 46, left: 48 },
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
            axisPointer: {
                type: 'line',
                lineStyle: { color: CHART_INK.axis, width: 1, type: 'dashed' },
            },
            ...tooltipStyle,
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: trend.labels,
            ...categoryAxis,
            axisLabel: {
                ...categoryAxis.axisLabel,
                interval: trend.labels.length > 8 ? ('auto' as const) : 0,
                rotate: trend.labels.length > 4 ? 26 : 0,
                hideOverlap: true,
            },
        },
        yAxis: [
            {
                type: 'value',
                scale: true,
                ...valueAxis,
                axisLabel: {
                    ...valueAxis.axisLabel,
                    formatter: (value: number) => fmtId(value),
                },
            },
            {
                type: 'value',
                scale: true,
                ...valueAxis,
                splitLine: { show: false },
                axisLabel: {
                    ...valueAxis.axisLabel,
                    formatter: (value: number) => `${fmtId(value, 0)}%`,
                },
            },
        ],
        series: [
            {
                name: 'Barang Jadi (BJD)',
                type: 'line',
                yAxisIndex: 0,
                smooth: 0.35,
                symbol: 'circle',
                symbolSize: 6,
                connectNulls: false,
                lineStyle: { width: 2.5, color },
                itemStyle: { color, borderColor: '#fff', borderWidth: 2 },
                areaStyle: { color: areaGradient(color) },
                label: pillLabel(color, '', 'top'),
                tooltip: {
                    valueFormatter: (value) =>
                        value === null || value === undefined ? '–' : fmtId(Number(value), 1),
                },
                data: trend.bjd,
            },
            {
                name: 'Rendemen',
                type: 'line',
                yAxisIndex: 1,
                smooth: 0.35,
                symbol: 'circle',
                symbolSize: 6,
                connectNulls: false,
                lineStyle: { width: 2, color: REND_LINE_COLOR, type: 'dashed' },
                itemStyle: { color: REND_LINE_COLOR, borderColor: '#fff', borderWidth: 2 },
                label: pillLabel(REND_LINE_COLOR, '%', 'bottom'),
                tooltip: {
                    valueFormatter: (value) =>
                        value === null || value === undefined
                            ? '–'
                            : `${fmtId(Number(value), 1)}%`,
                },
                data: trend.rendemen,
            },
        ],
    };
}
