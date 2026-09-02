# Rencana Perbaikan Parser Payroll — Dashboard `/performa` (Audit Dashboard)

Dokumen ini untuk dikerjakan oleh agent lain. Semua temuan sudah diverifikasi terhadap kode
dan data nyata (DB dev + file Excel sumber) — bagian "Fix" di tiap item boleh langsung
diimplementasikan tanpa investigasi ulang, kecuali disebutkan lain.

Modul terkait: `apps/api/src/modules/audit-dashboard/`
- `audit-dashboard.parser.ts` — parsing Excel murni (tidak menyentuh DB).
- `audit-dashboard.service.ts` — `importWorkbook()` (upsert Person + replace Period+Metric).
- `audit-dashboard.parser.spec.ts` — unit test parser, sudah ada banyak `describe` block
  (`parseWorkbook`, `normalizeUserLevel`, dll) yang jadi referensi gaya test.

**Catatan konteks penting**: commit `89c409d0` sengaja me-revert `audit-dashboard.parser.ts`,
`audit-dashboard.service.ts`, `schema.prisma`, controller, dan `apps/web/app/performa/page.tsx`
di branch `main` ke versi lama (tanpa dukungan payroll). Working tree saat ini masih menyimpan
versi WIP yang lebih baru (uncommitted) — file-file itu akan tetap muncul `M` di `git status`.
Semua perbaikan di dokumen ini dikerjakan di atas versi **uncommitted/WIP** yang sudah ada di
working tree, BUKAN versi lama di `main`.

---

## Item 1 (prioritas tertinggi): Gaji default bulanan tidak berlaku untuk orang dengan 1 baris

### Masalah
Di `consolidateRows()` (`audit-dashboard.parser.ts`, sekitar baris 530–613), fallback gaji
bulanan (HK × Rp 60.000) hanya dieksekusi di cabang `else` (multi-row):

```ts
for (const [normName, rows] of byPerson) {
  if (rows.length === 1) {
    consolidated.push({ ...rows[0], rowNumber: rowIdx++ }); // <-- tidak lewat fallback sama sekali
  } else {
    // ...
    if (isBulanan && (netWageRp === null || netWageRp === 0) && hk !== null && hk > 0) {
      netWageRp = hk * 60_000;
    }
    // ...
  }
}
```

Orang yang cuma py 1 baris mentah untuk periode itu (format lama satu-sheet, atau di format
baru cuma nyantol di salah satu dari dua sheet) tidak pernah dapat default ini →
`netWageRp` tetap `null` → di UI tampil "Data Payroll Belum Diunggah" walau sebenarnya dia
anak bulanan yang seharusnya tetap dapat Rp 60.000/HK.

Dampak nyata di DB dev saat ini: **158 dari 184 baris metric bulanan** kena bug ini
(hampir semua periode kecuali "23-29 JULI 26" yang kebetulan banyak org py multi-row).

### Fix
Pindahkan logic fallback keluar dari percabangan `if/else`, jadi satu langkah post-processing
yang berlaku ke SEMUA baris hasil konsolidasi (baik yang dari cabang 1-row maupun multi-row).
Cara paling bersih: setelah loop `for (const [normName, rows] of byPerson)` selesai mengisi
`consolidated`, jalankan satu pass tambahan di atas `consolidated`:

```ts
function applyBulananWageFallback(row: ParsedMetricRow): ParsedMetricRow {
  const isBulanan = /bulanan/i.test(row.normalizedLevel ?? row.rawUserLevel ?? '');
  if (isBulanan && (row.netWageRp === null || row.netWageRp === 0) && row.hk !== null && row.hk > 0) {
    return { ...row, netWageRp: row.hk * 60_000 };
  }
  return row;
}
```

Lalu:
1. Hapus blok `if (isBulanan && ...) { netWageRp = hk * 60_000; }` dari dalam cabang `else`
   (baris ~579–586) — termasuk variabel `isBulanan` yang sekarang tidak dipakai di situ lagi
   (biarkan `netWageRp = firstNonNull((r) => r.netWageRp)` apa adanya, tanpa modifikasi).
2. Ganti baris `return consolidated;` di akhir fungsi jadi
   `return consolidated.map(applyBulananWageFallback);`

Efeknya: baik baris single-row maupun multi-row sama-sama lewat fallback yang sama, tidak ada
duplikasi logic, dan perilaku existing untuk kasus yang sudah benar (mis. ALFIAN — lihat Item 2)
tidak berubah karena fallback ini hanya menyentuh baris yang levelnya "bulanan" DAN
`netWageRp` masih null/0.

