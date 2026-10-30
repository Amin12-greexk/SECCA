'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
    KeyRound,
    Loader2,
    LogOut,
    Package,
    TrendingUp,
    Wallet,
} from 'lucide-react';
import LazyEChart from '@/components/charts/LazyEChart';
import { fmtBpsId, fmtId } from '@/components/charts/chart-theme';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    MitraPortalSessionError,
    getMitraPortalData,
    mitraPortalLogin,
    mitraPortalLoginPassword,
    type MitraPortalData,
    type MitraPortalSession,
} from '@/lib/api';
import { CAPACITY_BANDS } from '../performa/components/capacityBand';
import PasswordDialog from './PasswordDialog';
import {
    capacityChartOption,
    fmtRp,
    toHarianWeeks,
    toWeeks,
    type HarianWeek,
    type MitraWeek,
} from './mitraWeeks';

const SESSION_KEY = 'secca-mitra-portal';
/** Sesi mana yang sudah diberi anjuran buat password (sekali per login). */
const NUDGE_KEY = 'secca-mitra-pw-nudge';

function readSession(): MitraPortalSession | null {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const session = JSON.parse(raw) as MitraPortalSession;
        return new Date(session.expiresAt).getTime() > Date.now() ? session : null;
    } catch {
        return null;
    }
}

export default function CekMitraPage() {
    const [session, setSession] = useState<MitraPortalSession | null>(null);
    const [ready, setReady] = useState(false);
    /** Nama mitra yang baru mengganti password -> layar masuk memberi tahu. */
    const [changedFor, setChangedFor] = useState<string | null>(null);

    useEffect(() => {
        // sessionStorage hanya ada di browser -> dibaca setelah mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSession(readSession());
        setReady(true);
    }, []);

    const logout = useCallback(() => {
        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch {}
        setSession(null);
    }, []);

    // Sesi habis -> otomatis keluar (HP bisa tertinggal terbuka).
    useEffect(() => {
        if (!session) return;
        const ms = new Date(session.expiresAt).getTime() - Date.now();
        const timer = setTimeout(logout, Math.max(0, ms));
        return () => clearTimeout(timer);
    }, [session, logout]);

    const login = useCallback((next: MitraPortalSession) => {
        try {
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
        } catch {}
        setChangedFor(null);
        setSession(next);
    }, []);

    // Setelah ganti password: keluar & hapus semua sisa sesi supaya tidak ada
    // token lama yang dipakai ulang (server juga sudah membatalkannya).
    const passwordChanged = useCallback((name: string) => {
        try {
            sessionStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(NUDGE_KEY);
        } catch {}
        setChangedFor(name);
        setSession(null);
    }, []);

    return (
        <div className="min-h-[100dvh] bg-emerald-50/60">
            {!ready ? null : session ? (
                <MitraHome session={session} onLogout={logout} onPasswordChanged={passwordChanged} />
            ) : (
                <LoginForm key={changedFor ?? 'login'} onLogin={login} changedFor={changedFor} />
            )}
        </div>
    );
}

/* ─── Login ───────────────────────────────────────────────────── */

