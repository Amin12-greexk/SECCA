'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, KeyRound, Link2, Loader2, Unlink, Upload } from 'lucide-react';
import {
    getMitraPinStatus,
    linkMitraExcelName,
    uploadMitraPins,
    type MitraPinStatus,
} from '@/lib/api';
import { useToast } from '@/lib/toast';

/**
 * Upload file PIN mitra untuk portal /cek (mitra cek performa & gaji
 * sendiri). File = daftar lengkap karyawan aktif (sheet BORONG, BULANAN &
 * HARIAN — anak harian hanya melihat riwayat gaji);
 * upload baru menggantikan semua PIN lama. Nama lengkap yang di Excel
 * pembayaran ditulis lain (mis. nama pendek) dihubungkan di sini, dan
 * hubungannya tetap tersimpan walau file PIN di-upload ulang.
 */
export default function MitraPinCard({ refreshKey }: { refreshKey?: unknown }) {
    const toast = useToast();
    const inputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<MitraPinStatus | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getMitraPinStatus()
            .then((result) => {
                if (!cancelled) setStatus(result);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [refreshKey]);

    const handleFile = async (file: File) => {
        setUploading(true);
        try {
            const result = await uploadMitraPins(file);
            setStatus(result);
            toast.success(`${result.total} PIN tersimpan • ${result.matched} cocok dengan data pembayaran`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal mengunggah file PIN.');
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const link = async (name: string, excelName: string | null) => {
        try {
            const result = await linkMitraExcelName(name, excelName);
            // `issues` hanya milik hasil upload terakhir — tetap ditampilkan.
            setStatus((prev) => ({ ...result, issues: prev?.issues }));
            toast.success(excelName ? `${name} → ${excelName}` : `Hubungan ${name} dilepas`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menghubungkan nama.');
        }
    };

    const issues = status?.issues ?? [];
    const unmatched = status?.unmatched ?? [];
    const linked = status?.linked ?? [];

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-green-600" />
                    <div>
                        <h2 className="text-sm font-semibold text-gray-800">PIN Mitra</h2>
                        <p className="text-xs text-gray-400">
                            {status && status.total > 0
                                ? `${status.total} PIN terdaftar • ${status.matched} cocok dengan data pembayaran`
                                : 'File .xlsx (sheet BORONG, BULANAN & HARIAN) berisi kolom Nama dan PIN'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href="/cek"
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                        <ExternalLink className="h-4 w-4" /> Halaman mitra
                    </Link>
                    <input
                        ref={inputRef}
                        type="file"
                        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) handleFile(file);
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-50"
                    >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploading ? 'Mengunggah...' : 'Upload PIN'}
                    </button>
                </div>
            </div>

            {status && status.needsReupload > 0 ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                    {status.needsReupload} PIN tersimpan dengan format lama dan belum bisa dipakai masuk. Upload
                    ulang file PIN.
                </p>
            ) : null}

            {issues.length > 0 ? (
                <details className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                    <summary className="cursor-pointer font-medium">{issues.length} baris dilewati</summary>
                    <ul className="mt-1.5 max-h-40 space-y-0.5 overflow-y-auto">
                        {issues.map((issue) => (
                            <li key={`${issue.row}-${issue.name}`}>
                                {issue.row}
                                {issue.name ? ` (${issue.name})` : ''}: {issue.reason}
                            </li>
                        ))}
                    </ul>
                </details>
            ) : null}

            {unmatched.length > 0 ? (
                <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
                    <summary className="cursor-pointer font-medium">
                        {unmatched.length} nama belum ditemukan di data pembayaran
                    </summary>
                    <p className="mt-1.5 text-amber-700">
                        Pilih nama yang dipakai di Excel pembayaran lalu klik Hubungkan. Mitra baru yang belum
                        punya data biarkan saja — otomatis cocok kalau namanya sama.
                    </p>
                    <ul className="mt-2 max-h-80 divide-y divide-amber-100 overflow-y-auto rounded-md bg-white">
                        {unmatched.map((item) => (
                            <UnmatchedRow
                                key={item.name}
                                name={item.name}
                                suggestions={item.suggestions}
                                excelNames={status?.excelNames ?? []}
                                onLink={(excelName) => link(item.name, excelName)}
                            />
                        ))}
                    </ul>
                </details>
            ) : null}

            {linked.length > 0 ? (
                <details className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
                    <summary className="cursor-pointer font-medium">{linked.length} nama sudah dihubungkan</summary>
                    <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto">
                        {linked.map((item) => (
                            <li key={item.name} className="flex items-center gap-2">
                                <span className="min-w-0 flex-1 truncate">
                                    <b>{item.name}</b> → {item.excelNames.join(', ') || '–'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => link(item.name, null)}
                                    className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800"
                                >
                                    <Unlink className="h-3 w-3" /> Lepas
                                </button>
                            </li>
                        ))}
                    </ul>
                </details>
            ) : null}
        </div>
    );
}

function UnmatchedRow({
    name,
    suggestions,
    excelNames,
    onLink,
}: {
    name: string;
    suggestions: string[];
    excelNames: string[];
    onLink: (excelName: string) => Promise<void>;
}) {
    // Sengaja tidak memilih saran otomatis: salah hubung = gaji orang lain
    // terbuka ke mitra ini. Manager harus memilih sendiri.
    const [choice, setChoice] = useState('');
    const [busy, setBusy] = useState(false);
    const others = excelNames.filter((n) => !suggestions.includes(n));

    return (
        <li className="flex flex-wrap items-center gap-2 px-2.5 py-2">
            <span className="min-w-[10rem] flex-1 font-medium text-gray-800">{name}</span>
            <select
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                aria-label={`Nama di Excel untuk ${name}`}
                className="h-8 max-w-[14rem] flex-1 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700"
            >
                <option value="">Pilih nama di Excel…</option>
                {suggestions.length > 0 ? (
                    <optgroup label="Mirip">
                        {suggestions.map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </optgroup>
                ) : null}
                <optgroup label="Semua (terbaru dulu)">
                    {others.map((n) => (
                        <option key={n} value={n}>
                            {n}
                        </option>
                    ))}
                </optgroup>
            </select>
            <button
                type="button"
                disabled={!choice || busy}
                onClick={async () => {
                    setBusy(true);
                    await onLink(choice);
                    setBusy(false);
                }}
                className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md bg-green-600 px-2.5 text-xs font-medium text-white hover:bg-green-700 disabled:cursor-default disabled:opacity-40"
            >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                Hubungkan
            </button>
        </li>
    );
}
