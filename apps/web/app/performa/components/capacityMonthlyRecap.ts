import type { PerformaPeriod, PerformaRow } from '@/lib/api';
import { CAPACITY_BANDS, classifyCapacity, type CapacityBand } from './capacityBand';
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
    /** Label angkatan — ditulis lengkap ("Minggu 1–12", bukan "mgg 1-12")
     * supaya tidak perlu tahu singkatannya dulu untuk paham; dipakai di chip
     * tangga target, rincian target bulanan, maupun tooltip kartu mitra. */
    label: string;
    color: string;
};

/** Tangga target per angkatan, urut dari yang paling muda. */
export const TARGET_TIERS: TargetTier[] = [
    {
        key: 'pemula',
        value: KUNING_TARGET.value,
        label: `Minggu 1–${KUNING_TARGET.weeks}`,
        color: KUNING_TARGET.color,
    },
    {
        key: 'perintis',
        value: HIJAU_TARGET.value,
        label: `Minggu ${KUNING_TARGET.weeks + 1}–${HIJAU_TARGET.weeks}`,
        color: HIJAU_TARGET.color,
    },
    { key: 'mandiri', value: MANDIRI_TARGET_VALUE, label: 'Mandiri', color: '#2563eb' },
];

const TIER_BY_KEY = new Map(TARGET_TIERS.map((tier) => [tier.key, tier]));

export type MonthBlock = {
    /** Periode dalam blok ini, urut kronologis. */
    periods: PerformaPeriod[];
};

/** Berapa periode mingguan yang dihitung sebagai "1 bulan". */
export const MONTH_BLOCK_WEEKS = 4;

/** Bagi periode (urut kronologis) jadi blok-blok 4 periode berturut-turut. */
export function buildMonthBlocks(periods: PerformaPeriod[], blockSize = MONTH_BLOCK_WEEKS): MonthBlock[] {
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
    /** Lama kerja (minggu) di periode TERAKHIR blok ini. null = Mandiri atau
     * minggunya tidak tercatat. */
    tenureWeeks: number | null;
    /** Angkatan yang dia tempati BULAN DEPAN (4 minggu lagi). */
    nextTier: TargetTier;
    /** Target g/hk bulan depan — beda dari ownTarget kalau dia melewati
     * checkpoint dalam 4 minggu ke depan. */
    nextTarget: number;
    /** Rata-rata hari kerja per minggu di blok ini — dipakai memecah target
     * bulanan jadi target mingguan yang realistis buat dia, bukan asumsi
     * seragam yang menghukum mitra yang memang tidak masuk penuh. */
    hkPerWeek: number;
    /**
     * Kesiapan menghadapi bulan depan:
     * - `aman`       : memenuhi target sekarang DAN target bulan depan
     * - `target-naik`: memenuhi sekarang, TAPI belum cukup untuk target baru
     * - `belum`      : target sekarang saja belum terpenuhi
     *
     * `target-naik` sengaja dipisah dari `aman`: tanpa itu mitra yang minggu
     * depan naik checkpoint terlihat hijau sampai bulan depan tiba-tiba
     * merah, padahal justru merekalah yang paling perlu didorong sekarang.
     */
    readiness: 'aman' | 'target-naik' | 'belum';
};

/**
 * Angkatan yang ditempati mitra 4 minggu lagi.
 *
 * "Mandiri" tetap Mandiri: statusnya menyerap dan tidak ada checkpoint di
 * atasnya, jadi targetnya tidak bergerak lagi (lihat tenure.ts).
 */