function LoginForm({
    onLogin,
    changedFor,
}: {
    onLogin: (session: MitraPortalSession) => void;
    /** Nama mitra yang baru saja mengganti password: langsung ke mode password. */
    changedFor: string | null;
}) {
    const [mode, setMode] = useState<'pin' | 'password'>(changedFor ? 'password' : 'pin');
    const [name, setName] = useState(changedFor ?? '');
    const [pin, setPin] = useState('');
    const [password, setPassword] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const switchMode = (next: 'pin' | 'password') => {
        setMode(next);
        setError(null);
        setPin('');
        setPassword('');
        setShowSecret(false);
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            onLogin(mode === 'pin' ? await mitraPortalLogin(pin) : await mitraPortalLoginPassword(name, password));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal masuk.');
            setPin('');
            setPassword('');
        } finally {
            setBusy(false);
        }
    };

    const field =
        'h-12 w-full rounded-xl border border-gray-200 px-3.5 text-base outline-none transition focus:border-[#059833] focus:ring-2 focus:ring-[#059833]/20';
    const toggle = (
        <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            aria-label={showSecret ? 'Sembunyikan' : 'Tampilkan'}
            className="absolute right-1.5 top-1.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 hover:text-gray-700"
        >
            {showSecret ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
    );

    return (
        <div className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center px-5 py-10">
            <Link href="/" className="mb-6 inline-flex items-center gap-1 self-start text-sm text-gray-500 hover:text-gray-800">
                <ArrowLeft className="h-4 w-4" /> Beranda
            </Link>
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-gray-100">
                    <Image src="/Assets/Logo-secca.png" alt="SECCA" width={40} height={40} className="h-full w-full object-contain" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Cek Performa &amp; Gaji</h1>
                    <p className="text-sm text-gray-500">Khusus mitra SECCA</p>
                </div>
            </div>

            {changedFor ? (
                <p role="status" className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">
                    <b>Password berhasil disimpan.</b> Silakan masuk lagi dengan nama lengkap dan password baru Anda.
                </p>
            ) : null}

            <form onSubmit={submit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                {mode === 'pin' ? (
                    <div>
                        <label htmlFor="mitra-pin" className="mb-1.5 block text-sm font-medium text-gray-700">
                            PIN
                        </label>
                        <p className="mb-2 text-xs text-gray-400">Masukkan PIN dari perusahaan.</p>
                        <div className="relative">
                            <input
                                id="mitra-pin"
                                value={pin}
                                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                type={showSecret ? 'text' : 'password'}
                                inputMode="numeric"
                                autoComplete="off"
                                required
                                autoFocus
                                minLength={3}
                                className={`${field} pr-12 text-lg tracking-[0.3em]`}
                                placeholder="••••"
                            />
                            {toggle}
                        </div>
                    </div>
                ) : (
                    <>
                        <div>
                            <label htmlFor="mitra-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                                Nama lengkap
                            </label>
                            <input
                                id="mitra-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoComplete="username"
                                autoCapitalize="characters"
                                required
                                autoFocus={!changedFor}
                                className={`${field} uppercase`}
                                placeholder="SESUAI DATA PERUSAHAAN"
                            />
                        </div>
                        <div>
                            <label htmlFor="mitra-password" className="mb-1.5 block text-sm font-medium text-gray-700">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="mitra-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    type={showSecret ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    autoFocus={Boolean(changedFor)}
                                    maxLength={72}
                                    className={`${field} pr-12`}
                                />
                                {toggle}
                            </div>
                        </div>
                    </>
                )}

                {error ? (
                    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </p>
                ) : null}

                <button
                    type="submit"
                    disabled={busy}
                    className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#059833] font-semibold text-white shadow-sm transition hover:bg-[#047f2b] active:scale-[0.98] disabled:opacity-60"
                >
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                    Masuk
                </button>
            </form>

            <button
                type="button"
                onClick={() => switchMode(mode === 'pin' ? 'password' : 'pin')}
                className="mt-4 cursor-pointer text-center text-sm font-medium text-[#059833] hover:underline"
            >
                {mode === 'pin' ? 'Sudah punya password? Masuk dengan password' : 'Belum punya password? Masuk dengan PIN'}
            </button>
            <p className="mt-2 text-center text-xs text-gray-400">
                {mode === 'pin' ? 'Lupa PIN? Tanyakan ke admin.' : 'Lupa password? Minta admin mereset.'}
            </p>
        </div>
    );
}

/* ─── Halaman mitra ───────────────────────────────────────────── */

function MitraHome({
    session,
    onLogout,
    onPasswordChanged,
}: {
    session: MitraPortalSession;
    onLogout: () => void;
    onPasswordChanged: (name: string) => void;
}) {
    const [data, setData] = useState<MitraPortalData | null>(null);
    // Belum punya password -> dialog anjuran terbuka sekali per login.
    const [passwordOpen, setPasswordOpen] = useState(() => {
        if (session.hasPassword) return false;
        try {
            return sessionStorage.getItem(NUDGE_KEY) !== session.expiresAt;
        } catch {
            return true;
        }
    });
    const hasPassword = data?.hasPassword ?? session.hasPassword;
    const [error, setError] = useState<string | null>(null);
    const [index, setIndex] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        getMitraPortalData(session.token)
            .then((result) => {
                if (!cancelled) setData(result);
            })
            .catch((err) => {
                if (cancelled) return;
                if (err instanceof MitraPortalSessionError) onLogout();
                else setError(err instanceof Error ? err.message : 'Gagal memuat data.');
            });
        return () => {
            cancelled = true;
        };
    }, [session.token, onLogout]);

    useEffect(() => {
        if (!passwordOpen || session.hasPassword) return;
        try {
            sessionStorage.setItem(NUDGE_KEY, session.expiresAt);
        } catch {}
    }, [passwordOpen, session.hasPassword, session.expiresAt]);

    const weeks = useMemo(() => (data ? toWeeks(data.periods) : []), [data]);
    const harianWeeks = useMemo(() => (data ? toHarianWeeks(data.harian ?? []) : []), [data]);
    const current = index ?? weeks.length - 1;
    const week = weeks[current] ?? null;
    // Anak harian (Cleaning Service, QC, dst) tidak punya data performa:
    // tampilannya hanya riwayat gaji.
    const isHarian = weeks.length === 0 && harianWeeks.length > 0;

    return (
        <div className="mx-auto max-w-lg px-4 pb-10 pt-4">
            <header className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#059833] text-base font-bold text-white">
                    {session.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900">{session.name}</p>
                    <p className="truncate text-xs text-gray-500">
                        {isHarian ? (harianWeeks.at(-1)?.bagian ?? 'Anak harian') : (week?.level ?? 'Mitra')}
                    </p>
                </div>
                <button
                    onClick={() => setPasswordOpen(true)}
                    aria-label={hasPassword ? 'Ganti password' : 'Buat password'}
                    className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-600 ring-1 ring-gray-200 hover:bg-white"
                >
                    <KeyRound className="h-4 w-4" />
                </button>
                <button
                    onClick={onLogout}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm text-gray-600 ring-1 ring-gray-200 hover:bg-white"
                >
                    <LogOut className="h-4 w-4" /> Keluar
                </button>
            </header>

            {!hasPassword ? (
                <button
                    onClick={() => setPasswordOpen(true)}
                    className="mb-4 flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-amber-50 p-3.5 text-left ring-1 ring-amber-200 hover:bg-amber-100/70"
                >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                        <KeyRound className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-amber-900">Ganti PIN dengan password Anda</span>
                        <span className="block text-xs text-amber-800/80">
                            PIN dipakai bersama banyak orang. Buat password sendiri supaya akun aman.
                        </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-amber-700" />
                </button>
            ) : null}

            <PasswordDialog
                session={session}
                hasPassword={hasPassword}
                open={passwordOpen}
                onOpenChange={setPasswordOpen}
                onChanged={onPasswordChanged}
                onSessionEnded={onLogout}
            />

            {error ? (
                <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>
            ) : !data ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-[#059833]" />
                </div>
            ) : isHarian ? (
                <HarianView weeks={harianWeeks} />
            ) : weeks.length === 0 ? (
                <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-100">
                    <p className="font-medium text-gray-800">Data performa belum ada.</p>
                    <p className="mt-1 text-sm text-gray-500">
                        Nama Anda belum ditemukan di rekap mingguan. Hubungi admin.
                    </p>
                </div>
            ) : (
                <>
                    <WeekPicker weeks={weeks} current={current} onChange={setIndex} />
                    {week ? <WeekSummary week={week} /> : null}

                    <Tabs defaultValue="performa" className="mt-4">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="performa">
                                <TrendingUp className="h-4 w-4" /> Performa
                            </TabsTrigger>
                            <TabsTrigger value="gaji">
                                <Wallet className="h-4 w-4" /> Gaji
                            </TabsTrigger>
                            <TabsTrigger value="bjd">
                                <Package className="h-4 w-4" /> Barang Jadi
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="performa" className="mt-3">
                            <PerformaTab weeks={weeks} />
                        </TabsContent>
                        <TabsContent value="gaji" className="mt-3">
                            <GajiTab weeks={weeks} current={current} onSelect={setIndex} />
                        </TabsContent>
                        <TabsContent value="bjd" className="mt-3">
                            <BjdTab weeks={weeks} current={current} onSelect={setIndex} />
                        </TabsContent>
                    </Tabs>
                </>
            )}

            <p className="mt-8 text-center text-xs text-gray-400">
                Data dari rekap mingguan perusahaan. Ada yang salah? Hubungi admin.
            </p>
        </div>
    );
}

