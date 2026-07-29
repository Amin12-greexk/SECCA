'use client';

import { useMemo } from 'react';
import type { PerformaSummaryResponse } from '@/lib/api';
import { ArrowDownRight, ArrowUpRight, UserMinus, UserPlus } from 'lucide-react';

const fmt = (value: number, fd = 0) =>
    new Intl.NumberFormat('id-ID', { minimumFractionDigits: fd, maximumFractionDigits: fd }).format(value);

export default function TurnoverAndShifts({
    currentSummary,
    prevSummary,
}: {
    currentSummary: PerformaSummaryResponse | null;
    prevSummary: PerformaSummaryResponse | null;
}) {
    const { newActiveCount, inactiveCount, topIncreases, topDecreases } = useMemo(() => {
        const currentRows = currentSummary?.rows || [];
        const prevRows = prevSummary?.rows || [];

        const currentMap = new Map();
        currentRows.forEach(r => currentMap.set(r.personId, r));
        
        const prevMap = new Map();
        prevRows.forEach(r => prevMap.set(r.personId, r));

        const allPersonIds = new Set([...currentMap.keys(), ...prevMap.keys()]);

        let newActiveCount = 0;
        let inactiveCount = 0;

        const performance: {
            personId: string;
            name: string;
            diffBjd: number;
            percentage: number;
            prevBjd: number;
            currentBjd: number;
        }[] = [];

        for (const personId of allPersonIds) {
            const current = currentMap.get(personId);
            const prev = prevMap.get(personId);

            const currentBjd = current?.totalBjd || 0;
            const prevBjd = prev?.totalBjd || 0;

            if (currentBjd > 0 && prevBjd === 0) newActiveCount++;
            if (currentBjd === 0 && prevBjd > 0) inactiveCount++;

            if (current && prev && prevBjd > 0) {
                const diffBjd = currentBjd - prevBjd;
                const percentage = Math.round((diffBjd / prevBjd) * 1000) / 10;
                
                performance.push({
                    personId,
                    name: current.name || prev.name,
                    diffBjd,
                    percentage,
                    prevBjd,
                    currentBjd
                });
            }
        }

        const sorted = performance.sort((a, b) => b.diffBjd - a.diffBjd);
        const topIncreases = sorted.filter(p => p.diffBjd > 0).slice(0, 10);
        const topDecreases = [...sorted].sort((a, b) => a.diffBjd - b.diffBjd).filter(p => p.diffBjd < 0).slice(0, 10);

        return { newActiveCount, inactiveCount, topIncreases, topDecreases };
    }, [currentSummary, prevSummary]);

    if (!prevSummary) {
        return null;
    }

    return (
        <div className="space-y-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-gray-800">
                    Perubahan & Turnover vs Periode Sebelumnya
                </h3>
                
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <UserPlus className="h-4 w-4 text-emerald-600" />
                            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700">Mitra Masuk</p>
                        </div>
                        <div className="flex items-end gap-2">
                            <p className="text-2xl font-bold text-emerald-900">{newActiveCount}</p>
                            <p className="mb-1 text-xs text-emerald-600">orang</p>
                        </div>
                    </div>
                    <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                        <div className="flex items-center gap-2 mb-1">
                            <UserMinus className="h-4 w-4 text-red-600" />
                            <p className="text-[11px] font-medium uppercase tracking-wide text-red-700">Mitra Keluar</p>
                        </div>
                        <div className="flex items-end gap-2">
                            <p className="text-2xl font-bold text-red-900">{inactiveCount}</p>
                            <p className="mb-1 text-xs text-red-600">orang</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div>
                        <h4 className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-3">
                            <ArrowUpRight className="h-4 w-4 text-green-600" />
                            Kapasitas Naik Signifikan
                        </h4>
                        {topIncreases.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Tidak ada kenaikan signifikan.</p>
                        ) : (
                            <div className="space-y-2">
                                {topIncreases.map((p) => (
                                    <div key={p.personId} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {fmt(p.prevBjd)} gr &rarr; {fmt(p.currentBjd)} gr
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-green-600">+{fmt(p.diffBjd)} gr</p>
                                            <p className="text-[10px] font-medium text-green-700 bg-green-100 rounded px-1.5 inline-block">+{p.percentage}%</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div>
                        <h4 className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-3">
                            <ArrowDownRight className="h-4 w-4 text-red-600" />
                            Kapasitas Turun Signifikan
                        </h4>
                        {topDecreases.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Tidak ada penurunan signifikan.</p>
                        ) : (
                            <div className="space-y-2">
                                {topDecreases.map((p) => (
                                    <div key={p.personId} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {fmt(p.prevBjd)} gr &rarr; {fmt(p.currentBjd)} gr
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-red-600">{fmt(p.diffBjd)} gr</p>
                                            <p className="text-[10px] font-medium text-red-700 bg-red-100 rounded px-1.5 inline-block">{p.percentage}%</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
