const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_NAMES = [
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
];

const parts = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
};

export const monthLabel = (month: string) => {
    const { y, m } = parts(`${month}-01`);
    return `${MONTH_NAMES[m - 1]} ${y}`;
};

export const dayNumber = (iso: string) => String(parts(iso).d);
export const dayName = (iso: string) => DAY_NAMES[parts(iso).dow];
export const isSunday = (iso: string) => parts(iso).dow === 0;

/** "15 Okt" */
export const shortDate = (iso: string) => {
    const { m, d } = parts(iso);
    return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`;
};

export const longDate = (iso: string) => {
    const { y, m, d, dow } = parts(iso);
    return `${DAY_NAMES[dow]}, ${d} ${MONTH_NAMES[m - 1]} ${y}`;
};

export const weekLabel = (week: { start: string; end: string }) =>
    `${shortDate(week.start)} – ${shortDate(week.end)}`;

/** 493 → "8j 13m" */
export const formatDuration = (minutes: number | null | undefined) => {
    if (minutes === null || minutes === undefined) return '–';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}j ${String(m).padStart(2, '0')}m`;
};

export const shiftLabel = (shifts: number[]) =>
    shifts.length === 0 ? '–' : shifts.map((s) => `Shift ${s}`).join(' + ');