function WeekPicker({
    weeks,
    current,
    onChange,
}: {
    weeks: Array<{ key: string; label: string }>;
    current: number;
    onChange: (index: number) => void;
}) {
    const arrow =
        'flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 disabled:cursor-default disabled:opacity-30';
    return (
        <div className="mb-3 flex items-center gap-2">
            <button className={arrow} onClick={() => onChange(current - 1)} disabled={current <= 0} aria-label="Minggu sebelumnya">
                <ChevronLeft className="h-5 w-5" />
            </button>
            <select
                value={current}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-label="Pilih minggu"
                className="h-10 min-w-0 flex-1 cursor-pointer rounded-xl bg-white px-3 text-center text-sm font-medium text-gray-800 ring-1 ring-gray-200 outline-none focus:ring-2 focus:ring-[#059833]"
            >
                {weeks.map((w, i) => (
                    <option key={w.key} value={i}>
                        {w.label}
                        {i === weeks.length - 1 ? ' (terbaru)' : ''}
                    </option>
                ))}
            </select>
            <button
                className={arrow}
                onClick={() => onChange(current + 1)}
                disabled={current >= weeks.length - 1}
                aria-label="Minggu berikutnya"
            >
                <ChevronRight className="h-5 w-5" />
            </button>
        </div>
    );
}

