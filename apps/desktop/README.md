# SECCA Desktop (Electron)

## Dev

1. Jalankan backend dan web seperti biasa.
2. (Opsional) set URL yang mau dibuka:

```powershell
$env:SECCA_DESKTOP_URL = "http://localhost:3000"
```

3. Jalankan Electron:

```powershell
pnpm --filter desktop dev
```

## Pengaturan Server

Di aplikasi, pilih menu **SECCA → Pengaturan Server** untuk mengganti URL frontend
tanpa edit file. Perubahan langsung me-reload halaman utama.

## Build Installer (Windows)

```powershell
pnpm desktop:build
```

Hasil installer ada di `apps/desktop/dist`.
