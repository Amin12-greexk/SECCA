'use client';

import { useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import {
    getMonthlyPayroll,
    getMonthlyPayrollMonths,
    type MonthlyPayrollMonth,
    type MonthlyPayrollResponse,
    type PerformaExpenseSummaryResponse,
    type PerformaHarianSummaryResponse,
} from '@/lib/api';
import HarianPayrollPanel from './HarianPayrollPanel';
import { downloadPayrollExcel } from './payrollExport';
import PayrollExpensePanel from './PayrollExpensePanel';

type Source = 'mingguan' | 'bulanan';

/**
 * Isi tab Penggajian. Sumber MINGGUAN = data Performa periode yang dipilih di
 * atas halaman (bisa dibuka rinciannya per mitra). Sumber BULANAN = file
 * "Data Penggajian" (total sebulan) — pilihan ini hanya muncul kalau sudah ada
 * bulan yang diunggah, dan sama sekali tidak menyentuh data kapasitas.
 */
export default function PenggajianTab({
    weeklyExpense,
    weeklyHarian,
    weeklyLabel,
    refreshKey,
    onSelectPerson,
}: {
    weeklyExpense: PerformaExpenseSummaryResponse | null;
    weeklyHarian: PerformaHarianSummaryResponse | null;
    weeklyLabel: string;
    refreshKey?: unknown;
    onSelectPerson: (personId: string) => void;
}) {
    const [source, setSource] = useState<Source>('mingguan');
    const [months, setMonths] = useState<MonthlyPayrollMonth[]>([]);
    const [month, setMonth] = useState('');
    // Hasil dicatat bersama kuncinya; "memuat" = kunci yang diminta belum sama
    // dengan kunci hasil terakhir (tanpa setState sinkron di dalam effect).
    const [loaded, setLoaded] = useState<{ key: string; data: MonthlyPayrollResponse | null } | null>(null);

    useEffect(() => {
        let cancelled = false;
        getMonthlyPayrollMonths()
            .then((list) => {
                if (cancelled) return;
                setMonths(list);
                setMonth((current) =>
                    list.some((item) => item.month === current) ? current : (list[list.length - 1]?.month ?? ''),
                );
                if (list.length === 0) setSource('mingguan');
            })
            .catch(() => !cancelled && setMonths([]));
        return () => {
            cancelled = true;
        };
    }, [refreshKey]);

    const requestKey = `${month}|${String(refreshKey)}`;
    useEffect(() => {
        if (source !== 'bulanan' || !month) return;
        let cancelled = false;
        getMonthlyPayroll(month)
            .then((data) => !cancelled && setLoaded({ key: requestKey, data }))
            .catch(() => !cancelled && setLoaded({ key: requestKey, data: null }));
        return () => {
            cancelled = true;
        };
    }, [source, month, requestKey]);

    const isMonthly = source === 'bulanan';
    const monthly = loaded?.key === requestKey ? loaded.data : null;
    const loading = isMonthly && Boolean(month) && loaded?.key !== requestKey;
    const expense = isMonthly ? (monthly?.expense ?? null) : weeklyExpense;
    const harian = isMonthly ? (monthly?.harian ?? null) : weeklyHarian;
    const label = isMonthly ? (monthly?.period?.label ?? '') : weeklyLabel;

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-3">
                {months.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm shadow-sm">
                            {(['mingguan', 'bulanan'] as const).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => setSource(item)}
                                    className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition-colors ${
                                        source === item ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {item === 'mingguan' ? 'Mingguan (Performa)' : 'Bulanan'}
                                </button>
                            ))}
                        </div>
                        {isMonthly ? (
                            <select
                                value={month}
                                onChange={(event) => setMonth(event.target.value)}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                                aria-label="Bulan penggajian"
                            >
                                {[...months].reverse().map((item) => (
                                    <option key={item.month} value={item.month}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        ) : null}
                    </div>
                ) : (
                    <span />
                )}

                <button
                    type="button"
                    disabled={loading || (!expense && !harian)}
                    onClick={() =>
                        downloadPayrollExcel(expense, harian, label || 'periode').catch(() => {})
                    }
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                    <FileDown className="h-4 w-4 text-green-600" />
                    Download Rangkuman (Excel)
                </button>
            </div>

            {isMonthly && loading ? <p className="text-sm text-gray-400">Memuat penggajian bulanan...</p> : null}

            <PayrollExpensePanel
                data={expense}
                periodLabel={label}
                // Rincian per mitra (modal) hanya ada untuk data mingguan Performa.
                onSelect={isMonthly ? undefined : onSelectPerson}
            />
            <HarianPayrollPanel data={harian} periodLabel={label} />
        </>
    );
}
