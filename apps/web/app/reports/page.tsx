'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileDown, Printer, RefreshCw, TrendingUp } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import ProtectedRoute from '@/components/ProtectedRoute';
import LazyEChart from '@/components/charts/LazyEChart';
import {
  getPerformaExpenseSummary,
  getPerformaHarianSummary,
  getPerformaExpenseTrend,
  getPerformaPeriods,
  type PerformaExpenseSummaryResponse,
  type PerformaHarianSummaryResponse,
  type PerformaExpenseTrendPoint,
  type PerformaPeriod,
} from '@/lib/api';
import { useToast } from '@/lib/toast';
import StickyPeriodPicker from '../performa/components/StickyPeriodPicker';
import { formatPeriodLabel } from '../performa/components/periodLabel';
import { ExpenseTile } from '../performa/components/PayrollExpensePanel';

const fmtRp = (value: number | null | undefined) =>
  value === null || value === undefined
    ? '–'
    : new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(value);

const fmtNum = (value: number | null | undefined) =>
  value === null || value === undefined ? '–' : Math.round(value).toLocaleString('id-ID');

const fmtBps = (bps: number | null | undefined) =>
  bps === null || bps === undefined ? '–' : `${(bps / 100).toFixed(2)}%`;

/**
 * Laporan Keuangan & Payroll — seluruh angkanya dari data dashboard Performa
 * (file Pak Anton), bukan dari data pembayaran mitra (/cek) dan bukan dari
 * alur setoran harian. Satu periode = satu minggu gaji.
 */
