/**
 * Terjemahan level mitra menjadi lama kerja.
 *
 * Tabel level resmi: 0 Training (0 mgg), 1 "Mitra Perintis" (1 mgg),
 * 2 "Mitra Perintis2" (2 mgg), ... 20 "Mitra Perintis20" (20 mgg),
 * 21 "Mitra Mandiri". "BULANAN" pekerja bulanan, di luar sistem borong.
 *
 * Perhatikan level 1 ditulis TANPA angka. Lihat `bareIsWeekOne`.
 *
 * "Mitra Mandiri" sengaja tidak diberi angka minggu meski tabel menulis 21:
 * itu status menyerap — mitra tetap "Mandiri" selama berbulan-bulan (31 dari
 * 74 mitra bertahan 10+ periode, banyak yang 15/15), jadi 21 adalah batas
 * BAWAH, bukan lama kerja berjalan. Memakainya sebagai angka pasti akan
 * menaruh checkpoint minggu 12/20 di periode yang salah.
 */

/** "Mitra Perintis" tanpa angka = level 1 = 1 minggu. */
function bareIsWeekOne(raw: string) {
    return /perintis/i.test(raw) && !/\d/.test(raw);
}

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
        const weeks = levelNumber != null && levelNumber > 0
            ? levelNumber
            : bareIsWeekOne(raw)
              ? 1
              : null;
        if (weeks != null) {
            return { short: `${weeks} mgg`, label: `±${weeks} minggu kerja` };
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
    if (/perintis|minggu/i.test(raw)) {
        if (levelNumber != null && levelNumber > 0) return levelNumber;
        // Data yang sudah tersimpan sebelum parser diperbaiki menyimpan null
        // untuk "Mitra Perintis" polos; dipulihkan di sini supaya tidak perlu
        // impor ulang seluruh workbook.
        if (bareIsWeekOne(raw)) return 1;
    }
    return null;
}

/**
 * Sudah lewat 20 minggu kerja? Mandiri = pasti ya; Perintis dihitung dari
 * levelNumber (kasus jaga-jaga bila belum sempat naik status ke Mandiri).
 */
export function isVeteranTenure(
    rawUserLevel?: string | null,
    levelNumber?: number | null,
): boolean {
    const raw = rawUserLevel?.trim();
    if (!raw) return false;
    if (/mandiri/i.test(raw)) return true;
    if (/perintis|minggu/i.test(raw) && levelNumber != null && levelNumber > 20) return true;
    return false;
}
