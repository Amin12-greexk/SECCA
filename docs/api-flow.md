# Secca API Flow (Ringkas)

Catatan:
- Semua endpoint (kecuali `GET /api` dan `POST /api/auth/login`) butuh Bearer token.
- Base path: `/api`
- Demo credentials:
  - Baku: `baku@secca.com` / `password`
  - Mitra: `mitra@secca.com` / `password`
  - Koreksi: `koreksi@secca.com` / `password`
  - Manager: `manager@secca.com` / `password`

## 0) Login (token)
Request:
```json
POST /api/auth/login
{
  "email": "manager@secca.com",
  "password": "password"
}
```
Response:
```json
{
  "data": {
    "user": {
      "id": "<uuid>",
      "name": "Manager Demo",
      "email": "manager@secca.com",
      "role": "manager"
    },
    "token": "<jwt>"
  },
  "meta": {
    "timestamp": "2026-01-30T02:00:00.000Z"
  }
}
```

## 1) Master data (Supplier, Grade, Worker)
- `POST /api/suppliers`
- `POST /api/grades`
- `POST /api/workers`

Contoh Supplier:
```json
POST /api/suppliers
Authorization: Bearer <jwt>
{
  "name": "PT Sumber Makmur",
  "code": "SUP-01",
  "phone": "08123456789"
}
```

## 2) Lokasi (Rak)
- `POST /api/locations` dengan `createDefaults: true` untuk membuat PRE_SALE + FINISHED.
- Rack worker akan dibuat otomatis saat bikin work-order, atau bisa dibuat manual dengan `type: "WORKER"` dan `workerId`.

```json
POST /api/locations
Authorization: Bearer <jwt>
{
  "createDefaults": true
}
```

## 3) Terima Bahan Baku (Raw Batch)
```json
POST /api/baku/receive
Authorization: Bearer <jwt>
{
  "supplierId": "<uuid>",
  "wetWeightGram": 12000,
  "receivedAt": "2026-01-30T02:00:00.000Z",
  "notes": "Batch pagi"
}
```
Response data berisi `cardNumber` (mis. `K0001/SECCA/26`) dan `qrPayload`.

## 4) Grading Raw Batch
```json
POST /api/grading/{rawBatchId}
Authorization: Bearer <jwt>
{
  "items": [
    { "gradeId": "<uuid-grade-A>", "wetWeightGram": 7000 },
    { "gradeId": "<uuid-grade-B>", "wetWeightGram": 4000 }
  ]
}
```
Hasil: list `gradedStockId` yang dipakai untuk buat lot.

## 5) Buat Lot (Manual / Auto-split)
Manual:
```json
POST /api/lots
Authorization: Bearer <jwt>
{
  "gradeId": "<uuid-grade-A>",
  "sources": [
    { "gradedStockId": "<uuid-graded-stock-1>", "wetWeightGram": 3000 }
  ],
  "moistureBps": 1200
}
```

Auto-split:
```json
POST /api/lots/auto-split
Authorization: Bearer <jwt>
{
  "gradedStockId": "<uuid-graded-stock-1>",
  "presetWeightGram": 75,
  "count": 10,
  "moistureBps": 1200
}
```

## 6) Work Order (Kirim lot ke worker)
```json
POST /api/work-orders
Authorization: Bearer <jwt>
{
  "workerId": "<uuid-worker>",
  "lotNumbers": ["LP000001/26", "LP000002/26"],
  "lane": "NEXT_DAY"
}
```

## 6.1) Board & Lane (Work Order)
Board per worker (hanya item status IN_PROGRESS):
```
GET /api/work-orders/board?workerId=<uuid-worker>
```
Response: `activeWorkOrder`, daftar item per lane (`NEXT_DAY`, `IN_PROGRESS`, `READY_TO_SUBMIT`).

Pindah lane:
```
POST /api/work-items/{id}/start
POST /api/work-items/{id}/mark-ready
```

Cancel item (kembali ke rak sementara):
```
POST /api/work-items/{id}/cancel
```

## 7) Finish (Hasil produksi & payroll)
```json
POST /api/finish
Authorization: Bearer <jwt>
{
  "workOrderItemId": "<uuid-work-order-item>",
  "returnedAt": "2026-01-30T02:30:00.000Z",
  "mainOutWeightGram": 600,
  "byProductWeightGram": 40,
  "notes": "Selesai"
}
```
Hasil: perhitungan susut + payroll entry otomatis.

Ringkasan rendemen/susut/pembayaran:
```json
GET /api/payroll/summary?from=2026-02-01&to=2026-02-29
Authorization: Bearer <jwt>
```
Opsional filter 1 mitra:
```json
GET /api/payroll/summary?from=2026-02-01&to=2026-02-29&workerId=<uuid-worker>
Authorization: Bearer <jwt>
```

## 8) Traceability
```json
GET /api/lots/{lotNumber}/trace
Authorization: Bearer <jwt>
```
Mengembalikan daftar sumber lot sampai ke supplier + raw batch.
