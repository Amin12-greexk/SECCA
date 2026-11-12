'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileSpreadsheet, Loader2, Trash2, Upload } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { resetPresensi, uploadPresensi, type PresensiImportResult } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/lib/toast';
import { shortDate } from '../presensiFormat';

function UploadContent() {
    const { user } = useAuth();
    const toast = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<PresensiImportResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);

    const canEdit = user?.role === 'manager' && !user?.readOnly;

    const handleFile = async (file: File) => {
        setUploading(true);
        setError(null);
        setResult(null);
        try {
            const data = await uploadPresensi(file);
            setResult(data);
            toast.success(`${data.totalRecords.toLocaleString('id-ID')} catatan presensi tersimpan`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal mengunggah file presensi.');
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const reset = async () => {
        if (!confirm('Hapus SEMUA data presensi (termasuk yang sudah diedit)? Tidak bisa dibatalkan.')) return;
        try {
            const { deleted } = await resetPresensi();
            setResult(null);
            toast.success(`${deleted.toLocaleString('id-ID')} catatan dihapus`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Gagal menghapus data presensi.');
        }
    };

    return (
        <div className="mx-auto max-w-3xl space-y-5 p-4 pb-16 md:p-6">
            <div>
                <Link href="/presensi" className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700">
                    <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke Presensi
                </Link>
                <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-gray-900">
                    <Upload className="h-6 w-6 text-green-600" /> Upload Presensi
                </h1>
            </div>

            {!canEdit ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Hanya akun manager yang bisa mengunggah dan mengubah presensi.
                </div>
            ) : (
                <>
                    <div
                        onDragOver={(event) => {
                            event.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(event) => {
                            event.preventDefault();
                            setDragging(false);
                            const file = event.dataTransfer.files?.[0];
                            if (file) handleFile(file);
                        }}
                        className={`rounded-xl border-2 border-dashed bg-white p-8 text-center transition-colors ${
                            dragging ? 'border-green-500 bg-green-50' : 'border-gray-200'
                        }`}
                    >
                        <FileSpreadsheet className="mx-auto h-10 w-10 text-green-600" />
                        <p className="mt-3 text-sm font-medium text-gray-800">Tarik file presensi ke sini, atau pilih file</p>
                        <p className="mt-1 text-xs text-gray-400">.xlsx • satu sheet per bulan</p>
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) handleFile(file);
                            }}
                        />
                        <button
                            type="button"
                            disabled={uploading}
                            onClick={() => inputRef.current?.click()}
                            className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                        >
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {uploading ? 'Memproses...' : 'Pilih file Excel'}
                        </button>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600 shadow-sm">
                        <p className="font-semibold text-gray-800">Format file</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed">
                            <li>Satu sheet per bulan (AGUSTUS, SEPTEMBER, OKTOBER, ...).</li>
                            <li>
                                Baris 1: <b>PIN</b>, <b>NAMA</b>, lalu tanggal <b>dd/mm/yy</b> (satu tanggal untuk sepasang kolom).
                            </li>
                            <li>
                                Baris 2: <b>IN</b> dan <b>OUT</b> untuk tiap tanggal. Baris 3 ke bawah: satu orang per baris, jam
                                ditulis <b>HH:MM</b>; kosong = tidak hadir.
                            </li>
                            <li>Sheet bernama &quot;SHIFT ...&quot; dilewati (salinan mentah dari sheet bulanan).</li>
                            <li>
                                Shift ditentukan dari jam masuk: mulai pukul 12:00 ke atas dihitung Shift 2 (pulang lewat tengah malam).
                            </li>
                            <li>
                                Upload ulang menimpa data bulan/tanggal yang sama, <b>kecuali</b> catatan yang sudah diubah manual.
                            </li>
                        </ul>
                    </div>

                    {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

                    {result ? (
                        <div className="space-y-3 rounded-xl border border-green-200 bg-green-50/60 p-4 text-sm text-gray-700">
                            <p className="font-semibold text-green-800">
                                {result.totalRecords.toLocaleString('id-ID')} catatan dari {result.people.toLocaleString('id-ID')} orang
                                tersimpan ({shortDate(result.from)} – {shortDate(result.to)})
                            </p>
                            <ul className="space-y-0.5 text-xs">
                                {result.sheets.map((sheet) => (
                                    <li key={sheet.name}>
                                        Sheet <b>{sheet.name}</b>: {sheet.people.toLocaleString('id-ID')} orang,{' '}
                                        {sheet.records.toLocaleString('id-ID')} catatan
                                    </li>
                                ))}
                            </ul>
                            {result.skippedSheets.length > 0 ? (
                                <p className="text-xs text-gray-500">Dilewati: {result.skippedSheets.join(', ')}</p>
                            ) : null}
                            {result.keptEdited > 0 ? (
                                <p className="text-xs text-blue-700">
                                    {result.keptEdited} catatan yang pernah diubah manual dipertahankan.
                                </p>
                            ) : null}
                            {result.issues.length > 0 ? (
                                <details className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                                    <summary className="cursor-pointer font-medium">{result.issues.length} baris dilewati</summary>
                                    <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto">
                                        {result.issues.map((issue) => (
                                            <li key={`${issue.sheet}-${issue.row}`}>
                                                {issue.sheet} baris {issue.row}: {issue.reason}
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            ) : null}
                            <Link href="/presensi" className="inline-block text-sm font-medium text-green-700 hover:underline">
                                Lihat presensi →
                            </Link>
                        </div>
                    ) : null}

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={reset}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                            <Trash2 className="h-4 w-4" /> Hapus semua data presensi
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

export default function PresensiUploadPage() {
    return (
        <ProtectedRoute>
            <UploadContent />
        </ProtectedRoute>
    );
}
