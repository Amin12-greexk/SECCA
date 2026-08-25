import type { EChartsOption } from 'echarts';
import {
    CHART_INK,
    categoryAxis,
    fmtId,
    tooltipStyle,
    valueAxis,
} from '@/components/charts/chart-theme';
import { CAPACITY_BAND_RANGES, classifyCapacity } from './capacityBand';
import {
    CAPACITY_TARGETS,
    capacityTargetMarkLine,
    capacityTargetMarkPoint,
    type CapacityTargetCheckpoint,
    type CapacityTargetProgress,
} from './capacityTarget';

export type CapacityTrendPoint = {
    label: string;
    gramPerHk: number | null;
};

/** Ambang target tertinggi (35 g/hk) — sumbu Y minimal harus memuat ini. */
const HIGHEST_TARGET = Math.max(...CAPACITY_TARGETS.map((t) => t.value));

/**
 * Tren "Kapasitas" (gram BJD/HK) antar periode: pita latar merah/kuning/
 * hijau/biru menandai bandnya, tiap titik diwarnai sesuai band nilainya
 * sendiri — naik/turun dan pergeseran band langsung kelihatan tanpa tabel.
 * Dua garis putus-putus (kuning di 25 g/hk, hijau di 35 g/hk) menandai
 * target minggu ke-12 dan minggu ke-20; kalau periode saat anak itu genap
 * minggu segitu ada di data, ditambah checkpoint (belah ketupat) tepat di
 * titik itu — lihat capacityTarget.ts.
 */
export function capacityTrendOption(
    points: CapacityTrendPoint[],
    checkpoints: CapacityTargetCheckpoint[] = [],
    progress: CapacityTargetProgress | null = null,
): EChartsOption {
    const labels = points.map((p) => p.label);
    const values = points.map((p) => p.gramPerHk);
    // Sumbu Y cukup setinggi data + headroom, tapi selalu memuat garis target
    // tertinggi. Sebelumnya dipaksa minimal 75 g/hk sehingga anak yang masih
    // di kisaran 5–25 g/hk gepeng menempel di dasar chart.
    const highest = Math.max(HIGHEST_TARGET, ...values.filter((v): v is number => v != null));
    const yMax = Math.ceil((highest + 10) / 10) * 10;
    const checkpointByLabel = new Map(checkpoints.map((c) => [c.periodLabel, c]));

    return {
        // top dilebihkan supaya pin progres (yang nongol di atas titik datanya)
        // tidak kepotong; bottom juga sedikit lebih longgar untuk label sumbu-X.
        grid: { top: 44, right: 16, bottom: 50, left: 48 },
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
                const lines = [label];
                if (value == null) {
                    lines.push('–');
                } else {
                    const band = classifyCapacity(value);
                    lines.push(`<b>${fmtId(value, 1)} g/hk</b>${band ? ` · ${band.label}` : ''}`);
                }
                const checkpoint = checkpointByLabel.get(label);
                if (checkpoint) {
                    const verdict =
                        checkpoint.achieved == null
                            ? 'data kosong'
                            : checkpoint.achieved
                              ? 'tercapai'
                              : 'belum tercapai';
                    const evalLabel = checkpoint.isApprox
                        ? `Evaluasi ≈mgg ${checkpoint.actualWeeks} (checkpoint dini, target aslinya mgg ${checkpoint.weeks})`
                        : `Evaluasi mgg ${checkpoint.weeks}`;
                    lines.push(
                        `<span style="color:${checkpoint.color}">◆ ${evalLabel} — target ${fmtId(checkpoint.target, 0)} g/hk: <b>${verdict}</b></span>`,
                    );
                }
                if (progress && progress.periodLabel === label) {
                    const progressColor = progress.achievedEarly ? '#059669' : '#f59e0b';
                    const gap = Math.abs(progress.actual - progress.target);
                    const progressText = progress.achievedEarly
                        ? `mgg ${progress.tenureNow} kerja — sudah lampaui ${fmtId(gap, 1)} g/hk di atas target ${fmtId(progress.target, 0)} g/hk (tenggat mgg ${progress.weeks}, lebih cepat ${progress.weeksRemaining} minggu)`
                        : `mgg ${progress.tenureNow} kerja — masih kurang ${fmtId(gap, 1)} g/hk dari target ${fmtId(progress.target, 0)} g/hk (mgg ${progress.weeks}, sisa ${progress.weeksRemaining} minggu)`;
                    lines.push(
                        `<span style="color:${progressColor}">📍 <b>${progressText}</b></span>`,
                    );
                }
                return lines.join('<br/>');
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
                name: 'Aktual',
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
                // Pita latar band & garis target: tipe markArea/markLine ECharts tidak
                // dideklarasikan lengkap di typings paket ini, jadi objeknya di-cast langsung.
                markArea: {
                    silent: true,
                    itemStyle: { opacity: 0.07 },
                    data: CAPACITY_BAND_RANGES.map((band) => [
                        { yAxis: band.min, itemStyle: { color: band.color } },
                        { yAxis: band.max ?? yMax },
                    ]),
                },
                markLine: capacityTargetMarkLine(checkpoints),
                markPoint: capacityTargetMarkPoint(checkpoints, progress),
            },
        ],
    } as EChartsOption;
}