### Test yang perlu ditambahkan
Di `audit-dashboard.parser.spec.ts`, tambahkan test di `describe('parseWorkbook', ...)`:
buat 1 sheet format lama (1 baris per orang, tanpa kolom payroll) dengan 1 orang ber-level
"BULANAN" dan HK terisi (mis. 6) — assert hasil `netWageRp === 6 * 60_000`. Ini mengcover
kasus yang sebelumnya lolos dari fallback.

---

## Item 2: Data ALFIAN di DB dev basi (bukan bug kode)

Menjalankan ulang parser versi WIP saat ini langsung terhadap
`apps/web/public/Dashboard/DATA PERCOBAAN.xlsx` menghasilkan data yang **sudah benar** untuk
ALFIAN FAIZ ROMADHONI: `rawUserLevel: "Mitra Mandiri"`, `netWageRp: 1.093.857,57`
(cocok dengan yang ditampilkan user). Tapi baris metric yang tersimpan di DB dev untuk
periode "23-29 JULI 26" py `rawUserLevel: "BULANAN"` — timestamp `createdAt`-nya ~12 detik
lebih telat dari baris lain di batch sync yang sama, mengindikasikan itu diimport pakai
iterasi parser yang lebih lama (sebelum alias header "level mitra" ditambahkan).

### Fix
Tidak perlu ubah kode. Setelah Item 1 selesai dan sudah lolos test, re-upload/re-import file
`DATA PERCOBAAN.xlsx` untuk periode "23-29 JULI 26" lewat fitur upload di aplikasi
(`importWorkbook()` di `audit-dashboard.service.ts` sudah menghapus `AuditDashboardPeriod`
lama untuk label yang sama sebelum menulis ulang — jadi re-import aman, tidak akan
menduplikasi data). Verifikasi setelah re-import: cek row ALFIAN di UI/DB sudah
`rawUserLevel = "Mitra Mandiri"`.

**Jangan reset DB dev** — DB ini menyimpan data sync produksi asli yang dipakai fitur lain
(lihat memory `baku-spec-fails-on-seeded-dev-db.md`). Re-import satu periode lewat fitur
upload aplikasi itu aman dan tidak melibatkan reset.

---

## Item 3: Formula Excel tanpa cached value → banyak sel kebaca `null`

### Masalah
`readCellValue()` (`audit-dashboard.parser.ts` baris ~365–382) mengembalikan `null` untuk sel
yang isinya formula tapi tidak punya cached result:

```ts
if ("formula" in obj || "sharedFormula" in obj) return null;
```

Ini bukan bug — ExcelJS memang cuma baca cached value terakhir yang disimpan Excel, tidak bisa
menghitung formula sendiri. Scan terhadap sheet "REKAP PAYROLL 23 - 29 JULI 26" di
`DATA PERCOBAAN.xlsx` (151 baris data) menemukan sel formula tanpa cached result sebanyak:

| Kolom | Baris ke-null |
|---|---|
| UPAH BORONG | 2 |
| SUBSIDI | 42 |
| PREMI | 47 |
| UANG MAKAN | 19 |
| POTONGAN | 115 / 151 (76%!) |
| UPAH BERSIH | 2 |

Beberapa formula mereferensi workbook eksternal (pola `[1]Rekap!...`) — kemungkinan besar
penyebabnya file sumber disimpan tanpa link ke workbook itu ter-update/ter-recalculate. Ini
kemungkinan penyebab utama keluhan umum "rendemen dll masih banyak yang miss", terpisah dari
Item 1 dan Item 2.

### Fix — dua bagian

**(a) Perbaikan proses (di luar kode, tidak butuh implementasi)**: sebelum upload, buka file
di Excel → `Data → Edit Links → Update Values` (atau `Ctrl+Alt+F9` untuk full recalc), lalu
simpan ulang supaya semua formula punya cached value. Sampaikan ini sebagai SOP ke
tim yang menyiapkan file, di luar scope kode.

**(b) Perbaikan kode (deteksi + surface warning, supaya "miss" kelihatan di UI, bukan diam-diam
jadi strip)** — scope medium, lakukan sebagai berikut:

1. Tambah field `hadUncachedFormula: boolean` di `CellSnapshot` (`audit-dashboard.parser.ts`
   baris ~143–146).
2. Saat membangun grid di `parseWorkbook()` (baris ~669–686), set flag ini `true` kalau
   `effectiveValue` adalah object dengan `"formula" in obj || "sharedFormula" in obj` DAN tidak
   ada `"result" in obj`.
