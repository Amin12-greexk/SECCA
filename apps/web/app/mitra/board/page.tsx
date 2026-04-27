'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageTransition from '@/components/animations/PageTransition';
import StaggerCards from '@/components/animations/StaggerCards';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
    getMyAttendance,
    getMitraOrderRequests,
    getWorkers,
    getWorkOrderBoard,
    markWorkItemReady,
    startWorkItem,
    type MitraAttendanceResponse,
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
        description: 'Cabut bulu, pengeringan, dan menunggu koreksi kering.',
        tone: 'bg-blue-50 text-blue-800 border-blue-200',
        accent: 'text-blue-700',
    },
    READY_TO_SUBMIT: {
        title: 'Ready To Submit',
        description: 'Siap setor setelah koreksi kering selesai.',
        tone: 'bg-green-50 text-green-800 border-green-200',
        accent: 'text-green-700',
    },
};

function getProcessStateLabel(item: WorkOrderBoardItem, lane: LaneKey) {
    if (item.processState === 'DRYING') return 'Pengeringan';
    if (item.processState === 'DRYING_QC') return 'Menunggu Koreksi Kering';
    if (item.processState === 'READY_TO_SUBMIT') return 'Siap Setor';
    if (item.processState === 'NEXT_DAY') return 'Besok Dikerjakan';
    if (item.processState === 'IN_PROGRESS') return 'Cabut Bulu';
    if (lane === 'NEXT_DAY') return 'Besok Dikerjakan';
    if (lane === 'READY_TO_SUBMIT') return 'Siap Setor';
    return 'Cabut Bulu';
}

function canMarkReady(item: WorkOrderBoardItem) {
    return item.processState === 'IN_PROGRESS' || (!item.processState && item.lane === 'IN_PROGRESS');
}

