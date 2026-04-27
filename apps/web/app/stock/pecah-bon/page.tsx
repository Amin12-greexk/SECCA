'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Camera, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, Plus, Printer, RefreshCw, Scissors, X, Copy, Trash2, CheckCircle2 } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
    approveMitraOrderRequest,
    getRawBatchesPaginated,
    getGrades,
    createPecahBon,
    fulfillMitraOrderRequest,
    getPecahBonEntries,
    getPecahBonEntriesPaginated,
    getPecahBonById,
    getMitraOrderRequests,
    updatePecahBonEntry,
    markPecahBonPrinted,
    deletePecahBonEntry,
    type RawBatch,
    type Grade,
    type MitraOrderRequest,
    type PecahBonEntry,
} from '@/lib/api';
import PecahBonCard from '@/components/print/PecahBonCard';
import { gsap } from 'gsap';

const pecahBonSchema = z.object({
    gradeId: z.string().min(1, 'Grade bentuk wajib dipilih'),
    featherGradeId: z.string().min(1, 'Grade bulu wajib dipilih'),
    colorGradeId: z.string().min(1, 'Grade warna wajib dipilih'),
    featherCondition: z.string().min(1, 'Kondisi bulu wajib diisi'),
    pieceCount: z.number().int().min(1, 'Minimal 1 keping'),
    initialWeightGram: z.number().min(0.1, 'Minimal 0.1 gram'),
    moisturePercent: z.number().min(0, 'Minimal 0%').max(100, 'Maksimal 100%'),
});

type PecahBonFormValues = z.infer<typeof pecahBonSchema>;

// Pagination constant for entries display
const ENTRIES_PER_PAGE = 20;
const BATCHES_PER_PAGE = 20;

interface BatchWithEntries extends RawBatch {
    pecahBonEntries?: PecahBonEntry[];
    entriesLoading?: boolean;
    expanded?: boolean;
    entriesPage?: number;
    entriesTotal?: number;
    entriesTotalPages?: number;
}

// Multi-entry row for bulk pecah bon
interface MultiEntryRow {
    id: string;
    gradeId: string;
    featherGradeId: string;
    colorGradeId: string;
    pieceCount: number | '';
    initialWeightGram: number | '';
    moisturePercent: number | '';
}

type DetectedBarcodeLike = {
    rawValue?: string;
};

type BarcodeDetectorLike = {
    detect: (source: unknown) => Promise<DetectedBarcodeLike[]>;
};

type BarcodeDetectorCtorLike = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

// Generate simple unique ID
const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

const createEmptyRow = (
    overrides: Partial<Omit<MultiEntryRow, 'id'>> = {}
): MultiEntryRow => ({
    id: generateId(),
    gradeId: '',
    featherGradeId: '',
    colorGradeId: '',
    pieceCount: '',
    initialWeightGram: '',
    moisturePercent: '',
    ...overrides,
});


