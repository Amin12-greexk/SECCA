'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { useAuth } from '@/lib/auth/AuthContext';

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  // Redirect to dashboard if authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (containerRef.current && !loading) {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
      );
    }
  }, [loading]);

  // Show nothing while checking auth (will redirect if authenticated)
  if (loading || isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-[100dvh] bg-white">
      <div
        ref={containerRef}
        className="grid min-h-[100dvh] w-full grid-cols-1 md:grid-cols-2"
      >
        <section className="flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-10">
          <div className="text-4xl font-semibold text-green-700">SECCA</div>
        </section>

        <section className="flex flex-col justify-center bg-white p-10 md:px-14">
          <h1 className="text-4xl font-bold text-gray-900">
            Selamat Datang di <span className="text-green-600">SECCA</span>
          </h1>
          <p className="mt-3 text-base text-gray-600">
            Sistem Manajemen Operasional untuk Baku, Mitra, dan Manajemen.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-medium text-white shadow-md transition-colors hover:bg-green-700"
            >
              Masuk Aplikasi
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-green-600 px-6 py-3 font-medium text-green-700 transition-colors hover:bg-green-50"
            >
              Buka Dashboard
            </Link>
          </div>

          <div className="mt-6 text-sm text-gray-500">
            Akses sesuai peran: Baku, Manager, Mitra, dan Admin.
          </div>
        </section>
      </div>
    </div>
  );
}
