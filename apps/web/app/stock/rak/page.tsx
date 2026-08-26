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
import { getGrades, getRackLotsByCodePaginated, moveLot, getPecahBonById, markPecahBonPrinted, type ProductionLot, type PecahBonEntry } from '@/lib/api';

type RackKey = 'mitraOrder';
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
  mitraOrder: {
    code: 'RAK_MITRA_ORDER',
    title: 'Rak Mitra Order',
    description: 'LP yang siap untuk di-assign ke mitra.',
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
    const [listPage, setListPage] = useState<Record<RackKey, number>>({
        mitraOrder: 1,
    });
    const [jumpTerm, setJumpTerm] = useState('');
    const [highlightedLotId, setHighlightedLotId] = useState<string | null>(null);
    const [pendingJumpLotId, setPendingJumpLotId] = useState<string | null>(null);
    const [pendingJumpKeyword, setPendingJumpKeyword] = useState<string | null>(null);
    const [selectedLotIds, setSelectedLotIds] = useState<Set<string>>(new Set());
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lotId: string; from: RackKey } | null>(null);
    const [rackState, setRackState] = useState<Record<RackKey, RackListState>>({
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
            const mitraOrder = await getRackLotsByCodePaginated(RACKS.mitraOrder.code, {
                page: listPage.mitraOrder,
                limit: LIST_PAGE_SIZE,
                search: searchTerm || undefined,
            });
            setRackState({
                mitraOrder: {
                    lots: mitraOrder.lots,
                    page: mitraOrder.page,
                    total: mitraOrder.total,
                    totalPages: mitraOrder.totalPages,
                    totalWetWeightGram: mitraOrder.totalWetWeightGram,
                },
            });
            setListPage((prev) => {
                if (prev.mitraOrder === mitraOrder.page) {
                    return prev;
                }
                return {
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
        void loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listPage.mitraOrder, searchTerm]);

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
            mitraOrder: buildMeta(rackState.mitraOrder),
        };
    }, [rackState]);

    const totals = useMemo(
        () => ({
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

    // Print helpers (matching PecahBonPage for consistency)
    const buildPrintOptions = () => {
        return {
            silent: true,
            preview: false,
            margin: '0',
            pageSize: { width: 80000, height: 297000 },
            addFinalMargin: true,
            bodyAttributes: {
                style: 'width: 80mm !important; max-width: 80mm !important; margin: 0 !important; padding: 0 !important;',
            },
            containerAttributes: {
                style: 'width: 76mm !important; max-width: 76mm !important; margin: 0 auto !important; margin-left: -2mm !important; padding: 0 !important;',
            },
            styleSheet: `
                @page {
                    size: 80mm auto;
                    margin: 0 !important;
                }
                * {
                    box-sizing: border-box !important;
                }
                html, body {
                    width: 80mm !important;
                    max-width: 80mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    font-family: Arial, Helvetica, sans-serif;
                    font-size: 11pt;
                }
                #container {
                    width: 76mm !important;
                    max-width: 76mm !important;
                    margin: 0 auto !important;
                    margin-left: -2mm !important;
                    padding: 0 !important;
                    text-align: center !important;
                }
                #container .section {
                    width: 100% !important;
                    max-width: 72mm !important;
                    margin: 0 auto !important;
                    padding: 1mm 0 !important;
                    text-align: center !important;
                }
                img {
                    max-width: 100% !important;
                    display: block !important;
                    margin: 0 auto !important;
                }
            `,
        };
    };

    const buildPecahBonPrintData = (entry: PecahBonEntry) => {
        const dateStr = formatDateTime(entry.pecahBonDate);
        const gradeDisplay = `${entry.grade?.code ?? '-'} / ${entry.featherGrade?.code ?? '-'} / ${entry.colorGrade?.code ?? '-'}`;
        const batchNumber = entry.rawBatch?.batchNumber ?? '-';

        return [
            {
                type: 'text',
                raw: true,
                value: `<div style="text-align:center;font-size:12pt;font-weight:bold;padding:1mm 0;">KARTU PECAH BON - TEI</div>`,
            },
            {
                type: 'qrCode',
                value: entry.pecahBonId || batchNumber,
                width: 80,
                height: 80,
                sectionStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1mm 0' },
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="border:1px solid #333;padding:1.5mm;font-size:9pt;width:100%;box-sizing:border-box;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5mm;">
                            <span style="font-weight:bold;">ID Pecah</span><span>${entry.pecahBonId ?? '-'}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5mm;">
                            <span style="font-weight:bold;">Batch No</span><span>${batchNumber}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5mm;">
                            <span style="font-weight:bold;">Nama Mitra</span><span>${entry.orderedForName || '-'}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="font-weight:bold;">Tgl Pecah</span><span>${dateStr}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-top:0.5mm;">
                            <span style="font-weight:bold;">Grade</span><span>${gradeDisplay}</span>
                        </div>
                    </div>
                `,
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="border:1.5px solid #000;padding:1.5mm;margin-top:1mm;text-align:center;width:100%;box-sizing:border-box;">
                        <div style="font-size:10pt;font-weight:bold;">BERAT: ${formatNumber(entry.initialWeightGram, 2)} Gr</div>
                        <div style="font-size:10pt;font-weight:bold;">KADAR AIR: ${formatNumber(entry.moisturePercent, 1)}%</div>
                    </div>
                `,
            },
            {
                type: 'text',
                raw: true,
                value: `<div style="margin-top:2mm;border-top:1px dashed #000;width:100%;"></div>`,
            },
        ];
    };

    const buildSetoranPrintData = (entry: PecahBonEntry) => {
        const dateStr = formatDateTime(entry.pecahBonDate);
        const gradeCode = `${entry.grade?.code ?? '-'} / ${entry.featherGrade?.code ?? '-'} / ${entry.colorGrade?.code ?? '-'}`;
        const pieceCount = entry.pieceCount;
        const wetWeight = formatNumber(entry.initialWeightGram, 2);
        const moisture = formatNumber(entry.moisturePercent, 1);
        const dryWeight = formatNumber(entry.dryWeightGram, 2);
        const batchNumber = entry.rawBatch?.batchNumber ?? '-';

        return [
            {
                type: 'text',
                raw: true,
                value: `<div style="text-align:center;font-size:11pt;font-weight:700;padding:0.5mm 0;border-bottom:1px solid #000;">SETORAN</div>`,
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="font-size:7pt;font-weight:600;line-height:1.2;padding:0.4mm 0;width:100%;max-width:72mm;margin:0 auto;">
                        <table style="width:100%;border-collapse:collapse;">
                            <tr>
                                <td style="padding:0.1mm 0;width:52%;">NAMA: TEI</td>
                                <td style="padding:0.1mm 0;width:48%;">GRADE: ${gradeCode}</td>
                            </tr>
                            <tr>
                                <td style="padding:0.1mm 0;">TGL: ${dateStr.split(',')[0]}</td>
                                <td style="padding:0.1mm 0;">BIJI: ${pieceCount} kpg</td>
                            </tr>
                            <tr>
                                <td style="padding:0.1mm 0;">NO LP: ${entry.pecahBonId ?? '-'}</td>
                                <td style="padding:0.1mm 0;">B.BASAH: ${wetWeight}g</td>
                            </tr>
                            <tr>
                                <td style="padding:0.1mm 0;">KARTU: ${batchNumber}</td>
                                <td style="padding:0.1mm 0;">K.AIR: ${moisture}%</td>
                            </tr>
                        </table>
                    </div>
                `,
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="margin:0.5mm auto;width:100%;max-width:72mm;">
                        <table style="width:100%;border-collapse:collapse;font-size:7pt;font-weight:600;border:1px solid #000;">
                            <tr style="background:#ddd;">
                                <td style="border:1px solid #000;padding:0.2mm;width:50%;"></td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:center;width:15%;">BIJI</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:center;width:35%;">GRAM</td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:0.2mm;font-size:8pt;">BERAT KERING</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:center;">${pieceCount}</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:center;">${dryWeight}</td>
                            </tr>
                        </table>
                    </div>
                `,
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="margin:0.5mm auto;width:100%;max-width:72mm;">
                        <table style="width:100%;border-collapse:collapse;font-size:7pt;font-weight:600;border:1px solid #000;">
                            <tr style="background:#ff9;">
                                <td style="border:1px solid #000;padding:0.2mm;font-size:8pt;" colspan="2">HASIL JADI:</td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;width:35%;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:0.2mm;">HANCURAN</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:0.2mm;">SESEKAN</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:0.2mm;">KAKI</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:0.2mm;">LAIN-LAIN</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                        </table>
                    </div>
                `,
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="margin:0.5mm auto;width:100%;max-width:72mm;">
                        <table style="width:100%;border-collapse:collapse;font-size:7pt;font-weight:600;border:1px solid #000;">
                            <tr style="background:#ddd;">
                                <td style="border:1px solid #000;padding:0.2mm;width:65%;font-size:8pt;">TOTAL BARANG JADI</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;width:35%;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                            <tr>
                                <td style="border:1px solid #000;padding:0.2mm;">HILANG/SUSUT</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                            <tr style="background:#ddd;">
                                <td style="border:1px solid #000;padding:0.2mm;">SUSUT PROSES</td>
                                <td style="border:1px solid #000;padding:0.2mm;text-align:right;">
                                    <span style="display:block;width:100%;border-bottom:1px dotted #000;height:1em;"></span>
                                </td>
                            </tr>
                        </table>
                    </div>
                `,
            },
            {
                type: 'text',
                raw: true,
                value: `<div style="margin-top:1mm;border-top:1px dashed #000;"></div>`,
            },
        ];
    };

    const handleAutoPrint = async (entry: PecahBonEntry) => {
        if (typeof window === 'undefined') return;

        try {
            // Priority: Thermal printer (securePOSPrinter) for exact sizing
            if (window.securePOSPrinter?.print) {
                const options = buildPrintOptions();
                
                // 1. Print Kartu Pecah Bon
                const kartuData = buildPecahBonPrintData(entry);
                await window.securePOSPrinter.print(kartuData, options);
                
                // Add a small delay between separate jobs to ensure the printer driver processes both
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 2. Print Setoran
                const setoranData = buildSetoranPrintData(entry);
                await window.securePOSPrinter.print(setoranData, options);

                await markPecahBonPrinted(entry.id).catch((err) => {
                    console.error('Failed to mark printed:', err);
                });
                
                toast.success(`Berhasil cetak (Kartu & Setoran): ${entry.pecahBonId ?? entry.id}`);
                return;
            }

            // Fallback: Electron seccaPrint
            if (window.seccaPrint?.print) {
                await window.seccaPrint.print({
                    silent: true,
                    printBackground: true,
                    margins: { marginType: 'none' },
                    preferCSSPageSize: true,
                });
                
                await markPecahBonPrinted(entry.id).catch((err) => {
                    console.error('Failed to mark printed:', err);
                });
                toast.success('Cetak otomatis selesai.');
                return;
            }

            toast.warning('LP dipindahkan, tapi printer tidak ditemukan untuk cetak otomatis.');
        } catch (error) {
            console.error('Error in auto-print:', error);
            toast.error('Gagal cetak otomatis: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const handleContextMenu = (event: React.MouseEvent, lotId: string, from: RackKey) => {
        event.preventDefault();
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            lotId,
            from,
        });
    };

    const closeContextMenu = () => setContextMenu(null);

    useEffect(() => {
        const handleGlobalClick = () => closeContextMenu();
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, []);

    const handleQuickJump = () => {
        const keyword = jumpTerm.trim();
        if (!keyword) {
            toast.error('Masukkan LP untuk jump.');
            return;
        }

        setViewMode('list');
        setSearchInput(keyword);
        setSearchTerm(keyword);
        setListPage({
            mitraOrder: 1,
        });
        setPendingJumpKeyword(keyword.toUpperCase());
    };

    const normalizeLotIdentifier = (lot: ProductionLot) =>
        (lot.externalId ?? lot.lotNumber).trim().toUpperCase();

    useEffect(() => {
        if (!pendingJumpKeyword || loading) return;

        const target = pendingJumpKeyword.trim().toUpperCase();
        const candidates = [...listMeta.mitraOrder.items];
        const found = candidates.find((lot) => normalizeLotIdentifier(lot) === target)
            ?? candidates.find((lot) => normalizeLotIdentifier(lot).includes(target));

        if (!found) {
            toast.error('LP tidak ditemukan.');
            setPendingJumpKeyword(null);
            return;
        }
        setPendingJumpKeyword(null);
        setPendingJumpLotId(found.id);
    }, [listMeta.mitraOrder.items, loading, pendingJumpKeyword, toast]);

    const renderLotCard = (lot: ProductionLot, from: RackKey, rack: RackConfig) => {
        const movable = isLotMovable(lot);
        const printed = Boolean(lot.printedAt);
        const isSelected = selectedLotIds.has(lot.id);
        const gradeLabel = [lot.grade?.code, lot.featherGrade?.code, lot.colorGrade?.code]
            .filter(Boolean)
            .join(' / ');

        if (viewMode === 'list') {
            return (
                <div
                    id={`rack-lot-row-${lot.id}`}
                    key={lot.id}
                    onContextMenu={(e) => movable && handleContextMenu(e, lot.id, from)}
                    className={`rounded-lg border px-3 py-2 transition ${
                        lot.id === highlightedLotId
                            ? 'border-green-400 bg-green-50 ring-1 ring-green-300'
                            : isSelected ? 'border-green-300 bg-green-50/50' : 'border-gray-200 bg-white'
                    } ${
                        movable
                            ? 'cursor-pointer hover:border-gray-300 hover:shadow-sm'
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
                onContextMenu={(e) => movable && handleContextMenu(e, lot.id, from)}
                className={`rounded-xl border transition p-3.5 shadow-sm ${
                    isSelected ? 'border-green-400 bg-green-50 shadow-md' : 'border-gray-200 bg-white'
                } ${
                    movable
                        ? 'cursor-pointer hover:border-gray-300 hover:shadow-md'
                        : 'cursor-not-allowed opacity-85'
                }`}
            >
                <div className="mb-2.5 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${rack.iconBgClass}`}>
                            <Package className={`h-4 w-4 ${rack.iconTextClass}`} />
                        </div>
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
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={loadData} disabled={loading}>
                            {loading ? 'Memuat...' : 'Refresh'}
                        </Button>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex-1 min-w-[240px] space-y-1">
                            <label className="text-xs font-medium text-gray-600">Cari Nomor LP</label>
                            <Input
                                value={searchInput}
                                onChange={(event) => {
                                    setSearchInput(event.target.value);
                                    setListPage({ mitraOrder: 1 });
                                }}
                                placeholder="Cari LP ID (TEI-...)"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600">Quick Jump</label>
                            <div className="flex gap-2">
                                <Input
                                    value={jumpTerm}
                                    className="w-40"
                                    onChange={(event) => setJumpTerm(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            handleQuickJump();
                                        }
                                    }}
                                    placeholder="Langsung ke LP"
                                />
                                <Button onClick={handleQuickJump}>Jump</Button>
                            </div>
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
                                className={`flex flex-col rounded-2xl border-2 bg-white shadow-sm transition-all border-gray-200`}
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
                                                    Tidak ada LP
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
                                                <div className="grid grid-cols-[auto_1.7fr_1.2fr_0.8fr_0.9fr_0.9fr_0.9fr] items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                                                    <div className="w-4"></div>
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

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-[100] min-w-[200px] overflow-hidden rounded-md border bg-white p-1 shadow-md animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 border-b mb-1 uppercase tracking-wider">
                        Opsi Rak LP
                    </div>
                    <button
                        className="flex w-full items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-slate-100 text-slate-700 transition-colors"
                        onClick={async () => {
                            closeContextMenu();
                            try {
                                const lot = listMeta.mitraOrder.items.find(l => l.id === contextMenu.lotId);
                                if (lot?.externalId) {
                                    const entry = await getPecahBonById(lot.externalId);
                                    await handleAutoPrint(entry);
                                } else {
                                    toast.error('ID Pecah Bon tidak ditemukan untuk dicetak.');
                                }
                            } catch (err) {
                                console.error('Failed to print lot:', err);
                                toast.error('Gagal memuat data cetak.');
                            }
                        }}
                    >
                        Cetak Ulang
                    </button>
                    <div className="h-px bg-slate-200 my-1" />
                    <button
                        className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 text-red-600 transition-colors"
                        onClick={closeContextMenu}
                    >
                        Batal
                    </button>
                </div>
            )}
        </div>
    );
}

export default function RakPage() {
    return (
        <ProtectedRoute>
            <RackContent />
        </ProtectedRoute>
    );
}
