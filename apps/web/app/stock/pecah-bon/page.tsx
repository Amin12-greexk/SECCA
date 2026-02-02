'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ChevronDown, ChevronUp, Loader2, Printer, RefreshCw, Scissors } from 'lucide-react';
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
    getRawBatches,
    getGrades,
    createPecahBon,
    getPecahBonEntries,
    type RawBatch,
    type Grade,
    type PecahBonEntry,
} from '@/lib/api';
import PecahBonCard from '@/components/print/PecahBonCard';

const pecahBonSchema = z.object({
    gradeId: z.string().min(1, 'Grade wajib dipilih'),
    featherCondition: z.string().min(1, 'Kondisi bulu wajib diisi'),
    pieceCount: z.number().int().min(1, 'Minimal 1 keping'),
    initialWeightGram: z.number().min(0.1, 'Minimal 0.1 gram'),
    moisturePercent: z.number().min(0, 'Minimal 0%').max(100, 'Maksimal 100%'),
});

type PecahBonFormValues = z.infer<typeof pecahBonSchema>;

interface BatchWithEntries extends RawBatch {
    pecahBonEntries?: PecahBonEntry[];
    entriesLoading?: boolean;
    expanded?: boolean;
}

function PecahBonContent() {
    const toast = useToast();
    const [rawBatches, setRawBatches] = useState<BatchWithEntries[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBatch, setSelectedBatch] = useState<BatchWithEntries | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [printContext, setPrintContext] = useState<{
        batch: BatchWithEntries;
        entry: PecahBonEntry;
    } | null>(null);
    const [printOpen, setPrintOpen] = useState(false);

    const handlePrint = () => window.print();

    const form = useForm<PecahBonFormValues>({
        resolver: zodResolver(pecahBonSchema),
        mode: 'onChange',
        defaultValues: {
            gradeId: '',
            featherCondition: '',
            pieceCount: 1,
            initialWeightGram: 0,
            moisturePercent: 0,
        },
    });

    const moisturePercent = form.watch('moisturePercent');
    const initialWeightGram = form.watch('initialWeightGram');

    // Auto-calculate dry weight
    const dryWeightGram = useMemo(() => {
        if (initialWeightGram > 0 && moisturePercent >= 0 && moisturePercent <= 100) {
            return initialWeightGram * (1 - moisturePercent / 100);
        }
        return 0;
    }, [initialWeightGram, moisturePercent]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [batchData, gradeData] = await Promise.all([
                getRawBatches(),
                getGrades(),
            ]);
            // Map rawBatchId to id for frontend compatibility
            const mapped = batchData.map((item: RawBatch & { rawBatchId?: string }) => ({
                ...item,
                id: item.rawBatchId ?? item.id,
                expanded: false,
                pecahBonEntries: undefined,
                entriesLoading: false,
            }));
            mapped.sort((left, right) =>
                left.batchNumber.localeCompare(right.batchNumber),
            );
            setRawBatches(mapped);
            setGrades(gradeData);
        } catch (err) {
            console.error('Error loading data:', err);
            toast.error('Gagal memuat data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toggleExpand = async (batchId: string) => {
        const batchIndex = rawBatches.findIndex((b) => b.id === batchId);
        if (batchIndex === -1) return;

        const batch = rawBatches[batchIndex];

        if (batch.expanded) {
            // Collapse
            setRawBatches((prev) =>
                prev.map((b) => (b.id === batchId ? { ...b, expanded: false } : b))
            );
        } else {
            // Expand and load entries if not already loaded
            if (!batch.pecahBonEntries) {
                setRawBatches((prev) =>
                    prev.map((b) =>
                        b.id === batchId ? { ...b, entriesLoading: true, expanded: true } : b
                    )
                );

                try {
                    const entries = await getPecahBonEntries(batchId);
                setRawBatches((prev) =>
                    prev.map((b) =>
                        b.id === batchId
                            ? {
                                ...b,
                                pecahBonEntries: [...entries].sort((left, right) => {
                                    const leftId = left.pecahBonId ?? '';
                                    const rightId = right.pecahBonId ?? '';
                                    if (leftId && rightId) {
                                        return leftId.localeCompare(rightId);
                                    }
                                    if (leftId) return -1;
                                    if (rightId) return 1;
                                    return new Date(left.pecahBonDate).getTime() - new Date(right.pecahBonDate).getTime();
                                }),
                                entriesLoading: false,
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
            } else {
                setRawBatches((prev) =>
                    prev.map((b) => (b.id === batchId ? { ...b, expanded: true } : b))
                );
            }
        }
    };

    const openPecahBonDialog = (batch: BatchWithEntries) => {
        setSelectedBatch(batch);
        form.reset({
            gradeId: '',
            featherCondition: batch.featherCondition,
            pieceCount: 1,
            initialWeightGram: batch.wetWeightGram,
            moisturePercent: batch.moisturePercent,
        });
        setDialogOpen(true);
    };

    const openPrintDialog = (batch: BatchWithEntries, entry: PecahBonEntry) => {
        setPrintContext({ batch, entry });
        setPrintOpen(true);
    };

    const onSubmit = async (values: PecahBonFormValues) => {
        if (!selectedBatch) return;

        try {
            const today = new Date().toISOString();
            await createPecahBon(selectedBatch.id, {
                ...values,
                pecahBonDate: today,
            });
            toast.success('Pecah Bon berhasil disimpan.');
            setDialogOpen(false);
            loadData();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal menyimpan Pecah Bon.';
            toast.error(message);
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

    const todayFormatted = new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(new Date());

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-72px)] flex items-center justify-center">
                <div className="flex items-center gap-3 text-gray-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Memuat data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-amber-50 via-white to-green-50 py-10 px-4">
            <div className="mx-auto max-w-6xl">
                <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-600/10">
                            <Scissors className="h-6 w-6 text-green-700" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-semibold text-gray-900">Pecah Bon</h1>
                            <p className="text-sm text-gray-600">
                                Membagi batch baku menjadi beberapa keping. Klik baris untuk lihat pecahan.
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={loadData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    {rawBatches.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <Scissors className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                            <p className="text-lg font-medium">Belum ada data</p>
                            <p className="text-sm mt-1">Batch baku akan muncul di sini untuk dipecah.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">

                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Batch
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Supplier
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Grading
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Sisa Berat (gr)
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Kadar Air
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
                                                <td className="px-4 py-3 text-gray-700">
                                                    {batch.featherCondition}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-900">
                                                    <span className={batch.wetWeightGram <= 0 ? 'text-red-600' : ''}>
                                                        {formatNumber(batch.wetWeightGram)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-900">
                                                    {formatNumber(batch.moisturePercent, 1)}%
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {formatDate(batch.createdAt)}
                                                </td>
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
                                                        ) : batch.pecahBonEntries && batch.pecahBonEntries.length > 0 ? (
                                                            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                                                                <table className="w-full text-sm">
                                                                    <thead>
                                                                        <tr className="bg-green-50 border-b border-gray-200">
                                                                            <th className="px-3 py-2 text-left text-xs font-medium text-green-700">
                                                                                ID Pecah Bon
                                                                            </th>
                                                                            <th className="px-3 py-2 text-left text-xs font-medium text-green-700">
                                                                                Tanggal Pecah
                                                                            </th>
                                                                            <th className="px-3 py-2 text-left text-xs font-medium text-green-700">
                                                                                Grade
                                                                            </th>
                                                                            <th className="px-3 py-2 text-left text-xs font-medium text-green-700">
                                                                                Kondisi
                                                                            </th>
                                                                            <th className="px-3 py-2 text-center text-xs font-medium text-green-700">
                                                                                Keping
                                                                            </th>
                                                                            <th className="px-3 py-2 text-right text-xs font-medium text-green-700">
                                                                                Berat Awal
                                                                            </th>
                                                                            <th className="px-3 py-2 text-right text-xs font-medium text-green-700">
                                                                                Kadar Air
                                                                            </th>
                                                                            <th className="px-3 py-2 text-right text-xs font-medium text-green-700">
                                                                                Berat Kering
                                                                            </th>
                                                                            <th className="px-3 py-2 text-center text-xs font-medium text-green-700">
                                                                                Aksi
                                                                            </th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-100">
                                                                        {batch.pecahBonEntries.map((entry) => (
                                                                            <tr key={entry.id} className="hover:bg-gray-50">
                                                                                <td className="px-3 py-2 font-mono text-gray-700">
                                                                                    {entry.pecahBonId ?? '-'}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-gray-600">
                                                                                    {formatDate(entry.pecahBonDate)}
                                                                                </td>
                                                                                <td className="px-3 py-2 font-medium text-gray-900">
                                                                                    {entry.grade?.code ?? '-'}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-gray-700">
                                                                                    {entry.featherCondition}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-center font-mono">
                                                                                    {entry.pieceCount}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-right font-mono text-gray-900">
                                                                                    {formatNumber(entry.initialWeightGram)}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-right font-mono text-gray-900">
                                                                                    {formatNumber(entry.moisturePercent, 1)}%
                                                                                </td>
                                                                                <td className="px-3 py-2 text-right font-mono font-semibold text-green-700">
                                                                                    {formatNumber(entry.dryWeightGram)}
                                                                                </td>
                                                                                <td className="px-3 py-2 text-center">
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="outline"
                                                                                        onClick={() => openPrintDialog(batch, entry)}
                                                                                        disabled={!entry.pecahBonId}
                                                                                    >
                                                                                        <Printer className="h-4 w-4" />
                                                                                        Cetak
                                                                                    </Button>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        ) : (
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
                    )}
                </div>
            </div>

            {/* Pecah Bon Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Pecah Bon</DialogTitle>
                        <DialogDescription>
                            Membagi batch {selectedBatch?.batchNumber} menjadi beberapa keping.
                            <br />
                            <span className="text-amber-600 font-medium">
                                Sisa berat: {selectedBatch ? formatNumber(selectedBatch.wetWeightGram) : '0'} gr
                            </span>
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Tanggal Pecah Bon</Label>
                            <Input value={todayFormatted} disabled />
                        </div>

                        <div className="space-y-2">
                            <Label>Grade Baku</Label>
                            <Select
                                value={form.watch('gradeId')}
                                onValueChange={(value) => form.setValue('gradeId', value, { shouldValidate: true })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih grade" />
                                </SelectTrigger>
                                <SelectContent>
                                    {grades.map((grade) => (
                                        <SelectItem key={grade.id} value={grade.id}>
                                            {grade.code} - {grade.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {form.formState.errors.gradeId && (
                                <p className="text-xs text-red-600">{form.formState.errors.gradeId.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Kondisi Bulu</Label>
                            <Input
                                placeholder="Masukkan kondisi bulu"
                                {...form.register('featherCondition')}
                            />
                            {form.formState.errors.featherCondition && (
                                <p className="text-xs text-red-600">{form.formState.errors.featherCondition.message}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Jumlah Keping</Label>
                            <Input
                                type="number"
                                min={1}
                                step={1}
                                placeholder="Contoh: 5"
                                {...form.register('pieceCount', { valueAsNumber: true })}
                            />
                            {form.formState.errors.pieceCount && (
                                <p className="text-xs text-red-600">{form.formState.errors.pieceCount.message}</p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Berat Awal (Gr)</Label>
                                <Input
                                    type="number"
                                    min={0.1}
                                    step="0.01"
                                    max={selectedBatch?.wetWeightGram ?? undefined}
                                    placeholder="Berat sebelum dikurangi kadar air"
                                    {...form.register('initialWeightGram', { valueAsNumber: true })}
                                />
                                {form.formState.errors.initialWeightGram && (
                                    <p className="text-xs text-red-600">{form.formState.errors.initialWeightGram.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Kadar Air (%)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    step="0.1"
                                    {...form.register('moisturePercent', { valueAsNumber: true })}
                                />
                                {form.formState.errors.moisturePercent && (
                                    <p className="text-xs text-red-600">{form.formState.errors.moisturePercent.message}</p>
                                )}
                            </div>
                        </div>

                        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-green-800">Berat Kering (Gr)</span>
                                <span className="text-xl font-bold text-green-900">
                                    {formatNumber(dryWeightGram, 2)}
                                </span>
                            </div>
                            <p className="mt-1 text-xs text-green-600">
                                Dihitung otomatis: Berat Awal × (1 - Kadar Air / 100)
                            </p>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    'Simpan'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
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
                                        gradeCode: printContext.entry.grade?.code,
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
                                            {printContext.entry.grade?.code ?? '-'}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Keping</span>
                                        <span className="font-semibold">{printContext.entry.pieceCount}</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Berat Awal</span>
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
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Berat Kering</span>
                                        <span className="font-semibold">
                                            {formatNumber(printContext.entry.dryWeightGram)} gr
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
