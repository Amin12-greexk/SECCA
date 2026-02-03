'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Check, ChevronsUpDown, Loader2, PackageCheck } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Alert from '@/components/Alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
    type Supplier,
} from '@/lib/api';

const formSchema = z.object({
    supplierId: z.string().min(1, 'Supplier wajib dipilih'),
    featherCondition: z.string().min(1, 'Kondisi baku wajib diisi'),
    wetWeightGram: z.number().min(0.1, 'Minimal 0.1 gram'),
    moisturePercent: z.number().min(0, 'Minimal 0%').max(100, 'Maksimal 100%'),
    notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function TerimaBakuContent() {
    const toast = useToast();
    const router = useRouter();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [supplierLoadError, setSupplierLoadError] = useState<string | null>(null);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [supplierOpen, setSupplierOpen] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        mode: 'onSubmit',
        defaultValues: {
            supplierId: '',
            featherCondition: '',
            wetWeightGram: 0,
            moisturePercent: 0,
            notes: '',
        },
    });

    const supplierId = form.watch('supplierId');

    const selectedSupplier = useMemo(
        () => suppliers.find((supplier) => supplier.id === supplierId),
        [suppliers, supplierId],
    );

    useEffect(() => {
        async function loadData() {
            try {
                const supplierData = await getSuppliers();
                setSuppliers(supplierData);
            } catch (error) {
                console.error('Failed to load suppliers:', error);
                setSupplierLoadError('Gagal memuat supplier. Masukkan ID supplier secara manual.');
            } finally {
                setLoadingSuppliers(false);
            }
        }

        loadData();
    }, []);

    const onSubmit = async (values: FormValues) => {
        setSubmitError(null);

        try {
            await submitBakuReceive(values);
            toast.success('Penerimaan baku berhasil dicatat. Data tersimpan di Stock Asal.');
            form.reset({
                supplierId: '',
                featherCondition: values.featherCondition,
                wetWeightGram: 0,
                moisturePercent: 0,
                notes: '',
            });
            // Navigate to Stock Asal page
            router.push('/stock/asal');
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
                    <span>Memuat data...</span>
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
                                Catat penerimaan bahan baku. Data akan tersimpan di Stock Asal untuk cetak kartu.
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
                                    <Label>Kondisi Baku</Label>
                                    <Input
                                        placeholder="Contoh: terlalu banyak BB / bulu berat"
                                        {...form.register('featherCondition')}
                                    />
                                    {form.formState.errors.featherCondition && (
                                        <p className="text-xs text-red-600">
                                            {form.formState.errors.featherCondition.message}
                                        </p>
                                    )}
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
                                        {...form.register('wetWeightGram', { valueAsNumber: true })}
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
                                        {...form.register('moisturePercent', { valueAsNumber: true })}
                                    />
                                    {form.formState.errors.moisturePercent && (
                                        <p className="text-xs text-red-600">
                                            {form.formState.errors.moisturePercent.message}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Notes field - full width */}
                        <div className="space-y-2">
                            <Label>Catatan (Opsional)</Label>
                            <Textarea
                                placeholder="Tambahkan catatan untuk penerimaan ini..."
                                rows={3}
                                {...form.register('notes')}
                            />
                        </div>

                        {submitError && (
                            <Alert variant="error" dismissible onDismiss={() => setSubmitError(null)}>
                                {submitError}
                            </Alert>
                        )}

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-gray-500">
                                Data akan tersimpan di Stock Asal. Anda dapat mencetak kartu dari halaman Stock Asal.
                            </p>
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
                        </div>
                    </form>
                </div>
            </div>
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