function nextMonthTier(weeks: number | null, isMandiri: boolean): TargetTier {
    if (isMandiri) return TIER_BY_KEY.get('mandiri')!;
    // Minggu tidak tercatat -> tidak bisa diramal, pakai angkatan yang sama.
    if (weeks === null) return TIER_BY_KEY.get('pemula')!;
    const next = weeks + 4;
    if (next > HIJAU_TARGET.weeks) return TIER_BY_KEY.get('mandiri')!;
    if (next > KUNING_TARGET.weeks) return TIER_BY_KEY.get('perintis')!;
    return TIER_BY_KEY.get('pemula')!;
}

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
    /** Level di periode TERAKHIR yang dia muncul — sumber ramalan angkatan
     * bulan depan. Periode diiterasi kronologis, jadi yang belakangan menimpa
     * yang duluan. */
    const lastLevel = new Map<string, { raw: string | null; num: number | null }>();

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
                    tenureWeeks: null,
                    nextTier: tier,
                    nextTarget: tier.value,
                    hkPerWeek: 0,
                    readiness: 'belum',
                });
            }

            const tierHk = hkByTier.get(row.personId) ?? new Map<TargetTier['key'], number>();
            tierHk.set(tier.key, (tierHk.get(tier.key) ?? 0) + hk);
            hkByTier.set(row.personId, tierHk);
            lastLevel.set(row.personId, {
                raw: row.rawUserLevel ?? null,
                num: row.levelNumber ?? null,
            });
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

        const level = lastLevel.get(agg.personId);
        agg.tenureWeeks = level ? tenureWeeks(level.raw, level.num) : null;
        agg.nextTier = nextMonthTier(
            agg.tenureWeeks,
            /mandiri/i.test(level?.raw ?? ''),
        );
        agg.nextTarget = agg.nextTier.value;

        // Pembagi = jumlah periode dalam blok (biasanya 4 minggu), bukan
        // konstanta: blok terakhir bisa belum genap 4 minggu, dan memakai 4
        // di situ akan mengecilkan angka mingguannya secara palsu.
        agg.hkPerWeek = block.periods.length > 0 ? agg.sumHk / block.periods.length : 0;

        agg.readiness = !agg.meetsTarget
            ? 'belum'
            : agg.avgGramPerHk != null && agg.avgGramPerHk >= agg.nextTarget
              ? 'aman'
              : 'target-naik';
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

export type TierBreakdown = {
    tier: TargetTier;
    /** HK yang dikerjakan DALAM angkatan ini bulan ini. Kalau seorang mitra
     * naik status di tengah bulan, HK sebelum & sesudah naik masuk baris
     * angkatan yang berbeda — bukan cacat, itu justru menunjukkan momen dia
     * naik checkpoint. */
    totalHk: number;
    /** Mitra unik yang minimal sekali berada di angkatan ini bulan ini. */
    personCount: number;
    /** Kontribusi angkatan ini ke target bulanan (gram) = target g/hk × totalHk. */
    targetGram: number;
    actualGram: number;
};

/**
 * Rincian "kenapa target bulan ini segini" per angkatan — jawaban langsung
 * atas pertanyaan yang sama selalu muncul begitu lihat angka target bulat
 * seperti "102,5 kg": dari mana asalnya.
 *
 * Dihitung per BARIS (bukan dari angkatan dominan seperti PersonBlockAggregate),
 * supaya jumlah targetGram semua tier di sini PERSIS SAMA dengan targetBjd di
 * blockTargetSummary — keduanya menjumlah tier.value × hk per baris, cuma
 * blockTargetSummary tidak memecahnya per angkatan.
 */
