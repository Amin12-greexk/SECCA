'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AuditMonthlyPeriod } from '@/lib/api';

type Props = {
    months: AuditMonthlyPeriod[];
    /** id bulan yang sedang aktif (sumber kebenaran ada di parent). */
    value: string;
    onChange: (periodId: string) => void;
    disabled?: boolean;
    /** Dipakai oleh salinan mengambang (StickyMonthlyPeriodPicker): chrome-nya
     * (bayangan, latar solid) disediakan pembungkus, jadi kotaknya sendiri
     * dibuat polos. */
    floating?: boolean;
};

/**
 * Pemilih bulan berbentuk slider linimasa — adaptasi PeriodPicker.tsx di
 * /performa untuk granularitas bulanan (AuditMonthlyPeriod, bukan
 * PerformaPeriod). Label sudah "Juni 2026" jadi apa adanya dari backend,
 * tidak perlu formatPeriodLabel seperti versi mingguan.
 */
export default function MonthlyPeriodPicker({
    months,
    value,
    onChange,
    disabled,
    floating = false,
}: Props) {
    const committedIndex = Math.max(
        0,
        months.findIndex((month) => month.id === value),
    );

    /** Posisi selama slider masih digeser — dipisah dari `value` supaya tiap
     * langkah geser tidak langsung menembak request; lihat catatan yang sama
     * di PeriodPicker.tsx (/performa) untuk alasan lengkapnya. */
    const [draft, setDraft] = useState<{ forValue: string; index: number } | null>(null);
    const draftIndex = draft && draft.forValue === value ? draft.index : null;

    const index = draftIndex ?? committedIndex;
    const current = months[index];
    const isEmpty = months.length === 0;
    const single = months.length <= 1;
    const locked = disabled || isEmpty;

    const commit = (nextIndex: number) => {
        setDraft(null);
        const next = months[nextIndex];
        if (next && next.id !== value) onChange(next.id);
    };

    const step = (delta: number) => {
        const nextIndex = Math.min(months.length - 1, Math.max(0, index + delta));
        if (nextIndex !== committedIndex) commit(nextIndex);
    };

    const arrowClass =
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 ' +
        'transition-colors hover:bg-white hover:text-green-700 ' +
        'disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent ' +
        'disabled:hover:text-gray-400';

    return (
        <div
            className={
                floating
                    ? 'w-full px-1 py-0.5'
                    : 'w-full rounded-lg border border-gray-200 bg-gray-50/70 px-2 py-1.5 sm:w-[15.5rem]'
            }
        >
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={locked || index <= 0}
                    className={arrowClass}
                    aria-label="Bulan sebelumnya"
                >
                    <ChevronLeft className="h-3.5 w-3.5" />
                </button>

                <p
                    className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-gray-900"
                    title={current ? `${current.label} · ${fmtRows(current.totalRows)}` : undefined}
                >
                    {isEmpty ? 'Belum ada data' : current?.label}
                </p>

                <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={locked || index >= months.length - 1}
                    className={arrowClass}
                    aria-label="Bulan berikutnya"
                >
                    <ChevronRight className="h-3.5 w-3.5" />
                </button>
            </div>

            {!isEmpty ? (
                <div className="mt-1 flex items-center gap-1.5">
                    <input
                        type="range"
                        min={0}
                        max={Math.max(0, months.length - 1)}
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
                        aria-label="Geser untuk memilih bulan"
                        aria-valuetext={current?.label}
                    />
                    <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
                        {index + 1}/{months.length}
                    </span>
                </div>
            ) : null}
        </div>
    );
}

function fmtRows(rows: number) {
    return `${rows} baris`;
}
