param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Invoke-RgSearch {
    param(
        [string]$Title,
        [string]$Pattern,
        [string]$Path,
        [string]$Why
    )

    Write-Section $Title
    Write-Host $Why
    Write-Host "Command: rg -n --hidden --glob '!node_modules/**' --glob '!supabase/.temp/**' --glob '!.git/**' `"$Pattern`" `"$Path`""

    $rgCommand = Get-Command rg -ErrorAction SilentlyContinue
    if ($rgCommand) {
        & $rgCommand.Path -n --hidden --glob '!node_modules/**' --glob '!supabase/.temp/**' --glob '!.git/**' $Pattern $Path
        if ($LASTEXITCODE -eq 1) {
            Write-Host "No matches found."
        } elseif ($LASTEXITCODE -ne 0) {
            throw "rg exited with code $LASTEXITCODE for pattern: $Pattern"
        }
        return
    }

    $resolvedPath = Resolve-Path $Path -ErrorAction SilentlyContinue
    if (-not $resolvedPath) {
        Write-Host "No matches found."
        return
    }

    $inputPaths = @()
    foreach ($item in Get-ChildItem -Path $resolvedPath.Path -Recurse -File -ErrorAction SilentlyContinue) {
        $fullName = $item.FullName
        if ($fullName -match '\\node_modules\\') { continue }
        if ($fullName -match '\\supabase\\\.temp\\') { continue }
        if ($fullName -match '\\\.git\\') { continue }
        $inputPaths += $fullName
    }

    if ($inputPaths.Count -eq 0) {
        Write-Host "No matches found."
        return
    }

    $matches = Select-String -Path $inputPaths -Pattern $Pattern -AllMatches -CaseSensitive:$false -ErrorAction SilentlyContinue
    if (-not $matches) {
        Write-Host "No matches found."
        return
    }

    foreach ($match in $matches) {
        $line = $match.Line
        $lineNumber = $match.LineNumber
        $pathValue = $match.Path
        Write-Host ("{0}:{1}:{2}" -f $pathValue, $lineNumber, $line)
    }
}

function Invoke-BoundaryCheck {
    param(
        [string]$Title,
        [string]$Path,
        [string]$Why
    )

    Write-Section $Title
    Write-Host $Why
    Write-Host "Command: rg -n --hidden --glob '!node_modules/**' --glob '!supabase/.temp/**' --glob '!.git/**' `"raw_provider_data`" `"$Path`""
    $rgCommand = Get-Command rg -ErrorAction SilentlyContinue
    if ($rgCommand) {
        & $rgCommand.Path -n --hidden --glob '!node_modules/**' --glob '!supabase/.temp/**' --glob '!.git/**' 'raw_provider_data' $Path
        if ($LASTEXITCODE -eq 1) {
            Write-Host "No matches found."
        } elseif ($LASTEXITCODE -ne 0) {
            throw "rg exited with code $LASTEXITCODE for boundary check: $Path"
        }
        return
    }

    $resolvedPath = Resolve-Path $Path -ErrorAction SilentlyContinue
    if (-not $resolvedPath) {
        Write-Host "No matches found."
        return
    }

    $matches = Select-String -Path $resolvedPath.Path -Pattern 'raw_provider_data' -AllMatches -CaseSensitive:$false -ErrorAction SilentlyContinue
    if (-not $matches) {
        Write-Host "No matches found."
        return
    }

    foreach ($match in $matches) {
        Write-Host ("{0}:{1}:{2}" -f $match.Path, $match.LineNumber, $match.Line)
    }
}

Push-Location $RepoRoot
try {
    Write-Host "SportsDataIO boundary audit script"
    Write-Host "Repo root: $RepoRoot"

    Invoke-BoundaryCheck `
        -Title '1) `backend/semantic-layer/normalizer.js`' `
        -Path 'backend/semantic-layer/normalizer.js' `
        -Why 'Decision boundary: no raw provider identity fallback may remain in the normalizer.'

    Invoke-BoundaryCheck `
        -Title '2) `backend/routes/predictions.js`' `
        -Path 'backend/routes/predictions.js' `
        -Why 'Decision boundary: predictions must not read provider payloads directly.'

    Invoke-BoundaryCheck `
        -Title '3) `backend/routes/direct1x2.js`' `
        -Path 'backend/routes/direct1x2.js' `
        -Why 'Decision boundary: 1X2 routing must stay canonical-only.'

    Invoke-BoundaryCheck `
        -Title '4) `backend/controllers/edgeMindController.js`' `
        -Path 'backend/controllers/edgeMindController.js' `
        -Why 'Decision boundary: enrichment logic must not rescue missing semantics from raw payloads.'

    Write-Section 'Audit exit criteria'
    Write-Host 'PASS only if all four files return no raw_provider_data hits.'
    Write-Host 'These are the decision-bearing paths guarded by the boundary contract.'
}
finally {
    Pop-Location
}