function ReportsContent() {
  const toast = useToast();
  const [periods, setPeriods] = useState<PerformaPeriod[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [expense, setExpense] = useState<PerformaExpenseSummaryResponse | null>(null);
  const [harian, setHarian] = useState<PerformaHarianSummaryResponse | null>(null);
  const [trend, setTrend] = useState<PerformaExpenseTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadForPeriod = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const [expenseData, harianData] = await Promise.all([
          getPerformaExpenseSummary(id || undefined).catch(() => null),
          getPerformaHarianSummary(id || undefined).catch(() => null),
        ]);
        setExpense(expenseData);
        setHarian(harianData);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Gagal memuat laporan.');
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    (async () => {
      try {
        const [periodList, trendData] = await Promise.all([
          getPerformaPeriods(),
          getPerformaExpenseTrend().catch(() => [] as PerformaExpenseTrendPoint[]),
        ]);
        setPeriods(periodList);
        setTrend(trendData);
        const latest = periodList[periodList.length - 1]?.id ?? '';
        setPeriodId(latest);
        await loadForPeriod(latest);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Gagal memuat daftar periode.');
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePeriodChange = (next: string) => {
    setPeriodId(next);
    loadForPeriod(next);
  };

  const periodRef = expense?.period ?? harian?.period ?? null;
  const periodLabel = periodRef ? formatPeriodLabel(periodRef) : undefined;
  const summary = expense?.summary ?? null;
  const harianSummary = harian?.summary ?? null;

  const rows = useMemo(() => {
    const list = (expense?.rows ?? []).filter(
      (row) => (row.netWageRp ?? 0) !== 0 || (row.hk ?? 0) > 0 || (row.totalBjd ?? 0) > 0,
    );
    const term = search.trim().toLowerCase();
    const filtered = term ? list.filter((row) => row.name.toLowerCase().includes(term)) : list;
    return [...filtered].sort((a, b) => (b.netWageRp ?? 0) - (a.netWageRp ?? 0));
  }, [expense, search]);

  const totals = useMemo(() => {
    const list = expense?.rows ?? [];
    const hk = list.reduce((sum, r) => sum + (r.hk ?? 0), 0);
    const baku = list.reduce((sum, r) => sum + (r.totalBakuBasah ?? 0), 0);
    const bjd = list.reduce((sum, r) => sum + (r.totalBjd ?? 0), 0);
    return { hk, baku, bjd, rendemenBps: baku > 0 ? (bjd / baku) * 10000 : null };
  }, [expense]);

  const borongBulananNet = summary?.totalNetWageRp ?? 0;
  const harianNet = harianSummary?.totalUpahBersihRp ?? 0;
  const totalPengeluaran = borongBulananNet + harianNet;

  const chartOption = useMemo<EChartsOption>(() => {
    if (trend.length === 0) return {};
    return {
      tooltip: { trigger: 'axis', valueFormatter: (value) => fmtRp(Number(value)) },
      legend: { data: ['Borong + Bulanan', 'Anak Harian'], top: 0, right: 10 },
      grid: { left: '3%', right: '4%', bottom: '3%', top: 36, containLabel: true },
      xAxis: { type: 'category', data: trend.map((p) => p.label) },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: (v: number) => `${Math.round(v / 1_000_000)} jt` },
      },
      series: [
        {
          name: 'Borong + Bulanan',
          type: 'bar',
          stack: 'upah',
          data: trend.map((p) => p.netWageRp),
          itemStyle: { color: '#047f2b' },
        },
        {
          name: 'Anak Harian',
          type: 'bar',
          stack: 'upah',
          data: trend.map((p) => p.harianRp),
          itemStyle: { color: '#0ea5a4', borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  }, [trend]);

  const exportCsv = () => {
    if (!expense) return;
    const q = (value: string | number | null | undefined) =>
      `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push('LAPORAN KEUANGAN & PAYROLL SECCA');
    lines.push(`Periode,${q(periodLabel)}`);
    lines.push('');
    lines.push('RINGKASAN');
    lines.push(`Upah Borong,${summary?.totalBorongWageRp ?? summary?.totalPieceworkWageRp ?? 0}`);
    lines.push(`Gaji Bulanan,${summary?.totalBulananWageRp ?? 0}`);
    lines.push(`Subsidi,${summary?.totalSubsidyRp ?? 0}`);
    lines.push(`Premi,${summary?.totalPremiumRp ?? 0}`);
    lines.push(`Uang Makan,${summary?.totalMealAllowanceRp ?? 0}`);
    lines.push(`Potongan,${summary?.totalDeductionRp ?? 0}`);
    lines.push(`Akumulasi Upah Borong/Bulanan,${borongBulananNet}`);
    lines.push(`Upah Anak Harian,${harianNet}`);
    lines.push(`Total Pengeluaran Upah,${totalPengeluaran}`);
    lines.push('');
    lines.push('RINCIAN PER MITRA');
    lines.push('Nama,PIN,Level,HK,Baku Basah (g),BJD (g),Rendemen,Upah Pokok/Borong,Subsidi,Premi,Uang Makan,Potongan,Upah Bersih');
    rows.forEach((r) => {
      lines.push(
        [
          q(r.name),
          q(r.pin),
          q(r.normalizedLevel ?? r.rawUserLevel),
          r.hk ?? '',
          r.totalBakuBasah ?? '',
          r.totalBjd ?? '',
          q(fmtBps(r.rendemenPctBps)),
          r.pieceworkWageRp ?? '',
          r.subsidyRp ?? '',
          r.premiumRp ?? '',
          r.mealAllowanceRp ?? '',
          r.deductionRp ?? '',
          r.netWageRp ?? '',
        ].join(','),
      );
    });
    if (harian && harian.rows.length > 0) {
      lines.push('');
      lines.push('ANAK HARIAN');
      lines.push('Nama,Bagian,Hari Kerja,Upah Bersih');
      harian.rows.forEach((r) =>
        lines.push([q(r.name), q(r.bagian), r.hariKerja ?? '', r.totalUpahRp ?? ''].join(',')),
      );
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Laporan_Keuangan_Payroll_${(periodLabel ?? 'periode').replace(/[^\w-]+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isEmpty = !loading && periods.length === 0;
  const hasData = !!summary || !!harianSummary;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 pb-16 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-gray-900">
            <span className="rounded-xl border border-purple-200 bg-purple-100 p-2 text-purple-700">
              <TrendingUp className="h-5 w-5" />
            </span>
            Laporan Keuangan &amp; Payroll
          </h1>
          <p className="mt-1.5 text-sm text-gray-600">
            Pengeluaran upah mitra borong, bulanan, dan anak harian per periode — dari data dashboard Performa.
          </p>
          <p className="mt-0.5 text-xs text-gray-400">{periodLabel ?? 'Data periode'}</p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <StickyPeriodPicker
            periods={periods}
            value={periodId}
            onChange={handlePeriodChange}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => loadForPeriod(periodId)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!expense || loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4 text-indigo-600" /> Ekspor CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!hasData || loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <Printer className="h-4 w-4 text-gray-600" /> Cetak
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-gray-700">Belum ada data periode</p>
          <p className="mt-1 text-xs text-gray-400">Upload data dulu di halaman Dashboard Performa.</p>
        </div>
      ) : null}

      {!isEmpty && !loading && !hasData ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Periode ini belum punya rincian payroll (format lama). Pilih periode yang lebih baru.
        </div>
      ) : null}

      {hasData ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ExpenseTile
              label="Upah Borong"
              value={fmtRp(summary?.totalBorongWageRp ?? summary?.totalPieceworkWageRp ?? 0)}
              accent="#2a78d6"
              hint={summary?.totalBorongCount ? `${summary.totalBorongCount} mitra` : undefined}
            />
            <ExpenseTile
              label="Gaji Bulanan"
              value={fmtRp(summary?.totalBulananWageRp ?? 0)}
              accent="#8b5cf6"
              hint={summary?.totalBulananCount ? `${summary.totalBulananCount} mitra` : undefined}
            />
            <ExpenseTile
              label="Anak Harian"
              value={fmtRp(harianNet)}
              accent="#0ea5a4"
              hint={harianSummary ? `${harianSummary.totalPeople} orang` : undefined}
            />
            <ExpenseTile
              label="Total Pengeluaran Upah"
              value={fmtRp(totalPengeluaran)}
              accent="#047f2b"
              hint="Borong + bulanan + harian"
              hero
            />
          </div>

          {summary ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <ExpenseTile label="Subsidi" value={fmtRp(summary.totalSubsidyRp)} accent="#eda100" />
              <ExpenseTile label="Premi" value={fmtRp(summary.totalPremiumRp)} accent="#eda100" />
              <ExpenseTile label="Uang Makan" value={fmtRp(summary.totalMealAllowanceRp)} accent="#eda100" />
              <ExpenseTile
                label="Potongan"
                value={`-${fmtRp(Math.abs(summary.totalDeductionRp))}`}
                accent="#dc2626"
              />
            </div>
          ) : null}

          {summary ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <ExpenseTile label="Total HK" value={fmtNum(totals.hk)} accent="#64748b" />
              <ExpenseTile label="Baku Basah (g)" value={fmtNum(totals.baku)} accent="#64748b" />
              <ExpenseTile label="BJD (g)" value={fmtNum(totals.bjd)} accent="#64748b" />
              <ExpenseTile
                label="Rendemen"
                value={fmtBps(totals.rendemenBps)}
                accent="#64748b"
                hint={
                  totals.bjd > 0
                    ? `Upah per kg BJD ${fmtRp((summary.totalNetWageRp / totals.bjd) * 1000)}`
                    : undefined
                }
              />
            </div>
          ) : null}
        </>
      ) : null}

      {trend.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-gray-700">Pengeluaran Upah per Periode</h2>
          <LazyEChart option={chartOption} height={300} />
        </div>
      ) : null}

      {rows.length > 0 || search ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-bold text-gray-800">Rincian Upah per Mitra</h2>
              <p className="text-xs text-gray-500">{rows.length} mitra • diurutkan dari upah bersih terbesar</p>
            </div>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama..."
              className="w-48 rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-2">Nama</th>
                  <th className="px-4 py-2">Level</th>
                  <th className="px-4 py-2 text-right">HK</th>
                  <th className="px-4 py-2 text-right">BJD (g)</th>
                  <th className="px-4 py-2 text-right">Rendemen</th>
                  <th className="px-4 py-2 text-right">Upah Pokok/Borong</th>
                  <th className="px-4 py-2 text-right">Subsidi+Premi+Makan</th>
                  <th className="px-4 py-2 text-right">Potongan</th>
                  <th className="px-4 py-2 text-right">Upah Bersih</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.personId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{row.name}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{row.normalizedLevel ?? row.rawUserLevel ?? '–'}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtNum(row.hk)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtNum(row.totalBjd)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtBps(row.rendemenPctBps)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtRp(row.pieceworkWageRp)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {fmtRp((row.subsidyRp ?? 0) + (row.premiumRp ?? 0) + (row.mealAllowanceRp ?? 0))}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-red-600">
                      {row.deductionRp ? `-${fmtRp(Math.abs(row.deductionRp))}` : '–'}
                    </td>
                    <td className="px-4 py-2 text-right font-bold tabular-nums text-gray-900">{fmtRp(row.netWageRp)}</td>
                  </tr>
                ))}
              </tbody>
              {summary && !search ? (
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50 text-xs font-bold text-gray-700">
                    <td className="px-4 py-2.5" colSpan={8}>Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtRp(summary.totalNetWageRp)}</td>
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </div>
      ) : null}

      {harian && harian.byBagian.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-bold text-gray-800">Anak Harian per Bagian</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2">Bagian</th>
                <th className="px-4 py-2 text-right">Orang</th>
                <th className="px-4 py-2 text-right">Total Upah</th>
              </tr>
            </thead>
            <tbody>
              {harian.byBagian.map((item) => (
                <tr key={item.bagian} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2 font-medium text-gray-800">{item.bagian}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{item.count}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{fmtRp(item.totalUpahRp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="text-xs text-gray-400">
        Rincian lebih lengkap per mitra ada di{' '}
        <Link href="/performa/payroll" className="font-medium text-green-700 hover:underline">
          Payroll &amp; Biaya Borong/Bulanan
        </Link>
        .
      </p>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <ReportsContent />
    </ProtectedRoute>
  );
}
