'use client';

import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { deletePresensiRecord, savePresensiRecord } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { longDate } from './presensiFormat';

export interface RecordTarget {
    id?: string;
    pin: string;
    name: string;
    date: string;
    shift: number;
    clockIn: string | null;
    clockOut: string | null;
}

/**
 * Ubah / tambah / hapus satu catatan presensi (hanya manager — server menolak
 * yang lain). Jam pulang shift 2 boleh lebih kecil dari jam masuk: artinya
 * pulang lewat tengah malam.
 */
export default function RecordDialog({
    target,
    onClose,
    onSaved,
}: {
    target: RecordTarget | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const toast = useToast();
    const [clockIn, setClockIn] = useState('');
    const [clockOut, setClockOut] = useState('');
    const [shift, setShift] = useState(1);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (target) {
            setClockIn(target.clockIn ?? '');
            setClockOut(target.clockOut ?? '');
            setShift(target.shift);
        }
    }, [target]);

    const run = async (action: () => Promise<unknown>, message: string) => {
        setBusy(true);
        try {
            await action();
            toast.success(message);
            onSaved();
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menyimpan.');
        } finally {
            setBusy(false);
        }
    };

    const save = () => {
        if (!target) return;
        if (!clockIn && !clockOut) {
            toast.error('Isi minimal jam masuk atau jam pulang.');
            return;
        }
        run(
            () =>
                savePresensiRecord({
                    id: target.id,
                    pin: target.pin,
                    name: target.name,
                    date: target.date,
                    shift,
                    clockIn: clockIn || null,
                    clockOut: clockOut || null,
                }),
            'Presensi tersimpan',
        );
    };

    return (
        <Dialog open={target !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{target?.id ? 'Ubah presensi' : 'Tambah presensi'}</DialogTitle>
                    <DialogDescription>
                        {target ? `${target.name} (${target.pin}) • ${longDate(target.date)}` : ''}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-3 py-2">
                    <label className="text-sm font-medium text-gray-700">
                        Jam masuk
                        <input
                            type="time"
                            value={clockIn}
                            onChange={(event) => setClockIn(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                    </label>
                    <label className="text-sm font-medium text-gray-700">
                        Jam pulang
                        <input
                            type="time"
                            value={clockOut}
                            onChange={(event) => setClockOut(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                    </label>
                    {!target?.id ? (
                        <label className="col-span-2 text-sm font-medium text-gray-700">
                            Shift
                            <select
                                value={shift}
                                onChange={(event) => setShift(Number(event.target.value))}
                                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                            >
                                <option value={1}>Shift 1 (pagi)</option>
                                <option value={2}>Shift 2 (sore, pulang lewat tengah malam)</option>
                            </select>
                        </label>
                    ) : null}
                    <p className="col-span-2 text-xs text-gray-400">
                        Catatan yang diubah di sini tidak akan ditimpa kalau file presensi diunggah ulang.
                    </p>
                </div>

                <DialogFooter className="gap-2 sm:justify-between">
                    {target?.id ? (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                if (!confirm('Hapus catatan presensi ini?')) return;
                                run(() => deletePresensiRecord(target.id!), 'Presensi dihapus');
                            }}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                            <Trash2 className="h-4 w-4" /> Hapus
                        </button>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={save}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Simpan
                        </button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
