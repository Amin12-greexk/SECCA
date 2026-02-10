'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export default function NotFound() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

            tl.fromTo(
                containerRef.current.querySelector('.logo-box'),
                { opacity: 0, scale: 0.8, y: 20 },
                { opacity: 1, scale: 1, y: 0, duration: 0.7 }
            );
            tl.fromTo(
                containerRef.current.querySelector('.error-code'),
                { opacity: 0, y: 30, scale: 0.9 },
                { opacity: 1, y: 0, scale: 1, duration: 0.6 },
                '-=0.3'
            );
            tl.fromTo(
                containerRef.current.querySelectorAll('.fade-up'),
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 },
                '-=0.2'
            );
        }
    }, []);

    return (
        <div className="min-h-screen relative overflow-hidden bg-gray-50">
            {/* Background decorations */}
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-100/60 blur-3xl" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-teal-100/50 blur-3xl" />

            <div ref={containerRef} className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
                {/* Logo */}
                <div className="logo-box mb-8">
                    <div className="w-24 h-24 bg-white rounded-2xl shadow-lg shadow-emerald-500/10 flex items-center justify-center p-3 ring-1 ring-gray-100">
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
                <div className="error-code mb-6">
                    <span className="text-8xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-emerald-600 to-emerald-400 leading-none">
                        404
                    </span>
                </div>

                {/* Error Message */}
                <h1 className="fade-up text-2xl md:text-3xl font-bold text-gray-900 mb-3 text-center">
                    Halaman Tidak Ditemukan
                </h1>
                <p className="fade-up text-gray-500 mb-10 text-center max-w-md">
                    Maaf, halaman yang Anda cari tidak dapat ditemukan.
                    Silakan kembali ke halaman utama.
                </p>

                {/* Back Button */}
                <Link
                    href="/"
                    className="fade-up group inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:bg-emerald-700 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
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
