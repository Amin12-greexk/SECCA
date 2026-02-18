param(
    [Parameter(Mandatory = $true)]
    [string]$SshHost,

    [Parameter(Mandatory = $true)]
    [string]$DbContainer,

    [string]$RemoteDumpPath = "/tmp/secca_source.dump",
    [string]$LocalDumpPath = "",
    [string]$LocalBackupDir = "backups",

    [string]$LocalDbHost = "localhost",
    [int]$LocalDbPort = 5433,
    [string]$LocalDbUser = "postgres",
    [string]$LocalDbPassword = "postgres",
    [string]$LocalDbName = "secca_local",

    [string]$PgDumpPath = "",
    [string]$PgImage = "postgres:17",

    [switch]$SkipLocalDump
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-PgDumpPath {
    param([string]$ExplicitPath)

    if (-not [string]::IsNullOrWhiteSpace($ExplicitPath)) {
        if (-not (Test-Path -LiteralPath $ExplicitPath)) {
            throw "pg_dump tidak ditemukan di path: $ExplicitPath"
        }
        return $ExplicitPath
    }

    $cmd = Get-Command pg_dump -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    $candidates = @(
        "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
        "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    throw "pg_dump tidak ditemukan. Install PostgreSQL client atau beri -PgDumpPath."
}

if (-not $SkipLocalDump) {
    if ([string]::IsNullOrWhiteSpace($LocalDumpPath)) {
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupRoot = Join-Path (Get-Location) $LocalBackupDir
        New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
        $LocalDumpPath = Join-Path $backupRoot ("secca_local_{0}.dump" -f $timestamp)
    }

    $resolvedPgDumpPath = Resolve-PgDumpPath -ExplicitPath $PgDumpPath
    Write-Host "Creating local dump: $LocalDumpPath"

    $previousPassword = $env:PGPASSWORD
    $env:PGPASSWORD = $LocalDbPassword
    try {
        & $resolvedPgDumpPath -h $LocalDbHost -p $LocalDbPort -U $LocalDbUser -d $LocalDbName -Fc -f $LocalDumpPath
        if ($LASTEXITCODE -ne 0) {
            throw "pg_dump gagal dengan exit code $LASTEXITCODE"
        }
    }
    finally {
        $env:PGPASSWORD = $previousPassword
    }
}

if ([string]::IsNullOrWhiteSpace($LocalDumpPath)) {
    throw "LocalDumpPath wajib diisi jika -SkipLocalDump dipakai."
}

if (-not (Test-Path -LiteralPath $LocalDumpPath)) {
    throw "Dump lokal tidak ditemukan: $LocalDumpPath"
}

Write-Host "Uploading dump to server: $RemoteDumpPath"
& scp $LocalDumpPath "${SshHost}:${RemoteDumpPath}"
if ($LASTEXITCODE -ne 0) {
    throw "SCP gagal dengan exit code $LASTEXITCODE"
}

$remoteScript = @'
set -euo pipefail

DB_CONTAINER="__DB_CONTAINER__"
REMOTE_DUMP="__REMOTE_DUMP__"
PG_IMAGE="__PG_IMAGE__"

TS=$(date +%Y%m%d_%H%M%S)
PROD_BACKUP="/tmp/prod_before_restore_${TS}.dump"

echo "[1/5] backup prod database..."
docker exec "$DB_CONTAINER" sh -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f '"$PROD_BACKUP"
docker cp "$DB_CONTAINER:$PROD_BACKUP" "$HOME/prod_before_restore_${TS}.dump"

echo "[2/5] copy source dump into db container..."
docker cp "$REMOTE_DUMP" "$DB_CONTAINER:/tmp/secca_source.dump"

echo "[3/5] read db credentials from container env..."
DB_USER=$(docker exec "$DB_CONTAINER" sh -lc 'printf %s "$POSTGRES_USER"')
DB_PASS=$(docker exec "$DB_CONTAINER" sh -lc 'printf %s "$POSTGRES_PASSWORD"')
DB_NAME=$(docker exec "$DB_CONTAINER" sh -lc 'printf %s "$POSTGRES_DB"')

echo "[4/5] restore dump..."
docker run --rm \
  --network "container:$DB_CONTAINER" \
  -e PGPASSWORD="$DB_PASS" \
  -v /tmp/secca_source.dump:/tmp/secca_source.dump:ro \
  "$PG_IMAGE" \
  sh -lc "pg_restore -h 127.0.0.1 -p 5432 -U \"$DB_USER\" -d \"$DB_NAME\" --clean --if-exists --no-owner --no-privileges /tmp/secca_source.dump"

echo "[5/5] quick verification..."
docker exec "$DB_CONTAINER" sh -lc 'export PGPASSWORD="$POSTGRES_PASSWORD"; psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) as raw_batches from \"RawBatch\";" -c "select count(*) as pecah_bon_entries from \"PecahBonEntry\";" -c "select count(*) as users from \"AppUser\";"'

echo "restore done. backup saved at: $HOME/prod_before_restore_${TS}.dump"
'@

$remoteScript = $remoteScript.Replace("__DB_CONTAINER__", $DbContainer)
$remoteScript = $remoteScript.Replace("__REMOTE_DUMP__", $RemoteDumpPath)
$remoteScript = $remoteScript.Replace("__PG_IMAGE__", $PgImage)

Write-Host "Running remote backup + restore..."
$remoteScript | & ssh $SshHost "bash -s"
if ($LASTEXITCODE -ne 0) {
    throw "Remote restore gagal dengan exit code $LASTEXITCODE"
}

Write-Host "Sync selesai."
Write-Host "Local dump: $LocalDumpPath"

