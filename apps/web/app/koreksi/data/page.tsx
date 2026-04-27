'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageTransition from '@/components/animations/PageTransition';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useToast } from '@/lib/toast';
import {
  completeDryQcWorkItem,
  getBarangJadiList,
  getFinishWorkItemByLp,
  getPecahBonHistoryPaginated,
  getPecahBonById,
  submitFinishSetoran,
  type BarangJadi,
  type FinishSubmitResponse,
  type FinishWorkItemLookup,
  type PecahBonEntry,
} from '@/lib/api';
import { BARANG_JADI_UPDATED_EVENT } from '@/lib/barang-jadi';

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ helpers (module-level, stable refs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

const normalizeDigits = (value: string) => value.replace(/\D/g, '').slice(0, 4);
const normalizeYear = (value: string) => value.replace(/\D/g, '').slice(0, 2);

const parsePecahBonId = (value: string) => {
  const match = value.trim().toUpperCase().match(/^([A-Z]+)-(\d{1,6})-(\d{2})$/);
  if (!match) return null;
  return { digits: match[2], year: match[3] };
};

const fmtNum = (value: number, fd = 2) =>
  new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: fd,
    maximumFractionDigits: fd,
  }).format(value);

const fmtDate = (dateStr: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));

const parseGram = (value: string) => {
  if (!value.trim()) return 0;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function KoreksiDataContent() {
  const toast = useToast();
  const toastRef = useRef(toast);

  /* â”€â”€ LP search state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const [lpDigits, setLpDigits] = useState('');
  const [yearSuffix, setYearSuffix] = useState(String(new Date().getFullYear()).slice(-2));
  const [searchLoading, setSearchLoading] = useState(false);

  /* â”€â”€ selected entry + work item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const [selectedEntry, setSelectedEntry] = useState<PecahBonEntry | null>(null);
  const [workItemLookupLoading, setWorkItemLookupLoading] = useState(false);
  const [workItemLookupError, setWorkItemLookupError] = useState<string | null>(null);
  const [workItem, setWorkItem] = useState<FinishWorkItemLookup | null>(null);

  /* â”€â”€ submit state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const [setoranSubmitting, setSetoranSubmitting] = useState(false);
  const [dryQcSubmitting, setDryQcSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<FinishSubmitResponse | null>(null);

  /* â”€â”€ history table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const [historyRows, setHistoryRows] = useState<PecahBonEntry[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit, setHistoryLimit] = useState<10 | 20>(10);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  /* â”€â”€ modal + form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const [setoranForm, setSetoranForm] = useState({
    resultGradeValues: {} as Record<string, string>,
    byProductValues: {} as Record<string, string>,
    notes: '',
  });
  const [barangJadiOptions, setBarangJadiOptions] = useState<BarangJadi[]>([]);
  const [selectedBarangJadiId, setSelectedBarangJadiId] = useState('');
  const [barangJadiLoading, setBarangJadiLoading] = useState(false);
  const [susutUnit, setSusutUnit] = useState<'gram' | 'percent'>('gram');

  const workItemCacheRef = useRef<Record<string, FinishWorkItemLookup>>({});

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    const syncBarangJadiOptions = async () => {
      setBarangJadiLoading(true);
      try {
        const nextOptions = await getBarangJadiList();
        setBarangJadiOptions(nextOptions);
        setSelectedBarangJadiId((current) =>
          nextOptions.some((item) => item.id === current) ? current : '',
        );
      } catch (error) {
        toastRef.current.error(error instanceof Error ? error.message : 'Gagal memuat master barang jadi.');
      } finally {
        setBarangJadiLoading(false);
      }
    };

    void syncBarangJadiOptions();
    const handleUpdated = () => {
      void syncBarangJadiOptions();
    };
    window.addEventListener(BARANG_JADI_UPDATED_EVENT, handleUpdated);

    return () => {
      window.removeEventListener(BARANG_JADI_UPDATED_EVENT, handleUpdated);
    };
  }, []);

  /* â”€â”€ derived / memoised calculations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const displayLpId = useMemo(() => {
    const digits = normalizeDigits(lpDigits).padStart(4, '0');
    return `TEI-${digits}-${yearSuffix || String(new Date().getFullYear()).slice(-2)}`;
  }, [lpDigits, yearSuffix]);

  const gradeLabel = useMemo(() => {
    if (!selectedEntry) return '-';
    const shape = selectedEntry.grade?.code ?? '-';
    const feather = selectedEntry.featherGrade?.code ?? '-';
    const color = selectedEntry.colorGrade?.code ?? '-';
    return `${shape}/${feather}/${color}`;
  }, [selectedEntry]);

  const setoranDryInGram = workItem?.dryInGram ?? selectedEntry?.dryWeightGram ?? 0;

  const selectedBarangJadi = useMemo(
    () => barangJadiOptions.find((item) => item.id === selectedBarangJadiId) ?? null,
    [barangJadiOptions, selectedBarangJadiId],
  );

  const visibleResultGrades = useMemo(
    () => selectedBarangJadi?.resultGrades ?? [],
    [selectedBarangJadi],
  );

  const totalBarangJadi = useMemo(
    () =>
      visibleResultGrades.reduce(
        (sum, field) => sum + parseGram(setoranForm.resultGradeValues[field.id] ?? ''),
        0,
      ),
    [setoranForm.resultGradeValues, visibleResultGrades],
  );

  const visibleByProducts = useMemo(
    () => selectedBarangJadi?.byProducts ?? [],
    [selectedBarangJadi],
  );

  const totalByProduct = useMemo(
    () =>
      visibleByProducts.reduce(
        (sum, field) => sum + parseGram(setoranForm.byProductValues[field.id] ?? ''),
        0,
      ),
    [setoranForm.byProductValues, visibleByProducts],
  );

  const susutProsesGram = useMemo(() => totalByProduct, [totalByProduct]);
  const susutProsesPct = useMemo(
    () => (setoranDryInGram > 0 ? (susutProsesGram / setoranDryInGram) * 100 : 0),
    [setoranDryInGram, susutProsesGram],
  );

  const susutHilangGram = useMemo(
    () => Math.max(setoranDryInGram - totalBarangJadi - totalByProduct, 0),
    [setoranDryInGram, totalBarangJadi, totalByProduct],
  );

  const rendemenPct = useMemo(
    () => (setoranDryInGram > 0 ? (totalBarangJadi / setoranDryInGram) * 100 : 0),
    [setoranDryInGram, totalBarangJadi],
  );

  const susutHilangPct = useMemo(
    () => (setoranDryInGram > 0 ? (susutHilangGram / setoranDryInGram) * 100 : 0),
    [setoranDryInGram, susutHilangGram],
  );

  const inputMelebihiDryIn = totalBarangJadi + totalByProduct > setoranDryInGram;

  const canSubmitSetoran =
    !!workItem?.canSubmit &&
    !!selectedBarangJadiId &&
    visibleResultGrades.length > 0 &&
    totalBarangJadi > 0 &&
    !inputMelebihiDryIn &&
    !setoranSubmitting &&
    !dryQcSubmitting;

  const submitDisabledReason = useMemo(() => {
    if (setoranSubmitting) return 'Sedang menyimpan...';
    if (dryQcSubmitting) return 'Sedang menyelesaikan koreksi kering...';
    if (!workItem?.canSubmit) {
      if (!workItem) return 'LP belum siap disetor';
      if (workItem.flowState === 'NEXT_DAY') return 'LP masih di antrian besok';
      if (workItem.flowState === 'IN_PROGRESS') return 'LP masih proses cabut bulu';
      if (workItem.flowState === 'DRYING') return 'LP masih proses pengeringan';
      if (workItem.flowState === 'DRYING_QC') return 'Selesaikan koreksi kering terlebih dahulu';
      if (workItem.flowState === 'SUBMITTED') return 'LP sudah disetor';
      if (workItem.flowState === 'CANCELED') return 'LP dibatalkan';
      return 'LP belum siap disetor';
    }
    if (!selectedBarangJadiId) return 'Pilih barang jadi';
    if (visibleResultGrades.length === 0) return 'Barang jadi belum punya grade hasil';
    if (totalBarangJadi <= 0) return 'Total Barang Jadi wajib diisi';
    if (inputMelebihiDryIn) return 'Input melebihi berat kering awal!';
    return '';
  }, [dryQcSubmitting, inputMelebihiDryIn, selectedBarangJadiId, setoranSubmitting, totalBarangJadi, visibleResultGrades.length, workItem]);

  /* â”€â”€ callbacks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const loadWorkItemByEntry = useCallback(
    async (entry: PecahBonEntry) => {
      if (!entry.pecahBonId) {
        setWorkItem(null);
        setWorkItemLookupError('Nomor LP belum tersedia pada entri ini.');
        return;
      }

      const cached = workItemCacheRef.current[entry.pecahBonId];
      if (cached) {
        setWorkItem(cached);
        setWorkItemLookupError(null);
        return;
      }

      setWorkItemLookupLoading(true);
      setWorkItemLookupError(null);
      try {
        const lookup = await getFinishWorkItemByLp(entry.pecahBonId);
        workItemCacheRef.current[entry.pecahBonId] = lookup;
        setWorkItem(lookup);
      } catch (error) {
        setWorkItem(null);
        setWorkItemLookupError(
          error instanceof Error ? error.message : 'Gagal mengambil data work item.',
        );
      } finally {
        setWorkItemLookupLoading(false);
      }
    },
    [],
  );

  const prefetchWorkItemByEntry = useCallback(async (entry: PecahBonEntry | null) => {
    if (!entry?.pecahBonId) return;
    if (workItemCacheRef.current[entry.pecahBonId]) return;
    try {
      const lookup = await getFinishWorkItemByLp(entry.pecahBonId);
      workItemCacheRef.current[entry.pecahBonId] = lookup;
    } catch {
      // Ignore prefetch failures; actual open flow will handle visible errors.
    }
  }, []);

  const loadHistory = async (page: number, limit: 10 | 20) => {
    setHistoryLoading(true);
    try {
      const result = await getPecahBonHistoryPaginated({ page, limit, order: 'desc' });
      const sortedRows = [...(result.items ?? [])].sort((a, b) =>
        (b.pecahBonId ?? '').localeCompare(a.pecahBonId ?? '', 'id-ID', { numeric: true }),
      );
      setHistoryRows(sortedRows);
      setHistoryTotal(result.total ?? 0);
      setHistoryTotalPages(result.totalPages ?? 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal memuat tabel pecah bon.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const getNextEntryInPage = useCallback(
    (entryId: string) => {
      const index = historyRows.findIndex((row) => row.id === entryId);
      if (index === -1) return null;
      return historyRows[index + 1] ?? null;
    },
    [historyRows],
  );

  const openEntryForSetoran = useCallback(
    async (entry: PecahBonEntry) => {
      setSelectedEntry(entry);
      setSubmitResult(null);
      setSelectedBarangJadiId((current) =>
        barangJadiOptions.some((item) => item.id === current) ? current : '',
      );
      setSetoranForm({
        resultGradeValues: {},
        byProductValues: {},
        notes: '',
      });

      if (entry.pecahBonId) {
        const parsed = parsePecahBonId(entry.pecahBonId);
        if (parsed) {
          setLpDigits(parsed.digits);
          setYearSuffix(parsed.year);
        }
      }

      await loadWorkItemByEntry(entry);
      void prefetchWorkItemByEntry(getNextEntryInPage(entry.id));
    },
    [barangJadiOptions, loadWorkItemByEntry, prefetchWorkItemByEntry, getNextEntryInPage],
  );

  const handleSearch = useCallback(async () => {
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
      await openEntryForSetoran(entry);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'LP tidak ditemukan.');
      setWorkItem(null);
      setWorkItemLookupError(null);
    } finally {
      setSearchLoading(false);
    }
  }, [lpDigits, yearSuffix, toast, openEntryForSetoran]);

  const handleSubmitSetoran = useCallback(async (moveNext = false) => {
    if (!selectedEntry || !workItem) {
      toast.error('Data LP belum siap untuk setoran.');
      return;
    }
    if (!selectedBarangJadiId) {
      toast.error('Pilih barang jadi terlebih dahulu.');
      return;
    }
    if (visibleResultGrades.length === 0) {
      toast.error('Barang jadi ini belum punya grade hasil.');
      return;
    }
    if (totalBarangJadi <= 0) {
      toast.error('Total Barang Jadi wajib diisi.');
      return;
    }
    if (inputMelebihiDryIn) {
      toast.error('Input melebihi berat kering awal!');
      return;
    }

    setSetoranSubmitting(true);
    try {
      const result = await submitFinishSetoran({
        workOrderItemId: workItem.workOrderItemId,
        barangJadiId: selectedBarangJadiId || undefined,
        returnedAt: new Date().toISOString(),
        mainOutWeightGram: Math.round(totalBarangJadi),
        byProductWeightGram: Math.round(totalByProduct),
        notes: setoranForm.notes.trim() || undefined,
        resultGrades: visibleResultGrades.map((item) => ({
          resultGradeTypeId: item.id,
          weightGram: Math.round(parseGram(setoranForm.resultGradeValues[item.id] ?? '')),
        })),
      });
      setSubmitResult(result);
      toast.success('Setoran berhasil disimpan.');

      const updatedWorkItem: FinishWorkItemLookup = {
        ...workItem,
        flowState: 'SUBMITTED',
        canSubmit: false,
        submittedAt: new Date().toISOString(),
      };
      setWorkItem(updatedWorkItem);
      if (selectedEntry.pecahBonId) {
        workItemCacheRef.current[selectedEntry.pecahBonId] = updatedWorkItem;
      }

      if (moveNext) {
        const nextEntry = getNextEntryInPage(selectedEntry.id);
        if (nextEntry) {
          await openEntryForSetoran(nextEntry);
        } else {
          toast.info('Tidak ada LP berikutnya di halaman ini.');
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan setoran.');
    } finally {
      setSetoranSubmitting(false);
    }
  }, [
    selectedEntry,
    workItem,
    totalBarangJadi,
    totalByProduct,
    inputMelebihiDryIn,
    setoranForm.notes,
    selectedBarangJadiId,
    setoranForm.resultGradeValues,
    toast,
    openEntryForSetoran,
    getNextEntryInPage,
    visibleResultGrades,
  ]);

  const handleCompleteDryQc = useCallback(async () => {
    if (!selectedEntry?.pecahBonId || !workItem) {
      toast.error('Data LP belum siap untuk koreksi kering.');
      return;
    }

    setDryQcSubmitting(true);
    try {
      await completeDryQcWorkItem(workItem.workOrderItemId);
      delete workItemCacheRef.current[selectedEntry.pecahBonId];
      await loadWorkItemByEntry(selectedEntry);
      toast.success('Koreksi kering selesai. LP siap setor.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal menyelesaikan koreksi kering.');
    } finally {
      setDryQcSubmitting(false);
    }
  }, [loadWorkItemByEntry, selectedEntry, toast, workItem]);

  /* â”€â”€ effects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  useEffect(() => {
    void loadHistory(historyPage, historyLimit);
  }, [historyPage, historyLimit]);



  /* â”€â”€ form field updater â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const updateField = useCallback(
    (field: keyof typeof setoranForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setSetoranForm((prev) => ({ ...prev, [field]: e.target.value })),
    [],
  );

  const updateByProductValue = useCallback(
    (byProductId: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setSetoranForm((prev) => ({
        ...prev,
        byProductValues: {
          ...prev.byProductValues,
          [byProductId]: e.target.value,
        },
      })),
    [],
  );

  const updateResultGradeValue = useCallback(
    (resultGradeId: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setSetoranForm((prev) => ({
        ...prev,
        resultGradeValues: {
          ...prev.resultGradeValues,
          [resultGradeId]: e.target.value,
        },
      })),
    [],
  );

  /* â”€â”€ status chip for modal header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const statusChip = useMemo(() => {
    if (workItemLookupLoading)
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
          Memuat...
        </span>
      );
    if (workItemLookupError)
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700">
          Error
        </span>
      );
    if (!workItem) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
          Menunggu
        </span>
      );
    }

    if (workItem.flowState === 'READY_TO_SUBMIT')
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Siap Setor
        </span>
      );
    if (workItem.flowState === 'DRYING')
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
          Pengeringan
        </span>
      );
    if (workItem.flowState === 'DRYING_QC')
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-100 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
          Koreksi Kering
        </span>
      );
    if (workItem.flowState === 'IN_PROGRESS')
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
          Cabut Bulu
        </span>
      );
    if (workItem.flowState === 'NEXT_DAY')
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
          Antrian Besok
        </span>
      );
    if (workItem.flowState === 'SUBMITTED')
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-700">
          Sudah Setor
        </span>
      );
    if (workItem.flowState === 'CANCELED')
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
          Dibatalkan
        </span>
      );

    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
        Menunggu
      </span>
    );
  }, [workItem, workItemLookupError, workItemLookupLoading]);

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-4">
      <PageTransition className="mx-auto max-w-7xl space-y-5">
        {/* â”€â”€ page header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Data Koreksi</h1>
            <p className="text-sm text-gray-500">
              Cari LP, input setoran, dan lihat riwayat pecah bon.
            </p>
          </div>
          <div className="flex items-center overflow-hidden rounded-lg border border-gray-300 focus-within:border-[#059833] focus-within:ring-1 focus-within:ring-[#059833]">
            <span className="flex items-center bg-gray-50 px-3 py-2 font-semibold text-gray-500 border-r border-gray-200 text-sm">
              TEI-
            </span>
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
              className="h-10 w-20 border-0 rounded-none shadow-none text-center font-semibold focus-visible:ring-0 px-2"
              placeholder="0001"
              aria-label="Digit nomor LP"
            />
            <span className="flex items-center px-1 font-semibold text-gray-400">-</span>
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
              className="h-10 w-14 border-0 rounded-none shadow-none text-center font-semibold focus-visible:ring-0 px-2"
              aria-label="Tahun LP"
            />
            <Button
              onClick={() => void handleSearch()}
              disabled={searchLoading}
              className="h-10 rounded-none bg-[#059833] hover:bg-[#047a29] px-5"
              aria-label="Cari nomor LP"
            >
              {searchLoading ? '...' : 'Cari'}
            </Button>
          </div>
        </div>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• INLINE SETORAN FORM AREA â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {selectedEntry ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
            {/* â”€â”€ LEFT: Form Inputs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="space-y-5">
              {/* Header bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#059833]/20 bg-gradient-to-r from-[#059833]/5 to-white px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#059833] text-white">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Form Setoran</p>
                    <p className="text-base font-bold text-gray-900 font-mono">{selectedEntry.pecahBonId ?? '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusChip}
                  <Button variant="outline" size="sm" onClick={() => { setSelectedEntry(null); setWorkItem(null); setSubmitResult(null); }} className="h-8 text-xs text-gray-500">
                    Tutup
                  </Button>
                </div>
              </div>

              {/* Setoran form grid */}
              <div className="grid gap-5 md:grid-cols-2">
                {/* Step 1: Pilih Barang Jadi */}
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2.5 border-b border-gray-100 pb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#059833] text-xs font-bold text-white">1</span>
                    <h3 className="text-sm font-semibold text-gray-900">Pilih Barang Jadi</h3>
                  </div>
                  <select
                    id="byProductTemplate"
                    value={selectedBarangJadiId}
                    onChange={(e) => setSelectedBarangJadiId(e.target.value)}
                    disabled={barangJadiLoading}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium outline-none transition-colors focus:border-[#059833] focus:ring-1 focus:ring-[#059833]"
                  >
                    <option value="">
                      {barangJadiLoading ? 'Memuat...' : barangJadiOptions.length > 0 ? '-- Pilih template --' : 'Belum ada'}
                    </option>
                    {barangJadiOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </div>

                {/* Step 2: Input Hasil  */}
                <div className={`rounded-xl border bg-white p-5 shadow-sm transition-all duration-200 ${selectedBarangJadiId ? 'border-[#059833]/30 ring-1 ring-[#059833]/10' : 'border-gray-200 opacity-60'}`}>
                  <div className="mb-4 flex items-center gap-2.5 border-b border-gray-100 pb-3">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${selectedBarangJadiId ? 'bg-[#059833] text-white' : 'bg-gray-300 text-gray-500'}`}>2</span>
                    <h3 className="text-sm font-semibold text-gray-900">Grade Hasil Barang Jadi</h3>
                  </div>
                  <div className={!selectedBarangJadiId ? 'pointer-events-none' : ''}>
                    {selectedBarangJadiId && visibleResultGrades.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                        Barang jadi ini belum memiliki grade hasil. Atur melalui Master Barang Jadi.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {visibleResultGrades.map((field) => (
                            <div key={field.id} className="space-y-1.5">
                              <Label htmlFor={`result-grade-${field.id}`} className="text-xs font-medium text-gray-600">
                                {field.name}
                              </Label>
                              <div className="relative">
                                <Input
                                  id={`result-grade-${field.id}`}
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={setoranForm.resultGradeValues[field.id] ?? ''}
                                  onChange={updateResultGradeValue(field.id)}
                                  className="h-10 pr-8 shadow-none"
                                  placeholder="0"
                                />
                                <span className="absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">gr</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between rounded-lg bg-[#059833]/5 px-3 py-3">
                          <span className="text-sm font-semibold text-[#059833]">Total Barang Jadi</span>
                          <span className="text-lg font-bold tabular-nums text-[#059833]">{fmtNum(totalBarangJadi, 2)} gr</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* By Product fields â€“ full width row */}
              {selectedBarangJadiId && (
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2.5 border-b border-gray-100 pb-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#059833] text-xs font-bold text-white">3</span>
                    <h3 className="text-sm font-semibold text-gray-900">By Product</h3>
                    {selectedBarangJadi && (
                      <span className="ml-auto rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">{selectedBarangJadi.name}</span>
                    )}
                  </div>

                  {visibleByProducts.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                      Barang jadi ini belum memiliki By Product. Atur melalui Master Barang Jadi.
                    </p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {visibleByProducts.map((field) => (
                        <div key={field.id} className="space-y-1.5">
                          <Label htmlFor={field.id} className="text-xs font-medium text-gray-600">{field.name}</Label>
                          <div className="relative">
                            <Input
                              id={field.id}
                              type="number"
                              min={0}
                              step="0.01"
                              value={setoranForm.byProductValues[field.id] ?? ''}
                              onChange={updateByProductValue(field.id)}
                              className="h-9 pr-8 shadow-none"
                              placeholder="0"
                            />
                            <span className="absolute inset-y-0 right-3 flex items-center text-xs text-gray-400">gr</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notes */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <Label htmlFor="setoranNotes" className="mb-1.5 block text-xs font-medium text-gray-600">Catatan (Opsional)</Label>
                    <textarea
                      id="setoranNotes"
                      className="min-h-14 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-[#059833] focus:ring-1 focus:ring-[#059833] resize-none"
                      value={setoranForm.notes}
                      onChange={updateField('notes')}
                      placeholder="Tulis pesan jika ada kendala..."
                    />
                  </div>
                </div>
              )}

              {/* â”€â”€ Submit buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="flex flex-wrap items-center justify-end gap-3">
                {inputMelebihiDryIn && (
                  <div id="validation-error" className="mr-auto flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2" role="alert">
                    <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <p className="text-xs font-semibold text-red-700">Input melebihi berat kering!</p>
                  </div>
                )}
                <Button
                  variant="outline"
                  className="h-10 px-5 text-sm font-semibold text-gray-700 border-gray-300"
                  onClick={() => void handleSubmitSetoran(true)}
                  disabled={!canSubmitSetoran}
                  title={submitDisabledReason}
                  aria-describedby={inputMelebihiDryIn ? 'validation-error' : undefined}
                >
                  {setoranSubmitting ? 'Memproses...' : 'SUBMIT & NEXT'}
                </Button>
                <Button
                  className="h-10 px-6 text-sm font-semibold bg-[#059833] hover:bg-[#047a29]"
                  onClick={() => void handleSubmitSetoran(false)}
                  disabled={!canSubmitSetoran}
                  title={submitDisabledReason}
                  aria-describedby={inputMelebihiDryIn ? 'validation-error' : undefined}
                >
                  {setoranSubmitting ? 'Menyimpan...' : 'SUBMIT SETORAN'}
                </Button>
              </div>

              {/* â”€â”€ Submit result â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              {submitResult && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">âœ“ Setoran Tersimpan</p>
                  <div className="grid gap-x-6 gap-y-1 text-sm text-emerald-900 sm:grid-cols-2">
                    <p>Susut Proses: <strong className="tabular-nums">{susutUnit === 'gram' ? `${fmtNum(submitResult.susutProsesGram, 2)} gr` : `${fmtNum(submitResult.susutProsesPctBps / 100, 2)}%`}</strong></p>
                    <p>Susut Hilang: <strong className="tabular-nums">{susutUnit === 'gram' ? `${fmtNum(submitResult.susutHilangGram, 2)} gr` : `${fmtNum(submitResult.susutHilangPctBps / 100, 2)}%`}</strong></p>
                    <p>Rendemen Utama: <strong className="tabular-nums">{fmtNum(submitResult.rendemenMainPctBps / 100, 2)}%</strong></p>
                    <p>Rendemen Bersih: <strong className="tabular-nums">{fmtNum(submitResult.rendemenNetPctBps / 100, 2)}%</strong></p>
                  </div>
                </div>
              )}
            </div>

            {/* â”€â”€ RIGHT: Info & Kalkulasi (sidebar) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
              {/* Info LP */}
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600">Info LP</h3>
                </div>
                <div className="divide-y divide-gray-100 text-sm">
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-gray-500">Grade</span>
                    <span className="font-semibold text-gray-900">{gradeLabel}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-gray-500">Pekerja</span>
                    <span className="font-semibold text-gray-900">{workItem?.workerName ?? '-'}</span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-gray-500">Keping</span>
                    <span className="font-semibold text-gray-900">{selectedEntry.pieceCount} pcs</span>
                  </div>
                  <div className="flex justify-between bg-[#059833]/5 px-4 py-3">
                    <span className="font-semibold text-[#059833]">Brt Kering</span>
                    <span className="text-base font-bold tabular-nums text-[#059833]">{fmtNum(selectedEntry.dryWeightGram, 2)} gr</span>
                  </div>
                </div>
              </div>

              {/* Flow status */}
              {workItem && !workItemLookupError && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      {(workItem.flowState === 'IN_PROGRESS' || workItem.flowState === 'DRYING' || workItem.flowState === 'DRYING_QC') && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                      )}
                      <span className={`relative inline-flex h-2 w-2 rounded-full ${workItem.flowState === 'READY_TO_SUBMIT' ? 'bg-[#059833]' : workItem.flowState === 'SUBMITTED' ? 'bg-gray-400' : 'bg-blue-500'}`}></span>
                    </span>
                    <p className="text-xs font-medium text-gray-700">
                      {workItem.flowState === 'NEXT_DAY' && 'Antrian besok.'}
                      {workItem.flowState === 'IN_PROGRESS' && 'Sedang pencabutan bulu.'}
                      {workItem.flowState === 'DRYING' && 'Sedang pengeringan.'}
                      {workItem.flowState === 'DRYING_QC' && 'Siap koreksi kering.'}
                      {workItem.flowState === 'READY_TO_SUBMIT' && 'Barang siap disetor.'}
                      {workItem.flowState === 'SUBMITTED' && 'Sudah disetor.'}
                      {workItem.flowState === 'CANCELED' && 'Dibatalkan.'}
                    </p>
                  </div>
                  {workItem.flowState === 'DRYING_QC' && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <Button type="button" size="sm" className="w-full bg-[#059833] hover:bg-[#047a29]" onClick={() => void handleCompleteDryQc()} disabled={dryQcSubmitting}>
                        {dryQcSubmitting ? 'Memproses...' : 'Selesaikan Koreksi Kering'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Auto calc */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm" aria-live="polite">
                <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-600">Kalkulasi</p>
                  <div className="flex rounded bg-gray-100 p-0.5">
                    <button type="button" className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-all ${susutUnit === 'gram' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`} onClick={() => setSusutUnit('gram')}>gr</button>
                    <button type="button" className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-all ${susutUnit === 'percent' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`} onClick={() => setSusutUnit('percent')}>%</button>
                  </div>
                </div>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between rounded-lg bg-emerald-50/70 px-3 py-2.5">
                    <span className="text-emerald-700">Total Barang Jadi</span>
                    <span className="font-semibold tabular-nums text-emerald-900">{fmtNum(totalBarangJadi, 2)} gr</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-gray-50 px-3 py-2.5">
                    <span className="text-gray-600">By Product</span>
                    <span className="font-semibold tabular-nums text-gray-900">{fmtNum(totalByProduct, 2)} gr</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-indigo-50/70 px-3 py-2.5">
                    <span className="text-indigo-700">Rendemen</span>
                    <span className="font-semibold tabular-nums text-indigo-900">{fmtNum(rendemenPct, 2)}%</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-amber-50/70 px-3 py-2.5">
                    <span className="text-amber-700">Susut Proses</span>
                    <span className="font-semibold tabular-nums text-amber-900">{susutUnit === 'gram' ? `${fmtNum(susutProsesGram, 2)} gr` : `${fmtNum(susutProsesPct, 2)}%`}</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-rose-50/70 px-3 py-2.5">
                    <span className="text-rose-700">Susut Hilang</span>
                    <span className="font-semibold tabular-nums text-rose-900">{susutUnit === 'gram' ? `${fmtNum(susutHilangGram, 2)} gr` : `${fmtNum(susutHilangPct, 2)}%`}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
            <p className="text-sm text-gray-500">Cari LP di atas atau klik baris tabel di bawah untuk memulai input setoran.</p>
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• HISTORY TABLE â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Daftar Pecah Bon</h3>
              <p className="text-xs text-gray-500">Klik baris untuk membuka form setoran.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Per halaman</span>
              <select
                value={historyLimit}
                onChange={(event) => {
                  const nextLimit = Number(event.target.value) as 10 | 20;
                  setHistoryLimit(nextLimit);
                  setHistoryPage(1);
                }}
                className="h-8 rounded-md border border-gray-300 px-2 text-xs outline-none focus:border-[#059833]"
                aria-label="Jumlah baris per halaman"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">ID LP</th>
                  <th className="px-3 py-2 text-left">Tanggal</th>
                  <th className="px-3 py-2 text-left">Grade</th>
                  <th className="px-3 py-2 text-right">Keping</th>
                  <th className="px-3 py-2 text-right">Basah</th>
                  <th className="px-3 py-2 text-right">K.Air</th>
                  <th className="px-3 py-2 text-right">Kering</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {historyLoading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-500">Memuat data...</td>
                  </tr>
                ) : historyRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-500">Belum ada data pecah bon.</td>
                  </tr>
                ) : (
                  historyRows.map((row) => (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => void openEntryForSetoran(row)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          void openEntryForSetoran(row);
                        }
                      }}
                      className={`cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${selectedEntry?.id === row.id
                        ? 'bg-emerald-50 ring-1 ring-emerald-200'
                        : 'hover:bg-gray-50 active:bg-gray-100'
                        }`}
                      aria-label={`Buka LP ${row.pecahBonId ?? row.id}`}
                    >
                      <td className="px-3 py-2.5 font-mono text-gray-800">{row.pecahBonId ?? '-'}</td>
                      <td className="px-3 py-2.5 text-gray-700">{fmtDate(row.pecahBonDate)}</td>
                      <td className="px-3 py-2.5 text-gray-800">
                        {row.grade?.code ?? '-'} / {row.featherGrade?.code ?? '-'} / {row.colorGrade?.code ?? '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{row.pieceCount}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{fmtNum(row.initialWeightGram, 2)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{fmtNum(row.moisturePercent, 1)}%</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-green-700">{fmtNum(row.dryWeightGram, 2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <span>
              Menampilkan {historyTotal === 0 ? 0 : (historyPage - 1) * historyLimit + 1}-
              {Math.min(historyPage * historyLimit, historyTotal)} dari {historyTotal}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                disabled={historyPage <= 1 || historyLoading}
                className="h-7 px-2 text-xs"
              >
                Prev
              </Button>
              <span>
                Halaman {historyPage}/{Math.max(historyTotalPages, 1)}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setHistoryPage((prev) => Math.min(Math.max(historyTotalPages, 1), prev + 1))}
                disabled={historyPage >= historyTotalPages || historyLoading}
                className="h-7 px-2 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </PageTransition>
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
