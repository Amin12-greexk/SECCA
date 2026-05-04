'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Package, Pencil, Printer, RefreshCw } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/lib/toast';
import { getRawBatchByCardId, getRawBatchesPaginated, getSuppliers, mergeRawBatches, updateRawBatch, deleteRawBatch, type RawBatch, type Supplier } from '@/lib/api';
import BatchCard from '@/components/print/BatchCard';

const BATCHES_PER_PAGE = 20;

export function StockAsalContent({ embedded = false }: { embedded?: boolean }) {
    const toast = useToast();
    const [rawBatches, setRawBatches] = useState<RawBatch[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [supplierLoadError, setSupplierLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [batchPage, setBatchPage] = useState(1);
    const [batchTotalPages, setBatchTotalPages] = useState(1);
    const [batchTotal, setBatchTotal] = useState(0);
    const [printBatch, setPrintBatch] = useState<RawBatch | null>(null);
    const [printOpen, setPrintOpen] = useState(false);
    const [editBatch, setEditBatch] = useState<RawBatch | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [editSaving, setEditSaving] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [selectedRawBatchIds, setSelectedRawBatchIds] = useState<string[]>([]);
    const [mergeOpen, setMergeOpen] = useState(false);
    const [mergeSaving, setMergeSaving] = useState(false);
    const [mergeValues, setMergeValues] = useState({
        supplierId: '',
        featherCondition: '',
        moisturePercent: '',
        notes: '',
        confirmSupplier: false,
        confirmFeatherCondition: false,
        confirmMoisturePercent: false,
        confirmMerge: false,
    });
    const [editValues, setEditValues] = useState({
        batchNumber: '',
        supplierId: '',
        featherCondition: '',
        invoiceWeightGram: '',
        wetWeightGram: '',
        moisturePercent: '',
        notes: '',
    });
    const [updateExistingEntries, setUpdateExistingEntries] = useState(false);
    const [scanLoading, setScanLoading] = useState(false);
    const scanBufferRef = useRef('');
    const scanLastAtRef = useRef(0);

    const selectedBatches = useMemo(
        () => rawBatches.filter((item) => selectedRawBatchIds.includes(item.id)),
        [rawBatches, selectedRawBatchIds],
    );
    const mergeEligibleBatchIds = useMemo(
        () => rawBatches.filter((item) => item.wetWeightGram > 0).map((item) => item.id),
        [rawBatches],
    );
    const mergeTotalWetWeightGram = useMemo(
        () => selectedBatches.reduce((sum, item) => sum + item.wetWeightGram, 0),
        [selectedBatches],
    );
    const mergeSuggestedMoisturePercent = useMemo(() => {
        if (selectedBatches.length === 0 || mergeTotalWetWeightGram <= 0) return 0;
        const weightedSum = selectedBatches.reduce(
            (sum, item) => sum + item.wetWeightGram * item.moisturePercent,
            0,
        );
        return weightedSum / mergeTotalWetWeightGram;
    }, [selectedBatches, mergeTotalWetWeightGram]);

    const buildPrintOptions = () => {
        // Options for electron-secure-pos-printer library
        // BP Lite 80D1: 80mm paper, ~72mm printable area
        return {
            silent: true,
            preview: false, // Direct print
            margin: '0',
            pageSize: { width: 80000, height: 297000 },
            addFinalMargin: true,
            bodyAttributes: {
                style: 'width: 80mm !important; max-width: 80mm !important; margin: 0 !important; padding: 0 !important;',
            },
            containerAttributes: {
                style: 'width: 76mm !important; max-width: 76mm !important; margin: 0 auto !important; margin-left: -2mm !important; padding: 2mm !important;',
            },
            styleSheet: `
                @page {
                    size: 80mm auto;
                    margin: 0 !important;
                }
                * {
                    box-sizing: border-box !important;
                }
                html, body {
                    width: 80mm !important;
                    max-width: 80mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    font-family: Arial, Helvetica, sans-serif;
                    font-size: 10pt;
                }
                #container {
                    width: 76mm !important;
                    max-width: 76mm !important;
                    margin: 0 auto !important;
                    margin-left: -2mm !important;
                    padding: 2mm !important;
                    text-align: center !important;
                }
                #container .section {
                    width: 100% !important;
                    max-width: 72mm !important;
                    margin: 0 auto !important;
                    padding: 1mm 0 !important;
                    text-align: center !important;
                }
                img {
                    max-width: 100% !important;
                    display: block !important;
                    margin: 0 auto !important;
                }
            `,
        };
    };

    const buildBatchPrintData = (batch: RawBatch) => {
        const displayWeightGram = getDisplayWeight(batch);
        const supplierName = batch.supplier?.name ?? batch.supplierId;
        const dateStr = formatDate(batch.createdAt);

        return [
            {
                type: 'text',
                raw: true,
                value: `<div style="text-align:center;font-size:11pt;font-weight:bold;padding:1mm 0;">KARTU BAKU - TEI</div>`,
            },
            {
                type: 'qrCode',
                value: batch.cardId ?? batch.batchNumber,
                width: 80,
                height: 80,
                sectionStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1mm 0' },
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="border:1px solid #333;padding:1.5mm;font-size:8pt;width:100%;box-sizing:border-box;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5mm;">
                            <span style="font-weight:bold;">Batch No</span><span>${batch.batchNumber}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5mm;">
                            <span style="font-weight:bold;">Tgl Masuk</span><span>${dateStr}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5mm;">
                            <span style="font-weight:bold;">Supplier</span><span>${supplierName}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="font-weight:bold;">Grading</span><span>${batch.featherCondition}</span>
                        </div>
                    </div>
                `,
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="border:1.5px solid #000;padding:1.5mm;margin-top:1mm;text-align:center;width:100%;box-sizing:border-box;">
                        <div style="font-size:9pt;font-weight:bold;">BERAT: ${formatNumber(displayWeightGram, 2)} Gr</div>
                        <div style="font-size:9pt;font-weight:bold;">KADAR AIR: ${formatNumber(batch.moisturePercent, 1)}%</div>
                    </div>
                `,
            },
            {
                type: 'text',
                raw: true,
                value: `<div style="margin-top:2mm;border-top:1px dashed #000;width:100%;"></div>`,
            },
        ];
    };

    const handlePrint = async () => {
        if (!printBatch) {
            return;
        }

        // Try electron-secure-pos-printer first (preferred for thermal printers)
        if (typeof window !== 'undefined' && window.securePOSPrinter?.print) {
            try {
                const options = buildPrintOptions();
                const data = buildBatchPrintData(printBatch);
                await window.securePOSPrinter.print(data, options);
                toast.success('Berhasil mencetak kartu!');
                return;
            } catch (error) {
                console.error('Secure POS print failed.', error);
                await window.seccaDesktop?.log?.({
                    scope: 'stock-asal',
                    message: 'securePOSPrinter.print failed',
                    error: error instanceof Error ? error.message : String(error),
                });
                // Don't show error yet, try fallback
            }
        }

        // Fallback to seccaPrint (Electron webContents.print)
        if (typeof window !== 'undefined' && window.seccaPrint?.print) {
            try {
                await window.seccaPrint.print({
                    silent: true,
                    printBackground: true,
                    margins: { marginType: 'none' },
                    preferCSSPageSize: true,
                });
                toast.success('Berhasil mencetak kartu!');
                return;
            } catch (error) {
                console.error('Silent print failed.', error);
                await window.seccaDesktop?.log?.({
                    scope: 'stock-asal',
                    message: 'seccaPrint.print failed',
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        // If we reach here, no print method worked
        toast.error('Gagal cetak. Pastikan aplikasi desktop terpasang dan printer terhubung.');
    };

    const loadData = async (page = batchPage) => {
        setLoading(true);
        try {
            const response = await getRawBatchesPaginated({
                page,
                limit: BATCHES_PER_PAGE,
                activeOnly: false,
            });
            if (response.total > 0 && response.page > response.totalPages) {
                await loadData(response.totalPages);
                return;
            }
            const data = response.items;
            // Map rawBatchId to id for frontend compatibility
            const mapped = data.map((item: RawBatch & { rawBatchId?: string }) => ({
                ...item,
                id: item.rawBatchId ?? item.id,
            }));
            mapped.sort((left, right) => left.batchNumber.localeCompare(right.batchNumber));
            setRawBatches(mapped);
            setSelectedRawBatchIds((prev) =>
                prev.filter((id) => mapped.some((item) => item.id === id && item.wetWeightGram > 0)),
            );
            setBatchPage(response.page);
            setBatchTotalPages(response.totalPages);
            setBatchTotal(response.total);
        } catch (err) {
            console.error('Error loading raw batches:', err);
            toast.error('Gagal memuat data stock asal.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        async function loadSuppliers() {
            try {
                const supplierData = await getSuppliers();
                setSuppliers(supplierData);
            } catch (error) {
                console.error('Failed to load suppliers:', error);
                setSupplierLoadError('Gagal memuat daftar supplier.');
            }
        }

        loadSuppliers();
    }, []);

    const openPrintDialog = (batch: RawBatch) => {
        setPrintBatch(batch);
        setPrintOpen(true);
    };

    const openEditDialog = (batch: RawBatch) => {
        setEditBatch(batch);
        const arrivalWeight = batch.originalWetWeightGram ?? batch.wetWeightGram;
        setEditValues({
            batchNumber: batch.batchNumber ?? '',
            supplierId: batch.supplier?.id ?? batch.supplierId ?? '',
            featherCondition: batch.featherCondition ?? '',
            invoiceWeightGram: batch.invoiceWeightGram?.toString() ?? '',
            wetWeightGram: arrivalWeight?.toString() ?? '',
            moisturePercent: batch.moisturePercent?.toString() ?? '',
            notes: batch.notes ?? '',
        });
        setUpdateExistingEntries(false);
        setEditOpen(true);
    };

    const toggleSelectBatch = (batchId: string, checked: boolean) => {
        if (!mergeEligibleBatchIds.includes(batchId)) {
            return;
        }
        setSelectedRawBatchIds((prev) => {
            if (checked) {
                if (prev.includes(batchId)) return prev;
                return [...prev, batchId];
            }
            return prev.filter((id) => id !== batchId);
        });
    };

    const toggleSelectAllVisible = (checked: boolean) => {
        if (!checked) {
            setSelectedRawBatchIds([]);
            return;
        }
        setSelectedRawBatchIds(mergeEligibleBatchIds);
    };

    const openMergeDialog = () => {
        if (selectedBatches.length < 2) {
            toast.error('Pilih minimal 2 kartu untuk digabung.');
            return;
        }

        const first = selectedBatches[0];
        setMergeValues({
            supplierId: first?.supplier?.id ?? first?.supplierId ?? '',
            featherCondition: first?.featherCondition ?? '',
            moisturePercent: mergeSuggestedMoisturePercent.toFixed(2),
            notes: '',
            confirmSupplier: false,
            confirmFeatherCondition: false,
            confirmMoisturePercent: false,
            confirmMerge: false,
        });
        setMergeOpen(true);
    };

    const handleMergeSave = async () => {
        if (selectedBatches.length < 2) {
            toast.error('Pilih minimal 2 kartu untuk digabung.');
            return;
        }

        const supplierId = mergeValues.supplierId.trim();
        const featherCondition = mergeValues.featherCondition.trim();
        const moisturePercent = Number(mergeValues.moisturePercent);
        if (!supplierId) {
            toast.error('Supplier wajib dipilih.');
            return;
        }
        if (!featherCondition) {
            toast.error('Kondisi baku wajib diisi.');
            return;
        }
        if (!Number.isFinite(moisturePercent) || moisturePercent < 0 || moisturePercent > 100) {
            toast.error('Kadar air wajib diisi (0 - 100).');
            return;
        }

        if (
            !mergeValues.confirmSupplier ||
            !mergeValues.confirmFeatherCondition ||
            !mergeValues.confirmMoisturePercent ||
            !mergeValues.confirmMerge
        ) {
            toast.error('Semua konfirmasi merge wajib dicentang.');
            return;
        }

        setMergeSaving(true);
        try {
            const merged = await mergeRawBatches({
                sourceRawBatchIds: selectedBatches.map((item) => item.id),
                supplierId,
                featherCondition,
                moisturePercent,
                notes: mergeValues.notes.trim() || undefined,
                confirmSupplier: mergeValues.confirmSupplier,
                confirmFeatherCondition: mergeValues.confirmFeatherCondition,
                confirmMoisturePercent: mergeValues.confirmMoisturePercent,
                confirmMerge: mergeValues.confirmMerge,
            });

            toast.success(`Kartu berhasil digabung ke ${merged.batchNumber}.`);
            setMergeOpen(false);
            setSelectedRawBatchIds([]);
            await loadData(batchPage);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Gagal menggabungkan kartu.';
            toast.error(message);
        } finally {
            setMergeSaving(false);
        }
    };

    const handleEditSave = async () => {
        if (!editBatch) return;

        const trimmedBatch = editValues.batchNumber.trim();
        const trimmedCondition = editValues.featherCondition.trim();
        const trimmedNotes = editValues.notes.trim();

        const payload: {
            batchNumber?: string;
            supplierId?: string;
            featherCondition?: string;
            invoiceWeightGram?: number;
            wetWeightGram?: number;
            moisturePercent?: number;
            notes?: string;
            updateExistingEntries?: boolean;
        } = {};

        if (trimmedBatch && trimmedBatch !== editBatch.batchNumber) {
            payload.batchNumber = trimmedBatch;
        }

        if (editValues.supplierId && editValues.supplierId !== editBatch.supplierId) {
            payload.supplierId = editValues.supplierId;
        }

        if (trimmedCondition && trimmedCondition !== editBatch.featherCondition) {
            payload.featherCondition = trimmedCondition;
        }

        const invoice = Number(editValues.invoiceWeightGram);
        const wet = Number(editValues.wetWeightGram);
        const moisture = Number(editValues.moisturePercent);

        if (!Number.isFinite(invoice) || invoice <= 0) {
            toast.error('Berat nota wajib diisi (lebih dari 0).');
            return;
        }
        if (!Number.isFinite(wet) || wet <= 0) {
            toast.error('Berat kedatangan wajib diisi (lebih dari 0).');
            return;
        }
        if (!Number.isFinite(moisture) || moisture < 0 || moisture > 100) {
            toast.error('Kadar air wajib diisi (0 - 100).');
            return;
        }

        if (invoice !== editBatch.invoiceWeightGram) payload.invoiceWeightGram = invoice;
        
        const currentArrivalWeight = editBatch.originalWetWeightGram ?? editBatch.wetWeightGram;
        if (Math.abs(wet - currentArrivalWeight) > 0.0001) payload.wetWeightGram = wet;
        
        if (moisture !== editBatch.moisturePercent) payload.moisturePercent = moisture;

        if (trimmedNotes !== (editBatch.notes ?? '')) {
            payload.notes = trimmedNotes;
        }

        if (updateExistingEntries) {
            payload.updateExistingEntries = true;
        }

        if (Object.keys(payload).length === 0) {
            setEditOpen(false);
            return;
        }

        setEditSaving(true);
        try {
            await updateRawBatch(editBatch.id, payload);
            toast.success(
                updateExistingEntries
                    ? 'Data batch dan LP terkait berhasil diperbarui.'
                    : 'Data batch berhasil diperbarui.',
            );
            setEditOpen(false);
            await loadData(batchPage);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal memperbarui batch.';
            toast.error(message);
        } finally {
            setEditSaving(false);
        }
    };

    const handleDeleteBatch = async () => {
        if (!editBatch) return;

        const confirmText = `Apakah Anda yakin ingin menghapus kartu ${editBatch.batchNumber}? Semua data pecah bon terkait juga akan dihapus.`;
        if (!window.confirm(confirmText)) return;

        setDeleteLoading(true);
        try {
            await deleteRawBatch(editBatch.id);
            toast.success(`Kartu ${editBatch.batchNumber} berhasil dihapus.`);
            setEditOpen(false);
            await loadData(batchPage);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal menghapus batch.';
            toast.error(message);
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleScanOpen = async (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        if (scanLoading) return;

        setScanLoading(true);
        try {
            const parsed = parseScanPayload(trimmed);
            const cardId =
                (parsed && typeof parsed.cardId === 'string' && parsed.cardId) ||
                trimmed;

            const batch = await getRawBatchByCardId(cardId);
            openPrintDialog(batch);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal membaca data kartu.';
            toast.error(message);
        } finally {
            setScanLoading(false);
        }
    };

    const parseScanPayload = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;

        try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            return parsed;
        } catch {
            return null;
        }
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const tagName = target?.tagName?.toLowerCase();
            const isEditable =
                tagName === 'input' ||
                tagName === 'textarea' ||
                tagName === 'select' ||
                target?.isContentEditable;
            if (isEditable) return;

            const now = Date.now();
            if (now - scanLastAtRef.current > 300) {
                scanBufferRef.current = '';
            }
            scanLastAtRef.current = now;

            if (event.key === 'Enter') {
                const payload = scanBufferRef.current.trim();
                scanBufferRef.current = '';
                if (payload) {
                    handleScanOpen(payload);
                }
                return;
            }

            if (event.key.length === 1) {
                scanBufferRef.current += event.key;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [scanLoading]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    const formatNumber = (value: number, fractionDigits = 2) =>
        new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        }).format(value);

    const getDisplayWeight = (batch: RawBatch) =>
        batch.originalWetWeightGram ?? batch.wetWeightGram;

    const editOriginalWeight = editBatch
        ? editBatch.originalWetWeightGram ?? editBatch.wetWeightGram
        : 0;
    const editUsedWeight = editBatch ? editOriginalWeight - editBatch.wetWeightGram : 0;
    const editWeightLocked = editBatch ? editUsedWeight > 0.0001 : false;

    if (loading) {
        return (
            <div className={`${embedded ? 'py-10' : 'min-h-[calc(100vh-72px)]'} flex items-center justify-center`}>
                <div className="flex items-center gap-3 text-gray-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Memuat data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={embedded ? 'py-6' : 'min-h-[calc(100vh-72px)] bg-green-50 py-10 px-4'}>
            <div className={embedded ? 'w-full' : 'mx-auto max-w-6xl'}>
                <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-600/10">
                            <Package className="h-6 w-6 text-amber-700" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-semibold text-gray-900">Stock Asal</h1>
                            <p className="text-sm text-gray-600">
                                Daftar penerimaan bahan baku. Cetak kartu dari sini.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                            variant="outline"
                            onClick={openMergeDialog}
                            disabled={selectedRawBatchIds.length < 2}
                        >
                            Gabung Kartu ({selectedRawBatchIds.length})
                        </Button>
                        <Button variant="outline" onClick={() => loadData(batchPage)} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    {rawBatches.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                            <p className="text-lg font-medium">Belum ada data</p>
                            <p className="text-sm mt-1">Data penerimaan baku akan muncul di sini.</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    mergeEligibleBatchIds.length > 0 &&
                                                    selectedRawBatchIds.length === mergeEligibleBatchIds.length
                                                }
                                                onChange={(event) => toggleSelectAllVisible(event.target.checked)}
                                                aria-label="Pilih semua batch di halaman ini"
                                            />
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Batch
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Supplier
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Kondisi Baku
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Berat (gr)
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Kadar Air
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Catatan
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Tanggal
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {rawBatches.map((batch) => (
                                        <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRawBatchIds.includes(batch.id)}
                                                    onChange={(event) => toggleSelectBatch(batch.id, event.target.checked)}
                                                    disabled={batch.wetWeightGram <= 0}
                                                    aria-label={`Pilih ${batch.batchNumber}`}
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{batch.batchNumber}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-gray-900">{batch.supplier?.name ?? '-'}</div>
                                                {batch.supplier?.code && (
                                                    <div className="text-xs text-gray-500">{batch.supplier.code}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">
                                                {batch.featherCondition}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-900">
                                                {formatNumber(getDisplayWeight(batch))}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-900">
                                                {formatNumber(batch.moisturePercent, 1)}%
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                                                {batch.notes || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {formatDate(batch.createdAt)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openPrintDialog(batch)}
                                                    >
                                                        <Printer className="h-4 w-4" />
                                                        Cetak
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => openEditDialog(batch)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                        Edit
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                </table>
                            </div>
                            {batchTotalPages > 1 && (
                                <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                                    <span className="text-gray-600">
                                        Menampilkan {(batchPage - 1) * BATCHES_PER_PAGE + 1} - {Math.min(batchPage * BATCHES_PER_PAGE, batchTotal)} dari {batchTotal} batch
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => loadData(batchPage - 1)}
                                            disabled={batchPage <= 1 || loading}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Sebelumnya
                                        </Button>
                                        <span className="text-xs text-gray-600 tabular-nums">
                                            {batchPage} / {batchTotalPages}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => loadData(batchPage + 1)}
                                            disabled={batchPage >= batchTotalPages || loading}
                                        >
                                            Berikutnya
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Print Dialog */}
            <Dialog open={printOpen} onOpenChange={setPrintOpen}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Print Preview</DialogTitle>
                        <DialogDescription>
                            Kartu siap dicetak ke printer Blueprint Lite 80D1 (lebar 72mm).
                        </DialogDescription>
                    </DialogHeader>

                    {printBatch && (
                        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                            <div className="flex items-start justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
                                <BatchCard batch={printBatch} />
                            </div>
                            <div className="space-y-4">
                                <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Batch</span>
                                        <span className="font-semibold">{printBatch.batchNumber}</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Supplier</span>
                                        <span className="font-semibold">
                                            {printBatch.supplier?.name ?? printBatch.supplierId}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Berat</span>
                                        <span className="font-semibold">
                                            {formatNumber(getDisplayWeight(printBatch))} gr
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Kadar Air</span>
                                        <span className="font-semibold">
                                            {formatNumber(printBatch.moisturePercent, 1)}%
                                        </span>
                                    </div>
                                    {printBatch.notes && (
                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                            <span className="text-gray-500 block mb-1">Catatan:</span>
                                            <span className="text-gray-700">{printBatch.notes}</span>
                                        </div>
                                    )}
                                </div>

                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setPrintOpen(false)}>
                                        Tutup
                                    </Button>
                                    <Button onClick={handlePrint}>
                                        <Printer className="h-4 w-4" />
                                        Cetak Kartu
                                    </Button>
                                </DialogFooter>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Merge Dialog */}
            <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Gabung Kartu Baku</DialogTitle>
                        <DialogDescription>
                            Kartu sumber akan disembunyikan dari daftar, lalu dibuat kartu baru dengan nomor identitas baru.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                            <p className="font-medium text-gray-900">Ringkasan kartu sumber</p>
                            <p className="mt-1">
                                {selectedBatches.map((item) => item.batchNumber).join(', ') || '-'}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                                <span>Total sisa gram: <strong>{formatNumber(mergeTotalWetWeightGram)} gr</strong></span>
                                <span>Kadar air saran: <strong>{formatNumber(mergeSuggestedMoisturePercent, 2)}%</strong></span>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Supplier Baru</Label>
                                <Select
                                    value={mergeValues.supplierId}
                                    onValueChange={(value) =>
                                        setMergeValues((prev) => ({ ...prev, supplierId: value }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pilih supplier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map((supplier) => (
                                            <SelectItem key={supplier.id} value={supplier.id}>
                                                {supplier.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Kondisi Baku Baru</Label>
                                <Input
                                    value={mergeValues.featherCondition}
                                    onChange={(event) =>
                                        setMergeValues((prev) => ({ ...prev, featherCondition: event.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Kadar Air Baru (%)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.01"
                                    value={mergeValues.moisturePercent}
                                    onChange={(event) =>
                                        setMergeValues((prev) => ({ ...prev, moisturePercent: event.target.value }))
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Catatan Merge</Label>
                                <Textarea
                                    value={mergeValues.notes}
                                    onChange={(event) =>
                                        setMergeValues((prev) => ({ ...prev, notes: event.target.value }))
                                    }
                                    placeholder="Opsional"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={mergeValues.confirmSupplier}
                                    onChange={(event) =>
                                        setMergeValues((prev) => ({ ...prev, confirmSupplier: event.target.checked }))
                                    }
                                />
                                Konfirmasi supplier sudah benar
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={mergeValues.confirmFeatherCondition}
                                    onChange={(event) =>
                                        setMergeValues((prev) => ({ ...prev, confirmFeatherCondition: event.target.checked }))
                                    }
                                />
                                Konfirmasi kondisi baku sudah benar
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={mergeValues.confirmMoisturePercent}
                                    onChange={(event) =>
                                        setMergeValues((prev) => ({ ...prev, confirmMoisturePercent: event.target.checked }))
                                    }
                                />
                                Konfirmasi kadar air sudah benar
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={mergeValues.confirmMerge}
                                    onChange={(event) =>
                                        setMergeValues((prev) => ({ ...prev, confirmMerge: event.target.checked }))
                                    }
                                />
                                Konfirmasi proses merge dan sembunyikan kartu sumber
                            </label>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setMergeOpen(false)} disabled={mergeSaving}>
                                Batal
                            </Button>
                            <Button onClick={handleMergeSave} disabled={mergeSaving}>
                                {mergeSaving ? 'Menggabungkan...' : 'Gabung Kartu'}
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Edit Stock Asal</DialogTitle>
                        <DialogDescription>
                            Perbaiki data batch jika ada kesalahan input.
                        </DialogDescription>
                    </DialogHeader>

                    {editBatch && (
                        <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Batch Number</Label>
                                    <Input
                                        value={editValues.batchNumber}
                                        onChange={(e) =>
                                            setEditValues((prev) => ({ ...prev, batchNumber: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Supplier</Label>
                                    {supplierLoadError ? (
                                        <Input
                                            value={editValues.supplierId}
                                            onChange={(e) =>
                                                setEditValues((prev) => ({ ...prev, supplierId: e.target.value }))
                                            }
                                        />
                                    ) : (
                                        <Select
                                            value={editValues.supplierId}
                                            onValueChange={(value) =>
                                                setEditValues((prev) => ({ ...prev, supplierId: value }))
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pilih supplier" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {suppliers.map((supplier) => (
                                                    <SelectItem key={supplier.id} value={supplier.id}>
                                                        {supplier.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {supplierLoadError && (
                                        <p className="text-xs text-amber-600">{supplierLoadError}</p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Kondisi Baku</Label>
                                <Input
                                    value={editValues.featherCondition}
                                    onChange={(e) =>
                                        setEditValues((prev) => ({ ...prev, featherCondition: e.target.value }))
                                    }
                                />
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>Berat Nota (gr)</Label>
                                    <Input
                                        type="number"
                                        min={0.1}
                                        step="0.01"
                                        value={editValues.invoiceWeightGram}
                                        onChange={(e) =>
                                            setEditValues((prev) => ({ ...prev, invoiceWeightGram: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Berat Kedatangan (gr)</Label>
                                    <Input
                                        type="number"
                                        min={0.1}
                                        step="0.01"
                                        value={editValues.wetWeightGram}
                                        onChange={(e) =>
                                            setEditValues((prev) => ({ ...prev, wetWeightGram: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Kadar Air (%)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step="0.1"
                                        value={editValues.moisturePercent}
                                        onChange={(e) =>
                                            setEditValues((prev) => ({ ...prev, moisturePercent: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>

                            {editBatch && Number(editValues.moisturePercent) !== editBatch.moisturePercent && (
                                <div className="flex items-center space-x-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                                    <input
                                        type="checkbox"
                                        id="updateExistingEntries"
                                        checked={updateExistingEntries}
                                        onChange={(e) => setUpdateExistingEntries(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <Label htmlFor="updateExistingEntries" className="text-sm font-medium text-blue-700 cursor-pointer">
                                        Update kadar air di semua LP pecah bon terkait?
                                    </Label>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Catatan</Label>
                                <Textarea
                                    value={editValues.notes}
                                    onChange={(e) =>
                                        setEditValues((prev) => ({ ...prev, notes: e.target.value }))
                                    }
                                />
                            </div>

                            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                                <Button
                                    variant="destructive"
                                    onClick={handleDeleteBatch}
                                    disabled={deleteLoading || editSaving}
                                >
                                    {deleteLoading ? 'Menghapus...' : 'Hapus Kartu'}
                                </Button>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving || deleteLoading}>
                                        Batal
                                    </Button>
                                    <Button onClick={handleEditSave} disabled={editSaving || deleteLoading}>
                                        {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                                    </Button>
                                </div>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </div>
    );
}

export default function StockAsalPage() {
    return (
        <ProtectedRoute allowedRoles={['baku', 'manager']}>
            <StockAsalContent />
        </ProtectedRoute>
    );
}

