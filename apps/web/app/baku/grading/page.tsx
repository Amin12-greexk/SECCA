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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/lib/toast';
import {
    createGrade,
    deleteGrade,
    getGrades,
    updateGrade,
    type Grade,
} from '@/lib/api';

const formSchema = z.object({
    code: z.string().min(1, 'Kode grading wajib diisi'),
    name: z.string().min(1, 'Nama grading wajib diisi'),
    type: z.enum(['BULU', 'WARNA', 'BENTUK']),
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
    code: '',
    name: '',
    type: 'BULU',
};

function GradingContent() {
    const toast = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [editingGrade, setEditingGrade] = useState<Grade | null>(null);

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

    const loadGrades = async () => {
        setLoading(true);
        setListError(null);

        try {
            const data = await getGrades();
            setGrades(data);
        } catch (err) {
            console.error('Failed to load grades:', err);
            setListError('Gagal memuat data grading. Coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGrades();
    }, []);

    const handleSubmit = async (values: FormValues) => {
        try {
            const payload = {
                code: values.code.trim(),
                name: values.name.trim(),
                type: values.type,
            };

            if (editingGrade) {
                await updateGrade(editingGrade.id, payload);
                toast.success('Grading berhasil diperbarui.');
            } else {
                await createGrade(payload);
                toast.success('Grading berhasil ditambahkan.');
            }

            setEditingGrade(null);
            form.reset(defaultValues);
            await loadGrades();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal menyimpan grading.';
            toast.error(message);
        }
    };

    const startEdit = (grade: Grade) => {
        setEditingGrade(grade);
        form.reset({
            code: grade.code,
            name: grade.name,
            type: (grade.type ?? 'BULU') as FormValues['type'],
        });
    };

    const cancelEdit = () => {
        setEditingGrade(null);
        form.reset(defaultValues);
    };

    const handleDelete = async (grade: Grade) => {
        const confirmed = window.confirm(`Hapus grading "${grade.code}"?`);
        if (!confirmed) {
            return;
        }

        try {
            await deleteGrade(grade.id);
            toast.success('Grading berhasil dihapus.');
            await loadGrades();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal menghapus grading.';
            toast.error(message);
        }
    };

    const groupedGrades = [
        {
            label: 'Grade Bulu',
            description: 'Contoh: BR, BS, dll.',
            type: 'BULU',
            items: grades.filter((grade) => grade.type === 'BULU' || !grade.type),
            badgeClass: 'bg-amber-100 text-amber-800',
            headerClass: 'border-amber-200 bg-amber-50',
            dotClass: 'bg-amber-500',
        },
        {
            label: 'Grade Warna',
            description: 'Contoh: W1, W2, W3.',
            type: 'WARNA',
            items: grades.filter((grade) => grade.type === 'WARNA'),
            badgeClass: 'bg-sky-100 text-sky-800',
            headerClass: 'border-sky-200 bg-sky-50',
            dotClass: 'bg-sky-500',
        },
        {
            label: 'Grade Bentuk',
            description: 'Contoh: MK, SGTG.',
            type: 'BENTUK',
            items: grades.filter((grade) => grade.type === 'BENTUK'),
            badgeClass: 'bg-emerald-100 text-emerald-800',
            headerClass: 'border-emerald-200 bg-emerald-50',
            dotClass: 'bg-emerald-500',
        },
    ];

    return (
        <div ref={containerRef} className="min-h-[calc(100vh-72px)] bg-green-50 py-10 px-4">
            <div className="mx-auto max-w-5xl space-y-8">
                <div className="flex flex-col gap-3">
                    <h1 className="text-3xl font-semibold text-gray-900">
                        {editingGrade ? 'Edit Grading' : 'Tambah Grading'}
                    </h1>
                    <p className="text-sm text-gray-600">
                        Kelola daftar grading untuk dropdown penerimaan bahan baku.
                    </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Kode Grading</Label>
                                <Input {...form.register('code')} />
                                {form.formState.errors.code && (
                                    <p className="text-xs text-red-600">{form.formState.errors.code.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Nama Grading</Label>
                                <Input {...form.register('name')} />
                                {form.formState.errors.name && (
                                    <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Jenis Grading</Label>
                                <Select
                                    value={form.watch('type')}
                                    onValueChange={(value) => form.setValue('type', value as FormValues['type'], { shouldValidate: true })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BULU">Bulu</SelectItem>
                                        <SelectItem value="WARNA">Warna</SelectItem>
                                        <SelectItem value="BENTUK">Bentuk</SelectItem>
                                    </SelectContent>
                                </Select>
                                {form.formState.errors.type && (
                                    <p className="text-xs text-red-600">{form.formState.errors.type.message}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : editingGrade ? (
                                    'Simpan Perubahan'
                                ) : (
                                    'Tambah Grading'
                                )}
                            </Button>
                            {editingGrade && (
                                <Button type="button" variant="outline" onClick={cancelEdit}>
                                    Batal
                                </Button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">Daftar Grading</h2>
                        <Button type="button" variant="outline" size="sm" onClick={loadGrades}>
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
                            Memuat grading...
                        </div>
                    ) : grades.length === 0 ? (
                        <p className="py-6 text-sm text-gray-500">Belum ada data grading.</p>
                    ) : (
                        <div className="mt-4 grid gap-6 lg:grid-cols-3">
                            {groupedGrades.map((group) =>
                                group.items.length === 0 ? null : (
                                    <div key={group.type} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                                        <div className={`flex items-start justify-between gap-4 border-b px-4 py-3 ${group.headerClass}`}>
                                            <div className="flex items-start gap-3">
                                                <span className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${group.dotClass}`} />
                                                <div>
                                                    <h3 className="text-sm font-semibold text-gray-900">{group.label}</h3>
                                                    <p className="text-xs text-gray-600">{group.description}</p>
                                                </div>
                                            </div>
                                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${group.badgeClass}`}>
                                                {group.items.length} item
                                            </span>
                                        </div>
                                        <div className="max-h-[480px] overflow-auto">
                                            <table className="w-full text-xs">
                                                <thead className="sticky top-0 z-10 bg-white">
                                                    <tr className="border-b border-gray-200 text-left text-gray-500">
                                                        <th className="px-3 py-1.5 font-medium">Kode</th>
                                                        <th className="px-3 py-1.5 font-medium">Nama</th>
                                                        <th className="px-3 py-1.5 text-right font-medium">Aksi</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {group.items.map((grade, index) => (
                                                        <tr
                                                            key={grade.id}
                                                            className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                                                        >
                                                            <td className="px-3 py-1 font-semibold text-gray-900">{grade.code}</td>
                                                            <td className="px-3 py-1 text-gray-700">{grade.name}</td>
                                                            <td className="px-3 py-1 text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => startEdit(grade)}
                                                                        className="h-6 w-6 p-0"
                                                                        title="Edit"
                                                                    >
                                                                        <Pencil className="h-3 w-3" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleDelete(grade)}
                                                                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                                                        title="Hapus"
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function GradingPage() {
    return (
        <ProtectedRoute allowedRoles={['baku', 'manager']}>
            <GradingContent />
        </ProtectedRoute>
    );
}
