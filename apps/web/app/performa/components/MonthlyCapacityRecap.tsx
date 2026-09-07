'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Target } from 'lucide-react';
import { useToast } from '@/lib/toast';
import { getPerformaSummary, type PerformaPeriod, type PerformaRow } from '@/lib/api';
import { fmtId } from '@/components/charts/chart-theme';
import { formatPeriodLabel } from './periodLabel';
import { classifyCapacity } from './capacityBand';
import {
    aggregateBlock,
    blockTargetSummary,
    blockTierBreakdown,
    buildMonthBlocks,
    isBlockLoaded,
    TARGET_TIERS,
    type MonthBlock,
    type PersonBlockAggregate,
} from './capacityMonthlyRecap';

type MonthlyMeterPoint = {
    blockIndex: number;
    label: string;
    rangeLabel: string;
    actualBjd: number;
    targetBjd: number;
    achievementPct: number | null;
};

type StatusFilter = 'all' | 'penuhi' | 'belum';

/** Label rentang tanggal satu blok: gabungan startDate periode pertama +
 * endDate periode terakhir, lewat formatPeriodLabel yang sama dipakai di
 * seluruh halaman supaya bentuknya konsisten ("7 Mei – 3 Jun 2026"). */
function blockLabel(block: MonthBlock): string {
    const first = block.periods[0];
    const last = block.periods[block.periods.length - 1];
    if (!first || !last) return '';
    return formatPeriodLabel({
        label: '',
        startDate: first.startDate,
        endDate: last.endDate,
    });
}

/**
 * Rekap bulanan target kapasitas.
 *
 * Dua pertanyaan berbeda dijawab di satu panel:
 * 1. Grafik — target BJD sebulan (Σ target g/hk tiap mitra × HK-nya) vs
 *    realisasinya, jadi kelihatan targetnya ikut naik saat mitra melewati
 *    minggu ke-12 atau jumlah mitra bertambah.
 * 2. Daftar — SIAPA yang rata-rata sebulan ini tembus ambang kuning (25 g/hk)
 *    / hijau (35 g/hk), ambang yang sama dipakai grafik tren per-anak.
 *
 * "Sebulan" = blok 4 periode mingguan berturut-turut (lihat
 * capacityMonthlyRecap.ts) — periode aslinya tidak selaras kalender, jadi
 * dipakai konvensi yang sama dengan aturan warning "1 bulan" yang sudah ada.
 */
