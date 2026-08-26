'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  RefreshCw, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  FileDown, 
  Printer, 
  UserCheck, 
  TrendingUp, 
  DollarSign, 
  Package, 
  AlertCircle,
  Clock
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/toast';
import { getWeeklyPayrollReport, type WeeklyReportResponse } from '@/lib/api';
import LazyEChart from '@/components/charts/LazyEChart';
import type { EChartsOption } from 'echarts';

// Helper to format currency
const fmtRp = (val: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val);
};

// Helper to format weight in gram
const fmtGram = (val: number) => {
  return `${Math.round(val).toLocaleString('id-ID')} g`;
};

// Helper to format BPS to percentage
const fmtBps = (bps: number) => {
  return `${(bps / 100).toFixed(2)}%`;
};

// Find the Thursday of the week containing the given date
function getThursday(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  // day: 0 = Sun, 1 = Mon, ..., 4 = Thu, 5 = Fri, 6 = Sat
  const diff = (day + 3) % 7; 
  date.setDate(date.getDate() - diff);
  return date;
}

// Convert date object to YYYY-MM-DD string
const toDateStr = (date: Date) => {
  return date.toISOString().slice(0, 10);
};

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <ReportsContent />
    </ProtectedRoute>
  );
}

function ReportsContent() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WeeklyReportResponse | null>(null);

  // Default to the current week (Kamis to Rabu)
  const [selectedThursday, setSelectedThursday] = useState<Date>(() => {
    return getThursday(new Date());
  });

  const getWeekRange = (thursday: Date) => {
    const start = new Date(thursday);
    const end = new Date(thursday);
    end.setDate(end.getDate() + 6); // Wed
    return { from: toDateStr(start), to: toDateStr(end) };
  };

  const [dateRange, setDateRange] = useState(() => getWeekRange(selectedThursday));
  const [customWorkDays, setCustomWorkDays] = useState<string[]>([]);
  const [isCustomDaysMode, setIsCustomDaysMode] = useState(false);

  // Sync dateRange and custom days when selectedThursday changes
  useEffect(() => {
    const range = getWeekRange(selectedThursday);
    setDateRange(range);
    
    // Reset custom work days to default (all days in range except Sundays)
    const defaultWorkDays: string[] = [];
    const cursor = new Date(range.from);
    const toDate = new Date(range.to);
    while (cursor <= toDate) {
      if (cursor.getDay() !== 0) { // Exclude Sunday
        defaultWorkDays.push(toDateStr(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    setCustomWorkDays(defaultWorkDays);
    setIsCustomDaysMode(false);
  }, [selectedThursday]);

  const load = useCallback(async (currentRange = dateRange, workDaysList = customWorkDays, useCustom = isCustomDaysMode) => {
    setLoading(true);
    try {
      const response = await getWeeklyPayrollReport({
        from: currentRange.from,
        to: currentRange.to,
        workDays: useCustom ? workDaysList : undefined,
      });
      setData(response);
      
      // If we got filters back, update workDays list to match what API resolved
      if (response?.filters?.workDays) {
        setCustomWorkDays(response.filters.workDays);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat laporan mingguan');
    } finally {
      setLoading(false);
    }
  }, [dateRange, customWorkDays, isCustomDaysMode, toast]);

  // Load when range changes
  useEffect(() => {
    load(dateRange, customWorkDays, isCustomDaysMode);
  }, [dateRange.from, dateRange.to, isCustomDaysMode]);

  // Move week backward
  const handlePrevWeek = () => {
    const prev = new Date(selectedThursday);
    prev.setDate(prev.getDate() - 7);
    setSelectedThursday(prev);
  };

  // Move week forward
  const handleNextWeek = () => {
    const next = new Date(selectedThursday);
    next.setDate(next.getDate() + 7);
    setSelectedThursday(next);
  };

  // Navigate to current week
  const handleCurrentWeek = () => {
    setSelectedThursday(getThursday(new Date()));
  };

  // Handle custom date fields changes
  const handleCustomDateChange = (field: 'from' | 'to', val: string) => {
    const newRange = { ...dateRange, [field]: val };
    setDateRange(newRange);
    setIsCustomDaysMode(false); // Reset to default work days when custom range is typed
  };

  // Toggle a specific day as a work day
  const handleToggleWorkDay = (dateStr: string) => {
    setIsCustomDaysMode(true);
    let newWorkDays = [...customWorkDays];
    if (newWorkDays.includes(dateStr)) {
      newWorkDays = newWorkDays.filter(d => d !== dateStr);
    } else {
      newWorkDays.push(dateStr);
    }
    setCustomWorkDays(newWorkDays);
    // Reload report with updated workDays
    load(dateRange, newWorkDays, true);
  };

  // Export report to CSV
  const handleExportCSV = () => {
    if (!data) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header Info
    csvContent += `LAPORAN PAYROLL MINGGUAN SECCA\n`;
    csvContent += `Periode,${data.filters.from} s/d ${data.filters.to}\n`;
    csvContent += `Jumlah Hari Kerja,${data.filters.workDayCount}\n\n`;
    
    // Summary
    csvContent += `RINGKASAN KINERJA MINGGUAN\n`;
    csvContent += `Total Setoran LP,${data.summary.totalReceipts}\n`;
    csvContent += `Total Dry In (Gram),${data.summary.totalDryInGram}\n`;
    csvContent += `Total Main Out (Gram),${data.summary.totalMainOutGram}\n`;
    csvContent += `Total By-Product (Gram),${data.summary.totalByProductGram}\n`;
    csvContent += `Total Gaji Mitra,${data.summary.totalPayrollRp}\n`;
    csvContent += `Rendemen Utama,${(data.summary.rendemenMainBps / 100).toFixed(2)}%\n`;
    csvContent += `Rendemen Bersih,${(data.summary.rendemenNetBps / 100).toFixed(2)}%\n`;
    csvContent += `Susut Proses,${(data.summary.susutProsesBps / 100).toFixed(2)}%\n\n`;
    
    // Workers Headers
    csvContent += `DAFTAR PAYROLL MITRA\n`;
    csvContent += `Mitra,Code,PIN,Setoran LP,Dry In (g),Main Out (g),By-Product (g),Rend. Utama,Rend. Bersih,Kehadiran (Hari),Target Hari,Gaji Bersih (Rp),Premi (Full Hadir)\n`;
    
    // Workers Rows
    data.workers.forEach(w => {
      csvContent += `"${w.workerName}","${w.workerCode || '-'}","${w.workerPin || '-'}","${w.receiptCount}","${w.dryInGram}","${w.mainOutGram}","${w.byProductGram}","${(w.rendemenMainBps / 100).toFixed(2)}%","${(w.rendemenNetBps / 100).toFixed(2)}%","${w.attendanceDays !== null ? w.attendanceDays : 'N/A'}","${w.workDayCount}","${w.payrollAmountRp}","${w.premiumEligible ? 'YA' : 'TIDAK'}"\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Weekly_Payroll_${data.filters.from}_${data.filters.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ECharts production trend options
  const chartOption = useMemo<EChartsOption>(() => {
    if (!data?.dailyBreakdown) return {};

    const dates = data.dailyBreakdown.map(d => {
      const parts = d.date.split('-');
      return `${parts[2]}/${parts[1]}`;
    });
    
    const mainOutData = data.dailyBreakdown.map(d => d.mainOutGram);
    const payrollData = data.dailyBreakdown.map(d => d.payrollRp);
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['Main Output (g)', 'Gaji (Rp)'],
        top: 0,
        right: 10
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
        top: 30
      },
      xAxis: [
        {
          type: 'category',
          data: dates,
          axisLabel: { color: '#6b7280' },
          axisLine: { lineStyle: { color: '#e5e7eb' } }
        }
      ],
      yAxis: [
        {
          type: 'value',
          name: 'Output',
          axisLabel: {
            formatter: '{value} g',
            color: '#6b7280'
          },
          splitLine: { lineStyle: { color: '#f1f5f9' } }
        },
        {
          type: 'value',
          name: 'Gaji',
          axisLabel: {
            formatter: (v: number) => `Rp ${v.toLocaleString('id-ID')}`,
            color: '#6b7280'
          },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: 'Main Output (g)',
          type: 'bar',
          data: mainOutData,
          itemStyle: { color: '#008300', borderRadius: [4, 4, 0, 0] },
          barWidth: '40%'
        },
        {
          name: 'Gaji (Rp)',
          type: 'line',
          yAxisIndex: 1,
          data: payrollData,
          smooth: true,
          itemStyle: { color: '#8b5cf6' },
          lineStyle: { width: 3 },
          symbolSize: 8
        }
      ]
    };
  }, [data]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto pb-16">
      
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
            <span className="bg-purple-100 text-purple-700 p-2 rounded-xl border border-purple-200">
              <TrendingUp className="h-6 w-6" />
            </span>
            Laporan Keuangan &amp; Payroll
          </h1>
          <p className="mt-1.5 text-sm text-gray-600">
            Laporan budgeting gaji, setoran, kehadiran finger, dan kelayakan premi mingguan.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => load()} disabled={loading} className="border-gray-200 shadow-sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!data || loading} className="border-gray-200 shadow-sm">
            <FileDown className="h-4 w-4 mr-2 text-indigo-600" />
            Ekspor CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!data || loading} className="border-gray-200 shadow-sm">
            <Printer className="h-4 w-4 mr-2 text-gray-600" />
            Cetak
          </Button>
        </div>
      </div>

      {/* Week Selector / Date Picker Bar */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={handlePrevWeek} className="h-9 w-9 border-gray-200 hover:bg-gray-50">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </Button>
            
            <div className="flex items-center px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 select-none">
              <CalendarIcon className="h-4 w-4 mr-2 text-purple-600" />
              Siklus: {dateRange.from} s/d {dateRange.to} (Kamis - Rabu)
            </div>

            <Button variant="outline" size="icon" onClick={handleNextWeek} className="h-9 w-9 border-gray-200 hover:bg-gray-50">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </Button>

            <Button variant="ghost" size="sm" onClick={handleCurrentWeek} className="text-xs font-semibold text-purple-700 hover:bg-purple-50">
              Minggu Ini
            </Button>
          </div>

          {/* Date Picker Form */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 font-medium">Dari:</span>
              <Input 
                type="date" 
                value={dateRange.from} 
                onChange={(e) => handleCustomDateChange('from', e.target.value)} 
                className="h-9 w-36 py-1 text-sm border-gray-200"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 font-medium">S/d:</span>
              <Input 
                type="date" 
                value={dateRange.to} 
                onChange={(e) => handleCustomDateChange('to', e.target.value)} 
                className="h-9 w-36 py-1 text-sm border-gray-200"
              />
            </div>
            <Button size="sm" onClick={() => load()} className="bg-purple-600 hover:bg-purple-700 text-white h-9 shadow-sm">
              Terapkan
            </Button>
          </div>
        </div>

        {/* WORK DAYS SHIFT TOGGLER */}
        {data && (
          <div className="pt-4 border-t border-gray-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Konfigurasi Hari Kerja
                </h3>
                <p className="text-xs text-gray-500">
                  Aktifkan/nonaktifkan tanggal di bawah untuk menyesuaikan hari kerja (misal: memindahkan libur Jumat ke Sabtu).
                </p>
              </div>
              <div className="text-xs font-semibold text-gray-600">
                Total: <span className="text-purple-700 text-sm font-bold">{data.filters.workDayCount}</span> Hari Kerja Aktif
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {data.dailyBreakdown.map((day) => {
                const isWork = customWorkDays.includes(day.date);
                const isSunday = new Date(day.date).getDay() === 0;
                
                return (
                  <button
                    key={day.date}
                    onClick={() => handleToggleWorkDay(day.date)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex flex-col items-center gap-0.5 min-w-[76px] cursor-pointer shadow-sm ${
                      isWork 
                        ? 'bg-purple-50 border-purple-300 text-purple-700 hover:bg-purple-100 hover:border-purple-400' 
                        : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                    }`}
                  >
                    <span>{new Date(day.date).toLocaleDateString('id-ID', { weekday: 'short' })}</span>
                    <span className="text-sm font-bold">{day.date.split('-')[2]}</span>
                    <span className="text-[9px] opacity-75">{isSunday ? 'Ahad (Off)' : 'Aktif'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {data && (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Setoran LP</p>
            <div className="mt-2 flex items-baseline justify-between">
              <h2 className="text-3xl font-extrabold text-gray-900">{data.summary.totalReceipts}</h2>
              <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center">
                <Package className="h-3 w-3 mr-1" /> LP
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Total LP yang disetor dalam rentang waktu terpilih
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Budget Gaji</p>
            <div className="mt-2 flex items-baseline justify-between">
              <h2 className="text-3xl font-extrabold text-purple-700">{fmtRp(data.summary.totalPayrollRp)}</h2>
              <span className="bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center">
                <DollarSign className="h-3 w-3 mr-0.5" /> IDR
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Total pengeluaran gaji bersih seluruh mitra kerja
            </p>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Rendemen Utama</p>
            <div className="mt-2 flex items-baseline justify-between">
              <h2 className="text-3xl font-extrabold text-emerald-700">{fmtBps(data.summary.rendemenMainBps)}</h2>
              <span className="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                Target: &ge;70%
              </span>
            </div>
            <p className="mt-1 text-xs text-emerald-600 font-medium">
              Output: {fmtGram(data.summary.totalMainOutGram)} / {fmtGram(data.summary.totalDryInGram)}
            </p>
          </div>
        </div>
      )}

      {/* Daily Chart Panel */}
      {data && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-700 mb-4">Tren Produksi &amp; Budget Harian</h3>
          <div className="h-80 w-full">
            <LazyEChart option={chartOption} height={320} />
          </div>
        </div>
      )}

      {/* Main Table Section - Budget & Payroll Per Worker */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between bg-gray-50/50">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Rincian Budget &amp; Gaji per Mitra</h2>
            <p className="text-xs text-gray-500 mt-0.5">Daftar setoran volume produksi, absensi finger, dan kelayakan premi.</p>
          </div>
          {data && (
            <div className="bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full font-semibold border border-purple-200">
              {data.workers.length} Mitra Terdaftar
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100/70 text-xs font-bold uppercase text-gray-500 tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Nama Mitra</th>
                <th className="px-3 py-3.5 text-center">Kode / PIN</th>
                <th className="px-3 py-3.5 text-right">Setoran LP</th>
                <th className="px-3 py-3.5 text-right">Dry In</th>
                <th className="px-3 py-3.5 text-right">Main Out</th>
                <th className="px-3 py-3.5 text-right">Rend. Utama</th>
                <th className="px-3 py-3.5 text-right">Rend. Net</th>
                <th className="px-4 py-3.5 text-center">Kehadiran (Absensi)</th>
                <th className="px-4 py-3.5 text-center">Premi Kehadiran</th>
                <th className="px-5 py-3.5 text-right">Gaji Bersih (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-5 py-16 text-center text-gray-400">
                    <RefreshCw className="h-7 w-7 animate-spin mx-auto text-purple-600 mb-2" />
                    Memuat rincian payroll dan absensi mitra...
                  </td>
                </tr>
              ) : !data || data.workers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-gray-500">
                    Tidak ada data payroll pada rentang tanggal terpilih.
                  </td>
                </tr>
              ) : (
                data.workers.map((w) => {
                  return (
                    <tr key={w.workerId} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-gray-900">{w.workerName}</td>
                      <td className="px-3 py-3.5 text-center tabular-nums text-gray-500 text-xs">
                        {w.workerCode || '-'} / <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-semibold">{w.workerPin || 'N/A'}</span>
                      </td>
                      <td className="px-3 py-3.5 text-right font-medium tabular-nums">{w.receiptCount} LP</td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-gray-600">{fmtGram(w.dryInGram)}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-gray-700">{fmtGram(w.mainOutGram)}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-indigo-700 font-bold">{fmtBps(w.rendemenMainBps)}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums text-emerald-700 font-semibold">{fmtBps(w.rendemenNetBps)}</td>
                      
                      <td className="px-4 py-3.5 text-center">
                        {w.attendanceDays !== null ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            w.isFullAttendance 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            <UserCheck className="h-3.5 w-3.5 mr-1" />
                            {w.attendanceDays} / {w.workDayCount} Hari
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs flex items-center justify-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                            Koneksi Finger Gagal
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        {w.attendanceDays !== null ? (
                          w.premiumEligible ? (
                            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold border border-emerald-200">
                              DAPAT PREMI
                            </span>
                          ) : (
                            <span className="bg-gray-100 text-gray-400 text-xs px-2.5 py-1 rounded-full font-medium">
                              TIDAK PREMI
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right font-extrabold text-purple-700 tabular-nums text-base">
                        {fmtRp(w.payrollAmountRp)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {data && data.workers.length > 0 && (
              <tfoot className="bg-gray-100/50 border-t border-gray-200 text-xs font-bold text-gray-700">
                <tr>
                  <td className="px-5 py-3.5">Total Ringkasan</td>
                  <td className="px-3 py-3.5"></td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{data.summary.totalReceipts} LP</td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{fmtGram(data.summary.totalDryInGram)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums">{fmtGram(data.summary.totalMainOutGram)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-indigo-700 font-extrabold">{fmtBps(data.summary.rendemenMainBps)}</td>
                  <td className="px-3 py-3.5 text-right tabular-nums text-emerald-700 font-extrabold">{fmtBps(data.summary.rendemenNetBps)}</td>
                  <td className="px-4 py-3.5"></td>
                  <td className="px-4 py-3.5"></td>
                  <td className="px-5 py-3.5 text-right font-extrabold text-purple-700 text-lg tabular-nums">
                    {fmtRp(data.summary.totalPayrollRp)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
}
