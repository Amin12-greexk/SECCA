param(
    [Parameter(Mandatory = $true)]
    [string]$SshHost,

    [Parameter(Mandatory = $true)]
    [string]$DbContainer,

    [string]$RemoteDumpPath = "/tmp/secca_prod_dump.dump",
    [string]$LocalBackupDir = "backups",
    [string]$LocalDbContainer = "secca-db",
    [string]$LocalDbName = "secca_local",
    [string]$LocalDbUser = "postgres",
    [string]$LocalDbPassword = "postgres",

    # Ambil dump produksi dan simpan di backups/, tanpa restore ke local DB.
    [switch]$DownloadOnly,

    # Lewati prompt konfirmasi restore local. Tetap membuat backup local kecuali -SkipLocalBackup.
    [switch]$Force,

    # Guard default hanya mengizinkan target local/dev. Pakai ini hanya bila benar-benar sadar targetnya aman.
    [switch]$AllowNonLocalTarget,

    # Tidak disarankan. Untuk keamanan, hanya boleh dipakai bersama -Force.
    [switch]$SkipLocalBackup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-CommandExists {
    param([string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Command '$Name' tidak ditemukan. Pastikan '$Name' tersedia di PATH."
    }
}

function Assert-SafeToken {
    param(
        [string]$Value,
        [string]$Label
    )

    if ($Value -notmatch '^[A-Za-z0-9_.-]+$') {
        throw "$Label hanya boleh berisi huruf, angka, titik, underscore, atau dash: $Value"
    }
}

function Assert-SafeRemoteDumpPath {
    param([string]$Path)

    if ($Path -notmatch '^/tmp/[A-Za-z0-9_.-]+\.dump$') {
        throw "RemoteDumpPath harus berbentuk /tmp/nama_file.dump agar aman dibersihkan. Nilai sekarang: $Path"
    }
}

function Assert-SafeLocalTarget {
    if ($AllowNonLocalTarget) {
        Write-Warning "AllowNonLocalTarget aktif. Pastikan target restore benar-benar database development/local."
        return
    }

    $dbLooksLocal = $LocalDbName -match '(?i)(local|dev|development|test)'
    $containerLooksLocal = $LocalDbContainer -match '^(secca-db|.*local.*|.*dev.*|.*test.*)$'

    if (-not $dbLooksLocal -or -not $containerLooksLocal) {
        throw @"
Target local tidak lolos safety guard.
  LocalDbContainer: $LocalDbContainer
  LocalDbName     : $LocalDbName

Script ini hanya untuk tarik data ke development/local. Jika target ini memang aman,
jalankan ulang dengan -AllowNonLocalTarget.
"@
    }
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command,
        [Parameter(Mandatory = $true)]
        [string]$ErrorMessage
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw $ErrorMessage
    }
}

function Confirm-LocalRestore {
    if ($DownloadOnly -or $Force) {
        return
    }

    Write-Host ""
    Write-Warning "Restore akan MENGGANTI isi database local '$LocalDbName' di container '$LocalDbContainer'."
    Write-Host "Backup local akan dibuat dulu sebelum restore."
    $answer = Read-Host "Ketik nama database target ($LocalDbName) untuk lanjut"

    if ($answer -ne $LocalDbName) {
        throw "Dibatalkan. Jawaban tidak sama dengan nama database target."
    }
}

Assert-CommandExists "ssh"
Assert-CommandExists "scp"
Assert-SafeToken -Value $DbContainer -Label "DbContainer"
Assert-SafeRemoteDumpPath -Path $RemoteDumpPath

if (-not $DownloadOnly) {
    Assert-CommandExists "docker"
    Assert-SafeToken -Value $LocalDbContainer -Label "LocalDbContainer"
    Assert-SafeLocalTarget
}

if ($SkipLocalBackup -and -not $Force -and -not $DownloadOnly) {
    throw "-SkipLocalBackup hanya boleh dipakai bersama -Force. Default aman: backup local dulu."
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupRoot = Join-Path (Get-Location) $LocalBackupDir
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

$safeLocalDbName = $LocalDbName -replace '[^A-Za-z0-9_.-]', '_'
$localBackupFile = Join-Path $backupRoot ("{0}_before_pull_{1}.dump" -f $safeLocalDbName, $timestamp)
$localDownloadedDump = Join-Path $backupRoot ("secca_prod_pull_{0}.dump" -f $timestamp)
$localContainerDump = "/tmp/secca_prod_pull.dump"
$stepTotal = if ($DownloadOnly) { 3 } else { 6 }

Write-Host "Tarik data produksi -> development"
Write-Host "  SSH host       : $SshHost"
Write-Host "  Prod container : $DbContainer"
Write-Host "  Local target   : $LocalDbContainer / $LocalDbName"
Write-Host "  Mode           : $(if ($DownloadOnly) { 'download-only' } else { 'download + restore local' })"
Write-Host ""

Confirm-LocalRestore

# 1. Backup local database before overwrite.
if (-not $DownloadOnly) {
    if (-not $SkipLocalBackup) {
        Write-Host "[1/$stepTotal] Backing up local database..."

        Invoke-Checked -ErrorMessage "Container local tidak ditemukan atau Docker tidak bisa mengaksesnya: $LocalDbContainer" -Command {
            docker container inspect $LocalDbContainer | Out-Null
        }

        Invoke-Checked -ErrorMessage "Gagal melakukan backup database lokal di dalam container." -Command {
            docker exec -e PGPASSWORD=$LocalDbPassword $LocalDbContainer pg_dump -U $LocalDbUser -d $LocalDbName -Fc -f "/tmp/local_backup.dump"
        }

        Invoke-Checked -ErrorMessage "Gagal mengunduh file backup lokal dari container." -Command {
            docker cp "${LocalDbContainer}:/tmp/local_backup.dump" "$localBackupFile"
        }

        docker exec $LocalDbContainer rm -f "/tmp/local_backup.dump" | Out-Null
        Write-Host "Backup lokal disimpan di: $localBackupFile"
    } else {
        Write-Warning "[1/$stepTotal] Local backup dilewati karena -SkipLocalBackup aktif."
    }
} else {
    Write-Host "[1/$stepTotal] DownloadOnly aktif; backup/restore local dilewati."
}

# 2. Generate dump on production server. This is read-only against the production DB.
Write-Host "[2/$stepTotal] Generating database dump on production server..."
$remoteScript = @'
set -euo pipefail

DB_CONTAINER="__DB_CONTAINER__"
REMOTE_DUMP="__REMOTE_DUMP__"

echo "Reading database credentials from container environment..."
DB_USER=$(docker exec "$DB_CONTAINER" sh -lc 'printf %s "$POSTGRES_USER"')
DB_PASS=$(docker exec "$DB_CONTAINER" sh -lc 'printf %s "$POSTGRES_PASSWORD"')
DB_NAME=$(docker exec "$DB_CONTAINER" sh -lc 'printf %s "$POSTGRES_DB"')

echo "Running pg_dump inside container..."
docker exec "$DB_CONTAINER" sh -lc "export PGPASSWORD=\"$DB_PASS\"; pg_dump -U \"$DB_USER\" -d \"$DB_NAME\" -Fc -f \"/tmp/prod_dump.dump\""

echo "Copying dump file out of container..."
docker cp "$DB_CONTAINER:/tmp/prod_dump.dump" "$REMOTE_DUMP"

echo "Cleaning up inside container..."
docker exec "$DB_CONTAINER" rm -f "/tmp/prod_dump.dump"

echo "Done"
'@

$remoteScript = $remoteScript.Replace("__DB_CONTAINER__", $DbContainer)
$remoteScript = $remoteScript.Replace("__REMOTE_DUMP__", $RemoteDumpPath)

$remoteScript | & ssh $SshHost "bash -s"
if ($LASTEXITCODE -ne 0) {
    throw "Gagal membuat database dump di server produksi."
}

# 3. Download dump from server.
Write-Host "[3/$stepTotal] Downloading dump from server..."
# Use a relative path for scp so Windows drive letter 'C:' is not interpreted as an scp host.
$scpDest = "./$LocalBackupDir/secca_prod_pull_${timestamp}.dump"
& scp "${SshHost}:${RemoteDumpPath}" "$scpDest"
if ($LASTEXITCODE -ne 0) {
    throw "Gagal mengunduh file dump dari server."
}

if (-not (Test-Path -LiteralPath $localDownloadedDump)) {
    throw "File dump tidak ditemukan setelah download: $localDownloadedDump"
}

Write-Host "Cleaning up dump on remote server host..."
& ssh $SshHost "rm -f $RemoteDumpPath"
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Dump remote gagal dibersihkan: $RemoteDumpPath"
}

if ($DownloadOnly) {
    Write-Host ""
    Write-Host "Download selesai. Tidak ada restore local karena -DownloadOnly aktif."
    Write-Host "File dump produksi disimpan di: $localDownloadedDump"
    return
}

# 4. Copy downloaded dump to local container.
Write-Host "[4/$stepTotal] Copying downloaded dump into local container..."
Invoke-Checked -ErrorMessage "Gagal menyalin file dump ke local container." -Command {
    docker cp "$localDownloadedDump" "${LocalDbContainer}:$localContainerDump"
}

try {
    # 5. Restore dump into local database.
    Write-Host "[5/$stepTotal] Restoring dump to local database..."
    Invoke-Checked -ErrorMessage "Gagal melakukan restore database lokal." -Command {
        docker exec -e PGPASSWORD=$LocalDbPassword $LocalDbContainer pg_restore -U $LocalDbUser -d $LocalDbName --clean --if-exists --no-owner --no-privileges "$localContainerDump"
    }
}
finally {
    docker exec $LocalDbContainer rm -f "$localContainerDump" | Out-Null
}

# 6. Verify local restore.
Write-Host "[6/$stepTotal] Verifying restore..."
docker exec -e PGPASSWORD=$LocalDbPassword $LocalDbContainer psql -U $LocalDbUser -d $LocalDbName -c 'SELECT COUNT(id) AS raw_batches_count FROM "RawBatch"'
docker exec -e PGPASSWORD=$LocalDbPassword $LocalDbContainer psql -U $LocalDbUser -d $LocalDbName -c 'SELECT COUNT(id) AS users_count FROM "AppUser"'

Write-Host ""
Write-Host "Tarik data selesai."
Write-Host "Backup local sebelum restore : $localBackupFile"
Write-Host "Dump produksi tersimpan      : $localDownloadedDump"
