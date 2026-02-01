'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Check, ChevronsUpDown, Loader2, PackageCheck, Printer } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Alert from '@/components/Alert';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useToast } from '@/lib/toast';
import {
    getSuppliers,
    submitBakuReceive,
    type BakuReceiveResponse,
    type Supplier,
} from '@/lib/api';
import BatchCard from '@/components/print/BatchCard';

const formSchema = z.object({
    supplierId: z.string().min(1, 'Supplier wajib dipilih'),
    origin: z.enum(['KAL', 'SBY', 'RBI', 'LPG', 'OTHER']),
    featherCondition: z.enum(['Light', 'Medium', 'Heavy']),
    wetWeightGram: z.coerce.number().min(0.1, 'Minimal 0.1 gram'),
    moisturePercent: z.coerce.number().min(0, 'Minimal 0%').max(100, 'Maksimal 100%'),
    pieceCount: z.coerce.number().int().min(1, 'Minimal 1'),
});

type FormValues = z.infer<typeof formSchema>;

const originOptions = [
    { value: 'KAL', label: 'Kalimantan (KAL)' },
    { value: 'SBY', label: 'Surabaya (SBY)' },
    { value: 'RBI', label: 'Riau (RBI)' },
    { value: 'LPG', label: 'Lampung (LPG)' },
    { value: 'OTHER', label: 'Lainnya (OTHER)' },
];

const featherOptions = [
    { value: 'Light', label: 'Ringan' },
    { value: 'Medium', label: 'Sedang' },
    { value: 'Heavy', label: 'Berat' },
];

