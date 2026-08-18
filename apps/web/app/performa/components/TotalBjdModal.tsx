'use client';

import { CalendarDays, RefreshCw, Scale, TrendingUp, X } from 'lucide-react';
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
    rows?: PerformaRow[];
}

/** Detail Total BJD sekantor: pisahkan kapasitas produksi (yang menentukan Rendemen)
 * dari reprocess/barang-jadi (yang cuma ikut ke total, bukan Rendemen), serta rata-rata kapasitas harian. */
export default function TotalBjdModal({
    isOpen,
    onClose,
    summary,
    periodLabel,
}: TotalBjdModalProps) {
    if (!summary) return null;

    const WORK_DAYS = 6;
    const totalProduksi = summary.totalBjd;
    const totalReprocess = summary.totalReprocessBjd ?? 0;
    const totalGabungan = summary.totalBjdWithReprocess ?? totalProduksi;
    const avgKapasitasHarian = totalGabungan / WORK_DAYS;
    const avgProduksiHarian = totalProduksi / WORK_DAYS;

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
                    <DialogTitle className="text-lg font-bold text-white">Total BJD & Kapasitas</DialogTitle>
                    <p className="text-xs text-slate-300 mt-0.5">
                        Gabungan produksi + reprocess, seluruh mitra
                        {periodLabel ? ` · ${periodLabel}` : ''}
                    </p>
                </div>

                <div className="p-6 space-y-5 bg-slate-50/50">
                    {/* Highlighted Top Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Card 1: Total BJD Gabungan */}
                        <div className="relative overflow-hidden rounded-xl border border-green-200 bg-gradient-to-br from-[#047f2b] to-emerald-600 p-4 text-white shadow-sm">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-100">
                                Total BJD Gabungan
                            </p>
                            <p className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
                                {fmtId(totalGabungan, 1)} g
                            </p>
                            <p className="mt-1 text-[11px] text-emerald-100/80">
                                Produksi + Reprocess
                            </p>
                        </div>

                        {/* Card 2: Rata-rata Kapasitas Harian (Dibagi 6 Hari Kerja) */}
                        <div className="relative overflow-hidden rounded-xl border border-teal-300 bg-gradient-to-br from-teal-700 to-emerald-800 p-4 text-white shadow-sm">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-teal-100 flex items-center gap-1.5">
                                    <TrendingUp className="h-3.5 w-3.5 text-teal-200" />
                                    Rata-rata Kapasitas
                                </p>
                                <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                                    <CalendarDays className="h-3 w-3" />
                                    6 Hari Kerja
                                </span>
                            </div>
                            <p className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
                                {fmtId(avgKapasitasHarian, 1)} g <span className="text-xs font-normal text-teal-200">/ hari</span>
                            </p>
                            <p className="mt-1 text-[11px] text-teal-100/80">
                                Total BJD ÷ 6 hari kerja
                            </p>
                        </div>
                    </div>

                    {/* Breakdown 2 Cards */}
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
                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                <span className="font-semibold text-blue-700">
                                    Rendemen {fmtBpsId(summary.weightedRendemenPctBps)}
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                    ~{fmtId(avgProduksiHarian, 1)} g/hr
                                </span>
                            </div>
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
                                Tidak ikut Rendemen
                            </p>
                            <div className="mt-2 pt-2 border-t border-purple-100 text-[10px] text-purple-600 font-medium">
                                Tambahan output non-basah
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
