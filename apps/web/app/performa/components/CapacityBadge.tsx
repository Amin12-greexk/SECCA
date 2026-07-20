'use client';

import { withAlpha } from '@/components/charts/chart-theme';
import { classifyCapacity } from './capacityBand';

/** Indikator band kapasitas gram/HK: titik ringkas (daftar padat) atau pill berlabel. */
export default function CapacityBadge({
    gramPerHk,
    variant = 'dot',
}: {
    gramPerHk: number | null | undefined;
    variant?: 'dot' | 'pill';
}) {
    const band = classifyCapacity(gramPerHk);
    if (!band) return null;

    if (variant === 'dot') {
        return (
            <span
                className="inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-white"
                style={{ backgroundColor: band.color }}
                title={`Kapasitas ${band.label}`}
            />
        );
    }

    return (
        <span
            className="inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap"
            style={{ backgroundColor: withAlpha(band.color, 0.15), color: band.color }}
            title={`Kapasitas ${band.label}`}
        >
            {band.label}
        </span>
    );
}
