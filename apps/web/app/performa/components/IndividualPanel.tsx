'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { User } from 'lucide-react';
import LazyEChart from '@/components/charts/LazyEChart';
import {
    categoryAxis,
    fmtId,
    stripPeriode,
    tooltipStyle,
    valueAxis,
    verticalGradient,
} from '@/components/charts/chart-theme';
import { useToast } from '@/lib/toast';
import {
    getPerformaTrends,
    updatePerformaPersonColor,
    type PerformaPerson,
    type PerformaRow,
    type PerformaTrendResponse,
} from '@/lib/api';
import { personTrendOption, type PersonBjdRendemenTrend } from './personTrendChart';
import { describeTenure } from './tenure';

type TrendBundle = {
    bjd: PerformaTrendResponse;
    rendemen: PerformaTrendResponse;
    hk: PerformaTrendResponse;
};

/** HK per periode — bar chart sederhana, jumlah hari kerja. */
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

export default function IndividualPanel({
    personId,
    persons,
    currentRow,
    periodLabel,
    canManage,
    onColorSaved,
}: {
    personId: string | null;
    persons: PerformaPerson[];
    /** Baris anak ini di periode terpilih; bisa kosong kalau dia absen. */
    currentRow: PerformaRow | null;
    periodLabel?: string;
    canManage: boolean;
    onColorSaved: (person: PerformaPerson) => void;
}) {
    const toast = useToast();
    const [bundle, setBundle] = useState<TrendBundle | null>(null);
    const [loading, setLoading] = useState(false);
    const [draftColor, setDraftColor] = useState<string | null>(null);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const person = persons.find((item) => item.id === personId) ?? null;
    const color = draftColor ?? person?.colorHex ?? '#2a78d6';

    useEffect(() => {
        setDraftColor(null);
    }, [personId]);

    useEffect(() => () => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
    }, []);

    useEffect(() => {
        if (!personId) {
            setBundle(null);
            return;
        }
        let active = true;
        setLoading(true);
        Promise.all([
            getPerformaTrends([personId], 'totalBjd'),
            getPerformaTrends([personId], 'rendemen'),
            getPerformaTrends([personId], 'hk'),
        ])
            .then(([bjd, rendemen, hk]) => {
                if (active) setBundle({ bjd, rendemen, hk });
            })
            .catch((error) => {
                if (active) {
                    toast.error(error instanceof Error ? error.message : 'Gagal memuat data anak.');
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
        // toast stabil dari provider; tidak dijadikan dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [personId]);

    // Drag color picker menembak banyak event — simpan setelah jeda 450ms.
    const handleColor = (hex: string) => {
        if (!personId) return;
        setDraftColor(hex);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            try {
                const updated = await updatePerformaPersonColor(personId, hex);
                onColorSaved(updated);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Gagal menyimpan warna.');
            }
        }, 450);
    };

    const labels = useMemo(
        () => (bundle?.bjd.periods ?? []).map((period) => stripPeriode(period.label)),
        [bundle],
    );

    // BJD + Rendemen digabung satu chart (sama seperti panel Kapasitas Mitra
    // di atas) supaya naik-turunnya langsung terlihat dalam satu grafik.
    const combinedTrend = useMemo<PersonBjdRendemenTrend | null>(() => {
        if (!bundle) return null;
        return {
            labels,
            bjd: bundle.bjd.series[0]?.points ?? [],
            rendemen: (bundle.rendemen.series[0]?.points ?? []).map((point) =>
                point === null ? null : Math.round(point) / 100,
            ),
        };
    }, [bundle, labels]);

    const hkPoints = useMemo(() => bundle?.hk.series[0]?.points ?? [], [bundle]);

    if (!person) return null;

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    {canManage ? (
                        <label
                            className="relative inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full shadow-sm ring-2 ring-white"
                            style={{ backgroundColor: color }}
                            title="Ubah warna anak ini"
                        >
                            <input
                                type="color"
                                value={color}
                                onChange={(event) => handleColor(event.target.value)}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                aria-label={`Warna ${person.name}`}
                            />
                        </label>
                    ) : (
                        <span
                            className="h-9 w-9 shrink-0 rounded-full shadow-sm ring-2 ring-white"
                            style={{ backgroundColor: color }}
                        />
                    )}
                    <div>
                        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                            {person.name}
                            <span className="font-mono text-[10px] font-normal text-gray-300">02</span>
                        </h2>
                        <p className="text-xs text-gray-400">
                            {currentRow?.rawUserLevel ?? 'Performa Individu'}
                            {(() => {
                                const tenure = describeTenure(
                                    currentRow?.rawUserLevel,
                                    currentRow?.levelNumber,
                                );
                                return tenure ? ` · ${tenure.label}` : '';
                            })()}
                            {' · '}
                            {person.totalPeriods} periode
                        </p>
                    </div>
                </div>

                {currentRow ? (
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: 'BJD', value: fmtId(currentRow.totalBjd ?? 0, 1) },
                            {
                                label: 'Rend',
                                value:
                                    currentRow.rendemenPctBps == null
                                        ? '–'
                                        : `${fmtId(currentRow.rendemenPctBps / 100, 1)}%`,
                            },
                            { label: 'HK', value: fmtId(currentRow.hk ?? 0, 0) },
                        ].map((chip) => (
                            <span
                                key={chip.label}
                                className="inline-flex items-baseline gap-1.5 rounded-lg border border-gray-100 bg-gray-50/70 px-2.5 py-1"
                            >
                                <span className="text-[10px] uppercase tracking-wide text-gray-400">
                                    {chip.label}
                                </span>
                                <span className="text-sm font-bold text-gray-900">{chip.value}</span>
                            </span>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-gray-400">
                        Tidak ada data di {periodLabel ?? 'periode ini'}.
                    </p>
                )}
            </div>

            {loading || !combinedTrend ? (
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="h-[220px] animate-pulse rounded-lg bg-gray-50 lg:col-span-2" />
                    <div className="h-[220px] animate-pulse rounded-lg bg-gray-50" />
                </div>
            ) : (
                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                            <User className="h-3 w-3 text-gray-300" />
                            Barang Jadi (BJD) &amp; Rendemen
                        </p>
                        <LazyEChart option={personTrendOption(combinedTrend, color)} height={220} />
                    </div>
                    <div>
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                            <User className="h-3 w-3 text-gray-300" />
                            HK
                        </p>
                        <LazyEChart option={hkBarOption(labels, hkPoints, color)} height={220} />
                    </div>
                </div>
            )}
        </div>
    );
}
