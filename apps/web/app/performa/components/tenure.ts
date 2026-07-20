/**
 * Terjemahan level mitra menjadi lama kerja.
 *
 * Aturan bisnis: "Mitra Perintis N" berarti sudah N minggu bekerja (1–20);
 * setelah lewat 20 minggu naik jadi "Mitra Mandiri"; "BULANAN" adalah
 * pekerja bulanan yang tidak ikut sistem borong.
 */

export type Tenure = {
    /** Label pendek untuk daftar padat: "5 mgg", ">20 mgg", "Bulanan". */
    short: string;
    /** Label lengkap untuk badge/tooltip: "±5 minggu kerja", dst. */
    label: string;
};

export function describeTenure(
    rawUserLevel?: string | null,
    levelNumber?: number | null,
): Tenure | null {
    const raw = rawUserLevel?.trim();
    if (!raw) return null;

    if (/bulanan/i.test(raw)) {
        return { short: 'Bulanan', label: 'Bulanan (non-borong)' };
    }
    if (/mandiri/i.test(raw)) {
        return { short: '>20 mgg', label: '>20 minggu kerja' };
    }
    if (/perintis|minggu/i.test(raw)) {
        if (levelNumber != null && levelNumber > 0) {
            return { short: `${levelNumber} mgg`, label: `±${levelNumber} minggu kerja` };
        }
        return { short: 'Perintis', label: 'Perintis (minggu belum tercatat)' };
    }

    return { short: raw, label: raw };
}

/**
 * Lama kerja dalam minggu untuk dihitung selisihnya antar periode.
 * Mandiri/Bulanan tidak punya angka pasti -> null (delta tidak dihitung).
 */
export function tenureWeeks(
    rawUserLevel?: string | null,
    levelNumber?: number | null,
): number | null {
    const raw = rawUserLevel?.trim();
    if (!raw) return null;
    if (/perintis|minggu/i.test(raw) && levelNumber != null && levelNumber > 0) {
        return levelNumber;
    }
    return null;
}
