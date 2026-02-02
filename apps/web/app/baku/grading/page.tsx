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
    createGrade,
    deleteGrade,
    getGrades,
    updateGrade,
    type Grade,
} from '@/lib/api';

const formSchema = z.object({
    code: z.string().min(1, 'Kode grading wajib diisi'),
    name: z.string().min(1, 'Nama grading wajib diisi'),
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
    code: '',
    name: '',
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

    return (
        <div ref={containerRef} className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-amber-50 via-white to-green-50 py-10 px-4">
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
                                <Input placeholder="Contoh: A" {...form.register('code')} />
                                {form.formState.errors.code && (
                                    <p className="text-xs text-red-600">{form.formState.errors.code.message}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label>Nama Grading</Label>
                                <Input placeholder="Contoh: Grade A" {...form.register('name')} />
                                {form.formState.errors.name && (
                                    <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
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
                        <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 text-left text-gray-500">
                                        <th className="py-3 pr-4 font-medium">Kode</th>
                                        <th className="py-3 pr-4 font-medium">Nama</th>
                                        <th className="py-3 text-right font-medium">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {grades.map((grade) => (
                                        <tr key={grade.id} className="border-b border-gray-100">
                                            <td className="py-3 pr-4 font-medium text-gray-900">{grade.code}</td>
                                            <td className="py-3 pr-4 text-gray-700">{grade.name}</td>
                                            <td className="py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => startEdit(grade)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDelete(grade)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Hapus
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