function TerimaBakuContent() {
    const toast = useToast();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [supplierLoadError, setSupplierLoadError] = useState<string | null>(null);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [printBatch, setPrintBatch] = useState<BakuReceiveResponse | null>(null);
    const [printOpen, setPrintOpen] = useState(false);
    const [supplierOpen, setSupplierOpen] = useState(false);

    const printRef = useRef<HTMLDivElement>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        mode: 'onSubmit',
        defaultValues: {
            supplierId: '',
            origin: 'KAL',
            featherCondition: 'Light',
            wetWeightGram: 0,
            moisturePercent: 0,
            pieceCount: 1,
        },
    });

    const supplierId = form.watch('supplierId');
    const originValue = form.watch('origin');
    const featherValue = form.watch('featherCondition');

    const selectedSupplier = useMemo(
        () => suppliers.find((supplier) => supplier.id === supplierId),
        [suppliers, supplierId],
    );

    useEffect(() => {
        async function loadSuppliers() {
            try {
                const data = await getSuppliers();
                setSuppliers(data);
            } catch (err) {
                console.error('Failed to load suppliers:', err);
                setSupplierLoadError('Gagal memuat supplier. Masukkan ID supplier secara manual.');
            } finally {
                setLoadingSuppliers(false);
            }
        }

        loadSuppliers();
    }, []);

    const handlePrint = useReactToPrint({
        content: () => printRef.current,
        documentTitle: printBatch?.batchNumber ?? 'batch-card',
    });

    const onSubmit = async (values: FormValues) => {
        setSubmitError(null);

        try {
            const response = await submitBakuReceive(values);
            setPrintBatch(response);
            setPrintOpen(true);
            toast.success('Penerimaan baku berhasil dicatat.');
            form.reset({
                supplierId: '',
                origin: values.origin,
                featherCondition: values.featherCondition,
                wetWeightGram: 0,
                moisturePercent: 0,
                pieceCount: 1,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan data.';
            setSubmitError(message);
            toast.error(message);
        }
    };

    if (loadingSuppliers) {
        return (
            <div className="min-h-[calc(100vh-72px)] flex items-center justify-center">
                <div className="flex items-center gap-3 text-gray-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Memuat data supplier...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-amber-50 via-white to-green-50 py-10 px-4">
            <div className="mx-auto max-w-5xl">
                <div className="mb-8 flex flex-col gap-3">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-600/10">
                            <PackageCheck className="h-6 w-6 text-green-700" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-semibold text-gray-900">Penerimaan Bahan Baku</h1>
                            <p className="text-sm text-gray-600">
                                Catat penerimaan bahan baku dan siapkan kartu cetak untuk proses berikutnya.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Supplier</Label>
                                    {supplierLoadError ? (
                                        <Input
                                            placeholder="Masukkan ID supplier"
                                            {...form.register('supplierId')}
                                        />
                                    ) : (
                                        <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    role="combobox"
                                                    className="w-full justify-between"
                                                >
                                                    {selectedSupplier ? selectedSupplier.name : 'Pilih supplier'}
                                                    <ChevronsUpDown className="h-4 w-4 opacity-60" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                <Command>
                                                    <CommandInput placeholder="Cari supplier..." />
                                                    <CommandList>
                                                        <CommandEmpty>Supplier tidak ditemukan.</CommandEmpty>
                                                        <CommandGroup>
                                                            {suppliers.map((supplier) => (
                                                                <CommandItem
                                                                    key={supplier.id}
                                                                    value={`${supplier.name} ${supplier.code ?? ''}`}
                                                                    onSelect={() => {
                                                                        form.setValue('supplierId', supplier.id, {
                                                                            shouldValidate: true,
                                                                        });
                                                                        setSupplierOpen(false);
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            'mr-2 h-4 w-4',
                                                                            supplier.id === supplierId
                                                                                ? 'opacity-100'
                                                                                : 'opacity-0',
                                                                        )}
                                                                    />
                                                                    <span>{supplier.name}</span>
                                                                    {supplier.code ? (
                                                                        <span className="ml-auto text-xs text-gray-500">
                                                                            {supplier.code}
                                                                        </span>
                                                                    ) : null}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                    {form.formState.errors.supplierId && (
                                        <p className="text-xs text-red-600">
                                            {form.formState.errors.supplierId.message}
                                        </p>
                                    )}
                                    {supplierLoadError && (
                                        <p className="text-xs text-amber-600">{supplierLoadError}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Asal</Label>
                                    <Select
                                        value={originValue}
                                        onValueChange={(value) =>
                                            form.setValue('origin', value as FormValues['origin'], {
                                                shouldValidate: true,
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih asal" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {originOptions.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Kondisi Bulu</Label>
                                    <RadioGroup
                                        value={featherValue}
                                        onValueChange={(value) =>
                                            form.setValue('featherCondition', value as FormValues['featherCondition'], {
                                                shouldValidate: true,
                                            })
                                        }
                                        className="grid grid-cols-3 gap-3"
                                    >
                                        {featherOptions.map((option) => (
                                            <Label
                                                key={option.value}
                                                className={cn(
                                                    'flex cursor-pointer items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700',
                                                    featherValue === option.value
                                                        ? 'border-green-600 bg-green-50 text-green-700'
                                                        : 'bg-white',
                                                )}
                                            >
                                                <span>{option.label}</span>
                                                <RadioGroupItem value={option.value} />
                                            </Label>
                                        ))}
                                    </RadioGroup>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Berat Basah (gram)</Label>
                                    <Input
                                        type="number"
                                        min={0.1}
                                        step="0.01"
                                        placeholder="Contoh: 1050.5"
                                        {...form.register('wetWeightGram')}
                                    />
                                    {form.formState.errors.wetWeightGram && (
                                        <p className="text-xs text-red-600">
                                            {form.formState.errors.wetWeightGram.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Kadar Air (%)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        step="0.1"
                                        placeholder="Contoh: 17.5"
                                        {...form.register('moisturePercent')}
                                    />
                                    {form.formState.errors.moisturePercent && (
                                        <p className="text-xs text-red-600">
                                            {form.formState.errors.moisturePercent.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label>Jumlah Potong</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        step="1"
                                        placeholder="Contoh: 120"
                                        {...form.register('pieceCount')}
                                    />
                                    {form.formState.errors.pieceCount && (
                                        <p className="text-xs text-red-600">
                                            {form.formState.errors.pieceCount.message}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {submitError && (
                            <Alert variant="error" dismissible onDismiss={() => setSubmitError(null)}>
                                {submitError}
                            </Alert>
                        )}

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-gray-500">
                                Pastikan data sudah benar sebelum mencetak kartu penerimaan.
                            </p>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    'Simpan & Cetak'
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>

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
                                <BatchCard ref={printRef} batch={printBatch} />
                            </div>
                            <div className="space-y-4">
                                <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Batch</span>
                                        <span className="font-semibold">{printBatch.batchNumber}</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Card ID</span>
                                        <span className="font-semibold">{printBatch.cardId}</span>
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
                                            {printBatch.wetWeightGram.toFixed(2)} gr
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Kadar Air</span>
                                        <span className="font-semibold">
                                            {printBatch.moisturePercent.toFixed(1)}%
                                        </span>
                                    </div>
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
        </div>
    );
}

export default function TerimaBakuPage() {
    return (
        <ProtectedRoute allowedRoles={['baku', 'manager']}>
            <TerimaBakuContent />
        </ProtectedRoute>
    );
}
