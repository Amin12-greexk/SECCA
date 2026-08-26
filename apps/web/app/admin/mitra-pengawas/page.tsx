'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getUsers, getWorkers, updateWorker, type User, type Worker } from '@/lib/api';
import { useToast } from '@/lib/toast';

const NONE_VALUE = '__NONE__';

type TrainerOption = {
    id: string;
    name: string;
    email: string;
};

function MitraPengawasContent() {
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [savingRowId, setSavingRowId] = useState<string | null>(null);
    const [bulkSaving, setBulkSaving] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [search, setSearch] = useState('');
    const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
    const [draftByWorkerId, setDraftByWorkerId] = useState<Record<string, string>>({});
    const [bulkTrainerId, setBulkTrainerId] = useState(NONE_VALUE);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersData, workersData] = await Promise.all([getUsers(), getWorkers()]);
            setUsers(usersData);
            setWorkers(workersData);
            const draft: Record<string, string> = {};
            workersData.forEach((worker) => {
                draft[worker.id] = worker.trainerId ?? NONE_VALUE;
            });
            setDraftByWorkerId(draft);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat data mitra/pengawas.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const trainers = useMemo<TrainerOption[]>(
        () =>
            users
                .filter((user) => String(user.role).toUpperCase() === 'TRAINER')
                .map((user) => ({
                    id: user.id,
                    name: user.name,
                    email: user.email,
                }))
                .sort((left, right) => left.name.localeCompare(right.name)),
        [users]
    );

    const mitraWorkerIds = useMemo(
        () =>
            new Set(
                users
                    .filter((user) => String(user.role).toUpperCase() === 'MITRA')
                    .map((user) => user.workerId)
                    .filter((workerId): workerId is string => Boolean(workerId))
            ),
        [users]
    );

    const mitraUsersByWorkerId = useMemo(() => {
        const map = new Map<string, User>();
        users
            .filter((user) => String(user.role).toUpperCase() === 'MITRA' && user.workerId)
            .forEach((user) => {
                if (user.workerId) {
                    map.set(user.workerId, user);
                }
            });
        return map;
    }, [users]);

    const trainerNameById = useMemo(() => {
        const map = new Map<string, string>();
        trainers.forEach((trainer) => {
            map.set(trainer.id, trainer.name);
        });
        return map;
    }, [trainers]);

    const mitraWorkers = useMemo(() => {
        const normalized = search.trim().toLowerCase();
        return workers
            .filter((worker) => mitraWorkerIds.has(worker.id))
            .filter((worker) => {
                if (!normalized) return true;
                const user = mitraUsersByWorkerId.get(worker.id);
                const trainerName = worker.trainerId ? trainerNameById.get(worker.trainerId) ?? '' : '';
                const fields = [
                    worker.name,
                    worker.code ?? '',
                    worker.pin ?? '',
                    user?.email ?? '',
                    trainerName,
                ];
                return fields.some((field) => field.toLowerCase().includes(normalized));
            })
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [mitraWorkerIds, mitraUsersByWorkerId, search, trainerNameById, workers]);

    const toggleRow = (workerId: string) => {
        setSelectedWorkerIds((prev) =>
            prev.includes(workerId) ? prev.filter((id) => id !== workerId) : [...prev, workerId]
        );
    };

    const toggleSelectAllFiltered = () => {
        const ids = mitraWorkers.map((worker) => worker.id);
        const allSelected = ids.length > 0 && ids.every((id) => selectedWorkerIds.includes(id));
        setSelectedWorkerIds((prev) => {
            if (allSelected) {
                return prev.filter((id) => !ids.includes(id));
            }
            const merged = new Set(prev);
            ids.forEach((id) => merged.add(id));
            return Array.from(merged);
        });
    };

    const setRowDraft = (workerId: string, trainerId: string) => {
        setDraftByWorkerId((prev) => ({
            ...prev,
            [workerId]: trainerId,
        }));
    };

    const saveSingle = async (worker: Worker) => {
        const draft = draftByWorkerId[worker.id] ?? NONE_VALUE;
        const payload = draft === NONE_VALUE ? null : draft;
        if (payload === (worker.trainerId ?? null)) {
            toast.error('Tidak ada perubahan untuk disimpan.');
            return;
        }

        setSavingRowId(worker.id);
        try {
            await updateWorker(worker.id, { trainerId: payload });
            setWorkers((prev) =>
                prev.map((item) =>
                    item.id === worker.id
                        ? {
                              ...item,
                              trainerId: payload,
                          }
                        : item
                )
            );
            toast.success('Pengawas mitra berhasil diperbarui.');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menyimpan perubahan.');
        } finally {
            setSavingRowId(null);
        }
    };

    const saveBulk = async () => {
        if (selectedWorkerIds.length === 0) {
            toast.error('Pilih minimal 1 mitra.');
            return;
        }
        if (bulkTrainerId !== NONE_VALUE && !trainers.some((trainer) => trainer.id === bulkTrainerId)) {
            toast.error('Pilih pengawas yang valid.');
            return;
        }

        const payload = bulkTrainerId === NONE_VALUE ? null : bulkTrainerId;
        setBulkSaving(true);
        try {
            const results = await Promise.allSettled(
                selectedWorkerIds.map((workerId) => updateWorker(workerId, { trainerId: payload }))
            );
            const successCount = results.filter((result) => result.status === 'fulfilled').length;
            const failedCount = results.length - successCount;

            if (successCount > 0) {
                setWorkers((prev) =>
                    prev.map((worker) =>
                        selectedWorkerIds.includes(worker.id)
                            ? {
                                  ...worker,
                                  trainerId: payload,
                              }
                            : worker
                    )
                );
                setDraftByWorkerId((prev) => {
                    const next = { ...prev };
                    selectedWorkerIds.forEach((workerId) => {
                        next[workerId] = payload ?? NONE_VALUE;
                    });
                    return next;
                });
            }

            if (failedCount > 0) {
                toast.error(`Sebagian gagal: ${successCount} berhasil, ${failedCount} gagal.`);
            } else {
                toast.success(`Berhasil assign ${successCount} mitra.`);
            }
        } finally {
            setBulkSaving(false);
        }
    };

    const allFilteredSelected =
        mitraWorkers.length > 0 && mitraWorkers.every((worker) => selectedWorkerIds.includes(worker.id));

    return (
        <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-6">
            <div className="mx-auto max-w-6xl space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-900">Assign Pengawas ke Mitra</h1>
                        <p className="text-sm text-gray-600">
                            Hubungkan mitra ke trainer/pengawas agar muncul di board pengawas.
                        </p>
                    </div>
                    <Button variant="outline" onClick={loadData} disabled={loading || bulkSaving}>
                        {loading ? 'Memuat...' : 'Refresh'}
                    </Button>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="grid gap-3 md:grid-cols-[1fr_220px_auto_auto]">
                        <div className="space-y-1.5">
                            <Label>Cari Mitra</Label>
                            <Input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Nama / kode / email / pengawas"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Bulk Pengawas</Label>
                            <Select value={bulkTrainerId} onValueChange={setBulkTrainerId}>
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
                        </div>
                        <div className="flex items-end">
                            <Button variant="outline" onClick={toggleSelectAllFiltered} disabled={mitraWorkers.length === 0}>
                                {allFilteredSelected ? 'Uncheck Semua' : 'Check Semua'}
                            </Button>
                        </div>
                        <div className="flex items-end">
                            <Button onClick={saveBulk} disabled={bulkSaving || selectedWorkerIds.length === 0}>
                                {bulkSaving ? 'Menyimpan...' : `Simpan Bulk (${selectedWorkerIds.length})`}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="max-h-[70vh] overflow-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                <tr>
                                    <th className="px-3 py-2 text-left">Pilih</th>
                                    <th className="px-3 py-2 text-left">Mitra</th>
                                    <th className="px-3 py-2 text-left">Akun Mitra</th>
                                    <th className="px-3 py-2 text-left">Pengawas</th>
                                    <th className="px-3 py-2 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                                            Memuat data...
                                        </td>
                                    </tr>
                                ) : mitraWorkers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">
                                            Tidak ada data mitra.
                                        </td>
                                    </tr>
                                ) : (
                                    mitraWorkers.map((worker) => {
                                        const mitraUser = mitraUsersByWorkerId.get(worker.id);
                                        const currentTrainer = worker.trainerId
                                            ? trainerNameById.get(worker.trainerId) ?? worker.trainerId
                                            : 'Tanpa Pengawas';
                                        const rowSaving = savingRowId === worker.id;

                                        return (
                                            <tr key={worker.id}>
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 rounded border-gray-300"
                                                        checked={selectedWorkerIds.includes(worker.id)}
                                                        onChange={() => toggleRow(worker.id)}
                                                    />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <p className="font-medium text-gray-900">{worker.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {worker.code ?? '-'} • PIN {worker.pin ?? '-'}
                                                    </p>
                                                </td>
                                                <td className="px-3 py-2 text-gray-700">
                                                    {mitraUser ? (
                                                        <div>
                                                            <p>{mitraUser.name}</p>
                                                            <p className="text-xs text-gray-500">{mitraUser.email}</p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-amber-700">Belum terhubung ke akun mitra</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="space-y-1">
                                                        <Select
                                                            value={draftByWorkerId[worker.id] ?? NONE_VALUE}
                                                            onValueChange={(value) => setRowDraft(worker.id, value)}
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
                                                        <p className="text-xs text-gray-500">Saat ini: {currentTrainer}</p>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <Button size="sm" onClick={() => saveSingle(worker)} disabled={rowSaving}>
                                                        {rowSaving ? 'Menyimpan...' : 'Simpan'}
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function MitraPengawasPage() {
    return (
        <ProtectedRoute>
            <MitraPengawasContent />
        </ProtectedRoute>
    );
}
