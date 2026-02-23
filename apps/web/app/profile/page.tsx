'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth/AuthContext';
import { changePassword } from '@/lib/api';
import { useToast } from '@/lib/toast';

function ProfileContent() {
    const { user } = useAuth();
    const toast = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [savingPassword, setSavingPassword] = useState(false);

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

    const handleChangePassword = async (event: React.FormEvent) => {
        event.preventDefault();
        if (savingPassword) return;

        const { currentPassword, newPassword, confirmPassword } = passwordForm;
        if (!currentPassword || !newPassword || !confirmPassword) {
            toast.error('Lengkapi semua field password.');
            return;
        }
        if (newPassword.length < 6) {
            toast.error('Password baru minimal 6 karakter.');
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error('Konfirmasi password tidak sama.');
            return;
        }

        setSavingPassword(true);
        try {
            await changePassword({
                currentPassword,
                newPassword,
            });
            toast.success('Password berhasil diperbarui.');
            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal mengubah password.');
        } finally {
            setSavingPassword(false);
        }
    };

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
                            <p className="text-xs text-gray-500">PIN Mitra</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{user.pin ?? '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Nomor WhatsApp</p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">{user.phone ?? '-'}</p>
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

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900">Reset Password</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Ubah password akun mitra secara mandiri.
                    </p>

                    <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleChangePassword}>
                        <div className="space-y-2">
                            <label className="text-xs text-gray-500">Password saat ini</label>
                            <input
                                type="password"
                                value={passwordForm.currentPassword}
                                onChange={(event) =>
                                    setPasswordForm((prev) => ({
                                        ...prev,
                                        currentPassword: event.target.value,
                                    }))
                                }
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-gray-500">Password baru</label>
                            <input
                                type="password"
                                value={passwordForm.newPassword}
                                onChange={(event) =>
                                    setPasswordForm((prev) => ({
                                        ...prev,
                                        newPassword: event.target.value,
                                    }))
                                }
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs text-gray-500">Konfirmasi password baru</label>
                            <input
                                type="password"
                                value={passwordForm.confirmPassword}
                                onChange={(event) =>
                                    setPasswordForm((prev) => ({
                                        ...prev,
                                        confirmPassword: event.target.value,
                                    }))
                                }
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <button
                                type="submit"
                                disabled={savingPassword}
                                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {savingPassword ? 'Menyimpan...' : 'Perbarui Password'}
                            </button>
                        </div>
                    </form>
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
