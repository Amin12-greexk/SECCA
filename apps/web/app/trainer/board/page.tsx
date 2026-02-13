'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import LoadingCircle from '@/components/LoadingCircle';
import { useToast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type {
    Worker,
    WorkOrderBoard,
    WorkOrderBoardItem,
    WorkLane,
} from '@/lib/api';
import {
    getWorkers,
    getWorkOrderBoard,
    startWorkItem,
    markWorkItemReady,
} from '@/lib/api';

// ---------- Sub-components ----------

function WorkItemCard({
    item,
    lane,
    onAction,
    actionLoading,
}: {
    item: WorkOrderBoardItem;
    lane: WorkLane;
    onAction?: (id: string) => void;
    actionLoading: string | null;
}) {
    const gradeLabel = [item.grade?.shape, item.grade?.feather, item.grade?.color]
        .filter(Boolean)
        .join(' / ');

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900 text-sm">{item.lotNumber}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {item.status}
                </span>
            </div>

            {gradeLabel && (
                <p className="text-xs text-gray-500">{gradeLabel}</p>
            )}

            {onAction && (
                <Button
                    size="sm"
                    className="w-full mt-1"
                    disabled={actionLoading === item.id}
                    onClick={() => onAction(item.id)}
                >
                    {actionLoading === item.id
                        ? 'Memproses...'
                        : lane === 'NEXT_DAY'
                            ? 'Mulai'
                            : 'Siap Diserahkan'}
                </Button>
            )}
        </div>
    );
}

function LaneColumn({
    title,
    count,
    items,
    lane,
    onAction,
    actionLoading,
}: {
    title: string;
    count: number;
    items: WorkOrderBoardItem[];
    lane: WorkLane;
    onAction?: (id: string) => void;
    actionLoading: string | null;
}) {
    const bgColor =
        lane === 'NEXT_DAY'
            ? 'bg-blue-50 border-blue-200'
            : lane === 'IN_PROGRESS'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-green-50 border-green-200';

    return (
        <div className={`border rounded-lg ${bgColor} flex flex-col`}>
            <div className="flex items-center justify-between p-3 border-b border-inherit">
                <h3 className="font-semibold text-sm text-gray-800">{title}</h3>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white text-gray-700 border border-gray-200">
                    {count}
                </span>
            </div>
            <div className="p-3 space-y-2 flex-1 overflow-y-auto max-h-[60vh]">
                {items.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">Tidak ada item</p>
                )}
                {items.map((item) => (
                    <WorkItemCard
                        key={item.id}
                        item={item}
                        lane={lane}
                        onAction={onAction}
                        actionLoading={actionLoading}
                    />
                ))}
            </div>
        </div>
    );
}

// ---------- Main content ----------

function TrainerBoardContent() {
    const { user } = useAuth();
    const toast = useToast();

    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loadingWorkers, setLoadingWorkers] = useState(true);
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [board, setBoard] = useState<WorkOrderBoard | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Load workers
    useEffect(() => {
        getWorkers()
            .then((list) => {
                if (user?.role === 'trainer') {
                    setWorkers(list.filter((w) => w.trainerId === user.id));
                } else {
                    setWorkers(list);
                }
            })
            .catch((err) => toast.error(err.message))
            .finally(() => setLoadingWorkers(false));
    }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

    // Load board
    const fetchBoard = useCallback(async () => {
        if (!selectedWorkerId) {
            setBoard(null);
            return;
        }
        setLoading(true);
        try {
            const data = await getWorkOrderBoard(selectedWorkerId);
            setBoard(data);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Gagal memuat board');
        } finally {
            setLoading(false);
        }
    }, [selectedWorkerId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        fetchBoard();
    }, [fetchBoard]);

    // Actions
    const handleStart = async (id: string) => {
        setActionLoading(id);
        try {
            await startWorkItem(id);
            toast.success('Item dimulai');
            fetchBoard();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Gagal memulai item');
        } finally {
            setActionLoading(null);
        }
    };

    const handleMarkReady = async (id: string) => {
        setActionLoading(id);
        try {
            await markWorkItemReady(id);
            toast.success('Item siap diserahkan');
            fetchBoard();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Gagal menandai item');
        } finally {
            setActionLoading(null);
        }
    };

    if (!user) return null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Board Trainer</h1>
                    <p className="text-sm text-gray-500 mt-1">Pantau pekerjaan mitra yang Anda kelola</p>
                </div>
                <a
                    href="/trainer/orders"
                    className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 hover:underline"
                >
                    + Buat Order Baru
                </a>
            </div>

            {/* Worker selector */}
            <div className="max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Pekerja</label>
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

            {/* Loading */}
            {loading && (
                <div className="flex justify-center py-12">
                    <LoadingCircle size="lg" />
                </div>
            )}

            {/* No worker selected */}
            {!loading && !selectedWorkerId && (
                <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
                    <div className="text-4xl mb-3">👤</div>
                    <h3 className="font-semibold text-gray-700">Pilih pekerja terlebih dahulu</h3>
                </div>
            )}

            {/* Empty state */}
            {!loading && selectedWorkerId && !board?.activeWorkOrder && (
                <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
                    <div className="text-4xl mb-3">📋</div>
                    <h3 className="font-semibold text-gray-700">Tidak ada work order aktif</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        <a href="/trainer/orders" className="text-green-600 hover:underline">
                            Buat order baru
                        </a>{' '}
                        untuk pekerja ini.
                    </p>
                </div>
            )}

            {/* Active work order summary */}
            {!loading && board?.activeWorkOrder && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-wrap items-center gap-4 text-sm">
                    <div>
                        <span className="text-gray-500">Work Order:</span>{' '}
                        <span className="font-medium text-gray-900">{board.activeWorkOrder.id.slice(0, 8)}...</span>
                    </div>
                    <div>
                        <span className="text-gray-500">Status:</span>{' '}
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            {board.activeWorkOrder.status}
                        </span>
                    </div>
                </div>
            )}

            {/* Board lanes */}
            {!loading && board?.activeWorkOrder && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <LaneColumn
                        title="Besok Dikerjakan"
                        count={board.counts.NEXT_DAY}
                        items={board.lanes.NEXT_DAY}
                        lane="NEXT_DAY"
                        onAction={handleStart}
                        actionLoading={actionLoading}
                    />
                    <LaneColumn
                        title="Sedang Dikerjakan"
                        count={board.counts.IN_PROGRESS}
                        items={board.lanes.IN_PROGRESS}
                        lane="IN_PROGRESS"
                        onAction={handleMarkReady}
                        actionLoading={actionLoading}
                    />
                    <LaneColumn
                        title="Siap Diserahkan"
                        count={board.counts.READY_TO_SUBMIT}
                        items={board.lanes.READY_TO_SUBMIT}
                        lane="READY_TO_SUBMIT"
                        actionLoading={actionLoading}
                    />
                </div>
            )}
        </div>
    );
}

// ---------- Page export ----------

export default function TrainerBoardPage() {
    return (
        <ProtectedRoute allowedRoles={['trainer', 'manager']}>
            <div className="p-6 md:p-8">
                <TrainerBoardContent />
            </div>
        </ProtectedRoute>
    );
}
