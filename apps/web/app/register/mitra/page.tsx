'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { registerMitra } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/lib/toast';

type FormState = {
    pinKaryawan: string;
    name: string;
    email: string;
    phone: string;
    password: string;
};

const initialForm: FormState = {
    pinKaryawan: '',
    name: '',
    email: '',
    phone: '',
    password: '',
};

export default function RegisterMitraPage() {
    const router = useRouter();
    const toast = useToast();
    const { isAuthenticated } = useAuth();
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [form, setForm] = useState<FormState>(initialForm);

    useEffect(() => {
        if (isAuthenticated) {
            router.replace('/mitra/board');
        }
    }, [isAuthenticated, router]);

    const updateField = (key: keyof FormState, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        const pinKaryawan = form.pinKaryawan.replace(/\D/g, '').slice(0, 6);
        const name = form.name.trim();
        const email = form.email.trim().toLowerCase();
        const phone = form.phone.trim();
        const password = form.password;

        if (!pinKaryawan || !name || !email || !phone || !password) {
            toast.error('Lengkapi semua field pendaftaran.');
            return;
        }
        if (pinKaryawan.length < 3 || pinKaryawan.length > 6) {
            toast.error('PIN harus 3-6 digit angka.');
            return;
        }

        setSubmitting(true);
        try {
            const result = await registerMitra({
                pinKaryawan,
                name,
                email,
                phone,
                password,
            });

            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');

            toast.success('Pendaftaran berhasil. Mengarahkan ke dashboard mitra...');
            window.location.assign('/mitra/board');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Pendaftaran gagal.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-10">
            <div className="mx-auto w-full max-w-lg rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
                <h1 className="text-2xl font-bold text-gray-900">Pendaftaran Mitra</h1>
                <p className="mt-1 text-sm text-gray-600">
                    Masukkan PIN mesin finger (3-6 digit).
                </p>

                <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700" htmlFor="pin">
                            PIN Karyawan / Mitra
                        </label>
                        <input
                            id="pin"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={form.pinKaryawan}
                            onChange={(e) =>
                                updateField('pinKaryawan', e.target.value.replace(/\D/g, '').slice(0, 6))
                            }
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                            disabled={submitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700" htmlFor="name">
                            Nama Lengkap
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={form.name}
                            onChange={(e) => updateField('name', e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                            disabled={submitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700" htmlFor="email">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={form.email}
                            onChange={(e) => updateField('email', e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                            disabled={submitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700" htmlFor="phone">
                            Nomor WhatsApp
                        </label>
                        <input
                            id="phone"
                            type="tel"
                            value={form.phone}
                            onChange={(e) => updateField('phone', e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                            disabled={submitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700" htmlFor="password">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={form.password}
                                onChange={(e) => updateField('password', e.target.value)}
                                className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                                disabled={submitting}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((prev) => !prev)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-gray-700"
                                disabled={submitting}
                            >
                                {showPassword ? 'Sembunyi' : 'Lihat'}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-xl bg-green-700 px-4 py-3 font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? 'Memproses...' : 'Daftar & Masuk'}
                    </button>
                </form>

                <p className="mt-5 text-center text-sm text-gray-600">
                    Sudah punya akun?{' '}
                    <Link href="/login" className="font-semibold text-green-700 hover:text-green-800">
                        Login di sini
                    </Link>
                </p>
            </div>
        </div>
    );
}
