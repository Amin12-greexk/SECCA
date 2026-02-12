'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { useAuth } from '@/lib/auth/AuthContext';

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!loading && !isAuthenticated && contentRef.current) {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(
        contentRef.current.querySelector('.logo-image'),
        { scale: 0.8, opacity: 0, y: 20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.8 }
      );

      tl.fromTo(
        contentRef.current.querySelectorAll('.animate-content'),
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.1 },
        '-=0.4'
      );
    }
  }, [loading, isAuthenticated]);

  if (loading || isAuthenticated) return null;

  return (
    <div
      ref={containerRef}
      className="min-h-[100dvh] relative bg-cover bg-center"
      style={{ backgroundImage: "url('/Assets/Background.png')" }}
    >
      {/* Semi-transparent white overlay */}
      <div className="absolute inset-0 bg-white/85" />

      {/* Content */}
      <div
        ref={contentRef}
        className="relative z-10 min-h-[100dvh] flex flex-col items-center justify-center px-6 py-16"
      >
        {/* Logo */}
        <div className="logo-image mb-10">
          <Image
            src="/Assets/Logo-secca.png"
            alt="Logo SECCA"
            width={200}
            height={200}
            className="w-[140px] md:w-[180px] h-auto object-contain drop-shadow-md"
            priority
          />
        </div>

        {/* Welcome Text */}
        <h1 className="animate-content text-4xl md:text-5xl font-bold text-gray-900 mb-3 tracking-tight text-center">
          Selamat Datang di <span className="text-emerald-600">SECCA</span>
        </h1>

        <p className="animate-content text-base md:text-lg text-gray-600 mb-10 text-center max-w-md">
          Sistem Manajemen Operasional untuk Baku, Mitra, dan Manajemen.
        </p>

        {/* Buttons */}
        <div className="animate-content flex flex-col sm:flex-row gap-4 mb-10">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-8 py-4 font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:bg-emerald-700 hover:shadow-xl hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Masuk Aplikasi
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-600/30 px-8 py-4 font-semibold text-emerald-700 transition-all duration-200 hover:bg-emerald-50 hover:border-emerald-600 hover:-translate-y-0.5 bg-white/50 backdrop-blur-sm"
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
