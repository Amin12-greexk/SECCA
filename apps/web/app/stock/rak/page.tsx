'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
    Filter,
    LayoutGrid,
    List,
    Package,
    RefreshCw,
    TrendingUp,
    Truck,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/toast';
import { getGrades, getRackLotsByCodePaginated, moveLot, type ProductionLot } from '@/lib/api';

type RackKey = 'preSale' | 'mitraOrder';
type ViewMode = 'grid' | 'list';
type PrintedFilter = 'all' | 'printed' | 'unprinted';
const LIST_PAGE_SIZE = 100;

type RackListState = {
    lots: ProductionLot[];
    page: number;
    total: number;
    totalPages: number;
    totalWetWeightGram: number;
};

type GradeOption = {
    id: string;
    code: string;
};

type RackConfig = {
    code: string;
    title: string;
    description: string;
    headerClass: string;
    iconBgClass: string;
    iconTextClass: string;
    badgeClass: string;
};

const RACKS: Record<RackKey, RackConfig> = {
    preSale: {
        code: 'RAK_SEMENTARA',
        title: 'Rak Sementara',
        description: 'LP hasil pecah bon sebelum masuk pool order mitra.',
        headerClass: 'bg-gray-600',
        iconBgClass: 'bg-gray-100',
        iconTextClass: 'text-gray-700',
        badgeClass: 'bg-gray-100 text-gray-700',
    },
    mitraOrder: {
        code: 'RAK_MITRA_ORDER',
        title: 'Rak Mitra Order',
        description: 'LP siap assign ke mitra oleh trainer/pengawas.',
        headerClass: 'bg-green-700',
        iconBgClass: 'bg-green-100',
        iconTextClass: 'text-green-700',
        badgeClass: 'bg-green-100 text-green-700',
    },
};

const formatNumber = (value: number, fractionDigits = 2) =>
    new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(value);

const formatDateTime = (value: string) =>
    new Date(value).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

