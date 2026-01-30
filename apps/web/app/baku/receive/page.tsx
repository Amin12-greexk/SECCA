'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import LoadingCircle from '@/components/LoadingCircle';
import Alert from '@/components/Alert';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useToast } from '@/lib/toast';
import { getSuppliers, submitBakuReceive, type Supplier, type BakuReceiveResponse } from '@/lib/api';

function TerimaBakuContent() {
    const formRef = useRef<HTMLDivElement>(null);
    const resultRef = useRef<HTMLDivElement>(null);

    // Form state
    const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
    const [supplierId, setSupplierId] = useState('');
    const [wetWeightGram, setWetWeightGram] = useState('');
    const [notes, setNotes] = useState('');

    // UI state
    const [loading, setLoading] = useState(false);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [result, setResult] = useState<BakuReceiveResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const toast = useToast();

    // Load suppliers on mount
    useEffect(() => {
        async function loadSuppliers() {
            try {
                const data = await getSuppliers();
                setSuppliers(data);
            } catch (err) {
                console.error('Failed to load suppliers, using fallback mode:', err);
                setSuppliers(null); // Fallback to manual input
            } finally {
                setLoadingSuppliers(false);
            }
        }

        loadSuppliers();
    }, []);

    // GSAP animation on mount
    useEffect(() => {
        if (formRef.current && !loadingSuppliers) {
            gsap.fromTo(
                formRef.current,
                { opacity: 0, y: 30 },
                { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
            );
        }
    }, [loadingSuppliers]);

    // Animate result when it appears
    useEffect(() => {
        if (result && resultRef.current) {
            gsap.fromTo(
                resultRef.current,
                { opacity: 0, scale: 0.95 },
                { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.2)' }
            );
        }
    }, [result]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setResult(null);

        // Validation
        if (!supplierId.trim()) {
            setError('Supplier ID harus diisi');
            toast.error('Supplier ID harus diisi');
            return;
        }

        const weight = parseFloat(wetWeightGram);
        if (isNaN(weight) || weight <= 0) {
            setError('Berat basah harus berupa angka positif');
            toast.error('Berat basah harus berupa angka positif');
            return;
        }

        setLoading(true);

        try {
            const response = await submitBakuReceive({
                supplierId: supplierId.trim(),
                wetWeightGram: weight,
                notes: notes.trim() || undefined,
            });

            setResult(response);
            toast.success('Penerimaan baku berhasil dicatat!');

            // Reset form
            setSupplierId('');
            setWetWeightGram('');
            setNotes('');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat mengirim data';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    if (loadingSuppliers) {
        return (
            <div className="min-h-[calc(100vh-72px)] flex items-center justify-center">
                <LoadingCircle size="lg" />
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-green-50 to-white py-12 px-4">
            <div className="container mx-auto max-w-2xl">
                {/* Page Title */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 mb-2">Terima Baku</h1>
                    <p className="text-gray-600">Form penerimaan bahan baku dari supplier</p>
                </div>

                {/* Form Card */}
                <div ref={formRef} className="bg-white rounded-xl shadow-lg p-8 mb-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Supplier Selection */}
                        <div>
                            <label htmlFor="supplier" className="block text-sm font-medium text-gray-700 mb-2">
                                Supplier {suppliers === null && '(Manual Input)'}
                            </label>

                            {suppliers !== null ? (
                                <select
                                    id="supplier"
                                    value={supplierId}
                                    onChange={(e) => setSupplierId(e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                                    required
                                >
                                    <option value="">Pilih Supplier</option>
                                    {suppliers.map((supplier) => (
                                        <option key={supplier.id} value={supplier.id}>
                                            {supplier.name}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    id="supplier"
                                    value={supplierId}
                                    onChange={(e) => setSupplierId(e.target.value)}
                                    placeholder="Masukkan Supplier ID"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                                    required
                                />
                            )}

                            {suppliers === null && (
                                <p className="mt-2 text-sm text-yellow-600">
                                    ⚠️ Endpoint suppliers tidak tersedia. Gunakan input manual.
                                </p>
                            )}
                        </div>

                        {/* Wet Weight */}
                        <div>
                            <label htmlFor="wetWeight" className="block text-sm font-medium text-gray-700 mb-2">
                                Berat Basah (gram)
                            </label>
                            <input
                                type="number"
                                id="wetWeight"
                                value={wetWeightGram}
                                onChange={(e) => setWetWeightGram(e.target.value)}
                                placeholder="Contoh: 5000"
                                min="0"
                                step="0.01"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                                required
                            />
                        </div>

                        {/* Notes */}
                        <div>
                            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                                Catatan (Opsional)
                            </label>
                            <textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Tambahkan catatan jika diperlukan..."
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition resize-none"
                            />
                        </div>

                        {/* Error Alert */}
                        {error && (
                            <Alert variant="error" dismissible onDismiss={() => setError(null)}>
                                {error}
                            </Alert>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-green-600 text-white font-medium py-3 px-6 rounded-lg hover:bg-green-700 focus:ring-4 focus:ring-green-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <LoadingCircle size="sm" />
                                    <span>Memproses...</span>
                                </>
                            ) : (
                                <>
                                    <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Submit Penerimaan</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Result Card */}
                {result && (
                    <div ref={resultRef} className="bg-green-50 border-2 border-green-200 rounded-xl p-8">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                                <svg
                                    className="w-6 h-6 text-white"
                                    fill="none"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="text-2xl font-bold text-green-800">Penerimaan Berhasil!</h2>
                        </div>

                        <div className="space-y-3">
                            <div className="bg-white rounded-lg p-4">
                                <p className="text-sm text-gray-600 mb-1">Card Number</p>
                                <p className="text-2xl font-mono font-bold text-gray-900">{result.cardNumber}</p>
                            </div>

                            <div className="bg-white rounded-lg p-4">
                                <p className="text-sm text-gray-600 mb-1">QR Payload</p>
                                <p className="text-sm font-mono text-gray-900 break-all">{result.qrPayload}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function TerimaBakuPage() {
    return (
        <ProtectedRoute allowedRoles={['baku', 'manager']}>
            <TerimaBakuContent />
        </ProtectedRoute>
    );
}
