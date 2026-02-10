'use client';

import { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { StockAsalContent } from '@/app/stock/asal/page';
import { PecahBonContent } from '@/app/stock/pecah-bon/page';

type StockTab = 'asal' | 'pecah';

export default function StockPage() {
    const [activeTab, setActiveTab] = useState<StockTab>('asal');

    return (
        <ProtectedRoute allowedRoles={['baku', 'manager']}>
            <div className="min-h-[calc(100vh-72px)] bg-green-50 py-8 px-4">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-6">
                        <h1 className="text-3xl font-semibold text-gray-900">Halaman Stock</h1>
                        <p className="text-sm text-gray-600">
                            Kelola data stock asal dan pecah bon di satu halaman.
                        </p>
                    </div>

                    <div className="border-b border-gray-200">
                        <div className="flex gap-6">
                            <button
                                type="button"
                                onClick={() => setActiveTab('asal')}
                                className={`pb-3 text-sm font-medium transition-colors ${
                                    activeTab === 'asal'
                                        ? 'border-b-2 border-emerald-600 text-emerald-700'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Data Stock
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('pecah')}
                                className={`pb-3 text-sm font-medium transition-colors ${
                                    activeTab === 'pecah'
                                        ? 'border-b-2 border-emerald-600 text-emerald-700'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                Pecah Bon
                            </button>
                        </div>
                    </div>

                    <div className="mt-6">
                        {activeTab === 'asal' ? (
                            <StockAsalContent embedded />
                        ) : (
                            <PecahBonContent embedded />
                        )}
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
