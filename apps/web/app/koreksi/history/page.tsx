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

const ROWS_PER_PAGE = 20;
const CSV_DELIMITER = ";";

type ViewTab = "manager" | "operasional";

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
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  /* ── Finish Receipts Data (Manager View) ── */
  const [receiptsData, setReceiptsData] = useState<
    PaginatedResult<FinishReceiptListItem>
  >({
    items: [],
    page: 1,
    limit: ROWS_PER_PAGE,
    total: 0,
    totalPages: 1,
  });

  /* ── Pecah Bon Entries Data (Operasional View) ── */
  const [pecahBonData, setPecahBonData] = useState<
    PaginatedResult<PecahBonEntry>
  >({
    items: [],
    page: 1,
    limit: ROWS_PER_PAGE,
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
  ) => {
    setLoading(true);
    try {
      if (tab === "operasional") {
        const [pbRes, frRes] = await Promise.all([
          getPecahBonHistoryPaginated({
            page: page + 1,
            limit: ROWS_PER_PAGE,
            search: query || undefined,
            from: from || undefined,
            to: to || undefined,
          }),
          getFinishReceipts({
            page: 1,
            limit: 100,
            search: query || undefined,
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
          limit: ROWS_PER_PAGE,
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

  const buildCsvOperasional = (exportRows: PecahBonEntry[], startIndex = 0) => {
    const headers = [
      "No",
      "ID LP",
      "Tanggal",
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
      "Rendemen (%)",
    ];
    const csvRows = exportRows.map((entry, index) => {
      const receipt = receiptsMap[entry.pecahBonId || entry.id];
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
      const netRendemen = dryIn > 0 ? ((mainOut + byProduct) / dryIn) * 100 : 0;

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
        receipt ? formatNumber(netRendemen, 2) : "-",
      ]
        .map(escapeCsv)
        .join(CSV_DELIMITER);
    });
    return { headers, csvRows };
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
      "Rendemen (%)",
      "Tarif / Gram (Rp)",
      "Total Upah Payroll (Rp)",
    ];
    const csvRows = exportRows.map((item, index) => {
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
      const netRendemen = dryIn > 0 ? ((mainOut + byProduct) / dryIn) * 100 : 0;

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
        formatNumber(netRendemen, 2),
        item.payroll?.rateRpPerGram ?? 0,
        item.payroll?.amountRp ?? 0,
      ]
        .map(escapeCsv)
        .join(CSV_DELIMITER);
    });
    return { headers, csvRows };
  };

  const downloadCsv = (
    content: { headers: string[]; csvRows: string[] },
    fileName: string,
  ) => {
    if (content.csvRows.length === 0) {
      toast.error("Tidak ada data untuk diunduh.");
      return;
    }
    const csvContent = `\uFEFF${[content.headers.join(CSV_DELIMITER), ...content.csvRows].join("\r\n")}`;
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

  const downloadExcelPage = () => {
    setExporting("page");
    try {
      if (viewTab === "manager") {
        const exportRows =
          selectedActiveReceiptRows.length > 0
            ? selectedActiveReceiptRows
            : receiptsData.items;
        const csv = buildCsvManager(exportRows, currentPage * ROWS_PER_PAGE);
        downloadCsv(
          csv,
          `riwayat-setoran-manager-page-${currentPage + 1}-${new Date().toISOString().slice(0, 10)}.csv`,
        );
        toast.success(`Berhasil mengunduh ${exportRows.length} baris.`);
      } else {
        const exportRows =
          selectedActivePecahBonRows.length > 0
            ? selectedActivePecahBonRows
            : pecahBonData.items;
        const csv = buildCsvOperasional(
          exportRows,
          currentPage * ROWS_PER_PAGE,
        );
        downloadCsv(
          csv,
          `riwayat-pecah-bon-operasional-page-${currentPage + 1}-${new Date().toISOString().slice(0, 10)}.csv`,
        );
        toast.success(`Berhasil mengunduh ${exportRows.length} baris.`);
      }
    } finally {
      setExporting(null);
    }
  };

  const fromRow = activeTotal === 0 ? 0 : currentPage * ROWS_PER_PAGE + 1;
  const toRow = Math.min((currentPage + 1) * ROWS_PER_PAGE, activeTotal);

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
                  setCurrentPage(0);
                  void loadPage(0, "", "", "", viewTab);
                }}
                disabled={loading}
              >
                Reset
              </Button>
            </div>
          </div>
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
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={downloadExcelPage}
                disabled={loading || activeRowCount === 0 || exporting !== null}
                className="bg-[#059833] hover:bg-[#047a29]"
              >
                {exporting === "page" ? "Menyiapkan..." : "Download CSV"}
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
                      Rendemen (%)
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
                      const netRendemen =
                        dryIn > 0 ? ((mainOut + byProduct) / dryIn) * 100 : 0;

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
                            {formatNumber(netRendemen, 1)}%
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
                    <th className="px-3 py-2.5 text-left font-bold">Tanggal</th>
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
                      Rendemen (%)
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
                      const netRendemen =
                        dryIn > 0 ? ((mainOut + byProduct) / dryIn) * 100 : 0;
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
                          <td className="px-3 py-2.5 text-gray-600">
                            {entry.pecahBonDate
                              ? new Date(entry.pecahBonDate).toLocaleDateString(
                                  "id-ID",
                                )
                              : "-"}
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
                            {receipt ? `${formatNumber(netRendemen, 1)}%` : "-"}
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
    <ProtectedRoute allowedRoles={["koreksi", "manager"]}>
      <KoreksiHistoryContent />
    </ProtectedRoute>
  );
}
