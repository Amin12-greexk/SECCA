'use client';

import { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { fmtBpsId, fmtId } from '@/components/charts/chart-theme';
import type { PerformaMonthlyExpenseStat } from '@/lib/api';

const fmtRp = (value: number | null | undefined) =>
    value === null || value === undefined
        ? '–'
        : new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              maximumFractionDigits: 0,
          }).format(value);

/** Label "MM/YYYY" -> urutan kronologis, bukan alfabetis. */
function sortByLabel(months: PerformaMonthlyExpenseStat[]) {
    return [...months].sort((a, b) => {
        const [monthA, yearA] = a.label.split('/').map(Number);
        const [monthB, yearB] = b.label.split('/').map(Number);
        return yearA !== yearB ? yearA - yearB : monthA - monthB;
    });
}

/**
 * Rekap bulanan biaya + produksi, digabung dari seluruh periode mingguan
 * (WEEKLY_PAYROLL_DETAIL) dalam bulan yang sama — sumber: /monthly-expenses.
 */
export default function MonthlyRecap({ months }: { months: PerformaMonthlyExpenseStat[] }) {
    const sorted = useMemo(() => sortByLabel(months), [months]);

    if (sorted.length === 0) return null;

    return (
        <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <CalendarDays className="h-4 w-4 text-green-600" />
                Rekap Bulanan
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                    {sorted.length} bulan
                </span>
            </h2>

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
                            <th className="px-4 py-2">Bulan</th>
                            <th className="px-4 py-2 text-right">Periode</th>
                            <th className="px-4 py-2 text-right">Total HK</th>
                            <th className="px-4 py-2 text-right">Baku Basah</th>
                            <th className="px-4 py-2 text-right">BJD</th>
                            <th className="px-4 py-2 text-right">Rendemen</th>
                            <th className="px-4 py-2 text-right">Upah Borong</th>
                            <th className="px-4 py-2 text-right">Subsidi+Premi+Makan</th>
                            <th className="px-4 py-2 text-right">Potongan</th>
                            <th className="px-4 py-2 text-right">Upah Bersih</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((month) => (
                            <tr key={month.label} className="border-b border-gray-50 last:border-0">
                                <td className="px-4 py-2 font-medium text-gray-800">{month.label}</td>
                                <td className="px-4 py-2 text-right text-gray-500">{month.periodCount}</td>
                                <td className="px-4 py-2 text-right text-gray-700">{fmtId(month.totalHk)}</td>
                                <td className="px-4 py-2 text-right text-gray-700">{fmtId(month.totalBakuBasah)}</td>
                                <td className="px-4 py-2 text-right text-gray-700">{fmtId(month.totalBjd)}</td>
                                <td className="px-4 py-2 text-right text-gray-700">
                                    {fmtBpsId(month.weightedRendemenPctBps)}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-700">
                                    {fmtRp(month.totalPieceworkWageRp)}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-700">
                                    {fmtRp(
                                        month.totalSubsidyRp + month.totalPremiumRp + month.totalMealAllowanceRp,
                                    )}
                                </td>
                                <td className="px-4 py-2 text-right text-red-600">{fmtRp(month.totalDeductionRp)}</td>
                                <td className="px-4 py-2 text-right font-semibold text-gray-900">
                                    {fmtRp(month.totalNetWageRp)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
