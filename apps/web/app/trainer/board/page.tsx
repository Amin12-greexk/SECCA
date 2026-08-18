'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import PageTransition from '@/components/animations/PageTransition';
import StaggerCards from '@/components/animations/StaggerCards';
import LoadingCircle from '@/components/LoadingCircle';
import { useToast } from '@/lib/toast';
import {
    Clock3,
    Grid3X3,
    PackageOpen,
    Search,
} from 'lucide-react';
import type {
    WorkOrderBoard,
    MitraWorkCard,
} from '@/lib/api';
import {
    getWorkOrderBoard,
    cancelWorkOrder,
    getTrainerOrderWorkers,
    type TrainerWorkerOrderCandidate,
} from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const formatCardDate = (value: string | null) =>
    value
        ? new Intl.DateTimeFormat('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(new Date(value))
        : '-';

const formatCardGrade = (card: MitraWorkCard) =>
    [card.grade.shape, card.grade.feather, card.grade.color].filter(Boolean).join(' / ') || '-';

const getCardAgeInfo = (card: MitraWorkCard) => {
    let days = card.ageDays ?? 1;
    if (card.workDate) {
        const start = new Date(card.workDate);
        const now = new Date();
        const diffMs = now.getTime() - start.getTime();
        days = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
    }

    if (days <= 1) {
        return {
            days,
            tone: 'border-emerald-300 bg-emerald-50/70 text-slate-900',
            dot: 'bg-emerald-500',
            badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            label: '1 Hari',
        };
    }
    if (days === 2) {
        return {
            days,
            tone: 'border-amber-300 bg-amber-50/80 text-slate-900',
            dot: 'bg-amber-500',
            badge: 'bg-amber-100 text-amber-800 border-amber-200',
            label: '2 Hari',
        };
    }
    // >= 3 hari
    return {
        days,
        tone: 'border-red-400 bg-red-50/90 text-slate-900',
        dot: 'bg-red-500 animate-pulse',
        badge: 'bg-red-100 text-red-800 border-red-200',
        label: `${days} Hari`,
    };
};

// ---------- Main content ----------

function TrainerBoardContent() {
    const { user } = useAuth();
    const toast = useToast();

    const [board, setBoard] = useState<WorkOrderBoard | null>(null);
    const [loading, setLoading] = useState(true);
    const [cardSearch, setCardSearch] = useState('');

    const [cancelDialog, setCancelDialog] = useState<{
      open: boolean;
      workOrderId: string;
      workerName: string;
      itemCount: number;
    } | null>(null);
    const [cancelMode, setCancelMode] = useState<'return' | 'reassign'>('return');
    const [reassignWorkerId, setReassignWorkerId] = useState('');
    const [workers, setWorkers] = useState<TrainerWorkerOrderCandidate[]>([]);
    const [canceling, setCanceling] = useState(false);

    const loadWorkers = useCallback(async () => {
      try {
        const data = await getTrainerOrderWorkers();
        setWorkers(data);
      } catch (err) {
        console.error('Failed to load workers:', err);
      }
    }, []);

    const handleCancelOrder = async () => {
      if (!cancelDialog) return;
      setCanceling(true);
      try {
        await cancelWorkOrder(
          cancelDialog.workOrderId,
          cancelMode === 'reassign' && reassignWorkerId
            ? { reassignToWorkerId: reassignWorkerId }
            : undefined,
        );
        toast.success(
          cancelMode === 'reassign'
            ? `Order berhasil di-cancel dan di-reassign`
            : `Order berhasil di-cancel, LP dikembalikan ke Rak Mitra Order`,
        );
        setCancelDialog(null);
        setCancelMode('return');
        setReassignWorkerId('');
        await fetchBoard();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Gagal cancel order');
      } finally {
        setCanceling(false);
      }
    };

    const visibleCards = useMemo(() => {
        const cards = board?.cards ?? [];
        const query = cardSearch.trim().toLowerCase();
        if (!query) return cards;
        return cards.filter((card) =>
            [
                card.lpNumber,
                card.stockId,
                card.workerName,
                formatCardGrade(card),
            ].some((value) => value?.toLowerCase().includes(query)),
        );
    }, [board?.cards, cardSearch]);

    const groupedCards = useMemo(() => {
        const groups: Record<string, MitraWorkCard[]> = {};
        for (const card of visibleCards) {
            const key = card.workOrderId ?? card.workerName;
            if (!groups[key]) groups[key] = [];
            groups[key].push(card);
        }
        return groups;
    }, [visibleCards]);

    // Load board
    const fetchBoard = useCallback(async () => {
        setLoading(true);
        try {
            const trainerIdParam = user?.role === 'trainer' ? user?.id : undefined;
            const data = await getWorkOrderBoard(undefined, trainerIdParam);
            setBoard(data);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Gagal memuat board');
        } finally {
            setLoading(false);
        }
    }, [toast, user?.id, user?.role]);

    useEffect(() => {
        fetchBoard();
    }, [fetchBoard]);

    if (!user) return null;

    return (
        <PageTransition className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Proses Pengerjaan</h1>
                    <p className="text-sm text-gray-500 mt-1">Pantau seluruh LP mitra dari proses produksi sampai siap setor</p>
                </div>
                <a
                    href="/trainer/orders"
                    className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-700 hover:underline font-medium"
                >
                    + Buat Order Baru
                </a>
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex justify-center py-12">
                    <LoadingCircle size="lg" />
                </div>
            )}

            {/* Empty state */}
            {!loading && (!board?.cards || board.cards.length === 0) && (
                <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
                    <div className="text-4xl mb-3">📋</div>
                    <h3 className="font-semibold text-gray-700">Tidak ada pekerjaan LP aktif</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Belum ada LP aktif untuk seluruh mitra pekerja saat ini.
                    </p>
                </div>
            )}

            {/* Summary indicator legend */}
            {!loading && board?.cards && board.cards.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-4 text-xs card-hover">
                    <div className="flex items-center gap-3">
                        <span className="text-gray-500">Total LP Aktif:</span>
                        <span className="font-bold text-blue-600 text-sm">
                            {board.cards.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border bg-emerald-50 border-emerald-200 text-emerald-800 font-medium">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            1 Hari (Baru)
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border bg-amber-50 border-amber-200 text-amber-800 font-medium">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            2 Hari
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border bg-red-50 border-red-200 text-red-800 font-medium">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            &gt;= 3 Hari (Terlambat)
                        </span>
                    </div>
                </div>
            )}

            {/* Card board */}
            {!loading && board?.cards && board.cards.length > 0 && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-center gap-2 border-b border-slate-200 pb-4">
                        <button type="button" className="inline-flex h-9 w-10 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm" title="Tampilan kartu">
                            <Grid3X3 className="h-4 w-4" />
                        </button>
                        <div className="flex h-9 w-full max-w-sm overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                            <input
                                value={cardSearch}
                                onChange={(event) => setCardSearch(event.target.value)}
                                placeholder="Cari Nama Atau ID"
                                className="min-w-0 flex-1 px-3 text-xs text-slate-700 outline-none placeholder:text-slate-400"
                            />
                            <button type="button" className="inline-flex w-10 items-center justify-center bg-blue-600 text-white" title="Cari">
                                <Search className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {visibleCards.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
                            LP tidak ditemukan.
                        </div>
                    ) : (
                        <StaggerCards className="flex flex-wrap gap-3" triggerKey={`cards-${visibleCards.length}`}>
                            {visibleCards.map((card) => {
                                const ageInfo = getCardAgeInfo(card);
                                return (
                                    <article key={card.id} className={`w-[260px] flex flex-col justify-between rounded-lg border p-3 shadow-sm transition-all hover:shadow-md ${ageInfo.tone}`}>
                                        <div>
                                            {/* Header: LP number + age badge */}
                                            <div className="flex items-center justify-between gap-1 pb-1.5 border-b border-black/5">
                                                <h2 className="text-xs font-bold text-slate-950 truncate" title={card.lpNumber}>
                                                    {card.lpNumber}
                                                </h2>
                                                <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold border whitespace-nowrap ${ageInfo.badge}`}>
                                                    <span className={`h-1.5 w-1.5 rounded-full ${ageInfo.dot}`} />
                                                    {ageInfo.label}
                                                </span>
                                            </div>

                                            {/* Worker name prominent */}
                                            <p className="mt-2 text-sm font-bold text-gray-900 truncate">{card.workerName}</p>

                                            {/* Details */}
                                            <dl className="mt-1.5 space-y-0.5 text-[11px]">
                                                <div className="flex justify-between gap-2">
                                                    <dt className="text-slate-500">ID Stok</dt>
                                                    <dd className="font-semibold text-blue-600 truncate">{card.stockId ?? '-'}</dd>
                                                </div>
                                                <div className="flex justify-between gap-2">
                                                    <dt className="flex items-center gap-0.5 text-slate-500">
                                                        <Clock3 className="h-3 w-3" /> Tgl Kerja
                                                    </dt>
                                                    <dd className="font-semibold text-slate-900">{formatCardDate(card.workDate)}</dd>
                                                </div>
                                                <div className="flex justify-between gap-2">
                                                    <dt className="flex items-center gap-0.5 text-slate-500">
                                                        <PackageOpen className="h-3 w-3" /> Grade
                                                    </dt>
                                                    <dd className="truncate text-right font-semibold text-slate-900">{formatCardGrade(card)}</dd>
                                                </div>
                                            </dl>
                                        </div>

                                        {/* Cancel Order */}
                                        <div className="mt-2 pt-1.5 border-t border-slate-200/60 flex items-center justify-end">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setCancelDialog({
                                                        open: true,
                                                        workOrderId: card.workOrderId,
                                                        workerName: card.workerName,
                                                        itemCount: 1,
                                                    });
                                                    loadWorkers();
                                                }}
                                                className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
                                            >
                                                Cancel Order
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </StaggerCards>
                    )}
                </div>
            )}

            {cancelDialog && (
              <Dialog open={cancelDialog.open} onOpenChange={(open) => !open && setCancelDialog(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cancel Order</DialogTitle>
                    <DialogDescription>
                      Cancel semua {cancelDialog.itemCount} LP dari order {cancelDialog.workerName}?
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => setCancelMode('return')}
                        className={`flex-1 rounded-lg border-2 p-3 text-sm font-medium transition ${cancelMode === 'return' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      >
                        Kembalikan ke Rak
                      </button>
                      <button
                        onClick={() => { setCancelMode('reassign'); loadWorkers(); }}
                        className={`flex-1 rounded-lg border-2 p-3 text-sm font-medium transition ${cancelMode === 'reassign' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      >
                        Reassign ke Mitra Lain
                      </button>
                    </div>
                    {cancelMode === 'reassign' && (
                      <Select value={reassignWorkerId} onValueChange={setReassignWorkerId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih mitra tujuan" />
                        </SelectTrigger>
                        <SelectContent>
                          {workers
                            .filter((w) => w.name !== cancelDialog.workerName)
                            .map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCancelDialog(null)} disabled={canceling}>
                      Batal
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleCancelOrder}
                      disabled={canceling || (cancelMode === 'reassign' && !reassignWorkerId)}
                    >
                      {canceling ? 'Processing...' : 'Konfirmasi Cancel'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
        </PageTransition>
    );
}

// ---------- Page export ----------

export default function TrainerBoardPage() {
    return (
        <ProtectedRoute allowedRoles={['trainer', 'manager']}>
            <div className="p-6 md:p-8">
                <TrainerBoardContent />
            </div>
        </ProtectedRoute>
    );
}
