'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import { fmtId } from '@/components/charts/chart-theme';
import type { PerformaExpenseSummaryResponse } from '@/lib/api';
import { getMitraCapacityColor } from './capacityBand';

const fmtRp = (value: number | null | undefined) =>
    value === null || value === undefined
        ? '–'
        : new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              maximumFractionDigits: 0,
          }).format(value);

const SELECT_CLASS =
    'w-48 rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none transition';

export function ExpenseTile({
    label,
    value,
    accent,
    hint,
    hero = false,
}: {
    label: string;
    value: string;
    accent: string;
    hint?: string;
    hero?: boolean;
}) {
    if (hero) {
        return (
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#047f2b] to-emerald-600 px-4 py-3 text-white shadow-sm">
                <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-100">{label}</p>
                <p className="mt-0.5 truncate text-lg font-bold">{value}</p>
                {hint ? <p className="mt-0.5 text-[10px] text-emerald-100/80">{hint}</p> : null}
            </div>
        );
    }
    return (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
                {label}
            </p>
            <p className="mt-0.5 truncate text-lg font-bold text-gray-900">{value}</p>
            {hint ? <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p> : null}
        </div>
    );
}

/**
 * Detail payroll & biaya per mitra untuk periode terpilih. Hanya tampil kalau
 * periode berformat WEEKLY_PAYROLL_DETAIL (expense-summary kosong untuk periode
 * lama karena workItems/payroll baru ada sejak format baru).
 */