3. Di `parseRawRowsFromGrid()`, saat membangun tiap `ParsedMetricRow`, cek kolom-kolom payroll
   (`pieceworkWage`, `subsidy`, `premium`, `mealAllowance`, `deduction`, `netWage`) — kalau
   `cellAt(key)` punya `hadUncachedFormula === true`, catat ke array warning baru, mis.:
   ```ts
   type ParseWarning = { rowNumber: number; rawName: string; column: ColumnKey; message: string };
   ```
4. Salurkan `warnings: ParseWarning[]` ke `ParsedPeriod` dan gabungkan semua jadi
   `ParsedWorkbook.warnings`.
5. Di `audit-dashboard.service.ts`, `importWorkbook()` — simpan warnings ini (mis. field JSON
   baru `warnings` di model `AuditDashboardImport` pada `schema.prisma`, butuh migration) dan
   kembalikan lewat response upload supaya frontend bisa tampilkan banner seperti
   "23 sel di file sumber belum ter-recalculate (kolom: SUBSIDI, PREMI, POTONGAN) — minta
   file sumber di-update-link & save ulang di Excel sebelum upload lagi."
6. Tambah test di `audit-dashboard.parser.spec.ts`: sheet dengan 1 sel formula
   `{ formula: '...' }` tanpa `result` di kolom payroll → assert warning muncul dengan
   `column` dan `rowNumber` yang benar, dan nilai kolom itu tetap `null` seperti sekarang
   (perilaku parsing nilai tidak berubah, cuma ditambah observability).

Bagian (b) opsional untuk dikerjakan sekarang — bisa jadi fast-follow terpisah kalau ingin
fokus dulu ke Item 1 & Item 4. Tapi WAJIB didokumentasikan ke user kalau tidak dikerjakan,
supaya user tahu kenapa data masih suka "miss" walau Item 1 & 4 sudah beres.

---

## Item 4: Fitur nama gabung koma — 1 LP dikerjakan berdua (atau lebih)

### Aturan bisnis (dikonfirmasi user, jangan diubah tanpa tanya ulang)
- **HK**: TIDAK diambil/dibagi dari baris LP yang namanya digabung koma. HK tiap orang
  tetap dari data absensi individu masing-masing (baris terpisah di sheet Rekap Payroll,
  yang sudah punya HK per-orang independen dari LP). Kalau orang itu berangkat 6 hari, HK-nya
  6; kalau 3 hari, HK-nya 3 — nilai ini tidak boleh disentuh oleh logic split LP-berdua.
- **Baku basah / BJD (rendemen)**: DI-SPLIT rata ke tiap nama yang tercantum (2 nama → dibagi
  2 / masing-masing 50%; N nama → masing-masing 1/N).
- **Upah**: TIDAK di-split. Alasan user: baris koma-gabung ini biasanya untuk "anak bulanan"
  (bukan borong/piece-rate), dan anak bulanan gajinya tetap flat Rp 60.000/hari berdasarkan
  HK-nya sendiri (lihat Item 1), independen dari output produksi LP yang mana pun. Jadi
  field upah (`pieceworkWageRp`, `subsidyRp`, `premiumRp`, `mealAllowanceRp`, `deductionRp`,
  `netWageRp`) pada baris hasil split TIDAK perlu dibagi maupun dinolkan — biarkan senilai
  aslinya (di sheet LP-detail kolom-kolom ini pada praktiknya kosong/0 untuk baris anak
  bulanan, jadi secara efektif tidak berpengaruh; jangan bikin logic pembagian upah baru).

**Catatan/edge case untuk masa depan (jangan diimplementasikan sekarang, cukup dicatat)**:
kalau suatu saat ada baris LP borong (piece-rate) yang juga namanya digabung koma, field
`pieceworkWageRp` mestinya perlu ikut di-split — tapi user bilang skenario itu belum pernah
terjadi ("biasanya anak bulanan"), jadi jangan bikin logic itu sekarang, cukup dikomentari
di kode sebagai catatan.

### Implementasi
Data sample yang ada sekarang (`DATA PERCOBAAN.xlsx` sheet "DATA PERIODE 23 - 29 JULI 26",
511 baris) tidak punya satupun contoh nama berkoma — jadi tidak ada ground truth nyata untuk
diverifikasi. Implementasikan berdasarkan spesifikasi di atas, dan tambahkan unit test sintetis
(bikin sheet kecil pakai `exceljs` langsung di file spec, ikuti pola test lain di
`audit-dashboard.parser.spec.ts`) untuk verifikasi behavior karena tidak ada file nyata
yang bisa dipakai.

