'use client';

import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import ProtectedRoute from '@/components/ProtectedRoute';

function GradingContent() {
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
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Tambah Grading</h1>
                <p className="text-gray-600 mb-8">
                    Halaman untuk menambahkan grading bahan baku
                </p>

                <div className="bg-white rounded-xl shadow-lg p-8">
                    <div className="text-center py-12">
                        <svg
                            className="mx-auto w-16 h-16 text-gray-400 mb-4"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <p className="text-gray-500">Halaman ini akan segera tersedia</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function GradingPage() {
    return (
        <ProtectedRoute allowedRoles={['baku', 'manager']}>
            <GradingContent />
        </ProtectedRoute>
    );
}
