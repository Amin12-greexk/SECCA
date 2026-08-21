'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { EChartsOption } from 'echarts';
import {
    AlertTriangle,
    CalendarDays,
    Calculator,
    ChevronRight,
    Filter,
    LayoutGrid,
    Search,
    Table,
    TrendingUp,
    Trophy,
    Wallet,
} from 'lucide-react';
import MitraPayrollModal from './MitraPayrollModal';
import LazyEChart from '@/components/charts/LazyEChart';
import {
    categoryAxis,
    fmtBpsId,
    fmtId,
    stripPeriode,
    tooltipStyle,
    valueAxis,
    verticalGradient,
} from '@/components/charts/chart-theme';
import { useToast } from '@/lib/toast';
import {
    getPerformaSummary,
    getPerformaTrends,
    type PerformaPeriod,
    type PerformaPerson,
    type PerformaRow,
} from '@/lib/api';
import { personTrendOption, type PersonBjdRendemenTrend } from './personTrendChart';
import { describeTenure, isVeteranTenure } from './tenure';
import CapacityBadge from './CapacityBadge';
import { CAPACITY_BANDS, classifyCapacity, getMitraCapacityColor, type CapacityBand } from './capacityBand';
import { capacityTrendOption } from './capacityTrendChart';
import {
    CAPACITY_TARGETS,
    capacityTargetCheckpoints,
    capacityTargetProgress,
    PROGRESS_AHEAD_COLOR,
    PROGRESS_WARNING_COLOR,
    type CapacityTargetCheckpoint,
    type CapacityTargetProgress,
} from './capacityTarget';

/** HK per periode — bar chart sederhana, jumlah hari kerja. Dipindah dari IndividualPanel
 * supaya grafik anak terpilih jadi satu tempat (tidak ada 2 panel terpisah untuk data yang sama). */
function hkBarOption(labels: string[], points: Array<number | null>, color: string): EChartsOption {
    return {
        grid: { top: 10, right: 10, bottom: 44, left: 46 },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(17,24,39,0.04)' } },
            ...tooltipStyle,
            valueFormatter: (value) =>
                value === null || value === undefined ? '–' : fmtId(Number(value), 0),
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
            ...valueAxis,
            axisLabel: { ...valueAxis.axisLabel, formatter: (value: number) => fmtId(value) },
        },
        series: [
            {
                type: 'bar',
                data: points,
                barMaxWidth: 22,
                itemStyle: { color: verticalGradient(color), borderRadius: [4, 4, 0, 0] },
            },
        ],
    };
}

/**
 * Kapasitas mitra sebagai daftar (bukan bar chart raksasa) — jumlah anak
 * per periode bisa 200-an. Klik anak di daftar untuk melihat grafik
 * Barang Jadi (BJD) yang sudah dia kerjakan antar periode.
 */

type RankMetric = 'bjd' | 'rendemen' | 'hk';

/** Urutan tab mengikuti prioritas data: BJD dulu, lalu Rendemen, lalu HK. */
const METRICS: Array<{
    value: RankMetric;
    label: string;
    color: string;
    isBps: boolean;
    fd: number;
}> = [
    { value: 'bjd', label: 'BJD', color: '#008300', isBps: false, fd: 1 },
    { value: 'rendemen', label: 'Rendemen', color: '#2a78d6', isBps: true, fd: 1 },
    { value: 'hk', label: 'HK', color: '#eda100', isBps: false, fd: 0 },
];

const RANK_CLASS: Record<number, string> = {
    0: 'text-amber-500 font-bold',
    1: 'text-gray-500 font-bold',
    2: 'text-orange-400 font-bold',
};

/** Garis BJD di chart tren memakai hijau standar BJD (bukan warna identitas per anak). */
const BJD_LINE_COLOR = '#008300';

/** Trend chart butuh BJD & Rendemen; HK ditambah khusus untuk kalkulator estimasi di bawah. */
type PersonTrend = PersonBjdRendemenTrend & { hk: Array<number | null> };

function readMetric(row: PerformaRow, metric: RankMetric): number | null {
    switch (metric) {
        case 'rendemen':
            return row.rendemenPctBps ?? null;
        case 'hk':
            return row.hk ?? null;
        case 'bjd':
        default:
            // Kartu ranking menampilkan BJD produksi + reprocess digabung (total barang
            // jadi seutuhnya) — beda dengan bjd/HK band kapasitas & rendemen di bawah,
            // yang sengaja tetap murni produksi (lihat perDayOf & rendemenPctBps).
            return row.totalBjd != null || row.reprocessBjd != null
                ? (row.totalBjd ?? 0) + (row.reprocessBjd ?? 0)
                : null;
    }
}

/** Nilai harian: total ÷ HK; null bila HK kosong/nol. */
function perDayOf(
    row: PerformaRow | null,
    key: 'totalBjd' | 'totalBakuBasah',
): number | null {
    if (!row || row.hk == null || row.hk <= 0) return null;
    const value = row[key];
    return value == null ? null : value / row.hk;
}

export type WarningStatus = {
    hasWarning: boolean;
    isRedMonth: boolean;
    isUnder13TwoWeeks: boolean;
    reasons: string[];
};

/**
 * Aturan warning baru:
 * 1. Rule 1: 1 bulan (4 periode berturut-turut) di badge/warna merah (<25 g/HK).
 * 2. Rule 2: 2 minggu (2 periode berturut-turut) < 13 g/HK.
 */
