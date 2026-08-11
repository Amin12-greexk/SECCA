'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/lib/toast';
import {
    approveMitraOrderRequest,
    cancelMitraOrderRequest,
    fulfillMitraOrderRequest,
    getMitraOrderRequests,
    getWorkers,
    rejectMitraOrderRequest,
    updateMitraOrderRequest,
    type MitraOrderRequest,
    type MitraOrderRequestStatus,
    type Worker,
} from '@/lib/api';
import { Input } from '@/components/ui/input';

type StatusFilter = MitraOrderRequestStatus | 'ALL';

const statusTone: Record<MitraOrderRequestStatus, string> = {
    REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200',
    APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
    REJECTED: 'bg-red-50 text-red-700 border-red-200',
    FULFILLED: 'bg-green-50 text-green-700 border-green-200',
};

function BakuOrdersContent() {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [requests, setRequests] = useState<MitraOrderRequest[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('REQUESTED');
    const [workerFilter, setWorkerFilter] = useState<string>('ALL');

    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectTarget, setRejectTarget] = useState<MitraOrderRequest | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectSubmitting, setRejectSubmitting] = useState(false);

    const [editOpen, setEditOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<MitraOrderRequest | null>(null);
    const [editGram, setEditGram] = useState('');
    const [editLpCount, setEditLpCount] = useState('');
    const [editNote, setEditNote] = useState('');
    const [editSubmitting, setEditSubmitting] = useState(false);

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<MitraOrderRequest | null>(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);

    const loadWorkers = async () => {
        try {
            const data = await getWorkers();
            setWorkers(data);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat daftar mitra.');
        }
    };

    const loadRequests = async () => {
        setLoading(true);
        try {
            const data = await getMitraOrderRequests({
                status: statusFilter === 'ALL' ? undefined : statusFilter,
                workerId: workerFilter === 'ALL' ? undefined : workerFilter,
                limit: 200,
            });
            setRequests(data);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat order mitra.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadWorkers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        loadRequests();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, workerFilter]);

    const counts = useMemo(() => {
        return requests.reduce(
            (acc, item) => {
                acc[item.status] += 1;
                return acc;
            },
            { REQUESTED: 0, APPROVED: 0, REJECTED: 0, FULFILLED: 0 } as Record<MitraOrderRequestStatus, number>
        );
    }, [requests]);

    const sortedRequests = useMemo(() => {
        const statusPriority: Record<MitraOrderRequestStatus, number> = {
            REQUESTED: 0,
            APPROVED: 1,
            REJECTED: 2,
            FULFILLED: 3,
        };

        return [...requests].sort((left, right) => {
            const byStatus = statusPriority[left.status] - statusPriority[right.status];
            if (byStatus !== 0) return byStatus;

            const leftTrainer = left.requestedBy?.role === 'TRAINER' ? 0 : 1;
            const rightTrainer = right.requestedBy?.role === 'TRAINER' ? 0 : 1;
            if (leftTrainer !== rightTrainer) return leftTrainer - rightTrainer;

            return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        });
    }, [requests]);

    const handleApprove = async (request: MitraOrderRequest) => {
        setActionLoadingId(request.id);
        try {
            await approveMitraOrderRequest(request.id);
            toast.success('Order mitra disetujui.');
            await loadRequests();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menyetujui order.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleFulfill = async (request: MitraOrderRequest) => {
        setActionLoadingId(request.id);
        try {
            await fulfillMitraOrderRequest(request.id);
            toast.success('Order ditandai selesai dipenuhi.');
            await loadRequests();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menandai order selesai.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const openRejectDialog = (request: MitraOrderRequest) => {
        setRejectTarget(request);
        setRejectReason('');
        setRejectOpen(true);
    };

    const handleReject = async () => {
        if (!rejectTarget) return;
        setRejectSubmitting(true);
        try {
            await rejectMitraOrderRequest(rejectTarget.id, rejectReason.trim() || undefined);
            toast.success('Order mitra ditolak.');
            setRejectOpen(false);
            setRejectTarget(null);
            setRejectReason('');
            await loadRequests();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menolak order.');
        } finally {
            setRejectSubmitting(false);
        }
    };

    const openEditDialog = (request: MitraOrderRequest) => {
        setEditTarget(request);
        const firstLine = request.lines && request.lines.length > 0 ? request.lines[0] : null;
        setEditGram(firstLine ? String(firstLine.weightGram) : String(request.requestedGram));
        setEditLpCount(firstLine ? String(firstLine.lpCount) : '1');
        setEditNote(request.note ?? '');
        setEditOpen(true);
    };

    const handleUpdateOrder = async () => {
        if (!editTarget) return;
        const gram = Number(editGram);
        const lpCount = Number(editLpCount);
        if (!gram || gram <= 0) {
            toast.error('Gram per LP harus lebih dari 0');
            return;
        }
        if (!lpCount || lpCount <= 0) {
            toast.error('Jumlah LP harus lebih dari 0');
            return;
        }

        setEditSubmitting(true);
        try {
            await updateMitraOrderRequest(editTarget.id, {
                requestedGram: gram,
                lpCount: lpCount,
                note: editNote.trim() || undefined,
            });
            toast.success('Order berhasil diperbarui.');
            setEditOpen(false);
            setEditTarget(null);
            await loadRequests();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memperbarui order.');
        } finally {
            setEditSubmitting(false);
        }
    };

    const openDeleteDialog = (request: MitraOrderRequest) => {
        setDeleteTarget(request);
        setDeleteOpen(true);
    };

    const handleDeleteOrder = async () => {
        if (!deleteTarget) return;
        setDeleteSubmitting(true);
        try {
            await cancelMitraOrderRequest(deleteTarget.id);
            toast.success('Order berhasil dihapus.');
            setDeleteOpen(false);
            setDeleteTarget(null);
            await loadRequests();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menghapus order.');
        } finally {
            setDeleteSubmitting(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-6">
            <div className="mx-auto max-w-6xl space-y-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">Order Mitra</h1>
                        <p className="text-sm text-gray-600">
                            Baku memproses antrian order mitra dengan prioritas order dari trainer.
                        </p>
                    </div>
                    <Button variant="outline" onClick={loadRequests} disabled={loading}>
                        {loading ? 'Memuat...' : 'Refresh'}
                    </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs text-amber-700">Requested</p>
                        <p className="text-2xl font-semibold text-amber-800">{counts.REQUESTED}</p>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                        <p className="text-xs text-blue-700">Approved</p>
                        <p className="text-2xl font-semibold text-blue-800">{counts.APPROVED}</p>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                        <p className="text-xs text-red-700">Rejected</p>
                        <p className="text-2xl font-semibold text-red-800">{counts.REJECTED}</p>
                    </div>
                    <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                        <p className="text-xs text-green-700">Fulfilled</p>
                        <p className="text-2xl font-semibold text-green-800">{counts.FULFILLED}</p>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Status</Label>
                            <Select
                                value={statusFilter}
                                onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Semua</SelectItem>
                                    <SelectItem value="REQUESTED">Requested</SelectItem>
                                    <SelectItem value="APPROVED">Approved</SelectItem>
                                    <SelectItem value="REJECTED">Rejected</SelectItem>
                                    <SelectItem value="FULFILLED">Fulfilled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Mitra</Label>
                            <Select value={workerFilter} onValueChange={setWorkerFilter}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Semua Mitra</SelectItem>
                                    {workers.map((worker) => (
                                        <SelectItem key={worker.id} value={worker.id}>
                                            {worker.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    {loading ? (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                            Memuat antrian order...
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                            Tidak ada order mitra pada filter ini.
                        </div>
                    ) : (
                        sortedRequests.map((request) => {
                            const isBusy = actionLoadingId === request.id;
                            return (
                                <div
                                    key={request.id}
                                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="space-y-1">
                                            <p className="text-base font-semibold text-gray-900">
                                                {request.worker?.name ?? 'Belum assign mitra'} - {request.requestedGram} gram
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Diminta oleh {request.requestedBy?.name ?? '-'} •{' '}
                                                {new Date(request.createdAt).toLocaleString('id-ID')}
                                            </p>
                                            {request.lines && request.lines.length > 0 && (
                                                <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700">
                                                    {request.lines
                                                        .map((line) => `${line.weightGram}g x ${line.lpCount} LP`)
                                                        .join(' | ')}
                                                </div>
                                            )}
                                            {request.note && (
                                                <p className="text-sm text-gray-700">{request.note}</p>
                                            )}
                                            {request.rejectionReason && (
                                                <p className="text-sm font-medium text-red-600">
                                                    Alasan tolak: {request.rejectionReason}
                                                </p>
                                            )}
                                            {!request.workerId && (
                                                <p className="text-sm font-medium text-amber-700">
                                                    Order agregat trainer. Assign LP ke mitra dilakukan setelah LP dipindah ke Rak Order Mitra.
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {request.requestedBy?.role === 'TRAINER' && (
                                                <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[10px] font-semibold text-purple-700">
                                                    PRIORITAS TRAINER
                                                </span>
                                            )}
                                            <span
                                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                                    statusTone[request.status]
                                                }`}
                                            >
                                                {request.status}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {request.status === 'REQUESTED' && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleApprove(request)}
                                                    disabled={isBusy}
                                                >
                                                    {isBusy ? 'Memproses...' : 'Approve'}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => openRejectDialog(request)}
                                                    disabled={isBusy}
                                                >
                                                    Reject
                                                </Button>
                                            </>
                                        )}
                                        {request.status === 'APPROVED' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleFulfill(request)}
                                                disabled={isBusy}
                                            >
                                                {isBusy ? 'Memproses...' : 'Mark Fulfilled'}
                                            </Button>
                                        )}
                                        {(request.status === 'REQUESTED' || request.status === 'APPROVED') && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openEditDialog(request)}
                                                disabled={isBusy}
                                            >
                                                Edit Order
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            className="bg-rose-600 hover:bg-rose-700 text-white"
                                            onClick={() => openDeleteDialog(request)}
                                            disabled={isBusy}
                                        >
                                            Hapus Order
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tolak Order Mitra</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label>Alasan (opsional)</Label>
                        <Textarea
                            value={rejectReason}
                            onChange={(event) => setRejectReason(event.target.value)}
                            placeholder="Contoh: kapasitas stok belum cukup"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectOpen(false)}>
                            Batal
                        </Button>
                        <Button variant="destructive" onClick={handleReject} disabled={rejectSubmitting}>
                            {rejectSubmitting ? 'Menyimpan...' : 'Tolak Order'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Order Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Order Mitra</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Gram Target Per LP</Label>
                            <Input
                                type="number"
                                min={1}
                                value={editGram}
                                onChange={(e) => setEditGram(e.target.value)}
                                placeholder="Contoh: 39"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Jumlah LP</Label>
                            <Input
                                type="number"
                                min={1}
                                value={editLpCount}
                                onChange={(e) => setEditLpCount(e.target.value)}
                                placeholder="Contoh: 1"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Catatan (opsional)</Label>
                            <Textarea
                                value={editNote}
                                onChange={(e) => setEditNote(e.target.value)}
                                placeholder="Catatan tambahan"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>
                            Batal
                        </Button>
                        <Button onClick={handleUpdateOrder} disabled={editSubmitting}>
                            {editSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Order Confirmation Dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Hapus / Batal Order</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 py-2">
                        <p className="text-sm text-gray-700">
                            Apakah Anda yakin ingin menghapus order dari{' '}
                            <span className="font-bold text-gray-900">
                                {deleteTarget?.requestedBy?.name ?? deleteTarget?.worker?.name ?? 'Mitra'}
                            </span>{' '}
                            sebesar <span className="font-bold text-gray-900">{deleteTarget?.requestedGram} gram</span>?
                        </p>
                        <p className="text-xs text-rose-600 font-medium">
                            Tindakan ini akan menghapus order dan antrian terkait secara permanen.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                            Batal
                        </Button>
                        <Button variant="destructive" onClick={handleDeleteOrder} disabled={deleteSubmitting}>
                            {deleteSubmitting ? 'Menghapus...' : 'Hapus Permanen'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function BakuOrdersPage() {
    return (
        <ProtectedRoute allowedRoles={['baku', 'manager']}>
            <BakuOrdersContent />
        </ProtectedRoute>
    );
}

