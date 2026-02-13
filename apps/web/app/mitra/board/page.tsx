'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
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
import {
    getWorkers,
    getWorkOrderBoard,
    markWorkItemReady,
    startWorkItem,
    type WorkOrderBoard,
    type WorkOrderBoardItem,
    type Worker,
} from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';

type LaneKey = 'NEXT_DAY' | 'IN_PROGRESS' | 'READY_TO_SUBMIT';

const laneMeta: Record<
    LaneKey,
    { title: string; description: string; tone: string; accent: string }
> = {
    NEXT_DAY: {
        title: 'Next Day',
        description: 'Daftar pekerjaan untuk besok.',
        tone: 'bg-amber-50 text-amber-800 border-amber-200',
        accent: 'text-amber-700',
    },
    IN_PROGRESS: {
        title: 'In Progress',
        description: 'Sedang dikerjakan sekarang.',
        tone: 'bg-blue-50 text-blue-800 border-blue-200',
        accent: 'text-blue-700',
    },
    READY_TO_SUBMIT: {
        title: 'Ready',
        description: 'Siap diserahkan ke pengawas.',
        tone: 'bg-green-50 text-green-800 border-green-200',
        accent: 'text-green-700',
    },
};

function MitraBoardContent() {
    const toast = useToast();
    const { user } = useAuth();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [board, setBoard] = useState<WorkOrderBoard | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        if (user?.workerId) {
            setSelectedWorkerId(user.workerId);
            return;
        }
        const loadWorkers = async () => {
            try {
                const list = await getWorkers();
                setWorkers(list);
                if (list.length > 0) {
                    setSelectedWorkerId((prev) => prev || list[0].id);
                }
            } catch (error) {
                toast.error(
                    error instanceof Error ? error.message : 'Gagal memuat mitra.'
                );
            }
        };
        loadWorkers();
    }, [toast, user?.workerId]);

    const activeWorker = useMemo(
        () => workers.find((worker) => worker.id === selectedWorkerId),
        [selectedWorkerId, workers]
    );

    const fetchBoard = async (workerId: string) => {
        setLoading(true);
        try {
            const data = await getWorkOrderBoard(workerId);
            setBoard(data);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'Gagal memuat board.'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedWorkerId) return;
        fetchBoard(selectedWorkerId);
    }, [selectedWorkerId]);

    const handleStart = async (itemId: string) => {
        setActionLoading(itemId);
        try {
            await startWorkItem(itemId);
            toast.success('Item dimulai.');
            if (selectedWorkerId) await fetchBoard(selectedWorkerId);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memulai item.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReady = async (itemId: string) => {
        setActionLoading(itemId);
        try {
            await markWorkItemReady(itemId);
            toast.success('Item siap diserahkan.');
            if (selectedWorkerId) await fetchBoard(selectedWorkerId);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'Gagal ubah ke siap.'
            );
        } finally {
            setActionLoading(null);
        }
    };

    const formatGrade = (item: WorkOrderBoardItem) => {
        const parts = [item.grade?.shape, item.grade?.feather, item.grade?.color].filter(
            Boolean
        );
        if (parts.length === 0) return '-';
        return parts.join('/');
    };

    const lanes: LaneKey[] = ['NEXT_DAY', 'IN_PROGRESS', 'READY_TO_SUBMIT'];

    return (
        <div className="min-h-[calc(100vh-72px)] bg-gray-50 px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-6xl space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">Board Mitra</h1>
                        <p className="text-sm text-gray-600">
                            Pantau pekerjaan berdasarkan status harian.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => selectedWorkerId && fetchBoard(selectedWorkerId)}
                        disabled={loading || !selectedWorkerId}
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {!user?.workerId && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <p className="text-sm font-medium text-gray-700">Pilih Mitra</p>
                        <div className="mt-3 max-w-md">
                            <Select
                                value={selectedWorkerId}
                                onValueChange={(value) => setSelectedWorkerId(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih mitra" />
                                </SelectTrigger>
                                <SelectContent>
                                    {workers.map((worker) => (
                                        <SelectItem key={worker.id} value={worker.id}>
                                            {worker.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                {selectedWorkerId && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold text-gray-500">Mitra Aktif</p>
                                <p className="text-lg font-semibold text-gray-900">
                                    {activeWorker?.name ?? 'Mitra'}
                                </p>
                            </div>
                            <div className="text-sm text-gray-600">
                                {board?.activeWorkOrder ? (
                                    <span>
                                        Work Order: <strong>{board.activeWorkOrder.id}</strong>
                                    </span>
                                ) : (
                                    <span>Belum ada work order aktif.</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {!selectedWorkerId && (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
                        Pilih mitra untuk melihat board.
                    </div>
                )}

                {selectedWorkerId && board && (
                    <div className="grid gap-4 md:grid-cols-3">
                        {lanes.map((lane) => {
                            const items = board.lanes[lane];
                            return (
                                <div
                                    key={lane}
                                    className="flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm"
                                >
                                    <div className={`rounded-t-xl border-b p-4 ${laneMeta[lane].tone}`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold">
                                                    {laneMeta[lane].title}
                                                </p>
                                                <p className="text-xs">{laneMeta[lane].description}</p>
                                            </div>
                                            <span className="text-sm font-semibold">{items.length}</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-3 p-4">
                                        {items.length === 0 ? (
                                            <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">
                                                Belum ada item di lane ini.
                                            </div>
                                        ) : (
                                            items.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900">
                                                                {item.lotNumber}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                Grade: {formatGrade(item)}
                                                            </p>
                                                        </div>
                                                        <span className={`text-xs font-semibold ${laneMeta[lane].accent}`}>
                                                            {item.lane.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    {lane === 'NEXT_DAY' && (
                                                        <Button
                                                            className="mt-3 w-full"
                                                            size="sm"
                                                            onClick={() => handleStart(item.id)}
                                                            disabled={actionLoading === item.id}
                                                        >
                                                            {actionLoading === item.id ? 'Memproses...' : 'Mulai'}
                                                        </Button>
                                                    )}
                                                    {lane === 'IN_PROGRESS' && (
                                                        <Button
                                                            className="mt-3 w-full"
                                                            size="sm"
                                                            onClick={() => handleReady(item.id)}
                                                            disabled={actionLoading === item.id}
                                                        >
                                                            {actionLoading === item.id
                                                                ? 'Memproses...'
                                                                : 'Siap Diserahkan'}
                                                        </Button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function MitraBoardPage() {
    return (
        <ProtectedRoute allowedRoles={['mitra', 'manager']}>
            <MitraBoardContent />
        </ProtectedRoute>
    );
}
