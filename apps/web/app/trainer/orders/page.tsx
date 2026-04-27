'use client';

import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Plus, RefreshCw } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/lib/toast';
import {
    createTrainerBulkOrderRequest,
    getTrainerOrderWorkers,
    type TrainerWorkerOrderCandidate,
} from '@/lib/api';

type WorkerDraft = {
    weightGram: string;
    lpCount: string;
};

const presetWeights = [25, 50, 75, 100];

function WorkerStatusBadge({
    hasActiveWorkOrder,
    isOrderEligible,
}: {
    hasActiveWorkOrder: boolean;
    isOrderEligible: boolean;
}) {
    if (hasActiveWorkOrder) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Sedang Produksi
            </span>
        );
    }

    if (isOrderEligible) {
        return (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Siap Diorder
            </span>
        );
    }

    return (
        <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600">
            Menunggu
        </span>
    );
}

function TrainerOrdersContent() {
    const toast = useToast();
    const [workers, setWorkers] = useState<TrainerWorkerOrderCandidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
    const [draftByWorker, setDraftByWorker] = useState<Record<string, WorkerDraft>>({});
    const [note, setNote] = useState('');

    const loadWorkers = async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const data = await getTrainerOrderWorkers();
            setWorkers(data);
            setSelectedWorkerIds((prev) =>
                prev.filter((workerId) => data.some((worker) => worker.id === workerId))
            );
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat daftar mitra.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadWorkers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredWorkers = useMemo(() => {
        const normalized = searchTerm.trim().toLowerCase();
        if (!normalized) return workers;
        return workers.filter((worker) => {
            const code = worker.code?.toLowerCase() ?? '';
            return worker.name.toLowerCase().includes(normalized) || code.includes(normalized);
        });
    }, [searchTerm, workers]);

    const eligibleWorkerIds = useMemo(
        () => workers.filter((worker) => worker.isOrderEligible).map((worker) => worker.id),
        [workers]
    );

    const selectedWorkers = useMemo(
        () => workers.filter((worker) => selectedWorkerIds.includes(worker.id)),
        [selectedWorkerIds, workers]
    );

    const selectedEligibleWorkers = useMemo(
        () => selectedWorkers.filter((worker) => worker.isOrderEligible),
        [selectedWorkers]
    );

    const canOpenModal = selectedEligibleWorkers.length > 0;

    const totalEligible = eligibleWorkerIds.length;
    const totalBusy = workers.length - totalEligible;
    const monthlyTotalCapacity = useMemo(
        () =>
            workers.reduce(
                (sum, worker) => sum + (worker.capacityStats?.monthlyDryInGram ?? 0),
                0
            ),
        [workers]
    );

    const toggleWorker = (workerId: string) => {
        setSelectedWorkerIds((prev) =>
            prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]
        );
        setDraftByWorker((prev) => {
            if (prev[workerId]) return prev;
            return {
                ...prev,
                [workerId]: {
                    weightGram: '',
                    lpCount: '',
                },
            };
        });
    };

    const toggleSelectEligible = () => {
        const allSelected = eligibleWorkerIds.length > 0 && eligibleWorkerIds.every((id) => selectedWorkerIds.includes(id));
        if (allSelected) {
            setSelectedWorkerIds((prev) => prev.filter((id) => !eligibleWorkerIds.includes(id)));
            return;
        }
        setSelectedWorkerIds((prev) => Array.from(new Set([...prev, ...eligibleWorkerIds])));
        setDraftByWorker((prev) => {
            const next = { ...prev };
            eligibleWorkerIds.forEach((workerId) => {
                if (!next[workerId]) {
                    next[workerId] = { weightGram: '', lpCount: '' };
                }
            });
            return next;
        });
    };

    const setDraftField = (workerId: string, field: keyof WorkerDraft, value: string) => {
        setDraftByWorker((prev) => ({
            ...prev,
            [workerId]: {
                weightGram: prev[workerId]?.weightGram ?? '',
                lpCount: prev[workerId]?.lpCount ?? '',
                [field]: value,
            },
        }));
    };

    const normalizedAssignments = useMemo(
        () =>
            selectedEligibleWorkers
                .map((worker) => {
                    const draft = draftByWorker[worker.id] ?? { weightGram: '', lpCount: '' };
                    const weightGram = Number(draft.weightGram);
                    const lpCount = Number(draft.lpCount);
                    const valid =
                        Number.isFinite(weightGram) &&
                        weightGram > 0 &&
                        Number.isFinite(lpCount) &&
                        lpCount > 0;
                    return {
                        workerId: worker.id,
                        weightGram: valid ? Math.round(weightGram) : 0,
                        lpCount: valid ? Math.round(lpCount) : 0,
                        valid,
                    };
                }),
        [draftByWorker, selectedEligibleWorkers]
    );

    const allAssignmentsValid =
        normalizedAssignments.length > 0 &&
        normalizedAssignments.every((assignment) => assignment.valid);

    const preview = useMemo(() => {
        const grouped = new Map<number, number>();
        let totalGram = 0;
        let totalLp = 0;

        normalizedAssignments.forEach((assignment) => {
            if (!assignment.valid) return;
            grouped.set(
                assignment.weightGram,
                (grouped.get(assignment.weightGram) ?? 0) + assignment.lpCount
            );
            totalGram += assignment.weightGram * assignment.lpCount;
            totalLp += assignment.lpCount;
        });

        return {
            totalGram,
            totalLp,
            groupedLines: Array.from(grouped.entries()).sort((left, right) => right[0] - left[0]),
        };
    }, [normalizedAssignments]);

    const openModal = () => {
        if (!canOpenModal) {
            toast.error('Pilih minimal 1 mitra yang siap order.');
            return;
        }

        const blocked = selectedWorkers.filter((worker) => !worker.isOrderEligible);
        if (blocked.length > 0) {
            toast.error(
                `Ada ${blocked.length} mitra yang belum eligible. Hapus dari pilihan sebelum lanjut.`
            );
            return;
        }

        setModalOpen(true);
    };

    const submitBulkOrder = async () => {
        if (!allAssignmentsValid) {
            toast.error('Lengkapi berat per LP dan jumlah LP untuk semua mitra terpilih.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = normalizedAssignments.map((assignment) => ({
                workerId: assignment.workerId,
                weightGram: assignment.weightGram,
                lpCount: assignment.lpCount,
            }));
            const response = await createTrainerBulkOrderRequest({
                assignments: payload,
                note: note.trim() || undefined,
                createIndividualRequests: true,
            });

            toast.success(
                `Order bulk tersimpan (${response.summary.totalLp} LP / ${response.summary.totalRequestedGram.toLocaleString('id-ID')} gram).`
            );
            setModalOpen(false);
            setSelectedWorkerIds([]);
            setDraftByWorker({});
            setNote('');
            await loadWorkers(true);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal membuat order bulk.');
        } finally {
            setSubmitting(false);
        }
    };

    const allEligibleSelected =
        eligibleWorkerIds.length > 0 && eligibleWorkerIds.every((id) => selectedWorkerIds.includes(id));

    return (
        <div className="space-y-6 p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Orderkan Mitra</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Pilih beberapa mitra binaan, isi target LP per mitra, lalu kirim template ke baku. LP yang dipecah akan otomatis ter-assign sesuai order.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => loadWorkers(true)} disabled={refreshing || loading}>
                        <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button onClick={openModal} disabled={!canOpenModal || loading}>
                        <Plus className="h-4 w-4" />
                        Orderkan Mitra ({selectedEligibleWorkers.length})
                    </Button>
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-500">Total Mitra Binaan</p>
                    <p className="text-2xl font-semibold text-gray-900">{workers.length}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs text-emerald-700">Siap Diorder</p>
                    <p className="text-2xl font-semibold text-emerald-800">{totalEligible}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-700">Sedang Proses / Pending</p>
                    <p className="text-2xl font-semibold text-amber-800">{totalBusy}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs text-blue-700">Kapasitas Aktual Bulan Ini (Setoran)</p>
                    <p className="text-2xl font-semibold text-blue-800">
                        {monthlyTotalCapacity.toLocaleString('id-ID')} gr
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-600">Cari Mitra</p>
                        <Input
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Cari nama / kode mitra"
                        />
                    </div>
                    <div className="flex items-end">
                        <Button variant="outline" onClick={toggleSelectEligible} disabled={eligibleWorkerIds.length === 0}>
                            {allEligibleSelected ? 'Uncheck Eligible' : 'Check Eligible'}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="max-h-[65vh] overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-3 py-2 text-left">Pilih</th>
                                <th className="px-3 py-2 text-left">Mitra</th>
                                <th className="px-3 py-2 text-left">Kapasitas Aktual</th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th className="px-3 py-2 text-left">Order Pending</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                                        Memuat daftar mitra...
                                    </td>
                                </tr>
                            ) : filteredWorkers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                                        Tidak ada mitra yang sesuai.
                                    </td>
                                </tr>
                            ) : (
                                filteredWorkers.map((worker) => (
                                    <tr key={worker.id}>
                                        <td className="px-3 py-2">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300"
                                                checked={selectedWorkerIds.includes(worker.id)}
                                                onChange={() => toggleWorker(worker.id)}
                                                disabled={!worker.isOrderEligible}
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            <p className="font-medium text-gray-900">{worker.name}</p>
                                            <p className="text-xs text-gray-500">{worker.code ?? worker.id.slice(0, 8)}</p>
                                        </td>
                                        <td className="px-3 py-2 text-gray-700">
                                            <div className="text-xs text-gray-700">
                                                <p>Minggu ini: {(worker.capacityStats?.currentWeekDryInGram ?? 0).toLocaleString('id-ID')} gr</p>
                                                <p className="text-gray-500">
                                                    Rata2/minggu bulan ini: {(worker.capacityStats?.avgWeeklyDryInGram ?? 0).toLocaleString('id-ID')} gr
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2">
                                            <WorkerStatusBadge
                                                hasActiveWorkOrder={worker.hasActiveWorkOrder}
                                                isOrderEligible={worker.isOrderEligible}
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-gray-700">
                                            {worker.pendingOrderCount > 0 && worker.pendingOrder ? (
                                                <div className="text-xs">
                                                    <p className="font-medium">{worker.pendingOrder.requestedGram} gr</p>
                                                    <p className="text-gray-500">{worker.pendingOrder.status}</p>
                                                </div>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Orderkan Mitra Terpilih</DialogTitle>
                        <DialogDescription>
                            Isi berat per LP dan jumlah LP untuk tiap mitra yang dipilih.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="overflow-hidden rounded-lg border border-gray-200">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Mitra</th>
                                        <th className="px-3 py-2 text-left">Berat / LP</th>
                                        <th className="px-3 py-2 text-left">Jumlah LP</th>
                                        <th className="px-3 py-2 text-left">Total (gr)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {selectedEligibleWorkers.map((worker) => {
                                        const draft = draftByWorker[worker.id] ?? { weightGram: '', lpCount: '' };
                                        const weightGram = Number(draft.weightGram);
                                        const lpCount = Number(draft.lpCount);
                                        const total = Number.isFinite(weightGram) && Number.isFinite(lpCount)
                                            ? Math.max(0, Math.round(weightGram)) * Math.max(0, Math.round(lpCount))
                                            : 0;

                                        return (
                                            <tr key={worker.id}>
                                                <td className="px-3 py-2">
                                                    <p className="font-medium text-gray-900">{worker.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        Minggu ini: {(worker.capacityStats?.currentWeekDryInGram ?? 0).toLocaleString('id-ID')} gr
                                                    </p>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="space-y-1.5">
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            value={draft.weightGram}
                                                            onChange={(event) =>
                                                                setDraftField(worker.id, 'weightGram', event.target.value)
                                                            }
                                                            placeholder="contoh 75"
                                                            className="h-9"
                                                        />
                                                        <div className="flex flex-wrap gap-1">
                                                            {presetWeights.map((preset) => (
                                                                <button
                                                                    key={preset}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setDraftField(worker.id, 'weightGram', String(preset))
                                                                    }
                                                                    className="rounded border border-gray-200 px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50"
                                                                >
                                                                    {preset}g
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        value={draft.lpCount}
                                                        onChange={(event) =>
                                                            setDraftField(worker.id, 'lpCount', event.target.value)
                                                        }
                                                        placeholder="contoh 5"
                                                        className="h-9"
                                                    />
                                                </td>
                                                <td className="px-3 py-2 font-semibold text-gray-900">
                                                    {total.toLocaleString('id-ID')}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="space-y-1.5">
                            <p className="text-xs font-medium text-gray-600">Catatan (opsional)</p>
                            <Textarea
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                placeholder="Contoh: prioritas setoran Rabu pagi"
                            />
                        </div>

                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                            <p className="font-semibold">
                                Preview template: {preview.totalLp} LP / {preview.totalGram.toLocaleString('id-ID')} gram
                            </p>
                            <p className="mt-1 text-xs">
                                {preview.groupedLines.length === 0
                                    ? 'Belum ada rincian valid.'
                                    : preview.groupedLines.map(([weightGram, lpCount]) => `${weightGram}g x ${lpCount} LP`).join(' | ')}
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>
                            Batal
                        </Button>
                        <Button onClick={submitBulkOrder} disabled={submitting || !allAssignmentsValid}>
                            {submitting ? 'Menyimpan...' : 'Kirim Order ke Baku'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function TrainerOrdersPage() {
    return (
        <ProtectedRoute allowedRoles={['trainer', 'manager']}>
            <TrainerOrdersContent />
        </ProtectedRoute>
    );
}
