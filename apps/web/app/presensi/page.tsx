'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, Clock, Pencil, Plus, RefreshCw, Search, Upload, Users } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getPresensi, type PresensiPerson, type PresensiRecord, type PresensiResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth/AuthContext';
import { useToast } from '@/lib/toast';
import RecordDialog, { type RecordTarget } from './RecordDialog';
import {
    dayName,
    dayNumber,
    formatDuration,
    isSunday,
    longDate,
    monthLabel,
    shiftLabel,
    weekLabel,
} from './presensiFormat';

const PAGE_SIZE = 100;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900">{value}</p>
            {hint ? <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p> : null}
        </div>
    );
}

function clockText(record: Pick<PresensiRecord, 'clockIn' | 'clockOut' | 'shift'>) {
    const out = record.clockOut ?? '–';
    const next = record.clockIn && record.clockOut && record.clockOut < record.clockIn ? ' +1' : '';
    return `${record.clockIn ?? '–'} – ${out}${next}`;
}

function PresensiContent() {
    const { user } = useAuth();
    const toast = useToast();
    // Hanya manager yang boleh upload & mengedit; server juga menolak yang lain.
    const canEdit = user?.role === 'manager' && !user?.readOnly;

    const [month, setMonth] = useState('');
    const [weekStart, setWeekStart] = useState('');
    const [shift, setShift] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [data, setData] = useState<PresensiResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [visible, setVisible] = useState(PAGE_SIZE);
    const [detailPin, setDetailPin] = useState<string | null>(null);
    const [detail, setDetail] = useState<PresensiPerson | null>(null);
    const [editing, setEditing] = useState<RecordTarget | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const result = await getPresensi({
                month: month || undefined,
                weekStart: weekStart || undefined,
                shift: shift || undefined,
                search: search || undefined,
            });
            setData(result);
            if (!month && result.month) setMonth(result.month);
            setVisible(PAGE_SIZE);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat presensi.');
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month, weekStart, shift, search]);

    useEffect(() => {
        load();
    }, [load]);

    // Detail satu orang (tampilan bulanan): ambil catatan harian bulan itu.
    const loadDetail = useCallback(async () => {
        if (!detailPin || !month) return;
        try {
            const result = await getPresensi({ month, search: detailPin, detail: true });
            setDetail(result.people.find((p) => p.pin === detailPin) ?? null);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal memuat rincian.');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [detailPin, month]);

    useEffect(() => {
        if (detailPin) loadDetail();
        else setDetail(null);
    }, [detailPin, loadDetail]);

    const afterSave = () => {
        load();
        if (detailPin) loadDetail();
    };

    const people = useMemo(() => data?.people ?? [], [data]);
    const shown = useMemo(() => people.slice(0, visible), [people, visible]);
    const isWeek = Boolean(data?.weekStart);
    const days = data?.days ?? [];

    const openEdit = (person: PresensiPerson, record: PresensiRecord) =>
        canEdit &&
        setEditing({
            id: record.id,
            pin: person.pin,
            name: person.name,
            date: record.date,
            shift: record.shift,
            clockIn: record.clockIn,
            clockOut: record.clockOut,
        });

    const openAdd = (person: PresensiPerson, date: string) =>
        canEdit &&
        setEditing({
            pin: person.pin,
            name: person.name,
            date,
            shift: person.shifts[0] ?? 1,
            clockIn: null,
            clockOut: null,
        });

    return (
        <div className="mx-auto max-w-7xl space-y-5 p-4 pb-16 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-gray-900">
                        <span className="rounded-xl border border-green-200 bg-green-100 p-2 text-green-700">
                            <CalendarCheck className="h-5 w-5" />
                        </span>
                        Presensi
                    </h1>
                    <p className="mt-1.5 text-sm text-gray-600">
                        Jam masuk &amp; pulang finger per bulan. Pilih minggu (Kamis – Rabu) untuk melihat harian.
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={load}
                        disabled={loading}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                    {canEdit ? (
                        <Link
                            href="/presensi/upload"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700"
                        >
                            <Upload className="h-4 w-4" /> Upload Presensi
                        </Link>
                    ) : null}
                </div>
            </div>

            {/* Filter */}
            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-end gap-3">
                    <label className="text-xs font-medium text-gray-500">
                        Bulan
                        <select
                            value={month}
                            onChange={(event) => {
                                setMonth(event.target.value);
                                setWeekStart('');
                            }}
                            className="mt-1 block w-44 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                        >
                            {(data?.months ?? []).map((m) => (
                                <option key={m} value={m}>
                                    {monthLabel(m)}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="text-xs font-medium text-gray-500">
                        Shift
                        <select
                            value={shift}
                            onChange={(event) => setShift(event.target.value)}
                            className="mt-1 block w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                        >
                            <option value="">Semua</option>
                            <option value="1">Shift 1</option>
                            <option value="2">Shift 2</option>
                        </select>
                    </label>
                    <label className="min-w-[12rem] flex-1 text-xs font-medium text-gray-500">
                        Cari nama / PIN
                        <span className="relative mt-1 block">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input
                                type="search"
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                                placeholder="Ketik nama atau PIN..."
                                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-800"
                            />
                        </span>
                    </label>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    <button
                        type="button"
                        onClick={() => setWeekStart('')}
                        className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium ${
                            !weekStart
                                ? 'border-green-600 bg-green-600 text-white'
                                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                        Sebulan penuh
                    </button>
                    {(data?.weeks ?? []).map((week, index) => (
                        <button
                            key={week.start}
                            type="button"
                            onClick={() => setWeekStart(week.start)}
                            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium ${
                                weekStart === week.start
                                    ? 'border-green-600 bg-green-600 text-white'
                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            Minggu {index + 1} • {weekLabel(week)}
                        </button>
                    ))}
                </div>
            </div>

            {data && data.month === null ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
                    <p className="text-sm font-medium text-gray-700">Belum ada data presensi</p>
                    <p className="mt-1 text-xs text-gray-400">
                        {canEdit ? 'Upload file presensi dulu lewat tombol di kanan atas.' : 'Minta manager mengunggah file presensi.'}
                    </p>
                </div>
            ) : null}

            {data && data.month ? (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <Stat label="Orang" value={String(data.totals.people)} hint={`Shift 1: ${data.totals.shift1} • Shift 2: ${data.totals.shift2}`} />
                        <Stat label="Total hadir (orang-hari)" value={data.totals.hadirDays.toLocaleString('id-ID')} />
                        <Stat
                            label="Rata-rata hadir / orang"
                            value={data.totals.people ? (data.totals.hadirDays / data.totals.people).toFixed(1) : '–'}
                            hint="hari"
                        />
                        <Stat
                            label="Periode"
                            value={isWeek && data.range ? weekLabel({ start: data.range.from, end: data.range.to }) : monthLabel(data.month)}
                        />
                    </div>

                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                            <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                <Users className="h-4 w-4 text-green-600" />
                                {people.length} orang
                            </p>
                            {canEdit && isWeek ? (
                                <p className="text-xs text-gray-400">Klik jam untuk mengubah, klik + untuk menambah.</p>
                            ) : null}
                            {!isWeek ? <p className="text-xs text-gray-400">Klik baris untuk rincian harian.</p> : null}
                        </div>

                        <div className="overflow-x-auto">
                            {isWeek ? (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
                                            <th className="sticky left-0 bg-white px-4 py-2">Nama</th>
                                            {days.map((day) => (
                                                <th
                                                    key={day}
                                                    className={`px-3 py-2 text-center ${isSunday(day) ? 'text-red-400' : ''}`}
                                                >
                                                    {dayName(day)} {dayNumber(day)}
                                                </th>
                                            ))}
                                            <th className="px-3 py-2 text-right">Hadir</th>
                                            <th className="px-3 py-2 text-right">Jam kerja</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shown.map((person) => (
                                            <tr key={person.pin} className="border-b border-gray-50 last:border-0 align-top">
                                                <td className="sticky left-0 bg-white px-4 py-2">
                                                    <p className="font-medium text-gray-800">{person.name}</p>
                                                    <p className="text-[11px] text-gray-400">
                                                        {person.pin} • {shiftLabel(person.shifts)}
                                                    </p>
                                                </td>
                                                {days.map((day) => {
                                                    const records = person.records.filter((r) => r.date === day);
                                                    return (
                                                        <td key={day} className="px-2 py-2 text-center">
                                                            <div className="space-y-1">
                                                                {records.map((record) => (
                                                                    <button
                                                                        key={record.id}
                                                                        type="button"
                                                                        disabled={!canEdit}
                                                                        onClick={() => openEdit(person, record)}
                                                                        title={canEdit ? 'Ubah' : undefined}
                                                                        className={`block w-full whitespace-nowrap rounded-md px-1.5 py-1 text-xs tabular-nums ${
                                                                            record.clockIn && record.clockOut
                                                                                ? 'bg-emerald-50 text-emerald-800'
                                                                                : 'bg-amber-50 text-amber-800'
                                                                        } ${canEdit ? 'cursor-pointer hover:ring-1 hover:ring-green-400' : 'cursor-default'} ${
                                                                            record.edited ? 'ring-1 ring-blue-300' : ''
                                                                        }`}
                                                                    >
                                                                        {clockText(record)}
                                                                    </button>
                                                                ))}
                                                                {records.length === 0 ? (
                                                                    canEdit ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openAdd(person, day)}
                                                                            title="Tambah presensi"
                                                                            className="mx-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-gray-300 hover:bg-gray-100 hover:text-green-600"
                                                                        >
                                                                            <Plus className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    ) : (
                                                                        <span className="text-gray-300">–</span>
                                                                    )
                                                                ) : null}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-3 py-2 text-right font-semibold tabular-nums">{person.hadirDays}</td>
                                                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                                                    {formatDuration(person.totalMinutes)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
                                            <th className="px-4 py-2">Nama</th>
                                            <th className="px-4 py-2">PIN</th>
                                            <th className="px-4 py-2">Shift</th>
                                            <th className="px-4 py-2 text-right">Hadir (hari)</th>
                                            <th className="px-4 py-2 text-right">Rata-rata masuk</th>
                                            <th className="px-4 py-2 text-right">Rata-rata pulang</th>
                                            <th className="px-4 py-2 text-right">Total jam kerja</th>
                                            <th className="px-4 py-2 text-right">Tidak lengkap</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {shown.map((person) => (
                                            <tr
                                                key={person.pin}
                                                onClick={() => setDetailPin(person.pin)}
                                                className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50"
                                            >
                                                <td className="px-4 py-2 font-medium text-gray-800">{person.name}</td>
                                                <td className="px-4 py-2 text-gray-500">{person.pin}</td>
                                                <td className="px-4 py-2 text-gray-600">{shiftLabel(person.shifts)}</td>
                                                <td className="px-4 py-2 text-right font-semibold tabular-nums">{person.hadirDays}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{person.avgIn ?? '–'}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{person.avgOut ?? '–'}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">{formatDuration(person.totalMinutes)}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">
                                                    {person.incompleteDays > 0 ? (
                                                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                                            {person.incompleteDays}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300">–</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            {!loading && people.length === 0 ? (
                                <p className="p-8 text-center text-sm text-gray-400">Tidak ada data pada filter ini.</p>
                            ) : null}
                        </div>

                        {people.length > visible ? (
                            <div className="border-t border-gray-100 p-3 text-center">
                                <button
                                    type="button"
                                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                                    className="cursor-pointer rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Tampilkan {Math.min(PAGE_SIZE, people.length - visible)} lagi ({people.length - visible} tersisa)
                                </button>
                            </div>
                        ) : null}
                    </div>
                </>
            ) : null}

            {/* Rincian harian satu orang (tampilan bulanan) */}
            <Dialog open={detailPin !== null} onOpenChange={(open) => (!open ? setDetailPin(null) : undefined)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{detail?.name ?? 'Rincian presensi'}</DialogTitle>
                        <DialogDescription>
                            {detail
                                ? `PIN ${detail.pin} • ${shiftLabel(detail.shifts)} • ${detail.hadirDays} hari hadir • ${formatDuration(detail.totalMinutes)}`
                                : 'Memuat...'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-left text-[11px] font-medium uppercase tracking-wide text-gray-500">
                                    <th className="py-2">Tanggal</th>
                                    <th className="py-2">Shift</th>
                                    <th className="py-2">Masuk – Pulang</th>
                                    <th className="py-2 text-right">Durasi</th>
                                    {canEdit ? <th className="py-2" /> : null}
                                </tr>
                            </thead>
                            <tbody>
                                {(detail?.records ?? []).map((record) => (
                                    <tr key={record.id} className="border-b border-gray-50 last:border-0">
                                        <td className="py-1.5">{longDate(record.date)}</td>
                                        <td className="py-1.5 text-gray-500">{record.shift}</td>
                                        <td className="py-1.5 tabular-nums">
                                            {clockText(record)}
                                            {record.edited ? (
                                                <span className="ml-1.5 rounded bg-blue-50 px-1 text-[10px] text-blue-600">diubah</span>
                                            ) : null}
                                        </td>
                                        <td className="py-1.5 text-right tabular-nums text-gray-600">{formatDuration(record.minutes)}</td>
                                        {canEdit && detail ? (
                                            <td className="py-1.5 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => openEdit(detail, record)}
                                                    className="cursor-pointer rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-green-700"
                                                    aria-label="Ubah"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        ) : null}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {detail && detail.records.length === 0 ? (
                            <p className="py-6 text-center text-sm text-gray-400">
                                <Clock className="mx-auto mb-1 h-5 w-5" />
                                Tidak ada catatan bulan ini.
                            </p>
                        ) : null}
                    </div>
                </DialogContent>
            </Dialog>

            <RecordDialog target={editing} onClose={() => setEditing(null)} onSaved={afterSave} />
        </div>
    );
}

export default function PresensiPage() {
    return (
        <ProtectedRoute>
            <PresensiContent />
        </ProtectedRoute>
    );
}
