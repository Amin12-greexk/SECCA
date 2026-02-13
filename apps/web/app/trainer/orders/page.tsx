'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadingCircle from '@/components/LoadingCircle';
import { useToast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { Worker, WorkLane } from '@/lib/api';
import { getWorkers, createWorkOrder } from '@/lib/api';

function TrainerOrdersContent() {
    const { user } = useAuth();
    const toast = useToast();

    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loadingWorkers, setLoadingWorkers] = useState(true);

    // Form state
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [lotText, setLotText] = useState('');
    const [lane, setLane] = useState<WorkLane>('NEXT_DAY');
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Derived
    const lotNumbers = useMemo(
        () =>
            lotText
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean),
        [lotText],
    );

    // Load workers
    useEffect(() => {
        getWorkers()
            .then((list) => {
                // If trainer, filter by trainerId
                if (user?.role === 'trainer') {
                    setWorkers(list.filter((w) => w.trainerId === user.id));
                } else {
                    setWorkers(list);
                }
            })
            .catch((err) => toast.error(err.message))
            .finally(() => setLoadingWorkers(false));
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleSubmit = async () => {
        setErrorMsg('');
        if (!selectedWorkerId) {
            toast.error('Pilih pekerja terlebih dahulu');
            return;
        }
        if (lotNumbers.length === 0) {
            toast.error('Masukkan minimal satu lot number');
            return;
        }

        setSubmitting(true);
        try {
            await createWorkOrder({
                workerId: selectedWorkerId,
                lotNumbers,
                lane,
            });
            toast.success(`Work order berhasil dibuat (${lotNumbers.length} lot)`);
            // Reset form
            setSelectedWorkerId('');
            setLotText('');
            setLane('NEXT_DAY');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Gagal membuat work order';
            if (msg.includes('WORK_NOT_FINISHED')) {
                setErrorMsg('Pekerja ini masih memiliki work order yang belum selesai. Selesaikan terlebih dahulu sebelum membuat order baru.');
            } else {
                toast.error(msg);
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (!user) return null;

    return (
        <div className="space-y-6 max-w-xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Buat Work Order</h1>
                <p className="text-sm text-gray-500 mt-1">Atur order mitra sesuai kapasitas</p>
            </div>

            {/* Worker select */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pekerja</label>
                {loadingWorkers ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <LoadingCircle size="sm" /> Memuat pekerja...
                    </div>
                ) : (
                    <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Pilih pekerja..." />
                        </SelectTrigger>
                        <SelectContent>
                            {workers.map((w) => (
                                <SelectItem key={w.id} value={w.id}>
                                    {w.name}{w.code ? ` (${w.code})` : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* Lot numbers */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lot Number <span className="text-gray-400 font-normal">(satu per baris)</span>
                </label>
                <Textarea
                    value={lotText}
                    onChange={(e) => setLotText(e.target.value)}
                    rows={6}
                    placeholder={'LOT-001\nLOT-002\nLOT-003'}
                />
            </div>

            {/* Lane select */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lane Awal</label>
                <Select value={lane} onValueChange={(v) => setLane(v as WorkLane)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="NEXT_DAY">Besok Dikerjakan</SelectItem>
                        <SelectItem value="IN_PROGRESS">Langsung Dikerjakan</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Summary */}
            {lotNumbers.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                        <span className="font-medium">Total lot:</span> {lotNumbers.length}
                    </p>
                </div>
            )}

            {/* Error message (e.g. WORK_NOT_FINISHED) */}
            {errorMsg && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
                    {errorMsg}
                </div>
            )}

            {/* Submit */}
            <div className="flex items-center gap-3">
                <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Menyimpan...' : 'Buat Work Order'}
                </Button>
                <a
                    href="/trainer/board"
                    className="text-sm text-green-600 hover:text-green-700 hover:underline"
                >
                    Lihat Board →
                </a>
            </div>
        </div>
    );
}

export default function TrainerOrdersPage() {
    return (
        <ProtectedRoute allowedRoles={['trainer', 'manager']}>
            <div className="p-6 md:p-8">
                <TrainerOrdersContent />
            </div>
        </ProtectedRoute>
    );
}
