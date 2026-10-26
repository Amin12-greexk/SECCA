'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Upload, Wallet } from 'lucide-react';
import {
    getMitraPaymentPeriods,
    resetMitraPaymentData,
    uploadMitraPaymentData,
    type MitraPaymentPeriod,
} from '@/lib/api';
import { useToast } from '@/lib/toast';
import { formatPeriodLabel } from './periodLabel';

/**
 * Upload data yang dilihat mitra di portal /cek (gaji, riwayat pembayaran,
 * barang jadi). Format Excel-nya sama persis dengan Upload Data performa,
 * tapi file & datanya terpisah: upload di sini tidak mengubah dashboard, dan
 * upload performa tidak mengubah yang dilihat mitra. Sheet periode yang sama
 * di-upload ulang = menggantikan periode itu.
 */
export default function MitraPaymentCard({ onChanged }: { onChanged?: () => void }) {
    const toast = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [periods, setPeriods] = useState<MitraPaymentPeriod[] | null>(null);
    const [uploading, setUploading] = useState(false);
    const [resetting, setResetting] = useState(false);

    const load = () =>
        getMitraPaymentPeriods()
            .then(setPeriods)
            .catch(() => {});

    useEffect(() => {
        load();
    }, []);

    const handleFile = async (file: File) => {
        setUploading(true);
        try {
            const result = await uploadMitraPaymentData(file);
            const replaced = result.periods.filter((period) => period.replaced).length;
            toast.success(
                `${result.totalSheets} periode • ${result.totalRows} baris dimuat ke data pembayaran` +
                    (replaced > 0 ? ` (${replaced} periode diperbarui)` : ''),
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

    const handleReset = async () => {
        if (
            !confirm(
                'Hapus SEMUA data pembayaran mitra? Mitra tidak akan melihat gaji apa pun di halaman cek sampai di-upload lagi. Dashboard performa tidak terpengaruh.',
            )
        ) {
            return;
        }
        setResetting(true);
        try {
            const res = await resetMitraPaymentData();
            toast.success(res.message);
            await load();
            onChanged?.();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal mereset data.');
        } finally {
            setResetting(false);
        }
    };

    const newestFirst = [...(periods ?? [])].reverse();
    const latest = newestFirst[0];

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-green-600" />
                    <div>
                        <h2 className="text-sm font-semibold text-gray-800">Data Pembayaran Mitra</h2>
                        <p className="text-xs text-gray-400">
                            {latest
                                ? `${newestFirst.length} periode • terbaru ${formatPeriodLabel(latest)}`
                                : 'Yang dilihat mitra di halaman cek • format Excel sama dengan Upload Data'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {latest ? (
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={uploading || resetting}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-100 disabled:opacity-50"
                        >
                            {resetting ? 'Mereset...' : 'Reset'}
                        </button>
                    ) : null}
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
                        disabled={uploading || resetting}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
                    >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploading ? 'Mengunggah...' : 'Upload Pembayaran'}
                    </button>
                </div>
            </div>

            {newestFirst.length > 0 ? (
                <details className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    <summary className="cursor-pointer font-medium">Periode yang sudah di-upload</summary>
                    <ul className="mt-2 max-h-60 divide-y divide-gray-100 overflow-y-auto">
                        {newestFirst.map((period) => (
                            <li key={period.id} className="flex items-center justify-between gap-2 py-1.5">
                                <span className="min-w-0 truncate">{formatPeriodLabel(period)}</span>
                                <span className="shrink-0 text-gray-400">
                                    {period.totalMetrics} mitra
                                    {period.totalHarian > 0 ? ` • ${period.totalHarian} harian` : ''}
                                </span>
                            </li>
                        ))}
                    </ul>
                </details>
            ) : null}
        </div>
    );
}
