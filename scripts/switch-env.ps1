param(
    [ValidateSet("dev", "prod")]
    [string]$Target = "dev",

    [ValidateSet("api", "web", "all")]
    [string]$Scope = "all",

    [string]$Run = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-EnvFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $result = @{}
    Get-Content -Path $Path | ForEach-Object {
        $line = $_.Trim()
        if ([string]::IsNullOrWhiteSpace($line)) { return }
        if ($line.StartsWith("#")) { return }

        $eq = $line.IndexOf("=")
        if ($eq -lt 1) { return }

        $key = $line.Substring(0, $eq).Trim()
        $value = $line.Substring($eq + 1).Trim()

        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        $result[$key] = $value
    }

    return $result
}

function Apply-EnvFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$EnvFilePath,
        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if (-not (Test-Path -LiteralPath $EnvFilePath)) {
        throw "Env file untuk $Label tidak ditemukan: $EnvFilePath"
    }

    $values = Read-EnvFile -Path $EnvFilePath
    foreach ($entry in $values.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($entry.Key, [string]$entry.Value, "Process")
    }

    Write-Host "Loaded $($values.Count) vars from $EnvFilePath"
}

$repoRoot = Split-Path -Parent $PSScriptRoot

$apiEnvByTarget = @{
    dev  = Join-Path $repoRoot "apps/api/.env"
    prod = Join-Path $repoRoot "apps/api/.env.production"
}

$webEnvByTarget = @{
    dev  = Join-Path $repoRoot "apps/web/.env.local"
    prod = Join-Path $repoRoot "apps/web/.env.production.local"
}

if ($Scope -eq "api" -or $Scope -eq "all") {
    Apply-EnvFile -EnvFilePath $apiEnvByTarget[$Target] -Label "API-$Target"
}

if ($Scope -eq "web" -or $Scope -eq "all") {
    Apply-EnvFile -EnvFilePath $webEnvByTarget[$Target] -Label "WEB-$Target"
}

Write-Host "Environment aktif: target=$Target, scope=$Scope"

if (-not [string]::IsNullOrWhiteSpace($Run)) {
    Write-Host "Running: $Run"
    Invoke-Expression $Run
}