function RackContent() {
    const toast = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [moving, setMoving] = useState(false);
    const [dragOver, setDragOver] = useState<RackKey | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [searchInput, setSearchInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGradeId, setSelectedGradeId] = useState<string>('all');
    const [gradeOptions, setGradeOptions] = useState<GradeOption[]>([]);
    const [printedFilter, setPrintedFilter] = useState<PrintedFilter>('all');
    const [listPage, setListPage] = useState<Record<RackKey, number>>({
        preSale: 1,
        mitraOrder: 1,
    });
    const [jumpTerm, setJumpTerm] = useState('');
    const [highlightedLotId, setHighlightedLotId] = useState<string | null>(null);
    const [pendingJumpLotId, setPendingJumpLotId] = useState<string | null>(null);
    const [pendingJumpKeyword, setPendingJumpKeyword] = useState<string | null>(null);
    const [rackState, setRackState] = useState<Record<RackKey, RackListState>>({
        preSale: {
            lots: [],
            page: 1,
            total: 0,
            totalPages: 1,
            totalWetWeightGram: 0,
        },
        mitraOrder: {
            lots: [],
            page: 1,
            total: 0,
            totalPages: 1,
            totalWetWeightGram: 0,
        },
    });

    useEffect(() => {
        if (!containerRef.current) return;
        gsap.fromTo(
            containerRef.current,
            { opacity: 0, y: 16 },
            { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }
        );
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [preSale, mitraOrder] = await Promise.all([
                getRackLotsByCodePaginated(RACKS.preSale.code, {
                    page: listPage.preSale,
                    limit: LIST_PAGE_SIZE,
                    search: searchTerm || undefined,
                    gradeId: selectedGradeId === 'all' ? undefined : selectedGradeId,
                    printed: printedFilter,
                }),
                getRackLotsByCodePaginated(RACKS.mitraOrder.code, {
                    page: listPage.mitraOrder,
                    limit: LIST_PAGE_SIZE,
                    search: searchTerm || undefined,
                    gradeId: selectedGradeId === 'all' ? undefined : selectedGradeId,
                    printed: printedFilter,
                }),
            ]);
            setRackState({
                preSale: {
                    lots: preSale.lots,
                    page: preSale.page,
                    total: preSale.total,
                    totalPages: preSale.totalPages,
                    totalWetWeightGram: preSale.totalWetWeightGram,
                },
                mitraOrder: {
                    lots: mitraOrder.lots,
                    page: mitraOrder.page,
                    total: mitraOrder.total,
                    totalPages: mitraOrder.totalPages,
                    totalWetWeightGram: mitraOrder.totalWetWeightGram,
                },
            });
            setListPage((prev) => {
                if (prev.preSale === preSale.page && prev.mitraOrder === mitraOrder.page) {
                    return prev;
                }
                return {
                    preSale: preSale.page,
                    mitraOrder: mitraOrder.page,
                };
            });
        } catch (error) {
            console.error('Error loading rack data:', error);
            toast.error('Gagal memuat data rak.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearchTerm(searchInput.trim());
        }, 250);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    useEffect(() => {
        const loadGradeOptions = async () => {
            try {
                const grades = await getGrades();
                const shapeCodes = grades
                    .filter((grade) => grade.type === 'BENTUK' && grade.code)
                    .map((grade) => ({ id: grade.id, code: grade.code }))
                    .sort((left, right) => left.code.localeCompare(right.code));
                setGradeOptions(shapeCodes);
            } catch (error) {
                console.error('Error loading grades:', error);
            }
        };

        void loadGradeOptions();
    }, []);

    useEffect(() => {
        void loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listPage.preSale, listPage.mitraOrder, searchTerm, selectedGradeId, printedFilter]);

    const listMeta = useMemo(() => {
        const buildMeta = (rack: RackListState) => {
            const page = rack.page;
            const total = rack.total;
            const totalPages = Math.max(1, rack.totalPages);
            const startIndex = total === 0 ? 0 : (page - 1) * LIST_PAGE_SIZE + 1;
            const endIndex = total === 0 ? 0 : Math.min(page * LIST_PAGE_SIZE, total);
            return {
                page,
                total,
                totalPages,
                startIndex,
                endIndex,
                items: rack.lots,
                totalWetWeightGram: rack.totalWetWeightGram,
            };
        };

        return {
            preSale: buildMeta(rackState.preSale),
            mitraOrder: buildMeta(rackState.mitraOrder),
        };
    }, [rackState]);

    const totals = useMemo(
        () => ({
            preSale: {
                count: listMeta.preSale.items.length,
                weight: listMeta.preSale.totalWetWeightGram,
                totalCount: listMeta.preSale.total,
            },
            mitraOrder: {
                count: listMeta.mitraOrder.items.length,
                weight: listMeta.mitraOrder.totalWetWeightGram,
                totalCount: listMeta.mitraOrder.total,
            },
        }),
        [listMeta]
    );

    useEffect(() => {
        if (!pendingJumpLotId) return;

        const raf = window.requestAnimationFrame(() => {
            const row = document.getElementById(`rack-lot-row-${pendingJumpLotId}`);
            if (!row) return;
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedLotId(pendingJumpLotId);
            setPendingJumpLotId(null);
        });

        return () => window.cancelAnimationFrame(raf);
    }, [listMeta, pendingJumpLotId, viewMode]);

    const isLotMovable = (lot: ProductionLot) =>
        !moving && lot.status !== 'COMPLETED' && lot.workItem?.status !== 'IN_PROGRESS';

    const handleDragStart = (
        event: React.DragEvent<HTMLDivElement>,
        lot: ProductionLot,
        from: RackKey
    ) => {
        if (!isLotMovable(lot)) {
            event.preventDefault();
            return;
        }
        event.dataTransfer.setData(
            'application/json',
            JSON.stringify({ lotId: lot.id, from })
        );
        event.dataTransfer.effectAllowed = 'move';
        event.currentTarget.style.opacity = '0.55';
    };

    const handleDragEnd = (event: React.DragEvent<HTMLDivElement>) => {
        event.currentTarget.style.opacity = '1';
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
        } catch (error) {
            console.error('Error moving lot:', error);
            toast.error(error instanceof Error ? error.message : 'Gagal memindahkan LP.');
        } finally {
            setMoving(false);
        }
    };

    const handleQuickJump = () => {
        const keyword = jumpTerm.trim();
        if (!keyword) {
            toast.error('Masukkan LP untuk jump.');
            return;
        }

        setViewMode('list');
        setSearchInput(keyword);
        setSearchTerm(keyword);
        setSelectedGradeId('all');
        setPrintedFilter('all');
        setListPage({
            preSale: 1,
            mitraOrder: 1,
        });
        setPendingJumpKeyword(keyword.toUpperCase());
    };

    const normalizeLotIdentifier = (lot: ProductionLot) =>
        (lot.externalId ?? lot.lotNumber).trim().toUpperCase();

    useEffect(() => {
        if (!pendingJumpKeyword || loading) return;

        const target = pendingJumpKeyword.trim().toUpperCase();
        const candidates = [...listMeta.preSale.items, ...listMeta.mitraOrder.items];
        const found = candidates.find((lot) => normalizeLotIdentifier(lot) === target)
            ?? candidates.find((lot) => normalizeLotIdentifier(lot).includes(target));

        if (!found) {
            toast.error('LP tidak ditemukan.');
            setPendingJumpKeyword(null);
            return;
        }
        setPendingJumpKeyword(null);
        setPendingJumpLotId(found.id);
    }, [listMeta.mitraOrder.items, listMeta.preSale.items, loading, pendingJumpKeyword, toast]);

    const renderLotCard = (lot: ProductionLot, from: RackKey, rack: RackConfig) => {
        const movable = isLotMovable(lot);
        const printed = Boolean(lot.printedAt);
        const gradeLabel = [lot.grade?.code, lot.featherGrade?.code, lot.colorGrade?.code]
            .filter(Boolean)
            .join(' / ');

        if (viewMode === 'list') {
            return (
                <div
                    id={`rack-lot-row-${lot.id}`}
                    key={lot.id}
                    draggable={movable}
                    onDragStart={(event) => handleDragStart(event, lot, from)}
                    onDragEnd={handleDragEnd}
                    className={`rounded-lg border px-3 py-2 transition ${
                        lot.id === highlightedLotId
                            ? 'border-green-400 bg-green-50 ring-1 ring-green-300'
                            : 'border-gray-200 bg-white'
                    } ${
                        movable
                            ? 'cursor-move hover:border-gray-300 hover:shadow-sm'
                            : 'cursor-not-allowed opacity-85'
                    }`}
                >
                    <div className="grid grid-cols-[1.7fr_1.2fr_0.8fr_0.9fr_0.9fr_0.9fr] items-center gap-2 text-xs">
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                                {lot.externalId ?? lot.lotNumber}
                            </p>
                            <p className="truncate text-[11px] text-gray-500">{gradeLabel || '-'}</p>
                        </div>
                        <div className="truncate text-gray-700">{formatDateTime(lot.createdAt)}</div>
                        <div className="text-right font-medium text-gray-900">
                            {formatNumber(lot.wetWeightGram, 0)}g
                        </div>
                        <div className="text-right font-medium text-gray-900">
                            {formatNumber(lot.dryWeightGramLocked, 0)}g
                        </div>
                        <div className="text-center">
                            <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                    printed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}
                            >
                                {printed ? 'Cetak' : 'Belum'}
                            </span>
                        </div>
                        <div className="text-right">
                            {lot.workItem?.status === 'IN_PROGRESS' ? (
                                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                    WO Aktif
                                </span>
                            ) : (
                                <span className="text-[11px] text-gray-500">{lot.status}</span>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div
                key={lot.id}
                draggable={movable}
                onDragStart={(event) => handleDragStart(event, lot, from)}
                onDragEnd={handleDragEnd}
                className={`rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm transition ${
                    movable
                        ? 'cursor-move hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg'
                        : 'cursor-not-allowed opacity-85'
                }`}
            >
                <div className="mb-2.5 flex items-start justify-between gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${rack.iconBgClass}`}>
                        <Package className={`h-4 w-4 ${rack.iconTextClass}`} />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${rack.badgeClass}`}>
                            {lot.grade?.code ?? 'GRADE'}
                        </span>
                        <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                printed
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                            }`}
                        >
                            {printed ? 'Sudah Cetak' : 'Belum Cetak'}
                        </span>
                    </div>
                </div>

                <p className="truncate text-sm font-bold text-gray-900">
                    {lot.externalId ?? lot.lotNumber}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">{gradeLabel || '-'}</p>

                <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-gray-50 p-2">
                        <p className="text-gray-500">Basah</p>
                        <p className="font-semibold text-gray-900">{formatNumber(lot.wetWeightGram, 0)} gr</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-2">
                        <p className="text-gray-500">Kering</p>
                        <p className="font-semibold text-gray-900">{formatNumber(lot.dryWeightGramLocked, 0)} gr</p>
                    </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-gray-500">{formatDateTime(lot.createdAt)}</span>
                    {lot.workItem?.status === 'IN_PROGRESS' ? (
                        <span className="rounded bg-blue-100 px-2 py-0.5 font-semibold text-blue-700">
                            WO Aktif
                        </span>
                    ) : (
                        <span className="text-gray-500">{lot.status}</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-[calc(100vh-72px)] bg-slate-50">
            <div ref={containerRef} className="mx-auto max-w-7xl space-y-4 px-4 py-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Rak LP</h1>
                        <p className="mt-1 text-sm text-gray-600">
                            Kontrol perpindahan LP antara Rak Sementara dan Rak Mitra Order.
                        </p>
                    </div>
                    <Button variant="outline" onClick={loadData} disabled={loading || moving}>
                        {loading ? 'Memuat...' : 'Refresh'}
                    </Button>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">Cari LP</label>
                            <Input
                                value={searchInput}
                                onChange={(event) => {
                                    setSearchInput(event.target.value);
                                    setListPage((prev) => {
                                        if (prev.preSale === 1 && prev.mitraOrder === 1) return prev;
                                        return { preSale: 1, mitraOrder: 1 };
                                    });
                                }}
                                placeholder="Cari nomor LP / ID eksternal"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">Filter Grade</label>
                            <select
                                value={selectedGradeId}
                                onChange={(event) => {
                                    setSelectedGradeId(event.target.value);
                                    setListPage((prev) => {
                                        if (prev.preSale === 1 && prev.mitraOrder === 1) return prev;
                                        return { preSale: 1, mitraOrder: 1 };
                                    });
                                }}
                                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                            >
                                <option value="all">Semua Grade</option>
                                {gradeOptions.map((grade) => (
                                    <option key={grade.id} value={grade.id}>
                                        {grade.code}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">Status Cetak</label>
                            <select
                                value={printedFilter}
                                onChange={(event) => {
                                    setPrintedFilter(event.target.value as PrintedFilter);
                                    setListPage((prev) => {
                                        if (prev.preSale === 1 && prev.mitraOrder === 1) return prev;
                                        return { preSale: 1, mitraOrder: 1 };
                                    });
                                }}
                                className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
                            >
                                <option value="all">Semua</option>
                                <option value="printed">Sudah Cetak</option>
                                <option value="unprinted">Belum Cetak</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">Tampilan</label>
                            <div className="flex h-10 items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
                                <Button
                                    size="icon"
                                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                                    className="h-8 w-8"
                                    onClick={() => setViewMode('grid')}
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                                    className="h-8 w-8"
                                    onClick={() => setViewMode('list')}
                                >
                                    <List className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-[2fr_auto]">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">Quick Jump LP</label>
                            <Input
                                value={jumpTerm}
                                onChange={(event) => setJumpTerm(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        handleQuickJump();
                                    }
                                }}
                                placeholder="Contoh: TEI-0221-26"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-transparent">Jump</label>
                            <Button className="h-10 w-full md:w-auto" onClick={handleQuickJump}>
                                Jump ke LP
                            </Button>
                        </div>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                        <Filter className="h-3.5 w-3.5" />
                        Mode list lebih ringkas untuk LP banyak. Drag & drop aktif untuk LP yang belum masuk work order.
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    {(Object.keys(RACKS) as RackKey[]).map((key) => {
                        const rack = RACKS[key];
                        const listData = listMeta[key];
                        const lots = listData.items;
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
                                        ? 'border-green-400 shadow-lg ring-4 ring-green-400/20'
                                        : 'border-gray-200'
                                }`}
                            >
                                <div className={`rounded-t-2xl p-4 text-white ${rack.headerClass}`}>
                                    <div className="mb-2.5 flex items-start justify-between">
                                        <div>
                                            <h2 className="text-lg font-bold">{rack.title}</h2>
                                            <p className="text-xs text-white/90">{rack.description}</p>
                                        </div>
                                        <div className="flex items-center gap-2 rounded-lg bg-white/20 px-3 py-1.5 backdrop-blur-sm">
                                            <Truck className="h-4 w-4" />
                                            <span className="text-sm font-bold">{stats.totalCount}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div className="rounded-lg bg-white/10 p-2.5 backdrop-blur-sm">
                                            <div className="mb-1 flex items-center gap-2">
                                                <TrendingUp className="h-4 w-4" />
                                                <span className="text-[11px] font-medium text-white/90">Total Berat</span>
                                            </div>
                                            <div className="text-base font-bold">
                                                {formatNumber(stats.weight / 1000, 1)} kg
                                            </div>
                                        </div>
                                        <div className="rounded-lg bg-white/10 p-2.5 backdrop-blur-sm">
                                            <div className="mb-1 flex items-center gap-2">
                                                <Package className="h-4 w-4" />
                                                <span className="text-[11px] font-medium text-white/90">Ditampilkan</span>
                                            </div>
                                            <div className="text-base font-bold">{stats.count} LP</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="h-[calc(100vh-340px)] overflow-y-auto p-3">
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
                                                    Tidak ada LP untuk filter saat ini
                                                </p>
                                                <p className="mt-1 text-xs text-gray-500">
                                                    Coba ubah pencarian atau filter.
                                                </p>
                                            </div>
                                        </div>
                                    ) : viewMode === 'grid' ? (
                                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                                            {lots.map((lot) => renderLotCard(lot, key, rack))}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="sticky top-0 z-10 mb-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                                <div className="grid grid-cols-[1.7fr_1.2fr_0.8fr_0.9fr_0.9fr_0.9fr] items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                                    <div>LP / Grade</div>
                                                    <div>Tanggal</div>
                                                    <div className="text-right">Basah</div>
                                                    <div className="text-right">Kering</div>
                                                    <div className="text-center">Cetak</div>
                                                    <div className="text-right">Status</div>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                {lots.map((lot) => renderLotCard(lot, key, rack))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                {viewMode === 'list' && listData.total > 0 && (
                                    <div className="border-t border-gray-200 px-3 py-2">
                                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                                            <span>
                                                Menampilkan {listData.startIndex}-{listData.endIndex} dari{' '}
                                                {listData.total} LP
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={listData.page <= 1}
                                                    onClick={() =>
                                                        setListPage((prev) => ({
                                                            ...prev,
                                                            [key]: Math.max(1, prev[key] - 1),
                                                        }))
                                                    }
                                                >
                                                    Prev
                                                </Button>
                                                <span className="min-w-[84px] text-center text-xs font-medium text-gray-700">
                                                    Page {listData.page}/{listData.totalPages}
                                                </span>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={listData.page >= listData.totalPages}
                                                    onClick={() =>
                                                        setListPage((prev) => ({
                                                            ...prev,
                                                            [key]: Math.min(listData.totalPages, prev[key] + 1),
                                                        }))
                                                    }
                                                >
                                                    Next
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
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
