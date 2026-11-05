-- Akun hanya-lihat (read-only): semua aksi tulis ditolak di API.
ALTER TABLE "AppUser" ADD COLUMN "readOnly" BOOLEAN NOT NULL DEFAULT false;
