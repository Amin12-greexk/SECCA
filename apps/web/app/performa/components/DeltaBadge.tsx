'use client';

import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { fmtId } from '@/components/charts/chart-theme';

/** Badge naik/turun vs periode sebelumnya. */
export default function DeltaBadge({
    value,
    suffix = '',
    tone = 'light',
}: {
    value: number | null;
    suffix?: string;
    /** 'dark' untuk dipakai di atas tile gradient. */
    tone?: 'light' | 'dark';
}) {
    if (value === null) {
        return (
            <span className={`text-[11px] ${tone === 'dark' ? 'text-white/60' : 'text-gray-400'}`}>
                periode pertama
            </span>
        );
    }

    const rounded = Math.round(value * 10) / 10;
    if (rounded === 0) {
        return (
            <span
                className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                    tone === 'dark' ? 'text-white/80' : 'text-gray-500'
                }`}
            >
                <Minus className="h-3 w-3" /> stabil
            </span>
        );
    }

    const up = rounded > 0;
    const Icon = up ? TrendingUp : TrendingDown;
    const cls =
        tone === 'dark'
            ? 'bg-white/15 text-white'
            : up
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700';

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}
        >
            <Icon className="h-3 w-3" />
            {up ? '+' : ''}
            {fmtId(rounded, 1)}
            {suffix}
        </span>
    );
}
