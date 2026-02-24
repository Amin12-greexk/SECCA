'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/toast';
import {
  getPecahBonHistoryPaginated,
  type PecahBonEntry,
  type PaginatedResult,
} from '@/lib/api';

const ROWS_PER_PAGE = 20;
const EXPORT_PAGE_LIMIT = 100;
const CSV_DELIMITER = ';';

function KoreksiHistoryContent() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'page' | 'filtered' | 'all' | null>(null);
  const [tableQuery, setTableQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pageData, setPageData] = useState<PaginatedResult<PecahBonEntry>>({
    items: [],
    page: 1,
    limit: ROWS_PER_PAGE,
    total: 0,
    totalPages: 1,
  });

  const formatNumber = (value: number, fractionDigits = 2) =>
    new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);

  const formatDate = (dateStr: string) =>
    new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));

  const gradeLabelFor = (entry: PecahBonEntry) => {
    const shape = entry.grade?.code ?? '-';
    const feather = entry.featherGrade?.code ?? '-';
    const color = entry.colorGrade?.code ?? '-';
    return `${shape}/${feather}/${color}`;
  };

  const loadPage = async (page: number, query = tableQuery, from = dateFrom, to = dateTo) => {
    setLoading(true);
    try {
      const response = await getPecahBonHistoryPaginated({
        page: page + 1,
        limit: ROWS_PER_PAGE,
        search: query || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setPageData(response);
      setSelectedIds([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat riwayat koreksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(0, '', '', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = async () => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      toast.error('Rentang tanggal tidak valid (dari > sampai).');
      return;
    }
    setCurrentPage(0);
    await loadPage(0);
  };

  const rows = useMemo(() => pageData.items, [pageData.items]);

  const allSelectedOnPage =
    rows.length > 0 && rows.every((entry) => selectedIds.includes(entry.id));

  const toggleRow = (entryId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(entryId);
      else set.delete(entryId);
      return Array.from(set);
    });
  };

  const toggleAllPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) {
        rows.forEach((entry) => set.add(entry.id));
      } else {
        rows.forEach((entry) => set.delete(entry.id));
      }
      return Array.from(set);
    });
  };

  const selectedRows = rows.filter((entry) => selectedIds.includes(entry.id));

  const escapeCsv = (value: string | number) => {
    const text = String(value ?? '');
    const escaped = text.replace(/"/g, '""');
    return new RegExp(`["\\n${CSV_DELIMITER}]`).test(escaped) ? `"${escaped}"` : escaped;
  };

  const buildExcelRows = (exportRows: PecahBonEntry[], startIndex = 0) => {
    const headers = [
      'No',
      'ID Pecah Bon',
      'Tanggal Pecah',
      'Batch',
      'Grade',
      'Kondisi',
      'Keping (pcs)',
      'Berat Basah (Gr)',
      'Kadar Air (%)',
      'Berat Kering (Gr)',
    ];
    const csvRows = exportRows.map((entry, index) =>
      [
        startIndex + index + 1,
        entry.pecahBonId ?? '-',
        formatDate(entry.pecahBonDate),
        entry.rawBatch?.batchNumber ?? '-',
        gradeLabelFor(entry),
        entry.featherCondition ?? '-',
        entry.pieceCount,
        formatNumber(entry.initialWeightGram, 2),
        formatNumber(entry.moisturePercent, 1),
        formatNumber(entry.dryWeightGram, 2),
      ]
        .map(escapeCsv)
        .join(CSV_DELIMITER)
    );
    return { headers, csvRows };
  };

  const downloadCsv = (rowsToExport: PecahBonEntry[], fileName: string, startIndex = 0) => {
    if (rowsToExport.length === 0) {
      toast.error('Tidak ada data untuk diunduh.');
      return;
    }
    const { headers, csvRows } = buildExcelRows(rowsToExport, startIndex);
    const csvContent = `\uFEFF${[headers.join(CSV_DELIMITER), ...csvRows].join('\r\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const fetchAllHistoryRows = async (params?: {
    from?: string;
    to?: string;
    search?: string;
  }) => {
    let page = 1;
    let totalPages = 1;
    const allRows: PecahBonEntry[] = [];

    while (page <= totalPages) {
      const response = await getPecahBonHistoryPaginated({
        page,
        limit: EXPORT_PAGE_LIMIT,
        from: params?.from || undefined,
        to: params?.to || undefined,
        search: params?.search || undefined,
      });
      allRows.push(...response.items);
      totalPages = response.totalPages;
      page += 1;
    }

    return allRows;
  };

  const downloadExcelPage = () => {
    const exportRows = selectedRows.length > 0 ? selectedRows : rows;
    if (exportRows.length === 0) {
      toast.error('Tidak ada data untuk diunduh.');
      return;
    }
    setExporting('page');
    downloadCsv(
      exportRows,
      `riwayat-koreksi-page-${currentPage + 1}-${new Date().toISOString().slice(0, 10)}.csv`,
      currentPage * ROWS_PER_PAGE
    );
    toast.success(`Berhasil mengunduh ${exportRows.length} baris (halaman ini).`);
    setExporting(null);
  };

  const downloadExcelFiltered = async () => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      toast.error('Rentang tanggal tidak valid (dari > sampai).');
      return;
    }
    setExporting('filtered');
    try {
      const allRows = await fetchAllHistoryRows({
        from: dateFrom || undefined,
        to: dateTo || undefined,
        search: tableQuery || undefined,
      });
      downloadCsv(
        allRows,
        `riwayat-koreksi-filter-${new Date().toISOString().slice(0, 10)}.csv`,
        0
      );
      toast.success(`Berhasil mengunduh ${allRows.length} baris (sesuai filter).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengunduh data filter.');
    } finally {
      setExporting(null);
    }
  };

  const downloadExcelAll = async () => {
    setExporting('all');
    try {
      const allRows = await fetchAllHistoryRows();
      downloadCsv(
        allRows,
        `riwayat-koreksi-semua-${new Date().toISOString().slice(0, 10)}.csv`,
        0
      );
      toast.success(`Berhasil mengunduh ${allRows.length} baris (semua data).`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mengunduh semua data.');
    } finally {
      setExporting(null);
    }
  };

  const copyTable = async () => {
    const copyRows = selectedRows.length > 0 ? selectedRows : rows;
    if (copyRows.length === 0) {
      toast.error('Tidak ada data untuk dicopy.');
      return;
    }

    const headers = [
      'No Halaman',
      'ID Pecah Bon',
      'Tanggal Pecah',
      'Batch',
      'Grade',
      'Kondisi',
      'Keping (pcs)',
      'Berat Basah (Gr)',
      'Kadar Air (%)',
      'Berat Kering (Gr)',
    ];
    const lines = copyRows.map((entry, index) =>
      [
        currentPage * ROWS_PER_PAGE + index + 1,
        entry.pecahBonId ?? '-',
        formatDate(entry.pecahBonDate),
        entry.rawBatch?.batchNumber ?? '-',
        gradeLabelFor(entry),
        entry.featherCondition ?? '-',
        entry.pieceCount,
        formatNumber(entry.initialWeightGram, 2),
        formatNumber(entry.moisturePercent, 1),
        formatNumber(entry.dryWeightGram, 2),
      ].join('\t')
    );
    const payload = [headers.join('\t'), ...lines].join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      toast.success(`Berhasil copy ${copyRows.length} baris.`);
      return;
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = payload;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success(`Berhasil copy ${copyRows.length} baris.`);
    }
  };

  const fromRow = pageData.total === 0 ? 0 : currentPage * ROWS_PER_PAGE + 1;
  const toRow = Math.min((currentPage + 1) * ROWS_PER_PAGE, pageData.total);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Riwayat Koreksi</h1>
          <p className="text-sm text-gray-600">
            Tabel selalu tampil dengan filter tanggal dan pagination server-side.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto]">
            <div className="space-y-1">
              <Label>Cari ID/grade/kondisi/batch</Label>
              <Input
                value={tableQuery}
                onChange={(event) => setTableQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void applyFilters();
                }}
                placeholder="Contoh: TEI-0229, MK/SGTG, SP, K0002"
              />
            </div>
            <div className="space-y-1">
              <Label>Dari Tanggal</Label>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Sampai Tanggal</Label>
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => void applyFilters()} disabled={loading}>
                {loading ? 'Memuat...' : 'Terapkan'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTableQuery('');
                  setDateFrom('');
                  setDateTo('');
                  setCurrentPage(0);
                  void loadPage(0, '', '', '');
                }}
                disabled={loading}
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Daftar LP</h2>
              <p className="text-xs text-gray-500">
                {fromRow}-{toRow} dari {pageData.total} LP - {selectedRows.length} terpilih
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={copyTable} disabled={loading || rows.length === 0}>
                Copy Table
              </Button>
              <Button type="button" onClick={downloadExcelPage} disabled={loading || rows.length === 0 || exporting !== null}>
                {exporting === 'page' ? 'Menyiapkan...' : 'Download Halaman'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void downloadExcelFiltered()}
                disabled={loading || exporting !== null}
              >
                {exporting === 'filtered' ? 'Menyiapkan...' : 'Download Filter'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void downloadExcelAll()}
                disabled={loading || exporting !== null}
              >
                {exporting === 'all' ? 'Menyiapkan...' : 'Download Semua'}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={allSelectedOnPage}
                      onChange={(event) => toggleAllPage(event.target.checked)}
                      disabled={rows.length === 0}
                    />
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">No</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">ID LP</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Tanggal</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Batch</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Grade</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">PCS</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Basah</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">K.Air</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Kering</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-500">
                      Memuat data...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-500">
                      Tidak ada data.
                    </td>
                  </tr>
                ) : (
                  rows.map((entry, index) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(entry.id)}
                          onChange={(event) => toggleRow(entry.id, event.target.checked)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500">
                        {currentPage * ROWS_PER_PAGE + index + 1}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-700">{entry.pecahBonId ?? '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{formatDate(entry.pecahBonDate)}</td>
                      <td className="px-3 py-2 text-gray-700">{entry.rawBatch?.batchNumber ?? '-'}</td>
                      <td className="px-3 py-2 text-gray-700">{gradeLabelFor(entry)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">{entry.pieceCount}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">
                        {formatNumber(entry.initialWeightGram, 2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-700">
                        {formatNumber(entry.moisturePercent, 1)}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-[#059833]">
                        {formatNumber(entry.dryWeightGram, 2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-600">
            <span>
              Halaman {currentPage + 1} dari {pageData.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = Math.max(0, currentPage - 1);
                  setCurrentPage(next);
                  void loadPage(next);
                }}
                disabled={loading || currentPage === 0}
              >
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = Math.min(pageData.totalPages - 1, currentPage + 1);
                  setCurrentPage(next);
                  void loadPage(next);
                }}
                disabled={loading || currentPage >= pageData.totalPages - 1}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KoreksiHistoryPage() {
  return (
    <ProtectedRoute allowedRoles={['koreksi', 'manager']}>
      <KoreksiHistoryContent />
    </ProtectedRoute>
  );
}