export function blockTierBreakdown(
    block: MonthBlock,
    rowsByPeriod: Record<string, PerformaRow[]>,
): TierBreakdown[] {
    const byTier = new Map<
        TargetTier['key'],
        { totalHk: number; targetGram: number; actualGram: number; people: Set<string> }
    >();
    for (const tier of TARGET_TIERS) {
        byTier.set(tier.key, { totalHk: 0, targetGram: 0, actualGram: 0, people: new Set() });
    }

    for (const period of block.periods) {
        const rows = rowsByPeriod[period.id];
        if (!rows) continue;
        for (const row of rows) {
            if (isExcludedFromCapacity(row)) continue;
            const hk = row.hk ?? 0;
            if (hk <= 0) continue;
            const bucket = byTier.get(personPeriodTier(row).key)!;
            bucket.totalHk += hk;
            bucket.targetGram += personPeriodTier(row).value * hk;
            bucket.actualGram += row.totalBjd ?? 0;
            bucket.people.add(row.personId);
        }
    }

    return TARGET_TIERS.map((tier) => {
        const bucket = byTier.get(tier.key)!;
        return {
            tier,
            totalHk: bucket.totalHk,
            personCount: bucket.people.size,
            targetGram: bucket.targetGram,
            actualGram: bucket.actualGram,
        };
    });
}

export type BandBreakdown = {
    band: CapacityBand;
    totalHk: number;
    personCount: number;
    targetGram: number;
    actualGram: number;
};

/**
 * Rincian target & capaian per BAND KAPASITAS (merah/kuning/hijau/biru) —
 * potongan kedua dari total target yang sama, di samping per angkatan.
 *
 * Bedanya penting: "angkatan" itu tagihan (ditentukan lama kerja), "band"
 * itu hasil (ditentukan capaian). Jadi band kuning bisa saja target
 * gabungannya tinggi — kalau isinya banyak mitra Mandiri yang ditagih 45
 * g/hari kerja tapi capaiannya baru 25-35. Justru selisih itu yang tidak
 * kelihatan kalau band cuma menampilkan jumlah orang.
 *
 * Total targetGram semua band SAMA PERSIS dengan total per angkatan (dan
 * dengan targetBjd di blockTargetSummary): band ditentukan dari rata-rata
 * SEBULAN orangnya, tapi gram targetnya tetap dijumlah per baris dengan
 * angkatan periode itu — dasar hitung yang sama, cuma dikelompokkan beda.
 */
export function blockBandBreakdown(
    block: MonthBlock,
    rowsByPeriod: Record<string, PerformaRow[]>,
): BandBreakdown[] {
    const bands = CAPACITY_BANDS.filter((b) => b.key !== 'purple');
    const byBand = new Map<
        CapacityBand['key'],
        { totalHk: number; targetGram: number; actualGram: number; people: Set<string> }
    >();
    for (const band of bands) {
        byBand.set(band.key, { totalHk: 0, targetGram: 0, actualGram: 0, people: new Set() });
    }

    // Band dipegang per ORANG (dari rata-rata sebulannya), bukan per baris,
    // supaya satu mitra tidak tersebar ke beberapa band gara-gara satu minggu
    // yang kebetulan jelek.
    const bandOfPerson = new Map<string, CapacityBand['key']>();
    for (const person of aggregateBlock(block, rowsByPeriod).values()) {
        if (person.sumHk <= 0) continue;
        const band = classifyCapacity(person.avgGramPerHk);
        if (band) bandOfPerson.set(person.personId, band.key);
    }

    for (const period of block.periods) {
        const rows = rowsByPeriod[period.id];
        if (!rows) continue;
        for (const row of rows) {
            if (isExcludedFromCapacity(row)) continue;
            const hk = row.hk ?? 0;
            if (hk <= 0) continue;
            const bandKey = bandOfPerson.get(row.personId);
            if (!bandKey) continue;
            const bucket = byBand.get(bandKey)!;
            bucket.totalHk += hk;
            bucket.targetGram += personPeriodTier(row).value * hk;
            bucket.actualGram += row.totalBjd ?? 0;
            bucket.people.add(row.personId);
        }
    }

    return bands.map((band) => {
        const bucket = byBand.get(band.key)!;
        return {
            band,
            totalHk: bucket.totalHk,
            personCount: bucket.people.size,
            targetGram: bucket.targetGram,
            actualGram: bucket.actualGram,
        };
    });
}

export { KUNING_TARGET, HIJAU_TARGET };
