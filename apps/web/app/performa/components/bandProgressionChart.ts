import type { EChartsOption } from 'echarts';
import {
    CHART_INK,
    areaGradient,
    categoryAxis,
    fmtId,
    tooltipStyle,
    valueAxis,
} from '@/components/charts/chart-theme';
import { classifyCapacity } from './capacityBand';
import type { PersonProgression, TargetVsActual } from './bandProgression';

const TARGET_COLOR = '#374151';
const ACTUAL_COLOR = '#059833';
const PERSON_COLOR = '#2a78d6';

/**
 * Grafik naik-turun "target vs realita" per minggu kerja: garis tangga
 * target (25 → 35 → 45 g/HK) dibanding rata-rata kapasitas nyata semua anak
 * di minggu kerja yang sama. Kalau satu anak dipilih, garisnya ditimpa di
 * atas rata-rata (yang dibuat pudar) supaya langsung terlihat ia di atas
 * atau di bawah target.
 */
export function targetVsActualOption(data: TargetVsActual, person: PersonProgression | null): EChartsOption {
    const labels = data.weeks.map(String);
    const personSeries = person
        ? data.weeks.map((w) => {
              const hits = person.points.filter((p) => p.t === w);
              return hits.length ? hits.reduce((s, p) => s + p.gramPerHk, 0) / hits.length : null;
          })
        : null;

    const values = [
        ...data.target,
        ...data.actual.filter((v): v is number => v != null),
        ...(personSeries ?? []).filter((v): v is number => v != null),
    ];
    const yMax = Math.ceil((Math.max(...values) + 5) / 10) * 10;

    const bandDot = (value: unknown, fallback: string) =>
        typeof value === 'number' ? (classifyCapacity(value)?.color ?? fallback) : fallback;

    return {
        grid: { top: 36, right: 16, bottom: 34, left: 40 },
        legend: {
            top: 0,
            left: 0,
            icon: 'roundRect',
            itemWidth: 14,
            itemHeight: 4,
            textStyle: { color: CHART_INK.secondary, fontSize: 11 },
        },
        tooltip: {
            trigger: 'axis',
            ...tooltipStyle,
            formatter: (params) => {
                const list = (Array.isArray(params) ? params : [params]) as Array<{
                    seriesName?: string;
                    value?: unknown;
                    dataIndex: number;
                    color?: string;
                }>;
                const i = list[0]?.dataIndex ?? 0;
                const target = data.target[i];
                const lines = [`<b>Minggu kerja ${data.weeks[i]}</b>`];
                for (const item of list) {
                    if (typeof item.value !== 'number') continue;
                    const gap = item.seriesName === 'Target' ? '' : ` (${item.value >= target ? '+' : ''}${fmtId(item.value - target, 1)})`;
                    lines.push(`${item.seriesName}: <b>${fmtId(item.value, 1)}</b> g/HK${gap}`);
                }
                if (data.sample[i]) lines.push(`<span style="color:#9ca3af">${data.sample[i]} anak</span>`);
                return lines.join('<br/>');
            },
        },
        xAxis: {
            type: 'category',
            data: labels,
            boundaryGap: false,
            name: 'minggu kerja',
            nameLocation: 'middle',
            nameGap: 22,
            nameTextStyle: { color: CHART_INK.muted, fontSize: 10 },
            ...categoryAxis,
        },
        yAxis: { type: 'value', min: 0, max: yMax, ...valueAxis },
        series: [
            {
                name: 'Target',
                type: 'line',
                step: 'middle',
                data: data.target,
                symbol: 'none',
                lineStyle: { color: TARGET_COLOR, width: 2, type: 'dashed' },
                itemStyle: { color: TARGET_COLOR },
                z: 3,
            },
            {
                name: 'Realita rata-rata',
                type: 'line',
                // Warna seri (dipakai legenda) — itemStyle.color di bawah fungsi per titik.
                color: ACTUAL_COLOR,
                data: data.actual,
                smooth: 0.3,
                connectNulls: true,
                symbol: 'circle',
                symbolSize: person ? 0 : 7,
                lineStyle: { color: ACTUAL_COLOR, width: person ? 1.5 : 2.5, opacity: person ? 0.35 : 1 },
                itemStyle: {
                    color: (p: { value?: unknown }) => bandDot(p.value, ACTUAL_COLOR),
                    borderColor: '#fff',
                    borderWidth: 1.5,
                },
                areaStyle: person ? undefined : { color: areaGradient(ACTUAL_COLOR) },
                z: 2,
            },
            ...(personSeries && person
                ? [
                      {
                          name: person.name,
                          type: 'line' as const,
                          color: PERSON_COLOR,
                          data: personSeries,
                          connectNulls: true,
                          symbol: 'circle',
                          symbolSize: 8,
                          lineStyle: { color: PERSON_COLOR, width: 2.5 },
                          itemStyle: {
                              color: (p: { value?: unknown }) => bandDot(p.value, PERSON_COLOR),
                              borderColor: '#fff',
                              borderWidth: 1.5,
                          },
                          z: 4,
                      },
                  ]
                : []),
        ],
    };
}
