'use client';

import { Layers, RefreshCw, Scale, X } from 'lucide-react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { fmtBpsId, fmtId } from '@/components/charts/chart-theme';
import type { PerformaRow, PerformaSummaryResponse } from '@/lib/api';

interface TotalBjdModalProps {
    isOpen: boolean;
    onClose: () => void;
    summary: PerformaSummaryResponse['summary'];
    periodLabel?: string;
    rows: PerformaRow[];
}

/** Detail Total BJD sekantor: pisahkan kapasitas produksi (yang menentukan Rendemen)
 * dari reprocess/barang-jadi (yang cuma ikut ke total, bukan Rendemen), plus siapa saja
 * yang mengerjakan reprocess periode ini. */
export default function TotalBjdModal({
    isOpen,
    onClose,
    summary,
    periodLabel,
    rows,
}: TotalBjdModalProps) {
    if (!summary) return null;

    const totalProduksi = summary.totalBjd;
    const totalReprocess = summary.totalReprocessBjd ?? 0;
    const totalGabungan = summary.totalBjdWithReprocess ?? totalProduksi;

    const contributors = rows
        .filter((row) => (row.reprocessBjd ?? 0) > 0)
        .map((row) => ({
            id: row.personId,
            name: row.name,
            colorHex: row.colorHex,
            reprocessBjd: row.reprocessBjd ?? 0,
            reprocessCount: row.reprocessCount ?? 0,
            totalBjd: row.totalBjd ?? 0,
        }))
        .sort((a, b) => b.reprocessBjd - a.reprocessBjd);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto p-0 border border-gray-200 shadow-2xl">
                <div className="relative bg-slate-900 px-6 py-5 text-white">
                    <DialogClose
                        onClick={onClose}
                        className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                    >
                        <X className="h-5 w-5" />
                        <span className="sr-only">Tutup</span>
                    </DialogClose>
                    <DialogTitle className="text-lg font-bold text-white">Total BJD</DialogTitle>
                    <p className="text-xs text-slate-300 mt-0.5">
                        Gabungan produksi + reprocess, seluruh mitra
                        {periodLabel ? ` · ${periodLabel}` : ''}
                    </p>
                </div>

                <div className="p-6 space-y-5 bg-slate-50/50">
                    <div className="relative overflow-hidden rounded-xl border border-green-200 bg-gradient-to-br from-[#047f2b] to-emerald-600 p-4 text-white shadow-sm">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-100">
                            Total BJD Gabungan
                        </p>
                        <p className="mt-0.5 text-3xl font-extrabold tracking-tight">
                            {fmtId(totalGabungan, 1)} g
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                <Scale className="h-3.5 w-3.5 text-blue-600" />
                                Kapasitas Produksi
                            </p>
                            <p className="mt-1 text-xl font-extrabold text-slate-900">
                                {fmtId(totalProduksi, 1)} g
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                                Baku Basah {fmtId(summary.totalBakuBasah, 1)} g
                            </p>
                            <p className="mt-1 text-xs font-semibold text-blue-700">
                                Rendemen {fmtBpsId(summary.weightedRendemenPctBps)}
                            </p>
                        </div>

                        <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-4">
                            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
                                <RefreshCw className="h-3.5 w-3.5" />
                                Reprocess / Barang Jadi
                            </p>
                            <p className="mt-1 text-xl font-extrabold text-slate-900">
                                {fmtId(totalReprocess, 1)} g
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                                {contributors.length} mitra terlibat
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400">
                                Tidak ikut Rendemen — tidak ada baku basah baru
                            </p>
                        </div>
                    </div>

                    {contributors.length > 0 ? (
                        <div>
                            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                                <Layers className="h-4 w-4 text-purple-600" />
                                Rincian per Mitra ({contributors.length})
                            </h3>
                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-3 py-2">Nama</th>
                                            <th className="px-3 py-2 text-right">BJD Produksi</th>
                                            <th className="px-3 py-2 text-right">BJD Reprocess</th>
                                            <th className="px-3 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {contributors.map((c) => (
                                            <tr key={c.id} className="hover:bg-slate-50">
                                                <td className="px-3 py-2 font-medium text-slate-800">
                                                    <span className="flex items-center gap-2">
                                                        <span
                                                            className="h-2 w-2 shrink-0 rounded-full"
                                                            style={{ backgroundColor: c.colorHex }}
                                                        />
                                                        {c.name}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-600">
                                                    {fmtId(c.totalBjd, 1)} g
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold text-purple-600">
                                                    {fmtId(c.reprocessBjd, 1)} g
                                                </td>
                                                <td className="px-3 py-2 text-right font-bold text-slate-900">
                                                    {fmtId(c.totalBjd + c.reprocessBjd, 1)} g
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 text-center py-2">
                            Tidak ada pekerjaan reprocess di periode ini.
                        </p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
