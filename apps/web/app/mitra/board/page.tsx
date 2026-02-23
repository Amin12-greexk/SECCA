'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
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
    createMitraOrderRequest,
    getMitraOrderRequests,
    getWorkers,
    getWorkOrderBoard,
    markWorkItemReady,
    startWorkItem,
    type MitraOrderRequest,
    type WorkOrderBoard,
    type WorkOrderBoardItem,
    type Worker,
} from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';

type LaneKey = 'NEXT_DAY' | 'IN_PROGRESS' | 'READY_TO_SUBMIT';
type OrderLineDraft = {
    id: string;
    weightGram: string;
    lpCount: string;
};

const createLineId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

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
    const [activeTab, setActiveTab] = useState<'board' | 'order'>('board');
    const [orderLoading, setOrderLoading] = useState(false);
    const [requests, setRequests] = useState<MitraOrderRequest[]>([]);
    const [orderSubmitting, setOrderSubmitting] = useState(false);
    const [requestForm, setRequestForm] = useState({
        requestedGram: '',
        note: '',
    });
    const [orderLines, setOrderLines] = useState<OrderLineDraft[]>([
        { id: createLineId(), weightGram: '', lpCount: '' },
    ]);

    const isTrainerOrderMode = user?.role === 'trainer';

    const orderLinesWithNumber = useMemo(
        () =>
            orderLines.map((line) => {
                const weightGram = Number(line.weightGram);
                const lpCount = Number(line.lpCount);
                const valid = Number.isFinite(weightGram) && weightGram > 0 && Number.isFinite(lpCount) && lpCount > 0;
                return {
                    ...line,
                    weightGramNumber: valid ? Math.round(weightGram) : 0,
                    lpCountNumber: valid ? Math.round(lpCount) : 0,
                    valid,
                };
            }),
        [orderLines]
    );

    const trainerRequestedGram = useMemo(
        () =>
            orderLinesWithNumber.reduce((sum, line) => {
                if (!line.valid) return sum;
                return sum + line.weightGramNumber * line.lpCountNumber;
            }, 0),
        [orderLinesWithNumber]
    );

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

    const fetchRequests = async (workerId: string) => {
        setOrderLoading(true);
        try {
            const data = await getMitraOrderRequests({
                workerId,
                limit: 100,
            });
            setRequests(data);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'Gagal memuat order mitra.'
            );
        } finally {
            setOrderLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedWorkerId) return;
        fetchBoard(selectedWorkerId);
        fetchRequests(selectedWorkerId);
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

    const statusTone: Record<string, string> = {
        REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200',
        APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
        REJECTED: 'bg-red-50 text-red-700 border-red-200',
        FULFILLED: 'bg-green-50 text-green-700 border-green-200',
    };

    const addOrderLine = () => {
        setOrderLines((prev) => [
            ...prev,
            { id: createLineId(), weightGram: '', lpCount: '' },
        ]);
    };

    const removeOrderLine = (lineId: string) => {
        setOrderLines((prev) =>
            prev.length === 1 ? prev : prev.filter((line) => line.id !== lineId)
        );
    };

    const updateOrderLine = (
        lineId: string,
        field: keyof Pick<OrderLineDraft, 'weightGram' | 'lpCount'>,
        value: string
    ) => {
        setOrderLines((prev) =>
            prev.map((line) =>
                line.id === lineId
                    ? {
                          ...line,
                          [field]: value,
                      }
                    : line
            )
        );
    };

    const handleCreateOrderRequest = async () => {
        if (!selectedWorkerId) {
            toast.error('Pilih mitra terlebih dahulu.');
            return;
        }

        const trainerLines = orderLinesWithNumber
            .filter((line) => line.valid)
            .map((line) => ({
                weightGram: line.weightGramNumber,
                lpCount: line.lpCountNumber,
            }));

        const requestedGram = Number(requestForm.requestedGram);
        if (isTrainerOrderMode) {
            if (trainerLines.length === 0) {
                toast.error('Isi minimal satu baris template (berat x jumlah LP).');
                return;
            }
        } else if (!Number.isFinite(requestedGram) || requestedGram <= 0) {
            toast.error('Masukkan target gram yang valid.');
            return;
        }

        setOrderSubmitting(true);
        try {
            await createMitraOrderRequest({
                workerId: selectedWorkerId,
                requestedGram: isTrainerOrderMode ? undefined : Math.round(requestedGram),
                lines: isTrainerOrderMode ? trainerLines : undefined,
                note: requestForm.note.trim() || undefined,
            });
            toast.success('Order mitra berhasil diajukan.');
            setRequestForm({ requestedGram: '', note: '' });
            setOrderLines([{ id: createLineId(), weightGram: '', lpCount: '' }]);
            await fetchRequests(selectedWorkerId);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'Gagal membuat order mitra.'
            );
        } finally {
            setOrderSubmitting(false);
        }
    };

    const refreshActiveTab = async () => {
        if (!selectedWorkerId) return;
        if (activeTab === 'board') {
            await fetchBoard(selectedWorkerId);
            return;
        }
        await fetchRequests(selectedWorkerId);
    };

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
                        onClick={refreshActiveTab}
                        disabled={(loading || orderLoading) || !selectedWorkerId}
                    >
                        <RefreshCw className={`h-4 w-4 ${(loading || orderLoading) ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setActiveTab('board')}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                            activeTab === 'board'
                                ? 'bg-green-600 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        Board
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('order')}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                            activeTab === 'order'
                                ? 'bg-green-600 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        Order
                    </button>
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

                {selectedWorkerId && board && activeTab === 'board' && (
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

                {selectedWorkerId && activeTab === 'order' && (
                    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
                        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <h2 className="text-base font-semibold text-gray-900">Ajukan Order Baru</h2>
                            <p className="mt-1 text-xs text-gray-600">
                                Masukkan target gram. Grade akan mengikuti lot yang disiapkan baku.
                            </p>

                            <div className="mt-4 space-y-3">
                                {isTrainerOrderMode ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-medium text-gray-600">
                                                Template Order (Berat x Jumlah LP)
                                            </label>
                                            <Button type="button" size="sm" variant="outline" onClick={addOrderLine}>
                                                <Plus className="h-4 w-4" />
                                                Tambah
                                            </Button>
                                        </div>
                                        <div className="space-y-2">
                                            {orderLines.map((line, index) => (
                                                <div key={line.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={line.weightGram}
                                                        onChange={(event) =>
                                                            updateOrderLine(line.id, 'weightGram', event.target.value)
                                                        }
                                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                                                        placeholder={`Berat LP #${index + 1}`}
                                                    />
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={line.lpCount}
                                                        onChange={(event) =>
                                                            updateOrderLine(line.id, 'lpCount', event.target.value)
                                                        }
                                                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                                                        placeholder="Jumlah LP"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeOrderLine(line.id)}
                                                        disabled={orderLines.length <= 1}
                                                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                                            Total target: <span className="font-semibold">{trainerRequestedGram}</span> gram
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-600">Target Berat (gram)</label>
                                        <input
                                            type="number"
                                            min={1}
                                            value={requestForm.requestedGram}
                                            onChange={(event) =>
                                                setRequestForm((prev) => ({
                                                    ...prev,
                                                    requestedGram: event.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                                            placeholder="Contoh: 75"
                                        />
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-gray-600">Catatan (opsional)</label>
                                    <textarea
                                        value={requestForm.note}
                                        onChange={(event) =>
                                            setRequestForm((prev) => ({
                                                ...prev,
                                                note: event.target.value,
                                            }))
                                        }
                                        className="min-h-[90px] w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                                        placeholder="Contoh: kebutuhan besok pagi"
                                    />
                                </div>
                                <Button
                                    className="w-full"
                                    onClick={handleCreateOrderRequest}
                                    disabled={orderSubmitting}
                                >
                                    {orderSubmitting ? 'Mengirim...' : 'Ajukan Order'}
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                            <h2 className="text-base font-semibold text-gray-900">Riwayat Order Mitra</h2>
                            <p className="mt-1 text-xs text-gray-600">
                                Pantau status order: Request, disetujui, ditolak, atau selesai dipenuhi.
                            </p>

                            <div className="mt-4 space-y-2">
                                {orderLoading ? (
                                    <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">
                                        Memuat order...
                                    </div>
                                ) : requests.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">
                                        Belum ada order mitra.
                                    </div>
                                ) : (
                                    requests.map((request) => (
                                        <div
                                            key={request.id}
                                            className="rounded-lg border border-gray-200 px-3 py-3"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-semibold text-gray-900">
                                                    {request.requestedGram} gram
                                                </p>
                                                <div className="flex items-center gap-1.5">
                                                    {request.requestedBy?.role === 'TRAINER' && (
                                                        <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                                                            PRIORITAS TRAINER
                                                        </span>
                                                    )}
                                                    <span
                                                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                                            statusTone[request.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'
                                                        }`}
                                                    >
                                                        {request.status}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {new Date(request.createdAt).toLocaleString('id-ID')}
                                            </p>
                                            {request.lines && request.lines.length > 0 && (
                                                <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px] text-gray-700">
                                                    {request.lines
                                                        .map((line) => `${line.weightGram}g x ${line.lpCount} LP`)
                                                        .join(' | ')}
                                                </div>
                                            )}
                                            {request.note && (
                                                <p className="mt-2 text-xs text-gray-700">{request.note}</p>
                                            )}
                                            {request.rejectionReason && (
                                                <p className="mt-2 text-xs font-medium text-red-600">
                                                    Alasan ditolak: {request.rejectionReason}
                                                </p>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
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