export default function PayrollExpensePanel({
    data,
    periodLabel,
    onSelect,
}: {
    data: PerformaExpenseSummaryResponse | null;
    periodLabel?: string;
    onSelect?: (personId: string) => void;
}) {
    const [search, setSearch] = useState('');
    const [showTable, setShowTable] = useState(false);

    const rows = useMemo(() => {
        const list = data?.rows ?? [];
        // Filter out zero-activity rows (no HK, no production, no wages in this period)
        const validList = list.filter((row) => {
            return (
                (row.hk ?? 0) > 0 ||
                (row.totalBjd ?? 0) > 0 ||
                (row.totalBakuBasah ?? 0) > 0 ||
                (row.netWageRp ?? 0) !== 0 ||
                (row.pieceworkWageRp ?? 0) !== 0 ||
                (row.subsidyRp ?? 0) !== 0 ||
                (row.premiumRp ?? 0) !== 0 ||
                (row.mealAllowanceRp ?? 0) !== 0 ||
                (row.deductionRp ?? 0) !== 0
            );
        });
        const term = search.trim().toLowerCase();
        const filtered = term
            ? validList.filter((row) => row.name.toLowerCase().includes(term))
            : validList;
        return [...filtered].sort((a, b) => (b.netWageRp ?? 0) - (a.netWageRp ?? 0));
    }, [data, search]);

    if (!data || (data.rows?.length ?? 0) === 0) return null;

    const summary = data.summary;

    return (
        <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Wallet className="h-4 w-4 text-green-600" />
                Payroll &amp; Biaya Perusahaan
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                    {periodLabel ?? 'Periode ini'}
                </span>
            </h2>

            {summary ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <ExpenseTile
                        label="Upah Borong"
                        value={fmtRp(summary.totalBorongWageRp ?? summary.totalPieceworkWageRp)}
                        accent="#2a78d6"
                        hint={summary.totalBorongCount ? `${summary.totalBorongCount} mitra` : undefined}
                    />
                    <ExpenseTile
                        label="Gaji Bulanan"
                        value={fmtRp(summary.totalBulananWageRp ?? 0)}
                        accent="#8b5cf6"
                        hint={summary.totalBulananCount ? `60rb/HK · ${summary.totalBulananCount} mitra` : 'Rp 60rb/HK'}
                    />
                    <ExpenseTile
                        label="Tunjangan & Potongan"
                        value={fmtRp(
                            summary.totalSubsidyRp +
                                summary.totalPremiumRp +
                                summary.totalMealAllowanceRp -
                                Math.abs(summary.totalDeductionRp),
                        )}
                        accent="#eda100"
                        hint={`Subsidi ${fmtRp(summary.totalSubsidyRp)} · Premi ${fmtRp(summary.totalPremiumRp)} · Makan ${fmtRp(summary.totalMealAllowanceRp)} · Potongan -${fmtRp(Math.abs(summary.totalDeductionRp))}`}
                    />
                    <ExpenseTile
                        label="Akumulasi Upah"
                        value={fmtRp(summary.totalNetWageRp)}
                        accent="#047f2b"
                        hero
                    />
                </div>
            ) : null}

            {/* Tombol untuk menampilkan/menyembunyikan tabel detail */}
            <button
                type="button"
                onClick={() => setShowTable((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 cursor-pointer"
            >
                {showTable ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
                {showTable ? 'Sembunyikan Detail' : `Lihat Detail Pembayaran (${rows.length} mitra)`}
            </button>

            {showTable ? (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                        <p className="text-xs font-medium text-gray-500">{rows.length} mitra</p>
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Cari nama..."
                            className={SELECT_CLASS}
                        />
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
                                    <th className="px-4 py-2">Nama</th>
                                    <th className="px-4 py-2">PIN</th>
                                    <th className="px-4 py-2">Level</th>
                                    <th className="px-4 py-2 text-right">HK</th>
                                    <th className="px-4 py-2 text-right">Upah Pokok/Borong</th>
                                    <th className="px-4 py-2 text-right">Tarif / g</th>
                                    <th className="px-4 py-2 text-right">Subsidi+Premi+Makan</th>
                                    <th className="px-4 py-2 text-right">Potongan</th>
                                    <th className="px-4 py-2 text-right">Upah Bersih</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => {
                                    const isBulanan = /bulanan/i.test(row.normalizedLevel ?? row.rawUserLevel ?? '');
                                    const allowanceSum = (row.subsidyRp ?? 0) + (row.premiumRp ?? 0) + (row.mealAllowanceRp ?? 0);
                                    return (
                                        <tr
                                            key={row.personId}
                                            onClick={() => onSelect?.(row.personId)}
                                            className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                                        >
                                            <td className="px-4 py-2 font-medium text-gray-800">
                                                <span className="flex items-center gap-2">
                                                    <span
                                                        className="h-2.5 w-2.5 flex-none rounded-full"
                                                        style={{ backgroundColor: getMitraCapacityColor(row) }}
                                                    />
                                                    {row.name}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 font-mono text-xs text-gray-500">
                                                {row.pin ?? '–'}
                                            </td>
                                            <td className="px-4 py-2 text-gray-500">
                                                {isBulanan ? (
                                                    <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                                                        Bulanan (60rb/HK)
                                                    </span>
                                                ) : (
                                                    row.normalizedLevel ?? '–'
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-right text-gray-700 font-medium">{fmtId(row.hk ?? 0)}</td>
                                            <td className="px-4 py-2 text-right text-gray-700">
                                                {isBulanan ? fmtRp(row.netWageRp) : fmtRp(row.pieceworkWageRp ?? row.upahBorongRp)}
                                            </td>
                                            <td className="px-4 py-2 text-right text-xs text-gray-600">
                                                {isBulanan || row.effectivePieceworkRatePerGramRp == null
                                                    ? '—'
                                                    : `${fmtRp(row.effectivePieceworkRatePerGramRp)}/g`}
                                            </td>
                                            <td className="px-4 py-2 text-right text-gray-700">
                                                {allowanceSum > 0 ? fmtRp(allowanceSum) : '–'}
                                            </td>
                                            <td className="px-4 py-2 text-right text-red-600">
                                                {row.deductionRp ? fmtRp(row.deductionRp) : '–'}
                                            </td>
                                            <td className="px-4 py-2 text-right font-bold text-gray-900">
                                                {fmtRp(row.netWageRp)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
