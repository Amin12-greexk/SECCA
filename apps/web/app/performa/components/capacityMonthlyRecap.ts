import type { PerformaPeriod, PerformaRow } from '@/lib/api';
import { CAPACITY_TARGETS } from './capacityTarget';
import { tenureWeeks } from './tenure';

/**
 * "Rekap Bulanan" kapasitas — beda konsep dari CAPACITY_TARGETS di
 * capacityTarget.ts (yang menilai lama kerja ke-12/20 minggu SEKALI per
 * anak). Ini menilai ULANG tiap blok 4 minggu, semua anak sekaligus: siapa
 * yang rata-rata bulan itu sudah tembus ambang kuning (25 g/hk) / hijau
 * (35 g/hk) — dua ambang yang sama, dibaca dari CAPACITY_TARGETS supaya
 * tidak ada angka ganda yang bisa mengambang tidak sinkron.
 *
 * Periode di /performa mingguan dan TIDAK selaras bulan kalender (ada yang
 * memotong dua bulan sekaligus — lihat AuditDashboardPeriod). Dari pada
 * memaksakan pengelompokan kalender yang berantakan, "1 bulan" di sini
 * dipakai konsisten dengan aturan warning yang sudah ada di MitraRanking
 * (evaluateMitraWarning): blok 4 periode berturut-turut, dari periode
 * paling awal. Blok terakhir boleh kurang dari 4 kalau jumlah periode belum
 * genap kelipatan 4.
 */

const KUNING_TARGET = CAPACITY_TARGETS.find((t) => t.weeks === 12)!;
const HIJAU_TARGET = CAPACITY_TARGETS.find((t) => t.weeks === 20)!;

/**
 * Checkpoint ke-3: begitu naik Mitra Mandiri, targetnya naik 10 gram lagi
 * jadi 45 g/hk.
 *
 * Sengaja TIDAK dimasukkan ke CAPACITY_TARGETS: isi array itu semuanya
 * berbasis "minggu ke-N", sedangkan Mandiri justru status yang minggunya
 * berhenti tercatat (lihat tenure.ts) — tidak ada angka minggu yang jujur
 * bisa ditulis di situ. Menambahkannya ke sana juga akan menambah garis
 * target ke-3 di grafik tren per-anak, yang bukan bagian dari rekap ini.
 *
 * Alasan bisnisnya: per Agustus 2026 mitra Mandiri (67 orang, sepertiga
 * tenaga kerja borong) rata-ratanya sudah 36,7 g/hk — sudah melewati
 * ambang 35, jadi target lama tidak lagi mengikat siapa pun di angkatan itu.
 */
const MANDIRI_TARGET_VALUE = 45;

export type TargetTier = {
    key: 'pemula' | 'perintis' | 'mandiri';
    /** Ambang g/hk yang harus dicapai angkatan ini. */
    value: number;
    /** Label pendek untuk chip keterangan — sengaja sesingkat mungkin. */
    label: string;
    color: string;
};

/** Tangga target per angkatan, urut dari yang paling muda. */
export const TARGET_TIERS: TargetTier[] = [
    {
        key: 'pemula',
        value: KUNING_TARGET.value,
        label: `≤ mgg ${KUNING_TARGET.weeks}`,
        color: KUNING_TARGET.color,
    },
    {
        key: 'perintis',
        value: HIJAU_TARGET.value,
        label: `mgg ${KUNING_TARGET.weeks + 1}–${HIJAU_TARGET.weeks}`,
        color: HIJAU_TARGET.color,
    },
    { key: 'mandiri', value: MANDIRI_TARGET_VALUE, label: 'Mandiri', color: '#2563eb' },
];

const TIER_BY_KEY = new Map(TARGET_TIERS.map((tier) => [tier.key, tier]));

export type MonthBlock = {
    /** Periode dalam blok ini, urut kronologis. */
    periods: PerformaPeriod[];
};

/** Bagi periode (urut kronologis) jadi blok-blok 4 periode berturut-turut. */
export function buildMonthBlocks(periods: PerformaPeriod[], blockSize = 4): MonthBlock[] {
    const blocks: MonthBlock[] = [];
    for (let i = 0; i < periods.length; i += blockSize) {
        blocks.push({ periods: periods.slice(i, i + blockSize) });
    }
    return blocks;
}