function MitraBoardContent() {
    const toast = useToast();
    const { user } = useAuth();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [board, setBoard] = useState<WorkOrderBoard | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'board' | 'order' | 'attendance'>('board');
    const [orderLoading, setOrderLoading] = useState(false);
    const [attendanceLoading, setAttendanceLoading] = useState(false);
    const [attendance, setAttendance] = useState<MitraAttendanceResponse | null>(null);
    const [attendanceRange, setAttendanceRange] = useState(() => {
        const today = new Date();
        // Cycle starts on Thursday. Calculate the most recent Thursday.
        // JS getDay(): 0 (Sun) to 6 (Sat). Thu is 4.
        const currentDay = today.getDay();
        const daysSinceThursday = (currentDay - 4 + 7) % 7;

        const cycleStart = new Date(today);
        cycleStart.setDate(today.getDate() - daysSinceThursday);
        cycleStart.setHours(0, 0, 0, 0);

        const toISO = (date: Date) => date.toISOString().slice(0, 10);
        return {
            from: toISO(cycleStart),
            to: toISO(today),
        };
    });
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

    const fetchAttendance = async () => {
        if (user?.role !== 'mitra') return;
        setAttendanceLoading(true);
        try {
            const data = await getMyAttendance({
                from: attendanceRange.from || undefined,
                to: attendanceRange.to || undefined,
            });
            setAttendance(data);
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : 'Gagal memuat data absensi.'
            );
        } finally {
            setAttendanceLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedWorkerId) return;
        fetchBoard(selectedWorkerId);
        fetchRequests(selectedWorkerId);
    }, [selectedWorkerId]);

    useEffect(() => {
        if (user?.role !== 'mitra') return;
        fetchAttendance();
    }, [user?.role, attendanceRange.from, attendanceRange.to]);

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
            toast.success('Item masuk proses pengeringan (maksimal 10 jam).');
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
        if (activeTab === 'attendance') {
            await fetchAttendance();
            return;
        }
        if (!selectedWorkerId) return;
        if (activeTab === 'board') {
            await fetchBoard(selectedWorkerId);
            return;
        }
        await fetchRequests(selectedWorkerId);
    };

    return (
        <div className="min-h-[calc(100vh-72px)] bg-gray-50 px-4 py-6 sm:px-6">
            <PageTransition className="mx-auto max-w-6xl space-y-5">
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
                        disabled={
                            loading ||
                            orderLoading ||
                            attendanceLoading ||
                            (activeTab !== 'attendance' && !selectedWorkerId)
                        }
                    >
                        <RefreshCw
                            className={`h-4 w-4 ${(loading || orderLoading || attendanceLoading) ? 'animate-spin' : ''}`}
                        />
                        Refresh
                    </Button>
                </div>

                <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setActiveTab('board')}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${activeTab === 'board'
                            ? 'bg-green-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        Board
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('order')}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${activeTab === 'order'
                            ? 'bg-green-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        Order
                    </button>
                    {user?.role === 'mitra' && (
                        <button
                            type="button"
                            onClick={() => setActiveTab('attendance')}
                            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${activeTab === 'attendance'
                                ? 'bg-green-600 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            Absensi
                        </button>
                    )}
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
                                    className="flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm card-hover"
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
                                    <StaggerCards className="flex-1 space-y-3 p-4" triggerKey={`${lane}-${items.length}`}>
                                        {items.length === 0 ? (
                                            <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">
                                                Belum ada item di lane ini.
                                            </div>
                                        ) : (
                                            items.map((item) => {
                                                const processLabel = getProcessStateLabel(item, lane);
                                                const isInProgressLane = lane === 'IN_PROGRESS';
                                                const showCabutAction = isInProgressLane && canMarkReady(item);
                                                const isDrying = item.processState === 'DRYING';
                                                const isDryingQc = item.processState === 'DRYING_QC';
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={cn(
                                                            'relative overflow-hidden rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all duration-300 card-hover',
                                                            showCabutAction && 'border-blue-200 ring-1 ring-blue-50 animate-pulse-subtle shadow-md shadow-blue-500/5'
                                                        )}
                                                    >
                                                        {/* Optional: subtle ambient background for in progress */}
                                                        {showCabutAction && (
                                                            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 to-transparent pointer-events-none" />
                                                        )}

                                                        <div className="relative z-10">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div>
                                                                    <p className="text-sm font-semibold text-gray-900">
                                                                        {item.lotNumber}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500">
                                                                        Grade: {formatGrade(item)}
                                                                    </p>
                                                                </div>
                                                                <span className={cn(
                                                                    'flex items-center gap-1.5 text-xs font-semibold',
                                                                    laneMeta[lane].accent
                                                                )}>
                                                                    {showCabutAction && (
                                                                        <span className="relative flex h-2 w-2">
                                                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75"></span>
                                                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-current"></span>
                                                                        </span>
                                                                    )}
                                                                    {processLabel}
                                                                </span>
                                                            </div>

                                                            {showCabutAction && (
                                                                <div className="mt-4 space-y-3">
                                                                    {/* Material-style Linear Indeterminate Progress */}
                                                                    <div className="relative h-1 w-full overflow-hidden rounded-full bg-blue-100/50">
                                                                        <div className="animate-progress-linear absolute h-full w-full origin-left bg-blue-500" />
                                                                    </div>

                                                                    <Button
                                                                        className="w-full bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20"
                                                                        size="sm"
                                                                        onClick={() => handleReady(item.id)}
                                                                        disabled={actionLoading === item.id}
                                                                    >
                                                                        {actionLoading === item.id
                                                                            ? 'Memproses...'
                                                                            : 'Selesai Cabut'}
                                                                    </Button>
                                                                </div>
                                                            )}

                                                            {isDrying && (
                                                                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                                                                    Pengeringan berjalan
                                                                    {item.dryingReadyAt
                                                                        ? ` sampai ${new Date(item.dryingReadyAt).toLocaleString('id-ID')}`
                                                                        : '.'}
                                                                </div>
                                                            )}

                                                            {isDryingQc && (
                                                                <div className="mt-3 rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1.5 text-[11px] text-cyan-700">
                                                                    Menunggu proses koreksi kering.
                                                                </div>
                                                            )}

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
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </StaggerCards>
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
                                                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone[request.status] ?? 'bg-gray-50 text-gray-600 border-gray-200'
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

                {activeTab === 'attendance' && user?.role === 'mitra' && (
                    <div className="space-y-4">
                        {user?.role !== 'mitra' && (
                            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                <h2 className="text-base font-semibold text-gray-900">Data Absensi Mitra</h2>
                                <p className="mt-1 text-xs text-gray-600">
                                    Data absensi diambil dari server SPL berdasarkan PIN mitra.
                                </p>
                                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-600">Dari Tanggal</label>
                                        <input
                                            type="date"
                                            value={attendanceRange.from}
                                            onChange={(event) =>
                                                setAttendanceRange((prev) => ({ ...prev, from: event.target.value }))
                                            }
                                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-600">Sampai Tanggal</label>
                                        <input
                                            type="date"
                                            value={attendanceRange.to}
                                            onChange={(event) =>
                                                setAttendanceRange((prev) => ({ ...prev, to: event.target.value }))
                                            }
                                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <Button onClick={fetchAttendance} disabled={attendanceLoading} className="w-full">
                                            {attendanceLoading ? 'Memuat...' : 'Ambil Data'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {user?.role === 'mitra' && (
                            <div className="flex flex-col gap-2 rounded-xl border border-green-100 bg-green-50/50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-base font-semibold text-green-900">Periode Absensi Aktif</h2>
                                    <p className="mt-0.5 text-xs text-green-700">
                                        Siklus mingguan (Kamis s/d Rabu). Data diperbarui otomatis.
                                    </p>
                                </div>
                                <div className="rounded-lg bg-white px-3 py-2 text-center shadow-sm sm:text-right">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Rentang Tanggal</p>
                                    <p className="text-sm font-bold text-gray-700 tabular-nums">
                                        {attendanceRange.from} <span className="mx-1 text-gray-300">→</span> {attendanceRange.to}
                                    </p>
                                </div>
                            </div>
                        )}

                        {attendance && (
                            <>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                                        <p className="text-xs text-gray-500">Total Record</p>
                                        <p className="text-xl font-semibold text-gray-900">
                                            {attendance.summary.totalRecords}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-green-200 bg-green-50 p-3 shadow-sm">
                                        <p className="text-xs text-green-700">Hari Hadir</p>
                                        <p className="text-xl font-semibold text-green-800">
                                            {attendance.summary.presentDays}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 shadow-sm">
                                        <p className="text-xs text-blue-700">Basis Premi (hari)</p>
                                        <p className="text-xl font-semibold text-blue-800">
                                            {attendance.summary.estimatedPremiumBaseDays}
                                        </p>
                                    </div>
                                </div>

                                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Tanggal</th>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Masuk</th>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Pulang</th>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Catatan</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {attendance.items.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-gray-500">
                                                            Tidak ada data absensi pada periode ini.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    attendance.items.map((item, index) => {
                                                        const isSunday = item.date ? new Date(item.date).getDay() === 0 : false;
                                                        return (
                                                            <tr
                                                                key={`${item.date ?? 'no-date'}-${index}`}
                                                                className={isSunday ? 'bg-red-50/50' : ''}
                                                            >
                                                                <td className="px-3 py-2 text-gray-700">
                                                                    {item.date ?? '-'}
                                                                    {isSunday && (
                                                                        <span className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">LIBUR</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 text-gray-700">{item.checkIn ?? '-'}</td>
                                                                <td className="px-3 py-2 text-gray-700">{item.checkOut ?? '-'}</td>
                                                                <td className="px-3 py-2 text-gray-700">
                                                                    <span className={isSunday ? 'font-medium text-red-600' : ''}>
                                                                        {item.status ?? '-'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-gray-700">{item.note ?? '-'}</td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </PageTransition>
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
