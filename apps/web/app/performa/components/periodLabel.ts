/**
 * Merapikan label periode untuk ditampilkan.
 *
 * Label mentah datang apa adanya dari nama sheet Excel dan formatnya tidak
 * konsisten: "07-13 MEI 26", "14 - 20 MEI 26", "30 JULI - 05 AGST" (tanpa
 * tahun), bahkan ada salah ketik "25 JUNI - 01 JUNI 26" yang maksudnya
 * berakhir di Juli. Karena backend sudah menyimpan startDate/endDate hasil
 * parsing, tanggal itulah sumber yang dipakai — bukan teks labelnya — jadi
 * salah ketik pada nama sheet ikut terkoreksi saat ditampilkan.
 *
 * PENTING: jangan pakai hasil fungsi ini sebagai kunci pencocokan. Label chart
 * kapasitas memakai `stripPeriode(period.label)` sebagai key di
 * capacityTrendChart; menormalisasi salah satu sisi saja akan memutus marker
 * checkpoint tanpa error.
 */

const MONTHS_ID = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember',
] as const;

/** Singkatan yang muncul di nama sheet → indeks bulan (0-based). Disamakan
 * dengan map MONTHS di audit-dashboard.parser.ts sisi backend. */
const MONTH_ALIASES: Record<string, number> = {
    januari: 0, jan: 0,
    februari: 1, feb: 1, pebruari: 1, peb: 1,
    maret: 2, mar: 2,
    april: 3, apr: 3,
    mei: 4,
    juni: 5, jun: 5,
    juli: 6, jul: 6,
    agustus: 7, agu: 7, ags: 7, agt: 7, agst: 7, agsts: 7, agus: 7,
    september: 8, sep: 8, sept: 8,
    oktober: 9, okt: 9,
    november: 10, nov: 10, nop: 10, nopember: 10,
    desember: 11, des: 11,
};

export type PeriodLike = {
    label: string;
    startDate?: string | null;
    endDate?: string | null;
    year?: number | null;
};

/** Tanggal disimpan sebagai UTC midnight; baca komponennya sebagai UTC juga
 * supaya zona waktu lokal tidak menggeser tanggalnya mundur sehari. */
function toUtcParts(value: string | null | undefined) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return {
        day: date.getUTCDate(),
        month: date.getUTCMonth(),
        year: date.getUTCFullYear(),
    };
}

/**
 * Rapikan label mentah saat tanggal tidak tersedia: buang awalan "periode",
 * ubah TERIAKAN jadi Kapital Awal, panjangkan singkatan bulan, dan lengkapi
 * tahun 2 digit. Selalu mengembalikan sesuatu — tidak pernah string kosong.
 */
function tidyRawLabel(label: string) {
    const cleaned = label
        // Awalan yang sama seperti yang dibuang parser backend.
        .replace(/^(data\s+periode|rekap\s+payroll)\s+/i, '')
        .replace(/^periode\s*/i, '')
        .trim();
    if (!cleaned) return label;

    const tokens = cleaned.replace(/\s*[-–—]\s*/g, ' – ').split(/\s+/);
    const lastIndex = tokens.length - 1;

    return tokens
        .map((token, i) => {
            const key = token.toLowerCase().replace(/[.,]/g, '');
            const monthIndex = MONTH_ALIASES[key];
            if (monthIndex !== undefined) return MONTHS_ID[monthIndex];
            // Tahun 2 digit HANYA kalau berada di posisi terakhir. Angka 2 digit
            // di tengah itu tanggal — "06 - 12 AGST" bukan "2006 - 2012 Agustus".
            if (i === lastIndex && /^\d{2}$/.test(token)) return `20${token}`;
            // Buang nol di depan supaya sama dengan jalur bertanggal: "05" → "5".
            if (/^\d{1,2}$/.test(token)) return String(Number(token));
            return token;
        })
        .join(' ');
}

/**
 * Bentuk panjang untuk header, dropdown, dan judul modal.
 *
 *   7 – 13 Mei 2026            (satu bulan)
 *   28 Mei – 3 Juni 2026       (beda bulan, tahun sama)
 *   30 Des 2026 – 5 Jan 2027   (beda tahun → tahun ditulis di kedua sisi)
 */
export function formatPeriodLabel(period: PeriodLike | null | undefined): string {
    if (!period) return '';

    const start = toUtcParts(period.startDate);
    const end = toUtcParts(period.endDate);
    if (!start || !end) return tidyRawLabel(period.label);

    const startMonth = MONTHS_ID[start.month];
    const endMonth = MONTHS_ID[end.month];

    if (start.year !== end.year) {
        return `${start.day} ${startMonth} ${start.year} – ${end.day} ${endMonth} ${end.year}`;
    }
    if (start.month !== end.month) {
        return `${start.day} ${startMonth} – ${end.day} ${endMonth} ${end.year}`;
    }
    return `${start.day} – ${end.day} ${startMonth} ${start.year}`;
}
