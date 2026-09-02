'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AuditMonthlyPeriod } from '@/lib/api';
import MonthlyPeriodPicker from './MonthlyPeriodPicker';

type Props = {
    months: AuditMonthlyPeriod[];
    value: string;
    onChange: (periodId: string) => void;
    disabled?: boolean;
};

/**
 * Pemilih bulan di header, plus salinan mengambang yang muncul sendiri
 * begitu yang asli tergulir keluar layar — adaptasi persis
 * StickyPeriodPicker.tsx di /performa untuk MonthlyPeriodPicker.
 *
 * Keduanya memakai `value` dan `onChange` yang sama, jadi tidak ada state
 * kedua yang bisa melenceng — yang mana pun digeser, satu sumber yang berubah.
 */
export default function StickyMonthlyPeriodPicker({ months, value, onChange, disabled }: Props) {
    const anchorRef = useRef<HTMLDivElement>(null);
    const [outOfView, setOutOfView] = useState(false);

    useEffect(() => {
        const el = anchorRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => setOutOfView(!entry.isIntersecting),
            // rootMargin atas -72px: saat login ada header aplikasi setinggi itu
            // yang menutupi bagian atas viewport, jadi pemilih dianggap "hilang"
            // tepat ketika benar-benar tertutup header, bukan sebelumnya.
            { threshold: 0, rootMargin: '-72px 0px 0px 0px' },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Portal hanya dibuat setelah observer menyala (pasti sudah di klien), jadi
    // tidak perlu penjaga "mounted" yang bikin setState di dalam effect.
    const showFloating = outOfView && months.length > 0;

    return (
        <>
            <div ref={anchorRef}>
                <MonthlyPeriodPicker months={months} value={value} onChange={onChange} disabled={disabled} />
            </div>

            {showFloating
                ? createPortal(
                      <div
                          // z-40: konsisten dengan StickyPeriodPicker /performa.
                          className="fixed bottom-4 left-1/2 z-40 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-gray-200 bg-white/95 px-2 py-1.5 shadow-lg ring-1 ring-black/5 backdrop-blur-sm"
                      >
                          <MonthlyPeriodPicker
                              months={months}
                              value={value}
                              onChange={onChange}
                              disabled={disabled}
                              floating
                          />
                      </div>,
                      document.body,
                  )
                : null}
        </>
    );
}
