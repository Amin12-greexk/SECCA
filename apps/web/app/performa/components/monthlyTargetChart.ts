import type { EChartsOption } from 'echarts';
import {
    CHART_FONT,
    CHART_INK,
    categoryAxis,
    fmtId,
    tooltipStyle,
    valueAxis,
    verticalGradient,
} from '@/components/charts/chart-theme';

/** Warna disamakan dengan BJD (hijau) & garis target mgg-12 (kuning) yang
 * sudah dipakai di grafik kapasitas per anak, supaya "aktual vs target"
 * terbaca sama di mana pun dilihat. */
const ACTUAL_COLOR = '#008300';
const TARGET_COLOR = '#eda100';

export type MonthlyTargetPoint = {
    /** "Bulan 1", "Bulan 2", ... */
    label: string;
    /** Rentang tanggal blok, untuk tooltip. */
    rangeLabel: string;
    /** Gram — dikonversi ke kg di sini supaya sumbu tidak penuh angka ratusan ribu. */
    actualBjd: number;
    targetBjd: number;
    totalHk: number;
    achievementPct: number | null;
    /** Berapa mitra memenuhi target angkatannya — hanya muncul di tooltip,
     * supaya badan grafik tidak penuh angka. */
    meetCount: number;
    personCount: number;
};

/**
 * Target bulanan vs realisasi: bar realisasi + garis target, label persen
 * pencapaian di atas tiap bar.
 *
 * Garis targetnya sengaja BUKAN garis datar — targetnya ikut bergerak tiap
 * bulan karena dihitung dari Σ (target g/hk tiap mitra × HK dia bulan itu):
 * naik saat mitra melewati minggu ke-12 (25 → 35 g/hk) atau jumlah mitra
 * bertambah, turun saat HK bulan itu sedikit (banyak libur). Itu yang membuat
 * perbandingannya adil antar bulan.
 */
export function monthlyTargetOption(points: MonthlyTargetPoint[]): EChartsOption {
    const labels = points.map((p) => p.label);
    const toKg = (grams: number) => grams / 1000;

    return {
        grid: { top: 44, right: 20, bottom: 28, left: 52 },
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
            axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(17,24,39,0.04)' } },
            ...tooltipStyle,
            formatter: (params) => {
                const list = Array.isArray(params) ? params : [params];
                const index = (list[0] as { dataIndex?: number }).dataIndex ?? 0;
                const point = points[index];
                if (!point) return '';
                const verdict =
                    point.achievementPct === null
                        ? '–'
                        : `<b style="color:${point.achievementPct >= 100 ? ACTUAL_COLOR : TARGET_COLOR}">${fmtId(
                              point.achievementPct,
                              1,
                          )}%</b> dari target`;
                return [
                    `${point.label} · ${point.rangeLabel}`,
                    `Realisasi: <b>${fmtId(toKg(point.actualBjd), 1)} kg</b>`,
                    `Target: <b>${fmtId(toKg(point.targetBjd), 1)} kg</b>`,
                    verdict,
                    `<span style="color:${CHART_INK.secondary}">${point.meetCount} dari ${point.personCount} mitra penuhi target · ${fmtId(
                        point.totalHk,
                        0,
                    )} HK</span>`,
                ].join('<br/>');
            },
        },
        xAxis: {
            type: 'category',
            data: labels,
            ...categoryAxis,
            axisLabel: {
                ...categoryAxis.axisLabel,
                interval: 0,
                rotate: 0,
                hideOverlap: true,
            },
        },
        yAxis: {
            type: 'value',
            ...valueAxis,
            axisLabel: {
                ...valueAxis.axisLabel,
                formatter: (value: number) => `${fmtId(value, 0)}kg`,
            },
        },
        series: [
            {
                name: 'Realisasi',
                type: 'bar',
                barMaxWidth: 46,
                itemStyle: { color: verticalGradient(ACTUAL_COLOR), borderRadius: [4, 4, 0, 0] },
                data: points.map((p) => toKg(p.actualBjd)),
                label: {
                    show: true,
                    // DI DALAM bar, bukan di atasnya: begitu realisasi mendekati
                    // target (mis. 96%), label di atas bar bertabrakan dengan
                    // garis target yang persis lewat di situ.
                    position: 'insideTop',
                    distance: 8,
                    fontSize: 11,
                    fontWeight: 700 as const,
                    fontFamily: CHART_FONT,
                    color: '#fff',
                    // Persen pencapaian, bukan angka kg-nya: nilai kg sudah
                    // terbaca dari tinggi bar & sumbu, yang tidak terbaca justru
                    // seberapa jauh dari targetnya.
                    formatter: (item: { dataIndex?: number }) => {
                        const point = points[item.dataIndex ?? -1];
                        if (!point || point.achievementPct === null) return '';
                        return `${fmtId(point.achievementPct, 0)}%`;
                    },
                },
            },
            {
                name: 'Target',
                type: 'line',
                smooth: 0.25,
                symbol: 'circle',
                symbolSize: 7,
                lineStyle: { width: 2.5, color: TARGET_COLOR, type: 'dashed' },
                itemStyle: { color: TARGET_COLOR, borderColor: '#fff', borderWidth: 2 },
                data: points.map((p) => toKg(p.targetBjd)),
                z: 3,
            },
        ],
    } as EChartsOption;
}
