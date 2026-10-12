'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, Download, ExternalLink, Info, LineChart, Loader2, Search } from 'lucide-react';
import type { PerformaPeriod, PerformaRow } from '@/lib/api';
import LazyEChart from '@/components/charts/LazyEChart';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    BLUE_THRESHOLD,
    GREEN_THRESHOLD,
    TARGET_GREEN_WEEK,
    TARGET_YELLOW_WEEK,
    YELLOW_THRESHOLD,
    computeBandProgression,
    targetVsActual,
    type NextBand,
    type PersonProgression,
    type ProgressBand,
    type TransitionStats,
} from './bandProgression';
import { targetVsActualOption } from './bandProgressionChart';
import { downloadBandProgressionExcel } from './bandProgressionExport';
import { fetchPeriodSummary, type SummaryScope } from './summaryCache';

/** Warna sama persis dengan band kapasitas (capacityBand.ts). */
const COLOR: Record<ProgressBand, string> = {
    red: '#e34948',
    yellow: '#eda100',
    green: '#1baf7a',
    blue: '#2a78d6',
};
const BAND_LABEL: Record<ProgressBand, string> = { red: 'Merah', yellow: 'Kuning', green: 'Hijau', blue: 'Biru' };
/** Kelompok = warna yang sudah dicapai secara stabil, bukan warna minggu ini. */
const GROUP_LABEL: Record<ProgressBand, string> = {
    red: 'Belum kuning',
    yellow: 'Kuning',
    green: 'Hijau',
    blue: 'Biru',
};
const BANDS: ProgressBand[] = ['red', 'yellow', 'green', 'blue'];

const fmt1 = (value: number | null) =>
    value === null ? '–' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value);

type Filter = ProgressBand | 'all';
type View = 'bar' | 'chart';

/* ─── Kartu ringkas per perpindahan warna ─────────────────────── */

function TransitionCard({
    from,
    to,
    stats,
    targetWeeks,
}: {
    from: ProgressBand;
    to: ProgressBand;
    stats: TransitionStats;
    targetWeeks?: number;
}) {
    const pct =
        stats.withinTarget !== null && stats.count > 0 ? Math.round((stats.withinTarget / stats.count) * 100) : null;
    return (
        <Card className="overflow-hidden">
            <div className="h-1" style={{ background: `linear-gradient(90deg, ${COLOR[from]}, ${COLOR[to]})` }} />
            <div className="px-4 py-3">
                <p className="flex items-center gap-1 text-xs font-medium text-gray-600">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR[from] }} />
                    {BAND_LABEL[from]}
                    <ArrowRight className="h-3 w-3 text-gray-400" aria-hidden />
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR[to] }} />
                    {BAND_LABEL[to]}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                    {fmt1(stats.average)}
                    <span className="ml-1 text-xs font-medium text-gray-500">mgg</span>
                </p>
                <p className="text-[11px] text-gray-500">
                    {stats.count} anak
                    {pct !== null && targetWeeks ? (
                        <>
                            {' · '}
                            <span className="font-semibold text-gray-700">{pct}%</span> ≤{targetWeeks} mgg
                        </>
                    ) : null}
                </p>
            </div>
        </Card>
    );
}

/* ─── Baris batang per anak ───────────────────────────────────── */

function ForecastChip({ person }: { person: PersonProgression }) {
    const f = person.forecast;
    if (!f) return null;
    const text = f.pending ? '1 mgg lagi' : f.weeksLeft === null ? 'tren datar' : `±${f.weeksLeft} mgg`;
    return (
        <span
            className="inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-medium"
            style={{ color: f.weeksLeft === null ? '#9ca3af' : COLOR[f.toward] }}
            title={`Perkiraan tembus ${BAND_LABEL[f.toward].toLowerCase()}`}
        >
            <ArrowRight className="h-3 w-3" aria-hidden />
            {text}
        </span>
    );
}

