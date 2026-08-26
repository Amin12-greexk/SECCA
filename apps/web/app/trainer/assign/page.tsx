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
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth/AuthContext';
import {
    createWorkOrderFromMitraOrder,
    getMitraOrderRequests,
    getRackLotsByCode,
    getWorkers,
    type MitraOrderRequest,
    type ProductionLot,
    type Worker,
} from '@/lib/api';

const MITRA_ORDER_RACK_CODE = 'RAK_MITRA_ORDER';

function TrainerAssignContent() {
    const toast = useToast();
    const { user } = useAuth();
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [lots, setLots] = useState<ProductionLot[]>([]);
    const [templates, setTemplates] = useState<MitraOrderRequest[]>([]);
    const [selectedWorkerId, setSelectedWorkerId] = useState('');
    const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState(false);

    const availableWorkers = useMemo(() => {
        if (user?.role !== 'trainer') return workers;
        const mine = workers.filter((worker) => worker.trainerId === user.id);
        const unassigned = workers.filter((worker) => !worker.trainerId);
        return [...mine, ...unassigned.filter((worker) => worker.trainerId !== user.id)];
    }, [user?.id, user?.role, workers]);

    const assignableLots = useMemo(
        () => lots.filter((lot) => lot.status === 'AVAILABLE' || lot.status === 'IN_PROGRESS'),
        [lots]
    );

    const filteredLots = useMemo(() => {
        const normalized = searchTerm.trim().toLowerCase();
        if (!normalized) return assignableLots;
        return assignableLots.filter((lot) => {
            const grade = lot.grade?.code?.toLowerCase() ?? '';
            return (
                lot.lotNumber.toLowerCase().includes(normalized) ||
                grade.includes(normalized)
            );
        });
    }, [assignableLots, searchTerm]);

    const totalPoolGram = useMemo(
        () => assignableLots.reduce((sum, lot) => sum + lot.wetWeightGram, 0),
        [assignableLots]
    );

    const templateSummary = useMemo(() => {
        const totalGram = templates.reduce((sum, item) => sum + item.requestedGram, 0);
        const totalLp = templates.reduce((sum, item) => {
            const lines = item.lines ?? [];
            return sum + lines.reduce((lineSum, line) => lineSum + line.lpCount, 0);
        }, 0);
        return { totalGram, totalLp };
    }, [templates]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [workerData, rackData, templateData] = await Promise.all([
                getWorkers(),
                getRackLotsByCode(MITRA_ORDER_RACK_CODE),
                getMitraOrderRequests({
                    status: 'APPROVED',
                    requestedByRole: 'TRAINER',
                    aggregateOnly: true,
                    limit: 200,
                }),
            ]);

            setWorkers(workerData);
            setLots(rackData.lots);
            setTemplates(templateData);
            setSelectedLotIds((prev) =>
                prev.filter((id) => rackData.lots.some((lot) => lot.id === id))
            );
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat data assign LP.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!selectedWorkerId && availableWorkers.length > 0) {
            setSelectedWorkerId(availableWorkers[0].id);
            return;
        }
        if (selectedWorkerId && !availableWorkers.some((worker) => worker.id === selectedWorkerId)) {
            setSelectedWorkerId(availableWorkers[0]?.id ?? '');
        }
    }, [availableWorkers, selectedWorkerId]);

    const toggleLot = (lotId: string) => {
        setSelectedLotIds((prev) =>
            prev.includes(lotId) ? prev.filter((id) => id !== lotId) : [...prev, lotId]
        );
    };

    const toggleSelectAllFiltered = () => {
        const visibleIds = filteredLots.map((lot) => lot.id);
        const allVisibleSelected =
            visibleIds.length > 0 && visibleIds.every((id) => selectedLotIds.includes(id));

        setSelectedLotIds((prev) => {
            if (allVisibleSelected) {
                return prev.filter((id) => !visibleIds.includes(id));
            }
            const next = new Set(prev);
            visibleIds.forEach((id) => next.add(id));
            return Array.from(next);
        });
    };

    const handleAssign = async () => {
        if (!selectedWorkerId) {
            toast.error('Pilih mitra tujuan terlebih dahulu.');
            return;
        }
        if (selectedLotIds.length === 0) {
            toast.error('Pilih minimal 1 LP dari Rak Order Mitra.');
            return;
        }

        setAssigning(true);
        try {
            await createWorkOrderFromMitraOrder({
                workerId: selectedWorkerId,
                lotIds: selectedLotIds,
            });
            toast.success(`Berhasil assign ${selectedLotIds.length} LP ke mitra.`);
            setSelectedLotIds([]);
            await loadData();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal assign LP ke mitra.');
        } finally {
            setAssigning(false);
        }
    };

    const allFilteredSelected =
        filteredLots.length > 0 && filteredLots.every((lot) => selectedLotIds.includes(lot.id));

    return (
        <div className="space-y-6 p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Assign LP ke Mitra</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Ambil LP dari Rak Order Mitra lalu assign ke mitra binaan.
                    </p>
                </div>
                <Button variant="outline" onClick={loadData} disabled={loading || assigning}>
                    {loading ? 'Memuat...' : 'Refresh'}
                </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                    <p className="text-xs text-gray-500">LP di Rak Order</p>
                    <p className="text-2xl font-semibold text-gray-900">{assignableLots.length}</p>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 p-3">
                    <p className="text-xs text-green-700">Total Gram Pool</p>
                    <p className="text-2xl font-semibold text-green-800">{totalPoolGram.toLocaleString('id-ID')}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs text-blue-700">Rekap Template Approved</p>
                    <p className="text-sm font-semibold text-blue-900">
                        {templateSummary.totalGram.toLocaleString('id-ID')} gr / {templateSummary.totalLp.toLocaleString('id-ID')} LP
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-600">Mitra Tujuan</p>
                        <Select value={selectedWorkerId} onValueChange={setSelectedWorkerId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih mitra" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableWorkers.map((worker) => (
                                    <SelectItem key={worker.id} value={worker.id}>
                                        {worker.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-600">Cari LP / Grade</p>
                        <Input
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Contoh: LP000123 atau MK"
                        />
                    </div>
                    <div className="flex items-end">
                        <Button
                            className="w-full"
                            onClick={handleAssign}
                            disabled={assigning || loading || selectedLotIds.length === 0 || !selectedWorkerId}
                        >
                            {assigning ? 'Assigning...' : `Assign ${selectedLotIds.length} LP`}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                    <div>
                        <p className="text-sm font-semibold text-gray-900">Pool LP Rak Order Mitra</p>
                        <p className="text-xs text-gray-500">
                            Pilih LP yang sudah disiapkan baku, lalu assign ke mitra.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={toggleSelectAllFiltered} disabled={filteredLots.length === 0}>
                        {allFilteredSelected ? 'Uncheck Semua' : 'Check Semua'}
                    </Button>
                </div>
                <div className="max-h-[65vh] overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-3 py-2 text-left">Pilih</th>
                                <th className="px-3 py-2 text-left">Nomor LP</th>
                                <th className="px-3 py-2 text-left">Grade</th>
                                <th className="px-3 py-2 text-left">Berat (gr)</th>
                                <th className="px-3 py-2 text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                                        Memuat data LP...
                                    </td>
                                </tr>
                            ) : filteredLots.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                                        Tidak ada LP di Rak Order Mitra.
                                    </td>
                                </tr>
                            ) : (
                                filteredLots.map((lot) => (
                                    <tr key={lot.id}>
                                        <td className="px-3 py-2">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300"
                                                checked={selectedLotIds.includes(lot.id)}
                                                onChange={() => toggleLot(lot.id)}
                                            />
                                        </td>
                                        <td className="px-3 py-2 font-medium text-gray-900">{lot.lotNumber}</td>
                                        <td className="px-3 py-2 text-gray-700">{lot.grade?.code ?? '-'}</td>
                                        <td className="px-3 py-2 text-gray-700">{lot.wetWeightGram.toLocaleString('id-ID')}</td>
                                        <td className="px-3 py-2 text-gray-700">{lot.status}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default function TrainerAssignPage() {
    return (
        <ProtectedRoute>
            <TrainerAssignContent />
        </ProtectedRoute>
    );
}
