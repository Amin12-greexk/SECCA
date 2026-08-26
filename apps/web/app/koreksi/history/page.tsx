"use client";

import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/AuthContext";
import { useToast } from "@/lib/toast";
import {
  getFinishReceipts,
  getPecahBonHistoryPaginated,
  type FinishReceiptListItem,
  type PecahBonEntry,
  type PaginatedResult,
} from "@/lib/api";

const CSV_DELIMITER = ";";
/** Batas atas "Semua" — samakan dengan @Max di PecahBonHistoryQueryDto/limit backend. */
const MAX_PAGE_SIZE = 1000;
/** Rem darurat loop ekspor: 50 x 1000 baris. Data riil sekarang ~3rb baris. */
const MAX_EXPORT_PAGES = 50;
const PAGE_SIZE_OPTIONS = [20, 50, 100, "all"] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

type ViewTab = "manager" | "operasional";

/**
 * Tarik seluruh halaman sampai habis. MAX_PAGE_SIZE itu batas per-request
 * backend (@Max 1000), bukan batas total — tanpa loop ini ekspor "semua"
 * diam-diam terpotong di 1000 baris pertama padahal datanya sudah 3rb+.
 */
async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[] }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= MAX_EXPORT_PAGES; page += 1) {
    const { items } = await fetchPage(page);
    const batch = items ?? [];
    all.push(...batch);
    if (batch.length < MAX_PAGE_SIZE) break;
  }
  return all;
}

