'use client';

import { useMemo } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
    DataZoomComponent,
    GridComponent,
    LegendComponent,
    MarkLineComponent,
    TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import type { EChartsOption } from 'echarts';

// Import selektif: hanya modul yang dipakai halaman performa, supaya bundle
// jauh lebih ringan daripada import 'echarts' penuh.
echarts.use([
    BarChart,
    LineChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    MarkLineComponent,
    DataZoomComponent,
    CanvasRenderer,
]);

export default function EChart({
    option,
    height = 320,
    onEvents,
}: {
    option: EChartsOption;
    height?: number;
    /** mis. { click: (params) => ... } — dipakai ranking untuk pilih anak. */
    onEvents?: Record<string, (params: unknown) => void>;
}) {
    const style = useMemo(() => ({ height, width: '100%' }), [height]);

    // Animasi masuk cepat untuk polesan, tapi hormati prefers-reduced-motion.
    const reducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const merged = useMemo<EChartsOption>(
        () => ({
            animationDuration: 500,
            animationEasing: 'cubicOut',
            ...option,
            animation: reducedMotion ? false : (option.animation ?? true),
        }),
        [option, reducedMotion],
    );

    return (
        <ReactEChartsCore
            echarts={echarts}
            option={merged}
            // notMerge: opsi lama tidak boleh nyangkut saat metrik/seri berganti.
            // lazyUpdate sengaja tidak dipakai — opsi sudah di-memo, dan update
            // sinkron memastikan seri langsung tergambar (bukan nunggu batch).
            notMerge
            style={style}
            onEvents={onEvents}
            opts={{ renderer: 'canvas' }}
        />
    );
}