function JourneyRow({
    person,
    scale,
    onPick,
}: {
    person: PersonProgression;
    scale: number;
    onPick: (personId: string) => void;
}) {
    const pos = (week: number) => `${(Math.min(Math.max(week, 0), scale) / scale) * 100}%`;
    const width = (from: number, to: number) =>
        `${(Math.max(0, Math.min(to, scale) - Math.min(from, scale)) / scale) * 100}%`;

    const now = person.currentWeek;
    const reached = person.reachedAtWeek;
    // Ujung tiap segmen = minggu warna berikutnya tercapai, atau sekarang.
    const segments = BANDS.map((band, i) => {
        const start = band === 'red' ? 0 : reached[band as NextBand];
        if (start === null) return null;
        const nextStart = BANDS.slice(i + 1)
            .map((b) => reached[b as NextBand])
            .find((w) => w !== null);
        return { band, start, end: nextStart ?? Math.max(now, start + 1) };
    }).filter((s): s is { band: ProgressBand; start: number; end: number } => s !== null);

    const f = person.forecast;
    const forecastEnd = f && f.weeksLeft !== null ? now + f.weeksLeft : null;

    return (
        <button
            type="button"
            onClick={() => onPick(person.personId)}
            disabled={!person.startKnown}
            className="group grid w-full cursor-pointer grid-cols-[minmax(0,7rem)_1fr_4.5rem] items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059833] disabled:cursor-default disabled:hover:bg-transparent sm:grid-cols-[minmax(0,10rem)_1fr_5rem] sm:gap-3"
            aria-label={`${person.name}: ${GROUP_LABEL[person.currentBand]}, minggu kerja ${now}. Lihat grafik target.`}
        >
            <span className="flex min-w-0 items-center gap-1.5">
                <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: COLOR[person.currentBand] }}
                    aria-hidden
                />
                <span className="truncate text-xs font-medium text-gray-800 group-hover:text-gray-950 sm:text-sm">
                    {person.name}
                </span>
            </span>

            {!person.startKnown ? (
                // Sudah Mandiri sejak sebelum data mulai direkam: minggu kerjanya
                // tidak diketahui, jadi tidak bisa ditaruh di sumbu minggu.
                <span className="flex h-4 items-center rounded bg-gray-50 px-2 text-[10px] text-gray-400">
                    minggu mulai tidak tercatat
                </span>
            ) : (
                <span className="relative block h-4" aria-hidden>
                    <span className="absolute inset-0 rounded bg-gray-50" />
                    {segments.map((s, i) => (
                        <span
                            key={s.band}
                            className={`absolute inset-y-0 ${i === 0 ? 'rounded-l' : ''} ${i === segments.length - 1 ? 'rounded-r' : ''}`}
                            style={{ left: pos(s.start), width: width(s.start, s.end), backgroundColor: COLOR[s.band] }}
                        />
                    ))}
                    {f && forecastEnd !== null ? (
                        <span
                            className="absolute inset-y-0 rounded-r opacity-70"
                            style={{
                                left: pos(now),
                                width: width(now, forecastEnd),
                                backgroundImage: `repeating-linear-gradient(135deg, ${COLOR[f.toward]} 0 3px, transparent 3px 6px)`,
                                boxShadow: `inset 0 0 0 1px ${COLOR[f.toward]}`,
                            }}
                        />
                    ) : null}
                    {[TARGET_YELLOW_WEEK, TARGET_GREEN_WEEK].map((week) =>
                        week <= scale ? (
                            <span
                                key={week}
                                className="absolute -inset-y-1 border-l border-dashed border-gray-400"
                                style={{ left: pos(week) }}
                            />
                        ) : null,
                    )}
                </span>
            )}

            <span className="flex justify-end">
                <ForecastChip person={person} />
            </span>
        </button>
    );
}

/** Legenda batang: satu baris, simbol persis seperti yang digambar di batang. */
function BarLegend() {
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-600">
            <span className="flex items-center gap-2">
                {BANDS.map((band) => (
                    <span key={band} className="flex items-center gap-1">
                        <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: COLOR[band] }} />
                        {BAND_LABEL[band]}
                    </span>
                ))}
            </span>
            <span className="flex items-center gap-1">
                <span
                    className="h-2.5 w-4 rounded-sm"
                    style={{
                        backgroundImage: 'repeating-linear-gradient(135deg, #6b7280 0 2px, transparent 2px 4px)',
                        boxShadow: 'inset 0 0 0 1px #6b7280',
                    }}
                />
                Perkiraan
            </span>
            <span className="flex items-center gap-1">
                <span className="h-3 border-l border-dashed border-gray-500" />
                Target mgg {TARGET_YELLOW_WEEK} &amp; {TARGET_GREEN_WEEK}
            </span>
            <span className="text-gray-400">Sumbu = minggu kerja</span>
        </div>
    );
}

function HowItWorks({ hidden }: { hidden: number }) {
    return (
        <Popover>
            <PopoverTrigger
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059833]"
                aria-label="Cara hitung"
            >
                <Info className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3 text-xs text-gray-600">
                <ul className="list-disc space-y-1 pl-4">
                    <li>
                        Kapasitas = BJD ÷ HK. Kuning ≥{YELLOW_THRESHOLD}, hijau ≥{GREEN_THRESHOLD}, biru ≥
                        {BLUE_THRESHOLD} g/HK.
                    </li>
                    <li>
                        Tembus = <b>2 minggu berturut-turut</b> di atas ambang.
                    </li>
                    <li>Minggu kerja dari level &quot;Mitra Perintis N&quot;.</li>
                    <li>Perkiraan: tren 6 minggu terakhir, atau nilai tengah semua anak kalau trennya datar.</li>
                    <li>Target grafik: mgg 1–12 = 25, mgg 13–20 = 35, Mandiri = 45 g/HK.</li>
                    {hidden > 0 ? <li>{hidden} anak tanpa batang: minggu mulai kerjanya tidak tercatat.</li> : null}
                </ul>
            </PopoverContent>
        </Popover>
    );
}

