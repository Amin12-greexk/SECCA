'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { RefreshCw, Truck, TrendingUp, Package } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/lib/toast';
import {
    getRackLotsByCode,
    moveLot,
    type ProductionLot,
} from '@/lib/api';

type RackKey = 'preSale' | 'mitraOrder';
type ViewMode = 'grid' | 'list';

const RACKS: Record<RackKey, { code: string; title: string; description: string; accent: string; color: string }> = {
    preSale: {
        code: 'RAK_SEMENTARA',
        title: 'Rak Sementara',
        description: 'LP hasil pecah bon ',
        accent: 'bg-gray-500',
        color: 'gray',
    },
    mitraOrder: {
        code: 'RAK_MITRA_ORDER',
        title: 'Rak Mitra Order',
        description: 'LP yang siap dikerjakan mitra.',
        accent: 'bg-emerald-700',
        color: 'emerald',
    },
};

const formatNumber = (value: number, fractionDigits = 2) =>
    new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(value);

function RackContent() {
    const toast = useToast();
    const { user } = useAuth();
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [moving, setMoving] = useState(false);
    const [dragOver, setDragOver] = useState<RackKey | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGrade, setSelectedGrade] = useState<string>('all');
    const [rackLots, setRackLots] = useState<Record<RackKey, ProductionLot[]>>({
        preSale: [],
        mitraOrder: [],
    });

    useEffect(() => {
        if (containerRef.current) {
            gsap.fromTo(
                containerRef.current,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }
            );
        }
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [preSale, mitraOrder] = await Promise.all([
                getRackLotsByCode(RACKS.preSale.code),
                getRackLotsByCode(RACKS.mitraOrder.code),
            ]);
            setRackLots({
                preSale: preSale.lots,
                mitraOrder: mitraOrder.lots,
            });
        } catch (err) {
            console.error('Error loading rack data:', err);
            toast.error('Gagal memuat data rak.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const allGrades = useMemo(() => {
        const grades = new Set<string>();
        Object.values(rackLots).forEach(lots => {
            lots.forEach(lot => {
                if (lot.grade?.code) grades.add(lot.grade.code);
            });
        });
        return Array.from(grades).sort();
    }, [rackLots]);

    const filteredRackLots = useMemo(() => {
        const filtered: Record<RackKey, ProductionLot[]> = {
            preSale: [],
            mitraOrder: [],
        };

        Object.keys(rackLots).forEach((key) => {
            const rackKey = key as RackKey;
            filtered[rackKey] = rackLots[rackKey].filter((lot) => {
                const matchesSearch = searchTerm === '' ||
                    (lot.externalId?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    lot.lotNumber.toLowerCase().includes(searchTerm.toLowerCase());
                
                const matchesGrade = selectedGrade === 'all' || lot.grade?.code === selectedGrade;

                return matchesSearch && matchesGrade;
            });
        });

        return filtered;
    }, [rackLots, searchTerm, selectedGrade]);

    const totals = useMemo(() => {
        const sumWeights = (lots: ProductionLot[]) =>
            lots.reduce((sum, lot) => sum + lot.wetWeightGram, 0);
        return {
            preSale: {
                count: filteredRackLots.preSale.length,
                weight: sumWeights(filteredRackLots.preSale),
                totalCount: rackLots.preSale.length,
            },
            mitraOrder: {
                count: filteredRackLots.mitraOrder.length,
                weight: sumWeights(filteredRackLots.mitraOrder),
                totalCount: rackLots.mitraOrder.length,
            },
        };
    }, [filteredRackLots, rackLots]);

    const handleDragStart = (event: React.DragEvent<HTMLDivElement>, lot: ProductionLot, from: RackKey) => {
        event.dataTransfer.setData(
            'application/json',
            JSON.stringify({ lotId: lot.id, from })
        );
        event.dataTransfer.effectAllowed = 'move';
        
        // Add visual feedback
        if (event.currentTarget) {
            event.currentTarget.style.opacity = '0.5';
        }
    };

    const handleDragEnd = (event: React.DragEvent<HTMLDivElement>) => {
        if (event.currentTarget) {
            event.currentTarget.style.opacity = '1';
        }
    };

    const handleDragOver = (event: React.DragEvent<HTMLDivElement>, target: RackKey) => {
        event.preventDefault();
        setDragOver(target);
    };

    const handleDrop = async (event: React.DragEvent<HTMLDivElement>, target: RackKey) => {
        event.preventDefault();
        setDragOver(null);
        if (moving) return;

        const raw = event.dataTransfer.getData('application/json');
        if (!raw) return;

        try {
            const payload = JSON.parse(raw) as { lotId: string; from: RackKey };
            if (payload.from === target) return;

            setMoving(true);
            await moveLot(payload.lotId, RACKS[target].code);
            toast.success('LP berhasil dipindahkan.');
            await loadData();
        } catch (err) {
            console.error('Error moving lot:', err);
            const message = err instanceof Error ? err.message : 'Gagal memindahkan lot.';
            toast.error(message);
        } finally {
            setMoving(false);
        }
    };

    const renderLotCard = (lot: ProductionLot, from: RackKey, rackColor: string) => {
        const isPrinted = !!lot.printedAt;
        const printedLabel = isPrinted ? 'Sudah Cetak' : 'Belum Cetak';
        const printedBadgeClass = isPrinted
            ? 'bg-emerald-100 text-emerald-700'
            : 'bg-amber-100 text-amber-700';

        if (viewMode === 'list') {
            return (
                <div
                    key={lot.id}
                    draggable
                    onDragStart={(event) => handleDragStart(event, lot, from)}
                    onDragEnd={handleDragEnd}
                    className="group cursor-move rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                >
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${rackColor}-100 flex-shrink-0`}>
                                <Package className={`h-5 w-5 text-${rackColor}-600`} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-900 truncate">
                                        {lot.externalId ?? lot.lotNumber}
                                    </span>
                                    <span className={`rounded-md bg-${rackColor}-100 px-2 py-0.5 text-xs font-medium text-${rackColor}-700`}>
                                        {lot.grade?.code ?? 'GRADE'}
                                    </span>
                                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${printedBadgeClass}`}>
                                        {printedLabel}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">{lot.status}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                            <div className="text-right">
                                <div className="text-xs text-gray-500">Basah</div>
                                <div className="font-semibold text-gray-900">{formatNumber(lot.wetWeightGram, 0)} gr</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-gray-500">Kering</div>
                                <div className="font-semibold text-gray-900">{formatNumber(lot.dryWeightGramLocked, 0)} gr</div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div
                key={lot.id}
                draggable
                onDragStart={(event) => handleDragStart(event, lot, from)}
                onDragEnd={handleDragEnd}
                className="group cursor-move rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm transition-all hover:border-gray-300 hover:shadow-lg hover:-translate-y-0.5"
            >
                <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-${rackColor}-100 flex-shrink-0`}>
                        <Package className={`h-4 w-4 text-${rackColor}-600`} />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className={`rounded-md bg-${rackColor}-100 px-2 py-1 text-[10px] font-semibold text-${rackColor}-700 uppercase tracking-wide`}>
                            {lot.grade?.code ?? 'GRADE'}
                        </span>
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${printedBadgeClass}`}>
                            {printedLabel}
                        </span>
                    </div>
                </div>
                <div className="mb-2.5">
                    <div className="text-xs text-gray-500 mb-0.5">LP Number</div>
                    <div className="text-sm font-bold text-gray-900 truncate">
                        {lot.externalId ?? lot.lotNumber}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="rounded-lg bg-gray-50 p-2">
                        <div className="text-[10px] text-gray-500 uppercase mb-0.5">Basah</div>
                        <div className="text-xs font-semibold text-gray-900">
                            {formatNumber(lot.wetWeightGram, 0)} gr
                        </div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2">
                        <div className="text-[10px] text-gray-500 uppercase mb-0.5">Kering</div>
                        <div className="text-xs font-semibold text-gray-900">
                            {formatNumber(lot.dryWeightGramLocked, 0)} gr
                        </div>
                    </div>
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                    {lot.status}
                </div>
            </div>
        );
    };

    const isLocked = user?.role === 'baku';

    return (
        <div className="relative min-h-[calc(100vh-72px)] bg-slate-50">
            <div
                ref={containerRef}
                className={isLocked ? 'pointer-events-none grayscale opacity-60' : undefined}
            >
            {/* Main Content */}
            <div className="mx-auto max-w-7xl px-4 py-6">
                <div className="grid gap-6 lg:grid-cols-2">
                    {(Object.keys(RACKS) as RackKey[]).map((key) => {
                        const rack = RACKS[key];
                        const lots = filteredRackLots[key];
                        const stats = totals[key];
                        const isOver = dragOver === key;

                        return (
                            <div
                                key={key}
                                onDragOver={(event) => handleDragOver(event, key)}
                                onDragLeave={() => setDragOver(null)}
                                onDrop={(event) => handleDrop(event, key)}
                                className={`flex flex-col rounded-2xl border-2 bg-white shadow-sm transition-all ${
                                    isOver 
                                        ? 'border-emerald-400 shadow-lg ring-4 ring-emerald-400/20 scale-[1.02]' 
                                        : 'border-gray-200'
                                }`}
                            >
                                {/* Rack Header */}
                                <div className={`rounded-t-2xl ${rack.accent} p-5 text-white`}>
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h2 className="text-xl font-bold mb-1">{rack.title}</h2>
                                            <p className="text-sm text-white/90">{rack.description}</p>
                                        </div>
                                        <div className="flex items-center gap-2 rounded-lg bg-white/20 backdrop-blur-sm px-3 py-1.5">
                                            <Truck className="h-4 w-4" />
                                            <span className="text-sm font-bold">{stats.totalCount}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Stats */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-lg bg-white/10 backdrop-blur-sm p-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <TrendingUp className="h-4 w-4" />
                                                <span className="text-xs font-medium text-white/90">Total Berat</span>
                                            </div>
                                            <div className="text-lg font-bold">
                                                {formatNumber(stats.weight / 1000, 1)} kg
                                            </div>
                                        </div>
                                        <div className="rounded-lg bg-white/10 backdrop-blur-sm p-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Package className="h-4 w-4" />
                                                <span className="text-xs font-medium text-white/90">Ditampilkan</span>
                                            </div>
                                            <div className="text-lg font-bold">
                                                {stats.count} LP
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Lots Container */}
                                <div className="flex-1 overflow-hidden">
                                    <div className="h-[calc(100vh-420px)] overflow-y-auto p-4">
                                        {loading ? (
                                            <div className="flex h-full items-center justify-center">
                                                <div className="text-center">
                                                    <RefreshCw className="mx-auto h-8 w-8 animate-spin text-gray-400" />
                                                    <p className="mt-2 text-sm text-gray-500">Memuat LP...</p>
                                                </div>
                                            </div>
                                        ) : lots.length === 0 ? (
                                            <div className="flex h-full items-center justify-center">
                                                <div className="text-center">
                                                    <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                                                        <Package className="h-8 w-8 text-gray-400" />
                                                    </div>
                                                    <p className="text-sm font-medium text-gray-900">
                                                        {searchTerm || selectedGrade !== 'all' 
                                                            ? 'Tidak ada LP yang sesuai filter'
                                                            : 'Belum ada LP di rak ini'}
                                                    </p>
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        {searchTerm || selectedGrade !== 'all'
                                                            ? 'Coba ubah pencarian atau filter'
                                                            : 'Drag & drop LP ke sini'}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={
                                                viewMode === 'grid'
                                                    ? 'grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
                                                    : 'space-y-2'
                                            }>
                                                {lots.map((lot) => renderLotCard(lot, key, rack.color))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            </div>

            {isLocked && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                    <div className="rounded-xl border border-gray-200 bg-white px-6 py-4 text-center shadow-lg">
                        <p className="text-base font-semibold text-gray-900">Rak sedang dikembangkan</p>
                        <p className="mt-1 text-sm text-gray-600">
                            Fitur ini sementara dikunci untuk akun baku.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function RakPage() {
    return (
        <ProtectedRoute allowedRoles={['baku', 'manager']}>
            <RackContent />
        </ProtectedRoute>
    );
}