export type PersonBlockAggregate = {
    personId: string;
    name: string;
    colorHex: string;
    /** Total BJD (murni produksi, tanpa reprocess — samakan definisi dengan
     * perDayOf/evaluateMitraWarning) dijumlah semua periode dalam blok. */
    sumBjd: number;
    sumHk: number;
    /** null kalau HK-nya 0/tidak ada di seluruh blok (anak tidak aktif bulan itu). */
    avgGramPerHk: number | null;
    /** Angkatan dengan HK terbanyak di blok ini — dipakai untuk label/warna. */
    tier: TargetTier;
    /** Target g/hk yang ditagih ke dia bulan ini — selalu pas 25/35/45. */
    ownTarget: number;
    /** Rata-ratanya sudah memenuhi target angkatannya sendiri? */
    meetsTarget: boolean;
};

/** "Cabut Rumah" tidak punya konsep kapasitas sama sekali (lihat page.tsx),
 * dan "Bulanan" digaji harian tetap, bukan dinilai dari gram/HK — keduanya
 * disaring dari rekap target supaya tidak nongol sebagai "belum capai". */
function isExcludedFromCapacity(row: PerformaRow): boolean {
    const level = row.normalizedLevel ?? row.rawUserLevel ?? '';
    return /cabut rumah/i.test(row.rawUserLevel ?? '') || /bulanan/i.test(level);
}

/** Agregasi per anak untuk satu blok bulan, dari rows tiap periode yang sudah dimuat. */
export function aggregateBlock(
    block: MonthBlock,
    rowsByPeriod: Record<string, PerformaRow[]>,
): Map<string, PersonBlockAggregate> {
    const map = new Map<string, PersonBlockAggregate>();
    /** HK per angkatan per orang — dipakai memilih angkatan dominan di blok
     * ini (bukan angkatan periode terakhir) supaya label tidak berubah cuma
     * karena satu minggu terakhir kebetulan naik status. */
    const hkByTier = new Map<string, Map<TargetTier['key'], number>>();

    for (const period of block.periods) {
        const rows = rowsByPeriod[period.id];
        if (!rows) continue;
        for (const row of rows) {
            if (isExcludedFromCapacity(row)) continue;
            const bjd = row.totalBjd ?? 0;
            const hk = row.hk ?? 0;
            // Baris ber-BJD tapi HK kosong dibuang, bukan dijumlah: BJD-nya
            // masuk pembilang sementara HK-nya tidak masuk penyebut, jadi
            // gram/HK orang itu jadi terlalu tinggi dan dia bisa lolos target
            // padahal tidak. Aturan yang sama dipakai blockTargetSummary,
            // supaya angka per-orang dan angka perusahaan sepopulasi.
            if (hk <= 0) continue;
            const tier = personPeriodTier(row);

            const existing = map.get(row.personId);
            if (existing) {
                existing.sumBjd += bjd;
                existing.sumHk += hk;
                existing.name = row.name;
                existing.colorHex = row.colorHex;
            } else {
                map.set(row.personId, {
                    personId: row.personId,
                    name: row.name,
                    colorHex: row.colorHex,
                    sumBjd: bjd,
                    sumHk: hk,
                    avgGramPerHk: null,
                    tier,
                    ownTarget: tier.value,
                    meetsTarget: false,
                });
            }

            const tierHk = hkByTier.get(row.personId) ?? new Map<TargetTier['key'], number>();
            tierHk.set(tier.key, (tierHk.get(tier.key) ?? 0) + hk);
            hkByTier.set(row.personId, tierHk);
        }
    }

    for (const agg of map.values()) {
        agg.avgGramPerHk = agg.sumHk > 0 ? agg.sumBjd / agg.sumHk : null;

        // Ditagih SATU angka bulat (25/35/45), bukan rata-rata tertimbang dari
        // angkatan yang dilewati: mitra yang naik status di tengah bulan akan
        // dapat target seperti "42 g/hk" — angka yang tidak pernah disebutkan
        // ke siapa pun dan tidak bisa dijelaskan ke mitranya. Dipakai angkatan
        // tempat dia menghabiskan HK terbanyak bulan itu; kalau seri, yang
        // lebih tinggi yang menang (itu arah yang dia tuju).
        const tierHk = hkByTier.get(agg.personId);
        if (tierHk && agg.sumHk > 0) {
            let best = TARGET_TIERS[0];
            for (const tier of TARGET_TIERS) {
                if ((tierHk.get(tier.key) ?? 0) >= (tierHk.get(best.key) ?? 0)) best = tier;
            }
            agg.tier = best;
        }
        agg.ownTarget = agg.tier.value;

        agg.meetsTarget = agg.avgGramPerHk != null && agg.avgGramPerHk >= agg.ownTarget;
    }

    return map;
}