/* ─── Panel ───────────────────────────────────────────────────── */

export default function BandProgressionPanel({
    periods,
    summaryScope,
    onSelect,
}: {
    periods: PerformaPeriod[];
    summaryScope: SummaryScope;
    onSelect?: (personId: string) => void;
}) {
    const [rowsByPeriod, setRowsByPeriod] = useState<Record<string, PerformaRow[]> | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<View>('bar');
    const [filter, setFilter] = useState<Filter>('red');
    const [search, setSearch] = useState('');
    const [chartPersonId, setChartPersonId] = useState('');
    const [exporting, setExporting] = useState(false);

    /** Hitungannya butuh SEMUA periode. Lewat cache bersama, jadi periode yang
     * sudah dibuka di slider tidak diminta ulang. */
    useEffect(() => {
        if (periods.length === 0) return;
        let alive = true;
        Promise.all(
            periods.map((p) => fetchPeriodSummary(p.id, summaryScope).then((data) => [p.id, data.rows] as const)),
        )
            .then((entries) => {
                if (!alive) return;
                setError(null);
                setRowsByPeriod(Object.fromEntries(entries));
            })
            .catch((err) => {
                if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat data periode.');
            });
        return () => {
            alive = false;
        };
    }, [periods, summaryScope]);

    const result = useMemo(
        () => (rowsByPeriod ? computeBandProgression(periods, rowsByPeriod) : null),
        [periods, rowsByPeriod],
    );

    const groups = useMemo(() => {
        const persons = result?.persons ?? [];
        const activeIn = (band: ProgressBand) => persons.filter((p) => p.active && p.currentBand === band);
        return {
            red: activeIn('red'),
            yellow: activeIn('yellow'),
            green: activeIn('green'),
            blue: activeIn('blue'),
            all: persons,
            hidden: persons.filter((p) => !p.startKnown).length,
        };
    }, [result]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = groups[filter].filter((p) => !q || p.name.toLowerCase().includes(q));
        // Yang paling cepat diperkirakan naik di atas; anak tanpa minggu kerja
        // (tanpa batang) selalu di paling bawah.
        const soon = (p: PersonProgression) => p.forecast?.weeksLeft ?? Number.POSITIVE_INFINITY;
        return [...list].sort(
            (a, b) =>
                Number(b.startKnown) - Number(a.startKnown) ||
                soon(a) - soon(b) ||
                a.currentWeek - b.currentWeek,
        );
    }, [groups, filter, search]);

    const scale = useMemo(() => {
        const ends = visible
            .filter((p) => p.startKnown)
            .map((p) => p.currentWeek + (p.forecast?.weeksLeft ?? 0));
        return Math.min(52, Math.max(TARGET_GREEN_WEEK + 4, ...ends));
    }, [visible]);

    const chartData = useMemo(() => (result ? targetVsActual(result.persons) : null), [result]);
    const chartable = useMemo(
        () =>
            (result?.persons ?? [])
                .filter((p) => p.startKnown)
                .sort((a, b) => a.name.localeCompare(b.name)),
        [result],
    );
    const chartPerson = chartable.find((p) => p.personId === chartPersonId) ?? null;
    const chartOption = useMemo(
        () => (chartData ? targetVsActualOption(chartData, chartPerson) : null),
        [chartData, chartPerson],
    );

    if (error) {
        return <Card className="p-4 text-sm text-red-700">{error}</Card>;
    }

    if (!result) {
        return (
            <Card className="flex h-[320px] items-center justify-center gap-2 text-sm text-gray-400">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-green-600" />
                Menghitung...
            </Card>
        );
    }

    const handleExport = async () => {
        if (!chartData) return;
        setExporting(true);
        try {
            const latest = [...periods].sort((a, b) => b.sortOrder - a.sortOrder)[0];
            await downloadBandProgressionExcel(result, chartData, latest?.label ?? 'semua periode');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Gagal membuat file Excel.');
        } finally {
            setExporting(false);
        }
    };

    const ticks = Array.from({ length: Math.floor(scale / 4) + 1 }, (_, i) => i * 4);
    // Klik batang anak = langsung lihat grafiknya terhadap target, tanpa pindah tab.
    const pickPerson = (personId: string) => {
        setChartPersonId(personId);
        setView('chart');
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <TransitionCard from="red" to="yellow" stats={result.redToYellow} targetWeeks={TARGET_YELLOW_WEEK} />
                <TransitionCard
                    from="yellow"
                    to="green"
                    stats={result.yellowToGreen}
                    targetWeeks={TARGET_GREEN_WEEK - TARGET_YELLOW_WEEK}
                />
                <TransitionCard from="green" to="blue" stats={result.greenToBlue} />
            </div>

            <Card className="p-3 sm:p-4">
                {/* Toolbar: ganti tampilan + cari/pilih anak + info, satu baris. */}
                <div className="flex flex-wrap items-center gap-2">
                    <Tabs value={view} onValueChange={(v) => setView(v as View)}>
                        <TabsList className="h-10">
                            <TabsTrigger value="bar" className="h-8 px-2.5 text-xs">
                                <BarChart3 className="h-3.5 w-3.5" aria-hidden />
                                Batang
                            </TabsTrigger>
                            <TabsTrigger value="chart" className="h-8 px-2.5 text-xs">
                                <LineChart className="h-3.5 w-3.5" aria-hidden />
                                Target vs Realita
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="ml-auto flex items-center gap-1">
                        {view === 'bar' ? (
                            <label className="relative block w-40 sm:w-52">
                                <span className="sr-only">Cari nama anak</span>
                                <Search
                                    className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                                    aria-hidden
                                />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Cari nama..."
                                    className="h-9 w-full rounded-md border border-gray-200 bg-white pr-2 pl-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059833]"
                                />
                            </label>
                        ) : (
                            <>
                                <label className="sr-only" htmlFor="band-chart-person">
                                    Pilih anak
                                </label>
                                <select
                                    id="band-chart-person"
                                    value={chartPersonId}
                                    onChange={(e) => setChartPersonId(e.target.value)}
                                    className="h-9 w-44 cursor-pointer rounded-md border border-gray-200 bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059833] sm:w-56"
                                >
                                    <option value="">Rata-rata semua anak</option>
                                    {chartable.map((p) => (
                                        <option key={p.personId} value={p.personId}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                                {chartPerson && onSelect ? (
                                    <button
                                        type="button"
                                        onClick={() => onSelect(chartPerson.personId)}
                                        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059833]"
                                        aria-label="Buka detail anak"
                                        title="Buka detail anak"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </button>
                                ) : null}
                            </>
                        )}
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={exporting}
                            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059833] disabled:cursor-wait disabled:opacity-60"
                            title="Download tabel perhitungan & prediksi (.xlsx)"
                        >
                            {exporting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                                <Download className="h-3.5 w-3.5 text-green-600" aria-hidden />
                            )}
                            Excel
                        </button>
                        <HowItWorks hidden={groups.hidden} />
                    </div>
                </div>

                {view === 'bar' ? (
                    <div className="mt-3 space-y-2">
                        {/* Filter kelompok = sekaligus legenda warna + jumlah anak aktif. */}
                        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Kelompok warna">
                            {([...BANDS, 'all'] as Filter[]).map((key) => {
                                const active = filter === key;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => setFilter(key)}
                                        className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059833] ${
                                            active
                                                ? 'border-gray-900 bg-gray-900 text-white'
                                                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        {key !== 'all' ? (
                                            <span
                                                className="h-2 w-2 rounded-full"
                                                style={{ backgroundColor: COLOR[key] }}
                                                aria-hidden
                                            />
                                        ) : null}
                                        {key === 'all' ? 'Semua' : GROUP_LABEL[key]}
                                        <span className="tabular-nums opacity-70">{groups[key].length}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <BarLegend />

                        <div className="rounded-lg border border-gray-100">
                            <div className="grid grid-cols-[minmax(0,7rem)_1fr_4.5rem] gap-2 border-b border-gray-100 px-2 py-1 sm:grid-cols-[minmax(0,10rem)_1fr_5rem] sm:gap-3">
                                <span />
                                <span className="relative h-4 text-[10px] text-gray-400 tabular-nums">
                                    {ticks.map((week) => (
                                        <span
                                            key={week}
                                            className="absolute -translate-x-1/2"
                                            style={{ left: `${(week / scale) * 100}%` }}
                                        >
                                            {week}
                                        </span>
                                    ))}
                                </span>
                                <span className="text-right text-[10px] text-gray-400">perkiraan</span>
                            </div>
                            <div className="max-h-[360px] overflow-y-auto p-1">
                                {visible.length === 0 ? (
                                    <p className="px-3 py-8 text-center text-sm text-gray-400">Tidak ada anak.</p>
                                ) : (
                                    visible.map((person) => (
                                        <JourneyRow
                                            key={person.personId}
                                            person={person}
                                            scale={scale}
                                            onPick={pickPerson}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                ) : chartOption ? (
                    <div className="mt-2">
                        <LazyEChart option={chartOption} height={340} />
                    </div>
                ) : null}
            </Card>
        </div>
    );
}