function WeekSummary({ week }: { week: MitraWeek }) {
    const gap = week.capacity != null && week.target != null ? week.capacity - week.target : null;
    return (
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="bg-gradient-to-br from-emerald-600 to-green-700 px-5 py-4 text-white">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-100">Total gaji minggu ini</p>
                <p className="mt-0.5 text-3xl font-extrabold tracking-tight">{fmtRp(week.pay.total)}</p>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-100">
                <Stat label="Kapasitas">
                    {week.isBulanan ? (
                        <span className="text-purple-700">Bulanan</span>
                    ) : week.capacity == null ? (
                        '–'
                    ) : (
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: week.band?.color }} />
                            {fmtId(week.capacity, 1)}
                        </span>
                    )}
                    <span className="block text-[11px] font-normal text-gray-400">g / HK</span>
                </Stat>
                <Stat label="Barang jadi">
                    {week.bjd == null ? '–' : fmtId(week.bjd, 1)}
                    <span className="block text-[11px] font-normal text-gray-400">gram</span>
                </Stat>
                <Stat label="Hari kerja">
                    {week.hk == null ? '–' : fmtId(week.hk, 0)}
                    <span className="block text-[11px] font-normal text-gray-400">hari</span>
                </Stat>
            </div>
            {gap != null ? (
                <p
                    className={`border-t border-gray-100 px-5 py-2.5 text-sm ${gap >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}
                >
                    Target {fmtId(week.target ?? 0, 0)} g/HK ·{' '}
                    <b>{gap >= 0 ? 'Tercapai ✓' : `Kurang ${fmtId(-gap, 1)} g/HK`}</b>
                </p>
            ) : null}
        </section>
    );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="px-3 py-3 text-center">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900">{children}</p>
        </div>
    );
}

/* ─── Tab: Performa ───────────────────────────────────────────── */

function PerformaTab({ weeks }: { weeks: MitraWeek[] }) {
    const option = useMemo(() => capacityChartOption(weeks), [weeks]);
    const hasCapacity = weeks.some((w) => w.capacity != null);
    return (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
            {hasCapacity ? (
                <>
                    <LazyEChart option={option} height={240} />
                    <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                        {CAPACITY_BANDS.filter((b) => b.key !== 'purple').map((band) => (
                            <span key={band.key} className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: band.color }} />
                                {band.label}
                            </span>
                        ))}
                    </div>
                </>
            ) : (
                <p className="py-8 text-center text-sm text-gray-500">Belum ada data kapasitas.</p>
            )}
        </section>
    );
}

/* ─── Tab: Gaji (riwayat pembayaran) ──────────────────────────── */

function GajiTab({
    weeks,
    current,
    onSelect,
}: {
    weeks: MitraWeek[];
    current: number;
    onSelect: (index: number) => void;
}) {
    const total = weeks.reduce((sum, w) => sum + (w.pay.total ?? 0), 0);
    return (
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="flex items-baseline justify-between border-b border-gray-100 px-4 py-3">
                <span className="text-sm text-gray-500">{weeks.length} minggu</span>
                <span className="text-sm text-gray-500">
                    Total <b className="text-gray-900">{fmtRp(total)}</b>
                </span>
            </div>
            <HistoryList
                weeks={weeks}
                current={current}
                onSelect={onSelect}
                right={(w) => <b className="text-gray-900">{fmtRp(w.pay.total)}</b>}
                sub={(w) => (w.hk == null ? '' : `${fmtId(w.hk, 0)} hari kerja`)}
                detail={(w) => <PayDetail week={w} />}
            />
        </section>
    );
}

function PayDetail({ week }: { week: MitraWeek }) {
    const { pay } = week;
    const lines: Array<[string, number | null, string?]> = pay.cabutRumah
        ? [[`Cabut rumah (${fmtRp(pay.cabutRumah.rate)} × ${pay.cabutRumah.qty ?? '–'})`, pay.total]]
        : [
              [week.isBulanan ? 'Gaji bulanan' : 'Upah borong', pay.borong],
              ['Subsidi', pay.subsidi],
              ['Premi / bonus', pay.premi],
              ['Uang makan', pay.makan],
              ['Potongan', pay.potongan, 'text-rose-600'],
          ];
    return (
        <dl className="space-y-1.5 text-sm">
            {lines
                .filter(([, value]) => value != null && value !== 0)
                .map(([label, value, cls]) => (
                    <div key={label} className="flex justify-between">
                        <dt className="text-gray-500">{label}</dt>
                        <dd className={cls ?? 'text-gray-800'}>{fmtRp(value)}</dd>
                    </div>
                ))}
            <div className="flex justify-between border-t border-gray-100 pt-1.5 font-semibold">
                <dt>Total</dt>
                <dd className="text-emerald-700">{fmtRp(pay.total)}</dd>
            </div>
        </dl>
    );
}

/* ─── Tab: Barang Jadi ────────────────────────────────────────── */

function BjdTab({
    weeks,
    current,
    onSelect,
}: {
    weeks: MitraWeek[];
    current: number;
    onSelect: (index: number) => void;
}) {
    const total = weeks.reduce((sum, w) => sum + (w.bjd ?? 0), 0);
    return (
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <div className="flex items-baseline justify-between border-b border-gray-100 px-4 py-3">
                <span className="text-sm text-gray-500">{weeks.length} minggu</span>
                <span className="text-sm text-gray-500">
                    Total <b className="text-gray-900">{fmtId(total, 1)} g</b>
                </span>
            </div>
            <HistoryList
                weeks={weeks}
                current={current}
                onSelect={onSelect}
                right={(w) => (
                    <span className="text-right">
                        <b className="text-gray-900">{w.bjd == null ? '–' : `${fmtId(w.bjd, 1)} g`}</b>
                        {w.capacity != null ? (
                            <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-gray-500">
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: w.band?.color }} />
                                {fmtId(w.capacity, 1)}/HK
                            </span>
                        ) : null}
                    </span>
                )}
                sub={(w) => (w.lpRows.length ? `${new Set(w.lpRows.map((lp) => lp.lpNumber)).size} LP` : '')}
                detail={(w) => <BjdDetail week={w} />}
            />
        </section>
    );
}

function BjdDetail({ week }: { week: MitraWeek }) {
    return (
        <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
                <Mini label="Baku basah" value={week.bakuBasah == null ? '–' : `${fmtId(week.bakuBasah, 1)} g`} />
                <Mini label="Rendemen" value={fmtBpsId(week.rendemenPctBps)} />
                <Mini
                    label="Reprocess"
                    value={week.reprocessBjd ? `${fmtId(week.reprocessBjd, 1)} g` : '–'}
                />
            </div>
            {week.lpRows.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="text-gray-400">
                            <tr className="border-b border-gray-100">
                                <th className="py-1.5 text-left font-medium">No. LP</th>
                                <th className="py-1.5 text-right font-medium">Baku (g)</th>
                                <th className="py-1.5 text-right font-medium">BJD (g)</th>
                                <th className="py-1.5 text-right font-medium">Rend.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {week.lpRows.map((lp, i) => (
                                <tr key={`${lp.lpNumber}-${i}`} className="border-b border-gray-50 last:border-0">
                                    <td className="py-1.5 text-gray-700">
                                        {lp.lpNumber ?? '–'}
                                        {lp.workerNames.length > 1 ? (
                                            <span className="ml-1 text-[10px] text-gray-400">(bersama)</span>
                                        ) : null}
                                    </td>
                                    <td className="py-1.5 text-right">{lp.totalBakuBasah == null ? '–' : fmtId(lp.totalBakuBasah, 1)}</td>
                                    <td className="py-1.5 text-right font-medium">{lp.totalBjd == null ? '–' : fmtId(lp.totalBjd, 1)}</td>
                                    <td className="py-1.5 text-right">{fmtBpsId(lp.rendemenPctBps)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </div>
    );
}

function Mini({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg bg-gray-50 px-2 py-2">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
            <p className="font-semibold text-gray-800">{value}</p>
        </div>
    );
}

/* ─── Anak harian: hanya riwayat gaji ─────────────────────────── */

function HarianView({ weeks }: { weeks: HarianWeek[] }) {
    const [index, setIndex] = useState<number | null>(null);
    const current = index ?? weeks.length - 1;
    const week = weeks[current];
    const total = weeks.reduce((sum, w) => sum + (w.total ?? 0), 0);

    return (
        <>
            <WeekPicker weeks={weeks} current={current} onChange={setIndex} />
            <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                <div className="bg-gradient-to-br from-emerald-600 to-green-700 px-5 py-4 text-white">
                    <p className="text-xs font-medium uppercase tracking-wider text-emerald-100">Total gaji minggu ini</p>
                    <p className="mt-0.5 text-3xl font-extrabold tracking-tight">{fmtRp(week.total)}</p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-100">
                    <Stat label="Hari kerja">
                        {week.hariKerja == null ? (week.hariKerjaRaw ?? '–') : fmtId(week.hariKerja, 0)}
                        <span className="block text-[11px] font-normal text-gray-400">hari</span>
                    </Stat>
                    <Stat label="Bagian">
                        <span className="text-base">{week.bagian ?? '–'}</span>
                    </Stat>
                </div>
            </section>

            <section className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                <div className="flex items-baseline justify-between border-b border-gray-100 px-4 py-3">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        <Wallet className="h-4 w-4 text-[#059833]" /> Riwayat gaji
                    </span>
                    <span className="text-sm text-gray-500">
                        {weeks.length} minggu · <b className="text-gray-900">{fmtRp(total)}</b>
                    </span>
                </div>
                <HistoryList
                    weeks={weeks}
                    current={current}
                    onSelect={setIndex}
                    right={(w) => <b className="text-gray-900">{fmtRp(w.total)}</b>}
                    sub={(w) => (w.hariKerja == null ? '' : `${fmtId(w.hariKerja, 0)} hari kerja`)}
                    detail={(w) => <HarianPayDetail week={w} />}
                />
            </section>
        </>
    );
}

function HarianPayDetail({ week }: { week: HarianWeek }) {
    return (
        <dl className="space-y-1.5 text-sm">
            {week.pay
                .filter(([, value]) => value != null && value !== 0)
                .map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                        <dt className="text-gray-500">{label}</dt>
                        <dd className="text-gray-800">{fmtRp(value)}</dd>
                    </div>
                ))}
            {week.potongan ? (
                <div className="flex justify-between">
                    <dt className="text-gray-500">Potongan</dt>
                    <dd className="text-rose-600">−{fmtRp(week.potongan)}</dd>
                </div>
            ) : null}
            <div className="flex justify-between border-t border-gray-100 pt-1.5 font-semibold">
                <dt>Total</dt>
                <dd className="text-emerald-700">{fmtRp(week.total)}</dd>
            </div>
        </dl>
    );
}

/* ─── Daftar riwayat per minggu (bisa dibuka) ─────────────────── */

function HistoryList<W extends { key: string; label: string }>({
    weeks,
    current,
    onSelect,
    right,
    sub,
    detail,
}: {
    weeks: W[];
    current: number;
    onSelect: (index: number) => void;
    right: (week: W) => React.ReactNode;
    sub: (week: W) => string;
    detail: (week: W) => React.ReactNode;
}) {
    const [open, setOpen] = useState<string | null>(null);
    // Terbaru di atas.
    const ordered = weeks.map((w, i) => ({ w, i })).reverse();
    return (
        <ul className="divide-y divide-gray-100">
            {ordered.map(({ w, i }) => {
                const isOpen = open === w.key;
                return (
                    <li key={w.key} className={i === current ? 'bg-emerald-50/50' : undefined}>
                        <button
                            onClick={() => {
                                setOpen(isOpen ? null : w.key);
                                onSelect(i);
                            }}
                            aria-expanded={isOpen}
                            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                        >
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-gray-800">{w.label}</span>
                                <span className="block text-xs text-gray-400">{sub(w)}</span>
                            </span>
                            <span className="shrink-0 text-sm">{right(w)}</span>
                            <ChevronDown
                                className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                            />
                        </button>
                        {isOpen ? <div className="px-4 pb-4">{detail(w)}</div> : null}
                    </li>
                );
            })}
        </ul>
    );
}