/** Semua periode dalam blok sudah punya data (tidak sedang loading/hilang)? */
export function isBlockLoaded(block: MonthBlock, rowsByPeriod: Record<string, PerformaRow[]>): boolean {
    return block.periods.every((p) => p.id in rowsByPeriod);
}

/**
 * Angkatan satu mitra di SATU periode — penentu target g/hk yang ditagih ke dia.
 *
 * Sengaja dihitung per periode, bukan sekali per blok, supaya mitra yang
 * melewati minggu ke-12 di tengah bulan langsung memakai target barunya di
 * minggu-minggu sisanya.
 */
export function personPeriodTier(row: PerformaRow): TargetTier {
    const weeks = tenureWeeks(row.rawUserLevel, row.levelNumber);
    if (weeks === null) {
        // Angka minggu tidak tercatat: "Mandiri" sudah pasti lewat mgg 20,
        // sisanya (level kosong/tidak dikenal) diperlakukan sebagai pemula.
        return /mandiri/i.test(row.rawUserLevel ?? '')
            ? TIER_BY_KEY.get('mandiri')!
            : TIER_BY_KEY.get('pemula')!;
    }
    if (weeks > HIJAU_TARGET.weeks) return TIER_BY_KEY.get('mandiri')!;
    if (weeks > KUNING_TARGET.weeks) return TIER_BY_KEY.get('perintis')!;
    return TIER_BY_KEY.get('pemula')!;
}

export type BlockTargetSummary = {
    /** BJD nyata seluruh mitra ber-HK di blok ini (gram). */
    actualBjd: number;
    /** Σ (target g/hk × HK) tiap baris — populasi yang sama dengan actualBjd. */
    targetBjd: number;
    totalHk: number;
    /** actual ÷ target × 100; null kalau tidak ada HK sama sekali. */
    achievementPct: number | null;
    /** Rata-rata kapasitas perusahaan bulan ini (g/hk); null kalau tanpa HK. */
    avgGramPerHk: number | null;
    /** Berapa mitra memenuhi target angkatannya sendiri, dari berapa. */
    meetCount: number;
    personCount: number;
    /** meetCount ÷ personCount × 100; null kalau tidak ada mitra aktif. */
    meetPct: number | null;
};

/**
 * Target vs realisasi satu blok bulan, plus berapa mitra yang memenuhi target
 * angkatannya sendiri.
 *
 * Dua angka ini menjawab pertanyaan berbeda dan keduanya perlu: persen volume
 * (kg) bisa terlihat bagus karena ditopang segelintir mitra kuat, sedangkan
 * persen mitra menunjukkan sebaran — berapa banyak orang yang benar-benar
 * memenuhi tagihannya.
 *
 * Populasinya SAMA PERSIS dengan yang dipakai aggregateBlock (tanpa Bulanan &
 * Cabut Rumah, hanya yang ber-HK) — kalau tidak, persentasenya membandingkan
 * dua populasi berbeda.
 */
export function blockTargetSummary(
    block: MonthBlock,
    rowsByPeriod: Record<string, PerformaRow[]>,
): BlockTargetSummary {
    let actualBjd = 0;
    let targetBjd = 0;
    let totalHk = 0;

    for (const period of block.periods) {
        const rows = rowsByPeriod[period.id];
        if (!rows) continue;
        for (const row of rows) {
            if (isExcludedFromCapacity(row)) continue;
            const hk = row.hk ?? 0;
            if (hk <= 0) continue;
            actualBjd += row.totalBjd ?? 0;
            targetBjd += personPeriodTier(row).value * hk;
            totalHk += hk;
        }
    }

    const active = Array.from(aggregateBlock(block, rowsByPeriod).values()).filter((p) => p.sumHk > 0);
    const meetCount = active.filter((p) => p.meetsTarget).length;

    return {
        actualBjd,
        targetBjd,
        totalHk,
        achievementPct: targetBjd > 0 ? (actualBjd / targetBjd) * 100 : null,
        avgGramPerHk: totalHk > 0 ? actualBjd / totalHk : null,
        meetCount,
        personCount: active.length,
        meetPct: active.length > 0 ? (meetCount / active.length) * 100 : null,
    };
}

export { KUNING_TARGET, HIJAU_TARGET };
