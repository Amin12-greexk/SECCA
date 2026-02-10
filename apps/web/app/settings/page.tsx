'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth/AuthContext';

function SettingsContent() {
    const { user } = useAuth();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            gsap.fromTo(
                containerRef.current.children,
                { opacity: 0, y: 16 },
                { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out' }
            );
        }
    }, []);

    if (!user) return null;

    return (
        <div ref={containerRef} className="min-h-[calc(100vh-72px)] bg-slate-50 px-4 py-8">
            <div className="mx-auto max-w-4xl space-y-6">
                <div className="rounded-2xl bg-green-600 p-6 text-white shadow-sm">
                    <h1 className="text-2xl font-semibold">Pengaturan</h1>
                    <p className="mt-1 text-sm text-green-100">Pengaturan dasar akun dan aplikasi.</p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900">Akun</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Anda login sebagai <span className="font-semibold">{user.name}</span> ({user.role}).
                    </p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-gray-200 p-4">
                            <p className="text-xs text-gray-500">Status sesi</p>
                            <p className="mt-1 text-sm font-medium text-gray-900">Aktif</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 p-4">
                            <p className="text-xs text-gray-500">Keamanan</p>
                            <p className="mt-1 text-sm text-gray-700">
                                Gunakan “Ingat saya” saat login jika ingin sesi tersimpan.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900">Aplikasi</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Pengaturan lanjutan akan ditambahkan sesuai kebutuhan operasional.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function SettingsPage() {
    return (
        <ProtectedRoute>
            <SettingsContent />
        </ProtectedRoute>
    );
}
