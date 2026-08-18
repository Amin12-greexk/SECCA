-- WorkOrderItem.lotId sebelumnya UNIQUE penuh. Akibatnya begitu sebuah item
-- di-cancel, barisnya (yang sengaja disimpan sebagai riwayat) tetap memegang
-- lotId tersebut, sehingga lot itu TIDAK BISA di-assign ke siapa pun lagi:
-- assignLot menemukan baris CANCELED itu lalu melempar
-- "Lot sudah di-assign ke worker lain". Efeknya cancel order selalu gagal
-- (jalur reassign) atau mengunci lot selamanya (jalur cancel biasa).
--
-- Aturan yang sebenarnya diinginkan: satu lot hanya boleh punya SATU item
-- AKTIF, tapi boleh punya berapa pun item CANCELED sebagai riwayat.
-- Itu diekspresikan sebagai partial unique index.

DROP INDEX IF EXISTS "WorkOrderItem_lotId_key";

CREATE INDEX IF NOT EXISTS "WorkOrderItem_lotId_idx"
  ON "WorkOrderItem"("lotId");

CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrderItem_lotId_active_key"
  ON "WorkOrderItem"("lotId")
  WHERE status <> 'CANCELED';
