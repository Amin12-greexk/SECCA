'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageTransition from '@/components/animations/PageTransition';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QrScanModal, resolveScanLookupValue, useHardwareScanner } from '@/components/scan/qr-scan';

import { useToast } from '@/lib/toast';
import {
  completeDryQcWorkItem,
  getBarangJadiList,
  getFinishWorkItemByLp,
  getPecahBonById,
  submitFinishSetoran,
  getLocations,
  type BarangJadi,
  type FinishSubmitResponse,
  type FinishWorkItemLookup,
  type PecahBonEntry,
  type RackLocation,
} from '@/lib/api';
import { BARANG_JADI_UPDATED_EVENT } from '@/lib/barang-jadi';

/* ─────────────────────── helpers (module-level, stable refs) ─────────────────────── */

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

const parseGram = (value: string) => {
  if (!value.trim()) return 0;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const KOREKSI_DRAFT_KEY = 'secca_koreksi_form_draft_v1';

/* ─────────────────────────── main component ────────────────────────────────── */

function KoreksiDataContent() {
  const toast = useToast();
  const toastRef = useRef(toast);

  /* ── LP search state ────────────────────────────────────────────────── */
  const [lpDigits, setLpDigits] = useState('');
  const [yearSuffix, setYearSuffix] = useState(String(new Date().getFullYear()).slice(-2));
  const [searchLoading, setSearchLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  /* ── selected entry + work item ─────────────────────────────────────── */
  const [selectedEntry, setSelectedEntry] = useState<PecahBonEntry | null>(null);
  const [workItemLookupLoading, setWorkItemLookupLoading] = useState(false);
  const [workItemLookupError, setWorkItemLookupError] = useState<string | null>(null);
  const [workItem, setWorkItem] = useState<FinishWorkItemLookup | null>(null);

  /* ── submit state ───────────────────────────────────────────────────── */
  const [setoranSubmitting, setSetoranSubmitting] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [alreadySubmittedModalOpen, setAlreadySubmittedModalOpen] = useState(false);
  const [dryQcSubmitting, setDryQcSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<FinishSubmitResponse | null>(null);

  /* ── modal + form ───────────────────────────────────────────────────── */
  const [setoranForm, setSetoranForm] = useState({
    resultGradeValues: {} as Record<string, string>,
    byProductValues: {} as Record<string, string>,
    notes: '',
  });
  const [barangJadiOptions, setBarangJadiOptions] = useState<BarangJadi[]>([]);
  const [selectedBarangJadiId, setSelectedBarangJadiId] = useState('');
  const [barangJadiLoading, setBarangJadiLoading] = useState(false);
  const [locations, setLocations] = useState<RackLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');

  /**
   * Tracks which weight input field the user last focused on, so that
   * incoming timbangan (scale) readings are routed to the correct field
   * instead of always going to the first result grade.
   *
   * Shape: { group: 'resultGrade' | 'byProduct', id: string }
   */
  const focusedWeightFieldRef = useRef<{ group: 'resultGrade' | 'byProduct'; id: string } | null>(null);

  const workItemCacheRef = useRef<Record<string, FinishWorkItemLookup>>({});
  const isRestoredRef = useRef(false);

  /* ── Restore draft from sessionStorage on mount ──────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(KOREKSI_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft.selectedEntry) {
          setSelectedEntry(draft.selectedEntry);
          if (draft.workItem) {
            setWorkItem(draft.workItem);
            if (draft.selectedEntry.pecahBonId) {
              workItemCacheRef.current[draft.selectedEntry.pecahBonId] = draft.workItem;
            }
          }
          if (draft.selectedBarangJadiId) setSelectedBarangJadiId(draft.selectedBarangJadiId);
          if (draft.selectedLocationId) setSelectedLocationId(draft.selectedLocationId);
          if (draft.setoranForm) setSetoranForm(draft.setoranForm);
          if (draft.lpDigits) setLpDigits(draft.lpDigits);
          if (draft.yearSuffix) setYearSuffix(draft.yearSuffix);
        }
      }
    } catch (e) {
      console.error('Gagal memuat draf setoran:', e);
    } finally {
      isRestoredRef.current = true;
    }
  }, []);

  /* ── Auto-save draft to sessionStorage on state change ──────────────── */
  useEffect(() => {
    if (typeof window === 'undefined' || !isRestoredRef.current) return;
    try {
      if (selectedEntry) {
        sessionStorage.setItem(
          KOREKSI_DRAFT_KEY,
          JSON.stringify({
            selectedEntry,
            workItem,
            selectedBarangJadiId,
            selectedLocationId,
            setoranForm,
            lpDigits,
            yearSuffix,
          }),
        );
      } else {
        sessionStorage.removeItem(KOREKSI_DRAFT_KEY);
      }
    } catch (e) {
      console.error('Gagal menyimpan draf setoran:', e);
    }
  }, [selectedEntry, workItem, selectedBarangJadiId, selectedLocationId, setoranForm, lpDigits, yearSuffix]);

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
        const locs = await getLocations();
        // filter ONLY finished rack, or show all? We can just show all or just 'FINISHED' type.
        setLocations(locs.filter(l => l.type === 'FINISHED'));
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

  /* ── derived / memoised calculations ────────────────────────────────── */

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

  const hasNegativeInput = useMemo(() => {
    const resultVals = Object.values(setoranForm.resultGradeValues);
    const byProductVals = Object.values(setoranForm.byProductValues);
    return (
      resultVals.some((v) => v.trim() !== '' && (isNaN(Number(v.replace(',', '.'))) || Number(v.replace(',', '.')) < 0)) ||
      byProductVals.some((v) => v.trim() !== '' && (isNaN(Number(v.replace(',', '.'))) || Number(v.replace(',', '.')) < 0))
    );
  }, [setoranForm.resultGradeValues, setoranForm.byProductValues]);

  const inputMelebihiDryIn = totalBarangJadi + totalByProduct > setoranDryInGram;

  const canSubmitSetoran =
    !!workItem &&
    workItem.flowState !== 'SUBMITTED' &&
    workItem.flowState !== 'CANCELED' &&
    !!selectedBarangJadiId &&
    visibleResultGrades.length > 0 &&
    totalBarangJadi > 0 &&
    !inputMelebihiDryIn &&
    !hasNegativeInput &&
    !setoranSubmitting &&
    !dryQcSubmitting;

  const submitDisabledReason = useMemo(() => {
    if (setoranSubmitting) return 'Sedang menyimpan...';
    if (dryQcSubmitting) return 'Sedang menyelesaikan koreksi kering...';
    if (!workItem) return 'LP belum ditemukan / belum siap disetor';
    if (workItem.flowState === 'SUBMITTED') return 'LP sudah disetor';
    if (workItem.flowState === 'CANCELED') return 'LP dibatalkan';
    if (!selectedBarangJadiId) return 'Pilih template barang jadi terlebih dahulu';
    if (visibleResultGrades.length === 0) return 'Barang jadi ini belum memiliki grade hasil';
    if (totalBarangJadi <= 0) return 'Total berat Barang Jadi wajib diisi (> 0 gram)';
    if (hasNegativeInput) return 'Ada input berat yang bernilai negatif / tidak valid!';
    if (inputMelebihiDryIn) return `Total hasil (${fmtNum(totalBarangJadi + totalByProduct)}g) melebihi berat kering awal (${fmtNum(setoranDryInGram)}g)!`;
    return '';
  }, [dryQcSubmitting, hasNegativeInput, inputMelebihiDryIn, selectedBarangJadiId, setoranDryInGram, setoranSubmitting, totalBarangJadi, totalByProduct, visibleResultGrades.length, workItem]);

  /* ── callbacks ──────────────────────────────────────────────────────── */

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
        if (cached.flowState === 'SUBMITTED') {
          setAlreadySubmittedModalOpen(true);
        }
        return;
      }

      setWorkItemLookupLoading(true);
      setWorkItemLookupError(null);
      try {
        const lookup = await getFinishWorkItemByLp(entry.pecahBonId);
        workItemCacheRef.current[entry.pecahBonId] = lookup;
        setWorkItem(lookup);
        if (lookup.flowState === 'SUBMITTED') {
          setAlreadySubmittedModalOpen(true);
        }
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

  const openEntryForSetoran = useCallback(
    async (entry: PecahBonEntry) => {
      setAlreadySubmittedModalOpen(false);
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
    },
    [barangJadiOptions, loadWorkItemByEntry],
  );

  const lookupAndOpen = useCallback(
    async (rawId: string): Promise<boolean> => {
      const id = rawId.trim();
      if (!id) {
        toastRef.current.error('Nomor LP kosong.');
        return false;
      }
      setSearchLoading(true);
      try {
        let entry: PecahBonEntry;
        try {
          entry = await getPecahBonById(id);
        } catch (firstErr) {
          const digitsOnly = id.replace(/\D/g, '');
          if (digitsOnly && digitsOnly !== id) {
            entry = await getPecahBonById(digitsOnly);
          } else {
            throw firstErr;
          }
        }
        await openEntryForSetoran(entry);
        toastRef.current.success(`LP ${entry.pecahBonId ?? id} dimuat.`);
        return true;
      } catch (error) {
        toastRef.current.error(error instanceof Error ? error.message : 'LP tidak ditemukan.');
        setWorkItem(null);
        setWorkItemLookupError(null);
        return false;
      } finally {
        setSearchLoading(false);
      }
    },
    [openEntryForSetoran],
  );

  const handleSearch = useCallback(() => {
    const digits = normalizeDigits(lpDigits);
    if (!digits) {
      toast.error('Masukkan nomor LP.');
      return;
    }
    const paddedDigits = digits.padStart(4, '0');
    const normalizedYear = normalizeYear(yearSuffix) || String(new Date().getFullYear()).slice(-2);
    void lookupAndOpen(`TEI-${paddedDigits}-${normalizedYear}`);
  }, [lpDigits, yearSuffix, toast, lookupAndOpen]);

  const handleScan = useCallback(
    (rawValue: string): Promise<boolean> => lookupAndOpen(resolveScanLookupValue(rawValue)),
    [lookupAndOpen],
  );

  /* ── Hardware event handler (desktop: scanner + timbangan) ──────────── */
  const handleHardwarePayload = useCallback(
    (payload: unknown) => {
      if (typeof payload === 'string') {
        void handleScan(payload);
        return;
      }

      const candidate = payload as { type?: string; value?: string } | null;
      const type = candidate?.type === 'weight' ? 'weight' : 'scan';
      const value = typeof candidate?.value === 'string' ? candidate.value.trim() : '';

      if (type === 'weight') {
        if (!value) return;
        const parsed = Number(value.replace(',', '.'));
        if (!Number.isFinite(parsed) || parsed < 0) return;

        if (!selectedBarangJadiId) {
          toastRef.current.info('Pilih barang jadi sebelum menerima timbangan.');
          return;
        }

        // Determine target field: use the last focused field, or fall back to first result grade
        const focused = focusedWeightFieldRef.current;
        let targetGroup: 'resultGrade' | 'byProduct' = 'resultGrade';
        let targetId: string | undefined;

        if (focused) {
          // Validate the focused field still exists in the current template
          if (focused.group === 'byProduct') {
            const exists = visibleByProducts.some((bp) => bp.id === focused.id);
            if (exists) {
              targetGroup = 'byProduct';
              targetId = focused.id;
            }
          } else {
            const exists = visibleResultGrades.some((rg) => rg.id === focused.id);
            if (exists) {
              targetGroup = 'resultGrade';
              targetId = focused.id;
            }
          }
        }

        // Fallback to first result grade if focused field was not resolved
        if (!targetId) {
          if (visibleResultGrades.length === 0) {
            toastRef.current.info('Pilih barang jadi dan grade hasil sebelum menerima timbangan.');
            return;
          }
          targetGroup = 'resultGrade';
          targetId = visibleResultGrades[0]?.id;
        }

        if (!targetId) return;

        // Determine the field label for the toast
        let fieldLabel: string;
        if (targetGroup === 'byProduct') {
          fieldLabel = visibleByProducts.find((bp) => bp.id === targetId)?.name ?? 'By Product';
        } else {
          fieldLabel = visibleResultGrades.find((rg) => rg.id === targetId)?.name ?? 'Grade';
        }

        setSetoranForm((prev) => {
          if (targetGroup === 'byProduct') {
            return {
              ...prev,
              byProductValues: {
                ...prev.byProductValues,
                [targetId!]: String(parsed),
              },
            };
          }
          return {
            ...prev,
            resultGradeValues: {
              ...prev.resultGradeValues,
              [targetId!]: String(parsed),
            },
          };
        });
        toastRef.current.success(`Timbangan → ${fieldLabel}: ${parsed.toLocaleString('id-ID')} gr`);
        return;
      }

      if (value) {
        void handleScan(value);
      }
    },
    [handleScan, selectedBarangJadiId, visibleResultGrades, visibleByProducts],
  );

  // Scanner mesin (keyboard-wedge) — aktif selama halaman terbuka.
  useHardwareScanner((payload) => {
    void handleScan(payload);
  });

  // Desktop hardware event (scanner mesin / timbangan via Electron IPC).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unsubscribe = (window as unknown as { seccaDesktop?: { onHardwareEvent?: (cb: (p: unknown) => void) => (() => void) } }).seccaDesktop?.onHardwareEvent?.(handleHardwarePayload);
    return () => unsubscribe?.();
  }, [handleHardwarePayload]);

  const handleSubmitSetoran = useCallback(async () => {
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
      setSuccessModalOpen(true);
      toast.success('Setoran berhasil disimpan!');

      // Clear draft since setoran was successfully submitted
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.removeItem(KOREKSI_DRAFT_KEY);
        } catch { /* ignore */ }
      }

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
    selectedLocationId,
    setoranForm.resultGradeValues,
    toast,
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

  /* ── form field updater ─────────────────────────────────────────────── */

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

  /* ── status chip ────────────────────────────────────────────────────── */

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

  /* ─────────────────────────── RENDER ────────────────────────────────── */

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-4 pb-24">
      <PageTransition className="mx-auto max-w-7xl space-y-5">
        {/* ── page header + search + scan ─────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Data Koreksi</h1>
            <p className="text-sm text-gray-500">
              Scan QR kartu pecah bon atau cari nomor LP untuk input setoran.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setScanOpen(true)}
              className="h-10 gap-2 border-[#059833] px-4 text-sm font-semibold text-[#059833] hover:bg-[#059833]/5"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Scan QR
            </Button>
            <div className="flex items-center overflow-hidden rounded-lg border border-gray-300 focus-within:border-[#059833] focus-within:ring-1 focus-within:ring-[#059833]">
              <span className="flex items-center border-r border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-500">
                TEI-
              </span>
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
                className="h-10 w-20 rounded-none border-0 px-2 text-center font-semibold shadow-none focus-visible:ring-0"
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
                    handleSearch();
                  }
                }}
                inputMode="numeric"
                className="h-10 w-14 rounded-none border-0 px-2 text-center font-semibold shadow-none focus-visible:ring-0"
                aria-label="Tahun LP"
              />
              <Button
                onClick={handleSearch}
                disabled={searchLoading}
                className="h-10 rounded-none bg-[#059833] px-5 hover:bg-[#047a29]"
                aria-label="Cari nomor LP"
              >
                {searchLoading ? '...' : 'Cari'}
              </Button>
            </div>
          </div>
        </div>

        {/* ═══════════════ INLINE SETORAN FORM ═══════════════════════════ */}
        {selectedEntry ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]">
            {/* ── LEFT: Form Inputs ───────────────────────────────────── */}
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

              {/* Dry QC button */}
              {workItem?.flowState === 'DRYING_QC' && (
                <div className="flex items-center gap-3 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3">
                  <p className="flex-1 text-sm text-cyan-800">LP dalam tahap koreksi kering. Selesaikan untuk lanjut ke setoran.</p>
                  <Button
                    size="sm"
                    disabled={dryQcSubmitting}
                    onClick={() => void handleCompleteDryQc()}
                    className="bg-cyan-600 hover:bg-cyan-700"
                  >
                    {dryQcSubmitting ? 'Memproses...' : 'Selesaikan Koreksi Kering'}
                  </Button>
                </div>
              )}

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

                {/* Step 2: Input Hasil */}
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
                                  onFocus={() => { focusedWeightFieldRef.current = { group: 'resultGrade', id: field.id }; }}
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

              {/* By Product fields — full width row */}
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
                              onFocus={() => { focusedWeightFieldRef.current = { group: 'byProduct', id: field.id }; }}
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

              {/* ── Submit buttons ──────────────────────────────────── */}
              <div className="flex flex-wrap items-center justify-end gap-3">
                {inputMelebihiDryIn ? (
                  <div id="validation-error" className="mr-auto flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2" role="alert">
                    <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <p className="text-xs font-semibold text-red-700">Input melebihi berat kering!</p>
                  </div>
                ) : (
                  !canSubmitSetoran && submitDisabledReason && (
                    <div className="mr-auto flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <p className="text-xs font-semibold text-amber-700">Belum bisa submit: {submitDisabledReason}</p>
                    </div>
                  )
                )}
                <Button
                  className="h-10 px-6 text-sm font-semibold bg-[#059833] hover:bg-[#047a29]"
                  onClick={() => setConfirmModalOpen(true)}
                  disabled={!canSubmitSetoran}
                  title={submitDisabledReason}
                  aria-describedby={inputMelebihiDryIn ? 'validation-error' : undefined}
                >
                  {setoranSubmitting ? 'Menyimpan...' : 'SUBMIT SETORAN'}
                </Button>
              </div>

              {/* ── Submit result ─────────────────────────────────── */}
              {submitResult && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">✓ Setoran Tersimpan</p>
                  <div className="grid gap-x-6 gap-y-1 text-sm text-emerald-900 sm:grid-cols-2">
                    <p>Rendemen Utama: <strong className="tabular-nums">{fmtNum(submitResult.rendemenMainPctBps / 100, 2)}%</strong></p>
                    <p>Rendemen Bersih: <strong className="tabular-nums">{fmtNum(submitResult.rendemenNetPctBps / 100, 2)}%</strong></p>
                    <p>Susut Proses: <strong className="tabular-nums">{fmtNum(submitResult.susutProsesPctBps / 100, 2)}%</strong></p>
                    <p>Susut Hilang: <strong className="tabular-nums">{fmtNum(submitResult.susutHilangPctBps / 100, 2)}%</strong></p>
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT: Info LP (sidebar) ────────────────────────────── */}
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
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#059833]/10">
              <svg className="h-7 w-7 text-[#059833]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-700">Scan QR kartu atau cari nomor LP untuk mulai setoran.</p>
            <p className="mt-1 text-xs text-gray-500">Scanner mesin juga otomatis terbaca saat halaman ini terbuka.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Button onClick={() => setScanOpen(true)} className="h-9 bg-[#059833] px-4 text-sm hover:bg-[#047a29]">Scan QR</Button>
            </div>
          </div>
        )}

        {/* ── Confirmation Modal (Kalkulasi popup) ──────────────────── */}
        <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-800">Konfirmasi Setoran</DialogTitle>
              <DialogDescription>
                Periksa kembali hasil kalkulasi sebelum menyimpan setoran ini.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <div className="flex justify-between rounded-lg bg-emerald-50 px-4 py-3 border border-emerald-100">
                <span className="font-medium text-emerald-800">Total Barang Jadi</span>
                <span className="font-bold tabular-nums text-emerald-900">{fmtNum(totalBarangJadi, 2)} gr</span>
              </div>
              <div className="flex justify-between rounded-lg bg-indigo-50 px-4 py-3 border border-indigo-100">
                <span className="font-medium text-indigo-800">Rendemen Bersih</span>
                <span className="text-lg font-black tabular-nums text-indigo-900">{fmtNum(rendemenPct, 2)}%</span>
              </div>
              <div className="flex justify-between rounded-lg bg-amber-50 px-4 py-3 border border-amber-100">
                <span className="font-medium text-amber-800">Susut Proses</span>
                <span className="font-bold tabular-nums text-amber-900">{fmtNum(susutProsesPct, 2)}%</span>
              </div>
              <div className="flex justify-between rounded-lg bg-rose-50 px-4 py-3 border border-rose-100">
                <span className="font-medium text-rose-800">Susut Hilang</span>
                <span className="font-bold tabular-nums text-rose-900">{fmtNum(susutHilangPct, 2)}%</span>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
                Batal
              </Button>
              <Button
                className="bg-[#059833] hover:bg-[#047a29]"
                disabled={setoranSubmitting}
                onClick={() => {
                  setConfirmModalOpen(false);
                  void handleSubmitSetoran();
                }}
              >
                {setoranSubmitting ? 'Memproses...' : 'Ya, Simpan Setoran'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Success Result Popup Modal ──────────────────────────────── */}
        <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="text-center sm:text-left">
              <div className="mx-auto sm:mx-0 mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <DialogTitle className="text-xl font-bold text-gray-900">Setoran Berhasil Disimpan!</DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                LP <strong className="font-mono text-gray-900">{selectedEntry?.pecahBonId ?? '-'}</strong> • Pekerja: <strong className="text-gray-900">{workItem?.workerName ?? '-'}</strong>
              </DialogDescription>
            </DialogHeader>

            {submitResult && (
              <div className="space-y-4 py-2">
                {/* Metrik Persentase utama */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-center">
                    <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Rendemen Bersih</p>
                    <p className="text-2xl font-black text-emerald-900 tabular-nums">{fmtNum(submitResult.rendemenNetPctBps / 100, 2)}%</p>
                  </div>
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-3 text-center">
                    <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">Rendemen Utama</p>
                    <p className="text-2xl font-black text-indigo-900 tabular-nums">{fmtNum(submitResult.rendemenMainPctBps / 100, 2)}%</p>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-center">
                    <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Susut Proses</p>
                    <p className="text-xl font-bold text-amber-900 tabular-nums">{fmtNum(submitResult.susutProsesPctBps / 100, 2)}%</p>
                  </div>
                  <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-center">
                    <p className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Susut Hilang</p>
                    <p className="text-xl font-bold text-rose-900 tabular-nums">{fmtNum(submitResult.susutHilangPctBps / 100, 2)}%</p>
                  </div>
                </div>

                {/* Detail Berat Gram */}
                <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 divide-y divide-gray-200 text-xs">
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500">Berat Kering Awal</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{fmtNum(submitResult.dryInGram, 2)} gr</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500">Total Barang Jadi</span>
                    <span className="font-bold text-emerald-700 tabular-nums">{fmtNum(submitResult.mainOutGram, 2)} gr</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500">By Product</span>
                    <span className="font-semibold text-gray-900 tabular-nums">{fmtNum(submitResult.byProductGram, 2)} gr</span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="mt-2">
              <Button
                className="w-full bg-[#059833] hover:bg-[#047a29] font-semibold h-10 text-sm"
                onClick={() => {
                  setSuccessModalOpen(false);
                  setSelectedEntry(null);
                  setWorkItem(null);
                  setSubmitResult(null);
                  setLpDigits('');
                }}
              >
                Scan / Cari LP Berikutnya →
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Warning LP Sudah Disetor Modal ────────────────────────────── */}
        <Dialog open={alreadySubmittedModalOpen} onOpenChange={setAlreadySubmittedModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader className="text-center sm:text-left">
              <div className="mx-auto sm:mx-0 mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <DialogTitle className="text-xl font-bold text-gray-900">LP Sudah Disetor!</DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Nomor LP <strong className="font-mono text-gray-900">{selectedEntry?.pecahBonId ?? '-'}</strong> sudah pernah menyelesaikan proses setoran.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 leading-relaxed">
                <p className="font-semibold text-amber-900 mb-1">Status: SUDAH SETOR ✓</p>
                <p>Kartu LP ini telah diproses dan stok barang telah dimasukkan ke Rak Finished. Anda tidak perlu melakukan penimbangan atau setoran ulang untuk LP ini.</p>
              </div>

              {workItem && (
                <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 divide-y divide-gray-200 text-xs">
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500">Pekerja / Mitra</span>
                    <span className="font-semibold text-gray-900">{workItem.workerName ?? '-'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500">Grade / Jenis</span>
                    <span className="font-semibold text-gray-900">{gradeLabel}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-500">Berat Kering Awal</span>
                    <span className="font-bold text-gray-900 tabular-nums">{fmtNum(workItem.dryInGram, 2)} gr</span>
                  </div>
                  {workItem.submittedAt && (
                    <div className="flex justify-between py-1.5">
                      <span className="text-gray-500">Waktu Setor</span>
                      <span className="font-medium text-emerald-700">{workItem.submittedAt ? new Date(workItem.submittedAt).toLocaleString('id-ID') : '-'}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="mt-2">
              <Button
                className="w-full bg-[#059833] hover:bg-[#047a29] font-semibold h-10 text-sm"
                onClick={() => {
                  setAlreadySubmittedModalOpen(false);
                  setSelectedEntry(null);
                  setWorkItem(null);
                  setSubmitResult(null);
                  setLpDigits('');
                }}
              >
                Tutup & Scan LP Lain →
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageTransition>

      <QrScanModal open={scanOpen} onClose={() => setScanOpen(false)} onDetected={handleScan} />
    </div>
  );
}

export default function KoreksiDataPage() {
  return (
    <ProtectedRoute>
      <KoreksiDataContent />
    </ProtectedRoute>
  );
}
