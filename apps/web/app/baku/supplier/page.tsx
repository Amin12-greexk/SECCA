'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Alert from '@/components/Alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/lib/toast';
import {
    createSupplier,
    deleteSupplier,
    getSuppliers,
    updateSupplier,
    type Supplier,
} from '@/lib/api';

const formSchema = z.object({
    name: z.string().min(1, 'Nama supplier wajib diisi'),
    code: z.string().optional(),
    phone: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
    name: '',
    code: '',
    phone: '',
};

const normalizeOptional = (value?: string) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
};

function SupplierContent() {
    const toast = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        mode: 'onSubmit',
        defaultValues,
    });

    useEffect(() => {
        if (containerRef.current) {
            gsap.fromTo(
                containerRef.current,
                { opacity: 0, y: 30 },
                { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
            );
        }
    }, []);

    const loadSuppliers = async () => {
        setLoading(true);
        setListError(null);

        try {
            const data = await getSuppliers();
            setSuppliers(data);
        } catch (err) {
            console.error('Failed to load suppliers:', err);
            setListError('Gagal memuat supplier. Coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSuppliers();
    }, []);

    const handleSubmit = async (values: FormValues) => {
        try {
            const payload = {
                name: values.name.trim(),
                code: normalizeOptional(values.code),
                phone: normalizeOptional(values.phone),
            };

            if (editingSupplier) {
                await updateSupplier(editingSupplier.id, payload);
                toast.success('Supplier berhasil diperbarui.');
            } else {
                await createSupplier(payload);
                toast.success('Supplier berhasil ditambahkan.');
            }

            setEditingSupplier(null);
            form.reset(defaultValues);
            await loadSuppliers();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal menyimpan supplier.';
            toast.error(message);
        }
    };

    const startEdit = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        form.reset({
            name: supplier.name,
            code: supplier.code ?? '',
            phone: supplier.phone ?? '',
        });
    };

    const cancelEdit = () => {
        setEditingSupplier(null);
        form.reset(defaultValues);
    };

    const handleDelete = async (supplier: Supplier) => {
        const confirmed = window.confirm(`Hapus supplier "${supplier.name}"?`);
        if (!confirmed) {
            return;
        }

        try {
            await deleteSupplier(supplier.id);
            toast.success('Supplier berhasil dihapus.');
            await loadSuppliers();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal menghapus supplier.';
            toast.error(message);
        }
    };

    return (
        <div ref={containerRef} className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-amber-50 via-white to-green-50 py-10 px-4">
            <div className="mx-auto max-w-5xl space-y-8">
                <div className="flex flex-col gap-3">
                    <h1 className="text-3xl font-semibold text-gray-900">
                        {editingSupplier ? 'Edit Supplier' : 'Tambah Supplier'}
                    </h1>
                    <p className="text-sm text-gray-600">
                        Kelola data supplier untuk pencatatan bahan baku.
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Nama Supplier</Label>
                                <Input placeholder="Contoh: Supplier Utama" {...form.register('name')} />
                                {form.formState.errors.name && (
                                    <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Kode (opsional)</Label>
                                <Input placeholder="Contoh: SUP-01" {...form.register('code')} />
                            </div>
                            <div className="space-y-2">
                                <Label>Telepon (opsional)</Label>
                                <Input placeholder="Contoh: 08123456789" {...form.register('phone')} />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : editingSupplier ? (
                                    'Simpan Perubahan'
                                ) : (
                                    'Tambah Supplier'
                                )}
                            </Button>
                            {editingSupplier && (
                                <Button type="button" variant="outline" onClick={cancelEdit}>
                                    Batal
                                </Button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">Daftar Supplier</h2>
                        <Button type="button" variant="outline" size="sm" onClick={loadSuppliers}>
                            Refresh
                        </Button>
                    </div>

                    {listError && (
                        <div className="mt-4">
                            <Alert variant="error">{listError}</Alert>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center gap-2 py-6 text-sm text-gray-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Memuat supplier...
                        </div>
                    ) : suppliers.length === 0 ? (
                        <p className="py-6 text-sm text-gray-500">Belum ada data supplier.</p>
                    ) : (
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 text-left text-gray-500">
                                        <th className="py-3 pr-4 font-medium">Nama</th>
                                        <th className="py-3 pr-4 font-medium">Kode</th>
                                        <th className="py-3 pr-4 font-medium">Telepon</th>
                                        <th className="py-3 text-right font-medium">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliers.map((supplier) => {
                                        return (
                                            <tr key={supplier.id} className="border-b border-gray-100">
                                                <td className="py-3 pr-4 font-medium text-gray-900">
                                                    {supplier.name}
                                                </td>
                                                <td className="py-3 pr-4 text-gray-700">{supplier.code ?? '-'}</td>
                                                <td className="py-3 pr-4 text-gray-700">{supplier.phone ?? '-'}</td>
                                                <td className="py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => startEdit(supplier)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleDelete(supplier)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            Hapus
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SupplierPage() {
    return (
        <ProtectedRoute allowedRoles={['baku', 'manager']}>
            <SupplierContent />
        </ProtectedRoute>
    );
}
