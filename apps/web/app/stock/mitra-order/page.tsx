'use client';

import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import ProtectedRoute from '@/components/ProtectedRoute';

function MitraOrderContent() {
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
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Rak Mitra Order</h1>
                <p className="text-gray-600 mb-8">
                    Tampilan rak untuk mitra order
                </p>

                <div className="bg-white rounded-xl shadow-lg p-8">
                    <div className="text-center py-12">
                        <svg
                            className="mx-auto w-16 h-16 text-green-400 mb-4"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <p className="text-lg font-medium text-gray-900 mb-2">Rak Mitra Order</p>
                        <p className="text-gray-500">Halaman ini akan segera tersedia</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function MitraOrderPage() {
    return (
        <ProtectedRoute allowedRoles={['baku', 'manager']}>
            <MitraOrderContent />
        </ProtectedRoute>
    );
}
