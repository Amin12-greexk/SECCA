'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Search, Target } from 'lucide-react';
import { useToast } from '@/lib/toast';
import { getPerformaSummary, type PerformaPeriod, type PerformaRow } from '@/lib/api';
import { fmtId } from '@/components/charts/chart-theme';
import { formatPeriodLabel } from './periodLabel';
import {
    aggregateBlock,
    blockTargetSummary,
    blockBandBreakdown,
    blockTierBreakdown,
    buildMonthBlocks,
    isBlockLoaded,
    MONTH_BLOCK_WEEKS,
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

type StatusFilter = 'all' | 'naik' | 'belum' | 'aman';

/** Warna per status kesiapan. Dipisah ke konstanta supaya baris JSX-nya tidak
 * penuh percabangan kelas Tailwind. */
const READINESS_STYLE: Record<
    PersonBlockAggregate['readiness'],
    { border: string; bg: string; dot: string; bar: string; text: string }
> = {
    aman: {
        border: 'border-emerald-200',
        bg: 'bg-emerald-50/40',
        dot: 'bg-emerald-500',
        bar: 'bg-emerald-500',
        text: 'text-emerald-700',
    },
    'target-naik': {
        border: 'border-amber-300',
        bg: 'bg-amber-50/50',
        dot: 'bg-amber-500',
        bar: 'bg-amber-500',
        text: 'text-amber-700',
    },
    belum: {
        border: 'border-gray-200',
        bg: 'bg-white',
        dot: 'bg-red-500',
        bar: 'bg-red-500',
        text: 'text-gray-500',
    },
};

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
    // Default "naik": kelompok yang paling gampang terlewat, karena mitranya
    // terlihat aman bulan ini padahal target mereka naik bulan depan.
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('naik');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [breakdownBy, setBreakdownBy] = useState<'angkatan' | 'kapasitas'>('angkatan');

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
            // Yang paling jauh dari target bulan depan naik ke atas: di daftar
            // sepanjang ini, yang butuh ditindak duluan harus ketemu duluan.
            // Dalam kelompok "aman" selisihnya sama-sama 0, jadi jatuh ke
            // urutan kapasitas tertinggi.
            .sort((a, b) => {
                const gap = (r: PersonBlockAggregate) => Math.max(0, r.nextTarget - (r.avgGramPerHk ?? 0));
                return gap(b) - gap(a) || (b.avgGramPerHk ?? -1) - (a.avgGramPerHk ?? -1);
            });
    }, [currentAgg, previousAgg]);

    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase();
        return rows
            .filter((r) => (query ? r.name.toLowerCase().includes(query) : true))
            .filter((r) => {
                if (statusFilter === 'naik') return r.readiness === 'target-naik';
                if (statusFilter === 'belum') return r.readiness === 'belum';
                if (statusFilter === 'aman') return r.readiness === 'aman';
                return true;
            });
    }, [rows, search, statusFilter]);

    const readinessCount = useMemo(
        () => ({
            aman: rows.filter((r) => r.readiness === 'aman').length,
            'target-naik': rows.filter((r) => r.readiness === 'target-naik').length,
            belum: rows.filter((r) => r.readiness === 'belum').length,
        }),
        [rows],
    );

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

    /** Potongan kedua dari total target yang sama: per band kapasitas. */
    const bandBreakdown = useMemo(
        () => (currentBlock && ready ? blockBandBreakdown(currentBlock, rowsByPeriod) : []),
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
            <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <Target className="h-4 w-4 shrink-0 text-amber-500" />
                    Kenapa target bulan ini {currentSummary ? fmtId(currentSummary.targetBjd / 1000, 1) : '–'} kg
                </p>
                <p className="mb-3 text-xs leading-relaxed text-gray-500">
                    {breakdownBy === 'angkatan'
                        ? 'Rumus: target gram per hari kerja tiap angkatan × jumlah hari kerja aktual angkatan itu bulan ini, lalu dijumlah semua angkatan.'
                        : 'Total target yang sama, dipotong menurut band kapasitas yang dicapai. Angkatan menentukan tagihannya, band menunjukkan hasilnya — selisih keduanya yang perlu dikejar.'}
                </p>

                {/* Satu total target, dua cara memotongnya. Ditaruh sebagai
                    tombol pilihan (bukan dua tabel sekaligus) supaya panelnya
                    tidak jadi dua kali lebih panjang. */}
                <div className="mb-3 inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
                    {(
                        [
                            { value: 'angkatan', label: 'Per angkatan' },
                            { value: 'kapasitas', label: 'Per kapasitas' },
                        ] as const
                    ).map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => setBreakdownBy(item.value)}
                            className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                                breakdownBy === item.value
                                    ? 'bg-gray-800 text-white'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {tierBreakdown.length === 0 ? (
                    <div className="h-[80px] animate-pulse rounded-lg bg-gray-100/70" />
                ) : (
                    <div className="flex flex-col gap-3">
                        {breakdownBy === 'angkatan'
                            ? tierBreakdown.map((row) => (
                                  <div key={row.tier.key} className="flex flex-col gap-1">
                                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm">
                                          <span className="flex items-center gap-2 font-medium text-gray-800">
                                              <span
                                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                  style={{ backgroundColor: row.tier.color }}
                                              />
                                              {row.tier.label}
                                              <span className="font-normal text-gray-500">· {row.personCount} mitra</span>
                                          </span>
                                          <span className="font-semibold text-gray-900">
                                              {fmtId(row.targetGram / 1000, 1)} kg
                                          </span>
                                      </div>
                                      <p className="pl-4 text-xs text-gray-500">
                                          {fmtId(row.totalHk, 0)} hari kerja × {fmtId(row.tier.value, 0)} gram per hari kerja
                                      </p>
                                  </div>
                              ))
                            : bandBreakdown.map((row) => {
                                  const pct =
                                      row.targetGram > 0 ? (row.actualGram / row.targetGram) * 100 : null;
                                  return (
                                      <div key={row.band.key} className="flex flex-col gap-1">
                                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm">
                                              <span className="flex items-center gap-2 font-medium text-gray-800">
                                                  <span
                                                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                                                      style={{ backgroundColor: row.band.color }}
                                                  />
                                                  {row.band.label}
                                                  <span className="font-normal text-gray-500">· {row.personCount} mitra</span>
                                              </span>
                                              <span className="font-semibold text-gray-900">
                                                  {fmtId(row.targetGram / 1000, 1)} kg
                                              </span>
                                          </div>
                                          <p className="pl-4 text-xs text-gray-500">
                                              Tercapai {fmtId(row.actualGram / 1000, 1)} kg dari target{' '}
                                              {fmtId(row.targetGram / 1000, 1)} kg
                                              {pct != null ? (
                                                  <span className={pct >= 100 ? 'text-green-600' : 'text-amber-700'}>
                                                      {' '}
                                                      ({fmtId(pct, 0)}%)
                                                  </span>
                                              ) : null}
                                          </p>
                                      </div>
                                  );
                              })}
                        <div className="mt-1 flex items-center justify-between border-t border-gray-200 pt-2.5 text-sm font-semibold text-gray-900">
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

            {/* Kelompok kesiapan + pencarian. "Target naik" ditaruh paling kiri
                dan jadi pilihan awal karena kelompok itu yang paling gampang
                terlewat: sekarang hijau, bulan depan jatuh. */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="inline-flex flex-wrap rounded-lg border border-gray-200 bg-gray-50 p-0.5">
                    {(
                        [
                            { value: 'naik', label: 'Target naik', count: readinessCount['target-naik'] },
                            { value: 'belum', label: 'Belum penuhi', count: readinessCount.belum },
                            { value: 'aman', label: 'Aman', count: readinessCount.aman },
                            { value: 'all', label: 'Semua', count: rows.length },
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
                            <span className="ml-1 text-gray-400">{item.count}</span>
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
                <div className="flex h-[160px] items-center justify-center px-4 text-center text-sm text-gray-400">
                    {statusFilter === 'naik' && !search
                        ? 'Tidak ada mitra yang targetnya naik bulan depan — semua sudah sesuai angkatannya.'
                        : search || statusFilter !== 'all'
                          ? 'Tidak ada anak cocok filter ini.'
                          : 'Belum ada data di bulan ini.'}
                </div>
            ) : (
                <div className="max-h-[460px] space-y-1.5 overflow-y-auto rounded-lg border border-gray-100 p-2">
                    {filteredRows.map((row) => {
                        const style = READINESS_STYLE[row.readiness];
                        const isOpen = expandedId === row.personId;
                        const avg = row.avgGramPerHk ?? 0;
                        // Semua angka rencana memakai target BULAN DEPAN — itu
                        // pertanyaan yang sedang dijawab ("biar aman bulan depan
                        // berapa"). Untuk mitra yang angkatannya tidak berubah,
                        // angkanya sama saja dengan target sekarang, jadi tidak
                        // ada yang tertukar.
                        const gapPerHk = Math.max(0, row.nextTarget - avg);
                        const pct = row.nextTarget > 0 ? Math.min(100, (avg / row.nextTarget) * 100) : 0;
                        const targetNaik = row.nextTarget > row.ownTarget;

                        return (
                            <div key={row.personId} className={`rounded-lg border ${style.border} ${style.bg}`}>
                                <button
                                    type="button"
                                    onClick={() => setExpandedId(isOpen ? null : row.personId)}
                                    aria-expanded={isOpen}
                                    className="w-full cursor-pointer px-3 py-2 text-left"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="flex min-w-0 items-center gap-2">
                                            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
                                            <span className="truncate text-xs font-medium text-gray-800">{row.name}</span>
                                            {row.newlyMeets ? (
                                                <span
                                                    className="shrink-0 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
                                                    title="Baru memenuhi target bulan ini"
                                                >
                                                    ↑ baru
                                                </span>
                                            ) : null}
                                            <span className="shrink-0 text-[11px] text-gray-400">
                                                {row.tenureWeeks != null
                                                    ? `Minggu ${row.tenureWeeks}${targetNaik ? ` → ${row.tenureWeeks + 4}` : ''}`
                                                    : row.tier.label}
                                            </span>
                                        </span>
                                        <span className="flex shrink-0 items-center gap-1.5 text-xs">
                                            <span className="font-semibold text-gray-900">
                                                {row.avgGramPerHk != null ? fmtId(row.avgGramPerHk, 1) : '–'}
                                                <span className="font-normal text-gray-400">
                                                    {' / '}
                                                    {fmtId(row.nextTarget, 0)}
                                                </span>
                                            </span>
                                            <ChevronDown
                                                className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                            />
                                        </span>
                                    </div>

                                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200/70">
                                        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${pct}%` }} />
                                    </div>

                                    <p className={`mt-1 text-[11px] ${style.text}`}>
                                        {row.readiness === 'aman'
                                            ? `Aman — target bulan depan ${fmtId(row.nextTarget, 0)} gram per hari kerja sudah terpenuhi`
                                            : targetNaik
                                              ? `Target naik ${fmtId(row.ownTarget, 0)} → ${fmtId(row.nextTarget, 0)} gram bulan depan, kurang ${fmtId(gapPerHk, 1)} gram tiap hari kerja`
                                              : `Kurang ${fmtId(gapPerHk, 1)} gram tiap hari kerja dari target ${fmtId(row.nextTarget, 0)}`}
                                    </p>
                                </button>

                                {isOpen ? (
                                    <div className="border-t border-gray-200/70 px-3 py-2.5">
                                        <table className="w-full text-[11px]">
                                            <thead>
                                                <tr className="text-gray-400">
                                                    <th className="text-left font-normal">&nbsp;</th>
                                                    <th className="text-right font-normal">sekarang</th>
                                                    <th className="text-right font-normal">harus</th>
                                                    <th className="text-right font-normal">tambah</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-gray-700">
                                                {(
                                                    [
                                                        { label: 'Per hari kerja', hint: '', mult: 1 },
                                                        { label: 'Per minggu', hint: `${fmtId(row.hkPerWeek, 1)} hari`, mult: row.hkPerWeek },
                                                        // Diproyeksikan ke bulan PENUH (4 minggu), bukan
                                                        // total HK blok ini: blok berjalan bisa baru 1-2
                                                        // minggu, dan memakai HK-nya apa adanya membuat
                                                        // baris "sebulan" sama persis dengan "per minggu".
                                                        {
                                                            label: 'Sebulan',
                                                            hint: `${fmtId(row.hkPerWeek * MONTH_BLOCK_WEEKS, 0)} hari`,
                                                            mult: row.hkPerWeek * MONTH_BLOCK_WEEKS,
                                                        },
                                                    ] as const
                                                ).map((baris) => {
                                                    const fd = baris.mult === 1 ? 1 : 0;
                                                    return (
                                                        <tr key={baris.label}>
                                                            <td className="py-0.5">
                                                                {baris.label}
                                                                {baris.hint ? <span className="text-gray-400"> ({baris.hint})</span> : null}
                                                            </td>
                                                            <td className="py-0.5 text-right">{fmtId(avg * baris.mult, fd)} g</td>
                                                            <td className="py-0.5 text-right font-semibold text-gray-900">
                                                                {fmtId(row.nextTarget * baris.mult, fd)} g
                                                            </td>
                                                            <td
                                                                className={`py-0.5 text-right ${
                                                                    gapPerHk > 0 ? 'text-amber-700' : 'text-green-600'
                                                                }`}
                                                            >
                                                                {gapPerHk > 0 ? `+${fmtId(gapPerHk * baris.mult, fd)} g` : 'cukup'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>

                                        {onSelect ? (
                                            <button
                                                type="button"
                                                onClick={() => onSelect(row.personId)}
                                                className="mt-2 cursor-pointer text-[11px] font-medium text-green-700 hover:underline"
                                            >
                                                Lihat grafik tren {row.name} →
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
