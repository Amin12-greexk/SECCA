'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { ClipboardList, Loader2, Package, Printer, RefreshCw } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/lib/toast';
import { getRawBatchByCardId, getRawBatches, type RawBatch } from '@/lib/api';
import BatchCard from '@/components/print/BatchCard';

function StockAsalContent() {
    const toast = useToast();
    const [rawBatches, setRawBatches] = useState<RawBatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [printBatch, setPrintBatch] = useState<RawBatch | null>(null);
    const [printOpen, setPrintOpen] = useState(false);
    const [scanOpen, setScanOpen] = useState(false);
    const [scanValue, setScanValue] = useState('');
    const [scanLoading, setScanLoading] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [scanResult, setScanResult] = useState<RawBatch | null>(null);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraLoading, setCameraLoading] = useState(false);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const frameRef = useRef<number | null>(null);

    const buildPrintOptions = () => {
        // Options for electron-secure-pos-printer library
        // BP Lite 80D1: 80mm paper, ~72mm printable area
        return {
            silent: true,
            preview: false, // Direct print
            margin: '0',
            pageSize: { width: 80000, height: 297000 },
            addFinalMargin: true,
            bodyAttributes: {
                style: 'width: 80mm !important; max-width: 80mm !important; margin: 0 !important; padding: 0 !important;',
            },
            containerAttributes: {
                style: 'width: 76mm !important; max-width: 76mm !important; margin: 0 auto !important; margin-left: -2mm !important; padding: 2mm !important;',
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
                    font-size: 10pt;
                }
                #container {
                    width: 76mm !important;
                    max-width: 76mm !important;
                    margin: 0 auto !important;
                    margin-left: -2mm !important;
                    padding: 2mm !important;
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

    const buildBatchPrintData = (batch: RawBatch) => {
        const displayWeightGram = getDisplayWeight(batch);
        const supplierName = batch.supplier?.name ?? batch.supplierId;
        const dateStr = formatDate(batch.createdAt);

        return [
            {
                type: 'text',
                raw: true,
                value: `<div style="text-align:center;font-size:11pt;font-weight:bold;padding:1mm 0;">KARTU BAKU - TEI</div>`,
            },
            {
                type: 'qrCode',
                value: JSON.stringify({
                    type: 'RAW_BATCH',
                    batchNumber: batch.batchNumber,
                    cardId: batch.cardId ?? null,
                    supplier: batch.supplier ?? null,
                    wetWeightGram: displayWeightGram,
                    remainingWetWeightGram: batch.wetWeightGram,
                    moisturePercent: batch.moisturePercent,
                    notes: batch.notes ?? null,
                }),
                width: 80,
                height: 80,
                sectionStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1mm 0' },
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="border:1px solid #333;padding:1.5mm;font-size:8pt;width:100%;box-sizing:border-box;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5mm;">
                            <span style="font-weight:bold;">Batch No</span><span>${batch.batchNumber}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5mm;">
                            <span style="font-weight:bold;">Tgl Masuk</span><span>${dateStr}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:0.5mm;">
                            <span style="font-weight:bold;">Supplier</span><span>${supplierName}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;">
                            <span style="font-weight:bold;">Grading</span><span>${batch.featherCondition}</span>
                        </div>
                    </div>
                `,
            },
            {
                type: 'text',
                raw: true,
                value: `
                    <div style="border:1.5px solid #000;padding:1.5mm;margin-top:1mm;text-align:center;width:100%;box-sizing:border-box;">
                        <div style="font-size:9pt;font-weight:bold;">BERAT: ${formatNumber(displayWeightGram, 2)} Gr</div>
                        <div style="font-size:9pt;font-weight:bold;">KADAR AIR: ${formatNumber(batch.moisturePercent, 1)}%</div>
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

    const handlePrint = async () => {
        if (!printBatch) {
            return;
        }

        // Try electron-secure-pos-printer first (preferred for thermal printers)
        if (typeof window !== 'undefined' && window.securePOSPrinter?.print) {
            try {
                const options = buildPrintOptions();
                const data = buildBatchPrintData(printBatch);
                await window.securePOSPrinter.print(data, options);
                toast.success('Berhasil mencetak kartu!');
                return;
            } catch (error) {
                console.error('Secure POS print failed.', error);
                await window.seccaDesktop?.log?.({
                    scope: 'stock-asal',
                    message: 'securePOSPrinter.print failed',
                    error: error instanceof Error ? error.message : String(error),
                });
                // Don't show error yet, try fallback
            }
        }

        // Fallback to seccaPrint (Electron webContents.print)
        if (typeof window !== 'undefined' && window.seccaPrint?.print) {
            try {
                await window.seccaPrint.print({
                    silent: true,
                    printBackground: true,
                    margins: { marginType: 'none' },
                    preferCSSPageSize: true,
                });
                toast.success('Berhasil mencetak kartu!');
                return;
            } catch (error) {
                console.error('Silent print failed.', error);
                await window.seccaDesktop?.log?.({
                    scope: 'stock-asal',
                    message: 'seccaPrint.print failed',
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }

        // If we reach here, no print method worked
        toast.error('Gagal cetak. Pastikan aplikasi desktop terpasang dan printer terhubung.');
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getRawBatches();
            // Map rawBatchId to id for frontend compatibility
            const mapped = data.map((item: RawBatch & { rawBatchId?: string }) => ({
                ...item,
                id: item.rawBatchId ?? item.id,
            }));
            mapped.sort((left, right) => left.batchNumber.localeCompare(right.batchNumber));
            setRawBatches(mapped);
        } catch (err) {
            console.error('Error loading raw batches:', err);
            toast.error('Gagal memuat data stock asal.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openPrintDialog = (batch: RawBatch) => {
        setPrintBatch(batch);
        setPrintOpen(true);
    };

    const openScanDialog = () => {
        setScanValue('');
        setScanError(null);
        setScanResult(null);
        setCameraError(null);
        setScanOpen(true);
    };

    const stopCamera = () => {
        if (frameRef.current) {
            window.cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setCameraOpen(false);
    };

    const handleScanDialogChange = (open: boolean) => {
        if (!open) {
            stopCamera();
        }
        setScanOpen(open);
    };

    const handleScan = async (overrideValue?: string) => {
        const trimmed = (overrideValue ?? scanValue).trim();
        if (!trimmed) return;

        setScanLoading(true);
        setScanError(null);
        setScanResult(null);

        try {
            const parsed = parseScanPayload(trimmed);
            const cardId =
                (parsed && typeof parsed.cardId === 'string' && parsed.cardId) ||
                trimmed;

            const batch = await getRawBatchByCardId(cardId);
            setScanResult(batch);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal membaca data kartu.';
            setScanError(message);
        } finally {
            setScanLoading(false);
        }
    };

    const parseScanPayload = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return null;

        try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            return parsed;
        } catch {
            return null;
        }
    };

    const startCamera = async () => {
        if (cameraOpen || cameraLoading) {
            return;
        }
        setCameraError(null);

        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraError('Browser tidak mendukung akses kamera.');
            return;
        }

        setCameraLoading(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setCameraOpen(true);
            const scanFrame = () => {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                if (!video || !canvas) {
                    frameRef.current = window.requestAnimationFrame(scanFrame);
                    return;
                }

                if (video.readyState >= 2) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const result = jsQR(imageData.data, imageData.width, imageData.height);
                        if (result?.data) {
                            setScanValue(result.data);
                            stopCamera();
                            handleScan(result.data);
                            return;
                        }
                    }
                }

                frameRef.current = window.requestAnimationFrame(scanFrame);
            };
            frameRef.current = window.requestAnimationFrame(scanFrame);
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : 'Gagal mengakses kamera. Pastikan izin kamera diaktifkan.';
            setCameraError(message);
            stopCamera();
        } finally {
            setCameraLoading(false);
        }
    };

    useEffect(() => {
        return () => {
            stopCamera();
        };

    }, []);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    const formatNumber = (value: number, fractionDigits = 2) =>
        new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        }).format(value);

    const getDisplayWeight = (batch: RawBatch) =>
        batch.originalWetWeightGram ?? batch.wetWeightGram;

    if (loading) {
        return (
            <div className="min-h-[calc(100vh-72px)] flex items-center justify-center">
                <div className="flex items-center gap-3 text-gray-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Memuat data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-amber-50 via-white to-green-50 py-10 px-4">
            <div className="mx-auto max-w-6xl">
                <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-600/10">
                            <Package className="h-6 w-6 text-amber-700" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-semibold text-gray-900">Stock Asal</h1>
                            <p className="text-sm text-gray-600">
                                Daftar penerimaan bahan baku. Cetak kartu dari sini.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button variant="outline" onClick={openScanDialog} disabled={loading}>
                            <ClipboardList className="h-4 w-4" />
                            Scan Kartu
                        </Button>
                        <Button variant="outline" onClick={loadData} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    {rawBatches.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            <Package className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                            <p className="text-lg font-medium">Belum ada data</p>
                            <p className="text-sm mt-1">Data penerimaan baku akan muncul di sini.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Batch
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Supplier
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Kondisi Baku
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Berat (gr)
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Kadar Air
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Catatan
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Tanggal
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {rawBatches.map((batch) => (
                                        <tr key={batch.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{batch.batchNumber}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-gray-900">{batch.supplier?.name ?? '-'}</div>
                                                {batch.supplier?.code && (
                                                    <div className="text-xs text-gray-500">{batch.supplier.code}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">
                                                {batch.featherCondition}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-900">
                                                {formatNumber(getDisplayWeight(batch))}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-gray-900">
                                                {formatNumber(batch.moisturePercent, 1)}%
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate">
                                                {batch.notes || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {formatDate(batch.createdAt)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openPrintDialog(batch)}
                                                >
                                                    <Printer className="h-4 w-4" />
                                                    Cetak
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Print Dialog */}
            <Dialog open={printOpen} onOpenChange={setPrintOpen}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Print Preview</DialogTitle>
                        <DialogDescription>
                            Kartu siap dicetak ke printer Blueprint Lite 80D1 (lebar 72mm).
                        </DialogDescription>
                    </DialogHeader>

                    {printBatch && (
                        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                            <div className="flex items-start justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
                                <BatchCard batch={printBatch} />
                            </div>
                            <div className="space-y-4">
                                <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Batch</span>
                                        <span className="font-semibold">{printBatch.batchNumber}</span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Supplier</span>
                                        <span className="font-semibold">
                                            {printBatch.supplier?.name ?? printBatch.supplierId}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Berat</span>
                                        <span className="font-semibold">
                                            {formatNumber(getDisplayWeight(printBatch))} gr
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-gray-500">Kadar Air</span>
                                        <span className="font-semibold">
                                            {formatNumber(printBatch.moisturePercent, 1)}%
                                        </span>
                                    </div>
                                    {printBatch.notes && (
                                        <div className="mt-3 pt-3 border-t border-gray-100">
                                            <span className="text-gray-500 block mb-1">Catatan:</span>
                                            <span className="text-gray-700">{printBatch.notes}</span>
                                        </div>
                                    )}
                                </div>

                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setPrintOpen(false)}>
                                        Tutup
                                    </Button>
                                    <Button onClick={handlePrint}>
                                        <Printer className="h-4 w-4" />
                                        Cetak Kartu
                                    </Button>
                                </DialogFooter>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Scan Dialog */}
            <Dialog open={scanOpen} onOpenChange={handleScanDialogChange}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Scan Kartu Baku</DialogTitle>
                        <DialogDescription>
                            Tempel hasil scan QR di bawah ini untuk melihat informasi lengkap kartu.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-gray-500">
                                Pengujian: aktifkan kamera laptop untuk scan tanpa mesin.
                            </p>
                            <div className="flex gap-2">
                                {!cameraOpen ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={startCamera}
                                        disabled={cameraLoading}
                                    >
                                        {cameraLoading ? 'Mengaktifkan...' : 'Aktifkan Kamera'}
                                    </Button>
                                ) : (
                                    <Button type="button" variant="outline" onClick={stopCamera}>
                                        Matikan Kamera
                                    </Button>
                                )}
                            </div>
                        </div>

                        {cameraError && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                {cameraError}
                            </div>
                        )}

                        {cameraOpen && (
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                                <video
                                    ref={videoRef}
                                    className="w-full rounded-lg"
                                    muted
                                    playsInline
                                />
                                <canvas ref={canvasRef} className="hidden" />
                                <p className="mt-2 text-xs text-gray-500">
                                    Arahkan QR ke kamera. Data akan terisi otomatis.
                                </p>
                            </div>
                        )}

                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                Data QR / Card ID
                            </label>
                            <Textarea
                                value={scanValue}
                                onChange={(event) => setScanValue(event.target.value)}
                                placeholder="Tempel hasil scan QR di sini..."
                                rows={4}
                            />
                        </div>

                        {scanError && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {scanError}
                            </div>
                        )}

                        {scanResult && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900">
                                <div className="mb-3 text-base font-semibold">Traceability Kartu</div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <div className="text-xs text-emerald-700">Batch</div>
                                        <div className="font-semibold">{scanResult.batchNumber}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-emerald-700">Tanggal Masuk</div>
                                        <div className="font-semibold">{formatDate(scanResult.createdAt)}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-emerald-700">Supplier</div>
                                        <div className="font-semibold">
                                            {scanResult.supplier?.name ?? scanResult.supplierId}
                                        </div>
                                        {scanResult.supplier?.code && (
                                            <div className="text-xs text-emerald-700">{scanResult.supplier.code}</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-xs text-emerald-700">Kondisi Baku</div>
                                        <div className="font-semibold">{scanResult.featherCondition}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-emerald-700">Kadar Air</div>
                                        <div className="font-semibold">
                                            {formatNumber(scanResult.moisturePercent, 1)}%
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-emerald-700">Berat Awal</div>
                                        <div className="font-semibold">
                                            {formatNumber(getDisplayWeight(scanResult))} gr
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-emerald-700">Sisa Berat</div>
                                        <div className="font-semibold">
                                            {formatNumber(scanResult.wetWeightGram)} gr
                                        </div>
                                    </div>
                                </div>
                                {scanResult.notes && (
                                    <div className="mt-3 text-xs text-emerald-700">
                                        Catatan: <span className="font-medium">{scanResult.notes}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setScanOpen(false)}>
                            Tutup
                        </Button>
                        <Button
                            onClick={() => handleScan()}
                            disabled={scanLoading || !scanValue.trim()}
                        >
                            {scanLoading ? 'Memproses...' : 'Cek Kartu'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function StockAsalPage() {
    return (
        <ProtectedRoute allowedRoles={['baku', 'manager']}>
            <StockAsalContent />
        </ProtectedRoute>
    );
}
