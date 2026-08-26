'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/lib/toast';
import {
    getFinishEvaluationSummary,
    type EvaluationGroupBy,
    type EvaluationMetricRow,
    type EvaluationSummary,
} from '@/lib/api';

const GROUP_LABEL: Record<EvaluationGroupBy, string> = {
    mitra: 'Mitra',
    grade: 'Grade',
    day: 'Harian',
    week: 'Mingguan',
    month: 'Bulanan',
};

const GROUP_COLUMN_HEAD: Record<EvaluationGroupBy, string> = {
    mitra: 'Mitra',
    grade: 'Grade',
    day: 'Tanggal',
    week: 'Minggu',
    month: 'Bulan',
};

const fmtGram = (g: number) => `${Math.round(g).toLocaleString('id-ID')} gr`;
const fmtPct = (bps: number) => `${(bps / 100).toFixed(2)}%`;

function firstDayOfMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: string }) {
    return (
        <div className={`rounded-xl border p-3 ${tone}`}>
            <p className="text-xs opacity-80">{label}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">{value}</p>
            {sub && <p className="text-xs opacity-70">{sub}</p>}
        </div>
    );
}

function KoreksiEvaluasiContent() {
    const toast = useToast();
    const [from, setFrom] = useState(firstDayOfMonth());
    const [to, setTo] = useState(today());
    const [groupBy, setGroupBy] = useState<EvaluationGroupBy>('mitra');
    const [data, setData] = useState<EvaluationSummary | null>(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getFinishEvaluationSummary({
                from: from || undefined,
                to: to || undefined,
                groupBy,
            });
            setData(result);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat rekap evaluasi.');
        } finally {
            setLoading(false);
        }
    }, [from, to, groupBy, toast]);

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const overall = data?.overall;

    return (
        <div className="space-y-5 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Evaluasi Koreksi</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Rekap rendemen, susut, dan by-product dari hasil setoran (per {GROUP_LABEL[groupBy].toLowerCase()}).
                    </p>
                </div>
                <Button variant="outline" onClick={load} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600">Dari Tanggal</label>
                        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600">Sampai Tanggal</label>
                        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-600">Kelompokkan per</label>
                        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as EvaluationGroupBy)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {(Object.keys(GROUP_LABEL) as EvaluationGroupBy[]).map((g) => (
                                    <SelectItem key={g} value={g}>
                                        {GROUP_LABEL[g]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-end">
                        <Button className="w-full" onClick={load} disabled={loading}>
                            {loading ? 'Memuat...' : 'Terapkan'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Overall summary */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Total LP"
                    value={(overall?.lpCount ?? 0).toLocaleString('id-ID')}
                    sub={`Berat kering: ${fmtGram(overall?.dryInGram ?? 0)}`}
                    tone="border-gray-200 bg-white text-gray-900"
                />
                <StatCard
                    label="Rendemen Utama"
                    value={fmtPct(overall?.rendemenMainPctBps ?? 0)}
                    sub={`Barang jadi: ${fmtGram(overall?.mainOutGram ?? 0)}`}
                    tone="border-indigo-200 bg-indigo-50 text-indigo-900"
                />
                <StatCard
                    label="Rendemen Bersih"
                    value={fmtPct(overall?.rendemenNetPctBps ?? 0)}
                    sub={`+ by-product: ${fmtGram(overall?.byProductGram ?? 0)}`}
                    tone="border-emerald-200 bg-emerald-50 text-emerald-900"
                />
                <StatCard
                    label="Susut Hilang"
                    value={fmtPct(overall?.susutHilangPctBps ?? 0)}
                    sub={`${fmtGram(overall?.susutHilangGram ?? 0)} • By-product ${fmtPct(overall?.susutProsesPctBps ?? 0)}`}
                    tone="border-rose-200 bg-rose-50 text-rose-900"
                />
            </div>

            {/* Breakdown table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-200 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">Rincian per {GROUP_LABEL[groupBy]}</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                                <th className="px-3 py-2 text-left">{GROUP_COLUMN_HEAD[groupBy]}</th>
                                <th className="px-3 py-2 text-right">LP</th>
                                <th className="px-3 py-2 text-right">Kering</th>
                                <th className="px-3 py-2 text-right">Barang Jadi</th>
                                <th className="px-3 py-2 text-right">By-Product</th>
                                <th className="px-3 py-2 text-right">Susut Hilang</th>
                                <th className="px-3 py-2 text-right">Rend. Utama</th>
                                <th className="px-3 py-2 text-right">Rend. Bersih</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-3 py-10 text-center text-sm text-gray-500">
                                        Memuat rekap...
                                    </td>
                                </tr>
                            ) : !data || data.groups.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-3 py-10 text-center text-sm text-gray-500">
                                        Belum ada data setoran pada rentang ini.
                                    </td>
                                </tr>
                            ) : (
                                data.groups.map((row: EvaluationMetricRow) => (
                                    <tr key={row.key} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 font-medium text-gray-900">{row.label}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{row.lpCount}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{fmtGram(row.dryInGram)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{fmtGram(row.mainOutGram)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{fmtGram(row.byProductGram)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums text-rose-700">{fmtGram(row.susutHilangGram)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-indigo-700">{fmtPct(row.rendemenMainPctBps)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">{fmtPct(row.rendemenNetPctBps)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {data && data.groups.length > 0 && overall && (
                            <tfoot className="border-t border-gray-200 bg-gray-50 text-xs font-semibold text-gray-800">
                                <tr>
                                    <td className="px-3 py-2">Total</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{overall.lpCount}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmtGram(overall.dryInGram)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmtGram(overall.mainOutGram)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmtGram(overall.byProductGram)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmtGram(overall.susutHilangGram)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(overall.rendemenMainPctBps)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(overall.rendemenNetPctBps)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </div>
    );
}

export default function KoreksiEvaluasiPage() {
    return (
        <ProtectedRoute>
            <KoreksiEvaluasiContent />
        </ProtectedRoute>
    );
}
