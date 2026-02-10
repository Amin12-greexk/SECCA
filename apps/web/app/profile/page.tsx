'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth/AuthContext';

function ProfileContent() {
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
                    <h1 className="text-2xl font-semibold">Profil Saya</h1>
                    <p className="mt-1 text-sm text-green-100">Informasi akun yang sedang aktif.</p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="grid gap-6 md:grid-cols-2">
                        <div>
                            <p className="text-xs text-gray-500">Nama</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{user.name}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{user.email}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Role</p>
                            <p className="mt-1 inline-flex rounded-md bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                                {user.role.toUpperCase()}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">User ID</p>
                            <p className="mt-1 text-sm font-mono text-gray-700">{user.id}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ProfilePage() {
    return (
        <ProtectedRoute>
            <ProfileContent />
        </ProtectedRoute>
    );
}
