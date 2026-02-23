'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth/AuthContext';
import {
    assignMitraOrderRequestWorker,
    getMitraOrderRequests,
    getWorkers,
    type MitraOrderRequest,
    type Worker,
} from '@/lib/api';

function TrainerAssignContent() {
    const toast = useToast();
    const { user } = useAuth();
    const [requests, setRequests] = useState<MitraOrderRequest[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [selectedWorkerByRequest, setSelectedWorkerByRequest] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [assigningId, setAssigningId] = useState<string | null>(null);

    const availableWorkers = useMemo(() => {
        if (user?.role !== 'trainer') return workers;
        return workers.filter((worker) => worker.trainerId === user.id);
    }, [user?.id, user?.role, workers]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [requestData, workerData] = await Promise.all([
                getMitraOrderRequests({
                    status: 'REQUESTED',
                    requestedByRole: 'TRAINER',
                    limit: 200,
                }),
                getWorkers(),
            ]);

            setRequests(requestData);
            setWorkers(workerData);
            setSelectedWorkerByRequest(
                requestData.reduce<Record<string, string>>((acc, request) => {
                    if (request.workerId) acc[request.id] = request.workerId;
                    return acc;
                }, {})
            );
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat data assign.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAssign = async (request: MitraOrderRequest) => {
        const workerId = selectedWorkerByRequest[request.id];
        if (!workerId) {
            toast.error('Pilih mitra terlebih dahulu.');
            return;
        }

        setAssigningId(request.id);
        try {
            await assignMitraOrderRequestWorker(request.id, workerId);
            toast.success('Mitra berhasil di-assign ke order trainer.');
            await loadData();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal assign mitra.');
        } finally {
            setAssigningId(null);
        }
    };

    return (
        <div className="space-y-6 p-6 md:p-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Assign Template ke Mitra</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Pilih mitra untuk template order trainer sebelum diproses baku.
                    </p>
                </div>
                <Button variant="outline" onClick={loadData} disabled={loading}>
                    {loading ? 'Memuat...' : 'Refresh'}
                </Button>
            </div>

            {loading ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                    Memuat data template...
                </div>
            ) : availableWorkers.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-700">
                    Daftar mitra binaan masih kosong. Pastikan `trainerId` pada data worker sudah diisi.
                </div>
            ) : requests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                    Tidak ada template trainer yang perlu di-assign.
                </div>
            ) : (
                <div className="space-y-3">
                    {requests.map((request) => {
                        const selectedWorkerId = selectedWorkerByRequest[request.id] ?? '';
                        return (
                            <div key={request.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-base font-semibold text-gray-900">
                                        {request.requestedGram} gram
                                    </p>
                                    <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[10px] font-semibold text-purple-700">
                                        TEMPLATE TRAINER
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Dibuat {new Date(request.createdAt).toLocaleString('id-ID')}
                                </p>
                                {request.lines && request.lines.length > 0 && (
                                    <p className="mt-2 text-xs text-gray-700">
                                        {request.lines
                                            .map((line) => `${line.weightGram}g x ${line.lpCount} LP`)
                                            .join(' | ')}
                                    </p>
                                )}
                                <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                                    <Select
                                        value={selectedWorkerId}
                                        onValueChange={(value) =>
                                            setSelectedWorkerByRequest((prev) => ({ ...prev, [request.id]: value }))
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih mitra untuk template ini" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableWorkers.map((worker) => (
                                                <SelectItem key={worker.id} value={worker.id}>
                                                    {worker.name}
                                                    {worker.capacityGram != null ? ` (kapasitas ${worker.capacityGram}g)` : ''}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        onClick={() => handleAssign(request)}
                                        disabled={assigningId === request.id}
                                    >
                                        {assigningId === request.id ? 'Memproses...' : 'Assign Mitra'}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function TrainerAssignPage() {
    return (
        <ProtectedRoute allowedRoles={['trainer', 'manager']}>
            <TrainerAssignContent />
        </ProtectedRoute>
    );
}
