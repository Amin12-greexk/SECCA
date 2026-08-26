'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
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
import { useAuth } from '@/lib/auth/AuthContext';
import { createWorker, getUsers, type User } from '@/lib/api';
import { useToast } from '@/lib/toast';

const NONE_VALUE = '__NONE__';

function MitraAddContent() {
    const toast = useToast();
    const { user } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [trainerLoadError, setTrainerLoadError] = useState<string | null>(null);
    const [trainers, setTrainers] = useState<User[]>([]);
    const [form, setForm] = useState({
        name: '',
        code: '',
        pin: '',
        trainerId: NONE_VALUE,
    });

    const isTrainerUser = user?.role === 'trainer';

    useEffect(() => {
        if (isTrainerUser && user?.id) {
            setForm((prev) => ({ ...prev, trainerId: user.id }));
        }
    }, [isTrainerUser, user?.id]);

    useEffect(() => {
        if (isTrainerUser) return;

        const loadTrainers = async () => {
            try {
                const users = await getUsers();
                const trainerUsers = users
                    .filter((item) => String(item.role).toUpperCase() === 'TRAINER')
                    .sort((left, right) => left.name.localeCompare(right.name));
                setTrainers(trainerUsers);
                setTrainerLoadError(null);
            } catch (error) {
                setTrainerLoadError(
                    error instanceof Error
                        ? error.message
                        : 'Daftar trainer tidak bisa dimuat saat ini.'
                );
            }
        };

        loadTrainers();
    }, [isTrainerUser]);

    const trainerLabel = useMemo(() => {
        if (!user) return 'Trainer';
        if (isTrainerUser) return `${user.name} (otomatis)`;
        return 'Pilih Trainer';
    }, [isTrainerUser, user]);

    const updateField = (field: keyof typeof form, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (submitting) return;

        const name = form.name.trim();
        const code = form.code.trim();
        const pin = form.pin.replace(/\D/g, '');
        if (!name) {
            toast.error('Nama mitra wajib diisi.');
            return;
        }
        if (pin && (pin.length < 3 || pin.length > 6)) {
            toast.error('PIN harus 3-6 digit angka.');
            return;
        }

        const trainerId = isTrainerUser
            ? user?.id ?? null
            : form.trainerId === NONE_VALUE
                ? null
                : form.trainerId;

        setSubmitting(true);
        try {
            await createWorker({
                name,
                code: code || undefined,
                pin: pin || undefined,
                trainerId,
            });

            toast.success('Data mitra berhasil ditambahkan.');
            setForm({
                name: '',
                code: '',
                pin: '',
                trainerId: isTrainerUser && user?.id ? user.id : NONE_VALUE,
            });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menambah mitra.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-4 md:p-6">
            <div className="mx-auto max-w-3xl space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">Tambah Mitra</h1>
                        <p className="text-sm text-gray-600">
                            Input data mitra operasional. Kapasitas order dihitung otomatis dari data setoran.
                        </p>
                    </div>
                    <Link href="/mitra/list">
                        <Button variant="outline" className="gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Kembali
                        </Button>
                    </Link>
                </div>

                <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5 md:col-span-2">
                            <Label htmlFor="mitra-name">Nama Mitra</Label>
                            <Input
                                id="mitra-name"
                                value={form.name}
                                onChange={(event) => updateField('name', event.target.value)}
                                placeholder="Nama lengkap mitra"
                                disabled={submitting}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="mitra-code">Kode Mitra (opsional)</Label>
                            <Input
                                id="mitra-code"
                                value={form.code}
                                onChange={(event) => updateField('code', event.target.value)}
                                placeholder="Contoh: MTR-021"
                                disabled={submitting}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="mitra-pin">PIN Finger (opsional, 3-6 digit)</Label>
                            <Input
                                id="mitra-pin"
                                inputMode="numeric"
                                maxLength={6}
                                value={form.pin}
                                onChange={(event) => updateField('pin', event.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="Contoh: 209"
                                disabled={submitting}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label>{trainerLabel}</Label>
                            {isTrainerUser ? (
                                <Input value={user?.name ?? '-'} disabled />
                            ) : (
                                <Select
                                    value={form.trainerId}
                                    onValueChange={(value) => updateField('trainerId', value)}
                                    disabled={submitting}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NONE_VALUE}>Tanpa Pengawas</SelectItem>
                                        {trainers.map((trainer) => (
                                            <SelectItem key={trainer.id} value={trainer.id}>
                                                {trainer.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    </div>

                    {trainerLoadError ? (
                        <p className="mt-3 text-xs text-amber-700">
                            Daftar trainer belum tersedia: {trainerLoadError}. Tetap bisa simpan mitra tanpa trainer.
                        </p>
                    ) : null}

                    <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                        <Link href="/mitra/list">
                            <Button variant="outline" type="button" disabled={submitting}>
                                Batal
                            </Button>
                        </Link>
                        <Button type="submit" disabled={submitting} className="gap-2">
                            <Save className="h-4 w-4" />
                            {submitting ? 'Menyimpan...' : 'Simpan Mitra'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function MitraAddPage() {
    return (
        <ProtectedRoute>
            <MitraAddContent />
        </ProtectedRoute>
    );
}
