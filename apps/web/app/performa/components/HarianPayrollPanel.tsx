'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, HardHat } from 'lucide-react';
import { fmtId } from '@/components/charts/chart-theme';
import type { PerformaHarianSummaryResponse } from '@/lib/api';
import { ExpenseTile } from './PayrollExpensePanel';

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

/**
 * Payroll "Anak Harian" — staf pendukung pabrik dibayar harian (Cleaning
 * Service, QC, Trainer, dst), populasi & skema gajinya terpisah total dari
 * mitra bulu (tidak ada Baku Basah/BJD/Rendemen/Kapasitas). Section sendiri
 * di halaman /performa yang sama, mengikuti pola visual PayrollExpensePanel
 * supaya konsisten satu halaman.
 */
export default function HarianPayrollPanel({
    data,
    periodLabel,
}: {
    data: PerformaHarianSummaryResponse | null;
    periodLabel?: string;
}) {
    const [search, setSearch] = useState('');
    const [bagianFilter, setBagianFilter] = useState<string | null>(null);
    const [showTable, setShowTable] = useState(false);

    const allRows = useMemo(() => data?.rows ?? [], [data]);

    const rows = useMemo(() => {
        let list = allRows;
        if (bagianFilter) {
            list = list.filter((row) => (row.bagian ?? 'Lainnya') === bagianFilter);
        }
        const term = search.trim().toLowerCase();
        if (term) {
            list = list.filter((row) => row.name.toLowerCase().includes(term));
        }
        return [...list].sort((a, b) => (b.totalUpahRp ?? 0) - (a.totalUpahRp ?? 0));
    }, [allRows, bagianFilter, search]);

    if (!data || allRows.length === 0) return null;

    const summary = data.summary;

    return (
        <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <HardHat className="h-4 w-4 text-amber-600" />
                Payroll Anak Harian
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    {periodLabel ?? 'Periode ini'}
                </span>
            </h2>

            {summary ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <ExpenseTile
                        label="Jumlah Anak Harian"
                        value={fmtId(summary.totalPeople, 0)}
                        accent="#2a78d6"
                    />
                    <ExpenseTile
                        label="Gaji Pokok"
                        value={fmtRp(summary.totalGapokRp)}
                        accent="#8b5cf6"
                    />
                    <ExpenseTile
                        label="Lembur (Weekday + Wkend)"
                        value={fmtRp(summary.totalUpahLemburWeekdayRp + summary.totalUpahLemburWeekendRp)}
                        accent="#eda100"
                        hint={`Weekday ${fmtRp(summary.totalUpahLemburWeekdayRp)} · Weekend ${fmtRp(summary.totalUpahLemburWeekendRp)}`}
                    />
                    <ExpenseTile
                        label="Total Upah Bersih"
                        value={fmtRp(summary.totalUpahBersihRp)}
                        accent="#047f2b"
                        hero
                    />
                </div>
            ) : null}

            {data.byBagian.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setBagianFilter(null)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            bagianFilter === null
                                ? 'border-green-600 bg-green-600 text-white'
                                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        Semua Bagian
                    </button>
                    {data.byBagian.map((b) => (
                        <button
                            key={b.bagian}
                            type="button"
                            onClick={() => setBagianFilter((prev) => (prev === b.bagian ? null : b.bagian))}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                bagianFilter === b.bagian
                                    ? 'border-green-600 bg-green-600 text-white'
                                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {b.bagian} · {b.count}
                        </button>
                    ))}
                </div>
            ) : null}

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
                {showTable ? 'Sembunyikan Detail' : `Lihat Detail Pembayaran (${allRows.length} anak harian)`}
            </button>

            {showTable ? (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                        <p className="text-xs font-medium text-gray-500">{rows.length} anak harian</p>
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
                                    <th className="px-4 py-2">Bagian</th>
                                    <th className="px-4 py-2 text-right">Hari Kerja</th>
                                    <th className="px-4 py-2 text-right">Gapok</th>
                                    <th className="px-4 py-2 text-right">Upah</th>
                                    <th className="px-4 py-2 text-right">Lembur</th>
                                    <th className="px-4 py-2 text-right">Makan+Premi+Tunj.</th>
                                    <th className="px-4 py-2 text-right">Potongan</th>
                                    <th className="px-4 py-2 text-right">Total Upah</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => {
                                    const lemburSum = (row.upahLemburWeekdayRp ?? 0) + (row.upahLemburWeekendRp ?? 0);
                                    const allowanceSum =
                                        (row.uangMakanRp ?? 0) + (row.premiRp ?? 0) + (row.tunjanganRp ?? 0);
                                    return (
                                        <tr
                                            key={row.id}
                                            className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors"
                                        >
                                            <td className="px-4 py-2 font-medium text-gray-800">{row.name}</td>
                                            <td className="px-4 py-2 font-mono text-xs text-gray-500">
                                                {row.pin ?? '–'}
                                            </td>
                                            <td className="px-4 py-2 text-gray-500">{row.bagian ?? '–'}</td>
                                            <td className="px-4 py-2 text-right text-gray-700 font-medium">
                                                {row.hariKerjaRaw ?? '–'}
                                            </td>
                                            <td className="px-4 py-2 text-right text-gray-700">{fmtRp(row.gapokRp)}</td>
                                            <td className="px-4 py-2 text-right text-gray-700">{fmtRp(row.upahRp)}</td>
                                            <td className="px-4 py-2 text-right text-gray-700">
                                                {lemburSum > 0 ? fmtRp(lemburSum) : '–'}
                                            </td>
                                            <td className="px-4 py-2 text-right text-gray-700">
                                                {allowanceSum > 0 ? fmtRp(allowanceSum) : '–'}
                                            </td>
                                            <td className="px-4 py-2 text-right text-red-600">
                                                {row.potonganRp ? fmtRp(Math.abs(row.potonganRp)) : '–'}
                                            </td>
                                            <td className="px-4 py-2 text-right font-bold text-gray-900">
                                                {fmtRp(row.totalUpahRp)}
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
