'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { useAuth } from '@/lib/auth/AuthContext';

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftSectionRef = useRef<HTMLDivElement>(null);
  const rightSectionRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  // Redirect to dashboard if authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, router]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Animate Left Section (Logo)
      if (leftSectionRef.current) {
        tl.fromTo(
          leftSectionRef.current,
          { x: -50, opacity: 0 },
          { x: 0, opacity: 1, duration: 1 }
        );

        tl.fromTo(
          leftSectionRef.current.querySelector('.logo-container'),
          { scale: 0.8, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.8 },
          '-=0.5'
        );
      }

      // Animate Right Section (Content)
      if (rightSectionRef.current) {
        tl.fromTo(
          rightSectionRef.current,
          { x: 50, opacity: 0 },
          { x: 0, opacity: 1, duration: 1 },
          '-=0.8'
        );

        tl.fromTo(
          rightSectionRef.current.querySelectorAll('.animate-content'),
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, stagger: 0.1 },
          '-=0.6'
        );
      }
    }
  }, [loading, isAuthenticated]);

  if (loading || isAuthenticated) {
    return null;
  }

  return (
    <div ref={containerRef} className="min-h-[100dvh] flex flex-col md:flex-row bg-white overflow-hidden">

      {/* Left Section - Logo & Branding */}
      <section
        ref={leftSectionRef}
        className="w-full md:w-[45%] lg:w-[40%] bg-emerald-50 flex items-center justify-center p-8 relative overflow-hidden"
      >
        {/* Decorative Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[300px] h-[300px] rounded-full bg-emerald-100/50 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-teal-100/50 blur-3xl" />

        <div className="logo-container relative z-10 p-10 bg-white rounded-3xl shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-50">
          <Image
            src="/Assets/Logo-secca.png"
            alt="Logo SECCA"
            width={280}
            height={280}
            className="w-[180px] md:w-[220px] h-auto object-contain"
            priority
          />
        </div>
      </section>

      {/* Right Section - Content & Background */}
      <section
        ref={rightSectionRef}
        className="w-full md:w-[55%] lg:w-[60%] relative flex flex-col justify-center p-8 md:p-16 lg:p-24"
      >
        {/* Background Image with Overlay */}
        <div
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/Assets/Background.png')" }}
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-l from-white/95 via-white/80 to-white/95 md:to-transparent md:bg-gradient-to-r md:from-white md:via-white/90 md:to-white/40" />

        {/* Content */}
        <div className="relative z-20 max-w-lg">
          <h1 className="animate-content text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4 tracking-tight">
            Selamat Datang di <span className="text-emerald-600 block mt-2">SECCA</span>
          </h1>

          <p className="animate-content text-lg text-gray-600 mb-10 leading-relaxed">
            Sistem Manajemen Operasional Terintegrasi untuk Baku, Mitra, dan Manajemen.
            Kelola operasional bisnis Anda dengan lebih efisien dan terstruktur.
          </p>

          <div className="animate-content flex flex-col sm:flex-row gap-4 mb-12">
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

          <div className="animate-content flex items-center gap-4 text-sm text-gray-500 bg-white/60 backdrop-blur-md p-4 rounded-xl border border-gray-100 inline-flex">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 border-2 border-white">B</div>
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600 border-2 border-white">M</div>
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600 border-2 border-white">K</div>
            </div>
            <p>Akses untuk Baku, Manager, Mitra & Koreksi</p>
          </div>
        </div>
      </section>
    </div>
  );
}
