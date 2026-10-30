'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, Loader2, X } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    MitraPortalSessionError,
    setMitraPortalPassword,
    type MitraPortalSession,
} from '@/lib/api';

const MIN_LENGTH = 8;

/**
 * Buat password sendiri menggantikan PIN (atau ganti password yang sudah ada).
 * Berhasil = semua sesi lama berakhir: pemanggil harus mengeluarkan mitra dan
 * mengarahkannya masuk lagi dengan nama + password (`onChanged`).
 */
export default function PasswordDialog({
    session,
    hasPassword,
    open,
    onOpenChange,
    onChanged,
    onSessionEnded,
}: {
    session: MitraPortalSession;
    hasPassword: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChanged: (name: string) => void;
    onSessionEnded: () => void;
}) {
    const [current, setCurrent] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const rules = [
        { ok: password.length >= MIN_LENGTH, label: `Minimal ${MIN_LENGTH} karakter` },
        { ok: /[A-Za-z]/.test(password), label: 'Ada huruf' },
        { ok: /\d/.test(password), label: 'Ada angka' },
        { ok: password.length > 0 && password === confirm, label: 'Kedua isian sama' },
    ];
    const valid = rules.every((rule) => rule.ok) && (!hasPassword || current.length > 0);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (busy || !valid) return;
        setBusy(true);
        setError(null);
        try {
            await setMitraPortalPassword(session.token, password, hasPassword ? current : undefined);
            // Sesi lama sudah tidak berlaku di server; bersihkan juga di sini.
            setCurrent('');
            setPassword('');
            setConfirm('');
            onChanged(session.name);
        } catch (err) {
            if (err instanceof MitraPortalSessionError) {
                onSessionEnded();
                return;
            }
            setError(err instanceof Error ? err.message : 'Gagal menyimpan password.');
        } finally {
            setBusy(false);
        }
    };

    const input =
        'h-12 w-full rounded-xl border border-gray-200 px-3.5 pr-12 text-base outline-none transition focus:border-[#059833] focus:ring-2 focus:ring-[#059833]/20';

    return (
        <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
            <DialogContent className="sm:max-w-md">
                <div className="-mx-1 flex-1 overflow-y-auto px-1">
                    <div className="mb-1 flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-[#059833]">
                            <KeyRound className="h-5 w-5" />
                        </span>
                        <DialogTitle>{hasPassword ? 'Ganti password' : 'Ganti PIN dengan password'}</DialogTitle>
                    </div>
                    <DialogDescription>
                        {hasPassword
                            ? 'Isi password saat ini, lalu password baru.'
                            : 'Supaya akun lebih aman, buat password sendiri. PIN tidak dipakai lagi setelah ini.'}
                    </DialogDescription>

                    <ol className="mt-4 space-y-1.5 rounded-xl bg-emerald-50/70 p-3.5 text-sm text-gray-700">
                        <li>
                            <b>1.</b> Buat password baru di bawah, lalu tekan <b>Simpan</b>.
                        </li>
                        <li>
                            <b>2.</b> Anda otomatis <b>keluar</b> dari halaman ini.
                        </li>
                        <li>
                            <b>3.</b> Masuk lagi dengan <b>nama lengkap</b> dan <b>password baru</b>.
                        </li>
                        <li className="pt-1 text-xs text-gray-500">
                            Ingat password Anda. Kalau lupa, minta admin mereset — Anda bisa masuk dengan PIN lagi.
                        </li>
                    </ol>

                    <form onSubmit={submit} className="mt-4 space-y-3">
                        {hasPassword ? (
                            <PasswordInput
                                id="pw-current"
                                label="Password saat ini"
                                value={current}
                                onChange={setCurrent}
                                show={show}
                                onToggle={() => setShow((v) => !v)}
                                autoComplete="current-password"
                                className={input}
                            />
                        ) : null}
                        <PasswordInput
                            id="pw-new"
                            label="Password baru"
                            value={password}
                            onChange={setPassword}
                            show={show}
                            onToggle={() => setShow((v) => !v)}
                            autoComplete="new-password"
                            className={input}
                        />
                        <PasswordInput
                            id="pw-confirm"
                            label="Ulangi password baru"
                            value={confirm}
                            onChange={setConfirm}
                            show={show}
                            onToggle={() => setShow((v) => !v)}
                            autoComplete="new-password"
                            className={input}
                        />

                        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            {rules.map((rule) => (
                                <li
                                    key={rule.label}
                                    className={`flex items-center gap-1 ${rule.ok ? 'text-[#059833]' : 'text-gray-400'}`}
                                >
                                    {rule.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                                    {rule.label}
                                </li>
                            ))}
                        </ul>

                        {error ? (
                            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                                {error}
                            </p>
                        ) : null}

                        <button
                            type="submit"
                            disabled={busy || !valid}
                            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#059833] font-semibold text-white shadow-sm transition hover:bg-[#047f2b] active:scale-[0.98] disabled:cursor-default disabled:opacity-50"
                        >
                            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                            Simpan password
                        </button>
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            disabled={busy}
                            className="h-10 w-full cursor-pointer rounded-xl text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                            {hasPassword ? 'Batal' : 'Nanti saja'}
                        </button>
                    </form>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function PasswordInput({
    id,
    label,
    value,
    onChange,
    show,
    onToggle,
    autoComplete,
    className,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    show: boolean;
    onToggle: () => void;
    autoComplete: string;
    className: string;
}) {
    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    type={show ? 'text' : 'password'}
                    autoComplete={autoComplete}
                    maxLength={72}
                    required
                    className={className}
                />
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute right-1.5 top-1.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                >
                    {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
            </div>
        </div>
    );
}
