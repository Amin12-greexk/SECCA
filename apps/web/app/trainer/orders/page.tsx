'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createMitraOrderRequest } from '@/lib/api';

type OrderLineDraft = {
    id: string;
    weightGram: string;
    lpCount: string;
};

const createLineId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function TrainerOrdersContent() {
    const toast = useToast();
    const [note, setNote] = useState('');
    const [orderLines, setOrderLines] = useState<OrderLineDraft[]>([
        { id: createLineId(), weightGram: '', lpCount: '' },
    ]);
    const [submitting, setSubmitting] = useState(false);

    const normalizedLines = useMemo(
        () =>
            orderLines
                .map((line) => {
                    const weightGram = Number(line.weightGram);
                    const lpCount = Number(line.lpCount);
                    const valid =
                        Number.isFinite(weightGram) &&
                        weightGram > 0 &&
                        Number.isFinite(lpCount) &&
                        lpCount > 0;
                    return {
                        ...line,
                        weightGram: valid ? Math.round(weightGram) : 0,
                        lpCount: valid ? Math.round(lpCount) : 0,
                        valid,
                    };
                })
                .filter((line) => line.valid)
                .map((line) => ({
                    weightGram: line.weightGram,
                    lpCount: line.lpCount,
                })),
        [orderLines]
    );

    const totalRequestedGram = useMemo(
        () => normalizedLines.reduce((sum, line) => sum + line.weightGram * line.lpCount, 0),
        [normalizedLines]
    );

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

    const handleSubmit = async () => {
        if (normalizedLines.length === 0) {
            toast.error('Isi minimal satu baris template (berat x jumlah LP).');
            return;
        }

        setSubmitting(true);
        try {
            await createMitraOrderRequest({
                lines: normalizedLines,
                note: note.trim() || undefined,
            });
            toast.success('Template order trainer berhasil disimpan.');
            setOrderLines([{ id: createLineId(), weightGram: '', lpCount: '' }]);
            setNote('');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal membuat template order trainer.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-2xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Template Order Trainer</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Catat kebutuhan gram per LP. Assign mitra dilakukan di menu terpisah.
                </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-gray-800">Template LP</h2>
                    <Button type="button" size="sm" variant="outline" onClick={addOrderLine}>
                        <Plus className="h-4 w-4" />
                        Tambah Baris
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
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                                placeholder={`Berat LP #${index + 1} (gram)`}
                            />
                            <input
                                type="number"
                                min={1}
                                value={line.lpCount}
                                onChange={(event) =>
                                    updateOrderLine(line.id, 'lpCount', event.target.value)
                                }
                                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
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

                <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                    Total order: <span className="font-semibold">{totalRequestedGram}</span> gram
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Catatan (opsional)</label>
                <Textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Contoh: untuk target setoran hari Selasa"
                />
            </div>

            <div className="flex items-center gap-3">
                <Button onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Menyimpan...' : 'Simpan Template'}
                </Button>
                <a
                    href="/trainer/assign"
                    className="text-sm text-green-600 hover:text-green-700 hover:underline"
                >
                    Assign ke Mitra -&gt;
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
