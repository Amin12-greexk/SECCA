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
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center bg-gradient-to-br from-green-50 to-white">
      <div ref={containerRef} className="text-center max-w-2xl px-4">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Selamat Datang di <span className="text-green-600">SECCA</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Sistem Manajemen Penerimaan Bahan Baku
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/baku/receive"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 4v16m8-8H4" />
            </svg>
            Terima Baku
          </Link>

          <Link
            href="/baku/list"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-green-600 font-medium rounded-lg border-2 border-green-600 hover:bg-green-50 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Lihat Daftar Baku
          </Link>
        </div>
      </div>
    </div>
  );
}
