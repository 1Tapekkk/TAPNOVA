param([ValidateSet('app','admin','server')][string]$Mode = 'app')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
try {
    function Test-LicenseServer {
        try { return (Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health' -TimeoutSec 2).ok -eq $true } catch { return $false }
    }
    if (-not (Test-LicenseServer)) {
        $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
        $nodeCandidates = @($(if ($nodeCommand) { $nodeCommand.Source }), (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'))
        $nodePath = $null
        foreach ($candidate in $nodeCandidates) {
            if ($candidate -and (Test-Path -LiteralPath $candidate)) {
                $nodeMajor = & $candidate -p 'parseInt(process.versions.node)'
                if ($LASTEXITCODE -eq 0 -and [int]$nodeMajor -ge 24) { $nodePath = $candidate; break }
            }
        }
        if (-not $nodePath) { throw 'Zainstaluj Node.js 24, aby uruchomic lokalny serwer licencji.' }
        $configFile = Join-Path $projectRoot 'license-server\.data\config.json'
        if (-not (Test-Path -LiteralPath $configFile)) {
            & $nodePath (Join-Path $projectRoot 'license-server\setup.cjs')
            if ($LASTEXITCODE -ne 0) { throw 'Nie udalo sie utworzyc konfiguracji serwera.' }
        }
        $serverFile = Join-Path $projectRoot 'license-server\server.cjs'
        Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverFile + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot 'license-server\.data\server.log') -RedirectStandardError (Join-Path $projectRoot 'license-server\.data\server-error.log') | Out-Null
        $deadline = (Get-Date).AddSeconds(15)
        while (-not (Test-LicenseServer)) {
            if ((Get-Date) -gt $deadline) { throw 'Serwer licencji nie wystartowal. Sprawdz license-server\.data\server-error.log.' }
            Start-Sleep -Milliseconds 300
        }
    }
    if ($Mode -eq 'admin') { Start-Process 'http://127.0.0.1:8787'; exit 0 }
    if ($Mode -eq 'server') { exit 0 }
    $appVersion = (Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
    $appPath = Join-Path $projectRoot "release\license-test-$appVersion\win-unpacked\TAPNOVA.exe"
    if (-not (Test-Path -LiteralPath $appPath)) { throw "Brak aktualnej paczki testowej $appVersion. Nie uruchomiono starego wydania." }
    $oldApps = @(Get-Process TAPNOVA -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.Path -ne $appPath -and $_.Path.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase) })
    foreach ($oldApp in $oldApps) {
        if (-not $oldApp.CloseMainWindow()) { throw 'Zamknij poprzednie okno TAPNOVA i ponownie uzyj skrotu.' }
        if (-not $oldApp.WaitForExit(10000)) { throw 'Poprzednia TAPNOVA nadal dziala. Zamknij ja i ponownie uzyj skrotu.' }
    }
    Start-Process -FilePath $appPath -WorkingDirectory (Split-Path -Parent $appPath)
} catch {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show($_.Exception.Message, 'TAPNOVA - uruchamianie') | Out-Null
    exit 1
}