export function PecahBonContent({ embedded = false }: { embedded?: boolean }) {
    const toast = useToast();
    const preferDocumentPrint = false;
    const preferDocumentPrintSetoran = false;
    const [rawBatches, setRawBatches] = useState<BatchWithEntries[]>([]);
    const [batchPage, setBatchPage] = useState(1);
    const [batchTotalPages, setBatchTotalPages] = useState(1);
    const [batchTotal, setBatchTotal] = useState(0);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [trainerOrderTemplates, setTrainerOrderTemplates] = useState<MitraOrderRequest[]>([]);
    const [pendingTrainerOrders, setPendingTrainerOrders] = useState<MitraOrderRequest[]>([]);
    const [orderActionLoadingId, setOrderActionLoadingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedBatch, setSelectedBatch] = useState<BatchWithEntries | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [printContext, setPrintContext] = useState<{
        batch: BatchWithEntries;
        entry: PecahBonEntry;
    } | null>(null);
    const [printOpen, setPrintOpen] = useState(false);
    const [setoranContext, setSetoranContext] = useState<{
        batch: BatchWithEntries;
        entry: PecahBonEntry;
    } | null>(null);
    const [setoranOpen, setSetoranOpen] = useState(false);
    const [selectedEntryIds, setSelectedEntryIds] = useState<Record<string, string[]>>({});
    const [editEntry, setEditEntry] = useState<PecahBonEntry | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [editSaving, setEditSaving] = useState(false);
    const [editValues, setEditValues] = useState({
        gradeId: '',
        featherGradeId: '',
        colorGradeId: '',
        pieceCount: '',
        initialWeightGram: '',
        moisturePercent: '',
        featherCondition: '',
    });
    const [, setScanLoading] = useState(false);
    const scanBufferRef = useRef('');
    const scanLastAtRef = useRef(0);
    const [cameraScanOpen, setCameraScanOpen] = useState(false);
    const [cameraScanStarting, setCameraScanStarting] = useState(false);
    const [cameraScanError, setCameraScanError] = useState<string | null>(null);
    const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const cameraLoopRef = useRef<number | null>(null);
    const cameraDetectorRef = useRef<BarcodeDetectorLike | null>(null);
    const cameraDetectingRef = useRef(false);
    const cameraLastPayloadRef = useRef('');
    const cameraLastAtRef = useRef(0);
    const scanOpenHandlerRef = useRef<(value: string) => Promise<boolean>>(async () => false);
    const [lpDigits, setLpDigits] = useState('');
    const [yearSuffix, setYearSuffix] = useState(String(new Date().getFullYear()).slice(-2));
    const [searchLoading, setSearchLoading] = useState(false);
    const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

    // Multi-entry state for bulk pecah bon
    const [multiEntries, setMultiEntries] = useState<MultiEntryRow[]>([]);
    const [selectedTemplateRequestId, setSelectedTemplateRequestId] = useState('NONE');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [syncFields, setSyncFields] = useState({
        gradeId: false,
        featherGradeId: false,
        colorGradeId: false,
        pieceCount: false,
        initialWeightGram: false,
        moisturePercent: false,
    });

    const shapeGrades = useMemo(() => grades.filter((grade) => grade.type === 'BENTUK'), [grades]);
    const featherGrades = useMemo(() => grades.filter((grade) => grade.type === 'BULU'), [grades]);
    const colorGrades = useMemo(() => grades.filter((grade) => grade.type === 'WARNA'), [grades]);
    const selectedTrainerTemplate = useMemo(
        () =>
            selectedTemplateRequestId === 'NONE'
                ? null
                : trainerOrderTemplates.find((item) => item.id === selectedTemplateRequestId) ?? null,
        [selectedTemplateRequestId, trainerOrderTemplates]
    );
    const normalizeLpDigits = (value: string) => value.replace(/\D/g, '').slice(0, 4);
    const normalizeYearSuffix = (value: string) => value.replace(/\D/g, '').slice(0, 2);
    const formatTemplateLines = (request: MitraOrderRequest) =>
        (request.lines ?? [])
            .map((line) => `${line.weightGram}g x ${line.lpCount} LP`)
            .join(' | ');

    // Multi-entry handlers
    const addEntry = () => {
        setMultiEntries((prev) => {
            const newRow = createEmptyRow();
            const firstRow = prev[0];
            if (firstRow) {
                if (syncFields.gradeId) newRow.gradeId = firstRow.gradeId;
                if (syncFields.featherGradeId) newRow.featherGradeId = firstRow.featherGradeId;
                if (syncFields.colorGradeId) newRow.colorGradeId = firstRow.colorGradeId;
                if (syncFields.pieceCount) newRow.pieceCount = firstRow.pieceCount;
                if (syncFields.initialWeightGram) newRow.initialWeightGram = firstRow.initialWeightGram;
                if (syncFields.moisturePercent) newRow.moisturePercent = firstRow.moisturePercent;
            }
            return [...prev, newRow];
        });
    };


    const removeEntry = (id: string) => {
        setMultiEntries(prev => prev.filter(row => row.id !== id));
    };

    const updateEntry = (id: string, field: keyof MultiEntryRow, value: string | number) => {
        setMultiEntries((prev) => {
            const updated = prev.map((row) =>
                row.id === id ? { ...row, [field]: value } : row
            );
            const firstRow = updated[0];
            if (!firstRow) return updated;
            if (firstRow.id !== id) return updated;
            if (!syncFields[field as keyof typeof syncFields]) return updated;
            return updated.map((row, idx) => (idx === 0 ? row : { ...row, [field]: value }));
        });
    };

    const duplicateEntry = (id: string) => {
        const source = multiEntries.find(row => row.id === id);
        if (source) {
            const newRow: MultiEntryRow = {
                ...source,
                id: generateId(),
            };
            const index = multiEntries.findIndex(row => row.id === id);
            setMultiEntries(prev => [
                ...prev.slice(0, index + 1),
                newRow,
                ...prev.slice(index + 1),
            ]);
        }
    };

    const handleSyncChange = (field: keyof typeof syncFields, checked: boolean) => {
        setSyncFields((prev) => ({ ...prev, [field]: checked }));
        if (!checked) return;
        setMultiEntries((prev) => {
            const firstRow = prev[0];
            if (!firstRow) return prev;
            return prev.map((row, idx) => (idx === 0 ? row : { ...row, [field]: firstRow[field as keyof MultiEntryRow] }));
        });
    };

    const applyTemplateToRows = (requestId: string) => {
        if (requestId === 'NONE') {
            setSelectedTemplateRequestId('NONE');
            setSyncFields({
                gradeId: false,
                featherGradeId: false,
                colorGradeId: false,
                pieceCount: false,
                initialWeightGram: false,
                moisturePercent: false,
            });
            return;
        }

        const template = trainerOrderTemplates.find((request) => request.id === requestId);
        if (!template) {
            toast.error('Template order tidak ditemukan.');
            return;
        }

        const lines = template.lines ?? [];
        if (lines.length === 0) {
            toast.error('Template order ini belum memiliki rincian LP.');
            return;
        }

        const totalLp = lines.reduce((sum, line) => sum + line.lpCount, 0);
        if (totalLp > 200) {
            toast.error('Template terlalu besar. Maksimal 200 LP per batch input.');
            return;
        }

        const rows: MultiEntryRow[] = [];
        lines.forEach((line) => {
            for (let index = 0; index < line.lpCount; index += 1) {
                rows.push(
                    createEmptyRow({
                        initialWeightGram: line.weightGram,
                        pieceCount: 1,
                        moisturePercent: selectedBatch?.moisturePercent ?? '',
                    })
                );
            }
        });

        setSelectedTemplateRequestId(requestId);
        setSyncFields({
            gradeId: true,
            featherGradeId: true,
            colorGradeId: true,
            pieceCount: false,
            initialWeightGram: false,
            moisturePercent: false,
        });
        setMultiEntries(rows.length > 0 ? rows : [createEmptyRow()]);
        toast.success(`Template trainer diterapkan (${totalLp} LP).`);
    };

    const handleApproveTrainerOrder = async (requestId: string) => {
        setOrderActionLoadingId(requestId);
        try {
            const approved = await approveMitraOrderRequest(requestId);
            toast.success('Order trainer disetujui. Template siap digunakan di Pecah Bon.');

            setPendingTrainerOrders((prev) => prev.filter((item) => item.id !== requestId));
            setTrainerOrderTemplates((prev) => [approved, ...prev.filter((item) => item.id !== requestId)]);

            if (selectedBatch && dialogOpen) {
                applyTemplateToRows(approved.id);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menyetujui order trainer.');
        } finally {
            setOrderActionLoadingId(null);
        }
    };

    const flashRow = (rowId: string) => {
        if (typeof window === 'undefined') return;
        const row = document.getElementById(`pecah-row-${rowId}`);
        if (!row) return;
        gsap.fromTo(
            row,
            { backgroundColor: '#ecfdf3' },
            {
                backgroundColor: 'transparent',
                duration: 0.6,
                ease: 'power2.out',
                clearProps: 'backgroundColor',
            }
        );
    };

    const clearHighlightIfActive = (entryId: string) => {
        setHighlightedEntryId((current) => (current === entryId ? null : current));
    };

    const buildPrintOptions = () => {
        return {
            silent: true,
            preview: false,
            margin: '0',
            pageSize: { width: 80000, height: 297000 },
            addFinalMargin: true,
            bodyAttributes: {
                style: 'width: 80mm !important; max-width: 80mm !important; margin: 0 !important; padding: 0 !important;',
            },
            containerAttributes: {
                style: 'width: 76mm !important; max-width: 76mm !important; margin: 0 auto !important; margin-left: -2mm !important; padding: 0 !important;',
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
                    font-size: 11pt;
                }
                #container {
                    width: 76mm !important;
                    max-width: 76mm !important;
                    margin: 0 auto !important;
                    margin-left: -2mm !important;
                    padding: 0 !important;
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

    const buildPecahBonPrintData = (batch: BatchWithEntries, entry: PecahBonEntry) => {
        const dateStr = formatDate(entry.pecahBonDate);
        const gradeDisplay = `${entry.grade?.code ?? '-'} / ${entry.featherGrade?.code ?? '-'} / ${entry.colorGrade?.code ?? '-'}`;
        return [
            {
                type: 'text',
                raw: true,
                value: `<div style="text-align:center;font-size:12pt;font-weight:bold;padding:1mm 0;">KARTU PECAH BON - TEI</div>`,
            },
            {
                type: 'qrCode',
                value: entry.pecahBonId || batch.batchNumber,
                width: 80,
                height: 80,
                sectionStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1mm 0' },
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="border:1px solid #333;padding:1.5mm;font-size:9pt;width:100%;box-sizing:border-box;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5mm;">
                            <span style="font-weight:bold;">ID Pecah</span><span>${entry.pecahBonId ?? '-'}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5mm;">
                            <span style="font-weight:bold;">Batch No</span><span>${batch.batchNumber}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="font-weight:bold;">Tgl Pecah</span><span>${dateStr}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-top:0.5mm;">
                            <span style="font-weight:bold;">Grade</span><span>${gradeDisplay}</span>
                        </div>
                    </div>
                `,
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="border:1.5px solid #000;padding:1.5mm;margin-top:1mm;text-align:center;width:100%;box-sizing:border-box;">
                        <div style="font-size:10pt;font-weight:bold;">BERAT: ${formatNumber(entry.initialWeightGram, 2)} Gr</div>
                        <div style="font-size:10pt;font-weight:bold;">KADAR AIR: ${formatNumber(entry.moisturePercent, 1)}%</div>
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

    const buildSetoranPrintData = (batch: BatchWithEntries, entry: PecahBonEntry) => {
        const dateStr = formatDate(entry.pecahBonDate);
        const gradeCode = `${entry.grade?.code ?? '-'} / ${entry.featherGrade?.code ?? '-'} / ${entry.colorGrade?.code ?? '-'}`;
        const pieceCount = entry.pieceCount;
        const wetWeight = formatNumber(entry.initialWeightGram, 2);
        const moisture = formatNumber(entry.moisturePercent, 1);
        const dryWeight = formatNumber(entry.dryWeightGram, 2);

        return [
            {
                type: 'text',
                raw: true,
                value: `<div style="text-align:center;font-size:11pt;font-weight:700;padding:0.5mm 0;border-bottom:1px solid #000;">SETORAN</div>`,
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="font-size:7pt;font-weight:600;line-height:1.2;padding:0.4mm 0;width:100%;max-width:72mm;margin:0 auto;">
                        <table style="width:100%;border-collapse:collapse;">
                            <tr>
                                <td style="padding:0.1mm 0;width:52%;">NAMA: TEI</td>
                                <td style="padding:0.1mm 0;width:48%;">GRADE: ${gradeCode}</td>
                            </tr>
                            <tr>
                                <td style="padding:0.1mm 0;">TGL: ${dateStr.split(',')[0]}</td>
                                <td style="padding:0.1mm 0;">BIJI: ${pieceCount} kpg</td>
                            </tr>
                            <tr>
                                <td style="padding:0.1mm 0;">NO LP: ${entry.pecahBonId ?? '-'}</td>
                                <td style="padding:0.1mm 0;">B.BASAH: ${wetWeight}g</td>
                            </tr>
                            <tr>
                                <td style="padding:0.1mm 0;">KARTU: ${batch.batchNumber}</td>
                                <td style="padding:0.1mm 0;">K.AIR: ${moisture}%</td>
                            </tr>
                        </table>
                    </div>
                `,
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="margin:0.5mm auto;width:100%;max-width:72mm;">
                        <table style="width:100%;border-collapse:collapse;font-size:7pt;font-weight:600;border:1px solid #000;">
                            <tr style="background:#ddd;">
                                <td style="border:1px solid #000;padding:0.2mm;width:50%;"></td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:center;width:15%;">BIJI</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:center;width:35%;">GRAM</td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:0.2mm;font-size:8pt;">BERAT KERING</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:center;">${pieceCount}</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:center;">${dryWeight}</td>
                            </tr>
                        </table>
                    </div>
                `,
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="margin:0.5mm auto;width:100%;max-width:72mm;">
                        <table style="width:100%;border-collapse:collapse;font-size:7pt;font-weight:600;border:1px solid #000;">
                            <tr style="background:#ff9;">
                                <td style="border:1px solid #000;padding:0.2mm;font-size:8pt;" colspan="2">HASIL JADI:</td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;width:35%;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:0.2mm;">HANCURAN</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:0.2mm;">SESEKAN</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:0.2mm;">KAKI</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:0.2mm;">LAIN-LAIN</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                        </table>
                    </div>
                `,
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="margin:0.5mm auto;width:100%;max-width:72mm;">
                        <table style="width:100%;border-collapse:collapse;font-size:7pt;font-weight:600;border:1px solid #000;">
                            <tr style="background:#ddd;">
                                <td style="border:1px solid #000;padding:0.2mm;width:65%;font-size:8pt;">TOTAL BARANG JADI</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;width:35%;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:0.2mm;">HILANG/SUSUT</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                            <tr style="background:#ddd;">
                                <td style="border:1px solid #000;padding:0.2mm;">SUSUT PROSES</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                        </table>
                    </div>
                `,
            },
            {
                type: 'text',
                raw: true,
                value: `<div style="margin-top:1mm;border-top:1px dashed #000;"></div>`,
            },
        ];
    };

    const handlePrint = async () => {
        if (!printContext) return;

        if (preferDocumentPrint && typeof window !== 'undefined' && window.seccaPrint?.print) {
            try {
                await window.seccaPrint.print({
                    silent: true,
                    printBackground: true,
                    margins: { marginType: 'none' },
                    preferCSSPageSize: true,
                });
                await markPecahBonPrinted(printContext.entry.id).catch((err) => {
                    console.error('Failed to mark printed:', err);
                });
                toast.success('Berhasil mencetak kartu!');
                return;
            } catch (error) {
                console.error('[SECCA] seccaPrint.print failed:', error);
                await window.seccaDesktop?.log?.({
                    scope: 'pecah-bon',
                    message: 'seccaPrint.print failed (document)',
                    error: error instanceof Error ? error.message : String(error),
                });
                toast.error('Gagal cetak (document): ' + (error instanceof Error ? error.message : String(error)));
                return;
            }
        }

        if (typeof window !== 'undefined' && window.securePOSPrinter?.print) {
            try {
                const options = buildPrintOptions();
                const data = buildPecahBonPrintData(printContext.batch, printContext.entry);
                await window.securePOSPrinter.print(data, options);
                await markPecahBonPrinted(printContext.entry.id).catch((err) => {
                    console.error('Failed to mark printed:', err);
                });
                toast.success('Berhasil mencetak kartu!');
                return;
            } catch (error) {
                console.error('[SECCA] securePOSPrinter.print failed:', error);
                await window.seccaDesktop?.log?.({
                    scope: 'pecah-bon',
                    message: 'securePOSPrinter.print failed',
                    error: error instanceof Error ? error.message : String(error),
                });
                toast.error('securePOSPrinter gagal: ' + (error instanceof Error ? error.message : String(error)));
                return;
            }
        }

        if (typeof window !== 'undefined' && window.seccaPrint?.print) {
            try {
                await window.seccaPrint.print({
                    silent: true,
                    printBackground: true,
                    margins: { marginType: 'none' },
                    preferCSSPageSize: true,
                });
                await markPecahBonPrinted(printContext.entry.id).catch((err) => {
                    console.error('Failed to mark printed:', err);
                });
                toast.success('Berhasil mencetak kartu!');
                return;
            } catch (error) {
                console.error('[SECCA] seccaPrint.print failed:', error);
                await window.seccaDesktop?.log?.({
                    scope: 'pecah-bon',
                    message: 'seccaPrint.print failed',
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        toast.error('Gagal cetak. Pastikan aplikasi desktop terpasang dan printer terhubung.');
    };

    const handlePrintSetoran = async (batch: BatchWithEntries, entry: PecahBonEntry) => {
        if (preferDocumentPrintSetoran && typeof window !== 'undefined' && window.seccaPrint?.print) {
            try {
                await window.seccaPrint.print({
                    silent: true,
                    printBackground: true,
                    margins: { marginType: 'none' },
                    preferCSSPageSize: true,
                });
                toast.success('Berhasil mencetak setoran!');
                return;
            } catch (error) {
                console.error('[SECCA] seccaPrint.print failed:', error);
                await window.seccaDesktop?.log?.({
                    scope: 'setoran',
                    message: 'seccaPrint.print failed (document)',
                    error: error instanceof Error ? error.message : String(error),
                });
                toast.error('Gagal cetak (document): ' + (error instanceof Error ? error.message : String(error)));
                return;
            }
        }

        if (typeof window !== 'undefined' && window.securePOSPrinter?.print) {
            try {
                const options = buildPrintOptions();
                const data = buildSetoranPrintData(batch, entry);
                await window.securePOSPrinter.print(data, options);
                toast.success('Berhasil mencetak setoran!');
                return;
            } catch (error) {
                console.error('[SECCA] securePOSPrinter.print failed:', error);
                await window.seccaDesktop?.log?.({
                    scope: 'setoran',
                    message: 'securePOSPrinter.print failed',
                    error: error instanceof Error ? error.message : String(error),
                });
                toast.error('securePOSPrinter gagal: ' + (error instanceof Error ? error.message : String(error)));
                return;
            }
        }

        toast.error('Gagal cetak. Pastikan aplikasi desktop terpasang dan printer terhubung.');
    };

    const form = useForm<PecahBonFormValues>({
        resolver: zodResolver(pecahBonSchema),
        mode: 'onChange',
        defaultValues: {
            gradeId: '',
            featherGradeId: '',
            colorGradeId: '',
            featherCondition: '',
            pieceCount: 1,
            initialWeightGram: 0,
            moisturePercent: 0,
        },
    });

    const loadData = async (page = batchPage, options?: { withGrades?: boolean; withTemplates?: boolean }) => {
        setLoading(true);
        try {
            const shouldLoadGrades = options?.withGrades ?? grades.length === 0;
            const shouldLoadTemplates = options?.withTemplates ?? trainerOrderTemplates.length === 0;
            const [batchResponse, gradeData, templateData, pendingTemplateData] = await Promise.all([
                getRawBatchesPaginated({
                    page,
                    limit: BATCHES_PER_PAGE,
                    activeOnly: true,
                }),
                shouldLoadGrades ? getGrades() : Promise.resolve(grades),
                shouldLoadTemplates
                    ? getMitraOrderRequests({
                        status: 'APPROVED',
                        requestedByRole: 'TRAINER',
                        aggregateOnly: true,
                        limit: 200,
                    })
                    : Promise.resolve(trainerOrderTemplates),
                getMitraOrderRequests({
                    status: 'REQUESTED',
                    requestedByRole: 'TRAINER',
                    aggregateOnly: true,
                    limit: 200,
                }),
            ]);
            if (batchResponse.total > 0 && batchResponse.page > batchResponse.totalPages) {
                await loadData(batchResponse.totalPages, options);
                return;
            }
            const mapped = batchResponse.items.map((item: RawBatch & { rawBatchId?: string }) => ({
                ...item,
                id: item.rawBatchId ?? item.id,
                expanded: false,
                pecahBonEntries: undefined,
                entriesLoading: false,
                entriesPage: 1,
                entriesTotal: 0,
                entriesTotalPages: 1,
            }));
            mapped.sort((left, right) =>
                left.batchNumber.localeCompare(right.batchNumber),
            );
            setRawBatches(mapped);
            if (shouldLoadGrades) {
                setGrades(gradeData);
            }
            if (shouldLoadTemplates) {
                setTrainerOrderTemplates(templateData);
            }
            setPendingTrainerOrders(pendingTemplateData);
            setBatchPage(batchResponse.page);
            setBatchTotalPages(batchResponse.totalPages);
            setBatchTotal(batchResponse.total);
        } catch (err) {
            console.error('Error loading data:', err);
            toast.error('Gagal memuat data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData(1, { withGrades: true, withTemplates: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadEntriesPage = async (batchId: string, page: number) => {
        setRawBatches((prev) =>
            prev.map((b) =>
                b.id === batchId ? { ...b, entriesLoading: true, expanded: true } : b
            )
        );

        try {
            const response = await getPecahBonEntriesPaginated(batchId, {
                page,
                limit: ENTRIES_PER_PAGE,
            });
            setRawBatches((prev) =>
                prev.map((b) =>
                    b.id === batchId
                        ? {
                            ...b,
                            pecahBonEntries: response.items,
                            entriesLoading: false,
                            entriesPage: response.page,
                            entriesTotal: response.total,
                            entriesTotalPages: response.totalPages,
                            expanded: true,
                        }
                        : b
                )
            );
        } catch (err) {
            console.error('Error loading pecah bon entries:', err);
            toast.error('Gagal memuat pecah bon entries.');
            setRawBatches((prev) =>
                prev.map((b) =>
                    b.id === batchId ? { ...b, entriesLoading: false } : b
                )
            );
        }
    };

    const toggleExpand = async (batchId: string) => {
        const batchIndex = rawBatches.findIndex((b) => b.id === batchId);
        if (batchIndex === -1) return;

        const batch = rawBatches[batchIndex];

        if (batch.expanded) {
            setRawBatches((prev) =>
                prev.map((b) => (b.id === batchId ? { ...b, expanded: false } : b))
            );
        } else {
            if (!batch.pecahBonEntries) {
                await loadEntriesPage(batchId, 1);
            } else {
                setRawBatches((prev) =>
                    prev.map((b) => (b.id === batchId ? { ...b, expanded: true } : b))
                );
            }
        }
    };

    const openPecahBonDialog = (batch: BatchWithEntries) => {
        setSelectedBatch(batch);
        setSelectedTemplateRequestId('NONE');
        setMultiEntries([
            createEmptyRow({
                moisturePercent: batch.moisturePercent,
            }),
        ]);
        form.reset({
            gradeId: '',
            featherGradeId: '',
            colorGradeId: '',
            featherCondition: batch.featherCondition,
            pieceCount: 1,
            initialWeightGram: 0,
            moisturePercent: batch.moisturePercent,
        });
        setDialogOpen(true);
    };

    const openPrintDialog = (batch: BatchWithEntries, entry: PecahBonEntry) => {
        clearHighlightIfActive(entry.id);
        setPrintContext({ batch, entry });
        setPrintOpen(true);
    };

    const openEditDialog = (entry: PecahBonEntry) => {
        clearHighlightIfActive(entry.id);
        setEditEntry(entry);
        setEditValues({
            gradeId: entry.gradeId,
            featherGradeId: entry.featherGradeId ?? '',
            colorGradeId: entry.colorGradeId ?? '',
            pieceCount: String(entry.pieceCount ?? ''),
            initialWeightGram: String(entry.initialWeightGram ?? ''),
            moisturePercent: String(entry.moisturePercent ?? ''),
            featherCondition: entry.featherCondition ?? '',
        });
        setEditOpen(true);
    };

    const handleDeleteEntry = async (entry: PecahBonEntry) => {
        const confirmText = `Apakah Anda yakin ingin menghapus LP ${entry.pecahBonId ?? 'ini'}? Berat (${formatNumber(entry.initialWeightGram)} gr) akan dikembalikan ke sisa berat kartu induk.`;
        if (!window.confirm(confirmText)) return;

        setDeleteLoading(entry.id);
        try {
            await deletePecahBonEntry(entry.id);
            toast.success(`LP ${entry.pecahBonId ?? ''} berhasil dihapus.`);

            // Refresh the batch and its entries
            setRawBatches((prev) =>
                prev.map((batch) => {
                    if (batch.id !== entry.rawBatchId) return batch;
                    return {
                        ...batch,
                        wetWeightGram: batch.wetWeightGram + entry.initialWeightGram,
                        pecahBonEntries: batch.pecahBonEntries?.filter((e) => e.id !== entry.id),
                        entriesTotal: (batch.entriesTotal ?? 0) > 0 ? (batch.entriesTotal ?? 0) - 1 : 0,
                    };
                })
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal menghapus LP.';
            toast.error(message);
        } finally {
            setDeleteLoading(null);
        }
    };

    const handleEditSave = async () => {
        if (!editEntry) return;
        const parsedPiece = parseInt(editValues.pieceCount, 10);
        const parsedWeight = parseFloat(editValues.initialWeightGram);
        const parsedMoisture = parseFloat(editValues.moisturePercent);

        if (!editValues.gradeId) {
            toast.error('Grade bentuk wajib dipilih.');
            return;
        }
        if (!editValues.featherGradeId) {
            toast.error('Grade bulu wajib dipilih.');
            return;
        }
        if (!editValues.colorGradeId) {
            toast.error('Grade warna wajib dipilih.');
            return;
        }
        if (!editValues.featherCondition.trim()) {
            toast.error('Kondisi baku wajib diisi.');
            return;
        }
        if (Number.isNaN(parsedPiece) || parsedPiece < 1) {
            toast.error('Jumlah keping wajib diisi (minimal 1).');
            return;
        }
        if (Number.isNaN(parsedWeight) || parsedWeight <= 0) {
            toast.error('Berat wajib diisi (lebih dari 0).');
            return;
        }
        if (Number.isNaN(parsedMoisture) || parsedMoisture < 0 || parsedMoisture > 100) {
            toast.error('Kadar air wajib diisi (0 - 100).');
            return;
        }

        setEditSaving(true);
        try {
            const updated = await updatePecahBonEntry(editEntry.id, {
                gradeId: editValues.gradeId,
                featherGradeId: editValues.featherGradeId,
                colorGradeId: editValues.colorGradeId,
                featherCondition: editValues.featherCondition.trim(),
                pieceCount: parsedPiece,
                initialWeightGram: parsedWeight,
                moisturePercent: parsedMoisture,
            });

            setRawBatches((prev) =>
                prev.map((batch) => {
                    if (batch.id !== updated.rawBatchId) return batch;
                    const updatedEntries = batch.pecahBonEntries?.map((entry) =>
                        entry.id === updated.id ? { ...entry, ...updated } : entry
                    );
                    return {
                        ...batch,
                        wetWeightGram: updated.rawBatch?.wetWeightGram ?? batch.wetWeightGram,
                        pecahBonEntries: updatedEntries,
                    };
                })
            );

            toast.success('Pecah bon berhasil diperbarui.');
            setEditOpen(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal mengubah pecah bon.';
            toast.error(message);
        } finally {
            setEditSaving(false);
        }
    };

    const openSetoranDialog = (batch: BatchWithEntries, entry: PecahBonEntry) => {
        clearHighlightIfActive(entry.id);
        setSetoranContext({ batch, entry });
        setSetoranOpen(true);
    };

    const toggleEntrySelection = (batchId: string, entryId: string, checked: boolean) => {
        setSelectedEntryIds((prev) => {
            const current = new Set(prev[batchId] ?? []);
            if (checked) {
                current.add(entryId);
            } else {
                current.delete(entryId);
            }
            return { ...prev, [batchId]: Array.from(current) };
        });
    };

    const togglePageSelection = (batchId: string, entryIds: string[], checked: boolean) => {
        setSelectedEntryIds((prev) => {
            const current = new Set(prev[batchId] ?? []);
            if (checked) {
                entryIds.forEach((id) => current.add(id));
            } else {
                entryIds.forEach((id) => current.delete(id));
            }
            return { ...prev, [batchId]: Array.from(current) };
        });
    };

    const clearSelection = (batchId: string) => {
        setSelectedEntryIds((prev) => ({ ...prev, [batchId]: [] }));
    };

    const handlePrintSelected = async (batch: BatchWithEntries, entryIds: string[]) => {
        if (entryIds.length === 0) return;
        let entries = (batch.pecahBonEntries ?? []).filter((entry) => entryIds.includes(entry.id));
        if (entries.length !== entryIds.length) {
            try {
                const allEntries = await getPecahBonEntries(batch.id);
                entries = allEntries.filter((entry) => entryIds.includes(entry.id));
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Gagal memuat data LP untuk dicetak.';
                toast.error(message);
                return;
            }
        }
        if (entries.length === 0) return;

        if (typeof window !== 'undefined' && window.securePOSPrinter?.print) {
            try {
                const options = buildPrintOptions();
                for (const entry of entries) {
                    const data = buildPecahBonPrintData(batch, entry);
                    await window.securePOSPrinter.print(data, options);
                    await markPecahBonPrinted(entry.id).catch((err) => {
                        console.error('Failed to mark printed:', err);
                    });
                }
                toast.success(`Berhasil mencetak ${entries.length} kartu.`);
                clearSelection(batch.id);
                return;
            } catch (error) {
                console.error('[SECCA] multi print failed:', error);
                await window.seccaDesktop?.log?.({
                    scope: 'pecah-bon',
                    message: 'multi print failed',
                    error: error instanceof Error ? error.message : String(error),
                });
                toast.error('Gagal cetak multiple.');
                return;
            }
        }

        toast.error('Cetak multiple hanya tersedia di aplikasi desktop.');
    };

    const handlePrintSetoranSelected = async (batch: BatchWithEntries, entryIds: string[]) => {
        if (entryIds.length === 0) return;
        let entries = (batch.pecahBonEntries ?? []).filter((entry) => entryIds.includes(entry.id));
        if (entries.length !== entryIds.length) {
            try {
                const allEntries = await getPecahBonEntries(batch.id);
                entries = allEntries.filter((entry) => entryIds.includes(entry.id));
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Gagal memuat data LP untuk dicetak.';
                toast.error(message);
                return;
            }
        }
        if (entries.length === 0) return;

        if (typeof window !== 'undefined' && window.securePOSPrinter?.print) {
            try {
                const options = buildPrintOptions();
                for (const entry of entries) {
                    const data = buildSetoranPrintData(batch, entry);
                    await window.securePOSPrinter.print(data, options);
                }
                toast.success(`Berhasil mencetak ${entries.length} setoran.`);
                clearSelection(batch.id);
                return;
            } catch (error) {
                console.error('[SECCA] multi setoran print failed:', error);
                await window.seccaDesktop?.log?.({
                    scope: 'setoran',
                    message: 'multi setoran print failed',
                    error: error instanceof Error ? error.message : String(error),
                });
                toast.error('Gagal cetak setoran multiple.');
                return;
            }
        }

        toast.error('Cetak multiple hanya tersedia di aplikasi desktop.');
    };

    const parsePecahBonId = (value: string) => {
        const match = value.match(/^([A-Z]+)-(\d+)-(\d{2})$/);
        if (!match) return null;
        return { digits: match[2], year: match[3] };
    };

    const resolveScanLookupValue = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return '';

        try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            const candidates = [parsed.pecahBonId, parsed.id, parsed.cardId];
            for (const candidate of candidates) {
                if (typeof candidate === 'string' && candidate.trim().length > 0) {
                    return candidate.trim();
                }
            }
        } catch {
            // Not a JSON payload, continue with raw text.
        }

        return trimmed;
    };

    const sortEntriesByPecahBonId = (entries: PecahBonEntry[]) =>
        [...entries].sort((left, right) => {
            const leftId = left.pecahBonId ?? '';
            const rightId = right.pecahBonId ?? '';
            if (leftId && rightId) return leftId.localeCompare(rightId);
            if (leftId) return -1;
            if (rightId) return 1;
            return new Date(left.pecahBonDate).getTime() - new Date(right.pecahBonDate).getTime();
        });

    const openFromScan = async (
        entry: PecahBonEntry,
        options?: { openPrint?: boolean; persistHighlight?: boolean }
    ) => {
        const openPrint = options?.openPrint ?? true;
        const persistHighlight = options?.persistHighlight ?? false;
        const batchId = entry.rawBatchId ?? entry.rawBatch?.id;
        if (!batchId) {
            toast.error('Batch tidak ditemukan untuk QR ini.');
            return;
        }

        let batch = rawBatches.find((b) => b.id === batchId);
        if (!batch) {
            const rawBatch = entry.rawBatch as (RawBatch & { rawBatchId?: string }) | undefined;
            if (rawBatch) {
                const fallbackBatch: BatchWithEntries = {
                    ...rawBatch,
                    id: rawBatch.rawBatchId ?? rawBatch.id,
                    expanded: false,
                    pecahBonEntries: undefined,
                    entriesLoading: false,
                    entriesPage: 1,
                    entriesTotal: 0,
                    entriesTotalPages: 1,
                };
                batch = fallbackBatch;
                setRawBatches((prev) => {
                    if (prev.some((item) => item.id === fallbackBatch.id)) return prev;
                    return [fallbackBatch, ...prev];
                });
            }
        }

        if (!batch) {
            toast.error('Batch tidak ditemukan di daftar.');
            return;
        }

        let entriesInBatch: PecahBonEntry[] = [];
        try {
            entriesInBatch = sortEntriesByPecahBonId(await getPecahBonEntries(batchId));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal memuat pecah bon entries.';
            toast.error(message);
            return;
        }

        const entryFromList =
            entriesInBatch.find(
                (item) => item.id === entry.id || item.pecahBonId === entry.pecahBonId
            ) ?? entry;

        const targetIndex = entriesInBatch.findIndex((item) => item.id === entryFromList.id);
        const targetPage = targetIndex >= 0 ? Math.floor(targetIndex / ENTRIES_PER_PAGE) + 1 : 1;
        const totalEntries = entriesInBatch.length;
        const totalPages = Math.max(1, Math.ceil(totalEntries / ENTRIES_PER_PAGE));
        const startIdx = (targetPage - 1) * ENTRIES_PER_PAGE;
        const pagedEntries = entriesInBatch.slice(startIdx, startIdx + ENTRIES_PER_PAGE);

        setRawBatches((prev) =>
            prev.map((b) =>
                b.id === batchId
                    ? {
                        ...b,
                        expanded: true,
                        entriesPage: targetPage,
                        entriesTotal: totalEntries,
                        entriesTotalPages: totalPages,
                        pecahBonEntries: pagedEntries,
                    }
                    : b
            )
        );

        if (targetIndex >= 0) {
            setTimeout(() => {
                const row = document.getElementById(`pecah-row-${entryFromList.id}`);
                row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                flashRow(entryFromList.id);
            }, 120);
        }

        if (persistHighlight) {
            setHighlightedEntryId(entryFromList.id);
        }

        if (openPrint) {
            openPrintDialog(
                {
                    ...batch,
                    pecahBonEntries: pagedEntries,
                    entriesPage: targetPage,
                    entriesTotal: totalEntries,
                    entriesTotalPages: totalPages,
                },
                entryFromList
            );
        }
    };

    const handleScanOpen = async (value: string): Promise<boolean> => {
        const trimmed = value.trim();
        if (!trimmed) return false;
        const lookupValue = resolveScanLookupValue(trimmed);
        if (!lookupValue) return false;
        setScanLoading(true);
        try {
            const entry = await getPecahBonById(lookupValue);
            if (entry.pecahBonId) {
                const parsed = parsePecahBonId(entry.pecahBonId);
                if (parsed) {
                    setLpDigits(parsed.digits);
                    setYearSuffix(parsed.year);
                }
            }
            await openFromScan(entry, { openPrint: false, persistHighlight: true });
            toast.success(`LP ${entry.pecahBonId ?? lookupValue} ditemukan. Pilih aksi Print/Edit/Setoran pada tabel.`);
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal menemukan QR.';
            toast.error(message);
            return false;
        } finally {
            setScanLoading(false);
        }
    };

    const handleSearchByDigits = async () => {
        const digits = normalizeLpDigits(lpDigits);
        if (!digits) {
            toast.error('Masukkan nomor LP.');
            return;
        }

        const fullId = `TEI-${digits.padStart(4, '0')}-${yearSuffix || String(new Date().getFullYear()).slice(-2)}`;
        setSearchLoading(true);
        setHighlightedEntryId(null);
        try {
            const entry = await getPecahBonById(fullId);
            if (entry.pecahBonId) {
                const parsed = parsePecahBonId(entry.pecahBonId);
                if (parsed) {
                    setLpDigits(parsed.digits);
                    setYearSuffix(parsed.year);
                }
            }
            await openFromScan(entry, { openPrint: false, persistHighlight: true });
            toast.success(`LP ${entry.pecahBonId ?? fullId} ditemukan.`);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'LP tidak ditemukan.';
            toast.error(message);
        } finally {
            setSearchLoading(false);
        }
    };

    scanOpenHandlerRef.current = handleScanOpen;

    const stopCameraScanner = () => {
        if (cameraLoopRef.current !== null && typeof window !== 'undefined') {
            window.cancelAnimationFrame(cameraLoopRef.current);
            cameraLoopRef.current = null;
        }

        if (cameraStreamRef.current) {
            for (const track of cameraStreamRef.current.getTracks()) {
                track.stop();
            }
            cameraStreamRef.current = null;
        }

        if (cameraVideoRef.current) {
            cameraVideoRef.current.pause();
            cameraVideoRef.current.srcObject = null;
        }

        cameraDetectorRef.current = null;
        cameraDetectingRef.current = false;
    };

    useEffect(() => {
        if (!cameraScanOpen) {
            stopCameraScanner();
            return;
        }

        let cancelled = false;

        const startCameraScanner = async () => {
            if (!navigator.mediaDevices?.getUserMedia) {
                setCameraScanError('Browser tidak mendukung akses kamera.');
                return;
            }

            const barcodeDetectorCtor = (window as Window & { BarcodeDetector?: BarcodeDetectorCtorLike })
                .BarcodeDetector;

            if (!barcodeDetectorCtor) {
                setCameraScanError(
                    'Browser belum mendukung scan barcode via kamera. Gunakan Chrome terbaru atau scanner mesin.'
                );
                return;
            }

            setCameraScanStarting(true);
            setCameraScanError(null);
            cameraLastPayloadRef.current = '';
            cameraLastAtRef.current = 0;

            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } },
                    audio: false,
                });

                if (cancelled) {
                    for (const track of stream.getTracks()) {
                        track.stop();
                    }
                    return;
                }

                cameraStreamRef.current = stream;

                const videoElement = cameraVideoRef.current;
                if (!videoElement) {
                    throw new Error('Elemen preview kamera tidak tersedia.');
                }

                videoElement.srcObject = stream;
                await videoElement.play();

                try {
                    cameraDetectorRef.current = new barcodeDetectorCtor({
                        formats: ['qr_code', 'code_128'],
                    });
                } catch {
                    cameraDetectorRef.current = new barcodeDetectorCtor();
                }

                const scanLoop = async () => {
                    if (cancelled || !cameraScanOpen) return;

                    const detector = cameraDetectorRef.current;
                    const video = cameraVideoRef.current;

                    if (
                        detector &&
                        video &&
                        video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
                        !cameraDetectingRef.current
                    ) {
                        cameraDetectingRef.current = true;
                        try {
                            const detections = await detector.detect(video);
                            const rawValue =
                                detections.find(
                                    (item) =>
                                        typeof item.rawValue === 'string' &&
                                        item.rawValue.trim().length > 0
                                )?.rawValue ?? '';

                            if (rawValue) {
                                const now = Date.now();
                                if (
                                    rawValue !== cameraLastPayloadRef.current ||
                                    now - cameraLastAtRef.current > 1200
                                ) {
                                    cameraLastPayloadRef.current = rawValue;
                                    cameraLastAtRef.current = now;
                                    const found = await scanOpenHandlerRef.current(rawValue);
                                    if (found) {
                                        setCameraScanOpen(false);
                                        return;
                                    }
                                }
                            }
                        } catch {
                            // Ignore transient detection failures while stream is stabilizing.
                        } finally {
                            cameraDetectingRef.current = false;
                        }
                    }

                    cameraLoopRef.current = window.requestAnimationFrame(() => {
                        void scanLoop();
                    });
                };

                cameraLoopRef.current = window.requestAnimationFrame(() => {
                    void scanLoop();
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Gagal membuka kamera.';
                setCameraScanError(message);
                stopCameraScanner();
            } finally {
                setCameraScanStarting(false);
            }
        };

        void startCameraScanner();

        return () => {
            cancelled = true;
            stopCameraScanner();
        };
    }, [cameraScanOpen]);

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
    }, []);

    const onSubmit = async (values: PecahBonFormValues) => {
        if (!selectedBatch) return;

        if (values.initialWeightGram > selectedBatch.wetWeightGram) {
            toast.error(
                `Berat awal (${formatNumber(values.initialWeightGram)}) melebihi sisa berat batch (${formatNumber(selectedBatch.wetWeightGram)}).`
            );
            return;
        }

        try {
            const today = new Date().toISOString();
            await createPecahBon(selectedBatch.id, {
                ...values,
                featherCondition: selectedBatch.featherCondition,
                pecahBonDate: today,
            });
            toast.success('Pecah Bon berhasil disimpan.');
            setDialogOpen(false);
            await loadData(batchPage, { withTemplates: true });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal menyimpan Pecah Bon.';
            toast.error(message);
        }
    };

    const onBulkSubmit = async () => {
        if (!selectedBatch) return;

        const featherCondition = selectedBatch.featherCondition;

        const validEntries = multiEntries.filter(
            (entry) =>
                entry.gradeId &&
                entry.featherGradeId &&
                entry.colorGradeId &&
                typeof entry.pieceCount === 'number' &&
                entry.pieceCount >= 1 &&
                typeof entry.initialWeightGram === 'number' &&
                entry.initialWeightGram > 0 &&
                typeof entry.moisturePercent === 'number' &&
                entry.moisturePercent >= 0
        );

        if (validEntries.length === 0) {
            toast.error('Tidak ada entry yang valid. Pastikan semua field terisi dengan benar.');
            return;
        }

        const totalInitialWeight = validEntries.reduce(
            (sum, entry) => sum + (typeof entry.initialWeightGram === 'number' ? entry.initialWeightGram : 0),
            0
        );
        if (totalInitialWeight > selectedBatch.wetWeightGram) {
            toast.error(
                `Total berat (${formatNumber(totalInitialWeight)}) melebihi sisa berat batch (${formatNumber(selectedBatch.wetWeightGram)}).`
            );
            return;
        }

        setIsSubmitting(true);
        let successCount = 0;
        let errorCount = 0;
        const today = new Date().toISOString();

        for (const entry of validEntries) {
            try {
                await createPecahBon(selectedBatch.id, {
                    gradeId: entry.gradeId,
                    featherGradeId: entry.featherGradeId,
                    colorGradeId: entry.colorGradeId,
                    featherCondition,
                    pieceCount: Number(entry.pieceCount),
                    initialWeightGram: Number(entry.initialWeightGram),
                    moisturePercent: Number(entry.moisturePercent),
                    pecahBonDate: today,
                });
                successCount++;
            } catch (err) {
                console.error('Failed to create pecah bon entry:', err);
                errorCount++;
            }
        }

        setIsSubmitting(false);

        if (successCount > 0) {
            toast.success(`${successCount} Pecah Bon berhasil disimpan.`);
        }
        if (errorCount > 0) {
            toast.error(`${errorCount} Pecah Bon gagal disimpan.`);
        }

        if (successCount > 0) {
            const selectedTemplateId = selectedTemplateRequestId;
            if (selectedTemplateId !== 'NONE' && successCount === validEntries.length) {
                try {
                    await fulfillMitraOrderRequest(selectedTemplateId);
                    setTrainerOrderTemplates((prev) =>
                        prev.filter((item) => item.id !== selectedTemplateId)
                    );
                    setSelectedTemplateRequestId('NONE');
                    toast.success('Template order otomatis ditandai selesai.');
                } catch (error) {
                    toast.error(
                        error instanceof Error
                            ? error.message
                            : 'Gagal menandai template selesai.'
                    );
                }
            }
            setDialogOpen(false);
            await loadData(batchPage, { withTemplates: true });
        }
    };

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

    const setoranDryInGram = setoranContext?.entry.dryWeightGram ?? 0;

    const todayFormatted = new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(new Date());

    // Calculate validation stats
    const validEntriesCount = multiEntries.filter(
        (entry) =>
            entry.gradeId &&
            entry.featherGradeId &&
            entry.colorGradeId &&
            typeof entry.pieceCount === 'number' &&
            entry.pieceCount >= 1 &&
            typeof entry.initialWeightGram === 'number' &&
            entry.initialWeightGram > 0 &&
            typeof entry.moisturePercent === 'number' &&
            entry.moisturePercent >= 0
    ).length;

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
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-600/10">
                            <Scissors className="h-6 w-6 text-green-700" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-semibold text-gray-900">Pecah Bon</h1>
                            <p className="text-sm text-gray-600">
                                Membagi batch baku menjadi beberapa keping
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1">
                            <span className="text-xs font-semibold text-gray-600">TEI-</span>
                            <Input
                                value={lpDigits}
                                onChange={(event) => setLpDigits(normalizeLpDigits(event.target.value))}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        handleSearchByDigits();
                                    }
                                }}
                                inputMode="numeric"
                                placeholder="0001"
                                className="h-7 w-16 border-0 p-0 text-center text-sm font-semibold shadow-none focus-visible:ring-0"
                            />
                            <span className="text-xs font-semibold text-gray-600">-</span>
                            <Input
                                value={yearSuffix}
                                onChange={(event) => setYearSuffix(normalizeYearSuffix(event.target.value))}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        handleSearchByDigits();
                                    }
                                }}
                                inputMode="numeric"
                                className="h-7 w-10 border-0 p-0 text-center text-sm font-semibold shadow-none focus-visible:ring-0"
                            />
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSearchByDigits}
                                disabled={searchLoading}
                                className="h-7 px-2"
                            >
                                {searchLoading ? 'Cari...' : 'Cari LP'}
                            </Button>
                        </div>
                        <Button variant="outline" onClick={() => setCameraScanOpen(true)} className="h-9">
                            <Camera className="h-4 w-4" />
                            Scan Kamera
                        </Button>
                        <Button variant="outline" onClick={() => loadData(batchPage)} disabled={loading} className="h-9">
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-sm font-semibold text-amber-900">Order Trainer / Pengawas</p>
                            <p className="text-xs text-amber-700">
                                Accept order di sini, lalu gunakan sebagai guide otomatis saat Pecah Bon.
                            </p>
                        </div>
                        <span className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800">
                            Pending {pendingTrainerOrders.length}
                        </span>
                    </div>
                    {pendingTrainerOrders.length === 0 ? (
                        <p className="mt-3 text-xs text-amber-700">Tidak ada order pending dari trainer.</p>
                    ) : (
                        <div className="mt-3 space-y-2">
                            {pendingTrainerOrders.map((request) => (
                                <div
                                    key={request.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-white px-3 py-2"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-900">
                                            {request.requestedBy?.name ?? 'Trainer'} - {request.requestedGram} gram
                                        </p>
                                        <p className="truncate text-xs text-gray-600">
                                            {formatTemplateLines(request) || 'Tanpa rincian LP'}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => handleApproveTrainerOrder(request.id)}
                                        disabled={orderActionLoadingId === request.id}
                                    >
                                        {orderActionLoadingId === request.id ? 'Memproses...' : 'Accept'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    {rawBatches.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <Scissors className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                            <p className="text-lg font-medium">Belum ada data</p>
                            <p className="text-sm mt-1">Batch baku akan muncul di sini untuk dipecah.</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10"></th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kondisi Baku</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sisa Berat (gr)</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Kadar Air</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tanggal</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {rawBatches.map((batch) => (
                                        <React.Fragment key={batch.id}>
                                            <tr
                                                className="hover:bg-gray-50 transition-colors cursor-pointer"
                                                onClick={() => toggleExpand(batch.id)}
                                            >
                                                <td className="px-4 py-3">
                                                    {batch.expanded ? (
                                                        <ChevronUp className="h-4 w-4 text-gray-500" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-gray-500" />
                                                    )}
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
                                                <td className="px-4 py-3 text-gray-700">{batch.featherCondition}</td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-900">
                                                    <span className={batch.wetWeightGram <= 0 ? 'text-red-600' : ''}>
                                                        {formatNumber(batch.wetWeightGram)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-900">
                                                    {formatNumber(batch.moisturePercent, 1)}%
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{formatDate(batch.createdAt)}</td>
                                                <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => openPecahBonDialog(batch)}
                                                        disabled={batch.wetWeightGram <= 0}
                                                    >
                                                        <Scissors className="h-4 w-4" />
                                                        Pecah Bon
                                                    </Button>
                                                </td>
                                            </tr>
                                            {batch.expanded && (
                                                <tr key={`${batch.id}-entries`}>
                                                    <td colSpan={8} className="px-4 py-3 bg-gray-50">
                                                        {batch.entriesLoading ? (
                                                            <div className="flex items-center gap-2 text-gray-500 py-2">
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                <span>Memuat pecahan...</span>
                                                            </div>
                                                        ) : batch.pecahBonEntries && batch.pecahBonEntries.length > 0 ? (() => {
                                                            const totalEntries = batch.entriesTotal ?? batch.pecahBonEntries.length;
                                                            const currentPage = batch.entriesPage ?? 1;
                                                            const totalPages = batch.entriesTotalPages ?? Math.max(1, Math.ceil(totalEntries / ENTRIES_PER_PAGE));
                                                            const startIdx = totalEntries === 0 ? 0 : (currentPage - 1) * ENTRIES_PER_PAGE + 1;
                                                            const endIdx = Math.min(currentPage * ENTRIES_PER_PAGE, totalEntries);
                                                            const paginatedEntries = batch.pecahBonEntries;
                                                            const selectedIds = selectedEntryIds[batch.id] ?? [];
                                                            const pageEntryIds = paginatedEntries.map((entry) => entry.id);
                                                            const selectedOnPage = pageEntryIds.filter((id) => selectedIds.includes(id));
                                                            const allPageSelected = pageEntryIds.length > 0 && selectedOnPage.length === pageEntryIds.length;

                                                            const goToPage = (page: number) => {
                                                                if (page < 1 || page > totalPages || page === currentPage) return;
                                                                loadEntriesPage(batch.id, page);
                                                            };

                                                            return (
                                                                <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                                                                    <div className="flex items-center justify-between bg-green-50 border-b border-gray-200 px-3 py-2">
                                                                        <span className="text-sm text-green-800">
                                                                            Menampilkan <strong>{startIdx}</strong> - <strong>{endIdx}</strong> dari <strong>{totalEntries}</strong> entries
                                                                        </span>
                                                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                                                            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200">
                                                                                Terpilih {selectedIds.length}
                                                                            </span>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    clearSelection(batch.id);
                                                                                }}
                                                                                disabled={selectedIds.length === 0}
                                                                                className="h-7 px-2"
                                                                            >
                                                                                Reset
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handlePrintSelected(batch, selectedIds);
                                                                                }}
                                                                                disabled={selectedIds.length === 0}
                                                                                className="h-7 px-3"
                                                                            >
                                                                                <Printer className="h-3 w-3" />
                                                                                Cetak Kartu
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handlePrintSetoranSelected(batch, selectedIds);
                                                                                }}
                                                                                disabled={selectedIds.length === 0}
                                                                                className="h-7 px-3"
                                                                            >
                                                                                <Printer className="h-3 w-3" />
                                                                                Cetak Setoran
                                                                            </Button>
                                                                            {totalPages > 1 && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="ghost"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            void goToPage(currentPage - 1);
                                                                                        }}
                                                                                        disabled={currentPage === 1 || batch.entriesLoading}
                                                                                        className="h-7 px-2"
                                                                                    >
                                                                                        <ChevronLeft className="h-4 w-4" />
                                                                                        Sebelumnya
                                                                                    </Button>
                                                                                    <span className="text-sm text-green-700 tabular-nums">
                                                                                        {currentPage} / {totalPages}
                                                                                    </span>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="ghost"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            void goToPage(currentPage + 1);
                                                                                        }}
                                                                                        disabled={currentPage >= totalPages || batch.entriesLoading}
                                                                                        className="h-7 px-2"
                                                                                    >
                                                                                        Selanjutnya
                                                                                        <ChevronRight className="h-4 w-4" />
                                                                                    </Button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <table className="w-full text-sm">
                                                                        <thead>
                                                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                                                <th className="px-3 py-2 text-center text-xs font-medium text-green-700 w-10">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        aria-label="Pilih semua di halaman"
                                                                                        checked={allPageSelected}
                                                                                        onChange={(e) =>
                                                                                            togglePageSelection(batch.id, pageEntryIds, e.target.checked)
                                                                                        }
                                                                                    />
                                                                                </th>
                                                                                <th className="px-3 py-2 text-left text-xs font-medium text-green-700">ID Pecah Bon</th>
                                                                                <th className="px-3 py-2 text-left text-xs font-medium text-green-700">Tanggal Pecah</th>
                                                                                <th className="px-3 py-2 text-left text-xs font-medium text-green-700">Grade (Bentuk / Bulu / Warna)</th>
                                                                                <th className="px-3 py-2 text-left text-xs font-medium text-green-700">Kondisi</th>
                                                                                <th className="px-3 py-2 text-center text-xs font-medium text-green-700">Keping</th>
                                                                                <th className="px-3 py-2 text-right text-xs font-medium text-green-700">Berat Awal</th>
                                                                                <th className="px-3 py-2 text-right text-xs font-medium text-green-700">Kadar Air</th>
                                                                                <th className="px-3 py-2 text-right text-xs font-medium text-green-700">Berat Kering</th>
                                                                                <th className="px-3 py-2 text-center text-xs font-medium text-green-700">Aksi</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-100">
                                                                            {paginatedEntries.map((entry) => (
                                                                                <tr
                                                                                    id={`pecah-row-${entry.id}`}
                                                                                    key={entry.id}
                                                                                    className={`transition-colors ${entry.id === highlightedEntryId ? 'bg-emerald-100 hover:bg-emerald-100' : 'hover:bg-gray-50'}`}
                                                                                >
                                                                                    <td className="px-3 py-2 text-center">
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            aria-label={`Pilih ${entry.pecahBonId ?? 'LP'}`}
                                                                                            checked={selectedIds.includes(entry.id)}
                                                                                            onChange={(e) =>
                                                                                                toggleEntrySelection(batch.id, entry.id, e.target.checked)
                                                                                            }
                                                                                        />
                                                                                    </td>
                                                                                    <td className="px-3 py-2 font-mono text-gray-700">{entry.pecahBonId ?? '-'}</td>
                                                                                    <td className="px-3 py-2 text-gray-600">{formatDate(entry.pecahBonDate)}</td>
                                                                                    <td className="px-3 py-2 font-medium text-gray-900">
                                                                                        {entry.grade?.code ?? '-'} / {entry.featherGrade?.code ?? '-'} / {entry.colorGrade?.code ?? '-'}
                                                                                    </td>
                                                                                    <td className="px-3 py-2 text-gray-700">{entry.featherCondition}</td>
                                                                                    <td className="px-3 py-2 text-center font-mono">{entry.pieceCount}</td>
                                                                                    <td className="px-3 py-2 text-right font-mono text-gray-900">{formatNumber(entry.initialWeightGram)}</td>
                                                                                    <td className="px-3 py-2 text-right font-mono text-gray-900">{formatNumber(entry.moisturePercent, 1)}%</td>
                                                                                    <td className="px-3 py-2 text-right font-mono font-semibold text-green-700">
                                                                                        {formatNumber(entry.dryWeightGram)}
                                                                                    </td>

                                                                                    <td className="px-3 py-2 text-center">
                                                                                        <div className="flex items-center justify-center gap-1">
                                                                                            <Button
                                                                                                size="sm"
                                                                                                variant="outline"
                                                                                                onClick={() => openPrintDialog(batch, entry)}
                                                                                                disabled={!entry.pecahBonId}
                                                                                                className="h-8 px-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                                                                                            >
                                                                                                <Printer className="h-3 w-3" />
                                                                                            </Button>
                                                                                            <Button
                                                                                                size="sm"
                                                                                                variant="outline"
                                                                                                onClick={() => openEditDialog(entry)}
                                                                                                className="h-8 px-2 border-amber-500 text-amber-700 hover:bg-amber-50"
                                                                                            >
                                                                                                Edit
                                                                                            </Button>
                                                                                            <Button
                                                                                                size="sm"
                                                                                                variant="outline"
                                                                                                onClick={() => handleDeleteEntry(entry)}
                                                                                                disabled={deleteLoading === entry.id}
                                                                                                className="h-8 px-2 border-red-500 text-red-700 hover:bg-red-50"
                                                                                                title="Hapus LP"
                                                                                            >
                                                                                                {deleteLoading === entry.id ? (
                                                                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                                                                ) : (
                                                                                                    <Trash2 className="h-3 w-3" />
                                                                                                )}
                                                                                            </Button>
                                                                                            <Button
                                                                                                size="sm"
                                                                                                variant="outline"
                                                                                                onClick={() => openSetoranDialog(batch, entry)}
                                                                                                disabled={!entry.pecahBonId}
                                                                                                className="h-8 px-2 border-sky-500 text-sky-700 hover:bg-sky-50"
                                                                                            >
                                                                                                Cetak Setoran
                                                                                            </Button>
                                                                                        </div>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                    {totalPages > 1 && (
                                                                        <div className="flex items-center justify-center gap-2 border-t border-gray-200 bg-gray-50 px-3 py-2">
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    void goToPage(currentPage - 1);
                                                                                }}
                                                                                disabled={currentPage === 1 || batch.entriesLoading}
                                                                                className="h-7 px-2"
                                                                            >
                                                                                <ChevronLeft className="h-4 w-4" />
                                                                            </Button>
                                                                            <span className="text-sm text-gray-600 tabular-nums">
                                                                                Halaman {currentPage} dari {totalPages}
                                                                            </span>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="ghost"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    void goToPage(currentPage + 1);
                                                                                }}
                                                                                disabled={currentPage >= totalPages || batch.entriesLoading}
                                                                                className="h-7 px-2"
                                                                            >
                                                                                <ChevronRight className="h-4 w-4" />
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })() : (
                                                            <div className="text-sm text-gray-500 py-2">
                                                                Belum ada pecah bon untuk batch ini.
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
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

            {/* Pecah Bon Dialog - Improved Multi Entry */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader className="border-b pb-4">
                        <DialogTitle className="text-xl">Input Pecah Bon</DialogTitle>
                        <DialogDescription>
                            Batch: <strong className="text-green-700">{selectedBatch?.batchNumber}</strong>
                            {' '}| Sisa berat: <strong>{selectedBatch ? formatNumber(selectedBatch.wetWeightGram) : '0'} gr</strong>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                        {/* Mode Toggle & Shared Fields */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-sm text-gray-600">
                                    Tanggal: <strong>{todayFormatted}</strong>
                                </div>
                            </div>

                            
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-600">Kondisi Baku</Label>
                                    <Input
                                        className="h-9 text-sm"
                                        value={selectedBatch?.featherCondition ?? ''}
                                        disabled
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-gray-600">Template Order Trainer (opsional)</Label>
                                    <Select
                                        value={selectedTemplateRequestId}
                                        onValueChange={applyTemplateToRows}
                                    >
                                        <SelectTrigger className="h-9 text-sm">
                                            <SelectValue placeholder="Pilih template order" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NONE">Tanpa template</SelectItem>
                                            {trainerOrderTemplates.map((request) => (
                                                <SelectItem key={request.id} value={request.id}>
                                                    {`${request.requestedBy?.name ?? 'Trainer'} | ${request.requestedGram}g`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedTrainerTemplate?.lines && selectedTrainerTemplate.lines.length > 0 && (
                                        <p className="text-[11px] text-gray-500">
                                            {selectedTrainerTemplate.lines
                                                .map((line) => `${line.weightGram}g x ${line.lpCount} LP`)
                                                .join(' | ')}
                                        </p>
                                    )}
                                    <p className="text-[11px] text-gray-500">
                                        Pilih template untuk auto-generate jumlah LP sesuai order. Tinggal isi grading.
                                    </p>
                                    {selectedTemplateRequestId !== 'NONE' && (
                                        <p className="text-[11px] text-green-700">
                                            Saat grading di baris pertama dipilih, baris bawah otomatis mengikuti. Bisa diubah per baris.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Multi-entry table */}
                        <div className="flex-1 overflow-hidden flex flex-col rounded-lg border border-gray-200 bg-white">
                            <div className="bg-green-50 border-b border-green-200 px-4 py-2 flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-green-800">Daftar LP yang Akan Dibuat</h3>
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={addEntry}
                                    disabled={isSubmitting}
                                    className="h-8"
                                >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Tambah LP
                                </Button>
                                </div>
                                
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-100 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-3 py-2 text-left w-20 text-xs font-semibold text-gray-700">Aksi</th>
                                                <th className="px-3 py-2 text-left w-10 text-xs font-semibold text-gray-700">#</th>
                                                <th className="px-3 py-2 text-left w-32 text-xs font-semibold text-gray-700">Bentuk</th>
                                                <th className="px-3 py-2 text-left w-32 text-xs font-semibold text-gray-700">Bulu</th>
                                                <th className="px-3 py-2 text-left w-32 text-xs font-semibold text-gray-700">Warna</th>
                                                <th className="px-3 py-2 text-right w-20 text-xs font-semibold text-gray-700">Keping</th>
                                                <th className="px-3 py-2 text-right w-28 text-xs font-semibold text-gray-700">Berat</th>
                                                <th className="px-3 py-2 text-right w-24 text-xs font-semibold text-gray-700">Kadar %</th>

                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {multiEntries.map((entry, index) => {
                                                const isValid =
                                                    entry.gradeId &&
                                                    entry.featherGradeId &&
                                                    entry.colorGradeId &&
                                                    typeof entry.pieceCount === 'number' &&
                                                    entry.pieceCount >= 1 &&
                                                    typeof entry.initialWeightGram === 'number' &&
                                                    entry.initialWeightGram > 0 &&
                                                    typeof entry.moisturePercent === 'number' &&
                                                    entry.moisturePercent >= 0;
                                                return (
                                                    <tr key={entry.id} className={`hover:bg-gray-50 ${!isValid ? 'bg-red-50/30' : ''}`}>
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => duplicateEntry(entry.id)}
                                                                    className="h-8 w-8 p-0"
                                                                    title="Duplikat"
                                                                >
                                                                    <Copy className="h-3 w-3" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => removeEntry(entry.id)}
                                                                    disabled={multiEntries.length <= 1}
                                                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                    title="Hapus"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-gray-500 font-mono text-xs">{index + 1}</span>
                                                                {isValid && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <Select
                                                                value={entry.gradeId}
                                                                onValueChange={(value) => {
                                                                    updateEntry(entry.id, 'gradeId', value);
                                                                    flashRow(entry.id);
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-9 text-xs">
                                                                    <SelectValue placeholder="Pilih..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {shapeGrades.map((grade) => (
                                                                        <SelectItem key={grade.id} value={grade.id}>
                                                                            {grade.code}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <Select
                                                                value={entry.featherGradeId}
                                                                onValueChange={(value) => {
                                                                    updateEntry(entry.id, 'featherGradeId', value);
                                                                    flashRow(entry.id);
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-9 text-xs">
                                                                    <SelectValue placeholder="Pilih..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {featherGrades.map((grade) => (
                                                                        <SelectItem key={grade.id} value={grade.id}>
                                                                            {grade.code}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <Select
                                                                value={entry.colorGradeId}
                                                                onValueChange={(value) => {
                                                                    updateEntry(entry.id, 'colorGradeId', value);
                                                                    flashRow(entry.id);
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-9 text-xs">
                                                                    <SelectValue placeholder="Pilih..." />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {colorGrades.map((grade) => (
                                                                        <SelectItem key={grade.id} value={grade.id}>
                                                                            {grade.code}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                step={1}
                                                                value={entry.pieceCount}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    const parsed = parseInt(value, 10);
                                                                    updateEntry(
                                                                        entry.id,
                                                                        'pieceCount',
                                                                        value === '' || Number.isNaN(parsed) ? '' : parsed
                                                                    );
                                                                }}
                                                                className="h-9 text-xs w-full text-right"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <Input
                                                                type="number"
                                                                min={0.1}
                                                                step="0.01"
                                                                value={entry.initialWeightGram}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    const parsed = parseFloat(value);
                                                                    updateEntry(
                                                                        entry.id,
                                                                        'initialWeightGram',
                                                                        value === '' || Number.isNaN(parsed) ? '' : parsed
                                                                    );
                                                                }}
                                                                className="h-9 text-xs w-full text-right"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                max={100}
                                                                step="0.1"
                                                                value={entry.moisturePercent}
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    const parsed = parseFloat(value);
                                                                    updateEntry(
                                                                        entry.id,
                                                                        'moisturePercent',
                                                                        value === '' || Number.isNaN(parsed) ? '' : parsed
                                                                    );
                                                                }}
                                                                className="h-9 text-xs w-full text-right"
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                        </div>
                         </div>                   
                    <DialogFooter className="border-t pt-4">
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
                            Batal
                        </Button>
                        <Button 
                            type="button" 
                            onClick={onBulkSubmit} 
                            disabled={isSubmitting || validEntriesCount === 0}
                            className="min-w-[160px]"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Simpan {validEntriesCount} LP
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={cameraScanOpen} onOpenChange={setCameraScanOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Scan Kamera</DialogTitle>
                        <DialogDescription>
                            Arahkan kamera ke QR/barcode kartu pecah bon. Scanner mesin tetap bisa dipakai seperti biasa.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="overflow-hidden rounded-lg border border-gray-200 bg-black">
                            <video
                                ref={cameraVideoRef}
                                className="h-64 w-full object-cover"
                                muted
                                playsInline
                                autoPlay
                            />
                        </div>
                        {cameraScanStarting && (
                            <p className="text-sm text-gray-600">Meminta izin kamera...</p>
                        )}
                        {cameraScanError && (
                            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {cameraScanError}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setCameraScanOpen(false)}
                        >
                            Tutup
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Pecah Bon Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Edit Pecah Bon</DialogTitle>
                        <DialogDescription>
                            Perbarui data LP dan berat. Jika berat dikurangi, sisa baku akan bertambah.
                        </DialogDescription>
                    </DialogHeader>

                    {editEntry && (
                        <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>Grade Bentuk</Label>
                                    <Select
                                        value={editValues.gradeId}
                                        onValueChange={(value) => setEditValues((prev) => ({ ...prev, gradeId: value }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih grade" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {shapeGrades.map((grade) => (
                                                <SelectItem key={grade.id} value={grade.id}>
                                                    {grade.code}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Grade Bulu</Label>
                                    <Select
                                        value={editValues.featherGradeId}
                                        onValueChange={(value) =>
                                            setEditValues((prev) => ({ ...prev, featherGradeId: value }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih grade" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {featherGrades.map((grade) => (
                                                <SelectItem key={grade.id} value={grade.id}>
                                                    {grade.code}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Grade Warna</Label>
                                    <Select
                                        value={editValues.colorGradeId}
                                        onValueChange={(value) =>
                                            setEditValues((prev) => ({ ...prev, colorGradeId: value }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih grade" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {colorGrades.map((grade) => (
                                                <SelectItem key={grade.id} value={grade.id}>
                                                    {grade.code}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>Keping</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        step={1}
                                        value={editValues.pieceCount}
                                        onChange={(e) =>
                                            setEditValues((prev) => ({ ...prev, pieceCount: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Berat (Gr)</Label>
                                    <Input
                                        type="number"
                                        min={0.1}
                                        step="0.01"
                                        value={editValues.initialWeightGram}
                                        onChange={(e) =>
                                            setEditValues((prev) => ({ ...prev, initialWeightGram: e.target.value }))
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

                            <div className="space-y-2">
                                <Label>Kondisi Bulu</Label>
                                <Input
                                    value={editValues.featherCondition}
                                    onChange={(e) =>
                                        setEditValues((prev) => ({ ...prev, featherCondition: e.target.value }))
                                    }
                                />
                            </div>

                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditOpen(false)}
                                    disabled={editSaving}
                                >
                                    Batal
                                </Button>
                                <Button type="button" onClick={handleEditSave} disabled={editSaving}>
                                    {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Print Dialog */}
            <Dialog open={printOpen} onOpenChange={setPrintOpen}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Print Preview</DialogTitle>
                        <DialogDescription>
                            Kartu siap dicetak ke printer Blueprint Lite 80D1 (lebar 72mm).
                        </DialogDescription>
                    </DialogHeader>

                    {printContext && (
                        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                            <div className="flex items-start justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
                                <PecahBonCard
                                    entry={{
                                        pecahBonId: printContext.entry.pecahBonId ?? '-',
                                        batchNumber: printContext.batch.batchNumber,
                                        pecahBonDate: printContext.entry.pecahBonDate,
                                        gradeCode: `${printContext.entry.grade?.code ?? '-'} / ${printContext.entry.featherGrade?.code ?? '-'} / ${printContext.entry.colorGrade?.code ?? '-'}`,
                                        featherCondition: printContext.entry.featherCondition,
                                        pieceCount: printContext.entry.pieceCount,
                                        initialWeightGram: printContext.entry.initialWeightGram,
                                        moisturePercent: printContext.entry.moisturePercent,
                                        dryWeightGram: printContext.entry.dryWeightGram,
                                    }}
                                />
                            </div>
                            <div className="space-y-4">
                                <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">ID Pecah Bon</span>
                                        <span className="font-semibold">
                                            {printContext.entry.pecahBonId ?? '-'}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Batch</span>
                                        <span className="font-semibold">{printContext.batch.batchNumber}</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Grade</span>
                                        <span className="font-semibold">
                                            {`${printContext.entry.grade?.code ?? '-'} / ${printContext.entry.featherGrade?.code ?? '-'} / ${printContext.entry.colorGrade?.code ?? '-'}`}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Keping</span>
                                        <span className="font-semibold">{printContext.entry.pieceCount}</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Berat</span>
                                        <span className="font-semibold">
                                            {formatNumber(printContext.entry.initialWeightGram)} gr
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Kadar Air</span>
                                        <span className="font-semibold">
                                            {formatNumber(printContext.entry.moisturePercent, 1)}%
                                        </span>
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setPrintOpen(false)}>
                                        Tutup
                                    </Button>
                                    <Button onClick={handlePrint} disabled={!printContext.entry.pecahBonId}>
                                        <Printer className="h-4 w-4" />
                                        Cetak Kartu
                                    </Button>
                                </DialogFooter>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Setoran Print Dialog */}
            <Dialog open={setoranOpen} onOpenChange={setSetoranOpen}>
                <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Preview Setoran</DialogTitle>
                        <DialogDescription>
                            BAKU hanya menyiapkan dan mencetak setoran. Input setoran dikerjakan di menu Koreksi.
                        </DialogDescription>
                    </DialogHeader>

                    {setoranContext && (
                        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
                            <div className="space-y-3">
                                <div className="flex items-start justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
                                    <div
                                        className="bg-white p-3 text-black"
                                        style={{ width: '72mm', fontFamily: 'Arial, Helvetica, sans-serif' }}
                                        dangerouslySetInnerHTML={{
                                            __html: buildSetoranPrintData(setoranContext.batch, setoranContext.entry)
                                                .filter((item) => item.type === 'text' && item.raw)
                                                .map((item) => item.value)
                                                .join(''),
                                        }}
                                    />
                                </div>
                                <Button
                                    className="w-full"
                                    onClick={() => handlePrintSetoran(setoranContext.batch, setoranContext.entry)}
                                >
                                    <Printer className="h-4 w-4" />
                                    Cetak Setoran
                                </Button>
                            </div>
                            <div className="space-y-4">
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Detail Setoran (Read-Only)</p>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs text-emerald-700">No LP</p>
                                            <p className="text-sm font-semibold text-emerald-900">
                                                {setoranContext.entry.pecahBonId ?? '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-emerald-700">Tanggal</p>
                                            <p className="text-sm font-semibold text-emerald-900">
                                                {formatDate(setoranContext.entry.pecahBonDate)}
                                            </p>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <p className="text-xs text-emerald-700">Grade</p>
                                            <p className="text-sm font-semibold text-emerald-900">
                                                {`${setoranContext.entry.grade?.code ?? '-'} / ${setoranContext.entry.featherGrade?.code ?? '-'} / ${setoranContext.entry.colorGrade?.code ?? '-'}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-lg border border-gray-200 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ringkasan Berat</p>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                        <div>
                                            <p className="text-xs text-gray-500">Berat Basah</p>
                                            <p className="text-base font-semibold text-gray-900">{formatNumber(setoranContext.entry.initialWeightGram, 2)} gr</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Kadar Air</p>
                                            <p className="text-base font-semibold text-gray-900">{formatNumber(setoranContext.entry.moisturePercent, 1)}%</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Berat Kering</p>
                                            <p className="text-base font-semibold text-emerald-700">{formatNumber(setoranDryInGram, 2)} gr</p>
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter className="flex-wrap gap-2">
                                    <Button variant="outline" onClick={() => setSetoranOpen(false)}>
                                        Tutup
                                    </Button>
                                    <Button onClick={() => handlePrintSetoran(setoranContext.batch, setoranContext.entry)}>
                                        <Printer className="h-4 w-4" />
                                        Cetak Setoran
                                    </Button>
                                </DialogFooter>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function PecahBonPage() {
    return (
        <ProtectedRoute allowedRoles={['baku', 'manager']}>
            <PecahBonContent />
        </ProtectedRoute>
    );
}
