'use client';

import {
    AlertTriangle,
    Calendar,
    CheckCircle2,
    DollarSign,
    Layers,
    RefreshCw,
    Scale,
    User,
    Wallet,
    X,
} from 'lucide-react';
import {
    Dialog,
    DialogClose,
    DialogContent,
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

    const isBulanan = /bulanan/i.test(row.normalizedLevel ?? row.rawUserLevel ?? '');
    const hk = row.hk ?? null;
    const bjd = row.totalBjd ?? null;
    const bakuBasah = row.totalBakuBasah ?? null;
    const bjdPerHk = hk && hk > 0 && bjd != null ? bjd / hk : null;
    const bakuPerHk = hk && hk > 0 && bakuBasah != null ? bakuBasah / hk : null;
    const band = isBulanan ? null : classifyCapacity(bjdPerHk);

    // Total BJD yang ditampilkan ke user = produksi + reprocess digabung (angka barang
    // jadi seutuhnya). Rendemen & band kapasitas tetap pakai `bjd` murni produksi di atas
    // (tidak boleh ikut reprocess karena reprocess tidak punya baku basah baru).
    const combinedBjd =
        bjd != null || row.reprocessBjd != null ? (bjd ?? 0) + (row.reprocessBjd ?? 0) : null;
    const combinedBjdPerHk = hk && hk > 0 && combinedBjd != null ? combinedBjd / hk : null;
    const tenure = describeTenure(row.rawUserLevel, row.levelNumber);

    const hasPayrollData =
        row.netWageRp != null ||
        row.pieceworkWageRp != null ||
        row.subsidyRp != null ||
        row.premiumRp != null ||
        row.mealAllowanceRp != null ||
        row.deductionRp != null;

    const prodLpRows = (row.lpRows ?? []).filter(
        (lp) => lp.transactionType !== 'REPROCESS' && lp.transactionType !== 'UNKNOWN'
    );
    const uniqueLpNumbers = Array.from(
        new Set(
            prodLpRows
                .map((lp) => lp.lpNumber)
                .filter((n): n is string => typeof n === 'string' && n.trim() !== '')
        )
    );
    const lpCount =
        row.lpCount ??
        (uniqueLpNumbers.length > 0
            ? uniqueLpNumbers.length
            : prodLpRows.length > 0
              ? prodLpRows.length
              : (bakuBasah || bjd ? 1 : 0));

    const reprocessRows = row.reprocessRows ?? [];
    const reprocessBjd = row.reprocessBjd ?? null;

    const isOver100Pct =
        row.rendemenPctBps != null &&
        row.susutProsesPctBps != null &&
        row.rendemenPctBps + row.susutProsesPctBps > 10_000;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 border border-gray-200 shadow-2xl">
                {/* Header Modal */}
                <div className="relative bg-slate-900 px-6 py-5 text-white">
                    <DialogClose
                        onClick={onClose}
                        className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                    >
                        <X className="h-5 w-5" />
                        <span className="sr-only">Tutup</span>
                    </DialogClose>

                    <div className="flex items-center gap-3 pr-8">
                        <span
                            className="h-10 w-10 shrink-0 rounded-full ring-4 ring-white/10 flex items-center justify-center font-bold text-slate-900"
                            style={{ backgroundColor: isBulanan ? '#8b5cf6' : (row.colorHex || '#2a78d6') }}
                        >
                            {row.name.charAt(0).toUpperCase()}
                        </span>
                        <div>
                            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                                {row.name}
                                {isBulanan ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/30 px-2 py-0.5 text-[10px] font-semibold text-purple-200 border border-purple-400/30">
                                        Bulanan (Rp 60.000/hari)
                                    </span>
                                ) : band ? (
                                    <span
                                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                                        style={{ backgroundColor: band.color }}
                                    >
                                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                                        {band.label}
                                    </span>
                                ) : null}
                            </DialogTitle>
                            <p className="text-xs text-slate-300 mt-0.5 flex flex-wrap items-center gap-2">
                                <span className="flex items-center gap-1">
                                    <User className="h-3 w-3 text-slate-400" />
                                    {row.pin ? `PIN: ${row.pin} · ` : ''}
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
                                Rincian Upah &amp; Pembayaran Mitra
                            </h3>
                            {!hasPayrollData ? (
                                <span className="text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                    Data Payroll Belum Diunggah
                                </span>
                            ) : null}
                        </div>

                        {/* Banner Total Upah Bersih */}
                        <div className="mb-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-600 to-green-700 p-4 text-white shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-100">
                                    Total Upah Bersih {isBulanan ? '(Gaji Bulanan)' : '(Take Home Pay)'}
                                </p>
                                <p className="text-2xl font-extrabold tracking-tight mt-0.5">
                                    {fmtRp(row.netWageRp)}
                                </p>
                                {isBulanan && hk ? (
                                    <p className="text-[11px] text-emerald-100 mt-1">
                                        Skema Bulanan: {fmtId(hk, 0)} HK × Rp 60.000 / hari
                                    </p>
                                ) : null}
                            </div>
                            <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-xs">
                                <DollarSign className="h-6 w-6 text-white" />
                            </div>
                        </div>

                        {/* Breakdown Komponen Upah */}
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    {isBulanan ? 'Tarif Harian' : 'Upah Borong'}
                                </span>
                                <span className="text-sm font-bold text-slate-800 mt-1 block">
                                    {isBulanan ? 'Rp 60.000 / hari' : fmtRp(row.pieceworkWageRp ?? row.upahBorongRp)}
                                </span>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Tarif Efektif / Gram
                                </span>
                                <span className="text-sm font-bold text-slate-800 mt-1 block">
                                    {isBulanan || row.effectivePieceworkRatePerGramRp == null
                                        ? '—'
                                        : `${fmtRp(row.effectivePieceworkRatePerGramRp)} / g`}
                                </span>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Tarif Efektif / Kg
                                </span>
                                <span className="text-sm font-bold text-slate-800 mt-1 block">
                                    {isBulanan || row.effectivePieceworkRatePerKgRp == null
                                        ? '—'
                                        : `${fmtRp(row.effectivePieceworkRatePerKgRp)} / kg`}
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
                    <div className="space-y-3">
                        <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                            <Scale className="h-4 w-4 text-blue-600" />
                            Hasil Produksi &amp; Efisiensi
                        </h3>

                        {isOver100Pct ? (
                            <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-semibold">Perhatian Data Efisiensi:</span> Total Rendemen ({fmtBpsId(row.rendemenPctBps)}) + SP ({fmtBpsId(row.susutProsesPctBps)}) = {fmtBpsId((row.rendemenPctBps ?? 0) + (row.susutProsesPctBps ?? 0))} (melebihi 100%). Susut Hilang (SH) tercatat {fmtBpsId(row.susutHilangPctBps)}.
                                </div>
                            </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                    Jumlah LP
                                </span>
                                <span className="text-sm font-bold text-slate-900 mt-1 block">
                                    {lpCount} LP
                                </span>
                                {uniqueLpNumbers.length > 0 ? (
                                    <span className="text-[10px] text-slate-500 mt-0.5 block truncate" title={uniqueLpNumbers.join(', ')}>
                                        {uniqueLpNumbers.slice(0, 3).join(', ')}{uniqueLpNumbers.length > 3 ? ` +${uniqueLpNumbers.length - 3}` : ''}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                                        Unit produksi
                                    </span>
                                )}
                            </div>

                            <div className="rounded-lg border border-green-200 bg-green-50/40 p-3">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-green-700">
                                    Total BJD
                                </span>
                                <span className="text-xl font-extrabold text-slate-900 mt-1 block">
                                    {combinedBjd == null ? '–' : `${fmtId(combinedBjd, 1)} g`}
                                </span>
                                <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    {combinedBjdPerHk == null ? '–' : `${fmtId(combinedBjdPerHk, 1)} g / HK`}
                                </span>
                                {reprocessBjd != null && reprocessBjd > 0 ? (
                                    <div className="mt-1.5 flex items-center gap-2.5 border-t border-green-200/60 pt-1.5 text-[10px]">
                                        <span className="text-slate-600">
                                            Produksi <b className="text-slate-800">{fmtId(bjd ?? 0, 1)} g</b>
                                        </span>
                                        <span className="text-purple-600">
                                            Reprocess <b>{fmtId(reprocessBjd, 1)} g</b>
                                        </span>
                                    </div>
                                ) : null}
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
                                <span className="text-[10px] text-slate-400 mt-0.5 block">
                                    SP: {fmtBpsId(row.susutProsesPctBps)} · SH: {fmtBpsId(row.susutHilangPctBps)}
                                </span>
                                {reprocessBjd != null && reprocessBjd > 0 ? (
                                    <span className="text-[9px] text-slate-400 mt-1 block">
                                        Dari BJD produksi saja (reprocess tidak ikut, tidak punya baku basah baru)
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Detail LP (Tabel LP) */}
                    {prodLpRows && prodLpRows.length > 0 ? (
                        <div>
                            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                                <Layers className="h-4 w-4 text-purple-600" />
                                Rincian Lot Produksi ({prodLpRows.length} LP)
                            </h3>
                            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-2xs">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                            <th className="px-3 py-2">NO. LP</th>
                                            <th className="px-3 py-2">Pekerja</th>
                                            <th className="px-3 py-2">Grade Baku</th>
                                            <th className="px-3 py-2 text-right">Baku Basah</th>
                                            <th className="px-3 py-2 text-right">BJD</th>
                                            <th className="px-3 py-2 text-right">Tarif BM/gr</th>
                                            <th className="px-3 py-2 text-right">Upah Mentah</th>
                                            <th className="px-3 py-2 text-right">Upah BJ</th>
                                            <th className="px-3 py-2 text-right">Upah Borong</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {prodLpRows.map((lp, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-3 py-2 font-mono font-bold text-slate-800">
                                                    {lp.lpNumber ?? `LP-${idx + 1}`}
                                                </td>
                                                <td className="px-3 py-2 text-slate-700">
                                                    {lp.workerNames && lp.workerNames.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {lp.workerNames.map((w, wIdx) => (
                                                                <span
                                                                    key={wIdx}
                                                                    className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                                                                >
                                                                    {w}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        row.name
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-slate-600">{lp.gradeBaku ?? '–'}</td>
                                                <td className="px-3 py-2 text-right font-medium text-slate-800">
                                                    {lp.totalBakuBasah != null ? `${fmtId(lp.totalBakuBasah, 1)} g` : '–'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium text-slate-800">
                                                    {lp.totalBjd != null ? `${fmtId(lp.totalBjd, 1)} g` : '–'}
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-600">
                                                    {lp.tarifBakuPerGramRp != null ? fmtRp(lp.tarifBakuPerGramRp) : '–'}
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-600">
                                                    {lp.upahMentahRp != null ? fmtRp(lp.upahMentahRp) : '–'}
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-600">
                                                    {lp.upahBarangJadiRp != null ? fmtRp(lp.upahBarangJadiRp) : '–'}
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                                                    {lp.upahBorongRp != null ? fmtRp(lp.upahBorongRp) : '–'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : null}

                    {/* Section 4: Detail Reprocess / Barang Jadi (anak bulanan, pola LP "764/5") */}
                    {reprocessRows.length > 0 ? (
                        <div>
                            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                                <RefreshCw className="h-4 w-4 text-purple-600" />
                                Rincian Reprocess / Barang Jadi ({reprocessRows.length})
                            </h3>
                            <p className="text-[11px] text-slate-500 mb-3">
                                Pengerjaan barang jadi tanpa baku basah baru (biasanya anak bulanan) — sudah
                                dijumlah ke Total BJD di atas, tapi sengaja tidak ikut Rendemen (tidak ada baku
                                basah baru untuk dibandingkan).
                            </p>
                            <div className="overflow-x-auto rounded-lg border border-purple-200 bg-purple-50/30 shadow-2xs">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-purple-100 bg-purple-50/80 text-left text-[10px] font-semibold uppercase tracking-wider text-purple-700">
                                            <th className="px-3 py-2">ID Reprocess</th>
                                            <th className="px-3 py-2 text-right">BJD</th>
                                            <th className="px-3 py-2 text-right">Rendemen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-purple-100">
                                        {reprocessRows.map((rp, idx) => (
                                            <tr key={idx} className="hover:bg-purple-50/60">
                                                <td className="px-3 py-2 font-mono font-bold text-slate-800">
                                                    {rp.reprocessId ?? `RP-${idx + 1}`}
                                                </td>
                                                <td className="px-3 py-2 text-right font-medium text-slate-800">
                                                    {rp.totalBjd != null ? `${fmtId(rp.totalBjd, 1)} g` : '–'}
                                                </td>
                                                <td className="px-3 py-2 text-right text-blue-700">
                                                    {fmtBpsId(rp.rendemenPctBps)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : null}
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
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Lihat Grafik Tren Anak Ini
                        </button>
                    ) : (
                        <div />
                    )}

                    <DialogClose
                        onClick={onClose}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                    >
                        Tutup
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}
