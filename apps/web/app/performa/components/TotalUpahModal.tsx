'use client';

import { Package, Wallet, X } from 'lucide-react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import { fmtId } from '@/components/charts/chart-theme';
import type { PerformaExpenseSummary, PerformaSummaryResponse } from '@/lib/api';

const fmtRp = (value: number | null | undefined) =>
    value === null || value === undefined
        ? '–'
        : new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              maximumFractionDigits: 0,
          }).format(value);

interface TotalUpahModalProps {
    isOpen: boolean;
    onClose: () => void;
    expenseSummary: PerformaExpenseSummary | null;
    performaSummary: PerformaSummaryResponse['summary'];
    periodLabel?: string;
}

/**
 * Detail Total Upah: metrik utamanya "Upah per Kg" — akumulasi upah bersih
 * (borong + bulanan + tunjangan − potongan) dibagi total Barang Jadi (kg),
 * jadi kelihatan biaya tenaga kerja per kg output, bukan cuma angka Rupiah
 * mentah. Breakdown borong/bulanan/tunjangan disamakan dengan panel
 * Payroll & Biaya supaya angkanya konsisten di seluruh halaman.
 */
export default function TotalUpahModal({
    isOpen,
    onClose,
    expenseSummary,
    performaSummary,
    periodLabel,
}: TotalUpahModalProps) {
    if (!expenseSummary || !performaSummary) return null;

    const totalUpah = expenseSummary.totalNetWageRp;
    const totalBjdGram = performaSummary.totalBjdWithReprocess ?? performaSummary.totalBjd;
    const totalBjdKg = totalBjdGram / 1000;
    const upahPerKg = totalBjdKg > 0 ? totalUpah / totalBjdKg : null;
    const tunjanganBersih =
        expenseSummary.totalSubsidyRp +
        expenseSummary.totalPremiumRp +
        expenseSummary.totalMealAllowanceRp -
        expenseSummary.totalDeductionRp;

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
                    <DialogTitle className="text-lg font-bold text-white">Total Upah &amp; Biaya per Kg</DialogTitle>
                    <p className="text-xs text-slate-300 mt-0.5">
                        Akumulasi upah bersih seluruh mitra
                        {periodLabel ? ` · ${periodLabel}` : ''}
                    </p>
                </div>

                <div className="p-6 space-y-5 bg-slate-50/50">
                    {/* Highlighted Top Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="relative overflow-hidden rounded-xl border border-green-200 bg-gradient-to-br from-[#047f2b] to-emerald-600 p-4 text-white shadow-sm">
                            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-emerald-100">
                                <Wallet className="h-3.5 w-3.5 text-emerald-200" />
                                Total Upah (Akumulasi)
                            </p>
                            <p className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
                                {fmtRp(totalUpah)}
                            </p>
                            <p className="mt-1 text-[11px] text-emerald-100/80">
                                Borong + Bulanan + Tunjangan − Potongan
                            </p>
                        </div>

                        <div className="relative overflow-hidden rounded-xl border border-teal-300 bg-gradient-to-br from-teal-700 to-emerald-800 p-4 text-white shadow-sm">
                            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-teal-100">
                                <Package className="h-3.5 w-3.5 text-teal-200" />
                                Upah per Kg
                            </p>
                            <p className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight">
                                {upahPerKg == null ? '–' : fmtRp(upahPerKg)}
                                {upahPerKg != null ? (
                                    <span className="text-xs font-normal text-teal-200"> / kg</span>
                                ) : null}
                            </p>
                            <p className="mt-1 text-[11px] text-teal-100/80">
                                Total Upah ÷ {fmtId(totalBjdKg, 2)} kg Barang Jadi
                            </p>
                        </div>
                    </div>

                    {/* Breakdown 3 Cards — sama seperti panel Payroll & Biaya supaya konsisten */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Upah Borong
                            </p>
                            <p className="mt-1 text-lg font-extrabold text-slate-900">
                                {fmtRp(expenseSummary.totalBorongWageRp ?? expenseSummary.totalPieceworkWageRp)}
                            </p>
                            {expenseSummary.totalBorongCount ? (
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                    {expenseSummary.totalBorongCount} mitra
                                </p>
                            ) : null}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Gaji Bulanan
                            </p>
                            <p className="mt-1 text-lg font-extrabold text-slate-900">
                                {fmtRp(expenseSummary.totalBulananWageRp ?? 0)}
                            </p>
                            {expenseSummary.totalBulananCount ? (
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                    {expenseSummary.totalBulananCount} mitra
                                </p>
                            ) : null}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Tunjangan − Potongan
                            </p>
                            <p className="mt-1 text-lg font-extrabold text-slate-900">{fmtRp(tunjanganBersih)}</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5 text-slate-400" />
                            Total Barang Jadi
                        </span>
                        <span className="font-semibold text-slate-700">
                            {fmtId(totalBjdGram, 1)} g ({fmtId(totalBjdKg, 2)} kg)
                        </span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