export default function MonthlyCapacityRecap({
    periods,
    onSelect,
}: {
    /** Urut kronologis, sama seperti dipakai MitraRanking. */
    periods: PerformaPeriod[];
    onSelect?: (personId: string) => void;
}) {
    const toast = useToast();
    const blocks = useMemo(() => buildMonthBlocks(periods), [periods]);
    const [blockIndex, setBlockIndex] = useState(() => Math.max(0, blocks.length - 1));
    const [rowsByPeriod, setRowsByPeriod] = useState<Record<string, PerformaRow[]>>({});
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

    // Data baru/reset -> jumlah blok berubah; balik ke blok terakhir yang valid.
    useEffect(() => {
        setBlockIndex((current) => Math.min(current, Math.max(0, blocks.length - 1)));
    }, [blocks.length]);

    const currentBlock = blocks[blockIndex] ?? null;
    const previousBlock = blockIndex > 0 ? blocks[blockIndex - 1] : null;

    /** Grafiknya menampilkan SEMUA bulan sekaligus, jadi seluruh periode
     * memang dibutuhkan — diambil sekali di awal (paralel), bukan menyusul
     * tiap kali blok diganti. */
    useEffect(() => {
        if (periods.length === 0) return;
        let alive = true;
        setLoading(true);
        Promise.all(periods.map((p) => getPerformaSummary(p.id).then((data) => [p.id, data.rows] as const)))
            .then((entries) => {
                if (!alive) return;
                setRowsByPeriod(Object.fromEntries(entries));
            })
            .catch((error) => {
                if (alive) toast.error(error instanceof Error ? error.message : 'Gagal memuat rekap bulanan.');
            })
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
        // toast stabil dari provider; tidak dijadikan dependency.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periods]);

    const ready = currentBlock ? isBlockLoaded(currentBlock, rowsByPeriod) : false;
    const currentAgg = useMemo(
        () => (currentBlock && ready ? aggregateBlock(currentBlock, rowsByPeriod) : null),
        [currentBlock, ready, rowsByPeriod],
    );
    const previousReady = previousBlock ? isBlockLoaded(previousBlock, rowsByPeriod) : true;
    const previousAgg = useMemo(
        () => (previousBlock && previousReady ? aggregateBlock(previousBlock, rowsByPeriod) : null),
        [previousBlock, previousReady, rowsByPeriod],
    );

    const rows = useMemo(() => {
        if (!currentAgg) return [] as Array<PersonBlockAggregate & { newlyMeets: boolean }>;
        return Array.from(currentAgg.values())
            // Tanpa HK bulan ini = tidak masuk kerja, tidak ada yang bisa
            // dinilai. Ikut disaring supaya panjang daftar sama dengan penyebut
            // "x dari y mitra" di kartu.
            .filter((agg) => agg.sumHk > 0)
            .map((agg) => {
                const prev = previousAgg?.get(agg.personId) ?? null;
                return { ...agg, newlyMeets: agg.meetsTarget && prev != null && !prev.meetsTarget };
            })
            .sort((a, b) => (b.avgGramPerHk ?? -1) - (a.avgGramPerHk ?? -1));
    }, [currentAgg, previousAgg]);

    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase();
        return rows
            .filter((r) => (query ? r.name.toLowerCase().includes(query) : true))
            .filter((r) => {
                if (statusFilter === 'penuhi') return r.meetsTarget;
                if (statusFilter === 'belum') return !r.meetsTarget;
                return true;
            });
    }, [rows, search, statusFilter]);

    const newlyMeetsCount = rows.filter((r) => r.newlyMeets).length;

    /** Satu meter per blok bulan — blok yang datanya belum lengkap dilewati
     * supaya tidak muncul sebagai bulan yang seolah anjlok ke 0. */
    const monthlyMeters = useMemo<MonthlyMeterPoint[]>(() => {
        return blocks
            .map((block, index) => ({ block, index }))
            .filter(({ block }) => isBlockLoaded(block, rowsByPeriod))
            .map(({ block, index }) => {
                const summary = blockTargetSummary(block, rowsByPeriod);
                return {
                    blockIndex: index,
                    label: `Bulan ${index + 1}`,
                    rangeLabel: blockLabel(block),
                    actualBjd: summary.actualBjd,
                    targetBjd: summary.targetBjd,
                    achievementPct: summary.achievementPct,
                };
            });
    }, [blocks, rowsByPeriod]);

    /** Rincian target bulan yang sedang dilihat, per angkatan — jawaban
     * langsung atas "target segini dari mana asalnya". */
    const tierBreakdown = useMemo(
        () => (currentBlock && ready ? blockTierBreakdown(currentBlock, rowsByPeriod) : []),
        [currentBlock, ready, rowsByPeriod],
    );

    // Kartu ringkasan memakai populasi yang SAMA dengan target (mitra borong
    // ber-HK, tanpa Bulanan/Cabut Rumah) — kalau memakai total kotor halaman
    // utama, satu panel akan memuat dua angka "total BJD" yang berbeda.
    const currentSummary = currentBlock ? blockTargetSummary(currentBlock, rowsByPeriod) : null;
    const previousSummary = previousBlock ? blockTargetSummary(previousBlock, rowsByPeriod) : null;
    const totalBjd = currentSummary?.actualBjd ?? 0;
    const prevTotalBjd = previousSummary && previousSummary.totalHk > 0 ? previousSummary.actualBjd : null;
    const growthBjd = prevTotalBjd != null ? totalBjd - prevTotalBjd : null;
    const growthPct = prevTotalBjd != null && prevTotalBjd > 0 ? (growthBjd! / prevTotalBjd) * 100 : null;
    const avgGrowth =
        currentSummary?.avgGramPerHk != null && previousSummary?.avgGramPerHk != null
            ? currentSummary.avgGramPerHk - previousSummary.avgGramPerHk
            : null;

    if (!currentBlock) return null;

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex justify-end">
                <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50/70 px-2 py-1.5">
                    <button
                        type="button"
                        onClick={() => setBlockIndex((i) => Math.max(0, i - 1))}
                        disabled={blockIndex <= 0}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Bulan sebelumnya"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <p className="min-w-[11rem] text-center text-xs font-semibold text-gray-900">
                        Bulan {blockIndex + 1}
                        <span className="block font-normal text-gray-400">{blockLabel(currentBlock)}</span>
                    </p>
                    <button
                        type="button"
                        onClick={() => setBlockIndex((i) => Math.min(blocks.length - 1, i + 1))}
                        disabled={blockIndex >= blocks.length - 1}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-30"
                        aria-label="Bulan berikutnya"
                    >
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* Tangga target — aturannya, di LUAR meter supaya tiap baris
                meter di bawah tidak perlu mengulang keterangan yang sama. */}
            <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
                {TARGET_TIERS.map((tier, index) => (
                    <div key={tier.key} className="flex items-center gap-2">
                        {index > 0 ? <span className="text-gray-300">→</span> : null}
                        <span className="flex items-center gap-1.5 text-xs">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tier.color }} />
                            <span className="text-gray-500">{tier.label}</span>
                            <span className="font-semibold text-gray-900">{fmtId(tier.value, 0)} g/hk</span>
                        </span>
                    </div>
                ))}
            </div>

            {/* Meter pencapaian per bulan — klik satu baris untuk pindah ke
                bulan itu, jadi dobel fungsi dengan panah prev/next di atas. */}
            <div className="mb-4 flex flex-col gap-2">
                {monthlyMeters.length === 0 ? (
                    <div className="h-[88px] animate-pulse rounded-lg bg-gray-100/70" />
                ) : (
                    monthlyMeters.map((point) => {
                        const isCurrent = point.blockIndex === blockIndex;
                        const hit = point.achievementPct != null && point.achievementPct >= 100;
                        return (
                            <button
                                key={point.blockIndex}
                                type="button"
                                onClick={() => setBlockIndex(point.blockIndex)}
                                className={`w-full rounded-lg border p-2.5 text-left transition-colors cursor-pointer ${
                                    isCurrent
                                        ? 'border-green-300 bg-green-50/60'
                                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                }`}
                            >
                                <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                                    <span className="font-semibold text-gray-800">
                                        {point.label}
                                        <span className="ml-1.5 font-normal text-gray-400">{point.rangeLabel}</span>
                                    </span>
                                    <span className="shrink-0 font-semibold text-gray-900">
                                        {fmtId(point.actualBjd / 1000, 1)} / {fmtId(point.targetBjd / 1000, 1)} kg
                                        <span className={`ml-1.5 ${hit ? 'text-green-600' : 'text-amber-600'}`}>
                                            {point.achievementPct != null ? `${fmtId(point.achievementPct, 0)}%` : '–'}
                                        </span>
                                    </span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                                    <div
                                        className={`h-full rounded-full ${hit ? 'bg-green-600' : 'bg-amber-500'}`}
                                        style={{ width: `${Math.min(point.achievementPct ?? 0, 100)}%` }}
                                    />
                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            {/* Rincian target bulan terpilih per angkatan — jawaban langsung
                "target segini dari mana": tiap angkatan hari kerjanya berapa,
                target gram/hari-kerjanya berapa (sesuai tangga di atas),
                jumlahnya berapa kg. Istilah ditulis lengkap ("hari kerja",
                bukan "HK") karena panel ini justru tempat menjelaskan
                singkatan itu ke pembaca yang belum tentu tahu — beda dengan
                daftar mitra di bawah yang boleh pakai singkatan karena
                sudah dijelaskan di sini duluan. */}
            <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <Target className="h-3.5 w-3.5 text-amber-500" />
                    Kenapa target bulan ini {currentSummary ? fmtId(currentSummary.targetBjd / 1000, 1) : '–'} kg
                </p>
                <p className="mb-2 text-[11px] text-gray-400">
                    Rumus: target gram per hari kerja tiap angkatan × jumlah hari kerja aktual angkatan itu bulan ini, lalu dijumlah semua angkatan.
                </p>
                {tierBreakdown.length === 0 ? (
                    <div className="h-[80px] animate-pulse rounded-lg bg-gray-100/70" />
                ) : (
                    <div className="flex flex-col gap-2">
                        {tierBreakdown.map((row) => (
                            <div key={row.tier.key} className="flex flex-col gap-0.5">
                                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs">
                                    <span className="flex items-center gap-1.5 text-gray-700">
                                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.tier.color }} />
                                        {row.tier.label}
                                        <span className="text-gray-400">· {row.personCount} mitra</span>
                                    </span>
                                    <span className="font-semibold text-gray-900">
                                        {fmtId(row.targetGram / 1000, 1)} kg
                                    </span>
                                </div>
                                <p className="pl-3.5 text-[11px] text-gray-400">
                                    {fmtId(row.totalHk, 0)} hari kerja × {fmtId(row.tier.value, 0)} gram per hari kerja
                                </p>
                            </div>
                        ))}
                        <div className="mt-1 flex items-center justify-between border-t border-gray-200 pt-1.5 text-xs font-semibold text-gray-900">
                            <span>Total target bulan ini</span>
                            <span>{currentSummary ? fmtId(currentSummary.targetBjd / 1000, 1) : '–'} kg</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        Realisasi BJD Bulan Ini
                    </p>
                    <p className="mt-0.5 text-xl font-bold text-gray-900">{fmtId(totalBjd / 1000, 1)} kg</p>
                    {growthBjd != null ? (
                        <p className={`mt-0.5 text-[11px] font-medium ${growthBjd >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {growthBjd >= 0 ? '▲' : '▼'} {fmtId(Math.abs(growthBjd) / 1000, 1)} kg
                            {growthPct != null ? ` (${growthPct >= 0 ? '+' : ''}${fmtId(growthPct, 1)}%)` : ''} vs bulan lalu
                        </p>
                    ) : (
                        <p className="mt-0.5 text-[11px] text-gray-400">Belum ada bulan pembanding</p>
                    )}
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        Target Bulan Ini
                    </p>
                    <p className="mt-0.5 text-xl font-bold text-gray-900">
                        {currentSummary ? fmtId(currentSummary.targetBjd / 1000, 1) : '–'} kg
                    </p>
                    <p
                        className={`mt-0.5 text-[11px] font-medium ${
                            currentSummary?.achievementPct != null && currentSummary.achievementPct >= 100
                                ? 'text-green-600'
                                : 'text-amber-600'
                        }`}
                    >
                        {currentSummary?.achievementPct != null
                            ? `Tercapai ${fmtId(currentSummary.achievementPct, 1)}% · ${fmtId(
                                  currentSummary.totalHk,
                                  0,
                              )} HK`
                            : 'Belum ada HK bulan ini'}
                    </p>
                </div>

                <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">
                        Penuhi Target Sendiri
                    </p>
                    <p className="mt-0.5 text-xl font-bold text-gray-900">
                        {currentSummary?.meetPct != null ? `${fmtId(currentSummary.meetPct, 0)}%` : '–'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-emerald-700">
                        {currentSummary
                            ? `${currentSummary.meetCount} dari ${currentSummary.personCount} mitra`
                            : 'Belum ada data'}
                        {newlyMeetsCount > 0 ? ` · ${newlyMeetsCount} baru` : ''}
                    </p>
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        Rata-rata Kapasitas
                    </p>
                    <p className="mt-0.5 text-xl font-bold text-gray-900">
                        {currentSummary?.avgGramPerHk != null ? fmtId(currentSummary.avgGramPerHk, 1) : '–'} g/hk
                    </p>
                    {avgGrowth != null ? (
                        <p className={`mt-0.5 text-[11px] font-medium ${avgGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {avgGrowth >= 0 ? '▲' : '▼'} {fmtId(Math.abs(avgGrowth), 1)} g/hk vs bulan lalu
                        </p>
                    ) : (
                        <p className="mt-0.5 text-[11px] text-gray-400">Belum ada bulan pembanding</p>
                    )}
                </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                    {(
                        [
                            { value: 'all', label: 'Semua' },
                            { value: 'penuhi', label: 'Penuhi Target' },
                            { value: 'belum', label: 'Belum Penuhi' },
                        ] as const
                    ).map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => setStatusFilter(item.value)}
                            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                statusFilter === item.value
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <div className="relative ml-auto">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Cari anak..."
                        className="w-44 rounded-lg border border-gray-300 bg-gray-50 py-1.5 pl-8 pr-3 text-sm transition focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                    />
                </div>
            </div>

            {!ready || loading ? (
                <div className="flex h-[160px] items-center justify-center text-sm text-gray-400">
                    Memuat rekap bulan ini...
                </div>
            ) : filteredRows.length === 0 ? (
                <div className="flex h-[160px] items-center justify-center text-sm text-gray-400">
                    {search || statusFilter !== 'all' ? 'Tidak ada anak cocok filter ini.' : 'Belum ada data di bulan ini.'}
                </div>
            ) : (
                <div className="max-h-[360px] overflow-y-auto rounded-lg border border-gray-100 p-2">
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredRows.map((row) => {
                            const band = classifyCapacity(row.avgGramPerHk);
                            return (
                                <button
                                    key={row.personId}
                                    type="button"
                                    onClick={() => onSelect?.(row.personId)}
                                    title={`${row.name} · ${row.tier.label} · ${
                                        row.avgGramPerHk != null ? fmtId(row.avgGramPerHk, 1) : '–'
                                    } dari target ${fmtId(row.ownTarget, 0)} g/hk bulan ini`}
                                    className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                                        onSelect ? 'cursor-pointer hover:bg-gray-50 hover:border-gray-200' : 'cursor-default'
                                    } ${row.meetsTarget ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-100'}`}
                                >
                                    <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: band?.color ?? '#d1d5db' }}
                                    />
                                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800">
                                        {row.name}
                                    </span>
                                    {row.newlyMeets ? (
                                        <span
                                            className="shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
                                            title="Baru memenuhi target bulan ini"
                                        >
                                            ↑ baru
                                        </span>
                                    ) : null}
                                    {/* "hasil / target" — angka targetnya ikut ditampilkan karena
                                        tiap angkatan beda tagihannya, jadi angka hasil saja tidak
                                        cukup untuk menilai. */}
                                    <span className="shrink-0 text-xs font-semibold text-gray-900">
                                        {row.avgGramPerHk != null ? fmtId(row.avgGramPerHk, 1) : '–'}
                                        <span className="font-normal text-gray-400">
                                            {' / '}
                                            {fmtId(row.ownTarget, 0)}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
