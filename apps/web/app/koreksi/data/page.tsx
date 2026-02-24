'use client';

import { useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/toast';
import { getPecahBonById, type PecahBonEntry } from '@/lib/api';

function KoreksiDataContent() {
  const toast = useToast();
  const [lpDigits, setLpDigits] = useState('');
  const [yearSuffix, setYearSuffix] = useState(String(new Date().getFullYear()).slice(-2));
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<PecahBonEntry | null>(null);

  const normalizeDigits = (value: string) => value.replace(/\D/g, '').slice(0, 4);
  const normalizeYear = (value: string) => value.replace(/\D/g, '').slice(0, 2);

  const parsePecahBonId = (value: string) => {
    const match = value.trim().toUpperCase().match(/^([A-Z]+)-(\d{1,6})-(\d{2})$/);
    if (!match) return null;
    return { digits: match[2], year: match[3] };
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
    const shape = selectedEntry.grade?.code ?? '-';
    const feather = selectedEntry.featherGrade?.code ?? '-';
    const color = selectedEntry.colorGrade?.code ?? '-';
    return `${shape}/${feather}/${color}`;
  }, [selectedEntry]);

  const displayLpId = useMemo(() => {
    const digits = normalizeDigits(lpDigits).padStart(4, '0');
    return `TEI-${digits}-${yearSuffix || String(new Date().getFullYear()).slice(-2)}`;
  }, [lpDigits, yearSuffix]);

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
      setSelectedEntry(entry);

      if (entry.pecahBonId) {
        const parsed = parsePecahBonId(entry.pecahBonId);
        if (parsed) {
          setLpDigits(parsed.digits);
          setYearSuffix(parsed.year);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'LP tidak ditemukan.');
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Data Koreksi</h1>
          <p className="text-sm text-gray-600">Cari 1 LP untuk melihat detail koreksi.</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <Label>Nomor LP</Label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">TEI-</span>
              <Input
                value={lpDigits}
                onChange={(event) => setLpDigits(normalizeDigits(event.target.value))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void handleSearch();
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
                    void handleSearch();
                  }
                }}
                inputMode="numeric"
                className="w-16 text-center font-semibold"
              />
              <Button onClick={() => void handleSearch()} disabled={searchLoading}>
                {searchLoading ? 'Mencari...' : 'Cari LP'}
              </Button>
            </div>
            <p className="text-xs text-gray-500">Format: {displayLpId}</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {selectedEntry ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-500">ID Pecah Bon</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedEntry.pecahBonId ?? displayLpId}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Tanggal</p>
                  <p className="text-sm font-medium text-gray-800">{formatDate(selectedEntry.pecahBonDate)}</p>
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
                  <p className="text-xs text-gray-500">Kondisi Bulu</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {selectedEntry.featherCondition || '-'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <p className="text-xs text-gray-500">Keping</p>
                  <p className="text-sm font-semibold text-gray-900">{selectedEntry.pieceCount} pcs</p>
                </div>
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
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
                  <div>
                    <p className="text-xs text-green-700">Berat Kering (Gr)</p>
                    <p className="text-lg font-semibold text-green-900">
                      {formatNumber(selectedEntry.dryWeightGram, 2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-gray-500">
              Masukkan nomor LP untuk melihat detail.
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

