'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/AuthContext';
import { useLogoReveal, useSequenceReveal } from '@/hooks/useMotion';
import AmbientBlobs from '@/components/animations/AmbientBlobs';
import LoadingCircle from '@/components/LoadingCircle';
import Alert from '@/components/Alert';
import { getDefaultAuthorizedPath } from '@/lib/access-control';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const logoRef = useRef<HTMLDivElement>(null);
    const { login, isAuthenticated, user } = useAuth();
    const router = useRouter();

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            router.push(getDefaultAuthorizedPath(user));
        }
    }, [isAuthenticated, router, user]);

    // Logo entrance
    useLogoReveal(logoRef, { delay: 0.1, duration: 0.7 });

    // Card + form stagger
    useSequenceReveal(
        containerRef,
        [
            {
                selector: '.reveal-card',
                from: { opacity: 0, y: 24, scale: 0.98 },
                to: { opacity: 1, y: 0, scale: 1, duration: 0.65, delay: 0.35, ease: 'power3.out' },
            },
            {
                selector: '.reveal-field',
                from: { opacity: 0, y: 14 },
                to: { opacity: 1, y: 0, duration: 0.45, stagger: 0.07 },
                position: '-=0.25',
            },
            {
                selector: '.reveal-submit',
                from: { opacity: 0, y: 12, scale: 0.96 },
                to: { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.2)' },
                position: '-=0.15',
            },
        ],
        [],
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!email.trim() || !password.trim()) {
            setError('Email dan password harus diisi');
            return;
        }

        setLoading(true);

        try {
            await login(email, password, rememberMe);
            // Redirect handled by AuthContext
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Login gagal';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 relative overflow-hidden">
            {/* Ambient background */}
            <AmbientBlobs />

            <div ref={containerRef} className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <div
                        ref={logoRef}
                        className="w-20 h-20 bg-white rounded-2xl shadow-lg shadow-emerald-500/10 flex items-center justify-center p-3 ring-1 ring-gray-100 transition-shadow duration-300 hover:shadow-xl hover:shadow-emerald-500/15"
                        style={{ opacity: 0 }}
                    >
                        <Image
                            src="/Assets/Logo-secca.png"
                            alt="Logo SECCA"
                            width={64}
                            height={64}
                            className="w-full h-full object-contain"
                        />
                    </div>
                </div>

                {/* Login Card */}
                <div
                    className="reveal-card bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-8 ring-1 ring-gray-100"
                    style={{ opacity: 0 }}
                >
                    <h1 className="text-2xl font-bold text-gray-900 mb-1 text-center">
                        Selamat Datang
                    </h1>
                    <p className="text-gray-500 mb-6 text-center text-sm">
                        Silakan login untuk melanjutkan
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Email */}
                        <div className="reveal-field" style={{ opacity: 0 }}>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition bg-gray-50/50"
                                required
                                disabled={loading}
                            />
                        </div>

                        {/* Password */}
                        <div className="reveal-field" style={{ opacity: 0 }}>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition pr-12 bg-gray-50/50"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    disabled={loading}
                                >
                                    {showPassword ? (
                                        <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className="reveal-field flex items-center justify-between text-sm text-gray-600" style={{ opacity: 0 }}>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    disabled={loading}
                                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                Ingat saya
                            </label>
                            <a href="#" className="text-emerald-600 hover:text-emerald-700 font-medium">
                                Lupa Password?
                            </a>
                        </div>

                        <div className="reveal-field text-sm text-gray-600" style={{ opacity: 0 }}>
                            Belum punya akun mitra?{' '}
                            <Link href="/register/mitra" className="font-semibold text-emerald-600 hover:text-emerald-700">
                                Daftar di sini
                            </Link>
                        </div>

                        {/* Error Alert */}
                        {error && (
                            <Alert variant="error" dismissible onDismiss={() => setError(null)}>
                                {error}
                            </Alert>
                        )}

                        {/* Submit Button */}
                        <div className="reveal-submit" style={{ opacity: 0 }}>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] active:shadow-md"
                            >
                                {loading ? (
                                    <>
                                        <LoadingCircle size="sm" />
                                        <span>Memproses...</span>
                                    </>
                                ) : (
                                    <span>Login</span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
