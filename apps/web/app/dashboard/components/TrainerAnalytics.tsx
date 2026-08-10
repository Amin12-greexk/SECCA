'use client';

import { useEffect, useMemo, useState } from 'react';
import LazyEChart from '@/components/charts/LazyEChart';
import type { EChartsOption } from 'echarts';
import { getTrainerSummary, type TrainerSummaryResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/lib/toast';

export default function TrainerAnalytics() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<TrainerSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getTrainerSummary(user?.id);
      setData(result);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat statistik trainer.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const formatNumber = (num: number) =>
    new Intl.NumberFormat('id-ID').format(Math.round(num));

  // ECharts Trend Line Chart Option (Naik-Turun Tren Mingguan)
  const lineChartOption = useMemo<EChartsOption>(() => {
    if (!data?.weeklyTrends) return {};

    const categories = data.weeklyTrends.map((t) => t.periodLabel);
    const orderData = data.weeklyTrends.map((t) => t.orderGram);
    const setoranData = data.weeklyTrends.map((t) => t.setoranGram);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          let res = `<div style="font-weight:700; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-bottom:4px;">${params[0].name}</div>`;
          params.forEach((item: any) => {
            res += `<div style="display:flex; justify-content:space-between; gap:16px; font-size:12px; margin-top:2px;">
              <span style="color:${item.color}; font-weight:600;">${item.seriesName}:</span>
              <span style="font-weight:700;">${new Intl.NumberFormat('id-ID').format(item.value)} gr</span>
            </div>`;
          });
          return res;
        },
      },
      legend: {
        data: ['Order Bon (Gram)', 'Hasil Setoran (Gram)'],
        top: 4,
        right: 10,
        textStyle: { color: '#475569', fontSize: 12, fontWeight: 500 },
      },
      grid: {
        left: '2%',
        right: '3%',
        bottom: '3%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: categories,
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLabel: {
          color: '#64748b',
          fontSize: 11,
          formatter: (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k gr` : `${v} gr`),
        },
      },
      series: [
        {
          name: 'Order Bon (Gram)',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: '#3b82f6' },
          itemStyle: { color: '#3b82f6' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.25)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.01)' },
              ],
            },
          },
          data: orderData,
        },
        {
          name: 'Hasil Setoran (Gram)',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: '#10b981' },
          itemStyle: { color: '#10b981' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.25)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.01)' },
              ],
            },
          },
          data: setoranData,
        },
      ],
    };
  }, [data?.weeklyTrends]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        <p className="mt-2 text-xs font-medium text-gray-500">Memuat chart grafik analitik mitra binaan...</p>
      </div>
    );
  }

  if (!data) return null;

  const { totals, workerStats, totalAssignedWorkers } = data;
  const yieldPct = totals.orderGram > 0 ? (totals.setoranGram / totals.orderGram) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900">
            Analitik & Grafik Tren Mitra Binaan
          </h2>
          <p className="text-xs text-gray-500">
            Grafik tren naik-turun Order Bon vs Hasil Setoran khusus mitra yang Anda bimbing ({totalAssignedWorkers} Mitra)
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="self-start rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
        >
          Refresh Analytics
        </button>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-700">Total Order Bon</span>
            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
              {totals.orderCount} LP
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-950">
            {formatNumber(totals.orderGram)} <span className="text-sm font-normal text-blue-700">gr</span>
          </p>
          <p className="mt-1 text-[11px] text-blue-600">Total berat baku di-order mitra</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700">Total Hasil Setoran</span>
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              {totals.setoranCount} Setoran
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-950">
            {formatNumber(totals.setoranGram)} <span className="text-sm font-normal text-emerald-700">gr</span>
          </p>
          <p className="mt-1 text-[11px] text-emerald-600">Total berat barang jadi yang disetorkan</p>
        </div>

        <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50/50 p-4 shadow-sm">
          <span className="text-xs font-medium text-purple-700">Rasio Output (Yield)</span>
          <p className="mt-2 text-2xl font-bold text-purple-950">
            {yieldPct.toFixed(1)}%
          </p>
          <p className="mt-1 text-[11px] text-purple-600">Perbandingan setoran vs order bon</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 shadow-sm">
          <span className="text-xs font-medium text-amber-700">Mitra Binaan Aktif</span>
          <p className="mt-2 text-2xl font-bold text-amber-950">
            {totalAssignedWorkers} <span className="text-sm font-normal text-amber-700">Orang</span>
          </p>
          <p className="mt-1 text-[11px] text-amber-600">Terhubung ke trainer Anda</p>
        </div>
      </div>

      {/* Main Trend Line Graph Chart (Grafik Naik-Turun Tren) */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">
              Grafik Tren Naik-Turun: Order Bon vs Hasil Setoran
            </h3>
            <p className="text-xs text-gray-500">
              Pantau fluktuasi grafik tren mingguan (Order Bon biru vs Setoran hijau)
            </p>
          </div>
        </div>

        <div className="w-full">
          <LazyEChart option={lineChartOption} height={340} />
        </div>
      </div>

      {/* Detail Table per Mitra Binaan */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-gray-900 text-sm">Detail Capaian Per Mitra Binaan</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-600 font-semibold">
              <tr>
                <th className="py-2.5 px-3">Nama Mitra</th>
                <th className="py-2.5 px-3 text-right">Order Bon (Gram)</th>
                <th className="py-2.5 px-3 text-center">Jumlah Order (LP)</th>
                <th className="py-2.5 px-3 text-right">Hasil Setoran (Gram)</th>
                <th className="py-2.5 px-3 text-center">Jumlah Setoran</th>
                <th className="py-2.5 px-3 text-right">Total Susut (Gram)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workerStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">
                    Tidak ada data mitra binaan.
                  </td>
                </tr>
              ) : (
                workerStats.map((w) => (
                  <tr key={w.workerId} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-gray-900">{w.workerName}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-blue-700">{formatNumber(w.orderGram)} gr</td>
                    <td className="py-2.5 px-3 text-center">{w.orderCount} LP</td>
                    <td className="py-2.5 px-3 text-right font-medium text-emerald-700">{formatNumber(w.setoranGram)} gr</td>
                    <td className="py-2.5 px-3 text-center">{w.setoranCount} Setoran</td>
                    <td className="py-2.5 px-3 text-right text-rose-600">{formatNumber(w.susutGram)} gr</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
