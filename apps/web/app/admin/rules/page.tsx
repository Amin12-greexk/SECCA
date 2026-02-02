'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Loader2, Trash2 } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Alert from '@/components/Alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/lib/toast';
import {
    deleteGradeTariff,
    deleteMoistureRule,
    deletePecahBonPreset,
    getGradeTariffs,
    getMoistureRules,
    getPecahBonPresets,
    type GradeTariff,
    type MoistureRule,
    type PecahBonPreset,
} from '@/lib/api';

type TabType = 'tariffs' | 'moisture' | 'presets';

function AdminRulesContent() {
    const toast = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<TabType>('tariffs');

    // State for Grade Tariffs
    const [tariffs, setTariffs] = useState<GradeTariff[]>([]);
    const [tariffsLoading, setTariffsLoading] = useState(true);
    const [tariffsError, setTariffsError] = useState<string | null>(null);

    // State for Moisture Rules
    const [moistureRules, setMoistureRules] = useState<MoistureRule[]>([]);
    const [moistureLoading, setMoistureLoading] = useState(true);
    const [moistureError, setMoistureError] = useState<string | null>(null);

    // State for Pecah Bon Presets
    const [presets, setPresets] = useState<PecahBonPreset[]>([]);
    const [presetsLoading, setPresetsLoading] = useState(true);
    const [presetsError, setPresetsError] = useState<string | null>(null);

    useEffect(() => {
        if (containerRef.current) {
            gsap.fromTo(
                containerRef.current,
                { opacity: 0, y: 30 },
                { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
            );
        }
    }, []);

    const loadTariffs = async () => {
        setTariffsLoading(true);
        setTariffsError(null);
        try {
            const data = await getGradeTariffs();
            setTariffs(data);
        } catch (err) {
            console.error('Failed to load tariffs:', err);
            setTariffsError('Gagal memuat data tarif. Coba lagi.');
        } finally {
            setTariffsLoading(false);
        }
    };

    const loadMoistureRules = async () => {
        setMoistureLoading(true);
        setMoistureError(null);
        try {
            const data = await getMoistureRules();
            setMoistureRules(data);
        } catch (err) {
            console.error('Failed to load moisture rules:', err);
            setMoistureError('Gagal memuat data aturan kelembaban. Coba lagi.');
        } finally {
            setMoistureLoading(false);
        }
    };

    const loadPresets = async () => {
        setPresetsLoading(true);
        setPresetsError(null);
        try {
            const data = await getPecahBonPresets();
            setPresets(data);
        } catch (err) {
            console.error('Failed to load presets:', err);
            setPresetsError('Gagal memuat data preset. Coba lagi.');
        } finally {
            setPresetsLoading(false);
        }
    };

    useEffect(() => {
        loadTariffs();
        loadMoistureRules();
        loadPresets();
    }, []);

    const handleDeleteTariff = async (item: GradeTariff) => {
        const confirmed = window.confirm(`Hapus tarif untuk grade "${item.grade?.name || item.gradeId}"?`);
        if (!confirmed) return;

        try {
            await deleteGradeTariff(item.id);
            toast.success('Tarif berhasil dihapus.');
            await loadTariffs();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal menghapus tarif.';
            toast.error(message);
        }
    };

    const handleDeleteMoistureRule = async (item: MoistureRule) => {
        const confirmed = window.confirm(`Hapus aturan kelembaban ini?`);
        if (!confirmed) return;

        try {
            await deleteMoistureRule(item.id);
            toast.success('Aturan kelembaban berhasil dihapus.');
            await loadMoistureRules();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal menghapus aturan.';
            toast.error(message);
        }
    };

    const handleDeletePreset = async (item: PecahBonPreset) => {
        const confirmed = window.confirm(`Hapus preset "${item.name}"?`);
        if (!confirmed) return;

        try {
            await deletePecahBonPreset(item.id);
            toast.success('Preset berhasil dihapus.');
            await loadPresets();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal menghapus preset.';
            toast.error(message);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(value);
    };

    const tabs: { id: TabType; label: string; count: number }[] = [
        { id: 'tariffs', label: 'Tarif Grade', count: tariffs.length },
        { id: 'moisture', label: 'Aturan Kelembaban', count: moistureRules.length },
        { id: 'presets', label: 'Preset Pecah Bon', count: presets.length },
    ];

    return (
        <div ref={containerRef} className="min-h-[calc(100vh-72px)] bg-gradient-to-br from-slate-50 via-white to-blue-50 py-10 px-4">
            <div className="mx-auto max-w-6xl space-y-8">
                <div className="flex flex-col gap-3">
                    <h1 className="text-3xl font-semibold text-gray-900">
                        Admin - Manajemen Data
                    </h1>
                    <p className="text-sm text-gray-600">
                        Kelola tarif grade, aturan kelembaban, dan preset pecah bon. Hapus data terkait sebelum menghapus Grade atau Supplier.
                    </p>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                {tab.label}
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id
                                        ? 'bg-blue-100 text-blue-600'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Grade Tariffs Tab */}
                {activeTab === 'tariffs' && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Daftar Tarif Grade</h2>
                            <Button type="button" variant="outline" size="sm" onClick={loadTariffs}>
                                Refresh
                            </Button>
                        </div>

                        {tariffsError && (
                            <div className="mb-4">
                                <Alert variant="error">{tariffsError}</Alert>
                            </div>
                        )}

                        {tariffsLoading ? (
                            <div className="flex items-center gap-2 py-6 text-sm text-gray-600">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Memuat tarif...
                            </div>
                        ) : tariffs.length === 0 ? (
                            <p className="py-6 text-sm text-gray-500">Belum ada data tarif grade.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 text-left text-gray-500">
                                            <th className="py-3 pr-4 font-medium">Grade</th>
                                            <th className="py-3 pr-4 font-medium">Tarif/gram</th>
                                            <th className="py-3 pr-4 font-medium">Berlaku Dari</th>
                                            <th className="py-3 pr-4 font-medium">Berlaku Sampai</th>
                                            <th className="py-3 text-right font-medium">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tariffs.map((item) => (
                                            <tr key={item.id} className="border-b border-gray-100">
                                                <td className="py-3 pr-4 font-medium text-gray-900">
                                                    {item.grade?.name || item.gradeId}
                                                </td>
                                                <td className="py-3 pr-4 text-gray-700">
                                                    {formatCurrency(item.rateRpPerGram)}
                                                </td>
                                                <td className="py-3 pr-4 text-gray-700">
                                                    {formatDate(item.effectiveFrom)}
                                                </td>
                                                <td className="py-3 pr-4 text-gray-700">
                                                    {item.effectiveTo ? formatDate(item.effectiveTo) : '-'}
                                                </td>
                                                <td className="py-3 text-right">
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDeleteTariff(item)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Hapus
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Moisture Rules Tab */}
                {activeTab === 'moisture' && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Daftar Aturan Kelembaban</h2>
                            <Button type="button" variant="outline" size="sm" onClick={loadMoistureRules}>
                                Refresh
                            </Button>
                        </div>

                        {moistureError && (
                            <div className="mb-4">
                                <Alert variant="error">{moistureError}</Alert>
                            </div>
                        )}

                        {moistureLoading ? (
                            <div className="flex items-center gap-2 py-6 text-sm text-gray-600">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Memuat aturan...
                            </div>
                        ) : moistureRules.length === 0 ? (
                            <p className="py-6 text-sm text-gray-500">Belum ada data aturan kelembaban.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 text-left text-gray-500">
                                            <th className="py-3 pr-4 font-medium">Grade</th>
                                            <th className="py-3 pr-4 font-medium">Supplier</th>
                                            <th className="py-3 pr-4 font-medium">Kelembaban (bps)</th>
                                            <th className="py-3 pr-4 font-medium">Berlaku Dari</th>
                                            <th className="py-3 text-right font-medium">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {moistureRules.map((item) => (
                                            <tr key={item.id} className="border-b border-gray-100">
                                                <td className="py-3 pr-4 text-gray-700">
                                                    {item.grade?.name || item.gradeId || '-'}
                                                </td>
                                                <td className="py-3 pr-4 text-gray-700">
                                                    {item.supplier?.name || item.supplierId || '-'}
                                                </td>
                                                <td className="py-3 pr-4 font-medium text-gray-900">
                                                    {item.moistureBps / 100}%
                                                </td>
                                                <td className="py-3 pr-4 text-gray-700">
                                                    {formatDate(item.effectiveFrom)}
                                                </td>
                                                <td className="py-3 text-right">
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDeleteMoistureRule(item)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Hapus
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Pecah Bon Presets Tab */}
                {activeTab === 'presets' && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Daftar Preset Pecah Bon</h2>
                            <Button type="button" variant="outline" size="sm" onClick={loadPresets}>
                                Refresh
                            </Button>
                        </div>

                        {presetsError && (
                            <div className="mb-4">
                                <Alert variant="error">{presetsError}</Alert>
                            </div>
                        )}

                        {presetsLoading ? (
                            <div className="flex items-center gap-2 py-6 text-sm text-gray-600">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Memuat preset...
                            </div>
                        ) : presets.length === 0 ? (
                            <p className="py-6 text-sm text-gray-500">Belum ada data preset pecah bon.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200 text-left text-gray-500">
                                            <th className="py-3 pr-4 font-medium">Nama</th>
                                            <th className="py-3 pr-4 font-medium">Berat (gram)</th>
                                            <th className="py-3 pr-4 font-medium">Status</th>
                                            <th className="py-3 text-right font-medium">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {presets.map((item) => (
                                            <tr key={item.id} className="border-b border-gray-100">
                                                <td className="py-3 pr-4 font-medium text-gray-900">
                                                    {item.name}
                                                </td>
                                                <td className="py-3 pr-4 text-gray-700">
                                                    {item.weightGram.toLocaleString('id-ID')} g
                                                </td>
                                                <td className="py-3 pr-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.isActive
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {item.isActive ? 'Aktif' : 'Nonaktif'}
                                                    </span>
                                                </td>
                                                <td className="py-3 text-right">
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDeletePreset(item)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Hapus
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AdminRulesPage() {
    return (
        <ProtectedRoute allowedRoles={['manager']}>
            <AdminRulesContent />
        </ProtectedRoute>
    );
}
