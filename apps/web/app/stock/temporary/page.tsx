'use client';

import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import ProtectedRoute from '@/components/ProtectedRoute';

function TemporaryContent() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) {
            gsap.fromTo(
                containerRef.current,
                { opacity: 0, y: 30 },
                { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
            );
        }
    }, []);

    return (
        <div ref={containerRef} className="p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Rak Penempatan Sementara</h1>
                <p className="text-gray-600 mb-8">
                    Tampilan rak untuk penempatan sementara
                </p>

                <div className="bg-white rounded-xl shadow-lg p-8">
                    <div className="text-center py-12">
                        <svg
                            className="mx-auto w-16 h-16 text-yellow-400 mb-4"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                        <p className="text-lg font-medium text-gray-900 mb-2">Rak Penempatan Sementara</p>
                        <p className="text-gray-500">Halaman ini akan segera tersedia</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function TemporaryPage() {
    return (
        <ProtectedRoute>
            <TemporaryContent />
        </ProtectedRoute>
    );
}
