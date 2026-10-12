import type { PerformaPeriod, PerformaRow } from '@/lib/api';
import { CAPACITY_TARGETS } from './capacityTarget';
import { TARGET_TIERS } from './capacityMonthlyRecap';
import { tenureWeeks } from './tenure';

/**
 * Berapa minggu anak butuh untuk naik warna kapasitas: merah → kuning (tembus
 * 25 g/HK), kuning → hijau (35 g/HK), lalu hijau → biru (50 g/HK) — per anak
 * dan rata-rata semua anak, plus perkiraan untuk warna berikutnya.
 *
 * Sumbu waktunya MINGGU KERJA anak (dibaca dari level "Mitra Perintis N",
 * lihat tenure.ts), bukan urutan periode upload: nomor minggu itu yang
 * dipakai bisnis untuk target minggu 12 / 20. Periode tanpa level berangka
 * (mis. sudah "Mandiri") diisi dari periode terdekat yang berangka + jarak
 * periodenya (satu periode = satu minggu).
 *
 * Anak yang tidak punya satu pun level berangka di data (sudah Mandiri sejak
 * sebelum data mulai direkam) tidak diketahui minggu mulainya: mereka tidak
 * ikut rata-rata merah → kuning, tapi tetap ikut perpindahan berikutnya kalau
 * perpindahannya terlihat di data.
 *
 * Kapasitas = BJD produksi ÷ HK (tanpa reprocess) — sama dengan band warna
 * di seluruh dashboard (capacityBand.ts). "Tembus" = 2 minggu berturut-turut
 * di atas ambang (lihat firstSustainedIndex).
 */

export const YELLOW_THRESHOLD = 25;
export const GREEN_THRESHOLD = 35;
export const BLUE_THRESHOLD = 50;

/** Target bisnis: kuning paling lambat minggu 12, hijau paling lambat minggu 20. */
export const TARGET_YELLOW_WEEK = CAPACITY_TARGETS[0].weeks;
export const TARGET_GREEN_WEEK = CAPACITY_TARGETS[1].weeks;

/** Perkiraan lebih jauh dari ini tidak bisa dipercaya — ditampilkan "belum terlihat". */
const MAX_FORECAST_WEEKS = 26;
/** Tren dianggap naik kalau minimal segini gram/HK per minggu. */
const MIN_SLOPE = 0.3;
const TREND_WINDOW = 6;

export type ProgressBand = 'red' | 'yellow' | 'green' | 'blue';
export type NextBand = Exclude<ProgressBand, 'red'>;

const THRESHOLD: Record<NextBand, number> = {
    yellow: YELLOW_THRESHOLD,
    green: GREEN_THRESHOLD,
    blue: BLUE_THRESHOLD,
};
const NEXT: Record<ProgressBand, NextBand | null> = {
    red: 'yellow',
    yellow: 'green',
    green: 'blue',
    blue: null,
};

type Observation = {
    periodIndex: number;
    periodLabel: string;
    /** Minggu kerja (startKnown) atau indeks periode (tidak diketahui). */
    t: number;
    gramPerHk: number;
};

export type Forecast = {
    /** Warna yang sedang dituju. */
    toward: NextBand;
    /** Perkiraan minggu lagi; null = dengan tren sekarang belum terlihat kapan. */
    weeksLeft: number | null;
    /** Perkiraan tembus di minggu kerja ke-berapa (kalau minggu mulai diketahui). */
    atWeek: number | null;
    /** 'tren' = dari kenaikan anak itu sendiri; 'rata-rata' = dari rata-rata semua anak. */
    method: 'tren' | 'rata-rata';
    /** Minggu terakhir sudah di atas ambang, tinggal menunggu minggu kedua. */
    pending: boolean;
};

export type PersonProgression = {
    personId: string;
    name: string;
    colorHex: string;
    /** Minggu kerja diketahui (ada level "Perintis N" di data). */
    startKnown: boolean;
    firstWeek: number;
    currentWeek: number;
    /** Kapasitas di catatan terbaru (g/HK). */
    currentGram: number;
    /** Warna tertinggi yang sudah dicapai secara stabil (lihat firstSustainedIndex),
     * bukan warna minggu terakhir saja. */
    currentBand: ProgressBand;
    /** Masih muncul di periode terbaru (atau satu sebelumnya). */
    active: boolean;
    /** Minggu kerja saat tembus tiap warna, untuk menggambar batang (null =
     * belum, atau minggu mulai kerja tidak diketahui). Bisa batas atas kalau
     * warnanya sudah tercapai sejak catatan pertama. */
    reachedAtWeek: Record<NextBand, number | null>;
    /** Lama tiap perpindahan (minggu); null = belum / tidak terukur. */
    redToYellowWeeks: number | null;
    yellowToGreenWeeks: number | null;
    greenToBlueWeeks: number | null;
    forecast: Forecast | null;
    /** Kapasitas per minggu kerja, untuk grafik target vs realita. */
    points: Array<{ t: number; gramPerHk: number; periodLabel: string }>;
};

