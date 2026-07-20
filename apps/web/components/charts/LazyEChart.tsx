'use client';

import dynamic from 'next/dynamic';

/**
 * ECharts butuh DOM/canvas, jadi di-load client-side saja.
 * Ini juga menjaga bundle awal halaman tetap ringan.
 */
const LazyEChart = dynamic(() => import('./EChart'), {
    ssr: false,
    loading: () => (
        <div className="flex h-[320px] items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-green-600" />
        </div>
    ),
});

export default LazyEChart;