function KoreksiHistoryContent() {
  const toast = useToast();
  const { user } = useAuth();
  const isManagerRole = user?.role?.toUpperCase() === "MANAGER";

  const [viewTab, setViewTab] = useState<ViewTab>(
    isManagerRole ? "manager" : "operasional",
  );

  useEffect(() => {
    if (!isManagerRole && viewTab !== "operasional") {
      setViewTab("operasional");
    }
  }, [isManagerRole, viewTab]);

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<
    "page" | "filtered" | "all" | null
  >(null);
  const [tableQuery, setTableQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  /** Cuma dipakai tab operasional — manager tidak punya kolom Status Setoran. */
  const [submittedFilter, setSubmittedFilter] = useState<"all" | "yes" | "no">(
    "all",
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);

  const effectiveLimit = pageSize === "all" ? MAX_PAGE_SIZE : pageSize;

  /* ── Finish Receipts Data (Manager View) ── */
  const [receiptsData, setReceiptsData] = useState<
    PaginatedResult<FinishReceiptListItem>
  >({
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  /* ── Pecah Bon Entries Data (Operasional View) ── */
  const [pecahBonData, setPecahBonData] = useState<
    PaginatedResult<PecahBonEntry>
  >({
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  /* ── Receipts Map for joining Operasional rows ── */
  const [receiptsMap, setReceiptsMap] = useState<
    Record<string, FinishReceiptListItem>
  >({});

  const formatNumber = (value: number, fractionDigits = 2) =>
    new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);

  const formatRp = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);

  const loadPage = async (
    page: number,
    query = tableQuery,
    from = dateFrom,
    to = dateTo,
    tab = viewTab,
    limit = effectiveLimit,
    submitted = submittedFilter,
  ) => {
    setLoading(true);
    try {
      if (tab === "operasional") {
        // Tabel operasional diurutkan nomor LP (terkecil dulu), sedangkan
        // FinishReceipt cuma bisa diurutkan tanggal setoran — dua sumbu yang
        // berbeda, jadi menyamakan `order` di kedua call seperti dulu tidak
        // lagi menjamin baris yang tampil ketemu pasangannya. Receipt karena
        // itu ditarik selebar mungkin untuk rentang filter yang sama, supaya
        // kolom PIN Mitra/nama/hasil tetap terisi di halaman ke berapa pun
        // (versi lama cuma benar di halaman 1).
        const [pbRes, frRes] = await Promise.all([
          getPecahBonHistoryPaginated({
            page: page + 1,
            limit,
            search: query || undefined,
            from: from || undefined,
            to: to || undefined,
            order: "asc",
            submitted,
          }),
          getFinishReceipts({
            page: 1,
            limit: MAX_PAGE_SIZE,
            search: query || undefined,
            from: from || undefined,
            to: to || undefined,
            order: "desc",
          }).catch(() => ({ items: [] as FinishReceiptListItem[] })),
        ]);
        setPecahBonData(pbRes);
        const map: Record<string, FinishReceiptListItem> = {};
        (frRes.items || []).forEach((item) => {
          if (item.noLp) map[item.noLp] = item;
        });
        setReceiptsMap(map);
      } else {
        const response = await getFinishReceipts({
          page: page + 1,
          limit,
          search: query || undefined,
          from: from || undefined,
          to: to || undefined,
        });
        setReceiptsData(response);
      }
      setSelectedIds([]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memuat data riwayat.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(0);
    void loadPage(0, tableQuery, dateFrom, dateTo, viewTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewTab]);

  const applyFilters = async () => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      toast.error("Rentang tanggal tidak valid (dari > sampai).");
      return;
    }
    setCurrentPage(0);
    await loadPage(0, tableQuery, dateFrom, dateTo, viewTab);
  };

  /* ── Current Active Rows ── */
  const activeTotal =
    viewTab === "operasional" ? pecahBonData.total : receiptsData.total;
  const activeTotalPages =
    viewTab === "operasional"
      ? pecahBonData.totalPages
      : receiptsData.totalPages;
  const activeRowCount =
    viewTab === "operasional"
      ? pecahBonData.items.length
      : receiptsData.items.length;
  /** Limit yang benar-benar dipakai memuat data yang sedang tampil — bukan
   * `pageSize` mentah, supaya nomor baris tetap akurat walau ganti ukuran
   * halaman belum selesai reload. */
  const activeLimit =
    (viewTab === "operasional" ? pecahBonData.limit : receiptsData.limit) ||
    effectiveLimit;

  const allSelectedOnPage =
    activeRowCount > 0 &&
    (viewTab === "operasional"
      ? pecahBonData.items.every((item) => selectedIds.includes(item.id))
      : receiptsData.items.every((item) => selectedIds.includes(item.id)));

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(id);
      else set.delete(id);
      return Array.from(set);
    });
  };

  const toggleAllPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      const items =
        viewTab === "operasional" ? pecahBonData.items : receiptsData.items;
      if (checked) items.forEach((item) => set.add(item.id));
      else items.forEach((item) => set.delete(item.id));
      return Array.from(set);
    });
  };

  const selectedActiveReceiptRows = receiptsData.items.filter((item) =>
    selectedIds.includes(item.id),
  );
  const selectedActivePecahBonRows = pecahBonData.items.filter((item) =>
    selectedIds.includes(item.id),
  );

  /* ── Manager Financial Stats ── */
  const managerStats = useMemo(() => {
    if (viewTab !== "manager") return null;
    let totalMainOut = 0;
    let totalByProduct = 0;
    let totalDryIn = 0;
    let totalPayrollRp = 0;

    receiptsData.items.forEach((item) => {
      totalMainOut += item.mainOutWeightGram ?? 0;
      totalByProduct += item.byProductWeightGram ?? 0;
      totalDryIn += item.dryInGram ?? 0;
      totalPayrollRp += item.payroll?.amountRp ?? 0;
    });

    const avgTariffPerGram = totalDryIn > 0 ? totalPayrollRp / totalDryIn : 0;
    const overallNetRendemen =
      totalDryIn > 0 ? ((totalMainOut + totalByProduct) / totalDryIn) * 100 : 0;

    return {
      totalMainOut,
      totalByProduct,
      totalDryIn,
      totalPayrollRp,
      avgTariffPerGram,
      overallNetRendemen,
    };
  }, [viewTab, receiptsData.items]);

  const escapeCsv = (value: string | number) => {
    const text = String(value ?? "");
    const escaped = text.replace(/"/g, '""');
    return new RegExp(`["\\n${CSV_DELIMITER}]`).test(escaped)
      ? `"${escaped}"`
      : escaped;
  };

  const buildCsvOperasional = (
    exportRows: PecahBonEntry[],
    startIndex = 0,
    /** Ekspor seluruh data memakai map hasil fetch-nya sendiri, bukan map
     * milik halaman yang lagi tampil — kalau tidak, baris di luar halaman
     * aktif kehilangan kolom PIN/nama/hasil. */
    receipts: Record<string, FinishReceiptListItem> = receiptsMap,
  ) => {
    const headers = [
      "No",
      "ID LP",
      "Status Setoran",
      "Tanggal Setoran",
      "Tanggal Pecah Bon",
      "Batch",
      "Grade Baku",
      "PCS",
      "Basah (Gr)",
      "Kadar Air (%)",
      "Berat Kering (Gr)",
      "Pekerja / Mitra",
      "PIN Mitra",
      "Hasil Barang Jadi (Gr)",
      "Rincian Grade Hasil",
      "By Product (Gr)",
      "Susut Proses (Gr)",
      "Susut Proses (%)",
      "Susut Hilang (Gr)",
      "Susut Hilang (%)",
      "Rendemen Utama (%)",
    ];
    const rows = exportRows.map((entry, index) => {
      const receipt = receipts[entry.pecahBonId || entry.id];
      const dryIn = receipt?.dryInGram || entry.dryWeightGram || 0;
      const mainOut = receipt?.mainOutWeightGram || 0;
      const byProduct = receipt?.byProductWeightGram || 0;
      const susutProsesG = receipt?.susutProsesGram ?? byProduct;
      const susutProsesPct = receipt?.susutProsesPctBps
        ? receipt.susutProsesPctBps / 100
        : dryIn > 0
          ? (susutProsesG / dryIn) * 100
          : 0;
      const susutHilangG =
        receipt?.susutHilangGram ?? Math.max(dryIn - mainOut - byProduct, 0);
      const susutHilangPct = receipt?.susutHilangPctBps
        ? receipt.susutHilangPctBps / 100
        : dryIn > 0
          ? (susutHilangG / dryIn) * 100
          : 0;
      const rendemenUtama = dryIn > 0 ? (mainOut / dryIn) * 100 : 0;

      const gradeLabel =
        [entry.grade?.code, entry.featherGrade?.code, entry.colorGrade?.code]
          .filter(Boolean)
          .join("/") || "-";
      const resultGradesStr =
        receipt?.resultGrades && receipt.resultGrades.length > 0
          ? receipt.resultGrades
              .map((rg) => `${rg.name} (${formatNumber(rg.weightGram, 1)}g)`)
              .join(", ")
          : "-";

      return [
        startIndex + index + 1,
        entry.pecahBonId ?? "-",
        entry.submittedAt ? "Sudah disetor" : "Belum disetor",
        entry.submittedAt
          ? new Date(entry.submittedAt).toLocaleDateString("id-ID")
          : "-",
        entry.pecahBonDate
          ? new Date(entry.pecahBonDate).toLocaleDateString("id-ID")
          : "-",
        entry.rawBatch?.batchNumber ?? "-",
        gradeLabel,
        entry.pieceCount,
        formatNumber(entry.initialWeightGram, 2),
        formatNumber(entry.moisturePercent, 1),
        formatNumber(entry.dryWeightGram, 2),
        receipt?.workerName ?? "-",
        receipt?.workerPin ?? "-",
        receipt ? formatNumber(mainOut, 2) : "-",
        resultGradesStr,
        receipt ? formatNumber(byProduct, 2) : "-",
        receipt ? formatNumber(susutProsesG, 2) : "-",
        receipt ? formatNumber(susutProsesPct, 2) : "-",
        receipt ? formatNumber(susutHilangG, 2) : "-",
        receipt ? formatNumber(susutHilangPct, 2) : "-",
        receipt ? formatNumber(rendemenUtama, 2) : "-",
      ];
    });
    return { headers, rows };
  };

  const buildCsvManager = (
    exportRows: FinishReceiptListItem[],
    startIndex = 0,
  ) => {
    const headers = [
      "No",
      "ID LP",
      "Pekerja / Mitra",
      "PIN Mitra",
      "Grade Baku",
      "Berat Kering (Gr)",
      "Hasil Barang Jadi (Gr)",
      "Rincian Grade Hasil",
      "By Product (Gr)",
      "Susut Proses (Gr)",
      "Susut Proses (%)",
      "Susut Hilang (Gr)",
      "Susut Hilang (%)",
      "Rendemen Utama (%)",
      "Tarif / Gram (Rp)",
      "Total Upah Payroll (Rp)",
    ];
    const rows = exportRows.map((item, index) => {
      const dryIn = item.dryInGram || 0;
      const mainOut = item.mainOutWeightGram || 0;
      const byProduct = item.byProductWeightGram || 0;
      const susutProsesG = item.susutProsesGram ?? byProduct;
      const susutProsesPct = item.susutProsesPctBps
        ? item.susutProsesPctBps / 100
        : dryIn > 0
          ? (susutProsesG / dryIn) * 100
          : 0;
      const susutHilangG =
        item.susutHilangGram ?? Math.max(dryIn - mainOut - byProduct, 0);
      const susutHilangPct = item.susutHilangPctBps
        ? item.susutHilangPctBps / 100
        : dryIn > 0
          ? (susutHilangG / dryIn) * 100
          : 0;
      const rendemenUtama = dryIn > 0 ? (mainOut / dryIn) * 100 : 0;

      const resultGradesStr =
        item.resultGrades && item.resultGrades.length > 0
          ? item.resultGrades
              .map((rg) => `${rg.name} (${formatNumber(rg.weightGram, 1)}g)`)
              .join(", ")
          : "-";

      return [
        startIndex + index + 1,
        item.noLp ?? "-",
        item.workerName ?? "-",
        item.workerPin ?? "-",
        item.grade ?? "-",
        formatNumber(dryIn, 2),
        formatNumber(mainOut, 2),
        resultGradesStr,
        formatNumber(byProduct, 2),
        formatNumber(susutProsesG, 2),
        formatNumber(susutProsesPct, 2),
        formatNumber(susutHilangG, 2),
        formatNumber(susutHilangPct, 2),
        formatNumber(rendemenUtama, 2),
        item.payroll?.rateRpPerGram ?? 0,
        item.payroll?.amountRp ?? 0,
      ];
    });
    return { headers, rows };
  };

  type TableContent = { headers: string[]; rows: (string | number)[][] };

  const downloadCsv = (content: TableContent, fileName: string) => {
    if (content.rows.length === 0) {
      toast.error("Tidak ada data untuk diunduh.");
      return;
    }
    const csvRows = content.rows.map((row) =>
      row.map(escapeCsv).join(CSV_DELIMITER),
    );
    const csvContent = `\uFEFF${[content.headers.join(CSV_DELIMITER), ...csvRows].join("\r\n")}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  /** Sel dengan tab/baris-baru diganti spasi supaya kolom TSV tidak geser saat di-paste. */
  const sanitizeTsvCell = (value: string | number) =>
    String(value ?? "").replace(/[\t\r\n]+/g, " ");

  const copyTableToClipboard = async (content: TableContent) => {
    if (content.rows.length === 0) {
      toast.error("Tidak ada data untuk disalin.");
      return;
    }
    const tsv = [
      content.headers.join("\t"),
      ...content.rows.map((row) => row.map(sanitizeTsvCell).join("\t")),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      toast.success(
        `${content.rows.length} baris disalin \u2014 siap ditempel ke Excel.`,
      );
    } catch {
      toast.error("Gagal menyalin ke clipboard.");
    }
  };

  /** Baris + label yang lagi kelihatan di layar — dipakai bareng oleh Download & Salin
   * supaya keduanya selalu merefleksikan pageSize + filter yang aktif saat ini. */
  const buildCurrentTableContent = (): {
    content: TableContent;
    rowCount: number;
  } => {
    if (viewTab === "manager") {
      const exportRows =
        selectedActiveReceiptRows.length > 0
          ? selectedActiveReceiptRows
          : receiptsData.items;
      return {
        content: buildCsvManager(exportRows, currentPage * activeLimit),
        rowCount: exportRows.length,
      };
    }
    const exportRows =
      selectedActivePecahBonRows.length > 0
        ? selectedActivePecahBonRows
        : pecahBonData.items;
    return {
      content: buildCsvOperasional(exportRows, currentPage * activeLimit),
      rowCount: exportRows.length,
    };
  };

  /**
   * Download CSV mengekspor SELURUH baris yang cocok filter aktif, bukan cuma
   * halaman yang lagi tampil. Dulu ekspor terbatas satu halaman, dan karena
   * tabel diurutkan tanggal setoran (LP belum-setor terlempar ke halaman
   * terakhir), CSV halaman 1 selalu kelihatan cuma berisi LP yang sudah
   * disetor walau filter Status Setoran = Semua.
   *
   * Kalau ada baris yang dicentang, pilihan itu yang dihormati apa adanya.
   */
  const downloadExcelAll = async () => {
    setExporting(selectedIds.length > 0 ? "page" : "all");
    const stamp = new Date().toISOString().slice(0, 10);
    const prefix =
      viewTab === "manager"
        ? "riwayat-setoran-manager"
        : "riwayat-pecah-bon-operasional";
    try {
      if (selectedIds.length > 0) {
        const { content, rowCount } = buildCurrentTableContent();
        downloadCsv(content, `${prefix}-pilihan-${stamp}.csv`);
        toast.success(`Berhasil mengunduh ${rowCount} baris terpilih.`);
        return;
      }

      const shared = {
        search: tableQuery || undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
      };

      if (viewTab === "manager") {
        const items = await fetchAllPages((page) =>
          getFinishReceipts({
            page,
            limit: MAX_PAGE_SIZE,
            ...shared,
            order: "desc",
          }),
        );
        downloadCsv(buildCsvManager(items, 0), `${prefix}-${stamp}.csv`);
        toast.success(`Berhasil mengunduh ${items.length} baris.`);
        return;
      }

      const [pbItems, frItems] = await Promise.all([
        fetchAllPages((page) =>
          getPecahBonHistoryPaginated({
            page,
            limit: MAX_PAGE_SIZE,
            ...shared,
            order: "asc",
            submitted: submittedFilter,
          }),
        ),
        fetchAllPages((page) =>
          getFinishReceipts({
            page,
            limit: MAX_PAGE_SIZE,
            ...shared,
            order: "desc",
          }),
        ).catch(() => [] as FinishReceiptListItem[]),
      ]);

      const fullMap: Record<string, FinishReceiptListItem> = {};
      frItems.forEach((item) => {
        if (item.noLp) fullMap[item.noLp] = item;
      });

      downloadCsv(
        buildCsvOperasional(pbItems, 0, fullMap),
        `${prefix}-${stamp}.csv`,
      );
      toast.success(`Berhasil mengunduh ${pbItems.length} baris.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyiapkan CSV.",
      );
    } finally {
      setExporting(null);
    }
  };

  const copyTablePage = async () => {
    setCopying(true);
    try {
      const { content } = buildCurrentTableContent();
      await copyTableToClipboard(content);
    } finally {
      setCopying(false);
    }
  };

  const handlePageSizeChange = (value: string) => {
    const next = value === "all" ? "all" : (Number(value) as PageSize);
    setPageSize(next);
    setCurrentPage(0);
    const nextLimit = next === "all" ? MAX_PAGE_SIZE : next;
    void loadPage(0, tableQuery, dateFrom, dateTo, viewTab, nextLimit);
  };

  const fromRow = activeTotal === 0 ? 0 : currentPage * activeLimit + 1;
  const toRow = Math.min((currentPage + 1) * activeLimit, activeTotal);

  return (
    <div className="min-h-[calc(100vh-72px)] bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* ── Page Header & Tab Switcher ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Riwayat Setoran & Pecah Bon
            </h1>
            <p className="text-sm text-gray-500">
              {viewTab === "manager"
                ? "Tampilan Finansial Manager: Rekap lengkap setoran, tarif grade, dan kalkulasi penggajian."
                : "Tampilan Operasional Koreksi: Riwayat penimbangan pecah bon dan kadar air."}
            </p>
          </div>

          {isManagerRole && (
            <div className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setViewTab("manager")}
                className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                  viewTab === "manager"
                    ? "bg-[#059833] text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                📊 Tampilan Manager (Tarif & Payroll)
              </button>
              <button
                type="button"
                onClick={() => setViewTab("operasional")}
                className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                  viewTab === "operasional"
                    ? "bg-[#059833] text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                📋 Tampilan Koreksi (Operasional)
              </button>
            </div>
          )}
        </div>

        {/* ── Manager Stats Bar (Only in Manager Tab) ── */}
        {viewTab === "manager" && managerStats && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
              <p className="text-xs font-semibold text-emerald-700">
                Total Setoran LP (Halaman Ini)
              </p>
              <p className="text-2xl font-black text-emerald-900 tabular-nums">
                {receiptsData.total} LP
              </p>
              <p className="text-xs text-emerald-700 mt-0.5">
                Berat Kering: {formatNumber(managerStats.totalDryIn, 1)} gr
              </p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-4">
              <p className="text-xs font-semibold text-indigo-700">
                Total Barang Jadi Output
              </p>
              <p className="text-2xl font-black text-indigo-900 tabular-nums">
                {formatNumber(managerStats.totalMainOut, 1)} gr
              </p>
              <p className="text-xs text-indigo-700 mt-0.5">
                + By-Product: {formatNumber(managerStats.totalByProduct, 1)} gr
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4">
              <p className="text-xs font-semibold text-amber-700">
                Estimasi Payroll / Upah (Rp)
              </p>
              <p className="text-2xl font-black text-amber-900 tabular-nums">
                {formatRp(managerStats.totalPayrollRp)}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Total hak bayar mitra
              </p>
            </div>
            <div className="rounded-xl border border-cyan-200 bg-cyan-50/80 p-4">
              <p className="text-xs font-semibold text-cyan-700">
                Rata-Rata Tarif Per Gram
              </p>
              <p className="text-2xl font-black text-cyan-900 tabular-nums">
                {formatRp(managerStats.avgTariffPerGram)} / gr
              </p>
              <p className="text-xs text-cyan-700 mt-0.5">
                Rendemen Bersih:{" "}
                {formatNumber(managerStats.overallNetRendemen, 1)}%
              </p>
            </div>
          </div>
        )}

        {/* ── Filters Bar ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto]">
            <div className="space-y-1">
              <Label htmlFor="searchQuery">Cari LP / Pekerja / Grade</Label>
              <Input
                id="searchQuery"
                value={tableQuery}
                onChange={(event) => setTableQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void applyFilters();
                }}
                placeholder="Contoh: TEI-0001, Sunariyah, MK/SGTG"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateFrom">Dari Tanggal</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateTo">Sampai Tanggal</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={() => void applyFilters()}
                disabled={loading}
                className="bg-[#059833] hover:bg-[#047a29]"
              >
                {loading ? "Memuat..." : "Terapkan"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTableQuery("");
                  setDateFrom("");
                  setDateTo("");
                  setSubmittedFilter("all");
                  setCurrentPage(0);
                  void loadPage(0, "", "", "", viewTab, effectiveLimit, "all");
                }}
                disabled={loading}
              >
                Reset
              </Button>
            </div>
          </div>

          {viewTab === "operasional" ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
              <Label className="text-xs font-medium text-gray-500">
                Status Setoran:
              </Label>
              {(
                [
                  { value: "all", label: "Semua" },
                  { value: "no", label: "Belum disetor" },
                  { value: "yes", label: "Sudah disetor" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setSubmittedFilter(opt.value);
                    setCurrentPage(0);
                    void loadPage(
                      0,
                      tableQuery,
                      dateFrom,
                      dateTo,
                      viewTab,
                      effectiveLimit,
                      opt.value,
                    );
                  }}
                  disabled={loading}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    submittedFilter === opt.value
                      ? "border-[#059833] bg-[#059833] text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* ── Main Data Table ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                {viewTab === "manager"
                  ? "Riwayat Setoran Finansial & Tarif"
                  : "Daftar Pecah Bon Operasional"}
              </h2>
              <p className="text-xs text-gray-500">
                {fromRow}-{toRow} dari {activeTotal} data • {selectedIds.length}{" "}
                terpilih
              </p>
              {viewTab === "operasional" && (
                <p className="mt-0.5 text-[11px] text-gray-400">
                  Diurutkan berdasarkan nomor LP (terkecil lebih dulu). Download
                  CSV mengunduh semua baris sesuai filter, bukan hanya halaman
                  ini.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Label
                  htmlFor="pageSize"
                  className="whitespace-nowrap text-xs text-gray-500"
                >
                  Baris/halaman
                </Label>
                <select
                  id="pageSize"
                  value={pageSize}
                  onChange={(event) => handlePageSizeChange(event.target.value)}
                  disabled={loading}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "all" ? "Semua" : option}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void copyTablePage()}
                disabled={loading || activeRowCount === 0 || copying}
              >
                {copying ? "Menyalin..." : "Salin Tabel"}
              </Button>
              <Button
                type="button"
                onClick={() => void downloadExcelAll()}
                disabled={loading || activeRowCount === 0 || exporting !== null}
                className="bg-[#059833] hover:bg-[#047a29]"
                title={
                  selectedIds.length > 0
                    ? `Unduh ${selectedIds.length} baris terpilih`
                    : "Unduh semua baris yang cocok dengan filter aktif"
                }
              >
                {exporting !== null
                  ? "Menyiapkan..."
                  : selectedIds.length > 0
                    ? `Download CSV (${selectedIds.length})`
                    : "Download CSV"}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            {viewTab === "manager" ? (
              /* ── TABLE VIEW: MANAGER (TARIF & PAYROLL) ── */
              <table className="w-full min-w-[1220px] text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                    <th className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={allSelectedOnPage}
                        onChange={(event) =>
                          toggleAllPage(event.target.checked)
                        }
                        disabled={receiptsData.items.length === 0}
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-600">
                      PIN Mitra
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold">
                      Pekerja / Mitra
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold">Tanggal</th>
                    <th className="px-3 py-2.5 text-left font-bold">ID LP</th>
                    <th className="px-3 py-2.5 text-left font-bold">
                      Grade Baku
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold">
                      Kering (g)
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold text-emerald-700">
                      Barang Jadi / Main Product
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold">
                      By-Prod (g)
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold text-amber-700">
                      Susut Proses
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold text-rose-700">
                      Susut Hilang
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold text-indigo-700">
                      Rendemen Utama (%)
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold text-indigo-900">
                      Tarif / Gram
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold text-emerald-800">
                      Total Upah (Rp)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={14}
                        className="px-3 py-8 text-center text-sm text-gray-500"
                      >
                        Memuat data setoran...
                      </td>
                    </tr>
                  ) : receiptsData.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={14}
                        className="px-3 py-8 text-center text-sm text-gray-500"
                      >
                        Belum ada data setoran disetor.
                      </td>
                    </tr>
                  ) : (
                    receiptsData.items.map((item) => {
                      const dryIn = item.dryInGram || 0;
                      const mainOut = item.mainOutWeightGram || 0;
                      const byProduct = item.byProductWeightGram || 0;
                      const susutProsesG = item.susutProsesGram ?? byProduct;
                      const susutProsesPct = item.susutProsesPctBps
                        ? item.susutProsesPctBps / 100
                        : dryIn > 0
                          ? (susutProsesG / dryIn) * 100
                          : 0;
                      const susutHilangG =
                        item.susutHilangGram ??
                        Math.max(dryIn - mainOut - byProduct, 0);
                      const susutHilangPct = item.susutHilangPctBps
                        ? item.susutHilangPctBps / 100
                        : dryIn > 0
                          ? (susutHilangG / dryIn) * 100
                          : 0;
                      const rendemenUtama =
                        dryIn > 0 ? (mainOut / dryIn) * 100 : 0;

                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(item.id)}
                              onChange={(event) =>
                                toggleRow(item.id, event.target.checked)
                              }
                            />
                          </td>
                          <td className="px-3 py-2.5 font-mono text-gray-600">
                            {item.workerPin ?? "-"}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-900">
                            {item.workerName}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700">
                            {item.returnedAt
                              ? new Date(item.returnedAt).toLocaleDateString(
                                  "id-ID",
                                )
                              : "-"}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold text-gray-900">
                            {item.noLp}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700">
                            {item.grade}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                            {formatNumber(dryIn, 2)}
                          </td>
                          <td className="px-3 py-2.5 text-left text-gray-800">
                            <div className="font-mono font-bold text-emerald-700">
                              {formatNumber(mainOut, 2)}g
                            </div>
                            {item.resultGrades &&
                              item.resultGrades.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {item.resultGrades.map((rg) => (
                                    <span
                                      key={rg.id}
                                      className="inline-flex items-center gap-1 rounded bg-emerald-100/70 px-1 py-0.5 text-[9px] font-semibold text-emerald-800"
                                    >
                                      {rg.name}:{" "}
                                      <strong className="font-mono">
                                        {formatNumber(rg.weightGram, 1)}g
                                      </strong>
                                    </span>
                                  ))}
                                </div>
                              )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                            {formatNumber(byProduct, 2)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-amber-800">
                            {formatNumber(susutProsesG, 2)}g{" "}
                            <span className="text-[10px] text-amber-600">
                              ({formatNumber(susutProsesPct, 1)}%)
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-rose-800">
                            {formatNumber(susutHilangG, 2)}g{" "}
                            <span className="text-[10px] text-rose-600">
                              ({formatNumber(susutHilangPct, 1)}%)
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-indigo-900">
                            {formatNumber(rendemenUtama, 1)}%
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold text-indigo-900">
                            {formatRp(item.payroll?.rateRpPerGram ?? 0)}/g
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-800 bg-emerald-50/50">
                            {formatRp(item.payroll?.amountRp ?? 0)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              /* ── TABLE VIEW: KOREKSI (OPERASIONAL) ── */
              <table className="w-full min-w-[1400px] text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-gray-700">
                    <th className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={allSelectedOnPage}
                        onChange={(event) =>
                          toggleAllPage(event.target.checked)
                        }
                        disabled={pecahBonData.items.length === 0}
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold text-gray-600">
                      PIN Mitra
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold">
                      Pekerja / Mitra
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold">
                      Status Setoran
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold">ID LP</th>
                    <th className="px-3 py-2.5 text-left font-bold">Batch</th>
                    <th className="px-3 py-2.5 text-left font-bold">
                      Grade Baku
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold">PCS</th>
                    <th className="px-3 py-2.5 text-right font-bold">
                      Basah (g)
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold">
                      K.Air (%)
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold">
                      Kering (g)
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold text-emerald-700">
                      Barang Jadi / Main Product
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold">
                      By-Prod (g)
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold text-amber-700">
                      Susut Proses
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold text-rose-700">
                      Susut Hilang
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold text-indigo-700">
                      Rendemen Utama (%)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={16}
                        className="px-3 py-8 text-center text-sm text-gray-500"
                      >
                        Memuat data pecah bon...
                      </td>
                    </tr>
                  ) : pecahBonData.items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={16}
                        className="px-3 py-8 text-center text-sm text-gray-500"
                      >
                        Belum ada data pecah bon.
                      </td>
                    </tr>
                  ) : (
                    pecahBonData.items.map((entry) => {
                      const receipt = receiptsMap[entry.pecahBonId || entry.id];
                      const dryIn =
                        receipt?.dryInGram || entry.dryWeightGram || 0;
                      const mainOut = receipt?.mainOutWeightGram || 0;
                      const byProduct = receipt?.byProductWeightGram || 0;
                      const susutProsesG =
                        receipt?.susutProsesGram ?? byProduct;
                      const susutProsesPct = receipt?.susutProsesPctBps
                        ? receipt.susutProsesPctBps / 100
                        : dryIn > 0
                          ? (susutProsesG / dryIn) * 100
                          : 0;
                      const susutHilangG =
                        receipt?.susutHilangGram ??
                        Math.max(dryIn - mainOut - byProduct, 0);
                      const susutHilangPct = receipt?.susutHilangPctBps
                        ? receipt.susutHilangPctBps / 100
                        : dryIn > 0
                          ? (susutHilangG / dryIn) * 100
                          : 0;
                      const rendemenUtama =
                        dryIn > 0 ? (mainOut / dryIn) * 100 : 0;
                      const gradeLabel =
                        [
                          entry.grade?.code,
                          entry.featherGrade?.code,
                          entry.colorGrade?.code,
                        ]
                          .filter(Boolean)
                          .join("/") || "-";

                      return (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(entry.id)}
                              onChange={(event) =>
                                toggleRow(entry.id, event.target.checked)
                              }
                            />
                          </td>
                          <td className="px-3 py-2.5 font-mono text-gray-600">
                            {receipt?.workerPin ?? "-"}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-900">
                            {receipt?.workerName ?? "-"}
                          </td>
                          <td className="px-3 py-2.5">
                            {entry.submittedAt ? (
                              <span className="inline-flex flex-col">
                                <span className="inline-flex w-fit items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                                  Sudah disetor
                                </span>
                                <span className="mt-0.5 text-[10px] text-gray-500">
                                  {new Date(
                                    entry.submittedAt,
                                  ).toLocaleDateString("id-ID")}
                                </span>
                              </span>
                            ) : (
                              <span className="inline-flex w-fit items-center rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                                Belum disetor
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono font-bold text-gray-900">
                            {entry.pecahBonId ?? "-"}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">
                            {entry.rawBatch?.batchNumber ?? "-"}
                          </td>
                          <td className="px-3 py-2.5 text-gray-700">
                            {gradeLabel}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                            {entry.pieceCount}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                            {formatNumber(entry.initialWeightGram, 2)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                            {formatNumber(entry.moisturePercent, 1)}%
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                            {formatNumber(entry.dryWeightGram, 2)}
                          </td>
                          <td className="px-3 py-2.5 text-left text-gray-800">
                            {receipt ? (
                              <>
                                <div className="font-mono font-bold text-emerald-700">
                                  {formatNumber(mainOut, 2)}g
                                </div>
                                {receipt.resultGrades &&
                                  receipt.resultGrades.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {receipt.resultGrades.map((rg) => (
                                        <span
                                          key={rg.id}
                                          className="inline-flex items-center gap-1 rounded bg-emerald-100/70 px-1 py-0.5 text-[9px] font-semibold text-emerald-800"
                                        >
                                          {rg.name}:{" "}
                                          <strong className="font-mono">
                                            {formatNumber(rg.weightGram, 1)}g
                                          </strong>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                              </>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-gray-700">
                            {receipt ? formatNumber(byProduct, 2) : "-"}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-amber-800">
                            {receipt ? (
                              <>
                                {formatNumber(susutProsesG, 2)}g{" "}
                                <span className="text-[10px] text-amber-600">
                                  ({formatNumber(susutProsesPct, 1)}%)
                                </span>
                              </>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-rose-800">
                            {receipt ? (
                              <>
                                {formatNumber(susutHilangG, 2)}g{" "}
                                <span className="text-[10px] text-rose-600">
                                  ({formatNumber(susutHilangPct, 1)}%)
                                </span>
                              </>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-indigo-900">
                            {receipt ? `${formatNumber(rendemenUtama, 1)}%` : "-"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-gray-600">
            <span>
              Halaman {currentPage + 1} dari {activeTotalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = Math.max(0, currentPage - 1);
                  setCurrentPage(next);
                  void loadPage(next, tableQuery, dateFrom, dateTo, viewTab);
                }}
                disabled={loading || currentPage === 0}
              >
                Sebelumnya
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = Math.min(activeTotalPages - 1, currentPage + 1);
                  setCurrentPage(next);
                  void loadPage(next, tableQuery, dateFrom, dateTo, viewTab);
                }}
                disabled={loading || currentPage >= activeTotalPages - 1}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KoreksiHistoryPage() {
  return (
    <ProtectedRoute>
      <KoreksiHistoryContent />
    </ProtectedRoute>
  );
}
