'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { useAuth } from '@/lib/auth/AuthContext';
import { getDefaultAuthorizedPath } from '@/lib/access-control';

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push(getDefaultAuthorizedPath(user));
    }
  }, [isAuthenticated, loading, router, user]);

  useEffect(() => {
    if (loading || isAuthenticated || !contentRef.current) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) return;

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(
      contentRef.current.querySelector('.logo-image'),
      { scale: 0.88, opacity: 0, y: 18 },
      { scale: 1, opacity: 1, y: 0, duration: 0.7 },
    ).fromTo(
      contentRef.current.querySelectorAll('.animate-content'),
      { y: 18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.45, stagger: 0.08 },
      '-=0.28',
    );

    return () => {
      tl.kill();
    };
  }, [loading, isAuthenticated]);

  if (loading || isAuthenticated) return null;

  return (
    <div
      ref={containerRef}
      className="relative min-h-[100dvh] overflow-hidden"
    >
      <Image
        src="/Assets/Background.png"
        alt=""
        fill
        priority
        quality={55}
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-white/85" />

      <div
        ref={contentRef}
        className="relative z-10 min-h-[100dvh] flex flex-col items-center justify-center px-6 py-16"
      >
        <div className="logo-image mb-10">
          <div className="flex h-[140px] w-[140px] items-center justify-center rounded-3xl bg-white p-4 shadow-xl shadow-emerald-900/8 ring-1 ring-gray-100/80 md:h-[176px] md:w-[176px] transition-shadow duration-300 hover:shadow-2xl hover:shadow-emerald-900/12">
            <Image
              src="/Assets/Logo-secca.png"
              alt="Logo SECCA"
              width={200}
              height={200}
              className="h-full w-full object-contain"
              priority
            />
          </div>
        </div>

        <h1 className="animate-content text-4xl md:text-5xl font-bold text-gray-900 mb-3 tracking-tight text-center">
          Selamat Datang di{' '}
          <span className="text-[#059833]">SECCA</span>
        </h1>

        <p className="animate-content text-base md:text-lg text-gray-600 mb-10 text-center max-w-md">
          Sistem Manajemen Operasional untuk Baku, Mitra, dan Manajemen.
        </p>

        <div className="animate-content flex flex-col sm:flex-row gap-4 mb-10">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#059833] px-8 py-4 font-semibold text-white shadow-lg shadow-[rgba(5,152,51,0.25)] transition-all duration-200 hover:bg-[#047f2b] hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] active:shadow-md"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Masuk Aplikasi
          </Link>
          <Link
            href="/performa"
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-[#059833]/30 px-8 py-4 font-semibold text-[#059833] transition-all duration-200 hover:bg-green-50 hover:border-[#059833] hover:-translate-y-0.5 active:scale-[0.97] bg-white/60 backdrop-blur-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Buka Dashboard
          </Link>
        </div>

        <p className="animate-content text-sm text-gray-500">
          Akses untuk Baku, Manager, Mitra & Koreksi
        </p>
      </div>
    </div>
  );
}