function evaluateMitraWarning(
    personId: string,
    rowsByPeriod: Record<string, PerformaRow[]>,
    recentPeriods: PerformaPeriod[],
    currentRow: PerformaRow | null,
): WarningStatus {
    if (!currentRow) {
        return { hasWarning: false, isRedMonth: false, isUnder13TwoWeeks: false, reasons: [] };
    }

    const historyRows = recentPeriods.map((p) => {
        const isCurrentActive = p.id === (currentRow as { periodId?: string }).periodId;
        const rowFromPeriod = rowsByPeriod[p.id]?.find((r) => r.personId === personId);
        return {
            period: p,
            row: rowFromPeriod ?? (isCurrentActive ? currentRow : null),
        };
    });

    // Pastikan periode paling akhir (periode aktif) selalu memakai currentRow jika belum ada di historyRows
    if (recentPeriods.length > 0) {
        const lastIdx = historyRows.length - 1;
        if (!historyRows[lastIdx].row) {
            historyRows[lastIdx].row = currentRow;
        }
    }

    const dailyOutputs = historyRows.map((h) => (h.row ? perDayOf(h.row, 'totalBjd') : null));

    // Rule 1: 1 bulan (4 periode terakhir) berada di badge merah (<25 g/HK)
    // Harus benar-benar 4 periode valid berturut-turut — kalau datanya kurang
    // dari 4 (misalnya Perintis baru 2 minggu), TIDAK boleh dianggap 1 bulan.
    const last4Outputs = dailyOutputs.slice(-4);
    const validLast4 = last4Outputs.filter((v): v is number => v !== null);
    const isRedMonth =
        validLast4.length >= 4 && validLast4.every((val) => val < 25);

    // Rule 2: 2 minggu (2 periode terakhir) < 13 g/HK
    // Harus ada 2 periode valid; 1 periode saja belum cukup untuk warning ini.
    const last2Outputs = dailyOutputs.slice(-2);
    const validLast2 = last2Outputs.filter((v): v is number => v !== null);
    const isUnder13TwoWeeks =
        validLast2.length >= 2 && validLast2.every((val) => val < 13);

    const reasons: string[] = [];
    if (isRedMonth) {
        reasons.push('1 bulan di badge merah (<25 g/HK)');
    }
    if (isUnder13TwoWeeks) {
        reasons.push('2 minggu <13 g/HK');
    }

    return {
        hasWarning: isRedMonth || isUnder13TwoWeeks,
        isRedMonth,
        isUnder13TwoWeeks,
        reasons,
    };
}

/**
 * Rincian satu periode dipecah per hari kerja: BJD & Baku Basah dibagi HK
 * jadi angka harian; Rendemen/SP/SH tetap (rasio, tidak berubah oleh pembagian).
 */
