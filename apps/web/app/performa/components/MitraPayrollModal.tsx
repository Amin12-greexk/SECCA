'use client';

import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    DollarSign,
    Scale,
    User,
    Wallet,
    X,
} from 'lucide-react';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { fmtBpsId, fmtId } from '@/components/charts/chart-theme';
import type { PerformaRow } from '@/lib/api';
import { classifyCapacity } from './capacityBand';
import { describeTenure } from './tenure';

const fmtRp = (value: number | null | undefined) =>
    value === null || value === undefined
        ? '–'
        : new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              maximumFractionDigits: 0,
          }).format(value);

export interface WarningInfo {
    hasWarning: boolean;
    isRedMonth: boolean;
    isUnder13TwoWeeks: boolean;
    reasons: string[];
}

interface MitraPayrollModalProps {
    isOpen: boolean;
    onClose: () => void;
    row: PerformaRow | null;
    periodLabel?: string;
    warningInfo?: WarningInfo;
    onViewTrend?: (personId: string) => void;
}

export default function MitraPayrollModal({
    isOpen,
    onClose,
    row,
    periodLabel,
    warningInfo,
    onViewTrend,
}: MitraPayrollModalProps) {
    if (!row) return null;

    const hk = row.hk ?? null;
    const bjd = row.totalBjd ?? null;
    const bakuBasah = row.totalBakuBasah ?? null;
    const bjdPerHk = hk && hk > 0 && bjd != null ? bjd / hk : null;
    const bakuPerHk = hk && hk > 0 && bakuBasah != null ? bakuBasah / hk : null;
    const band = classifyCapacity(bjdPerHk);
    const tenure = describeTenure(row.rawUserLevel, row.levelNumber);

    const hasPayrollData =
        row.netWageRp != null ||
        row.pieceworkWageRp != null ||
        row.subsidyRp != null ||
        row.premiumRp != null ||
        row.mealAllowanceRp != null ||
        row.deductionRp != null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 border border-gray-200 shadow-2xl">
                {/* Header Modal */}
                <div className="relative bg-slate-900 px-6 py-5 text-white">
                    <DialogClose
                        onClick={onClose}
                        className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                        <span className="sr-only">Tutup</span>
                    </DialogClose>

                    <div className="flex items-center gap-3 pr-8">
                        <span
                            className="h-10 w-10 shrink-0 rounded-full ring-4 ring-white/10 flex items-center justify-center font-bold text-slate-900"
                            style={{ backgroundColor: row.colorHex || '#2a78d6' }}
                        >
                            {row.name.charAt(0).toUpperCase()}
                        </span>
                        <div>
                            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                                {row.name}
                                {band ? (
                                    <span
                                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                                        style={{ backgroundColor: band.color }}
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                        {band.label}
                                    </span>
                                ) : null}
                            </DialogTitle>
                            <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                    <User className="h-3 w-3 text-slate-400" />
                                    {row.rawUserLevel ?? 'Mitra'}
                                    {tenure ? ` (${tenure.label})` : ''}
                                </span>
                                {periodLabel ? (
                                    <span className="flex items-center gap-1 border-l border-slate-700 pl-2">
                                        <Calendar className="h-3 w-3 text-slate-400" />
                                        {periodLabel}
                                    </span>
                                ) : null}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-6 bg-slate-50/50">
                    {/* Status Warning Alert (jika ada) */}
                    {warningInfo?.hasWarning ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs text-amber-900 shadow-xs flex items-start gap-2.5">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-amber-900">Perhatian Performa Mitra:</p>
                                <ul className="mt-1 list-disc list-inside space-y-0.5 text-amber-800">
                                    {warningInfo.reasons.map((reason, idx) => (
                                        <li key={idx}>{reason}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ) : null}

                    {/* Section 1: Detail Rincian Pembayaran / Payroll */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                                <Wallet className="h-4 w-4 text-emerald-600" />
                                Rincian Pembayaran &amp; Gaji Mitra
                            </h3>
                            {!hasPayrollData ? (
                                <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                    Data Payroll Belum Diunggah
                                </span>
                            ) : null}
                        </div>

                        {/* Banner Total Upah Bersih */}
                        <div className="mb-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-500 to-green-600 p-4 text-white shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-100">
                                    Total Upah Bersih (Take Home Pay)
                                </p>
                                <p className="text-2xl font-extrabold tracking-tight mt-0.5">
                                    {fmtRp(row.netWageRp)}
                                </p>
                            </div>
                            <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-xs">
                                <DollarSign className="h-6 w-6 text-white" />
                            </div>
                        </div>

                        {/* Breakdown Komponen Upah */}
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Upah Borong
                                </span>
                                <span className="text-sm font-bold text-slate-800 mt-1 block">
                                    {fmtRp(row.pieceworkWageRp)}
                                </span>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Subsidi Mingguan
                                </span>
                                <span className="text-sm font-bold text-emerald-700 mt-1 block">
                                    {fmtRp(row.subsidyRp)}
                                </span>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Premi / Bonus
                                </span>
                                <span className="text-sm font-bold text-amber-600 mt-1 block">
                                    {fmtRp(row.premiumRp)}
                                </span>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Uang Makan
                                </span>
                                <span className="text-sm font-bold text-indigo-700 mt-1 block">
                                    {fmtRp(row.mealAllowanceRp)}
                                </span>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Potongan
                                </span>
                                <span className="text-sm font-bold text-rose-600 mt-1 block">
                                    {fmtRp(row.deductionRp)}
                                </span>
                            </div>

                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 shadow-2xs">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800 block">
                                    Hari Kerja (HK)
                                </span>
                                <span className="text-sm font-bold text-emerald-900 mt-1 block">
                                    {hk == null ? '–' : `${fmtId(hk, 0)} hari`}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Ringkasan Hasil Kerja & Kapasitas Produksi */}
                    <div>
                        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                            <Scale className="h-4 w-4 text-blue-600" />
                            Hasil Produksi &amp; Efisiensi Harian
                        </h3>

                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Total BJD
                                </span>
                                <span className="text-sm font-bold text-slate-900 mt-1 block">
                                    {bjd == null ? '–' : `${fmtId(bjd, 1)} g`}
                                </span>
                                <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    {bjdPerHk == null ? '–' : `${fmtId(bjdPerHk, 1)} g / HK`}
                                </span>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Total Baku Basah
                                </span>
                                <span className="text-sm font-bold text-slate-900 mt-1 block">
                                    {bakuBasah == null ? '–' : `${fmtId(bakuBasah, 1)} g`}
                                </span>
                                <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    {bakuPerHk == null ? '–' : `${fmtId(bakuPerHk, 1)} g / HK`}
                                </span>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Rendemen (%)
                                </span>
                                <span className="text-sm font-bold text-blue-700 mt-1 block">
                                    {fmtBpsId(row.rendemenPctBps)}
                                </span>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Susut (SP / SH)
                                </span>
                                <span className="text-xs font-semibold text-slate-700 mt-1 block">
                                    SP: {fmtBpsId(row.susutProsesPctBps)}
                                </span>
                                <span className="text-xs font-semibold text-slate-700 mt-0.5 block">
                                    SH: {fmtBpsId(row.susutHilangPctBps)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Modal */}
                <div className="bg-slate-100 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
                    {onViewTrend ? (
                        <button
                            type="button"
                            onClick={() => {
                                onViewTrend(row.personId);
                                onClose();
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Lihat Grafik Tren Anak Ini
                        </button>
                    ) : (
                        <div />
                    )}

                    <DialogClose
                        onClick={onClose}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                    >
                        Tutup
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}
