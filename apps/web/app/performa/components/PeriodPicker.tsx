'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PerformaPeriod } from '@/lib/api';
import { formatPeriodLabel } from './periodLabel';

type Props = {
    periods: PerformaPeriod[];
    /** id periode yang sedang aktif (sumber kebenaran ada di parent). */
    value: string;
    onChange: (periodId: string) => void;
    disabled?: boolean;
};

/**
 * Pemilih periode berbentuk slider linimasa.
 *
 * Menggantikan <select> yang lebarnya ikut memanjang mengikuti label terpanjang
 * dan menuntut orang memindai 15 baris teks untuk pindah satu minggu. Periode di
 * sini urut kronologis (sortOrder naik), jadi slider + tombol maju/mundur lebih
 * pas: lebarnya tetap, posisi relatif terhadap keseluruhan data langsung
 * terlihat, dan geser satu langkah jauh lebih cepat daripada buka dropdown.
 */
export default function PeriodPicker({ periods, value, onChange, disabled }: Props) {
    const committedIndex = Math.max(
        0,
        periods.findIndex((period) => period.id === value),
    );

    /**
     * Posisi selama slider masih digeser. Wajib dipisah dari `value`: input
     * range memicu onChange tiap langkah, jadi kalau tiap langkah langsung
     * memanggil onChange (yang menembak request ringkasan periode), sekali
     * geser dari ujung ke ujung mengirim belasan request dan hasil yang datang
     * terakhir belum tentu periode yang dilepas. Draft hanya untuk tampilan;
     * pengiriman terjadi saat dilepas.
     *
     * `forValue` membuat draft membatalkan dirinya sendiri: begitu periode
     * berubah dari luar (muat awal, refresh, upload/reset), penanda ini tidak
     * lagi cocok dan posisi otomatis balik mengikuti `value`. Pola ini dipakai
     * supaya tidak perlu useEffect yang menyetel state — itu memicu render
     * berantai dan ditolak lint.
     */
    const [draft, setDraft] = useState<{ forValue: string; index: number } | null>(null);
    const draftIndex = draft && draft.forValue === value ? draft.index : null;

    const index = draftIndex ?? committedIndex;
    const current = periods[index];
    const isEmpty = periods.length === 0;
    const single = periods.length <= 1;
    const locked = disabled || isEmpty;

    const commit = (nextIndex: number) => {
        setDraft(null);
        const next = periods[nextIndex];
        if (next && next.id !== value) onChange(next.id);
    };

    const step = (delta: number) => {
        const nextIndex = Math.min(periods.length - 1, Math.max(0, index + delta));
        if (nextIndex !== committedIndex) commit(nextIndex);
    };

    const arrowClass =
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 ' +
        'transition-colors hover:bg-white hover:text-green-700 ' +
        'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent ' +
        'disabled:hover:text-gray-400';

    const fullLabel = current ? formatPeriodLabel(current) : '';

    return (
        <div className="w-full rounded-lg border border-gray-200 bg-gray-50/70 px-2 py-1.5 sm:w-[15.5rem]">
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={locked || index <= 0}
                    className={arrowClass}
                    aria-label="Periode sebelumnya"
                >
                    <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                <p
                    className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-gray-900"
                    title={
                        current
                            ? `${fullLabel} · ${current.totalMetrics} orang`
                            : undefined
                    }
                >
                    {isEmpty ? 'Belum ada data' : fullLabel}
                </p>

                <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={locked || index >= periods.length - 1}
                    className={arrowClass}
                    aria-label="Periode berikutnya"
                >
                    <ChevronRight className="h-3.5 w-3.5" />
                </button>
            </div>

            {!isEmpty ? (
                <div className="mt-1 flex items-center gap-1.5">
                    <input
                        type="range"
                        min={0}
                        max={Math.max(0, periods.length - 1)}
                        step={1}
                        value={index}
                        disabled={locked || single}
                        onChange={(event) =>
                            setDraft({ forValue: value, index: Number(event.target.value) })
                        }
                        // Kirim hanya saat geseran selesai — lihat catatan draft di atas.
                        onPointerUp={() => commit(index)}
                        onKeyUp={() => commit(index)}
                        onBlur={() => {
                            if (draftIndex !== null) commit(draftIndex);
                        }}
                        className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Geser untuk memilih periode"
                        aria-valuetext={fullLabel || undefined}
                    />
                    <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
                        {index + 1}/{periods.length}
                    </span>
                </div>
            ) : null}
        </div>
    );
}
