import type { EChartsOption } from 'echarts';
import {
    CHART_INK,
    categoryAxis,
    fmtId,
    tooltipStyle,
    valueAxis,
} from '@/components/charts/chart-theme';
import { CAPACITY_BAND_RANGES, classifyCapacity } from './capacityBand';

export type CapacityTrendPoint = {
    label: string;
    gramPerHk: number | null;
};

/**
 * Tren "Kapasitas" (gram BJD/HK) antar periode: pita latar merah/kuning/
 * hijau/biru menandai bandnya, tiap titik diwarnai sesuai band nilainya
 * sendiri — naik/turun dan pergeseran band langsung kelihatan tanpa tabel.
 */
export function capacityTrendOption(points: CapacityTrendPoint[]): EChartsOption {
    const labels = points.map((p) => p.label);
    const values = points.map((p) => p.gramPerHk);
    const highest = Math.max(75, ...values.filter((v): v is number => v != null));
    const yMax = Math.ceil((highest + 10) / 10) * 10;

    return {
        grid: { top: 24, right: 16, bottom: 46, left: 48 },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'line',
                lineStyle: { color: CHART_INK.axis, width: 1, type: 'dashed' },
            },
            ...tooltipStyle,
            formatter: (params) => {
                const first = Array.isArray(params) ? params[0] : params;
                const info = first as { value?: unknown; axisValueLabel?: string };
                const value = typeof info.value === 'number' ? info.value : null;
                const label = info.axisValueLabel ?? '';
                if (value == null) return `${label}<br/>–`;
                const band = classifyCapacity(value);
                return `${label}<br/><b>${fmtId(value, 1)} g/hk</b>${band ? ` · ${band.label}` : ''}`;
            },
        },
        xAxis: {
            type: 'category',
            data: labels,
            ...categoryAxis,
            axisLabel: {
                ...categoryAxis.axisLabel,
                interval: labels.length > 8 ? ('auto' as const) : 0,
                rotate: labels.length > 4 ? 26 : 0,
                hideOverlap: true,
            },
        },
        yAxis: {
            type: 'value',
            min: 0,
            max: yMax,
            ...valueAxis,
            axisLabel: { ...valueAxis.axisLabel, formatter: (value: number) => `${fmtId(value, 0)}g` },
        },
        series: [
            {
                type: 'line',
                connectNulls: false,
                smooth: 0.3,
                symbol: 'circle',
                symbolSize: 9,
                lineStyle: { width: 2.5, color: '#4b5563' },
                data: values.map((value) => {
                    if (value == null) return null;
                    const band = classifyCapacity(value);
                    return {
                        value,
                        itemStyle: {
                            color: band?.color ?? '#9ca3af',
                            borderColor: '#fff',
                            borderWidth: 2,
                        },
                    };
                }),
                label: {
                    show: labels.length <= 14,
                    position: 'top',
                    distance: 8,
                    fontSize: 10,
                    fontWeight: 700 as const,
                    color: CHART_INK.primary,
                    formatter: (item: { value?: unknown }) =>
                        item.value == null ? '' : fmtId(Number(item.value), 1),
                },
                // Pita latar band: tipe markArea ECharts tidak dideklarasikan lengkap
                // di typings paket ini, jadi objeknya di-cast langsung.
                markArea: {
                    silent: true,
                    itemStyle: { opacity: 0.07 },
                    data: CAPACITY_BAND_RANGES.map((band) => [
                        { yAxis: band.min, itemStyle: { color: band.color } },
                        { yAxis: band.max ?? yMax },
                    ]),
                },
            },
        ],
    } as EChartsOption;
}
