'use client';

import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import ProtectedRoute from '@/components/ProtectedRoute';

function SupplierContent() {
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
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Tambah Supplier</h1>
                <p className="text-gray-600 mb-8">
                    Halaman untuk menambahkan supplier bahan baku
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
                            <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        <p className="text-gray-500">Halaman ini akan segera tersedia</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SupplierPage() {
    return (
        <ProtectedRoute allowedRoles={['baku', 'manager']}>
            <SupplierContent />
        </ProtectedRoute>
    );
}
