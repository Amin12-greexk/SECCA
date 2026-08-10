'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Alert from '@/components/Alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/lib/toast';
import {
    createGradeTariff,
    createResultGradeTariff,
    deleteGradeTariff,
    deleteMoistureRule,
    deletePecahBonPreset,
    deleteResultGradeTariff,
    getBarangJadiList,
    getGrades,
    getGradeTariffs,
    getMoistureRules,
    getPecahBonPresets,
    getResultGradeTariffs,
    getTariffAudits,
    getSystemSetting,
    setSystemSetting,
    updateGradeTariff,
    updateResultGradeTariff,
    type BarangJadi,
    type Grade,
    type GradeTariff,
    type MoistureRule,
    type PecahBonPreset,
    type ResultGradeTariffItem,
    type TariffAuditLog,
} from '@/lib/api';

type TabType = 'resultTariffs' | 'tariffs' | 'moisture' | 'presets';

function AdminRulesContent() {
    const toast = useToast();
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<TabType>('resultTariffs');

    // System Setting (WET vs DRY raw material purchase base)
    const [rawCalcBase, setRawCalcBase] = useState<'WET' | 'DRY'>('WET');
    const [settingLoading, setSettingLoading] = useState(false);

    // State for Result Grade Tariffs
    const [resultTariffs, setResultTariffs] = useState<ResultGradeTariffItem[]>([]);
    const [resultTariffsLoading, setResultTariffsLoading] = useState(true);
    const [barangJadiOptions, setBarangJadiOptions] = useState<BarangJadi[]>([]);
    const [resultTariffForm, setResultTariffForm] = useState({
        resultGradeTypeId: '',
        rateRpPerGram: '',
    });

    // Edit state for Result Grade Tariffs
    const [editingResultTariff, setEditingResultTariff] = useState<ResultGradeTariffItem | null>(null);
    const [editResultForm, setEditResultForm] = useState({
        rateRpPerGram: '',
        effectiveFrom: '',
    });
    const [editResultSubmitting, setEditResultSubmitting] = useState(false);

    // Edit state for Grade Tariffs (Bentuk, Bulu, Warna)
    const [editingGradeTariff, setEditingGradeTariff] = useState<GradeTariff | null>(null);
    const [editGradeTariffForm, setEditGradeTariffForm] = useState({
        rateRpPerGram: '',
        effectiveFrom: '',
        effectiveTo: '',
    });
    const [editGradeSubmitting, setEditGradeSubmitting] = useState(false);

    // State for Grade Tariffs
    const [tariffs, setTariffs] = useState<GradeTariff[]>([]);
    const [tariffsLoading, setTariffsLoading] = useState(true);
    const [tariffsError, setTariffsError] = useState<string | null>(null);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [gradesLoading, setGradesLoading] = useState(true);
    const [tariffAudits, setTariffAudits] = useState<TariffAuditLog[]>([]);
    const [tariffAuditsLoading, setTariffAuditsLoading] = useState(true);

    const [tariffForm, setTariffForm] = useState({
        shapeGradeId: '',
        featherGradeId: '',
        colorGradeId: '',
        rateRpPerGram: '',
        effectiveFrom: '',
        effectiveTo: '',
    });

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

    const loadGrades = async () => {
        setGradesLoading(true);
        try {
            const data = await getGrades();
            setGrades(data);
        } catch (err) {
            console.error('Failed to load grades:', err);
            toast.error('Gagal memuat daftar grade.');
        } finally {
            setGradesLoading(false);
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

    const loadSystemSetting = async () => {
        try {
            const res = await getSystemSetting('RAW_MATERIAL_PAYROLL_CALC_BASE');
            setRawCalcBase(res.value === 'DRY' ? 'DRY' : 'WET');
        } catch {
            setRawCalcBase('WET');
        }
    };

    const loadResultTariffs = async () => {
        setResultTariffsLoading(true);
        try {
            const [tariffsData, bjdData] = await Promise.all([
                getResultGradeTariffs(),
                getBarangJadiList(),
            ]);
            setResultTariffs(tariffsData);
            setBarangJadiOptions(bjdData);
        } catch (err) {
            console.error('Failed to load result grade tariffs:', err);
        } finally {
            setResultTariffsLoading(false);
        }
    };

    const loadTariffAudits = async () => {
        setTariffAuditsLoading(true);
        try {
            setTariffAudits(await getTariffAudits());
        } catch (err) {
            console.error('Failed to load tariff audit history:', err);
        } finally {
            setTariffAuditsLoading(false);
        }
    };

    const handleUpdateRawCalcBase = async (val: 'WET' | 'DRY') => {
        setSettingLoading(true);
        try {
            await setSystemSetting('RAW_MATERIAL_PAYROLL_CALC_BASE', val);
            setRawCalcBase(val);
            toast.success(`Pengaturan basis pembelian baku berhasil diubah ke: Berat ${val === 'WET' ? 'Basah' : 'Kering'}.`);
        } catch {
            toast.error('Gagal memperbarui pengaturan.');
        } finally {
            setSettingLoading(false);
        }
    };

    const handleCreateResultTariff = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resultTariffForm.resultGradeTypeId || !resultTariffForm.rateRpPerGram) {
            toast.error('Pilih grade hasil dan isi tarif Rp/g.');
            return;
        }
        try {
            await createResultGradeTariff({
                resultGradeTypeId: resultTariffForm.resultGradeTypeId,
                rateRpPerGram: Number(resultTariffForm.rateRpPerGram),
            });
            toast.success('Tarif grade hasil berhasil disimpan.');
            setResultTariffForm({ resultGradeTypeId: '', rateRpPerGram: '' });
            await loadResultTariffs();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Gagal menyimpan tarif grade hasil.');
        }
    };

    const handleDeleteResultTariff = async (id: string, name: string) => {
        if (!window.confirm(`Hapus tarif untuk grade hasil "${name}"?`)) return;
        try {
            await deleteResultGradeTariff(id);
            toast.success('Tarif grade hasil berhasil dihapus.');
            await loadResultTariffs();
        } catch {
            toast.error('Gagal menghapus tarif grade hasil.');
        }
    };

    const handleOpenEditResultTariff = (item: ResultGradeTariffItem) => {
        setEditingResultTariff(item);
        setEditResultForm({
            rateRpPerGram: String(item.rateRpPerGram),
            effectiveFrom: item.effectiveFrom ? new Date(item.effectiveFrom).toISOString().slice(0, 10) : '',
        });
    };

    const handleSaveEditResultTariff = async () => {
        if (!editingResultTariff) return;
        const rate = Number(editResultForm.rateRpPerGram);
        if (!rate || rate <= 0) {
            toast.error('Tarif per gram harus lebih dari 0.');
            return;
        }
        setEditResultSubmitting(true);
        try {
            await updateResultGradeTariff(editingResultTariff.id, {
                rateRpPerGram: rate,
                effectiveFrom: editResultForm.effectiveFrom ? new Date(editResultForm.effectiveFrom).toISOString() : undefined,
            });
            toast.success('Tarif grade hasil berhasil diperbarui.');
            setEditingResultTariff(null);
            await loadResultTariffs();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Gagal memperbarui tarif grade hasil.');
        } finally {
            setEditResultSubmitting(false);
        }
    };

    const handleOpenEditGradeTariff = (item: GradeTariff) => {
        setEditingGradeTariff(item);
        setEditGradeTariffForm({
            rateRpPerGram: String(item.rateRpPerGram),
            effectiveFrom: item.effectiveFrom ? new Date(item.effectiveFrom).toISOString().slice(0, 10) : '',
            effectiveTo: item.effectiveTo ? new Date(item.effectiveTo).toISOString().slice(0, 10) : '',
        });
    };

    const handleSaveEditGradeTariff = async () => {
        if (!editingGradeTariff) return;
        const rate = Number(editGradeTariffForm.rateRpPerGram);
        if (!rate || rate <= 0) {
            toast.error('Tarif per gram harus lebih dari 0.');
            return;
        }
        setEditGradeSubmitting(true);
        try {
            await updateGradeTariff(editingGradeTariff.id, {
                rateRpPerGram: rate,
                effectiveFrom: editGradeTariffForm.effectiveFrom ? new Date(editGradeTariffForm.effectiveFrom).toISOString() : undefined,
                effectiveTo: editGradeTariffForm.effectiveTo ? new Date(editGradeTariffForm.effectiveTo).toISOString() : null,
            });
            toast.success('Tarif grade baku berhasil diperbarui.');
            setEditingGradeTariff(null);
            await loadTariffs();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Gagal memperbarui tarif grade baku.');
        } finally {
            setEditGradeSubmitting(false);
        }
    };

    useEffect(() => {
        loadSystemSetting();
        loadResultTariffs();
        loadTariffs();
        loadGrades();
        loadMoistureRules();
        loadPresets();
        loadTariffAudits();
    }, []);

    const handleDeleteTariff = async (item: GradeTariff) => {
        const label = [
            item.shapeGrade?.code ?? item.shapeGradeId,
            item.featherGrade?.code ?? item.featherGradeId,
            item.colorGrade?.code ?? item.colorGradeId,
        ]
            .filter(Boolean)
            .join(' / ');
        const confirmed = window.confirm(`Hapus tarif untuk kombinasi "${label}"?`);
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

    const shapeGrades = grades.filter((grade) => grade.type === 'BENTUK');
    const featherGrades = grades.filter((grade) => grade.type === 'BULU');
    const colorGrades = grades.filter((grade) => grade.type === 'WARNA');

    const handleTariffSubmit = async () => {
        if (!tariffForm.shapeGradeId) {
            toast.error('Pilih grade bentuk terlebih dulu.');
            return;
        }

        if (tariffForm.colorGradeId && !tariffForm.featherGradeId) {
            toast.error('Grade warna harus dipasangkan dengan grade bulu.');
            return;
        }

        const rate = Number(tariffForm.rateRpPerGram);
        if (!rate || rate <= 0) {
            toast.error('Tarif per gram harus lebih dari 0.');
            return;
        }

        if (!tariffForm.effectiveFrom) {
            toast.error('Tanggal mulai berlaku wajib diisi.');
            return;
        }

        try {
            await createGradeTariff({
                shapeGradeId: tariffForm.shapeGradeId,
                featherGradeId: tariffForm.featherGradeId || null,
                colorGradeId: tariffForm.colorGradeId || null,
                rateRpPerGram: rate,
                effectiveFrom: new Date(tariffForm.effectiveFrom).toISOString(),
                effectiveTo: tariffForm.effectiveTo
                    ? new Date(tariffForm.effectiveTo).toISOString()
                    : null,
            });
            toast.success('Tarif berhasil disimpan.');
            setTariffForm({
                shapeGradeId: '',
                featherGradeId: '',
                colorGradeId: '',
                rateRpPerGram: '',
                effectiveFrom: '',
                effectiveTo: '',
            });
            await loadTariffs();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Gagal menyimpan tarif.';
            toast.error(message);
        }
    };

    const tabs: { id: TabType; label: string; count: number }[] = [
        { id: 'resultTariffs', label: 'Tarif Grade Hasil & By-Product', count: resultTariffs.length },
        { id: 'tariffs', label: 'Tarif Baku (Bentuk/Bulu/Warna)', count: tariffs.length },
        { id: 'moisture', label: 'Aturan Kelembaban', count: moistureRules.length },
        { id: 'presets', label: 'Preset Pecah Bon', count: presets.length },
    ];

    // Collect all result grade types from barangJadiOptions
    const allResultGradeTypes = useMemo(() => {
        const map = new Map<string, { id: string; name: string }>();
        barangJadiOptions.forEach((bjd) => {
            bjd.resultGrades?.forEach((rg) => map.set(rg.id, rg));
        });
        return Array.from(map.values());
    }, [barangJadiOptions]);

    return (
        <div ref={containerRef} className="min-h-[calc(100vh-72px)] bg-slate-50 py-10 px-4">
            <div className="mx-auto max-w-6xl space-y-8">
                <div className="flex flex-col gap-3">
                    <h1 className="text-3xl font-semibold text-gray-900">
                        Admin & Manager - Aturan & Pengaturan Tarif
                    </h1>
                    <p className="text-sm text-gray-600">
                        Kelola tarif grade bahan baku, tarif grade hasil barang jadi, dan preferensi perhitungan upah mitra.
                    </p>
                </div>

                {/* ── CARD: Manager Preference Setting (WET vs DRY) ── */}
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 to-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full bg-[#059833] px-2.5 py-0.5 text-xs font-bold text-white uppercase">Pengaturan Manager</span>
                                <h2 className="text-base font-bold text-gray-900">Basis Pembelian Bahan Baku Mitra</h2>
                            </div>
                            <p className="mt-1 text-xs text-gray-600 max-w-2xl">
                                Pilih basis berat bahan baku yang &quot;dibeli&quot; oleh mitra saat pengambilan LP. Berat Basah (sebelum kadar air) atau Berat Kering (setelah potong kadar air).
                            </p>
                        </div>

                        <div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-white p-1.5 shadow-sm">
                            <button
                                type="button"
                                disabled={settingLoading}
                                onClick={() => void handleUpdateRawCalcBase('WET')}
                                className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                                    rawCalcBase === 'WET'
                                        ? 'bg-[#059833] text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                💧 Berat Basah (WET)
                            </button>
                            <button
                                type="button"
                                disabled={settingLoading}
                                onClick={() => void handleUpdateRawCalcBase('DRY')}
                                className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                                    rawCalcBase === 'DRY'
                                        ? 'bg-[#059833] text-white shadow-sm'
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                ☀️ Berat Kering (DRY)
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8 overflow-x-auto">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                                    activeTab === tab.id
                                        ? 'border-[#059833] text-[#059833]'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                {tab.label}
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                                    activeTab === tab.id
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Result Grade Tariffs Tab */}
                {activeTab === 'resultTariffs' && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Tarif Grade Hasil Barang Jadi</h2>
                                <p className="text-xs text-gray-500">Tarif per gram ini digunakan untuk menghitung nilai penjualan hasil karya mitra saat setoran.</p>
                            </div>
                            <Button type="button" variant="outline" size="sm" onClick={loadResultTariffs}>
                                Refresh
                            </Button>
                        </div>

                        {/* Form Tambah Tarif Grade Hasil */}
                        <form onSubmit={handleCreateResultTariff} className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                            <h3 className="text-sm font-semibold text-gray-800 mb-3">Tambah Tarif Grade Hasil Baru</h3>
                            <div className="grid gap-4 sm:grid-cols-3 items-end">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Tipe Grade Hasil Barang Jadi</Label>
                                    <select
                                        value={resultTariffForm.resultGradeTypeId}
                                        onChange={(e) => setResultTariffForm((prev) => ({ ...prev, resultGradeTypeId: e.target.value }))}
                                        className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs outline-none focus:border-[#059833]"
                                    >
                                        <option value="">-- Pilih Grade Hasil --</option>
                                        {allResultGradeTypes.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Tarif (Rp / Gram)</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        placeholder="Contoh: 1500"
                                        value={resultTariffForm.rateRpPerGram}
                                        onChange={(e) => setResultTariffForm((prev) => ({ ...prev, rateRpPerGram: e.target.value }))}
                                        className="h-10 text-xs shadow-none"
                                    />
                                </div>
                                <Button type="submit" className="h-10 bg-[#059833] hover:bg-[#047a29] font-semibold text-xs">
                                    Simpan Tarif Hasil
                                </Button>
                            </div>
                        </form>

                        {/* Tabel Tarif Grade Hasil */}
                        <div className="overflow-hidden rounded-xl border border-gray-200">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 font-bold uppercase text-gray-600">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Nama Grade Hasil</th>
                                        <th className="px-4 py-3 text-right">Tarif (Rp / Gram)</th>
                                        <th className="px-4 py-3 text-left">Tanggal Berlaku</th>
                                        <th className="px-4 py-3 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {resultTariffsLoading ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Memuat tarif grade hasil...</td>
                                        </tr>
                                    ) : resultTariffs.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-8 text-center text-gray-500">Belum ada tarif grade hasil yang dikonfigurasi.</td>
                                        </tr>
                                    ) : (
                                        resultTariffs.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-semibold text-gray-900">{item.resultGradeType?.name ?? '-'}</td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-[#059833]">{formatCurrency(item.rateRpPerGram)} / g</td>
                                                <td className="px-4 py-3 text-gray-600">{formatDate(item.effectiveFrom)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleOpenEditResultTariff(item)}
                                                            className="h-8 text-blue-600 hover:bg-blue-50"
                                                            title="Edit Tarif Grade Hasil"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => void handleDeleteResultTariff(item.id, item.resultGradeType?.name ?? '')}
                                                            className="h-8 text-rose-600 hover:bg-rose-50"
                                                            title="Hapus Tarif"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Grade Tariffs Tab */}
                {activeTab === 'tariffs' && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Daftar Tarif Grade</h2>
                            <Button type="button" variant="outline" size="sm" onClick={loadTariffs}>
                                Refresh
                            </Button>
                        </div>

                        <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <h3 className="text-sm font-semibold text-gray-800">Tambah Tarif Hirarki</h3>
                            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>Grade Bentuk</Label>
                                    <Select
                                        value={tariffForm.shapeGradeId}
                                        onValueChange={(value) =>
                                            setTariffForm((prev) => ({ ...prev, shapeGradeId: value }))
                                        }
                                        disabled={gradesLoading}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={gradesLoading ? 'Memuat...' : 'Pilih bentuk'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {shapeGrades.map((grade) => (
                                                <SelectItem key={grade.id} value={grade.id}>
                                                    {grade.code} - {grade.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Grade Bulu (opsional)</Label>
                                    <Select
                                        value={tariffForm.featherGradeId}
                                        onValueChange={(value) =>
                                            setTariffForm((prev) => ({
                                                ...prev,
                                                featherGradeId: value === 'none' ? '' : value,
                                                colorGradeId: value === 'none' ? '' : prev.colorGradeId,
                                            }))
                                        }
                                        disabled={gradesLoading}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={gradesLoading ? 'Memuat...' : 'Pilih bulu'} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Tanpa grade bulu</SelectItem>
                                            {featherGrades.map((grade) => (
                                                <SelectItem key={grade.id} value={grade.id}>
                                                    {grade.code} - {grade.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Grade Warna (opsional)</Label>
                                    <Select
                                        value={tariffForm.colorGradeId}
                                        onValueChange={(value) =>
                                            setTariffForm((prev) => ({
                                                ...prev,
                                                colorGradeId: value === 'none' ? '' : value,
                                            }))
                                        }
                                        disabled={gradesLoading || !tariffForm.featherGradeId}
                                    >
                                        <SelectTrigger>
                                            <SelectValue
                                                placeholder={
                                                    !tariffForm.featherGradeId
                                                        ? 'Pilih bulu dulu'
                                                        : gradesLoading
                                                            ? 'Memuat...'
                                                            : 'Pilih warna'
                                                }
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Tanpa grade warna</SelectItem>
                                            {colorGrades.map((grade) => (
                                                <SelectItem key={grade.id} value={grade.id}>
                                                    {grade.code} - {grade.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="mt-4 grid gap-4 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label>Tarif per gram</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={tariffForm.rateRpPerGram}
                                        onChange={(event) =>
                                            setTariffForm((prev) => ({ ...prev, rateRpPerGram: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Berlaku Dari</Label>
                                    <Input
                                        type="date"
                                        value={tariffForm.effectiveFrom}
                                        onChange={(event) =>
                                            setTariffForm((prev) => ({ ...prev, effectiveFrom: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Berlaku Sampai (opsional)</Label>
                                    <Input
                                        type="date"
                                        value={tariffForm.effectiveTo}
                                        onChange={(event) =>
                                            setTariffForm((prev) => ({ ...prev, effectiveTo: event.target.value }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="mt-4">
                                <Button type="button" onClick={handleTariffSubmit}>
                                    Simpan Tarif
                                </Button>
                            </div>
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
                                            <th className="py-3 pr-4 font-medium">Bentuk</th>
                                            <th className="py-3 pr-4 font-medium">Bulu</th>
                                            <th className="py-3 pr-4 font-medium">Warna</th>
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
                                                    {item.shapeGrade?.code || item.shapeGradeId}
                                                </td>
                                                <td className="py-3 pr-4 text-gray-700">
                                                    {item.featherGrade?.code || item.featherGradeId || '-'}
                                                </td>
                                                <td className="py-3 pr-4 text-gray-700">
                                                    {item.colorGrade?.code || item.colorGradeId || '-'}
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
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleOpenEditGradeTariff(item)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            Edit
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleDeleteTariff(item)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            Hapus
                                                        </Button>
                                                    </div>
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

                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Histori Perubahan Tarif</h2>
                            <p className="mt-1 text-xs text-gray-500">Mencatat siapa yang mengubah tarif, nilai sebelum/sesudah, dan waktunya.</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={loadTariffAudits} disabled={tariffAuditsLoading}>
                            Refresh
                        </Button>
                    </div>
                    {tariffAuditsLoading ? (
                        <div className="flex items-center gap-2 py-6 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" /> Memuat histori...</div>
                    ) : tariffAudits.length === 0 ? (
                        <p className="py-6 text-sm text-gray-500">Belum ada perubahan tarif melalui sistem.</p>
                    ) : (
                        <div className="max-h-80 overflow-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-gray-50 text-left text-xs text-gray-500">
                                    <tr>
                                        <th className="px-3 py-2">Tanggal</th>
                                        <th className="px-3 py-2">Pengguna</th>
                                        <th className="px-3 py-2">Jenis</th>
                                        <th className="px-3 py-2">Perubahan</th>
                                        <th className="px-3 py-2">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {tariffAudits.map((audit) => (
                                        <tr key={audit.id}>
                                            <td className="px-3 py-2 text-gray-600">{new Date(audit.changedAt).toLocaleString('id-ID')}</td>
                                            <td className="px-3 py-2 font-medium text-gray-900">{audit.changedBy.name}</td>
                                            <td className="px-3 py-2 text-gray-600">{audit.tariffType}</td>
                                            <td className="px-3 py-2 font-mono text-gray-700">{audit.previousRateRpPerGram == null ? '-' : formatCurrency(audit.previousRateRpPerGram)} → {audit.newRateRpPerGram == null ? '-' : formatCurrency(audit.newRateRpPerGram)}</td>
                                            <td className="px-3 py-2 text-gray-600">{audit.action}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>


            {/* Modal Edit Tarif Grade Hasil */}
            <Dialog open={!!editingResultTariff} onOpenChange={(open) => !open && setEditingResultTariff(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Tarif Grade Hasil: {editingResultTariff?.resultGradeType?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-1.5">
                            <Label>Tarif (Rp / Gram)</Label>
                            <Input
                                type="number"
                                min={1}
                                value={editResultForm.rateRpPerGram}
                                onChange={(e) => setEditResultForm((prev) => ({ ...prev, rateRpPerGram: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Tanggal Mulai Berlaku</Label>
                            <Input
                                type="date"
                                value={editResultForm.effectiveFrom}
                                onChange={(e) => setEditResultForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingResultTariff(null)}>Batal</Button>
                        <Button onClick={handleSaveEditResultTariff} disabled={editResultSubmitting} className="bg-[#059833] hover:bg-[#047a29]">
                            {editResultSubmitting ? 'Memperbarui...' : 'Simpan Perubahan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Edit Tarif Grade Baku (Hirarki) */}
            <Dialog open={!!editingGradeTariff} onOpenChange={(open) => !open && setEditingGradeTariff(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Edit Tarif Baku ({[editingGradeTariff?.shapeGrade?.code, editingGradeTariff?.featherGrade?.code, editingGradeTariff?.colorGrade?.code].filter(Boolean).join(' / ')})
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-1.5">
                            <Label>Tarif (Rp / Gram)</Label>
                            <Input
                                type="number"
                                min={1}
                                value={editGradeTariffForm.rateRpPerGram}
                                onChange={(e) => setEditGradeTariffForm((prev) => ({ ...prev, rateRpPerGram: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Mulai Berlaku</Label>
                            <Input
                                type="date"
                                value={editGradeTariffForm.effectiveFrom}
                                onChange={(e) => setEditGradeTariffForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Berlaku Sampai (Opsional)</Label>
                            <Input
                                type="date"
                                value={editGradeTariffForm.effectiveTo}
                                onChange={(e) => setEditGradeTariffForm((prev) => ({ ...prev, effectiveTo: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingGradeTariff(null)}>Batal</Button>
                        <Button onClick={handleSaveEditGradeTariff} disabled={editGradeSubmitting} className="bg-[#059833] hover:bg-[#047a29]">
                            {editGradeSubmitting ? 'Memperbarui...' : 'Simpan Perubahan'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
