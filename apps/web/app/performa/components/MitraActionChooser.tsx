'use client';

import { LineChart, Wallet, X } from 'lucide-react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import type { PerformaRow } from '@/lib/api';
import { classifyCapacity, getMitraCapacityColor } from './capacityBand';

type Props = {
    /** Baris yang barusan diklik di grid; null berarti pemilih tertutup. */
    row: PerformaRow | null;
    periodLabel?: string;
    onClose: () => void;
    onViewChart: (row: PerformaRow) => void;
    onViewPayroll: (row: PerformaRow) => void;
};

/**
 * Ditanyakan lebih dulu saat satu anak diklik di grid kapasitas: mau lihat
 * grafik trennya, atau rincian pembayarannya.
 *
 * Sebelumnya klik di grid langsung membuka modal pembayaran, dan grafik cuma
 * bisa dicapai lewat tautan di kaki modal itu — jadi orang yang sebenarnya
 * cuma mau melihat tren harus melewati modal dulu. Karena pilihannya kini
 * ditanyakan di depan, tautan di kaki modal dihapus supaya tidak ada dua pintu
 * untuk hal yang sama.
 */
export default function MitraActionChooser({
    row,
    periodLabel,
    onClose,
    onViewChart,
    onViewPayroll,
}: Props) {
    if (!row) return null;

    const isBulanan = /bulanan/i.test(row.normalizedLevel ?? row.rawUserLevel ?? '');
    const hk = row.hk ?? null;
    const bjd = row.totalBjd ?? null;
    const perHk = hk && hk > 0 && bjd != null ? bjd / hk : null;
    const band = isBulanan ? null : classifyCapacity(perHk);
    const dotColor = getMitraCapacityColor(row);

    const actionClass =
        'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer';

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="sm:max-w-sm p-0 border border-gray-200 shadow-2xl"
                // Fokus TIDAK dikembalikan ke kartu pemicu: untuk aksi "lihat
                // grafik" halaman langsung digulir ke panel di bawah, dan
                // pengembalian fokus bawaan Radix akan menariknya balik ke atas.
                onCloseAutoFocus={(event) => event.preventDefault()}
            >
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span
                            className="mt-0.5 h-3 w-3 shrink-0 rounded-full ring-2 ring-white shadow-xs"
                            style={{ backgroundColor: dotColor }}
                        />
                        <div className="min-w-0">
                            <DialogTitle className="truncate text-sm font-bold text-gray-900">
                                {row.name}
                            </DialogTitle>
                            <DialogDescription className="mt-0.5 truncate text-[11px] text-gray-500">
                                {[
                                    periodLabel,
                                    isBulanan ? 'Anak Bulanan' : band?.label,
                                ]
                                    .filter(Boolean)
                                    .join(' · ') || 'Pilih tampilan'}
                            </DialogDescription>
                        </div>
                    </div>
                    <DialogClose
                        onClick={onClose}
                        className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                        aria-label="Tutup"
                    >
                        <X className="h-4 w-4" />
                    </DialogClose>
                </div>

                <div className="space-y-2 px-5 py-4">
                    <button
                        type="button"
                        onClick={() => onViewChart(row)}
                        className={`${actionClass} border-blue-200 bg-blue-50/50 hover:bg-blue-50`}
                    >
                        <LineChart className="h-5 w-5 shrink-0 text-blue-600" />
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-gray-900">
                                Grafik Tren
                            </span>
                            <span className="block text-[11px] text-gray-500">
                                Kapasitas, BJD &amp; rendemen, HK antar periode
                            </span>
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onViewPayroll(row)}
                        className={`${actionClass} border-green-200 bg-green-50/50 hover:bg-green-50`}
                    >
                        <Wallet className="h-5 w-5 shrink-0 text-green-600" />
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-gray-900">
                                Detail Pembayaran
                            </span>
                            <span className="block text-[11px] text-gray-500">
                                Upah, tunjangan, potongan, dan rincian LP
                            </span>
                        </span>
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