function PerDayBreakdown({
    row,
    periodLabel,
}: {
    row: PerformaRow;
    periodLabel?: string;
}) {
    const hk = row.hk ?? null;
    const perDay = (value: number | null | undefined) =>
        hk && hk > 0 && value != null ? value / hk : null;

    const tenure = describeTenure(row.rawUserLevel, row.levelNumber);
    const bjdPerDay = perDay(row.totalBjd);

    const items: Array<{ label: string; value: string; strong?: boolean; badge?: number | null }> = [
        { label: 'Lama Kerja', value: tenure?.label ?? '–' },
        { label: 'HK', value: hk == null ? '–' : `${fmtId(hk, 0)} hari` },
        {
            label: 'BJD / hari',
            value: bjdPerDay == null ? '–' : `${fmtId(bjdPerDay, 1)} g`,
            strong: true,
            badge: bjdPerDay,
        },
        { label: 'Baku Basah / hari', value: perDay(row.totalBakuBasah) == null ? '–' : `${fmtId(perDay(row.totalBakuBasah) as number, 1)} g` },
        { label: 'Rendemen', value: fmtBpsId(row.rendemenPctBps) },
        { label: 'Susut Proses', value: fmtBpsId(row.susutProsesPctBps) },
        { label: 'Susut Hilang', value: fmtBpsId(row.susutHilangPctBps) },
    ];

    return (
        <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <CalendarDays className="h-3.5 w-3.5 text-green-600" />
                Rincian per hari kerja{periodLabel ? ` · ${periodLabel}` : ''}
            </p>
            {hk == null || hk <= 0 ? (
                <p className="text-xs text-gray-400">
                    HK tidak tersedia di periode ini, angka harian tidak bisa dihitung.
                </p>
            ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {items.map((item) => (
                        <div
                            key={item.label}
                            className={`rounded-md border px-2.5 py-1.5 ${
                                item.strong
                                    ? 'border-green-200 bg-green-50'
                                    : 'border-gray-100 bg-white'
                            }`}
                        >
                            <p className="text-[10px] uppercase tracking-wide text-gray-400">
                                {item.label}
                            </p>
                            <p
                                className={`flex items-center gap-1.5 text-sm font-bold ${
                                    item.strong ? 'text-green-700' : 'text-gray-900'
                                }`}
                            >
                                {item.value}
                                {item.badge !== undefined ? (
                                    <CapacityBadge gramPerHk={item.badge} variant="pill" />
                                ) : null}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/** Satu kolom periode dalam tabel perbandingan multi-periode. */
type WindowColumn = {
    period: PerformaPeriod;
    row: PerformaRow | null;
    isCurrent: boolean;
};

/** Titik warna kecil untuk legenda band kapasitas + garis target. Keterangan
 * garis target sengaja di legenda (bukan label di badan chart) supaya tidak
 * tabrakan dengan label titik data. Belah ketupat kecil = checkpoint di
 * chart, muncul persis di periode saat anak itu genap minggu segitu. */
function CapacityLegend() {
    return (
        <div className="flex flex-wrap items-center gap-2.5">
            {CAPACITY_BANDS.map((band) => (
                <span key={band.key} className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: band.color }} />
                    {band.label}
                </span>
            ))}
            {CAPACITY_TARGETS.map((t) => (
                <span key={t.weeks} className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                    <span className="flex items-center">
                        <span className="h-0 w-2.5 border-t-2 border-dashed" style={{ borderColor: t.color }} />
                        <span className="-ml-0.5 h-1.5 w-1.5 rotate-45" style={{ backgroundColor: t.color }} />
                    </span>
                    {t.label}
                </span>
            ))}
        </div>
    );
}

/**
 * Hasil evaluasi tiap checkpoint dalam bentuk teks — supaya penilaian
 * "tercapai/belum" terbaca tanpa harus hover belah ketupatnya di chart.
 * Checkpoint yang periodenya belum ada di data tidak muncul sama sekali.
 */
function CapacityCheckpointVerdicts({
    checkpoints,
}: {
    checkpoints: CapacityTargetCheckpoint[];
}) {
    if (checkpoints.length === 0) return null;

    return (
        <div className="mb-2 flex flex-wrap gap-2">
            {checkpoints.map((c) => (
                <span
                    key={c.weeks}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] ${
                        c.achieved
                            ? 'border-green-200 bg-green-50 text-green-800'
                            : c.achieved === false
                              ? 'border-red-200 bg-red-50 text-red-800'
                              : 'border-gray-200 bg-white text-gray-500'
                    }`}
                    title={`Periode ${c.periodLabel} — saat anak ini genap ${c.weeks} minggu kerja`}
                >
                    <span
                        className="h-2 w-2 rotate-45 border-2"
                        style={{
                            borderColor: c.color,
                            backgroundColor: c.achieved ? c.color : 'transparent',
                        }}
                    />
                    <b>Mgg {c.weeks}</b>
                    <span className="text-gray-400">·</span>
                    {c.actual == null ? 'data kosong' : `${fmtId(c.actual, 1)} / ${fmtId(c.target, 0)} g/hk`}
                    <span className="font-semibold">
                        {c.achieved ? '✓ tercapai' : c.achieved === false ? '✗ belum' : ''}
                    </span>
                    <span className="text-gray-400">({c.periodLabel})</span>
                </span>
            ))}
        </div>
    );
}

/**
 * Notifikasi "sedang berjalan" menuju target berikutnya yang belum jatuh tempo —
 * pelengkap CapacityCheckpointVerdicts yang cuma menilai tepat di minggu ke-12/20.
 * Cuma satu baris (target terdekat berikutnya saja) supaya tidak menumpuk dengan
 * badge checkpoint di atasnya.
 */
function CapacityProgressNotice({ progress }: { progress: CapacityTargetProgress | null }) {
    if (!progress) return null;
    const ahead = progress.achievedEarly;
    const color = ahead ? PROGRESS_AHEAD_COLOR : PROGRESS_WARNING_COLOR;
    const gap = Math.abs(progress.actual - progress.target);

    return (
        <div
            className={`mb-2 flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] ${
                ahead ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
            title={`Berdasarkan data terbaru — periode ${progress.periodLabel}`}
        >
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" style={{ color }} />
            {ahead ? (
                <span>
                    Sekarang <b>minggu ke-{progress.tenureNow}</b> kerja, kapasitas{' '}
                    <b>{fmtId(progress.actual, 1)} g/hk</b> — sudah{' '}
                    <b className="text-emerald-700">lampaui {fmtId(gap, 1)} g/hk</b> di atas target{' '}
                    {fmtId(progress.target, 0)} g/hk yang baru jatuh tempo minggu ke-{progress.weeks} (lebih cepat{' '}
                    {progress.weeksRemaining} minggu dari jadwal).
                </span>
            ) : (
                <span>
                    Sekarang <b>minggu ke-{progress.tenureNow}</b> kerja, kapasitas{' '}
                    <b>{fmtId(progress.actual, 1)} g/hk</b> — masih{' '}
                    <b className="text-amber-700">kurang {fmtId(gap, 1)} g/hk</b> dari target{' '}
                    {fmtId(progress.target, 0)} g/hk yang harus tercapai di minggu ke-{progress.weeks}, sisa{' '}
                    <b>{progress.weeksRemaining} minggu lagi</b>.
                </span>
            )}
        </div>
    );
}

/**
 * Tren kapasitas (gram BJD/HK) satu mitra melintasi N periode — grafik
 * garis dengan pita latar band & tiap titik diwarnai sesuai bandnya,
 * supaya naik/turun antar periode langsung kelihatan tanpa tabel.
 */
function CapacityTrendChart({
    columns,
    loading,
    missingLabels,
}: {
    columns: WindowColumn[];
    loading: boolean;
    missingLabels: string[];
}) {
    if (loading) {
        return <div className="h-[320px] animate-pulse rounded-lg bg-gray-50" />;
    }
    if (columns.length === 0) return null;

    const points = columns.map((c) => ({
        label: stripPeriode(c.period.label),
        gramPerHk: perDayOf(c.row, 'totalBjd'),
    }));
    const pointsWithRow = columns.map((c, i) => ({ ...points[i], row: c.row }));
    const checkpoints = capacityTargetCheckpoints(pointsWithRow);
    const progress = capacityTargetProgress(pointsWithRow);

    return (
        <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    Tren kapasitas · {columns.length} periode terakhir
                </p>
                <CapacityLegend />
            </div>

            {missingLabels.length > 0 ? (
                <p className="mb-2 rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                    Anak ini tidak punya data di: {missingLabels.join(', ')}.
                </p>
            ) : null}

            <CapacityCheckpointVerdicts checkpoints={checkpoints} />
            <CapacityProgressNotice progress={progress} />

            <LazyEChart option={capacityTrendOption(points, checkpoints, progress)} height={320} />
        </div>
    );
}

export default function MitraRanking({
    rows,
    periods,
    periodId,
    periodLabel,
    onSelect,
    externalSelectedId,
    persons,
    canManage,
    onColorSaved,
}: {
    rows: PerformaRow[];
    /** Semua periode (urut kronologis) — untuk pembanding tren, bukan ganti periode (itu di header halaman). */
    periods: PerformaPeriod[];
    periodId: string;
    periodLabel?: string;
    onSelect: (personId: string) => void;
    /** Anak yang dipilih dari luar (mis. klik di panel Payroll) — dashboard cuma
     * punya satu panel detail-anak sekarang, jadi ini harus dituruti. */
    externalSelectedId?: string | null;
    persons: PerformaPerson[];
    canManage: boolean;
    onColorSaved?: (person: PerformaPerson) => void;
}) {
    const toast = useToast();
    const [metric, setMetric] = useState<RankMetric>('bjd');
    const [search, setSearch] = useState('');
    /** Filter daftar anak berdasar band kapasitas gram/HK; null = semua. */
    const [bandFilter, setBandFilter] = useState<CapacityBand['key'] | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [activePayrollModalRow, setActivePayrollModalRow] = useState<PerformaRow | null>(null);
    const [trend, setTrend] = useState<PersonTrend | null>(null);
    const [loadingTrend, setLoadingTrend] = useState(false);
    /** Jumlah HK untuk estimasi barang jadi; default 5 hari kerja. */
    const [estDays, setEstDays] = useState(5);
    /** Jumlah periode yang dibandingkan sekaligus; 0 = semua periode. */
    const [periodWindow, setPeriodWindow] = useState(4);
    const [rowsByPeriod, setRowsByPeriod] = useState<Record<string, PerformaRow[]>>({});
    const [loadingWindow, setLoadingWindow] = useState(false);

    const active = METRICS.find((item) => item.value === metric) ?? METRICS[0];

    const currentIndex = periods.findIndex((period) => period.id === periodId);
    /** N periode terakhir yang berakhir tepat di periode aktif (urut kronologis). */
    const windowPeriods = useMemo(() => {
        if (currentIndex < 0) return [] as PerformaPeriod[];
        const size = periodWindow <= 0 ? periods.length : periodWindow;
        const start = Math.max(0, currentIndex - size + 1);
        return periods.slice(start, currentIndex + 1);
    }, [periods, currentIndex, periodWindow]);

    /** 4 periode terakhir (1 bulan) ending di periode aktif untuk evaluasi warning. */
    const recent4Periods = useMemo(() => {
        if (currentIndex < 0) return [] as PerformaPeriod[];
        const start = Math.max(0, currentIndex - 3);
        return periods.slice(start, currentIndex + 1);
    }, [periods, currentIndex]);

    // Data upload baru -> daftar periode berubah -> cache jendela basi.
    useEffect(() => {
        setRowsByPeriod({});
    }, [periods]);

    useEffect(() => {
        const requiredPeriods = Array.from(
            new Set([...windowPeriods.map((p) => p.id), ...recent4Periods.map((p) => p.id)]),
        );
        const missing = requiredPeriods.filter(
            (id) => id !== periodId && !(id in rowsByPeriod),
        );
        if (missing.length === 0) return;
        let alive = true;
        setLoadingWindow(true);
        Promise.all(
            missing.map((id) =>
                getPerformaSummary(id).then((data) => [id, data.rows] as const),
            ),
        )
            .then((entries) => {
                if (!alive) return;
                setRowsByPeriod((prev) => {
                    const next = { ...prev };
                    for (const [id, rws] of entries) next[id] = rws;
                    return next;
                });
            })
            .catch((error) => {
                if (alive) {
                    toast.error(
                        error instanceof Error ? error.message : 'Gagal memuat periode pembanding.',
                    );
                }
            })
            .finally(() => {
                if (alive) setLoadingWindow(false);
            });
        return () => {
            alive = false;
        };
        // toast stabil dari provider; tidak dijadikan dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [windowPeriods, recent4Periods, periodId]);

    const sorted = useMemo(() => {
        const query = search.trim().toLowerCase();
        return rows
            .filter((row) => {
                return (
                    (row.hk ?? 0) > 0 ||
                    (row.totalBjd ?? 0) > 0 ||
                    (row.totalBakuBasah ?? 0) > 0 ||
                    (row.netWageRp ?? 0) !== 0 ||
                    (row.pieceworkWageRp ?? 0) !== 0
                );
            })
            .filter((row) => (query ? row.name.toLowerCase().includes(query) : true))
            .filter((row) => {
                if (!bandFilter) return true;
                const isBulanan = /bulanan/i.test(row.normalizedLevel ?? row.rawUserLevel ?? '');
                if (bandFilter === 'purple') return isBulanan;
                if (isBulanan) return false;
                return classifyCapacity(perDayOf(row, 'totalBjd'))?.key === bandFilter;
            })
            .map((row) => ({ row, value: readMetric(row, metric) }))
            .filter((item): item is { row: PerformaRow; value: number } => item.value !== null)
            .sort((a, b) => b.value - a.value);
    }, [rows, metric, search, bandFilter]);

    const warningMap = useMemo(() => {
        const map: Record<string, WarningStatus> = {};
        for (const row of rows) {
            map[row.personId] = evaluateMitraWarning(
                row.personId,
                rowsByPeriod,
                recent4Periods,
                row,
            );
        }
        return map;
    }, [rows, rowsByPeriod, recent4Periods]);

    const warningCount = useMemo(
        () => rows.filter((row) => warningMap[row.personId]?.hasWarning).length,
        [rows, warningMap],
    );

    const redMonthCount = useMemo(
        () => rows.filter((row) => warningMap[row.personId]?.isRedMonth).length,
        [rows, warningMap],
    );

    const under13Count = useMemo(
        () => rows.filter((row) => warningMap[row.personId]?.isUnder13TwoWeeks).length,
        [rows, warningMap],
    );

    const selected = rows.find((row) => row.personId === selectedId) ?? null;
    const selectedColor = getMitraCapacityColor(selected);

    const windowColumns = useMemo<WindowColumn[]>(
        () =>
            windowPeriods.map((period) => ({
                period,
                isCurrent: period.id === periodId,
                row:
                    period.id === periodId
                        ? selected
                        : (rowsByPeriod[period.id]?.find((row) => row.personId === selectedId) ?? null),
            })),
        [windowPeriods, periodId, selected, rowsByPeriod, selectedId],
    );
    const missingWindowLabels = useMemo(
        () => windowColumns.filter((c) => !c.isCurrent && !c.row).map((c) => stripPeriode(c.period.label)),
        [windowColumns],
    );

    // Default: anak peringkat teratas — juga saat ganti periode dan anak
    // yang terpilih tidak punya data di periode baru. Kalau rows lagi kosong
    // (mis. sesaat setelah Reset Data / upload ulang), lepas dulu ke null
    // biar effect tren di bawah tidak sempat nembak getPerformaTrends untuk
    // personId yang sudah tidak ada lagi (404 "Data mitra tidak ditemukan").
    useEffect(() => {
        const stillExists =
            selectedId !== null && rows.some((row) => row.personId === selectedId);
        if (!stillExists) {
            setSelectedId(sorted.length > 0 ? sorted[0].row.personId : null);
        }
    }, [rows, sorted, selectedId]);

    // Pilihan dari luar (mis. klik baris di panel Payroll) harus tercermin di sini juga —
    // panel detail-anak di bawah cuma ada satu tempat sekarang, jadi harus selalu sinkron.
    useEffect(() => {
        if (externalSelectedId && externalSelectedId !== selectedId) {
            setSelectedId(externalSelectedId);
        }
        // selectedId sengaja tidak jadi dependency: ini cuma bereaksi ke perubahan dari luar,
        // klik di dalam komponen ini sendiri sudah diurus oleh pickPerson().
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [externalSelectedId]);

    /** Pilih anak dari dalam komponen ini + kabari parent, supaya state tetap sinkron
     * kalau ada bagian lain halaman yang juga mengikuti anak yang sedang dipilih. */
    const pickPerson = (personId: string) => {
        setSelectedId(personId);
        onSelect(personId);
    };

    useEffect(() => {
        if (!selectedId) {
            setTrend(null);
            return;
        }
        let alive = true;
        setLoadingTrend(true);
        Promise.all([
            getPerformaTrends([selectedId], 'totalBjd'),
            getPerformaTrends([selectedId], 'rendemen'),
            getPerformaTrends([selectedId], 'hk'),
        ])
            .then(([bjd, rendemen, hk]) => {
                if (!alive) return;
                setTrend({
                    labels: bjd.periods.map((period) => stripPeriode(period.label)),
                    bjd: bjd.series[0]?.points ?? [],
                    rendemen: (rendemen.series[0]?.points ?? []).map((point) =>
                        point === null ? null : Math.round(point) / 100,
                    ),
                    hk: hk.series[0]?.points ?? [],
                });
            })
            .catch((error) => {
                if (alive) {
                    toast.error(
                        error instanceof Error ? error.message : 'Gagal memuat grafik BJD anak.',
                    );
                }
            })
            .finally(() => {
                if (alive) setLoadingTrend(false);
            });
        return () => {
            alive = false;
        };
        // toast stabil dari provider; tidak dijadikan dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    const displayValue = (value: number) =>
        active.isBps ? `${fmtId(value / 100, active.fd)}%` : fmtId(value, active.fd);

    const fmtRp = (value: number | null | undefined) =>
        value === null || value === undefined
            ? '–'
            : new Intl.NumberFormat('id-ID', {
                  style: 'currency',
                  currency: 'IDR',
                  maximumFractionDigits: 0,
              }).format(value);

    const trendSummary = useMemo(() => {
        if (!trend) return null;
        const filled = trend.bjd.filter((point): point is number => point !== null);
        if (filled.length === 0) return null;

        // Rata-rata tertimbang: total BJD ÷ total HK seluruh periode aktif,
        // supaya periode dengan HK sedikit tidak mendistorsi angka harian.
        const totalBjd = filled.reduce((acc, point) => acc + point, 0);
        const totalHk = trend.hk.reduce<number>((acc, point) => acc + (point ?? 0), 0);

        return {
            total: totalBjd,
            periods: filled.length,
            avgPerHk: totalHk > 0 ? totalBjd / totalHk : null,
        };
    }, [trend]);

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-green-600" />
                    <div>
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            Kapasitas Mitra
                            <span className="font-mono text-[10px] font-normal text-gray-300">01</span>
                        </h2>
                        <p className="text-xs text-gray-400">
                            {periodLabel ? `${periodLabel} · ` : ''}
                            {rows.length} anak
                        </p>
                    </div>
                    {warningCount > 0 ? (
                        <span
                            className="ml-2 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 shadow-xs"
                            title={`Mitra Perlu Perhatian:\n• ${redMonthCount} mitra 1 bulan di badge merah (<25 g/HK)\n• ${under13Count} mitra 2 minggu <13 g/HK`}
                        >
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            {warningCount} mitra perlu perhatian
                        </span>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Toggle Mode: Grid vs Tabel Lengkap */}
                    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                viewMode === 'grid'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                            title="Tampilan Grid Kapasitas"
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Grid
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                viewMode === 'table'
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                            title="Tampilan Tabel Audit & Tarif Efektif"
                        >
                            <Table className="h-3.5 w-3.5" />
                            Tabel Detail
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Cari anak..."
                            className="w-44 rounded-lg border border-gray-300 bg-gray-50 py-1.5 pl-8 pr-3 text-sm transition focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                    </div>

                    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                        {METRICS.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => setMetric(item.value)}
                                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                    metric === item.value
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filter band kapasitas — mempersempit pencarian berdasar warna */}
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
                    <Filter className="h-3 w-3" />
                    Filter kapasitas:
                </span>
                <button
                    type="button"
                    onClick={() => setBandFilter(null)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        bandFilter === null
                            ? 'border-gray-800 bg-gray-800 text-white'
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    Semua
                </button>
                {CAPACITY_BANDS.map((band) => (
                    <button
                        key={band.key}
                        type="button"
                        onClick={() => setBandFilter((current) => (current === band.key ? null : band.key))}
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            bandFilter === band.key
                                ? 'border-transparent text-white'
                                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                        style={bandFilter === band.key ? { backgroundColor: band.color } : undefined}
                    >
                        <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: bandFilter === band.key ? '#fff' : band.color }}
                        />
                        {band.label}
                    </button>
                ))}
            </div>

            <div className="space-y-4">
                {viewMode === 'table' ? (
                    <div className="max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 bg-white">
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 z-10 bg-gray-50">
                                <tr className="border-b border-gray-200 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                    <th className="px-3 py-2.5">#</th>
                                    <th className="px-3 py-2.5">Nama &amp; Status</th>
                                    <th className="px-3 py-2.5">PIN</th>
                                    <th className="px-3 py-2.5">Level</th>
                                    <th className="px-3 py-2.5 text-right">HK</th>
                                    <th className="px-3 py-2.5 text-right">Jumlah LP</th>
                                    <th className="px-3 py-2.5 text-right">Total Baku</th>
                                    <th className="px-3 py-2.5 text-right">Total BJD</th>
                                    <th className="px-3 py-2.5 text-right">Rendemen</th>
                                    <th className="px-3 py-2.5 text-right">Upah</th>
                                    <th className="px-3 py-2.5 text-right">Tarif / Gram</th>
                                    <th className="px-3 py-2.5 text-right">Tarif / Kg</th>
                                    <th className="px-3 py-2.5 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {sorted.map((item, index) => {
                                    const row = item.row;
                                    const isSelected = row.personId === selectedId;
                                    const isBulanan = /bulanan/i.test(row.normalizedLevel ?? row.rawUserLevel ?? '');
                                    const band = classifyCapacity(perDayOf(row, 'totalBjd'));
                                    const dotColor = isBulanan ? '#8b5cf6' : (band?.color ?? '#d1d5db');
                                    const lpCount = row.lpCount ?? (row.lpRows?.length ?? (row.totalBakuBasah || row.totalBjd ? 1 : 0));

                                    return (
                                        <tr
                                            key={row.id}
                                            onClick={() => pickPerson(row.personId)}
                                            className={`hover:bg-gray-50/80 cursor-pointer transition-colors ${
                                                isSelected ? 'bg-green-50/60 font-medium' : ''
                                            }`}
                                        >
                                            <td className="px-3 py-2 font-mono text-gray-400">{index + 1}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="h-2 w-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: dotColor }}
                                                    />
                                                    <span className="font-semibold text-gray-800">{row.name}</span>
                                                    {isBulanan ? (
                                                        <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[9px] font-semibold text-purple-700 border border-purple-200">
                                                            Bulanan
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 font-mono text-gray-500">{row.pin ?? '–'}</td>
                                            <td className="px-3 py-2 text-gray-600">
                                                {isBulanan ? 'Bulanan (60rb/HK)' : (row.rawUserLevel ?? '–')}
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-700 font-medium">
                                                {row.hk != null ? fmtId(row.hk, 0) : '–'}
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-700">
                                                {lpCount} LP
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-700">
                                                {row.totalBakuBasah != null ? `${fmtId(row.totalBakuBasah, 1)} g` : '–'}
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-gray-900">
                                                {row.totalBjd != null || row.reprocessBjd != null
                                                    ? `${fmtId((row.totalBjd ?? 0) + (row.reprocessBjd ?? 0), 1)} g`
                                                    : '–'}
                                            </td>
                                            <td className="px-3 py-2 text-right text-blue-700 font-semibold">
                                                {fmtBpsId(row.rendemenPctBps)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-emerald-800">
                                                {isBulanan ? fmtRp(row.netWageRp) : fmtRp(row.pieceworkWageRp ?? row.netWageRp)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-600">
                                                {isBulanan || row.effectivePieceworkRatePerGramRp == null
                                                    ? '—'
                                                    : `${fmtRp(row.effectivePieceworkRatePerGramRp)}/g`}
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-600">
                                                {isBulanan || row.effectivePieceworkRatePerKgRp == null
                                                    ? '—'
                                                    : `${fmtRp(row.effectivePieceworkRatePerKgRp)}/kg`}
                                            </td>
                                            <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        pickPerson(row.personId);
                                                        setActivePayrollModalRow(row);
                                                    }}
                                                    className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700 hover:bg-green-100 cursor-pointer"
                                                >
                                                    <Wallet className="h-3 w-3" />
                                                    Detail
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* Daftar anak (ranking) — kartu grid, lebar penuh */
                    <div className="max-h-[360px] overflow-y-auto rounded-lg border border-gray-100 p-2">
                        {sorted.length === 0 ? (
                            <div className="flex h-[160px] items-center justify-center text-sm text-gray-400">
                                {search || bandFilter
                                    ? 'Tidak ada anak cocok filter ini.'
                                    : 'Tidak ada data untuk metrik ini.'}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {sorted.map((item, index) => {
                                    const isSelected = item.row.personId === selectedId;
                                    const warnStatus = warningMap[item.row.personId];
                                    const warn = warnStatus?.hasWarning;
                                    const isBulanan = /bulanan/i.test(item.row.normalizedLevel ?? item.row.rawUserLevel ?? '');
                                    const band = classifyCapacity(perDayOf(item.row, 'totalBjd'));
                                    const dotColor = isBulanan ? '#8b5cf6' : (band?.color ?? '#d1d5db');
                                    return (
                                        <button
                                            key={item.row.id}
                                            type="button"
                                            onClick={() => {
                                                pickPerson(item.row.personId);
                                                setActivePayrollModalRow(item.row);
                                            }}
                                            title={`${item.row.name}${isBulanan ? ' (Anak Bulanan - 60rb/HK)' : ''} - Klik untuk lihat detail pembayaran & gaji`}
                                            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all cursor-pointer ${
                                                isSelected
                                                    ? 'border-green-300 bg-green-50/70 shadow-xs'
                                                    : isBulanan
                                                      ? 'border-purple-200 bg-purple-50/30 hover:bg-purple-50/60'
                                                      : warn
                                                        ? 'border-amber-200 bg-amber-50/40 hover:bg-amber-50/70'
                                                        : 'border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                                            }`}
                                        >
                                            <span
                                                className={`w-5 shrink-0 text-right font-mono text-[10px] ${
                                                    RANK_CLASS[index] ?? 'text-gray-300'
                                                }`}
                                            >
                                                {index + 1}
                                            </span>
                                            {/* Satu titik saja: warna mengikuti band kapasitas / ungu untuk bulanan */}
                                            <span
                                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                style={{ backgroundColor: dotColor }}
                                            />
                                            <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800">
                                                {item.row.name}
                                            </span>
                                            {isBulanan ? (
                                                <span className="shrink-0 rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                                                    Bulanan
                                                </span>
                                            ) : null}
                                            {warn ? (
                                                <span title={`Warning:\n• ${warnStatus.reasons.join('\n• ')}`}>
                                                    <AlertTriangle
                                                        className={`h-3 w-3 shrink-0 ${
                                                            warnStatus.isRedMonth && warnStatus.isUnder13TwoWeeks
                                                                ? 'text-red-600 animate-pulse'
                                                                : warnStatus.isRedMonth
                                                                  ? 'text-red-500'
                                                                  : 'text-amber-500'
                                                        }`}
                                                        aria-label={warnStatus.reasons.join(', ')}
                                                    />
                                                </span>
                                            ) : null}
                                            <span className="shrink-0 text-xs font-semibold text-gray-900">
                                                {displayValue(item.value)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Grafik BJD anak terpilih — sekarang lebar penuh */}
                <div className="min-w-0 rounded-lg border border-gray-100 p-4">
                    {selected ? (
                        <>
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span
                                        className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white shadow-xs"
                                        style={{ backgroundColor: selectedColor }}
                                        title={selected ? (classifyCapacity(perDayOf(selected, 'totalBjd'))?.label ? `Kapasitas: ${classifyCapacity(perDayOf(selected, 'totalBjd'))?.label}` : 'Kapasitas Mitra') : ''}
                                    />
                                    <div className="min-w-0">
                                        <p className="flex items-center gap-2 truncate text-sm font-semibold text-gray-800">
                                            {selected.name}
                                            {(() => {
                                                const tenure = describeTenure(
                                                    selected.rawUserLevel,
                                                    selected.levelNumber,
                                                );
                                                return tenure ? (
                                                    <span
                                                        className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700"
                                                        title={selected.rawUserLevel ?? undefined}
                                                    >
                                                        {tenure.label}
                                                    </span>
                                                ) : null;
                                            })()}
                                            {selected && warningMap[selected.personId]?.hasWarning ? (
                                                <span
                                                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200"
                                                    title={`Warning:\n• ${warningMap[selected.personId].reasons.join('\n• ')}`}
                                                >
                                                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                                                    Warning: {warningMap[selected.personId].reasons.join(' · ')}
                                                </span>
                                            ) : null}
                                        </p>
                                        {trendSummary ? (
                                            <p className="text-[11px] text-gray-400">
                                                Total BJD {fmtId(trendSummary.total, 1)} ·{' '}
                                                {trendSummary.periods} periode aktif
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActivePayrollModalRow(selected)}
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 cursor-pointer"
                                >
                                    <Wallet className="h-3.5 w-3.5" />
                                    Detail Pembayaran
                                </button>
                            </div>

                            {/* Jumlah periode yang dibandingkan sekaligus */}
                            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                                <span className="text-gray-500">Bandingkan</span>
                                <select
                                    value={periodWindow}
                                    onChange={(event) => setPeriodWindow(Number(event.target.value))}
                                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs transition focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                    aria-label="Jumlah periode dibandingkan"
                                >
                                    <option value={2}>2 periode terakhir</option>
                                    <option value={4}>4 periode terakhir</option>
                                    <option value={8}>8 periode terakhir</option>
                                    <option value={0}>Semua periode</option>
                                </select>
                            </div>

                            {windowColumns.length > 1 ? (
                                /* Ditumpuk (bukan 2 kolom bersebelahan): grafik kapasitas butuh
                                 * lebar penuh supaya label periode & titik evaluasinya terbaca. */
                                <div className="space-y-3">
                                    <CapacityTrendChart
                                        columns={windowColumns}
                                        loading={loadingWindow}
                                        missingLabels={missingWindowLabels}
                                    />
                                    {loadingTrend || !trend ? (
                                        <div className="h-[300px] animate-pulse rounded-lg bg-gray-50" />
                                    ) : (
                                        <div>
                                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                                Barang jadi & rendemen per periode
                                            </p>
                                            <LazyEChart
                                                option={personTrendOption(trend, BJD_LINE_COLOR)}
                                                height={300}
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <PerDayBreakdown row={selected} periodLabel={periodLabel} />
                                    {loadingTrend || !trend ? (
                                        <div className="h-[300px] animate-pulse rounded-lg bg-gray-50" />
                                    ) : (
                                        <LazyEChart
                                            option={personTrendOption(trend, BJD_LINE_COLOR)}
                                            height={300}
                                        />
                                    )}
                                </>
                            )}

                            {!loadingTrend && trend ? (
                                <div className="mt-3">
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                        HK per periode
                                    </p>
                                    <LazyEChart
                                        option={hkBarOption(trend.labels, trend.hk, selectedColor)}
                                        height={120}
                                    />
                                </div>
                            ) : null}

                            {trendSummary?.avgPerHk != null ? (
                                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-green-100 bg-green-50/50 px-3 py-2 text-xs text-gray-600">
                                    <Calculator className="h-3.5 w-3.5 shrink-0 text-green-600" />
                                    <span>
                                        Rata-rata{' '}
                                        <b className="text-gray-900">
                                            {fmtId(trendSummary.avgPerHk, 1)} g/HK
                                        </b>
                                    </span>
                                    <span className="text-gray-300">·</span>
                                    <span>estimasi dengan</span>
                                    <select
                                        value={estDays}
                                        onChange={(event) =>
                                            setEstDays(Number(event.target.value))
                                        }
                                        className="rounded-md border border-gray-300 bg-white px-1.5 py-0.5 text-xs focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                        aria-label="Jumlah hari kerja untuk estimasi"
                                    >
                                        {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                                            <option key={days} value={days}>
                                                {days} HK
                                            </option>
                                        ))}
                                    </select>
                                    <span>
                                        ≈{' '}
                                        <b className="text-green-700">
                                            {fmtId(trendSummary.avgPerHk * estDays, 1)} g
                                        </b>{' '}
                                        barang jadi
                                    </span>
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
                            Klik anak di daftar untuk melihat grafik BJD-nya.
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Detail Pembayaran & Payroll Mitra */}
            <MitraPayrollModal
                isOpen={Boolean(activePayrollModalRow)}
                onClose={() => setActivePayrollModalRow(null)}
                row={activePayrollModalRow}
                periodLabel={periodLabel}
                warningInfo={activePayrollModalRow ? warningMap[activePayrollModalRow.personId] : undefined}
                onViewTrend={(personId) => pickPerson(personId)}
            />
        </div>
    );
}
