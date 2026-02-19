'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRef } from 'react';
import { useLogoReveal, useSequenceReveal } from '@/hooks/useMotion';
import AmbientBlobs from '@/components/animations/AmbientBlobs';

export default function NotFound() {
    const containerRef = useRef<HTMLDivElement>(null);
    const logoRef = useRef<HTMLDivElement>(null);

    useLogoReveal(logoRef, { delay: 0.1, duration: 0.7 });

    useSequenceReveal(
        containerRef,
        [
            {
                selector: '.reveal-code',
                from: { opacity: 0, y: 30, scale: 0.9 },
                to: { opacity: 1, y: 0, scale: 1, duration: 0.65, delay: 0.35, ease: 'back.out(1.3)' },
            },
            {
                selector: '.reveal-text',
                from: { opacity: 0, y: 18 },
                to: { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 },
                position: '-=0.25',
            },
            {
                selector: '.reveal-btn',
                from: { opacity: 0, y: 14, scale: 0.96 },
                to: { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.2)' },
                position: '-=0.2',
            },
        ],
        [],
    );

    return (
        <div className="min-h-screen relative overflow-hidden bg-gray-50">
            {/* Ambient background */}
            <AmbientBlobs />

            <div ref={containerRef} className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
                {/* Logo */}
                <div className="mb-8">
                    <div
                        ref={logoRef}
                        className="w-24 h-24 bg-white rounded-2xl shadow-lg shadow-emerald-500/10 flex items-center justify-center p-3 ring-1 ring-gray-100"
                        style={{ opacity: 0 }}
                    >
                        <Image
                            src="/Assets/Logo-secca.png"
                            alt="Logo SECCA"
                            width={80}
                            height={80}
                            className="w-full h-full object-contain"
                        />
                    </div>
                </div>

                {/* 404 Number */}
                <div className="reveal-code mb-6" style={{ opacity: 0 }}>
                    <span className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-emerald-600 to-emerald-400 leading-none">
                        404
                    </span>
                </div>

                {/* Error Message */}
                <h1 className="reveal-text text-2xl md:text-3xl font-bold text-gray-900 mb-3 text-center" style={{ opacity: 0 }}>
                    Halaman Tidak Ditemukan
                </h1>
                <p className="reveal-text text-gray-500 mb-10 text-center max-w-md" style={{ opacity: 0 }}>
                    Maaf, halaman yang Anda cari tidak dapat ditemukan.
                    Silakan kembali ke halaman utama.
                </p>

                {/* Back Button */}
                <Link
                    href="/"
                    className="reveal-btn group inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:bg-emerald-700 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97] transition-all duration-200"
                    style={{ opacity: 0 }}
                >
                    <svg
                        className="w-5 h-5 transition-transform group-hover:-translate-x-0.5"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Kembali ke Beranda
                </Link>
            </div>
        </div>
    );
}
