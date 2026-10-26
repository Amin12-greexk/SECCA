import type { EChartsOption } from 'echarts';
import { CHART_INK, categoryAxis, fmtId, tooltipStyle, valueAxis } from '@/components/charts/chart-theme';
import type { MitraPortalHarianWeek, MitraPortalWeek, PerformaLpRow } from '@/lib/api';
import { targetForWeek } from '../performa/components/bandProgression';
import { classifyCapacity, type CapacityBand } from '../performa/components/capacityBand';
import { formatPeriodLabel, formatPeriodShort } from '../performa/components/periodLabel';
import { isVeteranTenure, tenureWeeks } from '../performa/components/tenure';

export type MitraWeek = {
    key: string;
    label: string;
    shortLabel: string;
    level: string | null;
    isBulanan: boolean;
    isCabutRumah: boolean;
    hk: number | null;
    bakuBasah: number | null;
    /** BJD produksi + reprocess (barang jadi seutuhnya). */
    bjd: number | null;
    reprocessBjd: number | null;
    rendemenPctBps: number | null;
    /** g BJD produksi / HK — sama dengan dashboard performa. */
    capacity: number | null;
    band: CapacityBand | null;
    target: number | null;
    lpRows: PerformaLpRow[];
    pay: {
        borong: number | null;
        subsidi: number | null;
        premi: number | null;
        makan: number | null;
        potongan: number | null;
        total: number | null;
        cabutRumah: { rate: number | null; qty: number | null } | null;
    };
};

export function toWeeks(periods: MitraPortalWeek[]): MitraWeek[] {
    return periods.map(({ period, row }) => {
        const level = row.rawUserLevel ?? null;
        const isBulanan = /bulanan/i.test(row.normalizedLevel ?? level ?? '');
        const isCabutRumah = /cabut rumah/i.test(level ?? '');
        const hk = row.hk ?? null;
        const prodBjd = row.totalBjd ?? null;
        const reprocessBjd = row.reprocessBjd ?? null;
        const capacity = hk && hk > 0 && prodBjd != null ? prodBjd / hk : null;
        const tenure = tenureWeeks(level, row.levelNumber);
        const target = isBulanan || isCabutRumah
            ? null
            : tenure != null
              ? targetForWeek(tenure)
              : isVeteranTenure(level, row.levelNumber)
                ? targetForWeek(Infinity)
                : null;

        return {
            key: period.id,
            label: formatPeriodLabel(period),
            shortLabel: formatPeriodShort(period),
            level,
            isBulanan,
            isCabutRumah,
            hk,
            bakuBasah: row.totalBakuBasah ?? null,
            bjd: prodBjd != null || reprocessBjd != null ? (prodBjd ?? 0) + (reprocessBjd ?? 0) : null,
            reprocessBjd,
            rendemenPctBps: row.rendemenPctBps ?? null,
            capacity,
            band: isBulanan || isCabutRumah ? null : classifyCapacity(capacity),
            target,
            lpRows: (row.lpRows ?? []).filter(
                (lp) => lp.transactionType !== 'REPROCESS' && lp.transactionType !== 'UNKNOWN',
            ),
            pay: {
                borong: row.pieceworkWageRp ?? row.upahBorongRp ?? null,
                subsidi: row.subsidyRp ?? null,
                premi: row.premiumRp ?? null,
                makan: row.mealAllowanceRp ?? null,
                potongan: row.deductionRp ?? null,
                total: row.netWageRp ?? null,
                cabutRumah: isCabutRumah
                    ? { rate: row.cabutRumahRatePerUnitRp ?? null, qty: row.cabutRumahQty ?? null }
                    : null,
            },
        };
    });
}

/** Satu minggu anak harian (Cleaning Service, QC, dst): hanya gaji. */
export type HarianWeek = {
    key: string;
    label: string;
    bagian: string | null;
    hariKerja: number | null;
    hariKerjaRaw: string | null;
    pay: Array<[label: string, value: number | null]>;
    potongan: number | null;
    total: number | null;
};

export function toHarianWeeks(rows: MitraPortalHarianWeek[]): HarianWeek[] {
    return rows.map(({ period, row }) => ({
        key: period.id,
        label: formatPeriodLabel(period),
        bagian: row.bagian,
        hariKerja: row.hariKerja,
        hariKerjaRaw: row.hariKerjaRaw,
        pay: [
            ['Upah', row.upahRp],
            ['Lembur hari biasa', row.upahLemburWeekdayRp],
            ['Lembur Sabtu/Minggu', row.upahLemburWeekendRp],
            ['Uang makan', row.uangMakanRp],
            ['Premi', row.premiRp],
            ['Tunjangan', row.tunjanganRp],
        ],
        // Di Excel potongan kadang ditulis negatif, kadang positif.
        potongan: row.potonganRp == null ? null : Math.abs(row.potonganRp),
        total: row.totalUpahRp,
    }));
}

export const fmtRp = (value: number | null | undefined) =>
    value == null
        ? '–'
        : new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              maximumFractionDigits: 0,
          }).format(value);

const TARGET_COLOR = '#374151';
const LINE_COLOR = '#059833';

/** Kapasitas per minggu (titik berwarna sesuai band) vs garis target. */
export function capacityChartOption(weeks: MitraWeek[]): EChartsOption {
    const labels = weeks.map((w) => w.shortLabel);
    const actual = weeks.map((w) => (w.capacity == null ? null : Math.round(w.capacity * 10) / 10));
    const target = weeks.map((w) => w.target);
    const values = [...actual, ...target].filter((v): v is number => v != null);
    const yMax = Math.max(60, Math.ceil((Math.max(0, ...values) + 5) / 10) * 10);

    return {
        grid: { top: 30, right: 12, bottom: 28, left: 34 },
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
            valueFormatter: (value) => (value == null ? '–' : `${fmtId(Number(value), 1)} g/HK`),
        },
        xAxis: {
            ...categoryAxis,
            type: 'category',
            data: labels,
            axisLabel: { ...categoryAxis.axisLabel, fontSize: 10, hideOverlap: true },
        },
        yAxis: { ...valueAxis, type: 'value', min: 0, max: yMax, axisLabel: { ...valueAxis.axisLabel, fontSize: 10 } },
        series: [
            {
                name: 'Target',
                type: 'line',
                step: 'middle',
                data: target,
                symbol: 'none',
                color: TARGET_COLOR,
                lineStyle: { color: TARGET_COLOR, width: 1.5, type: 'dashed' },
            },
            {
                name: 'Kapasitas saya',
                type: 'line',
                smooth: 0.3,
                data: actual,
                connectNulls: true,
                color: LINE_COLOR,
                symbol: 'circle',
                symbolSize: 9,
                lineStyle: { color: LINE_COLOR, width: 2.5 },
                itemStyle: {
                    color: (p: { value?: unknown }) =>
                        typeof p.value === 'number' ? (classifyCapacity(p.value)?.color ?? LINE_COLOR) : LINE_COLOR,
                    borderColor: '#fff',
                    borderWidth: 1.5,
                },
            },
        ],
    };
}
