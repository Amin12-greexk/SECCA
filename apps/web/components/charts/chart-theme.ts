/**
 * Token visual chart — sengaja bebas dari import 'echarts' supaya file ini
 * aman di-import dari mana saja (termasuk jalur SSR) tanpa menyeret bundle
 * echarts. Bentuk gradient di bawah pakai notasi objek biasa yang memang
 * dimengerti ECharts, jadi tidak perlu echarts.graphic.
 */

export const CHART_INK = {
    primary: '#111827',
    secondary: '#6b7280',
    muted: '#9ca3af',
    grid: '#f1f5f9',
    axis: '#e5e7eb',
};

export const CHART_FONT =
    'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * Palet kategorikal urutan tetap (tidak pernah di-cycle), sama dengan
 * fallback di backend. Sudah lolos cek kontras + colour-blind separation.
 */
export const CATEGORICAL = [
    '#2a78d6', '#008300', '#e87ba4', '#eda100',
    '#1baf7a', '#eb6834', '#4a3aa7', '#e34948',
];

/** #rrggbb -> rgba(r,g,b,a) */
export function withAlpha(hex: string, alpha: number): string {
    const clean = hex.replace('#', '');
    const value =
        clean.length === 3
            ? clean.split('').map((char) => char + char).join('')
            : clean;
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return hex;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Gradient vertikal (notasi objek ECharts). */
export function verticalGradient(color: string, from = 0.85, to = 0.35) {
    return {
        type: 'linear' as const,
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
            { offset: 0, color: withAlpha(color, from) },
            { offset: 1, color: withAlpha(color, to) },
        ],
    };
}

/** Gradient horizontal untuk bar mendatar (ranking). */
export function horizontalGradient(color: string, from = 0.45, to = 0.95) {
    return {
        type: 'linear' as const,
        x: 0,
        y: 0,
        x2: 1,
        y2: 0,
        colorStops: [
            { offset: 0, color: withAlpha(color, from) },
            { offset: 1, color: withAlpha(color, to) },
        ],
    };
}

/** "periode 18-24 juni" -> "18-24 juni" — hemat ruang di sumbu X. */
export const stripPeriode = (label: string) => label.replace(/^periode\s*/i, '');

/** Gradient untuk area di bawah garis. */
export function areaGradient(color: string) {
    return {
        type: 'linear' as const,
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
            { offset: 0, color: withAlpha(color, 0.26) },
            { offset: 1, color: withAlpha(color, 0.01) },
        ],
    };
}

/** Tooltip seragam: kartu putih, radius, shadow lembut. */
export const tooltipStyle = {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderColor: 'rgba(17,24,39,0.08)',
    borderWidth: 1,
    padding: [10, 12] as [number, number],
    textStyle: { color: CHART_INK.primary, fontSize: 12, fontFamily: CHART_FONT },
    extraCssText: 'border-radius:10px;box-shadow:0 8px 24px rgba(17,24,39,0.10);',
};

export const axisLabel = {
    fontSize: 11,
    color: CHART_INK.muted,
    fontFamily: CHART_FONT,
};

export const splitLine = {
    lineStyle: { color: CHART_INK.grid, width: 1 },
};

/** Sumbu kategori: garis tipis, tanpa tick menonjol. */
export const categoryAxis = {
    axisLine: { lineStyle: { color: CHART_INK.axis } },
    axisTick: { show: false },
    axisLabel,
};

/** Sumbu nilai: tanpa garis sumbu, hanya split line resesif. */
export const valueAxis = {
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine,
    axisLabel,
};

export const fmtId = (value: number, fd = 0) =>
    new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: fd,
        maximumFractionDigits: fd,
    }).format(value);

/** bps -> "76,0%" (1% = 100 bps). */
export const fmtBpsId = (value: number | null | undefined, fd = 1) =>
    value === null || value === undefined ? '–' : `${fmtId(value / 100, fd)}%`;
