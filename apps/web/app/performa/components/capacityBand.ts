/**
 * Band kapasitas (gram Barang Jadi per HK) — mengikuti klasifikasi "Kapasitas"
 * yang sudah dipakai di sheet Excel sumber (kolom LEVEL | Kapasitas).
 *
 * Batas bawah inklusif, batas atas eksklusif: 24,9 g/hk selalu masuk merah,
 * tepat 25 g/hk sudah masuk kuning. Band biru tidak berbatas atas.
 */

export type CapacityBand = {
    key: 'red' | 'yellow' | 'green' | 'blue' | 'purple';
    label: string;
    color: string;
};

const BANDS: Array<{ min: number; max: number | null } & CapacityBand> = [
    { min: 0, max: 25, key: 'red', label: '0–25 g/hk', color: '#e34948' },
    { min: 25, max: 35, key: 'yellow', label: '25–35 g/hk', color: '#eda100' },
    { min: 35, max: 50, key: 'green', label: '35–50 g/hk', color: '#1baf7a' },
    { min: 50, max: null, key: 'blue', label: '≥50 g/hk', color: '#2a78d6' },
];

export function classifyCapacity(gramPerHk: number | null | undefined): CapacityBand | null {
    if (gramPerHk == null || !Number.isFinite(gramPerHk) || gramPerHk < 0) return null;
    const match = BANDS.find(
        (band) => gramPerHk >= band.min && (band.max === null || gramPerHk < band.max),
    );
    return match ? { key: match.key, label: match.label, color: match.color } : null;
}

export const BULANAN_BAND: CapacityBand = {
    key: 'purple',
    label: 'Bulanan',
    color: '#8b5cf6',
};

/** Daftar band untuk legenda/filter — urut dari terendah ke tertinggi. */
export const CAPACITY_BANDS: CapacityBand[] = [
    ...BANDS.map(({ key, label, color }) => ({ key, label, color })),
    BULANAN_BAND,
];

/** Ambang batas tiap band (dipakai markArea chart tren kapasitas). */
export const CAPACITY_BAND_RANGES = BANDS.map(({ min, max, color }) => ({ min, max, color }));

/** Warna identitas mitra otomatis berdasarkan band kapasitas atau status anak bulanan. */
export function getMitraCapacityColor(row: {
    hk?: number | null;
    totalBjd?: number | null;
    normalizedLevel?: string | null;
    rawUserLevel?: string | null;
} | null | undefined): string {
    if (!row) return '#2a78d6';
    const isBulanan = /bulanan/i.test(row.normalizedLevel ?? row.rawUserLevel ?? '');
    if (isBulanan) return BULANAN_BAND.color;
    const hk = row.hk ?? 0;
    const bjd = row.totalBjd ?? 0;
    const gramPerHk = hk > 0 ? bjd / hk : 0;
    const band = classifyCapacity(gramPerHk);
    return band ? band.color : '#d1d5db';
}

