'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Wallet } from 'lucide-react';
import {
    getPerformaExpenseSummary,
    getPerformaHarianSummary,
    getPerformaPeriods,
    getPerformaSummary,
    type PerformaExpenseSummaryResponse,
    type PerformaHarianSummaryResponse,
    type PerformaPeriod,
    type PerformaRow,
} from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import HarianPayrollPanel from '../components/HarianPayrollPanel';
import MitraPayrollModal from '../components/MitraPayrollModal';
import PayrollExpensePanel from '../components/PayrollExpensePanel';

const SELECT_CLASS =
    'rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none transition';

/**
 * Payroll & Biaya Perusahaan — halaman sendiri, dipisah dari /performa supaya
 * dashboard utama tetap ringkas (fokus ke grafik kapasitas), sementara rincian
 * gaji (mitra borong/bulanan + anak harian) yang panjang tetap punya tempat
 * lega tanpa membuat dashboard produksi penuh sesak.
 */
function PayrollContent() {
    const [periods, setPeriods] = useState<PerformaPeriod[]>([]);
    const [periodId, setPeriodId] = useState('');
    const [expenseSummary, setExpenseSummary] = useState<PerformaExpenseSummaryResponse | null>(null);
    const [harianSummary, setHarianSummary] = useState<PerformaHarianSummaryResponse | null>(null);
    const [rows, setRows] = useState<PerformaRow[]>([]);
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadForPeriod = useCallback(async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const [expenseData, harianData, summaryData] = await Promise.all([
                getPerformaExpenseSummary(id || undefined).catch(() => null),
                getPerformaHarianSummary(id || undefined).catch(() => null),
                getPerformaSummary(id || undefined).catch(() => null),
            ]);
            setExpenseSummary(expenseData);
            setHarianSummary(harianData);
            setRows(summaryData?.rows ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal memuat data payroll.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const periodList = await getPerformaPeriods();
                setPeriods(periodList);
                const latest = periodList[periodList.length - 1]?.id ?? '';
                setPeriodId(latest);
                await loadForPeriod(latest);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Gagal memuat daftar periode.');
                setLoading(false);
            }
        })();
    }, [loadForPeriod]);

    const handlePeriodChange = (nextId: string) => {
        setPeriodId(nextId);
        loadForPeriod(nextId);
    };

    const periodLabel = expenseSummary?.period?.label ?? harianSummary?.period?.label ?? undefined;
    const isEmpty = !loading && !error && periods.length === 0;

    return (
        <div className="p-4 sm:p-8">
            <div className="mx-auto max-w-6xl space-y-5">
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 px-5 pt-5 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <Link
                                href="/performa"
                                className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                Kembali ke Dashboard Performa
                            </Link>
                            <h1 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                                <Wallet className="h-5 w-5 text-green-600" />
                                Payroll &amp; Biaya Borong/Bulanan
                            </h1>
                            <p className="mt-0.5 text-xs text-gray-500">{periodLabel ?? 'Data periode'}</p>
                        </div>

                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label
                                    htmlFor="payroll-period"
                                    className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-gray-500"
                                >
                                    Periode
                                </label>
                                <select
                                    id="payroll-period"
                                    value={periodId}
                                    onChange={(event) => handlePeriodChange(event.target.value)}
                                    disabled={periods.length === 0}
                                    className={`${SELECT_CLASS} disabled:opacity-50`}
                                >
                                    {periods.length === 0 ? <option value="">Belum ada data</option> : null}
                                    {periods.map((period) => (
                                        <option key={period.id} value={period.id}>
                                            {period.label} ({period.totalMetrics})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="button"
                                onClick={() => loadForPeriod(periodId)}
                                disabled={loading}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                {loading ? 'Memuat...' : 'Refresh'}
                            </button>
                        </div>
                    </div>
                </div>

                {error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}

                {isEmpty ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
                        <Wallet className="mx-auto h-8 w-8 text-gray-300" />
                        <p className="mt-3 text-sm font-medium text-gray-700">Belum ada data periode</p>
                        <p className="mt-1 text-xs text-gray-400">
                            Upload data dulu di halaman Dashboard Performa.
                        </p>
                    </div>
                ) : null}

                <PayrollExpensePanel
                    data={expenseSummary}
                    periodLabel={periodLabel}
                    onSelect={setSelectedPersonId}
                />
                <HarianPayrollPanel data={harianSummary} periodLabel={periodLabel} />
            </div>

            <MitraPayrollModal
                isOpen={selectedPersonId !== null}
                onClose={() => setSelectedPersonId(null)}
                row={rows.find((row) => row.personId === selectedPersonId) ?? null}
                periodLabel={periodLabel}
            />
        </div>
    );
}

export default function PayrollPage() {
    return (
        <ProtectedRoute>
            <PayrollContent />
        </ProtectedRoute>
    );
}
