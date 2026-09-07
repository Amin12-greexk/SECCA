import {
    getPerformaExpenseSummary,
    getPerformaHarianSummary,
    getPerformaSummary,
    type PerformaExpenseSummaryResponse,
    type PerformaHarianSummaryResponse,
    type PerformaSummaryResponse,
} from '@/lib/api';

/**
 * Cache data per periode yang dipakai bersama halaman performa dan
 * MitraRanking.
 *
 * Kenapa perlu: satu kali geser slider periode dulu menembak banyak request
 * yang saling tumpang tindih —
 *   - halaman: ringkasan periode baru, biaya, harian, + ringkasan periode
 *     sebelumnya (yang terakhir ini bahkan di putaran jaringan terpisah)
 *   - MitraRanking: ringkasan 4 periode terakhir untuk kolom pembanding
 * Periode yang sama diminta dua komponen sekaligus, dan periode yang baru saja
 * ditinggalkan diminta lagi dari nol. Cache ini membuat geseran ke periode yang
 * sudah pernah dibuka tidak menembak jaringan sama sekali, dan dua pemanggil
 * yang meminta periode sama di saat bersamaan berbagi satu request (`inflight`).
 *
 * `scope` ikut jadi kunci karena /audit-dashboard/summary membuang kolom upah
 * dan PIN untuk pemanggil anonim: entri yang diambil sebelum login tidak boleh
 * dipakai ulang sesudah login (dan sebaliknya).
 */
export type SummaryScope = 'auth' | 'anon';

/** Satu laci cache per jenis data, masing-masing dengan dedupe request. */
function createStore<T>(fetcher: (periodId: string | undefined) => Promise<T>) {
    const cache = new Map<string, T>();
    const inflight = new Map<string, Promise<T>>();

    const keyOf = (periodId: string, scope: SummaryScope) => `${scope}::${periodId}`;

    return {
        fetch(periodId: string, scope: SummaryScope): Promise<T> {
            const key = keyOf(periodId, scope);

            const cached = cache.get(key);
            if (cached !== undefined) return Promise.resolve(cached);

            const pending = inflight.get(key);
            if (pending) return pending;

            const request = fetcher(periodId || undefined)
                .then((data) => {
                    // `null` = permintaan gagal (lihat expenseStore/harianStore yang
                    // menelan errornya). Jangan disimpan: kalau gagalnya cuma
                    // sesaat, hasil kosong itu akan menempel selamanya dan
                    // perpindahan periode berikutnya tidak pernah mencoba lagi.
                    if (data !== null) cache.set(key, data);
                    return data;
                })
                .finally(() => {
                    inflight.delete(key);
                });

            inflight.set(key, request);
            return request;
        },
        has(periodId: string, scope: SummaryScope) {
            return cache.has(keyOf(periodId, scope));
        },
        clear() {
            cache.clear();
            inflight.clear();
        },
    };
}

const summaryStore = createStore<PerformaSummaryResponse>((id) => getPerformaSummary(id));

/** Endpoint payroll menolak pemanggil anonim, jadi untuk scope 'anon' tidak
 * ditembak sama sekali — sama seperti perilaku halaman sebelumnya. */
const expenseStore = createStore<PerformaExpenseSummaryResponse | null>((id) =>
    getPerformaExpenseSummary(id).catch(() => null),
);
const harianStore = createStore<PerformaHarianSummaryResponse | null>((id) =>
    getPerformaHarianSummary(id).catch(() => null),
);

/** Ambil ringkasan periode, pakai cache kalau ada. */
export function fetchPeriodSummary(
    periodId: string,
    scope: SummaryScope,
): Promise<PerformaSummaryResponse> {
    return summaryStore.fetch(periodId, scope);
}

export function fetchPeriodExpense(
    periodId: string,
    scope: SummaryScope,
): Promise<PerformaExpenseSummaryResponse | null> {
    if (scope !== 'auth') return Promise.resolve(null);
    return expenseStore.fetch(periodId, scope);
}

export function fetchPeriodHarian(
    periodId: string,
    scope: SummaryScope,
): Promise<PerformaHarianSummaryResponse | null> {
    if (scope !== 'auth') return Promise.resolve(null);
    return harianStore.fetch(periodId, scope);
}

/** Sudah ada di cache -> pemanggil bisa lewat tanpa menyalakan indikator muat. */
export function hasPeriodSummary(periodId: string, scope: SummaryScope): boolean {
    return summaryStore.has(periodId, scope);
}

/** Seluruh data satu periode sudah tersaji dari cache (termasuk payroll kalau
 * pemanggil memang berhak melihatnya). */
export function hasPeriodBundle(periodId: string, scope: SummaryScope): boolean {
    if (!summaryStore.has(periodId, scope)) return false;
    if (scope !== 'auth') return true;
    return expenseStore.has(periodId, scope) && harianStore.has(periodId, scope);
}

/**
 * Data di server berubah (upload / reset) atau pengguna menekan Refresh —
 * seluruh isi cache harus dibuang, termasuk scope yang lain, karena id periode
 * bisa dipakai ulang oleh import baru.
 */
export function invalidatePeriodSummaries() {
    summaryStore.clear();
    expenseStore.clear();
    harianStore.clear();
}
