'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Loader2, Trash2, Upload } from 'lucide-react';
import {
    deleteMonthlyPayrollMonth,
    getMonthlyPayrollMonths,
    uploadMonthlyPayroll,
    type MonthlyPayrollMonth,
} from '@/lib/api';
import { useToast } from '@/lib/toast';

const fmtRp = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

/**
 * Upload "Data Penggajian bulanan" (sheet AGUSTUS, SEPTEMBER, ...): total gaji
 * sebulan per mitra & anak harian. Disimpan terpisah — hanya dipakai tab
 * Penggajian dan halaman Laporan; tidak mengubah kapasitas Performa maupun
 * yang dilihat mitra di /cek. Bulan yang sama di-upload lagi = ditimpa.
 */
export default function MonthlyPayrollCard({ onChanged }: { onChanged?: () => void }) {
    const toast = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [months, setMonths] = useState<MonthlyPayrollMonth[] | null>(null);
    const [uploading, setUploading] = useState(false);

    const load = () =>
        getMonthlyPayrollMonths()
            .then(setMonths)
            .catch(() => setMonths([]));

    useEffect(() => {
        load();
    }, []);

    const handleFile = async (file: File) => {
        setUploading(true);
        try {
            const result = await uploadMonthlyPayroll(file);
            const replaced = result.months.filter((m) => m.replaced).length;
            toast.success(
                `${result.months.length} bulan dimuat` + (replaced > 0 ? ` (${replaced} bulan ditimpa)` : ''),
            );
            await load();
            onChanged?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal mengunggah file.');
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const remove = async (month: MonthlyPayrollMonth) => {
        if (!confirm(`Hapus data penggajian ${month.label}?`)) return;
        try {
            await deleteMonthlyPayrollMonth(month.month);
            toast.success(`${month.label} dihapus`);
            await load();
            onChanged?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menghapus.');
        }
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-green-600" />
                    <div>
                        <h2 className="text-sm font-semibold text-gray-800">Data Penggajian Bulanan</h2>
                        <p className="text-xs text-gray-400">
                            File .xlsx dengan sheet per bulan (AGUSTUS, SEPTEMBER, ...). Hanya untuk tab Penggajian &amp;
                            Laporan — kapasitas dan halaman mitra tidak berubah.
                        </p>
                    </div>
                </div>
                <div>
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) handleFile(file);
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading}
                        className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
                    >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploading ? 'Mengunggah...' : 'Upload Penggajian'}
                    </button>
                </div>
            </div>

            {months && months.length > 0 ? (
                <ul className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-100 text-sm">
                    {[...months].reverse().map((month) => (
                        <li key={month.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                            <span className="min-w-[8rem] font-medium text-gray-800">{month.label}</span>
                            <span className="text-xs text-gray-500">
                                {month.mitraCount} mitra • {month.harianCount} anak harian
                            </span>
                            <span className="ml-auto text-xs font-semibold tabular-nums text-gray-700">
                                {fmtRp(month.netWageRp + month.harianRp)}
                            </span>
                            <button
                                type="button"
                                onClick={() => remove(month)}
                                aria-label={`Hapus ${month.label}`}
                                className="cursor-pointer rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </li>
                    ))}
                </ul>
            ) : months ? (
                <p className="mt-3 text-xs text-gray-400">Belum ada data penggajian bulanan.</p>
            ) : null}
        </div>
    );
}
