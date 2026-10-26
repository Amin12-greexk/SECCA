'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { gsap } from 'gsap';
import { ChevronRight, LogIn, UserRound } from 'lucide-react';
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
    <div ref={containerRef} className="relative min-h-[100dvh] overflow-hidden">
      <Image
        src="/Assets/Background.png"
        alt=""
        fill
        priority
        quality={55}
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white/85 to-emerald-50/90" />

      <div
        ref={contentRef}
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col justify-center px-5 py-12"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="logo-image mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-white p-3 shadow-lg shadow-emerald-900/10 ring-1 ring-gray-100">
            <Image
              src="/Assets/Logo-secca.png"
              alt="Logo SECCA"
              width={120}
              height={120}
              className="h-full w-full object-contain"
              priority
            />
          </div>
          <h1 className="animate-content text-3xl font-bold tracking-tight text-gray-900">
            Selamat Datang di <span className="text-[#059833]">SECCA</span>
          </h1>
          <p className="animate-content mt-2 text-sm text-gray-500">
            Pilih cara masuk
          </p>
        </div>

        <nav className="space-y-3">
          <EntryCard
            href="/cek"
            primary
            icon={<UserRound className="h-6 w-6" />}
            title="Cek Performa & Gaji"
            description="Untuk mitra · cukup PIN"
          />
          <EntryCard
            href="/login"
            icon={<LogIn className="h-6 w-6" />}
            title="Masuk Aplikasi"
            description="Untuk staf · email & sandi"
          />
        </nav>

        <p className="animate-content mt-10 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} SECCA
        </p>
      </div>
    </div>
  );
}

function EntryCard({
  href,
  icon,
  title,
  description,
  primary = false,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`animate-content group flex items-center gap-4 rounded-2xl px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059833] focus-visible:ring-offset-2 ${
        primary
          ? 'bg-[#059833] text-white shadow-lg shadow-[rgba(5,152,51,0.25)] hover:bg-[#047f2b] hover:shadow-xl'
          : 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200 hover:shadow-md hover:ring-[#059833]/40'
      }`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
          primary ? 'bg-white/15 text-white' : 'bg-emerald-50 text-[#059833]'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className={`block text-sm ${primary ? 'text-emerald-50/90' : 'text-gray-500'}`}>
          {description}
        </span>
      </span>
      <ChevronRight
        className={`h-5 w-5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${
          primary ? 'text-white/80' : 'text-gray-400'
        }`}
      />
    </Link>
  );
}