Lokasi perubahan: `parseRawRowsFromGrid()` (`audit-dashboard.parser.ts`, baris ~439–528), tepat
di titik pembacaan nama:

```ts
const nameCell = row[columns.nama]?.value;
if (isBlank(nameCell)) continue;

const rawName = String(nameCell).trim().replace(/\s+/g, " ");
```

Ubah jadi: deteksi koma pada `rawName`, split jadi array nama. Kalau hasil split > 1:
- Bagi `totalBakuBasah` dan `totalBjd` masing-masing dengan `names.length` untuk SETIAP
  entry hasil split (bukan dikurangi/dipotong — nilai originalnya tetap dibaca dulu dari sel,
  baru dibagi rata).
- Set `hk: null` secara eksplisit untuk tiap entry hasil split (jangan ambil dari
  `cellAt("hk").value` sama sekali) — beri komentar kenapa (biar tidak "diperbaiki" balik
  di masa depan oleh orang yang tidak tahu konteks ini).
- `rendemenPctBps`, `susutProsesPctBps`, `susutHilangPctBps`: salin apa adanya ke semua entry
  hasil split (rasio tidak berubah walau baku-basah/BJD dibagi rata, karena pembagiannya
  proporsional).
- Field upah (`pieceworkWageRp`, `subsidyRp`, `premiumRp`, `mealAllowanceRp`, `deductionRp`,
  `netWageRp`): salin nilai asli (tidak dibagi) ke semua entry hasil split — lihat alasan di
  atas.
- `rawName`/`normalizedName`: masing-masing entry pakai satu nama hasil split (trim +
  normalize masing-masing).
- `rowNumber`: boleh duplikat nomor baris Excel yang sama untuk tiap entry hasil split — ini
  aman karena `consolidateRows()` toh akan menomori ulang (`rowNumber: rowIdx++`) baris hasil
  konsolidasi akhir; `rowNumber` di raw row cuma dipakai untuk debugging/rawRowJson, bukan key.
- `rawRowJson`: salin objek yang sama (shallow copy) ke tiap entry; opsional tambahkan
  `_splitFromLp: rawName` (nama gabungan asli) untuk kemudahan audit/debug kalau ada yang
  aneh di kemudian hari.

Setelah split ini, alur existing `consolidateRows()` otomatis bekerja dengan benar TANPA
perlu diubah lagi (di luar Item 1): tiap orang hasil split akan ketemu dengan baris mereka
sendiri dari sheet Rekap Payroll (yang punya HK & level asli) saat dikelompokkan by
`normalizedName`, lalu `sum()` menjumlah totalBakuBasah/totalBjd dari SEMUA baris orang itu
(termasuk baris-baris hasil split dari LP yang dikerjakan berdua) dan `firstNonNull()` akan
mengambil HK dari baris Rekap Payroll (karena baris split sengaja diberi `hk: null`).

### Contoh kasus untuk test
Sheet dengan baris LP: `NAMA = "BUDI, SITI"`, `BERAT BASAH = 100`, `BERAT JADI = 60` →
harus menghasilkan 2 raw row: BUDI (`totalBakuBasah: 50, totalBjd: 30, hk: null`) dan SITI
(sama). Kombinasikan dengan baris Rekap Payroll terpisah untuk BUDI (`HK: 6`, level "BULANAN")
dan SITI (`HK: 4`, level "BULANAN") di sheet lain periode yang sama — assert hasil akhir
setelah `parseWorkbook()`: BUDI dapat `hk: 6`, `netWageRp: 6*60_000`, `totalBakuBasah` include
50 dari LP gabungan itu (plus tambahan kalau BUDI juga ada di LP lain sendirian); SITI dapat
`hk: 4`, `netWageRp: 4*60_000`, dst.

---

## Urutan pengerjaan yang disarankan
1. Item 1 (fix + test) — paling kecil, paling berdampak (158 baris di DB dev langsung
   ke-fix begitu di-reimport).
2. Item 4 (fix + test sintetis) — fitur baru sesuai spesifikasi user.
3. Item 2 — re-import periode "23-29 JULI 26" via UI setelah Item 1 & 4 di-deploy ke dev.
4. Item 3(b) — kalau ada waktu/scope; kalau tidak, minimal sampaikan Item 3(a) sebagai SOP ke
   user/tim penyiap file Excel.

Jalankan `npm test -- audit-dashboard` (atau path spec yang sesuai) di `apps/api` setelah tiap
item selesai untuk memastikan tidak ada regresi di test yang sudah ada.