export type TransitionStats = {
    count: number;
    average: number | null;
    median: number | null;
    /** Berapa anak yang tembus dalam batas target (null = tidak ada target). */
    withinTarget: number | null;
};

export type ProgressionResult = {
    persons: PersonProgression[];
    redToYellow: TransitionStats;
    yellowToGreen: TransitionStats;
    greenToBlue: TransitionStats;
    current: Record<ProgressBand, number>;
};

function stats(values: number[], targetWeeks: number | null): TransitionStats {
    if (values.length === 0) {
        return { count: 0, average: null, median: null, withinTarget: targetWeeks === null ? null : 0 };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return {
        count: values.length,
        average: values.reduce((sum, v) => sum + v, 0) / values.length,
        median,
        withinTarget: targetWeeks === null ? null : values.filter((v) => v <= targetWeeks).length,
    };
}

/** Kemiringan garis lurus (least squares) gram/HK per minggu. */
function slopeOf(points: Array<{ t: number; gramPerHk: number }>): number | null {
    if (points.length < 3) return null;
    const n = points.length;
    const meanT = points.reduce((s, p) => s + p.t, 0) / n;
    const meanG = points.reduce((s, p) => s + p.gramPerHk, 0) / n;
    let num = 0;
    let den = 0;
    for (const p of points) {
        num += (p.t - meanT) * (p.gramPerHk - meanG);
        den += (p.t - meanT) ** 2;
    }
    return den === 0 ? null : num / den;
}

/**
 * Kapasitas mingguan naik-turun tajam (11 g/HK lalu 35 minggu depannya, lalu
 * turun lagi), jadi satu minggu bagus belum dihitung "tembus". Anak baru
 * dianggap tembus ambang kalau 2 catatan BERTURUT-TURUT sudah di atasnya;
 * minggu tembusnya = minggu pertama dari pasangan itu.
 */
function firstSustainedIndex(observations: Observation[], threshold: number): number {
    for (let i = 0; i < observations.length - 1; i++) {
        if (observations[i].gramPerHk >= threshold && observations[i + 1].gramPerHk >= threshold) return i;
    }
    return -1;
}

type PersonDraft = {
    personId: string;
    name: string;
    colorHex: string;
    rows: Array<{ periodIndex: number; periodLabel: string; row: PerformaRow }>;
};

type Draft = Omit<PersonProgression, 'forecast'> & {
    observations: Observation[];
    /** Minggu saat warna sekarang mulai dicapai (null = tidak terlihat di data). */
    bandSince: number | null;
};

export function computeBandProgression(
    periods: PerformaPeriod[],
    rowsByPeriod: Record<string, PerformaRow[]>,
): ProgressionResult {
    const ordered = [...periods].sort((a, b) => a.sortOrder - b.sortOrder);
    const lastIndex = ordered.length - 1;

    const byPerson = new Map<string, PersonDraft>();
    ordered.forEach((period, periodIndex) => {
        for (const row of rowsByPeriod[period.id] ?? []) {
            let draft = byPerson.get(row.personId);
            if (!draft) {
                draft = { personId: row.personId, name: row.name, colorHex: row.colorHex, rows: [] };
                byPerson.set(row.personId, draft);
            }
            draft.rows.push({ periodIndex, periodLabel: period.label, row });
        }
    });

    const drafts: Draft[] = [];

    for (const draft of byPerson.values()) {
        // Pekerja bulanan di luar sistem borong — tidak dinilai naik warna.
        if (draft.rows.every(({ row }) => /bulanan/i.test(row.rawUserLevel ?? row.normalizedLevel ?? ''))) {
            continue;
        }

        const anchors = draft.rows
            .map(({ periodIndex, row }) => ({ periodIndex, week: tenureWeeks(row.rawUserLevel, row.levelNumber) }))
            .filter((a): a is { periodIndex: number; week: number } => a.week !== null);
        const startKnown = anchors.length > 0;

        const weekAt = (periodIndex: number, row: PerformaRow): number => {
            if (!startKnown) return periodIndex;
            const own = tenureWeeks(row.rawUserLevel, row.levelNumber);
            if (own !== null) return own;
            const nearest = anchors.reduce((best, a) =>
                Math.abs(a.periodIndex - periodIndex) < Math.abs(best.periodIndex - periodIndex) ? a : best,
            );
            return nearest.week + (periodIndex - nearest.periodIndex);
        };

        const observations: Observation[] = draft.rows
            .filter(({ row }) => (row.hk ?? 0) > 0 && row.totalBjd != null)
            .map(({ periodIndex, periodLabel, row }) => ({
                periodIndex,
                periodLabel,
                t: weekAt(periodIndex, row),
                gramPerHk: (row.totalBjd ?? 0) / (row.hk ?? 1),
            }))
            .filter((o) => !startKnown || o.t > 0)
            .sort((a, b) => a.t - b.t);
        if (observations.length === 0) continue;

        const first = observations[0];
        const last = observations[observations.length - 1];

        const idx = {
            yellow: firstSustainedIndex(observations, YELLOW_THRESHOLD),
            green: firstSustainedIndex(observations, GREEN_THRESHOLD),
            blue: firstSustainedIndex(observations, BLUE_THRESHOLD),
        };
        const at = (band: NextBand) => (idx[band] >= 0 ? observations[idx[band]].t : null);
        // Saat tembus benar-benar terlihat: ada catatan sebelumnya, atau minggu
        // mulainya diketahui dan ia tembus di minggu-minggu awal. Kalau tidak,
        // warnanya sudah tercapai sebelum data direkam — lamanya tidak terukur.
        const onsetSeen = (band: NextBand) =>
            idx[band] > 0 || (idx[band] === 0 && startKnown && first.t <= 2);

        const span = (from: NextBand, to: NextBand) => {
            const a = at(from);
            const b = at(to);
            return onsetSeen(from) && a !== null && b !== null ? b - a : null;
        };

        const currentBand: ProgressBand =
            idx.blue >= 0 ? 'blue' : idx.green >= 0 ? 'green' : idx.yellow >= 0 ? 'yellow' : 'red';

        drafts.push({
            personId: draft.personId,
            name: draft.name,
            colorHex: draft.colorHex,
            startKnown,
            firstWeek: first.t,
            currentWeek: last.t,
            currentGram: last.gramPerHk,
            currentBand,
            active: last.periodIndex >= lastIndex - 1,
            reachedAtWeek: {
                yellow: startKnown ? at('yellow') : null,
                green: startKnown ? at('green') : null,
                blue: startKnown ? at('blue') : null,
            },
            redToYellowWeeks: startKnown && onsetSeen('yellow') ? at('yellow') : null,
            yellowToGreenWeeks: span('yellow', 'green'),
            greenToBlueWeeks: span('green', 'blue'),
            observations,
            bandSince: currentBand === 'red' ? 0 : onsetSeen(currentBand) ? at(currentBand) : null,
            points: observations.map((o) => ({ t: o.t, gramPerHk: o.gramPerHk, periodLabel: o.periodLabel })),
        });
    }

    const collect = (key: 'redToYellowWeeks' | 'yellowToGreenWeeks' | 'greenToBlueWeeks') =>
        drafts.map((d) => d[key]).filter((v): v is number => v !== null);

    const redToYellow = stats(collect('redToYellowWeeks'), TARGET_YELLOW_WEEK);
    const yellowToGreen = stats(collect('yellowToGreenWeeks'), TARGET_GREEN_WEEK - TARGET_YELLOW_WEEK);
    // Belum ada target bisnis untuk biru — cukup lamanya saja.
    const greenToBlue = stats(collect('greenToBlueWeeks'), null);

    const medianTo: Record<NextBand, number | null> = {
        yellow: redToYellow.median,
        green: yellowToGreen.median,
        blue: greenToBlue.median,
    };

    const persons: PersonProgression[] = drafts.map(({ observations, bandSince, ...person }) => ({
        ...person,
        forecast: forecastFor(person, observations, bandSince, medianTo),
    }));

    const current: Record<ProgressBand, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
    for (const p of persons) if (p.active) current[p.currentBand] += 1;

    return { persons, redToYellow, yellowToGreen, greenToBlue, current };
}

/**
 * Perkiraan kapan anak tembus warna berikutnya.
 *
 * 1. Tren anak itu sendiri: garis lurus dari 6 catatan terakhirnya. Kalau naik
 *    cukup jelas, sisa jarak ke ambang ÷ kenaikan per minggu.
 * 2. Kalau trennya datar/turun/datanya kurang: pakai nilai tengah semua anak
 *    untuk perpindahan itu, dikurangi yang sudah dijalani.
 */
function forecastFor(
    person: Omit<PersonProgression, 'forecast'>,
    observations: Observation[],
    bandSince: number | null,
    medianTo: Record<NextBand, number | null>,
): Forecast | null {
    const toward = NEXT[person.currentBand];
    if (!person.active || !toward) return null;
    const threshold = THRESHOLD[toward];
    const now = person.currentWeek;
    const result = (weeksLeft: number | null, method: Forecast['method'], pending = false): Forecast => ({
        toward,
        weeksLeft,
        atWeek: person.startKnown && weeksLeft !== null ? now + weeksLeft : null,
        method,
        pending,
    });

    // Minggu terakhir sudah di atas ambang: tinggal satu minggu lagi untuk
    // dihitung tembus (aturan 2 minggu berturut-turut).
    if (person.currentGram >= threshold) return result(1, 'tren', true);

    const slope = slopeOf(observations.slice(-TREND_WINDOW));
    if (slope !== null && slope >= MIN_SLOPE) {
        const left = Math.max(1, Math.ceil((threshold - person.currentGram) / slope));
        return result(left <= MAX_FORECAST_WEEKS ? left : null, 'tren');
    }

    // Nilai tengah kelompok: lebih tahan terhadap satu-dua anak yang ekstrem.
    // Anak yang sudah melewati nilai tengah tapi trennya tidak naik sengaja
    // TIDAK diberi angka: "1 minggu lagi" untuk anak yang justru tertinggal
    // akan menyesatkan — lebih jujur ditampilkan "belum terlihat".
    const median = medianTo[toward];
    const sinceStart = toward === 'yellow' ? (person.startKnown ? 0 : null) : bandSince;
    const remaining = median !== null && sinceStart !== null ? Math.round(median - (now - sinceStart)) : null;
    return result(remaining !== null && remaining >= 1 ? remaining : null, 'rata-rata');
}

/* ─── Target vs realita per minggu kerja ──────────────────────── */

/** Target kapasitas menurut tangga target (Rekap Bulanan): minggu 1–12, 13–20, Mandiri. */
export function targetForWeek(week: number): number {
    const [pemula, perintis, mandiri] = TARGET_TIERS;
    if (week <= TARGET_YELLOW_WEEK) return pemula.value;
    if (week <= TARGET_GREEN_WEEK) return perintis.value;
    return mandiri.value;
}

export type TargetVsActual = {
    weeks: number[];
    target: number[];
    /** Rata-rata semua anak di minggu kerja itu; null kalau anaknya < MIN_SAMPLE. */
    actual: Array<number | null>;
    sample: number[];
};

/** Titik rata-rata dari 1–2 anak terlalu mudah naik-turun karena satu orang. */
const MIN_SAMPLE = 3;
const MAX_CHART_WEEK = 40;

export function targetVsActual(persons: PersonProgression[]): TargetVsActual {
    const sums = new Map<number, { total: number; n: number }>();
    for (const person of persons) {
        if (!person.startKnown) continue;
        for (const p of person.points) {
            if (p.t < 1 || p.t > MAX_CHART_WEEK) continue;
            const bucket = sums.get(p.t) ?? { total: 0, n: 0 };
            bucket.total += p.gramPerHk;
            bucket.n += 1;
            sums.set(p.t, bucket);
        }
    }
    const lastWeek = Math.max(
        TARGET_GREEN_WEEK + 2,
        ...[...sums.entries()].filter(([, b]) => b.n >= MIN_SAMPLE).map(([w]) => w),
    );
    const weeks = Array.from({ length: lastWeek }, (_, i) => i + 1);
    return {
        weeks,
        target: weeks.map(targetForWeek),
        actual: weeks.map((w) => {
            const b = sums.get(w);
            return b && b.n >= MIN_SAMPLE ? b.total / b.n : null;
        }),
        sample: weeks.map((w) => sums.get(w)?.n ?? 0),
    };
}
