'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

export default function NotFound() {
    const containerRef = useRef<HTMLDivElement>(null);
    const leafRef = useRef<SVGPathElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            gsap.fromTo(
                containerRef.current,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
            );
        }

        if (leafRef.current) {
            gsap.to(leafRef.current, {
                rotation: 10,
                transformOrigin: 'center',
                duration: 2,
                ease: 'power1.inOut',
                yoyo: true,
                repeat: -1,
            });
        }
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-white px-4">
            <div ref={containerRef} className="text-center max-w-md">
                {/* Animated 404 Illustration */}
                <div className="mb-8">
                    <svg
                        width="200"
                        height="200"
                        viewBox="0 0 200 200"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="mx-auto"
                    >
                        {/* Background Circle */}
                        <circle cx="100" cy="100" r="80" fill="rgb(22, 163, 74)" opacity="0.1" />

                        {/* Large Leaf */}
                        <path
                            ref={leafRef}
                            d="M100 40C100 40 70 50 70 90C70 130 100 140 100 140C100 140 130 130 130 90C130 50 100 40 100 40Z"
                            fill="rgb(22, 163, 74)"
                        />

                        {/* Leaf Vein */}
                        <path
                            d="M100 45L100 135"
                            stroke="white"
                            strokeWidth="3"
                            strokeLinecap="round"
                        />

                        {/* 404 Text */}
                        <text
                            x="100"
                            y="180"
                            fontSize="32"
                            fontWeight="bold"
                            fill="rgb(22, 163, 74)"
                            textAnchor="middle"
                        >
                            404
                        </text>
                    </svg>
                </div>

                {/* Error Message */}
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    Halaman Tidak Ditemukan
                </h1>
                <p className="text-gray-600 mb-8">
                    Maaf, halaman yang Anda cari tidak dapat ditemukan. Silakan kembali ke halaman utama.
                </p>

                {/* Back to Home Button */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
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
                        <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Kembali ke Beranda
                </Link>
            </div>
        </div>
    );
}
