'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/toast';
import {
  getPecahBonById,
  getPecahBonEntries,
  type PecahBonEntry,
} from '@/lib/api';

const ROWS_PER_PAGE = 20;

function KoreksiDataContent() {
  const toast = useToast();
  const [lpDigits, setLpDigits] = useState('');
  const [yearSuffix, setYearSuffix] = useState(String(new Date().getFullYear()).slice(-2));
  const [searchLoading, setSearchLoading] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PecahBonEntry | null>(null);
  const [batchEntries, setBatchEntries] = useState<PecahBonEntry[]>([]);
  const [tableQuery, setTableQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  const normalizeDigits = (value: string) => value.replace(/\D/g, '').slice(0, 4);
  const normalizeYear = (value: string) => value.replace(/\D/g, '').slice(0, 2);

  const parsePecahBonId = (value: string) => {
    const match = value.match(/^([A-Z]+)-(\d+)-(\d{2})$/);
    if (!match) return null;
    return { digits: match[2], year: match[3] };
  };

  const sortEntries = (entries: PecahBonEntry[]) =>
    [...entries].sort((left, right) => {
      const leftId = left.pecahBonId ?? '';
      const rightId = right.pecahBonId ?? '';
      if (leftId && rightId) return leftId.localeCompare(rightId);
      if (leftId) return -1;
      if (rightId) return 1;
      return new Date(left.pecahBonDate).getTime() - new Date(right.pecahBonDate).getTime();
    });

  const gradeLabelFor = (entry: PecahBonEntry) => {
    const shape = entry.grade?.code ?? '-';
    const feather = entry.featherGrade?.code ?? '-';
    const color = entry.colorGrade?.code ?? '-';
    return `${shape}/${feather}/${color}`;
  };

  const handleSearch = async () => {
    const digits = normalizeDigits(lpDigits);
    if (!digits) {
      toast.error('Masukkan nomor LP.');
      return;
    }
    setSearchLoading(true);
    try {
      const paddedDigits = digits.padStart(4, '0');
      const normalizedYear = normalizeYear(yearSuffix) || String(new Date().getFullYear()).slice(-2);
      const fullId = `TEI-${paddedDigits}-${normalizedYear}`;
      const entry = await getPecahBonById(fullId);

      if (entry.pecahBonId) {
        const parsed = parsePecahBonId(entry.pecahBonId);
        if (parsed) {
          setLpDigits(parsed.digits);
          setYearSuffix(parsed.year);
        }
      }

      setSelectedEntry(entry);
      setBatchEntries([]);
      setSelectedIds(entry.id ? [entry.id] : []);
      setTableQuery('');
      setCurrentPage(0);

      if (entry.rawBatchId) {
        setEntriesLoading(true);
        try {
          const entries = sortEntries(await getPecahBonEntries(entry.rawBatchId));
          const found = entries.find((item) => item.id === entry.id || item.pecahBonId === entry.pecahBonId);
          setBatchEntries(entries);
          setSelectedEntry(found ?? entry);
          if (found?.id) {
            setSelectedIds([found.id]);
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Gagal memuat daftar LP dalam batch.');
        } finally {
          setEntriesLoading(false);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'LP tidak ditemukan.');
    } finally {
      setSearchLoading(false);
    }
  };

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

  const gradeLabel = useMemo(() => {
    if (!selectedEntry) return '-';
    return gradeLabelFor(selectedEntry);
  }, [selectedEntry]);

  const displayLpId = useMemo(() => {
    const digits = normalizeDigits(lpDigits).padStart(4, '0');
    return `TEI-${digits}-${yearSuffix}`;
  }, [lpDigits, yearSuffix]);

  const filteredEntries = useMemo(() => {
    const query = tableQuery.trim().toLowerCase();
    if (!query) return batchEntries;
    return batchEntries.filter((entry) => {
      const searchable = [
        entry.pecahBonId ?? '',
        entry.rawBatch?.batchNumber ?? '',
        gradeLabelFor(entry),
        entry.featherCondition ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [batchEntries, tableQuery]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredEntries.length / ROWS_PER_PAGE)),
    [filteredEntries.length]
  );

  const paginatedEntries = useMemo(() => {
    const start = currentPage * ROWS_PER_PAGE;
    return filteredEntries.slice(start, start + ROWS_PER_PAGE);
  }, [filteredEntries, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages - 1) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [currentPage, totalPages]);

  const selectedCount = useMemo(
    () => filteredEntries.filter((entry) => selectedIds.includes(entry.id)).length,
    [filteredEntries, selectedIds]
  );

  const allFilteredSelected = filteredEntries.length > 0 && selectedCount === filteredEntries.length;

  const toggleEntry = (entryId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const current = new Set(prev);
      if (checked) current.add(entryId);
      else current.delete(entryId);
      return Array.from(current);
    });
  };

  const toggleAllFiltered = (checked: boolean) => {
    setSelectedIds((prev) => {
      const current = new Set(prev);
      if (checked) {
        filteredEntries.forEach((entry) => current.add(entry.id));
      } else {
        filteredEntries.forEach((entry) => current.delete(entry.id));
      }
      return Array.from(current);
    });
  };

  const escapeCsv = (value: string | number) => {
    const text = String(value ?? '');
    const escaped = text.replace(/"/g, '""');
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
  };

  const downloadExcel = () => {
    const rows = batchEntries.filter((entry) => selectedIds.includes(entry.id));
    if (rows.length === 0) {
      toast.error('Checklist LP yang ingin diunduh.');
      return;
    }

    const headers = [
      'ID Pecah Bon',
      'Tanggal Pecah',
      'Batch',
      'Grade',
      'Kondisi',
      'Keping',
      'Berat Basah (Gr)',
      'Kadar Air (%)',
      'Berat Kering (Gr)',
    ];

    const csvRows = rows.map((entry) =>
      [
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
        .join(',')
    );

    const csvContent = `\uFEFF${[headers.join(','), ...csvRows].join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const dateSuffix = new Date().toISOString().slice(0, 10);
    anchor.href = url;
    anchor.download = `koreksi-lp-${dateSuffix}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    toast.success(`Berhasil mengunduh ${rows.length} LP.`);
  };

  const copyTable = async () => {
    const selectedRows = filteredEntries.filter((entry) => selectedIds.includes(entry.id));
    const rows = selectedRows.length > 0 ? selectedRows : paginatedEntries;
    if (rows.length === 0) {
      toast.error('Tidak ada data LP untuk dicopy.');
      return;
    }

    const headers = [
      'ID Pecah Bon',
      'Tanggal Pecah',
      'Batch',
      'Grade',
      'Kondisi',
      'Keping',
      'Berat Basah (Gr)',
      'Kadar Air (%)',
      'Berat Kering (Gr)',
    ];

    const lines = rows.map((entry) =>
      [
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
      toast.success(`Berhasil copy ${rows.length} baris.`);
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
      toast.success(`Berhasil copy ${rows.length} baris.`);
    }
  };

  const fromRow = filteredEntries.length === 0 ? 0 : currentPage * ROWS_PER_PAGE + 1;
  const toRow = Math.min((currentPage + 1) * ROWS_PER_PAGE, filteredEntries.length);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Cek Detail LP</h1>
          <p className="text-sm text-gray-600">
            Cari LP, tampilkan banyak data dalam batch, lalu unduh Excel sesuai checklist.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nomor LP</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">TEI-</span>
                <Input
                  value={lpDigits}
                  onChange={(event) => setLpDigits(normalizeDigits(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleSearch();
                    }
                  }}
                  inputMode="numeric"
                  className="w-24 text-center font-semibold"
                />
                <span className="text-sm font-semibold text-gray-700">-</span>
                <Input
                  value={yearSuffix}
                  onChange={(event) => setYearSuffix(normalizeYear(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleSearch();
                    }
                  }}
                  inputMode="numeric"
                  className="w-16 text-center font-semibold"
                />
                <Button onClick={handleSearch} disabled={searchLoading}>
                  {searchLoading ? 'Mencari...' : 'Cari LP'}
                </Button>
              </div>
              <p className="text-xs text-gray-500">Format: {displayLpId}</p>
            </div>
          </div>

          <div className="mt-6">
            {selectedEntry ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-gray-500">Berat Kering (Gr)</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {formatNumber(selectedEntry.dryWeightGram, 2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">ID Pecah Bon</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {selectedEntry.pecahBonId ?? displayLpId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Tanggal</p>
                    <p className="text-sm font-medium text-gray-800">
                      {formatDate(selectedEntry.pecahBonDate)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">Batch</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedEntry.rawBatch?.batchNumber ?? '-'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">Grade</p>
                    <p className="text-sm font-semibold text-gray-900">{gradeLabel}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">Keping</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedEntry.pieceCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs text-gray-500">Kondisi Bulu</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {selectedEntry.featherCondition || '-'}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-green-700">Berat Kering (Gr)</p>
                      <p className="text-lg font-semibold text-green-900">
                        {formatNumber(selectedEntry.dryWeightGram, 2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-green-700">Berat Basah (Gr)</p>
                      <p className="text-lg font-semibold text-green-900">
                        {formatNumber(selectedEntry.initialWeightGram, 2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-green-700">Kadar Air (%)</p>
                      <p className="text-lg font-semibold text-green-900">
                        {formatNumber(selectedEntry.moisturePercent, 1)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center text-sm text-gray-500">
                Masukkan nomor LP untuk melihat detail.
              </div>
            )}
          </div>

          {selectedEntry && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Daftar LP dalam Batch</h2>
                  <p className="text-xs text-gray-500">
                    {entriesLoading
                      ? 'Memuat daftar LP...'
                      : `${fromRow}-${toRow} dari ${filteredEntries.length} LP - ${selectedCount} terpilih`}
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Input
                    value={tableQuery}
                    onChange={(event) => {
                      setTableQuery(event.target.value);
                      setCurrentPage(0);
                    }}
                    placeholder="Cari ID/grade/kondisi"
                    className="sm:w-60"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={copyTable}
                    disabled={entriesLoading || filteredEntries.length === 0}
                    className="whitespace-nowrap"
                  >
                    Copy Table
                  </Button>
                  <Button
                    onClick={downloadExcel}
                    disabled={entriesLoading || selectedIds.length === 0}
                    className="whitespace-nowrap"
                  >
                    Download Excel
                  </Button>
                </div>
              </div>

              {entriesLoading ? (
                <div className="py-6 text-center text-sm text-gray-500">Memuat LP...</div>
              ) : filteredEntries.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500">
                  Tidak ada LP sesuai pencarian.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={allFilteredSelected}
                              onChange={(event) => toggleAllFiltered(event.target.checked)}
                            />
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">ID LP</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Tanggal</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Grade</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Basah</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">K.Air</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600">Kering</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedEntries.map((entry) => {
                          const isSelected = selectedIds.includes(entry.id);
                          const isActive = selectedEntry?.id === entry.id;
                          return (
                            <tr
                              key={entry.id}
                              className={`${isActive ? 'bg-green-50' : 'hover:bg-gray-50'} cursor-pointer`}
                              onClick={() => setSelectedEntry(entry)}
                            >
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => toggleEntry(entry.id, event.target.checked)}
                                />
                              </td>
                              <td className="px-3 py-2 font-mono text-gray-700">{entry.pecahBonId ?? '-'}</td>
                              <td className="px-3 py-2 text-gray-600">{formatDate(entry.pecahBonDate)}</td>
                              <td className="px-3 py-2 text-gray-700">{gradeLabelFor(entry)}</td>
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-600">
                    <span>
                      Halaman {currentPage + 1} dari {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                        disabled={currentPage === 0}
                      >
                        Sebelumnya
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
                        disabled={currentPage >= totalPages - 1}
                      >
                        Berikutnya
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KoreksiDataPage() {
  return (
    <ProtectedRoute allowedRoles={['koreksi', 'manager']}>
      <KoreksiDataContent />
    </ProtectedRoute>
  );
}
